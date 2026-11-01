import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, BookOpen, Search, X } from 'lucide-react';
import guideMarkdown from '../../docs/user-guide.md?raw';

// The downloadable document and the in-app guide share one source.
const topics = guideMarkdown.split(/^## /m).slice(1).map((content, index) => {
  const [title, ...lines] = content.trim().split('\n');
  return { id: `guide-${index}`, title: title.trim(), body: lines.join('\n').trim() };
});
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

function GuideContent({ text }: { text: string }) {
  return <div className="space-y-4 text-sm leading-7 text-muted">
    {text.split(/\n\s*\n/).map((block, index) => {
      const lines = block.split('\n');
      if (lines.every(line => /^\d+\. /.test(line))) {
        return <ol key={index} className="space-y-3">{lines.map((line, step) => <li key={step} className="flex items-start gap-3"><span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-[11px] font-medium text-accent">{step + 1}</span><span><span className="sr-only">Bước {step + 1}: </span>{line.replace(/^\d+\. /, '')}</span></li>)}</ol>;
      }
      if (lines.every(line => line.startsWith('- '))) {
        return <ul key={index} className="list-disc space-y-2 pl-4 marker:text-subtle">{lines.map((line, item) => <li key={item}>{line.slice(2)}</li>)}</ul>;
      }
      return <p key={index}>{block}</p>;
    })}
  </div>;
}

export function HelpDialog({ onClose, initialSection = 'guide' }: { onClose: () => void; initialSection?: 'guide' | 'shortcuts' }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(initialSection === 'shortcuts' ? topics[topics.length - 1].id : topics[0].id);
  const [query, setQuery] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [frameBounds, setFrameBounds] = useState<DOMRect | null>(null);
  const visibleTopics = topics.filter(topic => normalize(`${topic.title} ${topic.body}`).includes(normalize(query.trim())));
  const selected = visibleTopics.find(topic => topic.id === selectedId) || visibleTopics[0];
  const selectedIndex = selected ? topics.findIndex(topic => topic.id === selected.id) : -1;

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([guideMarkdown], { type: 'text/markdown;charset=utf-8' }));
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const frame = document.getElementById('app-frame');
    const update = () => setFrameBounds(frame?.getBoundingClientRect() || null);
    const observer = new ResizeObserver(update);
    if (frame) observer.observe(frame);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    update();
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      dialog?.close();
    };
  }, []);

  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [selected?.id]);

  const selectTopic = (id: string) => { setSelectedId(id); setQuery(''); };
  const maxHeight = frameBounds ? Math.min(frameBounds.height - 16, (window.visualViewport?.height ?? window.innerHeight) - 16) : undefined;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="help-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      style={frameBounds ? {
        left: frameBounds.left + frameBounds.width / 2,
        top: frameBounds.top + frameBounds.height / 2,
        width: Math.min(896, frameBounds.width - 16),
        margin: 0,
        transform: 'translate(-50%, -50%)',
        '--help-height': `${maxHeight}px`,
      } as React.CSSProperties : undefined}
      className="studio-ui studio-help @container/help fixed m-auto w-[calc(100%-1rem)] max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface p-0 text-main"
    >
      <div className="flex h-[var(--help-height,85dvh)] max-h-[var(--help-height,85dvh)] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line p-4 @min-[640px]/help:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-accent"><BookOpen size={18} aria-hidden="true" /></span>
            <div><h2 id="help-title" className="text-base font-semibold">Hướng dẫn sử dụng</h2><p className="mt-0.5 text-xs text-muted">Hermes · Từ văn bản đến thư viện của bạn</p></div>
          </div>
          <button autoFocus type="button" onClick={onClose} aria-label="Đóng hướng dẫn" className="shrink-0 rounded-lg p-2 text-muted hover:bg-raised hover:text-main"><X size={18} /></button>
        </header>
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3 @min-[640px]/help:px-6">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-muted">
            <Search size={15} aria-hidden="true" />
            <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Tìm trong hướng dẫn" placeholder="Tìm cách sử dụng…" className="min-w-0 w-full bg-transparent text-xs text-main outline-none" />
          </label>
          {query && <button type="button" aria-label="Xóa tìm kiếm hướng dẫn" onClick={() => setQuery('')} className="rounded-lg p-2 text-muted hover:bg-raised"><X size={15} /></button>}
          <a download="hermes-huong-dan.md" href={downloadUrl || undefined} className="shrink-0 rounded-lg px-2 py-2 text-xs text-muted hover:bg-raised hover:text-main">Tải hướng dẫn</a>
        </div>
        <div className="flex min-h-0 flex-1 flex-col @min-[640px]/help:flex-row">
          <nav aria-label="Chủ đề hướng dẫn" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-canvas/40 p-2 [scrollbar-width:thin] @min-[640px]/help:w-52 @min-[640px]/help:flex-col @min-[640px]/help:overflow-y-auto @min-[640px]/help:border-b-0 @min-[640px]/help:border-r">
            {visibleTopics.map(topic => <button key={topic.id} type="button" aria-current={selected?.id === topic.id ? 'true' : undefined} onClick={() => setSelectedId(topic.id)} className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${selected?.id === topic.id ? 'bg-raised text-accent' : 'text-muted hover:bg-raised/60 hover:text-main'}`}>{topic.title}</button>)}
            {visibleTopics.length === 0 && <p className="px-3 py-2 text-xs text-muted">Không có chủ đề phù hợp</p>}
          </nav>
          <div ref={contentRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-5 @min-[640px]/help:p-7" tabIndex={0} aria-label="Nội dung hướng dẫn">
            {selected ? <article aria-labelledby="guide-topic-title">
              <p className="mb-2 text-[11px] text-subtle">HƯỚNG DẪN · {String(selectedIndex + 1).padStart(2, '0')} / {topics.length}</p>
              <h3 id="guide-topic-title" className="mb-5 text-lg font-semibold tracking-tight">{selected.title}</h3>
              <GuideContent text={selected.body} />
              {!query && <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-4">
                <button type="button" disabled={selectedIndex <= 0} onClick={() => selectTopic(topics[selectedIndex - 1].id)} className="flex items-center gap-1.5 rounded-lg p-2 text-xs text-muted hover:bg-raised"><ArrowLeft size={14} />Trước</button>
                <button type="button" disabled={selectedIndex >= topics.length - 1} onClick={() => selectTopic(topics[selectedIndex + 1].id)} className="flex items-center gap-1.5 rounded-lg p-2 text-xs text-accent hover:bg-raised">Tiếp theo<ArrowRight size={14} /></button>
              </div>}
            </article> : <div role="status" className="py-12 text-center"><Search size={24} className="mx-auto mb-3 text-subtle" /><h3 className="text-sm font-medium">Chưa tìm thấy hướng dẫn</h3><p className="mt-2 text-xs text-muted">Thử từ khóa khác như “thư viện”, “giọng đọc” hoặc “sao lưu”.</p><button type="button" onClick={() => setQuery('')} className="mt-4 rounded-lg bg-raised px-3 py-2 text-xs text-accent">Xem tất cả chủ đề</button></div>}
          </div>
        </div>
      </div>
    </dialog>, document.getElementById('app-frame') || document.body,
  );
}
