const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');

const built = buildSync({ entryPoints: ['src/utils/vietnameseTypography.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const moduleShim = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, moduleShim, moduleShim.exports);
const { capitalizeLineStarts, normalizeVietnameseTypography } = moduleShim.exports;

test('uppercases the first Unicode letter of every line after leading symbols', () => {
  const source = 'trước mắt\n  “một câu”\n123) đường xa\n😀… tiếng nói\n\n[đã xong]';
  assert.equal(
    capitalizeLineStarts(source),
    'Trước mắt\n  “Một câu”\n123) Đường xa\n😀… Tiếng nói\n\n[Đã xong]',
  );
});

test('line capitalization can be enabled during Vietnamese typography normalization', () => {
  assert.equal(normalizeVietnameseTypography('“xin chào”，thế giới\n- dòng hai', true), '"Xin chào", thế giới\n- Dòng hai');
  assert.equal(normalizeVietnameseTypography('“xin chào”', false), '"xin chào"');
});
