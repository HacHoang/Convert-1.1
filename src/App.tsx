/**
 * TTV Translate Android Web Clone
 * Chuyên dịch & convert tiểu thuyết Trung - Hán Việt - Vietphrase
 * Không yêu cầu đăng nhập, hoạt động hoàn toàn offline
 * Toàn bộ điều hướng nằm gọn trong nút Menu 3 gạch (Side Drawer) ở thanh trên
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AndroidHeader } from './components/AndroidHeader';
import { TranslateView } from './components/views/TranslateView';
import { LibraryView } from './components/views/LibraryView';
import { DictionaryView } from './components/views/DictionaryView';
import { SettingsView } from './components/views/SettingsView';
import { WordInspectModal } from './components/WordInspectModal';

const MainLayout: React.FC = () => {
  const { activeTab, settings } = useApp();

  // Color theme classes mapping
  const getThemeClass = () => {
    let activeTheme = settings.theme;
    if (activeTheme === 'system') {
      const isSystemDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeTheme = isSystemDark ? 'dark' : 'light';
    }

    switch (activeTheme) {
      case 'amoled':
        return 'bg-black text-white';
      case 'sepia':
        return 'bg-[#f5edd6] text-[#4a3928] selection:bg-[#e4d3aa]';
      case 'light':
        return 'bg-slate-100 text-slate-900 selection:bg-cyan-200';
      case 'mint':
        return 'bg-[#eef7ee] text-[#1d432b] selection:bg-emerald-200';
      case 'dark':
      default:
        return 'bg-neutral-950 text-neutral-100 selection:bg-cyan-900 selection:text-cyan-100';
    }
  };

  const isMobileFrame = settings.displayMode === 'mobile_frame';

  return (
    <div className={`min-h-screen w-full flex items-center justify-center ${getThemeClass()} transition-colors duration-200 font-sans`}>
      {/* Container: either mobile frame or full responsive */}
      <div 
        className={`w-full flex flex-col h-screen overflow-hidden ${
          isMobileFrame 
            ? 'max-w-md max-h-[92vh] rounded-[36px] border-4 border-neutral-700/80 shadow-2xl overflow-hidden my-auto' 
            : 'max-w-6xl mx-auto border-x border-neutral-800/60'
        }`}
      >
        {/* Top App Bar & Simulated Android Status Bar (Tích hợp Menu 3 gạch Side Drawer) */}
        <AndroidHeader />

        {/* Tab View Container - Tràn toàn bộ chiều cao màn hình */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeTab === 'translate' && <TranslateView />}
          {activeTab === 'library' && <LibraryView />}
          {activeTab === 'dictionary' && <DictionaryView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Word / Name Inspection & Editor Modal */}
      <WordInspectModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
