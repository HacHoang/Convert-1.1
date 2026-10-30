import {
  DICTIONARY_STORES, STORE_NAMES, STORE_LUAT_NHAN, STORE_IGNORED,
  readStore, readAppValue, writeAppValue, replaceStores,
} from './indexedDbStorage';

const BASE_URL = '/assets/default-dictionaries/';
type Progress = (message: string, percent: number) => void;
interface ManifestEntry { store: string; file: string; count: number; bytes: number; sha256: string }
interface Manifest { version: string; stores: ManifestEntry[] }
export interface DefaultDictionaryBundle { version: string; stores: Record<string, unknown[]> }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateDefaultManifest(value: unknown): Manifest {
  if (!isRecord(value) || typeof value.version !== 'string' || !value.version || !Array.isArray(value.stores) ||
    value.stores.length !== DICTIONARY_STORES.length) throw new Error('Danh mục từ điển mặc định không hợp lệ.');
  const seen = new Set<string>();
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
  onProgress?.('Đang lưu bộ từ điển mặc định…', 90);
  return { version: manifest.version, stores };
}

export async function restoreDefaultDictionaries(onProgress?: Progress): Promise<DefaultDictionaryBundle> {
  const bundle = await loadDefaultDictionaries(onProgress);
  await replaceStores(bundle.stores, { dictionariesInitialized: true, defaultDictionaryVersion: bundle.version });
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
