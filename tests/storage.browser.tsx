// Run on a dedicated test origin: npm run dev -- --port 3011
// Open /tests/storage.browser.html. This fixture changes data on that origin.
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, useApp } from '../src/context/AppContext';
import { readAppValue, readStore, replaceStores, writeAppValue, openDB, STORE_NAMES, STORE_APP } from '../src/utils/indexedDbStorage';
import { importEpub } from '../src/utils/epubImport';
import JSZip from 'jszip';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const output = document.getElementById('results')!;
let api: ReturnType<typeof useApp>;
function Probe() { const value = useApp(); useEffect(() => { api = value; }); return null; }
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const lines: string[] = [];
let root = createRoot(document.getElementById('test-root')!);
const wait = () => new Promise(resolve => setTimeout(resolve, 25));
async function remount() {
  await act(async () => { root.unmount(); });
  api = undefined as unknown as ReturnType<typeof useApp>;
  root = createRoot(document.getElementById('test-root')!);
  await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
  for (let i = 0; i < 200 && !api; i++) await act(wait);
  assert(api, 'Provider remount timed out');
}
async function run() {
  await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
  for (let i = 0; i < 200 && !api; i++) await act(wait);
  assert(api, 'Provider hydration timed out');
  const original = await api.exportAllDatabasesJson();
  try {
    await act(async () => {
      const result = await api.importAllDatabasesJson(JSON.stringify({
        app: 'TTV Translate', version: '2.6-offline', namesList: [], vietphraseMap: {}, savedChapters: [],
      }));
      assert(result.success, result.message);
    });
    assert(api.namesList.length === 0 && api.savedChapters.length === 0, 'Empty backup did not clear data');
    assert((await readStore(STORE_NAMES)).length === 0, 'Empty backup was not durable');
    lines.push('PASS legacy restore and empty sections');
    await remount();
    assert(api.namesList.length === 0 && api.savedChapters.length === 0, 'Empty sections resurrected on reload');
    lines.push('PASS cleared data stays empty after remount');

    const epub = new JSZip();
    epub.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>');
    epub.file('book.opf', '<package><manifest><item id="toc" href="toc.xhtml" media-type="application/xhtml+xml"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/><item id="copy" href="copy.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="toc"/><itemref idref="a"/><itemref idref="b"/><itemref idref="copy"/></spine></package>');
    epub.file('toc.xhtml', '<html><body><p><a href="a.xhtml">第1章 开始</a></p><p><a href="b.xhtml">第2章 后来</a></p></body></html>');
    const firstDocument = '<html><body><h1>第1章 开始</h1><h2>第1章 开始</h2><p>第一正文不能丢失</p></body></html>';
    epub.file('a.xhtml', firstDocument);
    epub.file('copy.xhtml', firstDocument);
    epub.file('b.xhtml', '<html><body><h1>第2章 后来</h1><p>第二正文</p></body></html>');
    const parsed = await importEpub(new File([await epub.generateAsync({ type: 'arraybuffer' })], 'regression.epub'));
    assert(parsed.length === 2 && parsed[0].content === '第一正文不能丢失' && parsed[1].content === '第二正文', 'EPUB imported duplicate/empty chapters or lost body text');
    const incomingEpub = parsed.map(row => ({ title: `Chương ${row.chapterNum}`, chapterPrefix: `Chương ${row.chapterNum}`, originalText: row.content, vietphraseText: `Bản dịch ${row.chapterNum}` }));
    let epubBookId = '';
    await act(async () => {
      const saved = await api.saveLibraryChapters({ title: 'EPUB regression' }, incomingEpub);
      assert(saved.count === 2, 'EPUB new-book save duplicated chapters'); epubBookId = saved.novelId;
    });
    await remount();
    assert(api.savedChapters.filter(row => row.novelId === epubBookId).length === 2, 'EPUB chapters changed on reload');
    await act(async () => {
      const saved = await api.saveLibraryChapters(epubBookId, incomingEpub);
      assert(saved.count === 0 && saved.skipped === 2, 'Saving EPUB again created duplicate chapters');
    });
    assert(api.savedChapters.filter(row => row.novelId === epubBookId).every(row => incomingEpub.some(input => input.originalText === row.originalText && input.vietphraseText === row.vietphraseText)), 'EPUB chapter text and translation mismatched');
    lines.push('PASS EPUB TOC/repeated heading/duplicate document import, new-book save, reload and repeat save');
    await writeAppValue('library', { novelsList: [], savedChapters: [] });
    await remount();

    await act(async () => {
      const chapters = [{ title: 'Large chapter', originalText: '中'.repeat(3_000_000), vietphraseText: 'Việt' }];
      const saved = await api.saveLibraryChapters({ title: 'Storage regression' }, chapters);
      assert(saved.count === 1, 'Large chapter not saved');
      const duplicate = await api.saveLibraryChapters(saved.novelId, chapters);
      assert(duplicate.count === 0, 'Duplicate chapter saved');
    });
    let persisted = await readAppValue<any>('library');
    assert(persisted.savedChapters[0].originalText.length === 3_000_000, 'Large chapter not durable');
    lines.push('PASS library > localStorage quota, bulk save and deduplication');

    const saved = persisted.savedChapters[0];
    await act(async () => {
      const result = await api.saveLibraryChapters(saved.novelId, [{ title: saved.title, originalText: saved.originalText, vietphraseText: 'Updated batch translation' }],
        { duplicatePolicy: 'overwrite', overwriteIds: [saved.id] });
      assert(result.overwritten === 1 && result.count === 0, 'Batch overwrite created a new copy');
      const id = await api.saveChapter({ novelId: saved.novelId, novelTitle: saved.novelTitle, title: saved.title,
        originalText: saved.originalText, vietphraseText: 'Updated single translation' },
      { duplicatePolicy: 'overwrite', overwriteIds: [saved.id] });
      assert(id === saved.id, 'Single overwrite changed chapter identity');
    });
    persisted = await readAppValue<any>('library');
    assert(persisted.savedChapters.length === 1 && persisted.savedChapters[0].vietphraseText === 'Updated single translation', 'Overwrite did not persist correctly');
    lines.push('PASS batch and single saves overwrite translations in place');
    const editedId = persisted.savedChapters[0].id;
    await act(async () => {
      await api.updateSavedChapter(editedId, { title: 'Chương 77: Đổi tên độc lập', originalText: 'Edited original', vietphraseText: 'Bản dịch sửa trực tiếp' });
    });
    await remount();
    persisted = await readAppValue<any>('library');
    assert(persisted.savedChapters.length === 1 && persisted.savedChapters[0].id === editedId, 'Editing renamed chapter created a duplicate or changed its ID');
    assert(persisted.savedChapters[0].chapterPrefix === 'Chương 77' && persisted.savedChapters[0].originalText === 'Edited original' && persisted.savedChapters[0].vietphraseText === 'Bản dịch sửa trực tiếp', 'Independent chapter edits did not survive reload');
    lines.push('PASS independent chapter title/source/translation editing keeps ID and survives reload');

    const before = await api.exportAllDatabasesJson();
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === STORE_APP) throw new DOMException('Simulated quota', 'QuotaExceededError');
      return put.apply(this, args);
    };
    try {
      let rejected = false;
      await act(async () => {
        try { await api.saveChapter({ title: 'Must fail', originalText: 'fail', vietphraseText: '' }); }
        catch { rejected = true; }
      });
      assert(rejected, 'Quota failure reported success');
      assert(await api.exportAllDatabasesJson().then(json => JSON.stringify(JSON.parse(json).savedChapters)) === JSON.stringify(JSON.parse(before).savedChapters), 'Failed save changed state');
      const restore = await api.importAllDatabasesJson(original);
      assert(!restore.success, 'Failed restore reported success');
    } finally { IDBObjectStore.prototype.put = put; }
    assert(JSON.stringify(await readAppValue('library')) === JSON.stringify(persisted), 'Failed transaction changed persistent data');
    lines.push('PASS quota failure preserves state and aborts full restore');

    const oldNames = await readStore(STORE_NAMES);
    let aborted = false;
    try { await replaceStores({ [STORE_NAMES]: [{ id: 'valid' }, {}] }); } catch { aborted = true; }
    assert(aborted, 'Invalid key did not abort transaction');
    assert(JSON.stringify(await readStore(STORE_NAMES)) === JSON.stringify(oldNames), 'Aborted transaction cleared dictionary');
    lines.push('PASS transaction rollback after clear and partial puts');

    await act(async () => {
      await api.resetDictionaries();
      const manifest = await fetch('/assets/default-dictionaries/manifest.json').then(response => response.json());
      const expected = manifest.stores.find((entry: any) => entry.store === 'names_main_store').count;
      assert((await readStore('names_main_store')).length === expected, 'Reset missed names main defaults');
      const result = await api.importAllDatabasesJson(before);
      assert(result.success, result.message);
    });
    const restored = JSON.parse(await api.exportAllDatabasesJson());
    delete restored.exportedAt;
    const expected = JSON.parse(before); delete expected.exportedAt;
    const changed = Object.keys(expected).filter(key => JSON.stringify(restored[key]) !== JSON.stringify(expected[key]));
    assert(changed.length === 0, `Full backup round-trip mismatch: ${changed.join(', ')}`);
    lines.push('PASS full backup round-trip after reset');

    await act(async () => {
      const result = await api.importAllDatabasesJson(JSON.stringify({ app: 'TTV Translate', version: '2.6-offline',
        ignoredPhrasesList: ['temporary ignored phrase'] }));
      assert(result.success, result.message);
      api.deleteMultiplePhrases(['temporary ignored phrase'], 'ignored');
    });
    for (let i = 0; i < 100 && api.ignoredPhrasesList.length; i++) await act(wait);
    await remount();
    assert(api.ignoredPhrasesList.length === 0, 'Deleted ignored phrase returned after remount');
    lines.push('PASS ignored phrase deletion survives remount');

    const legacyKeys = ['ttv_novel_books', 'ttv_saved_chapters', 'ttv_reader_settings'];
    const currentKeys = ['convert_novel_books', 'convert_saved_chapters', 'convert_reader_settings'];
    const migrationKeys = [...legacyKeys, ...currentKeys];
    const oldValues = migrationKeys.map(key => localStorage.getItem(key));
    try {
      currentKeys.forEach(key => localStorage.removeItem(key));
      localStorage.setItem(legacyKeys[0], '[]');
      localStorage.setItem(legacyKeys[1], '[]');
      localStorage.setItem(legacyKeys[2], JSON.stringify({ ...api.settings, ttsRate: 1.25 }));
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_APP, 'readwrite');
        tx.objectStore(STORE_APP).delete('library');
        tx.objectStore(STORE_APP).delete('settings');
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(tx.error);
      });
      db.close();
      await remount();
      assert(api.novelsList.length === 0 && api.savedChapters.length === 0, 'Migration replaced empty legacy library with samples');
      assert(api.settings.ttsRate === 1.25, 'Migration missed reader settings');
      await writeAppValue('library', { novelsList: [], savedChapters: [] });
      await remount();
      assert(api.novelsList.length === 0 && api.settings.ttsRate === 1.25, 'Migrated state changed on remount');
      lines.push('PASS legacy migration, empty library and settings survive remount');
    } finally {
      migrationKeys.forEach((key, i) => oldValues[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, oldValues[i]!));
    }
  } finally {
    await act(async () => { const result = await api.importAllDatabasesJson(original); assert(result.success, result.message); });
  }
  await act(async () => { root.unmount(); });
}
run().then(() => { output.textContent = lines.join('\n') + '\nALL PASSED'; })
  .catch(error => { output.textContent = lines.join('\n') + '\nFAIL: ' + error.stack; });
