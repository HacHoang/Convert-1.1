import { styleNameDictionary } from '../utils/translationStyle';
/**
 * Modal tra từ & Thêm Name / Vietphrase tức thì
 * Tính năng cốt lõi đặc trưng của QuickTranslator & Convert
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { inspectChinesePhrase } from '../utils/translatorEngine';
import { NameItem } from '../data/defaultNames';
import { X, Copy, Check } from 'lucide-react';
import { DEFAULT_VIETPHRASE } from '../data/vietphraseData';

const capitalizeName = (value: string) => value.replace(/\p{L}[\p{L}\p{M}]*/gu, word => word.charAt(0).toLocaleUpperCase('vi') + word.slice(1));

export const WordInspectModal: React.FC = () => {
  const {
    inspectModal,
    closeInspectModal,
    addName,
    addVietphrase,
    addIgnoredPhrase,
    namesList,
    namesMainMap,
    vietphraseMap,
  } = useApp();

  const [chinese, setChinese] = useState('');
  const [vietnamese, setVietnamese] = useState('');
  const [category, setCategory] = useState<NameItem['category']>('Nhân vật');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (inspectModal.isOpen) {
      const cn = inspectModal.initialChinese.trim();
      setChinese(cn);
      setCategory(inspectModal.initialCategory || 'Nhân vật');
      setNote('');
      setSaveSuccess(null);

      const lookup = inspectChinesePhrase(cn, namesList, vietphraseMap);
      const styleName = styleNameDictionary(inspectModal.style || 'neutral')[cn];
      const initialVn = inspectModal.target === 'name'
        ? capitalizeName(lookup.existingName || styleName || namesMainMap[cn] || lookup.hanviet)
        : (lookup.existingVp ?? inspectModal.initialVietnamese ?? lookup.hanviet);
      setVietnamese(initialVn);
    }
  }, [inspectModal.isOpen, inspectModal.initialChinese, inspectModal.initialVietnamese, inspectModal.initialCategory, inspectModal.target, inspectModal.style, namesList, namesMainMap, vietphraseMap]);

  if (!inspectModal.isOpen) return null;

  const currentLookup = inspectChinesePhrase(chinese, namesList, vietphraseMap);

  const existingStyleName = styleNameDictionary(inspectModal.style || 'neutral')[chinese.trim()];
  const hasName = currentLookup.existingName !== null || Object.hasOwn(namesMainMap, chinese.trim()) || Boolean(existingStyleName);
  const hasVietphrase = Object.hasOwn(vietphraseMap, chinese.trim()) || Object.hasOwn(DEFAULT_VIETPHRASE, chinese.trim());

  const handleChineseChange = (value: string) => {
    setChinese(value);
    const key = value.trim();
    const lookup = inspectChinesePhrase(key, namesList, vietphraseMap);
    setVietnamese(inspectModal.target === 'name'
      ? capitalizeName(lookup.existingName || styleNameDictionary(inspectModal.style || 'neutral')[key] || namesMainMap[key] || lookup.hanviet)
      : lookup.existingVp ?? lookup.hanviet);
  };

  const handleSaveName = () => {
    if (!chinese.trim() || !vietnamese.trim()) return;
    const name = capitalizeName(vietnamese.trim());
    setVietnamese(name);
    addName(chinese, name, category, note);
    setSaveSuccess(`${hasName ? 'Đã cập nhật' : 'Đã lưu'} "${chinese} = ${name}" vào Tệp Name!`);
    setTimeout(() => {
      closeInspectModal();
    }, 900);
  };

  const handleSaveVietphrase = () => {
    if (!chinese.trim() || !vietnamese.trim()) return;
    addVietphrase(chinese, vietnamese.toLowerCase());
    setSaveSuccess(`${hasVietphrase ? 'Đã cập nhật' : 'Đã lưu'} "${chinese} = ${vietnamese.toLowerCase()}" vào Tệp Vietphrase!`);
    setTimeout(() => {
      closeInspectModal();
    }, 900);
  };

  const handleSaveIgnored = () => {
    if (!chinese.trim()) return;
    addIgnoredPhrase(chinese.trim());
    setSaveSuccess(`Đã lưu "${chinese.trim()}" vào tệp Bỏ qua (IgnoreChinesephrase.txt)!`);
    setTimeout(() => {
      closeInspectModal();
    }, 900);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md rounded-xl bg-surface border border-line/80 text-main shadow-2xl p-5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line/80 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-soft"></span>
            <h3 className="font-medium text-sm text-main tracking-tight">
              Tra cứu &amp; Cập nhật từ điển
            </h3>
          </div>
          <button
            onClick={closeInspectModal}
            className="p-1 rounded-lg text-muted hover:text-main hover:bg-raised transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Lookup Quick Preview */}
        <div className="bg-surface rounded-lg p-3 mb-4 border border-line/80 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif text-accent tracking-wide select-all">
              {chinese || 'Chưa nhập chữ'}
            </span>
            <button
              onClick={() => handleCopy(chinese)}
              className="text-xs text-muted hover:text-accent flex items-center gap-1 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              Sao chép
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-line/60">
            <div>
              <span className="text-muted">Hán Việt: </span>
              <span className="text-main font-medium">{currentLookup.hanviet || '—'}</span>
            </div>
            <div>
              <span className="text-muted">Pinyin: </span>
              <span className="text-main font-mono">{currentLookup.pinyin || '—'}</span>
            </div>
          </div>

          {currentLookup.existingName && (
            <div className="text-xs text-accent/90 bg-accent-soft/30 px-2 py-1 rounded border border-accent/30">
              Có trong Name: <strong className="text-accent">{currentLookup.existingName}</strong>
            </div>
          )}
          {currentLookup.existingVp && !currentLookup.existingName && (
            <div className="text-xs text-amber-400/90 bg-amber-950/30 px-2 py-1 rounded border border-amber-800/30">
              Có trong Vietphrase: <strong className="text-amber-200">{currentLookup.existingVp}</strong>
            </div>
          )}
        </div>

        {/* Input Fields */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Chữ Hán gốc
            </label>
            <input
              type="text"
              value={chinese}
              onChange={(e) => handleChineseChange(e.target.value)}
              placeholder="Nhập chữ Hán..."
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-main placeholder-subtle focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              {inspectModal.target === 'vietphrase' ? 'Vietphrase' : 'Name'}
            </label>
            <input
              type="text"
              value={vietnamese}
              onChange={(e) => setVietnamese(inspectModal.target === 'name' ? capitalizeName(e.target.value) : e.target.value)}
              placeholder={inspectModal.target === 'vietphrase' ? 'Nhập Vietphrase...' : 'Nhập Name...'}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-main placeholder-subtle focus:outline-none focus:border-accent font-medium"
            />
            {inspectModal.target === 'name' && inspectModal.style === 'western' && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                Văn phong phương Tây ưu tiên tên tiếng Anh đã có trong từ điển. Name bạn lưu được ưu tiên hơn gợi ý tự động.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Phân loại Name
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NameItem['category'])}
                className="w-full bg-surface border border-line rounded-lg px-2.5 py-2 text-xs text-main focus:outline-none focus:border-accent"
              >
                <option value="Nhân vật">Nhân vật</option>
                <option value="Địa danh">Địa danh</option>
                <option value="Tông môn">Tông môn</option>
                <option value="Binh khí">Binh khí</option>
                <option value="Công pháp">Công pháp</option>
                <option value="Khác">Khác / Danh xưng</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Ghi chú (Tùy chọn)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú..."
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-main placeholder-subtle focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-3 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg p-2 flex items-center gap-2">
            <Check size={14} className="shrink-0" />
            {saveSuccess}
          </div>
        )}

        {/* Action Buttons: 3 nút ngang đều nhau trên 1 hàng, không có biểu tượng ký hiệu */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleSaveName}
            disabled={!chinese.trim() || !vietnamese.trim()}
            className="flex items-center justify-center bg-accent hover:bg-accent disabled:opacity-40 disabled:hover:bg-accent text-main font-medium py-2 px-2 rounded-lg text-xs transition-colors shadow-xs"
          >
            {hasName ? 'Cập nhật Name' : 'Lưu vào Name'}
          </button>

          <button
            onClick={handleSaveVietphrase}
            disabled={!chinese.trim() || !vietnamese.trim()}
            className="flex items-center justify-center bg-raised hover:bg-hover disabled:opacity-40 disabled:hover:bg-raised text-main font-medium py-2 px-2 rounded-lg text-xs transition-colors border border-line/60"
          >
            {hasVietphrase ? 'Cập nhật Vietphrase' : 'Lưu vào Vietphrase'}
          </button>

          <button
            onClick={handleSaveIgnored}
            disabled={!chinese.trim()}
            className="flex items-center justify-center bg-raised hover:bg-amber-900/40 text-main hover:text-amber-200 disabled:opacity-40 disabled:hover:bg-raised font-medium py-2 px-2 rounded-lg text-xs transition-colors border border-line/60"
          >
            Lưu vào Bỏ qua
          </button>
        </div>
      </div>
    </div>
  );
};
