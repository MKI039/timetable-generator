export const DEFAULT_SLOTS = [
  { id: 1, label: '9:00 - 9:50', isBreak: false },
  { id: 2, label: '9:50 - 10:40', isBreak: false },
  { id: 3, label: '10:40 - 11:00', isBreak: true, breakLabel: 'Short Break' },
  { id: 4, label: '11:00 - 11:50', isBreak: false },
  { id: 5, label: '11:50 - 12:40', isBreak: false },
  { id: 6, label: '12:40 - 1:40', isBreak: true, breakLabel: 'Lunch Break' },
  { id: 7, label: '1:40 - 2:30', isBreak: false },
  { id: 8, label: '2:30 - 3:20', isBreak: false },
];

export const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DEFAULT_SETTINGS = {
  daysPerWeek: 5,
  slots: DEFAULT_SLOTS,
  days: DEFAULT_DAYS,
};

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
