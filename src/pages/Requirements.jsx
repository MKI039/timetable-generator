import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import Modal from '../components/Modal';

export default function Workload() {
  const {
    faculty, subjects, classes, requirements,
    timetables, updateTimetable,
    addRequirement, updateRequirement, deleteRequirement,
  } = useApp();

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ facultyId: '', classId: '', subjectId: '', hoursPerWeek: 1, labHours: 0 });
  const [editId, setEditId] = useState(null);
  // resetConfirmReqId stores the requirement *id* (not classId) pending inline confirm
  const [resetConfirmReqId, setResetConfirmReqId] = useState(null);

  const openAdd = () => {
    setForm({ facultyId: '', classId: '', subjectId: '', hoursPerWeek: 1, labHours: 0 });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (r) => {
    setForm({ facultyId: r.facultyId, classId: r.classId, subjectId: r.subjectId, hoursPerWeek: r.hoursPerWeek, labHours: r.labHours || 0 });
    setEditId(r.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.facultyId || !form.classId || !form.subjectId || Number(form.hoursPerWeek) < 1) return;
    const payload = { ...form, hoursPerWeek: Number(form.hoursPerWeek), labHours: Number(form.labHours) || 0 };
    if (editId) await updateRequirement({ id: editId, ...payload });
    else await addRequirement(payload);
    setModal(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this workload entry?')) await deleteRequirement(id);
  };

  /**
   * Reset only the slots for this specific workload entry
   * (faculty + subject + class) in the timetable — leaves other subjects untouched.
   */
  const handleResetEntry = async (req) => {
    const tt = timetables.find((t) => t.classId === req.classId);
    if (!tt) { setResetConfirmReqId(null); return; }

    const newCT = JSON.parse(JSON.stringify(tt.classTimetable || {}));
    const newFT = JSON.parse(JSON.stringify(tt.facultyTimetable || {}));

    // Clear matching cells in classTimetable
    for (const classId of Object.keys(newCT)) {
      for (const day of Object.keys(newCT[classId])) {
        for (const slotId of Object.keys(newCT[classId][day])) {
          const cell = newCT[classId][day][slotId];
          if (cell && cell.subjectId === req.subjectId && cell.facultyId === req.facultyId) {
            newCT[classId][day][slotId] = null;
          }
        }
      }
    }

    // Clear matching cells in facultyTimetable
    for (const facultyId of Object.keys(newFT)) {
      for (const day of Object.keys(newFT[facultyId])) {
        for (const slotId of Object.keys(newFT[facultyId][day])) {
          const cell = newFT[facultyId][day][slotId];
          if (cell && cell.classId === req.classId && cell.subjectId === req.subjectId) {
            newFT[facultyId][day][slotId] = null;
          }
        }
      }
    }

    await updateTimetable({ ...tt, classTimetable: newCT, facultyTimetable: newFT });
    setResetConfirmReqId(null);
  };

  const getName = (arr, id) => arr.find((x) => x.id === id);
  const getFacultyName = (id) => getName(faculty, id)?.name || '?';
  const getClassName = (id) => { const c = getName(classes, id); return c ? `${c.name}${c.section ? ` (${c.section})` : ''}` : '?'; };
  const getSubjectName = (id) => getName(subjects, id)?.name || '?';
  const getTimetableForClass = (classId) => timetables.find((t) => t.classId === classId);

  const hasEntrySlots = (req) => {
    const tt = getTimetableForClass(req.classId);
    if (!tt?.classTimetable) return false;          
    for (const days of Object.values(tt.classTimetable)) {
      for (const slots of Object.values(days)) {
        for (const cell of Object.values(slots)) {
          if (cell && cell.subjectId === req.subjectId && cell.facultyId === req.facultyId) return true;
        }
      }
    }
    return false;
  };

  const totalHours = requirements.reduce((s, r) => s + (r.hoursPerWeek || 0) + (r.labHours || 0) * 2, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workload</h1>
          <p className="page-subtitle">{requirements.length} entries · {totalHours} weekly hours total</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Workload</button>
      </div>

      {requirements.length === 0 ? (
        <div className="empty-state">
          <p>No workload defined. Add faculty → class → subject → hours/week mappings here.</p>
          <button className="btn btn-primary" onClick={openAdd}>Add first entry</button>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Faculty</th>
                <th>Class / Section</th>
                <th>Subject</th>
                <th>Hours/Week</th>
                <th>Lab Hours</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((r, i) => (
                <tr key={r.id}>
                  <td className="td-num">{i + 1}</td>
                  <td className="td-name">{getFacultyName(r.facultyId)}</td>
                  <td>{getClassName(r.classId)}</td>
                  <td><span className="tag">{getSubjectName(r.subjectId)}</span></td>
                  <td><span className="badge badge--accent">{r.hoursPerWeek}h</span></td>
                  <td>
                    {(r.labHours || 0) > 0
                      ? <span className="badge badge--lab">🔬 {r.labHours} lab ({r.labHours * 2}h)</span>
                      : <span className="td-muted">—</span>}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(r)} title="Edit workload">✏️</button>

                      {/* Inline confirm reset for this specific subject's slots only */}
                      {hasEntrySlots(r) && (
                        resetConfirmReqId === r.id ? (
                          <>
                            <button
                              className="btn-icon btn-icon--warn-confirm"
                              onClick={() => handleResetEntry(r)}
                              title="Confirm: clear this subject's scheduled slots"
                            >✓</button>
                            <button className="btn-icon" onClick={() => setResetConfirmReqId(null)} title="Cancel">✕</button>
                          </>
                        ) : (
                          <button
                            className="btn-icon btn-icon--warn"
                            onClick={() => setResetConfirmReqId(r.id)}
                            title={`Clear scheduled slots for ${getSubjectName(r.subjectId)} in ${getClassName(r.classId)}`}
                          >🔄</button>
                        )
                      )}

                      <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(r.id)} title="Delete workload entry">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={editId ? 'Edit Workload' : 'Add Workload'} onClose={() => setModal(false)}>
          <div className="form-row">
            <div className="form-group">
              <label>Faculty *</label>
              <select value={form.facultyId} onChange={(e) => setForm((f) => ({ ...f, facultyId: e.target.value }))}>
                <option value="">— Select Faculty —</option>
                {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Class / Section *</label>
              <select value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}>
                <option value="">— Select Class —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Subject *</label>
              <select value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}>
                <option value="">— Select Subject —</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Theory Hours/Week *</label>
              <input type="number" min="0" max="30" value={form.hoursPerWeek}
                onChange={(e) => setForm((f) => ({ ...f, hoursPerWeek: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>🔬 Lab Hours/Week</label>
              <input type="number" min="0" max="10" value={form.labHours}
                onChange={(e) => setForm((f) => ({ ...f, labHours: e.target.value }))} />
              <p className="form-hint">
                Each lab hour = a 2-hour block scheduled together.<br />
                Priority: slots 3&amp;4 → 5&amp;6 → 1&amp;2.
              </p>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
