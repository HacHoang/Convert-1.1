const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const built = buildSync({ stdin: { contents: "export * from './src/utils/savedWebFile'; export { mergeWebChapters } from './src/utils/webImport';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { readSavedWebFile, mergeWebChapters, MAX_SAVED_WEB_BYTES } = loaded.exports;
const html = '<html><head><meta charset="utf-8"><title>Mục lục</title></head><body><a href="1.html">第1章 起点</a></body></html>';
const archive = (body, transfer) => `MIME-Version: 1.0\r\nContent-Type: multipart/related;\r\n boundary="fixture"\r\nSnapshot-Content-Location: https://example.org/book/\r\n\r\n--fixture\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: ${transfer}\r\nContent-Location: https://example.org/book/\r\n\r\n${body}\r\n--fixture--\r\n`;

test('saved HTML retains UTF-8 and UTF-16 text', async () => {
  for (const bytes of [Buffer.from(html), Buffer.concat([Buffer.from([255, 254]), Buffer.from(html, 'utf16le')])]) {
    assert.equal((await readSavedWebFile(new File([bytes], 'toc.html'))).html, html);
  }
});
test('MHTML extracts the HTML MIME part in base64 and quoted-printable', async () => {
  const bytes = Buffer.from(html);
  const qp = [...bytes].map(byte => '=' + byte.toString(16).padStart(2, '0')).join('').match(/.{1,60}/g).join('=\r\n');
  for (const [body, transfer] of [[bytes.toString('base64'), 'base64'], [qp, 'quoted-printable']]) {
    const parsed = await readSavedWebFile(new File([archive(body, transfer)], 'toc.mhtml'));
    assert.equal(parsed.html, html);
    assert.equal(parsed.sourceUrl, 'https://example.org/book/');
  }
});
test('invalid, empty, too large and corrupt saved web files fail explicitly', async () => {
  await assert.rejects(readSavedWebFile(new File([], 'empty.html')), /trống/);
  await assert.rejects(readSavedWebFile(new File(['plain text'], 'wrong.html')), /không chứa/);
  await assert.rejects(readSavedWebFile(new File([new Uint8Array([0xff, 0xff, 0xff])], 'bad.html')), /mã hóa/);
  await assert.rejects(readSavedWebFile(new File([new Uint8Array(MAX_SAVED_WEB_BYTES + 1)], 'large.html')), /16 MB/);
  await assert.rejects(readSavedWebFile(new File([archive('%%%broken%%%', 'base64')], 'bad.mhtml')), /base64/);
});
test('chapter merge deduplicates URLs, upgrades imported content and reports actual counts', () => {
  const existing = [{ id: 'keep-id', url: 'https://example.org/1', title: 'Chapter 1', selected: false, status: 'error', error: 'blocked' }];
  const incoming = [{ id: 'new-id', url: existing[0].url, title: 'Chapter 1', selected: true, status: 'ready', content: 'saved content' }];
  const result = mergeWebChapters(existing, [...incoming, ...incoming], true);
  assert.equal(result.chapters.length, 1); assert.equal(result.added, 0);
  assert.equal(result.updated, 1);
  assert.equal(result.chapters[0].id, 'keep-id'); assert.equal(result.chapters[0].status, 'ready');
  assert.equal(result.chapters[0].selected, false); assert.equal(result.chapters[0].error, undefined);
  assert.equal(existing[0].status, 'error');
  assert.equal(mergeWebChapters(existing, incoming, false).chapters[0].id, 'new-id');
});
