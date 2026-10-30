import React, { useEffect, useState } from 'react';
import { STYLE_LABELS, resolveTranslationStyle, type TranslationStyleChoice, type TranslationStyle } from '../utils/translationStyle';

export function TranslationStyleSelect({ value, tags, onChange, disabled = false, autoStyle, compact = false }: { value: TranslationStyleChoice; tags: string[]; onChange: (choice: TranslationStyleChoice) => void | boolean | Promise<void | boolean>; disabled?: boolean; autoStyle?: TranslationStyle; compact?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 2500); return () => clearTimeout(timer); }, [notice]);
  const selectedStyle = value === 'auto' ? autoStyle || resolveTranslationStyle(tags) : value;
  const currentLabel = STYLE_LABELS[selectedStyle];
  return <label title={currentLabel} className={compact ? 'relative inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line px-2 text-xs text-main hover:bg-hover focus-within:outline-2 focus-within:outline-accent' : 'flex min-w-0 items-center gap-2 text-xs text-muted'}>
    <span className="shrink-0">{compact ? currentLabel : 'Văn phong'}</span>
    {compact && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>}
    <select aria-label="Văn phong dịch" value={selectedStyle} disabled={disabled || saving} onChange={async event => {
      const choice = event.target.value as TranslationStyle;
      if (choice === selectedStyle) return;
      setSaving(true); setNotice(null);
      try { const saved = await onChange(choice); if (saved !== false) setNotice({ text: `Đã đổi văn phong sang ${STYLE_LABELS[choice]}` }); }
      catch { setNotice({ text: 'Không lưu được văn phong. Vui lòng thử lại.', error: true }); }
      finally { setSaving(false); }
    }} title={currentLabel} className={compact ? 'absolute inset-0 h-full w-full cursor-pointer bg-surface text-main opacity-0' : 'min-w-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-main'}>
      {Object.entries(STYLE_LABELS).filter(([key]) => key !== 'auto').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
    {notice && <span role={notice.error ? 'alert' : 'status'} className="pointer-events-none fixed bottom-5 left-1/2 z-[100] w-max max-w-[90vw] -translate-x-1/2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-main shadow-xl">{notice.text}</span>}
  </label>;
}
