const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const path = require('node:path');
const compiled = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/epubImport.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, loaded, loaded.exports);
const { splitEpubDocument } = loaded.exports;

test('EPUB repeated heading does not create a phantom chapter', () => {
  const chapters = splitEpubDocument('第1章 开始\n第1章 开始\n真实正文\n第2章 后来\n第二正文', 1);
  assert.equal(chapters.length, 2);
  assert.deepEqual(chapters.map(c => c.content), ['真实正文', '第二正文']);
});
test('EPUB prose without numbered headings keeps its opening line', () => {
  const chapters = splitEpubDocument('开篇正文不能丢失\n第二段', 7, '开端');
  assert.equal(chapters[0].content, '开篇正文不能丢失\n第二段');
  assert.equal(chapters[0].rawTitle, '开端');
  assert.equal(chapters[0].chapterNum, 7);
});
test('EPUB heading-only table of contents is not imported as chapters', () => {
  assert.deepEqual(splitEpubDocument('第1章 开始\n第2章 后来\n第3章 结束', 1), []);
});
test('EPUB preserves parts with the same number but different content', () => {
  const chapters = splitEpubDocument('第1章 开始 (1/2)\n第一部分\n第1章 开始 (2/2)\n第二部分', 1);
  assert.equal(chapters.length, 2);
  assert.deepEqual(chapters.map(c => c.content), ['第一部分', '第二部分']);
});
