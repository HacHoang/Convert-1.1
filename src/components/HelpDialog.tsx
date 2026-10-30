import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Keyboard, X } from 'lucide-react';

const shortcuts = [
  ['Alt + S', 'Lưu chương vào thư viện'],
  ['Alt + C', 'Sao chép bản dịch'],
  ['Alt + R', 'Làm mới bản dịch'],
  ['Alt + F', 'Mở hoặc đóng tìm và thay thế'],
  ['Alt + K', 'Bật hoặc tắt cuộn đồng bộ'],
  ['Alt + ←', 'Mở chương trước trong thư viện'],
  ['Alt + →', 'Mở chương tiếp trong thư viện'],
  ['Alt + P', 'Đọc, tạm dừng hoặc tiếp tục đọc'],
];

export function HelpDialog({ onClose, initialSection = 'guide' }: { onClose: () => void; initialSection?: 'guide' | 'shortcuts' }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState(initialSection);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="help-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} className="studio-ui studio-help m-auto w-[calc(100%-2rem)] max-w-xl max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-main">
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 id="help-title" className="text-base font-semibold">Hướng dẫn</h2>
          <button autoFocus type="button" onClick={onClose} aria-label="Đóng hướng dẫn" className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-main"><X size={18} /></button>
        </div>
        <div role="group" aria-label="Nội dung hướng dẫn" className="flex shrink-0 gap-1 border-b border-line px-5 py-2">
          <button aria-pressed={section === 'guide'} onClick={() => setSection('guide')} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${section === 'guide' ? 'bg-raised text-main' : 'text-muted hover:text-main'}`}><BookOpen size={15} />Cách sử dụng</button>
          <button aria-pressed={section === 'shortcuts'} onClick={() => setSection('shortcuts')} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${section === 'shortcuts' ? 'bg-raised text-main' : 'text-muted hover:text-main'}`}><Keyboard size={15} />Phím tắt</button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 text-sm leading-relaxed">
          {section === 'guide' ? <div className="space-y-5">
            <section><h3 className="mb-1 font-medium text-main">Dịch nhanh</h3><p className="text-muted">Dán tiếng Trung hoặc mở tệp TXT/DOCX. Bản Vietphrase cập nhật tự động. Chọn Hán Việt để xem phiên âm hoặc Song song để đối chiếu bản gốc và bản dịch.</p></section>
            <section><h3 className="mb-1 font-medium text-main">Tra từ và chỉnh nghĩa</h3><p className="text-muted">Bôi đen chữ trong ô tiếng Trung để tra từ và thêm vào từ điển. Dùng Tìm và thay thế để sửa nội dung; bật Cuộn đồng bộ để hai khung cuộn cùng nhau.</p></section>
            <section><h3 className="mb-1 font-medium text-main">Dịch nhiều chương</h3><p className="text-muted">Thêm nhiều tệp hoặc dán văn bản vào Tách chương. Chọn truyện, chương đầu và định dạng, rồi bấm Dịch tất cả. Sau khi dịch, lưu vào thư viện, tải ZIP hoặc lưu thư mục nếu trình duyệt hỗ trợ.</p></section>
            <section><h3 className="mb-1 font-medium text-main">Thư viện</h3><p className="text-muted">Tìm và sắp xếp truyện, đổi giữa lưới và danh sách. Mở một truyện để xem chương, mỗi tập gồm tối đa 100 chương. Nhập số tập rồi bấm Đến để chuyển nhanh.</p></section>
            <section><h3 className="mb-1 font-medium text-main">Đọc giọng nói</h3><p className="text-muted">Trong Vietphrase hoặc Song song, dùng nút trước/tiếp để chọn đoạn, nút giữa để đọc hoặc tạm dừng. Nút Dừng kết thúc lượt đọc. Tốc độ và thử giọng nằm trong Cài đặt; thiết bị cần có giọng tiếng Việt.</p></section>
          </div> : <div>
            <p className="mb-4 text-xs text-muted">Các phím Alt dưới đây dùng trong Dịch nhanh. Phím Esc đóng menu và hướng dẫn.</p>
            <dl className="divide-y divide-neutral-800">{shortcuts.map(([key, label]) => <div key={key} className="flex items-center justify-between gap-4 py-3"><dt className="text-xs text-main">{label}</dt><dd><kbd className="whitespace-nowrap rounded-md border border-line bg-canvas px-2 py-1 font-mono text-[11px] text-main">{key}</kbd></dd></div>)}</dl>
          </div>}
        </div>
      </div>
    </dialog>, document.body,
  );
}
