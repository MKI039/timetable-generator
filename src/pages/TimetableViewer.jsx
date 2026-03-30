import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import TimetableGrid from '../components/TimetableGrid';
import Modal from '../components/Modal';
import { generateTimetable, buildExistingFacultySchedule } from '../engine/scheduler';
import { exportToExcel, exportToPDF } from '../utils/export';
import { generateId } from '../constants/defaults';
import './TimetableViewer.css';

export default function TimetableViewer() {
  const { faculty, subjects, classes, requirements, timetables, settings,
          addTimetable, updateTimetable, deleteTimetable } = useApp();

  const [searchParams] = useSearchParams();
  const [selectedTtId, setSelectedTtId] = useState(null);
  const [viewMode, setViewMode] = useState('class'); // 'class' | 'faculty'
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [newModal, setNewModal] = useState(false);
  const [newClassId, setNewClassId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [warnings, setWarnings] = useState([]);
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
      const result = generateTimetable(targetRequirements, settings, existingSchedules);
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

  const handleExcelExport = () => {
    if (!selectedTt) return;
    exportToExcel(selectedTt, { faculty, subjects, classes, settings });
  };

  const handlePDFExport = async () => {
    const el = document.getElementById('tt-export-target');
    if (!el || !selectedTt) return;
    await exportToPDF(el, selectedTt.name);
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
          <button className="btn btn-primary" onClick={() => setNewModal(true)}>
            + New Timetable
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="warnings-box">
          <strong>⚠️ {warnings.length} session{warnings.length > 1 ? 's' : ''} could not be scheduled:</strong>
          <ul>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
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
                <button
                  className="tt-list-delete"
                  onClick={(e) => { e.stopPropagation(); handleDeleteTt(tt.id); }}
                  title="Delete"
                >✕</button>
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
