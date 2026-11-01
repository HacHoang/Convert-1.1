import React, { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { SAVED_WEB_ACCEPT } from '../utils/savedWebFile';

export function SavedWebFilePicker({ label, disabled, onSelect }: { label: string; disabled?: boolean; onSelect: (file: File) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  return <div className="min-w-0 space-y-1.5">
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" aria-label={`Chọn ${label}`} disabled={disabled || reading} onClick={() => input.current?.click()} className="studio-action shrink-0">
        {reading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{reading ? 'Đang đọc…' : 'Chọn tệp'}
      </button>
      <span title={name || undefined} className="min-w-0 truncate text-xs text-muted">{name || 'Chưa chọn tệp HTML / MHTML'}</span>
      <input ref={input} aria-label={label} type="file" accept={SAVED_WEB_ACCEPT} disabled={disabled || reading} className="hidden" onChange={async event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        setName(file.name); setReading(true); setError('');
        try { await onSelect(file); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không đọc được tệp.'); }
        finally { setReading(false); }
      }} />
    </div>
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
  </div>;
}
