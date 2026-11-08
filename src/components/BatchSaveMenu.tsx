import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ChapterExportFormat } from '../utils/chapterFileNames';

type Submenu = 'library' | 'computer' | null;

export function BatchSaveMenu({ disabled, libraryFields, onLibrary, onComputer }: {
  disabled: boolean;
  libraryFields: React.ReactNode;
  onLibrary: () => void;
  onComputer: (format: ChapterExportFormat) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; stacked: boolean; flip: boolean } | null>(null);
  const [submenu, setSubmenu] = useState<Submenu>(null);
  const close = () => { setPosition(null); setSubmenu(null); };
  const open = () => {
    if (disabled || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    // The app can be shown in a narrow phone frame inside a desktop browser.
    // Anchor to the toolbar's actual bounds, not the browser window's width.
    const toolbarRect = trigger.current.closest('[data-batch-toolbar="settings"]')?.getBoundingClientRect();
    const viewportLeft = toolbarRect?.left ?? 0;
    const viewportRight = toolbarRect?.right ?? window.innerWidth;
    const stacked = (toolbarRect?.width ?? window.innerWidth) < 560;
    const menuWidth = 208;
    const libraryWidth = 208;
    const flip = !stacked && rect.left + menuWidth + libraryWidth > viewportRight - 8;
    const left = stacked
      ? Math.max(viewportLeft + 8, Math.min(rect.right - libraryWidth, viewportRight - libraryWidth - 8))
      : Math.max(viewportLeft + 8, Math.min(rect.left, viewportRight - menuWidth - 8));
    const requiredHeight = stacked ? 240 : 180;
    setPosition({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - requiredHeight)), left, stacked, flip });
  };

  useEffect(() => {
    if (!position) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [position]);
  useEffect(() => { if (disabled) close(); }, [disabled]);

  const item = 'flex min-h-9 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs text-main hover:bg-hover focus:bg-hover focus:outline-none';
  return <>
    <button ref={trigger} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={!!position} aria-label="Lưu bản dịch" className="studio-action h-8" onClick={() => { if (position) close(); else open(); }}>Lưu vào…<ChevronDown size={13} /></button>
    {position && createPortal(<div ref={menu} role="menu" aria-label="Lưu bản dịch" style={position} className="fixed z-[100] w-52 rounded-lg border border-line bg-surface p-1 shadow-xl" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); trigger.current?.focus(); } if (event.key === 'Tab') close(); }}>
      <div className="relative">
        <button role="menuitem" type="button" aria-haspopup="menu" aria-expanded={submenu === 'library'} className={item} onClick={() => setSubmenu(current => current === 'library' ? null : 'library')}>Lưu vào thư viện{submenu === 'library' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
        {submenu === 'library' && <div role="menu" aria-label="Tùy chọn lưu vào thư viện" className={`absolute z-10 w-52 rounded-lg border border-line bg-surface p-2 shadow-xl ${position.stacked ? '-left-[5px] top-[calc(100%+4px)]' : position.flip ? '-top-1 right-[calc(100%-2px)]' : '-top-1 left-[calc(100%-2px)]'}`}>
          <div className="space-y-2">{libraryFields}</div>
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" className="rounded-md px-3 py-2 text-xs text-muted hover:bg-hover hover:text-main" onClick={close}>Huỷ</button>
            <button role="menuitem" type="button" className="rounded-md border border-line bg-raised px-3 py-2 text-xs font-medium text-main hover:bg-hover" onClick={() => { close(); onLibrary(); }}>Lưu</button>
          </div>
        </div>}
      </div>
      <div className="relative">
        <button role="menuitem" type="button" aria-haspopup="menu" aria-expanded={submenu === 'computer'} className={item} onClick={() => setSubmenu(current => current === 'computer' ? null : 'computer')}>Lưu vào máy{submenu === 'computer' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
        {submenu === 'computer' && <div role="menu" aria-label="Định dạng lưu vào máy" className={`absolute w-28 rounded-lg border border-line bg-surface p-1 shadow-xl ${position.stacked ? 'right-0 top-[calc(100%+4px)]' : position.flip ? '-top-1 right-[calc(100%-2px)]' : '-top-1 left-[calc(100%-2px)]'}`}>{(['txt', 'docx', 'epub', 'pdf'] as const).map(format => <button key={format} role="menuitem" type="button" className={item} onClick={() => { close(); onComputer(format); }}>.{format}</button>)}</div>}
      </div>
    </div>, document.body)}
  </>;
}
