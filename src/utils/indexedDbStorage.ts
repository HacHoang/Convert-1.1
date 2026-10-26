/**
 * IndexedDB Multi-Store Storage Helper for Convert App
 * Hỗ trợ lưu trữ toàn bộ các bảng từ điển QuickTranslator (~40MB+)
 * Vượt qua giới hạn 5MB của localStorage, không bị lỗi QuotaExceededError.
 */

import { NameItem } from '../data/defaultNames';

const DB_NAME = 'ConvertAppDB';
const DB_VERSION = 2;

export const STORE_NAMES = 'names_store'; // Names phụ / cá nhân
export const STORE_NAMES_MAIN = 'names_main_store'; // Names chính gốc (136k)
export const STORE_VIETPHRASE = 'vietphrase_store'; // Vietphrase
export const STORE_LUAT_NHAN = 'luat_nhan_store'; // Luật nhân
export const STORE_PRONOUNS = 'pronouns_store'; // Đại từ
export const STORE_IGNORED = 'ignored_phrases_store'; // Cụm bỏ qua / watermark
export const STORE_PHIEN_AM = 'phien_am_store'; // Phiên âm Hán Việt

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAMES)) {
        const store = db.createObjectStore(STORE_NAMES, { keyPath: 'id' });
        store.createIndex('chinese', 'chinese', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES_MAIN)) {
        db.createObjectStore(STORE_NAMES_MAIN, { keyPath: 'chinese' });
      }

      if (!db.objectStoreNames.contains(STORE_VIETPHRASE)) {
        db.createObjectStore(STORE_VIETPHRASE, { keyPath: 'chinese' });
      }

      if (!db.objectStoreNames.contains(STORE_LUAT_NHAN)) {
        db.createObjectStore(STORE_LUAT_NHAN, { keyPath: 'pattern' });
      }

      if (!db.objectStoreNames.contains(STORE_PRONOUNS)) {
        db.createObjectStore(STORE_PRONOUNS, { keyPath: 'chinese' });
      }

      if (!db.objectStoreNames.contains(STORE_IGNORED)) {
        db.createObjectStore(STORE_IGNORED, { keyPath: 'phrase' });
      }

      if (!db.objectStoreNames.contains(STORE_PHIEN_AM)) {
        db.createObjectStore(STORE_PHIEN_AM, { keyPath: 'chinese' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ------------------- NAMES CÁ NHÂN / NAMES PHỤ STORAGE -------------------

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
      for (const k of keys) {
        store.delete(k);
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

// ------------------- NAMES CHÍNH (NAMES_MAIN) -------------------

export async function getStoredNamesMain(): Promise<Record<string, string>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES_MAIN, 'readonly');
      const store = tx.objectStore(STORE_NAMES_MAIN);
      const req = store.getAll();
      req.onsuccess = () => {
        const records: { chinese: string; vietnamese: string }[] = req.result || [];
        const map: Record<string, string> = {};
        for (const r of records) {
          map[r.chinese] = r.vietnamese;
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

export async function saveNamesMainBatch(items: { chinese: string; vietnamese: string }[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES_MAIN, 'readwrite');
    const store = tx.objectStore(STORE_NAMES_MAIN);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearNamesMainStore(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES_MAIN, 'readwrite');
    const store = tx.objectStore(STORE_NAMES_MAIN);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ------------------- LUẬT NHÂN STORAGE -------------------

export interface LuatNhanRecord {
  pattern: string; // e.g. "在{0}的面前"
  translation: string; // e.g. "trước mặt {0}"
}

export async function getStoredLuatNhan(): Promise<Record<string, string>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LUAT_NHAN, 'readonly');
      const store = tx.objectStore(STORE_LUAT_NHAN);
      const req = store.getAll();
      req.onsuccess = () => {
        const records: LuatNhanRecord[] = req.result || [];
        const map: Record<string, string> = {};
        for (const r of records) {
          map[r.pattern] = r.translation;
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

export async function saveLuatNhanBatch(items: LuatNhanRecord[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LUAT_NHAN, 'readwrite');
    const store = tx.objectStore(STORE_LUAT_NHAN);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearLuatNhanStore(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LUAT_NHAN, 'readwrite');
    const store = tx.objectStore(STORE_LUAT_NHAN);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ------------------- ĐẠI TỪ (PRONOUNS) STORAGE -------------------

export async function getStoredPronouns(): Promise<Record<string, string>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PRONOUNS, 'readonly');
      const store = tx.objectStore(STORE_PRONOUNS);
      const req = store.getAll();
      req.onsuccess = () => {
        const records: { chinese: string; vietnamese: string }[] = req.result || [];
        const map: Record<string, string> = {};
        for (const r of records) {
          map[r.chinese] = r.vietnamese;
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

export async function savePronounsBatch(items: { chinese: string; vietnamese: string }[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRONOUNS, 'readwrite');
    const store = tx.objectStore(STORE_PRONOUNS);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearPronounsStore(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRONOUNS, 'readwrite');
    const store = tx.objectStore(STORE_PRONOUNS);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ------------------- CỤM TỪ BỎ QUA (IGNORED PHRASES) STORAGE -------------------

export async function getStoredIgnoredPhrases(): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IGNORED, 'readonly');
      const store = tx.objectStore(STORE_IGNORED);
      const req = store.getAll();
      req.onsuccess = () => {
        const records: { phrase: string }[] = req.result || [];
        resolve(records.map(r => r.phrase));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveIgnoredPhrasesBatch(phrases: string[]): Promise<void> {
  if (phrases.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IGNORED, 'readwrite');
    const store = tx.objectStore(STORE_IGNORED);
    for (const p of phrases) {
      if (p) store.put({ phrase: p });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearIgnoredPhrasesStore(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IGNORED, 'readwrite');
    const store = tx.objectStore(STORE_IGNORED);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ------------------- XUẤT / NHẬP TOÀN BỘ CƠ SỞ DỮ LIỆU (ALL-IN-ONE) -------------------

export interface FullDatabaseBackup {
  version: number;
  exportedAt: number;
  namesCustom: NameItem[];
  namesMain: Record<string, string>;
  vietphrase: Record<string, string>;
  luatNhan: Record<string, string>;
  pronouns: Record<string, string>;
  ignoredPhrases: string[];
}

export async function exportAllDatabases(): Promise<string> {
  const [namesCustom, namesMain, vietphrase, luatNhan, pronouns, ignoredPhrases] = await Promise.all([
    getStoredNames(),
    getStoredNamesMain(),
    getStoredVietphrase(),
    getStoredLuatNhan(),
    getStoredPronouns(),
    getStoredIgnoredPhrases()
  ]);

  const backup: FullDatabaseBackup = {
    version: DB_VERSION,
    exportedAt: Date.now(),
    namesCustom,
    namesMain,
    vietphrase,
    luatNhan,
    pronouns,
    ignoredPhrases
  };

  return JSON.stringify(backup, null, 2);
}

export async function importAllDatabases(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const data: FullDatabaseBackup = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      throw new Error('Định dạng tệp sao lưu không hợp lệ');
    }

    // Nạp từng store
    if (Array.isArray(data.namesCustom) && data.namesCustom.length > 0) {
      await saveNamesBatch(data.namesCustom);
    }

    if (data.namesMain && typeof data.namesMain === 'object') {
      const items = Object.entries(data.namesMain).map(([k, v]) => ({ chinese: k, vietnamese: v }));
      await saveNamesMainBatch(items);
    }

    if (data.vietphrase && typeof data.vietphrase === 'object') {
      const items = Object.entries(data.vietphrase).map(([k, v]) => ({ chinese: k, vietnamese: v }));
      await saveVietphraseBatch(items);
    }

    if (data.luatNhan && typeof data.luatNhan === 'object') {
      const items = Object.entries(data.luatNhan).map(([k, v]) => ({ pattern: k, translation: v }));
      await saveLuatNhanBatch(items);
    }

    if (data.pronouns && typeof data.pronouns === 'object') {
      const items = Object.entries(data.pronouns).map(([k, v]) => ({ chinese: k, vietnamese: v }));
      await savePronounsBatch(items);
    }

    if (Array.isArray(data.ignoredPhrases) && data.ignoredPhrases.length > 0) {
      await saveIgnoredPhrasesBatch(data.ignoredPhrases);
    }

    return { success: true, message: 'Khôi phục cơ sở dữ liệu thành công!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Lỗi khi nhập dữ liệu' };
  }
}
