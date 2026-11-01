import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, BookOpen, Check, ChevronLeft, ChevronRight, Download, ExternalLink, Globe, Library, Loader2, RotateCcw, Search, Square, X } from 'lucide-react';
import { useApp, type SavedChapter } from '../../context/AppContext';
import { analyzeWebPage, analyzeSavedWebPage, mergeWebChapters, DEFAULT_EXTRACTION, extractWebChapter, loadWebPage, readHtmlFile, readWebDraft, saveWebDraft, WebImportError, type ExtractionOptions, type WebChapter } from '../../utils/webImport';
import { readSavedWebFile } from '../../utils/savedWebFile';
import { SavedWebFilePicker } from '../SavedWebFilePicker';
import { convertText } from '../../utils/translatorEngine';
import { resolveTranslationStyle, type TranslationStyleChoice } from '../../utils/translationStyle';
import { TranslationStyleSelect } from '../TranslationStyleSelect';
import { isServerApiAvailable, serverApiUrl } from '../../utils/serverApi';
import { hasSourceBrowser, readInSourceBrowser } from '../../utils/sourceBrowser';

type Draft = {
  url: string; title: string; author: string; titleVi: string; authorVi: string; description: string; language: string; filename: string; cover: string;
  chapters: WebChapter[]; extraction: ExtractionOptions; style: TranslationStyleChoice;
  output: 'original' | 'vietphrase' | 'hanviet'; font: 'serif' | 'sans-serif'; fontSize: number; lineHeight: number; delay: number;
};
const EMPTY: Draft = { url: '', title: '', author: '', titleVi: '', authorVi: '', description: '', language: 'zh', filename: '', cover: '', chapters: [], extraction: DEFAULT_EXTRACTION, style: 'neutral', output: 'original', font: 'serif', fontSize: 18, lineHeight: 1.7, delay: 1000 };
const field = 'w-full min-w-0 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-main';
const statusLabels = { pending: 'Chờ tải', loading: 'Đang tải', ready: 'Đã tải', error: 'Lỗi' };
const PAGE_SIZE = 50;

export function WebImportView() {
  const { saveLibraryChapters, setActiveTab, namesList, namesMainMap, phienAmMap, dictionaryStyleRevision, vietphraseMap, luatNhanMap, pronounsMap, ignoredPhrasesList, settings, novelsList, savedChapters } = useApp();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState('');
  const [browserMode, setBrowserMode] = useState(hasSourceBrowser);
  const readPage = (url: string, signal: AbortSignal) => browserMode ? readInSourceBrowser(url, signal) : loadWebPage(url, signal);
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState('');
  const [blockedUrl, setBlockedUrl] = useState('');
  const [htmlImportOpen, setHtmlImportOpen] = useState(false);
  useEffect(() => { if (blockedUrl) setHtmlImportOpen(true); }, [blockedUrl]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [range, setRange] = useState({ start: 1, end: 1 });
  const [manual, setManual] = useState('');
  const [append, setAppend] = useState(false);
  const [preview, setPreview] = useState<WebChapter | null>(null);
  const [editing, setEditing] = useState<WebChapter | null>(null);
  const [editingError, setEditingError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const abortRef = useRef<AbortController | null>(null);
  const chapterListRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const snapshot = useRef(draft);
  snapshot.current = draft;
  const update = (value: Partial<Draft>) => setDraft(previous => ({ ...previous, ...value }));
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    readWebDraft<Draft>().then(saved => {
      if (cancelled || !saved) return;
      setDraft({ ...EMPTY, ...saved, chapters: saved.chapters.map(chapter => ({ ...chapter, status: chapter.status === 'loading' ? 'pending' : chapter.status })) });
      setRange({ start: 1, end: saved.chapters.length || 1 });
    }).catch(() => { if (!cancelled) setStorageError('Không đọc được bản nháp trên máy.'); }).finally(() => { if (!cancelled) setHydrated(true); });
    return () => { cancelled = true; alive.current = false; abortRef.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      saveWebDraft(draft).catch(() => { if (alive.current) setStorageError('Không lưu được bản nháp. Có thể bộ nhớ trình duyệt đã đầy.'); });
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, hydrated]);
  // Persist the latest partial download when navigating to another app tab.
  useEffect(() => () => { if (snapshot.current.chapters.length) saveWebDraft(snapshot.current).catch(() => {}); }, []);

  const chosen = draft.chapters.filter(chapter => chapter.selected);
  const ready = chosen.filter(chapter => chapter.status === 'ready');
  const failed = chosen.filter(chapter => chapter.status === 'error');
  const canExport = chosen.length > 0 && ready.length === chosen.length && !busy;
  const filtered = draft.chapters.filter(chapter => (statusFilter === 'all' || chapter.status === statusFilter) && (!query || `${chapter.title} ${chapter.url}`.toLowerCase().includes(query.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { chapterListRef.current?.scrollTo({ top: 0 }); }, [safePage, query, statusFilter]);
  const patchChapter = (id: string, patch: Partial<WebChapter>) => setDraft(previous => ({ ...previous, chapters: previous.chapters.map(chapter => chapter.id === id ? { ...chapter, ...patch } : chapter) }));
  const start = (label: string) => { const controller = new AbortController(); abortRef.current = controller; setBusy(label); setMessage(''); setBlockedUrl(''); return controller; };
  const finish = () => { if (alive.current) setBusy(''); abortRef.current = null; };
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Thao tác không thành công.';

  const importHtml = async (file?: File) => {
    if (!file) return;
    setHtmlImportOpen(true);
    const controller = start(`Đang đọc ${file.name}`);
    try {
      const saved = await readSavedWebFile(file);
      controller.signal.throwIfAborted();
      const result = analyzeSavedWebPage(saved.html, snapshot.current.url, draft.extraction, saved.sourceUrl);
      const merged = mergeWebChapters(snapshot.current.chapters, result.chapters, append);
      setDraft(previous => ({ ...previous, url: result.url,
        title: append && previous.title ? previous.title : result.title || previous.title,
        author: append && previous.author ? previous.author : result.author,
        description: append && previous.description ? previous.description : result.description,
        cover: append && previous.cover ? previous.cover : result.cover,
        language: result.language, chapters: merged.chapters }));
      setRange({ start: 1, end: merged.chapters.length || 1 }); setPage(1); setQuery(''); setStatusFilter('all');
      setMessage(`Đã nhập ${file.name}: thêm ${merged.added} chương${merged.updated ? `, cập nhật ${merged.updated} chương` : ''}. Tổng ${merged.chapters.length} chương.${result.chapters.some(chapter => chapter.content) ? ' Nội dung từ tệp đã sẵn sàng.' : ' Chọn chương để tải nội dung; tệp mục lục chỉ chứa các liên kết.'}`);
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(`Không nhập được tệp: ${errorMessage(error)}`);
        if (error instanceof WebImportError && error.code === 'SOURCE_VERIFICATION_REQUIRED') setBlockedUrl(error.sourceUrl || draft.url);
      }
    } finally { finish(); }
  };

  const analyze = async () => {
    const controller = start('Đang phân tích mục lục');
    try {
      const page = await readPage(draft.url.trim(), controller.signal);
      const result = browserMode ? analyzeSavedWebPage(page.html, page.url, draft.extraction) : analyzeWebPage(page.html, page.url, draft.extraction);
      if (!result.chapters.length) {
        try { extractWebChapter(page.html, draft.extraction); result.chapters.push({ id: crypto.randomUUID(), url: page.url, title: result.title || 'Chương 1', selected: true, status: 'pending' }); }
        catch { /* Keep empty state with selector guidance. */ }
      }
      setDraft(previous => {
        const chapters = append ? [...previous.chapters] : [];
        const seen = new Set(chapters.map(chapter => chapter.url));
        for (const chapter of result.chapters) if (!seen.has(chapter.url)) { if (chapters.length >= 5000) break; chapters.push(chapter); seen.add(chapter.url); }
        return { ...previous, url: page.url, title: append && previous.title ? previous.title : result.title, author: previous.author || result.author, description: previous.description || result.description, cover: previous.cover || result.cover, language: result.language, chapters };
      });
      setRange({ start: 1, end: (append ? draft.chapters.length : 0) + result.chapters.length || 1 });
      setPage(1);
      setMessage(result.chapters.length ? `Tìm thấy ${result.chapters.length} chương. Kiểm tra danh sách trước khi tải.` : 'Chưa tìm thấy chương. Bạn có thể dán danh sách URL hoặc tùy chỉnh selector mục lục bên dưới.');
    } catch (error) { if (!controller.signal.aborted) { setMessage(errorMessage(error)); if (error instanceof WebImportError && error.code === 'SOURCE_VERIFICATION_REQUIRED') setBlockedUrl(error.sourceUrl || draft.url); } }
    finally { finish(); }
  };

  const download = async (onlyErrors = false, single?: string) => {
    const targets = draft.chapters.filter(chapter => single ? chapter.id === single : chapter.selected && (onlyErrors ? chapter.status === 'error' : chapter.status !== 'ready'));
    if (!targets.length) return;
    const controller = start('Đang tải nội dung');
    let successes = 0;
    try {
      for (const chapter of targets) {
        if (controller.signal.aborted) break;
        patchChapter(chapter.id, { status: 'loading', error: undefined });
        try {
          const page = await readPage(chapter.url, controller.signal);
          if (browserMode) {
            if (new URL(page.url).origin !== new URL(chapter.url).origin) throw new Error('Trang đã chuyển sang website khác. Chưa lưu nội dung vào chương.');
            analyzeSavedWebPage(page.html, page.url, draft.extraction);
          }
          const content = extractWebChapter(page.html, draft.extraction);
          if (controller.signal.aborted) throw new Error('Đã hủy');
          patchChapter(chapter.id, { status: 'ready', content, error: undefined });
          successes++;
        } catch (error) {
          patchChapter(chapter.id, { status: controller.signal.aborted ? 'pending' : 'error', error: controller.signal.aborted ? undefined : errorMessage(error) });
          // Closing the reader or a verification failure must not open every remaining chapter.
          if (browserMode) break;
        }
        if (controller.signal.aborted) break;
        // One request at a time with a cancellable pause to avoid hammering the source.
        await new Promise<void>(resolve => {
          const done = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', done); resolve(); };
          const timer = setTimeout(done, Math.max(500, draft.delay));
          controller.signal.addEventListener('abort', done, { once: true });
        });
      }
      if (alive.current) setMessage(controller.signal.aborted ? 'Đã dừng. Những chương đã tải được giữ lại, bấm Tải tiếp để tiếp tục.' : `Đã tải thêm ${successes}/${targets.length} chương. Bạn có thể xem trước hoặc thử lại chương lỗi.`);
    } finally { finish(); }
  };

  const addManual = () => {
    try {
      const chapters = [...draft.chapters];
      const seen = new Set(chapters.map(chapter => chapter.url));
      for (const [index, line] of manual.split(/\r?\n/).filter(line => line.trim()).entries()) {
        const [raw, ...label] = line.split('|');
        const url = new URL(raw.trim());
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`URL dòng ${index + 1} không hợp lệ.`);
        url.hash = '';
        if (seen.has(url.href)) continue;
        chapters.push({ id: crypto.randomUUID(), url: url.href, title: label.join('|').trim() || `Chương ${chapters.length + 1}`, selected: true, status: 'pending' });
        seen.add(url.href);
        if (chapters.length > 5000) throw new Error('Mỗi bản nháp hỗ trợ tối đa 5.000 chương.');
      }
      update({ chapters }); setRange({ start: 1, end: chapters.length }); setManual(''); setMessage('Đã thêm các URL mới và loại URL trùng.');
    } catch (error) { setMessage(errorMessage(error)); }
  };

  const prepareChapter = (chapter: WebChapter, index: number): SavedChapter => {
    const originalText = chapter.content || '';
    const translated = draft.output === 'original' ? null : convertText(originalText, namesList, vietphraseMap, { style: resolveTranslationStyle([], draft.style), namesMainMap, customPhienAm: phienAmMap, customLuatNhan: luatNhanMap, customPronouns: pronounsMap, customIgnored: ignoredPhrasesList, prioritizeNames: settings.prioritizeNames, capitalizeSentences: settings.capitalizeSentences });
    const translatedTitle = draft.output === 'original' ? null : convertText(chapter.title, namesList, vietphraseMap, { style: resolveTranslationStyle([], draft.style), namesMainMap, customPhienAm: phienAmMap, customLuatNhan: luatNhanMap, customPronouns: pronounsMap, customIgnored: ignoredPhrasesList });
    return { id: chapter.id, title: translatedTitle ? draft.output === 'hanviet' ? translatedTitle.hanvietText : translatedTitle.fullText : chapter.title, originalText, vietphraseText: translated ? draft.output === 'hanviet' ? translated.hanvietText : translated.fullText : '', hanvietText: translated?.hanvietText, sourceUrl: chapter.url, savedAt: index, novelTitle: draft.title };
  };

  const exportBook = async (library: boolean) => {
    if (!canExport) return;
    const controller = start(library ? 'Đang lưu thư viện' : 'Đang đóng gói EPUB');
    try {
      let cover = draft.cover;
      if (cover && !cover.startsWith('data:')) {
        const response = await fetch(serverApiUrl('/api/web-import/resource'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: cover, image: true }), signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(`Không tải được ảnh bìa: ${result.error}. Xóa hoặc tải ảnh bìa khác để tiếp tục.`);
        cover = result.image;
      }
      const chapters: SavedChapter[] = [];
      for (const [index, chapter] of chosen.entries()) {
        controller.signal.throwIfAborted();
        chapters.push(prepareChapter(chapter, index));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      const useVietnamese = library || draft.output !== 'original';
      const book = { title: (useVietnamese ? draft.titleVi.trim() || draft.title.trim() : draft.title.trim() || draft.titleVi.trim()) || 'Truyện từ web', author: useVietnamese ? draft.authorVi.trim() || draft.author.trim() : draft.author.trim() || draft.authorVi.trim(), originalTitle: draft.title.trim(), originalAuthor: draft.author.trim(), vietnameseTitle: draft.titleVi.trim(), vietnameseAuthor: draft.authorVi.trim(), description: draft.description, coverUrl: cover, translationStyle: draft.style };
      if (library) {
        const result = await saveLibraryChapters(book, chapters);
        setMessage(`Đã thêm ${result.count} chương vào Thư viện. Mở Thư viện để đọc hoặc convert.`);
      } else {
        const { createNovelEpub } = await import('../../utils/epubExport');
        const blob = await createNovelEpub(book, chapters, { preserveOrder: true, language: draft.output === 'original' ? draft.language : 'vi', font: draft.font, fontSize: draft.fontSize, lineHeight: draft.lineHeight, cover });
        controller.signal.throwIfAborted();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${(draft.filename || book.title || 'truyen').replace(/\.epub$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')}.epub`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        setMessage(`Đã xuất EPUB gồm ${chapters.length} chương theo đúng thứ tự đã chọn.`);
      }
    } catch (error) { if (!controller.signal.aborted) { setMessage(errorMessage(error)); if (error instanceof WebImportError && error.code === 'SOURCE_VERIFICATION_REQUIRED') setBlockedUrl(error.sourceUrl || draft.url); } }
    finally { finish(); }
  };

  if (!hydrated) return <div className="p-6 text-sm text-muted">Đang mở bản nháp…</div>;
  return <div className="flex-1 min-h-0 overflow-y-auto bg-canvas">
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold"><Globe size={20} />Truyện từ web</h1><p className="mt-1 text-sm text-muted">Lấy chương, kiểm tra nội dung và tạo sách EPUB của bạn.</p></div>
        <span className="text-xs text-muted">{storageError || 'Bản nháp tự lưu trên máy'}</span>
      </div>
      {!isServerApiAvailable() && <p role="note" className="rounded-lg border border-line bg-raised/40 p-3 text-xs leading-relaxed text-muted">Dùng trình duyệt trong app để lấy trang. Ảnh bìa từ URL vẫn cần máy chủ API; bạn có thể chọn ảnh từ máy.</p>}
      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <label htmlFor="web-start" className="block text-sm font-medium">1. Trang truyện hoặc mục lục</label>
        {hasSourceBrowser() ? <label className="flex items-center gap-2 text-xs text-muted">Cách lấy trang<select aria-label="Cách lấy trang" disabled={!!busy} value={browserMode ? 'browser' : 'direct'} onChange={event => setBrowserMode(event.target.value === 'browser')} className="min-w-0 rounded-lg border border-line bg-canvas p-2 text-main"><option value="browser">Trình duyệt trong app</option>{isServerApiAvailable() && <option value="direct">Tải trực tiếp</option>}</select></label> : <p className="text-xs text-muted">Trình duyệt xác minh có trong bản Hermes PC và Android. Bản web hỗ trợ tải trực tiếp hoặc nhập HTML/MHTML.</p>}
        {browserMode && <p className="text-xs text-muted">Mở trang, xác minh nếu được yêu cầu rồi bấm Lấy nội dung. Khi tải chương, mỗi chương sẽ mở trong cùng phiên trình duyệt để bạn xác nhận.</p>}
        <form onSubmit={event => { event.preventDefault(); if (!busy && draft.url.trim()) void analyze(); }} className="flex min-w-0 items-stretch gap-2">
          <input id="web-start" type="url" required value={draft.url} disabled={!!busy} onChange={event => update({ url: event.target.value })} placeholder="https://…/muc-luc" className={`${field} flex-1 basis-0`} />
          <button disabled={!!busy || !draft.url.trim()} className="studio-action studio-action-primary shrink-0 whitespace-nowrap"><Search size={15} />Phân tích</button>
        </form>
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={append} disabled={!!busy} onChange={event => setAppend(event.target.checked)} />Thêm chương vào danh sách hiện có (mục lục nhiều trang)</label>
        <details><summary className="cursor-pointer text-xs text-muted">Tùy chỉnh lấy nội dung</summary><div className="mt-3 space-y-3">
          <p className="text-xs text-muted">Để trống để tự nhận diện. Selector CSS chỉ áp dụng cho lần phân tích hoặc tải tiếp theo. Có thể dùng “Tải lại” từng chương để kiểm tra.</p>
          {([['links', 'Liên kết chương', 'Ví dụ: .chapter-list a'], ['content', 'Vùng nội dung truyện', 'Ví dụ: #chaptercontent'], ['remove', 'Vùng bỏ qua', 'Ví dụ: nav, .ads, .chapter-nav']] as const).map(([key, label, placeholder]) => <label key={key} className="block space-y-1 text-xs text-muted">{label}<input disabled={!!busy} className={field} value={draft.extraction[key]} placeholder={placeholder} onChange={event => update({ extraction: { ...draft.extraction, [key]: event.target.value } })} /></label>)}
          <label className="flex items-center gap-2 text-xs text-muted">Khoảng nghỉ giữa hai chương <select disabled={!!busy} className="rounded border border-line bg-canvas p-1.5 text-main" value={draft.delay} onChange={event => update({ delay: Number(event.target.value) })}><option value={500}>0,5 giây</option><option value={1000}>1 giây</option><option value={2000}>2 giây</option><option value={5000}>5 giây</option></select></label>
        </div></details>
        <details><summary className="cursor-pointer text-xs text-muted">Dán danh sách URL thủ công</summary><div className="mt-3 space-y-2"><textarea aria-label="Danh sách URL chương" disabled={!!busy} value={manual} onChange={event => setManual(event.target.value)} placeholder={'Mỗi dòng một URL. Có thể ghi: URL | Tên chương'} rows={4} className={field} /><button className="studio-action" disabled={!!busy || !manual.trim()} onClick={addManual}>Thêm vào danh sách</button></div></details>
        <details open={htmlImportOpen} onToggle={event => setHtmlImportOpen(event.currentTarget.open)}><summary className="cursor-pointer text-xs text-muted">Trang chặn tải? Nhập HTML từ máy</summary><div className="mt-3 space-y-2 text-xs text-muted"><p>Lưu trang đã mở được dưới dạng HTML hoặc MHTML, rồi chọn tệp ở đây (tối đa 16 MB). App tự nhận URL gốc nếu có trong tệp; nếu thiếu, điền URL ở trên. Nội dung từng chương có thể nhập bằng nút “Nhập nội dung”.</p><SavedWebFilePicker label="HTML mục lục đã lưu" disabled={!!busy} onSelect={importHtml} /></div></details>
      </section>

      {(message || busy) && <div role="status" aria-live="polite" className="sticky top-0 z-10 rounded-lg border border-line bg-surface p-3 text-sm"><span className="flex items-center gap-2">{busy && <Loader2 size={15} className="animate-spin" />}{busy || message}</span>{busy && <button className="studio-action mt-2" onClick={() => abortRef.current?.abort()}><Square size={13} />Dừng</button>}</div>}

      {blockedUrl && <div className="space-y-2 rounded-lg border border-line bg-surface p-3 text-sm"><a className="studio-action" href={blockedUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Mở trang gốc để xác minh</a><p className="text-xs leading-relaxed text-muted">Nếu trình duyệt mở được truyện, lưu trang mục lục dạng HTML rồi nhập ở bước 1. Phiên xác minh trong trình duyệt không tự chuyển sang máy chủ app; bấm Phân tích lại có thể vẫn bị chặn.</p></div>}
      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">2. Chọn chương <span className="ml-1 text-muted font-normal">{chosen.length}/{draft.chapters.length}</span></h2><span className="text-xs text-muted">{ready.length} đã tải · {failed.length} lỗi</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button className="studio-action" disabled={!!busy || !draft.chapters.length} onClick={() => update({ chapters: draft.chapters.map(chapter => ({ ...chapter, selected: true })) })}>Chọn hết</button>
          <button className="studio-action" disabled={!!busy || !chosen.length} onClick={() => update({ chapters: draft.chapters.map(chapter => ({ ...chapter, selected: false })) })}>Bỏ chọn</button>
          <button className="studio-action" disabled={!!busy || !draft.chapters.length} onClick={() => update({ chapters: [...draft.chapters].reverse() })}>Đảo thứ tự</button>
          <button className="studio-action" disabled={!!busy || !draft.chapters.length} onClick={() => update({ chapters: [...draft.chapters].sort((a, b) => a.title.localeCompare(b.title, 'vi', { numeric: true })) })}>Xếp theo tên</button>
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center"><span>Chọn khoảng</span><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2"><input aria-label="Từ chương" type="number" min={1} max={draft.chapters.length || 1} className="h-9 w-full min-w-0 rounded-lg border border-line bg-canvas px-2 text-main" value={range.start} onChange={event => setRange({ ...range, start: Number(event.target.value) })} /><span>đến</span><input aria-label="Đến chương" type="number" min={range.start} max={draft.chapters.length || 1} className="h-9 w-full min-w-0 rounded-lg border border-line bg-canvas px-2 text-main" value={range.end} onChange={event => setRange({ ...range, end: Number(event.target.value) })} /><button className="studio-action" disabled={!!busy || !draft.chapters.length || range.start < 1 || range.end < range.start || range.end > draft.chapters.length} onClick={() => update({ chapters: draft.chapters.map((chapter, index) => ({ ...chapter, selected: index + 1 >= range.start && index + 1 <= range.end })) })}>Áp dụng</button></div></div>
        <input aria-label="Tìm chương hoặc URL" className={field} placeholder="Tìm chương hoặc URL…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
        <label className="flex items-center gap-2 text-xs text-muted">Trạng thái<select aria-label="Lọc trạng thái chương" className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-main" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">Tất cả</option><option value="pending">Chờ tải</option><option value="ready">Đã tải</option><option value="error">Lỗi</option></select></label>
        {!draft.chapters.length ? <div className="py-8 text-center text-sm text-muted"><BookOpen className="mx-auto mb-2" size={26} />Danh sách chương sẽ hiện ở đây.</div> : <div ref={chapterListRef} role="region" aria-label="Danh sách chương" tabIndex={0} className="max-h-[min(26rem,50dvh)] overflow-y-auto overscroll-contain divide-y divide-line pr-2 [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent">
          {rows.map(chapter => <div key={chapter.id} className="flex items-start gap-3 py-3">
            <input aria-label={`Chọn ${chapter.title}`} type="checkbox" className="mt-3 accent-accent" disabled={!!busy} checked={chapter.selected} onChange={event => patchChapter(chapter.id, { selected: event.target.checked })} />
            <div className="min-w-0 flex-1"><input aria-label="Tên chương" className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm text-main hover:border-line focus:border-line" disabled={!!busy} value={chapter.title} onChange={event => patchChapter(chapter.id, { title: event.target.value })} /><a href={chapter.url} target="_blank" rel="noreferrer" className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted"><span className="truncate">{chapter.url}</span><ExternalLink size={11} /></a>{chapter.error && <p className="mt-1 text-xs text-red-500">{chapter.error}</p>}<button className="mt-1 text-xs text-muted hover:text-main" disabled={!!busy} onClick={() => { setEditingError(''); setEditing({ ...chapter }); }}>Nhập nội dung / sửa URL</button></div>
            <div className="flex shrink-0 flex-col items-end gap-1"><span className={`flex items-center gap-1 text-xs ${chapter.status === 'ready' ? 'text-accent' : 'text-muted'}`}>{chapter.status === 'loading' ? <Loader2 size={12} className="animate-spin" /> : chapter.status === 'ready' ? <Check size={12} /> : null}{statusLabels[chapter.status]}</span><button className="text-xs text-accent hover:underline disabled:opacity-40" disabled={!!busy} onClick={() => chapter.content ? setPreview(chapter) : void download(false, chapter.id)}>{chapter.content ? 'Xem trước' : 'Tải thử'}</button>{chapter.content && <button className="text-xs text-muted hover:underline" disabled={!!busy} onClick={() => void download(false, chapter.id)}>Tải lại</button>}</div>
          </div>)}
        </div>}
        {pages > 1 && <div className="flex items-center justify-center gap-3 text-xs"><button aria-label="Trang trước" className="studio-action" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={15} /></button>{safePage}/{pages}<button aria-label="Trang tiếp" className="studio-action" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}><ChevronRight size={15} /></button></div>}
        <div className="space-y-2 border-t border-line pt-3"><progress aria-label="Tiến độ tải chương" value={ready.length + failed.length} max={chosen.length || 1} className="h-1.5 w-full accent-accent" /><div className="web-import-actions grid grid-cols-2 gap-2"><button className="studio-action studio-action-primary" aria-label={ready.length ? 'Tải tiếp chương đã chọn' : 'Tải chương đã chọn'} disabled={!!busy || !chosen.some(chapter => chapter.status !== 'ready')} onClick={() => void download()}><ArrowDownToLine size={15} />{ready.length ? 'Tải tiếp đã chọn' : 'Tải đã chọn'}</button><button className="studio-action" disabled={!!busy || !failed.length} onClick={() => void download(true)}><RotateCcw size={15} />Thử lại lỗi{failed.length ? ` (${failed.length})` : ''}</button></div></div>
      </section>

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">3. Thông tin sách & xuất EPUB</h2>
        <div className="grid gap-3 sm:grid-cols-2">{([['title', 'Tên truyện (tiếng Trung)'], ['titleVi', 'Tên truyện (tiếng Việt)'], ['author', 'Tác giả (tiếng Trung)'], ['authorVi', 'Tác giả (tiếng Việt)'], ['filename', 'Tên tệp EPUB'], ['language', 'Ngôn ngữ bản gốc (zh, vi, en…)']] as const).map(([key, label]) => <label key={key} className="space-y-1 text-xs text-muted">{label}<input className={field} disabled={!!busy} value={draft[key]} onChange={event => update({ [key]: event.target.value })} /></label>)}</div>
        <label className="block space-y-1 text-xs text-muted">Giới thiệu<textarea className={field} rows={2} disabled={!!busy} value={draft.description} onChange={event => update({ description: event.target.value })} /></label>
        <div className="space-y-2"><label className="block space-y-1 text-xs text-muted">Ảnh bìa (URL hoặc tải ảnh từ máy)<span className="relative block"><input className={`${field} pr-9`} disabled={!!busy} placeholder="https://…/cover.jpg" value={draft.cover.startsWith('data:') ? '' : draft.cover} onChange={event => update({ cover: event.target.value })} />{draft.cover && <button type="button" aria-label="Bỏ bìa" title="Bỏ bìa" disabled={!!busy} onClick={() => update({ cover: '' })} className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"><X size={14} /></button>}</span></label><div className="flex flex-wrap items-center gap-2"><label className="studio-action cursor-pointer">Chọn ảnh<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={!!busy} onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setMessage('Chọn ảnh JPEG/PNG/WebP dưới 5 MB.'); return; } const reader = new FileReader(); reader.onload = () => update({ cover: String(reader.result) }); reader.readAsDataURL(file); }} /></label>{draft.cover.startsWith('data:') && <img src={draft.cover} alt="Bìa đã chọn" className="h-20 w-14 rounded object-cover" />}</div></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs text-muted">Nội dung xuất<select className={field} disabled={!!busy} value={draft.output} onChange={event => update({ output: event.target.value as Draft['output'] })}><option value="original">Giữ nguyên bản gốc</option><option value="vietphrase">Hermes Vietphrase</option><option value="hanviet">Phiên âm Hán Việt</option></select></label><div className="self-end pb-1"><TranslationStyleSelect value={draft.style} tags={[]} onChange={style => update({ style })} disabled={!!busy || draft.output === 'original'} /></div></div>
        <details><summary className="cursor-pointer text-xs text-muted">Kiểu chữ trong sách</summary><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-xs text-muted">Phông chữ<select className={field} value={draft.font} onChange={event => update({ font: event.target.value as Draft['font'] })}><option value="serif">Có chân — đọc truyện</option><option value="sans-serif">Không chân — hiện đại</option></select></label><label className="space-y-1 text-xs text-muted">Cỡ chữ: {draft.fontSize}px<input type="range" className="block w-full accent-accent" min={12} max={28} value={draft.fontSize} onChange={event => update({ fontSize: Number(event.target.value) })} /></label><label className="space-y-1 text-xs text-muted">Giãn dòng: {draft.lineHeight}<input type="range" className="block w-full accent-accent" min={1.2} max={2.4} step={0.1} value={draft.lineHeight} onChange={event => update({ lineHeight: Number(event.target.value) })} /></label></div></details>
        <div className="web-import-actions grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-3"><button className="studio-action studio-action-primary col-span-2 sm:col-span-1" disabled={!canExport} onClick={() => void exportBook(false)}><Download size={15} />Xuất EPUB</button><button className="studio-action" disabled={!canExport} onClick={() => void exportBook(true)}><BookOpen size={15} />Lưu vào thư viện</button><button className="studio-action" disabled={!!busy} onClick={() => setActiveTab('library')}><Library size={15} />Mở thư viện</button></div>
        {!canExport && chosen.length > 0 && <p className="text-xs text-muted">Tải đủ các chương đã chọn hoặc bỏ chọn chương lỗi trước khi xuất.</p>}
      </section>
    </div>
    {preview && <div role="dialog" aria-modal="true" aria-label="Xem trước nội dung chương" onKeyDown={event => { if (event.key === 'Escape') setPreview(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-xl border border-line bg-surface text-main"><div className="flex items-center justify-between gap-3 border-b border-line p-4"><h2 className="truncate text-sm font-semibold">{preview.title}</h2><button autoFocus aria-label="Đóng xem trước" className="studio-action" onClick={() => setPreview(null)}><X size={16} /></button></div><div className="overflow-y-auto whitespace-pre-wrap p-5" style={{ fontFamily: draft.font, fontSize: draft.fontSize, lineHeight: draft.lineHeight }}>{prepareChapter(preview, 0).vietphraseText || preview.content}</div></div></div>}
    {editing && <div role="dialog" aria-modal="true" aria-label="Nhập nội dung chương" onKeyDown={event => { if (event.key === 'Escape') setEditing(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90dvh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-xl border border-line bg-surface p-4 text-main"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">Nhập nội dung chương</h2><button aria-label="Đóng nhập nội dung" className="studio-action" onClick={() => setEditing(null)}><X size={16} /></button></div><label className="block space-y-1 text-xs text-muted">URL chương<input type="url" className={field} value={editing.url} onChange={event => setEditing({ ...editing, url: event.target.value })} /></label><label className="block space-y-1 text-xs text-muted">Nội dung văn bản<textarea autoFocus rows={12} className={field} value={editing.content || ''} onChange={event => setEditing({ ...editing, content: event.target.value })} /></label><div className="block space-y-1 text-xs text-muted"><p>Hoặc chọn HTML của chương</p><SavedWebFilePicker label="HTML nội dung chương đã lưu" onSelect={async file => { setEditingError(''); try { const content = extractWebChapter(await readHtmlFile(file), draft.extraction); setEditing(previous => previous ? { ...previous, content } : null); } catch (error) { setEditingError(errorMessage(error)); } }} /></div><p role="alert" className="text-xs text-red-500">{editingError}</p><button className="studio-action studio-action-primary" onClick={() => { try { const url = new URL(editing.url); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL chương không hợp lệ.'); url.hash = ''; if (draft.chapters.some(chapter => chapter.id !== editing.id && chapter.url === url.href)) throw new Error('URL đã có trong danh sách chương.'); const content = editing.content?.trim(); patchChapter(editing.id, { url: url.href, content, status: content ? 'ready' : 'pending', error: undefined }); setEditing(null); } catch (error) { setEditingError(errorMessage(error)); } }}>Lưu nội dung</button></div></div>}
  </div>;
}
