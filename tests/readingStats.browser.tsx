// Dedicated test origin only. Tests replace the readingStats app-store key on that origin.
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useReadingActivity } from '../src/hooks/useReadingActivity';
import { applyReadingDelta, emptyReadingStats, localReadingDay, type ReadingStats } from '../src/utils/readingStats';
import { updateReadingStats } from '../src/utils/readingStatsStore';
import { ReadingStatsMetrics } from '../src/components/ReadingStatsMetrics';
import { AppProvider, useApp } from '../src/context/AppContext';
import { LibraryReader } from '../src/components/LibraryReader';
import { AndroidHeader } from '../src/components/AndroidHeader';
import { BackgroundTasks } from '../src/context/BackgroundTasks';
import { DICTIONARY_STORES, replaceStores, readAppValue } from '../src/utils/indexedDbStorage';
import '../src/index.css';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const output = document.querySelector('#results')!, area = document.querySelector('#root')!;
const lines: string[] = [];
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
let clock = 0, focused = true, visible = 'visible', end = false;
const original = { now: performance.now, interval: window.setInterval, clear: window.clearInterval, hasFocus: document.hasFocus };
const intervals = new Map<number, () => void>(); let nextTimer = 1;
Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible });
document.hasFocus = () => focused;
window.setInterval = ((callback: () => void) => { const id = nextTimer++; intervals.set(id, callback); return id; }) as typeof window.setInterval;
window.clearInterval = ((id: number) => { intervals.delete(id); }) as typeof window.clearInterval;
let current: ReadingStats, changeChapter: (id: string) => void, reset: () => void, expand: () => void;
function Harness() {
  const [stats, setStats] = useState(emptyReadingStats), [chapter, setChapter] = useState('one'), [expanded, setExpanded] = useState(false);
  current = stats; changeChapter = setChapter; reset = () => setStats(emptyReadingStats()); expand = () => setExpanded(value => !value);
  useReadingActivity({ bookId: 'book', chapterId: chapter, epoch: stats.epoch, enabled: true, atEnd: () => end, record: delta => setStats(previous => applyReadingDelta(previous, delta)) });
  return <div style={{ width: '280px' }}><ReadingStatsMetrics stats={stats} novels={[]} chapters={[]} expanded={expanded} /></div>;
}
const root = createRoot(area);
let api: ReturnType<typeof useApp>, closeReader: () => void;
const book = { id: 'integration-book', title: 'Test book', isFavorite: true, createdAt: 1, updatedAt: 1 };
const chapter = { id: 'integration-chapter', novelId: book.id, title: 'Chapter 1', originalText: 'Nội dung đọc thử. '.repeat(20), vietphraseText: 'Nội dung đọc thử. '.repeat(20), savedAt: 1 };
function IntegratedReader() {
  api = useApp(); const [open, setOpen] = useState(true); closeReader = () => setOpen(false);
  return <BackgroundTasks><AndroidHeader />{open && <LibraryReader book={book} chapters={[chapter]} onClose={() => setOpen(false)} onEdit={() => {}} />}</BackgroundTasks>;
}
const until = async (predicate: () => unknown) => {
  for (let n = 0; n < 200; n++) { if (predicate()) return; await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }); }
  throw new Error('Integration timed out');
};
const advance = async (seconds: number) => { for (let n = 0; n < seconds; n++) await act(async () => { clock += 1000; for (const callback of [...intervals.values()]) callback(); }); };
async function run() {
  await act(async () => root.render(<Harness />));
  assert(area.querySelectorAll('button').length === 6, 'Collapsed view must show 6 metrics');
  await act(async () => expand());
  assert(area.querySelectorAll('button').length === 12, 'Expanded view must show 12 metrics');
  await act(async () => area.querySelector<HTMLButtonElement>('button[title*="3 phút"]')!.click());
  assert(area.querySelector('[role="status"]')?.textContent?.includes('3 phút'), 'Mobile explanation is missing');
  await act(async () => expand());
  assert(area.querySelectorAll('button').length === 6, 'Collapse did not restore 6 metrics');
  lines.push('PASS 6/12 metrics and tappable mobile descriptions');
  await advance(30);
  assert(current.totalReadBooks === 1 && current.totalReadMinutes === 0.5, 'Active reading time was not recorded');
  end = true; await advance(15);
  assert(current.chapters[JSON.stringify(['book', 'one'])].completed, 'Completion threshold was not recorded');
  const beforeHide = current.totalReadMinutes;
  await act(async () => { focused = false; window.dispatchEvent(new Event('blur')); visible = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
  await advance(60);
  assert(current.totalReadMinutes === beforeHide, 'Hidden/unfocused reader added time');
  await act(async () => { focused = true; visible = 'visible'; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
  await advance(200); const afterIdle = current.totalReadMinutes; await advance(60);
  assert(current.totalReadMinutes === afterIdle, 'Idle reader kept adding time');
  await act(async () => document.dispatchEvent(new Event('pointerdown'))); await advance(15);
  assert(current.totalReadMinutes > afterIdle, 'Reading did not resume after interaction');
  lines.push('PASS active reading, completion, background/blur pause, idle pause and resume');
  end = false; await act(async () => changeChapter('two')); await advance(35);
  end = true; await act(async () => changeChapter('three'));
  assert(!current.chapters[JSON.stringify(['book', 'two'])].completed, 'New chapter end position leaked into previous chapter');
  await advance(5); await act(async () => reset());
  assert(current.totalReadMinutes === 0 && Object.keys(current.chapters).length === 0, 'Reset resurrected pending old-epoch time');
  lines.push('PASS chapter switch attribution and reset without stale buffered events');
  await act(async () => root.unmount());
  const initial = await updateReadingStats(() => emptyReadingStats());
  const delta = { epoch: initial.epoch, bookId: 'store-book', chapterId: 'store-chapter', day: localReadingDay(), seconds: 15, atEnd: true };
  await Promise.all(Array.from({ length: 8 }, () => updateReadingStats(stats => applyReadingDelta(stats, delta))));
  const persisted = await updateReadingStats(stats => stats);
  assert(persisted.totalReadMinutes === 2 && persisted.totalReadBooks === 1 && Object.values(persisted.chapters).filter(row => row.completed).length === 1, 'Concurrent writes lost time or double-counted book/chapter');
  await updateReadingStats(() => emptyReadingStats());
  const afterReset = await updateReadingStats(stats => applyReadingDelta(stats, delta));
  assert(afterReset.totalReadMinutes === 0, 'Delayed persisted write resurrected cleared statistics');
  lines.push('PASS atomic persistence across concurrent writers and reset epoch protection');
  await replaceStores(Object.fromEntries(DICTIONARY_STORES.map(name => [name, []])), { dictionariesInitialized: true, library: { novelsList: [book], savedChapters: [chapter] }, readingStats: emptyReadingStats() });
  const integrated = createRoot(area); end = false; focused = true; visible = 'visible';
  await act(async () => integrated.render(<AppProvider><IntegratedReader /></AppProvider>));
  await until(() => area.querySelector('[data-reader-paragraph]'));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
  await advance(30);
  await until(() => api?.readingStats.totalReadBooks === 1);
  assert(api.readingStats.totalReadMinutes === 0.5, 'Real LibraryReader/AppProvider did not persist active time');
  await act(async () => closeReader());
  await act(async () => area.querySelector<HTMLButtonElement>('button[aria-label="Mở menu"]')!.click());
  assert(document.querySelectorAll('#drawer-reading-metrics button').length === 6, 'Drawer collapsed count is incorrect');
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Xem đầy đủ thống kê"]')!.click());
  assert(document.querySelectorAll('#drawer-reading-metrics button').length === 12, 'Drawer expansion did not work');
  assert(document.querySelector('#drawer-reading-metrics')?.textContent?.includes('Truyện yêu thích'), 'New interesting metric missing');
  await act(async () => { assert(await api.resetReadingStats(), 'Reset failed'); });
  assert(api.readingStats.totalReadMinutes === 0 && api.novelsList.length === 1 && api.savedChapters.length === 1, 'Reset changed library or retained reading time');
  const saved = await readAppValue<ReadingStats>('readingStats');
  assert(saved?.totalReadMinutes === 0 && saved.epoch === api.readingStats.epoch, 'Provider reset did not persist');
  lines.push('PASS actual LibraryReader → AppProvider → IndexedDB, drawer 6/12 toggle, reset preserves books/chapters');
  await act(async () => integrated.unmount());
}
run().then(() => { output.textContent = lines.join('\n') + '\nALL PASSED'; }).catch(error => { output.textContent = lines.join('\n') + '\nFAIL: ' + error.stack; }).finally(() => {
  Object.defineProperty(performance, 'now', { configurable: true, value: original.now }); delete (document as any).visibilityState;
  document.hasFocus = original.hasFocus; window.setInterval = original.interval; window.clearInterval = original.clear;
});
