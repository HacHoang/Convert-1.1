/**
 * Tab Tủ Truyện & Quản Lý Tiểu Thuyết (Library View)
 * Hỗ trợ thêm mới truyện, chỉnh sửa thông tin (tên, tác giả, ảnh bìa, tóm tắt),
 * quản lý danh sách chương và đọc offline không cần đăng nhập.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp, SavedChapter, NovelBook, parseChapterHeader, PRESET_COVERS } from '../../context/AppContext';
import { 
  BookMarked, 
  Trash2, 
  BookOpen, 
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
  Upload
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
  'Gia đấu',
];

export const LibraryView: React.FC = () => {
  const { 
    novelsList,
    addNovel,
    updateNovel,
    deleteNovel,
    toggleFavoriteNovel,
    savedChapters, 
    deleteSavedChapter, 
    saveChapter,
    setActiveTab, 
    setActiveRawText, 
    setActiveChapterTitle, 
    setActiveNovelTitle,
    setActiveNovelId,
    settings
  } = useApp();

  const isLight = settings.theme === 'light';
  const isSepia = settings.theme === 'sepia';

  const [activeSubView, setActiveSubView] = useState<'all' | 'favorites'>('all');
  const [selectedNovelId, setSelectedNovelId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Chế độ xem Tủ truyện: Ô lưới (tổng quan) hoặc Danh sách (chi tiết)
  const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const stored = localStorage.getItem('ttv_library_view_mode');
      if (stored === 'grid' || stored === 'list') return stored;
    } catch {}
    return 'grid';
  });

  // Tiêu chí sắp xếp: Mặc định theo 'recent' (Chương mới cập nhật nhất)
  const [sortOption, setSortOption] = useState<'recent' | 'oldest' | 'name_asc' | 'name_desc' | 'chapters_count'>(() => {
    try {
      const stored = localStorage.getItem('ttv_library_sort_option');
      if (stored && ['recent', 'oldest', 'name_asc', 'name_desc', 'chapters_count'].includes(stored)) {
        return stored as any;
      }
    } catch {}
    return 'recent';
  });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Đóng sort menu khi bấm ra ngoài
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Modal State: Thêm mới hoặc Chỉnh sửa truyện
  const [novelModalOpen, setNovelModalOpen] = useState(false);
  const [editingNovelId, setEditingNovelId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalOriginalTitle, setModalOriginalTitle] = useState('');
  const [modalAuthor, setModalAuthor] = useState('');
  const [modalGenres, setModalGenres] = useState<string[]>(['Huyền huyễn']);
  const [modalCoverUrl, setModalCoverUrl] = useState(PRESET_COVERS[0]);
  const [modalDescription, setModalDescription] = useState('');
  const localCoverInputRef = useRef<HTMLInputElement>(null);
  
  // Custom Confirmation Modal for Deleting Novel (Fixes window.confirm blocked in iframe)
  const [novelToDelete, setNovelToDelete] = useState<NovelBook | null>(null);
  const [toastState, setToastState] = useState<{ message: string; isError?: boolean } | null>(null);

  const showToast = (message: string, isError: boolean = false) => {
    setToastState({ message, isError });
    setTimeout(() => setToastState(null), 2500);
  };

  const selectedNovel = novelsList.find(n => n.id === selectedNovelId);

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
    setModalCoverUrl(novel.coverUrl || PRESET_COVERS[0]);
    setModalDescription(novel.description || '');
    setNovelModalOpen(true);
  };

  // Lưu thông tin truyện (Thêm mới hoặc Cập nhật)
  const handleSaveNovel = () => {
    if (!modalTitle.trim()) {
      showToast('Vui lòng nhập tên bộ truyện!', true);
      return;
    }
    const genreString = modalGenres.length > 0 ? modalGenres.join(' · ') : 'Huyền huyễn';

    if (editingNovelId) {
      updateNovel(editingNovelId, {
        title: modalTitle.trim(),
        originalTitle: modalOriginalTitle.trim(),
        author: modalAuthor.trim(),
        genres: modalGenres,
        genre: genreString,
        coverUrl: modalCoverUrl.trim(),
        description: modalDescription.trim(),
      });
      showToast('Đã lưu thay đổi bộ truyện');
    } else {
      addNovel({
        title: modalTitle.trim(),
        originalTitle: modalOriginalTitle.trim(),
        author: modalAuthor.trim() || 'Khuyết danh',
        genres: modalGenres,
        genre: genreString,
        coverUrl: modalCoverUrl.trim(),
        description: modalDescription.trim(),
      });
      showToast('Đã tạo bộ truyện mới');
    }

    setNovelModalOpen(false);
  };

  // Mở chương để dịch / đọc
  const handleOpenChapter = (chap: SavedChapter) => {
    setActiveRawText(chap.originalText);
    setActiveChapterTitle(chap.title);
    setActiveNovelTitle(chap.novelTitle || 'Tiểu thuyết');
    if (chap.novelId) setActiveNovelId(chap.novelId);
    setActiveTab('translate');
  };

  // Tải file .txt của chương
  const handleDownloadTxt = (chap: SavedChapter, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const content = `${chap.novelTitle || ''}\n${chap.title}\n\n${chap.vietphraseText || chap.originalText}`;
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
    const chaps = savedChapters.filter(c => c.novelId === novel.id || c.novelTitle === novel.title);
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
        const countA = savedChapters.filter(c => c.novelId === a.id || c.novelTitle === a.title).length;
        const countB = savedChapters.filter(c => c.novelId === b.id || c.novelTitle === b.title).length;
        return countB - countA;
      }
      return 0;
    });
  }, [novelsList, activeSubView, searchTerm, sortOption, savedChapters]);

  const favoriteCount = useMemo(() => novelsList.filter(n => n.isFavorite).length, [novelsList]);

  // Lọc chương thuộc truyện đang chọn
  const novelChapters = savedChapters.filter(c => 
    selectedNovelId ? (c.novelId === selectedNovelId || c.novelTitle === selectedNovel?.title) : true
  );

  const handleSelectSort = (option: typeof sortOption) => {
    setSortOption(option);
    try {
      localStorage.setItem('ttv_library_sort_option', option);
    } catch {}
    setIsSortMenuOpen(false);
  };

  const handleToggleViewMode = () => {
    const next = libraryViewMode === 'grid' ? 'list' : 'grid';
    setLibraryViewMode(next);
    try {
      localStorage.setItem('ttv_library_view_mode', next);
    } catch {}
  };

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${
      isLight ? 'bg-[#f8f9fa] text-neutral-900' : isSepia ? 'bg-[#f4e6ca] text-[#3d2e1e]' : 'bg-neutral-950 text-neutral-100'
    }`}>
      {/* Top Header: Subtabs & Integrated Toolbar */}
      <div className={`shrink-0 p-2.5 sm:p-3 border-b flex items-center justify-between flex-wrap gap-2 transition-colors ${
        isLight ? 'bg-white border-neutral-200' : isSepia ? 'bg-[#ede0c8] border-[#dfcdb0]' : 'bg-neutral-900 border-neutral-800'
      }`}>
        {/* Subtab Toggle: Tất Cả vs Yêu Thích */}
        <div className={`flex items-center p-0.5 rounded-lg border text-xs ${
          isLight ? 'bg-neutral-100 border-neutral-200' : isSepia ? 'bg-[#dfcdb0] border-[#cfbe9e]' : 'bg-neutral-950 border-neutral-800'
        }`}>
          <button
            onClick={() => {
              setActiveSubView('all');
              setSelectedNovelId(null);
            }}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubView === 'all' && !selectedNovelId
                ? 'bg-cyan-600 text-white shadow-xs'
                : isLight ? 'text-neutral-600 hover:text-neutral-900' : isSepia ? 'text-[#6e553f] hover:text-[#3d2e1e]' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Book size={14} />
            <span>Tất Cả ({novelsList.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveSubView('favorites');
              setSelectedNovelId(null);
            }}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubView === 'favorites' && !selectedNovelId
                ? 'bg-rose-600 text-white shadow-xs'
                : isLight ? 'text-neutral-600 hover:text-neutral-900' : isSepia ? 'text-[#6e553f] hover:text-[#3d2e1e]' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Heart size={14} className={activeSubView === 'favorites' ? 'fill-white' : 'fill-rose-500/20 text-rose-400'} />
            <span>Yêu Thích ({favoriteCount})</span>
          </button>
        </div>

        {/* Right Toolbar: Expandable Search, View mode, Sort & Add novel */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* Tối ưu thanh tìm kiếm gọn vào toolbar: Nút kính lúp mở rộng hoặc ô input co giãn */}
          {isSearchOpen || searchTerm ? (
            <div className="relative flex items-center animate-in fade-in zoom-in-95 duration-150">
              <Search size={13} className="absolute left-2.5 text-neutral-400 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  selectedNovelId 
                    ? `Tìm chương...` 
                    : activeSubView === 'favorites'
                      ? "Tìm trong yêu thích..." 
                      : "Tìm truyện, tác giả..."
                }
                className={`w-36 sm:w-56 rounded-lg pl-7 pr-6 py-1 text-xs transition-colors focus:outline-none focus:border-cyan-500 border ${
                  isLight 
                    ? 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400' 
                    : isSepia 
                      ? 'bg-[#fbf0d9] border-[#dfcdb0] text-[#3d2e1e] placeholder-[#a69279]' 
                      : 'bg-neutral-950 border-neutral-700 text-neutral-200 placeholder-neutral-500'
                }`}
              />
              <button
                onClick={() => {
                  setSearchTerm('');
                  setIsSearchOpen(false);
                }}
                className="absolute right-1.5 p-0.5 text-neutral-400 hover:text-neutral-200 rounded cursor-pointer"
                title="Đóng tìm kiếm"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isLight 
                  ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300' 
                  : isSepia 
                    ? 'bg-[#dfcdb0] hover:bg-[#d0be9e] text-[#3d2e1e] border-[#cfbe9e]' 
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700 hover:text-white'
              }`}
              title="Tìm kiếm truyện"
              aria-label="Tìm kiếm truyện"
            >
              <Search size={15} />
            </button>
          )}

          {/* Nút chuyển đổi danh sách xem: Ô lưới (tổng quan) vs Danh sách (chi tiết) */}
          {!selectedNovelId && (
            <>
              <button
                onClick={handleToggleViewMode}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isLight 
                    ? 'bg-neutral-100 hover:bg-neutral-200 text-cyan-600 border-neutral-300' 
                    : isSepia 
                      ? 'bg-[#dfcdb0] hover:bg-[#d0be9e] text-cyan-800 border-[#cfbe9e]' 
                      : 'bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border-neutral-700'
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
                      ? 'bg-cyan-600 text-white border-cyan-500' 
                      : isLight 
                        ? 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200' 
                        : isSepia 
                          ? 'bg-[#dfcdb0] text-[#3d2e1e] border-[#cfbe9e] hover:bg-[#d0be9e]' 
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white hover:bg-neutral-700'
                  }`}
                  title="Sắp xếp"
                  aria-label="Sắp xếp"
                >
                  <ArrowUpDown size={15} />
                </button>

                {/* Popover danh sách sắp xếp */}
                {isSortMenuOpen && (
                  <div className={`absolute right-0 top-full mt-1.5 w-60 rounded-xl shadow-2xl p-1.5 z-50 text-xs animate-in zoom-in-95 duration-100 border ${
                    isLight 
                      ? 'bg-white border-neutral-200 text-neutral-800' 
                      : isSepia 
                        ? 'bg-[#fbf0d9] border-[#dfcdb0] text-[#3d2e1e]' 
                        : 'bg-neutral-900 border-neutral-700 text-neutral-100'
                  }`}>
                    <div className="px-2.5 py-1 text-[11px] font-semibold opacity-60 uppercase tracking-wider border-b border-neutral-800/40 mb-1">
                      Sắp xếp truyện theo
                    </div>
                    <button
                      onClick={() => handleSelectSort('recent')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
                    >
                      <span className={sortOption === 'recent' ? 'text-cyan-500 font-semibold' : ''}>
                        Chương mới cập nhật nhất
                      </span>
                      {sortOption === 'recent' && <Check size={14} className="text-cyan-500" />}
                    </button>

                    <button
                      onClick={() => handleSelectSort('oldest')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
                    >
                      <span className={sortOption === 'oldest' ? 'text-cyan-500 font-semibold' : ''}>
                        Chương cũ nhất
                      </span>
                      {sortOption === 'oldest' && <Check size={14} className="text-cyan-500" />}
                    </button>

                    <button
                      onClick={() => handleSelectSort('name_asc')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
                    >
                      <span className={sortOption === 'name_asc' ? 'text-cyan-500 font-semibold' : ''}>
                        Tên truyện: A → Z
                      </span>
                      {sortOption === 'name_asc' && <Check size={14} className="text-cyan-500" />}
                    </button>

                    <button
                      onClick={() => handleSelectSort('name_desc')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
                    >
                      <span className={sortOption === 'name_desc' ? 'text-cyan-500 font-semibold' : ''}>
                        Tên truyện: Z → A
                      </span>
                      {sortOption === 'name_desc' && <Check size={14} className="text-cyan-500" />}
                    </button>

                    <button
                      onClick={() => handleSelectSort('chapters_count')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
                    >
                      <span className={sortOption === 'chapters_count' ? 'text-cyan-500 font-semibold' : ''}>
                        Số lượng chương nhiều nhất
                      </span>
                      {sortOption === 'chapters_count' && <Check size={14} className="text-cyan-500" />}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Nút Thêm Mới Truyện */}
          <button
            onClick={handleOpenAddNovelModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Thêm Truyện</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* VIEW 1: Chi tiết 1 bộ truyện (Khi đang chọn 1 truyện) */}
        {selectedNovelId && selectedNovel ? (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Nút quay lại */}
            <button
              onClick={() => setSelectedNovelId(null)}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-cyan-400 transition-colors py-1"
            >
              <ChevronLeft size={16} />
              <span>Quay lại danh sách bộ truyện</span>
            </button>

            {/* Thẻ thông tin bộ truyện */}
            <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row gap-4 items-start shadow-md">
              <img
                src={selectedNovel.coverUrl || PRESET_COVERS[0]}
                alt={selectedNovel.title}
                className="w-24 sm:w-28 h-36 object-cover rounded-xl shadow-md border border-neutral-700 shrink-0"
              />

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-neutral-100">
                      {selectedNovel.title}
                    </h2>
                    {selectedNovel.originalTitle && (
                      <p className="text-xs text-neutral-400 font-serif">
                        {selectedNovel.originalTitle}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        toggleFavoriteNovel(selectedNovel.id);
                        showToast(selectedNovel.isFavorite ? `Đã bỏ thích "${selectedNovel.title}"` : `Đã thêm "${selectedNovel.title}" vào Yêu Thích`);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        selectedNovel.isFavorite
                          ? 'bg-rose-950/60 text-rose-400 border-rose-800/80 shadow-xs'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                      }`}
                      title={selectedNovel.isFavorite ? "Bỏ yêu thích" : "Yêu thích truyện này"}
                    >
                      <Heart size={13} className={selectedNovel.isFavorite ? "fill-rose-500 text-rose-500" : ""} />
                      <span>{selectedNovel.isFavorite ? 'Đã thích' : 'Yêu thích'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditNovelModal(selectedNovel)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium border border-neutral-700 transition-colors cursor-pointer"
                      title="Chỉnh sửa thông tin truyện"
                    >
                      <Edit3 size={13} />
                      <span>Sửa thông tin</span>
                    </button>

                    <button
                      onClick={() => setNovelToDelete(selectedNovel)}
                      className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                      title="Xóa bộ truyện"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-neutral-400 flex-wrap">
                  <span>Tác giả: <strong className="text-neutral-200">{selectedNovel.author || 'Khuyết danh'}</strong></span>
                  <span>·</span>
                  <span className="px-1.5 py-0.5 rounded-sm bg-neutral-800 text-cyan-300 text-[11px] border border-neutral-700/60">
                    {selectedNovel.genre || 'Huyền huyễn'}
                  </span>
                  <span>·</span>
                  <span className="text-neutral-300 font-medium">{novelChapters.length} chương đã lưu</span>
                </div>

                {/* Đường dẫn thư mục lưu trữ */}
                <div className="text-[10.5px] font-mono text-cyan-400 flex items-center gap-1.5 bg-neutral-950/80 px-2.5 py-1 rounded-lg border border-neutral-800/80">
                  <Folder size={12} className="shrink-0" />
                  <span className="text-neutral-500">Thư mục:</span>
                  <span className="truncate">/local/Convert/Lib/{selectedNovel.title}/</span>
                </div>

                {selectedNovel.description && (
                  <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80">
                    {selectedNovel.description}
                  </p>
                )}
              </div>
            </div>

            {/* Danh sách chương của bộ truyện */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
                Danh sách chương đã lưu ({novelChapters.length})
              </h3>

              {novelChapters.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs space-y-2">
                  <p>Chưa có chương nào được lưu cho bộ truyện này.</p>
                  <button
                    onClick={() => {
                      setActiveNovelTitle(selectedNovel.title);
                      setActiveNovelId(selectedNovel.id);
                      setActiveTab('translate');
                    }}
                    className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-500"
                  >
                    Dịch chương mới ngay
                  </button>
                </div>
              ) : (
                novelChapters.map(chap => {
                  const parsed = parseChapterHeader(chap.title);
                  const prefix = chap.chapterPrefix || parsed.prefix;
                  const name = chap.chapterName || parsed.name || (chap.title !== prefix ? chap.title.replace(prefix, '').replace(/^[:\s\-]+/, '') : '');

                  return (
                    <div
                      key={chap.id}
                      onClick={() => handleOpenChapter(chap)}
                      className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 cursor-pointer transition-all flex items-center justify-between gap-3 text-xs group shadow-xs"
                    >
                      <div className="flex-1 min-w-0">
                        {/* Chương luôn đi kèm tên chương bên cạnh */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded-md bg-cyan-950/80 text-cyan-400 font-bold border border-cyan-800/60 text-[11px] shrink-0">
                            {prefix}
                          </span>
                          <h4 className="font-semibold text-neutral-100 group-hover:text-cyan-300 transition-colors truncate">
                            {name || chap.title}
                          </h4>
                        </div>

                        {/* Đường dẫn tệp riêng trong bộ nhớ máy */}
                        <div className="text-[10px] font-mono text-neutral-500 mt-1 flex items-center gap-1 truncate">
                          <Folder size={11} className="text-cyan-400/80 shrink-0" />
                          <span className="truncate">
                            {chap.filePath || `/local/Convert/Lib/${selectedNovel.title}/${chap.title}.txt`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleDownloadTxt(chap, e)}
                          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg"
                          title="Tải file .txt"
                        >
                          <Download size={14} />
                        </button>

                        <button
                          onClick={() => deleteSavedChapter(chap.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg"
                          title="Xóa chương này"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* VIEW 2: Danh Sách Các Bộ Truyện (Tất Cả hoặc Yêu Thích) */
          sortedAndFilteredNovels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
              {activeSubView === 'favorites' ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-rose-950/40 border border-rose-900/60 flex items-center justify-center mb-3 text-rose-500">
                    <Heart size={28} className="fill-rose-500/20" />
                  </div>
                  <p className="text-sm font-semibold text-neutral-200">Chưa có truyện nào trong danh sách Yêu Thích</p>
                  <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                    Hãy bấm vào biểu tượng hình trái tim ở góc bìa truyện để thêm truyện vào danh sách yêu thích của bạn!
                  </p>
                </>
              ) : (
                <>
                  <Book size={36} className="mb-2 text-neutral-600 stroke-[1.5]" />
                  <p className="text-sm font-medium text-neutral-400">Không tìm thấy bộ truyện nào</p>
                  <button
                    onClick={handleOpenAddNovelModal}
                    className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium cursor-pointer"
                  >
                    + Thêm Mới Truyện
                  </button>
                </>
              )}
            </div>
          ) : libraryViewMode === 'grid' ? (
            /* DẠNG 1: Ô LƯỚI (TỔNG QUAN) */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {sortedAndFilteredNovels.map((novel) => {
                const chaps = savedChapters.filter(c => c.novelId === novel.id || c.novelTitle === novel.title);
                const count = chaps.length;
                const latestChap = chaps.length > 0 ? chaps.reduce((prev, curr) => curr.savedAt > prev.savedAt ? curr : prev) : null;
                const latestParsed = latestChap ? parseChapterHeader(latestChap.title) : null;

                return (
                  <div
                    key={novel.id}
                    onClick={() => setSelectedNovelId(novel.id)}
                    className="rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 cursor-pointer transition-all flex flex-col group overflow-hidden shadow-sm hover:shadow-cyan-950/30"
                  >
                    {/* Bìa sách kèm Huy hiệu số chương, thể loại & Nút Yêu Thích */}
                    <div className="relative aspect-3/4 w-full bg-neutral-950 overflow-hidden">
                      <img
                        src={novel.coverUrl || PRESET_COVERS[0]}
                        alt={novel.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/30" />

                      {/* Huy hiệu số chương */}
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-cyan-300 font-bold text-[10px] border border-cyan-500/30 shadow-xs">
                          {count} chương
                        </span>
                      </div>

                      {/* Thể loại */}
                      <div className="absolute top-2 left-2">
                        <span className="px-1.5 py-0.5 rounded-md bg-neutral-900/80 backdrop-blur-xs text-neutral-300 text-[10px] border border-neutral-700/60 truncate max-w-24 block">
                          {novel.genre || 'Huyền huyễn'}
                        </span>
                      </div>

                      {/* Nút bấm Trái Tim Yêu Thích ngay trên bìa */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteNovel(novel.id);
                          showToast(novel.isFavorite ? `Đã bỏ thích "${novel.title}"` : `Đã thêm "${novel.title}" vào Yêu Thích`);
                        }}
                        className={`absolute bottom-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md ${
                          novel.isFavorite
                            ? 'bg-rose-600 text-white shadow-rose-950/60 scale-105 ring-2 ring-rose-400/80'
                            : 'bg-black/60 text-neutral-300 hover:text-rose-400 hover:bg-black/85'
                        }`}
                        title={novel.isFavorite ? "Bỏ yêu thích" : "Yêu thích truyện này"}
                        aria-label={novel.isFavorite ? "Bỏ yêu thích" : "Yêu thích truyện này"}
                      >
                        <Heart size={14} className={novel.isFavorite ? "fill-white" : ""} />
                      </button>
                    </div>

                    {/* Chi tiết tóm tắt */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-neutral-100 group-hover:text-cyan-300 truncate">
                          {novel.title}
                        </h3>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {novel.author || 'Khuyết danh'}
                        </p>

                        {/* Chương mới nhất đi kèm số chương và tên chương bên cạnh */}
                        {latestChap ? (
                          <div className={`mt-2 p-1.5 rounded-lg border text-[11px] ${
                            isLight ? 'bg-neutral-100/80 border-neutral-200' : isSepia ? 'bg-[#dfcdb0]/60 border-[#cfbe9e]' : 'bg-neutral-950/80 border-neutral-800/80'
                          }`}>
                            <span className="text-cyan-500 font-medium block truncate">
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
                const chaps = savedChapters.filter(c => c.novelId === novel.id || c.novelTitle === novel.title);
                const count = chaps.length;
                const latestChap = chaps.length > 0 ? chaps.reduce((prev, curr) => curr.savedAt > prev.savedAt ? curr : prev) : null;
                const latestParsed = latestChap ? parseChapterHeader(latestChap.title) : null;

                return (
                  <div
                    key={novel.id}
                    onClick={() => setSelectedNovelId(novel.id)}
                    className={`p-3.5 rounded-2xl border hover:border-cyan-500/50 cursor-pointer transition-all flex flex-col sm:flex-row gap-3.5 group shadow-sm ${
                      isLight 
                        ? 'bg-white border-neutral-200 text-neutral-900' 
                        : isSepia 
                          ? 'bg-[#ede0c8] border-[#dfcdb0] text-[#3d2e1e]' 
                          : 'bg-neutral-900 border-neutral-800 text-neutral-100'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={novel.coverUrl || PRESET_COVERS[0]}
                        alt={novel.title}
                        className="w-20 h-28 object-cover rounded-xl shadow-md border border-neutral-700/80 group-hover:scale-102 transition-transform self-start"
                      />
                      {novel.isFavorite && (
                        <div className="absolute top-1 left-1 p-1 bg-rose-600 rounded-full text-white shadow-xs">
                          <Heart size={10} className="fill-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        {/* Hàng tiêu đề: Tên truyện bên trái, Sửa/Xóa/Yêu thích/Số chương gom lên góc trên bên phải */}
                        <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold truncate group-hover:text-cyan-400">
                              {novel.title}
                            </h3>
                            {novel.originalTitle && (
                              <p className="text-[11px] opacity-70 font-serif">
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
                                  ? 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:text-cyan-600 hover:bg-neutral-200' 
                                  : isSepia 
                                    ? 'bg-[#dfcdb0] text-[#3d2e1e] border-[#cfbe9e] hover:bg-[#d0be9e]' 
                                    : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-cyan-300 hover:bg-neutral-700'
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
                                  ? 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:text-rose-600 hover:bg-rose-50' 
                                  : isSepia 
                                    ? 'bg-[#dfcdb0] text-[#3d2e1e] border-[#cfbe9e] hover:text-rose-700 hover:bg-[#d0be9e]' 
                                    : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-rose-400 hover:bg-neutral-700'
                              }`}
                              title="Xóa bộ truyện"
                            >
                              <Trash2 size={13} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoriteNovel(novel.id);
                                showToast(novel.isFavorite ? `Đã bỏ thích "${novel.title}"` : `Đã thêm "${novel.title}" vào Yêu Thích`);
                              }}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                novel.isFavorite
                                  ? 'bg-rose-950/60 text-rose-400 border-rose-800/80 shadow-xs'
                                  : isLight 
                                    ? 'bg-neutral-100 text-neutral-500 border-neutral-300 hover:text-rose-500' 
                                    : isSepia 
                                      ? 'bg-[#dfcdb0] text-[#6e553f] border-[#cfbe9e] hover:text-rose-600' 
                                      : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-rose-400 hover:bg-neutral-700'
                              }`}
                              title={novel.isFavorite ? "Bỏ yêu thích" : "Yêu thích truyện này"}
                            >
                              <Heart size={14} className={novel.isFavorite ? "fill-rose-500 text-rose-500" : ""} />
                            </button>

                            <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-400 font-semibold text-xs border border-cyan-800/60">
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
                            isLight ? 'bg-neutral-50 border-neutral-200' : isSepia ? 'bg-[#dfcdb0]/50 border-[#cfbe9e]' : 'bg-neutral-950/80 border-neutral-800'
                          }`}>
                            <Clock size={12} className="text-cyan-500 shrink-0" />
                            <span className="opacity-75 shrink-0">Chương mới nhất:</span>
                            <span className="font-bold text-cyan-400 truncate">
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
          <div className="w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 p-5 text-neutral-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h3 className="font-bold text-sm text-neutral-100">
                {editingNovelId ? 'Chỉnh Sửa Thông Tin Bộ Truyện' : 'Thêm Mới Bộ Truyện Vào Tủ'}
              </h3>
              <button
                onClick={() => setNovelModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-400 font-medium mb-1">
                  Tên Bộ Truyện Tiếng Việt <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Ví dụ: Đấu Phá Thương Khung, Phàm Nhân Tu Tiên..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 font-medium mb-1">
                    Tên Gốc Tiếng Trung (Nguyên tác)
                  </label>
                  <input
                    type="text"
                    value={modalOriginalTitle}
                    onChange={(e) => setModalOriginalTitle(e.target.value)}
                    placeholder="Ví dụ: 斗破苍穹, 凡人修仙传..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 font-serif focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 font-medium mb-1">
                    Tên Tác Giả
                  </label>
                  <input
                    type="text"
                    value={modalAuthor}
                    onChange={(e) => setModalAuthor(e.target.value)}
                    placeholder="Ví dụ: Thiên Tàm Thổ Đậu, Vong Ngữ..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Multi-genre Checkbox Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-neutral-400 font-medium">
                    Thể Loại Truyện (Có thể đánh dấu tích chọn nhiều thể loại):
                  </label>
                  <span className="text-[11px] text-cyan-400 font-medium">
                    Đã chọn {modalGenres.length} thể loại
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl scrollbar-thin scrollbar-thumb-neutral-800">
                  {NOVEL_GENRES.map((g) => {
                    const isChecked = modalGenres.includes(g);
                    return (
                      <label
                        key={g}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-cyan-950/70 border-cyan-500/80 text-cyan-200 font-medium'
                            : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
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
                          className="rounded border-neutral-700 bg-neutral-800 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="truncate">{g}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Cover Image Selector: Local File Upload & URL */}
              <div>
                <label className="block text-neutral-400 font-medium mb-1.5">
                  Ảnh Bìa Truyện (Chọn từ bộ nhớ máy hoặc nhập URL):
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={modalCoverUrl}
                    onChange={(e) => setModalCoverUrl(e.target.value)}
                    placeholder="https://... hoặc tải từ máy"
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-cyan-500 text-[11px]"
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
                    className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 hover:text-white rounded-lg border border-neutral-700 text-xs font-medium cursor-pointer shrink-0 transition-colors"
                    title="Chọn tệp ảnh từ bộ nhớ thiết bị"
                  >
                    <Upload size={13} />
                    <span>Chọn ảnh từ máy</span>
                  </button>

                  <img
                    src={modalCoverUrl}
                    alt="Preview"
                    className="w-9 h-11 object-cover rounded-md border border-neutral-700 shrink-0"
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
                        modalCoverUrl === url ? 'border-cyan-400 ring-2 ring-cyan-500/50 scale-105' : 'border-neutral-800 opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-medium mb-1">
                  Tóm Tắt / Giới Thiệu Nội Dung
                </label>
                <textarea
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="Nhập tóm tắt cốt truyện, thế giới quan, nhân vật chính..."
                  className="w-full h-24 p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800 mt-4">
              <button
                onClick={() => setNovelModalOpen(false)}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium"
              >
                Hủy bỏ
              </button>

              <button
                onClick={handleSaveNovel}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>{editingNovelId ? 'Lưu Thay Đổi' : 'Tạo Truyện Mới'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastState && (
        <div 
          className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 text-xs py-1.5 px-4 rounded-full shadow-xl border animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none flex items-center gap-1.5 ${
            toastState.isError
              ? 'bg-neutral-900/95 text-rose-500 border-rose-500/80 font-bold ring-1 ring-rose-500/50 shadow-rose-950/50'
              : 'bg-neutral-900/95 text-emerald-400 border-emerald-500/60 font-medium ring-1 ring-emerald-500/40 shadow-emerald-950/40'
          }`}
        >
          <span className={toastState.isError ? 'text-rose-500 font-bold tracking-wide' : 'text-emerald-400 font-semibold'}>
            {toastState.message}
          </span>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Bộ Truyện */}
      {novelToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-5 text-neutral-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-100">Xóa Bộ Truyện?</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Hành động này không thể hoàn tác.</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/80 p-3 rounded-xl border border-neutral-800">
              Bạn có chắc chắn muốn xóa bộ truyện <strong className="text-cyan-300">"{novelToDelete.title}"</strong> cùng toàn bộ các chương đã lưu trong tủ không?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setNovelToDelete(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  deleteNovel(novelToDelete.id);
                  if (selectedNovelId === novelToDelete.id) {
                    setSelectedNovelId(null);
                  }
                  setNovelToDelete(null);
                  showToast('Đã xóa bộ truyện');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
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
