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
const { readTextFile } = load('textFile.ts');

test('dictionary imports preserve UTF-16LE/BE, CR-only lines, empty meanings and long keys', async () => {
  const text = '名字=La Bân\r空=\r' + '长'.repeat(126) + '=nghĩa=a/b\r';
  const utf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
  const utf16be = Buffer.from(utf16le); utf16be.swap16();
  for (const bytes of [Buffer.from(text, 'utf8'), utf16le, utf16be]) {
    const rows = await parseDictionaryFileChunked(new File([bytes], 'dict.txt'));
    assert.equal(rows.length, 3);
    assert.equal(rows[0].vietnamese, 'La Bân');
    assert.equal(rows[1].vietnamese, '');
    assert.equal(rows[2].chinese.length, 126);
    assert.equal(rows[2].vietnamese, 'nghĩa=a/b');
  }
});

test('invalid text encoding is rejected instead of silently inserting replacement characters', async () => {
  await assert.rejects(readTextFile(new Blob([new Uint8Array([0x81, 0x82, 0x83])])), /UTF-8/);
});
const { readConvertPreference } = load('legacyCompatibility.ts');
const { mergeDictionaryRows } = load('indexedDbStorage.ts');

test('dictionary edits notify other windows only after a successful commit', async () => {
  const storage = load('indexedDbStorage.ts');
  const originals = ['indexedDB', 'BroadcastChannel'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const events = [];
  let fail = false;
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: class {
    postMessage(stores) { events.push(stores); }
    close() {}
  } });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open() {
      const request = { result: {
        close() {},
        transaction() {
          const tx = {
            error: new Error('quota'),
            objectStore() { return {
              put() {}, delete() {},
              get() { const req = { result: [] }; queueMicrotask(() => req.onsuccess?.()); return req; },
            }; },
          };
          queueMicrotask(() => queueMicrotask(() => fail ? tx.onabort() : tx.oncomplete()));
          return tx;
        },
      } };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  } });
  try {
    await storage.saveVietphraseItem('中', 'trung');
    await storage.deleteVietphraseItem('中');
    assert.deepEqual(events, [[storage.STORE_VIETPHRASE], [storage.STORE_VIETPHRASE]]);
    fail = true;
    await assert.rejects(storage.saveVietphraseItem('中', 'trung'), /quota/);
    await assert.rejects(storage.deleteVietphraseItem('中'), /quota/);
    assert.equal(events.length, 2);
    await storage.saveVietphraseBatch([]);
    assert.equal(events.length, 2);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
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

test('Hermes backups use current branding and old branded backups remain importable', () => {
  for (const app of ['Hermes', 'Convert', 'TTV Translate']) {
    const backup = parseBackup(JSON.stringify({ ...legacy, app }));
    assert.equal(backup.app, 'Hermes');
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

test('ignored phrase streaming retains full lines and skips comments', async () => {
  const file = new File(['\uFEFF# comment\r\n广告=整行\r\n\r\n// skip\n末尾'], 'ignored.txt');
  const rows = await parseDictionaryFileChunked(file, undefined, undefined, 'ignored');
  assert.deepEqual(rows, [{ chinese: '广告=整行', vietnamese: '' }, { chinese: '末尾', vietnamese: '' }]);
});
