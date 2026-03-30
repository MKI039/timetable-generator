import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import Modal from '../components/Modal';

export default function Faculty() {
  const { faculty, subjects, addFaculty, updateFaculty, deleteFaculty } = useApp();
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState({ name: '', subjectIds: [] });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const openAdd = () => {
    setForm({ name: '', subjectIds: [] });
    setEditId(null);
    setModal('edit');
  };

  const openEdit = (f) => {
    setForm({ name: f.name, subjectIds: f.subjectIds || [] });
    setEditId(f.id);
    setModal('edit');
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editId) {
      await updateFaculty({ id: editId, ...form });
    } else {
      await addFaculty(form);
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this faculty member?')) {
      await deleteFaculty(id);
    }
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

  const filtered = faculty.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

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
                    <input
                      type="checkbox"
                      checked={form.subjectIds.includes(s.id)}
                      onChange={() => toggleSubject(s.id)}
                    />
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
    </div>
  );
}
