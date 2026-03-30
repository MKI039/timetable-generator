import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import Modal from '../components/Modal';

export default function Requirements() {
  const { faculty, subjects, classes, requirements, addRequirement, updateRequirement, deleteRequirement } = useApp();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ facultyId: '', classId: '', subjectId: '', hoursPerWeek: 1 });
  const [editId, setEditId] = useState(null);

  const openAdd = () => {
    setForm({ facultyId: '', classId: '', subjectId: '', hoursPerWeek: 1 });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (r) => {
    setForm({ facultyId: r.facultyId, classId: r.classId, subjectId: r.subjectId, hoursPerWeek: r.hoursPerWeek });
    setEditId(r.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.facultyId || !form.classId || !form.subjectId || form.hoursPerWeek < 1) return;
    if (editId) await updateRequirement({ id: editId, ...form, hoursPerWeek: Number(form.hoursPerWeek) });
    else await addRequirement({ ...form, hoursPerWeek: Number(form.hoursPerWeek) });
    setModal(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this requirement?')) await deleteRequirement(id);
  };

  const getName = (arr, id) => arr.find((x) => x.id === id);
  const getFacultyName = (id) => getName(faculty, id)?.name || '?';
  const getClassName = (id) => {
    const c = getName(classes, id);
    return c ? `${c.name}${c.section ? ` (${c.section})` : ''}` : '?';
  };
  const getSubjectName = (id) => getName(subjects, id)?.name || '?';

  const totalHours = requirements.reduce((s, r) => s + (r.hoursPerWeek || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Requirements</h1>
          <p className="page-subtitle">{requirements.length} requirements · {totalHours} weekly hours total</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Requirement</button>
      </div>

      {requirements.length === 0 ? (
        <div className="empty-state">
          <p>No requirements defined. Define faculty → class → subject → hours/week mappings here.</p>
          <button className="btn btn-primary" onClick={openAdd}>Add first requirement</button>
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
                  <td>
                    <span className="badge badge--accent">{r.hoursPerWeek}h</span>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(r)}>✏️</button>
                      <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(r.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={editId ? 'Edit Requirement' : 'Add Requirement'} onClose={() => setModal(false)}>
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
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>
                ))}
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
              <label>Hours per Week *</label>
              <input type="number" min="1" max="30" value={form.hoursPerWeek}
                onChange={(e) => setForm((f) => ({ ...f, hoursPerWeek: e.target.value }))} />
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
