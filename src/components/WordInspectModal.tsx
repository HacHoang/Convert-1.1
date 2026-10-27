/**
 * Modal tra từ & Thêm Name / Vietphrase tức thì
 * Tính năng cốt lõi đặc trưng của QuickTranslator & TTV Translate
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { inspectChinesePhrase } from '../utils/translatorEngine';
import { NameItem } from '../data/defaultNames';
import { X, Copy, Check } from 'lucide-react';

export const WordInspectModal: React.FC = () => {
  const {
    inspectModal,
    closeInspectModal,
    addName,
    addVietphrase,
    addIgnoredPhrase,
    namesList,
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

      // Tra cứu tự động gợi ý
      const lookup = inspectChinesePhrase(cn, namesList, vietphraseMap);
      let initialVn = inspectModal.initialVietnamese;
      if (!initialVn) {
        if (inspectModal.initialCategory === 'Nhân vật' && lookup.hanviet) {
          initialVn = lookup.hanviet
            .split(/\s+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
        } else {
          initialVn = lookup.suggestedVietnamese;
        }
      }
      setVietnamese(initialVn);
    }
  }, [inspectModal.isOpen, inspectModal.initialChinese, inspectModal.initialVietnamese, inspectModal.initialCategory, namesList, vietphraseMap]);

  if (!inspectModal.isOpen) return null;

  const currentLookup = inspectChinesePhrase(chinese, namesList, vietphraseMap);

  const handleSaveName = () => {
    if (!chinese.trim() || !vietnamese.trim()) return;
    addName(chinese, vietnamese, category, note);
    setSaveSuccess(`Đã lưu "${chinese} = ${vietnamese}" vào Tệp Name!`);
    setTimeout(() => {
      closeInspectModal();
    }, 900);
  };

  const handleSaveVietphrase = () => {
    if (!chinese.trim() || !vietnamese.trim()) return;
    addVietphrase(chinese, vietnamese.toLowerCase());
    setSaveSuccess(`Đã lưu "${chinese} = ${vietnamese.toLowerCase()}" vào Tệp Vietphrase!`);
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
        className="relative w-full max-w-md rounded-xl bg-[#141417] border border-zinc-800/80 text-zinc-100 shadow-2xl p-5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <h3 className="font-medium text-sm text-zinc-100 tracking-tight">
              Tra cứu &amp; Cập nhật từ điển
            </h3>
          </div>
          <button
            onClick={closeInspectModal}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Lookup Quick Preview */}
        <div className="bg-[#09090b] rounded-lg p-3 mb-4 border border-zinc-800/80 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif text-cyan-300 tracking-wide select-all">
              {chinese || 'Chưa nhập chữ'}
            </span>
            <button
              onClick={() => handleCopy(chinese)}
              className="text-xs text-zinc-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              Sao chép
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-zinc-800/60">
            <div>
              <span className="text-zinc-500">Hán Việt: </span>
              <span className="text-zinc-200 font-medium">{currentLookup.hanviet || '—'}</span>
            </div>
            <div>
              <span className="text-zinc-500">Pinyin: </span>
              <span className="text-zinc-300 font-mono">{currentLookup.pinyin || '—'}</span>
            </div>
          </div>

          {currentLookup.existingName && (
            <div className="text-xs text-cyan-400/90 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-800/30">
              Có trong Name: <strong className="text-cyan-200">{currentLookup.existingName}</strong>
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
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Chữ Hán gốc
            </label>
            <input
              type="text"
              value={chinese}
              onChange={(e) => setChinese(e.target.value)}
              placeholder="Nhập chữ Hán..."
              className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Nghĩa / Tên tiếng Việt
            </label>
            <input
              type="text"
              value={vietnamese}
              onChange={(e) => setVietnamese(e.target.value)}
              placeholder="Nhập nghĩa dịch..."
              className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Phân loại Name
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NameItem['category'])}
                className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
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
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Ghi chú (Tùy chọn)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú..."
                className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
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
            className="flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white font-medium py-2 px-2 rounded-lg text-xs transition-colors shadow-xs"
          >
            Lưu vào Name
          </button>

          <button
            onClick={handleSaveVietphrase}
            disabled={!chinese.trim() || !vietnamese.trim()}
            className="flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-zinc-200 font-medium py-2 px-2 rounded-lg text-xs transition-colors border border-zinc-700/60"
          >
            Lưu vào Vietphrase
          </button>

          <button
            onClick={handleSaveIgnored}
            disabled={!chinese.trim()}
            className="flex items-center justify-center bg-zinc-800 hover:bg-amber-900/40 text-zinc-300 hover:text-amber-200 disabled:opacity-40 disabled:hover:bg-zinc-800 font-medium py-2 px-2 rounded-lg text-xs transition-colors border border-zinc-700/60"
          >
            Lưu vào Bỏ qua
          </button>
        </div>
      </div>
    </div>
  );
};
