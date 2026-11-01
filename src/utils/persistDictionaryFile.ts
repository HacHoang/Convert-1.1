export function persistDictionaryFile(kind: string, file: File, onProgress?: (count: number, percent: number) => void): Promise<number> {
  const worker = new Worker(new URL('./dictionaryPersist.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<number>((resolve, reject) => {
    const fail = (error: Error) => { worker.terminate(); reject(error); };
    worker.onerror = event => fail(new Error(event.message || 'Không khởi chạy được bộ lưu từ điển.'));
    worker.onmessageerror = () => fail(new Error('Không nhận được dữ liệu từ bộ nạp từ điển.'));
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress?.(data.count, data.percent);
      else if (data.type === 'done') { worker.terminate(); resolve(data.count); }
      else if (data.type === 'error') fail(new Error(data.message));
    };
    try { worker.postMessage({ kind, file }); } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  });
}
