import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import Modal from '../components/Modal';

export default function Faculty() {
  const { faculty, subjects, classes, timetables, settings, addFaculty, updateFaculty, deleteFaculty } = useApp();
  const [modal, setModal] = useState(null); // null | 'edit' | 'timetable'
  const [form, setForm] = useState({ name: '', subjectIds: [] });
  const [editId, setEditId] = useState(null);
  const [viewFacultyId, setViewFacultyId] = useState(null);
  const [search, setSearch] = useState('');

  const openAdd = () => { setForm({ name: '', subjectIds: [] }); setEditId(null); setModal('edit'); };
  const openEdit = (f) => { setForm({ name: f.name, subjectIds: f.subjectIds || [] }); setEditId(f.id); setModal('edit'); };

  const openTimetable = (fId) => { setViewFacultyId(fId); setModal('timetable'); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editId) await updateFaculty({ id: editId, ...form });
    else await addFaculty(form);
    setModal(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this faculty member?')) await deleteFaculty(id);
  };

  const toggleSubject = (id) => {
    setForm((f) => ({
      ...f,
      subjectIds: f.subjectIds.includes(id)
        ? f.subjectIds.filter((s) => s !== id)
        : [...f.subjectIds, id],
    }));
  };

  const getSubjectName = (id) => subjects.find((s) => s.id === id)?.name || id;
  const getClassName   = (id) => { const c = classes.find((x) => x.id === id); return c ? `${c.name}${c.section ? ` (${c.section})` : ''}` : '?'; };
  const getSubjectById = (id) => subjects.find((s) => s.id === id);

  const filtered = faculty.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  /**
   * Build this faculty's combined timetable by merging their data across ALL timetables.
   * Returns { [day]: { [slotId]: { subjectId, classId, isLab? } | null } }
   */
  const buildCombinedFacultyTT = (fId) => {
    const combined = {};
    for (const tt of timetables) {
      const ftData = tt.facultyTimetable?.[fId];
      if (!ftData) continue;
      for (const [day, slots] of Object.entries(ftData)) {
        if (!combined[day]) combined[day] = {};
        for (const [slotId, cell] of Object.entries(slots)) {
          if (cell && !combined[day][slotId]) {
            combined[day][slotId] = cell;
          }
        }
      }
    }
    return combined;
  };

  // Total weekly hours for a faculty across all timetables
  const getFacultyWeeklyHours = (fId) => {
    let count = 0;
    for (const tt of timetables) {
      const ftData = tt.facultyTimetable?.[fId];
      if (!ftData) continue;
      for (const days of Object.values(ftData)) {
        for (const cell of Object.values(days)) {
          if (cell && !cell.labPair) count++; // count each slot once (lab counted once per slot pair)
        }
      }
    }
    return count;
  };

  // ---- Faculty Timetable Modal Content ----
  const renderFacultyTimetable = () => {
    if (!viewFacultyId) return null;
    const fac = faculty.find((f) => f.id === viewFacultyId);
    const combinedTT = buildCombinedFacultyTT(viewFacultyId);
    const activeDays = (settings?.days || []).slice(0, settings?.daysPerWeek || 5);
    const allSlots = settings?.slots || [];
    const hasSessions = activeDays.some((day) =>
      allSlots.some((slot) => !slot.isBreak && combinedTT[day]?.[String(slot.id)])
    );

    return (
      <Modal
        title={`${fac?.name || '?'} — Weekly Timetable`}
        onClose={() => setModal(null)}
        size="lg"
      >
        {!hasSessions ? (
          <div className="faculty-tt-empty">
            <p>No scheduled sessions found for this faculty.<br/>Generate timetables first.</p>
          </div>
        ) : (
          <div className="faculty-tt-wrapper">
            <div className="faculty-tt-scroll">
              <table className="faculty-tt-grid">
                <thead>
                  <tr>
                    <th className="ftt-corner">Day / Period</th>
                    {allSlots.map((slot) => (
                      <th key={slot.id} className={slot.isBreak ? 'ftt-break-header' : 'ftt-slot-header'}>
                        <div className="ftt-slot-label">{slot.isBreak ? (slot.breakLabel || 'Break') : slot.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((day) => (
                    <tr key={day}>
                      <td className="ftt-day-label">{day}</td>
                      {allSlots.map((slot) => {
                        if (slot.isBreak) {
                          return <td key={slot.id} className="ftt-cell ftt-cell--break">{slot.breakLabel}</td>;
                        }
                        const cell = combinedTT[day]?.[String(slot.id)];
                        const isLab = cell?.isLab;
                        const subject = cell ? getSubjectById(cell.subjectId) : null;
                        const className = cell ? getClassName(cell.classId) : null;
                        return (
                          <td key={slot.id} className={`ftt-cell${cell ? (isLab ? ' ftt-cell--lab' : ' ftt-cell--filled') : ' ftt-cell--empty'}`}>
                            {cell ? (
                              <>
                                <span className="ftt-subject">
                                  {subject?.name || '?'}
                                  {isLab && <span className="ftt-lab-tag">🔬</span>}
                                </span>
                                <span className="ftt-class">{className}</span>
                              </>
                            ) : (
                              <span className="ftt-empty">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="faculty-tt-footer">
              <span>Total scheduled: <strong>{getFacultyWeeklyHours(viewFacultyId)} periods/week</strong></span>
              <span className="ftt-legend">
                <span className="ftt-legend-dot ftt-legend-dot--theory"></span>Theory&nbsp;&nbsp;
                <span className="ftt-legend-dot ftt-legend-dot--lab"></span>Lab
              </span>
            </div>
          </div>
        )}
      </Modal>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty</h1>
          <p className="page-subtitle">{faculty.length} members registered</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Faculty</button>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          type="text"
          placeholder="Search faculty..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No faculty members found.</p>
          <button className="btn btn-primary" onClick={openAdd}>Add your first faculty member</button>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Assigned Subjects</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={f.id}>
                  <td className="td-num">{i + 1}</td>
                  <td className="td-name">{f.name}</td>
                  <td>
                    <div className="tag-list">
                      {(f.subjectIds || []).length === 0 ? (
                        <span className="tag-empty">No subjects</span>
                      ) : (
                        (f.subjectIds || []).map((sid) => (
                          <span key={sid} className="tag">{getSubjectName(sid)}</span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button
                        className="btn-icon btn-icon--timetable"
                        onClick={() => openTimetable(f.id)}
                        title="View this faculty's complete weekly timetable"
                      >📅</button>
                      <button className="btn-icon" onClick={() => openEdit(f)} title="Edit">✏️</button>
                      <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(f.id)} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Add faculty modal */}
      {modal === 'edit' && (
        <Modal title={editId ? 'Edit Faculty' : 'Add Faculty'} onClose={() => setModal(null)}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              placeholder="e.g. Dr. Sharma"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Assigned Subjects</label>
            {subjects.length === 0 ? (
              <p className="form-hint">Add subjects first.</p>
            ) : (
              <div className="checkbox-grid">
                {subjects.map((s) => (
                  <label key={s.id} className="checkbox-item">
                    <input type="checkbox" checked={form.subjectIds.includes(s.id)} onChange={() => toggleSubject(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </div>
        </Modal>
      )}

      {/* Individual faculty timetable modal */}
      {modal === 'timetable' && renderFacultyTimetable()}
    </div>
  );
}
