import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { BatchTranslationItem } from '../utils/chapterSplitter';

export function BatchChapterPreviewDialog({ chapter, filename, onClose }: {
  chapter: BatchTranslationItem; filename?: string; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [bounds, setBounds] = useState({ width: 880, height: '90dvh' });
  useEffect(() => {
    const frame = document.getElementById('app-frame');
    const update = () => setBounds({
      width: Math.max(0, Math.min(880, (frame?.clientWidth || window.innerWidth) - 16)),
      height: `${Math.floor(Math.min(frame?.clientHeight || window.innerHeight, window.visualViewport?.height || window.innerHeight) * 0.92)}px`,
    });
    const observer = new ResizeObserver(update);
    if (frame) observer.observe(frame);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    update();
    ref.current?.showModal();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return <dialog ref={ref} style={bounds} aria-labelledby="chapter-preview-title" onCancel={event => { event.preventDefault(); onClose(); }} className="chapter-preview-dialog studio-help m-auto overflow-hidden rounded-xl border border-line bg-surface p-0 text-main shadow-2xl">
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <span className="max-w-24 shrink-0 truncate rounded border border-line bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent" title={filename}>{filename}</span>
        <h3 id="chapter-preview-title" className="min-w-0 flex-1 truncate text-sm font-semibold" title={chapter.translatedTitle || chapter.rawTitle}>{chapter.translatedTitle || chapter.rawTitle}</h3>
        <button autoFocus aria-label="Đóng xem trước" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-main"><X size={18} /></button>
      </header>
      <div className="chapter-preview-panes min-h-0 flex-1 gap-2 p-2">
        <section aria-label="Nội dung gốc" tabIndex={0} className="min-h-0 min-w-0 overflow-auto overscroll-contain rounded-lg border border-line bg-canvas p-3 font-serif text-sm leading-relaxed whitespace-pre-wrap break-words">{chapter.content}</section>
        <section aria-label="Nội dung đã dịch" tabIndex={0} className="min-h-0 min-w-0 overflow-auto overscroll-contain rounded-lg border border-line bg-canvas p-3 text-sm leading-relaxed whitespace-pre-wrap break-words">{chapter.translatedContent || <span className="italic text-muted">Chương này chưa được dịch.</span>}</section>
      </div>
      <footer className="flex shrink-0 justify-end border-t border-line px-3 py-2">
        <button onClick={onClose} className="min-h-9 rounded-lg bg-raised px-4 text-xs font-medium hover:bg-hover">Đóng</button>
      </footer>
    </div>
  </dialog>;
}
