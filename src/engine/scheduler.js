/**
 * Timetable Scheduling Engine
 *
 * Greedy + backtracking scheduler that generates conflict-free timetables.
 * Cross-timetable faculty conflicts are checked against existingFacultySchedules.
 * Supports lab sessions: 2-hour consecutive blocks with slot-pair priority.
 *
 * Rules enforced:
 *  1. Max 1 theory class of the same subject per class per day.
 *  2. If a lab is placed on a day for a subject, theory for that subject is
 *     avoided on that same day — only allowed as a last resort.
 *  3. The 6th teaching slot (last period) is only used when earlier slots are full.
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
          if (assignment) schedule[facultyId][day][slotId] = true;
        }
      }
    }
  }
  return schedule;
}

/**
 * Determine preferred lab slot pairs from the teaching slot IDs.
 * Priority: positions [2,3] → [4,5] → [0,1]
 */
function getLabSlotPairs(teachingSlotIds) {
  const sorted = [...teachingSlotIds].sort((a, b) => Number(a) - Number(b));
  const pairs = [];
  if (sorted.length >= 4) pairs.push([sorted[2], sorted[3]]);
  if (sorted.length >= 6) pairs.push([sorted[4], sorted[5]]);
  if (sorted.length >= 2) pairs.push([sorted[0], sorted[1]]);
  for (let i = 0; i < sorted.length - 1; i++) {
    const p = [sorted[i], sorted[i + 1]];
    if (!pairs.some(([a, b]) => a === p[0] && b === p[1])) pairs.push(p);
  }
  return pairs;
}

/**
 * Split teaching slots: first 5 are preferred (mandatory hours),
 * the 6th slot is fallback-only (optional last period).
 */
function splitSlotsByPriority(teachingSlotIds) {
  const sorted = [...teachingSlotIds].sort((a, b) => Number(a) - Number(b));
  if (sorted.length <= 5) return { preferred: sorted, fallback: [] };
  return { preferred: sorted.slice(0, 5), fallback: sorted.slice(5) };
}

/**
 * Main scheduler function.
 *
 * @param {Array} requirements  - { id, facultyId, classId, subjectId, hoursPerWeek, labHours? }
 * @param {Object} settings     - { daysPerWeek, slots, days }
 * @param {Object} existingFacultySchedules
 * @returns {{ classTimetable, facultyTimetable, unscheduled, warnings }}
 */
export function generateTimetable(requirements, settings, existingFacultySchedules = {}) {
  const { daysPerWeek, slots, days } = settings;
  const activeDays = days.slice(0, daysPerWeek);
  const teachingSlotIds = slots.filter((s) => !s.isBreak).map((s) => String(s.id));

  const labSlotPairs = getLabSlotPairs(teachingSlotIds);
  const { preferred: preferredSlots, fallback: fallbackSlots } = splitSlotsByPriority(teachingSlotIds);

  const classTimetable = {};
  const facultyTimetable = {};

  const initClass = (classId) => {
    if (!classTimetable[classId]) {
      classTimetable[classId] = {};
      for (const day of activeDays) {
        classTimetable[classId][day] = {};
        for (const slotId of teachingSlotIds) classTimetable[classId][day][slotId] = null;
      }
    }
  };

  const initFaculty = (facultyId) => {
    if (!facultyTimetable[facultyId]) {
      facultyTimetable[facultyId] = {};
      for (const day of activeDays) {
        facultyTimetable[facultyId][day] = {};
        for (const slotId of teachingSlotIds) facultyTimetable[facultyId][day][slotId] = null;
      }
    }
  };

  for (const req of requirements) {
    initClass(req.classId);
    initFaculty(req.facultyId);
  }

  // --- Build session lists ---
  let theorySessions = [];
  let labSessions = [];

  for (const req of requirements) {
    for (let i = 0; i < (req.hoursPerWeek || 0); i++) {
      theorySessions.push({ reqId: req.id, facultyId: req.facultyId, classId: req.classId, subjectId: req.subjectId, isLab: false });
    }
    for (let i = 0; i < (req.labHours || 0); i++) {
      labSessions.push({ reqId: req.id, facultyId: req.facultyId, classId: req.classId, subjectId: req.subjectId, isLab: true });
    }
  }

  theorySessions = shuffle(theorySessions);
  labSessions = shuffle(labSessions);

  const unscheduled = [];
  const warnings = [];

  // --- Day-usage trackers (Rule 1 & 2) ---
  // Separate trackers so we can distinguish "only lab on day" vs "theory on day"
  const theoryDayUsed = {}; // [classId][subjectId][day] = true
  const labDayUsed = {};    // [classId][subjectId][day] = true

  const markDay = (tracker, classId, subjectId, day) => {
    tracker[classId] ??= {};
    tracker[classId][subjectId] ??= {};
    tracker[classId][subjectId][day] = true;
  };
  const unmarkDay = (tracker, classId, subjectId, day) => {
    if (tracker[classId]?.[subjectId]) delete tracker[classId][subjectId][day];
  };
  const hasTheoryOnDay = (classId, subjectId, day) => !!theoryDayUsed[classId]?.[subjectId]?.[day];
  const hasLabOnDay    = (classId, subjectId, day) => !!labDayUsed[classId]?.[subjectId]?.[day];
  const hasAnyOnDay    = (classId, subjectId, day) => hasTheoryOnDay(classId, subjectId, day) || hasLabOnDay(classId, subjectId, day);

  // --- Slot helpers ---
  const placeTheory = (session, day, slotId) => {
    classTimetable[session.classId][day][slotId] = { subjectId: session.subjectId, facultyId: session.facultyId };
    facultyTimetable[session.facultyId][day][slotId] = { classId: session.classId, subjectId: session.subjectId };
    markDay(theoryDayUsed, session.classId, session.subjectId, day);
  };
  const unplaceTheory = (session, day, slotId) => {
    classTimetable[session.classId][day][slotId] = null;
    facultyTimetable[session.facultyId][day][slotId] = null;
    unmarkDay(theoryDayUsed, session.classId, session.subjectId, day);
  };
  const placeLab = (session, day, slotId1, slotId2) => {
    classTimetable[session.classId][day][slotId1] = { subjectId: session.subjectId, facultyId: session.facultyId, isLab: true, labPair: slotId2 };
    classTimetable[session.classId][day][slotId2] = { subjectId: session.subjectId, facultyId: session.facultyId, isLab: true, labPair: slotId1 };
    facultyTimetable[session.facultyId][day][slotId1] = { classId: session.classId, subjectId: session.subjectId, isLab: true, labPair: slotId2 };
    facultyTimetable[session.facultyId][day][slotId2] = { classId: session.classId, subjectId: session.subjectId, isLab: true, labPair: slotId1 };
    markDay(labDayUsed, session.classId, session.subjectId, day); // prevent theory landing same day
  };

  const isFacultyBusy = (facultyId, day, slotId) =>
    !!(facultyTimetable[facultyId]?.[day]?.[slotId]) ||
    !!(existingFacultySchedules[facultyId]?.[day]?.[slotId]);

  const isClassBusy = (classId, day, slotId) => !!classTimetable[classId]?.[day]?.[slotId];

  /**
   * Find a theory slot obeying:
   *   Pass 1: preferred slots, day has NO theory or lab of this subject
   *   Pass 2: fallback slots, day has NO theory or lab of this subject
   *   Pass 3 (last resort): preferred slots, day has a lab but no theory yet (theory+lab combo)
   *   Pass 4 (absolute last resort): any slot, only blocking theory+theory on same day
   */
  const findTheorySlot = (session) => {
    const { classId, subjectId, facultyId } = session;
    const dayOrder = shuffle(activeDays);
    const prefShuffled = shuffle(preferredSlots);

    // Pass 1: preferred, day clean
    for (const day of dayOrder) {
      if (hasAnyOnDay(classId, subjectId, day)) continue;
      for (const slotId of prefShuffled) {
        if (!isClassBusy(classId, day, slotId) && !isFacultyBusy(facultyId, day, slotId))
          return { day, slotId };
      }
    }
    // Pass 2: fallback slot, day clean
    for (const day of dayOrder) {
      if (hasAnyOnDay(classId, subjectId, day)) continue;
      for (const slotId of fallbackSlots) {
        if (!isClassBusy(classId, day, slotId) && !isFacultyBusy(facultyId, day, slotId))
          return { day, slotId };
      }
    }
    // Pass 3: preferred, day has lab but no theory — theory+lab combo, last resort
    for (const day of dayOrder) {
      if (hasTheoryOnDay(classId, subjectId, day)) continue; // never theory+theory
      for (const slotId of prefShuffled) {
        if (!isClassBusy(classId, day, slotId) && !isFacultyBusy(facultyId, day, slotId))
          return { day, slotId };
      }
    }
    // Pass 4: absolute last resort — any slot, block only theory+theory
    for (const day of dayOrder) {
      if (hasTheoryOnDay(classId, subjectId, day)) continue;
      for (const slotId of [...prefShuffled, ...fallbackSlots]) {
        if (!isClassBusy(classId, day, slotId) && !isFacultyBusy(facultyId, day, slotId))
          return { day, slotId };
      }
    }
    return null;
  };

  const findLabSlot = (session) => {
    const dayOrder = shuffle(activeDays);
    for (const day of dayOrder) {
      for (const [s1, s2] of labSlotPairs) {
        if (!isClassBusy(session.classId, day, s1) && !isFacultyBusy(session.facultyId, day, s1) &&
            !isClassBusy(session.classId, day, s2) && !isFacultyBusy(session.facultyId, day, s2)) {
          return { day, slotId1: s1, slotId2: s2 };
        }
      }
    }
    return null;
  };

  // --- Schedule labs first (harder: need 2 consecutive free slots) ---
  for (const session of labSessions) {
    const slot = findLabSlot(session);
    if (slot) {
      placeLab(session, slot.day, slot.slotId1, slot.slotId2);
    } else {
      unscheduled.push(session);
      warnings.push(`Could not schedule lab: Faculty "${session.facultyId}" → Class "${session.classId}" (Subject "${session.subjectId}")`);
    }
  }

  // --- Greedy pass for theory sessions ---
  const placed = [];
  for (const session of theorySessions) {
    const slot = findTheorySlot(session);
    if (slot) {
      placeTheory(session, slot.day, slot.slotId);
      placed.push({ session, day: slot.day, slotId: slot.slotId });
    } else {
      // Backtracking: displace an already-placed theory session
      let resolved = false;
      for (const candidate of shuffle(placed)) {
        if (candidate.session.classId !== session.classId && candidate.session.facultyId !== session.facultyId) continue;
        unplaceTheory(candidate.session, candidate.day, candidate.slotId);
        const newSlot = findTheorySlot(session);
        if (newSlot) {
          const altSlot = findTheorySlot(candidate.session);
          if (altSlot) {
            placeTheory(session, newSlot.day, newSlot.slotId);
            placed.push({ session, day: newSlot.day, slotId: newSlot.slotId });
            placeTheory(candidate.session, altSlot.day, altSlot.slotId);
            candidate.day = altSlot.day;
            candidate.slotId = altSlot.slotId;
            resolved = true;
            break;
          }
        }
        placeTheory(candidate.session, candidate.day, candidate.slotId);
      }
      if (!resolved) {
        unscheduled.push(session);
        warnings.push(`Could not schedule: Faculty "${session.facultyId}" → Class "${session.classId}" (Subject "${session.subjectId}")`);
      }
    }
  }

  return { classTimetable, facultyTimetable, unscheduled, warnings };
}

/**
 * Post-generation conflict detection.
 */
export function detectConflicts(classTimetable, facultyTimetable, existingFacultySchedules = {}) {
  const conflicts = [];
  for (const [facultyId, days] of Object.entries(facultyTimetable)) {
    for (const [day, slots] of Object.entries(days)) {
      for (const [slotId, assignment] of Object.entries(slots)) {
        if (assignment && existingFacultySchedules[facultyId]?.[day]?.[slotId]) {
          conflicts.push({ type: 'faculty-cross', facultyId, day, slotId,
            message: `Faculty ${facultyId} is double-booked on ${day} slot ${slotId} (cross-timetable)` });
        }
      }
    }
  }
  return conflicts;
}
