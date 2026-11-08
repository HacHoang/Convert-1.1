import React, { useEffect, useState } from 'react';
import { Check, Copy, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NameItem } from '../data/defaultNames';
import { inspectChinesePhrase } from '../utils/translatorEngine';
import { styleNameDictionary } from '../utils/translationStyle';
import { useBackgroundTasks } from '../context/BackgroundTasks';

const capitalizeName = (value: string) => value.replace(/\p{L}[\p{L}\p{M}]*/gu, word => word.charAt(0).toLocaleUpperCase('vi') + word.slice(1));

export const WordInspectModal: React.FC = () => {
  const app = useApp();
  const background = useBackgroundTasks();
  const { inspectModal, namesList, namesMainMap, phienAmMap, vietphraseMap } = app;
  const [chinese, setChinese] = useState('');
  const [vietnamese, setVietnamese] = useState('');
  const [category, setCategory] = useState<NameItem['category']>('Nhân vật');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const target = inspectModal.target || 'name';
  const originalChinese = inspectModal.initialChinese.trim();
  const targetLabel = target === 'name_main' ? 'Name chính' : target === 'name' ? 'Name phụ' : 'VietPhrase';

  const suggestedValue = (key: string, includeInitial = false) => {
    const lookup = inspectChinesePhrase(key, namesList, vietphraseMap, { namesMainMap, customPhienAm: phienAmMap });
    const initial = includeInitial ? inspectModal.initialVietnamese : '';
    if (target === 'name_main') return capitalizeName(namesMainMap[key] || initial || styleNameDictionary(inspectModal.style || 'neutral')[key] || lookup.hanviet);
    if (target === 'name') return capitalizeName(namesList.find(item => item.chinese === key)?.vietnamese || initial || lookup.hanviet);
    return vietphraseMap[key] || initial || lookup.hanviet;
  };

  useEffect(() => {
    if (!inspectModal.isOpen) return;
    setChinese(originalChinese);
    setVietnamese(suggestedValue(originalChinese, true));
    setCategory(inspectModal.initialCategory || 'Nhân vật');
    setNote('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectModal.isOpen, inspectModal.initialChinese, inspectModal.initialVietnamese, inspectModal.initialCategory, inspectModal.target, inspectModal.style]);

  if (!inspectModal.isOpen) return null;
  const cleanChinese = chinese.trim();
  const lookup = inspectChinesePhrase(cleanChinese, namesList, vietphraseMap, { namesMainMap, customPhienAm: phienAmMap });
  const hasTargetEntry = target === 'name_main'
    ? Object.hasOwn(namesMainMap, originalChinese)
    : target === 'name'
      ? namesList.some(item => item.chinese === originalChinese)
      : Object.hasOwn(vietphraseMap, originalChinese);

  const removeOriginal = () => {
    if (target === 'name_main') app.deleteNameMain(originalChinese);
    else if (target === 'name') namesList.filter(item => item.chinese === originalChinese).forEach(item => app.deleteName(item.id));
    else app.deleteVietphrase(originalChinese);
  };

  const handleSave = () => {
    if (!cleanChinese || !vietnamese.trim()) return;
    if (originalChinese && originalChinese !== cleanChinese) removeOriginal();
    const saved = target === 'vietphrase' ? vietnamese.trim().toLowerCase() : capitalizeName(vietnamese.trim());
    if (target === 'name_main') app.addNameMain(cleanChinese, saved);
    else if (target === 'name') app.addName(cleanChinese, saved, category, note);
    else app.addVietphrase(cleanChinese, saved);
    background.notify(`${hasTargetEntry ? 'Đã cập nhật' : 'Đã lưu'} “${cleanChinese} = ${saved}” vào ${targetLabel}.`);
    setTimeout(app.closeInspectModal, 700);
  };

  const handleDelete = () => {
    if (!hasTargetEntry || !window.confirm(`Xóa “${originalChinese}” khỏi ${targetLabel}?`)) return;
    removeOriginal();
    app.closeInspectModal();
  };

  const handleChineseChange = (value: string) => {
    setChinese(value);
    setVietnamese(suggestedValue(value.trim()));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(chinese);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      app.closeInspectModal();
      return;
    }
    const activeElement = event.target as HTMLElement;
    const isTextControl = activeElement.matches('input, textarea, select');
    const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!arrows.includes(event.key) || isTextControl) return;

    const actions = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-dialog-action]:not(:disabled)'));
    if (!actions.length) return;
    event.preventDefault();
    const currentIndex = actions.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const nextIndex = currentIndex < 0
      ? (step > 0 ? 0 : actions.length - 1)
      : (currentIndex + step + actions.length) % actions.length;
    actions[nextIndex].focus();
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
    <div className="relative w-full max-w-md rounded-xl bg-surface border border-line/80 text-main shadow-2xl p-5 overflow-hidden" onClick={event => event.stopPropagation()} onKeyDown={handleDialogKeyDown}>
      <div className="flex items-center justify-between pb-3 border-b border-line/80 mb-4">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent-soft" /><h3 className="font-medium text-sm">Chỉnh sửa {targetLabel}</h3></div>
        <button onClick={app.closeInspectModal} aria-label="Đóng" className="p-1 rounded-lg text-muted hover:text-main hover:bg-raised"><X size={16} /></button>
      </div>
      <div className="bg-surface rounded-lg p-3 mb-4 border border-line/80 space-y-2">
        <div className="flex items-baseline justify-between"><span className="text-2xl font-reading text-accent tracking-wide select-all">{chinese || 'Chưa nhập chữ'}</span><button onClick={handleCopy} className="text-xs text-muted hover:text-accent flex items-center gap-1">{copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}Sao chép</button></div>
        <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-line/60"><div><span className="text-muted">Hán Việt: </span><span className="font-medium">{lookup.hanviet || '—'}</span></div><div><span className="text-muted">Pinyin: </span><span className="font-mono">{lookup.pinyin || '—'}</span></div></div>
      </div>
      <div className="space-y-3 mb-4">
        <div><label className="block text-xs font-medium text-muted mb-1">Chữ Hán gốc</label><input value={chinese} onChange={event => handleChineseChange(event.target.value)} placeholder="Nhập chữ Hán..." className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent" /></div>
        <div><label className="block text-xs font-medium text-muted mb-1">{targetLabel}</label><input value={vietnamese} onChange={event => setVietnamese(target === 'vietphrase' ? event.target.value : capitalizeName(event.target.value))} placeholder={`Nhập ${targetLabel}...`} className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent font-medium" /></div>
        {(target === 'name' || target === 'name_main') && <div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-medium text-muted mb-1">Phân loại Name</label><select value={category} onChange={event => setCategory(event.target.value as NameItem['category'])} className="w-full bg-surface border border-line rounded-lg px-2.5 py-2 text-xs"><option>Nhân vật</option><option>Địa danh</option><option>Tông môn</option><option>Binh khí</option><option>Công pháp</option><option value="Khác">Khác / Danh xưng</option></select></div><div><label className="block text-xs font-medium text-muted mb-1">Ghi chú (Tùy chọn)</label><input value={note} onChange={event => setNote(event.target.value)} placeholder="Ghi chú..." className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs" /></div></div>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button data-dialog-action onClick={app.closeInspectModal} className="bg-raised hover:bg-hover text-main font-medium py-2 px-2 rounded-lg text-xs border border-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Hủy</button>
        <button data-dialog-action onClick={handleDelete} disabled={!hasTargetEntry} className="flex items-center justify-center gap-1 bg-raised hover:bg-red-950/50 text-red-300 disabled:opacity-40 font-medium py-2 px-2 rounded-lg text-xs border border-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Trash2 size={13} />Xóa</button>
        <button data-dialog-action autoFocus onClick={handleSave} disabled={!cleanChinese || !vietnamese.trim()} className="bg-accent disabled:opacity-40 text-main font-medium py-2 px-2 rounded-lg text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface">{hasTargetEntry ? `Cập nhật ${targetLabel}` : `Lưu ${targetLabel}`}</button>
      </div>
    </div>
  </div>;
};
