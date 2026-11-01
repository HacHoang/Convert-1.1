import { readAppValue, writeAppValue } from './indexedDbStorage';
import { STYLE_LABELS, type TranslationStyle } from './translationStyle';

export type MeaningKind = 'vietphrase' | 'names_main' | 'names';
export type MeaningStyle = { meaning: string; styles: TranslationStyle[]; automatic?: boolean };
export type MeaningStyleData = Partial<Record<MeaningKind, Record<string, MeaningStyle[]>>>;
export const MEANING_STYLES_KEY = 'dictionaryMeaningStyles:v1';
export const MEANING_STYLES_FALLBACK_KEY = 'dictionaryMeaningStylesFallback:v1';
export const MEANING_STYLE_OPTIONS = Object.entries(STYLE_LABELS).filter(([id]) => id !== 'auto') as [TranslationStyle, string][];
let data: MeaningStyleData = {};
let revision = 0;
let fallback: 'neutral' | null = null;
export function meaningStyleFallback() { return fallback; }

export function validMeaningStyles(value: unknown): value is MeaningStyleData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([kind, entries]) => ['vietphrase', 'names_main', 'names'].includes(kind)
    && entries && typeof entries === 'object' && !Array.isArray(entries)
    && Object.entries(entries).every(([key, rows]) => key.trim() && Array.isArray(rows)
      && new Set(rows.map(row => row?.meaning)).size === rows.length
      && rows.every(row => row && typeof row.meaning === 'string' && Array.isArray(row.styles)
        && (row.automatic === undefined || typeof row.automatic === 'boolean')
        && new Set(row.styles).size === row.styles.length
        && row.styles.every((style: unknown) => typeof style === 'string' && style !== 'auto' && Object.hasOwn(STYLE_LABELS, style)))));
}

export function meaningStyleSnapshot(): MeaningStyleData { return data; }
export function meaningStyleRevision() { return revision; }
export function applyMeaningStyles(value: MeaningStyleData, defaultStyle: 'neutral' | null = null) {
  if (!validMeaningStyles(value)) throw new Error('Thuộc tính văn phong không hợp lệ.');
  data = value; fallback = defaultStyle; revision++;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('translation-style-changed'));
}
export async function loadMeaningStyles() {
  const stored = await readAppValue<unknown>(MEANING_STYLES_KEY);
  const defaultStyle = await readAppValue<unknown>(MEANING_STYLES_FALLBACK_KEY);
  applyMeaningStyles(stored === undefined ? {} : validMeaningStyles(stored) ? stored : {}, defaultStyle === 'neutral' ? 'neutral' : null);
}
export async function saveMeaningStyles(kind: MeaningKind, key: string, rows: MeaningStyle[]) {
  const next = { ...data, [kind]: { ...data[kind], [key]: rows.map(row => ({ meaning: row.meaning, styles: [...row.styles] })) } };
  if (!validMeaningStyles(next)) throw new Error('Thuộc tính văn phong không hợp lệ.');
  await writeAppValue(MEANING_STYLES_KEY, next);
  applyMeaningStyles(next, fallback);
}
export function assignedMeanings(kind: MeaningKind, key: string): MeaningStyle[] | undefined {
  const entries = data[kind];
  return entries && Object.hasOwn(entries, key) ? entries[key] : undefined;
}
export function preferredMeaning(kind: MeaningKind, key: string, style: TranslationStyle): string | undefined {
  // Neutral inferred tags describe uncertainty; they must not change the original default meaning.
  return assignedMeanings(kind, key)?.find(row => row.styles.includes(style) && (style !== 'neutral' || !row.automatic))?.meaning;
}
