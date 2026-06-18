import { generateTimetable } from '../engine/scheduler';

self.onmessage = (event) => {
  const { id, requirements, settings, existingSchedules } = event.data;

  try {
    const result = generateTimetable(requirements, settings, existingSchedules);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'Failed to generate timetable.',
    });
  }
};
