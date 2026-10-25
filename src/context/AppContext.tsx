/**
 * Context quản lý toàn bộ dữ liệu offline của Convert
 * 100% Offline, không yêu cầu đăng nhập.
 * Hỗ trợ IndexedDB cho từ điển dung lượng lớn (~40MB+)
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
  clearVietphraseStore 
} from '../utils/indexedDbStorage';

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

/**
 * Tách tự động tiền tố chương (Chương 30) và tên chương riêng biệt (Nguy Kịch)
 * từ header văn bản đã dịch.
 */
export function parseChapterHeader(title: string): { prefix: string; name: string; full: string } {
  if (!title) return { prefix: 'Chương 1', name: '', full: 'Chương 1' };
  const trimmed = title.trim();
  
  // Khớp các định dạng như: "Chương 30 Nguy Kịch", "Chương 30: Nguy Kịch", "Hồi 1 - Xuất thế", v.v.
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

export type AppTheme = 'dark' | 'light' | 'sepia' | 'mint' | 'amoled' | 'system';
export type AppTab = 'translate' | 'library' | 'dictionary' | 'settings';

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
  
  // Names
  namesList: NameItem[];
  addName: (chinese: string, vietnamese: string, category?: NameItem['category'], note?: string) => boolean;
  updateName: (id: string, updates: Partial<NameItem>) => void;
  deleteName: (id: string) => void;
  exportNamesTxt: () => string;
  importNamesTxt: (content: string) => number;
  
  // Vietphrase
  vietphraseMap: Record<string, string>;
  addVietphrase: (chinese: string, vietnamese: string) => void;
  deleteVietphrase: (chinese: string) => void;
  exportVietphraseTxt: () => string;
  importVietphraseTxt: (content: string) => number;
  resetDictionaries: () => void;
  
  // Thao tác xóa cụm từ chung (xóa cả trong Name và Vietphrase)
  deletePhrase: (chinese: string) => void;
  importEntriesBatch: (type: 'names' | 'vietphrase', entries: Array<{ chinese: string; vietnamese: string }>) => Promise<number>;
  isImportingLargeFile: boolean;
  importProgress: { count: number; percent: number } | null;
  setImportProgress: React.Dispatch<React.SetStateAction<{ count: number; percent: number } | null>>;

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
    description: 'Băng lãnh cùng hắc ám cùng tồn tại trong vũ trụ sâu thẳm, chín bộ rồng thi thể kéo theo một chiếc quan tài đồng xanh cổ xưa từ thời hồng hoang... Diệp Phàm cùng chúng bạn từ đỉnh Thái Sơn bị cuốn vào Bắc Đẩu tinh vực.',
    genre: 'Huyền huyễn / Thần thoại',
    createdAt: Date.now() - 800000,
    updatedAt: Date.now() - 300000,
  }
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

  // Load Names: khởi tạo từ INITIAL_NAMES, sau đó nạp từ IndexedDB
  const [namesList, setNamesList] = useState<NameItem[]>(INITIAL_NAMES);

  // Load Vietphrase
  const [vietphraseMap, setVietphraseMap] = useState<Record<string, string>>({});

  // Loading progress state for 40MB files
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
            // Seed initial names into IndexedDB
            saveNamesBatch(INITIAL_NAMES).catch(console.error);
          }
        }
      } catch (err) {
        console.error('Error loading names from IndexedDB', err);
      }

      try {
        const storedVp = await getStoredVietphrase();
        if (isMounted) {
          setVietphraseMap(storedVp || {});
        }
      } catch (err) {
        console.error('Error loading vietphrase from IndexedDB', err);
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
    return [
      {
        id: 'chap-init-1',
        novelId: 'novel-1',
        title: SAMPLE_CHAPTERS[0].chapterTitle,
        novelTitle: SAMPLE_CHAPTERS[0].bookTitle,
        originalText: SAMPLE_CHAPTERS[0].chineseContent,
        vietphraseText: '',
        savedAt: Date.now() - 50000,
      }
    ];
  });

  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('ttv_settings');
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // Reading Stats (Số sách đã đọc, tổng số phút đọc)
  const [readingStats, setReadingStats] = useState<ReadingStats>(() => {
    try {
      const stored = localStorage.getItem('ttv_reading_stats');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.totalReadBooks === 'number' && typeof parsed.totalReadMinutes === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return {
      totalReadBooks: 2,
      totalReadMinutes: 108, // 1.8 giờ
    };
  });

  const resetReadingStats = useCallback(() => {
    const zero: ReadingStats = { totalReadBooks: 0, totalReadMinutes: 0 };
    setReadingStats(zero);
    try {
      localStorage.setItem('ttv_reading_stats', JSON.stringify(zero));
    } catch {
      // ignore
    }
  }, []);

  // Google Account state
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
      isLoggedIn: true,
      email: 'readerheadless@gmail.com',
      name: 'Google Reader',
      avatarUrl: '',
    };
  });

  const loginWithGoogle = useCallback((email?: string, name?: string) => {
    const account: GoogleAccount = {
      isLoggedIn: true,
      email: email || 'readerheadless@gmail.com',
      name: name || 'Google Reader',
      avatarUrl: '',
    };
    setGoogleAccount(account);
    try {
      localStorage.setItem('ttv_google_account', JSON.stringify(account));
    } catch {
      // ignore
    }
  }, []);

  const logoutGoogle = useCallback(() => {
    const account: GoogleAccount = {
      isLoggedIn: false,
      email: '',
      name: '',
      avatarUrl: '',
    };
    setGoogleAccount(account);
    try {
      localStorage.setItem('ttv_google_account', JSON.stringify(account));
    } catch {
      // ignore
    }
  }, []);

  // Sync readingStats and googleAccount
  useEffect(() => {
    try {
      localStorage.setItem('ttv_reading_stats', JSON.stringify(readingStats));
    } catch {
      // ignore
    }
  }, [readingStats]);

  // Active translation content buffer
  const [activeRawText, setActiveRawText] = useState<string>('');
  const [activeChapterTitle, setActiveChapterTitle] = useState<string>('');
  const [activeNovelTitle, setActiveNovelTitle] = useState<string>('');
  const [activeNovelId, setActiveNovelId] = useState<string>('novel-1');

  // Inspect Modal
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

  // Sync lightweight novel and settings to localStorage (novels and chapters are small JSON)
  useEffect(() => {
    try {
      localStorage.setItem('ttv_novel_books', JSON.stringify(novelsList));
    } catch {
      // ignore
    }
  }, [novelsList]);

  useEffect(() => {
    try {
      localStorage.setItem('ttv_saved_chapters', JSON.stringify(savedChapters));
    } catch {
      // ignore
    }
  }, [savedChapters]);

  useEffect(() => {
    try {
      localStorage.setItem('ttv_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Names handlers
  const addName = (
    chinese: string,
    vietnamese: string,
    category: NameItem['category'] = 'Nhân vật',
    note: string = ''
  ): boolean => {
    const cleanChinese = chinese.trim();
    const cleanViet = vietnamese.trim();
    if (!cleanChinese || !cleanViet) return false;

    let targetItem: NameItem | null = null;

    setNamesList(prev => {
      const existingIdx = prev.findIndex(item => item.chinese === cleanChinese);
      if (existingIdx >= 0) {
        const updated = [...prev];
        targetItem = {
          ...updated[existingIdx],
          vietnamese: cleanViet,
          category,
          note: note || updated[existingIdx].note,
        };
        updated[existingIdx] = targetItem;
        return updated;
      }
      targetItem = {
        id: `name-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        chinese: cleanChinese,
        vietnamese: cleanViet,
        category,
        note,
        createdAt: Date.now(),
      };
      return [targetItem, ...prev];
    });

    if (targetItem) {
      saveNameItem(targetItem).catch(console.error);
    }
    return true;
  };

  const updateName = (id: string, updates: Partial<NameItem>) => {
    setNamesList(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          saveNameItem(updated).catch(console.error);
          return updated;
        }
        return item;
      });
      return next;
    });
  };

  const deleteName = (id: string) => {
    setNamesList(prev => prev.filter(item => item.id !== id));
    deleteNameItem(id).catch(console.error);
  };

  // Vietphrase handlers
  const addVietphrase = (chinese: string, vietnamese: string) => {
    const cn = chinese.trim();
    const vn = vietnamese.trim();
    if (!cn || !vn) return;
    setVietphraseMap(prev => ({
      ...prev,
      [cn]: vn,
    }));
    saveVietphraseItem(cn, vn).catch(console.error);
  };

  const deleteVietphrase = (chinese: string) => {
    setVietphraseMap(prev => {
      const copy = { ...prev };
      delete copy[chinese];
      return copy;
    });
    deleteVietphraseItem(chinese).catch(console.error);
  };

  // Thao tác xóa cụm từ thống nhất (được gọi từ Khung Trung Văn khi bôi đen chữ Hán)
  const deletePhrase = useCallback((chinese: string) => {
    const trimmed = chinese.trim();
    if (!trimmed) return;

    // 1. Xóa khỏi Tệp Name
    setNamesList(prev => prev.filter(n => n.chinese !== trimmed));
    deleteNameByChinese(trimmed).catch(console.error);

    // 2. Xóa khỏi Vietphrase
    setVietphraseMap(prev => {
      const copy = { ...prev };
      delete copy[trimmed];
      return copy;
    });
    deleteVietphraseItem(trimmed).catch(console.error);
  }, []);

  // Import số lượng lớn theo batch trực tiếp vào IndexedDB & RAM (cho tệp 40MB)
  const importEntriesBatch = async (
    type: 'names' | 'vietphrase',
    entries: Array<{ chinese: string; vietnamese: string }>
  ): Promise<number> => {
    if (!entries || entries.length === 0) return 0;
    setIsImportingLargeFile(true);

    try {
      if (type === 'names') {
        const newItems: NameItem[] = entries.map((e, idx) => ({
          id: `name-${Date.now()}-${idx}`,
          chinese: e.chinese,
          vietnamese: e.vietnamese,
          category: 'Nhân vật',
          note: 'Nhập từ tệp QuickTranslator',
          createdAt: Date.now(),
        }));

        // Ghi vào IndexedDB
        await saveNamesBatch(newItems);

        // Cập nhật RAM State
        setNamesList(prev => {
          const map = new Map<string, NameItem>();
          for (const item of prev) map.set(item.chinese, item);
          for (const item of newItems) map.set(item.chinese, item);
          return Array.from(map.values());
        });
      } else {
        // Vietphrase
        await saveVietphraseBatch(entries);

        setVietphraseMap(prev => {
          const next = { ...prev };
          for (const e of entries) {
            next[e.chinese] = e.vietnamese;
          }
          return next;
        });
      }

      return entries.length;
    } finally {
      setIsImportingLargeFile(false);
    }
  };

  const exportNamesTxt = (): string => {
    return namesList
      .map(item => `${item.chinese}=${item.vietnamese}`)
      .join('\n');
  };

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

  const exportVietphraseTxt = (): string => {
    const merged = { ...DEFAULT_VIETPHRASE, ...vietphraseMap };
    return Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
  };

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
    // Cập nhật lại các chương thuộc truyện này
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

    // Đồng thời cập nhật thời gian updatedAt của bộ truyện tương ứng để sắp xếp chương mới nhất
    if (chapter.novelId) {
      setNovelsList(prev => prev.map(book => 
        book.id === chapter.novelId ? { ...book, updatedAt: Date.now() } : book
      ));
    } else if (chapter.novelTitle) {
      setNovelsList(prev => prev.map(book => 
        book.title === chapter.novelTitle ? { ...book, updatedAt: Date.now() } : book
      ));
    }

    return id;
  };

  const deleteSavedChapter = (id: string) => {
    setSavedChapters(prev => prev.filter(c => c.id !== id));
  };

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  // Inspect Modal
  const openInspectModal = (
    chinese: string,
    vietnamese: string = '',
    category: NameItem['category'] = 'Nhân vật'
  ) => {
    setInspectModal({
      isOpen: true,
      initialChinese: chinese,
      initialVietnamese: vietnamese,
      initialCategory: category,
    });
  };

  const closeInspectModal = () => {
    setInspectModal(prev => ({ ...prev, isOpen: false }));
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
        vietphraseMap,
        addVietphrase,
        deleteVietphrase,
        exportVietphraseTxt,
        importVietphraseTxt,
        resetDictionaries,
        deletePhrase,
        importEntriesBatch,
        isImportingLargeFile,
        importProgress,
        setImportProgress,
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
