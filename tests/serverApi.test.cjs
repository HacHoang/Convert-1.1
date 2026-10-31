const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { Capacitor } = require('@capacitor/core');
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/serverApi.ts')], platform: 'node', format: 'cjs', bundle: true, packages: 'external', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { isServerApiAvailable, isServerApiUnavailable, serverApiUrl } = loaded.exports;

test('browser API paths preserve same-origin server endpoints', () => {
  const isNativePlatform = Capacitor.isNativePlatform;
  Capacitor.isNativePlatform = () => false;
  try {
    assert.equal(isServerApiAvailable(), true);
    assert.equal(serverApiUrl('/api/auth/session'), '/api/auth/session');
  } finally {
    Capacitor.isNativePlatform = isNativePlatform;
  }
});

test('native API paths fail explicitly until an API backend is configured', () => {
  const isNativePlatform = Capacitor.isNativePlatform;
  Capacitor.isNativePlatform = () => true;
  try {
    assert.equal(isServerApiAvailable(), false);
    assert.throws(() => serverApiUrl('/api/web-import/resource'), error => isServerApiUnavailable(error) && /máy chủ API/.test(error.message));
  } finally {
    Capacitor.isNativePlatform = isNativePlatform;
  }
});
