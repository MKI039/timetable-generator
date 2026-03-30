import { openDB } from 'idb';

const DB_NAME = 'timetable-gen-db';
const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('faculty')) {
          db.createObjectStore('faculty', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('classes')) {
          db.createObjectStore('classes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('requirements')) {
          db.createObjectStore('requirements', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('timetables')) {
          db.createObjectStore('timetables', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// --- Generic helpers ---
export async function getAllFromStore(storeName) {
  const db = await getDB();
  return db.getAll(storeName);
}

export async function putToStore(storeName, item) {
  const db = await getDB();
  await db.put(storeName, item);
}

export async function deleteFromStore(storeName, id) {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function getSetting(key) {
  const db = await getDB();
  const record = await db.get('settings', key);
  return record ? record.value : null;
}

export async function putSetting(key, value) {
  const db = await getDB();
  await db.put('settings', { key, value });
}
