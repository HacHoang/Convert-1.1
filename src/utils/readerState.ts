import type { SavedChapter } from '../context/AppContext';
import { detectChapterHeading } from './chapterHeading';
import { openDB, readAppValue, STORE_APP } from './indexedDbStorage';

export interface ReadingPosition {
  chapterId: string; paragraphIndex: number; paragraphOffset: number; scrollRatio: number; updatedAt: number;
}
export interface ReaderBookmark extends ReadingPosition { id: string; novelId: string; label: string }
export interface ReaderPreferences {
  fontSize: number; lineHeight: number; width: number; theme: 'light' | 'dark' | 'sepia';
  fontFamily: 'serif' | 'sans'; autoNext: boolean; mode: 'translation' | 'original';
}
export interface ReaderState {
  progress: Record<string, ReadingPosition>; bookmarks: ReaderBookmark[]; preferences: ReaderPreferences;
}
export const READER_KEY = 'readerState';
const PENDING_KEY = 'convert_reader_pending_progress';
export const DEFAULT_READER_PREFERENCES: ReaderPreferences = { fontSize: 20, lineHeight: 1.9, width: 760, theme: 'sepia', fontFamily: 'serif', autoNext: true, mode: 'translation' };
const empty = (): ReaderState => ({ progress: {}, bookmarks: [], preferences: { ...DEFAULT_READER_PREFERENCES } });
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const fraction = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
export function validReadingPosition(value: unknown): value is ReadingPosition {
  return record(value) && typeof value.chapterId === 'string' && Number.isSafeInteger(value.paragraphIndex) && value.paragraphIndex >= 0 &&
    fraction(value.paragraphOffset) && fraction(value.scrollRatio) && typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt >= 0;
}
export function validReaderState(value: unknown): value is ReaderState {
  if (!record(value) || !record(value.progress) || !Object.values(value.progress).every(validReadingPosition) || !Array.isArray(value.bookmarks) || !record(value.preferences)) return false;
  if (!value.bookmarks.every((row: unknown) => record(row) && typeof row.id === 'string' && typeof row.novelId === 'string' && typeof row.label === 'string' && validReadingPosition(row))) return false;
  const p = value.preferences;
  return typeof p.fontSize === 'number' && p.fontSize >= 14 && p.fontSize <= 36 && typeof p.lineHeight === 'number' && p.lineHeight >= 1.3 && p.lineHeight <= 2.6 &&
    typeof p.width === 'number' && p.width >= 480 && p.width <= 1000 && ['light', 'dark', 'sepia'].includes(p.theme) &&
    ['serif', 'sans'].includes(p.fontFamily) && ['translation', 'original'].includes(p.mode) && typeof p.autoNext === 'boolean';
}
function pending(): Record<string, ReadingPosition> {
  try { const value = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); return record(value) ? Object.fromEntries(Object.entries(value).filter(([, position]) => validReadingPosition(position))) : {}; }
  catch { return {}; }
}
export function stageReadingPosition(novelId: string, position: ReadingPosition) {
  try { const values = pending(); if (!values[novelId] || values[novelId].updatedAt <= position.updatedAt) values[novelId] = position; localStorage.setItem(PENDING_KEY, JSON.stringify(values)); } catch { /* IndexedDB remains the primary store. */ }
}
export function clearStagedReadingPositions() { try { localStorage.removeItem(PENDING_KEY); } catch {} }
export function mergeReadingProgress(current: Record<string, ReadingPosition>, next: Record<string, ReadingPosition>) {
  const result = { ...current };
  for (const [id, position] of Object.entries(next)) if (!result[id] || result[id].updatedAt <= position.updatedAt) result[id] = position;
  return result;
}
export async function readReaderState(): Promise<ReaderState> {
  const saved = await readAppValue<ReaderState>(READER_KEY);
  const state = validReaderState(saved) ? saved : empty();
  return { ...state, progress: mergeReadingProgress(state.progress, pending()) };
}
/** Read-modify-write inside one transaction preserves bookmarks and progress across tabs. */
export async function updateReaderState(change: (state: ReaderState) => ReaderState): Promise<ReaderState> {
  const db = await openDB();
  try { return await new Promise<ReaderState>((resolve, reject) => {
    const tx = db.transaction(STORE_APP, 'readwrite'); const store = tx.objectStore(STORE_APP); const request = store.get(READER_KEY); let next: ReaderState;
    tx.oncomplete = () => resolve(next); tx.onerror = tx.onabort = () => reject(tx.error || new Error('Không lưu được vị trí đọc.'));
    request.onsuccess = () => { try {
      const state = validReaderState(request.result) ? request.result : empty();
      next = change({ ...state, progress: mergeReadingProgress(state.progress, pending()) });
      store.put(next, READER_KEY);
    } catch { tx.abort(); } };
  }); } finally { db.close(); }
}
export const saveReadingPosition = (novelId: string, position: ReadingPosition) => {
  stageReadingPosition(novelId, position);
  return updateReaderState(state => ({ ...state, progress: mergeReadingProgress(state.progress, { [novelId]: position }) }));
};
export function orderReaderChapters(chapters: SavedChapter[]): SavedChapter[] {
  const number = (chapter: SavedChapter) => Number((detectChapterHeading(chapter.chapterPrefix || '') || detectChapterHeading(chapter.title) || detectChapterHeading(chapter.originalText))?.prefix.match(/\d+/)?.[0] || Number.MAX_SAFE_INTEGER);
  const part = (chapter: SavedChapter) => Number(`${chapter.title}\n${chapter.originalText.split('\n')[0]}`.match(/[（(]\s*(\d+)\s*[/／]\s*\d+\s*[)）]/)?.[1] || 0);
  return [...chapters].sort((a, b) => number(a) - number(b) || part(a) - part(b) || a.title.localeCompare(b.title, 'vi', { numeric: true }) || a.savedAt - b.savedAt);
}
export function readerChapterBlocks(total: number) {
  return Array.from({ length: Math.ceil(total / 100) }, (_, index) => ({ index, start: index * 100, end: Math.min(total, (index + 1) * 100) }));
}

export function shouldAdvanceReader(options: { enabled: boolean; interacting: boolean; restoring: boolean; panelOpen: boolean; hasNext: boolean; elapsed: number; bottomGap: number; overflow: number; allowShort: boolean }) {
  return options.enabled && options.interacting && !options.restoring && !options.panelOpen && options.hasNext && options.elapsed >= 1000 && options.bottomGap <= 8 && (options.overflow >= 40 || options.allowShort);
}

/** Reaching the end only arms navigation. A separate gesture after a quiet
 * reading interval is required, so inertial/continuous scrolling cannot skip it. */
export class ReaderEndGate {
  private reachedAt: number | null = null;
  private lastGestureAt: number | null = null;
  reset() { this.reachedAt = null; this.lastGestureAt = null; }
  update(now: number, atEnd: boolean, gesture: boolean): boolean {
    if (!atEnd) { this.reset(); return false; }
    if (this.reachedAt === null) this.reachedAt = now;
    const quiet = this.lastGestureAt === null || now - this.lastGestureAt >= 600;
    if (gesture) this.lastGestureAt = now;
    return gesture && quiet && now - this.reachedAt >= 2500;
  }
}
