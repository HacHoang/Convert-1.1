const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gzipSync, gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const { buildSync } = require('esbuild');
const built = buildSync({ entryPoints: [path.join(__dirname, '../src/utils/defaultDictionaries.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { validateDefaultManifest, loadDefaultDictionaries } = loaded.exports;
const directory = path.join(__dirname, '../public/assets/default-dictionaries');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));

test('bundled snapshot contains complete, intact dictionary data and no library or account data', () => {
  validateDefaultManifest(manifest);
  assert.equal(manifest.stores.length, 7);
  for (const entry of manifest.stores) {
    const bytes = fs.readFileSync(path.join(directory, entry.file));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    const rows = JSON.parse(gunzipSync(bytes));
    assert.equal(rows.length, entry.count);
    assert.ok(!rows.some(row => row.chinese?.toLowerCase() === 'ttv' && row.vietnamese === 'tangthuvien'));
  }
  assert.ok(manifest.stores.find(entry => entry.store === 'vietphrase_store').count > 960000);
  assert.ok(manifest.stores.find(entry => entry.store === 'names_main_store').count > 136000);
});

test('manifest rejects missing, duplicate and unsafe store paths', () => {
  for (const edit of [
    m => m.stores.pop(),
    m => { m.stores[0] = m.stores[1]; },
    m => { m.stores[0].file = '../other.json.gz'; },
    m => { m.stores[0].store = 'app_store'; },
  ]) {
    const value = structuredClone(manifest); edit(value);
    assert.throws(() => validateDefaultManifest(value));
  }
});

function fixture() {
  const value = structuredClone(manifest);
  const files = new Map();
  for (const entry of value.stores) {
    const row = entry.store === 'names_store' ? { id: 'n', chinese: '名', vietnamese: 'danh', category: 'Khác', createdAt: 1 } :
      entry.store === 'luat_nhan_store' ? { pattern: '{0}', translation: '{0}' } :
      entry.store === 'ignored_phrases_store' ? { phrase: '广告' } : { chinese: '中', vietnamese: 'trung' };
    const bytes = gzipSync(JSON.stringify([row]));
    entry.count = 1; entry.bytes = bytes.length;
    entry.sha256 = createHash('sha256').update(bytes).digest('hex');
    files.set(entry.file, bytes);
  }
  const fetcher = async url => url.endsWith('manifest.json') ? Response.json(value) : new Response(files.get(url.split('/').pop()));
  return { value, files, fetcher };
}

test('loader handles gzip and already-decoded static-host responses', async () => {
  const data = fixture();
  const gzip = await loadDefaultDictionaries(undefined, data.fetcher);
  const decoded = await loadDefaultDictionaries(undefined, async url => url.endsWith('manifest.json') ? Response.json(data.value) :
    new Response(gunzipSync(data.files.get(url.split('/').pop()))));
  assert.deepEqual(gzip, decoded);
  assert.equal(Object.keys(gzip.stores).length, 7);
});

test('failed download or truncated content never returns a partial default bundle', async () => {
  const data = fixture();
  await assert.rejects(loadDefaultDictionaries(undefined, async url => url.includes('vietphrase_store') ? new Response('', { status: 503 }) : data.fetcher(url)));
  const bytes = data.files.get('vietphrase_store.json.gz');
  data.files.set('vietphrase_store.json.gz', bytes.subarray(0, bytes.length - 1));
  await assert.rejects(loadDefaultDictionaries(undefined, data.fetcher));
});
