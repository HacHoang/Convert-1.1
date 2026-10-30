/**
 * Tab Dịch Nhanh (Translate View)
 * - Loại bỏ click tra từ ở phần Vietphrase, chỉ giữ lại ở văn bản tiếng Trung.
 * - Đồng bộ bôi đen hai chiều: Quét chọn ở Vietphrase thì phần tiếng Trung tương ứng nổi bật, và ngược lại.
 * - Tự động convert tên chương ở phần Vietphrase sang tiếng Việt chuẩn nghĩa.
 * - Rút gọn các nút chế độ xem thành dạng ICON nhỏ gọn kèm tooltip giải thích.
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useApp, parseChapterHeader, PRESET_COVERS } from '../../context/AppContext';
import { 
  convertText, 
  TranslatedToken, 
  inspectChinesePhrase, 
  reorderVietphraseMeanings, 
  cleanAndFormatSentence 
} from '../../utils/translatorEngine';
import { speechService } from '../../utils/speechEngine';
import * as mammoth from 'mammoth';
import { 
  Play, 
  Pause, 
  Square, 
  Copy, 
  Download, 
  Bookmark, 
  Trash2, 
  ClipboardPaste, 
  Columns, 
  FileText, 
  Maximize2, 
  Minimize2, 
  FileUp,
  BookmarkPlus, 
  BookOpen, 
  Search,
  CaseSensitive,
  Type,
  Plus,
  X,
  Check,
  Folder,
  AlertCircle,
  RefreshCw,
  Link2,
  Unlink2,
  Replace,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export const TranslateView: React.FC = () => {
  const {
    namesList,
    vietphraseMap,
    addVietphrase,
    settings,
    novelsList,
    addNovel,
    savedChapters,
    saveChapter,
    openInspectModal,
    activeRawText,
    setActiveRawText,
    activeChapterTitle,
    setActiveChapterTitle,
    activeNovelTitle,
    setActiveNovelTitle,
    activeNovelId,
    setActiveNovelId,
    deletePhrase,
    luatNhanMap,
    pronounsMap,
    ignoredPhrasesList,
    addIgnoredPhrase,
  } = useApp();

  const [inputChinese, setInputChinese] = useState<string>(activeRawText || '');
  const [novelTitle, setNovelTitle] = useState<string>(activeNovelTitle || 'Tiểu Thuyết');
  const [chapterTitle, setChapterTitle] = useState<string>(activeChapterTitle || 'Vietphrase');
  
  // Translation mode: 'vietphrase' | 'hanviet' | 'chinese' | 'parallel'
  const [viewMode, setViewMode] = useState<'vietphrase' | 'hanviet' | 'chinese' | 'parallel'>('vietphrase');
  
  // Toasts & UI state (Chuẩn thông báo: "Đã lưu" hoặc "Lỗi" màu đỏ)
  const [toastState, setToastState] = useState<{ message: string; isError?: boolean } | null>(null);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Modal Lưu Chương Thông Minh vào /local/Convert/Lib/[Tên Truyện]/[Tên Chương]
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveNovelId, setSaveNovelId] = useState<string>('');
  const [saveChapterPrefix, setSaveChapterPrefix] = useState<string>('Chương 1');
  const [saveChapterName, setSaveChapterName] = useState<string>('');
  const [isInlineCreateNovel, setIsInlineCreateNovel] = useState(false);
  const [inlineNovelTitle, setInlineNovelTitle] = useState('');
  const [inlineNovelAuthor, setInlineNovelAuthor] = useState('');
  const [inlineNovelGenre, setInlineNovelGenre] = useState('Huyền huyễn / Dị giới');
  const [inlineNovelCover, setInlineNovelCover] = useState(PRESET_COVERS[0]);

  // Audio Speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Đồng bộ bôi đen 2 chiều: Danh sách token IDs đang được highlight tương ứng
  const [syncedTokenIds, setSyncedTokenIds] = useState<Set<string>>(new Set());

  // Danh sách từ được người dùng chọn đổi nghĩa trong chương hiện tại
  const [tokenOverrides, setTokenOverrides] = useState<Record<string, string>>({});

  // Trạng thái làm mới bản dịch thủ công khi cập nhật từ điển/names
  const [refreshTick, setRefreshTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tùy chọn đặt làm nghĩa ưu tiên trong từ điển Vietphrase (khi chọn nghĩa thay thế)
  const [savePriorityToDict, setSavePriorityToDict] = useState<boolean>(false);

  // Selection Floating Action Bar State
  const [selectionInfo, setSelectionInfo] = useState<{
    text: string;
    source: 'chinese' | 'vietphrase' | null;
    x: number;
    y: number;
    visible: boolean;
    targetToken?: TranslatedToken;
    alternatives?: string[];
    chineseOriginal?: string;
    hanvietText?: string;
    vietphraseText?: string;
  }>({ text: '', source: null, x: 0, y: 0, visible: false });

  // Tỷ lệ phần trăm chia giữa 2 khung Trung & Vietphrase (15% - 85%)
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('ttv_split_percent');
      if (stored) {
        const val = parseFloat(stored);
        if (!isNaN(val) && val >= 15 && val <= 85) return val;
      }
    } catch {}
    return 40;
  });
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isMdScreen, setIsMdScreen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  const containerRef = useRef<HTMLDivElement>(null);
  const splitPaneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chineseTextareaRef = useRef<HTMLTextAreaElement>(null);
  const vietphraseScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<'chinese' | 'vietphrase' | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cuộn đồng bộ hai chiều (Synchronized Scrolling)
  const [isSyncScroll, setIsSyncScroll] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ttv_sync_scroll') !== 'false';
    } catch {
      return true;
    }
  });

  // Tìm và thay thế nhanh trong chương
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [saveToDictOnReplace, setSaveToDictOnReplace] = useState(true);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Tự động cuộn theo giọng đọc TTS (paragraph highlighting)
  const [activeReadingParagraphIndex, setActiveReadingParagraphIndex] = useState<number | null>(null);

  // Modal hướng dẫn phím tắt nhanh
  const [isHotkeysModalOpen, setIsHotkeysModalOpen] = useState(false);

  // Theo dõi kích thước màn hình để xác định hướng kéo (ngang hay dọc)
  useEffect(() => {
    const handleResize = () => setIsMdScreen(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Xử lý kéo thả đường kẻ tiếp xúc giữa Trung và Vietphrase
  const handleDividerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingSplit(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDividerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSplit || !splitPaneRef.current) return;
    const rect = splitPaneRef.current.getBoundingClientRect();
    const isHorizontal = window.innerWidth >= 768;

    let percent = 50;
    if (isHorizontal) {
      const offsetX = e.clientX - rect.left;
      percent = (offsetX / rect.width) * 100;
    } else {
      const offsetY = e.clientY - rect.top;
      percent = (offsetY / rect.height) * 100;
    }

    const clamped = Math.max(15, Math.min(85, Math.round(percent)));
    setSplitPercent(clamped);
  };

  const handleDividerPointerUp = (e: React.PointerEvent) => {
    if (isDraggingSplit) {
      setIsDraggingSplit(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      try {
        localStorage.setItem('ttv_split_percent', splitPercent.toString());
      } catch {}
    }
  };

  const handleDividerDoubleClick = () => {
    setSplitPercent(50);
    try {
      localStorage.setItem('ttv_split_percent', '50');
    } catch {}
    showToast('Đã đặt lại tỷ lệ chia 50:50');
  };

  // Sync activeRawText from context
  useEffect(() => {
    if (activeRawText) setInputChinese(activeRawText);
  }, [activeRawText]);

  useEffect(() => {
    if (activeChapterTitle) setChapterTitle(activeChapterTitle);
  }, [activeChapterTitle]);

  useEffect(() => {
    if (activeNovelTitle) setNovelTitle(activeNovelTitle);
  }, [activeNovelTitle]);

  // Execute Translation Engine
  const translation = useMemo(() => {
    return convertText(inputChinese, namesList, vietphraseMap, {
      prioritizeNames: settings.prioritizeNames,
      capitalizeSentences: settings.capitalizeSentences,
      customLuatNhan: luatNhanMap,
      customPronouns: pronounsMap,
      customIgnored: ignoredPhrasesList,
    });
  }, [inputChinese, namesList, vietphraseMap, luatNhanMap, pronounsMap, ignoredPhrasesList, settings.prioritizeNames, settings.capitalizeSentences, refreshTick]);

  // Tự động convert tên chương sang tiếng Việt
  const convertedChapterTitle = useMemo(() => {
    if (!chapterTitle) return '';
    const conv = convertText(chapterTitle, namesList, vietphraseMap, {
      prioritizeNames: settings.prioritizeNames,
      capitalizeSentences: settings.capitalizeSentences,
      customLuatNhan: luatNhanMap,
      customPronouns: pronounsMap,
      customIgnored: ignoredPhrasesList,
    });
    return conv.fullText || chapterTitle;
  }, [chapterTitle, namesList, vietphraseMap, luatNhanMap, pronounsMap, ignoredPhrasesList, settings.prioritizeNames, settings.capitalizeSentences, refreshTick]);

  // Toàn văn Vietphrase đã áp dụng các lựa chọn đổi nghĩa của người dùng (tokenOverrides)
  const effectiveTranslationText = useMemo(() => {
    if (Object.keys(tokenOverrides).length === 0) {
      return translation.fullText;
    }
    return translation.paragraphs
      .map(p => {
        const words = p.tokens
          .map(tok => tokenOverrides[tok.id] !== undefined ? tokenOverrides[tok.id] : tok.translated)
          .filter(w => w !== '');
        return cleanAndFormatSentence(words.join(' '));
      })
      .join('\n\n');
  }, [translation, tokenOverrides]);

  // Danh sách đoạn văn bản (paragraphs) đã áp dụng tokenOverrides dùng cho TTS tuần tự
  const effectiveParagraphs = useMemo(() => {
    return translation.paragraphs.map(p => {
      if (viewMode === 'hanviet') return p.hanviet;
      const words = p.tokens
        .map(tok => tokenOverrides[tok.id] !== undefined ? tokenOverrides[tok.id] : tok.translated)
        .filter(w => w !== '');
      return cleanAndFormatSentence(words.join(' '));
    });
  }, [translation.paragraphs, viewMode, tokenOverrides]);


  const showToast = (msg: string, isError: boolean = false) => {
    setToastState({ message: msg, isError });
    setTimeout(() => setToastState(null), 2500);
  };

  // Nút 1: Mở và dịch file văn bản (.txt và .docx)
  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const isDocx = fileName.toLowerCase().endsWith('.docx');

    setIsLoadingFile(true);
    showToast(`Đang đọc tệp ${fileName}...`);

    try {
      let extractedText = '';

      if (isDocx) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else {
        extractedText = await file.text();
      }

      if (!extractedText.trim()) {
        showToast('Tệp không có nội dung văn bản.');
        setIsLoadingFile(false);
        return;
      }

      // Tự động nhận diện tên chương từ dòng đầu tiên hoặc tên file
      const lines = extractedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let detectedTitle = '';
      if (lines.length > 0 && lines[0].length <= 70) {
        detectedTitle = lines[0];
      }
      if (!detectedTitle) {
        detectedTitle = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      }

      setInputChinese(extractedText);
      setActiveRawText(extractedText);
      setTokenOverrides({});
      setChapterTitle(detectedTitle);
      setActiveChapterTitle(detectedTitle);
      handleStopSpeech();

      showToast(`✓ Đã mở "${detectedTitle}" thành công!`);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi đọc file. Vui lòng kiểm tra lại định dạng tệp!');
    } finally {
      setIsLoadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  // Nút 2: Dán từ clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputChinese(text);
        setActiveRawText(text);
        setTokenOverrides({});
        showToast('✓ Đã dán nội dung từ Clipboard!');
      }
    } catch {
      showToast('Không thể truy cập Clipboard trình duyệt.');
    }
  };

  // Nút 3: Sao chép chương vừa dịch (kèm tiêu đề tiếng Việt đã convert)
  const handleCopyChapter = () => {
    if (!inputChinese.trim()) {
      showToast('Chưa có nội dung để sao chép!');
      return;
    }

    const currentTranslationText = viewMode === 'hanviet' ? translation.hanvietText : effectiveTranslationText;
    const displayTitle = viewMode === 'chinese' ? chapterTitle : convertedChapterTitle;
    const formattedContent = `${novelTitle ? `[Bộ truyện]: ${novelTitle}\n` : ''}${displayTitle ? `[Chương]: ${displayTitle}\n` : ''}\n------------------------------------\n\n${currentTranslationText}`;

    navigator.clipboard.writeText(formattedContent);
    showToast('✓ Đã sao chép chương vào Clipboard!');
  };

  // Nút Làm mới (Refresh) bản dịch - recalculate ngay lập tức khi vừa cập nhật từ điển/names
  const handleRefreshTranslation = () => {
    setIsRefreshing(true);
    setRefreshTick(prev => prev + 1);
    setTokenOverrides({});
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  // Nút 4: Lưu thành file văn bản (.txt)
  const handleSaveAsTxtFile = () => {
    if (!inputChinese.trim()) {
      showToast('Chưa có nội dung chương để lưu file!');
      return;
    }

    const currentTranslationText = viewMode === 'hanviet' ? translation.hanvietText : effectiveTranslationText;
    const displayTitle = viewMode === 'chinese' ? chapterTitle : convertedChapterTitle;
    const formattedContent = `${novelTitle || 'Tiểu Thuyết'}\n${displayTitle || 'Chương Dịch'}\nXuất bản ngày: ${new Date().toLocaleDateString('vi-VN')}\n====================================\n\n${currentTranslationText}`;

    const cleanTitle = (displayTitle || 'chuong_dich')
      .replace(/[^\w\s\u00C0-\u1EF9]/gi, '')
      .trim()
      .replace(/\s+/g, '_');

    const blob = new Blob([formattedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanTitle}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    showToast(`✓ Đã lưu file ${cleanTitle}.txt!`);
  };

  // Nút 5: Xóa nội dung nhập
  const handleClearInput = () => {
    setInputChinese('');
    setActiveRawText('');
    setTokenOverrides({});
    handleStopSpeech();
    setSyncedTokenIds(new Set());
    showToast('Đã xóa nội dung nhập.');
  };

  // Handle TTS với cơ chế đọc tuần tự từng đoạn tránh bị ngắt 15s và tự động cuộn
  const handleToggleSpeech = () => {
    if (isSpeaking) {
      if (isPaused) {
        speechService.resume();
        setIsPaused(false);
      } else {
        speechService.pause();
        setIsPaused(true);
      }
    } else {
      const parasToRead = effectiveParagraphs.length > 0 ? effectiveParagraphs : [effectiveTranslationText];
      if (parasToRead.length === 0 || !parasToRead[0]) return;

      speechService.speakParagraphs(parasToRead, settings.ttsRate, settings.ttsPitch, {
        onParagraphChange: (index) => {
          setActiveReadingParagraphIndex(index);
          const el = document.getElementById(`p-reader-${index}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        onStart: () => {
          setIsSpeaking(true);
          setIsPaused(false);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setIsPaused(false);
          setActiveReadingParagraphIndex(null);
        },
        onError: () => {
          setIsSpeaking(false);
          setIsPaused(false);
          setActiveReadingParagraphIndex(null);
        }
      });
    }
  };

  const handleStopSpeech = () => {
    speechService.stop();
    setIsSpeaking(false);
    setIsPaused(false);
    setActiveReadingParagraphIndex(null);
  };

  // Mở hộp thoại lưu chương thông minh vào Tủ Truyện
  const handleOpenSaveModal = () => {
    if (!inputChinese.trim()) {
      showToast('Lỗi', true);
      return;
    }

    // Tự động bóc tách số chương và tên chương từ header đã convert
    const effectiveTitle = convertedChapterTitle || chapterTitle || 'Chương 1';
    const parsed = parseChapterHeader(effectiveTitle);
    setSaveChapterPrefix(parsed.prefix);
    setSaveChapterName(parsed.name);

    // Mặc định chọn bộ truyện
    if (activeNovelId && novelsList.some(n => n.id === activeNovelId)) {
      setSaveNovelId(activeNovelId);
      setIsInlineCreateNovel(false);
    } else if (novelsList.length > 0) {
      setSaveNovelId(novelsList[0].id);
      setIsInlineCreateNovel(false);
    } else {
      setSaveNovelId('');
      setIsInlineCreateNovel(true);
      setInlineNovelTitle(novelTitle !== 'Tiểu Thuyết' ? novelTitle : '');
    }

    setIsSaveModalOpen(true);
  };

  // Xác nhận lưu chương vào thư viện
  const handleConfirmSave = () => {
    if (!inputChinese.trim()) {
      showToast('Lỗi', true);
      return;
    }

    let finalNovelId = saveNovelId;
    let finalNovelTitle = novelTitle;

    // Nếu người dùng chọn tạo bộ truyện mới ngay trong modal
    if (isInlineCreateNovel) {
      if (!inlineNovelTitle.trim()) {
        showToast('Lỗi', true);
        return;
      }

      try {
        finalNovelId = addNovel({
          title: inlineNovelTitle.trim(),
          author: inlineNovelAuthor.trim() || 'Khuyết danh',
          genre: inlineNovelGenre,
          coverUrl: inlineNovelCover,
          description: '',
        });
        finalNovelTitle = inlineNovelTitle.trim();
        setActiveNovelTitle(finalNovelTitle);
        setActiveNovelId(finalNovelId);
      } catch {
        showToast('Lỗi', true);
        return;
      }
    } else {
      const existingNovel = novelsList.find(n => n.id === saveNovelId);
      if (existingNovel) {
        finalNovelTitle = existingNovel.title;
        setActiveNovelTitle(existingNovel.title);
        setActiveNovelId(existingNovel.id);
      } else if (!saveNovelId && novelsList.length === 0) {
        showToast('Lỗi', true);
        return;
      }
    }

    const prefix = saveChapterPrefix.trim() || 'Chương';
    const name = saveChapterName.trim();
    // Tiêu đề chương luôn đi kèm tên chương bên cạnh: "Chương 30: Nguy Kịch"
    const fullChapterTitle = name ? `${prefix}: ${name}` : prefix;

    try {
      saveChapter({
        novelId: finalNovelId || undefined,
        title: fullChapterTitle,
        chapterPrefix: prefix,
        chapterName: name,
        novelTitle: finalNovelTitle,
        originalText: inputChinese,
        vietphraseText: effectiveTranslationText,
        hanvietText: translation.hanvietText,
      });

      setIsSaveModalOpen(false);
      setIsInlineCreateNovel(false);
      // Quy chuẩn thông báo khi lưu thành công: "Đã lưu" (không phát âm thanh)
      showToast('Đã lưu');
    } catch {
      // Thông báo khi lỗi: "Lỗi" màu đỏ
      showToast('Lỗi', true);
    }
  };

  // Cuộn đồng bộ hai chiều (Synchronized Scrolling) giữa ô tiếng Trung & Vietphrase
  const handleChineseScroll = () => {
    if (!isSyncScroll || isScrollingRef.current === 'vietphrase') return;
    const textarea = chineseTextareaRef.current;
    const reader = vietphraseScrollRef.current;
    if (!textarea || !reader) return;

    isScrollingRef.current = 'chinese';
    const scrollMax = textarea.scrollHeight - textarea.clientHeight;
    if (scrollMax > 0) {
      const ratio = textarea.scrollTop / scrollMax;
      reader.scrollTop = ratio * (reader.scrollHeight - reader.clientHeight);
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = null;
    }, 80);
  };

  const handleVietphraseScroll = () => {
    if (!isSyncScroll || isScrollingRef.current === 'chinese') return;
    const textarea = chineseTextareaRef.current;
    const reader = vietphraseScrollRef.current;
    if (!textarea || !reader) return;

    isScrollingRef.current = 'vietphrase';
    const scrollMax = reader.scrollHeight - reader.clientHeight;
    if (scrollMax > 0) {
      const ratio = reader.scrollTop / scrollMax;
      textarea.scrollTop = ratio * (textarea.scrollHeight - textarea.clientHeight);
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = null;
    }, 80);
  };

  // Danh sách các chương đã lưu thuộc bộ truyện hiện tại
  const currentNovelChapters = useMemo(() => {
    if (!activeNovelId) return [];
    return savedChapters
      .filter(ch => ch.novelId === activeNovelId)
      .sort((a, b) => a.savedAt - b.savedAt);
  }, [savedChapters, activeNovelId]);

  const currentChapterIndex = useMemo(() => {
    if (currentNovelChapters.length === 0) return -1;
    return currentNovelChapters.findIndex(
      ch => ch.title === chapterTitle || ch.chapterName === chapterTitle || ch.chapterPrefix === chapterTitle
    );
  }, [currentNovelChapters, chapterTitle]);

  const handlePrevChapter = useCallback(() => {
    if (currentNovelChapters.length > 0 && currentChapterIndex > 0) {
      const prevCh = currentNovelChapters[currentChapterIndex - 1];
      setInputChinese(prevCh.originalText);
      setChapterTitle(prevCh.title);
      setActiveChapterTitle(prevCh.title);
      setActiveRawText(prevCh.originalText);
      setTokenOverrides({});
      showToast(`Đã mở: ${prevCh.title}`);
      return;
    }

    // Tự động nhận diện và giảm số chương nếu chưa lưu
    const match = chapterTitle.match(/(Chương|第)\s*(\d+)/i);
    if (match) {
      const num = parseInt(match[2], 10);
      if (num > 1) {
        const newTitle = chapterTitle.replace(match[0], `${match[1]} ${num - 1}`);
        setChapterTitle(newTitle);
        setActiveChapterTitle(newTitle);
        showToast(`Đã chuyển: ${newTitle}`);
      } else {
        showToast('Đây là chương đầu tiên', true);
      }
    } else {
      showToast('Không có chương trước', true);
    }
  }, [currentNovelChapters, currentChapterIndex, chapterTitle, setActiveChapterTitle, setActiveRawText]);

  const handleNextChapter = useCallback(() => {
    if (currentNovelChapters.length > 0 && currentChapterIndex >= 0 && currentChapterIndex < currentNovelChapters.length - 1) {
      const nextCh = currentNovelChapters[currentChapterIndex + 1];
      setInputChinese(nextCh.originalText);
      setChapterTitle(nextCh.title);
      setActiveChapterTitle(nextCh.title);
      setActiveRawText(nextCh.originalText);
      setTokenOverrides({});
      showToast(`Đã mở: ${nextCh.title}`);
      return;
    }

    // Tự động tăng số chương
    const match = chapterTitle.match(/(Chương|第)\s*(\d+)/i);
    if (match) {
      const num = parseInt(match[2], 10);
      const newTitle = chapterTitle.replace(match[0], `${match[1]} ${num + 1}`);
      setChapterTitle(newTitle);
      setActiveChapterTitle(newTitle);
      showToast(`Sẵn sàng cho: ${newTitle}`);
    } else {
      const newTitle = 'Chương 2';
      setChapterTitle(newTitle);
      setActiveChapterTitle(newTitle);
      showToast(`Sẵn sàng cho: ${newTitle}`);
    }
  }, [currentNovelChapters, currentChapterIndex, chapterTitle, setActiveChapterTitle, setActiveRawText]);

  // Tìm và thay thế
  const findMatches = useMemo(() => {
    if (!findQuery.trim()) return [];
    const matches: number[] = [];
    let pos = 0;
    while ((pos = inputChinese.indexOf(findQuery, pos)) !== -1) {
      matches.push(pos);
      pos += findQuery.length || 1;
    }
    return matches;
  }, [inputChinese, findQuery]);

  const highlightChineseMatch = (startIndex: number, length: number) => {
    const textarea = chineseTextareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(startIndex, startIndex + length);
      const lineCount = inputChinese.substring(0, startIndex).split('\n').length;
      const totalLines = inputChinese.split('\n').length;
      if (totalLines > 0) {
        textarea.scrollTop = (lineCount / totalLines) * textarea.scrollHeight - textarea.clientHeight / 2;
      }
    }
  };

  const handleNextMatch = () => {
    if (findMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % findMatches.length;
    setCurrentMatchIndex(nextIdx);
    highlightChineseMatch(findMatches[nextIdx], findQuery.length);
  };

  const handlePrevMatch = () => {
    if (findMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + findMatches.length) % findMatches.length;
    setCurrentMatchIndex(prevIdx);
    highlightChineseMatch(findMatches[prevIdx], findQuery.length);
  };

  const handleReplaceOne = () => {
    if (!findQuery.trim() || findMatches.length === 0) {
      showToast('Không tìm thấy từ cần thay thế', true);
      return;
    }
    const targetPos = findMatches[currentMatchIndex] ?? findMatches[0];
    const newText = inputChinese.slice(0, targetPos) + replaceQuery + inputChinese.slice(targetPos + findQuery.length);
    setInputChinese(newText);
    setActiveRawText(newText);

    if (saveToDictOnReplace && replaceQuery.trim()) {
      addVietphrase(findQuery.trim(), replaceQuery.trim());
    }
    showToast(`Đã thay thế "${findQuery}"`);
  };

  const handleReplaceAll = () => {
    if (!findQuery.trim()) {
      showToast('Vui lòng nhập từ cần tìm', true);
      return;
    }
    const count = findMatches.length;
    if (count === 0) {
      showToast('Không tìm thấy kết quả phù hợp', true);
      return;
    }
    const newText = inputChinese.split(findQuery).join(replaceQuery);
    setInputChinese(newText);
    setActiveRawText(newText);

    if (saveToDictOnReplace && replaceQuery.trim()) {
      addVietphrase(findQuery.trim(), replaceQuery.trim());
    }
    showToast(`Đã thay thế tất cả ${count} vị trí`);
  };

  // Hệ thống phím tắt nhanh (Hotkeys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 's') {
          e.preventDefault();
          handleOpenSaveModal();
        } else if (key === 'c') {
          e.preventDefault();
          handleCopyChapter();
        } else if (key === 'r') {
          e.preventDefault();
          handleRefreshTranslation();
        } else if (key === 'f') {
          e.preventDefault();
          setIsFindReplaceOpen(prev => !prev);
        } else if (key === 'k') {
          e.preventDefault();
          setIsSyncScroll(prev => {
            const next = !prev;
            try { localStorage.setItem('ttv_sync_scroll', String(next)); } catch {}
            showToast(next ? 'Đã bật cuộn đồng bộ' : 'Đã tắt cuộn đồng bộ');
            return next;
          });
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevChapter();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextChapter();
        } else if (key === 'p') {
          e.preventDefault();
          handleToggleSpeech();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePrevChapter, 
    handleNextChapter, 
    handleToggleSpeech,
    inputChinese, 
    chapterTitle, 
    novelTitle, 
    viewMode, 
    translation, 
    effectiveTranslationText
  ]);

  // Chỉ gọi tra cứu khi click từ ở tiếng Trung
  const handleChineseTokenClick = (tok: TranslatedToken) => {
    if (tok.isPunctuation) return;
    openInspectModal(tok.original, tok.translated, tok.category as any || (tok.isName ? 'Nhân vật' : 'Khác'));
  };

  // Đồng bộ bôi đen hai chiều (Bidirectional Highlighting) & Nhận diện đa nghĩa
  const handleTextSelection = (source: 'chinese' | 'vietphrase') => {
    const ta = chineseTextareaRef.current;
    let selectedText = '';
    let selStart = -1;
    let selEnd = -1;
    let rectX = window.innerWidth / 2;
    let rectY = 100;

    if (source === 'chinese' && ta && ta.selectionStart !== ta.selectionEnd) {
      selStart = ta.selectionStart;
      selEnd = ta.selectionEnd;
      selectedText = ta.value.substring(selStart, selEnd).trim();
      const taRect = ta.getBoundingClientRect();
      rectX = Math.max(20, Math.min(window.innerWidth - 200, taRect.left + taRect.width / 2));
      rectY = Math.max(70, taRect.top + 30);
    } else {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionInfo(prev => ({ ...prev, visible: false }));
        setSyncedTokenIds(new Set());
        return;
      }
      selectedText = selection.toString().trim();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        rectX = rect.left + rect.width / 2;
        rectY = rect.top - 10;
      }
    }

    if (!selectedText || selectedText.length < 1) {
      setSelectionInfo(prev => ({ ...prev, visible: false }));
      setSyncedTokenIds(new Set());
      return;
    }

    // Tìm các token tương ứng với đoạn vừa bôi đen
    const matchedTokenIds = new Set<string>();
    let targetTok: TranslatedToken | undefined = undefined;

    if (source === 'vietphrase') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // 1. Quét các phần tử span[data-token-id] giao thoa TRỰC TIẾP với vùng bôi đen (selection range)
        try {
          const ancestor = range.commonAncestorContainer;
          const containerEl = ancestor instanceof HTMLElement ? ancestor : ancestor.parentElement;
          if (containerEl) {
            const spans = containerEl.querySelectorAll<HTMLElement>('[data-token-id]');
            spans.forEach(span => {
              if (selection.containsNode(span, true)) {
                const tId = span.dataset.tokenId;
                if (tId) matchedTokenIds.add(tId);
              }
            });
          }
        } catch {}

        // 2. Nếu selection nằm hoàn toàn bên trong 1 token duy nhất
        if (matchedTokenIds.size === 0) {
          let currNode: Node | null = selection.anchorNode;
          while (currNode && currNode !== document.body) {
            if (currNode instanceof HTMLElement && currNode.dataset && currNode.dataset.tokenId) {
              matchedTokenIds.add(currNode.dataset.tokenId);
              break;
            }
            currNode = currNode.parentNode;
          }
          if (matchedTokenIds.size === 0 && selection.focusNode) {
            currNode = selection.focusNode;
            while (currNode && currNode !== document.body) {
              if (currNode instanceof HTMLElement && currNode.dataset && currNode.dataset.tokenId) {
                matchedTokenIds.add(currNode.dataset.tokenId);
                break;
              }
              currNode = currNode.parentNode;
            }
          }
        }
      }

      // 3. Fallback: Nếu không có thẻ span nào bắt được
      if (matchedTokenIds.size === 0) {
        const cleanSel = selectedText.trim().toLowerCase().replace(/\s+/g, ' ');
        for (let i = 0; i < translation.tokens.length; i++) {
          let accum = '';
          const candidateGroup: string[] = [];
          for (let j = i; j < Math.min(i + 8, translation.tokens.length); j++) {
            const tok = translation.tokens[j];
            if (tok.isPunctuation) continue;
            const currentVal = (tokenOverrides[tok.id] !== undefined ? tokenOverrides[tok.id] : tok.translated).trim().toLowerCase();
            accum = accum ? `${accum} ${currentVal}` : currentVal;
            candidateGroup.push(tok.id);
            if (accum === cleanSel || accum.replace(/\s+/g, '') === cleanSel.replace(/\s+/g, '')) {
              candidateGroup.forEach(id => matchedTokenIds.add(id));
              break;
            }
          }
          if (matchedTokenIds.size > 0) break;
        }
      }

      if (matchedTokenIds.size > 0) {
        const firstId = Array.from(matchedTokenIds)[0];
        targetTok = translation.tokens.find(t => t.id === firstId);

        // ĐỒNG BỘ 2 CHIỀU: Tự động bôi đen chính xác chữ Hán trong ô tiếng Trung!
        const ordered = translation.tokens.filter(t => matchedTokenIds.has(t.id));
        const starts = ordered.map(t => t.charStart).filter((n): n is number => n !== undefined);
        const ends = ordered.map(t => t.charEnd).filter((n): n is number => n !== undefined);
        if (starts.length > 0 && ends.length > 0 && chineseTextareaRef.current) {
          const minS = Math.min(...starts);
          const maxE = Math.max(...ends);
          chineseTextareaRef.current.focus();
          chineseTextareaRef.current.setSelectionRange(minS, maxE);
        }
      }
    } else {
      // Người dùng bôi đen ở tiếng Trung:
      if (selStart !== -1 && selEnd !== -1) {
        // Khớp chuẩn xác theo vị trí ký tự charStart / charEnd trong ô soạn thảo!
        for (const tok of translation.tokens) {
          if (tok.charStart !== undefined && tok.charEnd !== undefined) {
            if (tok.charStart < selEnd && tok.charEnd > selStart) {
              matchedTokenIds.add(tok.id);
              if (!targetTok && !tok.isPunctuation) {
                targetTok = tok;
              }
            }
          }
        }
      }

      // Fallback theo chuỗi ký tự liền kề
      if (matchedTokenIds.size === 0) {
        const cleanCn = selectedText.trim().replace(/\s+/g, '');
        for (let i = 0; i < translation.tokens.length; i++) {
          let accum = '';
          const candidateGroup: string[] = [];
          for (let j = i; j < Math.min(i + 10, translation.tokens.length); j++) {
            const tok = translation.tokens[j];
            accum += tok.original;
            candidateGroup.push(tok.id);
            if (accum === cleanCn) {
              candidateGroup.forEach(id => matchedTokenIds.add(id));
              targetTok = translation.tokens[i];
              break;
            }
          }
          if (matchedTokenIds.size > 0) break;
        }
      }
    }

    setSyncedTokenIds(matchedTokenIds);

    // Trích xuất chữ Hán gốc tương ứng, nghĩa Vietphrase và tên Hán Việt viết hoa
    const orderedMatched = translation.tokens.filter(t => matchedTokenIds.has(t.id));
    let derivedChinese = '';
    let derivedHanviet = '';
    let derivedVietphrase = '';

    if (orderedMatched.length > 0) {
      derivedChinese = orderedMatched.map(t => t.original).join('');
      derivedVietphrase = orderedMatched
        .map(t => (tokenOverrides[t.id] !== undefined ? tokenOverrides[t.id] : t.translated).trim())
        .filter(Boolean)
        .join(' ');
      derivedHanviet = orderedMatched
        .map(t => {
          if (t.hanviet) {
            return t.hanviet
              .trim()
              .split(/\s+/)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
          }
          return '';
        })
        .filter(Boolean)
        .join(' ');
    } else {
      derivedChinese = selectedText;
      const lookup = inspectChinesePhrase(selectedText, namesList, vietphraseMap);
      derivedVietphrase = lookup.existingVp || lookup.suggestedVietnamese || '';
      derivedHanviet = lookup.hanviet
        ? lookup.hanviet
            .trim()
            .split(/\s+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        : '';
    }

    // Tính danh sách nghĩa thay thế (khác nghĩa đang hiển thị)
    let availableAlternatives: string[] | undefined = undefined;
    if (targetTok && targetTok.alternatives && targetTok.alternatives.length > 1) {
      const currentMeaning = tokenOverrides[targetTok.id] !== undefined ? tokenOverrides[targetTok.id] : targetTok.translated;
      availableAlternatives = targetTok.alternatives.filter(
        alt => alt.trim().toLowerCase() !== currentMeaning.trim().toLowerCase()
      );
    }

    setSelectionInfo({
      text: selectedText,
      source,
      x: rectX,
      y: rectY,
      visible: true,
      targetToken: targetTok,
      alternatives: availableAlternatives,
      chineseOriginal: derivedChinese || undefined,
      hanvietText: derivedHanviet || undefined,
      vietphraseText: derivedVietphrase || undefined,
    });
  };

  // Thay thế từ đang chọn bằng một nghĩa khác trong Vietphrase
  const handleSelectAlternativeMeaning = (tok: TranslatedToken, altMeaning: string) => {
    setTokenOverrides(prev => ({
      ...prev,
      [tok.id]: altMeaning,
    }));

    if (savePriorityToDict && tok.original) {
      const raw = tok.rawVietphrase || vietphraseMap[tok.original] || (tok.alternatives ? tok.alternatives.join('/') : '');
      const reordered = reorderVietphraseMeanings(raw, altMeaning);
      addVietphrase(tok.original, reordered);
      showToast(`✓ Đã đổi sang "${altMeaning}" & lưu thứ tự ưu tiên vào từ điển!`);
    } else {
      showToast(`✓ Đã đổi sang "${altMeaning}"`);
    }

    setSelectionInfo(prev => ({ ...prev, visible: false }));
    setSyncedTokenIds(new Set());
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  };

  // Dismiss selection menu when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#selection-bubble-toolbar')) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setSelectionInfo(prev => ({ ...prev, visible: false }));
          setSyncedTokenIds(new Set());
        }
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  const fontClass = settings.fontFamily === 'serif' ? 'font-serif' : 'font-sans';

  const readerThemeClasses = useMemo(() => {
    let activeTheme = settings.theme;
    if (activeTheme === 'system') {
      const isSystemDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const currentHour = new Date().getHours();
      const isNightTime = currentHour < 6 || currentHour >= 18;
      activeTheme = (isSystemDark || isNightTime) ? 'dark' : 'light';
    }

    switch (activeTheme) {
      case 'light':
        return {
          bg: 'bg-white',
          text: 'text-[#1a1a1a]',
          subtext: 'text-neutral-500',
          border: 'border-slate-200',
          card: 'bg-slate-50 border-slate-200 text-[#1a1a1a]',
          bar: 'bg-[#f9fafb] border-slate-200 text-[#1a1a1a]',
          btn: 'bg-white hover:bg-slate-100 text-[#1a1a1a] border-slate-300',
          pText: 'text-[#1a1a1a]',
        };
      case 'sepia':
        return {
          bg: 'bg-[#fbf0d9]',
          text: 'text-[#4a3525]',
          subtext: 'text-[#6e553f]',
          border: 'border-[#dfcfa8]',
          card: 'bg-[#f2e4c4] border-[#dfcfa8] text-[#4a3525]',
          bar: 'bg-[#f2e4c4] border-[#dfcfa8] text-[#4a3525]',
          btn: 'bg-[#ede2cb] hover:bg-[#e4d6be] text-[#4a3525] border-[#dfcfa8]',
          pText: 'text-[#4a3525]',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-[#121212]',
          text: 'text-[#f4f4f5]',
          subtext: 'text-neutral-400',
          border: 'border-[#2e2e2e]',
          card: 'bg-[#1e1e1e] border-[#2e2e2e] text-[#f4f4f5]',
          bar: 'bg-[#1e1e1e] border-[#2e2e2e] text-[#f4f4f5]',
          btn: 'bg-[#252525] hover:bg-[#2d2d2d] text-[#f4f4f5] border-[#383838]',
          pText: 'text-[#f4f4f5]',
        };
    }
  }, [settings.theme]);

  const isLight = settings.theme === 'light';
  const isSepia = settings.theme === 'sepia';

  return (
    <div 
      ref={containerRef}
      className={`flex-1 flex flex-col h-full overflow-hidden relative transition-colors duration-150 ${readerThemeClasses.bg} ${readerThemeClasses.text}`}
    >
      {/* Hidden File Input for .txt and .docx */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".txt,.docx,.doc,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Toast Notification Banner - Hỗ trợ chuẩn thông báo "Đã lưu" hoặc "Lỗi" màu đỏ */}
      {toastState && (
        <div 
          className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 text-xs py-1.5 px-4 rounded-full shadow-xl border animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none flex items-center gap-1.5 ${
            toastState.isError
              ? 'bg-neutral-900/95 text-rose-500 border-rose-500/80 font-bold ring-1 ring-rose-500/50 shadow-rose-950/50'
              : 'bg-neutral-900/95 text-emerald-400 border-emerald-500/60 font-medium ring-1 ring-emerald-500/40 shadow-emerald-950/40'
          }`}
        >
          {toastState.isError && <AlertCircle size={14} className="text-rose-500 shrink-0" />}
          <span className={toastState.isError ? 'text-rose-500 font-bold tracking-wide' : 'text-emerald-400 font-semibold'}>
            {toastState.message}
          </span>
        </div>
      )}

      {/* Floating Selection Tooltip Toolbar for Highlighted Words */}
      {selectionInfo.visible && (
        <div
          id="selection-bubble-toolbar"
          style={{
            position: 'fixed',
            left: `${Math.max(10, Math.min(window.innerWidth - 380, selectionInfo.x - 190))}px`,
            top: `${Math.max(60, selectionInfo.y - (selectionInfo.alternatives && selectionInfo.alternatives.length > 0 ? 115 : 45))}px`,
            zIndex: 60,
          }}
          className="flex flex-col gap-1.5 p-1.5 bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl text-xs backdrop-blur-md animate-in zoom-in-95 duration-100 max-w-[420px]"
        >
          {/* Khối tùy chọn chọn nghĩa thay thế từ Vietphrase */}
          {selectionInfo.alternatives && selectionInfo.alternatives.length > 0 && selectionInfo.targetToken && (
            <div className="flex flex-col gap-1.5 p-2 bg-neutral-950/80 rounded-lg border border-neutral-800">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-cyan-400 font-semibold">
                  Nghĩa thay thế:
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-neutral-300 hover:text-white select-none">
                  <input
                    type="checkbox"
                    checked={savePriorityToDict}
                    onChange={e => setSavePriorityToDict(e.target.checked)}
                    className="rounded border-neutral-700 bg-neutral-800 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Đặt làm nghĩa ưu tiên trong từ điển</span>
                </label>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {selectionInfo.alternatives.map((altMeaning, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectionInfo.targetToken && handleSelectAlternativeMeaning(selectionInfo.targetToken, altMeaning)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-neutral-800 hover:bg-cyan-600 hover:text-white text-cyan-300 border border-neutral-700 hover:border-cyan-500 transition-colors shadow-2xs"
                    title={`Chọn "${altMeaning}"${savePriorityToDict ? ' và đặt làm nghĩa ưu tiên trong từ điển' : ''}`}
                  >
                    {altMeaning}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hàng nút công cụ thao tác */}
          <div className="flex items-center gap-1">
            <span 
              className="font-serif px-2 py-0.5 text-cyan-300 font-semibold max-w-32 truncate border-r border-neutral-800"
              title={selectionInfo.chineseOriginal ? `Gốc: ${selectionInfo.chineseOriginal} | Đang chọn: ${selectionInfo.text}` : selectionInfo.text}
            >
              {selectionInfo.chineseOriginal || selectionInfo.text}
            </span>

            <button
              onClick={() => {
                const targetCn = selectionInfo.chineseOriginal || selectionInfo.text;
                const cleanVn = selectionInfo.source === 'vietphrase' ? selectionInfo.text.replace(/\s+/g, ' ').trim() : '';
                const targetVn = cleanVn || selectionInfo.hanvietText || selectionInfo.vietphraseText || '';
                openInspectModal(targetCn, targetVn, 'Nhân vật');
                setSelectionInfo(prev => ({ ...prev, visible: false }));
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
              title="Thêm từ đang chọn vào Tệp Name"
            >
              <BookmarkPlus size={13} />
              <span>+ Name</span>
            </button>

            <button
              onClick={() => {
                const targetCn = selectionInfo.chineseOriginal || selectionInfo.text;
                const cleanVn = selectionInfo.source === 'vietphrase' 
                  ? selectionInfo.text.replace(/\s+/g, ' ').trim() 
                  : (selectionInfo.vietphraseText || '');
                const targetVn = cleanVn.toLowerCase();
                openInspectModal(targetCn, targetVn, 'Khác');
                setSelectionInfo(prev => ({ ...prev, visible: false }));
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors"
              title="Thêm vào từ điển Vietphrase"
            >
              <BookOpen size={13} />
              <span>+ Vietphrase</span>
            </button>

            <button
              onClick={() => {
                const targetCn = selectionInfo.chineseOriginal || selectionInfo.text;
                addIgnoredPhrase(targetCn);
                showToast(`Đã thêm "${targetCn}" vào Tệp Bỏ qua`);
                setSelectionInfo(prev => ({ ...prev, visible: false }));
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-amber-900/60 text-amber-300 hover:text-white rounded-lg font-medium transition-colors"
              title="Thêm vào Tệp Bỏ qua (IgnoreChinesephrase.txt)"
            >
              <span>+ Bỏ qua</span>
            </button>

            <button
              onClick={() => {
                const targetCn = selectionInfo.chineseOriginal || selectionInfo.text;
                deletePhrase(targetCn);
                showToast(`Đã xóa cụm "${targetCn}" khỏi từ điển`);
                setSelectionInfo(prev => ({ ...prev, visible: false }));
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-rose-900/70 text-rose-300 hover:text-white rounded-lg font-medium transition-colors border border-transparent hover:border-rose-700/60"
              title="Xóa cụm từ này khỏi Tệp Name hoặc Vietphrase"
            >
              <Trash2 size={13} />
              <span>Xóa từ</span>
            </button>

            <button
              onClick={() => {
                const targetCn = selectionInfo.chineseOriginal || selectionInfo.text;
                const lookup = inspectChinesePhrase(targetCn, namesList, vietphraseMap);
                showToast(`HV: ${lookup.hanviet} | Pinyin: ${lookup.pinyin}`);
                setSelectionInfo(prev => ({ ...prev, visible: false }));
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              title="Tra Hán Việt & Pinyin"
            >
              <Search size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Top Controls Bar - Toàn bộ các nút dạng ICON siêu nhỏ gọn */}
      <div className={`shrink-0 p-2.5 px-3 border-b flex items-center justify-between gap-2 text-xs transition-colors ${readerThemeClasses.bar}`}>
        {/* Nhóm 1: 6 nút chức năng (Mở file, Dán, Copy, Làm mới, Tải file, Xóa) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={handleTriggerFileInput}
            disabled={isLoadingFile}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-cyan-600 hover:text-white text-cyan-400 border border-neutral-700 hover:border-cyan-500 flex items-center justify-center transition-all shadow-2xs group"
            title="Mở tệp (.txt, .docx)"
            aria-label="Mở tệp"
          >
            <FileUp size={15} className={isLoadingFile ? 'animate-bounce text-cyan-400' : 'group-hover:scale-105 transition-transform'} />
          </button>

          <button
            onClick={handlePasteClipboard}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-cyan-600 hover:text-white text-neutral-300 border border-neutral-700 hover:border-cyan-500 flex items-center justify-center transition-all shadow-2xs group"
            title="Dán từ clipboard"
            aria-label="Dán từ clipboard"
          >
            <ClipboardPaste size={15} className="text-cyan-400 group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={handleCopyChapter}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-cyan-600 hover:text-white text-neutral-300 border border-neutral-700 hover:border-cyan-500 flex items-center justify-center transition-all shadow-2xs group"
            title="Sao chép bản dịch"
            aria-label="Sao chép bản dịch"
          >
            <Copy size={15} className="text-cyan-400 group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={handleRefreshTranslation}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-cyan-600 hover:text-white text-neutral-300 border border-neutral-700 hover:border-cyan-500 flex items-center justify-center transition-all shadow-2xs group"
            title="Làm mới bản dịch"
            aria-label="Làm mới bản dịch"
          >
            <RefreshCw 
              size={14} 
              className={`text-cyan-400 group-hover:text-white transition-all ${
                isRefreshing ? 'animate-spin text-white' : 'group-hover:rotate-45'
              }`} 
            />
          </button>

          <button
            onClick={handleSaveAsTxtFile}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-emerald-600 hover:text-white text-neutral-300 border border-neutral-700 hover:border-emerald-500 flex items-center justify-center transition-all shadow-2xs group"
            title="Tải về file .txt"
            aria-label="Tải về file .txt"
          >
            <Download size={15} className="text-emerald-400 group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={handleClearInput}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-rose-900/60 hover:text-rose-300 text-neutral-400 border border-neutral-700 hover:border-rose-600 flex items-center justify-center transition-all shadow-2xs"
            title="Xóa nội dung"
            aria-label="Xóa nội dung"
          >
            <Trash2 size={14} />
          </button>

          {/* Nút Tìm và thay thế nhanh */}
          <button
            onClick={() => setIsFindReplaceOpen(v => !v)}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all shadow-2xs group ${
              isFindReplaceOpen 
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-cyan-900/30' 
                : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700 hover:text-white'
            }`}
            title="Tìm & Thay thế nhanh trong chương (Alt+F)"
            aria-label="Tìm và thay thế"
          >
            <Replace size={15} />
          </button>

          {/* Nút Cuộn đồng bộ hai chiều */}
          <button
            onClick={() => {
              setIsSyncScroll(prev => {
                const next = !prev;
                try { localStorage.setItem('ttv_sync_scroll', String(next)); } catch {}
                showToast(next ? 'Đã bật cuộn đồng bộ' : 'Đã tắt cuộn đồng bộ');
                return next;
              });
            }}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all shadow-2xs group ${
              isSyncScroll
                ? 'bg-cyan-600/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-600/30'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
            }`}
            title={isSyncScroll ? "Cuộn đồng bộ 2 khung: BẬT (Alt+K)" : "Cuộn đồng bộ 2 khung: TẮT (Alt+K)"}
            aria-label="Cuộn đồng bộ"
          >
            {isSyncScroll ? <Link2 size={15} /> : <Unlink2 size={15} />}
          </button>

          {/* Nút Hướng dẫn phím tắt */}
          <button
            onClick={() => setIsHotkeysModalOpen(true)}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border border-neutral-700 flex items-center justify-center transition-all shadow-2xs"
            title="Phím tắt nhanh (Hotkeys)"
            aria-label="Phím tắt nhanh"
          >
            <Keyboard size={15} />
          </button>
        </div>

        {/* Chuyển chương trước / tiếp */}
        <div className="flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 rounded-lg p-0.5 px-1 shadow-2xs">
          <button
            onClick={handlePrevChapter}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-cyan-400 transition-colors"
            title="Chương trước (Alt+←)"
            aria-label="Chương trước"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="text-[11px] font-medium px-1.5 py-0.5 text-neutral-300 max-w-[120px] sm:max-w-[180px] truncate select-none text-center">
            {currentNovelChapters.length > 0 && currentChapterIndex >= 0 ? (
              <span title={chapterTitle}>
                Chương {currentChapterIndex + 1}/{currentNovelChapters.length}
              </span>
            ) : (
              <span title={chapterTitle || 'Chương'}>
                {chapterTitle ? (chapterTitle.length > 15 ? chapterTitle.slice(0, 15) + '...' : chapterTitle) : 'Chương'}
              </span>
            )}
          </div>

          <button
            onClick={handleNextChapter}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-cyan-400 transition-colors"
            title="Chương tiếp theo (Alt+→)"
            aria-label="Chương tiếp"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Nhóm 2: 3 nút chế độ xem rút gọn thành ICON nhỏ gọn kèm tooltip khi giữ/rê chuột */}
        <div className="flex items-center p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 shrink-0 gap-0.5">
          {/* Nút 1: Vietphrase */}
          <button
            onClick={() => setViewMode('vietphrase')}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all relative group ${
              viewMode === 'vietphrase' 
                ? 'bg-cyan-600 text-white shadow-xs font-semibold' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
            title="Vietphrase"
            aria-label="Chế độ Vietphrase"
          >
            <BookOpen size={15} />
          </button>

          {/* Nút 2: Hán Việt */}
          <button
            onClick={() => setViewMode('hanviet')}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all relative group ${
              viewMode === 'hanviet' 
                ? 'bg-cyan-600 text-white shadow-xs font-semibold' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
            title="Hán Việt"
            aria-label="Chế độ Hán Việt"
          >
            <CaseSensitive size={17} />
          </button>

          {/* Nút 3: Song Song */}
          <button
            onClick={() => setViewMode('parallel')}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all relative group ${
              viewMode === 'parallel' 
                ? 'bg-cyan-600 text-white shadow-xs font-semibold' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
            title="Song song"
            aria-label="Chế độ Song song"
          >
            <Columns size={15} />
          </button>
        </div>
      </div>

      {/* Find & Replace Collapsible Panel */}
      {isFindReplaceOpen && (
        <div className="p-2.5 px-4 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2.5 text-xs animate-in slide-in-from-top-1 duration-150 shadow-md">
          <div className="flex flex-wrap items-center gap-2">
            {/* Find Input */}
            <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1">
              <Search size={14} className="text-neutral-500" />
              <input
                type="text"
                placeholder="Tìm từ/tiếng Trung..."
                value={findQuery}
                onChange={(e) => {
                  setFindQuery(e.target.value);
                  setCurrentMatchIndex(0);
                }}
                className="bg-transparent text-neutral-200 placeholder-neutral-500 outline-none text-xs w-32 sm:w-44"
              />
              {findQuery && (
                <span className="text-[10px] text-neutral-400 px-1 font-mono">
                  {findMatches.length > 0 ? `${currentMatchIndex + 1}/${findMatches.length}` : '0'}
                </span>
              )}
              <button
                onClick={handlePrevMatch}
                disabled={findMatches.length === 0}
                className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30"
                title="Vị trí trước"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={handleNextMatch}
                disabled={findMatches.length === 0}
                className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30"
                title="Vị trí tiếp"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Replace Input */}
            <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1">
              <Replace size={14} className="text-neutral-500" />
              <input
                type="text"
                placeholder="Thay thế bằng..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="bg-transparent text-neutral-200 placeholder-neutral-500 outline-none text-xs w-32 sm:w-44"
              />
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleReplaceOne}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors font-medium"
            >
              Thay thế
            </button>
            <button
              onClick={handleReplaceAll}
              className="px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white transition-colors font-medium shadow-2xs"
            >
              Thay tất cả
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Option to save to Vietphrase dictionary */}
            <label className="flex items-center gap-1.5 cursor-pointer text-neutral-400 hover:text-neutral-200 select-none">
              <input
                type="checkbox"
                checked={saveToDictOnReplace}
                onChange={(e) => setSaveToDictOnReplace(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="text-[11px]">Lưu vào từ điển Vietphrase</span>
            </label>

            <button
              onClick={() => setIsFindReplaceOpen(false)}
              className="p-1 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800"
              title="Đóng thanh tìm kiếm"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Split (Input & Reader) với thanh kéo thả điều chỉnh kích thước */}
      <div 
        ref={splitPaneRef} 
        className={`flex-1 flex flex-col md:flex-row overflow-hidden relative ${
          isDraggingSplit ? 'select-none cursor-col-resize md:cursor-col-resize' : ''
        }`}
      >
        {/* Left / Top: Khung Trung */}
        {!isReadingMode && (
           <div 
             style={{
               width: isMdScreen ? `${splitPercent}%` : '100%',
               height: !isMdScreen ? `${splitPercent}%` : '100%',
             }}
             className={`shrink-0 flex flex-col overflow-hidden transition-colors ${
               isLight ? 'bg-neutral-50/90 border-r border-slate-200' : isSepia ? 'bg-[#f4e6ca]/90 border-r border-[#dfcfa8]' : 'bg-neutral-900/60'
             }`}
           >
            <div className={`p-2 px-3 border-b flex items-center justify-between text-xs transition-colors ${
              isLight ? 'bg-neutral-100/90 border-slate-200 text-neutral-600' : isSepia ? 'bg-[#ede0c8] border-[#dfcfa8] text-[#4a3525]' : 'bg-neutral-900/90 border-neutral-800/80 text-neutral-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${isLight ? 'text-neutral-800' : isSepia ? 'text-[#3d2e1e]' : 'text-neutral-200'}`}>Tiếng Trung</span>
                <span className="text-[11px] opacity-60 font-normal hidden sm:inline">(Soạn thảo tự do &amp; bôi đen để tra/thêm từ)</span>
              </div>
              <span className="font-mono text-[11px] opacity-60">
                {inputChinese.length.toLocaleString()} ký tự
              </span>
            </div>

            {/* Vùng soạn thảo tiếng Trung tự do */}
            <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
              <textarea
                ref={chineseTextareaRef}
                value={inputChinese}
                onChange={(e) => {
                  setInputChinese(e.target.value);
                  setActiveRawText(e.target.value);
                }}
                onScroll={handleChineseScroll}
                onSelect={() => handleTextSelection('chinese')}
                onMouseUp={() => handleTextSelection('chinese')}
                onTouchEnd={() => handleTextSelection('chinese')}
                onKeyUp={(e) => {
                  if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
                    handleTextSelection('chinese');
                  }
                }}
                placeholder="Nhập hoặc dán văn bản tiếng Trung vào đây... Bạn có thể gõ, thêm, xóa văn bản như bình thường!"
                className={`flex-1 w-full h-full p-3 bg-transparent font-serif text-sm resize-none focus:outline-none focus:ring-0 leading-relaxed font-normal ${
                  isLight ? 'text-neutral-900 placeholder-neutral-400' : isSepia ? 'text-[#3d2e1e] placeholder-[#a69279]' : 'text-neutral-200 placeholder-neutral-600'
                }`}
              />
            </div>
          </div>
        )}

        {/* Thanh kẻ tiếp xúc kéo thả (Draggable Split Divider) */}
        {!isReadingMode && (
          <div
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
            onPointerCancel={handleDividerPointerUp}
            onDoubleClick={handleDividerDoubleClick}
            className={`shrink-0 touch-none select-none relative z-30 flex items-center justify-center transition-colors group ${
              isMdScreen
                ? 'w-2 hover:w-2.5 cursor-col-resize h-full bg-neutral-800 hover:bg-cyan-500/40 active:bg-cyan-500 border-x border-neutral-700/60'
                : 'h-2 hover:h-2.5 cursor-row-resize w-full bg-neutral-800 hover:bg-cyan-500/40 active:bg-cyan-500 border-y border-neutral-700/60'
            } ${isDraggingSplit ? 'bg-cyan-500 ring-1 ring-cyan-400' : ''}`}
            title="Kéo để chia tỷ lệ (Nhấp đúp: 50/50)"
          >
            {/* Grip handle indicator */}
            <div className={`rounded-full transition-colors ${
              isMdScreen ? 'w-1 h-8' : 'h-1 w-8'
            } ${isDraggingSplit ? 'bg-white' : 'bg-neutral-500 group-hover:bg-cyan-300'}`} />
          </div>
        )}

        {/* Right / Bottom: Khung Vietphrase */}
        <div 
          style={{
            width: !isReadingMode && isMdScreen ? `${100 - splitPercent}%` : '100%',
            height: !isReadingMode && !isMdScreen ? `${100 - splitPercent}%` : '100%',
          }}
          onMouseUp={() => handleTextSelection('vietphrase')}
          onTouchEnd={() => handleTextSelection('vietphrase')}
          className={`flex-1 flex flex-col overflow-hidden transition-colors duration-150 ${readerThemeClasses.bg} ${readerThemeClasses.text}`}
        >
          {/* Reader Action Bar */}
          <div className={`shrink-0 px-3 py-2 border-b flex items-center justify-between gap-2 text-xs transition-colors ${readerThemeClasses.bar}`}>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="font-semibold truncate">
                {viewMode === 'parallel' 
                  ? 'Song Song' 
                  : viewMode === 'hanviet' 
                    ? 'Hán Việt' 
                    : viewMode === 'chinese' 
                      ? 'Trung' 
                      : 'Vietphrase'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* TTS Controls */}
              <button
                onClick={handleToggleSpeech}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                  isSpeaking
                    ? 'bg-amber-600 hover:bg-amber-500 text-white font-medium animate-pulse'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                }`}
                title={isSpeaking ? (isPaused ? 'Tiếp tục đọc' : 'Tạm dừng đọc') : 'Đọc giọng nói'}
              >
                {isSpeaking && !isPaused ? <Pause size={13} /> : <Play size={13} />}
                <span className="hidden sm:inline">{isSpeaking ? (isPaused ? 'Tiếp tục' : 'Tạm dừng') : 'Đọc'}</span>
              </button>

              {isSpeaking && (
                <button
                  onClick={handleStopSpeech}
                  className="p-1 rounded-md bg-neutral-800 hover:bg-rose-900/60 text-rose-400 transition-colors"
                  title="Dừng đọc"
                >
                  <Square size={13} />
                </button>
              )}

              {/* Save to library */}
              <button
                onClick={handleOpenSaveModal}
                className="p-1.5 rounded-md text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800 transition-colors"
                title="Lưu vào Thư Viện"
              >
                <BookmarkPlus size={15} />
              </button>

              {/* Reading mode full screen */}
              <button
                onClick={() => setIsReadingMode(!isReadingMode)}
                className="p-1.5 text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800 rounded-md transition-colors"
                title={isReadingMode ? 'Hiện ô nhập tiếng Trung' : 'Toàn màn hình đọc'}
              >
                {isReadingMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>

          {/* Reader Content Body */}
          <div 
            ref={vietphraseScrollRef}
            onScroll={handleVietphraseScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
          >
            {translation.paragraphs.length === 0 || !inputChinese.trim() ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
                <FileText size={36} className="mb-2 text-neutral-600 stroke-[1.5]" />
                <p className="text-sm">Chưa có nội dung dịch</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                  Mở tệp (.txt, .docx) hoặc dán văn bản tiếng Trung để bắt đầu dịch.
                </p>
              </div>
            ) : viewMode === 'parallel' ? (
              // Song Song view: Two-column / aligned paragraphs
              <div className="space-y-6">
                {translation.paragraphs.map((p, idx) => (
                  <div 
                    key={idx} 
                    id={`p-reader-${idx}`}
                    className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl border transition-all duration-300 ${
                      activeReadingParagraphIndex === idx
                        ? isLight 
                          ? 'bg-cyan-50 border-cyan-400 ring-2 ring-cyan-200' 
                          : isSepia 
                            ? 'bg-[#edd9b8] border-amber-600 ring-2 ring-amber-300' 
                            : 'bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/30'
                        : isLight 
                          ? 'bg-white border-slate-200' 
                          : isSepia 
                            ? 'bg-[#f4e6ca] border-[#dfcfa8]' 
                            : 'bg-neutral-900/50 border-neutral-800/60'
                    }`}
                  >
                    <div className="font-serif text-sm text-neutral-400 leading-relaxed border-b md:border-b-0 md:border-r border-neutral-800 pb-2 md:pb-0 md:pr-3">
                      {p.tokens.map(tok => {
                        const isSynced = syncedTokenIds.has(tok.id);
                        return (
                          <span
                            key={tok.id}
                            onClick={() => handleChineseTokenClick(tok)}
                            className={`cursor-pointer px-0.5 rounded-xs ${
                              isSynced ? 'bg-cyan-500/40 text-cyan-100 ring-1 ring-cyan-400' : ''
                            }`}
                          >
                            {tok.original}
                          </span>
                        );
                      })}
                    </div>
                    <div 
                      className={`${fontClass} leading-relaxed`}
                      style={{ 
                        fontSize: `${settings.fontSize}px`, 
                        lineHeight: settings.lineHeight,
                        color: settings.customTextColor || undefined
                      }}
                    >
                      {/* Ở phần Vietphrase: Không có sự kiện click mở popup */}
                      {p.tokens.map((tok, tokIdx) => {
                        const isPunc = tok.isPunctuation || [',', '.', '!', '?', ';', ':', ')', ']', '}', '”', '"', "'"].includes(tok.translated);
                        return (
                          <React.Fragment key={tok.id}>
                            {tokIdx > 0 && !isPunc ? ' ' : null}
                            {renderPureReadingToken(tok, syncedTokenIds.has(tok.id), settings.theme, tokenOverrides[tok.id], settings.customTextColor)}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'chinese' ? (
              // Chinese view: with interactive token inspection
              <div 
                className="font-serif leading-loose space-y-4"
                style={{ fontSize: `${settings.fontSize + 2}px` }}
              >
                {chapterTitle && (
                  <h2 className="text-lg font-bold text-cyan-400 mb-2 border-b border-neutral-800 pb-2">
                    {chapterTitle}
                  </h2>
                )}

                {translation.paragraphs.map((p, pIdx) => {
                  const isCurrentReading = activeReadingParagraphIndex === pIdx;
                  return (
                    <p 
                      key={pIdx} 
                      id={`p-reader-${pIdx}`}
                      className={`text-neutral-300 transition-all duration-300 ${
                        isCurrentReading ? 'bg-cyan-950/40 border-l-4 border-cyan-400 pl-3 py-1.5 rounded-r-lg' : ''
                      }`}
                    >
                      {p.tokens.map(tok => {
                        const isSynced = syncedTokenIds.has(tok.id);
                        if (tok.isPunctuation) {
                          return <span key={tok.id}>{tok.original}</span>;
                        }

                        return (
                          <span
                            key={tok.id}
                            onClick={() => handleChineseTokenClick(tok)}
                            className={`cursor-pointer px-0.5 rounded-xs transition-colors ${
                              isSynced 
                                ? 'bg-cyan-500/40 text-cyan-100 ring-1 ring-cyan-400' 
                                : tok.isName 
                                  ? 'text-cyan-400 font-medium hover:bg-neutral-800' 
                                  : 'hover:bg-neutral-800 text-neutral-200'
                            }`}
                            title={`Dịch: ${tok.translated} | HV: ${tok.hanviet} | Bấm để tra/thêm Name`}
                          >
                            {tok.original}
                          </span>
                        );
                      })}
                    </p>
                  );
                })}
              </div>
            ) : (
              // Vietphrase or Hanviet view
              <div 
                className={`${fontClass} space-y-4 select-text`}
                style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
              >
                {/* Tiêu đề chương đã tự động convert sang tiếng Việt */}
                {(convertedChapterTitle || chapterTitle) && (
                  <h2 className={`text-lg font-bold mb-2 pb-2 border-b ${
                    settings.theme === 'light' || settings.theme === 'sepia' 
                      ? 'text-cyan-800 border-slate-300' 
                      : 'text-cyan-400 border-neutral-800'
                  }`}>
                    {viewMode === 'hanviet' 
                      ? (translation.paragraphs[0]?.hanviet.slice(0, 50) || chapterTitle)
                      : convertedChapterTitle}
                  </h2>
                )}

                {translation.paragraphs.map((p, pIdx) => {
                  const isCurrentReading = activeReadingParagraphIndex === pIdx;
                  return (
                    <p 
                      key={pIdx} 
                      id={`p-reader-${pIdx}`}
                      className={`${readerThemeClasses.pText} transition-all duration-300 ${
                        isCurrentReading 
                          ? isLight 
                            ? 'bg-cyan-50/90 border-l-4 border-cyan-600 pl-3 py-1.5 rounded-r-lg ring-1 ring-cyan-200 shadow-xs' 
                            : isSepia 
                              ? 'bg-[#ecd7b0] border-l-4 border-amber-700 pl-3 py-1.5 rounded-r-lg ring-1 ring-amber-400/40 shadow-xs' 
                              : 'bg-cyan-950/40 border-l-4 border-cyan-400 pl-3 py-1.5 rounded-r-lg ring-1 ring-cyan-500/30 shadow-xs'
                          : ''
                      }`}
                      style={settings.customTextColor ? { color: settings.customTextColor } : undefined}
                    >
                      {viewMode === 'hanviet'
                        ? p.hanviet
                        // Ở phần Vietphrase: Không có sự kiện click mở popup
                        : p.tokens.map((tok, tokIdx) => {
                            const isPunc = tok.isPunctuation || [',', '.', '!', '?', ';', ':', ')', ']', '}', '”', '"', "'"].includes(tok.translated);
                            return (
                              <React.Fragment key={tok.id}>
                                {tokIdx > 0 && !isPunc ? ' ' : null}
                                {renderPureReadingToken(tok, syncedTokenIds.has(tok.id), settings.theme, tokenOverrides[tok.id], settings.customTextColor)}
                              </React.Fragment>
                            );
                          })}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Lưu Chương Thông Minh vào /local/Convert/Lib */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-5 text-neutral-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                  <BookmarkPlus size={16} />
                </div>
                <h3 className="font-bold text-sm text-neutral-100">
                  Lưu Chương Vào Tủ Truyện
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsSaveModalOpen(false);
                  setIsInlineCreateNovel(false);
                }}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Thông tin đường dẫn lưu trữ cố định theo thiết bị */}
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-2 text-[11px] text-neutral-400">
              <Folder size={15} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-neutral-500 block">Đường dẫn tệp trong bộ nhớ máy:</span>
                <span className="font-mono text-cyan-300 break-all select-all">
                  /local/Convert/Lib/{
                    isInlineCreateNovel 
                      ? (inlineNovelTitle.trim() || 'Tieu_Thuyet') 
                      : (novelsList.find(n => n.id === saveNovelId)?.title || novelTitle || 'Tieu_Thuyet')
                  }/{saveChapterPrefix.trim() || 'Chuong'}_{saveChapterName.trim() || '1'}.txt
                </span>
              </div>
            </div>

            {/* Chọn bộ truyện hoặc Tạo truyện mới */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300">
                  Bộ truyện:
                </label>
                {!isInlineCreateNovel ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsInlineCreateNovel(true);
                      setInlineNovelTitle(novelTitle !== 'Tiểu Thuyết' ? novelTitle : '');
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <Plus size={13} />
                    <span>Tạo truyện mới</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsInlineCreateNovel(false)}
                    className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                  >
                    Chọn truyện có sẵn
                  </button>
                )}
              </div>

              {!isInlineCreateNovel ? (
                <div>
                  <select
                    value={saveNovelId}
                    onChange={(e) => setSaveNovelId(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                  >
                    {novelsList.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.title} {n.author ? `(${n.author})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Form tạo truyện mới trực tiếp tại chỗ */
                <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2.5">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Tên bộ truyện <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={inlineNovelTitle}
                      onChange={(e) => setInlineNovelTitle(e.target.value)}
                      placeholder="Ví dụ: Đấu La Đại Lục"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">
                        Tác giả
                      </label>
                      <input
                        type="text"
                        value={inlineNovelAuthor}
                        onChange={(e) => setInlineNovelAuthor(e.target.value)}
                        placeholder="Ví dụ: Đường Gia Tam Thiếu"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">
                        Thể loại
                      </label>
                      <select
                        value={inlineNovelGenre}
                        onChange={(e) => setInlineNovelGenre(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="Huyền huyễn / Dị giới">Huyền huyễn</option>
                        <option value="Tiên hiệp / Tu chân">Tiên hiệp</option>
                        <option value="Đô thị / Dị năng">Đô thị</option>
                        <option value="Khoa huyễn / Mạt thế">Khoa huyễn</option>
                        <option value="Võng du / Đồng nhân">Võng du</option>
                        <option value="Kiếm hiệp / Cổ điển">Kiếm hiệp</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Chọn ảnh bìa mẫu
                    </label>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {PRESET_COVERS.map((cov, idx) => (
                        <img
                          key={idx}
                          src={cov}
                          alt="Cover"
                          onClick={() => setInlineNovelCover(cov)}
                          className={`w-10 h-14 object-cover rounded-md cursor-pointer shrink-0 border transition-all ${
                            inlineNovelCover === cov
                              ? 'border-cyan-400 ring-2 ring-cyan-500/50 scale-105'
                              : 'border-neutral-700 opacity-60 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tiêu đề & Tên chương (Tự động bắt từ header đã dịch) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300">
                Thông tin chương đã dịch:
              </label>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="block text-[11px] text-neutral-400 mb-1">
                    Số / Tiền tố
                  </label>
                  <input
                    type="text"
                    value={saveChapterPrefix}
                    onChange={(e) => setSaveChapterPrefix(e.target.value)}
                    placeholder="Chương 30"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500 font-medium"
                  />
                </div>

                <div className="col-span-7">
                  <label className="block text-[11px] text-neutral-400 mb-1 flex items-center justify-between">
                    <span>Tên chương</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Tự động bắt</span>
                  </label>
                  <input
                    type="text"
                    value={saveChapterName}
                    onChange={(e) => setSaveChapterName(e.target.value)}
                    placeholder="Nguy Kịch"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Dòng xem trước tiêu đề chương đầy đủ */}
              <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-800/80 text-[11.5px] text-neutral-400 flex items-center gap-1.5">
                <span className="text-neutral-500">Tiêu đề lưu:</span>
                <span className="font-semibold text-neutral-200 truncate">
                  {saveChapterPrefix.trim()}{saveChapterName.trim() ? `: ${saveChapterName.trim()}` : ''}
                </span>
              </div>
            </div>

            {/* Nút thao tác: Đúng chuẩn nút "Xác nhận" và nút Hủy */}
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsSaveModalOpen(false);
                  setIsInlineCreateNovel(false);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-cyan-500/20 flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Xác nhận</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hướng Dẫn Phím Tắt Nhanh (Hotkeys Guide) */}
      {isHotkeysModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-5 text-neutral-100 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                  <Keyboard size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-100">Phím Tắt Nhanh (Hotkeys)</h3>
                  <p className="text-[11px] text-neutral-400">Thao tác dịch và duyệt chương siêu tốc</p>
                </div>
              </div>
              <button
                onClick={() => setIsHotkeysModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 py-1 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-neutral-300">Lưu chương vào thư viện</span>
                <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-cyan-400 font-mono font-medium shadow-2xs">Alt + S</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-neutral-300">Sao chép bản dịch vào Clipboard</span>
                <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-cyan-400 font-mono font-medium shadow-2xs">Alt + C</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-neutral-300">Làm mới bản dịch</span>
                <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-cyan-400 font-mono font-medium shadow-2xs">Alt + R</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-neutral-300">Tìm & thay thế nhanh trong chương</span>
                <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-cyan-400 font-mono font-medium shadow-2xs">Alt + F</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-neutral-300">Bật / Tắt cuộn đồng bộ 2 khung</span>
                <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-cyan-400 font-mono font-medium shadow-2xs">Alt + K</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-neutral-300">Chuyển sang chương trước</span>
                <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-cyan-400 font-mono font-medium shadow-2xs">Alt + ←</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-neutral-300">Chuyển sang chương tiếp theo</span>
                <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-cyan-400 font-mono font-medium shadow-2xs">Alt + →</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-neutral-300">Đọc / Tạm dừng giọng nói TTS</span>
                <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-cyan-400 font-mono font-medium shadow-2xs">Alt + P</kbd>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-800">
              <button
                onClick={() => setIsHotkeysModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors shadow-2xs"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Render từ trong bản dịch Vietphrase:
 * - LOẠI BỎ sự kiện onClick mở popup tra từ để trải nghiệm đọc không bị gián đoạn.
 * - Hỗ trợ highlight khi được đồng bộ bôi đen từ văn bản tiếng Trung (isSynced).
 * - Gắn dataset.tokenId để xác định chính xác từ khi quét bôi đen chọn nghĩa.
 * - Hiển thị từ đã thay thế (overrideText) nếu người dùng đã chọn nghĩa khác.
 */
function renderPureReadingToken(
  tok: TranslatedToken, 
  isSynced: boolean, 
  theme: string = 'dark',
  overrideText?: string,
  customTextColor?: string
) {
  const displayText = overrideText !== undefined ? overrideText : tok.translated;

  if (displayText === '') {
    return null;
  }

  if (tok.isPunctuation) {
    return <span key={tok.id} data-token-id={tok.id}>{displayText}</span>;
  }

  const isLightOrWarm = theme === 'light' || theme === 'sepia';

  // Nếu đang được đồng bộ bôi đen từ tiếng Trung
  if (isSynced) {
    return (
      <span
        key={tok.id}
        data-token-id={tok.id}
        className="bg-cyan-500/35 text-cyan-200 font-semibold ring-1 ring-cyan-500/80 rounded-xs px-0.5 mx-0.5 transition-colors"
      >
        {displayText}
      </span>
    );
  }

  // Tên riêng (Name)
  if (tok.isName) {
    return (
      <span
        key={tok.id}
        data-token-id={tok.id}
        style={customTextColor ? { color: customTextColor } : undefined}
        className={`font-semibold mx-0.5 ${!customTextColor ? (isLightOrWarm ? 'text-cyan-700' : 'text-cyan-300') : ''}`}
      >
        {displayText}
      </span>
    );
  }

  // Custom Vietphrase (ĐÃ SỬA: Loại bỏ màu vàng amber-300 ép buộc gây lỗi chữ vàng nền tối)
  if (tok.isCustom) {
    return (
      <span
        key={tok.id}
        data-token-id={tok.id}
        style={customTextColor ? { color: customTextColor } : undefined}
        className={`font-medium mx-0.5 border-b border-dotted border-cyan-500/40 ${
          !customTextColor ? (isLightOrWarm ? 'text-neutral-900' : 'text-[#f4f4f5]') : ''
        }`}
      >
        {displayText}
      </span>
    );
  }

  // Từ thông thường (hoặc từ đã được người dùng đổi nghĩa)
  return (
    <span 
      key={tok.id} 
      data-token-id={tok.id}
      style={customTextColor ? { color: customTextColor } : undefined}
      className={`mx-0.2 ${
        !customTextColor ? (isLightOrWarm ? 'text-neutral-900' : 'text-[#f4f4f5]') : ''
      } ${overrideText !== undefined ? 'underline decoration-cyan-500/60 decoration-dotted underline-offset-2' : ''}`}
      title={tok.alternatives && tok.alternatives.length > 1 ? `Có ${tok.alternatives.length} nghĩa (Bôi đen để đổi)` : undefined}
    >
      {displayText}
    </span>
  );
}
