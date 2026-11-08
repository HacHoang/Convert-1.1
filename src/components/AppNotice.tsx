import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

/** Theme-aware presentation shared by transient and inline notifications. */
export function AppNotice({ children, error = false, onClose, className = '' }: {
  children: React.ReactNode; error?: boolean; onClose?: () => void; className?: string;
}) {
  const Icon = error ? AlertCircle : CheckCircle2;
  return <div role={error ? 'alert' : 'status'} aria-atomic="true" className={`app-notice ${className}`}>
    <Icon size={16} className={`shrink-0 ${error ? 'text-danger' : 'text-accent'}`} />
    <div className="min-w-0 flex-1 break-words">{children}</div>
    {onClose && <button type="button" aria-label="Đóng thông báo" onClick={onClose} className="shrink-0 rounded-md p-1 text-muted hover:bg-hover hover:text-main focus-visible:outline-2 focus-visible:outline-accent"><X size={14} /></button>}
  </div>;
}
