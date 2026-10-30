import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { NovelBook } from '../context/AppContext';

export type NewLibraryBook = Omit<NovelBook, 'id' | 'createdAt' | 'updatedAt'>;

export function NewLibraryBookDialog({ initialTitle, chapterCount, busy, onConfirm, onCancel }: {
  initialTitle: string; chapterCount: number; busy: boolean;
  onConfirm: (book: NewLibraryBook) => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [originalTitle, setOriginalTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genres, setGenres] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const field = 'mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-main';
  return <dialog ref={dialog} aria-labelledby="new-library-book-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} className="studio-help m-auto max-h-[85dvh] w-[min(38rem,94vw)] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-main shadow-xl">
    <form className="flex max-h-[85dvh] flex-col" onSubmit={event => {
      event.preventDefault(); if (busy || !title.trim()) return;
      const tags = [...new Set(genres.split(',').map(value => value.trim()).filter(Boolean))];
      onConfirm({ title: title.trim(), originalTitle: originalTitle.trim(), author: author.trim(), genres: tags,
        genre: tags.join(' / '), coverUrl: coverUrl.trim(), description: description.trim() });
    }}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line p-5">
        <h2 id="new-library-book-title" className="font-semibold">Tạo truyện mới trong thư viện</h2>
        <button type="button" aria-label="Đóng cửa sổ tạo truyện" disabled={busy} onClick={onCancel} className="p-1"><X size={20} /></button>
      </header>
      <fieldset disabled={busy} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm">
        <p className="text-muted">Nhập thông tin truyện để lưu {chapterCount} chương đã dịch vào thư viện.</p>
        <label className="block">Tên truyện <span className="text-accent">*</span><input autoFocus required value={title} onChange={event => setTitle(event.target.value)} className={field} /></label>
        <label className="block">Tên gốc<input value={originalTitle} onChange={event => setOriginalTitle(event.target.value)} className={field} /></label>
        <label className="block">Tác giả<input value={author} onChange={event => setAuthor(event.target.value)} className={field} /></label>
        <label className="block">Thể loại<input value={genres} onChange={event => setGenres(event.target.value)} placeholder="Ví dụ: Tiên hiệp, Huyền huyễn" className={field} /><span className="text-xs text-muted">Phân cách các thể loại bằng dấu phẩy.</span></label>
        <label className="block">Đường dẫn ảnh bìa<input value={coverUrl} onChange={event => setCoverUrl(event.target.value)} placeholder="https://…" className={field} /></label>
        <label className="block">Giới thiệu<textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} className={field} /></label>
      </fieldset>
      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line p-4">
        <button type="button" disabled={busy} onClick={onCancel} className="studio-action">Hủy</button>
        <button type="submit" disabled={busy || !title.trim()} className="studio-action studio-action-primary">{busy ? 'Đang lưu…' : 'Tạo truyện và lưu chương'}</button>
      </footer>
    </form>
  </dialog>;
}
