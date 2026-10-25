/**
 * IndexedDB Storage Helper for Convert App
 * Hỗ trợ lưu trữ tệp Name & Vietphrase dung lượng lớn (~40MB+)
 * Vượt qua giới hạn 5MB của localStorage, không bị lỗi QuotaExceededError.
 */

import { NameItem } from '../data/defaultNames';

const DB_NAME = 'ConvertAppDB';
const DB_VERSION = 1;
const STORE_NAMES = 'names_store';
const STORE_VIETPHRASE = 'vietphrase_store';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAMES)) {
        const store = db.createObjectStore(STORE_NAMES, { keyPath: 'id' });
        store.createIndex('chinese', 'chinese', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_VIETPHRASE)) {
        db.createObjectStore(STORE_VIETPHRASE, { keyPath: 'chinese' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ------------------- NAMES STORAGE -------------------

export async function getStoredNames(): Promise<NameItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES, 'readonly');
      const store = tx.objectStore(STORE_NAMES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load names from IndexedDB', err);
    return [];
  }
}

export async function saveNameItem(item: NameItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    const store = tx.objectStore(STORE_NAMES);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteNameItem(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    const store = tx.objectStore(STORE_NAMES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteNameByChinese(chinese: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    const store = tx.objectStore(STORE_NAMES);
    const index = store.index('chinese');
    const req = index.getAllKeys(chinese);
    req.onsuccess = () => {
      const keys = req.result;
      if (!keys || keys.length === 0) {
        resolve();
        return;
      }
      let deleted = 0;
      for (const k of keys) {
        store.delete(k);
        deleted++;
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveNamesBatch(items: NameItem[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    const store = tx.objectStore(STORE_NAMES);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearNamesStore(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    const store = tx.objectStore(STORE_NAMES);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ------------------- VIETPHRASE STORAGE -------------------

export interface VietphraseRecord {
  chinese: string;
  vietnamese: string;
}

export async function getStoredVietphrase(): Promise<Record<string, string>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIETPHRASE, 'readonly');
      const store = tx.objectStore(STORE_VIETPHRASE);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: VietphraseRecord[] = request.result || [];
        const map: Record<string, string> = {};
        for (const r of records) {
          map[r.chinese] = r.vietnamese;
        }
        resolve(map);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load vietphrase from IndexedDB', err);
    return {};
  }
}

export async function saveVietphraseItem(chinese: string, vietnamese: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIETPHRASE, 'readwrite');
    const store = tx.objectStore(STORE_VIETPHRASE);
    const req = store.put({ chinese, vietnamese });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVietphraseItem(chinese: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIETPHRASE, 'readwrite');
    const store = tx.objectStore(STORE_VIETPHRASE);
    const req = store.delete(chinese);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveVietphraseBatch(items: VietphraseRecord[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIETPHRASE, 'readwrite');
    const store = tx.objectStore(STORE_VIETPHRASE);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearVietphraseStore(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIETPHRASE, 'readwrite');
    const store = tx.objectStore(STORE_VIETPHRASE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
