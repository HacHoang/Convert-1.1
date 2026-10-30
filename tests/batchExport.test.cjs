const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const path = require('node:path');
const JSZip = require('jszip');
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/batchExportUtils.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);

test('selected chapter downloads use EPUB-style blob links with unique TXT/DOCX filenames and no folder picker', async () => {
  const originalDocument = globalThis.document, originalWindow = globalThis.window;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL, originalTimeout = globalThis.setTimeout;
  const blobs = new Map(), downloads = [];
  globalThis.window = { showDirectoryPicker: () => { throw Error('Folder picker must not be called'); } };
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { downloads.push({ name: this.download, blob: blobs.get(this.href) }); }, remove() {} }) };
  URL.createObjectURL = blob => { const id = `blob:${blobs.size}`; blobs.set(id, blob); return id; };
  URL.revokeObjectURL = () => {};
  globalThis.setTimeout = (callback, delay, ...args) => originalTimeout(callback, delay === 30000 ? 1 : delay, ...args);
  const chapters = [1, 2].map(part => ({ id: `c-${part}`, chapterNum: 1, rawTitle: `Chương 1 (${part}/2)`, translatedTitle: `Chương 1 (${part}/2)`, translatedContent: `Nội dung phần ${part}` }));
  try {
    for (const format of ['txt', 'docx']) assert.equal((await loaded.exports.downloadChapterFiles(chapters, format)).count, 2);
    assert.deepEqual(downloads.map(file => file.name), ['1-1.txt', '1-2.txt', '1-1.docx', '1-2.docx']);
    assert.match(await downloads[0].blob.text(), /Nội dung phần 1/);
    const docx = await JSZip.loadAsync(await downloads[3].blob.arrayBuffer());
    assert.match(await docx.file('word/document.xml').async('string'), /Nội dung phần 2/);
  } finally {
    globalThis.document = originalDocument; globalThis.window = originalWindow;
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; globalThis.setTimeout = originalTimeout;
  }
});

test('folder picker runs immediately and all TXT/DOCX files are closed before success', async () => {
  const previousWindow = globalThis.window;
  const files = new Map(); let picked = 0, closed = 0;
  globalThis.window = { showDirectoryPicker: () => {
    picked++;
    return Promise.resolve({ name: 'Selected folder', getFileHandle: async name => ({ createWritable: async () => ({ write: async data => files.set(name, data), close: async () => { closed++; }, abort: async () => {} }) }) });
  } };
  const chapters = [1, 2].map(number => ({ id: `chapter-${number}`, chapterNum: number, rawTitle: `Chương ${number}`, translatedTitle: `Chương ${number}`, translatedContent: `Nội dung ${number}` }));
  try {
    for (const format of ['txt', 'docx']) {
      const progress = [];
      const task = loaded.exports.saveChaptersToUserFolder(chapters, format, count => progress.push(count));
      assert.equal(picked, format === 'txt' ? 1 : 2, 'picker must open before the first asynchronous wait');
      const result = await task;
      assert.equal(result.count, 2);
      assert.equal(result.folderName, 'Selected folder');
      assert.deepEqual(progress, [1, 2]);
      assert.ok(files.has(`1.${format}`) && files.has(`2.${format}`));
    }
    assert.equal(closed, 4);
  } finally { globalThis.window = previousWindow; }
});

test('cancelled folder picker writes nothing and write failure cannot report success', async () => {
  const previousWindow = globalThis.window;
  try {
    globalThis.window = { showDirectoryPicker: () => Promise.reject(new DOMException('Cancelled', 'AbortError')) };
    await assert.rejects(loaded.exports.saveChaptersToUserFolder([], 'txt'), { name: 'AbortError' });
    let aborted = false;
    globalThis.window = { showDirectoryPicker: async () => ({ name: 'test', getFileHandle: async () => ({ createWritable: async () => ({ write: async () => { throw Error('disk full'); }, abort: async () => { aborted = true; } }) }) }) };
    await assert.rejects(loaded.exports.saveChaptersToUserFolder([{ id: 'c', chapterNum: 1, rawTitle: 'Chương 1', translatedContent: 'body' }], 'txt'), /0\/1.*disk full/);
    assert.equal(aborted, true);
  } finally { globalThis.window = previousWindow; }
});

test('folder write permission is requested and file creation AbortError becomes a visible failure', async () => {
  const previousWindow = globalThis.window;
  const chapter = { id: 'c', chapterNum: 1, rawTitle: 'Chương 1', translatedContent: 'body' };
  let requested = false, created = false;
  try {
    globalThis.window = { showDirectoryPicker: async () => ({ name: 'Selected folder', queryPermission: async () => 'prompt', requestPermission: async () => { requested = true; return 'denied'; }, getFileHandle: async () => { created = true; } }) };
    await assert.rejects(loaded.exports.saveChaptersToUserFolder([chapter], 'txt'), /Chưa có quyền ghi/);
    assert.equal(requested, true);
    assert.equal(created, false);
    const stages = [];
    globalThis.window = { showDirectoryPicker: async () => ({ name: 'Selected folder', queryPermission: async () => 'granted', getFileHandle: async () => { throw new DOMException('write blocked', 'AbortError'); } }) };
    await assert.rejects(loaded.exports.saveChaptersToUserFolder([chapter], 'txt', undefined, message => stages.push(message)), error => error.name === 'Error' && /1\.txt.*0\/1.*write blocked/.test(error.message));
    assert.equal(stages.length, 2);
  } finally { globalThis.window = previousWindow; }
});

test('integrated browser chooser interception is an actionable error, not a silent cancellation', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { showDirectoryPicker: () => Promise.reject(new DOMException("Failed to execute 'showDirectoryPicker' on 'Window': Intercepted by Page.setInterceptFileChooserDialog().", 'AbortError')) };
  try {
    await assert.rejects(loaded.exports.saveChaptersToUserFolder([], 'txt'), error => error.name === 'Error' && /chặn hộp chọn thư mục/.test(error.message) && /chưa có file nào/.test(error.message));
  } finally { globalThis.window = previousWindow; }
});

test('saving to a computer without folder support produces TXT or DOCX, never a ZIP download', async () => {
  const previousDocument = globalThis.document;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  let blob, filename;
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { filename = this.download; }, remove() {} }) };
  URL.createObjectURL = value => { blob = value; return 'blob:test'; };
  URL.revokeObjectURL = () => {};
  const chapters = [{ rawTitle: 'Chapter 1', translatedTitle: 'Chương 1', translatedContent: 'Nội dung một' }, { rawTitle: 'Chapter 2', translatedTitle: 'Chương 2', translatedContent: 'Nội dung hai' }];
  try {
    await loaded.exports.downloadCombinedChapters(chapters, 'txt', 'Truyện');
    assert.equal(filename, 'Truyện.txt');
    const text = await blob.text();
    assert.match(text, /Chương 1\n\nNội dung một/);
    assert.match(text, /Chương 2\n\nNội dung hai/);
    await loaded.exports.downloadCombinedChapters(chapters, 'docx', 'Truyện');
    assert.equal(filename, 'Truyện.docx');
    const document = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await document.file('word/document.xml').async('string');
    assert.match(xml, /Nội dung một/);
    assert.match(xml, /Nội dung hai/);
  } finally {
    globalThis.document = previousDocument;
    URL.createObjectURL = previousCreate;
    URL.revokeObjectURL = previousRevoke;
  }
});
