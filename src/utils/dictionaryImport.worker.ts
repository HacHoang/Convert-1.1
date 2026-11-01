import { parseDictionaryFileChunked } from './largeFileImporter';
let resume: (() => void) | undefined;
self.onmessage = async ({ data }) => {
  if (data.type === 'ack') { resume?.(); resume = undefined; return; }
  if (data.type !== 'start') return;
  try {
    await parseDictionaryFileChunked(data.file,
      (count, percent) => self.postMessage({ type: 'progress', count, percent }),
      entries => new Promise<void>(resolve => { resume = resolve; self.postMessage({ type: 'batch', entries }); }), data.mode);
    self.postMessage({ type: 'done' });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
