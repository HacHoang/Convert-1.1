import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { NameSuggestion } from '../utils/batchNameDetection';

export function BatchNameReviewDialog({ suggestions, busy, chapterCount, onConfirm, onCancel }: {
  suggestions: NameSuggestion[]; busy: boolean; chapterCount: number;
  onConfirm: (names: { chinese: string; vietnamese: string }[], remember: boolean) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState(() => suggestions.map(row => ({ ...row, selected: false })));
  const [remember, setRemember] = useState(false);
  const [showUncertain, setShowUncertain] = useState(false);
  const [bounds, setBounds] = useState(() => ({ width: Math.min(800, (document.getElementById('app-frame')?.clientWidth || window.innerWidth) - 16), maxHeight: Math.floor((window.visualViewport?.height || window.innerHeight) * 0.92) }));
  useEffect(() => {
    const frame = document.getElementById('app-frame');
    const update = () => setBounds({ width: Math.min(800, (frame?.clientWidth || window.innerWidth) - 16), maxHeight: Math.floor(Math.min(frame?.clientHeight || window.innerHeight, window.visualViewport?.height || window.innerHeight) * 0.92) });
    const observer = new ResizeObserver(update); if (frame) observer.observe(frame);
    window.addEventListener('resize', update); window.visualViewport?.addEventListener('resize', update); update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update); };
  }, []);
  useEffect(() => { ref.current?.showModal(); }, []);
  const selected = rows.filter(row => row.selected);
  const uncertainCount = rows.filter(row => row.possibleContinuationOf).length;
  const visibleRows = rows.map((row, index) => ({ row, index })).filter(({ row }) => !row.possibleContinuationOf || showUncertain || row.selected);
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every(({ row }) => row.selected);
  return <dialog ref={ref} style={bounds} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} aria-labelledby="batch-name-review-title" className="name-review-dialog studio-help m-auto overflow-hidden rounded-2xl border border-line bg-surface p-0 text-main shadow-xl">
    <div className="flex flex-col" style={{ maxHeight: 'inherit' }}>
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-5">
    <h2 id="batch-name-review-title" className="text-base font-semibold">Duyệt tên nhân vật trước khi hoàn tất</h2>
    <button aria-label="Đóng cửa sổ duyệt tên" className="shrink-0 rounded-lg p-1 text-muted hover:bg-raised" disabled={busy} onClick={onCancel}><X size={20} /></button>
    </header>
    <div className="name-review-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
    <p className="mt-2 text-sm text-muted">Đã dịch nháp {chapterCount} chương. Chọn tên đúng, sửa cách viết nếu cần rồi xác nhận. Gợi ý có thể nhầm.</p>
    {!visibleRows.length && <p className="my-5 text-sm">Chưa phát hiện tên mới đủ tin cậy. Bạn vẫn có thể xem lại bản nháp trước khi xác nhận.</p>}
    {!!uncertainCount && <label className="mt-3 flex items-center gap-2 text-sm text-muted"><input type="checkbox" disabled={busy} checked={showUncertain} onChange={event => setShowUncertain(event.target.checked)} />Hiện {uncertainCount} cụm có thể dính từ sau tên</label>}
    {!!visibleRows.length && <div className="name-review-selection sticky top-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-2 bg-surface py-2">
      <button className="studio-action" disabled={busy} onClick={() => { const visible = new Set(visibleRows.map(({ index }) => index)); setRows(previous => previous.map((row, index) => visible.has(index) ? { ...row, selected: !allVisibleSelected } : row)); }}>{allVisibleSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>
      <span className="text-xs text-muted" title="Áp dụng cho danh sách đang hiển thị">Đã chọn {selected.length} tên</span>
    </div>}
    <div className="my-4 space-y-3">{visibleRows.map(({ row, index }) => <div key={row.chinese} className="name-review-card rounded-xl border border-line p-3">
      <div className="name-review-fields flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2"><input type="checkbox" disabled={busy} checked={row.selected} onChange={event => setRows(previous => previous.map((value, i) => i === index ? { ...value, selected: event.target.checked } : value))} />{row.chinese}</label>
        <input aria-label={`Tên tiếng Việt cho ${row.chinese}`} disabled={busy} value={row.vietnamese} onChange={event => setRows(previous => previous.map((value, i) => i === index ? { ...value, vietnamese: event.target.value } : value))} className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm" />
        <span className="text-xs text-muted">{row.count} lần · {row.chapterCount} chương</span>
      </div>
      {row.possibleContinuationOf && <p className="mt-2 text-xs text-amber-500">Có thể là tên {row.possibleContinuationOf} nối với từ trong câu; chỉ chọn nếu đây thực sự là tên đầy đủ.</p>}
      <p className="mt-2 text-xs text-muted">Gốc: …{row.sourceExample}…</p>
      <p className="mt-1 text-xs text-muted">Bản nháp: …{row.translationExample}…</p>
    </div>)}</div>
    {!!rows.length && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} disabled={busy} onChange={event => setRemember(event.target.checked)} />Lưu các tên đã chọn vào từ điển Name cho lần sau</label>}
    </div>
    <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line bg-surface p-4">
      <button className="studio-action" disabled={busy} onClick={onCancel}>Xem lại bản nháp</button>
      <button className="studio-action studio-action-primary" disabled={busy || selected.some(row => !row.vietnamese.trim())} onClick={() => onConfirm(selected.map(row => ({ chinese: row.chinese, vietnamese: row.vietnamese.trim() })), remember)}>{busy ? 'Đang áp dụng tên…' : `Xác nhận bản dịch${selected.length ? ` · ${selected.length} tên` : ''}`}</button>
    </footer>
    </div>
  </dialog>;
}
