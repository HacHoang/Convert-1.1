/**
 * Tab Cài đặt (Settings View)
 * Tùy biến hiển thị, phông chữ, quy tắc dịch, giọng đọc TTS và thông báo loại bỏ đăng nhập.
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useBackgroundTasks } from '../../context/BackgroundTasks';
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
    exportAllDatabasesJson,
    importAllDatabasesJson,
    resetDictionaries 
  } = useApp();
  const background = useBackgroundTasks();

  const [testSpeechPlaying, setTestSpeechPlaying] = useState(false);
  useEffect(() => () => speechService.stop(), []);

  const handleTestTTS = () => {
    if (testSpeechPlaying) {
      speechService.stop();
      setTestSpeechPlaying(false);
      return;
    }
    const sampleText = 'Xin chào, đây là giọng đọc thử nghiệm của ứng dụng Hermes.';
    setTestSpeechPlaying(true);
    speechService.speak(sampleText, settings.ttsRate, {
      onEnd: () => setTestSpeechPlaying(false),
      onError: error => { setTestSpeechPlaying(false); background.notify(String(error), true); },
    });
  };

  const backupBusy = background.running;
  const handleExportFullBackup = async () => {
    try {
      const json = await exportAllDatabasesJson();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `hermes_backup_${Date.now()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      background.reportResult('Đã xuất file sao lưu thành công');
    } catch (error) { background.reportResult(String(error), true); }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!window.confirm('Thay thế các phần dữ liệu có trong bản sao lưu? Các phần không có trong bản cũ được giữ nguyên.')) { input.value = ''; return; }
    background.run('Khôi phục bản sao lưu', async () => {
      try {
        const result = await importAllDatabasesJson(await file.text());
        if (!result.success) throw new Error(result.message);
        background.reportResult(result.message);
      } catch (error) { background.reportResult(String(error), true); }
      finally { input.value = ''; }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface text-main p-4 sm:p-6 space-y-5 max-w-4xl mx-auto w-full">
      {/* Quy tắc dịch & Engine */}
      <div className="p-4 sm:p-5 rounded-xl bg-surface border border-line/80 space-y-3">
        <div className="flex items-center gap-2 text-main font-medium text-xs tracking-wide uppercase">
          <Sparkles size={15} className="text-accent" />
          <span>Quy tắc dịch thuật</span>
        </div>

        <div className="block py-2 border-b border-line/60">
          <span className="text-xs font-medium text-main block mb-1">Lõi dịch Quick Translator</span>
          <span className="text-[11px] text-muted block">
            Hermes dùng duy nhất thuật toán đã port từ TranslatorEngine 1.4; không cần DLL/.NET khi chạy.
          </span>
        </div>
            <label className="block py-2 border-b border-line/60">
              <span className="text-xs font-medium text-main block mb-1.5">Thuật toán dịch</span>
              <select
                value={settings.quickTranslationAlgorithm}
                onChange={event => updateSettings({ quickTranslationAlgorithm: Number(event.target.value) as 0 | 1 | 2 })}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-main"
              >
                <option value={0}>Ưu tiên cụm VietPhrase dài</option>
                <option value={1}>Dịch từ trái sang phải</option>
                <option value={2}>Ưu tiên cụm VietPhrase dài (từ 4 chữ)</option>
              </select>
            </label>
            <label className="block py-2 border-b border-line/60">
              <span className="text-xs font-medium text-main block mb-1.5">Hiển thị VietPhrase một nghĩa</span>
              <select
                value={settings.quickVietphraseWrapType}
                onChange={event => updateSettings({ quickVietphraseWrapType: Number(event.target.value) as 0 | 1 | 2 | 3 })}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-main"
              >
                <option value={0}>Không dùng [...]</option>
                <option value={1}>Luôn dùng [...] (cả Hán Việt)</option>
                <option value={2}>Luôn dùng [...] (trừ Hán Việt)</option>
                <option value={3}>Chỉ dùng [...] nếu có hơn một nghĩa</option>
              </select>
            </label>

        <div className="flex items-center justify-between py-2 border-b border-line/60">
          <div>
            <span className="text-xs font-medium text-main block">Ưu tiên Tệp Name trước Vietphrase</span>
            <span className="text-[11px] text-muted">Giữ chuẩn tên nhân vật, môn phái và địa danh</span>
          </div>
          <input
            type="checkbox"
            checked={settings.prioritizeNames}
            onChange={(e) => updateSettings({ prioritizeNames: e.target.checked })}
            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-xs font-medium text-main block">Tự động viết hoa đầu câu và đầu dòng</span>
            <span className="text-[11px] text-muted">Bỏ qua dấu, số và ký hiệu để viết hoa chữ cái đầu tiên</span>
          </div>
          <input
            type="checkbox"
            checked={settings.capitalizeSentences}
            onChange={(e) => updateSettings({ capitalizeSentences: e.target.checked })}
            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Cài đặt Text-To-Speech */}
      <div className="p-4 sm:p-5 rounded-xl bg-surface border border-line/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-main font-medium text-xs tracking-wide uppercase">
            <Volume2 size={15} className="text-accent" />
            <span>Giọng đọc Text-To-Speech (TTS)</span>
          </div>
          <button
            onClick={handleTestTTS}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              testSpeechPlaying
                ? 'bg-amber-600 text-main'
                : 'bg-raised hover:bg-hover text-main'
            }`}
          >
            {testSpeechPlaying ? 'Dừng đọc' : 'Thử giọng đọc'}
          </button>
        </div>

        <div className="pt-1">
          <div>
            <div className="flex justify-between text-xs text-muted mb-1.5">
              <span>Tốc độ:</span>
              <span className="font-mono text-accent text-xs">{settings.ttsRate}x</span>
            </div>
            <input
              type="range"
              aria-label="Tốc độ đọc"
              min="0.5"
              max="2"
              step="0.05"
              value={settings.ttsRate}
              onChange={(e) => updateSettings({ ttsRate: Number(e.target.value) })}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

        </div>
      </div>

      {/* Sao lưu và quản lý dữ liệu */}
      <div className="p-4 sm:p-5 rounded-xl bg-surface border border-line/80 space-y-3">
        <div className="flex items-center gap-2 text-main font-medium text-xs tracking-wide uppercase">
          <HardDrive size={15} className="text-accent" />
          <span>Sao lưu &amp; Dữ liệu</span>
        </div>

        <div className="text-xs text-muted flex items-center gap-3">
          <span>Name: <strong className="text-main">{namesList.length}</strong></span>
          <span>•</span>
          <span>Vietphrase: <strong className="text-main">{Object.keys(vietphraseMap).length}</strong></span>
          <span>•</span>
          <span>Chương: <strong className="text-main">{savedChapters.length}</strong></span>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-2">
          <button
            disabled={backupBusy}
            onClick={() => background.run('Xuất bản sao lưu', handleExportFullBackup)}
            className="flex items-center gap-1.5 px-3 py-2 bg-raised/90 hover:bg-hover/90 text-main border border-line/70 rounded-lg text-xs font-medium transition-colors"
          >
            <Download size={14} />
            <span>Sao lưu dữ liệu (.JSON)</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 bg-raised/90 hover:bg-hover/90 text-main border border-line/70 rounded-lg text-xs font-medium transition-colors cursor-pointer">
            <Upload size={14} />
            <span>Khôi phục dữ liệu</span>
            <input
              disabled={backupBusy}
              type="file"
              accept=".json"
              onChange={handleRestoreBackup}
              className="hidden"
            />
          </label>

          <button
            disabled={backupBusy}
            onClick={async () => {
              if (window.confirm('Đặt lại toàn bộ từ điển về mặc định?')) {
                background.run('Đặt lại từ điển', async () => {
                  await resetDictionaries();
                });
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-rose-400 hover:bg-rose-950/30 rounded-lg text-xs font-medium transition-colors ml-auto border border-rose-900/40"
          >
            <RotateCcw size={14} />
            <span>Đặt lại từ điển</span>
          </button>
        </div>

      </div>
    </div>
  );
};
