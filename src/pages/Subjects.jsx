import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import Modal from '../components/Modal';

export default function Subjects() {
  const { subjects, addSubject, updateSubject, deleteSubject } = useApp();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '' });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const openAdd = () => { setForm({ name: '', code: '' }); setEditId(null); setModal(true); };
  const openEdit = (s) => { setForm({ name: s.name, code: s.code || '' }); setEditId(s.id); setModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editId) await updateSubject({ id: editId, ...form });
    else await addSubject(form);
    setModal(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this subject?')) await deleteSubject(id);
  };

  const filtered = subjects.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects.length} subjects defined</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Subject</button>
      </div>

      <div className="toolbar">
        <input className="search-input" type="text" placeholder="Search subjects..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No subjects found.</p>
          <button className="btn btn-primary" onClick={openAdd}>Add your first subject</button>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>#</th><th>Subject Name</th><th>Code</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id}>
                  <td className="td-num">{i + 1}</td>
                  <td className="td-name">{s.name}</td>
                  <td><span className="tag">{s.code || '—'}</span></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(s)}>✏️</button>
                      <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(s.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={editId ? 'Edit Subject' : 'Add Subject'} onClose={() => setModal(false)} size="sm">
          <div className="form-group">
            <label>Subject Name *</label>
            <input type="text" placeholder="e.g. Mathematics" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div className="form-group">
            <label>Subject Code</label>
            <input type="text" placeholder="e.g. MATH101" value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
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
