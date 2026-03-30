import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import Modal from './Modal';
import './TimetableGrid.css';

export default function TimetableGrid({ timetable, viewMode = 'class', selectedId }) {
  const { faculty, subjects, classes, settings } = useApp();
  const [editCell, setEditCell] = useState(null); // { type, id, day, slotId }
  const [editData, setEditData] = useState({});
  const { updateTimetable } = useApp();

  if (!timetable) return <div className="grid-empty">No timetable selected.</div>;

  const activeDays = settings.days.slice(0, settings.daysPerWeek);
  const allSlots = settings.slots;

  const getFacultyName = (id) => faculty.find((f) => f.id === id)?.name || '?';
  const getSubjectName = (id) => subjects.find((s) => s.id === id)?.name || '?';
  const getClassName = (id) => classes.find((c) => c.id === id)?.name || '?';

  // --- Class view ---
  const renderClassView = () => {
    const dayMap = timetable.classTimetable?.[selectedId];
    if (!dayMap) return <div className="grid-empty">No data for this class.</div>;

    return (
      <div className="tt-grid-wrapper" id="tt-export-target">
        <table className="tt-grid">
          <thead>
            <tr>
              <th className="tt-corner">Day / Time</th>
              {allSlots.map((slot) => (
                <th key={slot.id} className={slot.isBreak ? 'tt-break-header' : ''}>
                  {slot.label}
                  {slot.isBreak && <span className="tt-break-badge">{slot.breakLabel}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDays.map((day) => (
              <tr key={day}>
                <td className="tt-day-label">{day}</td>
                {allSlots.map((slot) => {
                  if (slot.isBreak) {
                    return <td key={slot.id} className="tt-cell tt-cell--break">{slot.breakLabel}</td>;
                  }
                  const cell = dayMap?.[day]?.[String(slot.id)];
                  return (
                    <td
                      key={slot.id}
                      className={`tt-cell${cell ? ' tt-cell--filled' : ' tt-cell--empty'}`}
                      onClick={() => {
                        setEditCell({ type: 'class', classId: selectedId, day, slotId: String(slot.id) });
                        setEditData(cell || { subjectId: '', facultyId: '' });
                      }}
                    >
                      {cell ? (
                        <>
                          <span className="tt-subject">{getSubjectName(cell.subjectId)}</span>
                          <span className="tt-faculty">{getFacultyName(cell.facultyId)}</span>
                        </>
                      ) : (
                        <span className="tt-empty-label">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // --- Faculty view ---
  const renderFacultyView = () => {
    const dayMap = timetable.facultyTimetable?.[selectedId];
    if (!dayMap) return <div className="grid-empty">No data for this faculty.</div>;

    return (
      <div className="tt-grid-wrapper" id="tt-export-target">
        <table className="tt-grid">
          <thead>
            <tr>
              <th className="tt-corner">Day / Time</th>
              {allSlots.map((slot) => (
                <th key={slot.id} className={slot.isBreak ? 'tt-break-header' : ''}>
                  {slot.label}
                  {slot.isBreak && <span className="tt-break-badge">{slot.breakLabel}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDays.map((day) => (
              <tr key={day}>
                <td className="tt-day-label">{day}</td>
                {allSlots.map((slot) => {
                  if (slot.isBreak) {
                    return <td key={slot.id} className="tt-cell tt-cell--break">{slot.breakLabel}</td>;
                  }
                  const cell = dayMap?.[day]?.[String(slot.id)];
                  return (
                    <td
                      key={slot.id}
                      className={`tt-cell${cell ? ' tt-cell--filled' : ' tt-cell--empty'}`}
                    >
                      {cell ? (
                        <>
                          <span className="tt-subject">{getSubjectName(cell.subjectId)}</span>
                          <span className="tt-faculty">{getClassName(cell.classId)}</span>
                        </>
                      ) : (
                        <span className="tt-empty-label">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // --- Edit modal ---
  const handleSaveEdit = async () => {
    if (!editCell) return;
    const { classId, day, slotId } = editCell;
    const updated = JSON.parse(JSON.stringify(timetable));

    if (!updated.classTimetable[classId]) updated.classTimetable[classId] = {};
    if (!updated.classTimetable[classId][day]) updated.classTimetable[classId][day] = {};

    const oldCell = updated.classTimetable[classId][day][slotId];
    const newAssignment = editData.subjectId && editData.facultyId ? editData : null;

    // Remove old faculty assignment
    if (oldCell?.facultyId && updated.facultyTimetable[oldCell.facultyId]) {
      updated.facultyTimetable[oldCell.facultyId][day][slotId] = null;
    }

    updated.classTimetable[classId][day][slotId] = newAssignment;

    // Assign new faculty
    if (newAssignment?.facultyId) {
      if (!updated.facultyTimetable[newAssignment.facultyId]) updated.facultyTimetable[newAssignment.facultyId] = {};
      if (!updated.facultyTimetable[newAssignment.facultyId][day]) updated.facultyTimetable[newAssignment.facultyId][day] = {};
      updated.facultyTimetable[newAssignment.facultyId][day][slotId] = {
        classId,
        subjectId: newAssignment.subjectId,
      };
    }

    await updateTimetable(updated);
    setEditCell(null);
  };

  return (
    <>
      {viewMode === 'class' ? renderClassView() : renderFacultyView()}

      {editCell && (
        <Modal title="Edit Time Slot" onClose={() => setEditCell(null)} size="sm">
          <div className="form-group">
            <label>Subject</label>
            <select
              value={editData.subjectId || ''}
              onChange={(e) => setEditData((d) => ({ ...d, subjectId: e.target.value }))}
            >
              <option value="">— Clear —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Faculty</label>
            <select
              value={editData.facultyId || ''}
              onChange={(e) => setEditData((d) => ({ ...d, facultyId: e.target.value }))}
            >
              <option value="">— Clear —</option>
              {faculty.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setEditCell(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveEdit}>Save</button>
          </div>
        </Modal>
      )}
    </>
  );
}
