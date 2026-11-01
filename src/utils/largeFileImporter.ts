import { textFileChunks } from './textFile';
export interface ParsedDictEntry { chinese: string; vietnamese: string }

/** Keep empty meanings, embedded equals signs and arbitrarily long keys intact. */
export function parseDictionaryLine(raw: string): ParsedDictEntry | null {
  const line = raw.replace(/^\uFEFF/, '').trim();
  if (!line || line.startsWith('#') || line.startsWith('//')) return null;
  const eq = line.indexOf('=');
  if (eq <= 0) return null;
  const chinese = line.slice(0, eq).trim();
  return chinese ? { chinese, vietnamese: line.slice(eq + 1).trim() } : null;
}

export async function parseDictionaryFileChunked(
  file: File,
  onProgress?: (processedCount: number, percent: number) => void,
  onBatch?: (entries: ParsedDictEntry[]) => Promise<unknown>,
  mode: 'dictionary' | 'ignored' = 'dictionary',
): Promise<ParsedDictEntry[]> {
  const collected: ParsedDictEntry[] = [];
  let batch: ParsedDictEntry[] = [], leftover = '', count = 0;
  const flush = async () => {
    if (!batch.length) return;
    if (onBatch) await onBatch(batch); else collected.push(...batch);
    count += batch.length; batch = [];
  };
  const consume = async (line: string) => {
    const phrase = mode === 'ignored' ? line.replace(/^\uFEFF/, '').trim() : '';
    const entry = mode === 'ignored' ? (phrase && !phrase.startsWith('#') && !phrase.startsWith('//') ? { chinese: phrase, vietnamese: '' } : null) : parseDictionaryLine(line);
    if (entry) batch.push(entry);
    if (batch.length >= 5000) await flush();
  };
  for await (const { text, percent } of textFileChunks(file)) {
    const combined = leftover + text;
    // Keep a trailing CR with the unfinished line so CRLF across chunks is intact.
    const tailCR = combined.endsWith('\r') ? '\r' : '';
    const lines = (tailCR ? combined.slice(0, -1) : combined).split(/\r\n|\n|\r/);
    leftover = lines.pop()! + tailCR;
    for (const line of lines) await consume(line);
    await flush();
    onProgress?.(count, percent);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  await consume(leftover);
  await flush();
  onProgress?.(count, 100);
  return collected;
}
