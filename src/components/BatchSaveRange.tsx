import React, { useState } from 'react';

export function BatchSaveRange({ numbers, disabled, onChange }: {
  numbers: number[]; disabled: boolean;
  onChange: (first: number, last: number) => void;
}) {
  const options = [...new Set(numbers)].sort((a, b) => a - b);
  const [from, setFrom] = useState(String(options[0] ?? ''));
  const [to, setTo] = useState(String(options.at(-1) ?? ''));
  const update = (nextFrom: string, nextTo: string) => {
    const start = Number(nextFrom), end = Number(nextTo);
    if (!options.includes(start) || !options.includes(end)) return;
    setFrom(nextFrom); setTo(nextTo);
    onChange(start, end);
  };
  const inputClass = 'w-[4.5rem] min-w-0 h-8 bg-surface border border-line rounded-lg px-1 py-1 text-xs text-accent font-mono font-semibold focus:outline-none focus:border-accent text-center disabled:opacity-50';
  return <div className="batch-chapter-start min-w-0 flex items-center gap-1.5">
    <label htmlFor="batch-save-from" className="whitespace-nowrap text-muted">Lưu từ:</label>
    <select id="batch-save-from" aria-label="L?u t? ch??ng" disabled={disabled || !options.length} value={from} onChange={event => { const value = event.target.value; update(value, Number(value) > Number(to) ? value : to); }} className={inputClass}>
      {options.map(number => <option key={number} value={number}>{number}</option>)}
    </select>
    <label htmlFor="batch-save-to" className="text-muted">đến</label>
    <select id="batch-save-to" aria-label="L?u ??n ch??ng" disabled={disabled || !options.length} value={to} onChange={event => { const value = event.target.value; update(Number(value) < Number(from) ? value : from, value); }} className={inputClass}>
      {options.map(number => <option key={number} value={number}>{number}</option>)}
    </select>
  </div>;
}
