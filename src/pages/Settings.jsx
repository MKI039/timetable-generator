import React, { useState, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { DEFAULT_SETTINGS } from '../constants/defaults';
import './Settings.css';

const BACKUP_ARRAY_KEYS = ['faculty', 'subjects', 'classes', 'requirements', 'timetables'];
const BACKUP_KEYS = ['version', ...BACKUP_ARRAY_KEYS, 'settings'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeString(value) {
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]*>/g, '');
}

function sanitizeBackupValue(value) {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeBackupValue);
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, sanitizeBackupValue(entry)])
  );
}

function validateBackupData(data) {
  if (!isPlainObject(data)) throw new Error('Backup must be a JSON object.');

  const unknownKeys = Object.keys(data).filter((key) => !BACKUP_KEYS.includes(key));
  if (unknownKeys.length) throw new Error(`Unknown backup key: ${unknownKeys[0]}`);

  for (const key of BACKUP_ARRAY_KEYS) {
    if (!Array.isArray(data[key])) throw new Error(`Missing or invalid "${key}" array.`);
    if (!data[key].every(isPlainObject)) throw new Error(`"${key}" must contain only objects.`);
  }

  if (!isPlainObject(data.settings)) throw new Error('Missing or invalid "settings" object.');
  if (!Array.isArray(data.settings.days)) throw new Error('Missing or invalid settings.days.');
  if (!Array.isArray(data.settings.slots)) throw new Error('Missing or invalid settings.slots.');
  if (!Number.isInteger(data.settings.daysPerWeek)) throw new Error('Missing or invalid settings.daysPerWeek.');

  return sanitizeBackupValue(data);
}

export default function Settings() {
  const {
    settings,
    updateSettings,
    faculty,
    subjects,
    classes,
    requirements,
    timetables,
    importBackupData,
  } = useApp();

  const [form, setForm] = useState(() => ({
    daysPerWeek: settings.daysPerWeek,
    slots: JSON.parse(JSON.stringify(settings.slots)),
    days: [...settings.days],
  }));
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleExportBackup = () => {
    const backupData = {
      version: 1,
      faculty,
      subjects,
      classes,
      requirements,
      timetables,
      settings,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `timetable-backup-${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = validateBackupData(JSON.parse(event.target.result));

        const proceed = window.confirm(
          'WARNING: Importing this backup will overwrite all current settings, classes, subjects, faculty lists, and saved timetables. Do you want to proceed?'
        );
        if (!proceed) return;

        setImportStatus('⌛ Restoring backup...');
        await importBackupData(data);
        setImportStatus('✅ Backup Restored Successfully!');
        setTimeout(() => setImportStatus(''), 3000);
      } catch (err) {
        console.error(err);
        alert('Backup import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };


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

      <div className="backup-section" style={{ marginTop: '24px' }}>
        <div className="settings-card">
          <h2 className="settings-card-title">📦 Data Backup & Restore</h2>
          <p className="form-hint" style={{ marginBottom: '16px' }}>
            Export all configurations, schedules, and settings as a JSON backup file to save locally, or restore a previously saved backup file.
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={handleExportBackup}>
              📥 Export Backup (.json)
            </button>
            <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
              📤 Restore from Backup
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportBackup}
              accept=".json"
              style={{ display: 'none' }}
            />
            {importStatus && (
              <span className={`import-status-text ${importStatus.includes('✅') ? 'status-success' : 'status-pending'}`} style={{ marginLeft: '12px', fontWeight: '500' }}>
                {importStatus}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
