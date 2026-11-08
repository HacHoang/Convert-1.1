import React, { useState } from 'react';
import { STYLE_LABELS, resolveTranslationStyle, type TranslationStyleChoice, type TranslationStyle } from '../utils/translationStyle';
import { useBackgroundTasks } from '../context/BackgroundTasks';

export function TranslationStyleSelect({ value, tags, onChange, disabled = false, autoStyle, compact = false }: { value: TranslationStyleChoice; tags: string[]; onChange: (choice: TranslationStyleChoice) => void | boolean | Promise<void | boolean>; disabled?: boolean; autoStyle?: TranslationStyle; compact?: boolean }) {
  const background = useBackgroundTasks();
  const [saving, setSaving] = useState(false);
  const selectedStyle = value === 'auto' ? autoStyle || resolveTranslationStyle(tags) : value;
  const currentLabel = STYLE_LABELS[selectedStyle];
  return <label title={currentLabel} className={compact ? 'relative inline-flex h-8 w-28 shrink-0 items-center justify-between rounded-lg border border-line px-2 text-xs text-main hover:bg-hover focus-within:outline-2 focus-within:outline-accent' : 'flex min-w-0 items-center gap-2 text-xs text-muted'}>
    <span className={compact ? 'min-w-0 truncate' : 'shrink-0'}>{compact ? currentLabel : 'Văn phong'}</span>
    {compact && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>}
    <select aria-label="Văn phong dịch" value={selectedStyle} disabled={disabled || saving} onChange={async event => {
      const choice = event.target.value as TranslationStyle;
      if (choice === selectedStyle) return;
      setSaving(true);
      try { const saved = await onChange(choice); if (saved !== false) background.notify(`Đã đổi văn phong sang ${STYLE_LABELS[choice]}`); }
      catch { background.notify('Không lưu được văn phong. Vui lòng thử lại.', true); }
      finally { setSaving(false); }
    }} title={currentLabel} className={compact ? 'absolute inset-0 h-full w-full cursor-pointer bg-surface text-main opacity-0' : 'min-w-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-main'}>
      {Object.entries(STYLE_LABELS).filter(([key]) => key !== 'auto').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  </label>;
}
