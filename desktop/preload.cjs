const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hermesSourceBrowser', Object.freeze({
  open: url => ipcRenderer.invoke('source-browser:open', url),
  close: () => ipcRenderer.invoke('source-browser:close'),
}));
