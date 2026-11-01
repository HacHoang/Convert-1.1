import { parseDictionaryFileChunked } from './largeFileImporter';
import { readStore, replaceStores, STORE_NAMES, STORE_NAMES_MAIN, STORE_VIETPHRASE, STORE_PHIEN_AM, STORE_LUAT_NHAN, STORE_PRONOUNS, STORE_IGNORED } from './indexedDbStorage';

self.onmessage = async ({ data }) => {
  const stores: Record<string, string> = { names: STORE_NAMES, names_main: STORE_NAMES_MAIN, vietphrase: STORE_VIETPHRASE, phienam: STORE_PHIEN_AM, luatnhan: STORE_LUAT_NHAN, pronouns: STORE_PRONOUNS, ignored: STORE_IGNORED };
  try {
    const store = stores[data.kind];
    if (!store) throw new Error('Loại từ điển không hợp lệ.');
    self.postMessage({ type: 'progress', count: 0, percent: 1, phase: 'prepare' });
    const entries = new Map<string, Record<string, any>>();
    if (data.kind !== 'ignored') {
      for (const row of await readStore<Record<string, any>>(store)) entries.set(row.chinese ?? row.pattern, row);
    }
    let count = 0;
    await parseDictionaryFileChunked(data.file,
      (processed, percent) => { count = processed; self.postMessage({ type: 'progress', count, percent: 2 + Math.floor(percent * 0.88), phase: 'parse' }); },
      async batch => {
        for (const { chinese, vietnamese } of batch) {
          if (data.kind === 'names') {
            const old = entries.get(chinese);
            entries.set(chinese, { id: old?.id || `name-import-${crypto.randomUUID()}`, chinese, vietnamese, category: old?.category || 'Nhân vật', createdAt: old?.createdAt || Date.now(), note: old?.note || 'Nhập TXT' });
          } else if (data.kind === 'ignored') entries.set(chinese, { phrase: chinese });
          else if (data.kind === 'luatnhan') entries.set(chinese, { pattern: chinese, translation: vietnamese });
          else entries.set(chinese, { chinese, vietnamese });
        }
      }, data.kind === 'ignored' ? 'ignored' : 'dictionary');
    if (!count && data.kind !== 'ignored') throw new Error('Không tìm thấy dòng Từ=nghĩa hợp lệ trong tệp.');
    self.postMessage({ type: 'progress', count, percent: 92, phase: 'save' });
    // One atomic snapshot replaces millions of separate IndexedDB put requests.
    // Validation/decoding must finish before changing durable data.
    await replaceStores({ [store]: [...entries.values()] });
    self.postMessage({ type: 'done', count: data.kind === 'ignored' ? entries.size : count });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
