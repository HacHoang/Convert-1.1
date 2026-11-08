import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { stylePhraseDictionary } from '../utils/translationStyle';
import { parseVietphraseMeanings } from '../utils/translatorEngine';
import { assignedMeanings, meaningStyleFallback, saveMeaningStyles, MEANING_STYLE_OPTIONS, type MeaningKind, type MeaningStyle } from '../utils/meaningStyles';

export function meaningRows(kind: MeaningKind, chinese: string, raw: string): MeaningStyle[] {
  const meanings = [...new Set([parseVietphraseMeanings(raw).primary, ...parseVietphraseMeanings(raw).alternatives])];
  const saved = assignedMeanings(kind, chinese);
  return meanings.map(meaning => ({ meaning, styles: saved
    ? saved.find(row => row.meaning === meaning)?.styles || []
    : meaningStyleFallback() === 'neutral' ? ['neutral'] : kind === 'vietphrase' ? MEANING_STYLE_OPTIONS.filter(([style]) => stylePhraseDictionary(style)[chinese] === meaning).map(([style]) => style) : [],
  }));
}

export function MeaningStyleEditor({ kind, chinese, raw, onClose }: { kind: MeaningKind; chinese: string; raw: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState(() => meaningRows(kind, chinese, raw));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bounds, setBounds] = useState<DOMRect | null>(null);
  useEffect(() => {
    const frame = document.getElementById('app-frame');
    const update = () => setBounds(frame?.getBoundingClientRect() || null);
    const observer = new ResizeObserver(update);
    if (frame) observer.observe(frame);
    window.addEventListener('resize', update); window.visualViewport?.addEventListener('resize', update);
    update(); dialogRef.current?.showModal();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update); dialogRef.current?.close(); };
  }, []);
  const select = (index: number, styles: MeaningStyle['styles']) => setRows(previous => previous.map((row, at) => ({
    ...row, styles: at === index ? styles : row.styles,
  })));
  const height = bounds ? Math.min(bounds.height - 16, (window.visualViewport?.height ?? window.innerHeight) - 16) : undefined;
  return createPortal(<dialog ref={dialogRef} aria-labelledby="meaning-style-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}
    style={bounds ? { left: bounds.left + bounds.width / 2, top: bounds.top + bounds.height / 2, width: Math.min(680, bounds.width - 16), margin: 0, transform: 'translate(-50%, -50%)', '--meaning-height': `${height}px` } as React.CSSProperties : undefined}
    className="studio-ui fixed m-auto w-[calc(100%-1rem)] max-w-2xl overflow-hidden rounded-xl border border-line bg-surface p-0 text-main backdrop:bg-black/60">
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError('');
      try { await saveMeaningStyles(kind, chinese, rows); onClose(); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được thuộc tính.'); setBusy(false); }
    }} className="flex max-h-[var(--meaning-height,85dvh)] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0"><h2 id="meaning-style-title" className="text-sm font-semibold">Thuộc tính văn phong</h2><p className="mt-1 break-words text-base text-accent">{chinese}</p><p className="mt-2 text-xs leading-relaxed text-muted">Một nghĩa có thể dùng nhiều văn phong. Nếu nhiều nghĩa cùng thẻ, ưu tiên nghĩa đứng trước trong từ điển.</p></div>
        <button type="button" disabled={busy} aria-label="Đóng thuộc tính văn phong" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-raised"><X size={18} /></button>
      </header>
      <div className="min-h-0 space-y-3 overflow-y-auto p-4">
        {rows.map((row, index) => <details key={row.meaning} open={rows.length <= 2 || undefined} className="rounded-lg border border-line bg-canvas/40 p-3">
          <summary className="cursor-pointer break-words text-sm font-medium">{row.meaning || '(Lược bỏ / nghĩa rỗng)'}<span className="ml-2 text-[11px] font-normal text-muted">{row.styles.length ? `${row.styles.length} văn phong` : 'Chưa phân loại'}</span></summary>
          <fieldset disabled={busy} aria-label={`Văn phong cho nghĩa ${row.meaning || 'rỗng'}`} className="mt-3">
            <div className="mb-3 flex gap-3 text-xs"><button type="button" onClick={() => select(index, MEANING_STYLE_OPTIONS.map(([style]) => style))} className="text-accent hover:underline">Dùng mọi văn phong</button><button type="button" onClick={() => select(index, [])} className="text-muted hover:text-main">Bỏ các thẻ</button></div>
            <div className="flex flex-wrap gap-1.5">{MEANING_STYLE_OPTIONS.map(([style, label]) => <label key={style} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${row.styles.includes(style) ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line text-muted hover:bg-raised'}`}><input type="checkbox" checked={row.styles.includes(style)} onChange={event => select(index, event.target.checked ? [...row.styles, style] : row.styles.filter(value => value !== style))} className="accent-accent" />{label}</label>)}</div>
          </fieldset>
        </details>)}
        <p role="alert" className="min-h-4 truncate text-xs text-rose-400" title={error || undefined}>{error}</p>
      </div>
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line p-3">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-muted hover:bg-raised">Hủy</button>
        <button type="submit" disabled={busy} className="rounded-lg bg-accent px-3 py-2 text-xs text-main">{busy ? 'Đang lưu…' : 'Lưu thuộc tính'}</button>
      </footer>
    </form>
  </dialog>, document.getElementById('app-frame') || document.body);
}
