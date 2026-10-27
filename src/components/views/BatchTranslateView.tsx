/**
 * Màn hình Dịch hàng loạt nhiều chương (Batch Translation View)
 * Thiết kế tối ưu riêng cho giao diện máy tính / PC
 * Hỗ trợ nạp đến 2000+ chương, lưu từng file riêng biệt theo STT chương (1810.txt, 1810.docx)
 * Lưu hàng loạt vào Thư viện với tính năng tự động lọc bỏ chương trùng lặp
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { convertText } from '../../utils/translatorEngine';
import {
  BatchTranslationItem,
  splitLargeTextIntoChapters,
  parseMultipleFiles,
  extractChapterNumber,
} from '../../utils/chapterSplitter';
import {
  saveChaptersToUserFolder,
  downloadChaptersAsZip,
  isDirectoryPickerSupported,
} from '../../utils/batchExportUtils';
import {
  FolderUp,
  FileText,
  Play,
  Pause,
  FolderDown,
  Archive,
  Library,
  RotateCcw,
  Search,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Trash2,
  X,
} from 'lucide-react';

const PAGE_SIZE = 50;

export const BatchTranslateView: React.FC = () => {
  const {
    namesList,
    vietphraseMap,
    luatNhanMap,
    pronounsMap,
    ignoredPhrasesList,
    settings,
    novelsList,
    addNovel,
    savedChapters,
    saveChapter,
    setActiveTab,
  } = useApp();

  // Mode nạp dữ liệu: 'files' (nhiều file riêng) hoặc 'split' (tách từ 1 văn bản lớn)
  const [inputMode, setInputMode] = useState<'files' | 'split'>('files');
  const [largeText, setLargeText] = useState<string>('');
  const [novelTitle, setNovelTitle] = useState<string>('Tiểu Thuyết Mới');
  const [selectedNovelId, setSelectedNovelId] = useState<string>('');
  const [startChapterNum, setStartChapterNum] = useState<number>(1);
  const [exportFormat, setExportFormat] = useState<'txt' | 'docx'>('txt');

  // Danh sách chương
  const [chapters, setChapters] = useState<BatchTranslationItem[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Trạng thái dịch
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const cancelRequestedRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Trạng thái xuất file / lưu
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Modal xem trước chương
  const [previewChapter, setPreviewChapter] = useState<BatchTranslationItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Cập nhật ref khi paused state thay đổi
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Tự động nhận diện STT chương đầu tiên khi danh sách chương thay đổi
  useEffect(() => {
    if (chapters.length > 0) {
      setStartChapterNum(chapters[0].chapterNum);
    }
  }, [chapters.length]);

  // Xử lý nạp nhiều file
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      showToast(`Đang phân tích ${files.length} tệp...`);
      const parsed = await parseMultipleFiles(Array.from(files), startChapterNum);
      const items: BatchTranslationItem[] = parsed.map(p => ({
        ...p,
        translatedTitle: '',
        translatedContent: '',
        status: 'pending',
      }));
      setChapters(items);
      setCurrentIndex(0);
      setCurrentPage(1);
      showToast(`Đã nạp thành công ${items.length} chương!`);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi đọc danh sách tệp', true);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Xử lý tách văn bản lớn
  const handleSplitLargeText = () => {
    if (!largeText.trim()) {
      showToast('Vui lòng dán hoặc tải văn bản chứa các chương!', true);
      return;
    }

    try {
      const parsed = splitLargeTextIntoChapters(largeText, startChapterNum);
      if (parsed.length === 0) {
        showToast('Không tìm thấy chương nào trong văn bản!', true);
        return;
      }

      const items: BatchTranslationItem[] = parsed.map(p => ({
        ...p,
        translatedTitle: '',
        translatedContent: '',
        status: 'pending',
      }));
      setChapters(items);
      setCurrentIndex(0);
      setCurrentPage(1);
      showToast(`Đã tự động phân tách thành công ${items.length} chương!`);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tách chương', true);
    }
  };

  // Đặt lại STT hàng loạt theo số bắt đầu do người dùng nhập
  const handleApplyStartNumber = (newStart: number) => {
    setStartChapterNum(newStart);
    setChapters(prev =>
      prev.map((chap, idx) => ({
        ...chap,
        chapterNum: newStart + idx,
      }))
    );
    showToast(`Đã đánh số lại từ chương ${newStart} đến ${newStart + chapters.length - 1}`);
  };

  // Hàm dịch đơn lẻ 1 chương
  const translateSingleItem = (item: BatchTranslationItem): { title: string; content: string } => {
    const convTitle = convertText(item.rawTitle, namesList, vietphraseMap, {
      prioritizeNames: settings.prioritizeNames,
      capitalizeSentences: settings.capitalizeSentences,
      customLuatNhan: luatNhanMap,
      customPronouns: pronounsMap,
      customIgnored: ignoredPhrasesList,
    });

    const convBody = convertText(item.content, namesList, vietphraseMap, {
      prioritizeNames: settings.prioritizeNames,
      capitalizeSentences: settings.capitalizeSentences,
      customLuatNhan: luatNhanMap,
      customPronouns: pronounsMap,
      customIgnored: ignoredPhrasesList,
    });

    return {
      title: convTitle.fullText || item.rawTitle,
      content: convBody.fullText || item.content,
    };
  };

  // Bắt đầu dịch hàng loạt (Non-blocking Queue với chunks)
  const handleStartBatchTranslation = async () => {
    if (chapters.length === 0) {
      showToast('Chưa có chương nào để dịch!', true);
      return;
    }

    setIsTranslating(true);
    setIsPaused(false);
    cancelRequestedRef.current = false;
    isPausedRef.current = false;

    // Tìm vị trí chương chưa hoàn thành đầu tiên
    let startIdx = chapters.findIndex(c => c.status !== 'done');
    if (startIdx === -1) startIdx = 0;

    for (let i = startIdx; i < chapters.length; i++) {
      if (cancelRequestedRef.current) break;

      // Xử lý tạm dừng
      while (isPausedRef.current && !cancelRequestedRef.current) {
        await new Promise(r => setTimeout(r, 200));
      }
      if (cancelRequestedRef.current) break;

      setCurrentIndex(i);

      // Cập nhật trạng thái đang dịch
      setChapters(prev => {
        const copy = [...prev];
        copy[i] = { ...copy[i], status: 'processing' };
        return copy;
      });

      // Nhường luồng cho UI render mượt mà
      await new Promise(r => setTimeout(r, 0));

      try {
        const currentItem = chapters[i];
        const res = translateSingleItem(currentItem);

        setChapters(prev => {
          const copy = [...prev];
          copy[i] = {
            ...copy[i],
            translatedTitle: res.title,
            translatedContent: res.content,
            status: 'done',
          };
          return copy;
        });
      } catch (err: any) {
        setChapters(prev => {
          const copy = [...prev];
          copy[i] = {
            ...copy[i],
            status: 'error',
            errorMessage: err.message || 'Lỗi dịch',
          };
          return copy;
        });
      }
    }

    setIsTranslating(false);
    if (!cancelRequestedRef.current) {
      showToast('Hoàn tất dịch hàng loạt!');
    }
  };

  // Tạm dừng / Tiếp tục
  const handleTogglePause = () => {
    setIsPaused(prev => !prev);
  };

  // Hủy tiến trình dịch
  const handleStopTranslation = () => {
    cancelRequestedRef.current = true;
    setIsTranslating(false);
    setIsPaused(false);
    showToast('Đã dừng tiến trình dịch');
  };

  // Lưu từng file riêng biệt vào Thư mục chọn sẵn trên máy tính
  const handleSaveToDirectory = async () => {
    const readyChapters = chapters.filter(c => c.translatedContent || c.content);
    if (readyChapters.length === 0) {
      showToast('Chưa có chương nào có nội dung để lưu!', true);
      return;
    }

    if (!isDirectoryPickerSupported()) {
      showToast('Trình duyệt không hỗ trợ chọn thư mục trực tiếp. Đang chuyển sang tải file ZIP...', true);
      handleDownloadZip();
      return;
    }

    setIsExporting(true);
    setExportMessage('Đang chờ chọn thư mục trên máy tính...');

    try {
      const res = await saveChaptersToUserFolder(
        readyChapters,
        exportFormat,
        (saved, total, currentName) => {
          setExportMessage(`Đang lưu ${currentName} (${saved}/${total})...`);
        }
      );
      showToast(`Đã lưu thành công ${res.count} tệp (${exportFormat.toUpperCase()}) vào thư mục "${res.folderName}"!`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast(err.message || 'Lỗi khi lưu thư mục', true);
      }
    } finally {
      setIsExporting(false);
      setExportMessage('');
    }
  };

  // Tải trọn bộ các chương dưới dạng ZIP (Quy tắc tên file bên trong: STT chương)
  const handleDownloadZip = async () => {
    const readyChapters = chapters.filter(c => c.translatedContent || c.content);
    if (readyChapters.length === 0) {
      showToast('Chưa có chương nào có nội dung để tải!', true);
      return;
    }

    setIsExporting(true);
    setExportMessage('Đang nén các tệp chương...');

    try {
      await downloadChaptersAsZip(
        readyChapters,
        exportFormat,
        `${novelTitle || 'Truyen'}_Chuong_${readyChapters[0].chapterNum}-${readyChapters[readyChapters.length - 1].chapterNum}`,
        (percent) => {
          setExportMessage(`Đang đóng gói file ZIP: ${percent}%...`);
        }
      );
      showToast('Tải tệp ZIP thành công!');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tạo file ZIP', true);
    } finally {
      setIsExporting(false);
      setExportMessage('');
    }
  };

  // Lưu hàng loạt vào Thư viện truyện (Tự động bỏ qua chương trùng)
  const handleSaveAllToLibrary = () => {
    const readyChapters = chapters.filter(c => c.translatedContent);
    if (readyChapters.length === 0) {
      showToast('Chưa có chương nào đã dịch để lưu vào Thư viện!', true);
      return;
    }

    let targetNovelId = selectedNovelId;
    let targetNovelTitle = novelTitle.trim() || 'Tiểu Thuyết Dịch';

    // Nếu chưa chọn truyện có sẵn, tạo mới truyện
    if (!targetNovelId) {
      const existing = novelsList.find(n => n.title.toLowerCase() === targetNovelTitle.toLowerCase());
      if (existing) {
        targetNovelId = existing.id;
      } else {
        targetNovelId = addNovel({
          title: targetNovelTitle,
          description: `Bộ truyện nạp dịch hàng loạt ${readyChapters.length} chương`,
          genre: 'Tiên hiệp / Dị giới',
        });
      }
    } else {
      const found = novelsList.find(n => n.id === targetNovelId);
      if (found) targetNovelTitle = found.title;
    }

    // Danh sách tiêu đề chương đã có trong truyện này
    const existingTitles = new Set(
      savedChapters
        .filter(c => c.novelId === targetNovelId || c.novelTitle === targetNovelTitle)
        .map(c => (c.chapterPrefix || c.title).toLowerCase().trim())
    );

    let savedCount = 0;
    let skippedCount = 0;

    for (const chap of readyChapters) {
      const prefix = `Chương ${chap.chapterNum}`;
      // Kiểm tra trùng lặp
      if (existingTitles.has(prefix.toLowerCase()) || existingTitles.has(chap.translatedTitle.toLowerCase())) {
        skippedCount++;
        continue;
      }

      saveChapter({
        novelId: targetNovelId,
        novelTitle: targetNovelTitle,
        title: chap.translatedTitle || `${prefix}: Đang cập nhật`,
        chapterPrefix: prefix,
        chapterName: chap.translatedTitle.replace(/^(?:Chương|Hồi|Tiết)\s*\d+[\s:：\-–—\.]*/i, ''),
        originalText: chap.content,
        vietphraseText: chap.translatedContent,
      });

      existingTitles.add(prefix.toLowerCase());
      savedCount++;
    }

    if (savedCount > 0) {
      showToast(`Đã lưu ${savedCount} chương vào truyện "${targetNovelTitle}"! (${skippedCount} chương đã tồn tại được bỏ qua)`);
    } else {
      showToast(`Toàn bộ ${skippedCount} chương này đã tồn tại trong thư viện, không có chương mới.`, true);
    }
  };

  // Tính toán số liệu thống kê
  const stats = useMemo(() => {
    const total = chapters.length;
    const done = chapters.filter(c => c.status === 'done').length;
    const totalChars = chapters.reduce((sum, c) => sum + c.charCount, 0);
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, totalChars, percent };
  }, [chapters]);

  // Lọc và phân trang danh sách chương
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const q = searchQuery.toLowerCase().trim();
    return chapters.filter(
      c =>
        c.chapterNum.toString().includes(q) ||
        c.rawTitle.toLowerCase().includes(q) ||
        c.translatedTitle.toLowerCase().includes(q)
    );
  }, [chapters, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredChapters.length / PAGE_SIZE));
  const displayedChapters = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredChapters.slice(start, start + PAGE_SIZE);
  }, [filteredChapters, currentPage]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950 text-neutral-100">
      {/* Thông báo riêng cho màn hình di động (< 768px) */}
      <div className="md:hidden flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 flex items-center justify-center mb-4 shadow-lg">
          <Monitor size={32} />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">
          Tính năng Dịch Hàng Loạt chỉ hỗ trợ trên PC
        </h2>
        <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
          Xử lý hàng trăm đến 2.000 chương truyện và xuất trực tiếp vào thư mục trên máy tính đòi hỏi không gian hiển thị rộng và File System API của máy tính để bàn.
        </p>
        <button
          onClick={() => setActiveTab('translate')}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Quay lại Dịch Nhanh
        </button>
      </div>

      {/* GIAO DIỆN CHÍNH TRÊN PC (md:flex) */}
      <div className="hidden md:flex flex-col flex-1 h-full overflow-hidden">
        {/* Top Control Bar */}
        <div className="shrink-0 px-6 py-3 border-b border-neutral-800/80 bg-neutral-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-white tracking-tight">
                  Dịch Hàng Loạt Nhiều Chương
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/60 text-cyan-400 font-semibold">
                  Tối ưu 2000+ chương
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Tên file xuất: <code className="text-cyan-300 font-mono">1810.{exportFormat}</code>, <code className="text-cyan-300 font-mono">1811.{exportFormat}</code>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!isTranslating ? (
              <button
                onClick={handleStartBatchTranslation}
                disabled={chapters.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
              >
                <Play size={14} />
                <span>Bắt đầu dịch ({stats.total} chương)</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleTogglePause}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isPaused ? <Play size={14} /> : <Pause size={14} />}
                  <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                </button>
                <button
                  onClick={handleStopTranslation}
                  className="p-1.5 bg-neutral-800 hover:bg-rose-900/70 text-rose-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Dừng tiến trình"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Lưu vào Thư mục */}
            <button
              onClick={handleSaveToDirectory}
              disabled={isTranslating || chapters.length === 0 || isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 hover:text-white border border-neutral-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="Mở hộp thoại chọn Folder trên máy tính và lưu từng file: 1810.txt, 1811.txt..."
            >
              <FolderDown size={14} className="text-cyan-400" />
              <span>Lưu vào Thư mục</span>
            </button>

            {/* Tải tệp ZIP */}
            <button
              onClick={handleDownloadZip}
              disabled={isTranslating || chapters.length === 0 || isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 hover:text-white border border-neutral-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="Tải trọn bộ các chương dưới dạng ZIP"
            >
              <Archive size={14} className="text-amber-400" />
              <span>Tải file ZIP</span>
            </button>

            {/* Lưu vào Thư viện */}
            <button
              onClick={handleSaveAllToLibrary}
              disabled={isTranslating || chapters.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 hover:text-white border border-neutral-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="Lưu tất cả chương đã dịch vào Thư viện truyện (tự động bỏ qua chương trùng)"
            >
              <Library size={14} className="text-emerald-400" />
              <span>Lưu Thư Viện</span>
            </button>
          </div>
        </div>

        {/* Thông báo tiến độ / Toast */}
        {toastMessage && (
          <div className={`px-4 py-2 text-xs font-medium flex items-center justify-between border-b ${
            toastMessage.isError 
              ? 'bg-rose-950/80 text-rose-200 border-rose-800' 
              : 'bg-emerald-950/80 text-emerald-200 border-emerald-800'
          }`}>
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="text-neutral-400 hover:text-white">
              <X size={13} />
            </button>
          </div>
        )}

        {isExporting && exportMessage && (
          <div className="px-6 py-2 bg-cyan-950/90 text-cyan-200 border-b border-cyan-800 text-xs font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{exportMessage}</span>
          </div>
        )}

        {/* Cấu hình & Nạp đầu vào */}
        <div className="shrink-0 px-6 py-3 border-b border-neutral-800/60 bg-neutral-900/30 grid grid-cols-12 gap-3 items-center text-xs">
          {/* Tên truyện & Thư viện */}
          <div className="col-span-4 flex items-center gap-2">
            <label className="text-neutral-400 whitespace-nowrap">Bộ truyện:</label>
            <input
              type="text"
              value={novelTitle}
              onChange={(e) => setNovelTitle(e.target.value)}
              placeholder="Nhập tên truyện..."
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            {novelsList.length > 0 && (
              <select
                value={selectedNovelId}
                onChange={(e) => {
                  setSelectedNovelId(e.target.value);
                  const found = novelsList.find(n => n.id === e.target.value);
                  if (found) setNovelTitle(found.title);
                }}
                className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-cyan-500 max-w-32"
              >
                <option value="">Chọn từ TV...</option>
                {novelsList.map(n => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* STT Bắt đầu */}
          <div className="col-span-3 flex items-center gap-2">
            <label className="text-neutral-400 whitespace-nowrap" title="Số thứ tự chương bắt đầu để đặt tên file (ví dụ: 1810)">
              STT Bắt đầu:
            </label>
            <input
              type="number"
              min={1}
              value={startChapterNum}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                  handleApplyStartNumber(val);
                }
              }}
              className="w-20 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono font-semibold focus:outline-none focus:border-cyan-500 text-center"
            />
            <span className="text-[11px] text-neutral-500 font-mono">
              → {startChapterNum + Math.max(0, chapters.length - 1)}
            </span>
          </div>

          {/* Định dạng file */}
          <div className="col-span-2 flex items-center gap-2">
            <label className="text-neutral-400">Định dạng:</label>
            <div className="flex rounded-lg bg-neutral-900 p-0.5 border border-neutral-800">
              <button
                onClick={() => setExportFormat('txt')}
                className={`px-2 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  exportFormat === 'txt' ? 'bg-cyan-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                TXT
              </button>
              <button
                onClick={() => setExportFormat('docx')}
                className={`px-2 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  exportFormat === 'docx' ? 'bg-cyan-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                DOCX
              </button>
            </div>
          </div>

          {/* Nút nạp dữ liệu */}
          <div className="col-span-3 flex items-center justify-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".txt,.docx,.doc,text/plain"
              onChange={handleFilesSelected}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 rounded-lg text-xs font-medium cursor-pointer"
            >
              <FolderUp size={13} className="text-cyan-400" />
              <span>Nạp nhiều tệp</span>
            </button>
            <button
              onClick={() => setInputMode(inputMode === 'split' ? 'files' : 'split')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                inputMode === 'split'
                  ? 'bg-cyan-950 border-cyan-700 text-cyan-300'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
              }`}
            >
              <FileText size={13} />
              <span>{inputMode === 'split' ? 'Đóng ô dán văn bản' : 'Tách từ văn bản lớn'}</span>
            </button>
          </div>
        </div>

        {/* Khu vực ô dán văn bản lớn (nếu chọn chế độ tách) */}
        {inputMode === 'split' && (
          <div className="shrink-0 px-6 py-4 border-b border-neutral-800/80 bg-neutral-900/50 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">
                Dán văn bản tổng chứa toàn bộ các chương (tối ưu hóa cho văn bản hàng chục triệu ký tự):
              </span>
              <button
                onClick={handleSplitLargeText}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Sparkles size={13} />
                <span>Tự động nhận diện &amp; Tách chương</span>
              </button>
            </div>
            <textarea
              value={largeText}
              onChange={(e) => setLargeText(e.target.value)}
              placeholder="Dán toàn bộ các chương truyện vào đây (vd: 第1810章 Khởi đầu... 第1811章 Tiến bước...)..."
              rows={4}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        )}

        {/* Thanh trạng thái tiến độ thời gian thực */}
        <div className="shrink-0 px-6 py-2.5 bg-neutral-900/40 border-b border-neutral-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Tiến độ:</span>
              <span className="font-semibold text-white font-mono">{stats.done} / {stats.total} chương</span>
              <span className="text-cyan-400 font-mono font-bold">({stats.percent}%)</span>
            </div>
            <div className="w-48 bg-neutral-800 rounded-full h-2 overflow-hidden border border-neutral-700/60">
              <div
                className="bg-cyan-500 h-full transition-all duration-200"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tìm kiếm chương */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm STT (vd: 1810)..."
                className="bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500 w-44"
              />
            </div>

            {chapters.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Bạn có chắc muốn xóa danh sách chương này để nạp đợt mới?')) {
                    setChapters([]);
                    setCurrentIndex(0);
                  }
                }}
                className="p-1 rounded-md text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                title="Xóa danh sách chương hiện tại"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Bảng danh sách chương (Phân trang 50 chương/trang) */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {chapters.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600 mb-3">
                <FileText size={28} />
              </div>
              <p className="text-sm font-medium text-neutral-300">Chưa có chương nào được nạp</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                Bấm <strong>"Nạp nhiều tệp"</strong> để chọn hàng loạt file TXT/DOCX hoặc bấm <strong>"Tách từ văn bản lớn"</strong> để dán văn bản tổng.
              </p>
            </div>
          ) : (
            <div className="border border-neutral-800/80 rounded-xl overflow-hidden bg-neutral-900/30">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-900/80 border-b border-neutral-800 text-neutral-400 font-semibold">
                    <th className="py-2.5 px-3 w-24">Tên file</th>
                    <th className="py-2.5 px-3">Tiêu đề gốc</th>
                    <th className="py-2.5 px-3">Tiêu đề dịch</th>
                    <th className="py-2.5 px-3 w-24 text-right">Số ký tự</th>
                    <th className="py-2.5 px-3 w-28 text-center">Trạng thái</th>
                    <th className="py-2.5 px-3 w-20 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans">
                  {displayedChapters.map((chap) => {
                    const fileName = `${chap.chapterNum}.${exportFormat}`;
                    return (
                      <tr
                        key={chap.id}
                        className="hover:bg-neutral-800/30 transition-colors group"
                      >
                        {/* Tên file: CHỈ GỒM STT CHƯƠNG */}
                        <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">
                          {fileName}
                        </td>

                        {/* Tiêu đề gốc */}
                        <td className="py-2.5 px-3 text-neutral-300 font-serif max-w-xs truncate" title={chap.rawTitle}>
                          {chap.rawTitle}
                        </td>

                        {/* Tiêu đề dịch */}
                        <td className="py-2.5 px-3 text-neutral-200 max-w-xs truncate" title={chap.translatedTitle || 'Chưa dịch'}>
                          {chap.translatedTitle || (
                            <span className="text-neutral-600 italic">Chưa dịch</span>
                          )}
                        </td>

                        {/* Số ký tự */}
                        <td className="py-2.5 px-3 text-right font-mono text-neutral-400">
                          {chap.charCount.toLocaleString()}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-2.5 px-3 text-center">
                          {chap.status === 'done' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                              <CheckCircle size={11} />
                              Xong
                            </span>
                          ) : chap.status === 'processing' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-full animate-pulse">
                              <Clock size={11} />
                              Đang dịch
                            </span>
                          ) : chap.status === 'error' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded-full">
                              <AlertCircle size={11} />
                              Lỗi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 bg-neutral-800/60 px-2 py-0.5 rounded-full">
                              Chờ
                            </span>
                          )}
                        </td>

                        {/* Thao tác xem trước */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setPreviewChapter(chap)}
                            className="p-1 rounded-md text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Xem trước chương"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Phân trang dưới cùng */}
        {chapters.length > 0 && (
          <div className="shrink-0 px-6 py-2.5 border-t border-neutral-800/80 bg-neutral-900/60 flex items-center justify-between text-xs text-neutral-400">
            <div>
              Hiển thị {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredChapters.length)} trong tổng số {filteredChapters.length} chương
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 disabled:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-mono text-neutral-200">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 disabled:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL XEM TRƯỚC CHƯƠNG (PREVIEW MODAL) */}
      {previewChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-100 flex flex-col h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="font-mono px-2 py-0.5 rounded-md bg-cyan-950 border border-cyan-800/60 text-cyan-400 font-bold text-xs">
                  {previewChapter.chapterNum}.{exportFormat}
                </span>
                <h3 className="font-bold text-sm text-white truncate max-w-lg">
                  {previewChapter.translatedTitle || previewChapter.rawTitle}
                </h3>
              </div>
              <button
                onClick={() => setPreviewChapter(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content: 2 cột Gốc & Dịch */}
            <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden pt-4">
              <div className="flex flex-col border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <div className="px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-xs font-semibold text-neutral-400">
                  Gốc tiếng Trung ({previewChapter.rawTitle})
                </div>
                <div className="flex-1 p-4 overflow-y-auto font-serif text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {previewChapter.content}
                </div>
              </div>

              <div className="flex flex-col border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <div className="px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-xs font-semibold text-cyan-400">
                  Bản dịch ({previewChapter.translatedTitle || 'Chưa dịch'})
                </div>
                <div className="flex-1 p-4 overflow-y-auto text-xs text-neutral-100 leading-relaxed whitespace-pre-wrap">
                  {previewChapter.translatedContent || (
                    <span className="text-neutral-500 italic">Chương này chưa được dịch. Bấm "Bắt đầu dịch" ở màn hình chính.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => setPreviewChapter(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
