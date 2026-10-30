import { validReaderState, type ReaderState } from './readerState';
import { STYLE_LABELS } from './translationStyle';
import { LEGACY_BACKUP_APP } from './legacyCompatibility';
import type { SavedChapter, NovelBook, AppSettings, ReadingStats } from '../context/AppContext';
import type { NameItem } from '../data/defaultNames';
import { DICTIONARY_STORES, STORE_NAMES, STORE_NAMES_MAIN, STORE_VIETPHRASE, STORE_LUAT_NHAN,
  STORE_PRONOUNS, STORE_IGNORED, STORE_PHIEN_AM } from './indexedDbStorage';

export interface LibraryData { novelsList: NovelBook[]; savedChapters: SavedChapter[] }
export interface BackupData {
  app: 'Convert'; version: 3; exportedAt: string;
  namesList?: NameItem[]; namesMainMap?: Record<string, string>; vietphraseMap?: Record<string, string>;
  luatNhanMap?: Record<string, string>; pronounsMap?: Record<string, string>;
  ignoredPhrasesList?: string[]; phienAmMap?: Record<string, string>;
  novelsList?: NovelBook[]; savedChapters?: SavedChapter[];
  settings?: AppSettings; readingStats?: ReadingStats; readerState?: ReaderState;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (): never => { throw new Error('Tệp sao lưu không hợp lệ hoặc có phiên bản chưa được hỗ trợ.'); };
const strings = (v: unknown) => object(v) && Object.values(v).every(x => typeof x === 'string');
const rows = (v: unknown, fields: string[], numbers: string[] = []) => Array.isArray(v) && v.every(row =>
  object(row) && fields.every(key => typeof row[key] === 'string') && numbers.every(key => typeof row[key] === 'number' && Number.isFinite(row[key])));

export function parseBackup(text: string): BackupData {
  const raw: unknown = JSON.parse(text);
  if (!object(raw)) return fail();
  let data = raw;
  if (raw.app === 'Convert' || raw.app === LEGACY_BACKUP_APP) {
    if (raw.version !== 3 && raw.version !== '2.6-offline') return fail();
  } else if (typeof raw.version === 'number' && raw.version >= 1 && raw.version <= 2 && 'namesCustom' in raw) {
    data = { namesList: raw.namesCustom, namesMainMap: raw.namesMain, vietphraseMap: raw.vietphrase,
      luatNhanMap: raw.luatNhan, pronounsMap: raw.pronouns, ignoredPhrasesList: raw.ignoredPhrases };
  } else return fail();
  if (data.readerState !== undefined && !validReaderState(data.readerState)) return fail();
  const maps = ['namesMainMap', 'vietphraseMap', 'luatNhanMap', 'pronounsMap', 'phienAmMap'];
  for (const key of maps) if (data[key] !== undefined && !strings(data[key])) return fail();
  if (data.namesList !== undefined && (!rows(data.namesList, ['id', 'chinese', 'vietnamese', 'category'], ['createdAt']) ||
    !(data.namesList as NameItem[]).every(row => ['Nhân vật', 'Địa danh', 'Tông môn', 'Binh khí', 'Công pháp', 'Khác'].includes(row.category)))) return fail();
  if (data.ignoredPhrasesList !== undefined && (!Array.isArray(data.ignoredPhrasesList) || !data.ignoredPhrasesList.every(v => typeof v === 'string'))) return fail();
  if (data.savedChapters !== undefined && !rows(data.savedChapters, ['id', 'title', 'originalText', 'vietphraseText'], ['savedAt'])) return fail();
  if (data.novelsList !== undefined && !rows(data.novelsList, ['id', 'title'], ['createdAt', 'updatedAt'])) return fail();
  for (const [key, fields] of [
    ['namesList', ['note']],
    ['savedChapters', ['novelId', 'chapterPrefix', 'chapterName', 'filePath', 'novelTitle', 'hanvietText', 'sourceUrl']],
    ['novelsList', ['originalTitle', 'author', 'coverUrl', 'description', 'genre', 'filePath', 'translationStyle']],
  ] as const) {
    const values = data[key] as Record<string, unknown>[] | undefined;
    if (values && values.some(row => fields.some(field => row[field] !== undefined && typeof row[field] !== 'string'))) return fail();
  }
  if ((data.novelsList as Record<string, unknown>[] | undefined)?.some(row =>
    (row.genres !== undefined && (!Array.isArray(row.genres) || !row.genres.every(value => typeof value === 'string'))) ||
    (row.isFavorite !== undefined && typeof row.isFavorite !== 'boolean'))) return fail();
  for (const key of ['namesList', 'novelsList', 'savedChapters']) {
    const values = data[key] as { id: string }[] | undefined;
    if (values && (values.some(v => !v.id.trim()) || new Set(values.map(v => v.id)).size !== values.length)) return fail();
  }
  if (data.settings !== undefined) {
    const s = data.settings;
    if (!object(s) || !['light', 'dark', 'sepia', 'system'].includes(String(s.theme)) ||
      !['sans', 'serif'].includes(String(s.fontFamily)) || !['responsive', 'mobile_frame'].includes(String(s.displayMode)) ||
      typeof s.prioritizeNames !== 'boolean' || typeof s.capitalizeSentences !== 'boolean' ||
      typeof s.fontSize !== 'number' || s.fontSize < 8 || s.fontSize > 100 ||
      typeof s.lineHeight !== 'number' || s.lineHeight < 0.5 || s.lineHeight > 5 ||
      typeof s.ttsRate !== 'number' || s.ttsRate < 0.5 || s.ttsRate > 2 ||
      (s.translationStyle !== undefined && (s.translationStyle === 'auto' || !Object.hasOwn(STYLE_LABELS, String(s.translationStyle)))) ||
      (s.customTextColor !== undefined && typeof s.customTextColor !== 'string')) return fail();
  }
  if (data.readingStats !== undefined && (!object(data.readingStats) ||
    !['totalReadBooks', 'totalReadMinutes'].every(k => typeof (data.readingStats as Record<string, unknown>)[k] === 'number' &&
      Number.isFinite((data.readingStats as Record<string, number>)[k]) && (data.readingStats as Record<string, number>)[k] >= 0))) return fail();
  if (![...maps, 'namesList', 'ignoredPhrasesList', 'novelsList', 'savedChapters', 'settings', 'readingStats'].some(key => data[key] !== undefined)) return fail();
  if (raw.version === 3 && (raw.app === 'Convert' || raw.app === LEGACY_BACKUP_APP) &&
    ![...maps, 'namesList', 'ignoredPhrasesList', 'novelsList', 'savedChapters', 'settings', 'readingStats'].every(key => data[key] !== undefined)) return fail();
  return { ...data, app: 'Convert', version: 3, exportedAt: String(raw.exportedAt || '') } as BackupData;
}

export function backupStores(data: BackupData): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {};
  if (data.namesList !== undefined) result[STORE_NAMES] = data.namesList;
  for (const [key, store] of [['namesMainMap', STORE_NAMES_MAIN], ['vietphraseMap', STORE_VIETPHRASE],
    ['pronounsMap', STORE_PRONOUNS], ['phienAmMap', STORE_PHIEN_AM]] as const) {
    const map = data[key];
    if (map !== undefined) result[store] = Object.entries(map).map(([chinese, vietnamese]) => ({ chinese, vietnamese }));
  }
  if (data.luatNhanMap !== undefined) result[STORE_LUAT_NHAN] = Object.entries(data.luatNhanMap).map(([pattern, translation]) => ({ pattern, translation }));
  if (data.ignoredPhrasesList !== undefined) result[STORE_IGNORED] = data.ignoredPhrasesList.map(phrase => ({ phrase }));
  if (Object.keys(result).some(key => !DICTIONARY_STORES.includes(key))) throw new Error('Unknown store');
  return result;
}
