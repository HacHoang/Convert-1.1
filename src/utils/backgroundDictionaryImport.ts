import { parseDictionaryFileChunked, type ParsedDictEntry } from './largeFileImporter';

/** Worker parses bounded batches; acknowledge only after each IndexedDB transaction commits. */
export async function importDictionaryInBackground(file: File, onProgress: ((count: number, percent: number) => void) | undefined, onBatch: (entries: ParsedDictEntry[]) => Promise<unknown>, mode: 'dictionary' | 'ignored' = 'dictionary') {
  if (typeof Worker === 'undefined') { await parseDictionaryFileChunked(file, onProgress, onBatch, mode); return; }
  const worker = new Worker(new URL('./dictionaryImport.worker.ts', import.meta.url), { type: 'module' });
  try {
    await new Promise<void>((resolve, reject) => {
      worker.onerror = event => reject(new Error(event.message || 'Không khởi chạy được bộ nạp nền.'));
      worker.onmessage = async ({ data }) => {
        try {
          if (data.type === 'batch') { await onBatch(data.entries); worker.postMessage({ type: 'ack' }); }
          else if (data.type === 'progress') onProgress?.(data.count, data.percent);
          else if (data.type === 'done') resolve();
          else if (data.type === 'error') reject(new Error(data.message));
        } catch (error) { reject(error); }
      };
      worker.postMessage({ type: 'start', file, mode });
    });
  } finally { worker.terminate(); }
}
