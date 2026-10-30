/**
 * Tab Cài đặt (Settings View)
 * Tùy biến hiển thị, phông chữ, quy tắc dịch, giọng đọc TTS và thông báo loại bỏ đăng nhập.
 */

import React, { useState, useEffect } from 'react';
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
    exportAllDatabasesJson,
    importAllDatabasesJson,
    resetDictionaries 
  } = useApp();

  const [testSpeechPlaying, setTestSpeechPlaying] = useState(false);
  const [testSpeechError, setTestSpeechError] = useState('');
  useEffect(() => () => speechService.stop(), []);
  const [backupSuccess, setBackupSuccess] = useState(false);

  const handleTestTTS = () => {
    if (testSpeechPlaying) {
      speechService.stop();
      setTestSpeechPlaying(false);
      return;
    }
    const sampleText = 'Xin chào, đây là giọng đọc thử nghiệm của ứng dụng Convert.';
    setTestSpeechError('');
    setTestSpeechPlaying(true);
    speechService.speak(sampleText, settings.ttsRate, {
      onEnd: () => setTestSpeechPlaying(false),
      onError: error => { setTestSpeechPlaying(false); setTestSpeechError(String(error)); },
    });
  };

  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const handleExportFullBackup = async () => {
    setBackupBusy(true);
    setBackupError('');
    try {
      const json = await exportAllDatabasesJson();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `convert_backup_${Date.now()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 2000);
    } catch (error) { setBackupError(String(error)); }
    finally { setBackupBusy(false); }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!window.confirm('Thay thế các phần dữ liệu có trong bản sao lưu? Các phần không có trong bản cũ được giữ nguyên.')) { input.value = ''; return; }
    setBackupBusy(true);
    setBackupSuccess(false);
    setBackupError('');
    try {
      const result = await importAllDatabasesJson(await file.text());
      if (!result.success) throw new Error(result.message);
      alert(result.message);
    } catch (error) { setBackupError(String(error)); }
    finally { setBackupBusy(false); input.value = ''; }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface text-main p-4 sm:p-6 space-y-5 max-w-4xl mx-auto w-full">
      {/* Quy tắc dịch & Engine */}
      <div className="p-4 sm:p-5 rounded-xl bg-surface border border-line/80 space-y-3">
        <div className="flex items-center gap-2 text-main font-medium text-xs tracking-wide uppercase">
          <Sparkles size={15} className="text-accent" />
          <span>Quy tắc dịch thuật</span>
        </div>

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
            <span className="text-xs font-medium text-main block">Tự động viết hoa đầu câu</span>
            <span className="text-[11px] text-muted">Viết hoa ký tự đầu sau dấu câu</span>
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

        {testSpeechError && <p role="alert" className="text-xs text-rose-400">{testSpeechError}</p>}
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
            onClick={handleExportFullBackup}
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
                setBackupBusy(true);
                try { await resetDictionaries(); } catch (error) { setBackupError(String(error)); }
                finally { setBackupBusy(false); }
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-rose-400 hover:bg-rose-950/30 rounded-lg text-xs font-medium transition-colors ml-auto border border-rose-900/40"
          >
            <RotateCcw size={14} />
            <span>Đặt lại từ điển</span>
          </button>
        </div>

        {backupBusy && <p role="status" className="text-xs text-muted">Đang xử lý dữ liệu…</p>}
        {backupError && <p role="alert" className="text-xs text-rose-400">{backupError}</p>}
        {backupSuccess && (
          <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-lg flex items-center gap-1.5">
            <Check size={14} />
            <span>Đã xuất file sao lưu thành công</span>
          </div>
        )}
      </div>
    </div>
  );
};
