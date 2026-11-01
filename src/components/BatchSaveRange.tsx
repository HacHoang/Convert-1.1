import React, { useState } from 'react';

export function BatchSaveRange({ totalChapters, disabled, onChange }: {
  totalChapters: number; disabled: boolean;
  onChange: (first: number, last: number) => void;
}) {
  const [from, setFrom] = useState(totalChapters ? '1' : '');
  const [to, setTo] = useState(String(totalChapters || ''));
  const update = (nextFrom: string, nextTo: string) => {
    const start = Number(nextFrom), end = Number(nextTo);
    setFrom(nextFrom); setTo(nextTo);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && start <= end && end <= totalChapters) onChange(start, end);
  };
  const inputClass = 'w-[4.5rem] min-w-0 h-8 bg-surface border border-line rounded-lg px-1 py-1 text-xs text-accent font-mono font-semibold focus:outline-none focus:border-accent text-center disabled:opacity-50';
  return <div className="batch-chapter-start min-w-0 flex items-center gap-1.5">
    <label htmlFor="batch-save-from" className="whitespace-nowrap text-muted">Lưu từ:</label>
    <input id="batch-save-from" aria-label="Lưu từ vị trí" type="number" min={1} max={totalChapters} step={1} disabled={disabled || !totalChapters} value={from} onChange={event => { const value = event.target.value; update(value, Number(value) > Number(to) ? value : to); }} className={inputClass} />
    <label htmlFor="batch-save-to" className="text-muted">đến</label>
    <input id="batch-save-to" aria-label="Lưu đến vị trí" type="number" min={1} max={totalChapters} step={1} disabled={disabled || !totalChapters} value={to} onChange={event => { const value = event.target.value; update(Number(value) < Number(from) ? value : from, value); }} className={inputClass} />
  </div>;
}
