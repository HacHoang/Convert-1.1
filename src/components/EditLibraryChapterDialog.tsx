import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { SavedChapter } from '../context/AppContext';

export function EditLibraryChapterDialog({ chapter, onSave, onClose }: {
  chapter: SavedChapter; onSave: (updates: Pick<SavedChapter, 'title' | 'originalText' | 'vietphraseText'>) => Promise<void>; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(chapter.title);
  const [originalText, setOriginalText] = useState(chapter.originalText);
  const [vietphraseText, setVietphraseText] = useState(chapter.vietphraseText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-labelledby="edit-library-chapter-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="studio-help m-auto w-[min(62rem,96vw)] max-h-[90dvh] overflow-hidden rounded-xl border border-line bg-surface p-0 text-main shadow-xl">
    <form className="flex max-h-[90dvh] flex-col" onSubmit={async event => { event.preventDefault(); if (busy || !title.trim()) return; setBusy(true); setError(''); try { await onSave({ title, originalText, vietphraseText }); onClose(); } catch (reason) { setError(String(reason)); } finally { setBusy(false); } }}>
      <header className="flex shrink-0 items-center justify-between border-b border-line p-4"><h2 id="edit-library-chapter-title" className="font-semibold">Sửa chương truyện</h2><button type="button" aria-label="Đóng sửa chương" disabled={busy} onClick={onClose} className="p-2"><X size={18} /></button></header>
      <fieldset disabled={busy} className="min-h-0 space-y-4 overflow-y-auto p-4 text-sm">
        <label className="block">Tên chương<input autoFocus required value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2" /></label>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="block">Nguyên văn<textarea aria-label="Nguyên văn" value={originalText} onChange={event => setOriginalText(event.target.value)} rows={14} className="mt-1 w-full resize-y rounded-lg border border-line bg-canvas p-3 leading-relaxed" /></label>
          <label className="block">Bản dịch<textarea aria-label="Bản dịch" value={vietphraseText} onChange={event => setVietphraseText(event.target.value)} rows={14} className="mt-1 w-full resize-y rounded-lg border border-line bg-canvas p-3 leading-relaxed" /></label>
        </div>
        {error && <p role="alert" className="text-rose-400">{error}</p>}
      </fieldset>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-line p-4"><button type="button" disabled={busy} onClick={onClose} className="studio-action">Hủy</button><button type="submit" disabled={busy || !title.trim()} className="studio-action studio-action-primary">{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></footer>
    </form>
  </dialog>;
}
