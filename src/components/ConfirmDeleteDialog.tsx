import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function ConfirmDeleteDialog({ description, onCancel, onConfirm }: { description: string; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return createPortal(<dialog ref={ref} aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" onCancel={onCancel} onClick={event => { if (event.target === event.currentTarget) onCancel(); }} className="studio-ui m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-line bg-surface p-5 text-main backdrop:bg-black/50">
    <h2 id="delete-dialog-title" className="text-base font-semibold">Xóa khỏi danh sách?</h2>
    <p id="delete-dialog-description" className="mt-2 break-words text-sm leading-relaxed text-muted">{description}</p>
    <div className="mt-5 flex justify-end gap-2">
      <button autoFocus type="button" onClick={onCancel} className="studio-action">Hủy</button>
      <button type="button" onClick={onConfirm} className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-on-accent hover:opacity-90">Xóa</button>
    </div>
  </dialog>, document.body);
}
