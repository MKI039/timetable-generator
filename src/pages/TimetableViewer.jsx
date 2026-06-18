import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import TimetableGrid from '../components/TimetableGrid';
import Modal from '../components/Modal';
import { generateTimetable, buildExistingFacultySchedule } from '../engine/scheduler';
import { updateExistingTimetable } from '../engine/timetableUpdater';
import { exportToExcel, exportToPDF } from '../utils/export';
import './TimetableViewer.css';

function generateInWorker(requirements, settings, existingSchedules) {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(generateTimetable(requirements, settings, existingSchedules));
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/schedulerWorker.js', import.meta.url), { type: 'module' });
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

    worker.onmessage = (event) => {
      if (event.data.id !== id) return;
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Scheduler worker failed.'));
    };
    worker.postMessage({ id, requirements, settings, existingSchedules });
  }).catch(() => generateTimetable(requirements, settings, existingSchedules));
}

export default function TimetableViewer() {
  const { faculty, subjects, classes, requirements, timetables, settings,
          addTimetable, updateTimetable, deleteTimetable } = useApp();

  const getFacultyName = (id) => faculty.find((f) => f.id === id)?.name || 'Unknown Faculty';
  const getSubjectName = (id) => subjects.find((s) => s.id === id)?.name || 'Unknown Subject';
  const getClassName = (id) => {
    const c = classes.find((classObj) => classObj.id === id);
    return c ? `${c.name}${c.section ? ` (${c.section})` : ''}` : 'Unknown Class';
  };

  const [searchParams] = useSearchParams();
  const [selectedTtId, setSelectedTtId] = useState(null);
  const [viewMode, setViewMode] = useState('class'); // 'class' | 'faculty'
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [newModal, setNewModal] = useState(false);
  const [newClassId, setNewClassId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [updatingExisting, setUpdatingExisting] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [toast, setToast] = useState(null);
  const [resetConfirmTtId, setResetConfirmTtId] = useState(null);
  const toastTimerRef = useRef(null);
  const gridRef = useRef(null);

  // Sync from URL param
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && timetables.find((t) => t.id === id)) {
      setSelectedTtId(id);
    } else if (timetables.length > 0 && !selectedTtId) {
      setSelectedTtId(timetables[timetables.length - 1].id);
    }
  }, [searchParams, timetables]);

  const selectedTt = timetables.find((t) => t.id === selectedTtId);

  // Auto-pick first entity when view mode or timetable changes
  useEffect(() => {
    if (viewMode === 'class' && classes.length > 0) {
      if (selectedTt && selectedTt.classId) {
        setSelectedEntityId(selectedTt.classId);
      } else {
        setSelectedEntityId(classes[0].id);
      }
    } else if (viewMode === 'faculty' && faculty.length > 0) {
      setSelectedEntityId(faculty[0].id);
    }
  }, [viewMode, selectedTtId, classes, faculty, selectedTt]);

  const handleGenerate = async () => {
    if (!selectedTt) return;
    setGenerating(true);
    setWarnings([]);
    try {
      const existingSchedules = buildExistingFacultySchedule(timetables, selectedTtId);
      const targetRequirements = selectedTt.classId
        ? requirements.filter((r) => r.classId === selectedTt.classId)
        : requirements;
      const result = await generateInWorker(targetRequirements, settings, existingSchedules);
      const updated = {
        ...selectedTt,
        classTimetable: result.classTimetable,
        facultyTimetable: result.facultyTimetable,
        generatedAt: new Date().toISOString(),
      };
      await updateTimetable(updated);
      setWarnings(result.warnings || []);
    } finally {
      setGenerating(false);
    }
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  };

  const handleUpdateExisting = async () => {
    if (!selectedTt) return;
    setUpdatingExisting(true);
    setWarnings([]);

    try {
      const result = updateExistingTimetable(selectedTt, requirements, settings, timetables);

      if (result.added > 0) {
        await updateTimetable({
          ...result.timetable,
          generatedAt: selectedTt.generatedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      setWarnings(result.warnings || []);

      if (result.warnings.length > 0) {
        showToast('error', `Could not place ${result.warnings.length} new session${result.warnings.length > 1 ? 's' : ''}. Check warnings for details.`);
      } else if (result.added > 0) {
        showToast('success', `Updated timetable with ${result.added} new session${result.added > 1 ? 's' : ''}.`);
      } else {
        showToast('info', 'Timetable is already up to date.');
      }
    } finally {
      setUpdatingExisting(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newClassId) return;
    const selectedClass = classes.find(c => c.id === newClassId);
    if (!selectedClass) return;
    const ttName = `${selectedClass.name}${selectedClass.section ? ` (${selectedClass.section})` : ''}`;
    const tt = await addTimetable({
      name: ttName,
      classId: newClassId,
      classTimetable: {},
      facultyTimetable: {},
    });
    setSelectedTtId(tt.id);
    setNewModal(false);
    setNewClassId('');
  };

  const handleDeleteTt = async (id) => {
    if (!window.confirm('Delete this timetable?')) return;
    await deleteTimetable(id);
    setSelectedTtId(timetables.filter((t) => t.id !== id)[0]?.id || null);
  };

  // Reset = clear all grid data but keep the timetable record
  const handleResetTt = async (id) => {
    const tt = timetables.find((t) => t.id === id);
    if (!tt) return;
    await updateTimetable({ ...tt, classTimetable: {}, facultyTimetable: {}, generatedAt: null });
    setResetConfirmTtId(null);
  };

  const handleExcelExport = () => {
    if (!selectedTt) return;
    exportToExcel(selectedTt, { faculty, subjects, classes, settings });
  };

  const handlePDFExport = async () => {
    if (!selectedTt) return;
    await exportToPDF(selectedTt, { faculty, subjects, classes, settings });
  };

  const entityList = viewMode === 'class'
    ? (selectedTt?.classId ? classes.filter(c => c.id === selectedTt.classId) : classes)
    : faculty;
  const getEntityLabel = (e) => viewMode === 'class'
    ? `${e.name}${e.section ? ` (${e.section})` : ''}`
    : e.name;

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable Viewer</h1>
          <p className="page-subtitle">
            {timetables.length} timetable{timetables.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleExcelExport} disabled={!selectedTt}>
            📥 Excel
          </button>
          <button className="btn btn-secondary" onClick={handlePDFExport} disabled={!selectedTt}>
            📄 PDF
          </button>
          <button
            className="btn btn-accent"
            onClick={handleGenerate}
            disabled={generating || !selectedTt || requirements.length === 0}
          >
            {generating ? '⏳ Generating...' : '⚡ Generate'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleUpdateExisting}
            disabled={generating || updatingExisting || !selectedTt || requirements.length === 0}
          >
            {updatingExisting ? 'Updating...' : 'Update Existing'}
          </button>
          <button className="btn btn-primary" onClick={() => setNewModal(true)}>
            + New Timetable
          </button>
        </div>
      </div>

      {toast && (
        <div className={`toast-message toast-message--${toast.type}`}>
          {toast.message}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="warnings-box">
          <strong>⚠️ {warnings.length} session{warnings.length > 1 ? 's' : ''} could not be scheduled due to constraints:</strong>
          <div className="warnings-list" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {warnings.map((w, i) => {
              const facName = getFacultyName(w.facultyId);
              const subName = getSubjectName(w.subjectId);
              const clsName = getClassName(w.classId);

              let reasonText = '';
              if (w.type === 'lab') {
                if (w.reason === 'class_busy') reasonText = `Class ${clsName} has no remaining 2-hour consecutive slots.`;
                else if (w.reason === 'faculty_busy') reasonText = `Faculty ${facName} is fully booked during consecutive slot options.`;
                else if (w.reason === 'no_consecutive_slots') reasonText = `No empty 2-hour consecutive slot is available for Class ${clsName} and Faculty ${facName}.`;
                else reasonText = `No matching 2-hour consecutive slots were mutually free for Class ${clsName} and Faculty ${facName}.`;
              } else {
                if (w.reason === 'class_busy') reasonText = `Class ${clsName} is fully occupied with other subjects.`;
                else if (w.reason === 'faculty_busy') reasonText = `Faculty ${facName} is fully occupied at all matching free slots.`;
                else if (w.reason === 'no_empty_slots') reasonText = `No valid empty slot is available without breaking timetable constraints.`;
                else if (w.reason === 'attempt_limit') reasonText = 'Scheduling stopped after reaching the safety attempt limit.';
                else if (w.reason === 'daily_limit_violation') reasonText = `Adding this session violates the constraint of max 1 theory class of "${subName}" per day.`;
                else reasonText = `No matching time slots were mutually free for Class ${clsName} and Faculty ${facName}.`;
              }

              return (
                <div key={i} className="warning-card" style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  color: '#f87171',
                  textAlign: 'left'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                    ❌ {w.type === 'lab' ? '🔬 Lab' : '📖 Theory'} Session: {subName} for {clsName} ({facName})
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {reasonText}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="tt-layout">
        {/* Left panel: timetable list */}
        <div className="tt-list-panel">
          <div className="panel-header">Timetables</div>
          {timetables.length === 0 ? (
            <div className="panel-empty">No timetables yet.<br/>Click "+ New Timetable".</div>
          ) : (
            timetables.map((tt) => (
              <div
                key={tt.id}
                className={`tt-list-item${tt.id === selectedTtId ? ' tt-list-item--active' : ''}`}
                onClick={() => setSelectedTtId(tt.id)}
              >
                <div className="tt-list-name">🗓️ {tt.name}</div>
                <div className="tt-list-meta">{new Date(tt.createdAt).toLocaleDateString()}</div>
                <div className="tt-list-actions" onClick={(e) => e.stopPropagation()}>
                  {resetConfirmTtId === tt.id ? (
                    <>
                      <button
                        className="tt-list-btn tt-list-btn--confirm"
                        onClick={() => handleResetTt(tt.id)}
                        title="Confirm reset"
                      >✓</button>
                      <button
                        className="tt-list-btn"
                        onClick={() => setResetConfirmTtId(null)}
                        title="Cancel"
                      >✕</button>
                    </>
                  ) : (
                    <button
                      className="tt-list-btn tt-list-btn--warn"
                      onClick={() => setResetConfirmTtId(tt.id)}
                      title="Reset timetable (clear all slots)"
                    >🔄</button>
                  )}
                  <button
                    className="tt-list-delete"
                    onClick={() => handleDeleteTt(tt.id)}
                    title="Delete"
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Main panel */}
        <div className="tt-main-panel">
          {!selectedTt ? (
            <div className="empty-state">
              <p>Select or create a timetable to get started.</p>
              <button className="btn btn-primary" onClick={() => setNewModal(true)}>+ New Timetable</button>
            </div>
          ) : (
            <>
              <div className="tt-controls">
                {/* View mode toggle */}
                <div className="view-toggle">
                  <button
                    className={`view-btn${viewMode === 'class' ? ' view-btn--active' : ''}`}
                    onClick={() => setViewMode('class')}
                  >🏫 Section View</button>
                  <button
                    className={`view-btn${viewMode === 'faculty' ? ' view-btn--active' : ''}`}
                    onClick={() => setViewMode('faculty')}
                  >👤 Faculty View</button>
                </div>

                {/* Entity selector */}
                <select
                  className="entity-select"
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                >
                  {entityList.map((e) => (
                    <option key={e.id} value={e.id}>{getEntityLabel(e)}</option>
                  ))}
                </select>
              </div>

              {/* Generated at info */}
              {selectedTt.generatedAt && (
                <div className="generated-info">
                  Last generated: {new Date(selectedTt.generatedAt).toLocaleString()} · Click any class cell to edit
                </div>
              )}

              <div ref={gridRef}>
                {generating && (
                  <div className="tt-generating-banner">
                    <span className="tt-spinner" />
                    Generating timetable...
                  </div>
                )}
                <TimetableGrid
                  timetable={selectedTt}
                  viewMode={viewMode}
                  selectedId={selectedEntityId}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {newModal && (
        <Modal title="New Timetable" onClose={() => setNewModal(false)} size="sm">
          <div className="form-group">
            <label>Select Class / Section *</label>
            <select
              value={newClassId}
              onChange={(e) => setNewClassId(e.target.value)}
              autoFocus
            >
              <option value="">— Select a Class —</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.section ? ` (${c.section})` : ''}
                </option>
              ))}
            </select>
            <p className="form-hint">A unique timetable will be generated specifically for this class.</p>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setNewModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateNew} disabled={!newClassId}>Create</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
