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
import { chapterIdsOutsidePositionRange } from '../../utils/chapterRange';
import { useBackgroundTasks, type BackgroundTaskControl } from '../../context/BackgroundTasks';
import { quickTranslateOneMeaningForBatch } from '../../utils/quickTranslatorPort';
import { clearBatchDraft, deleteBatchDraftChapters, readBatchDraft, replaceBatchDraft, saveBatchDraftChapter, saveBatchDraftChapters, saveBatchDraftMeta } from '../../utils/indexedDbStorage';
/**
 * Màn hình Dịch hàng loạt nhiều chương (Batch Translation View)
 * Thiết kế tối ưu riêng cho giao diện máy tính / PC
 * Hỗ trợ nạp đến 2000+ chương, lưu từng file riêng biệt theo STT chương (1810.txt, 1810.docx)
 * Lưu hàng loạt vào Thư viện với tính năng tự động lọc bỏ chương trùng lặp
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { useApp } from '../../context/AppContext';
import {
  BatchTranslationItem,
  parseMultipleFiles,
  extractChapterNumber,
} from '../../utils/chapterSplitter';
import {
  downloadChaptersAsZip,
  saveChaptersToUserFolder,
} from '../../utils/batchExportUtils';
import type { ChapterExportFormat } from '../../utils/chapterFileNames';
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
const BATCH_DRAFT_VERSION = 1;

type BatchDraftMeta = {
  version: number;
  chapterIds: string[];
  excludedChapterIds?: string[];
  reviewed?: boolean;
  selectedNovelId?: string;
};

export const BatchTranslateView: React.FC = () => {
  const background = useBackgroundTasks();
  const {
    activeTab,
    namesList, namesMainMap, phienAmMap, dictionaryStyleRevision,
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
  const [selectedNovelId, setSelectedNovelId] = useState<string>('');
  const [startChapterNum] = useState<number>(1);
  const styleChoice = settings.translationStyle || 'neutral';
  const setStyleChoice = (choice: TranslationStyleChoice) => updateSettings({ translationStyle: resolveTranslationStyle([], choice) });
  const styleNovel = novelsList.find(novel => novel.id === selectedNovelId);
  const styleTags = styleNovel?.genres?.length ? styleNovel.genres : [styleNovel?.genre || ''];
  const translationStyle = styleChoice;
  const [exportFormat, setExportFormat] = useState<ChapterExportFormat>('txt');

  // Danh sách chương
  const [chapters, setChapters] = useState<BatchTranslationItem[]>([]);
  const [excludedChapterIds, setExcludedChapterIds] = useState<Set<string>>(() => new Set());
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const completedChapters = useMemo(() => chapters.filter(chapter => chapter.status === 'done' && chapter.translatedContent), [chapters]);
  const selectedChapters = useMemo(() => completedChapters.filter(chapter => !excludedChapterIds.has(chapter.id)), [completedChapters, excludedChapterIds]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Trạng thái dịch
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const cancelRequestedRef = useRef<boolean>(false);
  const batchWorkerRef = useRef<Worker | null>(null);
  const abortBatchRunRef = useRef<(() => void) | null>(null);
  const batchRunIdRef = useRef(0);
  const draftQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [draftReady, setDraftReady] = useState(false);

  // Trạng thái xuất file / lưu
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Modal xem trước chương
  const [previewChapter, setPreviewChapter] = useState<BatchTranslationItem | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<BatchTranslationItem | 'all' | { ids: string[] } | null>(null);
  const exportNames = useMemo(() => chapterFileNames(chapters, exportFormat), [chapters, exportFormat]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueDraft = (work: () => Promise<void>) => {
    const next = draftQueueRef.current.then(work);
    draftQueueRef.current = next.catch(error => console.error('Không thể lưu nháp dịch hàng loạt', error));
    return next;
  };
  const draftMeta = (items = chapters): BatchDraftMeta => ({
    version: BATCH_DRAFT_VERSION, chapterIds: items.map(item => item.id), excludedChapterIds: [...excludedChapterIds], reviewed, selectedNovelId,
  });

  useEffect(() => {
    let active = true;
    void readBatchDraft<BatchTranslationItem>().then(({ meta, chapters: stored }) => {
      if (!active || !meta || meta.version !== BATCH_DRAFT_VERSION || !stored.length) return;
      const saved = meta as unknown as BatchDraftMeta;
      const byId = new Map(stored.map(item => [item.id, item.status === 'processing' ? { ...item, status: 'pending' as const } : item]));
      const restored = (saved.chapterIds || []).map(id => byId.get(id)).filter((item): item is BatchTranslationItem => !!item);
      if (!restored.length) return;
      setChapters(restored); setExcludedChapterIds(new Set(saved.excludedChapterIds || [])); setReviewed(!!saved.reviewed);
      setSelectedNovelId(saved.selectedNovelId || '');
    }).catch(error => console.error('Không thể khôi phục nháp dịch hàng loạt', error)).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    void queueDraft(() => saveBatchDraftMeta(draftMeta()));
  }, [draftReady, excludedChapterIds, reviewed, selectedNovelId]);

  const removeQueuedChapter = (id: string) => {
    if (isTranslating || isImporting) return;
    setReviewed(false);
    setNameSuggestions([]);
    setChapters(previous => previous.filter(chapter => chapter.id !== id));
    setSelectedRowIds(previous => { const next = new Set(previous); next.delete(id); return next; });
    setCurrentPage(1);
    setCurrentIndex(0);
    if (previewChapter?.id === id) setPreviewChapter(null);
    void queueDraft(async () => {
      await deleteBatchDraftChapters([id]);
      await saveBatchDraftMeta(draftMeta(chapters.filter(chapter => chapter.id !== id)));
    });
  };

  const confirmRemoval = () => {
    if (isTranslating || isImporting) { setPendingRemoval(null); return; }
    if (pendingRemoval === 'all') {
      setReviewed(false);
      setNameSuggestions([]);
      setChapters([]);
      setSelectedRowIds(new Set());
      setCurrentIndex(0);
      setCurrentPage(1);
      setPreviewChapter(null);
      void queueDraft(clearBatchDraft);
    } else if (pendingRemoval && 'ids' in pendingRemoval) {
      const removed = new Set(pendingRemoval.ids);
      setReviewed(false);
      setNameSuggestions([]);
      setChapters(previous => previous.filter(chapter => !removed.has(chapter.id)));
      setSelectedRowIds(previous => new Set([...previous].filter(id => !removed.has(id))));
      setExcludedChapterIds(previous => new Set([...previous].filter(id => !removed.has(id))));
      setCurrentIndex(0);
      setCurrentPage(1);
      if (previewChapter && removed.has(previewChapter.id)) setPreviewChapter(null);
      void queueDraft(async () => {
        await deleteBatchDraftChapters(pendingRemoval.ids);
        await saveBatchDraftMeta({ ...draftMeta(chapters.filter(chapter => !removed.has(chapter.id))), excludedChapterIds: [...excludedChapterIds].filter(id => !removed.has(id)) });
      });
    } else if (pendingRemoval) removeQueuedChapter(pendingRemoval.id);
    setPendingRemoval(null);
  };

  const showToast = (text: string, isError = false) => {
    background.notify(text, isError);
  };

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
      setSelectedRowIds(new Set());
      setCurrentIndex(0);
      setCurrentPage(1);
      await queueDraft(() => replaceBatchDraft(items, { version: BATCH_DRAFT_VERSION, chapterIds: items.map(item => item.id), excludedChapterIds: [], reviewed: false, selectedNovelId }));
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
    const quickOptions = {
      namesMainMap, phienAmMap, luatNhanMap, pronounsMap,
      ignoredPhrases: ignoredPhrasesList,
      translationAlgorithm: settings.quickTranslationAlgorithm,
      wrapType: settings.quickVietphraseWrapType,
      prioritizedName: settings.prioritizeNames,
      capitalizeLines: settings.capitalizeSentences,
    } as const;
    const [quickTitle, quickBody] = [quickTranslateOneMeaningForBatch(item.rawTitle, translationNames, vietphraseMap, quickOptions), quickTranslateOneMeaningForBatch(item.content, translationNames, vietphraseMap, quickOptions)];

    return {
      title: quickTitle || item.rawTitle,
      content: quickBody || item.content,
    };
  };

  // Bắt đầu dịch hàng loạt trong Worker để luồng giao diện vẫn phản hồi.
  const handleStartBatchTranslation = async (control: BackgroundTaskControl) => {
    if (chapters.length === 0) {
      showToast('Chưa có chương nào để dịch!', true);
      return;
    }

    if (isTranslating || reviewBusy || saveBusy) return;
    setReviewed(false);
    setReviewOpen(false);
    setNameSuggestions([]);
    const resetChapters = chapters.map(chapter => ({ ...chapter, status: 'pending' as const, translatedTitle: '', translatedContent: '' }));
    setChapters(resetChapters);
    setExcludedChapterIds(new Set());
    void queueDraft(() => replaceBatchDraft(resetChapters, { ...draftMeta(resetChapters), excludedChapterIds: [], reviewed: false }));
    const detector = new BatchNameDetector([...namesList.map(row => row.chinese), ...Object.keys(namesMainMap)]);
    setIsTranslating(true);
    setIsPaused(false);
    cancelRequestedRef.current = false;
    background.progress({ detail: 'Đang khởi động bộ dịch…', percent: 0 });
    const runId = ++batchRunIdRef.current;
    const chapterById = new Map(resetChapters.map(chapter => [chapter.id, chapter]));
    const quickOptions = {
      namesMainMap, phienAmMap, luatNhanMap, pronounsMap,
      ignoredPhrases: ignoredPhrasesList,
      translationAlgorithm: settings.quickTranslationAlgorithm,
      wrapType: settings.quickVietphraseWrapType,
      prioritizedName: settings.prioritizeNames,
      capitalizeLines: settings.capitalizeSentences,
    } as const;

    try {
      await new Promise<void>((resolve, reject) => {
        const worker = new Worker(new URL('../../utils/batchTranslation.worker.ts', import.meta.url), { type: 'module' });
        batchWorkerRef.current = worker;
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          control.signal.removeEventListener('abort', handleAbort);
          abortBatchRunRef.current = null;
          if (error) reject(error);
          else resolve();
        };
        const handleAbort = () => finish(new DOMException('Tác vụ dịch đã bị dừng vì không còn phản hồi.', 'AbortError'));
        control.signal.addEventListener('abort', handleAbort, { once: true });
        abortBatchRunRef.current = () => finish(new DOMException('Đã dừng tác vụ dịch nền.', 'AbortError'));
        let completedCount = 0;
        worker.onerror = event => finish(new Error(event.message || 'Không thể khởi động dịch nền.'));
        worker.onmessageerror = () => finish(new Error('Bộ dịch trả về dữ liệu không hợp lệ.'));
        worker.onmessage = ({ data }) => {
          if (data.runId !== runId) return;
          control.heartbeat();
          if (data.type === 'chunk') {
            const completed: BatchTranslationItem[] = data.rows.flatMap((row: { id: string; title: string; content: string }): BatchTranslationItem[] => {
              const chapter = chapterById.get(row.id);
              if (!chapter) return [];
              detector.addChapter(chapter.content, []);
              return [{ ...chapter, translatedTitle: row.title, translatedContent: row.content, status: 'done' as const }];
            });
            completedCount += completed.length;
            const results = new Map<string, BatchTranslationItem>(completed.map(chapter => [chapter.id, chapter]));
            setChapters(previous => previous.map(chapter => results.get(chapter.id) || chapter));
            setCurrentIndex(completedCount);
            void queueDraft(() => saveBatchDraftChapters(completed));
            background.progress({ detail: `Đã xử lý ${completedCount}/${resetChapters.length} chương`, percent: Math.round((completedCount / resetChapters.length) * 100) });
          } else if (data.type === 'complete') finish();
          else if (data.type === 'error') finish(new Error(data.message || 'Lỗi dịch nền.'));
        };
        worker.postMessage({ type: 'start', runId, chapters: resetChapters, names: namesList, vietphrase: vietphraseMap, options: quickOptions });
        control.heartbeat();
      });
      setNameSuggestions(detector.suggestions({ includeUncertain: true }));
      if (!cancelRequestedRef.current) {
        setReviewOpen(true);
        showToast('Đã dịch nháp. Hãy duyệt tên và xác nhận bản dịch.');
      }
    } catch (error) {
      if (!cancelRequestedRef.current) throw error;
    } finally {
      abortBatchRunRef.current = null;
      batchWorkerRef.current?.terminate();
      batchWorkerRef.current = null;
      setIsTranslating(false);
      setIsPaused(false);
    }
  };

  useEffect(() => {
    // React Fast Refresh keeps state but replaces the Worker. Clear any stale
    // "translating" state so development updates cannot leave the UI at 0%.
    setIsTranslating(false);
    setIsPaused(false);
    const stopDetachedWorker = () => {
      cancelRequestedRef.current = true;
      abortBatchRunRef.current?.();
      abortBatchRunRef.current = null;
      batchWorkerRef.current?.terminate();
      batchWorkerRef.current = null;
    };
    import.meta.hot?.dispose(stopDetachedWorker);
    return stopDetachedWorker;
  }, []);
  useEffect(() => {
    setReviewed(false);
    setNameSuggestions([]);
    setChapters(previous => {
      const reset = previous.map(chapter => ({ ...chapter, translatedContent: '', translatedTitle: '', status: 'pending' as const }));
      if (draftReady) {
        void queueDraft(() => replaceBatchDraft(reset, {
          version: BATCH_DRAFT_VERSION,
          chapterIds: reset.map(chapter => chapter.id),
          excludedChapterIds: [...excludedChapterIds],
          reviewed: false,
          selectedNovelId,
        }));
      }
      return reset;
    });
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
          void queueDraft(() => saveBatchDraftChapter(updated[i]));
          background.progress({ detail: `Đang áp dụng tên cho chương ${i + 1}/${updated.length}`, percent: Math.round(((i + 1) / updated.length) * 95) });
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
    setIsPaused(previous => {
      const next = !previous;
      batchWorkerRef.current?.postMessage({ type: 'pause', runId: batchRunIdRef.current, paused: next });
      return next;
    });
  };

  // Hủy tiến trình dịch
  const handleStopTranslation = () => {
    cancelRequestedRef.current = true;
    batchWorkerRef.current?.postMessage({ type: 'cancel', runId: batchRunIdRef.current });
    setIsPaused(false);
    background.reportResult('Đã dừng tiến trình dịch');
  };

  // Pick one folder once, then write every selected chapter into it.
  const handleDownloadSelectedFiles = async (format: ChapterExportFormat) => {
    if (!reviewed || reviewBusy || isTranslating) { showToast('Hãy duyệt tên và xác nhận bản dịch trước.', true); return; }
    const readyChapters = selectedChapters;
    if (readyChapters.length === 0) {
      showToast('Chưa có chương nào có nội dung để lưu!', true);
      return;
    }


    setIsExporting(true);
    const pickerStartedAt = performance.now();
    try {
      const res = await saveChaptersToUserFolder(
        readyChapters,
        format,
        undefined,
        undefined,
      );
      showToast(`Đã lưu ${res.count} file ${format.toUpperCase()} vào thư mục “${res.folderName}”.`);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        const blockedByEmbeddedBrowser = /\bCode\/\d/i.test(navigator.userAgent) && performance.now() - pickerStartedAt < 1500;
        if (blockedByEmbeddedBrowser) {
          try {
            await downloadChaptersAsZip(readyChapters, format, `Hermes_${format.toUpperCase()}_${readyChapters.length}_chuong`);
            showToast(`Trình duyệt tích hợp không cho chọn thư mục. Đã tải một gói ZIP chứa ${readyChapters.length} file ${format.toUpperCase()} hoàn chỉnh.`);
          } catch (fallbackError) {
            showToast(fallbackError instanceof Error ? fallbackError.message : 'Không tạo được gói file tải xuống.', true);
          }
          return;
        }
        showToast('Đã hủy chọn thư mục.'); return;
      }
      const message = err.message || 'Không tạo được file tải xuống'; showToast(message, true);
    } finally {
      setIsExporting(false);
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
      if (!newBook && !selectedNovelId) {
        showToast('Hãy chọn truyện trong Thư viện hoặc tạo truyện mới.', true);
        return;
      }
      const book = newBook ? { ...newBook, translationStyle } : selectedNovelId;
      const incoming = readyChapters.map(chap => {
        const prefix = `Chương ${chap.chapterNum}`;
        const part = chap.rawTitle.match(/[（(]\s*(\d+)\s*[/／]\s*(\d+)\s*[)）]/);
        const base = chap.translatedTitle || `${prefix}: Đang cập nhật`;
        const title = part && !/[（(]\s*\d+\s*[/／]\s*\d+\s*[)）]/.test(base) ? `${base} (${part[1]}/${part[2]})` : base;
        // Source chapter numbers are not reliably unique (some crawlers restart
        // numbering). Keep the queue item's stable ID as the import identity so
        // every translated item can be saved and later re-saved independently.
        return { title, chapterPrefix: prefix, chapterName: chap.translatedTitle.replace(/^(?:Chương|Hồi|Tiết)\s*\d+[\s:：\-–—\.]*/i, ''),
          originalText: chap.content, vietphraseText: chap.translatedContent, sourceUrl: `batch-draft:${chap.id}` };
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
  const selectedFilteredChapters = filteredChapters.filter(chapter => selectedRowIds.has(chapter.id));
  const allFilteredSelected = filteredChapters.length > 0 && selectedFilteredChapters.length === filteredChapters.length;
  const toggleAllFiltered = () => setSelectedRowIds(previous => {
    const next = new Set(previous);
    for (const chapter of filteredChapters) {
      if (allFilteredSelected) next.delete(chapter.id);
      else next.add(chapter.id);
    }
    return next;
  });

  const totalPages = Math.max(1, Math.ceil(filteredChapters.length / PAGE_SIZE));
  useEffect(() => { setCurrentPage(previous => Math.min(previous, totalPages)); }, [totalPages]);
  const displayedChapters = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredChapters.slice(start, start + PAGE_SIZE);
  }, [filteredChapters, currentPage]);

  return (
    <div className="@container flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden bg-canvas text-main">

      {reviewOpen && activeTab === 'batch' && <BatchNameReviewDialog suggestions={nameSuggestions} busy={reviewBusy} chapterCount={chapters.filter(chapter => chapter.status === 'done').length} onConfirm={(selected, remember) => background.run('Hoàn tất bản dịch', () => confirmNameReview(selected, remember))} onHide={() => setReviewOpen(false)} onCancel={() => { if (!reviewBusy) setReviewOpen(false); }} />}
      {pendingSave && <LibrarySaveConflictDialog count={pendingSave.matchIds.length} busy={saveBusy} onChoose={policy => void saveBatchLibrary(pendingSave, policy)} onCancel={() => setPendingSave(null)} />}
      {newBookOpen && !pendingSave && <NewLibraryBookDialog initialTitle="" chapterCount={selectedChapters.length} busy={saveBusy} onCancel={() => { if (!saveBusy) setNewBookOpen(false); }} onConfirm={book => void handleSaveAllToLibrary(book)} />}
      {pendingRemoval && <ConfirmDeleteDialog
        description={pendingRemoval === 'all'
          ? `Xóa toàn bộ ${chapters.length} chương khỏi danh sách dịch? Tệp gốc và truyện trong thư viện vẫn được giữ.`
          : 'ids' in pendingRemoval
            ? `Xóa ${pendingRemoval.ids.length} chương đã chọn khỏi danh sách dịch? Tệp gốc và truyện trong thư viện vẫn được giữ.`
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
                onClick={() => background.run('Dịch nhiều chương', handleStartBatchTranslation, { staleAfterMs: 120_000 })}
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
        {/* Cấu hình & Nạp đầu vào */}
        <div data-batch-toolbar="settings" className="shrink-0 min-w-0 px-3 @min-[640px]:px-6 py-3 border-b border-line/60 bg-surface/30 flex flex-wrap gap-x-4 gap-y-2 items-center text-xs">
          {/* Tên truyện & Thư viện */}
          <BatchSaveRange
            key={`${chapters.length}:${chapters[0]?.id || ''}:${reviewed}`}
            totalChapters={chapters.length}
            disabled={!completedChapters.length || isTranslating || reviewBusy || saveBusy || isExporting}
            onChange={(first, last) => setExcludedChapterIds(new Set(chapterIdsOutsidePositionRange(chapters, first, last)))}
          />
          <div className="batch-save-controls ml-auto flex shrink-0 items-center">
            <BatchSaveMenu disabled={!reviewed || isTranslating || reviewBusy || saveBusy || isExporting || !selectedChapters.length} libraryFields={<>
              <select aria-label="Chọn từ Thư Viện" value={selectedNovelId} onChange={event => setSelectedNovelId(event.target.value)} disabled={!novelsList.length} className="block h-9 w-full rounded-lg border border-line bg-canvas px-3 text-center text-xs font-medium text-main transition-colors hover:bg-hover focus:border-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60">
                <option value="">{novelsList.length ? 'Chọn từ Thư Viện' : 'Chưa có truyện trong Thư Viện'}</option>
                {novelsList.map(novel => <option key={novel.id} value={novel.id}>{novel.title}</option>)}
              </select>
              <button type="button" onClick={() => { setSelectedNovelId(''); setNewBookOpen(true); }} className="flex h-9 w-full items-center justify-center rounded-lg border border-line bg-canvas px-3 text-center text-xs font-medium text-main transition-colors hover:bg-hover focus:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent">
                Thêm Truyện mới
              </button>
            </>} onLibrary={() => void handleSaveAllToLibrary()} onComputer={format => { setExportFormat(format); void handleDownloadSelectedFiles(format); }} />
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
                className="bg-surface border border-line rounded-lg pl-8 pr-8 py-1 text-xs text-main focus:outline-none focus:border-accent w-44"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  aria-label="Xóa nội dung tìm chương"
                  title="Xóa tìm kiếm"
                  onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:bg-raised hover:text-main focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {chapters.length > 0 && (
              <button
                onClick={() => setPendingRemoval({ ids: selectedFilteredChapters.map(chapter => chapter.id) })}
                disabled={isTranslating || isImporting || !selectedFilteredChapters.length}
                className="p-1 rounded-md text-muted hover:text-rose-400 hover:bg-raised transition-colors"
                title={searchQuery.trim() ? `Xóa ${selectedFilteredChapters.length} kết quả đã chọn` : `Xóa ${selectedFilteredChapters.length} chương đã chọn`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Bảng danh sách chương (Phân trang 50 chương/trang) */}
        <div className="batch-chapter-list flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 @min-[640px]:px-6 py-2">
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
                    <th className="w-9 px-3 py-2.5"><input type="checkbox" aria-label="Chọn tất cả kết quả đang lọc" checked={allFilteredSelected} ref={element => { if (element) element.indeterminate = selectedFilteredChapters.length > 0 && !allFilteredSelected; }} disabled={!filteredChapters.length || isTranslating || reviewBusy || saveBusy || isExporting} onChange={toggleAllFiltered} /></th>
                    <th className="py-2.5 px-3 w-24">Tên file</th>
                    <th className="py-2.5 px-3">Tiêu đề gốc</th>
                    <th className="py-2.5 px-3">Tiêu đề dịch</th>
                    <th className="py-2.5 px-3 w-24 text-right">Số ký tự</th>
                    <th className="py-2.5 px-3 w-28 text-center">Trạng thái</th>
                    <th className="py-2.5 px-3 w-20 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-reading">
                  {displayedChapters.map((chap) => {
                    const fileName = exportNames.get(chap.id);
                    return (
                      <tr
                        key={chap.id}
                        className="hover:bg-raised/30 transition-colors group"
                      >
                        <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Chọn ${chap.rawTitle} để xóa`} checked={selectedRowIds.has(chap.id)} disabled={isTranslating || reviewBusy || saveBusy || isExporting} onChange={event => { const checked = event.target.checked; setSelectedRowIds(previous => { const next = new Set(previous); if (checked) next.add(chap.id); else next.delete(chap.id); return next; }); }} /></td>
                        {/* Tên file: CHỈ GỒM STT CHƯƠNG */}
                        <td className="py-2.5 px-3 font-mono font-bold text-accent">
                          {fileName}
                          <span className={`batch-mobile-status hidden ml-1 ${chap.status === 'done' ? 'text-emerald-500' : chap.status === 'error' ? 'text-rose-500' : 'text-muted'}`} aria-label={chap.status === 'done' ? 'Đã dịch' : chap.status === 'error' ? 'Lỗi dịch' : chap.status === 'processing' ? 'Đang dịch' : 'Chưa dịch'}>●</span>
                        </td>

                        {/* Tiêu đề gốc */}
                        <td className="py-2.5 px-3 text-main font-reading max-w-xs truncate" title={chap.rawTitle}>
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
