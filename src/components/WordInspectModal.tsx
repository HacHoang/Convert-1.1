/**
 * Modal tra từ & Thêm Name / Vietphrase tức thì
 * Tính năng cốt lõi đặc trưng của QuickTranslator & TTV Translate
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { inspectChinesePhrase } from '../utils/translatorEngine';
import { NameItem } from '../data/defaultNames';
import { X, BookmarkPlus, BookOpen, Copy, Check } from 'lucide-react';

export const WordInspectModal: React.FC = () => {
  const {
    inspectModal,
    closeInspectModal,
    addName,
    addVietphrase,
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
      setVietnamese(inspectModal.initialVietnamese || lookup.suggestedVietnamese);
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-100 shadow-2xl p-5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <h3 className="font-semibold text-base text-neutral-100 tracking-tight">
              Tra Cứu &amp; Cập Nhật Từ Điển
            </h3>
          </div>
          <button
            onClick={closeInspectModal}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Lookup Quick Preview */}
        <div className="bg-neutral-950/80 rounded-xl p-3 mb-4 border border-neutral-800/80 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif text-cyan-300 tracking-wide select-all">
              {chinese || 'Chưa nhập chữ'}
            </span>
            <button
              onClick={() => handleCopy(chinese)}
              className="text-xs text-neutral-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              Sao chép
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-neutral-800/60">
            <div>
              <span className="text-neutral-500">Hán Việt: </span>
              <span className="text-neutral-200 font-medium">{currentLookup.hanviet || '—'}</span>
            </div>
            <div>
              <span className="text-neutral-500">Pinyin: </span>
              <span className="text-neutral-300 font-mono">{currentLookup.pinyin || '—'}</span>
            </div>
          </div>

          {currentLookup.existingName && (
            <div className="text-xs text-cyan-400/90 bg-cyan-950/30 px-2 py-1 rounded-md border border-cyan-800/30">
              Đang có trong Tệp Name: <strong className="text-cyan-200">{currentLookup.existingName}</strong>
            </div>
          )}
          {currentLookup.existingVp && !currentLookup.existingName && (
            <div className="text-xs text-amber-400/90 bg-amber-950/30 px-2 py-1 rounded-md border border-amber-800/30">
              Đang có trong Vietphrase: <strong className="text-amber-200">{currentLookup.existingVp}</strong>
            </div>
          )}
        </div>

        {/* Input Fields */}
        <div className="space-y-3.5 mb-5">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Chữ Hán gốc (Chinese)
            </label>
            <input
              type="text"
              value={chinese}
              onChange={(e) => setChinese(e.target.value)}
              placeholder="Ví dụ: 萧炎, 乌坦城, 斗尊..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Nghĩa / Tên tiếng Việt
            </label>
            <input
              type="text"
              value={vietnamese}
              onChange={(e) => setVietnamese(e.target.value)}
              placeholder="Ví dụ: Tiêu Viêm, Ô Thản Thành, Đấu Tôn..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Phân loại Name
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NameItem['category'])}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="Nhân vật">Nhân vật (Tiêu Viêm, Dược Lão)</option>
                <option value="Địa danh">Địa danh (Ô Thản Thành)</option>
                <option value="Tông môn">Tông môn (Vân Lam Tông)</option>
                <option value="Binh khí">Binh khí (Huyền Trọng Thước)</option>
                <option value="Công pháp">Công pháp (Phần Quyết)</option>
                <option value="Khác">Khác / Danh xưng</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Ghi chú thêm (Tùy chọn)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Đấu Phá Thương Khung"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-4 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg p-2.5 flex items-center gap-2">
            <Check size={14} className="shrink-0" />
            {saveSuccess}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSaveName}
            disabled={!chinese.trim() || !vietnamese.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium py-2.5 px-3 rounded-xl text-xs transition-colors shadow-sm"
          >
            <BookmarkPlus size={15} />
            Lưu vào Name (Ưu tiên)
          </button>

          <button
            onClick={handleSaveVietphrase}
            disabled={!chinese.trim() || !vietnamese.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 font-medium py-2.5 px-3 rounded-xl text-xs transition-colors border border-neutral-700"
          >
            <BookOpen size={15} />
            Lưu vào Vietphrase
          </button>
        </div>
      </div>
    </div>
  );
};
