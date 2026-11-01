import { app, BrowserWindow, WebContentsView, ipcMain, session, dialog } from 'electron';
import express from 'express';
import path from 'node:path';
import { createWebImportRouter } from '../server/webImport';
import { createGoogleAuthRouter } from '../server/googleAuth';

let main: BrowserWindow;
let reader: BrowserWindow | null = null;
let cancelReader: (() => void) | null = null;
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
  // Fixed loopback origin keeps IndexedDB drafts/dictionaries across app restarts.
  const server = web.listen(43821, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
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
  ipcMain.handle('source-browser:close', event => { if (authorized(event)) cancelReader?.(); });
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
  main.on('closed', () => { reader?.close(); server.close(); });
  await main.loadURL(origin);
  main.show();
  main.focus();
}).catch(error => { dialog.showErrorBox('Không mở được Hermes', String(error)); app.quit(); });
app.on('window-all-closed', () => app.quit());
