import { BatchSaveRange } from '../BatchSaveRange';
import { BatchChapterPreviewDialog } from '../BatchChapterPreviewDialog';
import { BatchSaveMenu } from '../BatchSaveMenu';
import { BatchNameDetector, type NameSuggestion } from '../../utils/batchNameDetection';
import { BatchNameReviewDialog } from '../BatchNameReviewDialog';
import { LibrarySaveConflictDialog } from '../LibrarySaveConflictDialog';
import { NewLibraryBookDialog, type NewLibraryBook } from '../NewLibraryBookDialog';
import { createLibraryChapterMatcher, type ChapterInput } from '../../utils/libraryChapterMerge';
import type { NameItem } from '../../data/defaultNames';
import type { NovelBook } from '../../context/AppContext';
import { resolveTranslationStyle, type TranslationStyleChoice } from '../../utils/translationStyle';
import { TranslationStyleSelect } from '../TranslationStyleSelect';
import { chapterFileNames } from '../../utils/chapterFileNames';
/**
 * Màn hình Dịch hàng loạt nhiều chương (Batch Translation View)
 * Thiết kế tối ưu riêng cho giao diện máy tính / PC
 * Hỗ trợ nạp đến 2000+ chương, lưu từng file riêng biệt theo STT chương (1810.txt, 1810.docx)
 * Lưu hàng loạt vào Thư viện với tính năng tự động lọc bỏ chương trùng lặp
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { useApp } from '../../context/AppContext';
import { convertText } from '../../utils/translatorEngine';
import {
  BatchTranslationItem,
  parseMultipleFiles,
  extractChapterNumber,
} from '../../utils/chapterSplitter';
import {
  downloadChapterFiles,
} from '../../utils/batchExportUtils';
import {
  FolderUp,
  FileText,
  Play,
  Pause,
  RotateCcw,
  Search,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
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
    updateSettings,
    novelsList,
    importEntriesBatch,
    savedChapters,
    saveLibraryChapters,
  } = useApp();

  const [reviewed, setReviewed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<NameSuggestion[]>([]);
  const [saveBusy, setSaveBusy] = useState(false);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ book: string | Omit<NovelBook, 'id' | 'createdAt' | 'updatedAt'>; chapters: ChapterInput[]; matchIds: string[] } | null>(null);
  const [novelTitle, setNovelTitle] = useState<string>('Tiểu Thuyết Mới');
  const [selectedNovelId, setSelectedNovelId] = useState<string>('');
  const [startChapterNum] = useState<number>(1);
  const styleChoice = settings.translationStyle || 'neutral';
  const setStyleChoice = (choice: TranslationStyleChoice) => updateSettings({ translationStyle: resolveTranslationStyle([], choice) });
  const styleNovel = novelsList.find(novel => novel.id === selectedNovelId);
  const styleTags = styleNovel?.genres?.length ? styleNovel.genres : [styleNovel?.genre || ''];
  const translationStyle = styleChoice;
  const [exportFormat, setExportFormat] = useState<'txt' | 'docx'>('txt');

  // Danh sách chương
  const [chapters, setChapters] = useState<BatchTranslationItem[]>([]);
  const [excludedChapterIds, setExcludedChapterIds] = useState<Set<string>>(() => new Set());
  const completedChapters = useMemo(() => chapters.filter(chapter => chapter.status === 'done' && chapter.translatedContent), [chapters]);
  const selectedChapters = useMemo(() => completedChapters.filter(chapter => !excludedChapterIds.has(chapter.id)), [completedChapters, excludedChapterIds]);
  const allChaptersSelected = completedChapters.length > 0 && selectedChapters.length === completedChapters.length;
  const toggleAllChapters = () => setExcludedChapterIds(allChaptersSelected ? new Set(completedChapters.map(chapter => chapter.id)) : new Set());
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
  const [exportError, setExportError] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Modal xem trước chương
  const [previewChapter, setPreviewChapter] = useState<BatchTranslationItem | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<BatchTranslationItem | 'all' | null>(null);
  const exportNames = useMemo(() => chapterFileNames(chapters, exportFormat), [chapters, exportFormat]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeQueuedChapter = (id: string) => {
    if (isTranslating || isImporting) return;
    setReviewed(false);
    setNameSuggestions([]);
    setChapters(previous => previous.filter(chapter => chapter.id !== id).map(chapter => ({ ...chapter, status: 'pending', translatedContent: '', translatedTitle: '' })));
    setCurrentPage(1);
    setCurrentIndex(0);
    if (previewChapter?.id === id) setPreviewChapter(null);
  };

  const confirmRemoval = () => {
    if (isTranslating || isImporting) { setPendingRemoval(null); return; }
    if (pendingRemoval === 'all') {
      setReviewed(false);
      setNameSuggestions([]);
      setChapters([]);
      setCurrentIndex(0);
      setCurrentPage(1);
      setPreviewChapter(null);
    } else if (pendingRemoval) removeQueuedChapter(pendingRemoval.id);
    setPendingRemoval(null);
  };

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Cập nhật ref khi paused state thay đổi
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Keep imported numbering independent from the save selection range.
  // Recover title numbers for queues retained by hot reload from the old renumber control.
  useEffect(() => {
    setChapters(previous => {
      let changed = false;
      const next = previous.map(chapter => {
        const number = chapter.sourceChapterNum ?? extractChapterNumber(chapter.rawTitle, chapter.chapterNum);
        if (chapter.chapterNum === number && chapter.sourceChapterNum === number) return chapter;
        changed = true;
        return { ...chapter, chapterNum: number, sourceChapterNum: number };
      });
      return changed ? next : previous;
    });
  }, [chapters.length]);

  // Xử lý nạp nhiều file
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (isImporting || isTranslating) return;
    setIsImporting(true);
    try {
      showToast(`Đang phân tích ${files.length} tệp...`);
      const parsed = await parseMultipleFiles(Array.from(files), startChapterNum);
      const items: BatchTranslationItem[] = parsed.map(p => ({
        ...p,
        sourceChapterNum: p.chapterNum,
        translatedTitle: '',
        translatedContent: '',
        status: 'pending',
      }));
      setReviewed(false);
      setNameSuggestions([]);
      setChapters(items);
      setExcludedChapterIds(new Set());
      setCurrentIndex(0);
      setCurrentPage(1);
      showToast(`Đã nạp thành công ${items.length} chương!`);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi đọc danh sách tệp', true);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Hàm dịch đơn lẻ 1 chương
  const translateSingleItem = (item: BatchTranslationItem, translationNames: NameItem[] = namesList) => {
    const convTitle = convertText(item.rawTitle, translationNames, vietphraseMap, {
      prioritizeNames: translationNames !== namesList || settings.prioritizeNames,
      capitalizeSentences: settings.capitalizeSentences,
      customLuatNhan: luatNhanMap,
      customPronouns: pronounsMap,
      style: translationStyle,
      customIgnored: ignoredPhrasesList,
    });

    const convBody = convertText(item.content, translationNames, vietphraseMap, {
      prioritizeNames: translationNames !== namesList || settings.prioritizeNames,
      capitalizeSentences: settings.capitalizeSentences,
      customLuatNhan: luatNhanMap,
      customPronouns: pronounsMap,
      style: translationStyle,
      customIgnored: ignoredPhrasesList,
    });

    return {
      title: convTitle.fullText || item.rawTitle,
      content: convBody.fullText || item.content,
      tokens: convBody.tokens,
    };
  };

  // Bắt đầu dịch hàng loạt (Non-blocking Queue với chunks)
  const handleStartBatchTranslation = async () => {
    if (chapters.length === 0) {
      showToast('Chưa có chương nào để dịch!', true);
      return;
    }

    if (isTranslating || reviewBusy || saveBusy) return;
    setReviewed(false);
    setReviewOpen(false);
    setNameSuggestions([]);
    setChapters(previous => previous.map(chapter => ({ ...chapter, status: 'pending', translatedTitle: '', translatedContent: '' })));
    setExcludedChapterIds(new Set());
    const detector = new BatchNameDetector(namesList.map(row => row.chinese));
    setIsTranslating(true);
    setIsPaused(false);
    cancelRequestedRef.current = false;
    isPausedRef.current = false;

    // Tìm vị trí chương chưa hoàn thành đầu tiên
    const startIdx = 0;

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
        detector.addChapter(currentItem.content, res.tokens);

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
    setNameSuggestions(detector.suggestions({ includeUncertain: true }));
    if (!cancelRequestedRef.current) {
      setReviewOpen(true);
      showToast('Đã dịch nháp. Hãy duyệt tên và xác nhận bản dịch.');
    }
  };

  useEffect(() => () => { cancelRequestedRef.current = true; }, []);
  useEffect(() => {
    setReviewed(false);
    setNameSuggestions([]);
    setChapters(previous => previous.map(chapter => ({ ...chapter, translatedContent: '', translatedTitle: '', status: 'pending' })));
  }, [translationStyle]);

  const confirmNameReview = async (selected: { chinese: string; vietnamese: string }[], remember: boolean) => {
    if (reviewBusy) return;
    setReviewBusy(true);
    try {
      const approved: NameItem[] = [...namesList, ...selected.map(row => ({ ...row, id: `review-${crypto.randomUUID()}`, category: 'Nhân vật' as const, createdAt: Date.now() }))];
      const updated = [...chapters];
      if (selected.length) {
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].status !== 'done') continue;
          const result = translateSingleItem(updated[i], approved);
          updated[i] = { ...updated[i], translatedTitle: result.title, translatedContent: result.content };
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (remember) await importEntriesBatch('names', selected);
      }
      setChapters(updated);
      setPreviewChapter(null);
      setReviewed(true);
      setReviewOpen(false);
      showToast('Đã xác nhận bản dịch. Bạn có thể xuất hoặc lưu thư viện.');
    } catch (error) { showToast('Không hoàn tất được bản dịch: ' + String(error), true); }
    finally { setReviewBusy(false); }
  };

  // Tạm dừng / Tiếp tục
  const handleTogglePause = () => {
    setIsPaused(prev => !prev);
  };

  // Hủy tiến trình dịch
  const handleStopTranslation = () => {
    cancelRequestedRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    showToast('Đã dừng tiến trình dịch');
  };

  // Tải từng chương đã chọn bằng cùng cơ chế tải EPUB của thư viện.
  const handleDownloadSelectedFiles = async (format: 'txt' | 'docx') => {
    if (!reviewed || reviewBusy || isTranslating) { showToast('Hãy duyệt tên và xác nhận bản dịch trước.', true); return; }
    const readyChapters = selectedChapters;
    if (readyChapters.length === 0) {
      showToast('Chưa có chương nào có nội dung để lưu!', true);
      return;
    }


    setIsExporting(true);
    setExportError('');
    setExportMessage('Đang tạo file tải xuống...');

    try {
      const res = await downloadChapterFiles(
        readyChapters,
        format,
        (saved, total, currentName) => {
          setExportMessage(`Đã gửi ${currentName} tới trình tải xuống (${saved}/${total})...`);
        },
      );
      showToast(`Đã gửi ${res.count} file ${format.toUpperCase()} tới trình tải xuống.`);
    } catch (err: any) {
      const message = err.message || 'Không tạo được file tải xuống'; setExportError(message); showToast(message, true);
    } finally {
      setIsExporting(false);
      setExportMessage('');
    }
  };

  const handleSaveAllToLibrary = async (newBook?: NewLibraryBook) => {
    if (!reviewed || reviewBusy || isTranslating) { showToast('Hãy duyệt tên và xác nhận bản dịch trước.', true); return; }
    const readyChapters = selectedChapters;
    if (readyChapters.length === 0) {
      showToast('Chưa có chương nào đã dịch để lưu vào Thư viện!', true);
      return;
    }

    try {
      const existingNovel = novelsList.find(row => row.title.trim().toLowerCase() === novelTitle.trim().toLowerCase());
      if (!newBook && !selectedNovelId && !existingNovel) { setNewBookOpen(true); return; }
      const book = newBook ? { ...newBook, translationStyle } : selectedNovelId || existingNovel!.id;
      const incoming = readyChapters.map(chap => {
        const prefix = `Chương ${chap.chapterNum}`;
        const part = chap.rawTitle.match(/[（(]\s*(\d+)\s*[/／]\s*(\d+)\s*[)）]/);
        const base = chap.translatedTitle || `${prefix}: Đang cập nhật`;
        const title = part && !/[（(]\s*\d+\s*[/／]\s*\d+\s*[)）]/.test(base) ? `${base} (${part[1]}/${part[2]})` : base;
        return { title, chapterPrefix: prefix, chapterName: chap.translatedTitle.replace(/^(?:Chương|Hồi|Tiết)\s*\d+[\s:：\-–—\.]*/i, ''),
          originalText: chap.content, vietphraseText: chap.translatedContent };
      });
      const novel = typeof book === 'string' ? novelsList.find(row => row.id === book) : novelsList.find(row => row.title.toLowerCase() === book.title.toLowerCase());
      const matcher = createLibraryChapterMatcher(savedChapters);
      const matchIds = [...new Set(incoming.map(chapter => matcher.find( { ...chapter, novelId: novel?.id, novelTitle: novel?.title || (typeof book === 'string' ? '' : book.title) })?.id).filter((id): id is string => !!id))];
      if (matchIds.length) { setPendingSave({ book, chapters: incoming, matchIds }); return; }
      await saveBatchLibrary({ book, chapters: incoming, matchIds: [] }, 'overwrite');
    } catch (error) { showToast('Không lưu được thư viện: ' + String(error), true); }
  };

  const saveBatchLibrary = async (data: NonNullable<typeof pendingSave>, policy: 'overwrite' | 'skip') => {
    if (saveBusy) return;
    setSaveBusy(true);
    try {
      const result = await saveLibraryChapters(data.book, data.chapters, { duplicatePolicy: policy, overwriteIds: data.matchIds });
      setSelectedNovelId(result.novelId);
      setNewBookOpen(false);
      setPendingSave(null);
      showToast(`Đã lưu ${result.count} chương mới, ghi đè ${result.overwritten}, giữ ${result.skipped} bản cũ.`);
    } catch (error) { showToast('Không lưu được thư viện: ' + String(error), true); }
    finally { setSaveBusy(false); }
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
  useEffect(() => { setCurrentPage(previous => Math.min(previous, totalPages)); }, [totalPages]);
  const displayedChapters = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredChapters.slice(start, start + PAGE_SIZE);
  }, [filteredChapters, currentPage]);

  return (
    <div className="@container flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden bg-canvas text-main">

      {reviewOpen && <BatchNameReviewDialog suggestions={nameSuggestions} busy={reviewBusy} chapterCount={chapters.filter(chapter => chapter.status === 'done').length} onConfirm={confirmNameReview} onCancel={() => { if (!reviewBusy) setReviewOpen(false); }} />}
      {pendingSave && <LibrarySaveConflictDialog count={pendingSave.matchIds.length} busy={saveBusy} onChoose={policy => void saveBatchLibrary(pendingSave, policy)} onCancel={() => setPendingSave(null)} />}
      {newBookOpen && !pendingSave && <NewLibraryBookDialog initialTitle={novelTitle} chapterCount={selectedChapters.length} busy={saveBusy} onCancel={() => { if (!saveBusy) setNewBookOpen(false); }} onConfirm={book => void handleSaveAllToLibrary(book)} />}
      {!reviewed && chapters.some(chapter => chapter.status === 'done') && !isTranslating && <div role="status" className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-raised px-4 py-2 text-sm"><span>Bản dịch nháp — cần xác nhận trước khi xuất hoặc lưu.</span><button className="studio-action" onClick={() => setReviewOpen(true)}>Duyệt tên và xác nhận</button></div>}
      {pendingRemoval && <ConfirmDeleteDialog
        description={pendingRemoval === 'all'
          ? `Xóa toàn bộ ${chapters.length} chương khỏi danh sách dịch? Tệp gốc và truyện trong thư viện vẫn được giữ.`
          : `Xóa “${pendingRemoval.rawTitle}” (${exportNames.get(pendingRemoval.id)}) khỏi danh sách dịch? Tệp gốc vẫn được giữ.`}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={confirmRemoval}
      />}

      {/* Respond to the app width, including the phone frame on desktop. */}
      <div className="flex min-w-0 min-h-0 flex-col flex-1 h-full overflow-hidden [&_svg]:shrink-0">
        {/* Top Control Bar */}
        <div data-batch-toolbar="actions" className="shrink-0 px-3 @min-[640px]:px-6 py-3 border-b border-line/80 bg-surface grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sticky top-0 z-20">
          {/* Nút nạp dữ liệu */}
          <div className="flex min-w-0 items-center gap-2 [&_button]:min-h-8 [&_button]:justify-center [&_button]:whitespace-nowrap">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".txt,.docx,.epub,text/plain,application/epub+zip"
              onChange={handleFilesSelected}
              disabled={isImporting || isTranslating}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || isTranslating}
              title="Nạp tệp TXT, DOCX hoặc EPUB"
              className="studio-action"
            >
              <FolderUp size={13} className="text-accent" />
              <span>{isImporting ? 'Đang nhập...' : 'Thêm tệp'}</span>
            </button>

          </div>

          <div className="min-w-0 justify-self-center max-w-full"><TranslationStyleSelect compact value={styleChoice} autoStyle={resolveTranslationStyle(styleTags, styleNovel?.translationStyle || 'auto')} tags={styleTags} onChange={setStyleChoice} disabled={isTranslating} /></div>
          {/* Action buttons */}
          <div className="justify-self-end flex min-w-0 items-center gap-2 [&_button]:min-h-9 [&_button]:justify-center [&_button]:whitespace-nowrap">

            {!isTranslating ? (
              <button
                onClick={handleStartBatchTranslation}
                disabled={chapters.length === 0 || reviewBusy || saveBusy}
                className="studio-action studio-action-primary"
                title="Dịch toàn bộ chương đã thêm"
              >
                <Play size={14} />
                <span>Dịch tất cả</span>
              </button>
            ) : (
              <div className="flex min-w-0 items-center justify-center gap-1.5">
                <button
                  onClick={handleTogglePause}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-main rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isPaused ? <Play size={14} /> : <Pause size={14} />}
                  <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                </button>
                <button
                  onClick={handleStopTranslation}
                  className="p-1.5 bg-raised hover:bg-rose-900/70 text-rose-300 hover:text-main rounded-lg transition-colors cursor-pointer"
                  title="Dừng tiến trình"
                >
                  <X size={15} />
                </button>
              </div>
            )}


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
            <button onClick={() => setToastMessage(null)} className="text-muted hover:text-main">
              <X size={13} />
            </button>
          </div>
        )}

        {exportError && <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-rose-800 bg-rose-950 px-4 py-3 text-xs text-rose-100"><span className="min-w-0 flex-1">{exportError}</span><button className="underline" onClick={() => void handleDownloadSelectedFiles(exportFormat)}>Thử lưu lại</button><button aria-label="Đóng lỗi lưu file" onClick={() => setExportError('')}><X size={14} /></button></div>}
        {isExporting && exportMessage && (
          <div className="px-6 py-2 bg-accent-soft/90 text-accent border-b border-accent text-xs font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-soft animate-ping" />
            <span>{exportMessage}</span>
          </div>
        )}

        {/* Cấu hình & Nạp đầu vào */}
        <div data-batch-toolbar="settings" className="shrink-0 min-w-0 px-3 @min-[640px]:px-6 py-3 border-b border-line/60 bg-surface/30 flex flex-wrap gap-x-4 gap-y-2 items-center text-xs">
          <div className="batch-save-controls flex shrink-0 items-center">
            <BatchSaveMenu disabled={!reviewed || isTranslating || reviewBusy || saveBusy || isExporting || !selectedChapters.length} onLibrary={() => void handleSaveAllToLibrary()} onComputer={format => { setExportFormat(format); void handleDownloadSelectedFiles(format); }} />
          </div>
          {/* Tên truyện & Thư viện */}
          <BatchSaveRange
            key={`${chapters.length}:${chapters[0]?.id || ''}:${reviewed}`}
            numbers={chapters.map(chapter => chapter.chapterNum)}
            disabled={!completedChapters.length || isTranslating || reviewBusy || saveBusy || isExporting}
            onChange={(first, last) => setExcludedChapterIds(new Set(chapters.filter(chapter => chapter.chapterNum < first || chapter.chapterNum > last).map(chapter => chapter.id)))}
          />
          <div className="batch-book-fields flex min-w-0 flex-wrap items-center gap-2">
            {novelsList.length > 0 && (
              <select
                aria-label="Chọn truyện từ thư viện"
                value={selectedNovelId}
                onChange={(e) => {
                  setSelectedNovelId(e.target.value);
                  const found = novelsList.find(n => n.id === e.target.value);
                  if (found) setNovelTitle(found.title);
                }}
                className="w-40 max-w-full min-w-0 h-8 bg-surface border border-line rounded-lg px-2 py-1.5 text-xs text-main focus:outline-none focus:border-accent"
              >
                <option value="">Chọn từ thư viện</option>
                {novelsList.map(n => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            )}
            <label htmlFor="batch-novel-title" className="text-muted whitespace-nowrap">Tên truyện:</label>
            <input
              id="batch-novel-title"
              type="text"
              value={novelTitle}
              onChange={(e) => setNovelTitle(e.target.value)}
              placeholder="Nhập tên truyện..."
              className="w-52 max-w-full min-w-0 h-8 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-accent"
            />

          </div>

          {/* STT Bắt đầu */}



        </div>

        {/* Thanh trạng thái tiến độ thời gian thực */}
        <div className="shrink-0 px-3 @min-[640px]:px-6 py-2.5 bg-surface/40 border-b border-line/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 @min-[640px]:gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">Tiến độ:</span>
              <span className="font-semibold text-main font-mono">{stats.done} / {stats.total} chương</span>
              <span className="text-accent font-mono font-bold">({stats.percent}%)</span>
            </div>
            <div className="w-full @min-[640px]:w-32 @min-[960px]:w-48 bg-raised rounded-full h-2 overflow-hidden border border-line/60">
              <div
                className="bg-accent h-full transition-all duration-200"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            {/* Tìm kiếm chương */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm chương..."
                className="bg-surface border border-line rounded-lg pl-8 pr-3 py-1 text-xs text-main focus:outline-none focus:border-accent w-44"
              />
            </div>

            {chapters.length > 0 && (
              <button
                onClick={() => setPendingRemoval('all')}
                disabled={isTranslating || isImporting}
                className="p-1 rounded-md text-muted hover:text-rose-400 hover:bg-raised transition-colors"
                title="Xóa danh sách chương hiện tại"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Bảng danh sách chương (Phân trang 50 chương/trang) */}
        <div className="batch-chapter-list flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 @min-[640px]:px-6 py-2">
          {completedChapters.length > 0 && <div className="mb-2 shrink-0 text-xs">
            <span role="status" className="text-muted">Đã chọn {selectedChapters.length}/{completedChapters.length} chương để lưu</span>
          </div>}
          {chapters.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted">
              <div className="w-14 h-14 rounded-2xl bg-surface border border-line flex items-center justify-center text-muted mb-3">
                <FileText size={28} />
              </div>
              <p className="text-sm font-medium text-main">Chưa có chương</p>
              <p className="text-xs text-muted mt-1 max-w-sm">
                Thêm tệp TXT, DOCX hoặc EPUB để bắt đầu dịch.
              </p>
            </div>
          ) : (
            <div className="batch-chapter-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-line/80 bg-surface/30">
              <table className="batch-chapter-table w-full min-w-[640px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface/80 border-b border-line text-muted font-semibold">
                    <th className="w-9 px-3 py-2.5"><input type="checkbox" aria-label="Chọn tất cả chương đã dịch" checked={allChaptersSelected} ref={element => { if (element) element.indeterminate = selectedChapters.length > 0 && !allChaptersSelected; }} disabled={!completedChapters.length || isTranslating || reviewBusy || saveBusy || isExporting} onChange={toggleAllChapters} /></th>
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
                    const fileName = exportNames.get(chap.id);
                    return (
                      <tr
                        key={chap.id}
                        className="hover:bg-raised/30 transition-colors group"
                      >
                        <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Chọn lưu ${chap.rawTitle}`} checked={chap.status === 'done' && !!chap.translatedContent && !excludedChapterIds.has(chap.id)} disabled={chap.status !== 'done' || !chap.translatedContent || isTranslating || reviewBusy || saveBusy || isExporting} onChange={event => { const checked = event.target.checked; setExcludedChapterIds(previous => { const next = new Set(previous); if (checked) next.delete(chap.id); else next.add(chap.id); return next; }); }} /></td>
                        {/* Tên file: CHỈ GỒM STT CHƯƠNG */}
                        <td className="py-2.5 px-3 font-mono font-bold text-accent">
                          {fileName}
                          <span className={`batch-mobile-status hidden ml-1 ${chap.status === 'done' ? 'text-emerald-500' : chap.status === 'error' ? 'text-rose-500' : 'text-muted'}`} aria-label={chap.status === 'done' ? 'Đã dịch' : chap.status === 'error' ? 'Lỗi dịch' : chap.status === 'processing' ? 'Đang dịch' : 'Chưa dịch'}>●</span>
                        </td>

                        {/* Tiêu đề gốc */}
                        <td className="py-2.5 px-3 text-main font-serif max-w-xs truncate" title={chap.rawTitle}>
                          {chap.rawTitle}
                        </td>

                        {/* Tiêu đề dịch */}
                        <td className="py-2.5 px-3 text-main max-w-xs truncate" title={chap.translatedTitle || 'Chưa dịch'}>
                          {chap.translatedTitle || (
                            <span className="text-muted italic">{chap.rawTitle}</span>
                          )}
                        </td>

                        {/* Số ký tự */}
                        <td className="py-2.5 px-3 text-right font-mono text-muted">
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
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent bg-accent-soft/60 border border-accent/40 px-2 py-0.5 rounded-full animate-pulse">
                              <Clock size={11} />
                              Đang dịch
                            </span>
                          ) : chap.status === 'error' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded-full">
                              <AlertCircle size={11} />
                              Lỗi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted bg-raised/60 px-2 py-0.5 rounded-full">
                              Chờ
                            </span>
                          )}
                        </td>

                        {/* Thao tác xem trước */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setPreviewChapter(chap)}
                            className="p-1 rounded-md text-muted hover:text-accent hover:bg-raised transition-colors cursor-pointer"
                            title="Xem trước chương"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => setPendingRemoval(chap)}
                            disabled={isTranslating || isImporting}
                            aria-label={`Bỏ chương ${chap.chapterNum} khỏi danh sách dịch`}
                            title="Bỏ khỏi danh sách dịch"
                            className="ml-1 rounded-md p-1 text-muted hover:bg-raised hover:text-rose-400 disabled:opacity-30"
                          >
                            <Trash2 size={14} />
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
          <div className="batch-pagination shrink-0 px-3 @min-[640px]:px-6 py-2 border-t border-line/80 bg-surface flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <div>
              {filteredChapters.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredChapters.length)} / ${filteredChapters.length} chương` : 'Không có chương phù hợp'}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md bg-raised hover:bg-hover disabled:opacity-40 text-main disabled:hover:bg-raised transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-mono text-main">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md bg-raised hover:bg-hover disabled:opacity-40 text-main disabled:hover:bg-raised transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL XEM TRƯỚC CHƯƠNG (PREVIEW MODAL) */}
      {previewChapter && (
        <BatchChapterPreviewDialog chapter={previewChapter} filename={exportNames.get(previewChapter.id)} onClose={() => setPreviewChapter(null)} />
      )}
    </div>
  );
};
