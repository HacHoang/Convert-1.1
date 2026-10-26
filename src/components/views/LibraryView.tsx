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
  Folder
} from 'lucide-react';

export const LibraryView: React.FC = () => {
  const { 
    novelsList,
    addNovel,
    updateNovel,
    deleteNovel,
    savedChapters, 
    deleteSavedChapter, 
    saveChapter,
    setActiveTab, 
    setActiveRawText, 
    setActiveChapterTitle, 
    setActiveNovelTitle,
    setActiveNovelId 
  } = useApp();

  const [activeSubView, setActiveSubView] = useState<'novels' | 'chapters'>('novels');
  const [selectedNovelId, setSelectedNovelId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
  const [modalGenre, setModalGenre] = useState('Huyền huyễn / Dị giới');
  const [modalCoverUrl, setModalCoverUrl] = useState(PRESET_COVERS[0]);
  const [modalDescription, setModalDescription] = useState('');
  
  // Custom Confirmation Modal for Deleting Novel (Fixes window.confirm blocked in iframe)
  const [novelToDelete, setNovelToDelete] = useState<NovelBook | null>(null);
  const [toastState, setToastState] = useState<{ message: string; isError?: boolean } | null>(null);

  const showToast = (message: string, isError: boolean = false) => {
    setToastState({ message, isError });
    setTimeout(() => setToastState(null), 2500);
  };

  const selectedNovel = novelsList.find(n => n.id === selectedNovelId);

  // Mở modal thêm truyện mới
  const handleOpenAddNovelModal = () => {
    setEditingNovelId(null);
    setModalTitle('');
    setModalOriginalTitle('');
    setModalAuthor('');
    setModalGenre('Huyền huyễn / Dị giới');
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
    setModalGenre(novel.genre || 'Huyền huyễn / Dị giới');
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

    if (editingNovelId) {
      updateNovel(editingNovelId, {
        title: modalTitle.trim(),
        originalTitle: modalOriginalTitle.trim(),
        author: modalAuthor.trim(),
        genre: modalGenre.trim(),
        coverUrl: modalCoverUrl.trim(),
        description: modalDescription.trim(),
      });
    } else {
      addNovel({
        title: modalTitle.trim(),
        originalTitle: modalOriginalTitle.trim(),
        author: modalAuthor.trim() || 'Khuyết danh',
        genre: modalGenre.trim(),
        coverUrl: modalCoverUrl.trim(),
        description: modalDescription.trim(),
      });
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

  // Lọc và sắp xếp danh sách truyện
  const sortedAndFilteredNovels = useMemo(() => {
    const list = novelsList.filter(n => 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
  }, [novelsList, searchTerm, sortOption, savedChapters]);

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
    <div className="flex-1 flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Top Header: Subtabs, Toolbar & Search */}
      <div className="shrink-0 p-3 bg-neutral-900 border-b border-neutral-800 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Subtab Toggle */}
          <div className="flex items-center p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => {
                setActiveSubView('novels');
                setSelectedNovelId(null);
              }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                activeSubView === 'novels' && !selectedNovelId
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Book size={14} />
              <span>Bộ Truyện ({novelsList.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveSubView('chapters');
                setSelectedNovelId(null);
              }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                activeSubView === 'chapters'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileText size={14} />
              <span>Tất Cả Chương ({savedChapters.length})</span>
            </button>
          </div>

          {/* Right Toolbar: View mode switcher, Sort button & Add novel */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Nút chuyển đổi danh sách xem: Ô lưới (tổng quan) vs Danh sách (chi tiết) */}
            {activeSubView === 'novels' && !selectedNovelId && (
              <>
                <button
                  onClick={handleToggleViewMode}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-neutral-700 transition-colors"
                  title={libraryViewMode === 'grid' ? 'Xem danh sách' : 'Xem dạng lưới'}
                  aria-label="Chuyển đổi giao diện xem"
                >
                  {libraryViewMode === 'grid' ? <List size={15} /> : <LayoutGrid size={15} />}
                </button>

                {/* Nút sắp xếp truyện: A-Z, Z-A, ngày cập nhật chương */}
                <div ref={sortMenuRef} className="relative">
                  <button
                    onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                    className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                      isSortMenuOpen 
                        ? 'bg-cyan-600 text-white border-cyan-500' 
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white hover:bg-neutral-700'
                    }`}
                    title="Sắp xếp"
                    aria-label="Sắp xếp"
                  >
                    <ArrowUpDown size={15} />
                  </button>

                  {/* Popover danh sách sắp xếp */}
                  {isSortMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-60 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs animate-in zoom-in-95 duration-100">
                      <div className="px-2.5 py-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 mb-1">
                        Sắp xếp truyện theo
                      </div>
                      <button
                        onClick={() => handleSelectSort('recent')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-neutral-800 transition-colors"
                      >
                        <span className={sortOption === 'recent' ? 'text-cyan-400 font-semibold' : 'text-neutral-300'}>
                          Chương mới cập nhật nhất
                        </span>
                        {sortOption === 'recent' && <Check size={14} className="text-cyan-400" />}
                      </button>

                      <button
                        onClick={() => handleSelectSort('oldest')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-neutral-800 transition-colors"
                      >
                        <span className={sortOption === 'oldest' ? 'text-cyan-400 font-semibold' : 'text-neutral-300'}>
                          Chương cũ nhất
                        </span>
                        {sortOption === 'oldest' && <Check size={14} className="text-cyan-400" />}
                      </button>

                      <button
                        onClick={() => handleSelectSort('name_asc')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-neutral-800 transition-colors"
                      >
                        <span className={sortOption === 'name_asc' ? 'text-cyan-400 font-semibold' : 'text-neutral-300'}>
                          Tên truyện: A → Z
                        </span>
                        {sortOption === 'name_asc' && <Check size={14} className="text-cyan-400" />}
                      </button>

                      <button
                        onClick={() => handleSelectSort('name_desc')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-neutral-800 transition-colors"
                      >
                        <span className={sortOption === 'name_desc' ? 'text-cyan-400 font-semibold' : 'text-neutral-300'}>
                          Tên truyện: Z → A
                        </span>
                        {sortOption === 'name_desc' && <Check size={14} className="text-cyan-400" />}
                      </button>

                      <button
                        onClick={() => handleSelectSort('chapters_count')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-neutral-800 transition-colors"
                      >
                        <span className={sortOption === 'chapters_count' ? 'text-cyan-400 font-semibold' : 'text-neutral-300'}>
                          Số lượng chương nhiều nhất
                        </span>
                        {sortOption === 'chapters_count' && <Check size={14} className="text-cyan-400" />}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Nút Thêm Mới Truyện */}
            <button
              onClick={handleOpenAddNovelModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus size={14} />
              <span>Thêm Truyện</span>
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              selectedNovelId 
                ? `Tìm chương trong ${selectedNovel?.title}...` 
                : activeSubView === 'novels' 
                  ? "Tìm truyện theo tên, tác giả, thể loại..." 
                  : "Tìm chương đã lưu..."
            }
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
          />
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
                      onClick={() => handleOpenEditNovelModal(selectedNovel)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium border border-neutral-700 transition-colors"
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
        ) : activeSubView === 'novels' ? (
          // VIEW 2: Danh sách các bộ truyện (Hỗ trợ Ô lưới tổng quan & Danh sách chi tiết)
          sortedAndFilteredNovels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
              <Book size={36} className="mb-2 text-neutral-600 stroke-[1.5]" />
              <p className="text-sm font-medium text-neutral-400">Không tìm thấy bộ truyện nào</p>
              <button
                onClick={handleOpenAddNovelModal}
                className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium"
              >
                + Thêm Mới Truyện
              </button>
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
                    {/* Bìa sách kèm Huy hiệu số chương & thể loại */}
                    <div className="relative aspect-3/4 w-full bg-neutral-950 overflow-hidden">
                      <img
                        src={novel.coverUrl || PRESET_COVERS[0]}
                        alt={novel.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/30" />

                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-cyan-300 font-bold text-[10px] border border-cyan-500/30 shadow-xs">
                          {count} chương
                        </span>
                      </div>

                      <div className="absolute top-2 left-2">
                        <span className="px-1.5 py-0.5 rounded-md bg-neutral-900/80 backdrop-blur-xs text-neutral-300 text-[10px] border border-neutral-700/60 truncate max-w-24 block">
                          {novel.genre || 'Huyền huyễn'}
                        </span>
                      </div>
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
                          <div className="mt-2 p-1.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 text-[11px]">
                            <span className="text-cyan-400 font-medium block truncate">
                              {latestChap.chapterPrefix || latestParsed?.prefix}
                              {(latestChap.chapterName || latestParsed?.name) ? `: ${latestChap.chapterName || latestParsed?.name}` : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] text-neutral-500 italic">
                            Chưa có chương nào
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500">
                        <span className="font-mono truncate">/local/.../Lib/</span>
                        <span className="text-cyan-400 group-hover:translate-x-0.5 transition-transform font-medium flex items-center gap-0.5">
                          Xem <ArrowRight size={11} />
                        </span>
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
                    className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 cursor-pointer transition-all flex flex-col sm:flex-row gap-3.5 group shadow-sm"
                  >
                    <img
                      src={novel.coverUrl || PRESET_COVERS[0]}
                      alt={novel.title}
                      className="w-20 h-28 object-cover rounded-xl shadow-md border border-neutral-700/80 shrink-0 group-hover:scale-102 transition-transform self-start"
                    />

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                          <div>
                            <h3 className="text-sm font-bold text-neutral-100 group-hover:text-cyan-300 truncate">
                              {novel.title}
                            </h3>
                            {novel.originalTitle && (
                              <p className="text-[11px] text-neutral-400 font-serif">
                                {novel.originalTitle}
                              </p>
                            )}
                          </div>

                          <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-cyan-300 font-semibold text-xs border border-neutral-700/60">
                            {count} chương
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-neutral-400 flex-wrap mt-1">
                          <span>Tác giả: <strong className="text-neutral-200">{novel.author || 'Khuyết danh'}</strong></span>
                          <span>·</span>
                          <span className="text-neutral-400">{novel.genre || 'Huyền huyễn'}</span>
                          <span>·</span>
                          <span className="font-mono text-[10.5px] text-neutral-500 flex items-center gap-1">
                            <Folder size={11} className="text-cyan-400" />
                            /local/Convert/Lib/{novel.title}/
                          </span>
                        </div>

                        {novel.description && (
                          <p className="text-xs text-neutral-400 line-clamp-2 mt-1.5 leading-relaxed">
                            {novel.description}
                          </p>
                        )}

                        {/* Chương mới nhất đi kèm số chương và tên chương bên cạnh */}
                        {latestChap && (
                          <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-neutral-950/80 border border-neutral-800 flex items-center gap-2 text-xs">
                            <Clock size={12} className="text-cyan-400 shrink-0" />
                            <span className="text-neutral-400 shrink-0">Chương mới nhất:</span>
                            <span className="font-bold text-cyan-300 truncate">
                              {latestChap.chapterPrefix || latestParsed?.prefix}
                              {(latestChap.chapterName || latestParsed?.name) ? `: ${latestChap.chapterName || latestParsed?.name}` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-neutral-800 text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveNovelTitle(novel.title);
                            setActiveNovelId(novel.id);
                            setActiveTab('translate');
                          }}
                          className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
                        >
                          <BookOpen size={13} />
                          <span>Dịch chương mới</span>
                        </button>

                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleOpenEditNovelModal(novel, e)}
                            className="px-2 py-1 text-neutral-400 hover:text-cyan-300 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1"
                            title="Sửa thông tin truyện"
                          >
                            <Edit3 size={13} />
                            <span>Sửa</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNovelToDelete(novel);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                            title="Xóa bộ truyện"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // VIEW 3: Danh sách tất cả các chương đã lưu (Kèm số chương và tên chương rõ ràng)
          savedChapters.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
              <BookMarked size={36} className="mb-2 text-neutral-600 stroke-[1.5]" />
              <p className="text-sm">Chưa có chương truyện nào được lưu</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {savedChapters.map(chap => {
                const dateStr = new Date(chap.savedAt).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const parsed = parseChapterHeader(chap.title);
                const prefix = chap.chapterPrefix || parsed.prefix;
                const name = chap.chapterName || parsed.name || (chap.title !== prefix ? chap.title.replace(prefix, '').replace(/^[:\s\-]+/, '') : '');

                return (
                  <div
                    key={chap.id}
                    onClick={() => handleOpenChapter(chap)}
                    className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs group shadow-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {chap.novelTitle && (
                          <span className="text-[11px] font-semibold text-cyan-400 truncate">
                            {chap.novelTitle}
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <Clock size={11} />
                          {dateStr}
                        </span>
                      </div>

                      {/* Số chương luôn đi kèm tên chương bên cạnh */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-md bg-cyan-950/80 text-cyan-400 font-bold border border-cyan-800/60 text-[11px] shrink-0">
                          {prefix}
                        </span>
                        <h4 className="text-sm font-semibold text-neutral-200 truncate group-hover:text-cyan-300">
                          {name || chap.title}
                        </h4>
                      </div>

                      {/* Đường dẫn tệp riêng */}
                      <div className="text-[10px] font-mono text-neutral-500 mt-1 flex items-center gap-1 truncate">
                        <Folder size={11} className="text-cyan-400/80 shrink-0" />
                        <span className="truncate">
                          {chap.filePath || `/local/Convert/Lib/${chap.novelTitle || 'Tieu_Thuyet'}/${chap.title}.txt`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDownloadTxt(chap, e)}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg"
                        title="Tải tệp .txt"
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

              <div>
                <label className="block text-neutral-400 font-medium mb-1">
                  Thể Loại Truyện
                </label>
                <select
                  value={modalGenre}
                  onChange={(e) => setModalGenre(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="Huyền huyễn / Dị giới">Huyền huyễn / Dị giới</option>
                  <option value="Tiên hiệp / Cổ điển">Tiên hiệp / Cổ điển</option>
                  <option value="Đô thị / Dị năng">Đô thị / Dị năng</option>
                  <option value="Kiếm hiệp / Võ lâm">Kiếm hiệp / Võ lâm</option>
                  <option value="Khoa huyễn / Mạt thế">Khoa huyễn / Mạt thế</option>
                  <option value="Hệ thống / Đồng nhân">Hệ thống / Đồng nhân</option>
                  <option value="Lịch sử / Quân sự">Lịch sử / Quân sự</option>
                </select>
              </div>

              {/* Cover Image Selector */}
              <div>
                <label className="block text-neutral-400 font-medium mb-1">
                  Ảnh Bìa Truyện (Nhập URL hoặc chọn mẫu bên dưới):
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={modalCoverUrl}
                    onChange={(e) => setModalCoverUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-cyan-500 text-[11px]"
                  />
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
