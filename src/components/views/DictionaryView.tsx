/**
 * Tab Cơ Sở Dữ Liệu & Từ Điển (Unified Database View)
 * Trung tâm hợp nhất toàn bộ dữ liệu từ điển của Quick Translator:
 * - Vietphrase (từ vựng thông dụng & truyện)
 * - Names Chính (danh xưng & địa danh gốc)
 * - Names Phụ / Cá Nhân (tên nhân vật theo truyện)
 * - Phiên Âm Hán Việt (12.5k ký tự chuẩn)
 * - Luật Nhân (228 quy tắc ngữ pháp)
 * - Đại Từ & Cụm Bỏ Qua (Pronouns & Ignored Phrases)
 * 
 * Hỗ trợ Import/Export từng file riêng lẻ hoặc TOÀN BỘ cùng một lúc.
 */

import React, { useState, useMemo, useRef } from 'react';
import { useApp, DictCategoryType } from '../../context/AppContext';
import { NameItem } from '../../data/defaultNames';
import { DEFAULT_VIETPHRASE } from '../../data/vietphraseData';
import { CHINESE_PHIEN_AM_WORDS } from '../../data/quickTranslatorData';
import { parseDictionaryFileChunked } from '../../utils/largeFileImporter';
import { 
  Database, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Upload, 
  Download, 
  RotateCcw, 
  Check, 
  X,
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Sparkles,
  FileText,
  Layers,
  Archive,
  RefreshCw
} from 'lucide-react';

const PAGE_SIZE = 50;

type UnifiedTab = 'vietphrase' | 'names_main' | 'names_custom' | 'phienam' | 'luatnhan' | 'pronouns_ignored';

// Tiện ích tải file về máy
function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const DictionaryView: React.FC = () => {
  const {
    namesList,
    deleteName,
    updateName,
    addName,
    namesMainMap,
    vietphraseMap,
    addVietphrase,
    deleteVietphrase,
    luatNhanMap,
    pronounsMap,
    ignoredPhrasesList,
    deletePhrase,
    updatePhrase,
    deleteMultiplePhrases,
    exportSingleTxt,
    importSingleTxt,
    clearSpecificStore,
    loadAllQuickTranslatorAssets,
    exportAllDatabasesJson,
    importAllDatabasesJson,
    resetDictionaries,
    settings
  } = useApp();

  const [activeTab, setActiveTab] = useState<UnifiedTab>('vietphrase');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Status & Notification Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Loading indicator for large imports & bundle loading
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingPercent, setProcessingPercent] = useState<number>(0);

  // Ref cho các input file ẩn
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const allJsonFileInputRef = useRef<HTMLInputElement>(null);

  // Modal thêm mục mới
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newCategory, setNewCategory] = useState<NameItem['category']>('Nhân vật');

  // Edit inline cả từ tiếng Trung và nghĩa tiếng Việt (2-way editable)
  const [editingItem, setEditingItem] = useState<{
    originalChinese: string;
    editChinese: string;
    editViet: string;
    id?: string;
  } | null>(null);

  // Chọn nhiều từ để xóa 1 lần
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Hộp thoại xác nhận tùy biến trước khi xóa từ điển
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    items: string[];
    count: number;
    sampleTitle?: string;
  } | null>(null);

  // Chuyển tab và reset trang
  const handleTabChange = (tab: UnifiedTab) => {
    setActiveTab(tab);
    setSearchTerm('');
    setSelectedCategory('all');
    setCurrentPage(1);
    setEditingItem(null);
    setSelectedKeys(new Set());
  };

  // 1. Dữ liệu Vietphrase gộp (DEFAULT + User)
  const fullVietphrase = useMemo(() => {
    const map = { ...DEFAULT_VIETPHRASE, ...vietphraseMap };
    return Object.entries(map).map(([chinese, vietnamese]) => ({
      chinese,
      vietnamese,
      isCustom: Boolean(vietphraseMap[chinese]),
    }));
  }, [vietphraseMap]);

  // 2. Dữ liệu Names Chính (namesMainMap)
  const fullNamesMain = useMemo(() => {
    return Object.entries(namesMainMap).map(([chinese, vietnamese]) => ({
      chinese,
      vietnamese,
    }));
  }, [namesMainMap]);

  // 3. Dữ liệu Luật Nhân
  const fullLuatNhan = useMemo(() => {
    return Object.entries(luatNhanMap).map(([pattern, translation]) => ({
      chinese: pattern,
      vietnamese: translation,
    }));
  }, [luatNhanMap]);

  // 4. Dữ liệu Phiên Âm Hán Việt (12.5k từ)
  const fullPhienAm = useMemo(() => {
    return Object.entries(CHINESE_PHIEN_AM_WORDS).map(([chinese, phienam]) => ({
      chinese,
      vietnamese: phienam,
    }));
  }, []);

  // 5. Dữ liệu Đại Từ & Cụm Bỏ Qua
  const fullPronouns = useMemo(() => {
    return Object.entries(pronounsMap).map(([chinese, vietnamese]) => ({
      chinese,
      vietnamese,
      type: 'Đại từ'
    }));
  }, [pronounsMap]);

  const fullIgnored = useMemo(() => {
    return ignoredPhrasesList.map(phrase => ({
      chinese: phrase,
      vietnamese: '(Lọc bỏ watermark/quảng cáo)',
      type: 'Cụm bỏ qua'
    }));
  }, [ignoredPhrasesList]);

  // Lọc dữ liệu theo tab và từ khóa
  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    switch (activeTab) {
      case 'vietphrase': {
        if (!term) return fullVietphrase;
        return fullVietphrase.filter(item =>
          item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)
        );
      }
      case 'names_main': {
        if (!term) return fullNamesMain;
        return fullNamesMain.filter(item =>
          item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)
        );
      }
      case 'names_custom': {
        return namesList.filter(item => {
          const matchesTerm = !term ||
            item.chinese.toLowerCase().includes(term) ||
            item.vietnamese.toLowerCase().includes(term) ||
            (item.note && item.note.toLowerCase().includes(term));
          const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
          return matchesTerm && matchesCat;
        }).map(item => ({
          chinese: item.chinese,
          vietnamese: item.vietnamese,
          category: item.category,
          id: item.id,
          note: item.note
        }));
      }
      case 'phienam': {
        if (!term) return fullPhienAm;
        return fullPhienAm.filter(item =>
          item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)
        );
      }
      case 'luatnhan': {
        if (!term) return fullLuatNhan;
        return fullLuatNhan.filter(item =>
          item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)
        );
      }
      case 'pronouns_ignored': {
        const combined = [...fullPronouns, ...fullIgnored];
        if (!term) return combined;
        return combined.filter(item =>
          item.chinese.toLowerCase().includes(term) || item.vietnamese.toLowerCase().includes(term)
        );
      }
      default:
        return [];
    }
  }, [activeTab, searchTerm, selectedCategory, fullVietphrase, fullNamesMain, namesList, fullPhienAm, fullLuatNhan, fullPronouns, fullIgnored]);

  // Phân trang
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, safeCurrentPage]);

  // ------------------- CÁC THAO TÁC XUẤT / NHẬP HÀNG LOẠT -------------------

  // Nạp 1-click toàn bộ dữ liệu gốc QuickTranslator từ các file asset
  const handleLoadAllDefaults = async () => {
    if (!window.confirm('Bạn có muốn nạp trọn bộ từ điển gốc Quick Translator (Phiên âm 12.5k từ, Luật Nhân, Đại Từ, Names2 và Names chính) vào IndexedDB?')) {
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Đang khởi động nạp dữ liệu...');
    setProcessingPercent(10);

    try {
      const res = await loadAllQuickTranslatorAssets((msg, pct) => {
        setProcessingStatus(msg);
        setProcessingPercent(pct);
      });

      if (res.success) {
        showToast('Đã nạp trọn bộ dữ liệu Quick Translator thành công!');
      } else {
        showToast(res.message, true);
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi nạp dữ liệu', true);
    } finally {
      setIsProcessing(false);
      setProcessingPercent(0);
    }
  };

  // Xuất toàn bộ tất cả database ra file JSON tổng hợp
  const handleExportAllJson = async () => {
    try {
      setIsProcessing(true);
      setProcessingStatus('Đang đóng gói toàn bộ cơ sở dữ liệu...');
      const json = await exportAllDatabasesJson();
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadTextFile(`QuickTranslator_FullBackup_${dateStr}.json`, json);
      showToast('Đã xuất toàn bộ cơ sở dữ liệu thành công!');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xuất dữ liệu', true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Nhập toàn bộ tất cả database từ file JSON
  const handleImportAllJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus('Đang khôi phục toàn bộ dữ liệu từ tệp sao lưu...');
    try {
      const text = await file.text();
      const res = await importAllDatabasesJson(text);
      if (res.success) {
        showToast('Khôi phục toàn bộ cơ sở dữ liệu thành công!');
      } else {
        showToast(res.message, true);
      }
    } catch (err: any) {
      showToast('Tệp sao lưu không hợp lệ: ' + (err.message || ''), true);
    } finally {
      setIsProcessing(false);
      if (allJsonFileInputRef.current) allJsonFileInputRef.current.value = '';
    }
  };

  // ------------------- CÁC THAO TÁC XUẤT / NHẬP TỪNG FILE -------------------

  // Xuất tệp TXT cho tab hiện tại theo cú pháp QuickTranslator
  const handleExportCurrentTab = () => {
    let dictType: DictCategoryType = 'vietphrase';
    let filename = 'VietPhrase.txt';

    switch (activeTab) {
      case 'vietphrase':
        dictType = 'vietphrase';
        filename = 'VietPhrase.txt';
        break;
      case 'names_main':
        dictType = 'names_main';
        filename = 'Names.txt';
        break;
      case 'names_custom':
        dictType = 'names';
        filename = 'Names2.txt';
        break;
      case 'phienam':
        dictType = 'phienam';
        filename = 'ChinesePhienAmWords.txt';
        break;
      case 'luatnhan':
        dictType = 'luatnhan';
        filename = 'LuatNhan.txt';
        break;
      case 'pronouns_ignored':
        dictType = 'pronouns';
        filename = 'Pronouns.txt';
        break;
    }

    const content = exportSingleTxt(dictType);
    downloadTextFile(filename, content);
    showToast(`Đã xuất tệp ${filename} (${content.split('\n').length} dòng)`);
  };

  // Nhập tệp TXT cho tab hiện tại
  const handleImportCurrentTab = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let dictType: DictCategoryType = 'vietphrase';
    switch (activeTab) {
      case 'vietphrase': dictType = 'vietphrase'; break;
      case 'names_main': dictType = 'names_main'; break;
      case 'names_custom': dictType = 'names'; break;
      case 'phienam': dictType = 'phienam'; break;
      case 'luatnhan': dictType = 'luatnhan'; break;
      case 'pronouns_ignored': dictType = 'pronouns'; break;
    }

    setIsProcessing(true);
    setProcessingStatus(`Đang đọc tệp ${file.name}...`);
    try {
      // Nếu tệp lớn > 5MB, sử dụng chunked importer
      if (file.size > 5 * 1024 * 1024) {
        const entries = await parseDictionaryFileChunked(file, (count, pct) => {
          setProcessingStatus(`Đã xử lý ${count.toLocaleString()} dòng (${pct}%)`);
          setProcessingPercent(pct);
        });
        const content = entries.map(e => `${e.chinese}=${e.vietnamese}`).join('\n');
        const count = await importSingleTxt(dictType, content);
        showToast(`Đã nhập thành công ${count.toLocaleString()} mục vào ${dictType}!`);
      } else {
        const content = await file.text();
        const count = await importSingleTxt(dictType, content);
        showToast(`Đã nhập thành công ${count.toLocaleString()} mục!`);
      }
    } catch (err: any) {
      showToast('Lỗi khi nhập tệp: ' + (err.message || ''), true);
    } finally {
      setIsProcessing(false);
      setProcessingPercent(0);
      if (singleFileInputRef.current) singleFileInputRef.current.value = '';
    }
  };

  // Xóa trắng dữ liệu của bảng hiện tại
  const handleClearCurrentTab = async () => {
    let dictType: DictCategoryType = 'vietphrase';
    let label = 'Vietphrase';

    switch (activeTab) {
      case 'vietphrase': dictType = 'vietphrase'; label = 'Vietphrase'; break;
      case 'names_main': dictType = 'names_main'; label = 'Names Chính'; break;
      case 'names_custom': dictType = 'names'; label = 'Names Phụ / Cá Nhân'; break;
      case 'luatnhan': dictType = 'luatnhan'; label = 'Luật Nhân'; break;
      case 'pronouns_ignored': dictType = 'pronouns'; label = 'Đại Từ'; break;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa toàn bộ dữ liệu trong bảng ${label}?`)) return;

    await clearSpecificStore(dictType);
    showToast(`Đã dọn dẹp bảng ${label}!`);
  };

  // Thêm mục mới
  const handleAddNewEntry = () => {
    if (!newKey.trim() || !newVal.trim()) {
      showToast('Vui lòng điền đủ từ gốc và nghĩa tiếng Việt', true);
      return;
    }

    const cn = newKey.trim();
    const vn = newVal.trim();

    if (activeTab === 'names_custom') {
      addName(cn, vn, newCategory);
      showToast(`Đã thêm tên riêng: ${cn} = ${vn}`);
    } else if (activeTab === 'vietphrase') {
      addVietphrase(cn, vn);
      showToast(`Đã thêm Vietphrase: ${cn} = ${vn}`);
    } else {
      importSingleTxt(activeTab === 'names_main' ? 'names_main' : activeTab === 'luatnhan' ? 'luatnhan' : 'pronouns', `${cn}=${vn}`);
      showToast(`Đã thêm mục: ${cn} = ${vn}`);
    }

    setNewKey('');
    setNewVal('');
    setIsAddModalOpen(false);
  };

  // Chọn hoặc bỏ chọn 1 từ
  const toggleSelectKey = (chinese: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(chinese)) next.delete(chinese);
      else next.add(chinese);
      return next;
    });
  };

  // Chọn hoặc bỏ chọn tất cả trên trang hiện tại
  const handleToggleSelectAll = (currentPageItems: Array<{ chinese: string }>) => {
    const allSelected = currentPageItems.length > 0 && currentPageItems.every(i => selectedKeys.has(i.chinese));
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (allSelected) {
        currentPageItems.forEach(i => next.delete(i.chinese));
      } else {
        currentPageItems.forEach(i => next.add(i.chinese));
      }
      return next;
    });
  };

  // Lưu sửa đổi 2 chiều cả từ tiếng Trung và nghĩa tiếng Việt
  const handleSaveEdit = () => {
    if (!editingItem) return;
    const { originalChinese, editChinese, editViet, id } = editingItem;
    const cleanCn = editChinese.trim();
    const cleanVn = editViet.trim();

    if (!cleanCn || !cleanVn) {
      showToast('Từ tiếng Trung và nghĩa tiếng Việt không được để trống!', true);
      return;
    }

    if (activeTab === 'names_custom') {
      updatePhrase(originalChinese, cleanCn, cleanVn, 'name');
    } else if (activeTab === 'vietphrase') {
      updatePhrase(originalChinese, cleanCn, cleanVn, 'vietphrase');
    } else {
      if (originalChinese !== cleanCn) {
        deletePhrase(originalChinese);
      }
      importSingleTxt(activeTab === 'names_main' ? 'names_main' : activeTab === 'luatnhan' ? 'luatnhan' : 'pronouns', `${cleanCn}=${cleanVn}`);
    }

    setEditingItem(null);
    showToast(`Đã lưu cập nhật: ${cleanCn} = ${cleanVn}`);
  };

  // Yêu cầu xóa 1 từ (kích hoạt hộp thoại xác nhận)
  const handleRequestDeleteItem = (chineseKey: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      items: [chineseKey],
      count: 1,
      sampleTitle: chineseKey
    });
  };

  // Yêu cầu xóa hàng loạt các từ đã chọn (kích hoạt hộp thoại xác nhận với số lượng)
  const handleRequestBulkDelete = () => {
    if (selectedKeys.size === 0) return;
    setDeleteConfirmModal({
      isOpen: true,
      items: Array.from(selectedKeys),
      count: selectedKeys.size
    });
  };

  // Xác nhận thực hiện xóa sau khi người dùng bấm đồng ý trên Modal
  const handleConfirmDelete = () => {
    if (!deleteConfirmModal || deleteConfirmModal.items.length === 0) return;
    const items = deleteConfirmModal.items;
    const count = items.length;

    if (activeTab === 'names_custom') {
      deleteMultiplePhrases(items, 'name');
    } else if (activeTab === 'vietphrase') {
      deleteMultiplePhrases(items, 'vietphrase');
    } else if (activeTab === 'pronouns_ignored') {
      deleteMultiplePhrases(items, 'ignored');
    } else {
      items.forEach(cn => deletePhrase(cn));
    }

    setSelectedKeys(prev => {
      const next = new Set(prev);
      items.forEach(k => next.delete(k));
      return next;
    });

    setDeleteConfirmModal(null);
    showToast(`Đã xóa thành công ${count} từ khỏi từ điển!`);
  };

  const isLight = settings.theme === 'light';
  const isSepia = settings.theme === 'sepia';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-medium shadow-xl flex items-center gap-2 animate-in fade-in duration-150 ${
          toastMsg.isError ? 'bg-red-950 text-red-200 border border-red-700' : 'bg-neutral-900 text-neutral-100 border border-neutral-700'
        }`}>
          {toastMsg.isError ? <X size={14} className="text-red-400" /> : <Check size={14} className="text-emerald-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Processing Loader Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="text-cyan-400 animate-spin" />
          <p className="text-sm font-semibold text-white tracking-wide">{processingStatus}</p>
          {processingPercent > 0 && (
            <div className="w-64 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 transition-all duration-200" 
                style={{ width: `${processingPercent}%` }} 
              />
            </div>
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input 
        ref={singleFileInputRef} 
        type="file" 
        accept=".txt,.config" 
        className="hidden" 
        onChange={handleImportCurrentTab} 
      />
      <input 
        ref={allJsonFileInputRef} 
        type="file" 
        accept=".json" 
        className="hidden" 
        onChange={handleImportAllJson} 
      />

      {/* HEADER: TIÊU ĐỀ & THANH THAO TÁC TOÀN CỤC (GLOBAL BATCH ACTIONS) */}
      <div className={`px-4 py-3.5 border-b shrink-0 flex flex-wrap items-center justify-between gap-3 ${
        isLight ? 'bg-neutral-50/80 border-neutral-200 text-neutral-900' : isSepia ? 'bg-[#f4e6ca] border-[#dfcdb0] text-[#3d2e1e]' : 'bg-[#18191c] border-neutral-800 text-neutral-100'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Database size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight flex items-center gap-2">
              Cơ Sở Dữ Liệu & Từ Điển
              <span className="text-[10px] font-mono font-normal px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                QuickTranslator Core
              </span>
            </h1>
            <p className="text-[11px] opacity-60">
              Quản lý toàn bộ tệp từ điển, tên riêng nhân vật và luật nhân dịch thuật
            </p>
          </div>
        </div>

        {/* Global Batch Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleLoadAllDefaults}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-sm cursor-pointer transition-all active:scale-95"
            title="Nạp nhanh toàn bộ từ điển mẫu từ bộ tệp QuickTranslator TTV"
          >
            <Sparkles size={13} />
            <span>Nạp Gốc QT</span>
          </button>

          <button
            onClick={handleExportAllJson}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
              isLight ? 'bg-white border-neutral-300 hover:bg-neutral-100 text-neutral-800' : isSepia ? 'bg-[#fdf6e9] border-[#d8c4a5] hover:bg-[#ebd8b7] text-[#3d2e1e]' : 'bg-[#222327] border-neutral-700 hover:bg-neutral-700 text-neutral-200'
            }`}
            title="Xuất toàn bộ tất cả bảng từ điển ra tệp JSON sao lưu"
          >
            <Download size={13} />
            <span>Xuất Hết</span>
          </button>

          <button
            onClick={() => allJsonFileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
              isLight ? 'bg-white border-neutral-300 hover:bg-neutral-100 text-neutral-800' : isSepia ? 'bg-[#fdf6e9] border-[#d8c4a5] hover:bg-[#ebd8b7] text-[#3d2e1e]' : 'bg-[#222327] border-neutral-700 hover:bg-neutral-700 text-neutral-200'
            }`}
            title="Nhập khôi phục toàn bộ từ tệp JSON sao lưu"
          >
            <Upload size={13} />
            <span>Nhập Hết</span>
          </button>
        </div>
      </div>

      {/* SEGMENTED TAB BAR: 6 BẢNG DỮ LIỆU TỪ ĐIỂN */}
      <div className={`px-4 pt-2.5 border-b overflow-x-auto scrollbar-none shrink-0 ${
        isLight ? 'bg-neutral-100/50 border-neutral-200' : isSepia ? 'bg-[#efe0c3] border-[#dfcdb0]' : 'bg-[#151619] border-neutral-800'
      }`}>
        <div className="flex items-center gap-1 min-w-max pb-2">
          <button
            onClick={() => handleTabChange('vietphrase')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'vietphrase'
                ? 'bg-cyan-600 text-white shadow-xs font-semibold'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-800/40'
            }`}
          >
            <span>Vietphrase</span>
            <span className="text-[10px] opacity-80 font-mono">({fullVietphrase.length.toLocaleString()})</span>
          </button>

          <button
            onClick={() => handleTabChange('names_main')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'names_main'
                ? 'bg-cyan-600 text-white shadow-xs font-semibold'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-800/40'
            }`}
          >
            <span>Names Chính</span>
            <span className="text-[10px] opacity-80 font-mono">({fullNamesMain.length.toLocaleString()})</span>
          </button>

          <button
            onClick={() => handleTabChange('names_custom')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'names_custom'
                ? 'bg-cyan-600 text-white shadow-xs font-semibold'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-800/40'
            }`}
          >
            <span className="flex items-center gap-1">
              <span>Names Phụ / Cá Nhân</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </span>
            <span className="text-[10px] opacity-80 font-mono">({namesList.length.toLocaleString()})</span>
          </button>

          <button
            onClick={() => handleTabChange('phienam')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'phienam'
                ? 'bg-cyan-600 text-white shadow-xs font-semibold'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-800/40'
            }`}
          >
            <span>Phiên Âm Hán Việt</span>
            <span className="text-[10px] opacity-80 font-mono">({fullPhienAm.length.toLocaleString()})</span>
          </button>

          <button
            onClick={() => handleTabChange('luatnhan')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'luatnhan'
                ? 'bg-cyan-600 text-white shadow-xs font-semibold'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-800/40'
            }`}
          >
            <span>Luật Nhân</span>
            <span className="text-[10px] opacity-80 font-mono">({fullLuatNhan.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('pronouns_ignored')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pronouns_ignored'
                ? 'bg-cyan-600 text-white shadow-xs font-semibold'
                : 'opacity-70 hover:opacity-100 hover:bg-neutral-800/40'
            }`}
          >
            <span>Đại Từ & Bỏ Qua</span>
            <span className="text-[10px] opacity-80 font-mono">({fullPronouns.length + fullIgnored.length})</span>
          </button>
        </div>
      </div>

      {/* PER-TAB ACTION TOOLBAR: TÌM KIẾM, IMPORT/EXPORT FILE TXT VÀ THÊM MỚI */}
      <div className={`px-4 py-2.5 border-b shrink-0 flex flex-wrap items-center justify-between gap-2 text-xs ${
        isLight ? 'bg-white border-neutral-200' : isSepia ? 'bg-[#fbf0d9] border-[#dfcdb0]' : 'bg-[#18191c] border-neutral-800'
      }`}>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder={`Tìm trong ${activeTab === 'vietphrase' ? 'Vietphrase' : activeTab === 'names_main' ? 'Names chính' : activeTab === 'names_custom' ? 'Names cá nhân' : 'bảng hiện tại'}...`}
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none transition-colors ${
                isLight ? 'bg-neutral-100 border-neutral-300 focus:border-cyan-600' : isSepia ? 'bg-[#f0e2c8] border-[#dfcdb0] focus:border-cyan-600 text-[#3d2e1e]' : 'bg-[#222327] border-neutral-700 focus:border-cyan-500 text-neutral-100'
              }`}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Phân loại danh mục (chỉ khi xem Names cá nhân) */}
          {activeTab === 'names_custom' && (
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              className={`px-2 py-1.5 rounded-lg border text-xs outline-none cursor-pointer ${
                isLight ? 'bg-neutral-100 border-neutral-300' : isSepia ? 'bg-[#f0e2c8] border-[#dfcdb0] text-[#3d2e1e]' : 'bg-[#222327] border-neutral-700 text-neutral-200'
              }`}
            >
              <option value="all">Tất cả loại</option>
              <option value="Nhân vật">Nhân vật</option>
              <option value="Địa danh">Địa danh</option>
              <option value="Môn phái">Môn phái</option>
              <option value="Vũ khí / Pháp bảo">Vũ khí / Pháp bảo</option>
              <option value="Công pháp / Chiêu thức">Công pháp / Chiêu thức</option>
              <option value="Khác">Khác</option>
            </select>
          )}
        </div>

        {/* Nút hành động riêng cho tệp hiện tại */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => singleFileInputRef.current?.click()}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border cursor-pointer hover:border-cyan-500/50 transition-colors ${
              isLight ? 'bg-neutral-50 border-neutral-300 text-neutral-800' : isSepia ? 'bg-[#f0e2c8] border-[#dfcdb0] text-[#3d2e1e]' : 'bg-[#222327] border-neutral-700 text-neutral-200'
            }`}
            title="Nhập tệp .txt riêng cho bảng này"
          >
            <Upload size={12} />
            <span>Nhập .txt</span>
          </button>

          <button
            onClick={handleExportCurrentTab}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border cursor-pointer hover:border-cyan-500/50 transition-colors ${
              isLight ? 'bg-neutral-50 border-neutral-300 text-neutral-800' : isSepia ? 'bg-[#f0e2c8] border-[#dfcdb0] text-[#3d2e1e]' : 'bg-[#222327] border-neutral-700 text-neutral-200'
            }`}
            title="Xuất tệp .txt chuẩn QuickTranslator cho bảng này"
          >
            <Download size={12} />
            <span>Xuất .txt</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={13} />
            <span>Thêm Mục</span>
          </button>

          {activeTab !== 'phienam' && (
            <button
              onClick={handleClearCurrentTab}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
              title="Xóa trắng bảng này"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* BULK ACTION BAR KHI ĐANG CHỌN NHIỀU TỪ */}
      {selectedKeys.size > 0 && (
        <div className="px-4 py-2 bg-cyan-950/90 border-b border-cyan-800/80 text-cyan-200 text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Đã chọn {selectedKeys.size} từ</span>
            <span className="text-[11px] opacity-75">trong bảng {activeTab}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedKeys(new Set())}
              className="px-2.5 py-1 rounded-md bg-cyan-900/60 hover:bg-cyan-900 text-cyan-200 text-xs cursor-pointer transition-colors"
            >
              Bỏ chọn tất cả
            </button>
            <button
              onClick={handleRequestBulkDelete}
              className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Trash2 size={13} />
              <span>Xóa {selectedKeys.size} từ đã chọn</span>
            </button>
          </div>
        </div>
      )}

      {/* DATA GRID / BẢNG DỮ LIỆU HIỂN THỊ */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {paginatedData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 opacity-50 text-xs">
            <Archive size={28} />
            <p>Không tìm thấy mục nào phù hợp</p>
          </div>
        ) : (
          <div className="text-xs font-mono">
            {/* Table Header: Cột Chọn tất cả, Từ tiếng Trung, Nghĩa tiếng Việt, Thao tác */}
            <div className={`flex items-center gap-2.5 py-1.5 px-2 border-b text-[11px] font-semibold opacity-70 ${
              isLight ? 'border-neutral-200 text-neutral-700' : isSepia ? 'border-[#dfcdb0] text-[#3d2e1e]' : 'border-neutral-800 text-neutral-400'
            }`}>
              <input 
                type="checkbox"
                checked={paginatedData.length > 0 && paginatedData.every(i => selectedKeys.has(i.chinese))}
                onChange={() => handleToggleSelectAll(paginatedData)}
                className="rounded border-neutral-700 bg-neutral-800 text-cyan-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                title="Chọn hoặc bỏ chọn tất cả trên trang này"
              />
              <span className="w-1/3 min-w-[120px]">Từ Gốc Tiếng Trung (Bên trái)</span>
              <span className="flex-1">Nghĩa Tiếng Việt</span>
              <span className="w-16 text-right">Thao tác</span>
            </div>

            <div className="divide-y divide-neutral-800/40">
              {paginatedData.map((item, idx) => {
                const isEditing = editingItem?.originalChinese === item.chinese;
                const isChecked = selectedKeys.has(item.chinese);

                return (
                  <div 
                    key={`${item.chinese}-${idx}`}
                    className={`py-2 px-2 flex items-center justify-between gap-3 transition-colors rounded-lg group ${
                      isChecked 
                        ? 'bg-cyan-950/30' 
                        : isLight ? 'hover:bg-neutral-100' : isSepia ? 'hover:bg-[#ebd8b7]/40' : 'hover:bg-neutral-800/30'
                    }`}
                  >
                    {/* Checkbox chọn dòng */}
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectKey(item.chinese)}
                      className="rounded border-neutral-700 bg-neutral-800 text-cyan-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                    />

                    {/* Cột Từ Gốc Tiếng Trung (Bên trái) - Có thể sửa khi bấm nút Sửa */}
                    <div className="w-1/3 min-w-[120px] truncate flex items-center gap-2 font-sans font-medium text-sm">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingItem.editChinese}
                          onChange={(e) => setEditingItem({ ...editingItem, editChinese: e.target.value })}
                          className="w-full px-2 py-1 rounded bg-[#2a2b30] border border-cyan-500 text-xs text-cyan-300 font-serif outline-none"
                          placeholder="Từ tiếng Trung"
                        />
                      ) : (
                        <>
                          <span className="text-cyan-400 font-semibold">{item.chinese}</span>
                          {(item as any).isCustom && (
                            <span className="text-[10px] text-amber-400 font-normal px-1 py-0.2 rounded bg-amber-950/50 border border-amber-800/40">
                              Cá nhân
                            </span>
                          )}
                          {(item as any).category && (
                            <span className="text-[10px] opacity-60 font-normal">
                              · {(item as any).category}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Cột Nghĩa Tiếng Việt / Bản Dịch - Có thể sửa khi bấm nút Sửa */}
                    <div className="flex-1 min-w-0 font-sans">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingItem.editViet}
                            onChange={(e) => setEditingItem({ ...editingItem, editViet: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                            className="flex-1 px-2 py-1 rounded bg-[#2a2b30] border border-cyan-500 text-xs text-white outline-none"
                            placeholder="Nghĩa tiếng Việt"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="p-1 rounded bg-cyan-600 text-white hover:bg-cyan-500 cursor-pointer"
                            title="Lưu thay đổi cả tiếng Trung và tiếng Việt"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
                            className="p-1 rounded bg-neutral-700 text-neutral-300 hover:bg-neutral-600 cursor-pointer"
                            title="Hủy"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className={isLight ? 'text-neutral-800' : isSepia ? 'text-[#3d2e1e]' : 'text-neutral-200'}>
                          {item.vietnamese || <span className="opacity-40 italic">(Lược bỏ / rỗng)</span>}
                        </span>
                      )}
                    </div>

                    {/* Cột Nút Hành Động (Sửa cả 2 từ / Xóa có xác nhận) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-16 justify-end">
                      {!isEditing && (
                        <button
                          onClick={() => {
                            setEditingItem({
                              originalChinese: item.chinese,
                              editChinese: item.chinese,
                              editViet: item.vietnamese,
                              id: (item as any).id
                            });
                          }}
                          className="p-1 text-neutral-400 hover:text-cyan-300 hover:bg-neutral-800 rounded cursor-pointer"
                          title="Sửa từ tiếng Trung bên trái và nghĩa tiếng Việt"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}

                      {activeTab !== 'phienam' && (
                        <button
                          onClick={() => handleRequestDeleteItem(item.chinese)}
                          className="p-1 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded cursor-pointer"
                          title="Xóa mục này (kèm xác nhận)"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER: PHÂN TRANG VÀ THỐNG KÊ */}
      <div className={`px-4 py-2.5 border-t shrink-0 flex items-center justify-between text-xs font-mono opacity-80 ${
        isLight ? 'bg-neutral-50 border-neutral-200' : isSepia ? 'bg-[#efe0c3] border-[#dfcdb0]' : 'bg-[#18191c] border-neutral-800'
      }`}>
        <div>
          Tổng: <span className="font-bold">{totalItems.toLocaleString()}</span> mục 
          {searchTerm && ` (lọc từ ${totalItems.toLocaleString()})`}
        </div>

        <div className="flex items-center gap-2">
          <span>Trang {safeCurrentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safeCurrentPage <= 1}
            className="p-1 rounded border border-neutral-700 disabled:opacity-30 hover:bg-neutral-800 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="p-1 rounded border border-neutral-700 disabled:opacity-30 hover:bg-neutral-800 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* MODAL: THÊM MỤC MỚI VÀO BẢNG ĐANG CHỌN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-5 rounded-2xl shadow-2xl border text-sm space-y-4 animate-in zoom-in-95 duration-150 ${
            isLight ? 'bg-white border-neutral-200 text-neutral-900' : isSepia ? 'bg-[#fbf0d9] border-[#dfcdb0] text-[#3d2e1e]' : 'bg-[#1e1f23] border-neutral-800 text-neutral-100'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Plus size={16} className="text-cyan-400" />
                Thêm Mục Mới Vào {activeTab === 'vietphrase' ? 'Vietphrase' : activeTab === 'names_custom' ? 'Names Cá Nhân' : activeTab === 'luatnhan' ? 'Luật Nhân' : 'Từ Điển'}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="p-1 text-neutral-400 hover:text-white rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium opacity-70 mb-1">Từ gốc tiếng Trung / Cấu trúc:</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={activeTab === 'luatnhan' ? 'Ví dụ: 在{0}的面前' : 'Ví dụ: 萧炎 hoặc 了'}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${
                    isLight ? 'bg-neutral-100 border-neutral-300' : isSepia ? 'bg-[#f0e2c8] border-[#dfcdb0]' : 'bg-[#121316] border-neutral-700 text-white'
                  }`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium opacity-70 mb-1">Nghĩa tiếng Việt / Mẫu dịch:</label>
                <input
                  type="text"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  placeholder={activeTab === 'luatnhan' ? 'Ví dụ: trước mặt {0}' : 'Ví dụ: Tiêu Viêm hoặc /liễu/rồi'}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${
                    isLight ? 'bg-neutral-100 border-neutral-300' : isSepia ? 'bg-[#f0e2c8] border-[#dfcdb0]' : 'bg-[#121316] border-neutral-700 text-white'
                  }`}
                />
                <p className="text-[11px] opacity-50 mt-1">
                  Phân tách các nghĩa bằng dấu gạch chéo <code>/</code> (vd: <code>/liễu/rồi</code>)
                </p>
              </div>

              {activeTab === 'names_custom' && (
                <div>
                  <label className="block text-xs font-medium opacity-70 mb-1">Phân loại tên riêng:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none cursor-pointer ${
                      isLight ? 'bg-neutral-100 border-neutral-300' : isSepia ? 'bg-[#f0e2c8] border-[#dfcdb0]' : 'bg-[#121316] border-neutral-700 text-white'
                    }`}
                  >
                    <option value="Nhân vật">Nhân vật</option>
                    <option value="Địa danh">Địa danh</option>
                    <option value="Môn phái">Môn phái</option>
                    <option value="Vũ khí / Pháp bảo">Vũ khí / Pháp bảo</option>
                    <option value="Công pháp / Chiêu thức">Công pháp / Chiêu thức</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-xs font-medium cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleAddNewEntry}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer shadow-sm"
              >
                Lưu vào Từ Điển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA TỪ ĐIỂN TÙY BIẾN KÈM SỐ LƯỢNG */}
      {deleteConfirmModal && deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-5 text-neutral-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-neutral-100">Xác Nhận Xóa Từ Điển</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {deleteConfirmModal.count > 1 ? `Xóa ${deleteConfirmModal.count} từ đã chọn` : 'Xóa 1 từ khỏi từ điển'}
                </p>
              </div>
            </div>

            <div className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/80 p-3 rounded-xl border border-neutral-800">
              {deleteConfirmModal.count === 1 ? (
                <p>
                  Bạn có chắc chắn muốn xóa từ <strong className="text-cyan-400 font-bold">"{deleteConfirmModal.sampleTitle}"</strong> khỏi từ điển không?
                </p>
              ) : (
                <p>
                  Bạn có chắc chắn muốn xóa toàn bộ <strong className="text-rose-400 font-bold">{deleteConfirmModal.count}</strong> từ đã chọn khỏi từ điển không? Thao tác này sẽ cập nhật cơ sở dữ liệu và không thể hoàn tác.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xác nhận xóa {deleteConfirmModal.count > 1 ? `(${deleteConfirmModal.count})` : ''}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
