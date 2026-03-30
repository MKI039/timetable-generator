import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { DEFAULT_SETTINGS, DEFAULT_SLOTS, DEFAULT_DAYS } from '../constants/defaults';
import './Settings.css';

export default function Settings() {
  const { settings, updateSettings } = useApp();
  const [form, setForm] = useState(() => ({
    daysPerWeek: settings.daysPerWeek,
    slots: JSON.parse(JSON.stringify(settings.slots)),
    days: [...settings.days],
  }));
  const [saved, setSaved] = useState(false);

  const handleSlotChange = (index, field, value) => {
    const newSlots = [...form.slots];
    newSlots[index] = { ...newSlots[index], [field]: field === 'isBreak' ? value : value };
    setForm((f) => ({ ...f, slots: newSlots }));
  };

  const handleAddSlot = () => {
    setForm((f) => ({
      ...f,
      slots: [...f.slots, { id: Date.now(), label: 'New Slot', isBreak: false, breakLabel: '' }],
    }));
  };

  const handleRemoveSlot = (index) => {
    setForm((f) => ({ ...f, slots: f.slots.filter((_, i) => i !== index) }));
  };

  const handleDayChange = (index, value) => {
    const newDays = [...form.days];
    newDays[index] = value;
    setForm((f) => ({ ...f, days: newDays }));
  };

  const handleSave = async () => {
    // Re-index slot IDs
    const updatedSlots = form.slots.map((s, i) => ({ ...s, id: i + 1 }));
    await updateSettings({ ...form, slots: updatedSlots });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setForm({
      daysPerWeek: DEFAULT_SETTINGS.daysPerWeek,
      slots: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.slots)),
      days: [...DEFAULT_SETTINGS.days],
    });
  };

  const teachingSlots = form.slots.filter((s) => !s.isBreak);
  const totalHoursPerDay = teachingSlots.length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure working days, time slots, and break periods</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleReset}>Reset to Default</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '✅ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="settings-grid">
        {/* Working Days */}
        <div className="settings-card">
          <h2 className="settings-card-title">Working Days</h2>
          <div className="form-group">
            <label>Days per Week</label>
            <input
              type="number" min="1" max="7"
              value={form.daysPerWeek}
              onChange={(e) => setForm((f) => ({ ...f, daysPerWeek: parseInt(e.target.value) || 5 }))}
              style={{ width: 100 }}
            />
            <p className="form-hint">Only the first {form.daysPerWeek} day names below will be used.</p>
          </div>
          <div className="days-grid">
            {form.days.map((d, i) => (
              <div key={i} className={`day-item${i >= form.daysPerWeek ? ' day-item--inactive' : ''}`}>
                <span className="day-num">{i + 1}</span>
                <input
                  type="text"
                  value={d}
                  onChange={(e) => handleDayChange(i, e.target.value)}
                  className="day-input"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Time Slots */}
        <div className="settings-card settings-card--wide">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="settings-card-title" style={{ margin: 0 }}>
              Time Slots
              <span className="slot-summary">{totalHoursPerDay} teaching slots · {form.slots.filter(s => s.isBreak).length} breaks</span>
            </h2>
            <button className="btn btn-secondary btn-sm" onClick={handleAddSlot}>+ Add Slot</button>
          </div>

          <div className="slots-list">
            {form.slots.map((slot, i) => (
              <div key={slot.id} className={`slot-row${slot.isBreak ? ' slot-row--break' : ''}`}>
                <span className="slot-num">{i + 1}</span>
                <input
                  className="slot-label-input"
                  type="text"
                  value={slot.label}
                  placeholder="e.g. 9:00 - 9:50"
                  onChange={(e) => handleSlotChange(i, 'label', e.target.value)}
                />
                <label className="slot-break-toggle">
                  <input
                    type="checkbox"
                    checked={slot.isBreak}
                    onChange={(e) => handleSlotChange(i, 'isBreak', e.target.checked)}
                  />
                  Break
                </label>
                {slot.isBreak && (
                  <input
                    className="slot-break-name"
                    type="text"
                    value={slot.breakLabel || ''}
                    placeholder="Break name"
                    onChange={(e) => handleSlotChange(i, 'breakLabel', e.target.value)}
                  />
                )}
                <button
                  className="btn-icon btn-icon--danger"
                  onClick={() => handleRemoveSlot(i)}
                  title="Remove"
                >🗑️</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
