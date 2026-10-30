import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function BatchSaveMenu({ disabled, onLibrary, onComputer }: {
  disabled: boolean; onLibrary: () => void; onComputer: (format: 'txt' | 'docx') => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), computer = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [submenu, setSubmenu] = useState(false);
  const close = () => { setPosition(null); setSubmenu(false); };
  const open = () => {
    if (disabled) return;
    const rect = trigger.current!.getBoundingClientRect();
    setPosition({ top: Math.min(rect.bottom + 4, window.innerHeight - 120), left: Math.max(8, Math.min(rect.left, window.innerWidth - 268)) });
  };
  useEffect(() => {
    if (!position) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', close); window.addEventListener('wheel', scroll, { passive: true }); window.addEventListener('touchmove', scroll, { passive: true });
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); window.removeEventListener('wheel', scroll); window.removeEventListener('touchmove', scroll); };
  }, [position]);
  useEffect(() => { if (disabled) close(); }, [disabled]);
  const item = 'flex min-h-9 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs text-main hover:bg-hover focus:bg-hover focus:outline-none';
  return <>
    <button ref={trigger} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={!!position} aria-label="Lưu bản dịch" className="studio-action h-8" onClick={() => { if (position) close(); else { open(); requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()); } }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); open(); requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()); } }}>Lưu vào…<ChevronDown size={13} /></button>
    {position && createPortal(<div ref={menu} role="menu" aria-label="Lưu bản dịch" style={position} className="fixed z-[100] w-40 rounded-lg border border-line bg-surface p-1 shadow-xl" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); trigger.current?.focus(); }
      if (event.key === 'Tab') close();
      if (event.key === 'ArrowRight' && document.activeElement === computer.current) { event.preventDefault(); setSubmenu(true); requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('[aria-label="Định dạng lưu vào máy"] button')?.focus()); }
      if (event.key === 'ArrowLeft' && submenu) { event.preventDefault(); setSubmenu(false); computer.current?.focus(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const parent = (event.target as HTMLElement).closest('[role="menu"]'); const items = Array.from(parent?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []).filter(el => el.closest('[role="menu"]') === parent); const index = items.indexOf(document.activeElement as HTMLButtonElement); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
    }}>
      <button role="menuitem" type="button" className={item} onMouseEnter={() => setSubmenu(false)} onClick={() => { close(); onLibrary(); }}>Lưu vào thư viện</button>
      <div className="relative" onMouseEnter={() => setSubmenu(true)} onMouseLeave={() => setSubmenu(false)}>
        <button ref={computer} role="menuitem" type="button" aria-haspopup="menu" aria-expanded={submenu} className={item} onClick={() => setSubmenu(true)}>Lưu vào máy<ChevronRight size={14} /></button>
        {submenu && <div role="menu" aria-label="Định dạng lưu vào máy" className="absolute -top-1 left-[calc(100%-2px)] w-24 rounded-lg border border-line bg-surface p-1 shadow-xl">{(['txt', 'docx'] as const).map(format => <button key={format} role="menuitem" type="button" className={item} onClick={() => { close(); onComputer(format); }}>.{format}</button>)}</div>}
      </div>
    </div>, document.body)}
  </>;
}
