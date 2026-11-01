const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/chapterRange.ts')], platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { chapterIdsOutsidePositionRange } = loaded.exports;

test('batch save range uses queue positions for 2,095 chapters even when source numbers stop at 789', () => {
  const chapters = Array.from({ length: 2095 }, (_, index) => ({
    id: `chapter-${index + 1}`,
    chapterNum: (index % 789) + 1,
  }));
  assert.deepEqual(chapterIdsOutsidePositionRange(chapters, 1, 2095), []);

  const excluded = chapterIdsOutsidePositionRange(chapters, 788, 790);
  assert.equal(excluded.length, 2092);
  assert.ok(!excluded.includes('chapter-788'));
  assert.ok(!excluded.includes('chapter-789'));
  assert.ok(!excluded.includes('chapter-790'));
  assert.ok(excluded.includes('chapter-787'));
  assert.ok(excluded.includes('chapter-791'));
});
