import { buildExistingFacultySchedule } from './scheduler';

function getActiveDays(settings) {
  return (settings.days || []).slice(0, settings.daysPerWeek || 5);
}

function getTeachingSlotIds(settings) {
  return (settings.slots || []).filter((slot) => !slot.isBreak).map((slot) => String(slot.id));
}

function getLabSlotPairs(teachingSlotIds) {
  const sorted = [...teachingSlotIds].sort((a, b) => Number(a) - Number(b));
  const pairs = [];
  if (sorted.length >= 4) pairs.push([sorted[2], sorted[3]]);
  if (sorted.length >= 6) pairs.push([sorted[4], sorted[5]]);
  if (sorted.length >= 2) pairs.push([sorted[0], sorted[1]]);
  for (let i = 0; i < sorted.length - 1; i++) {
    const pair = [sorted[i], sorted[i + 1]];
    if (!pairs.some(([a, b]) => a === pair[0] && b === pair[1])) pairs.push(pair);
  }
  return pairs;
}

function splitSlotsByPriority(teachingSlotIds) {
  const sorted = [...teachingSlotIds].sort((a, b) => Number(a) - Number(b));
  if (sorted.length <= 5) return { preferred: sorted, fallback: [] };
  return { preferred: sorted.slice(0, 5), fallback: sorted.slice(5) };
}

function initClass(classTimetable, classId, activeDays, teachingSlotIds) {
  classTimetable[classId] ??= {};
  for (const day of activeDays) {
    classTimetable[classId][day] ??= {};
    for (const slotId of teachingSlotIds) classTimetable[classId][day][slotId] ??= null;
  }
}

function initFaculty(facultyTimetable, facultyId, activeDays, teachingSlotIds) {
  facultyTimetable[facultyId] ??= {};
  for (const day of activeDays) {
    facultyTimetable[facultyId][day] ??= {};
    for (const slotId of teachingSlotIds) facultyTimetable[facultyId][day][slotId] ??= null;
  }
}

function buildDayTrackers(classTimetable) {
  const theoryDayUsed = {};
  const labDayUsed = {};

  const mark = (tracker, classId, subjectId, day) => {
    tracker[classId] ??= {};
    tracker[classId][subjectId] ??= {};
    tracker[classId][subjectId][day] = true;
  };

  for (const [classId, dayMap] of Object.entries(classTimetable || {})) {
    for (const [day, slots] of Object.entries(dayMap || {})) {
      for (const cell of Object.values(slots || {})) {
        if (!cell) continue;
        mark(cell.isLab ? labDayUsed : theoryDayUsed, classId, cell.subjectId, day);
      }
    }
  }

  return { theoryDayUsed, labDayUsed, mark };
}

function countScheduledForRequirement(classTimetable, req) {
  let theory = 0;
  let labCells = 0;
  const dayMap = classTimetable?.[req.classId] || {};

  for (const slots of Object.values(dayMap)) {
    for (const cell of Object.values(slots || {})) {
      if (!cell || cell.subjectId !== req.subjectId || cell.facultyId !== req.facultyId) continue;
      if (cell.isLab) labCells += 1;
      else theory += 1;
    }
  }

  return { theory, labs: Math.floor(labCells / 2) };
}

function requirementKey({ classId, facultyId, subjectId }) {
  return `${classId}::${facultyId}::${subjectId}`;
}

function collectScheduledCells(classTimetable, req, activeDays, teachingSlotIds) {
  const theory = [];
  const labs = new Map();
  const dayMap = classTimetable?.[req.classId] || {};

  for (const day of activeDays) {
    for (const slotId of teachingSlotIds) {
      const cell = dayMap?.[day]?.[slotId];
      if (!cell || cell.subjectId !== req.subjectId || cell.facultyId !== req.facultyId) continue;

      if (!cell.isLab) {
        theory.push({ classId: req.classId, day, slotId });
        continue;
      }

      const pairKey = [day, slotId, cell.labPair].sort().join('::');
      if (!labs.has(pairKey)) labs.set(pairKey, []);
      labs.get(pairKey).push({ classId: req.classId, day, slotId });
    }
  }

  return { theory, labs: [...labs.values()] };
}

function createMissingSessions(classTimetable, requirements) {
  const sessions = [];

  for (const req of requirements) {
    const scheduled = countScheduledForRequirement(classTimetable, req);
    const missingTheory = Math.max(0, Number(req.hoursPerWeek || 0) - scheduled.theory);
    const missingLabs = Math.max(0, Number(req.labHours || 0) - scheduled.labs);

    for (let i = 0; i < missingLabs; i++) {
      sessions.push({ ...req, type: 'lab' });
    }
    for (let i = 0; i < missingTheory; i++) {
      sessions.push({ ...req, type: 'theory' });
    }
  }

  return sessions;
}

export function updateExistingTimetable(timetable, requirements, settings, allTimetables) {
  const activeDays = getActiveDays(settings);
  const teachingSlotIds = getTeachingSlotIds(settings);
  const labSlotPairs = getLabSlotPairs(teachingSlotIds);
  const { preferred, fallback } = splitSlotsByPriority(teachingSlotIds);
  const existingFacultySchedules = buildExistingFacultySchedule(allTimetables, timetable.id);

  const updated = {
    ...timetable,
    classTimetable: JSON.parse(JSON.stringify(timetable.classTimetable || {})),
    facultyTimetable: JSON.parse(JSON.stringify(timetable.facultyTimetable || {})),
  };

  const targetRequirements = timetable.classId
    ? requirements.filter((req) => req.classId === timetable.classId)
    : requirements;
  const targetRequirementKeys = new Set(targetRequirements.map(requirementKey));

  for (const req of targetRequirements) {
    initClass(updated.classTimetable, req.classId, activeDays, teachingSlotIds);
    initFaculty(updated.facultyTimetable, req.facultyId, activeDays, teachingSlotIds);
  }

  let removed = 0;

  const clearClassSlot = (classId, day, slotId) => {
    const cell = updated.classTimetable[classId]?.[day]?.[slotId];
    if (!cell) return;

    updated.classTimetable[classId][day][slotId] = null;
    if (updated.facultyTimetable[cell.facultyId]?.[day]?.[slotId]) {
      updated.facultyTimetable[cell.facultyId][day][slotId] = null;
    }
    removed += 1;
  };

  for (const classId of Object.keys(updated.classTimetable)) {
    if (timetable.classId && classId !== timetable.classId) continue;
    for (const day of Object.keys(updated.classTimetable[classId] || {})) {
      for (const slotId of Object.keys(updated.classTimetable[classId][day] || {})) {
        const cell = updated.classTimetable[classId][day][slotId];
        if (!cell) continue;
        if (!targetRequirementKeys.has(requirementKey({ classId, facultyId: cell.facultyId, subjectId: cell.subjectId }))) {
          clearClassSlot(classId, day, slotId);
        }
      }
    }
  }

  for (const req of targetRequirements) {
    const scheduled = collectScheduledCells(updated.classTimetable, req, activeDays, teachingSlotIds);
    const allowedTheory = Number(req.hoursPerWeek || 0);
    const allowedLabs = Number(req.labHours || 0);

    for (const cell of scheduled.theory.slice(allowedTheory)) {
      clearClassSlot(cell.classId, cell.day, cell.slotId);
    }

    for (const labCells of scheduled.labs.slice(allowedLabs)) {
      for (const cell of labCells) {
        clearClassSlot(cell.classId, cell.day, cell.slotId);
      }
    }
  }

  const { theoryDayUsed, labDayUsed, mark } = buildDayTrackers(updated.classTimetable);
  const hasTheoryOnDay = (classId, subjectId, day) => !!theoryDayUsed[classId]?.[subjectId]?.[day];
  const hasAnyOnDay = (classId, subjectId, day) =>
    !!theoryDayUsed[classId]?.[subjectId]?.[day] || !!labDayUsed[classId]?.[subjectId]?.[day];

  const isClassBusy = (classId, day, slotId) => !!updated.classTimetable[classId]?.[day]?.[slotId];
  const isFacultyBusy = (facultyId, day, slotId) =>
    !!updated.facultyTimetable[facultyId]?.[day]?.[slotId] ||
    !!existingFacultySchedules[facultyId]?.[day]?.[slotId];

  const placeTheory = (session, day, slotId) => {
    updated.classTimetable[session.classId][day][slotId] = {
      subjectId: session.subjectId,
      facultyId: session.facultyId,
    };
    initFaculty(updated.facultyTimetable, session.facultyId, activeDays, teachingSlotIds);
    updated.facultyTimetable[session.facultyId][day][slotId] = {
      classId: session.classId,
      subjectId: session.subjectId,
    };
    mark(theoryDayUsed, session.classId, session.subjectId, day);
  };

  const placeLab = (session, day, slotId1, slotId2) => {
    const classCell1 = { subjectId: session.subjectId, facultyId: session.facultyId, isLab: true, labPair: slotId2 };
    const classCell2 = { subjectId: session.subjectId, facultyId: session.facultyId, isLab: true, labPair: slotId1 };
    const facultyCell1 = { classId: session.classId, subjectId: session.subjectId, isLab: true, labPair: slotId2 };
    const facultyCell2 = { classId: session.classId, subjectId: session.subjectId, isLab: true, labPair: slotId1 };

    updated.classTimetable[session.classId][day][slotId1] = classCell1;
    updated.classTimetable[session.classId][day][slotId2] = classCell2;
    initFaculty(updated.facultyTimetable, session.facultyId, activeDays, teachingSlotIds);
    updated.facultyTimetable[session.facultyId][day][slotId1] = facultyCell1;
    updated.facultyTimetable[session.facultyId][day][slotId2] = facultyCell2;
    mark(labDayUsed, session.classId, session.subjectId, day);
  };

  const findTheorySlot = (session) => {
    const passes = [
      { slots: preferred, cleanDay: true, allowLabDay: false },
      { slots: fallback, cleanDay: true, allowLabDay: false },
      { slots: preferred, cleanDay: false, allowLabDay: true },
      { slots: [...preferred, ...fallback], cleanDay: false, allowLabDay: true },
    ];

    for (const pass of passes) {
      for (const day of activeDays) {
        if (pass.cleanDay && hasAnyOnDay(session.classId, session.subjectId, day)) continue;
        if (!pass.allowLabDay && hasTheoryOnDay(session.classId, session.subjectId, day)) continue;
        if (pass.allowLabDay && hasTheoryOnDay(session.classId, session.subjectId, day)) continue;
        for (const slotId of pass.slots) {
          if (!isClassBusy(session.classId, day, slotId) && !isFacultyBusy(session.facultyId, day, slotId)) {
            return { day, slotId };
          }
        }
      }
    }

    return null;
  };

  const findLabSlot = (session) => {
    for (const requireCleanDay of [true, false]) {
      for (const day of activeDays) {
        if (requireCleanDay && hasAnyOnDay(session.classId, session.subjectId, day)) continue;
        for (const [slotId1, slotId2] of labSlotPairs) {
          if (
            !isClassBusy(session.classId, day, slotId1) &&
            !isClassBusy(session.classId, day, slotId2) &&
            !isFacultyBusy(session.facultyId, day, slotId1) &&
            !isFacultyBusy(session.facultyId, day, slotId2)
          ) {
            return { day, slotId1, slotId2 };
          }
        }
      }
    }
    return null;
  };

  const warnings = [];
  let added = 0;
  const sessions = createMissingSessions(updated.classTimetable, targetRequirements);

  for (const session of sessions) {
    const slot = session.type === 'lab' ? findLabSlot(session) : findTheorySlot(session);
    if (slot && session.type === 'lab') {
      placeLab(session, slot.day, slot.slotId1, slot.slotId2);
      added += 1;
    } else if (slot) {
      placeTheory(session, slot.day, slot.slotId);
      added += 1;
    } else {
      warnings.push({
        type: session.type,
        classId: session.classId,
        facultyId: session.facultyId,
        subjectId: session.subjectId,
        reason: session.type === 'lab' ? 'no_consecutive_slots' : 'no_empty_slots',
      });
    }
  }

  return { timetable: updated, warnings, added, removed, missing: sessions.length };
}
