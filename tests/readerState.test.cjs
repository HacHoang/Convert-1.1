const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');
const result = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/readerState.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, loaded, loaded.exports);
const { mergeReadingProgress, orderReaderChapters, readerChapterBlocks, shouldAdvanceReader, validReaderState, DEFAULT_READER_PREFERENCES, ReaderEndGate } = loaded.exports;
const position = { chapterId: 'c', paragraphIndex: 3, paragraphOffset: 0.5, scrollRatio: 0.4, updatedAt: 10 };

test('chapter end requires a fresh gesture after reading time and continuous scrolling cannot advance', () => {
  const gate = new ReaderEndGate();
  assert.equal(gate.update(0, true, true), false);
  assert.equal(gate.update(1000, true, true), false);
  assert.equal(gate.update(2500, true, false), false);
  for (let time = 1100; time <= 4000; time += 100) assert.equal(gate.update(time, true, true), false);
  assert.equal(gate.update(4700, true, true), true);
  gate.reset();
  assert.equal(gate.update(4800, true, true), false);
  assert.equal(gate.update(7500, false, true), false);
  assert.equal(gate.update(7600, true, true), false);
  assert.equal(gate.update(10000, true, true), false);
  assert.equal(gate.update(10700, true, true), true);
});

test('newer reading positions win while other novels retain their positions', () => {
  const current = { first: position, second: { ...position, chapterId: 'other' } };
  const result = mergeReadingProgress(current, { first: { ...position, updatedAt: 9 }, third: position });
  assert.equal(result.first.updatedAt, 10);
  assert.equal(result.second.chapterId, 'other');
  assert.deepEqual(result.third, position);
  assert.equal(current.third, undefined);
});
test('reader sorts chapter numbers and explicit parts naturally without mutating source', () => {
  const chapters = ['Chương 101', 'Chương 2 (2/2)', 'Chương 10', 'Chương 2 (1/2)', 'Chương 1'].map((title, index) => ({ id: String(index), title, originalText: '', savedAt: 0 }));
  assert.deepEqual(orderReaderChapters(chapters).map(row => row.title), ['Chương 1', 'Chương 2 (1/2)', 'Chương 2 (2/2)', 'Chương 10', 'Chương 101']);
  assert.equal(chapters[0].title, 'Chương 101');
  assert.deepEqual(readerChapterBlocks(205), [{ index: 0, start: 0, end: 100 }, { index: 1, start: 100, end: 200 }, { index: 2, start: 200, end: 205 }]);
});
test('automatic advance requires user intent and cannot cascade on restoration or short chapters', () => {
  const options = { enabled: true, interacting: true, restoring: false, panelOpen: false, hasNext: true, elapsed: 1500, bottomGap: 0, overflow: 900, allowShort: false };
  assert.equal(shouldAdvanceReader(options), true);
  for (const patch of [{ enabled: false }, { interacting: false }, { restoring: true }, { panelOpen: true }, { hasNext: false }, { elapsed: 500 }, { bottomGap: 20 }, { overflow: 0 }]) assert.equal(shouldAdvanceReader({ ...options, ...patch }), false);
  assert.equal(shouldAdvanceReader({ ...options, overflow: 0, allowShort: true }), true);
});
test('reader backup validation rejects invalid anchors and preferences', () => {
  const state = { progress: { book: position }, bookmarks: [{ ...position, id: 'mark', novelId: 'book', label: 'Page' }], preferences: DEFAULT_READER_PREFERENCES };
  assert.equal(validReaderState(state), true);
  assert.equal(validReaderState({ ...state, progress: { book: { ...position, scrollRatio: 4 } } }), false);
  assert.equal(validReaderState({ ...state, bookmarks: [{ ...position, id: 'bad' }] }), false);
  assert.equal(validReaderState({ ...state, preferences: { ...DEFAULT_READER_PREFERENCES, fontSize: 1000 } }), false);
});
