const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hermesSourceBrowser', Object.freeze({
  open: url => ipcRenderer.invoke('source-browser:open', url),
  fetch: url => ipcRenderer.invoke('source-browser:fetch', url),
  close: () => ipcRenderer.invoke('source-browser:close'),
}));
contextBridge.exposeInMainWorld('hermesFileSystem', Object.freeze({
  chooseDirectory: () => ipcRenderer.invoke('file-export:choose-directory'),
  writeFile: (name, bytes) => ipcRenderer.invoke('file-export:write-file', name, bytes),
  finish: () => ipcRenderer.invoke('file-export:finish'),
}));
