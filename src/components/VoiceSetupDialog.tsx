import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, X, RefreshCw } from 'lucide-react';
import { speechService } from '../utils/speechEngine';

export function VoiceSetupDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [ready, setReady] = useState(false);
  const check = () => setReady(!!speechService.getVietnameseVoice());
  useEffect(() => {
    ref.current?.showModal();
    check();
    window.speechSynthesis?.addEventListener('voiceschanged', check);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', check);
  }, []);
  return createPortal(<dialog ref={ref} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} className="studio-ui m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-line bg-surface p-0 text-main backdrop:bg-black/50">
    <div className="flex items-center justify-between border-b border-line p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Volume2 size={18} strokeWidth={1.75} />Giọng đọc tiếng Việt</h2>
      <button onClick={onClose} aria-label="Đóng hướng dẫn giọng đọc" className="rounded-md p-1.5 text-muted hover:bg-hover"><X size={16} /></button>
    </div>
    <div className="space-y-3 p-4 text-sm leading-relaxed text-muted">
      <p role="status">{ready ? 'Đã tìm thấy giọng tiếng Việt. Đóng cửa sổ và bấm Đọc để bắt đầu.' : 'Trình duyệt chưa cung cấp giọng tiếng Việt cho ứng dụng.'}</p>
      {!ready && <>
        <p>Trên Windows: mở Cài đặt → Thời gian và ngôn ngữ → Giọng nói → Thêm giọng nói. Chọn Tiếng Việt nếu có trong danh sách.</p>
        <p>Sau khi cài, mở lại trình duyệt. Trình duyệt tích hợp có thể không cung cấp giọng đã cài; hãy thử mở ứng dụng bằng Chrome hoặc Edge.</p>
        <p className="text-xs">Ứng dụng hiện dùng giọng của thiết bị. Chưa có dịch vụ đọc trực tuyến để thay thế khi thiếu giọng.</p>
      </>}
      <button onClick={check} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium text-main hover:bg-hover"><RefreshCw size={14} />Kiểm tra lại</button>
    </div>
  </dialog>, document.body);
}
