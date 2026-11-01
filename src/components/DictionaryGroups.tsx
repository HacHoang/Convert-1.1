import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Pin, PinOff, X } from 'lucide-react';

export function DictionaryGroups({ value, onChange, counts }: { value: string; onChange: (value: any) => void; counts: Record<string, number | undefined> }) {
  const groups = [
    { name: 'Từ điển', items: [['thieuchuu', 'Thiều Chửu'], ['babylon', 'Babylon'], ['lacviet', 'Lạc Việt']] },
    { name: 'Các file dữ liệu', items: [['vietphrase', 'Vietphrase'], ['names_main', 'Name chính'], ['names_custom', 'Name phụ'], ['phienam', 'Phiên âm Hán Việt'], ['luatnhan', 'Luật nhân'], ['pronouns', 'Đại từ'], ['ignored_chinese', 'Cụm bỏ qua'], ['vietphrase_merged', 'Vietphrase file gộp']] },
  ];
  const [open, setOpen] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!pinned && !root.current?.contains(event.target as Node)) setOpen(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pinned) setOpen(null); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [pinned]);
  const label = groups.flatMap(group => group.items).find(([id]) => id === value)?.[1];
  return <div ref={root} className="relative shrink-0 border-b border-line bg-surface px-3 py-2">
    <div className="flex items-center gap-2">
      {groups.map((group, index) => <button key={group.name} aria-expanded={open === index} aria-controls="dictionary-group-menu" onClick={() => setOpen(open === index ? null : index)} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs ${group.items.some(([id]) => id === value) ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line text-muted hover:bg-raised'}`}>{group.name}<ChevronDown size={13} /></button>)}
      <span className="min-w-0 flex-1 truncate text-right text-xs text-muted" title={label}>{label}</span>
    </div>
    {open !== null && <div id="dictionary-group-menu" aria-label={groups[open].name} className={`${pinned ? 'mt-2' : 'absolute inset-x-3 top-full z-30 mt-1 shadow-xl'} overflow-hidden rounded-xl border border-line bg-surface`}>
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs"><span className="font-medium">{groups[open].name}</span><div className="flex items-center gap-2"><button aria-label={pinned ? 'Bỏ ghim danh sách' : 'Ghim danh sách'} aria-pressed={pinned} onClick={() => setPinned(!pinned)} className="rounded p-1 text-muted hover:bg-raised">{pinned ? <PinOff size={14} /> : <Pin size={14} />}</button><button aria-label="Đóng danh sách file" onClick={() => setOpen(null)} className="rounded p-1 text-muted hover:bg-raised"><X size={14} /></button></div></div>
      <div className="grid max-h-[35dvh] grid-cols-2 gap-1 overflow-y-auto p-2 @min-[768px]/app:grid-cols-3">{groups[open].items.map(([id, text]) => <button key={id} aria-pressed={value === id} onClick={() => { onChange(id); if (!pinned) setOpen(null); }} className={`flex min-w-0 items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${value === id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-raised'}`}><span>{text}</span><span className="text-[10px] tabular-nums opacity-60">{counts[id]?.toLocaleString() ?? '…'}</span></button>)}</div>
    </div>}
  </div>;
}
