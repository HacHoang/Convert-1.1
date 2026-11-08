const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const vm = require('node:vm');

async function fixture(desktop, native) {
  const result = await esbuild.build({ entryPoints: ['src/utils/sourceBrowser.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'capacitor-test', setup(build) {
    build.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'capacitor', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const Capacitor = {getPlatform:()=>globalThis.nativeEnabled?"android":"web",isPluginAvailable:()=>!!globalThis.nativeEnabled};export const registerPlugin=()=>globalThis.nativeBridge;', loader: 'js' }));
  } }] });
  const context = { module: { exports: {} }, window: { hermesSourceBrowser: desktop }, nativeEnabled: !!native, nativeBridge: native, URL, Error };
  vm.runInNewContext(result.outputFiles[0].text, context);
  return context.module.exports;
}
test('desktop reader returns captured HTML and rejects invalid protocols before invoking bridge', async () => {
  let calls = 0;
  const api = await fixture({ open: async url => { calls++; return { url, html: '<article>story</article>' }; }, close: async () => {} });
  assert.equal(api.hasSourceBrowser(), true);
  assert.equal((await api.readInSourceBrowser('https://example.org/chapter')).html, '<article>story</article>');
  await assert.rejects(api.readInSourceBrowser('file:///secret'), /URL/);
  await assert.rejects(api.readInSourceBrowser('https://user:pass@example.org'), /URL/);
  assert.equal(calls, 1);
});
test('desktop background fetch uses the bridge without opening the interactive reader', async () => {
  let opens = 0, fetches = 0;
  const api = await fixture({
    open: async url => { opens++; return { url, html: 'interactive' }; },
    fetch: async url => { fetches++; return { url, html: '<article>background</article>' }; },
    close: async () => {},
  });
  const page = await api.readSourceInBackground('https://example.org/chapter', new AbortController().signal);
  assert.equal(page.html, '<article>background</article>');
  assert.equal(api.canFetchSourceInBackground(), true);
  assert.equal(fetches, 1);
  assert.equal(opens, 0);
});
test('Android uses native reader and cancellation closes it without returning late content', async () => {
  let complete, closes = 0;
  const api = await fixture(undefined, { open: () => new Promise(resolve => { complete = resolve; }), close: async () => { closes++; } });
  const controller = new AbortController();
  const pending = api.readInSourceBrowser('https://example.org/', controller.signal);
  controller.abort();
  complete({ url: 'https://example.org/', html: 'late' });
  await assert.rejects(pending, /abort/i);
  assert.equal(closes, 1);
});
test('ordinary web clearly reports unavailable reader and never opens a fake iframe', async () => {
  const api = await fixture();
  assert.equal(api.hasSourceBrowser(), false);
  await assert.rejects(api.readInSourceBrowser('https://example.org/'), /Android/);
});
