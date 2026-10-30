import React, { useEffect, useRef } from 'react';

export function LibrarySaveConflictDialog({ count, busy, onChoose, onCancel }: {
  count: number; busy: boolean; onChoose: (policy: 'overwrite' | 'skip') => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} aria-labelledby="library-conflicts-title" className="studio-help m-auto w-[min(30rem,94vw)] rounded-2xl border border-line bg-surface p-5 text-main shadow-xl">
    <h2 id="library-conflicts-title" className="font-semibold">Thư viện đã có {count} chương</h2>
    <p className="my-3 text-sm text-muted">Bạn có thể ghi đè bản dịch cũ hoặc giữ bản cũ và chỉ lưu chương mới. Chỉ các chương khớp trong cùng bộ truyện được thay thế.</p>
    <div className="flex flex-wrap justify-end gap-2">
      <button className="studio-action" disabled={busy} onClick={onCancel}>Hủy lưu</button>
      <button className="studio-action" disabled={busy} onClick={() => onChoose('skip')}>Giữ bản cũ</button>
      <button className="studio-action studio-action-primary" disabled={busy} onClick={() => onChoose('overwrite')}>{busy ? 'Đang lưu…' : 'Ghi đè bản cũ'}</button>
    </div>
  </dialog>;
}
