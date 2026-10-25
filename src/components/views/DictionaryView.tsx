/**
 * Tab Quản Lý Từ Điển (Dictionary View)
 * Quản lý Tệp Name và Tệp Vietphrase cá nhân
 * Tương thích định dạng QuickTranslator (.txt: ChữHán=NghĩaViệt)
 * Hỗ trợ nạp tệp dung lượng lớn (~40MB+) bằng IndexedDB và chunked streaming
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { NameItem } from '../../data/defaultNames';
import { parseDictionaryFileChunked } from '../../utils/largeFileImporter';
import { 
  BookMarked, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Upload, 
  Download, 
  RotateCcw, 
  Check, 
  X,
  FileCode,
  Tag,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText
} from 'lucide-react';

const PAGE_SIZE = 50;

export const DictionaryView: React.FC = () => {
  const {
    namesList,
    deleteName,
    updateName,
    exportNamesTxt,
    importNamesTxt,
    vietphraseMap,
    addVietphrase,
    deleteVietphrase,
    exportVietphraseTxt,
    importVietphraseTxt,
    resetDictionaries,
    openInspectModal,
    importEntriesBatch,
    settings
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'names' | 'vietphrase'>('names');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Edit mode inline state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editViet, setEditViet] = useState('');
  const [editCategory, setEditCategory] = useState<NameItem['category']>('Nhân vật');

  // Import modal & Stream status
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<string | null>(null);

  // Large file 40MB chunked import progress
  const [largeFileLoading, setLargeFileLoading] = useState<{
    isLoading: boolean;
    fileName: string;
    count: number;
    percent: number;
    phase: string;
  } | null>(null);

  // Reset pagination when filter or subtab changes
  const handleTabChange = (tab: 'names' | 'vietphrase') => {
    setActiveSubTab(tab);
    setSearchTerm('');
    setSelectedCategory('all');
    setCurrentPage(1);
  };

  // Filtered Names with safety limit
  const filteredNames = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term && selectedCategory === 'all') {
      return namesList;
    }
    return namesList.filter(item => {
      const matchesSearch = !term || 
        item.chinese.toLowerCase().includes(term) ||
        item.vietnamese.toLowerCase().includes(term) ||
        (item.note && item.note.toLowerCase().includes(term));

      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [namesList, searchTerm, selectedCategory]);

  // Filtered Vietphrase
  const vietphraseEntries = useMemo(() => Object.entries(vietphraseMap), [vietphraseMap]);
  const filteredVp = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return vietphraseEntries;
    return vietphraseEntries.filter(([cn, vn]) => 
      cn.toLowerCase().includes(term) ||
      vn.toLowerCase().includes(term)
    );
  }, [vietphraseEntries, searchTerm]);

  // Pagination calculation
  const totalItems = activeSubTab === 'names' ? filteredNames.length : filteredVp.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const displayedNames = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredNames.slice(start, start + PAGE_SIZE);
  }, [filteredNames, safeCurrentPage]);

  const displayedVp = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredVp.slice(start, start + PAGE_SIZE);
  }, [filteredVp, safeCurrentPage]);

  const handleStartEdit = (item: NameItem) => {
    setEditingId(item.id);
    setEditViet(item.vietnamese);
    setEditCategory(item.category);
  };

  const handleSaveEdit = (id: string) => {
    if (!editViet.trim()) return;
    updateName(id, {
      vietnamese: editViet.trim(),
      category: editCategory,
    });
    setEditingId(null);
  };

  const handleExport = () => {
    const content = activeSubTab === 'names' ? exportNamesTxt() : exportVietphraseTxt();
    const filename = activeSubTab === 'names' ? 'Names.txt' : 'Vietphrase.txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Nhập từ dán văn bản thủ công
  const handleProcessImportText = () => {
    if (!importText.trim()) return;
    if (activeSubTab === 'names') {
      const count = importNamesTxt(importText);
      setImportResult(`Đã nhập thành công ${count} mục vào Tệp Name!`);
    } else {
      const count = importVietphraseTxt(importText);
      setImportResult(`Đã nhập thành công ${count} mục vào Tệp Vietphrase!`);
    }
    setTimeout(() => {
      setShowImportModal(false);
      setImportText('');
      setImportResult(null);
    }, 1500);
  };

  // Nạp tệp lớn (~40MB+) bằng cơ chế Chunked Streaming + IndexedDB
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowImportModal(false);
    setLargeFileLoading({
      isLoading: true,
      fileName: file.name,
      count: 0,
      percent: 0,
      phase: 'Đang đọc và phân đoạn tệp...'
    });

    try {
      // 1. Phân tích tệp theo khối không làm đứng trình duyệt
      const parsedEntries = await parseDictionaryFileChunked(file, (count, percent) => {
        setLargeFileLoading({
          isLoading: true,
          fileName: file.name,
          count,
          percent,
          phase: `Đang xử lý ${count.toLocaleString()} dòng từ vựng (${percent}%)...`
        });
      });

      // 2. Lưu trực tiếp vào IndexedDB theo batch
      setLargeFileLoading(prev => prev ? {
        ...prev,
        phase: `Đang đồng bộ ${parsedEntries.length.toLocaleString()} mục vào bộ nhớ IndexedDB...`,
        percent: 98
      } : null);

      const savedCount = await importEntriesBatch(activeSubTab, parsedEntries);

      setLargeFileLoading({
        isLoading: false,
        fileName: file.name,
        count: savedCount,
        percent: 100,
        phase: `✓ Hoàn tất! Đã nạp thành công ${savedCount.toLocaleString()} mục vào ${activeSubTab === 'names' ? 'Tệp Name' : 'Từ điển Vietphrase'}.`
      });

      setTimeout(() => {
        setLargeFileLoading(null);
      }, 3000);
    } catch (err) {
      console.error('Lỗi khi nạp tệp từ điển lớn', err);
      setLargeFileLoading({
        isLoading: false,
        fileName: file.name,
        count: 0,
        percent: 0,
        phase: 'Lỗi: Không thể phân tích tệp từ điển. Vui lòng kiểm tra định dạng UTF-8!'
      });
      setTimeout(() => {
        setLargeFileLoading(null);
      }, 3500);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden relative">
      {/* Top Header: Subtabs & Action Bar */}
      <div className="shrink-0 p-3 bg-neutral-900 border-b border-neutral-800 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Subtabs Switcher */}
          <div className="flex items-center p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => handleTabChange('names')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'names'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Tệp Name ({namesList.length.toLocaleString()})
            </button>
            <button
              onClick={() => handleTabChange('vietphrase')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'vietphrase'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Vietphrase ({vietphraseEntries.length.toLocaleString()})
            </button>
          </div>

          {/* Action Buttons: Add, Import, Export, Reset */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => openInspectModal('', '', 'Nhân vật')}
              className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
              title="Thêm mục từ vựng mới"
            >
              <Plus size={14} />
              <span>Thêm Mới</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium border border-neutral-700 flex items-center gap-1 transition-colors cursor-pointer"
              title="Nạp tệp .txt từ máy tính (Hỗ trợ file lớn 40MB)"
            >
              <Upload size={14} />
              <span>Nạp Tệp (.txt)</span>
            </button>

            <button
              onClick={handleExport}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium border border-neutral-700 flex items-center gap-1 transition-colors cursor-pointer"
              title="Xuất file .txt tải về máy"
            >
              <Download size={14} />
              <span>Xuất File</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Bạn có chắc muốn khôi phục từ điển về mặc định ban đầu?')) {
                  resetDictionaries();
                }
              }}
              className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              title="Khôi phục từ điển mặc định"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={`Tìm trong ${totalItems.toLocaleString()} từ (${activeSubTab === 'names' ? 'chữ Hán, nghĩa Việt, ghi chú' : 'từ khóa'})...`}
              className="w-full pl-9 pr-8 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {activeSubTab === 'names' && (
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-cyan-500 shrink-0"
            >
              <option value="all">Tất cả phân loại</option>
              <option value="Nhân vật">Nhân vật</option>
              <option value="Địa danh">Địa danh</option>
              <option value="Tổ chức">Tổ chức</option>
              <option value="Bảo vật / Công pháp">Bảo vật / Công pháp</option>
              <option value="Khác">Khác</option>
            </select>
          )}
        </div>
      </div>

      {/* Main List Content with Virtual / Pagination */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeSubTab === 'names' ? (
          displayedNames.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
              <BookMarked size={36} className="mb-2 text-neutral-600 stroke-[1.5]" />
              <p className="text-sm">Không tìm thấy mục Name nào</p>
              <p className="text-xs text-neutral-600 mt-1">
                Thử thay đổi từ khóa tìm kiếm hoặc bấm "Nạp Tệp" để nhập tệp Name lớn.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {displayedNames.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700/80 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-sm font-semibold text-cyan-300">
                        {item.chinese}
                      </span>
                      <span className="text-neutral-500 font-mono text-[10px]">=</span>
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editViet}
                          onChange={(e) => setEditViet(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(item.id)}
                          className="bg-neutral-950 border border-cyan-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="font-semibold text-neutral-100 truncate">
                          {item.vietnamese}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-neutral-400 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-sm bg-neutral-800 text-neutral-300 text-[10px] border border-neutral-700/60">
                        {item.category}
                      </span>
                      {item.note && (
                        <span className="text-neutral-500 truncate max-w-48">
                          {item.note}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {editingId === item.id ? (
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        className="p-1.5 text-emerald-400 hover:bg-neutral-800 rounded-lg transition-colors"
                        title="Lưu thay đổi"
                      >
                        <Check size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                        title="Sửa nhanh nghĩa Việt"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}

                    <button
                      onClick={() => deleteName(item.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors"
                      title="Xóa mục này"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          displayedVp.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
              <FileCode size={36} className="mb-2 text-neutral-600 stroke-[1.5]" />
              <p className="text-sm">Không tìm thấy cụm từ Vietphrase nào</p>
              <p className="text-xs text-neutral-600 mt-1">
                Bấm "Nạp Tệp (.txt)" để nạp tệp Vietphrase.txt (~40MB).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {displayedVp.map(([cn, vn]) => (
                <div
                  key={cn}
                  className="p-3 rounded-xl bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700/80 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-serif text-sm font-semibold text-amber-300 shrink-0">
                      {cn}
                    </span>
                    <span className="text-neutral-500 font-mono text-[10px]">=</span>
                    <span className="font-medium text-neutral-200 truncate">
                      {vn}
                    </span>
                  </div>

                  <button
                    onClick={() => deleteVietphrase(cn)}
                    className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors"
                    title="Xóa mục này"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="shrink-0 px-4 py-2 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <div>
            Hiển thị <strong>{((safeCurrentPage - 1) * PAGE_SIZE + 1).toLocaleString()}</strong> - <strong>{Math.min(safeCurrentPage * PAGE_SIZE, totalItems).toLocaleString()}</strong> trong <strong>{totalItems.toLocaleString()}</strong> mục
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="font-mono text-neutral-300 px-2">
              Trang {safeCurrentPage.toLocaleString()} / {totalPages.toLocaleString()}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 cursor-pointer"
              title="Trang tiếp"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-5 text-neutral-100 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
              <h3 className="font-semibold text-sm">
                Nhập {activeSubTab === 'names' ? 'Tệp Name' : 'Tệp Vietphrase'} (.txt)
              </h3>
              <button 
                onClick={() => setShowImportModal(false)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-neutral-400 mb-3">
              Hỗ trợ tệp QuickTranslator lớn <strong>~40MB+</strong> (hàng triệu dòng từ vựng). Tự động lưu vào IndexedDB không bị lỗi quá tải.
            </p>

            <div className="mb-3.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <label className="block text-xs font-semibold text-cyan-300 mb-1.5">
                📁 Chọn file .txt từ máy tính:
              </label>
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="block w-full text-xs text-neutral-400 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer"
              />
              <span className="text-[10.5px] text-neutral-500 mt-1 block">
                Khuyên dùng cho tệp dung lượng lớn (Names.txt hoặc Vietphrase.txt).
              </span>
            </div>

            <div className="relative">
              <div className="text-[11px] text-neutral-400 mb-1">
                Hoặc dán nội dung văn bản trực tiếp:
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Tiêu Viêm=Tiêu Viêm\n萧战=Tiêu Chiến\n药老=Dược Lão...`}
                className="w-full h-32 p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 mb-2"
              />
            </div>

            {importResult && (
              <div className="mb-3 text-xs font-medium text-emerald-400 bg-emerald-950/40 p-2 rounded-md">
                {importResult}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3.5 py-1.5 bg-neutral-800 text-neutral-300 rounded-xl text-xs hover:bg-neutral-700"
              >
                Đóng
              </button>
              <button
                onClick={handleProcessImportText}
                disabled={!importText.trim()}
                className="px-4 py-1.5 bg-cyan-600 text-white rounded-xl text-xs font-semibold hover:bg-cyan-500 disabled:opacity-50"
              >
                Nhập văn bản đã dán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Large File 40MB Progress Indicator Modal */}
      {largeFileLoading && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 p-5 text-neutral-100 shadow-2xl space-y-3">
            <div className="flex items-center gap-3">
              {largeFileLoading.isLoading ? (
                <Loader2 size={24} className="text-cyan-400 animate-spin shrink-0" />
              ) : (
                <Check size={24} className="text-emerald-400 shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-neutral-100 truncate">
                  {largeFileLoading.isLoading ? 'Đang nạp từ điển dung lượng lớn' : 'Hoàn tất nạp dữ liệu'}
                </h3>
                <p className="text-xs text-neutral-400 truncate">
                  Tệp: <strong className="text-cyan-300">{largeFileLoading.fileName}</strong>
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden border border-neutral-800">
                <div 
                  className="h-full bg-linear-to-r from-cyan-600 to-blue-500 transition-all duration-150"
                  style={{ width: `${largeFileLoading.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                <span>{largeFileLoading.count.toLocaleString()} dòng</span>
                <span>{largeFileLoading.percent}%</span>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
              {largeFileLoading.phase}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
