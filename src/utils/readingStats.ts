export interface ReadingActivity {
  seconds: number;
  completed: boolean;
}
export interface ReadingStats {
  version: 2;
  epoch: string;
  startedAt: number;
  totalReadBooks: number;
  totalReadMinutes: number;
  days: Record<string, number>;
  chapters: Record<string, ReadingActivity>;
  legacyUnverified?: { totalReadBooks: number; totalReadMinutes: number };
}
export interface ReadingDelta { epoch: string; bookId: string; chapterId: string; day: string; seconds: number; atEnd: boolean }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const localReadingDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function validReadingDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localReadingDay(date) === value;
}
export function emptyReadingStats(now = Date.now(), epoch = crypto.randomUUID()): ReadingStats {
  return { version: 2, epoch, startedAt: now, totalReadBooks: 0, totalReadMinutes: 0, days: {}, chapters: {} };
}
export function validReadingStats(value: unknown): value is ReadingStats {
  if (!record(value) || value.version !== 2 || typeof value.epoch !== 'string' || !value.epoch || !finite(value.startedAt) || !record(value.days) || !record(value.chapters)) return false;
  return Object.entries(value.days).every(([day, seconds]) => validReadingDay(day) && finite(seconds)) &&
    Object.entries(value.chapters).every(([key, activity]) => {
      try { const ids = JSON.parse(key); return Array.isArray(ids) && ids.length === 2 && ids.every(id => typeof id === 'string' && id.length > 0) && record(activity) && finite(activity.seconds) && typeof activity.completed === 'boolean'; } catch { return false; }
    }) && finite(value.totalReadBooks) && finite(value.totalReadMinutes);
}
function totals(stats: ReadingStats): ReadingStats {
  const books = new Map<string, number>();
  for (const [key, activity] of Object.entries(stats.chapters)) {
    const [book] = JSON.parse(key);
    books.set(book, (books.get(book) || 0) + activity.seconds);
  }
  return { ...stats, totalReadBooks: [...books.values()].filter(seconds => seconds >= 30).length,
    totalReadMinutes: Object.values(stats.days).reduce((sum, seconds) => sum + seconds, 0) / 60 };
}
export function normalizeReadingStats(value: unknown): ReadingStats {
  if (validReadingStats(value)) return totals(value);
  const next = emptyReadingStats();
  // Old counters were seeded demo values, without any recorded reading events.
  // Keep them for recovery but never present them as verified reading history.
  if (record(value) && finite(value.totalReadBooks) && finite(value.totalReadMinutes)) next.legacyUnverified = { totalReadBooks: value.totalReadBooks, totalReadMinutes: value.totalReadMinutes };
  return next;
}
export function applyReadingDelta(stats: ReadingStats, delta: ReadingDelta): ReadingStats {
  if (delta.epoch !== stats.epoch || !delta.bookId || !delta.chapterId || !validReadingDay(delta.day) || !finite(delta.seconds) || delta.seconds <= 0 || delta.seconds > 30) return stats;
  const key = JSON.stringify([delta.bookId, delta.chapterId]);
  const previous = stats.chapters[key] || { seconds: 0, completed: false };
  const seconds = previous.seconds + delta.seconds;
  return totals({ ...stats, days: { ...stats.days, [delta.day]: (stats.days[delta.day] || 0) + delta.seconds },
    chapters: { ...stats.chapters, [key]: { seconds, completed: previous.completed || seconds >= 30 && delta.atEnd } } });
}
const previousDay = (day: string) => { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() - 1); return localReadingDay(date); };
export function summarizeReadingStats(stats: ReadingStats, today = localReadingDay()) {
  const days = Object.keys(stats.days).filter(day => stats.days[day] >= 60).sort();
  let longestStreak = 0, run = 0, last = '';
  for (const day of days) { run = last === previousDay(day) ? run + 1 : 1; longestStreak = Math.max(longestStreak, run); last = day; }
  let currentStreak = 0, cursor = stats.days[today] >= 60 ? today : previousDay(today);
  while (stats.days[cursor] >= 60) { currentStreak++; cursor = previousDay(cursor); }
  let weekSeconds = 0; cursor = today;
  for (let n = 0; n < 7; n++) { weekSeconds += stats.days[cursor] || 0; cursor = previousDay(cursor); }
  return { todaySeconds: stats.days[today] || 0, weekSeconds, currentStreak, longestStreak, activeDays: days.length,
    completedChapters: Object.values(stats.chapters).filter(activity => activity.completed).length,
    longestDaySeconds: Math.max(0, ...Object.values(stats.days)),
    averageDaySeconds: days.length ? days.reduce((sum, day) => sum + stats.days[day], 0) / days.length : 0 };
}

/** Reject time jumps, background tabs and idle time; only count the recent active interval. */
export function activeReadingSeconds(elapsedMs: number, visible: boolean, focused: boolean, idleMs: number) {
  return visible && focused && elapsedMs > 0 && elapsedMs <= 2500 && idleMs < 180000 ? elapsedMs / 1000 : 0;
}
