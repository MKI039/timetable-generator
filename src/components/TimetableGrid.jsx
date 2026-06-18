import React, { useEffect, useState } from 'react';
import { useApp } from '../store/AppContext';
import Modal from './Modal';
import { buildExistingFacultySchedule, detectConflicts } from '../engine/scheduler';
import './TimetableGrid.css';

export default function TimetableGrid({ timetable, viewMode = 'class', selectedId }) {
  const { faculty, subjects, classes, settings, timetables } = useApp();
  const [editCell, setEditCell] = useState(null); // { type, id, day, slotId }
  const [editData, setEditData] = useState({});
  const [now, setNow] = useState(() => new Date());
  const { updateTimetable } = useApp();

  const existingFacultySchedules = buildExistingFacultySchedule(timetables || [], timetable.id);
  const conflicts = detectConflicts(timetable.classTimetable || {}, timetable.facultyTimetable || {}, existingFacultySchedules);

  if (!timetable) return <div className="grid-empty">No timetable selected.</div>;

  const activeDays = settings.days.slice(0, settings.daysPerWeek);
  const allSlots = settings.slots;
  const currentDay = now.toLocaleDateString(undefined, { weekday: 'long' });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const getFacultyName = (id) => faculty.find((f) => f.id === id)?.name || '?';
  const getSubjectName = (id) => subjects.find((s) => s.id === id)?.name || '?';
  const getClassName = (id) => classes.find((c) => c.id === id)?.name || '?';

  const parseSlotTime = (time) => {
    const match = String(time).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridian = match[3]?.toLowerCase();

    if (meridian === 'pm' && hour < 12) hour += 12;
    if (meridian === 'am' && hour === 12) hour = 0;
    if (!meridian && hour < 7) hour += 12;

    return hour * 60 + minute;
  };

  const isCurrentSlot = (slot) => {
    const [startLabel, endLabel] = String(slot.label).split(/\s*[-–]\s*/);
    const start = parseSlotTime(startLabel);
    const end = parseSlotTime(endLabel);
    if (start === null || end === null) return false;

    const current = now.getHours() * 60 + now.getMinutes();
    return current >= start && current < end;
  };

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
                <th key={slot.id} className={`${slot.isBreak ? 'tt-break-header' : ''}${isCurrentSlot(slot) ? ' tt-slot-current' : ''}`}>
                  {slot.label}
                  {slot.isBreak && <span className="tt-break-badge">{slot.breakLabel}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDays.map((day) => (
              <tr key={day}>
                <td className={`tt-day-label${day === currentDay ? ' tt-day-label--today' : ''}`}>{day}</td>
                {allSlots.map((slot) => {
                  if (slot.isBreak) {
                    return <td key={slot.id} className={`tt-cell tt-cell--break${day === currentDay && isCurrentSlot(slot) ? ' tt-cell--now' : ''}`}>{slot.breakLabel}</td>;
                  }
                  const cell = dayMap?.[day]?.[String(slot.id)];
                  const isLab = cell?.isLab;
                  const conflictObj = cell ? conflicts.find(c => c.facultyId === cell.facultyId && c.day === day && c.slotId === String(slot.id)) : null;

                  let cellClass = 'tt-cell';
                  if (cell) {
                    if (isLab) cellClass += ' tt-cell--filled tt-cell--lab';
                    else cellClass += ' tt-cell--filled';
                    if (conflictObj) cellClass += ' tt-cell--conflict';
                  } else {
                    cellClass += ' tt-cell--empty';
                  }
                  if (day === currentDay && isCurrentSlot(slot)) cellClass += ' tt-cell--now';

                  return (
                    <td
                      key={slot.id}
                      className={cellClass}
                      onClick={() => {
                        setEditCell({ type: 'class', classId: selectedId, day, slotId: String(slot.id) });
                        setEditData(cell || { subjectId: '', facultyId: '' });
                      }}
                    >
                      {cell ? (
                        <>
                          <span className="tt-subject">
                            {getSubjectName(cell.subjectId)}
                            {isLab && <span className="tt-lab-tag">🔬 Lab</span>}
                          </span>
                          <span className="tt-faculty">{getFacultyName(cell.facultyId)}</span>
                          {conflictObj && (
                            <span className="tt-conflict-badge" title={conflictObj.message}>
                              ⚠️ Busy in "{conflictObj.otherTtName}"
                            </span>
                          )}
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
                <th key={slot.id} className={`${slot.isBreak ? 'tt-break-header' : ''}${isCurrentSlot(slot) ? ' tt-slot-current' : ''}`}>
                  {slot.label}
                  {slot.isBreak && <span className="tt-break-badge">{slot.breakLabel}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDays.map((day) => (
              <tr key={day}>
                <td className={`tt-day-label${day === currentDay ? ' tt-day-label--today' : ''}`}>{day}</td>
                {allSlots.map((slot) => {
                  if (slot.isBreak) {
                    return <td key={slot.id} className={`tt-cell tt-cell--break${day === currentDay && isCurrentSlot(slot) ? ' tt-cell--now' : ''}`}>{slot.breakLabel}</td>;
                  }
                  const cell = dayMap?.[day]?.[String(slot.id)];
                  const isLab = cell?.isLab;
                  const otherTtName = existingFacultySchedules[selectedId]?.[day]?.[String(slot.id)];

                  let cellClass = 'tt-cell';
                  if (cell) {
                    if (isLab) cellClass += ' tt-cell--filled tt-cell--lab';
                    else cellClass += ' tt-cell--filled';
                    if (otherTtName) cellClass += ' tt-cell--conflict';
                  } else {
                    cellClass += ' tt-cell--empty';
                    if (otherTtName) cellClass += ' tt-cell--conflict';
                  }
                  if (day === currentDay && isCurrentSlot(slot)) cellClass += ' tt-cell--now';

                  return (
                    <td
                      key={slot.id}
                      className={cellClass}
                    >
                      {cell ? (
                        <>
                          <span className="tt-subject">
                            {getSubjectName(cell.subjectId)}
                            {isLab && <span className="tt-lab-tag">🔬 Lab</span>}
                          </span>
                          <span className="tt-faculty">{getClassName(cell.classId)}</span>
                          {otherTtName && (
                            <span className="tt-conflict-badge">
                              ⚠️ Busy in "{otherTtName}"
                            </span>
                          )}
                        </>
                      ) : otherTtName ? (
                        <>
                          <span className="tt-empty-label">—</span>
                          <span className="tt-conflict-badge">
                            ⚠️ Busy in "{otherTtName}"
                          </span>
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
              {faculty.map((f) => {
                const busyInTt = existingFacultySchedules[f.id]?.[editCell.day]?.[editCell.slotId];
                return (
                  <option key={f.id} value={f.id}>
                    {f.name} {busyInTt ? `(⚠️ Busy - in "${busyInTt}")` : ''}
                  </option>
                );
              })}
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
