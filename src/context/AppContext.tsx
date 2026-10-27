/**
 * Context quản lý toàn bộ dữ liệu offline của Convert
 * 100% Offline, không yêu cầu đăng nhập.
 * Hỗ trợ IndexedDB cho toàn bộ các bảng từ điển QuickTranslator (~40MB+)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NameItem, INITIAL_NAMES } from '../data/defaultNames';
import { DEFAULT_VIETPHRASE } from '../data/vietphraseData';
import { SAMPLE_CHAPTERS } from '../data/sampleNovels';
import { 
  getStoredNames, 
  saveNameItem, 
  deleteNameItem, 
  deleteNameByChinese,
  saveNamesBatch, 
  clearNamesStore,
  getStoredVietphrase, 
  saveVietphraseItem, 
  deleteVietphraseItem, 
  saveVietphraseBatch, 
  clearVietphraseStore,
  getStoredNamesMain,
  saveNamesMainBatch,
  clearNamesMainStore,
  getStoredLuatNhan,
  saveLuatNhanBatch,
  clearLuatNhanStore,
  getStoredPronouns,
  savePronounsBatch,
  clearPronounsStore,
  getStoredIgnoredPhrases,
  saveIgnoredPhrasesBatch,
  clearIgnoredPhrasesStore,
  exportAllDatabases,
  importAllDatabases
} from '../utils/indexedDbStorage';
import { 
  DEFAULT_LUAT_NHAN, 
  DEFAULT_PRONOUNS, 
  DEFAULT_IGNORED_PHRASES, 
  DEFAULT_NAMES2, 
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
  id: string;
  title: string;
  originalTitle?: string;
  author?: string;
  coverUrl?: string;
  description?: string;
  genre?: string;
  filePath?: string;
  createdAt: number;
  updatedAt: number;
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
  if (!title) return { prefix: 'Chương 1', name: '', full: 'Chương 1' };
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
export type AppTab = 'translate' | 'batch' | 'library' | 'dictionary' | 'settings';

export interface AppSettings {
  theme: AppTheme;
  fontSize: number;
  lineHeight: number;
  fontFamily: 'sans' | 'serif';
  displayMode: 'responsive' | 'mobile_frame';
  prioritizeNames: boolean;
  capitalizeSentences: boolean;
  ttsRate: number;
  ttsPitch: number;
}

export interface ReadingStats {
  totalReadBooks: number;
  totalReadMinutes: number;
}

export interface GoogleAccount {
  isLoggedIn: boolean;
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
  resetReadingStats: () => void;

  // Google Account
  googleAccount: GoogleAccount;
  loginWithGoogle: (email?: string, name?: string) => void;
  logoutGoogle: () => void;
  
  // Names Phụ / Cá Nhân
  namesList: NameItem[];
  addName: (chinese: string, vietnamese: string, category?: NameItem['category'], note?: string) => boolean;
  updateName: (id: string, updates: Partial<NameItem>) => void;
  deleteName: (id: string) => void;
  exportNamesTxt: () => string;
  importNamesTxt: (content: string) => number;

  // Names Chính (Gốc 136k từ)
  namesMainMap: Record<string, string>;
  
  // Vietphrase
  vietphraseMap: Record<string, string>;
  addVietphrase: (chinese: string, vietnamese: string) => void;
  deleteVietphrase: (chinese: string) => void;
  exportVietphraseTxt: () => string;
  importVietphraseTxt: (content: string) => number;
  resetDictionaries: () => void;

  // Luật Nhân (LuatNhan)
  luatNhanMap: Record<string, string>;
  
  // Đại Từ (Pronouns)
  pronounsMap: Record<string, string>;
  
  // Cụm Bỏ Qua (IgnoredPhrases)
  ignoredPhrasesList: string[];
  addIgnoredPhrase: (chinese: string) => void;
  
  // Thao tác xóa cụm từ chung
  deletePhrase: (chinese: string) => void;
  importEntriesBatch: (type: 'names' | 'vietphrase', entries: Array<{ chinese: string; vietnamese: string }>) => Promise<number>;
  isImportingLargeFile: boolean;
  importProgress: { count: number; percent: number } | null;
  setImportProgress: React.Dispatch<React.SetStateAction<{ count: number; percent: number } | null>>;

  // IMPORT / EXPORT ĐƠN LẺ & HÀNG LOẠT
  exportSingleTxt: (dictType: DictCategoryType) => string;
  importSingleTxt: (dictType: DictCategoryType, content: string) => Promise<number>;
  clearSpecificStore: (dictType: DictCategoryType) => Promise<void>;
  loadAllQuickTranslatorAssets: (onProgress?: (msg: string, percent: number) => void) => Promise<{ success: boolean; message: string }>;
  exportAllDatabasesJson: () => Promise<string>;
  importAllDatabasesJson: (jsonStr: string) => Promise<{ success: boolean; message: string }>;

  // Novels / Quản lý bộ truyện
  novelsList: NovelBook[];
  addNovel: (book: Omit<NovelBook, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNovel: (id: string, updates: Partial<NovelBook>) => void;
  deleteNovel: (id: string) => void;
  
  // Library / Chương đã lưu
  savedChapters: SavedChapter[];
  saveChapter: (chapter: Omit<SavedChapter, 'id' | 'savedAt'>) => string;
  deleteSavedChapter: (id: string) => void;
  
  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  
  // Quick Inspector Modal
  inspectModal: {
    isOpen: boolean;
    initialChinese: string;
    initialVietnamese: string;
    initialCategory: NameItem['category'];
  };
  openInspectModal: (chinese: string, vietnamese?: string, category?: NameItem['category']) => void;
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

const DEFAULT_NOVELS: NovelBook[] = [
  {
    id: 'novel-1',
    title: 'Đấu Phá Thương Khung',
    originalTitle: '斗破苍穹',
    author: 'Thiên Tàm Thổ Đậu (天蚕土豆)',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
    description: 'Nơi này là thuộc về đấu khí thế giới, không có hoa tiếu diễm lệ ma pháp, có, chỉ là sinh sôi đến đỉnh phong đấu khí! Thiếu niên Tiêu Viêm từng là thiên tài nay trở thành phế vật, tình cờ đánh thức Dược Lão trong chiếc giới chỉ tàn lưu...',
    genre: 'Huyền huyễn / Dị giới',
    createdAt: Date.now() - 1000000,
    updatedAt: Date.now() - 100000,
  },
  {
    id: 'novel-2',
    title: 'Phàm Nhân Tu Tiên',
    originalTitle: '凡人修仙传',
    author: 'Vong Ngữ (忘语)',
    coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
    description: 'Một cái bình thường phổ thông sơn thôn thiếu niên Hàn Lập, ngẫu nhiên tiến vào giang hồ môn phái, tuy rằng tư chất thường thường, nhưng dựa vào tâm tính kiên định cùng một cái thần bí tiểu lục bình, bước lên con đường tu tiên đầy trắc trở.',
    genre: 'Tiên hiệp / Cổ điển',
    createdAt: Date.now() - 900000,
    updatedAt: Date.now() - 200000,
  },
  {
    id: 'novel-3',
    title: 'Già Thiên',
    originalTitle: '遮天',
    author: 'Thần Đông (辰东)',
    coverUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&auto=format&fit=crop&q=80',
    description: 'Băng lãnh cùng hắc ám cùng tồn tại trong vũ trụ sâu thẳm, chín bộ kéo hòm rồng khổng lồ nằm ngang vạn cổ. Diệp Phàm cùng các bạn học tham gia họp lớp tại Thái Sơn, bất ngờ bị cuốn vào hành trình tu tiên vĩ đại xuyên qua các tinh vực...',
    genre: 'Huyền huyễn / Tiên hiệp',
    createdAt: Date.now() - 800000,
    updatedAt: Date.now() - 300000,
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 16,
  lineHeight: 1.7,
  fontFamily: 'sans',
  displayMode: 'responsive',
  prioritizeNames: true,
  capitalizeSentences: true,
  ttsRate: 1.0,
  ttsPitch: 1.0,
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<AppTab>('translate');

  // Load Names cá nhân / phụ
  const [namesList, setNamesList] = useState<NameItem[]>(INITIAL_NAMES);

  // Load Names chính (136k từ)
  const [namesMainMap, setNamesMainMap] = useState<Record<string, string>>({});

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

  // Khởi động nạp từ IndexedDB khi mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const storedNames = await getStoredNames();
        if (isMounted) {
          if (storedNames && storedNames.length > 0) {
            setNamesList(storedNames);
          } else {
            saveNamesBatch(INITIAL_NAMES).catch(console.error);
          }
        }
      } catch (err) {
        console.error('Error loading names from IndexedDB', err);
      }

      try {
        const storedVp = await getStoredVietphrase();
        if (isMounted && storedVp && Object.keys(storedVp).length > 0) {
          setVietphraseMap(storedVp);
        }
      } catch (err) {
        console.error('Error loading vietphrase from IndexedDB', err);
      }

      try {
        const storedMain = await getStoredNamesMain();
        if (isMounted && storedMain && Object.keys(storedMain).length > 0) {
          setNamesMainMap(storedMain);
        }
      } catch (err) {
        console.error('Error loading namesMain from IndexedDB', err);
      }

      try {
        const storedLn = await getStoredLuatNhan();
        if (isMounted && storedLn && Object.keys(storedLn).length > 0) {
          setLuatNhanMap(prev => ({ ...prev, ...storedLn }));
        }
      } catch (err) {
        console.error('Error loading luatNhan from IndexedDB', err);
      }

      try {
        const storedPro = await getStoredPronouns();
        if (isMounted && storedPro && Object.keys(storedPro).length > 0) {
          setPronounsMap(prev => ({ ...prev, ...storedPro }));
        }
      } catch (err) {
        console.error('Error loading pronouns from IndexedDB', err);
      }

      try {
        const storedIgnored = await getStoredIgnoredPhrases();
        if (isMounted && storedIgnored && storedIgnored.length > 0) {
          setIgnoredPhrasesList(storedIgnored);
        }
      } catch (err) {
        console.error('Error loading ignored phrases from IndexedDB', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load Novels
  const [novelsList, setNovelsList] = useState<NovelBook[]>(() => {
    try {
      const stored = localStorage.getItem('ttv_novel_books');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_NOVELS;
  });

  // Load Saved Chapters
  const [savedChapters, setSavedChapters] = useState<SavedChapter[]>(() => {
    try {
      const stored = localStorage.getItem('ttv_saved_chapters');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return SAMPLE_CHAPTERS;
  });

  // Load Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('ttv_reader_settings');
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // Reading Stats
  const [readingStats, setReadingStats] = useState<ReadingStats>(() => {
    try {
      const stored = localStorage.getItem('ttv_reading_stats');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return {
      totalReadBooks: 2,
      totalReadMinutes: 145,
    };
  });

  // Google Account
  const [googleAccount, setGoogleAccount] = useState<GoogleAccount>(() => {
    try {
      const stored = localStorage.getItem('ttv_google_account');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
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
  }>({
    isOpen: false,
    initialChinese: '',
    initialVietnamese: '',
    initialCategory: 'Nhân vật',
  });

  // Active translation state
  const [activeRawText, setActiveRawText] = useState('');
  const [activeChapterTitle, setActiveChapterTitle] = useState('');
  const [activeNovelTitle, setActiveNovelTitle] = useState('Đấu Phá Thương Khung');
  const [activeNovelId, setActiveNovelId] = useState('novel-1');

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('ttv_novel_books', JSON.stringify(novelsList));
  }, [novelsList]);

  useEffect(() => {
    localStorage.setItem('ttv_saved_chapters', JSON.stringify(savedChapters));
  }, [savedChapters]);

  useEffect(() => {
    localStorage.setItem('ttv_reader_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('ttv_reading_stats', JSON.stringify(readingStats));
  }, [readingStats]);

  useEffect(() => {
    localStorage.setItem('ttv_google_account', JSON.stringify(googleAccount));
  }, [googleAccount]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const resetReadingStats = () => {
    setReadingStats({ totalReadBooks: 0, totalReadMinutes: 0 });
  };

  const loginWithGoogle = (email?: string, name?: string) => {
    const userEmail = email || 'converter.pro@gmail.com';
    const userName = name || 'Converter Pro';
    setGoogleAccount({
      isLoggedIn: true,
      email: userEmail,
      name: userName,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    });
  };

  const logoutGoogle = () => {
    setGoogleAccount({
      isLoggedIn: false,
      email: '',
      name: '',
      avatarUrl: undefined,
    });
  };

  const openInspectModal = (chinese: string, vietnamese?: string, category?: NameItem['category']) => {
    setInspectModal({
      isOpen: true,
      initialChinese: chinese,
      initialVietnamese: vietnamese || '',
      initialCategory: category || 'Nhân vật',
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
    const vn = vietnamese.trim();

    setVietphraseMap(prev => ({
      ...prev,
      [cn]: vn,
    }));
    saveVietphraseItem(cn, vn).catch(console.error);
  };

  const deleteVietphrase = (chinese: string) => {
    const cn = chinese.trim();
    setVietphraseMap(prev => {
      const next = { ...prev };
      delete next[cn];
      return next;
    });
    deleteVietphraseItem(cn).catch(console.error);
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

  const importEntriesBatch = async (
    type: 'names' | 'vietphrase',
    entries: Array<{ chinese: string; vietnamese: string }>
  ): Promise<number> => {
    if (entries.length === 0) return 0;
    setIsImportingLargeFile(true);

    try {
      if (type === 'names') {
        const newNames: NameItem[] = entries.map((e, idx) => ({
          id: `batch-${Date.now()}-${idx}`,
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
        const merged = { ...DEFAULT_VIETPHRASE, ...vietphraseMap };
        return Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n');
      }
      case 'luatnhan': {
        const merged = { ...DEFAULT_LUAT_NHAN, ...luatNhanMap };
        return Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n');
      }
      case 'pronouns': {
        const merged = { ...DEFAULT_PRONOUNS, ...pronounsMap };
        return Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n');
      }
      case 'phienam':
        return Object.entries(CHINESE_PHIEN_AM_WORDS).map(([k, v]) => `${k}=${v}`).join('\n');
      case 'ignored':
        return ignoredPhrasesList.join('\n');
      default:
        return '';
    }
  };

  const importSingleTxt = async (dictType: DictCategoryType, content: string): Promise<number> => {
    const lines = content.split(/\r?\n/);
    let count = 0;

    if (dictType === 'ignored') {
      const phrases = lines.map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('//'));
      await saveIgnoredPhrasesBatch(phrases);
      setIgnoredPhrasesList(phrases);
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
        const items: NameItem[] = keyValBatch.map((e, idx) => ({
          id: `name-import-${Date.now()}-${idx}`,
          chinese: e.chinese,
          vietnamese: e.vietnamese,
          category: 'Nhân vật',
          note: 'Nhập từ tệp TXT',
          createdAt: Date.now(),
        }));
        await saveNamesBatch(items);
        setNamesList(prev => {
          const map = new Map<string, NameItem>();
          for (const item of prev) map.set(item.chinese, item);
          for (const item of items) map.set(item.chinese, item);
          return Array.from(map.values());
        });
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
      case 'vietphrase':
        await clearVietphraseStore();
        setVietphraseMap({});
        break;
      case 'luatnhan':
        await clearLuatNhanStore();
        setLuatNhanMap(DEFAULT_LUAT_NHAN);
        break;
      case 'pronouns':
        await clearPronounsStore();
        setPronounsMap(DEFAULT_PRONOUNS);
        break;
      case 'ignored':
        await clearIgnoredPhrasesStore();
        setIgnoredPhrasesList(DEFAULT_IGNORED_PHRASES);
        break;
    }
  };

  // Nạp toàn bộ dữ liệu gốc từ bộ asset QuickTranslator
  const loadAllQuickTranslatorAssets = async (
    onProgress?: (msg: string, percent: number) => void
  ): Promise<{ success: boolean; message: string }> => {
    try {
      onProgress?.('Đang nạp Luật Nhân & Đại Từ...', 15);
      const lnRecords = Object.entries(DEFAULT_LUAT_NHAN).map(([pattern, translation]) => ({ pattern, translation }));
      await saveLuatNhanBatch(lnRecords);
      setLuatNhanMap(DEFAULT_LUAT_NHAN);

      const proRecords = Object.entries(DEFAULT_PRONOUNS).map(([chinese, vietnamese]) => ({ chinese, vietnamese }));
      await savePronounsBatch(proRecords);
      setPronounsMap(DEFAULT_PRONOUNS);

      await saveIgnoredPhrasesBatch(DEFAULT_IGNORED_PHRASES);
      setIgnoredPhrasesList(DEFAULT_IGNORED_PHRASES);

      onProgress?.('Đang nạp Names Phụ (Names2)...', 35);
      const names2Items: NameItem[] = Object.entries(DEFAULT_NAMES2).map(([chinese, vietnamese], idx) => ({
        id: `name2-${idx}`,
        chinese,
        vietnamese,
        category: 'Nhân vật',
        note: 'Names phụ gốc QuickTranslator',
        createdAt: Date.now(),
      }));
      await saveNamesBatch(names2Items);
      setNamesList(names2Items);

      onProgress?.('Đang đọc tệp Names chính (Names.txt ~136k từ)...', 60);
      try {
        const namesRes = await fetch('/assets/aistudio/Names_537be5ed.txt');
        if (namesRes.ok) {
          const namesTxt = await namesRes.text();
          const lines = namesTxt.split(/\r?\n/);
          const batch: Array<{ chinese: string; vietnamese: string }> = [];
          for (const line of lines) {
            const eqIdx = line.indexOf('=');
            if (eqIdx > 0) {
              const cn = line.slice(0, eqIdx).trim();
              const vn = line.slice(eqIdx + 1).trim();
              if (cn && vn) batch.push({ chinese: cn, vietnamese: vn });
            }
          }
          await saveNamesMainBatch(batch);
          const map: Record<string, string> = {};
          for (const b of batch) map[b.chinese] = b.vietnamese;
          setNamesMainMap(map);
        }
      } catch (err) {
        console.warn('Could not load asset Names.txt', err);
      }

      onProgress?.('Đang đọc tệp Vietphrase cơ bản...', 85);
      try {
        const vpRes = await fetch('/assets/aistudio/Vietphrase_cho_file_g_p_ef2c75e8.txt');
        if (vpRes.ok) {
          const vpTxt = await vpRes.text();
          const lines = vpTxt.split(/\r?\n/);
          const batch: Array<{ chinese: string; vietnamese: string }> = [];
          for (const line of lines) {
            const eqIdx = line.indexOf('=');
            if (eqIdx > 0) {
              const cn = line.slice(0, eqIdx).trim();
              const vn = line.slice(eqIdx + 1).trim();
              if (cn && vn) batch.push({ chinese: cn, vietnamese: vn });
            }
          }
          await saveVietphraseBatch(batch);
          setVietphraseMap(prev => {
            const next = { ...prev };
            for (const b of batch) next[b.chinese] = b.vietnamese;
            return next;
          });
        }
      } catch (err) {
        console.warn('Could not load Vietphrase_cho_file_g_p', err);
      }

      onProgress?.('Hoàn tất nạp dữ liệu QuickTranslator!', 100);
      return { success: true, message: 'Đã nạp trọn bộ dữ liệu QuickTranslator thành công!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Lỗi khi nạp dữ liệu' };
    }
  };

  const exportAllDatabasesJson = async (): Promise<string> => {
    return exportAllDatabases();
  };

  const importAllDatabasesJson = async (jsonStr: string): Promise<{ success: boolean; message: string }> => {
    const res = await importAllDatabases(jsonStr);
    if (res.success) {
      // Refresh local state from IndexedDB
      const [names, main, vp, ln, pro, ign] = await Promise.all([
        getStoredNames(),
        getStoredNamesMain(),
        getStoredVietphrase(),
        getStoredLuatNhan(),
        getStoredPronouns(),
        getStoredIgnoredPhrases()
      ]);
      setNamesList(names);
      setNamesMainMap(main);
      setVietphraseMap(vp);
      setLuatNhanMap(ln);
      setPronounsMap(pro);
      setIgnoredPhrasesList(ign);
    }
    return res;
  };

  const exportNamesTxt = (): string => exportSingleTxt('names');
  const importNamesTxt = (content: string): number => {
    const lines = content.split(/\r?\n/);
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
    const lines = content.split(/\r?\n/);
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
        if (cn && vn) {
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

  const resetDictionaries = () => {
    setNamesList(INITIAL_NAMES);
    setVietphraseMap({});
    clearNamesStore().then(() => saveNamesBatch(INITIAL_NAMES)).catch(console.error);
    clearVietphraseStore().catch(console.error);
  };

  // Novel management handlers
  const addNovel = (book: Omit<NovelBook, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const id = `novel-${Date.now()}`;
    const newBook: NovelBook = {
      ...book,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNovelsList(prev => [newBook, ...prev]);
    return id;
  };

  const updateNovel = (id: string, updates: Partial<NovelBook>) => {
    setNovelsList(prev => prev.map(book => (book.id === id ? { ...book, ...updates, updatedAt: Date.now() } : book)));
  };

  const deleteNovel = (id: string) => {
    setNovelsList(prev => prev.filter(book => book.id !== id));
    setSavedChapters(prev => prev.filter(chap => chap.novelId !== id));
  };

  // Saved Chapters handlers
  const saveChapter = (chapter: Omit<SavedChapter, 'id' | 'savedAt'>): string => {
    const id = `chap-${Date.now()}`;
    const parsed = parseChapterHeader(chapter.title);
    const safeNovel = (chapter.novelTitle || 'Tieu_Thuyet').trim().replace(/[\\/:*?"<>|]/g, '_');
    const safeChap = (chapter.title || 'Chuong').trim().replace(/[\\/:*?"<>|]/g, '_');
    const filePath = `/local/Convert/Lib/${safeNovel}/${safeChap}.txt`;

    const newChapter: SavedChapter = {
      ...chapter,
      id,
      chapterPrefix: chapter.chapterPrefix || parsed.prefix,
      chapterName: chapter.chapterName || parsed.name,
      filePath,
      savedAt: Date.now(),
    };

    setSavedChapters(prev => [newChapter, ...prev]);

    setNovelsList(prev =>
      prev.map(b => (b.id === chapter.novelId || b.title === chapter.novelTitle ? { ...b, updatedAt: Date.now() } : b))
    );

    return id;
  };

  const deleteSavedChapter = (id: string) => {
    setSavedChapters(prev => prev.filter(chap => chap.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        readingStats,
        resetReadingStats,
        googleAccount,
        loginWithGoogle,
        logoutGoogle,
        namesList,
        addName,
        updateName,
        deleteName,
        exportNamesTxt,
        importNamesTxt,
        namesMainMap,
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
        importEntriesBatch,
        isImportingLargeFile,
        importProgress,
        setImportProgress,
        exportSingleTxt,
        importSingleTxt,
        clearSpecificStore,
        loadAllQuickTranslatorAssets,
        exportAllDatabasesJson,
        importAllDatabasesJson,
        novelsList,
        addNovel,
        updateNovel,
        deleteNovel,
        savedChapters,
        saveChapter,
        deleteSavedChapter,
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
