import { chapterBelongsToNovel } from '../../utils/libraryMembership';
import { readReaderState, type ReadingPosition } from '../../utils/readerState';
import { EditLibraryChapterDialog } from '../EditLibraryChapterDialog';
const LibraryReader = React.lazy(() => import('../LibraryReader').then(module => ({ default: module.LibraryReader })));
import { readConvertPreference } from '../../utils/legacyCompatibility';
import { useBackgroundTasks } from '../../context/BackgroundTasks';
import { capitalizeLineStarts } from '../../utils/vietnameseTypography';
import { libraryPageAfterSwipe, type LibraryNovelPage } from '../../utils/libraryPageNavigation';
/**
 * Tab Tủ Truyện & Quản Lý Tiểu Thuyết (Library View)
 * Hỗ trợ thêm mới truyện, chỉnh sửa thông tin (tên, tác giả, ảnh bìa, tóm tắt),
 * quản lý danh sách chương và đọc offline không cần đăng nhập.
 */

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp, SavedChapter, NovelBook, parseChapterHeader, PRESET_COVERS } from '../../context/AppContext';
import { 
  BookMarked, 
  Trash2, 
  Search, 
  Download, 
  Plus, 
  ArrowRight, 
  Edit3, 
  ChevronLeft,
  Book, 
  Sparkles, 
  X, 
  Check, 
  FileText,
  Clock,
  Image as ImageIcon,
  LayoutGrid,
  List,
  ArrowUpDown,
  Folder,
  Heart,
  Upload,
  Star
} from 'lucide-react';

export const NOVEL_GENRES = [
  'Huyền huyễn',
  'Tiên hiệp',
  'Dị giới',
  'Đô thị',
  'Kiếm hiệp',
  'Khoa huyễn',
  'Võng du',
  'Linh dị / Kinh dị',
  'Lịch sử / Quân sự',
  'Đồng nhân',
  'Hệ thống',
  'Điền văn',
  'Mạt thế',
  'Trùng sinh',
  'Xuyên không',
  'Ngôn tình',
  'Đam mỹ',
  'Bách hợp',
  'Cổ đại',
  'Kỳ huyễn',
  'Hài hước',
  'Phương Tây',
  'Hàn Quốc',
  'Nhật Bản',
  'Light novel',
  'Gia đấu',
];

export const LibraryView: React.FC = () => {
  const background = useBackgroundTasks();
  const { 
    novelsList,
    addNovel,
    updateNovel,
    deleteNovel,
    toggleFavoriteNovel,
    savedChapters, 
    deleteSavedChapter, 
    deleteSavedChapters,
    saveChapter,
    updateSavedChapter,
    setActiveTab, 
    setActiveRawText, 
    setActiveChapterTitle, 
    setActiveNovelTitle,
    setActiveNovelId,
    settings
  } = useApp();

  const isLight = settings.theme === 'light';
  const isSepia = settings.theme === 'sepia';

  const [readerBookId, setReaderBookId] = useState<string | null>(null);
  const [editingChapter, setEditingChapter] = useState<SavedChapter | null>(null);
  const [readerChapterId, setReaderChapterId] = useState<string | undefined>();
  const [readingProgress, setReadingProgress] = useState<Record<string, ReadingPosition>>({});
  useEffect(() => { readReaderState().then(state => setReadingProgress(state.progress)).catch(console.error); }, [readerBookId]);
  const [activeSubView, setActiveSubView] = useState<'all' | 'favorites'>('all');
  const [selectedNovelId, setSelectedNovelId] = useState<string | null>(null);
  const [selectedNovelPage, setSelectedNovelPage] = useState<LibraryNovelPage>('details');
  const novelPageTouchStart = useRef<{ x: number; y: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [chapterSort, setChapterSort] = useState('name_asc');
  const [chapterPage, setChapterPage] = useState(1);
  const [chapterPageInput, setChapterPageInput] = useState('1');
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(() => new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const chapterListRef = useRef<HTMLDivElement>(null);

  // Chế độ xem Tủ truyện: Ô lưới (tổng quan) hoặc Danh sách (chi tiết)
  const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const stored = readConvertPreference('convert_library_view_mode');
      if (stored === 'grid' || stored === 'list') return stored;
    } catch {}
    return 'grid';
  });

  // Tiêu chí sắp xếp: Mặc định theo 'recent' (Chương mới cập nhật nhất)
  const [sortOption, setSortOption] = useState<'recent' | 'oldest' | 'name_asc' | 'name_desc' | 'chapters_count'>(() => {
    try {
      const stored = readConvertPreference('convert_library_sort_option');
      if (stored && ['recent', 'oldest', 'name_asc', 'name_desc', 'chapters_count'].includes(stored)) {
        return stored as any;
      }
    } catch {}
    return 'recent';
  });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortPopupRef = useRef<HTMLDivElement>(null);
  const libraryRef = useRef<HTMLDivElement>(null);
  const [sortPopupPosition, setSortPopupPosition] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!isSortMenuOpen) { setSortPopupPosition(null); return; }
    const positionPopup = () => {
      const anchor = sortMenuRef.current?.getBoundingClientRect();
      const bounds = libraryRef.current?.getBoundingClientRect();
      if (!anchor || !bounds) return;
      const leftEdge = Math.max(8, bounds.left + 8);
      const rightEdge = Math.min(window.innerWidth - 8, bounds.right - 8);
      const width = Math.min(240, Math.max(0, rightEdge - leftEdge));
      const topEdge = Math.max(8, bounds.top);
      const bottomEdge = Math.min(window.innerHeight - 8, bounds.bottom - 8);
      const below = Math.max(0, bottomEdge - anchor.bottom - 6);
      const above = Math.max(0, anchor.top - topEdge - 6);
      const height = Math.min(sortPopupRef.current?.scrollHeight || 240, Math.max(below, above));
      const openBelow = below >= height || below >= above;
      setSortPopupPosition({
        position: 'fixed',
        left: Math.max(leftEdge, Math.min(anchor.right - width, rightEdge - width)),
        top: openBelow ? anchor.bottom + 6 : Math.max(topEdge, anchor.top - height - 6),
        width,
        maxHeight: openBelow ? below : above,
      });
    };
    positionPopup();
    window.addEventListener('resize', positionPopup);
    window.addEventListener('scroll', positionPopup, true);
    return () => {
      window.removeEventListener('resize', positionPopup);
      window.removeEventListener('scroll', positionPopup, true);
    };
  }, [isSortMenuOpen]);

  // Đóng sort menu khi bấm ra ngoài
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node) && !sortPopupRef.current?.contains(e.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSortMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Modal State: Thêm mới hoặc Chỉnh sửa truyện
  const [novelModalOpen, setNovelModalOpen] = useState(false);
  const [editingNovelId, setEditingNovelId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalOriginalTitle, setModalOriginalTitle] = useState('');
  const [modalAuthor, setModalAuthor] = useState('');
  const [modalGenres, setModalGenres] = useState<string[]>(['Huyền huyễn']);
  const [modalPublicationStatus, setModalPublicationStatus] = useState<'ongoing' | 'completed'>('ongoing');
  const [modalCoverUrl, setModalCoverUrl] = useState(PRESET_COVERS[0]);
  const [modalDescription, setModalDescription] = useState('');
  const [ratingNovel, setRatingNovel] = useState<NovelBook | null>(null);
  const [ratingValue, setRatingValue] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [ratingReview, setRatingReview] = useState('');
  const localCoverInputRef = useRef<HTMLInputElement>(null);
  
  // Custom Confirmation Modal for Deleting Novel (Fixes window.confirm blocked in iframe)
  const [novelToDelete, setNovelToDelete] = useState<NovelBook | null>(null);
  const showToast = (message: string, isError: boolean = false) => {
    background.notify(message, isError);
  };

  const selectedNovel = novelsList.find(n => n.id === selectedNovelId);
  const [isExportingEpub, setIsExportingEpub] = useState(false);
  const handleExportEpub = async () => {
    if (!selectedNovel || isExportingEpub) return;
    setIsExportingEpub(true);
    try {
      const { downloadNovelEpub } = await import('../../utils/epubExport');
      // Export the whole novel, independent of search, sort and current chapter page.
      const chapters = savedChapters.filter(chapter => chapterBelongsToNovel(chapter, selectedNovel));
      await downloadNovelEpub(selectedNovel, chapters);
      showToast(`Đã xuất EPUB (${chapters.length} chương)`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể xuất EPUB.', true);
    } finally { setIsExportingEpub(false); }
  };

  // Chọn ảnh bìa từ tệp trong máy
  const handleLocalCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Kích thước ảnh không quá 5MB', true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setModalCoverUrl(reader.result);
          showToast('Đã chọn ảnh bìa từ bộ nhớ máy');
        }
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  // Mở modal thêm truyện mới
  const handleOpenAddNovelModal = () => {
    setEditingNovelId(null);
    setModalTitle('');
    setModalOriginalTitle('');
    setModalAuthor('');
    setModalGenres(['Huyền huyễn']);
    setModalPublicationStatus('ongoing');
    setModalCoverUrl(PRESET_COVERS[Math.floor(Math.random() * PRESET_COVERS.length)]);
    setModalDescription('');
    setNovelModalOpen(true);
  };

  // Mở modal sửa truyện đã có
  const handleOpenEditNovelModal = (novel: NovelBook, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingNovelId(novel.id);
    setModalTitle(novel.title);
    setModalOriginalTitle(novel.originalTitle || '');
    setModalAuthor(novel.author || '');
    const genres = novel.genres && novel.genres.length > 0 
      ? novel.genres 
      : (novel.genre ? novel.genre.split(/[·,/]/).map(g => g.trim()).filter(Boolean) : ['Huyền huyễn']);
    setModalGenres(genres.length > 0 ? genres : ['Huyền huyễn']);
    setModalPublicationStatus(novel.publicationStatus || 'ongoing');
    setModalCoverUrl(novel.coverUrl || PRESET_COVERS[0]);
    setModalDescription(novel.description || '');
    setNovelModalOpen(true);
  };

  // Lưu thông tin truyện (Thêm mới hoặc Cập nhật)
  const handleSaveNovel = async () => {
    if (!modalTitle.trim()) {
      showToast('Vui lòng nhập tên bộ truyện!', true);
      return;
    }
    try {
    const genreString = modalGenres.length > 0 ? modalGenres.join(' · ') : 'Huyền huyễn';

    if (editingNovelId) {
      await updateNovel(editingNovelId, {
        title: modalTitle.trim(),
        originalTitle: modalOriginalTitle.trim(),
        author: modalAuthor.trim(),
        genres: modalGenres,
        genre: genreString,
        coverUrl: modalCoverUrl.trim(),
        description: modalDescription.trim(),
        publicationStatus: modalPublicationStatus,
      });
      showToast('Đã lưu thay đổi bộ truyện');
    } else {
      await addNovel({
        title: modalTitle.trim(),
        originalTitle: modalOriginalTitle.trim(),
        author: modalAuthor.trim() || 'Khuyết danh',
        genres: modalGenres,
        genre: genreString,
        coverUrl: modalCoverUrl.trim(),
        description: modalDescription.trim(),
        publicationStatus: modalPublicationStatus,
      });
      showToast('Đã tạo bộ truyện mới');
    }

    setNovelModalOpen(false);
    } catch (error) { showToast('Không lưu được truyện: ' + String(error), true); }
  };

  const handleOpenRatingModal = (novel: NovelBook) => {
    setRatingNovel(novel);
    setRatingValue(novel.rating || 0);
    setRatingReview(novel.review || '');
  };

  const handleSaveRating = async () => {
    if (!ratingNovel || ratingValue === 0) {
      showToast('Vui lòng chọn từ 1 đến 5 sao.', true);
      return;
    }
    try {
      await updateNovel(ratingNovel.id, { rating: ratingValue, review: ratingReview.trim() });
      showToast('Đã lưu đánh giá truyện');
      setRatingNovel(null);
    } catch (error) {
      showToast('Không lưu được đánh giá: ' + String(error), true);
    }
  };

  // Mở chương để dịch / đọc
  const handleEditChapter = (chap: SavedChapter) => {
    setReaderBookId(null);
    setActiveRawText(chap.originalText);
    setActiveChapterTitle(chap.title);
    setActiveNovelTitle(chap.novelTitle || 'Tiểu thuyết');
    if (chap.novelId) setActiveNovelId(chap.novelId);
    setActiveTab('translate');
  };

  const handleOpenChapter = (chapter: SavedChapter) => {
    const id = chapter.novelId || novelsList.find(book => book.title === chapter.novelTitle)?.id || selectedNovelId;
    if (!id) { showToast('Không tìm thấy bộ truyện của chương này.', true); return; }
    setReaderChapterId(chapter.id); setReaderBookId(id);
  };

  // Tải file .txt của chương
  const handleDownloadTxt = (chap: SavedChapter, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const chapterText = chap.vietphraseText.trim() ? capitalizeLineStarts(chap.vietphraseText) : chap.originalText;
    const content = `${chap.novelTitle || ''}\n${chap.title}\n\n${chapterText}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chap.title}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Lấy thời điểm cập nhật chương gần nhất của bộ truyện
  const getNovelLatestTimestamp = (novel: NovelBook) => {
    const chaps = savedChapters.filter(c => chapterBelongsToNovel(c, novel));
    if (chaps.length > 0) {
      return Math.max(...chaps.map(c => c.savedAt));
    }
    return novel.updatedAt || novel.createdAt || 0;
  };

  // Lọc và sắp xếp danh sách truyện (Tất cả hoặc Yêu thích)
  const sortedAndFilteredNovels = useMemo(() => {
    let list = novelsList;
    if (activeSubView === 'favorites') {
      list = list.filter(n => n.isFavorite);
    }
    list = list.filter(n => 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.originalTitle && n.originalTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (n.author && n.author.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (n.genre && n.genre.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return list.sort((a, b) => {
      if (sortOption === 'recent') {
        return getNovelLatestTimestamp(b) - getNovelLatestTimestamp(a);
      }
      if (sortOption === 'oldest') {
        return getNovelLatestTimestamp(a) - getNovelLatestTimestamp(b);
      }
      if (sortOption === 'name_asc') {
        return a.title.localeCompare(b.title, 'vi');
      }
      if (sortOption === 'name_desc') {
        return b.title.localeCompare(a.title, 'vi');
      }
      if (sortOption === 'chapters_count') {
        const countA = savedChapters.filter(c => chapterBelongsToNovel(c, a)).length;
        const countB = savedChapters.filter(c => chapterBelongsToNovel(c, b)).length;
        return countB - countA;
      }
      return 0;
    });
  }, [novelsList, activeSubView, searchTerm, sortOption, savedChapters]);

  const favoriteCount = useMemo(() => novelsList.filter(n => n.isFavorite).length, [novelsList]);

  // Lọc chương thuộc truyện đang chọn
  const novelChapters = savedChapters.filter(c => 
    selectedNovelId ? (!!selectedNovel && chapterBelongsToNovel(c, selectedNovel)) : true
  );

  const displayedChapters = useMemo(() => {
    const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
    return savedChapters
      .filter(c => selectedNovelId && (!!selectedNovel && chapterBelongsToNovel(c, selectedNovel)))
      .filter(c => c.title.toLocaleLowerCase('vi').includes(searchTerm.trim().toLocaleLowerCase('vi')))
      .sort((a, b) => chapterSort === 'recent'
        ? b.savedAt - a.savedAt || collator.compare(a.title, b.title)
        : chapterSort === 'name_desc' ? collator.compare(b.title, a.title) : collator.compare(a.title, b.title));
  }, [savedChapters, selectedNovelId, selectedNovel?.title, searchTerm, chapterSort]);
  const chapterPageCount = Math.max(1, Math.ceil(displayedChapters.length / 100));
  const currentChapterPage = Math.min(chapterPage, chapterPageCount);
  const chapterOffset = (currentChapterPage - 1) * 100;
  const pageChapters = displayedChapters.slice(chapterOffset, chapterOffset + 100);
  const selectedChapterCount = selectedChapterIds.size;
  const areAllVisibleChaptersSelected = displayedChapters.length > 0 && displayedChapters.every(chapter => selectedChapterIds.has(chapter.id));

  useEffect(() => {
    setChapterPage(1);
    setChapterPageInput('1');
  }, [selectedNovelId, searchTerm, chapterSort]);

  useEffect(() => {
    setSelectedChapterIds(new Set());
  }, [selectedNovelId]);

  useEffect(() => {
    const availableIds = new Set(novelChapters.map(chapter => chapter.id));
    setSelectedChapterIds(current => {
      const next = new Set([...current].filter(id => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [novelChapters]);

  useEffect(() => {
    setChapterPage(currentChapterPage);
    setChapterPageInput(String(currentChapterPage));
  }, [currentChapterPage]);

  const goToChapterPage = (page: number) => {
    const next = Math.max(1, Math.min(chapterPageCount, Math.trunc(page) || 1));
    setChapterPage(next);
    setChapterPageInput(String(next));
    chapterListRef.current?.scrollIntoView({ block: 'start' });
  };

  const toggleChapterSelection = (chapterId: string) => {
    setSelectedChapterIds(current => {
      const next = new Set(current);
      next.has(chapterId) ? next.delete(chapterId) : next.add(chapterId);
      return next;
    });
  };

  const toggleAllVisibleChapterSelection = () => {
    setSelectedChapterIds(current => {
      const next = new Set(current);
      if (areAllVisibleChaptersSelected) {
        displayedChapters.forEach(chapter => next.delete(chapter.id));
      } else {
        displayedChapters.forEach(chapter => next.add(chapter.id));
      }
      return next;
    });
  };

  const openNovelDetails = (novelId: string) => {
    setSelectedNovelId(novelId);
    setSelectedNovelPage('details');
    setSearchTerm('');
  };

  const handleNovelPageTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = novelPageTouchStart.current;
    novelPageTouchStart.current = null;
    if (!start || event.changedTouches.length === 0) return;
    const deltaX = event.changedTouches[0].clientX - start.x;
    const deltaY = event.changedTouches[0].clientY - start.y;
    setSelectedNovelPage(page => libraryPageAfterSwipe(page, deltaX, deltaY));
  };

  const handleDeleteSelectedChapters = () => {
    const chapterIds = [...selectedChapterIds];
    if (!chapterIds.length) return;
    setSelectedChapterIds(new Set());
    setIsBulkDeleteOpen(false);
    // The queued IndexedDB transaction continues without blocking the library UI.
    void deleteSavedChapters(chapterIds)
      .then(deleted => showToast(deleted ? `Đã xóa ${deleted} chương đã chọn` : 'Các chương đã chọn không còn trong thư viện.'))
      .catch(error => {
        setSelectedChapterIds(new Set(chapterIds));
        showToast(error instanceof Error ? error.message : 'Không thể xóa các chương đã chọn.', true);
      });
  };

  const handleSelectSort = (option: typeof sortOption) => {
    setSortOption(option);
    try {
      localStorage.setItem('convert_library_sort_option', option);
    } catch {}
    setIsSortMenuOpen(false);
  };

  const handleToggleViewMode = () => {
    const next = libraryViewMode === 'grid' ? 'list' : 'grid';
    setLibraryViewMode(next);
    try {
      localStorage.setItem('convert_library_view_mode', next);
    } catch {}
  };

  const readerBook = novelsList.find(book => book.id === readerBookId);
  if (readerBook) return <React.Suspense fallback={<p className="p-6">Đang mở chế độ đọc…</p>}><LibraryReader
    book={readerBook} chapters={savedChapters.filter(chapter => chapterBelongsToNovel(chapter, readerBook))}
    initialChapterId={readerChapterId} onClose={() => setReaderBookId(null)} onEdit={handleEditChapter} /></React.Suspense>;

  return (
    <div ref={libraryRef} className={`@container/library flex-1 min-w-0 flex flex-col h-full overflow-hidden ${
      isLight ? 'bg-surface text-main' : isSepia ? 'bg-surface text-main' : 'bg-canvas text-main'
    }`}>
      {editingChapter && <EditLibraryChapterDialog chapter={editingChapter} onClose={() => setEditingChapter(null)} onSave={updates => updateSavedChapter(editingChapter.id, updates)} />}
      {/* Top Header: Subtabs & Integrated Toolbar */}
      {!selectedNovelId && <div className={`shrink-0 p-2.5 sm:p-3 border-b flex items-center justify-between flex-wrap gap-2 transition-colors ${
        isLight ? 'bg-surface border-line' : isSepia ? 'bg-surface border-line' : 'bg-surface border-line'
      }`}>
        {/* Subtab Toggle: Tất cả vs Yêu thích */}
        <div className={`flex items-center p-0.5 rounded-lg border text-xs ${
          isLight ? 'bg-raised border-line' : isSepia ? 'bg-surface border-line' : 'bg-canvas border-line'
        }`}>
          <button
            onClick={() => {
              setActiveSubView('all');
              setSelectedNovelId(null);
            }}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubView === 'all' && !selectedNovelId
                ? 'bg-accent text-main shadow-xs'
                : isLight ? 'text-muted hover:text-main' : isSepia ? 'text-main hover:text-main' : 'text-muted hover:text-main'
            }`}
          >
            <Book size={14} />
            <span>Tất cả ({novelsList.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveSubView('favorites');
              setSelectedNovelId(null);
            }}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubView === 'favorites' && !selectedNovelId
                ? 'bg-rose-600 text-main shadow-xs'
                : isLight ? 'text-muted hover:text-main' : isSepia ? 'text-main hover:text-main' : 'text-muted hover:text-main'
            }`}
          >
            <Heart size={14} className={activeSubView === 'favorites' ? 'fill-white' : 'fill-rose-500/20 text-rose-400'} />
            <span>Yêu thích ({favoriteCount})</span>
          </button>
        </div>

        {/* Right Toolbar: Expandable Search, View mode, Sort & Add novel */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* Tối ưu thanh tìm kiếm gọn vào toolbar: Nút kính lúp mở rộng hoặc ô input co giãn */}
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-muted pointer-events-none" />
              <input
                type="text"
                aria-label={selectedNovelId ? 'Tìm chương' : 'Tìm truyện, tác giả'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  selectedNovelId 
                    ? `Tìm chương...` 
                    : activeSubView === 'favorites'
                      ? "Tìm trong yêu thích..." 
                      : "Tìm truyện, tác giả..."
                }
                className={`w-36 sm:w-56 rounded-lg pl-7 pr-6 py-1 text-xs transition-colors focus:outline-none focus:border-accent border ${
                  isLight 
                    ? 'bg-canvas border-line text-main placeholder-subtle' 
                    : isSepia 
                      ? 'bg-surface border-line text-main placeholder-[#a69279]' 
                      : 'bg-canvas border-line text-main placeholder-subtle'
                }`}
              />
              <button
                onClick={() => {
                  setSearchTerm('');
                }}
                className="absolute right-1.5 p-0.5 text-muted hover:text-main rounded cursor-pointer"
                title="Xóa tìm kiếm"
                aria-label="Xóa tìm kiếm"
              >
                <X size={12} />
              </button>
            </div>

          {/* Nút chuyển đổi danh sách xem: Ô lưới (tổng quan) vs Danh sách (chi tiết) */}
          {!selectedNovelId && (
            <>
              <button
                onClick={handleToggleViewMode}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isLight 
                    ? 'bg-raised hover:bg-raised text-accent border-line' 
                    : isSepia 
                      ? 'bg-surface hover:bg-surface text-accent border-line' 
                      : 'bg-raised hover:bg-hover text-accent border-line'
                }`}
                title={libraryViewMode === 'grid' ? 'Xem danh sách' : 'Xem dạng lưới'}
                aria-label="Chuyển đổi giao diện xem"
              >
                {libraryViewMode === 'grid' ? <List size={15} /> : <LayoutGrid size={15} />}
              </button>

              {/* Nút sắp xếp truyện: A-Z, Z-A, ngày cập nhật chương */}
              <div ref={sortMenuRef} className="relative">
                <button
                  onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                  className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                    isSortMenuOpen 
                      ? 'bg-accent text-main border-accent' 
                      : isLight 
                        ? 'bg-raised text-main border-line hover:bg-raised' 
                        : isSepia 
                          ? 'bg-surface text-main border-line hover:bg-surface' 
                          : 'bg-raised text-main border-line hover:text-main hover:bg-hover'
                  }`}
                  title="Sắp xếp"
                  aria-label="Sắp xếp"
                  aria-expanded={isSortMenuOpen}
                  aria-controls="library-sort-popup"
                >
                  <ArrowUpDown size={15} />
                </button>

                {/* Popover danh sách sắp xếp */}
                {isSortMenuOpen && createPortal(
                  <div ref={sortPopupRef} id="library-sort-popup" aria-label="Sắp xếp truyện theo" style={sortPopupPosition || { position: 'fixed', visibility: 'hidden', width: 240 }} className={`rounded-xl shadow-2xl p-1.5 z-[100] overflow-y-auto overscroll-contain text-xs border ${
                    isLight 
                      ? 'bg-surface border-line text-main' 
                      : isSepia 
                        ? 'bg-surface border-line text-main' 
                        : 'bg-surface border-line text-main'
                  }`}>
                    <div className="px-2.5 py-1 text-[11px] font-semibold opacity-60 uppercase tracking-wider border-b border-line/40 mb-1">
                      Sắp xếp truyện theo
                    </div>
                    <button
                      onClick={() => handleSelectSort('recent')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-accent/10 transition-colors"
                    >
                      <span className={sortOption === 'recent' ? 'text-accent font-semibold' : ''}>
                        Chương mới cập nhật nhất
                      </span>
                      {sortOption === 'recent' && <Check size={14} className="text-accent" />}
                    </button>

                    <button
                      onClick={() => handleSelectSort('oldest')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-accent/10 transition-colors"
                    >
                      <span className={sortOption === 'oldest' ? 'text-accent font-semibold' : ''}>
                        Chương cũ nhất
                      </span>
                      {sortOption === 'oldest' && <Check size={14} className="text-accent" />}
                    </button>

                    <button
                      onClick={() => handleSelectSort('name_asc')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-accent/10 transition-colors"
                    >
                      <span className={sortOption === 'name_asc' ? 'text-accent font-semibold' : ''}>
                        Tên truyện: A → Z
                      </span>
                      {sortOption === 'name_asc' && <Check size={14} className="text-accent" />}
                    </button>

                    <button
                      onClick={() => handleSelectSort('name_desc')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-accent/10 transition-colors"
                    >
                      <span className={sortOption === 'name_desc' ? 'text-accent font-semibold' : ''}>
                        Tên truyện: Z → A
                      </span>
                      {sortOption === 'name_desc' && <Check size={14} className="text-accent" />}
                    </button>

                    <button
                      onClick={() => handleSelectSort('chapters_count')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-accent/10 transition-colors"
                    >
                      <span className={sortOption === 'chapters_count' ? 'text-accent font-semibold' : ''}>
                        Số lượng chương nhiều nhất
                      </span>
                      {sortOption === 'chapters_count' && <Check size={14} className="text-accent" />}
                    </button>
                  </div>, document.body
                )}
              </div>
            </>
          )}

          {/* Nút Thêm Mới Truyện */}
          <button
            onClick={handleOpenAddNovelModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent text-main rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Thêm truyện</span>
          </button>
        </div>
      </div>}

      {/* Main Content Area */}
      <div className={`flex-1 overflow-y-auto ${selectedNovelId ? 'p-3 sm:p-5' : 'p-4'}`}>
        {/* VIEW 1: Chi tiết 1 bộ truyện (Khi đang chọn 1 truyện) */}
        {selectedNovelId && selectedNovel ? (
          <div
            className="min-h-full max-w-6xl mx-auto"
            onTouchStart={event => { novelPageTouchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
            onTouchEnd={handleNovelPageTouchEnd}
          >
          {selectedNovelPage === 'details' ? <div className="library-detail-page min-h-full space-y-3">
            {/* Nút quay lại */}
            <button
              onClick={() => { setSelectedNovelId(null); setSearchTerm(''); }}
              className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors py-1"
            >
              <ChevronLeft size={16} />
              <span>Quay lại danh sách bộ truyện</span>
            </button>

            {/* Thẻ thông tin bộ truyện */}
            <div className="library-book-card library-detail-card p-4 sm:p-5 rounded-2xl bg-surface border border-line flex flex-col sm:flex-row sm:flex-wrap gap-4 items-start shadow-md">
              <img
                src={selectedNovel.coverUrl || PRESET_COVERS[0]}
                alt={selectedNovel.title}
                className="library-book-cover w-24 sm:w-28 h-36 object-cover rounded-xl shadow-md border border-line shrink-0"
              />

              <div className="library-book-info flex-1 min-w-0 space-y-2">
                <div className="library-book-heading flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-bold text-main">
                      {selectedNovel.title}
                    </h2>
                    {selectedNovel.originalTitle && (
                      <p className="text-xs text-muted font-reading">
                        {selectedNovel.originalTitle}
                      </p>
                    )}
                  </div>

                  <div className="library-book-actions inline-flex shrink-0 items-center gap-1" role="toolbar" aria-label="Thao tác với truyện">
                    <button
                      type="button"
                      onClick={() => handleOpenEditNovelModal(selectedNovel)}
                      className={`library-status-action ${selectedNovel.publicationStatus === 'completed' ? 'is-completed' : ''}`}
                      aria-label={`Trạng thái: ${selectedNovel.publicationStatus === 'completed' ? 'Đã hoàn thành' : 'Đang ra'}. Mở sửa thông tin truyện`}
                      title="Chỉnh trạng thái trong Sửa thông tin"
                    >
                      {selectedNovel.publicationStatus === 'completed' ? 'Đã hoàn thành' : 'Đang ra'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenRatingModal(selectedNovel)}
                      className={`library-rating-action ${selectedNovel.rating ? 'is-rated' : ''}`}
                      aria-label={selectedNovel.rating ? `Đánh giá hiện tại ${selectedNovel.rating} trên 5 sao. Mở để sửa` : 'Đánh giá truyện'}
                      title={selectedNovel.rating ? `${selectedNovel.rating}/5 sao${selectedNovel.review ? ` · ${selectedNovel.review}` : ''}` : 'Đánh giá truyện'}
                    >
                      <Star size={14} className={selectedNovel.rating ? 'fill-current' : ''} />
                      <span>{selectedNovel.rating ? `${selectedNovel.rating}/5` : '0/5'}</span>
                    </button>

                    <button
                      onClick={() => {
                        void toggleFavoriteNovel(selectedNovel.id).catch(error => showToast(String(error), true));
                        showToast(selectedNovel.isFavorite ? `Đã bỏ thích "${selectedNovel.title}"` : `Đã thêm "${selectedNovel.title}" vào Yêu thích`);
                      }}
                      className={`library-icon-action ${
                        selectedNovel.isFavorite
                          ? 'is-active text-rose-400'
                          : ''
                      }`}
                      aria-label={selectedNovel.isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                      aria-pressed={Boolean(selectedNovel.isFavorite)}
                      title={selectedNovel.isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                    >
                      <Heart size={17} className={selectedNovel.isFavorite ? "fill-current" : ""} />
                    </button>

                    <button
                      onClick={() => handleOpenEditNovelModal(selectedNovel)}
                      className="library-icon-action"
                      aria-label="Sửa thông tin truyện"
                      title="Sửa thông tin truyện"
                    >
                      <Edit3 size={17} />
                    </button>

                    <button
                      onClick={handleExportEpub}
                      disabled={isExportingEpub || novelChapters.length === 0}
                      className="library-icon-action"
                      aria-label={isExportingEpub ? "Đang xuất EPUB" : "Xuất EPUB"}
                      title={novelChapters.length === 0 ? "Chưa có chương để xuất EPUB" : isExportingEpub ? "Đang xuất EPUB" : "Xuất EPUB"}
                    >
                      <Download size={17} strokeWidth={1.75} />
                    </button>

                    <button
                      onClick={() => setNovelToDelete(selectedNovel)}
                      className="library-icon-action library-icon-action-danger"
                      aria-label="Xóa truyện"
                      title="Xóa truyện"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="library-book-meta flex items-center gap-2 text-xs text-muted flex-wrap">
                  <span>Tác giả: <strong className="text-main">{selectedNovel.author || 'Khuyết danh'}</strong></span>
                  <span>·</span>
                  <span className="px-1.5 py-0.5 rounded-sm bg-raised text-accent text-[11px] border border-line/60">
                    {selectedNovel.genre || 'Huyền huyễn'}
                  </span>
                  <span>·</span>
                  <span className="text-main font-medium">{novelChapters.length} chương đã lưu</span>
                </div>

                {/* Đường dẫn thư mục lưu trữ */}
                <div className="library-book-path text-[10.5px] font-mono text-accent flex items-center gap-1.5 bg-canvas/80 px-2.5 py-1 rounded-lg border border-line/80">
                  <Folder size={12} className="shrink-0" />
                  <span className="text-muted">Thư mục:</span>
                  <span className="truncate">/local/Hermes/Lib/{selectedNovel.title}/</span>
                </div>

              </div>

              <section className="library-book-description w-full basis-full space-y-1.5" aria-labelledby="library-book-description-title">
                <h3 id="library-book-description-title" className="text-xs font-semibold text-main">Giới thiệu</h3>
                <div className="h-40 overflow-y-auto whitespace-pre-wrap text-xs text-muted leading-relaxed bg-canvas/60 p-2.5 rounded-xl border border-line/80">
                  {selectedNovel.description || 'Chưa có nội dung giới thiệu.'}
                </div>
              </section>
            </div>

            <div className="library-detail-actions grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setSelectedNovelPage('chapters'); setSearchTerm(''); }}
                className="studio-action min-h-11"
              >
                Danh sách chương
              </button>
              <button
                type="button"
                title={readingProgress[selectedNovel.id] ? `Lần đọc gần nhất: ${savedChapters.find(chapter => chapter.id === readingProgress[selectedNovel.id].chapterId)?.title || 'Chương đã lưu'} · ${Math.round(readingProgress[selectedNovel.id].scrollRatio * 100)}%` : undefined}
                disabled={!novelChapters.length}
                onClick={() => { setReaderChapterId(undefined); setReaderBookId(selectedNovel.id); }}
                className="studio-action studio-action-primary min-h-11 disabled:opacity-40"
              >
                {readingProgress[selectedNovel.id] ? 'Đọc tiếp' : 'Đọc truyện'}
              </button>
            </div>
          </div> : <div className="library-chapters-page min-h-full space-y-3">
            <div className="grid min-h-9 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <button
                type="button"
                onClick={() => { setSelectedNovelPage('details'); setSearchTerm(''); }}
                aria-label="Về thông tin truyện; cũng có thể vuốt sang phải"
                title="Bấm hoặc vuốt sang phải để về thông tin truyện"
                className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
              >
                <ChevronLeft size={16} />
                <span>Thông tin truyện</span>
              </button>
              <h2 className="min-w-0 truncate text-center text-sm font-semibold text-main">{selectedNovel.title}</h2>
              <span className="w-4" aria-hidden="true" />
            </div>

            {/* Danh sách chương của bộ truyện */}
            <div ref={chapterListRef} className="space-y-2">
              <div className="library-chapter-toolbar flex flex-col items-stretch gap-2 text-xs rounded-xl border border-line bg-surface p-2">
                <div className="library-chapter-primary-row flex min-w-0 items-center gap-2">
                  <label className="flex shrink-0 items-center gap-1.5 text-muted cursor-pointer select-none" title="Chọn hoặc bỏ chọn toàn bộ chương đang hiển thị">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả chương đang hiển thị"
                      checked={areAllVisibleChaptersSelected}
                      onChange={toggleAllVisibleChapterSelection}
                      disabled={displayedChapters.length === 0}
                      className="w-4 h-4 rounded-full border-line bg-raised text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    {selectedChapterCount > 0 && <span className="min-w-4 text-[11px] tabular-nums">{selectedChapterCount}</span>}
                  </label>
                  <div className="relative ml-auto w-36 min-w-0 shrink sm:w-56">
                    <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="search" aria-label="Tìm chương" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Tìm chương…" className="h-8 w-full rounded-lg border border-line bg-canvas pl-6 pr-7 text-[11px] text-main outline-none focus:border-accent" />
                    <button type="button" aria-label="Xóa toàn bộ nội dung tìm kiếm" title="Xóa tìm kiếm" disabled={!searchTerm} onClick={() => setSearchTerm('')} className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted hover:text-main disabled:opacity-35"><X size={12} /></button>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <label className="relative grid h-8 w-8 place-items-center rounded-lg border border-line bg-raised text-muted hover:bg-hover hover:text-main" title="Sắp xếp chương">
                      <ArrowUpDown size={14} aria-hidden="true" />
                      <select aria-label="Sắp xếp chương" value={chapterSort} onChange={e => setChapterSort(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0">
                        <option value="name_asc">Tên chương A–Z</option>
                        <option value="name_desc">Tên chương Z–A</option>
                        <option value="recent">Mới thêm</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      aria-label={`Xóa ${selectedChapterCount} chương đã chọn`}
                      onClick={() => setIsBulkDeleteOpen(true)}
                      disabled={selectedChapterCount === 0}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-raised text-danger hover:bg-hover disabled:cursor-not-allowed disabled:opacity-35"
                      title="Xóa các chương đã chọn"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {displayedChapters.length > 0 && (
                  <form className="library-chapter-pagination flex items-center gap-1.5 shrink-0" onSubmit={e => { e.preventDefault(); goToChapterPage(Number(chapterPageInput)); }}>
                    <span className="text-muted">{chapterOffset + 1}–{Math.min(chapterOffset + 100, displayedChapters.length)}/{displayedChapters.length} chương</span>
                    <button type="button" aria-label="Tập trước" disabled={currentChapterPage === 1} onClick={() => goToChapterPage(currentChapterPage - 1)} className="px-2 py-1.5 rounded bg-raised text-main disabled:opacity-30">‹</button>
                    <label className="flex items-center gap-1 text-muted">Tập
                      <input aria-label="Số tập" type="number" min={1} max={chapterPageCount} step={1} required value={chapterPageInput} onChange={e => setChapterPageInput(e.target.value)} className="w-16 px-2 py-1 rounded border border-line bg-surface text-main" />
                      / {chapterPageCount}
                    </label>
                    <button type="submit" className="px-2 py-1.5 rounded bg-accent text-main">Đến</button>
                    <button type="button" aria-label="Tập sau" disabled={currentChapterPage === chapterPageCount} onClick={() => goToChapterPage(currentChapterPage + 1)} className="px-2 py-1.5 rounded bg-raised text-main disabled:opacity-30">›</button>
                  </form>
                )}
              </div>

              {novelChapters.length === 0 ? (
                <div className="p-8 text-center text-muted rounded-xl bg-surface/60 border border-line text-xs space-y-2">
                  <p>Chưa có chương nào được lưu cho bộ truyện này.</p>
                  <button
                    onClick={() => {
                      setActiveNovelTitle(selectedNovel.title);
                      setActiveNovelId(selectedNovel.id);
                      setActiveTab('translate');
                    }}
                    className="px-3 py-1.5 bg-accent text-main rounded-lg text-xs font-medium hover:bg-accent"
                  >
                    Dịch chương mới ngay
                  </button>
                </div>
              ) : (
                <div className="library-chapter-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
                {displayedChapters.length === 0 && <p className="text-xs text-muted py-4">Không tìm thấy chương phù hợp.</p>}
                {pageChapters.map((chap, index) => {
                  const parsed = parseChapterHeader(chap.title);
                  const prefix = chap.chapterPrefix || parsed.prefix;
                  const name = chap.chapterName || parsed.name || (chap.title !== prefix ? chap.title.replace(prefix, '').replace(/^[:\s\-]+/, '') : '');

                  return (
                    <div
                      key={chap.id}
                      onClick={() => handleOpenChapter(chap)}
                      className="library-chapter-row px-2 py-1 rounded-lg bg-surface border border-line hover:border-accent/50 cursor-pointer transition-all flex items-center justify-between gap-1.5 text-xs group"
                    >
                      <label className="shrink-0 flex items-center cursor-pointer" onClick={event => event.stopPropagation()} title={`Chọn ${chap.title}`}>
                        <input
                          type="checkbox"
                          checked={selectedChapterIds.has(chap.id)}
                          onChange={() => toggleChapterSelection(chap.id)}
                          aria-label={`Chọn ${chap.title}`}
                          className="w-4 h-4 rounded-full border-line bg-raised text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                      </label>
                      <span className="text-muted tabular-nums shrink-0 text-[10px]" title="Số thứ tự">{chapterOffset + index + 1}.</span>
                      <div className="flex-1 min-w-0">
                        {/* Chương luôn đi kèm tên chương bên cạnh */}
                        <div className="flex items-center gap-1.5" title={chap.title}>
                          <span className="px-1.5 py-0.5 rounded-md bg-accent-soft/80 text-accent font-bold border border-accent/60 text-[11px] shrink-0">
                            {prefix}
                          </span>
                          <h4 className="font-semibold text-main group-hover:text-accent transition-colors truncate">
                            {name || chap.title}
                          </h4>
                        </div>

                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditingChapter(chap)} className="p-1.5 text-muted hover:text-accent hover:bg-raised rounded-lg" aria-label={`Sửa ${chap.title}`} title="Sửa chương"><Edit3 size={14} /></button>
                        <button
                          onClick={(e) => handleDownloadTxt(chap, e)}
                          className="p-1.5 text-muted hover:text-main hover:bg-raised rounded-lg"
                          title="Tải file .txt"
                        >
                          <Download size={14} />
                        </button>

                        <button
                          onClick={() => { void deleteSavedChapter(chap.id).catch(error => showToast(String(error), true)); }}
                          className="p-1.5 text-muted hover:text-rose-400 hover:bg-raised rounded-lg"
                          title="Xóa chương này"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </div>}
          </div>
        ) : (
          /* VIEW 2: Danh Sách Các Bộ Truyện (Tất cả hoặc Yêu thích) */
          sortedAndFilteredNovels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted">
              {activeSubView === 'favorites' ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-rose-950/40 border border-rose-900/60 flex items-center justify-center mb-3 text-rose-500">
                    <Heart size={28} className="fill-rose-500/20" />
                  </div>
                  <p className="text-sm font-semibold text-main">Chưa có truyện nào trong danh sách Yêu thích</p>
                  <p className="text-xs text-muted mt-1 max-w-sm">
                    Hãy bấm vào biểu tượng hình trái tim ở góc bìa truyện để thêm truyện vào danh sách yêu thích của bạn!
                  </p>
                </>
              ) : (
                <>
                  <Book size={36} className="mb-2 text-muted stroke-[1.5]" />
                  <p className="text-sm font-medium text-muted">Không tìm thấy bộ truyện nào</p>
                  <button
                    onClick={handleOpenAddNovelModal}
                    className="mt-3 px-4 py-2 bg-accent hover:bg-accent text-main rounded-xl text-xs font-medium cursor-pointer"
                  >
                    + Thêm Mới Truyện
                  </button>
                </>
              )}
            </div>
          ) : libraryViewMode === 'grid' ? (
            /* DẠNG 1: Ô LƯỚI (TỔNG QUAN) */
            <div data-novel-grid className="grid grid-cols-1 @min-[340px]/library:grid-cols-2 @min-[600px]/library:grid-cols-3 @min-[900px]/library:grid-cols-4 gap-3">
              {sortedAndFilteredNovels.map((novel) => {
                const chaps = savedChapters.filter(c => chapterBelongsToNovel(c, novel));
                const count = chaps.length;
                const latestChap = chaps.length > 0 ? chaps.reduce((prev, curr) => curr.savedAt > prev.savedAt ? curr : prev) : null;
                const latestParsed = latestChap ? parseChapterHeader(latestChap.title) : null;

                return (
                  <div
                    key={novel.id}
                    onClick={() => openNovelDetails(novel.id)}
                    className="rounded-2xl bg-surface border border-line hover:border-accent/50 cursor-pointer transition-all flex flex-col group overflow-hidden shadow-sm hover:shadow-cyan-950/30"
                  >
                    {/* Bìa sách kèm Huy hiệu số chương, thể loại & Nút Yêu thích */}
                    <div data-book-cover className="relative aspect-3/4 w-full bg-canvas overflow-hidden">
                      <img
                        src={novel.coverUrl || PRESET_COVERS[0]}
                        alt={novel.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/30" />

                      {/* Huy hiệu số chương */}
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-accent font-bold text-[10px] border border-accent/30 shadow-xs">
                          {count} chương
                        </span>
                      </div>

                      {/* Thể loại */}
                      <div className="absolute top-2 left-2 right-2">
                        <span className="px-1.5 py-0.5 rounded-md bg-surface/80 backdrop-blur-xs text-main text-[10px] border border-line/60 truncate max-w-full block">
                          {novel.genre || 'Huyền huyễn'}
                        </span>
                      </div>

                      {/* Nút bấm Trái Tim Yêu thích ngay trên bìa */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleFavoriteNovel(novel.id).catch(error => showToast(String(error), true));
                          showToast(novel.isFavorite ? `Đã bỏ thích "${novel.title}"` : `Đã thêm "${novel.title}" vào Yêu thích`);
                        }}
                        className={`absolute bottom-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md ${
                          novel.isFavorite
                            ? 'bg-rose-600 text-main shadow-rose-950/60 scale-105 ring-2 ring-rose-400/80'
                            : 'bg-black/60 text-main hover:text-rose-400 hover:bg-black/85'
                        }`}
                        title={novel.isFavorite ? "Bỏ yêu thích" : "Yêu thích truyện này"}
                        aria-label={novel.isFavorite ? "Bỏ yêu thích" : "Yêu thích truyện này"}
                      >
                        <Heart size={14} className={novel.isFavorite ? "fill-white" : ""} />
                      </button>
                    </div>

                    {/* Chi tiết tóm tắt */}
                    <div className="p-3 min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 title={novel.title} className="text-sm leading-5 min-h-10 font-bold text-main group-hover:text-accent line-clamp-3 break-words">
                          {novel.title}
                        </h3>
                        <p className="text-[11px] text-muted truncate mt-0.5">
                          {novel.author || 'Khuyết danh'}
                        </p>

                        {/* Chương mới nhất đi kèm số chương và tên chương bên cạnh */}
                        {latestChap ? (
                          <div className={`mt-2 p-1.5 rounded-lg border text-[11px] ${
                            isLight ? 'bg-raised/80 border-line' : isSepia ? 'bg-surface/60 border-line' : 'bg-canvas/80 border-line/80'
                          }`}>
                            <span className="text-accent font-medium block truncate">
                              {latestChap.chapterPrefix || latestParsed?.prefix}
                              {(latestChap.chapterName || latestParsed?.name) ? `: ${latestChap.chapterName || latestParsed?.name}` : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] opacity-50 italic">
                            Chưa có chương nào
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* DẠNG 2: DANH SÁCH (CHI TIẾT) */
            <div className="space-y-3">
              {sortedAndFilteredNovels.map((novel) => {
                const chaps = savedChapters.filter(c => chapterBelongsToNovel(c, novel));
                const count = chaps.length;
                const latestChap = chaps.length > 0 ? chaps.reduce((prev, curr) => curr.savedAt > prev.savedAt ? curr : prev) : null;
                const latestParsed = latestChap ? parseChapterHeader(latestChap.title) : null;

                return (
                  <div
                    key={novel.id}
                    onClick={() => openNovelDetails(novel.id)}
                    className={`p-3.5 rounded-2xl border hover:border-accent/50 cursor-pointer transition-all flex flex-col sm:flex-row gap-3.5 group shadow-sm ${
                      isLight 
                        ? 'bg-surface border-line text-main' 
                        : isSepia 
                          ? 'bg-surface border-line text-main' 
                          : 'bg-surface border-line text-main'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={novel.coverUrl || PRESET_COVERS[0]}
                        alt={novel.title}
                        className="w-20 h-28 object-cover rounded-xl shadow-md border border-line/80 group-hover:scale-102 transition-transform self-start"
                      />
                      {novel.isFavorite && (
                        <div className="absolute top-1 left-1 p-1 bg-rose-600 rounded-full text-main shadow-xs">
                          <Heart size={10} className="fill-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        {/* Hàng tiêu đề: Tên truyện bên trái, Sửa/Xóa/Yêu thích/Số chương gom lên góc trên bên phải */}
                        <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold truncate group-hover:text-accent">
                              {novel.title}
                            </h3>
                            {novel.originalTitle && (
                              <p className="text-[11px] opacity-70 font-reading">
                                {novel.originalTitle}
                              </p>
                            )}
                          </div>

                          {/* Mang phần sửa xóa truyện lên trên cùng hàng với nút yêu thích và số chương */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleOpenEditNovelModal(novel, e)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isLight 
                                  ? 'bg-raised text-muted border-line hover:text-accent hover:bg-raised' 
                                  : isSepia 
                                    ? 'bg-surface text-main border-line hover:bg-surface' 
                                    : 'bg-raised text-main border-line hover:text-accent hover:bg-hover'
                              }`}
                              title="Sửa thông tin truyện"
                            >
                              <Edit3 size={13} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNovelToDelete(novel);
                              }}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isLight 
                                  ? 'bg-raised text-muted border-line hover:text-rose-600 hover:bg-rose-50' 
                                  : isSepia 
                                    ? 'bg-surface text-main border-line hover:text-rose-700 hover:bg-surface' 
                                    : 'bg-raised text-main border-line hover:text-rose-400 hover:bg-hover'
                              }`}
                              title="Xóa bộ truyện"
                            >
                              <Trash2 size={13} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleFavoriteNovel(novel.id).catch(error => showToast(String(error), true));
                                showToast(novel.isFavorite ? `Đã bỏ thích "${novel.title}"` : `Đã thêm "${novel.title}" vào Yêu thích`);
                              }}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                novel.isFavorite
                                  ? 'bg-rose-950/60 text-rose-400 border-rose-800/80 shadow-xs'
                                  : isLight 
                                    ? 'bg-raised text-muted border-line hover:text-rose-500' 
                                    : isSepia 
                                      ? 'bg-surface text-main border-line hover:text-rose-600' 
                                      : 'bg-raised text-muted border-line hover:text-rose-400 hover:bg-hover'
                              }`}
                              title={novel.isFavorite ? "Bỏ yêu thích" : "Yêu thích truyện này"}
                            >
                              <Heart size={14} className={novel.isFavorite ? "fill-rose-500 text-rose-500" : ""} />
                            </button>

                            <span className="px-2 py-0.5 rounded-md bg-accent-soft/60 text-accent font-semibold text-xs border border-accent/60">
                              {count} chương
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs opacity-75 flex-wrap mt-1">
                          <span>Tác giả: <strong className="opacity-95">{novel.author || 'Khuyết danh'}</strong></span>
                          <span>·</span>
                          <span>{novel.genre || 'Huyền huyễn'}</span>
                        </div>

                        {novel.description && (
                          <p className="text-xs opacity-75 line-clamp-2 mt-1.5 leading-relaxed">
                            {novel.description}
                          </p>
                        )}

                        {/* Chương mới nhất đi kèm số chương và tên chương bên cạnh */}
                        {latestChap && (
                          <div className={`mt-2 px-2.5 py-1.5 rounded-lg border flex items-center gap-2 text-xs ${
                            isLight ? 'bg-canvas border-line' : isSepia ? 'bg-surface/50 border-line' : 'bg-canvas/80 border-line'
                          }`}>
                            <Clock size={12} className="text-accent shrink-0" />
                            <span className="opacity-75 shrink-0">Chương mới nhất:</span>
                            <span className="font-bold text-accent truncate">
                              {latestChap.chapterPrefix || latestParsed?.prefix}
                              {(latestChap.chapterName || latestParsed?.name) ? `: ${latestChap.chapterName || latestParsed?.name}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Modal Thêm Mới / Chỉnh Sửa Thông Tin Truyện */}
      {novelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-surface border border-line p-5 text-main shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <h3 className="font-bold text-sm text-main">
                {editingNovelId ? 'Sửa truyện' : 'Thêm truyện'}
              </h3>
              <button
                onClick={() => setNovelModalOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-main hover:bg-raised"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted font-medium mb-1">
                  Tên truyện <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Ví dụ: Đấu Phá Thương Khung, Phàm Nhân Tu Tiên..."
                  className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-main focus:outline-none focus:border-accent font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted font-medium mb-1">
                    Tên tiếng Trung
                  </label>
                  <input
                    type="text"
                    value={modalOriginalTitle}
                    onChange={(e) => setModalOriginalTitle(e.target.value)}
                    placeholder="Ví dụ: 斗破苍穹, 凡人修仙传..."
                            className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-main font-reading focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-muted font-medium mb-1">
                    Tác giả
                  </label>
                  <input
                    type="text"
                    value={modalAuthor}
                    onChange={(e) => setModalAuthor(e.target.value)}
                    placeholder="Ví dụ: Thiên Tàm Thổ Đậu, Vong Ngữ..."
                    className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-main focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="novel-publication-status" className="block text-muted font-medium mb-1">
                  Trạng thái truyện
                </label>
                <select
                  id="novel-publication-status"
                  value={modalPublicationStatus}
                  onChange={(event) => setModalPublicationStatus(event.target.value as 'ongoing' | 'completed')}
                  className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-main focus:outline-none focus:border-accent"
                >
                  <option value="ongoing">Đang ra</option>
                  <option value="completed">Đã hoàn thành</option>
                </select>
              </div>

              {/* Multi-genre Checkbox Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-muted font-medium">
                    Thể Loại Truyện (Có thể đánh dấu tích chọn nhiều thể loại):
                  </label>
                  <span className="text-[11px] text-accent font-medium">
                    Đã chọn {modalGenres.length} thể loại
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-2.5 bg-canvas border border-line rounded-xl scrollbar-thin scrollbar-thumb-neutral-800">
                  {NOVEL_GENRES.map((g) => {
                    const isChecked = modalGenres.includes(g);
                    return (
                      <label
                        key={g}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-accent-soft/70 border-accent/80 text-accent font-medium'
                            : 'bg-surface/60 border-line/80 text-muted hover:text-main hover:border-line'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setModalGenres(modalGenres.filter(item => item !== g));
                            } else {
                              setModalGenres([...modalGenres, g]);
                            }
                          }}
                          className="rounded border-line bg-raised text-accent focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="truncate">{g}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Cover Image Selector: Local File Upload & URL */}
              <div>
                <label className="block text-muted font-medium mb-1.5">
                  Ảnh Bìa Truyện (Chọn từ bộ nhớ máy hoặc nhập URL):
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={modalCoverUrl}
                    onChange={(e) => setModalCoverUrl(e.target.value)}
                    placeholder="https://... hoặc tải từ máy"
                    className="flex-1 bg-canvas border border-line rounded-lg px-3 py-2 text-main focus:outline-none focus:border-accent text-[11px]"
                  />

                  {/* Hidden file input for uploading from local storage */}
                  <input
                    type="file"
                    ref={localCoverInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleLocalCoverUpload}
                  />

                  <button
                    type="button"
                    onClick={() => localCoverInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-raised hover:bg-hover text-accent hover:text-main rounded-lg border border-line text-xs font-medium cursor-pointer shrink-0 transition-colors"
                    title="Chọn tệp ảnh từ bộ nhớ thiết bị"
                  >
                    <Upload size={13} />
                    <span>Chọn ảnh từ máy</span>
                  </button>

                  <img
                    src={modalCoverUrl}
                    alt="Preview"
                    className="w-9 h-11 object-cover rounded-md border border-line shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = PRESET_COVERS[0];
                    }}
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {PRESET_COVERS.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt="Preset"
                      onClick={() => setModalCoverUrl(url)}
                      className={`w-10 h-14 object-cover rounded-md cursor-pointer border transition-all shrink-0 ${
                        modalCoverUrl === url ? 'border-accent ring-2 ring-accent/50 scale-105' : 'border-line opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-muted font-medium mb-1">
                  Giới thiệu
                </label>
                <textarea
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="Nhập tóm tắt cốt truyện, thế giới quan, nhân vật chính..."
                  className="w-full h-24 p-3 bg-canvas border border-line rounded-lg text-main placeholder-subtle focus:outline-none focus:border-accent leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-line mt-4">
              <button
                onClick={() => setNovelModalOpen(false)}
                className="px-3 py-2 bg-raised hover:bg-hover text-main rounded-xl text-xs font-medium"
              >
                Hủy bỏ
              </button>

              <button
                onClick={handleSaveNovel}
                className="px-4 py-2 bg-accent hover:bg-accent text-main rounded-xl text-xs font-semibold shadow-xs"
              >
                {editingNovelId ? 'Lưu thay đổi' : 'Tạo truyện'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ratingNovel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setRatingNovel(null); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="novel-rating-title"
            className="novel-rating-dialog w-full max-w-md rounded-2xl bg-surface border border-line p-5 text-main shadow-2xl"
            onKeyDown={(event) => { if (event.key === 'Escape') setRatingNovel(null); }}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
              <div className="min-w-0">
                <h3 id="novel-rating-title" className="font-bold text-sm">Đánh giá truyện</h3>
                <p className="mt-1 truncate text-xs text-muted">{ratingNovel.title}</p>
              </div>
              <button type="button" className="library-icon-action" aria-label="Đóng" onClick={() => setRatingNovel(null)}>
                <X size={16} />
              </button>
            </div>

            <fieldset className="mt-5">
              <legend className="w-full text-center text-xs text-muted">
                {ratingValue ? `${ratingValue}/5 sao` : 'Chọn số sao'}
              </legend>
              <div className="novel-rating-stars mt-3 flex items-center justify-center gap-2" role="radiogroup" aria-label="Điểm đánh giá">
                {([1, 2, 3, 4, 5] as const).map(star => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={ratingValue === star}
                    aria-label={`${star} sao`}
                    autoFocus={star === (ratingValue || 1)}
                    className={star <= ratingValue ? 'is-selected' : ''}
                    onClick={() => setRatingValue(star)}
                  >
                    <Star size={30} className={star <= ratingValue ? 'fill-current' : ''} />
                  </button>
                ))}
              </div>
            </fieldset>

            <label htmlFor="novel-rating-review" className="mt-5 block text-xs font-medium text-muted">Nhận xét</label>
            <textarea
              id="novel-rating-review"
              value={ratingReview}
              onChange={(event) => setRatingReview(event.target.value)}
              maxLength={1000}
              placeholder="Viết đánh giá của bạn về truyện..."
              className="mt-1.5 h-28 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm text-main placeholder-subtle focus:border-accent focus:outline-none"
            />
            <div className="mt-1 text-right text-[10px] text-muted">{ratingReview.length}/1000</div>

            <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
              <button type="button" className="studio-action" onClick={() => setRatingNovel(null)}>Hủy</button>
              <button type="button" className="studio-action studio-action-primary" disabled={ratingValue === 0} onClick={handleSaveRating}>Lưu đánh giá</button>
            </div>
          </section>
        </div>
      )}

      {/* Toast Notification Banner */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-line p-5 text-main shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-raised border border-line text-danger flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-main">Xóa chương đã chọn?</h3>
                <p className="text-xs text-muted mt-0.5">Hành động này không thể hoàn tác.</p>
              </div>
            </div>
            <p className="text-xs text-main leading-relaxed bg-canvas/80 p-3 rounded-xl border border-line">
              Bạn sắp xóa <strong className="text-accent">{selectedChapterCount} chương</strong> đã chọn khỏi bộ truyện này.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setIsBulkDeleteOpen(false)}
                className="px-4 py-2 bg-raised hover:bg-hover text-main rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedChapters}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Bộ Truyện */}
      {novelToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-line p-5 text-main shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-raised border border-line text-danger flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-main">Xóa Bộ Truyện?</h3>
                <p className="text-xs text-muted mt-0.5">Hành động này không thể hoàn tác.</p>
              </div>
            </div>

            <p className="text-xs text-main leading-relaxed bg-canvas/80 p-3 rounded-xl border border-line">
              Bạn có chắc chắn muốn xóa bộ truyện <strong className="text-accent">"{novelToDelete.title}"</strong> cùng toàn bộ các chương đã lưu trong tủ không?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setNovelToDelete(null)}
                className="px-4 py-2 bg-raised hover:bg-hover text-main rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  try {
                  await deleteNovel(novelToDelete.id);
                  if (selectedNovelId === novelToDelete.id) {
                    setSelectedNovelId(null);
                  }
                  setNovelToDelete(null);
                  showToast('Đã xóa bộ truyện');
                  } catch (error) { showToast('Không xóa được truyện: ' + String(error), true); }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-main rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
