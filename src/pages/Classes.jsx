import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import Modal from '../components/Modal';

export default function Classes() {
  const { classes, addClass, updateClass, deleteClass } = useApp();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', section: '' });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const openAdd = () => { setForm({ name: '', section: '' }); setEditId(null); setModal(true); };
  const openEdit = (c) => { setForm({ name: c.name, section: c.section || '' }); setEditId(c.id); setModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editId) await updateClass({ id: editId, ...form });
    else await addClass(form);
    setModal(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this class?')) await deleteClass(id);
  };

  const filtered = classes.filter((c) =>
    `${c.name} ${c.section}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Classes / Sections</h1>
          <p className="page-subtitle">{classes.length} classes registered</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Class</button>
      </div>

      <div className="toolbar">
        <input className="search-input" type="text" placeholder="Search classes..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No classes found.</p>
          <button className="btn btn-primary" onClick={openAdd}>Add your first class</button>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>#</th><th>Class Name</th><th>Section</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id}>
                  <td className="td-num">{i + 1}</td>
                  <td className="td-name">{c.name}</td>
                  <td><span className="tag">{c.section || '—'}</span></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(c)}>✏️</button>
                      <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(c.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={editId ? 'Edit Class' : 'Add Class'} onClose={() => setModal(false)} size="sm">
          <div className="form-group">
            <label>Class Name *</label>
            <input type="text" placeholder="e.g. BSc Computer Science 2nd Year"
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div className="form-group">
            <label>Section</label>
            <input type="text" placeholder="e.g. Section A"
              value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} />
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
