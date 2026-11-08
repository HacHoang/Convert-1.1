/**
 * IndexedDB Multi-Store Storage Helper for Hermes
 * Hỗ trợ lưu trữ toàn bộ các bảng từ điển QuickTranslator (~40MB+)
 * Bộ mặc định lưu theo snapshot; chỉnh sửa lưu riêng. Quota vẫn phụ thuộc trình duyệt.
 */

import { NameItem } from '../data/defaultNames';

const DB_NAME = 'ConvertAppDB';
const DB_VERSION = 4;
export const STORE_APP = 'app_store';
export const STORE_BATCH_DRAFT = 'batch_draft_store';

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

      if (!db.objectStoreNames.contains(STORE_APP)) db.createObjectStore(STORE_APP);
      if (!db.objectStoreNames.contains(STORE_BATCH_DRAFT)) db.createObjectStore(STORE_BATCH_DRAFT, { keyPath: 'id' });
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

    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

// Large defaults are one snapshot per dictionary. Individual edits stay in the
// original object stores; tombstones keep deleted default entries from returning.
export const DICTIONARY_STORES = [STORE_NAMES, STORE_NAMES_MAIN, STORE_VIETPHRASE,
  STORE_LUAT_NHAN, STORE_PRONOUNS, STORE_IGNORED, STORE_PHIEN_AM];
const snapshotKey = (store: string) => `dictionarySnapshot:${store}`;
const deletedKey = (store: string) => `dictionaryDeleted:${store}`;
const keyPathFor = (store: string) => store === STORE_NAMES ? 'id' : store === STORE_LUAT_NHAN ? 'pattern' : store === STORE_IGNORED ? 'phrase' : 'chinese';
const DICTIONARY_CHANNEL = 'hermes-dictionary-changes-v1';

function announceDictionaryChanges(stores: string[]) {
  const changed = stores.filter(store => DICTIONARY_STORES.includes(store));
  if (!changed.length || typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(DICTIONARY_CHANNEL);
  channel.postMessage(changed);
  channel.close();
}

export function subscribeDictionaryChanges(listener: (stores: string[]) => void) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(DICTIONARY_CHANNEL);
  channel.onmessage = event => {
    if (Array.isArray(event.data)) listener(event.data.filter((store): store is string => typeof store === 'string' && DICTIONARY_STORES.includes(store)));
  };
  return () => channel.close();
}

async function mutate(stores: string[], action: (tx: IDBTransaction) => void): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Không thể lưu dữ liệu trình duyệt'));
      try { action(tx); } catch (error) { tx.abort(); reject(error); }
    });
  } finally { db.close(); }
}

export function mergeDictionaryRows<T>(baseline: T[], overrides: T[], deleted: string[], keyPath: string): T[] {
  if (!baseline.length) return overrides;
  if (!overrides.length && !deleted.length) return baseline;
  const removed = new Set(deleted);
  const key = (row: T) => (row as Record<string, string>)[keyPath];
  const map = new Map<string, T>();
  for (const row of baseline) if (!removed.has(key(row))) map.set(key(row), row);
  // Re-adding an entry takes precedence over an earlier deletion.
  for (const row of overrides) map.set(key(row), row);
  return Array.from(map.values());
}

// Reads fail explicitly: failed storage must never become a successful empty backup.
export async function readStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction([storeName, STORE_APP], 'readonly');
      const rows = tx.objectStore(storeName).getAll();
      const baseline = tx.objectStore(STORE_APP).get(snapshotKey(storeName));
      const deleted = tx.objectStore(STORE_APP).get(deletedKey(storeName));
      tx.oncomplete = () => resolve(mergeDictionaryRows(baseline.result || [], rows.result || [], deleted.result || [], keyPathFor(storeName)));
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Không đọc được dữ liệu trình duyệt'));
    });
  } finally { db.close(); }
}

export async function readAppValue<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_APP, 'readonly');
      const req = tx.objectStore(STORE_APP).get(key);
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Không đọc được dữ liệu trình duyệt'));
    });
  } finally { db.close(); }
}

export const writeAppValue = (key: string, value: unknown): Promise<void> =>
  mutate([STORE_APP], tx => { tx.objectStore(STORE_APP).put(value, key); });

const BATCH_DRAFT_META_KEY = 'batchDraftMeta';

/** One resumable batch queue. Chapters are written independently to avoid repeatedly serializing a whole book. */
export async function readBatchDraft<T extends { id: string }>(): Promise<{ meta: Record<string, unknown> | undefined; chapters: T[] }> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_APP, STORE_BATCH_DRAFT], 'readonly');
      const meta = tx.objectStore(STORE_APP).get(BATCH_DRAFT_META_KEY);
      const chapters = tx.objectStore(STORE_BATCH_DRAFT).getAll();
      tx.oncomplete = () => resolve({ meta: meta.result, chapters: chapters.result || [] });
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Không thể đọc nháp dịch hàng loạt'));
    });
  } finally { db.close(); }
}

export const saveBatchDraftMeta = (meta: Record<string, unknown>): Promise<void> =>
  mutate([STORE_APP], tx => { tx.objectStore(STORE_APP).put(meta, BATCH_DRAFT_META_KEY); });

export const saveBatchDraftChapter = <T extends { id: string }>(chapter: T): Promise<void> =>
  mutate([STORE_BATCH_DRAFT], tx => { tx.objectStore(STORE_BATCH_DRAFT).put(chapter); });

export const saveBatchDraftChapters = <T extends { id: string }>(chapters: T[]): Promise<void> =>
  !chapters.length ? Promise.resolve() : mutate([STORE_BATCH_DRAFT], tx => { for (const chapter of chapters) tx.objectStore(STORE_BATCH_DRAFT).put(chapter); });

export async function replaceBatchDraft<T extends { id: string }>(chapters: T[], meta: Record<string, unknown>): Promise<void> {
  await mutate([STORE_APP, STORE_BATCH_DRAFT], tx => {
    tx.objectStore(STORE_BATCH_DRAFT).clear();
    for (const chapter of chapters) tx.objectStore(STORE_BATCH_DRAFT).put(chapter);
    tx.objectStore(STORE_APP).put(meta, BATCH_DRAFT_META_KEY);
  });
}

export const deleteBatchDraftChapters = (ids: string[]): Promise<void> =>
  !ids.length ? Promise.resolve() : mutate([STORE_BATCH_DRAFT], tx => { for (const id of ids) tx.objectStore(STORE_BATCH_DRAFT).delete(id); });

export const clearBatchDraft = (): Promise<void> =>
  mutate([STORE_APP, STORE_BATCH_DRAFT], tx => { tx.objectStore(STORE_BATCH_DRAFT).clear(); tx.objectStore(STORE_APP).delete(BATCH_DRAFT_META_KEY); });

const writeRows = async (name: string, rows: unknown[]): Promise<void> => {
  if (!rows.length) return;
  await mutate([name], tx => { for (const row of rows) tx.objectStore(name).put(row); });
  announceDictionaryChanges([name]);
};

export async function deleteDictionaryKeys(name: string, keys: string[]): Promise<void> {
  if (!DICTIONARY_STORES.includes(name)) throw new Error('Bảng từ điển không hợp lệ');
  if (!keys.length) return;
  await mutate([name, STORE_APP], tx => {
    const app = tx.objectStore(STORE_APP);
    const request = app.get(deletedKey(name));
    request.onsuccess = () => {
      try { app.put([...new Set([...(request.result || []), ...keys])], deletedKey(name)); }
      catch { tx.abort(); }
    };
    for (const key of keys) tx.objectStore(name).delete(key);
  });
  announceDictionaryChanges([name]);
}
const deleteKeys = deleteDictionaryKeys;

// Replace snapshots and clear prior edits in ONE transaction. Bulk snapshots avoid
// millions of IndexedDB put requests during a fresh install or a full restore.
export async function replaceStores(stores: Record<string, unknown[]>, appValues: Record<string, unknown> = {}): Promise<void> {
  for (const [name, rows] of Object.entries(stores)) {
    if (!DICTIONARY_STORES.includes(name) || !Array.isArray(rows)) throw new Error('Bảng từ điển không hợp lệ');
    const keyPath = keyPathFor(name);
    const keys = new Set<string>();
    for (const row of rows) {
      const key = row && typeof row === 'object' ? (row as Record<string, unknown>)[keyPath] : undefined;
      if (typeof key !== 'string' || keys.has(key)) throw new Error('Khóa từ điển không hợp lệ hoặc bị trùng');
      keys.add(key);
    }
  }
  await mutate([...Object.keys(stores), STORE_APP], tx => {
    const app = tx.objectStore(STORE_APP);
    for (const [name, rows] of Object.entries(stores)) {
      tx.objectStore(name).clear();
      app.put(rows, snapshotKey(name));
      app.delete(deletedKey(name));
    }
    for (const [key, value] of Object.entries(appValues)) app.put(value, key);
  });
  announceDictionaryChanges(Object.keys(stores));
}

export interface VietphraseRecord { chinese: string; vietnamese: string }
export interface LuatNhanRecord { pattern: string; translation: string }
const getMap = async (name: string): Promise<Record<string, string>> => Object.fromEntries(
  (await readStore<VietphraseRecord>(name)).map(row => [row.chinese, row.vietnamese]));

export const getStoredNames = () => readStore<NameItem>(STORE_NAMES);
export const saveNameItem = (item: NameItem) => writeRows(STORE_NAMES, [item]);
export const saveNamesBatch = (items: NameItem[]) => writeRows(STORE_NAMES, items);
export const deleteNameItem = (id: string) => deleteKeys(STORE_NAMES, [id]);
export async function deleteNameByChinese(chinese: string): Promise<void> {
  const rows = await getStoredNames();
  await deleteKeys(STORE_NAMES, rows.filter(row => row.chinese === chinese).map(row => row.id));
}
export const clearNamesStore = () => replaceStores({ [STORE_NAMES]: [] });
export const getStoredVietphrase = () => getMap(STORE_VIETPHRASE);
export const saveVietphraseItem = (chinese: string, vietnamese: string) => writeRows(STORE_VIETPHRASE, [{ chinese, vietnamese }]);
export const saveVietphraseBatch = (items: VietphraseRecord[]) => writeRows(STORE_VIETPHRASE, items);
export const deleteVietphraseItem = (chinese: string) => deleteKeys(STORE_VIETPHRASE, [chinese]);
export const clearVietphraseStore = () => replaceStores({ [STORE_VIETPHRASE]: [] });
export const getStoredNamesMain = () => getMap(STORE_NAMES_MAIN);
export const saveNamesMainBatch = (items: VietphraseRecord[]) => writeRows(STORE_NAMES_MAIN, items);
export const clearNamesMainStore = () => replaceStores({ [STORE_NAMES_MAIN]: [] });
export const savePhienAmBatch = (items: VietphraseRecord[]) => writeRows(STORE_PHIEN_AM, items);
export async function getStoredLuatNhan(): Promise<Record<string, string>> {
  return Object.fromEntries((await readStore<LuatNhanRecord>(STORE_LUAT_NHAN)).map(row => [row.pattern, row.translation]));
}
export const saveLuatNhanBatch = (items: LuatNhanRecord[]) => writeRows(STORE_LUAT_NHAN, items);
export const clearLuatNhanStore = () => replaceStores({ [STORE_LUAT_NHAN]: [] });
export const getStoredPronouns = () => getMap(STORE_PRONOUNS);
export const savePronounsBatch = (items: VietphraseRecord[]) => writeRows(STORE_PRONOUNS, items);
export const clearPronounsStore = () => replaceStores({ [STORE_PRONOUNS]: [] });
export async function getStoredIgnoredPhrases(): Promise<string[]> {
  return (await readStore<{ phrase: string }>(STORE_IGNORED)).map(row => row.phrase);
}
export const saveIgnoredPhrasesBatch = (phrases: string[]) => writeRows(STORE_IGNORED, phrases.filter(Boolean).map(phrase => ({ phrase })));
export const deleteIgnoredPhrases = (phrases: string[]) => deleteKeys(STORE_IGNORED, phrases);
export const clearIgnoredPhrasesStore = () => replaceStores({ [STORE_IGNORED]: [] });
