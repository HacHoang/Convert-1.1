import {
  DICTIONARY_STORES, STORE_NAMES, STORE_LUAT_NHAN, STORE_IGNORED,
  readStore, readAppValue, writeAppValue, replaceStores,
} from './indexedDbStorage';
import { validMeaningStyles, MEANING_STYLES_KEY, MEANING_STYLES_FALLBACK_KEY, type MeaningStyleData } from './meaningStyles';

const BASE_URL = '/assets/default-dictionaries/';
type Progress = (message: string, percent: number) => void;
interface ManifestEntry { store: string; file: string; count: number; bytes: number; sha256: string }
interface Manifest { version: string; stores: ManifestEntry[]; meaningStyles?: Omit<ManifestEntry, 'store'> }
export interface DefaultDictionaryBundle { version: string; stores: Record<string, unknown[]>; meaningStyles?: { version: 1; fallback: 'neutral'; entries: MeaningStyleData } }
export function defaultDictionaryValues(bundle: DefaultDictionaryBundle): Record<string, unknown> {
  return { dictionariesInitialized: true, defaultDictionaryVersion: bundle.version,
    ...(bundle.meaningStyles ? { [MEANING_STYLES_KEY]: bundle.meaningStyles.entries, [MEANING_STYLES_FALLBACK_KEY]: bundle.meaningStyles.fallback } : {}) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateDefaultManifest(value: unknown): Manifest {
  if (!isRecord(value) || typeof value.version !== 'string' || !value.version || !Array.isArray(value.stores) ||
    value.stores.length !== DICTIONARY_STORES.length) throw new Error('Danh mục từ điển mặc định không hợp lệ.');
  const seen = new Set<string>();
  if (value.meaningStyles !== undefined) {
    const entry = value.meaningStyles;
    if (!isRecord(entry) || entry.file !== 'meaning_styles.json.gz' || !Number.isSafeInteger(entry.count) || Number(entry.count) < 0 || !Number.isSafeInteger(entry.bytes) || Number(entry.bytes) < 1 || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Danh mục thẻ văn phong không hợp lệ.');
  }
  for (const entry of value.stores) {
    if (!isRecord(entry) || typeof entry.store !== 'string' || !DICTIONARY_STORES.includes(entry.store) ||
      seen.has(entry.store) || entry.file !== `${entry.store}.json.gz` ||
      !Number.isSafeInteger(entry.count) || Number(entry.count) < 0 ||
      !Number.isSafeInteger(entry.bytes) || Number(entry.bytes) < 1 ||
      typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Danh mục từ điển mặc định không hợp lệ.');
    seen.add(entry.store);
  }
  return value as unknown as Manifest;
}

function validateRows(entry: ManifestEntry, value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length !== entry.count) throw new Error(`Thiếu dữ liệu mặc định: ${entry.store}`);
  const keys = new Set<string>();
  for (const row of value) {
    if (!isRecord(row)) throw new Error(`Dữ liệu mặc định không hợp lệ: ${entry.store}`);
    const key = entry.store === STORE_NAMES ? row.id : entry.store === STORE_LUAT_NHAN ? row.pattern :
      entry.store === STORE_IGNORED ? row.phrase : row.chinese;
    if (typeof key !== 'string' || !key || keys.has(key) ||
      (entry.store !== STORE_IGNORED && typeof (entry.store === STORE_LUAT_NHAN ? row.translation : row.vietnamese) !== 'string') ||
      (entry.store === STORE_NAMES && (typeof row.chinese !== 'string' || typeof row.category !== 'string' ||
        typeof row.createdAt !== 'number' || !Number.isFinite(row.createdAt)))) throw new Error(`Dữ liệu mặc định không hợp lệ: ${entry.store}`);
    keys.add(key);
  }
  return value;
}

/** Download and validate everything before opening the replacement transaction. */
export async function loadDefaultDictionaries(onProgress?: Progress, fetcher: typeof fetch = fetch): Promise<DefaultDictionaryBundle> {
  onProgress?.('Đang mở bộ từ điển mặc định…', 0);
  const manifestResponse = await fetcher(`${BASE_URL}manifest.json`, { cache: 'no-cache' });
  if (!manifestResponse.ok) throw new Error('Không tải được danh mục từ điển mặc định. Hãy kiểm tra kết nối và thử lại.');
  const manifest = validateDefaultManifest(await manifestResponse.json());
  const totalBytes = manifest.stores.reduce((sum, entry) => sum + entry.bytes, 0);
  let loadedBytes = 0;
  const stores: Record<string, unknown[]> = {};
  for (const entry of manifest.stores) {
    onProgress?.('Đang tải bộ từ điển mặc định…', Math.round(loadedBytes / totalBytes * 85));
    const response = await fetcher(`${BASE_URL}${entry.file}`);
    if (!response.ok) throw new Error(`Không tải được từ điển mặc định: ${entry.store}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let decoded: Response;
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (bytes.length !== entry.bytes) throw new Error(`Tệp từ điển mặc định chưa tải đủ: ${entry.store}`);
      if (globalThis.crypto?.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== entry.sha256) throw new Error(`Tệp từ điển mặc định bị lỗi: ${entry.store}`);
      }
      decoded = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    } else {
      // Some static hosts add Content-Encoding and the browser already decompresses it.
      decoded = new Response(bytes);
    }
    stores[entry.store] = validateRows(entry, await decoded.json());
    loadedBytes += entry.bytes;
  }
  let meaningStyles: DefaultDictionaryBundle['meaningStyles'];
  if (manifest.meaningStyles) {
    const entry = manifest.meaningStyles;
    onProgress?.('Đang tải thẻ văn phong mặc định…', 86);
    const response = await fetcher(`${BASE_URL}${entry.file}`);
    if (!response.ok) throw new Error('Không tải được thẻ văn phong mặc định.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let decoded = new Response(bytes);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (bytes.length !== entry.bytes) throw new Error('Tệp thẻ văn phong chưa tải đủ.');
      if (globalThis.crypto?.subtle) {
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== entry.sha256) throw new Error('Tệp thẻ văn phong bị lỗi.');
      }
      decoded = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    }
    const value = await decoded.json();
    if (!isRecord(value) || value.version !== 1 || value.fallback !== 'neutral' || !validMeaningStyles(value.entries)
      || Object.values(value.entries).reduce((n, rows) => n + Object.keys(rows || {}).length, 0) !== entry.count) throw new Error('Dữ liệu thẻ văn phong không hợp lệ.');
    meaningStyles = value as unknown as DefaultDictionaryBundle['meaningStyles'];
  }
  onProgress?.('Đang lưu bộ từ điển mặc định…', 90);
  return { version: manifest.version, stores, ...(meaningStyles ? { meaningStyles } : {}) };
}

export async function restoreDefaultDictionaries(onProgress?: Progress): Promise<DefaultDictionaryBundle> {
  if (typeof Worker !== 'undefined') {
    const worker = new Worker(new URL('./defaultDictionaries.worker.ts', import.meta.url), { type: 'module' });
    let version: string;
    try {
      version = await new Promise<string>((resolve, reject) => {
        worker.onerror = event => reject(new Error(event.message || 'Không mở được bộ nạp mặc định.'));
        worker.onmessage = ({ data }) => {
          if (data.type === 'progress') onProgress?.(data.detail, data.percent);
          else if (data.type === 'done') resolve(data.version);
          else if (data.type === 'error') reject(new Error(data.message));
        };
        worker.postMessage({ type: 'start' });
      });
    } finally { worker.terminate(); }
    const stores: Record<string, unknown[]> = {};
    // Read sequentially to avoid several large structured clones at once on mobile.
    for (const store of DICTIONARY_STORES) stores[store] = await readStore(store);
    onProgress?.('Đã nạp bộ từ điển mặc định.', 100);
    return { version, stores };
  }
  const bundle = await loadDefaultDictionaries(onProgress);
  await replaceStores(bundle.stores, defaultDictionaryValues(bundle));
  onProgress?.('Đã nạp bộ từ điển mặc định.', 100);
  return bundle;
}

/** A missing marker alone must never overwrite an existing user's dictionaries. */
export async function initializeDefaultDictionaries(onProgress?: Progress): Promise<void> {
  if (await readAppValue<boolean>('dictionariesInitialized')) return;
  const counts = await Promise.all(DICTIONARY_STORES.map(async name => (await readStore(name)).length));
  if (counts.some(count => count > 0)) {
    await writeAppValue('dictionariesInitialized', true);
    return;
  }
  await restoreDefaultDictionaries(onProgress);
}
