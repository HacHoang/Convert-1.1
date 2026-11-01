import { importDictionaryInBackground } from './backgroundDictionaryImport';
type Row = { chinese: string; vietnamese: string };
const pending = new Map<string, Promise<Row[]>>();
let latest: { file: string; rows: Row[] } | null = null;

/** A tab switch does not abort parsing; retain only the last reference to limit mobile memory. */
export function loadReferenceDictionary(file: string, onProgress?: (count: number, percent: number) => void): Promise<Row[]> {
  if (latest?.file === file) return Promise.resolve(latest.rows);
  const existing = pending.get(file);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch(`/assets/aistudio/${file}`);
    if (!response.ok) throw new Error('Không tải được tệp từ điển.');
    const blob = await response.blob();
    const entries = new Map<string, string>();
    await importDictionaryInBackground(new File([blob], file), onProgress, async batch => {
      for (const entry of batch) entries.set(entry.chinese, entry.vietnamese);
    });
    const rows = Array.from(entries, ([chinese, vietnamese]) => ({ chinese, vietnamese }));
    latest = { file, rows };
    return rows;
  })();
  pending.set(file, request);
  void request.then(() => pending.delete(file), () => pending.delete(file));
  return request;
}
