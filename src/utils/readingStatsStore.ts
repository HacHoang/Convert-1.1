import { openDB, STORE_APP } from './indexedDbStorage';
import { normalizeReadingStats, type ReadingStats } from './readingStats';

/** Atomic across tabs: a reset or another reader cannot be overwritten by a stale cached counter. */
export async function updateReadingStats(change: (current: ReadingStats) => ReadingStats, fallback?: ReadingStats): Promise<ReadingStats> {
  const db = await openDB();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP, 'readwrite'), store = tx.objectStore(STORE_APP);
    const request = store.get('readingStats'); let next: ReadingStats;
    tx.oncomplete = () => resolve(next);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Không lưu được thống kê đọc.'));
    request.onsuccess = () => {
      try { next = change(normalizeReadingStats(request.result ?? fallback)); store.put(next, 'readingStats'); }
      catch { tx.abort(); }
    };
  }); } finally { db.close(); }
}
