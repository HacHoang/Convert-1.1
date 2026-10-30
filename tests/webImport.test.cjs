const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');

function load(file, overrides = {}) {
  const built = buildSync({ entryPoints: [path.join(__dirname, file)], platform: 'node', format: 'cjs', bundle: true, packages: 'external', write: false });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', built.outputFiles[0].text)(name => overrides[name] || require(name), module, module.exports);
  return module.exports;
}
const { isPublicAddress, validateWebUrl } = load('../server/webImport.ts');

test('web import accepts public URLs and rejects local networks and disguised local IPs', () => {
  for (const url of ['http://localhost/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://10.0.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'file:///etc/passwd', 'https://user:password@example.com/', 'https://example.com:8443/']) assert.throws(() => validateWebUrl(url), url);
  for (const address of ['0.0.0.0', '127.0.0.1', '169.254.169.254', '172.20.1.2', '192.168.1.2', '100.100.100.100', '::1', 'fd00::1', 'fe80::1', '::ffff:8.8.8.8', '2001:db8::1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(validateWebUrl('https://example.com/book/').href, 'https://example.com/book/');
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('redirects cannot reach private addresses and DNS results are pinned for the request', async () => {
  let calls = 0;
  const fakeHttp = { get(url, options, callback) {
    calls++;
    options.lookup(url.hostname, { all: true }, (error, addresses) => assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]));
    const request = new EventEmitter(); request.setTimeout = () => {}; request.destroy = () => {};
    queueMicrotask(() => {
      const response = new EventEmitter(); response.statusCode = 302; response.headers = { location: 'http://127.0.0.1/private' };
      callback(response); response.emit('end');
    });
    return request;
  } };
  const { fetchWebResource } = load('../server/webImport.ts', { 'node:dns/promises': { lookup: async () => [{ address: '93.184.216.34', family: 4 }] }, 'node:https': fakeHttp });
  await assert.rejects(fetchWebResource('https://example.com/', new AbortController().signal), /nội bộ/);
  assert.equal(calls, 1);
});

test('DNS resolution to private addresses is rejected before opening a connection', async () => {
  const { fetchWebResource } = load('../server/webImport.ts', { 'node:dns/promises': { lookup: async () => [{ address: '127.0.0.1', family: 4 }] } });
  await assert.rejects(fetchWebResource('https://example.com/', new AbortController().signal), /không được hỗ trợ/);
});

test('Cloudflare verification is identified separately from ordinary HTTP errors', async () => {
  for (const fixture of [
    { status: 403, body: '<title>Just a moment...</title>', headers: {}, code: 'SOURCE_VERIFICATION_REQUIRED' },
    { status: 200, body: 'verify', headers: { 'cf-mitigated': 'challenge' }, code: 'SOURCE_VERIFICATION_REQUIRED' },
    { status: 403, body: 'Forbidden', headers: {}, code: 'SOURCE_HTTP_ERROR' },
  ]) {
    const fakeHttp = { get(url, options, callback) {
      const request = new EventEmitter(); request.setTimeout = () => {};
      queueMicrotask(() => {
        const response = new EventEmitter(); response.statusCode = fixture.status; response.headers = { 'content-type': 'text/html', ...fixture.headers };
        callback(response); response.emit('data', Buffer.from(fixture.body)); response.emit('end');
      });
      return request;
    } };
    const { fetchWebResource } = load('../server/webImport.ts', { 'node:dns/promises': { lookup: async () => [{ address: '93.184.216.34', family: 4 }] }, 'node:https': fakeHttp });
    await assert.rejects(fetchWebResource('https://example.com/book/', new AbortController().signal), error => error.status === 403 && error.code === fixture.code && error.sourceUrl === 'https://example.com/book/');
  }
});

test('web EPUB keeps editorial order, language, escaped metadata and embedded cover', async () => {
  const { createNovelEpub } = load('../src/utils/epubExport.ts');
  const JSZip = require('jszip');
  const chapter = title => ({ id: title, title, originalText: 'Nội dung <an toàn> & đầy đủ.', vietphraseText: '', savedAt: 0 });
  const blob = await createNovelEpub({ title: 'A & B', author: '<Author>', description: 'Test' }, [chapter('Chapter 10'), chapter('Chapter 2')], { preserveOrder: true, language: 'en', font: 'sans-serif', fontSize: 20, lineHeight: 1.8, cover: 'data:image/png;base64,iVBORw0KGgo=' });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const opf = await zip.file('EPUB/book.opf').async('string');
  assert.match(opf, /<dc:language>en<\/dc:language>/);
  assert.match(opf, /A &amp; B/);
  assert.match(opf, /properties="cover-image"/);
  assert.ok(zip.file('EPUB/cover.png'));
  const first = await zip.file('EPUB/chapter-1.xhtml').async('string');
  assert.match(first, /Chapter 10/);
  assert.match(first, /font-family:sans-serif;font-size:20px;line-height:1.8/);
  assert.match(first, /&lt;an toàn&gt; &amp;/);
  assert.equal(await zip.file('mimetype').async('string'), 'application/epub+zip');
});
