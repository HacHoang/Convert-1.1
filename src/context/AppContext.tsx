import { applyReadingDelta, emptyReadingStats, normalizeReadingStats, type ReadingDelta, type ReadingStats } from '../utils/readingStats';
import { updateReadingStats } from '../utils/readingStatsStore';
export type { ReadingStats } from '../utils/readingStats';
import { readReaderState, clearStagedReadingPositions } from '../utils/readerState';
import { mergeLibraryChapters, type ChapterSaveOptions } from '../utils/libraryChapterMerge';
import { initializeDefaultDictionaries, restoreDefaultDictionaries } from '../utils/defaultDictionaries';
import { readConvertPreference, removeLegacyAccount } from '../utils/legacyCompatibility';
import { parseBackup, backupStores, type BackupData, type LibraryData } from '../utils/appBackup';
import type { TranslationStyle } from '../utils/translationStyle';
import { importDictionaryInBackground } from '../utils/backgroundDictionaryImport';
import { persistDictionaryFile } from '../utils/persistDictionaryFile';
import { yieldToBrowser } from '../utils/yieldToBrowser';
import { loadMeaningStyles, meaningStyleSnapshot, meaningStyleFallback, applyMeaningStyles, MEANING_STYLES_KEY, MEANING_STYLES_FALLBACK_KEY } from '../utils/meaningStyles';
/**
 * Context quản lý toàn bộ dữ liệu offline của Hermes
 * 100% Offline, không yêu cầu đăng nhập.
 * Hỗ trợ IndexedDB cho toàn bộ các bảng từ điển QuickTranslator (~40MB+)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authRequest } from '../utils/googleAuth';
import { simplifyChinese } from '../utils/simplifyChinese';
import { NameItem, INITIAL_NAMES } from '../data/defaultNames';
import { 
  saveNameItem, 
  deleteNameItem, 
  deleteNameByChinese,
  saveNamesBatch, 
  clearNamesStore,
  saveVietphraseItem, 
  deleteVietphraseItem, 
  saveVietphraseBatch, 
  clearVietphraseStore,
  saveNamesMainBatch,
  savePhienAmBatch,
  clearNamesMainStore,
  saveLuatNhanBatch,
  clearLuatNhanStore,
  savePronounsBatch,
  clearPronounsStore,
  saveIgnoredPhrasesBatch,
  clearIgnoredPhrasesStore,
  readStore, readAppValue, writeAppValue, replaceStores, deleteIgnoredPhrases, deleteDictionaryKeys,
  STORE_NAMES, STORE_NAMES_MAIN, STORE_VIETPHRASE, STORE_LUAT_NHAN, STORE_PRONOUNS, STORE_IGNORED, STORE_PHIEN_AM, DICTIONARY_STORES,
  subscribeDictionaryChanges
} from '../utils/indexedDbStorage';
import { 
  DEFAULT_LUAT_NHAN, 
  DEFAULT_PRONOUNS, 
  DEFAULT_IGNORED_PHRASES, 
  CHINESE_PHIEN_AM_WORDS 
} from '../data/quickTranslatorData';

export interface SavedChapter {
  id: string;
  novelId?: string;
  title: string;
  chapterPrefix?: string;
  chapterName?: string;
  filePath?: string;
  novelTitle?: string;
  originalText: string;
  vietphraseText: string;
  hanvietText?: string;
  sourceUrl?: string;
  savedAt: number;
}

export interface NovelBook {
  translationStyle?: import('../utils/translationStyle').TranslationStyleChoice;
  id: string;
  title: string;
  originalTitle?: string;
  originalAuthor?: string;
  vietnameseTitle?: string;
  vietnameseAuthor?: string;
  author?: string;
  coverUrl?: string;
  description?: string;
  genre?: string;
  genres?: string[];
  filePath?: string;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  publicationStatus?: 'ongoing' | 'completed';
  rating?: 1 | 2 | 3 | 4 | 5;
  review?: string;
}

export const PRESET_COVERS = [
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1514533450685-4493e01d1fdc?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=400&auto=format&fit=crop&q=80',
];

export function parseChapterHeader(title: string): { prefix: string; name: string; full: string } {
  if (!title.trim()) return { prefix: '', name: '', full: '' };
  const trimmed = title.trim();
  
  const match = trimmed.match(/^(Chương\s*\d+|Hồi\s*\d+|Đệ\s*\d+\s*Chương|Tiết\s*\d+|Phần\s*\d+)(?:[\s:：\-–—\.]+)?(.*)$/i);
  if (match) {
    const prefix = match[1].trim();
    const name = match[2].trim();
    const full = name ? `${prefix}: ${name}` : prefix;
    return { prefix, name, full };
  }
  
  if (trimmed.toLowerCase().startsWith('chương')) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
      const prefix = `${parts[0]} ${parts[1]}`;
      const name = parts.slice(2).join(' ').replace(/^[:：\-–—\.]+\s*/, '').trim();
      const full = name ? `${prefix}: ${name}` : prefix;
      return { prefix, name, full };
    }
  }

  return { prefix: 'Chương', name: trimmed, full: trimmed };
}

export type AppTheme = 'light' | 'dark' | 'sepia' | 'system';
export type AppTab = 'translate' | 'batch' | 'web' | 'library' | 'dictionary' | 'settings';

export interface AppSettings {
  translationStyle?: TranslationStyle;
  theme: AppTheme;
  fontSize: number;
  lineHeight: number;
  fontFamily: 'reading';
  displayMode: 'responsive' | 'mobile_frame';
  prioritizeNames: boolean;
  quickTranslationAlgorithm: 0 | 1 | 2;
  quickVietphraseWrapType: 0 | 1 | 2 | 3;
  capitalizeSentences: boolean;
  ttsRate: number;
  customTextColor?: string;
}


export interface GoogleAccount {
  isLoggedIn: boolean;
  id?: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export type DictCategoryType = 
  | 'names' 
  | 'names_main' 
  | 'vietphrase' 
  | 'luatnhan' 
  | 'pronouns' 
  | 'phienam' 
  | 'ignored';

interface AppContextType {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  
  // Reading Stats
  readingStats: ReadingStats;
  resetReadingStats: () => Promise<boolean>;
  recordReadingActivity: (delta: ReadingDelta) => void;

  // Google Account
  googleAccount: GoogleAccount;
  loginWithGoogle: (credential: string, csrf: string) => Promise<void>;
  logoutGoogle: () => Promise<void>;
  
  // Names Phụ / Cá Nhân
  namesList: NameItem[];
  addName: (chinese: string, vietnamese: string, category?: NameItem['category'], note?: string) => boolean;
  addNameMain: (chinese: string, vietnamese: string) => boolean;
  deleteNameMain: (chinese: string) => void;
  updateName: (id: string, updates: Partial<NameItem>) => void;
  deleteName: (id: string) => void;
  exportNamesTxt: () => string;
  importNamesTxt: (content: string) => number;

  // Names Chính (Gốc 136k từ)
  namesMainMap: Record<string, string>;
  phienAmMap: Record<string, string>;
  dictionaryStyleRevision: number;
  
  // Vietphrase
  vietphraseMap: Record<string, string>;
  addVietphrase: (chinese: string, vietnamese: string) => void;
  deleteVietphrase: (chinese: string) => void;
  exportVietphraseTxt: () => string;
  importVietphraseTxt: (content: string) => number;
  resetDictionaries: () => Promise<void>;

  // Luật Nhân (LuatNhan)
  luatNhanMap: Record<string, string>;
  
  // Đại Từ (Pronouns)
  pronounsMap: Record<string, string>;
  
  // Cụm Bỏ Qua (IgnoredPhrases)
  ignoredPhrasesList: string[];
  addIgnoredPhrase: (chinese: string) => void;
  
  // Thao tác xóa cụm từ chung
  deletePhrase: (chinese: string) => void;
  updatePhrase: (oldChinese: string, newChinese: string, newViet: string, type: 'name' | 'vietphrase') => void;
  deleteMultiplePhrases: (phrases: string[], type: 'name' | 'vietphrase' | 'ignored') => void;
  importEntriesBatch: (type: 'names' | 'vietphrase', entries: Array<{ chinese: string; vietnamese: string }>) => Promise<number>;
  isImportingLargeFile: boolean;
  importProgress: { count: number; percent: number } | null;
  setImportProgress: React.Dispatch<React.SetStateAction<{ count: number; percent: number } | null>>;

  // IMPORT / EXPORT ĐƠN LẺ & HÀNG LOẠT
  exportSingleTxt: (dictType: DictCategoryType) => string;
  importSingleTxt: (dictType: DictCategoryType, content: string) => Promise<number>;
  importDictionaryFile: (dictType: DictCategoryType, file: File, onProgress?: (count: number, percent: number) => void) => Promise<number>;
  clearSpecificStore: (dictType: DictCategoryType) => Promise<void>;
  replaceIgnoredPhrases: (phrases: string[]) => Promise<void>;
  deleteDictionaryEntries: (dictType: DictCategoryType, keys: string[]) => Promise<void>;
  loadAllQuickTranslatorAssets: (onProgress?: (msg: string, percent: number) => void) => Promise<{ success: boolean; message: string }>;
  exportAllDatabasesJson: () => Promise<string>;
  importAllDatabasesJson: (jsonStr: string) => Promise<{ success: boolean; message: string }>;

  // Novels / Quản lý bộ truyện
  novelsList: NovelBook[];
  saveLibraryChapters: (book: string | Omit<NovelBook, 'id' | 'createdAt' | 'updatedAt'>, chapters: Omit<SavedChapter, 'id' | 'savedAt'>[], options?: ChapterSaveOptions) => Promise<{ novelId: string; count: number; overwritten: number; skipped: number }>;
  addNovel: (book: Omit<NovelBook, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateNovel: (id: string, updates: Partial<NovelBook>) => Promise<void>;
  deleteNovel: (id: string) => Promise<void>;
  toggleFavoriteNovel: (id: string) => Promise<void>;
  
  // Library / Chương đã lưu
  savedChapters: SavedChapter[];
  saveChapter: (chapter: Omit<SavedChapter, 'id' | 'savedAt'>, options?: ChapterSaveOptions) => Promise<string>;
  updateSavedChapter: (id: string, updates: Pick<SavedChapter, 'title' | 'originalText' | 'vietphraseText'>) => Promise<void>;
  deleteSavedChapter: (id: string) => Promise<void>;
  deleteSavedChapters: (ids: string[]) => Promise<number>;
  
  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => Promise<boolean>;
  
  // Quick Inspector Modal
  inspectModal: {
    isOpen: boolean;
    initialChinese: string;
    initialVietnamese: string;
    initialCategory: NameItem['category'];
    target?: 'name' | 'name_main' | 'vietphrase';
    style?: TranslationStyle;
  };
  openInspectModal: (chinese: string, vietnamese?: string, category?: NameItem['category'], target?: 'name' | 'name_main' | 'vietphrase', style?: TranslationStyle) => void;
  closeInspectModal: () => void;

  // Active translation buffer
  activeRawText: string;
  setActiveRawText: (text: string) => void;
  activeChapterTitle: string;
  setActiveChapterTitle: (title: string) => void;
  activeNovelTitle: string;
  setActiveNovelTitle: (title: string) => void;
  activeNovelId: string;
  setActiveNovelId: (id: string) => void;
}

const DEFAULT_NOVEL_ID = 'default-tian-hei-qing-dian-deng';
const LEGACY_SAMPLE_NOVEL_IDS = new Set(['novel-1', 'novel-2', 'novel-3']);
const DEFAULT_NOVELS: NovelBook[] = [{
  id: DEFAULT_NOVEL_ID,
  title: 'Thiên Hắc Thỉnh Điểm Đăng',
  originalTitle: '天黑请点灯',
  author: '罗樵森 (La Tiều Sâm)',
  genre: 'Huyền huyễn / Linh dị / Kinh dị',
  publicationStatus: 'ongoing',
  createdAt: 0,
  updatedAt: 0,
}];

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 16,
  lineHeight: 1.7,
  fontFamily: 'reading',
  displayMode: 'responsive',
  prioritizeNames: true,
  quickTranslationAlgorithm: 1,
  quickVietphraseWrapType: 0,
  capitalizeSentences: true,
  ttsRate: 1.0,
  customTextColor: '',
};

const normalizeSettings = (value?: Partial<AppSettings> | Record<string, unknown>): AppSettings => {
  const legacy = { ...(value || {}) } as Record<string, unknown>;
  delete legacy.desktopTranslationEngine;
  if (legacy.fontFamily === 'sans' || legacy.fontFamily === 'serif') legacy.fontFamily = 'reading';
  if (legacy.fontFamily !== undefined && legacy.fontFamily !== 'reading') delete legacy.fontFamily;
  return { ...DEFAULT_SETTINGS, ...legacy } as AppSettings;
};

const rowsToDictionaryMap = (rows: Array<{ chinese: string; vietnamese: string }>) =>
  Object.fromEntries(rows.map(row => [row.chinese, row.vietnamese]));

const rowsToVietphraseMap = (rows: Array<{ chinese: string; vietnamese: string }>) => {
  const result: Record<string, string> = Object.create(null);
  // Add normalized aliases first; exact simplified entries win in pass two.
  for (const row of rows) result[simplifyChinese(row.chinese)] = row.vietnamese;
  for (const row of rows) result[row.chinese] = row.vietnamese;
  return result;
};

/**
 * A saved chapter must belong to one concrete book ID. Older title-only rows
 * cannot safely be matched: a later book with the same title would inherit
 * them. Remove those rows, together with orphaned and duplicate IDs, whenever
 * the library is read or written.
 */
const normalizeLibraryData = (library: LibraryData): LibraryData => {
  // Versions before 1.2 seeded three showcase books into an empty library.
  // They are not user data and must never reappear after the library is cleared.
  const hadLegacySamples = library.novelsList.some(book => LEGACY_SAMPLE_NOVEL_IDS.has(book.id));
  let novelsList = library.novelsList.filter(book => !LEGACY_SAMPLE_NOVEL_IDS.has(book.id));
  if (hadLegacySamples && novelsList.length === 0) novelsList = DEFAULT_NOVELS;
  const novelIds = new Set(novelsList.map(book => book.id));
  const chapterIds = new Set<string>();
  const savedChapters = library.savedChapters.filter(chapter => {
    if (!chapter.novelId || !novelIds.has(chapter.novelId) || chapterIds.has(chapter.id)) return false;
    chapterIds.add(chapter.id);
    return true;
  });
  return novelsList.length === library.novelsList.length && savedChapters.length === library.savedChapters.length
    ? library
    : { novelsList, savedChapters };
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<AppTab>('translate');

  // Load Names cá nhân / phụ
  const [namesList, setNamesList] = useState<NameItem[]>(INITIAL_NAMES);

  // Load Names chính (136k từ)
  const [namesMainMap, setNamesMainMap] = useState<Record<string, string>>({});
  const [phienAmMap, setPhienAmMap] = useState<Record<string, string>>({});
  const [dictionaryStyleRevision, setDictionaryStyleRevision] = useState(0);
  useEffect(() => {
    const update = () => setDictionaryStyleRevision(value => value + 1);
    window.addEventListener('translation-style-changed', update);
    return () => window.removeEventListener('translation-style-changed', update);
  }, []);

  // Load Vietphrase
  const [vietphraseMap, setVietphraseMap] = useState<Record<string, string>>({});

  // Load Luật nhân
  const [luatNhanMap, setLuatNhanMap] = useState<Record<string, string>>(DEFAULT_LUAT_NHAN);

  // Load Đại từ
  const [pronounsMap, setPronounsMap] = useState<Record<string, string>>(DEFAULT_PRONOUNS);

  // Load Cụm từ bỏ qua
  const [ignoredPhrasesList, setIgnoredPhrasesList] = useState<string[]>(DEFAULT_IGNORED_PHRASES);

  // Loading progress state
  const [isImportingLargeFile, setIsImportingLargeFile] = useState(false);
  const [importProgress, setImportProgress] = useState<{ count: number; percent: number } | null>(null);

  // Load Novels
  const [novelsList, setNovelsList] = useState<NovelBook[]>(() => {
    try {
      const stored = readConvertPreference('convert_novel_books');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_NOVELS;
  });

  // Load Saved Chapters
  const [savedChapters, setSavedChapters] = useState<SavedChapter[]>(() => {
    try {
      const stored = readConvertPreference('convert_saved_chapters');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const ids = new Set<string>();
          return parsed.map((chapter: SavedChapter) => {
            const id = ids.has(chapter.id) ? `chap-${crypto.randomUUID()}` : chapter.id;
            ids.add(id);
            return id === chapter.id ? chapter : { ...chapter, id };
          });
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Load Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = readConvertPreference('convert_reader_settings');
      if (stored) {
        return normalizeSettings(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // Verified reading events only; legacy demo totals are retained separately.
  const [readingStats, setReadingStats] = useState<ReadingStats>(() => {
    try { return normalizeReadingStats(JSON.parse(readConvertPreference('convert_reading_stats') || 'null')); }
    catch { return emptyReadingStats(); }
  });

  // Google Account
  const authRevision = useRef(0);
  const [googleAccount, setGoogleAccount] = useState<GoogleAccount>(() => {
    return {
      isLoggedIn: false,
      email: '',
      name: '',
      avatarUrl: undefined,
    };
  });

  // Inspection modal state
  const [inspectModal, setInspectModal] = useState<{
    isOpen: boolean;
    initialChinese: string;
    initialVietnamese: string;
    initialCategory: NameItem['category'];
    target?: 'name' | 'name_main' | 'vietphrase';
    style?: TranslationStyle;
  }>({
    isOpen: false,
    initialChinese: '',
    initialVietnamese: '',
    initialCategory: 'Nhân vật',
  });

  // Active translation state
  const [activeRawText, setActiveRawText] = useState('');
  const [activeChapterTitle, setActiveChapterTitle] = useState('');
  const [activeNovelTitle, setActiveNovelTitle] = useState('Thiên Hắc Thỉnh Điểm Đăng');
  const [activeNovelId, setActiveNovelId] = useState(DEFAULT_NOVEL_ID);

  const [storageReady, setStorageReady] = useState(false);
  const [dictionaryLoadStatus, setDictionaryLoadStatus] = useState('');
  const [storageError, setStorageError] = useState('');
  const libraryRef = useRef<LibraryData>({ novelsList, savedChapters });
  const settingsRef = useRef(settings);
  const statsRef = useRef(readingStats);
  const storageQueue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <T,>(operation: () => Promise<T>): Promise<T> => {
    const pending = storageQueue.current.then(operation);
    storageQueue.current = pending.catch(() => {});
    return pending;
  };
  const reportStorageError = (error: unknown) => {
    console.error(error);
    window.alert('Không lưu được dữ liệu. Có thể bộ nhớ trình duyệt đã đầy hoặc bị chặn. Hãy xuất EPUB hoặc sao lưu và thử lại.');
  };
  const commitLibrary = (change: (current: LibraryData) => LibraryData) => enqueue(async () => {
    const next = normalizeLibraryData(change(libraryRef.current));
    await writeAppValue('library', next);
    libraryRef.current = next;
    setNovelsList(next.novelsList);
    setSavedChapters(next.savedChapters);
  });

  useEffect(() => subscribeDictionaryChanges(stores => {
    if (!stores.length) return;
    void enqueue(async () => {
      const changed = new Set(stores);
      const map = (rows: any[]) => rowsToDictionaryMap(rows);
      if (changed.has(STORE_NAMES)) setNamesList(await readStore<NameItem>(STORE_NAMES));
      if (changed.has(STORE_NAMES_MAIN)) setNamesMainMap(map(await readStore<any>(STORE_NAMES_MAIN)));
      if (changed.has(STORE_VIETPHRASE)) setVietphraseMap(rowsToVietphraseMap(await readStore<any>(STORE_VIETPHRASE)));
      if (changed.has(STORE_LUAT_NHAN)) setLuatNhanMap(Object.fromEntries((await readStore<any>(STORE_LUAT_NHAN)).map(row => [row.pattern, row.translation])));
      if (changed.has(STORE_PRONOUNS)) setPronounsMap(map(await readStore<any>(STORE_PRONOUNS)));
      if (changed.has(STORE_IGNORED)) setIgnoredPhrasesList((await readStore<any>(STORE_IGNORED)).map(row => row.phrase));
      if (changed.has(STORE_PHIEN_AM)) setPhienAmMap(map(await readStore<any>(STORE_PHIEN_AM)));
    }).catch(reportStorageError);
  }), []);

  useEffect(() => {
    let active = true;
    void enqueue(async () => {
      let library = await readAppValue<LibraryData>('library');
      if (!library) {
        library = libraryRef.current;
        await writeAppValue('library', library);
      }
      const normalizedLibrary = normalizeLibraryData(library);
      if (normalizedLibrary !== library) {
        library = normalizedLibrary;
        await writeAppValue('library', library);
      }
      const storedSettings = normalizeSettings(await readAppValue<AppSettings>('settings') || settingsRef.current);
      const stats = await updateReadingStats(current => current, statsRef.current);
      await writeAppValue('settings', storedSettings);
      await initializeDefaultDictionaries((message, percent) => { if (active) setDictionaryLoadStatus(`${message} ${percent}%`); });
      await loadMeaningStyles();
      if (!active) return;
      libraryRef.current = library;
      settingsRef.current = storedSettings;
      statsRef.current = stats;
      setNovelsList(library.novelsList);
      setSavedChapters(library.savedChapters);
      setSettings(storedSettings);
      setReadingStats(stats);
      const map = (rows: any[]) => rowsToDictionaryMap(rows);
      // Load stores one at a time. Loading all seven in parallel temporarily kept
      // both every IndexedDB row and every converted lookup table in memory.
      setNamesList(await readStore<any>(STORE_NAMES));
      setNamesMainMap(map(await readStore<any>(STORE_NAMES_MAIN)));
      setVietphraseMap(rowsToVietphraseMap(await readStore<any>(STORE_VIETPHRASE)));
      setLuatNhanMap(Object.fromEntries((await readStore<any>(STORE_LUAT_NHAN)).map(row => [row.pattern, row.translation])));
      setPronounsMap(map(await readStore<any>(STORE_PRONOUNS)));
      setIgnoredPhrasesList((await readStore<any>(STORE_IGNORED)).map(row => row.phrase));
      setPhienAmMap(map(await readStore<any>(STORE_PHIEN_AM)));
      if (!active) return;
      setStorageReady(true);
      // Keep legacy copies as a recovery source; IndexedDB is authoritative after migration.
    }).catch(error => { if (active) setStorageError(String(error)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // Legacy mock accounts are never a source of authenticated identity.
    try { removeLegacyAccount(); } catch {}
    let active = true;
    const revision = authRevision.current;
    authRequest<GoogleAccount>('session').then(account => { if (active && authRevision.current === revision) setGoogleAccount(account); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const updateSettings = (updates: Partial<AppSettings>) => {
    return enqueue(async () => {
      const next = { ...settingsRef.current, ...updates };
      await writeAppValue('settings', next);
      settingsRef.current = next;
      setSettings(next);
      return true;
    }).catch(error => { reportStorageError(error); return false; });
  };

  const statsChannel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('hermes-reading-stats-v2'); statsChannel.current = channel;
    let active = true;
    channel.onmessage = () => { void readAppValue<ReadingStats>('readingStats').then(value => {
      if (active && value) { const next = normalizeReadingStats(value); statsRef.current = next; setReadingStats(next); }
    }).catch(() => {}); };
    return () => { active = false; channel.close(); statsChannel.current = null; };
  }, []);
  const recordReadingActivity = (delta: ReadingDelta) => {
    void enqueue(async () => {
      const next = await updateReadingStats(current => applyReadingDelta(current, delta));
      statsRef.current = next; setReadingStats(next); statsChannel.current?.postMessage('changed');
    }).catch(reportStorageError);
  };

  const resetReadingStats = () => {
    return enqueue(async () => {
      const next = await updateReadingStats(() => emptyReadingStats());
      statsRef.current = next;
      setReadingStats(next);
      statsChannel.current?.postMessage('changed');
      return true;
    }).catch(error => { reportStorageError(error); return false; });
  };

  const loginWithGoogle = async (credential: string, csrf: string) => {
    const revision = ++authRevision.current;
    const account = await authRequest<GoogleAccount>('google', { credential, csrf });
    if (authRevision.current === revision) setGoogleAccount(account);
  };

  const logoutGoogle = async () => {
    ++authRevision.current;
    await authRequest('logout', {});
    window.google?.accounts.id.disableAutoSelect();
    setGoogleAccount({
      isLoggedIn: false,
      email: '',
      name: '',
      avatarUrl: undefined,
    });
  };

  const openInspectModal = (chinese: string, vietnamese?: string, category?: NameItem['category'], target?: 'name' | 'name_main' | 'vietphrase', style?: TranslationStyle) => {
    setInspectModal({
      isOpen: true,
      initialChinese: chinese,
      initialVietnamese: vietnamese || '',
      initialCategory: category || 'Nhân vật',
      target: target || (category === 'Khác' ? 'vietphrase' : 'name'),
      style,
    });
  };

  const closeInspectModal = () => {
    setInspectModal(prev => ({ ...prev, isOpen: false }));
  };

  // Names handlers
  const addName = (chinese: string, vietnamese: string, category: NameItem['category'] = 'Nhân vật', note = ''): boolean => {
    if (!chinese.trim() || !vietnamese.trim()) return false;
    const cleanCn = chinese.trim();
    const cleanVn = vietnamese.trim();

    const existingIndex = namesList.findIndex(n => n.chinese === cleanCn);
    if (existingIndex >= 0) {
      const updated = [...namesList];
      const updatedItem: NameItem = {
        ...updated[existingIndex],
        vietnamese: cleanVn,
        category,
        note: note || updated[existingIndex].note,
        createdAt: Date.now(),
      };
      updated[existingIndex] = updatedItem;
      setNamesList(updated);
      saveNameItem(updatedItem).catch(console.error);
      return true;
    }

    const newItem: NameItem = {
      id: `name-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      chinese: cleanCn,
      vietnamese: cleanVn,
      category,
      note,
      createdAt: Date.now(),
    };

    setNamesList(prev => [newItem, ...prev]);
    saveNameItem(newItem).catch(console.error);
    return true;
  };

  const addNameMain = (chinese: string, vietnamese: string): boolean => {
    const cleanCn = chinese.trim();
    const cleanVn = vietnamese.trim();
    if (!cleanCn || !cleanVn) return false;
    setNamesMainMap(previous => ({ ...previous, [cleanCn]: cleanVn }));
    saveNamesMainBatch([{ chinese: cleanCn, vietnamese: cleanVn }]).catch(console.error);
    return true;
  };

  const deleteNameMain = (chinese: string) => {
    const cleanCn = chinese.trim();
    if (!cleanCn) return;
    setNamesMainMap(previous => {
      const next = { ...previous };
      delete next[cleanCn];
      return next;
    });
    deleteDictionaryKeys(STORE_NAMES_MAIN, [cleanCn]).catch(console.error);
  };

  const updateName = (id: string, updates: Partial<NameItem>) => {
    setNamesList(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const newItem = { ...item, ...updates };
          saveNameItem(newItem).catch(console.error);
          return newItem;
        }
        return item;
      });
      return updated;
    });
  };

  const deleteName = (id: string) => {
    setNamesList(prev => prev.filter(item => item.id !== id));
    deleteNameItem(id).catch(console.error);
  };

  const deletePhrase = (chinese: string) => {
    const cleanCn = chinese.trim();
    if (!cleanCn) return;

    deleteNameByChinese(cleanCn).catch(console.error);
    setNamesList(prev => prev.filter(n => n.chinese !== cleanCn));

    deleteVietphraseItem(cleanCn).catch(console.error);
    setVietphraseMap(prev => {
      const copy = { ...prev };
      delete copy[cleanCn];
      return copy;
    });
  };

  const addVietphrase = (chinese: string, vietnamese: string) => {
    if (!chinese.trim() || !vietnamese.trim()) return;
    const cn = chinese.trim();
    const normalizedCn = simplifyChinese(cn);
    const vn = vietnamese.trim();

    setVietphraseMap(prev => ({
      ...prev,
      [normalizedCn]: vn,
      [cn]: vn,
    }));
    const rows = normalizedCn === cn ? [{ chinese: cn, vietnamese: vn }] : [{ chinese: cn, vietnamese: vn }, { chinese: normalizedCn, vietnamese: vn }];
    saveVietphraseBatch(rows).catch(console.error);
  };

  const deleteVietphrase = (chinese: string) => {
    const cn = chinese.trim();
    const normalizedCn = simplifyChinese(cn);
    setVietphraseMap(prev => {
      const next = { ...prev };
      delete next[cn];
      delete next[normalizedCn];
      return next;
    });
    Promise.all([...new Set([cn, normalizedCn])].map(key => deleteVietphraseItem(key))).catch(console.error);
  };

  const addIgnoredPhrase = (chinese: string) => {
    const cleanCn = chinese.trim();
    if (!cleanCn) return;
    setIgnoredPhrasesList(prev => {
      if (prev.includes(cleanCn)) return prev;
      const updated = [cleanCn, ...prev];
      saveIgnoredPhrasesBatch([cleanCn]).catch(console.error);
      return updated;
    });
  };

  const updatePhrase = (oldChinese: string, newChinese: string, newViet: string, type: 'name' | 'vietphrase') => {
    const oldCn = oldChinese.trim();
    const newCn = newChinese.trim();
    const newVn = newViet.trim();
    if (!newCn || !newVn) return;

    if (type === 'name') {
      const existing = namesList.find(n => n.chinese === oldCn);
      if (oldCn !== newCn) {
        deleteNameByChinese(oldCn).catch(console.error);
      }
      const newItem: NameItem = {
        id: existing?.id || `name-${Date.now()}`,
        chinese: newCn,
        vietnamese: newVn,
        category: existing?.category || 'Nhân vật',
        note: existing?.note || '',
        createdAt: Date.now(),
      };
      setNamesList(prev => {
        const filtered = prev.filter(n => n.chinese !== oldCn && n.chinese !== newCn);
        return [newItem, ...filtered];
      });
      saveNameItem(newItem).catch(console.error);
    } else {
      if (oldCn !== newCn) {
        deleteVietphraseItem(oldCn).catch(console.error);
      }
      setVietphraseMap(prev => {
        const next = { ...prev };
        if (oldCn !== newCn) delete next[oldCn];
        next[newCn] = newVn;
        return next;
      });
      saveVietphraseItem(newCn, newVn).catch(console.error);
    }
  };

  const deleteMultiplePhrases = (phrases: string[], type: 'name' | 'vietphrase' | 'ignored') => {
    if (!phrases || phrases.length === 0) return;
    const phraseSet = new Set(phrases.map(p => p.trim()));

    if (type === 'name') {
      phrases.forEach(cn => deleteNameByChinese(cn.trim()).catch(console.error));
      setNamesList(prev => prev.filter(n => !phraseSet.has(n.chinese)));
    } else if (type === 'vietphrase') {
      phrases.forEach(cn => deleteVietphraseItem(cn.trim()).catch(console.error));
      setVietphraseMap(prev => {
        const next = { ...prev };
        phrases.forEach(cn => delete next[cn.trim()]);
        return next;
      });
    } else if (type === 'ignored') {
      deleteIgnoredPhrases([...phraseSet]).then(() => setIgnoredPhrasesList(prev => prev.filter(p => !phraseSet.has(p)))).catch(reportStorageError);
    }
  };

  const importEntriesBatch = async (
    type: 'names' | 'vietphrase',
    entries: Array<{ chinese: string; vietnamese: string }>
  ): Promise<number> => {
    if (entries.length === 0) return 0;
    setIsImportingLargeFile(true);

    try {
      if (type === 'names') {
        const newNames: NameItem[] = entries.map((e, idx) => ({
          id: `batch-${crypto.randomUUID()}`,
          chinese: e.chinese,
          vietnamese: e.vietnamese,
          category: 'Nhân vật',
          note: 'Nhập lô QuickTranslator',
          createdAt: Date.now(),
        }));

        await saveNamesBatch(newNames);
        setNamesList(prev => {
          const map = new Map<string, NameItem>();
          for (const item of prev) map.set(item.chinese, item);
          for (const item of newNames) map.set(item.chinese, item);
          return Array.from(map.values());
        });
        return newNames.length;
      } else {
        await saveVietphraseBatch(entries);
        setVietphraseMap(prev => {
          const map = { ...prev };
          for (const e of entries) {
            map[e.chinese] = e.vietnamese;
          }
          return map;
        });
        return entries.length;
      }
    } finally {
      setIsImportingLargeFile(false);
      setImportProgress(null);
    }
  };

  // Export / Import từng file riêng lẻ theo cú pháp QuickTranslator
  const exportSingleTxt = (dictType: DictCategoryType): string => {
    switch (dictType) {
      case 'names':
        return namesList.map(item => `${item.chinese}=${item.vietnamese}`).join('\n');
      case 'names_main':
        return Object.entries(namesMainMap).map(([k, v]) => `${k}=${v}`).join('\n');
      case 'vietphrase': {
        const merged = vietphraseMap;
        return Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n');
      }
      case 'luatnhan': {
        const merged = luatNhanMap;
        return Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n');
      }
      case 'pronouns': {
        const merged = pronounsMap;
        return Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n');
      }
      case 'phienam':
        return Object.entries(phienAmMap).map(([k, v]) => `${k}=${v}`).join('\n');
      case 'ignored':
        return ignoredPhrasesList.join('\n');
      default:
        return '';
    }
  };

  const importSingleTxt = async (dictType: DictCategoryType, content: string): Promise<number> => {
    const lines = content.split(/\r\n|\r|\n/);
    let count = 0;

    if (dictType === 'ignored') {
      const phrases = lines.map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('//'));
      await replaceIgnoredPhrases(phrases);
      return phrases.length;
    }

    const keyValBatch: Array<{ chinese: string; vietnamese: string }> = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim();
        if (k) {
          keyValBatch.push({ chinese: k, vietnamese: v });
          count++;
        }
      }
    }

    if (keyValBatch.length === 0) return 0;

    switch (dictType) {
      case 'names': {
        // A Chinese key has one value even across repeated imports/batches.
        const map = new Map((await readStore<NameItem>(STORE_NAMES)).map(item => [item.chinese, item]));
        for (const entry of keyValBatch) {
          const existing = map.get(entry.chinese);
          map.set(entry.chinese, {
            id: existing?.id || `name-import-${crypto.randomUUID()}`,
            chinese: entry.chinese, vietnamese: entry.vietnamese,
            category: existing?.category || 'Nhân vật', note: existing?.note || 'Nhập từ tệp TXT',
            createdAt: existing?.createdAt || Date.now(),
          });
        }
        const next = [...map.values()];
        await replaceStores({ [STORE_NAMES]: next });
        setNamesList(next);
        break;
      }
      case 'names_main': {
        await saveNamesMainBatch(keyValBatch);
        setNamesMainMap(prev => {
          const next = { ...prev };
          for (const item of keyValBatch) next[item.chinese] = item.vietnamese;
          return next;
        });
        break;
      }
      case 'phienam': {
        await savePhienAmBatch(keyValBatch);
        setPhienAmMap(previous => ({ ...previous, ...Object.fromEntries(keyValBatch.map(row => [row.chinese, row.vietnamese])) }));
        break;
      }
      case 'vietphrase': {
        await saveVietphraseBatch(keyValBatch);
        setVietphraseMap(prev => {
          const next = { ...prev };
          for (const item of keyValBatch) next[item.chinese] = item.vietnamese;
          return next;
        });
        break;
      }
      case 'luatnhan': {
        const records = keyValBatch.map(k => ({ pattern: k.chinese, translation: k.vietnamese }));
        await saveLuatNhanBatch(records);
        setLuatNhanMap(prev => {
          const next = { ...prev };
          for (const r of records) next[r.pattern] = r.translation;
          return next;
        });
        break;
      }
      case 'pronouns': {
        await savePronounsBatch(keyValBatch);
        setPronounsMap(prev => {
          const next = { ...prev };
          for (const item of keyValBatch) next[item.chinese] = item.vietnamese;
          return next;
        });
        break;
      }
    }

    return count;
  };

  const importDictionaryFile = async (dictType: DictCategoryType, file: File, onProgress?: (count: number, percent: number) => void): Promise<number> => {
    if (typeof Worker !== 'undefined') {
      const count = await persistDictionaryFile(dictType, file, onProgress);
      onProgress?.(count, 96);
      const store = { names: STORE_NAMES, names_main: STORE_NAMES_MAIN, vietphrase: STORE_VIETPHRASE, phienam: STORE_PHIEN_AM, luatnhan: STORE_LUAT_NHAN, pronouns: STORE_PRONOUNS, ignored: STORE_IGNORED }[dictType];
      const rows = await readStore<any>(store);
      if (dictType === 'names') setNamesList(rows);
      else if (dictType === 'ignored') setIgnoredPhrasesList(rows.map(row => row.phrase));
      else {
        const map: Record<string, string> = Object.create(null);
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index]; map[row.chinese ?? row.pattern] = row.vietnamese ?? row.translation;
          if (index % 20000 === 19999) await yieldToBrowser();
        }
        switch (dictType) {
          case 'names_main': setNamesMainMap(map); break;
          case 'vietphrase': setVietphraseMap(rowsToVietphraseMap(rows)); break;
          case 'phienam': setPhienAmMap(map); break;
          case 'luatnhan': setLuatNhanMap(map); break;
          case 'pronouns': setPronounsMap(map); break;
        }
      }
      onProgress?.(count, 100);
      return count;
    }
    if (dictType === 'ignored') {
      const phrases = new Set<string>();
      await importDictionaryInBackground(file, onProgress, async entries => {
        for (const entry of entries) phrases.add(entry.chinese);
      }, 'ignored');
      await replaceIgnoredPhrases([...phrases]);
      return phrases.size;
    }
    const stores: Partial<Record<DictCategoryType, string>> = {
      names: STORE_NAMES, names_main: STORE_NAMES_MAIN, vietphrase: STORE_VIETPHRASE,
      phienam: STORE_PHIEN_AM, luatnhan: STORE_LUAT_NHAN, pronouns: STORE_PRONOUNS,
    };
    const store = stores[dictType];
    if (!store) throw new Error('Loại tệp không hỗ trợ nhập từ điển.');
    const names = dictType === 'names' ? new Map((await readStore<NameItem>(STORE_NAMES)).map(item => [item.chinese, item])) : null;
    let committed = 0, processed = 0;
    const refresh = async () => {
      if (dictType === 'names') return;
      const rows = await readStore<any>(store);
      const map: Record<string, string> = Object.create(null);
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        map[row.chinese ?? row.pattern] = row.vietnamese ?? row.translation;
        if (index % 10000 === 9999) await yieldToBrowser();
      }
      switch (dictType) {
        case 'names_main': setNamesMainMap(map); break;
        case 'vietphrase': setVietphraseMap(rowsToVietphraseMap(rows)); break;
        case 'phienam': setPhienAmMap(map); break;
        case 'luatnhan': setLuatNhanMap(map); break;
        case 'pronouns': setPronounsMap(map); break;
      }
    };
    try {
      await importDictionaryInBackground(file, onProgress, async entries => {
        if (names) {
          for (const entry of entries) {
            const existing = names.get(entry.chinese);
            names.set(entry.chinese, { id: existing?.id || `name-import-${crypto.randomUUID()}`, ...entry,
              category: existing?.category || 'Nhân vật', createdAt: existing?.createdAt || Date.now(), note: existing?.note || 'Nhập TXT' });
          }
        } else {
          switch (dictType) {
            case 'names_main': await saveNamesMainBatch(entries); break;
            case 'vietphrase': await saveVietphraseBatch(entries); break;
            case 'phienam': await savePhienAmBatch(entries); break;
            case 'luatnhan': await saveLuatNhanBatch(entries.map(row => ({ pattern: row.chinese, translation: row.vietnamese }))); break;
            case 'pronouns': await savePronounsBatch(entries); break;
          }
          committed += entries.length;
        }
        processed += entries.length;
      });
      if (names) {
        const next = [...names.values()];
        await replaceStores({ [STORE_NAMES]: next });
        committed = processed;
        setNamesList(next);
      } else await refresh();
      return processed;
    } catch (error) {
      if (committed) await refresh();
      throw new Error(`Đã lưu ${committed.toLocaleString()} mục trước khi dừng: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const replaceIgnoredPhrases = async (phrases: string[]): Promise<void> => {
    const next = [...new Set(phrases.map(phrase => phrase.trim()).filter(Boolean))];
    await replaceStores({ [STORE_IGNORED]: next.map(phrase => ({ phrase })) });
    setIgnoredPhrasesList(next);
  };

  const clearSpecificStore = async (dictType: DictCategoryType): Promise<void> => {
    switch (dictType) {
      case 'names':
        await clearNamesStore();
        setNamesList([]);
        break;
      case 'names_main':
        await clearNamesMainStore();
        setNamesMainMap({});
        break;
      case 'phienam':
        await replaceStores({ [STORE_PHIEN_AM]: [] });
        setPhienAmMap({});
        break;
      case 'vietphrase':
        await clearVietphraseStore();
        setVietphraseMap({});
        break;
      case 'luatnhan':
        await clearLuatNhanStore();
        setLuatNhanMap({});
        break;
      case 'pronouns':
        await clearPronounsStore();
        setPronounsMap({});
        break;
      case 'ignored':
        await clearIgnoredPhrasesStore();
        setIgnoredPhrasesList([]);
        break;
    }
  };

  const deleteDictionaryEntries = async (dictType: DictCategoryType, keys: string[]): Promise<void> => {
    const removed = new Set(keys);
    if (!removed.size) return;
    const stores: Partial<Record<DictCategoryType, string>> = {
      names: STORE_NAMES, names_main: STORE_NAMES_MAIN, vietphrase: STORE_VIETPHRASE, phienam: STORE_PHIEN_AM,
      luatnhan: STORE_LUAT_NHAN, pronouns: STORE_PRONOUNS, ignored: STORE_IGNORED,
    };
    const store = stores[dictType];
    if (!store) throw new Error('Bảng này chỉ hỗ trợ tra cứu.');
    const storageKeys = dictType === 'names' ? namesList.filter(row => removed.has(row.chinese)).map(row => row.id) : [...removed];
    await deleteDictionaryKeys(store, storageKeys);
    const withoutKeys = (map: Record<string, string>) => Object.fromEntries(Object.entries(map).filter(([key]) => !removed.has(key)));
    switch (dictType) {
      case 'names': setNamesList(prev => prev.filter(row => !removed.has(row.chinese))); break;
      case 'names_main': setNamesMainMap(withoutKeys); break;
      case 'phienam': setPhienAmMap(withoutKeys); break;
      case 'vietphrase': setVietphraseMap(withoutKeys); break;
      case 'luatnhan': setLuatNhanMap(withoutKeys); break;
      case 'pronouns': setPronounsMap(withoutKeys); break;
      case 'ignored': setIgnoredPhrasesList(prev => prev.filter(key => !removed.has(key))); break;
    }
  };

  const loadAllQuickTranslatorAssets = async (
    onProgress?: (message: string, percent: number) => void,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      await enqueue(async () => {
        const bundle = await restoreDefaultDictionaries(onProgress);
        await loadMeaningStyles();
        applyDictionaryStores(bundle.stores);
      });
      return { success: true, message: 'Đã nạp bộ từ điển mặc định của Hermes.' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Không nạp được từ điển mặc định.' };
    }
  };

  const exportAllDatabasesJson = (): Promise<string> => enqueue(async () => {
    const stores = await Promise.all(DICTIONARY_STORES.map(name => readStore<any>(name)));
    const map = (rows: any[]) => Object.fromEntries(rows.map(row => [row.chinese, row.vietnamese]));
    const backup: BackupData = {
      app: 'Hermes', version: 3, exportedAt: new Date().toISOString(),
      meaningStyles: meaningStyleSnapshot(),
      meaningStylesFallback: meaningStyleFallback(),
      namesList: stores[0], namesMainMap: map(stores[1]), vietphraseMap: map(stores[2]),
      luatNhanMap: Object.fromEntries(stores[3].map(row => [row.pattern, row.translation])),
      pronounsMap: map(stores[4]), ignoredPhrasesList: stores[5].map(row => row.phrase), phienAmMap: map(stores[6]),
      ...libraryRef.current, settings: settingsRef.current, readingStats: statsRef.current, readerState: await readReaderState(),
    };
    return JSON.stringify(backup);
  });

  const importAllDatabasesJson = (text: string): Promise<{ success: boolean; message: string }> => enqueue(async () => {
    try {
      const data = parseBackup(text);
      const library = normalizeLibraryData({ novelsList: data.novelsList ?? libraryRef.current.novelsList,
        savedChapters: data.savedChapters ?? libraryRef.current.savedChapters });
      const preferences = normalizeSettings(data.settings ?? settingsRef.current);
      const stats = normalizeReadingStats(data.readingStats ?? statsRef.current);
      await replaceStores(backupStores(data), { library, settings: preferences, readingStats: stats, dictionariesInitialized: true, ...(data.readerState ? { readerState: data.readerState } : {}), ...(data.meaningStyles !== undefined ? { [MEANING_STYLES_KEY]: data.meaningStyles, [MEANING_STYLES_FALLBACK_KEY]: data.meaningStylesFallback ?? null } : {}) });
      if (data.meaningStyles !== undefined) applyMeaningStyles(data.meaningStyles, data.meaningStylesFallback ?? null);
      if (data.readerState) clearStagedReadingPositions();
      libraryRef.current = library;
      settingsRef.current = preferences;
      statsRef.current = stats;
      setNovelsList(library.novelsList);
      setSavedChapters(library.savedChapters);
      setSettings(preferences);
      setReadingStats(stats);
      if (data.namesList !== undefined) setNamesList(data.namesList);
      if (data.namesMainMap !== undefined) setNamesMainMap(data.namesMainMap);
      if (data.phienAmMap !== undefined) setPhienAmMap(data.phienAmMap);
      if (data.vietphraseMap !== undefined) setVietphraseMap(rowsToVietphraseMap(Object.entries(data.vietphraseMap).map(([chinese, vietnamese]) => ({ chinese, vietnamese }))));
      if (data.luatNhanMap !== undefined) setLuatNhanMap(data.luatNhanMap);
      if (data.pronounsMap !== undefined) setPronounsMap(data.pronounsMap);
      if (data.ignoredPhrasesList !== undefined) setIgnoredPhrasesList(data.ignoredPhrasesList);
      return { success: true, message: 'Đã khôi phục dữ liệu. Các phần không có trong bản sao lưu cũ được giữ nguyên.' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Không khôi phục được dữ liệu' };
    }
  });

  const exportNamesTxt = (): string => exportSingleTxt('names');
  const importNamesTxt = (content: string): number => {
    const lines = content.split(/\r\n|\r|\n/);
    let count = 0;
    const newItems: NameItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const cn = parts[0].trim();
        const vn = parts.slice(1).join('=').trim();
        if (cn && vn) {
          newItems.push({
            id: `import-${Date.now()}-${count++}`,
            chinese: cn,
            vietnamese: vn,
            category: 'Nhân vật',
            note: 'Nhập từ tệp QuickTranslator',
            createdAt: Date.now(),
          });
        }
      }
    }

    if (newItems.length > 0) {
      saveNamesBatch(newItems).catch(console.error);
      setNamesList(prev => {
        const map = new Map<string, NameItem>();
        for (const item of prev) map.set(item.chinese, item);
        for (const item of newItems) map.set(item.chinese, item);
        return Array.from(map.values());
      });
    }

    return newItems.length;
  };

  const exportVietphraseTxt = (): string => exportSingleTxt('vietphrase');
  const importVietphraseTxt = (content: string): number => {
    const lines = content.split(/\r\n|\r|\n/);
    let count = 0;
    const newEntries: Record<string, string> = {};
    const batchList: Array<{ chinese: string; vietnamese: string }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const cn = parts[0].trim();
        const vn = parts.slice(1).join('=').trim();
        if (cn) {
          newEntries[cn] = vn;
          batchList.push({ chinese: cn, vietnamese: vn });
          count++;
        }
      }
    }

    if (batchList.length > 0) {
      saveVietphraseBatch(batchList).catch(console.error);
      setVietphraseMap(prev => ({
        ...prev,
        ...newEntries,
      }));
    }

    return count;
  };

  const applyDictionaryStores = (stores: Record<string, unknown[]>) => {
    const map = (name: string) => Object.fromEntries((stores[name] as { chinese: string; vietnamese: string }[]).map(row => [row.chinese, row.vietnamese]));
    setNamesList(stores[STORE_NAMES] as NameItem[]);
    setNamesMainMap(map(STORE_NAMES_MAIN));
    setPhienAmMap(map(STORE_PHIEN_AM));
    setVietphraseMap(rowsToVietphraseMap(stores[STORE_VIETPHRASE] as { chinese: string; vietnamese: string }[]));
    setLuatNhanMap(Object.fromEntries((stores[STORE_LUAT_NHAN] as { pattern: string; translation: string }[]).map(row => [row.pattern, row.translation])));
    setPronounsMap(map(STORE_PRONOUNS));
    setIgnoredPhrasesList((stores[STORE_IGNORED] as { phrase: string }[]).map(row => row.phrase));
  };

  const resetDictionaries = () => enqueue(async () => {
    const bundle = await restoreDefaultDictionaries();
    await loadMeaningStyles();
    applyDictionaryStores(bundle.stores);
  });

  // Novel management handlers
  const addNovel = async (book: Omit<NovelBook, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const id = `novel-${crypto.randomUUID()}`;
    const newBook: NovelBook = {
      ...book,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await commitLibrary(current => ({ ...current, novelsList: [newBook, ...current.novelsList] }));
    return id;
  };

  const updateNovel = (id: string, updates: Partial<NovelBook>) => commitLibrary(current => ({
    ...current, novelsList: current.novelsList.map(book => book.id === id ? { ...book, ...updates, id, updatedAt: Date.now() } : book),
  }));

  const deleteNovel = (id: string) => commitLibrary(current => ({
    novelsList: current.novelsList.filter(book => book.id !== id),
    savedChapters: current.savedChapters.filter(chapter => chapter.novelId !== id),
  }));

  const toggleFavoriteNovel = (id: string) => commitLibrary(current => ({
    ...current, novelsList: current.novelsList.map(book => book.id === id ? { ...book, isFavorite: !book.isFavorite, updatedAt: Date.now() } : book),
  }));

  const saveLibraryChapters = async (
    book: string | Omit<NovelBook, 'id' | 'createdAt' | 'updatedAt'>,
    chapters: Omit<SavedChapter, 'id' | 'savedAt'>[],
    options: ChapterSaveOptions = {},
  ): Promise<{ novelId: string; count: number; overwritten: number; skipped: number }> => {
    let result = { novelId: '', count: 0, overwritten: 0, skipped: 0 };
    await commitLibrary(current => {
      const existing = typeof book === 'string' ? current.novelsList.find(row => row.id === book) :
        current.novelsList.find(row => row.title.toLowerCase() === book.title.toLowerCase());
      if (typeof book === 'string' && !existing) throw new Error('Không tìm thấy bộ truyện.');
      const novel: NovelBook = existing || { ...(book as Omit<NovelBook, 'id' | 'createdAt' | 'updatedAt'>),
        id: `novel-${crypto.randomUUID()}`, createdAt: Date.now(), updatedAt: Date.now() };
      const incoming = chapters.map(chapter => {
        const parsed = parseChapterHeader(chapter.title);
        return { ...chapter, novelId: novel.id, novelTitle: novel.title,
          chapterPrefix: chapter.chapterPrefix || parsed.prefix, chapterName: chapter.chapterName || parsed.name };
      });
      const merged = mergeLibraryChapters(current.savedChapters, incoming, options);
      result = { novelId: novel.id, count: merged.count, overwritten: merged.overwritten, skipped: merged.skipped };
      return {
        novelsList: existing ? current.novelsList.map(row => row.id === novel.id ? { ...row,
          ...(typeof book === 'string' ? {} : {
            originalTitle: book.originalTitle || row.originalTitle,
            originalAuthor: book.originalAuthor || row.originalAuthor,
            vietnameseTitle: book.vietnameseTitle || row.vietnameseTitle,
            vietnameseAuthor: book.vietnameseAuthor || row.vietnameseAuthor,
          }), updatedAt: Date.now() } : row) : [novel, ...current.novelsList],
        savedChapters: merged.chapters,
      };
    });
    return result;
  };

  // Saved Chapters handlers
  const saveChapter = async (chapter: Omit<SavedChapter, 'id' | 'savedAt'>, options: ChapterSaveOptions = {}): Promise<string> => {
    let id = '';
    const parsed = parseChapterHeader(chapter.title);
    const safeNovel = (chapter.novelTitle || 'Tieu_Thuyet').trim().replace(/[\\/:*?"<>|]/g, '_');
    const safeChap = (chapter.title || 'Chuong').trim().replace(/[\\/:*?"<>|]/g, '_');
    const filePath = `/local/Hermes/Lib/${safeNovel}/${safeChap}.txt`;

    const newChapter: Omit<SavedChapter, 'id' | 'savedAt'> = {
      ...chapter,
      chapterPrefix: chapter.chapterPrefix || parsed.prefix,
      chapterName: chapter.chapterName || parsed.name,
      filePath,
    };

    await commitLibrary(current => {
      const merged = mergeLibraryChapters(current.savedChapters, [newChapter], options);
      id = merged.ids[0];
      return { savedChapters: merged.chapters,
        novelsList: current.novelsList.map(book => book.id === chapter.novelId || book.title === chapter.novelTitle ? { ...book, updatedAt: Date.now() } : book),
      };
    });

    return id;
  };

  const updateSavedChapter = (id: string, updates: Pick<SavedChapter, 'title' | 'originalText' | 'vietphraseText'>) => commitLibrary(current => {
    if (!updates.title.trim()) throw new Error('Tên chương không được để trống.');
    if (!current.savedChapters.some(chapter => chapter.id === id)) throw new Error('Chương đã bị xóa.');
    const parsed = parseChapterHeader(updates.title.trim());
    return { ...current, savedChapters: current.savedChapters.map(chapter => chapter.id === id ? { ...chapter, ...updates,
      title: updates.title.trim(), chapterPrefix: parsed.prefix, chapterName: parsed.name, hanvietText: undefined, savedAt: Date.now() } : chapter) };
  });

  const deleteSavedChapter = (id: string) => commitLibrary(current => ({
    ...current, savedChapters: current.savedChapters.filter(chapter => chapter.id !== id),
  }));

  // A single snapshot write is substantially cheaper than committing once for every
  // selected chapter. The storage queue still serializes it with other library edits.
  const deleteSavedChapters = async (ids: string[]): Promise<number> => {
    const idsToDelete = new Set(ids);
    if (!idsToDelete.size) return 0;
    let deleted = 0;
    await commitLibrary(current => {
      const remaining = current.savedChapters.filter(chapter => {
        const remove = idsToDelete.has(chapter.id);
        if (remove) deleted++;
        return !remove;
      });
      return deleted ? { ...current, savedChapters: remaining } : current;
    });
    return deleted;
  };

  if (storageError) return <div role="alert" className="p-6">Không mở được dữ liệu: {storageError}. Hãy kiểm tra dung lượng và quyền lưu trữ rồi tải lại trang.</div>;
  if (!storageReady) return <div role="status" className="p-6">{dictionaryLoadStatus || 'Đang mở dữ liệu…'}</div>;

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        readingStats,
        resetReadingStats,
        recordReadingActivity,
        googleAccount,
        loginWithGoogle,
        logoutGoogle,
        namesList,
        addName,
        addNameMain,
        deleteNameMain,
        updateName,
        deleteName,
        exportNamesTxt,
        importNamesTxt,
        namesMainMap,
        phienAmMap,
        dictionaryStyleRevision,
        vietphraseMap,
        addVietphrase,
        deleteVietphrase,
        exportVietphraseTxt,
        importVietphraseTxt,
        resetDictionaries,
        luatNhanMap,
        pronounsMap,
        ignoredPhrasesList,
        addIgnoredPhrase,
        deletePhrase,
        updatePhrase,
        deleteMultiplePhrases,
        importEntriesBatch,
        isImportingLargeFile,
        importProgress,
        setImportProgress,
        exportSingleTxt,
        importSingleTxt,
        importDictionaryFile,
        clearSpecificStore,
        replaceIgnoredPhrases,
        deleteDictionaryEntries,
        loadAllQuickTranslatorAssets,
        exportAllDatabasesJson,
        importAllDatabasesJson,
        novelsList,
        addNovel,
        saveLibraryChapters,
        updateNovel,
        deleteNovel,
        toggleFavoriteNovel,
        savedChapters,
        saveChapter,
        updateSavedChapter,
        deleteSavedChapter,
        deleteSavedChapters,
        settings,
        updateSettings,
        inspectModal,
        openInspectModal,
        closeInspectModal,
        activeRawText,
        setActiveRawText,
        activeChapterTitle,
        setActiveChapterTitle,
        activeNovelTitle,
        setActiveNovelTitle,
        activeNovelId,
        setActiveNovelId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
