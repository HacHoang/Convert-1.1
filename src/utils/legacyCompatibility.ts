/** Read older installations without retaining their branding in current output. */
export const LEGACY_BACKUP_APP = 'TTV Translate';
const LEGACY_STORAGE_PREFIX = 'ttv_';

export function readConvertPreference(key: string): string | null {
  const current = localStorage.getItem(key);
  if (current !== null) return current;
  const previous = localStorage.getItem(key.replace(/^convert_/, LEGACY_STORAGE_PREFIX));
  if (previous !== null) {
    // A migration write must not hide readable legacy data if storage is full.
    try { localStorage.setItem(key, previous); } catch { /* Keep using the old value. */ }
  }
  return previous;
}

export function removeLegacyAccount(): void {
  localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}google_account`);
}
