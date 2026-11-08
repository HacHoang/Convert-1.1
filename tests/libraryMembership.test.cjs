const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const built = buildSync({ entryPoints: ['src/utils/libraryMembership.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} };
new Function('module', 'exports', built.outputFiles[0].text)(loaded, loaded.exports);
const { countLibraryChapters, chapterBelongsToNovel } = loaded.exports;

test('empty book shells do not count unattached sample chapters', () => {
  const novels = [{ id: 'one', title: 'One' }, { id: 'two', title: 'Two' }, { id: 'three', title: 'Three' }];
  assert.equal(countLibraryChapters([{ novelTitle: 'Sample A' }, { novelTitle: 'Sample B' }, {}], novels), 0);
  assert.equal(countLibraryChapters([{ novelId: 'one' }, { novelTitle: 'Two' }], novels), 2);
});

test('explicit book IDs take precedence and duplicate book titles do not double-count', () => {
  const novels = [{ id: 'one', title: 'Same' }, { id: 'two', title: 'Same' }];
  assert.equal(chapterBelongsToNovel({ novelId: 'deleted', novelTitle: 'Same' }, novels[0]), false);
  assert.equal(countLibraryChapters([{ novelTitle: 'Same' }, { novelId: 'one', novelTitle: 'Old title' }], novels), 2);
  assert.equal(countLibraryChapters([{ novelId: 'one' }], []), 0);
});
