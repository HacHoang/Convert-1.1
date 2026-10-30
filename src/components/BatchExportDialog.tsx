import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function BatchExportDialog({ directorySupported, format, onFormat, onConfirm, onClose }: {
  directorySupported: boolean; format: 'txt' | 'docx'; onFormat: (format: 'txt' | 'docx') => void;
  onConfirm: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-labelledby="batch-export-title" onCancel={event => { event.preventDefault(); onClose(); }} className="studio-help m-auto w-[min(26rem,94vw)] rounded-xl border border-line bg-surface p-5 text-main shadow-xl">
    <div className="flex items-center justify-between gap-3"><h2 id="batch-export-title" className="font-semibold">Lưu vào máy</h2><button aria-label="Đóng tùy chọn xuất" onClick={onClose} className="p-2"><X size={18} /></button></div>
    <p className="mt-3 text-sm text-muted">{directorySupported ? 'Chọn định dạng, sau đó chọn thư mục để lưu từng chương.' : 'Các chương sẽ được gộp vào một file để tải về máy.'}</p>
    <fieldset className="my-5 space-y-3"><legend className="mb-3 text-sm text-muted">Định dạng file chương</legend>{(['txt', 'docx'] as const).map(value => <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-sm"><input type="radio" name="batch-export-format" value={value} checked={format === value} onChange={() => onFormat(value)} /><span>{value.toUpperCase()} · {value === 'txt' ? 'Văn bản thuần' : 'Tài liệu Word'}</span></label>)}</fieldset>
    <div className="flex justify-end gap-2"><button className="studio-action" onClick={onClose}>Hủy</button><button className="studio-action studio-action-primary" onClick={onConfirm}>{directorySupported ? 'Chọn thư mục và lưu' : 'Lưu file'}</button></div>
  </dialog>;
}
