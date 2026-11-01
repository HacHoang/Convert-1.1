const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const vm = require('node:vm');
const bundle = esbuild.buildSync({ entryPoints: ['src/utils/readingStats.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const context = { module: { exports: {} }, crypto: require('node:crypto').webcrypto, Date };
vm.runInNewContext(bundle.outputFiles[0].text, context);
const { emptyReadingStats, normalizeReadingStats, applyReadingDelta, summarizeReadingStats, activeReadingSeconds, localReadingDay, validReadingDay, validReadingStats } = context.module.exports;
const tick = (stats, patch = {}) => applyReadingDelta(stats, { epoch: stats.epoch, bookId: 'book', chapterId: 'chapter', day: '2026-11-01', seconds: 15, atEnd: false, ...patch });

test('statistics start at zero; legacy demo totals are retained but never counted', () => {
  const migrated = normalizeReadingStats({ totalReadBooks: 2, totalReadMinutes: 145 });
  assert.equal(migrated.totalReadBooks, 0); assert.equal(migrated.totalReadMinutes, 0);
  assert.equal(migrated.legacyUnverified.totalReadMinutes, 145);
  assert.equal(normalizeReadingStats(migrated).epoch, migrated.epoch);
});
test('reading accumulates actual seconds, counts unique books at 30 seconds and completed chapters once', () => {
  let stats = emptyReadingStats(); stats = tick(stats, { atEnd: true });
  assert.equal(stats.totalReadBooks, 0); assert.equal(summarizeReadingStats(stats).completedChapters, 0);
  stats = tick(stats, { atEnd: true });
  assert.equal(stats.totalReadBooks, 1); assert.equal(stats.totalReadMinutes, 0.5);
  assert.equal(summarizeReadingStats(stats).completedChapters, 1);
  stats = tick(stats, { atEnd: true }); stats = tick(stats, { chapterId: 'second' });
  assert.equal(stats.totalReadBooks, 1); assert.equal(summarizeReadingStats(stats).completedChapters, 1);
  assert.equal(stats.totalReadMinutes, 1);
});
test('completion requires both accumulated time and reaching the end, including short chapters', () => {
  let stats = tick(tick(emptyReadingStats()));
  assert.equal(summarizeReadingStats(stats).completedChapters, 0);
  stats = tick(stats, { atEnd: true, seconds: 0.2 });
  assert.equal(summarizeReadingStats(stats).completedChapters, 1);
});
test('reset rejects pending events from the old epoch and invalid event data', () => {
  const old = tick(emptyReadingStats()), reset = emptyReadingStats();
  for (const patch of [{ epoch: old.epoch }, { seconds: 31 }, { seconds: -1 }, { seconds: Infinity }, { day: '2026-02-30' }, { bookId: '' }]) assert.equal(tick(reset, patch), reset);
  assert.equal(validReadingDay('2024-02-29'), true); assert.equal(validReadingDay('2025-02-29'), false);
});
test('current/longest streak, seven-day totals and best day follow local calendar days', () => {
  let stats = emptyReadingStats();
  for (const day of ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-30', '2026-10-31']) for (let n = 0; n < 4; n++) stats = tick(stats, { day });
  stats = tick(stats, { day: '2026-11-01', seconds: 15 });
  const summary = summarizeReadingStats(stats, '2026-11-01');
  assert.equal(summary.currentStreak, 2); assert.equal(summary.longestStreak, 3);
  assert.equal(summary.activeDays, 5); assert.equal(summary.weekSeconds, 195);
  assert.equal(summary.todaySeconds, 15); assert.equal(summary.longestDaySeconds, 60);
  assert.equal(summarizeReadingStats(stats, '2026-11-02').currentStreak, 0);
});
test('hidden, unfocused, idle and suspended reading never add time', () => {
  assert.equal(activeReadingSeconds(1000, true, true, 100), 1);
  for (const args of [[1000, false, true, 0], [1000, true, false, 0], [1000, true, true, 180000], [60000, true, true, 0], [-1, true, true, 0]]) assert.equal(activeReadingSeconds(...args), 0);
});
test('normalization validates records and recalculates derived counters rather than trusting imported totals', () => {
  const stats = tick(tick(emptyReadingStats())); stats.totalReadBooks = 999; stats.totalReadMinutes = 999;
  assert.equal(normalizeReadingStats(stats).totalReadBooks, 1); assert.equal(normalizeReadingStats(stats).totalReadMinutes, 0.5);
  assert.equal(validReadingStats({ ...stats, days: { '2026-11-01': NaN } }), false);
  assert.equal(validReadingStats({ ...stats, chapters: { broken: { seconds: 10, completed: false } } }), false);
  assert.match(localReadingDay(new Date(2026, 10, 1)), /^2026-11-01$/);
});
