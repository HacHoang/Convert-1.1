import { readAppValue, writeAppValue } from './indexedDbStorage';

const STORAGE_KEY = 'apiKeySettings';
const LEGACY_GEMINI_STORAGE_KEY = 'geminiApiKeySettings';

export type ApiProviderId = 'openai' | 'claude' | 'gemini' | 'custom';

export interface ApiKeyEntry {
  id: string;
  name: string;
  key: string;
  providerId: ApiProviderId;
  customProviderName?: string;
  createdAt: number;
}

export interface ApiKeySettings {
  entries: ApiKeyEntry[];
  activeIds: Record<string, string>;
}

interface LegacyGeminiApiKeySettings {
  entries?: Array<{ id?: unknown; name?: unknown; key?: unknown; createdAt?: unknown }>;
  activeId?: unknown;
}

export const API_PROVIDERS: Record<Exclude<ApiProviderId, 'custom'>, string> = {
  openai: 'OpenAI / ChatGPT',
  claude: 'Anthropic / Claude',
  gemini: 'Google / Gemini',
};

const emptySettings = (): ApiKeySettings => ({ entries: [], activeIds: {} });

export function isApiProviderId(value: string): value is ApiProviderId {
  return ['openai', 'claude', 'gemini', 'custom'].includes(value);
}

export function providerStorageKey(entry: Pick<ApiKeyEntry, 'providerId' | 'customProviderName'>): string {
  if (entry.providerId !== 'custom') return entry.providerId;
  return `custom:${(entry.customProviderName || '').trim().toLowerCase()}`;
}

export function normalizeApiKeySettings(stored: unknown): ApiKeySettings {
  if (!stored || typeof stored !== 'object') return emptySettings();
  const value = stored as Partial<ApiKeySettings>;
  if (!Array.isArray(value.entries)) return emptySettings();
  const entries = value.entries.filter((entry): entry is ApiKeyEntry =>
    !!entry &&
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.key === 'string' &&
    isApiProviderId(entry.providerId) &&
    (entry.providerId !== 'custom' || typeof entry.customProviderName === 'string' && !!entry.customProviderName.trim()) &&
    Number.isFinite(entry.createdAt),
  );
  const activeIds: Record<string, string> = {};
  if (value.activeIds && typeof value.activeIds === 'object') {
    for (const [provider, id] of Object.entries(value.activeIds)) {
      if (typeof id === 'string' && entries.some(entry => entry.id === id && providerStorageKey(entry) === provider)) {
        activeIds[provider] = id;
      }
    }
  }
  return { entries, activeIds };
}

export function migrateLegacyGeminiApiKeys(legacy: LegacyGeminiApiKeySettings | undefined): ApiKeySettings {
  if (!legacy || !Array.isArray(legacy.entries)) return emptySettings();
  const entries = legacy.entries.filter((entry): entry is { id: string; name: string; key: string; createdAt: number } =>
    typeof entry?.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.key === 'string' &&
    Number.isFinite(entry.createdAt),
  ).map(entry => ({
    ...entry,
    providerId: 'gemini' as const,
  }));
  const activeId = typeof legacy.activeId === 'string' && entries.some(entry => entry.id === legacy.activeId)
    ? legacy.activeId
    : undefined;
  return { entries, activeIds: activeId ? { gemini: activeId } : {} };
}

async function readSettings(): Promise<ApiKeySettings> {
  const stored = await readAppValue<unknown>(STORAGE_KEY);
  if (stored !== undefined) return normalizeApiKeySettings(stored);

  const migrated = migrateLegacyGeminiApiKeys(await readAppValue<LegacyGeminiApiKeySettings>(LEGACY_GEMINI_STORAGE_KEY));
  if (migrated.entries.length) {
    await writeAppValue(STORAGE_KEY, migrated);
    await writeAppValue(LEGACY_GEMINI_STORAGE_KEY, { entries: [], activeId: null });
  }
  return migrated;
}

export async function listApiKeys(): Promise<ApiKeySettings> {
  return readSettings();
}

export async function addApiKey(
  name: string,
  key: string,
  providerId: ApiProviderId,
  customProviderName = '',
): Promise<ApiKeySettings> {
  const trimmedKey = key.trim();
  const trimmedName = name.trim();
  const trimmedProviderName = customProviderName.trim();
  if (!trimmedKey) throw new Error('Nhập API key trước khi lưu.');
  if (!trimmedName) throw new Error('Nhập tên để dễ phân biệt API key.');
  if (!isApiProviderId(providerId)) throw new Error('Chọn nhà cung cấp hợp lệ.');
  if (providerId === 'custom' && !trimmedProviderName) throw new Error('Nhập tên nhà cung cấp.');

  const entry: ApiKeyEntry = {
    id: crypto.randomUUID(),
    name: trimmedName,
    key: trimmedKey,
    providerId,
    ...(providerId === 'custom' ? { customProviderName: trimmedProviderName } : {}),
    createdAt: Date.now(),
  };
  const settings = await readSettings();
  const providerKey = providerStorageKey(entry);
  if (settings.entries.some(existing => providerStorageKey(existing) === providerKey && existing.key === trimmedKey)) {
    throw new Error('API key này đã có ở nhà cung cấp đã chọn.');
  }
  const next = {
    entries: [...settings.entries, entry],
    activeIds: settings.activeIds[providerKey]
      ? settings.activeIds
      : { ...settings.activeIds, [providerKey]: entry.id },
  };
  await writeAppValue(STORAGE_KEY, next);
  return next;
}

export async function renameApiKey(id: string, name: string): Promise<ApiKeySettings> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Tên API key không được để trống.');
  const settings = await readSettings();
  if (!settings.entries.some(entry => entry.id === id)) throw new Error('Không tìm thấy API key.');
  const next = { ...settings, entries: settings.entries.map(entry => entry.id === id ? { ...entry, name: trimmedName } : entry) };
  await writeAppValue(STORAGE_KEY, next);
  return next;
}

export async function setActiveApiKey(id: string): Promise<ApiKeySettings> {
  const settings = await readSettings();
  const entry = settings.entries.find(item => item.id === id);
  if (!entry) throw new Error('Không tìm thấy API key.');
  const providerKey = providerStorageKey(entry);
  const next = { ...settings, activeIds: { ...settings.activeIds, [providerKey]: id } };
  await writeAppValue(STORAGE_KEY, next);
  return next;
}

export async function deleteApiKey(id: string): Promise<ApiKeySettings> {
  const settings = await readSettings();
  const entry = settings.entries.find(item => item.id === id);
  if (!entry) throw new Error('Không tìm thấy API key.');
  const entries = settings.entries.filter(item => item.id !== id);
  const providerKey = providerStorageKey(entry);
  const activeIds = { ...settings.activeIds };
  if (activeIds[providerKey] === id) {
    const replacement = entries.find(item => providerStorageKey(item) === providerKey);
    if (replacement) activeIds[providerKey] = replacement.id;
    else delete activeIds[providerKey];
  }
  const next = { entries, activeIds };
  await writeAppValue(STORAGE_KEY, next);
  return next;
}

export async function getActiveGeminiApiKey(): Promise<string> {
  const settings = await readSettings();
  const id = settings.activeIds.gemini;
  const active = settings.entries.find(entry => entry.id === id && entry.providerId === 'gemini');
  if (!active) throw new Error('Chưa có API key Google / Gemini đang dùng. Mở mục API Keys để thêm khóa.');
  return active.key;
}

export function maskApiKey(key: string): string {
  return `...${key.slice(-5)}`;
}
