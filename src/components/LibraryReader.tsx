import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, List, Settings2, X, Trash2, Maximize, Minimize, Square } from 'lucide-react';
import { useApp, type NovelBook, type SavedChapter } from '../context/AppContext';
import { convertText } from '../utils/translatorEngine';
import { resolveTranslationStyle } from '../utils/translationStyle';
import { speechService } from '../utils/speechEngine';
import { filterWebsiteNotices } from '../utils/paragraphFilters';
import { SpeechTransport } from './SpeechTransport';
import { VoiceSetupDialog } from './VoiceSetupDialog';
import { ReaderEndGate } from '../utils/readerState';
import { DEFAULT_READER_PREFERENCES, orderReaderChapters, readerChapterBlocks, readReaderState, saveReadingPosition,
  stageReadingPosition, updateReaderState, shouldAdvanceReader, type ReaderPreferences, type ReaderState, type ReadingPosition } from '../utils/readerState';

export function LibraryReader({ book, chapters: unsorted, initialChapterId, onClose, onEdit }: {
  book: NovelBook; chapters: SavedChapter[]; initialChapterId?: string; onClose: () => void; onEdit: (chapter: SavedChapter) => void;
}) {
  const { namesList, vietphraseMap, luatNhanMap, pronounsMap, ignoredPhrasesList, settings } = useApp();
  const chapters = useMemo(() => orderReaderChapters(unsorted), [unsorted]);
  const [chapterId, setChapterId] = useState('');
  const [state, setState] = useState<ReaderState>({ progress: {}, bookmarks: [], preferences: { ...DEFAULT_READER_PREFERENCES } });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<'chapters' | 'bookmarks' | 'settings' | null>(null);
  const [search, setSearch] = useState('');
  const [block, setBlock] = useState(0);
  const [percent, setPercent] = useState(0);
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const [autoPending, setAutoPending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speechParagraph, setSpeechParagraph] = useState<number | null>(null);
  const [showVoiceSetup, setShowVoiceSetup] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(() => !!speechService.getVietnameseVoice());
  const endGate = useRef(new ReaderEndGate());
  const touchAtEnd = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const root = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null);
  const position = useRef<ReadingPosition | null>(null), target = useRef<ReadingPosition | null>(null);
  const restoring = useRef(true), intent = useRef(false), touchY = useRef(0), shortPull = useRef(0);
  const entered = useRef(0), autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null), saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null), frame = useRef(0);
  const index = chapters.findIndex(chapter => chapter.id === chapterId), chapter = chapters[index];
  const prefs = state.preferences;
  const report = (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason));
  const flush = () => position.current ? saveReadingPosition(book.id, position.current).catch(report) : Promise.resolve();
  const cancelAuto = () => { if (autoTimer.current) clearTimeout(autoTimer.current); autoTimer.current = null; setAutoPending(false); };
  const capture = () => {
    const element = viewport.current;
    if (!element || !chapter || restoring.current) return;
    const bounds = element.getBoundingClientRect();
    const nodes = element.querySelectorAll<HTMLElement>('[data-reader-paragraph]');
    let paragraphIndex = Math.max(0, nodes.length - 1), paragraphOffset = nodes.length ? 1 : 0;
    for (let i = 0; i < nodes.length; i++) { const rect = nodes[i].getBoundingClientRect(); if (rect.bottom > bounds.top + 16) { paragraphIndex = i; paragraphOffset = Math.min(1, Math.max(0, (bounds.top + 16 - rect.top) / Math.max(1, rect.height))); break; } }
    const scrollRatio = Math.min(1, Math.max(0, element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight)));
    position.current = { chapterId: chapter.id, paragraphIndex, paragraphOffset, scrollRatio, updatedAt: Date.now() };
    stageReadingPosition(book.id, position.current); setPercent(Math.round(scrollRatio * 100)); setCurrentParagraph(paragraphIndex);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 500);
  };
  const go = (next: number, anchor?: ReadingPosition) => {
    if (next < 0 || next >= chapters.length) return;
    capture(); void flush(); cancelAuto(); speechService.stop(); setSpeaking(false);
    restoring.current = true; intent.current = false; shortPull.current = 0; endGate.current.reset(); setPaused(false); setSpeechParagraph(null);
    target.current = anchor || { chapterId: chapters[next].id, paragraphIndex: 0, paragraphOffset: 0, scrollRatio: 0, updatedAt: Date.now() };
    position.current = null; setChapterId(chapters[next].id); setBlock(Math.floor(next / 100)); setDrawer(null);
    // A bookmark in the current chapter still needs an explicit position restore.
    if (next === index) requestAnimationFrame(restorePosition);
  };
  const text = useMemo(() => {
    if (!chapter) return '';
    if (prefs.mode === 'original') return chapter.originalText;
    if (chapter.vietphraseText.trim()) return filterWebsiteNotices(chapter.vietphraseText);
    return convertText(chapter.originalText, namesList, vietphraseMap, { prioritizeNames: settings.prioritizeNames,
      capitalizeSentences: settings.capitalizeSentences, customLuatNhan: luatNhanMap, customPronouns: pronounsMap,
      customIgnored: ignoredPhrasesList, style: resolveTranslationStyle(book.genres?.length ? book.genres : [book.genre || ''], book.translationStyle || 'auto') }).fullText;
  }, [chapter, prefs.mode, namesList, vietphraseMap, settings.prioritizeNames, settings.capitalizeSentences, luatNhanMap, pronounsMap, ignoredPhrasesList, book]);
  const paragraphs = useMemo(() => text.split(/\n+/).map(line => line.trim()).filter(Boolean), [text]);
  const restorePosition = () => {
    const element = viewport.current;
    if (!element) return;
    const anchor = target.current;
    if (anchor && anchor.scrollRatio > 0) {
      const nodes = element.querySelectorAll<HTMLElement>('[data-reader-paragraph]');
      const node = nodes[Math.min(anchor.paragraphIndex, nodes.length - 1)];
      if (node) { const rect = node.getBoundingClientRect(); element.scrollTop += rect.top - element.getBoundingClientRect().top - 16 + rect.height * anchor.paragraphOffset; }
      else element.scrollTop = anchor.scrollRatio * Math.max(0, element.scrollHeight - element.clientHeight);
    } else element.scrollTop = 0;
    entered.current = Date.now();
    requestAnimationFrame(() => { restoring.current = false; capture(); });
  };
  useEffect(() => {
    let active = true;
    readReaderState().then(saved => {
      if (!active) return;
      setState(saved);
      const progress = saved.progress[book.id];
      const id = initialChapterId || progress?.chapterId;
      const found = chapters.findIndex(row => row.id === id), next = found >= 0 ? found : 0;
      target.current = progress && progress.chapterId === chapters[next]?.id ? progress : null;
      setChapterId(chapters[next]?.id || ''); setBlock(Math.floor(next / 100)); setReady(true);
    }).catch(report);
    return () => { active = false; };
  }, [book.id]);
  useLayoutEffect(() => { if (ready && chapter) { restoring.current = true; requestAnimationFrame(restorePosition); } }, [chapterId, ready]);
  useEffect(() => {
    const save = () => { capture(); void flush(); };
    const hide = () => { if (document.visibilityState === 'hidden') save(); };
    window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', hide);
    return () => { save(); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', hide); if (saveTimer.current) clearTimeout(saveTimer.current); if (autoTimer.current) clearTimeout(autoTimer.current); cancelAnimationFrame(frame.current); speechService.stop(); };
  }, [chapterId, ready]);
  useEffect(() => { if (!prefs.autoNext || drawer) cancelAuto(); }, [prefs.autoNext, drawer]);
  useEffect(() => { endGate.current.reset(); }, [prefs.autoNext, drawer, chapterId]);
  useEffect(() => {
    const update = () => setVoiceAvailable(!!speechService.getVietnameseVoice());
    window.speechSynthesis?.addEventListener('voiceschanged', update); update();
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', update);
  }, []);
  useEffect(() => { const listener = () => setFullscreen(document.fullscreenElement === root.current); document.addEventListener('fullscreenchange', listener); return () => document.removeEventListener('fullscreenchange', listener); }, []);
  const maybeAuto = (allowShort = false, gesture = false) => {
    const element = viewport.current;
    if (!element) return;
    if (element.scrollHeight - element.scrollTop - element.clientHeight > 8) endGate.current.reset();
    if (!shouldAdvanceReader({ enabled: prefs.autoNext, interacting: intent.current, restoring: restoring.current, panelOpen: !!drawer, hasNext: index >= 0 && index < chapters.length - 1,
      elapsed: Date.now() - entered.current, bottomGap: element.scrollHeight - element.scrollTop - element.clientHeight, overflow: element.scrollHeight - element.clientHeight, allowShort })) { cancelAuto(); return; }
    if (!endGate.current.update(Date.now(), true, gesture) || speaking) return;
    if (autoTimer.current) return;
    setAutoPending(true);
    autoTimer.current = setTimeout(() => { autoTimer.current = null; const view = viewport.current; if (view && intent.current && view.scrollHeight - view.scrollTop - view.clientHeight <= 8) go(index + 1); else setAutoPending(false); }, 900);
  };
  const scroll = () => { cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => { capture(); maybeAuto(); }); };
  const changePrefs = async (patch: Partial<ReaderPreferences>) => {
    capture(); target.current = position.current; restoring.current = true;
    speechService.stop(); setSpeaking(false); cancelAuto();
    setPaused(false); setSpeechParagraph(null); endGate.current.reset();
    setState(current => ({ ...current, preferences: { ...current.preferences, ...patch } }));
    try { const next = await updateReaderState(current => ({ ...current, preferences: { ...current.preferences, ...patch } })); setState(next); }
    catch (reason) { report(reason); }
    requestAnimationFrame(() => requestAnimationFrame(restorePosition));
  };
  const currentBookmark = state.bookmarks.find(row => row.novelId === book.id && row.chapterId === chapterId && row.paragraphIndex === currentParagraph);
  const canRead = prefs.mode === 'translation' && paragraphs.length > 0;
  const activeSpeechParagraph = speechParagraph ?? currentParagraph;
  const moveSpeech = (paragraph: number) => {
    setSpeechParagraph(paragraph);
    viewport.current?.querySelector(`[data-reader-paragraph="${paragraph}"]`)?.scrollIntoView({ block: 'start' });
  };
  const toggleSpeech = () => {
    if (!canRead) return;
    if (!voiceAvailable) { setShowVoiceSetup(true); return; }
    intent.current = false; cancelAuto(); endGate.current.reset();
    if (speaking) { if (paused) speechService.resume(); else speechService.pause(); setPaused(!paused); return; }
    speechService.speakParagraphs(paragraphs, settings.ttsRate, { onStart: () => { setSpeaking(true); setPaused(false); },
      onParagraphChange: moveSpeech, onEnd: () => { setSpeaking(false); setPaused(false); setSpeechParagraph(null); },
      onError: reason => { setSpeaking(false); setPaused(false); setSpeechParagraph(null); report(reason); } }, activeSpeechParagraph);
  };
  const seekSpeech = (direction: -1 | 1) => {
    const next = activeSpeechParagraph + direction;
    if (!canRead || next < 0 || next >= paragraphs.length) return;
    intent.current = false; cancelAuto(); endGate.current.reset();
    if (speaking) speechService.seekParagraph(next); else moveSpeech(next);
  };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!ready || drawer || showVoiceSetup || event.ctrlKey || event.metaKey || target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (!event.repeat) go(index + (event.key === 'ArrowRight' ? 1 : -1));
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        intent.current = event.key === 'ArrowDown';
        if (!intent.current) { cancelAuto(); endGate.current.reset(); }
        else maybeAuto(true, !event.repeat);
        viewport.current?.scrollBy({ top: event.key === 'ArrowDown' ? 72 : -72, behavior: 'auto' });
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });
  const toggleBookmark = async () => {
    capture(); if (!position.current || !chapter) return;
    const here = { ...position.current };
    try { const next = await updateReaderState(current => {
      const old = current.bookmarks.find(row => row.novelId === book.id && row.chapterId === chapterId && row.paragraphIndex === here.paragraphIndex);
      return { ...current, bookmarks: old ? current.bookmarks.filter(row => row.id !== old.id) : [...current.bookmarks, { ...here, id: crypto.randomUUID(), novelId: book.id, label: `${chapter.title} · ${(paragraphs[here.paragraphIndex] || '').slice(0, 70)}` }] };
    }); setState(next); } catch (reason) { report(reason); }
  };
  const close = async () => { capture(); await flush(); if (document.fullscreenElement === root.current) await document.exitFullscreen().catch(() => {}); onClose(); };
  const colors = prefs.theme === 'dark' ? { background: '#161819', color: '#e7e7e5', '--ui-surface': '#202324', '--ui-text': '#e7e7e5', '--ui-muted': '#a5aaa9', '--ui-border': '#3c4142' } : prefs.theme === 'light' ?
    { background: '#fafaf8', color: '#282b2b', '--ui-surface': '#ffffff', '--ui-text': '#282b2b', '--ui-muted': '#636868', '--ui-border': '#d8dcdb' } :
    { background: '#f4ecd9', color: '#403729', '--ui-surface': '#eee3cd', '--ui-text': '#403729', '--ui-muted': '#776b58', '--ui-border': '#d6c8ac' };
  const bookmarks = state.bookmarks.filter(row => row.novelId === book.id && chapters.some(chapter => chapter.id === row.chapterId));
  const listed = search.trim() ? chapters.map((row, i) => ({ row, i })).filter(({ row, i }) => `${i + 1} ${row.title}`.toLowerCase().includes(search.toLowerCase().trim())).slice(0, 100) :
    chapters.slice(block * 100, block * 100 + 100).map((row, offset) => ({ row, i: block * 100 + offset }));
  return <div ref={root} role="region" aria-label="Chế độ đọc truyện" className="library-reader fixed inset-0 z-40 flex min-h-0 flex-col" style={colors as React.CSSProperties}>
    <header className="library-reader-header flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2" style={{ background: 'var(--ui-surface)' }}>
      <div className="flex min-w-0 items-center gap-2"><button aria-label="Về thư viện" className="p-2" onClick={() => void close()}><ArrowLeft size={19} /></button><div className="min-w-0"><p className="truncate text-sm font-semibold">{book.title}</p><p className="truncate text-xs text-muted">{chapter?.title || 'Đang mở truyện…'}</p></div></div>
      <div className="flex items-center gap-1">
        <button className="p-2" aria-label="Danh sách chương" onClick={() => { setBlock(Math.max(0, Math.floor(index / 100))); setDrawer('chapters'); }}><List size={19} /></button>
        <button className="p-2" aria-label={currentBookmark ? 'Bỏ đánh dấu trang này' : 'Đánh dấu trang này'} onClick={() => void toggleBookmark()}>{currentBookmark ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}</button>
        <button className="p-2" aria-label="Các trang đã đánh dấu" onClick={() => setDrawer('bookmarks')}><BookmarkCheck size={19} /></button>
        <button className="p-2" aria-label="Cài đặt đọc truyện" onClick={() => setDrawer('settings')}><Settings2 size={19} /></button>
        <button className="hidden p-2 sm:block" aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(report); else void root.current?.requestFullscreen().catch(report); }}>{fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
      </div>
    </header>
    {error && <p role="alert" className="shrink-0 bg-rose-950 px-4 py-2 text-sm text-rose-200">{error}<button className="ml-3 underline" onClick={() => setError('')}>Đóng</button></p>}
    {!ready ? <p role="status" className="p-6">Đang mở vị trí đọc…</p> : !chapter ? <p className="p-6">Truyện chưa có chương để đọc.</p> : <>
      <div ref={viewport} tabIndex={0} aria-label="Nội dung chương" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 outline-none sm:px-10" onScroll={scroll}
        onWheel={event => { if (event.deltaY > 0) { intent.current = true; shortPull.current += event.deltaY; maybeAuto(shortPull.current > 70, true); } else { intent.current = false; shortPull.current = 0; cancelAuto(); endGate.current.reset(); } }}
        onTouchStart={event => { touchY.current = event.touches[0].clientY; const el = event.currentTarget; touchAtEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 8; }} onTouchMove={event => { intent.current = touchY.current - event.touches[0].clientY > 20; if (!intent.current) { cancelAuto(); endGate.current.reset(); } }} onTouchEnd={event => { if (touchY.current - event.changedTouches[0].clientY > 60) maybeAuto(true, touchAtEnd.current); }}
        onKeyDown={event => { if (['PageDown', ' ', 'End'].includes(event.key)) { intent.current = true; maybeAuto(true, !event.repeat); } else if (['PageUp', 'Home'].includes(event.key)) { intent.current = false; cancelAuto(); endGate.current.reset(); } }}>
        <article className="mx-auto pb-8 pt-8 sm:pt-12" style={{ maxWidth: prefs.width, fontSize: prefs.fontSize, lineHeight: prefs.lineHeight, fontFamily: prefs.fontFamily === 'serif' ? '"Noto Serif", Georgia, serif' : '"Be Vietnam Pro", sans-serif', overflowWrap: 'anywhere' }}>
          <p className="mb-2 text-xs text-muted">Chương {index + 1}/{chapters.length} · khoảng {Math.max(1, Math.ceil(text.split(/\s+/).length / 230))} phút đọc</p>
          <h1 className="mb-8 text-[1.35em] font-semibold leading-relaxed">{chapter.title}</h1>
          {prefs.mode === 'translation' && !chapter.vietphraseText.trim() && <p className="mb-6 text-xs text-muted">Bản dịch tạm từ nguyên văn. Có thể mở chỉnh sửa nếu cần.</p>}
          {paragraphs.map((paragraph, i) => <p key={`${chapter.id}-${i}`} data-reader-paragraph={i} className="mb-[1em] whitespace-pre-wrap">{paragraph}</p>)}
          {!paragraphs.length && <p>Chương chưa có nội dung.</p>}
          <div className="mt-12 border-t border-line pt-6 text-center text-sm"><p className="mb-4 text-muted">{index === chapters.length - 1 ? 'Bạn đã đọc đến chương cuối đã lưu.' : 'Hết chương. Chờ 2,5 giây, rồi kéo thêm một nhịp để sang chương sau.'}</p><div className="flex justify-center gap-3"><button className="studio-action" disabled={index <= 0} onClick={() => go(index - 1)}><ChevronLeft size={16} />Chương trước</button><button className="studio-action" disabled={index >= chapters.length - 1} onClick={() => go(index + 1)}>Chương sau<ChevronRight size={16} /></button></div></div>
        </article>
      </div>
      <footer className="library-reader-footer flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs" style={{ background: 'var(--ui-surface)' }}>
        <button aria-label="Chương trước" disabled={index <= 0} className="p-2 disabled:opacity-30" onClick={() => go(index - 1)}><ChevronLeft size={18} /></button>
        <span>{index + 1}/{chapters.length} · {percent}% chương</span>
        <SpeechTransport speaking={speaking} paused={paused} canRead={canRead} previousDisabled={!voiceAvailable || !canRead || activeSpeechParagraph <= 0} nextDisabled={!canRead || activeSpeechParagraph >= paragraphs.length - 1} onToggle={toggleSpeech} onSeek={seekSpeech} />
        {speaking && <button aria-label="Dừng đọc" className="p-2" onClick={() => { speechService.stop(); setSpeaking(false); setPaused(false); setSpeechParagraph(null); }}><Square size={16} /></button>}
        {autoPending && <button className="underline" onClick={() => { intent.current = false; cancelAuto(); endGate.current.reset(); }}>Hủy chuyển chương</button>}
        <button aria-label="Chương sau" disabled={index >= chapters.length - 1} className="p-2 disabled:opacity-30" onClick={() => go(index + 1)}><ChevronRight size={18} /></button>
      </footer>
    </>}
    {showVoiceSetup && <VoiceSetupDialog onClose={() => setShowVoiceSetup(false)} />}
    {drawer && <div className="absolute inset-0 z-10 flex justify-end bg-black/40" onClick={() => setDrawer(null)}><section role="dialog" aria-modal="true" aria-label={drawer === 'chapters' ? 'Mục lục truyện' : drawer === 'bookmarks' ? 'Trang đã đánh dấu' : 'Tùy chỉnh đọc'} className="flex h-full w-[min(26rem,94vw)] flex-col overflow-y-auto p-5 shadow-xl" style={{ background: 'var(--ui-surface)' }} onClick={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key === 'Escape') setDrawer(null);
      if (event.key === 'Tab') { const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')); const first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}>
      <div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">{drawer === 'chapters' ? 'Danh sách chương' : drawer === 'bookmarks' ? 'Đánh dấu trang' : 'Tùy chỉnh đọc'}</h2><button autoFocus aria-label="Đóng bảng đọc" className="p-2" onClick={() => setDrawer(null)}><X size={18} /></button></div>
      {drawer === 'chapters' && <><input aria-label="Tìm chương trong mục lục" placeholder="Tìm số chương hoặc tiêu đề…" value={search} onChange={event => setSearch(event.target.value)} className="mb-3 rounded-lg border border-line bg-transparent px-3 py-2 text-sm" /><select aria-label="Nhóm 100 chương" value={block} onChange={event => { setBlock(Number(event.target.value)); setSearch(''); }} className="mb-4 rounded-lg border border-line bg-transparent p-2 text-sm">{readerChapterBlocks(chapters.length).map(group => <option key={group.index} value={group.index}>Chương {group.start + 1}–{group.end}</option>)}</select><p className="mb-2 text-xs text-muted">{search ? 'Tối đa 100 kết quả. Nhập thêm để thu hẹp tìm kiếm.' : 'Mỗi nhóm tối đa 100 chương.'}</p><nav className="space-y-1">{listed.map(({ row, i }) => <button key={row.id} aria-current={row.id === chapterId ? 'page' : undefined} onClick={() => go(i)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${row.id === chapterId ? 'bg-accent-soft font-semibold' : 'hover:bg-black/5'}`}>{row.title}</button>)}{!listed.length && <p className="text-sm text-muted">Không có chương phù hợp.</p>}</nav></>}
      {drawer === 'bookmarks' && <div className="space-y-3">{!bookmarks.length && <p className="text-sm text-muted">Chưa có trang đánh dấu. Dùng biểu tượng đánh dấu trên thanh đọc để lưu vị trí hiện tại.</p>}{bookmarks.map(mark => <div key={mark.id} className="flex items-start gap-2 rounded-lg border border-line p-3"><button className="flex-1 text-left text-sm" onClick={() => go(chapters.findIndex(row => row.id === mark.chapterId), mark)}>{mark.label}</button><button aria-label={`Xóa đánh dấu ${mark.label}`} onClick={() => void updateReaderState(current => ({ ...current, bookmarks: current.bookmarks.filter(row => row.id !== mark.id) })).then(setState).catch(report)}><Trash2 size={16} /></button></div>)}</div>}
      {drawer === 'settings' && <div className="space-y-5 text-sm">
        <label className="block">Cỡ chữ: {prefs.fontSize}px<input aria-label="Cỡ chữ đọc truyện" type="range" min={14} max={36} value={prefs.fontSize} onChange={event => void changePrefs({ fontSize: Number(event.target.value) })} className="mt-2 block w-full" /></label>
        <label className="block">Giãn dòng: {prefs.lineHeight}<input aria-label="Giãn dòng đọc truyện" type="range" min={1.3} max={2.6} step={0.1} value={prefs.lineHeight} onChange={event => void changePrefs({ lineHeight: Number(event.target.value) })} className="mt-2 block w-full" /></label>
        <label className="block">Độ rộng trang<input aria-label="Độ rộng trang đọc" type="range" min={480} max={1000} step={40} value={prefs.width} onChange={event => void changePrefs({ width: Number(event.target.value) })} className="mt-2 block w-full" /></label>
        <label className="block">Giao diện đọc<select aria-label="Giao diện đọc" value={prefs.theme} onChange={event => void changePrefs({ theme: event.target.value as ReaderPreferences['theme'] })} className="ml-3 rounded border border-line bg-transparent p-2"><option value="sepia">Giấy ngả vàng</option><option value="light">Sáng</option><option value="dark">Tối</option></select></label>
        <label className="block">Phông chữ<select aria-label="Phông chữ đọc" value={prefs.fontFamily} onChange={event => void changePrefs({ fontFamily: event.target.value as ReaderPreferences['fontFamily'] })} className="ml-3 rounded border border-line bg-transparent p-2"><option value="serif">Có chân</option><option value="sans">Không chân</option></select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.autoNext} onChange={event => void changePrefs({ autoNext: event.target.checked })} />Tự sang chương khi kéo hết trang</label>
        <label className="block">Nội dung<select aria-label="Ngôn ngữ đọc" value={prefs.mode} onChange={event => void changePrefs({ mode: event.target.value as ReaderPreferences['mode'] })} className="ml-3 rounded border border-line bg-transparent p-2"><option value="translation">Bản dịch tiếng Việt</option><option value="original">Nguyên văn</option></select></label>
        <p className="text-xs text-muted">Vị trí và đánh dấu được lưu tự động trên trình duyệt này. ←/→: chuyển chương. ↑/↓: cuộn nội dung đọc.</p>
        {chapter && <button className="studio-action" onClick={() => { capture(); void flush().then(() => onEdit(chapter)); }}>Mở chương để chỉnh sửa / dịch</button>}
      </div>}
    </section></div>}
  </div>;
}
