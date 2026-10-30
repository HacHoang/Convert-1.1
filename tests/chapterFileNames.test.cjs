const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const path = require('node:path');
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/chapterFileNames.ts')], platform: 'node', format: 'cjs', bundle: true, write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { chapterFileNames } = loaded.exports;
const chapter = (id, chapterNum, rawTitle = '') => ({ id, chapterNum, rawTitle });

test('preserves both parts and single-part imports with explicit part numbers', () => {
  const parts = [chapter('a', 45, 'Title (1/2)'), chapter('b', 45, 'Title (2/2)'), chapter('c', 46)];
  assert.deepEqual([...chapterFileNames(parts, 'txt').values()], ['45-1.txt', '45-2.txt', '46.txt']);
  assert.deepEqual([...chapterFileNames([parts[1]], 'docx').values()], ['45-2.docx']);
});

test('all output names remain unique with unlabelled duplicates and repeated part labels', () => {
  const parts = [chapter('a', 1), chapter('b', 1, '(1/2)'), chapter('c', 1, '（1／2）'), chapter('d', 1, '(2/2)')];
  const names = [...chapterFileNames(parts, 'txt').values()];
  assert.equal(new Set(names).size, parts.length);
});
