/**
 * Timetable Scheduling Engine
 *
 * Greedy + backtracking scheduler that generates conflict-free timetables.
 * Cross-timetable faculty conflicts are checked against existingFacultySchedules.
 */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build the merged faculty schedule from all OTHER saved timetables.
 * Returns: { [facultyId]: { [day]: { [slotId]: true } } }
 */
export function buildExistingFacultySchedule(allTimetables, excludeId = null) {
  const schedule = {};
  for (const tt of allTimetables) {
    if (tt.id === excludeId) continue;
    const ft = tt.facultyTimetable || {};
    for (const [facultyId, days] of Object.entries(ft)) {
      if (!schedule[facultyId]) schedule[facultyId] = {};
      for (const [day, slots] of Object.entries(days)) {
        if (!schedule[facultyId][day]) schedule[facultyId][day] = {};
        for (const [slotId, assignment] of Object.entries(slots)) {
          if (assignment) {
            schedule[facultyId][day][slotId] = true;
          }
        }
      }
    }
  }
  return schedule;
}

/**
 * Main scheduler function.
 *
 * @param {Array} requirements  - array of { id, facultyId, classId, subjectId, hoursPerWeek }
 * @param {Object} settings     - { daysPerWeek, slots, days }
 * @param {Object} existingFacultySchedules - merged cross-timetable faculty block data
 * @returns {{ classTimetable, facultyTimetable, unscheduled, warnings }}
 */
export function generateTimetable(requirements, settings, existingFacultySchedules = {}) {
  const { daysPerWeek, slots, days } = settings;
  const activeDays = days.slice(0, daysPerWeek);
  const teachingSlotIds = slots.filter((s) => !s.isBreak).map((s) => String(s.id));

  // classTimetable[classId][day][slotId] = { subjectId, facultyId } | null
  const classTimetable = {};
  // facultyTimetable[facultyId][day][slotId] = { classId, subjectId } | null
  const facultyTimetable = {};

  const initClass = (classId) => {
    if (!classTimetable[classId]) {
      classTimetable[classId] = {};
      for (const day of activeDays) {
        classTimetable[classId][day] = {};
        for (const slotId of teachingSlotIds) {
          classTimetable[classId][day][slotId] = null;
        }
      }
    }
  };

  const initFaculty = (facultyId) => {
    if (!facultyTimetable[facultyId]) {
      facultyTimetable[facultyId] = {};
      for (const day of activeDays) {
        facultyTimetable[facultyId][day] = {};
        for (const slotId of teachingSlotIds) {
          facultyTimetable[facultyId][day][slotId] = null;
        }
      }
    }
  };

  // Initialize structures
  for (const req of requirements) {
    initClass(req.classId);
    initFaculty(req.facultyId);
  }

  // Expand requirements into individual session units
  let sessions = [];
  for (const req of requirements) {
    for (let i = 0; i < req.hoursPerWeek; i++) {
      sessions.push({
        reqId: req.id,
        facultyId: req.facultyId,
        classId: req.classId,
        subjectId: req.subjectId,
      });
    }
  }

  // Shuffle for balanced distribution
  sessions = shuffle(sessions);

  const unscheduled = [];
  const warnings = [];

  const place = (session, day, slotId) => {
    classTimetable[session.classId][day][slotId] = {
      subjectId: session.subjectId,
      facultyId: session.facultyId,
    };
    facultyTimetable[session.facultyId][day][slotId] = {
      classId: session.classId,
      subjectId: session.subjectId,
    };
  };

  const unplace = (session, day, slotId) => {
    classTimetable[session.classId][day][slotId] = null;
    facultyTimetable[session.facultyId][day][slotId] = null;
  };

  const isFacultyBusy = (facultyId, day, slotId) => {
    // Check within current timetable
    if (facultyTimetable[facultyId]?.[day]?.[slotId]) return true;
    // Check cross-timetable conflicts
    if (existingFacultySchedules[facultyId]?.[day]?.[slotId]) return true;
    return false;
  };

  const isClassBusy = (classId, day, slotId) => {
    return !!classTimetable[classId]?.[day]?.[slotId];
  };

  const findSlot = (session) => {
    // Shuffle days & slots for fair distribution
    const dayOrder = shuffle(activeDays);
    const slotOrder = shuffle(teachingSlotIds);

    for (const day of dayOrder) {
      for (const slotId of slotOrder) {
        if (!isClassBusy(session.classId, day, slotId) && !isFacultyBusy(session.facultyId, day, slotId)) {
          return { day, slotId };
        }
      }
    }
    return null;
  };

  // --- Greedy pass ---
  const placed = [];
  for (const session of sessions) {
    const slot = findSlot(session);
    if (slot) {
      place(session, slot.day, slot.slotId);
      placed.push({ session, ...slot });
    } else {
      // --- Backtracking: try displacing an already-placed session ---
      let resolved = false;
      for (const candidate of shuffle(placed)) {
        // Only displace a different session that shares faculty or class with conflict session
        if (
          candidate.session.classId !== session.classId &&
          candidate.session.facultyId !== session.facultyId
        )
          continue;

        // Temporarily remove the candidate
        unplace(candidate.session, candidate.day, candidate.slotId);

        const newSlot = findSlot(session);
        if (newSlot) {
          // Re-place displaced candidate elsewhere
          const altSlot = findSlot(candidate.session);
          if (altSlot) {
            place(session, newSlot.day, newSlot.slotId);
            placed.push({ session, ...newSlot });
            place(candidate.session, altSlot.day, altSlot.slotId);
            candidate.day = altSlot.day;
            candidate.slotId = altSlot.slotId;
            resolved = true;
            break;
          }
        }
        // Restore if backtracking failed
        place(candidate.session, candidate.day, candidate.slotId);
      }

      if (!resolved) {
        unscheduled.push(session);
        warnings.push(
          `Could not schedule: Faculty "${session.facultyId}" → Class "${session.classId}" (Subject "${session.subjectId}")`
        );
      }
    }
  }

  return { classTimetable, facultyTimetable, unscheduled, warnings };
}

/**
 * Detect conflicts in a given timetable (post-generation validation).
 * Returns array of conflict descriptors.
 */
export function detectConflicts(classTimetable, facultyTimetable, existingFacultySchedules = {}) {
  const conflicts = [];

  // Check cross-timetable faculty conflicts
  for (const [facultyId, days] of Object.entries(facultyTimetable)) {
    for (const [day, slots] of Object.entries(days)) {
      for (const [slotId, assignment] of Object.entries(slots)) {
        if (assignment && existingFacultySchedules[facultyId]?.[day]?.[slotId]) {
          conflicts.push({
            type: 'faculty-cross',
            facultyId,
            day,
            slotId,
            message: `Faculty ${facultyId} is double-booked on ${day} slot ${slotId} (cross-timetable)`,
          });
        }
      }
    }
  }

  return conflicts;
}
