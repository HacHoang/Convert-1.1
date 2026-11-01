import React from 'react';

export function DictionaryPagination({ totalItems, pageSize, setPageSize, page, totalPages, setPage }: {
  totalItems: number; pageSize: number; setPageSize: (size: number) => void;
  page: number; totalPages: number; setPage: (page: number) => void;
}) {
  return <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2 text-xs">
    <div className="flex items-center gap-2 text-muted"><span>{totalItems.toLocaleString()} mục</span><select aria-label="Số dòng mỗi trang" value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="rounded border border-line bg-surface px-1 py-1 text-main">{[25, 50, 100, 200].map(size => <option key={size} value={size}>{size} / trang</option>)}</select></div>
    <form className="flex items-center gap-1" onSubmit={event => {
      event.preventDefault();
      const input = event.currentTarget.elements.namedItem('page') as HTMLInputElement;
      const next = Math.max(1, Math.min(totalPages, Math.trunc(Number(input.value)) || 1));
      setPage(next); input.value = String(next);
    }}>
      <button type="button" aria-label="Trang đầu" disabled={page === 1} onClick={() => setPage(1)} className="rounded border border-line px-2 py-1 disabled:opacity-30">«</button>
      <button type="button" aria-label="Trang trước" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border border-line px-2 py-1 disabled:opacity-30">‹</button>
      <input key={page} name="page" aria-label="Đến trang" type="number" inputMode="numeric" min="1" max={totalPages} defaultValue={page} className="w-16 rounded border border-line bg-canvas px-1 py-1 text-center text-main" />
      <span className="px-1 text-muted">/ {totalPages.toLocaleString()}</span><button type="submit" className="rounded px-1.5 py-1 text-accent">Đi</button>
      <button type="button" aria-label="Trang tiếp" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="rounded border border-line px-2 py-1 disabled:opacity-30">›</button>
      <button type="button" aria-label="Trang cuối" disabled={page === totalPages} onClick={() => setPage(totalPages)} className="rounded border border-line px-2 py-1 disabled:opacity-30">»</button>
    </form>
  </div>;
}
