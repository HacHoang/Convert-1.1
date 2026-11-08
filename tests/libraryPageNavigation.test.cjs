const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');

const bundle = buildSync({ entryPoints: ['src/utils/libraryPageNavigation.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const loaded = { exports: {} };
new Function('module', 'exports', bundle.outputFiles[0].text)(loaded, loaded.exports);
const { libraryPageAfterSwipe } = loaded.exports;

test('left swipe opens chapters and right swipe returns to details', () => {
  assert.equal(libraryPageAfterSwipe('details', -90, 8), 'chapters');
  assert.equal(libraryPageAfterSwipe('chapters', 90, -5), 'details');
});

test('short, vertical and opposite swipes do not change the library page', () => {
  assert.equal(libraryPageAfterSwipe('details', -40, 0), 'details');
  assert.equal(libraryPageAfterSwipe('details', -90, 100), 'details');
  assert.equal(libraryPageAfterSwipe('details', 90, 0), 'details');
  assert.equal(libraryPageAfterSwipe('chapters', -90, 0), 'chapters');
});
