const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');
function load(file) {
  const built = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/', file)], bundle: true, platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
const { parseBackup, backupStores } = load('appBackup.ts');
const { parseDictionaryFileChunked } = load('largeFileImporter.ts');
const { readConvertPreference } = load('legacyCompatibility.ts');
const { mergeDictionaryRows } = load('indexedDbStorage.ts');
const legacy = { app: 'TTV Translate', version: '2.6-offline', namesList: [], vietphraseMap: {}, savedChapters: [] };

test('backup preserves reading progress, bookmarks and preferences and rejects invalid anchors', () => {
  const { DEFAULT_READER_PREFERENCES } = load('readerState.ts');
  const position = { chapterId: 'chapter-2', paragraphIndex: 12, paragraphOffset: 0.4, scrollRatio: 0.3, updatedAt: 100 };
  const readerState = { progress: { novel: position }, bookmarks: [{ ...position, id: 'mark', novelId: 'novel', label: 'Saved page' }], preferences: DEFAULT_READER_PREFERENCES };
  assert.deepEqual(parseBackup(JSON.stringify({ ...legacy, readerState })).readerState, readerState);
  assert.throws(() => parseBackup(JSON.stringify({ ...legacy, readerState: { ...readerState, progress: { novel: { ...position, paragraphIndex: -1 } } } })));
});

test('snapshot overlays preserve edits, honor deletions, and allow re-adding entries', () => {
  const baseline = [{ chinese: 'a', vietnamese: 'old' }, { chinese: 'b', vietnamese: 'base' }];
  assert.equal(mergeDictionaryRows(baseline, [], [], 'chinese'), baseline);
  assert.deepEqual(mergeDictionaryRows(baseline, [{ chinese: 'a', vietnamese: 'new' }], ['a', 'b'], 'chinese'), [{ chinese: 'a', vietnamese: 'new' }]);
  assert.deepEqual(mergeDictionaryRows(baseline, [], ['a'], 'chinese'), [baseline[1]]);
  assert.deepEqual(baseline[0], { chinese: 'a', vietnamese: 'old' });
});

test('current backups use Convert and old branded backups normalize to Convert', () => {
  for (const app of ['Convert', 'TTV Translate']) {
    const backup = parseBackup(JSON.stringify({ ...legacy, app }));
    assert.equal(backup.app, 'Convert');
    assert.ok(!JSON.stringify(backup).includes('TTV'));
  }
});

test('preferences migrate to Convert keys without overwriting current preferences', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map([['ttv_sync_scroll', 'false']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  try {
    assert.equal(readConvertPreference('convert_sync_scroll'), 'false');
    assert.equal(values.get('convert_sync_scroll'), 'false');
    values.set('convert_sync_scroll', 'true');
    assert.equal(readConvertPreference('convert_sync_scroll'), 'true');
    values.delete('convert_sync_scroll');
    storage.setItem = () => { throw new Error('quota'); };
    assert.equal(readConvertPreference('convert_sync_scroll'), 'false');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('legacy backup replaces supplied empty sections and preserves missing sections', () => {
  const data = parseBackup(JSON.stringify(legacy));
  assert.deepEqual(backupStores(data), { names_store: [], vietphrase_store: [] });
  assert.equal(data.novelsList, undefined);
  assert.deepEqual(data.savedChapters, []);
});

test('dictionary-only backup from the previous format is supported', () => {
  const data = parseBackup(JSON.stringify({ version: 2, namesCustom: [], namesMain: { a: 'b' }, ignoredPhrases: [] }));
  assert.deepEqual(backupStores(data).names_main_store, [{ chinese: 'a', vietnamese: 'b' }]);
  assert.deepEqual(backupStores(data).ignored_phrases_store, []);
});

test('reject unrelated, incomplete, future, malformed and duplicate-record backups', () => {
  for (const value of [{}, [], { ...legacy, version: 99 }, { ...legacy, version: 3 },
    { ...legacy, namesList: [null] }, { ...legacy, vietphraseMap: { a: 1 } },
    { ...legacy, savedChapters: [{ id: 'x' }] }, { ...legacy, settings: { theme: 'dark' } },
    { ...legacy, namesList: Array(2).fill({ id: 'x', chinese: 'a', vietnamese: 'b', category: 'Khác', createdAt: 1 }) }]) {
    assert.throws(() => parseBackup(JSON.stringify(value)));
  }
});

test('chunked import preserves UTF-8, long lines, equals signs and final line', async () => {
  const long = '中'.repeat(360000);
  const file = new File([`# comment\n${long}=nghĩa=hai\r\n末=cuối`], 'large.txt');
  const entries = await parseDictionaryFileChunked(file);
  assert.deepEqual(entries, [{ chinese: long, vietnamese: 'nghĩa=hai' }, { chinese: '末', vietnamese: 'cuối' }]);
});

test('streaming consumer receives bounded batches and progress counts committed entries', async () => {
  const file = new File([Array.from({ length: 12003 }, (_, i) => `中${i}=Việt${i}`).join('\n')], 'batch.txt');
  let count = 0;
  let progress;
  const result = await parseDictionaryFileChunked(file, (n, percent) => { progress = [n, percent]; }, async batch => {
    assert.ok(batch.length <= 5000);
    count += batch.length;
  });
  assert.equal(count, 12003);
  assert.deepEqual(result, []);
  assert.deepEqual(progress, [12003, 100]);
});

test('streaming import stops on failed persistence instead of reporting completion', async () => {
  let completed = false;
  await assert.rejects(parseDictionaryFileChunked(new File(['中=Việt'], 'fail.txt'), (_, percent) => {
    if (percent === 100) completed = true;
  }, async () => { throw new Error('quota'); }), /quota/);
  assert.equal(completed, false);
});
