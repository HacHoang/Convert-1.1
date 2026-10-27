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
import { BatchTranslateView } from './components/views/BatchTranslateView';
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
      const currentHour = new Date().getHours();
      const isNightTime = currentHour < 6 || currentHour >= 18;
      activeTheme = (isSystemDark || isNightTime) ? 'dark' : 'light';
    }

    switch (activeTheme) {
      case 'light':
        return 'bg-white text-[#1a1a1a] selection:bg-slate-200 selection:text-black';
      case 'sepia':
        return 'bg-[#fbf0d9] text-[#4a3525] selection:bg-[#ecdcb9] selection:text-[#3d2e1e]';
      case 'dark':
      default:
        return 'bg-[#121212] text-[#e1e1e1] selection:bg-neutral-800 selection:text-[#e1e1e1]';
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
          {activeTab === 'batch' && <BatchTranslateView />}
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
