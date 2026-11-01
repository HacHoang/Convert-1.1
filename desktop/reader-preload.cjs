const { ipcRenderer } = require('electron');
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('button[data-action]').forEach(button => {
    button.addEventListener('click', () => ipcRenderer.send('reader:action', button.dataset.action));
  });
  ipcRenderer.on('reader:address', (_event, url) => { document.querySelector('#address').textContent = url; });
  ipcRenderer.on('reader:error', (_event, message) => { document.querySelector('#hint').textContent = message; });
});
