const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');

const built = buildSync({ entryPoints: ['src/utils/simplifyChinese.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const moduleShim = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, moduleShim, moduleShim.exports);
const { simplifyChinese } = moduleShim.exports;

test('traditional normalization is idempotent for custom VietPhrase keys', () => {
  const traditional = '沒安什麼好心眼兒';
  const simplified = '没安什么好心眼儿';
  assert.equal(simplifyChinese(traditional), simplified);
  assert.equal(simplifyChinese(simplified), simplified);
  assert.equal(simplifyChinese(simplifyChinese(traditional)), simplified);
});
