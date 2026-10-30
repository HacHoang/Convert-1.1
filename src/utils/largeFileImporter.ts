/** Parse UTF-8 incrementally. With onBatch, retain at most 5,000 entries. */
export interface ParsedDictEntry { chinese: string; vietnamese: string }
export async function parseDictionaryFileChunked(
  file: File,
  onProgress?: (processedCount: number, percent: number) => void,
  onBatch?: (entries: ParsedDictEntry[]) => Promise<unknown>,
): Promise<ParsedDictEntry[]> {
  const decoder = new TextDecoder('utf-8');
  const chunkSize = 1024 * 1024;
  const collected: ParsedDictEntry[] = [];
  let batch: ParsedDictEntry[] = [];
  let leftover = '';
  let count = 0;
  const flush = async () => {
    if (!batch.length) return;
    if (onBatch) await onBatch(batch);
    else collected.push(...batch);
    count += batch.length;
    batch = [];
  };
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, file.size);
    const text = leftover + decoder.decode(await file.slice(offset, end).arrayBuffer(), { stream: end < file.size });
    const lines = text.split('\n');
    leftover = end < file.size ? lines.pop()! : '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const chinese = line.slice(0, eq).trim();
      const vietnamese = line.slice(eq + 1).trim();
      if (chinese && vietnamese) batch.push({ chinese, vietnamese });
      if (batch.length >= 5000) await flush();
    }
    await flush();
    onProgress?.(count, Math.min(99, Math.round(end / file.size * 100)));
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  onProgress?.(count, 100);
  return collected;
}
