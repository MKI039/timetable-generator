import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  getAllFromStore,
  putToStore,
  deleteFromStore,
  getSetting,
  putSetting,
} from '../db/db';
import { generateId, DEFAULT_SETTINGS } from '../constants/defaults';

const AppContext = createContext(null);

const initialState = {
  faculty: [],
  subjects: [],
  classes: [],
  requirements: [],
  timetables: [],
  settings: DEFAULT_SETTINGS,
  loading: true,
};

function appReducer(state, action) {
  switch (action.type) {
    // --- INIT ---
    case 'LOAD_ALL':
      return { ...state, ...action.payload, loading: false };

    // --- FACULTY ---
    case 'ADD_FACULTY':
      return { ...state, faculty: [...state.faculty, action.payload] };
    case 'UPDATE_FACULTY':
      return {
        ...state,
        faculty: state.faculty.map((f) => (f.id === action.payload.id ? action.payload : f)),
      };
    case 'DELETE_FACULTY':
      return { ...state, faculty: state.faculty.filter((f) => f.id !== action.payload) };

    // --- SUBJECTS ---
    case 'ADD_SUBJECT':
      return { ...state, subjects: [...state.subjects, action.payload] };
    case 'UPDATE_SUBJECT':
      return {
        ...state,
        subjects: state.subjects.map((s) => (s.id === action.payload.id ? action.payload : s)),
      };
    case 'DELETE_SUBJECT':
      return { ...state, subjects: state.subjects.filter((s) => s.id !== action.payload) };

    // --- CLASSES ---
    case 'ADD_CLASS':
      return { ...state, classes: [...state.classes, action.payload] };
    case 'UPDATE_CLASS':
      return {
        ...state,
        classes: state.classes.map((c) => (c.id === action.payload.id ? action.payload : c)),
      };
    case 'DELETE_CLASS':
      return { ...state, classes: state.classes.filter((c) => c.id !== action.payload) };

    // --- REQUIREMENTS ---
    case 'ADD_REQUIREMENT':
      return { ...state, requirements: [...state.requirements, action.payload] };
    case 'UPDATE_REQUIREMENT':
      return {
        ...state,
        requirements: state.requirements.map((r) =>
          r.id === action.payload.id ? action.payload : r
        ),
      };
    case 'DELETE_REQUIREMENT':
      return { ...state, requirements: state.requirements.filter((r) => r.id !== action.payload) };

    // --- TIMETABLES ---
    case 'ADD_TIMETABLE':
      return { ...state, timetables: [...state.timetables, action.payload] };
    case 'UPDATE_TIMETABLE':
      return {
        ...state,
        timetables: state.timetables.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    case 'DELETE_TIMETABLE':
      return { ...state, timetables: state.timetables.filter((t) => t.id !== action.payload) };

    // --- SETTINGS ---
    case 'UPDATE_SETTINGS':
      return { ...state, settings: action.payload };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load all data from IndexedDB on mount
  useEffect(() => {
    async function loadAll() {
      const [faculty, subjects, classes, requirements, timetables, savedSettings] =
        await Promise.all([
          getAllFromStore('faculty'),
          getAllFromStore('subjects'),
          getAllFromStore('classes'),
          getAllFromStore('requirements'),
          getAllFromStore('timetables'),
          getSetting('appSettings'),
        ]);

      dispatch({
        type: 'LOAD_ALL',
        payload: {
          faculty,
          subjects,
          classes,
          requirements,
          timetables,
          settings: savedSettings || DEFAULT_SETTINGS,
        },
      });
    }
    loadAll();
  }, []);

  // --- Faculty actions ---
  const addFaculty = useCallback(async (data) => {
    const item = { id: generateId(), ...data };
    await putToStore('faculty', item);
    dispatch({ type: 'ADD_FACULTY', payload: item });
    return item;
  }, []);

  const updateFaculty = useCallback(async (item) => {
    await putToStore('faculty', item);
    dispatch({ type: 'UPDATE_FACULTY', payload: item });
  }, []);

  const deleteFaculty = useCallback(async (id) => {
    await deleteFromStore('faculty', id);
    dispatch({ type: 'DELETE_FACULTY', payload: id });
  }, []);

  // --- Subject actions ---
  const addSubject = useCallback(async (data) => {
    const item = { id: generateId(), ...data };
    await putToStore('subjects', item);
    dispatch({ type: 'ADD_SUBJECT', payload: item });
    return item;
  }, []);

  const updateSubject = useCallback(async (item) => {
    await putToStore('subjects', item);
    dispatch({ type: 'UPDATE_SUBJECT', payload: item });
  }, []);

  const deleteSubject = useCallback(async (id) => {
    await deleteFromStore('subjects', id);
    dispatch({ type: 'DELETE_SUBJECT', payload: id });
  }, []);

  // --- Class actions ---
  const addClass = useCallback(async (data) => {
    const item = { id: generateId(), ...data };
    await putToStore('classes', item);
    dispatch({ type: 'ADD_CLASS', payload: item });
    return item;
  }, []);

  const updateClass = useCallback(async (item) => {
    await putToStore('classes', item);
    dispatch({ type: 'UPDATE_CLASS', payload: item });
  }, []);

  const deleteClass = useCallback(async (id) => {
    await deleteFromStore('classes', id);
    dispatch({ type: 'DELETE_CLASS', payload: id });
  }, []);

  // --- Requirement actions ---
  const addRequirement = useCallback(async (data) => {
    const item = { id: generateId(), ...data };
    await putToStore('requirements', item);
    dispatch({ type: 'ADD_REQUIREMENT', payload: item });
    return item;
  }, []);

  const updateRequirement = useCallback(async (item) => {
    await putToStore('requirements', item);
    dispatch({ type: 'UPDATE_REQUIREMENT', payload: item });
  }, []);

  const deleteRequirement = useCallback(async (id) => {
    await deleteFromStore('requirements', id);
    dispatch({ type: 'DELETE_REQUIREMENT', payload: id });
  }, []);

  // --- Timetable actions ---
  const saveTimetable = useCallback(async (item) => {
    await putToStore('timetables', item);
    const exists = item.id && true;
    if (exists) {
      dispatch({ type: 'UPDATE_TIMETABLE', payload: item });
    } else {
      dispatch({ type: 'ADD_TIMETABLE', payload: item });
    }
  }, []);

  const addTimetable = useCallback(async (data) => {
    const item = { id: generateId(), createdAt: new Date().toISOString(), ...data };
    await putToStore('timetables', item);
    dispatch({ type: 'ADD_TIMETABLE', payload: item });
    return item;
  }, []);

  const updateTimetable = useCallback(async (item) => {
    await putToStore('timetables', item);
    dispatch({ type: 'UPDATE_TIMETABLE', payload: item });
  }, []);

  const deleteTimetable = useCallback(async (id) => {
    await deleteFromStore('timetables', id);
    dispatch({ type: 'DELETE_TIMETABLE', payload: id });
  }, []);

  // --- Settings ---
  const updateSettings = useCallback(async (newSettings) => {
    await putSetting('appSettings', newSettings);
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
  }, []);

  const value = {
    ...state,
    addFaculty,
    updateFaculty,
    deleteFaculty,
    addSubject,
    updateSubject,
    deleteSubject,
    addClass,
    updateClass,
    deleteClass,
    addRequirement,
    updateRequirement,
    deleteRequirement,
    saveTimetable,
    addTimetable,
    updateTimetable,
    deleteTimetable,
    updateSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
