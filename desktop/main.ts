import { app, BrowserWindow, WebContentsView, ipcMain, session, dialog } from 'electron';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createWebImportRouter } from '../server/webImport';
import { createGoogleAuthRouter } from '../server/googleAuth';

// 43821 belongs to the 1.1 desktop release. Keeping 1.2 on its own port lets
// an installed 1.2 build and an older 1.1 portable build run side by side.
const DESKTOP_PORT = 43822;

async function listenOnLoopback(web: express.Express) {
  const listen = (port: number) => new Promise<ReturnType<express.Express['listen']>>((resolve, reject) => {
    const server = web.listen(port, '127.0.0.1');
    const onError = (error: NodeJS.ErrnoException) => { server.removeListener('listening', onListening); reject(error); };
    const onListening = () => { server.removeListener('error', onError); resolve(server); };
    server.once('error', onError);
    server.once('listening', onListening);
  });
  try {
    // Keep this release's origin stable so its IndexedDB data survives restarts.
    return await listen(DESKTOP_PORT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    // Installed and portable builds use different single-instance locks, so they can
    // legitimately reach this point together. An ephemeral loopback port isolates them.
    return listen(0);
  }
}

let main: BrowserWindow;
let reader: BrowserWindow | null = null;
let cancelReader: (() => void) | null = null;
let cancelFetch: (() => void) | null = null;
let exportDirectory: string | null = null;
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (main) { main.restore(); main.focus(); } });
function validUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('URL trang không hợp lệ.');
  return url.href;
}
app.whenReady().then(async () => {
  const root = path.resolve(__dirname, '..');
  const web = express();
  web.disable('x-powered-by');
  web.use('/api/web-import', createWebImportRouter());
  web.use('/api/auth', createGoogleAuthRouter({ clientId: process.env.GOOGLE_CLIENT_ID, production: false }));
  web.use(express.static(path.join(root, 'dist')));
  web.get('*', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
  // Prefer a fixed loopback origin to keep IndexedDB data across app restarts.
  const server = await listenOnLoopback(web);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Không mở được Hermes.');
  const origin = `http://127.0.0.1:${address.port}`;
  const sourceSession = session.fromPartition('persist:hermes-source-reader');
  sourceSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  sourceSession.setPermissionCheckHandler(() => false);
  sourceSession.on('will-download', event => event.preventDefault());
  main = new BrowserWindow({ width: 1200, height: 820, minWidth: 360, autoHideMenuBar: true,
    webPreferences: { preload: path.join(root, 'desktop/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  main.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  main.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  const authorized = (event: Electron.IpcMainInvokeEvent) => event.sender === main.webContents && event.senderFrame?.url.startsWith(origin + '/');
  ipcMain.handle('file-export:choose-directory', async event => {
    if (!authorized(event)) throw new Error('Không được phép.');
    const result = await dialog.showOpenDialog(main, { title: 'Chọn thư mục lưu bản dịch', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    exportDirectory = path.resolve(result.filePaths[0]);
    return { name: path.basename(exportDirectory) || exportDirectory };
  });
  ipcMain.handle('file-export:write-file', async (event, filename: string, bytes: ArrayBuffer | Uint8Array) => {
    if (!authorized(event) || !exportDirectory) throw new Error('Chưa chọn thư mục lưu.');
    if (typeof filename !== 'string' || !filename || path.basename(filename) !== filename || /[\\/:*?"<>|\u0000-\u001f]/.test(filename)) throw new Error('Tên file không hợp lệ.');
    const target = path.join(exportDirectory, filename);
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    await fs.writeFile(target, data);
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size !== data.byteLength) throw new Error(`Không xác minh được file ${filename}.`);
    return { size: stat.size };
  });
  ipcMain.handle('file-export:finish', event => {
    if (!authorized(event)) throw new Error('Không được phép.');
    exportDirectory = null;
  });
  ipcMain.handle('source-browser:close', event => { if (authorized(event)) { cancelReader?.(); cancelFetch?.(); } });
  ipcMain.handle('source-browser:fetch', async (event, input: string) => {
    if (!authorized(event)) throw new Error('Không được phép.');
    const url = validUrl(input);
    const controller = new AbortController();
    cancelFetch?.();
    const cancel = () => controller.abort();
    cancelFetch = cancel;
    try {
      const response = await sourceSession.fetch(url, { credentials: 'include', redirect: 'follow', signal: controller.signal });
      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (declaredSize > 8_000_000) throw new Error('Trang quá lớn.');
      const html = await response.text();
      if (html.length > 8_000_000) throw new Error('Trang quá lớn.');
      if (!response.ok && !/just a moment|attention required|访问验证|安全验证|人机验证|cf-challenge/i.test(html)) throw new Error(`Trang trả về lỗi HTTP ${response.status}.`);
      return { url: validUrl(response.url || url), html };
    } finally {
      if (cancelFetch === cancel) cancelFetch = null;
    }
  });
  ipcMain.handle('source-browser:open', async (event, input: string) => {
    if (!authorized(event)) throw new Error('Không được phép.');
    const url = validUrl(input);
    if (reader) throw new Error('Trình duyệt đang mở.');
    return new Promise((resolve, reject) => {
      const window = new BrowserWindow({ parent: main, modal: true, width: 1050, height: 780, minWidth: 360, autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: path.join(root, 'desktop/reader-preload.cjs') } });
      reader = window;
      const view = new WebContentsView({ webPreferences: { partition: 'persist:hermes-source-reader', sandbox: true, contextIsolation: true, nodeIntegration: false } });
      window.contentView.addChildView(view);
      const fit = () => { const [width, height] = window.getContentSize(); view.setBounds({ x: 0, y: 92, width, height: Math.max(0, height - 92) }); };
      fit(); window.on('resize', fit);
      view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      view.webContents.on('will-navigate', (nav, target) => { try { validUrl(target); } catch { nav.preventDefault(); } });
      view.webContents.on('will-redirect', (nav, target) => { try { validUrl(target); } catch { nav.preventDefault(); } });
      const notify = (channel: string, text: string) => { if (!window.isDestroyed()) window.webContents.send(channel, text); };
      const announce = () => { if (!view.webContents.isDestroyed()) notify('reader:address', view.webContents.getURL()); };
      view.webContents.on('did-navigate', announce); view.webContents.on('did-navigate-in-page', announce);
      let settled = false;
      const channel = 'reader:action';
      const handler = async (actionEvent: Electron.IpcMainEvent, action: string) => {
        if (actionEvent.sender !== window.webContents) return;
        if (action === 'close') { window.close(); return; }
        if (action === 'back' && view.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack();
        if (action === 'reload') view.webContents.reload();
        if (action === 'capture' && !settled) {
          try {
            const currentUrl = validUrl(view.webContents.getURL());
            const html = await view.webContents.executeJavaScript('document.documentElement.outerHTML');
            if (window.isDestroyed()) return;
            if (typeof html !== 'string' || html.length > 8000000) throw new Error('Trang quá lớn.');
            settled = true; resolve({ url: currentUrl, html }); window.close();
          } catch { notify('reader:error', 'Không lấy được nội dung. Hãy chờ trang tải xong rồi thử lại.'); }
        }
      };
      ipcMain.on(channel, handler);
      cancelReader = () => window.close();
      window.on('closed', () => {
        ipcMain.removeListener(channel, handler);
        if (!view.webContents.isDestroyed()) view.webContents.close();
        reader = null; cancelReader = null;
        if (!settled) reject(new Error('Đã đóng trình duyệt, chưa lấy nội dung.'));
      });
      void window.loadFile(path.join(root, 'desktop/reader.html')).then(announce).catch(() => { if (!window.isDestroyed()) window.close(); });
      void view.webContents.loadURL(url).catch(() => { notify('reader:error', 'Không tải được trang. Bạn có thể bấm Tải lại.'); });
    });
  });
  main.on('closed', () => { exportDirectory = null; reader?.close(); server.close(); });
  await main.loadURL(origin);
  main.show();
  main.focus();
}).catch(error => { dialog.showErrorBox('Không mở được Hermes', String(error)); app.quit(); });
app.on('window-all-closed', () => app.quit());
