// Run after build:desktop: electron scripts/test-desktop.cjs
const { app, BrowserWindow } = require('electron');
const { createServer } = require('node:http');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-reader-test-')));
const timeout = setTimeout(() => { console.error('FAIL desktop reader timed out'); app.exit(1); }, 30000);
const waitFor = async predicate => { for (let n = 0; n < 200; n++) { const result = predicate(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 50)); } throw new Error('Window did not load'); };
let main;
app.on('browser-window-created', (_event, window) => {
  window.hide();
  if (!main) main = window;
});
require('../desktop-build/main.cjs');
app.whenReady().then(async () => {
  const fixture = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.url === '/first') res.setHeader('Set-Cookie', 'reader_session=verified; Path=/; HttpOnly');
    res.end(`<html><head><title>Reader fixture</title></head><body><article>${req.headers.cookie || 'first page'}</article></body></html>`);
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => fixture.once('listening', resolve));
  try {
    await waitFor(() => main && !main.webContents.isLoading() && main.webContents.getURL().startsWith('http'));
    assert.equal(await main.webContents.executeJavaScript('typeof window.hermesSourceBrowser?.open'), 'function');
    assert.equal(await main.webContents.executeJavaScript('typeof window.hermesFileSystem?.chooseDirectory'), 'function');
    assert.equal(await main.webContents.executeJavaScript('typeof window.hermesFileSystem?.writeFile'), 'function');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const capture = async route => {
      const pending = main.webContents.executeJavaScript(`window.hermesSourceBrowser.open(${JSON.stringify(origin + route)})`);
      const reader = await waitFor(() => BrowserWindow.getAllWindows().find(window => window !== main));
      await waitFor(() => reader.contentView.children[0]?.webContents.getURL().includes(route) && !reader.contentView.children[0].webContents.isLoading());
      const source = reader.contentView.children[0].webContents;
      assert.equal(await source.executeJavaScript('typeof window.hermesSourceBrowser'), 'undefined');
      assert.equal(await source.executeJavaScript('typeof require'), 'undefined');
      await waitFor(() => !reader.webContents.isLoading());
      await reader.webContents.executeJavaScript('document.querySelector("[data-action=capture]").click()');
      return pending;
    };
    assert.match((await capture('/first')).html, /first page/);
    const windowsBeforeFetch = BrowserWindow.getAllWindows().length;
    const fetched = await main.webContents.executeJavaScript(`window.hermesSourceBrowser.fetch(${JSON.stringify(origin + '/second')})`);
    assert.match(fetched.html, /reader_session=verified/);
    assert.equal(BrowserWindow.getAllWindows().length, windowsBeforeFetch);
    assert.match((await capture('/second')).html, /reader_session=verified/);
    const pending = main.webContents.executeJavaScript(`window.hermesSourceBrowser.open(${JSON.stringify(origin + '/close')}).then(()=>false,()=>true)`);
    const reader = await waitFor(() => BrowserWindow.getAllWindows().find(window => window !== main));
    reader.close();
    assert.equal(await pending, true);
    console.log('PASS desktop capture, silent session fetch, cookie retention, remote-page isolation and close cancellation');
    clearTimeout(timeout); fixture.close(); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(timeout); fixture.close(); app.exit(1); }
});
