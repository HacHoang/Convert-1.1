/**
 * Tab Cài Đặt (Settings View)
 * Tùy biến hiển thị, phông chữ, quy tắc dịch, giọng đọc TTS và thông báo loại bỏ đăng nhập.
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { speechService } from '../../utils/speechEngine';
import { 
  Volume2, 
  HardDrive, 
  Sparkles, 
  RotateCcw,
  Check,
  Download,
  Upload
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    namesList, 
    vietphraseMap, 
    savedChapters,
    resetDictionaries 
  } = useApp();

  const [testSpeechPlaying, setTestSpeechPlaying] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);

  const handleTestTTS = () => {
    if (testSpeechPlaying) {
      speechService.stop();
      setTestSpeechPlaying(false);
      return;
    }
    const sampleText = 'Xin chào, đây là giọng đọc thử nghiệm của ứng dụng TTV Translate.';
    setTestSpeechPlaying(true);
    speechService.speak(sampleText, settings.ttsRate, settings.ttsPitch, {
      onEnd: () => setTestSpeechPlaying(false),
      onError: () => setTestSpeechPlaying(false),
    });
  };

  const handleExportFullBackup = () => {
    const backupData = {
      app: 'TTV Translate',
      version: '2.6-offline',
      exportedAt: new Date().toISOString(),
      namesList,
      vietphraseMap,
      savedChapters,
      settings,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ttv_translate_backup_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupSuccess(true);
    setTimeout(() => setBackupSuccess(false), 2000);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.namesList) localStorage.setItem('ttv_names_list', JSON.stringify(json.namesList));
        if (json.vietphraseMap) localStorage.setItem('ttv_user_vietphrase', JSON.stringify(json.vietphraseMap));
        if (json.savedChapters) localStorage.setItem('ttv_saved_chapters', JSON.stringify(json.savedChapters));
        if (json.settings) localStorage.setItem('ttv_settings', JSON.stringify(json.settings));
        alert('Khôi phục dữ liệu thành công! Trang sẽ được làm mới.');
        window.location.reload();
      } catch (err) {
        alert('Tệp sao lưu không hợp lệ.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-950 text-neutral-100 p-4 sm:p-6 space-y-6">
      {/* Quy tắc dịch & Engine */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3.5">
        <div className="flex items-center gap-2 text-neutral-200 font-semibold text-sm">
          <Sparkles size={16} className="text-cyan-400" />
          <span>Quy Tắc Dịch Thuật</span>
        </div>

        <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/60">
          <div>
            <span className="text-xs font-medium text-neutral-200 block">Ưu tiên Tệp Name trước Vietphrase</span>
            <span className="text-[11px] text-neutral-500">Giữ chuẩn tên nhân vật, môn phái, địa danh khi có sự trùng lặp</span>
          </div>
          <input
            type="checkbox"
            checked={settings.prioritizeNames}
            onChange={(e) => updateSettings({ prioritizeNames: e.target.checked })}
            className="w-4 h-4 accent-cyan-500 rounded-sm cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between py-1.5">
          <div>
            <span className="text-xs font-medium text-neutral-200 block">Tự động viết hoa đầu câu</span>
            <span className="text-[11px] text-neutral-500">Viết hoa chữ cái đầu tiên sau dấu chấm, hỏi, than</span>
          </div>
          <input
            type="checkbox"
            checked={settings.capitalizeSentences}
            onChange={(e) => updateSettings({ capitalizeSentences: e.target.checked })}
            className="w-4 h-4 accent-cyan-500 rounded-sm cursor-pointer"
          />
        </div>
      </div>

      {/* Cài đặt Text-To-Speech */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-200 font-semibold text-sm">
            <Volume2 size={16} className="text-cyan-400" />
            <span>Giọng Đọc Text-To-Speech (TTS)</span>
          </div>
          <button
            onClick={handleTestTTS}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              testSpeechPlaying
                ? 'bg-amber-600 text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
            }`}
          >
            {testSpeechPlaying ? 'Dừng thử' : 'Thử giọng đọc'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs text-neutral-400 mb-1">
              <span>Tốc độ đọc:</span>
              <span className="font-mono text-cyan-400">{settings.ttsRate}x</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.6"
              step="0.05"
              value={settings.ttsRate}
              onChange={(e) => updateSettings({ ttsRate: Number(e.target.value) })}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-neutral-400 mb-1">
              <span>Cao độ giọng (Pitch):</span>
              <span className="font-mono text-cyan-400">{settings.ttsPitch}</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={settings.ttsPitch}
              onChange={(e) => updateSettings({ ttsPitch: Number(e.target.value) })}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Sao lưu và quản lý dữ liệu */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
        <div className="flex items-center gap-2 text-neutral-200 font-semibold text-sm">
          <HardDrive size={16} className="text-cyan-400" />
          <span>Sao Lưu &amp; Dữ Liệu Thiết Bị</span>
        </div>

        <p className="text-xs text-neutral-400">
          Hiện đang lưu trữ: <strong>{namesList.length}</strong> mục Name · <strong>{Object.keys(vietphraseMap).length}</strong> cụm Vietphrase · <strong>{savedChapters.length}</strong> chương truyện.
        </p>

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            onClick={handleExportFullBackup}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-medium transition-colors"
          >
            <Download size={14} />
            <span>Sao lưu dữ liệu (.JSON)</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-medium transition-colors cursor-pointer">
            <Upload size={14} />
            <span>Phục hồi từ .JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreBackup}
              className="hidden"
            />
          </label>

          <button
            onClick={() => {
              if (window.confirm('Bạn có chắc muốn đặt lại toàn bộ từ điển về nguyên bản?')) {
                resetDictionaries();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-rose-400 hover:bg-rose-950/40 rounded-xl text-xs font-medium transition-colors ml-auto"
          >
            <RotateCcw size={14} />
            <span>Đặt lại từ điển</span>
          </button>
        </div>

        {backupSuccess && (
          <div className="text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded-lg flex items-center gap-1.5">
            <Check size={14} />
            <span>Đã tạo và tải file sao lưu thành công!</span>
          </div>
        )}
      </div>
    </div>
  );
};
