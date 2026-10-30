/**
 * Convert Android Web Clone
 * Chuyên dịch & convert tiểu thuyết Trung - Hán Việt - Vietphrase
 * Không yêu cầu đăng nhập, hoạt động hoàn toàn offline
 * Toàn bộ điều hướng nằm gọn trong nút Menu 3 gạch (Side Drawer) ở thanh trên
 */

import React, { useEffect } from 'react';
import { useResolvedTheme } from './utils/theme';
import { AppProvider, useApp } from './context/AppContext';
import { AndroidHeader } from './components/AndroidHeader';
import { TranslateView } from './components/views/TranslateView';
const BatchTranslateView = React.lazy(() => import('./components/views/BatchTranslateView').then(module => ({ default: module.BatchTranslateView })));
const LibraryView = React.lazy(() => import('./components/views/LibraryView').then(module => ({ default: module.LibraryView })));
const DictionaryView = React.lazy(() => import('./components/views/DictionaryView').then(module => ({ default: module.DictionaryView })));
const SettingsView = React.lazy(() => import('./components/views/SettingsView').then(module => ({ default: module.SettingsView })));
import { WordInspectModal } from './components/WordInspectModal';
const WebImportView = React.lazy(() => import('./components/views/WebImportView').then(module => ({ default: module.WebImportView })));

const MainLayout: React.FC = () => {
  const { activeTab, settings } = useApp();
  const theme = useResolvedTheme(settings.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }, [theme]);

  const isMobileFrame = settings.displayMode === 'mobile_frame';

  return (
    <div data-theme={theme} className="studio-ui min-h-screen w-full flex items-center justify-center bg-canvas text-main selection:bg-accent-soft transition-colors duration-200 font-sans antialiased">
      {/* Container: either mobile frame or full responsive */}
      <div 
        id="app-frame"
        className={`@container/app relative isolate w-full flex flex-col h-screen overflow-hidden ${
          isMobileFrame 
            ? 'max-w-md max-h-[92vh] rounded-3xl border border-neutral-700/80 overflow-hidden my-auto'
            : 'max-w-6xl mx-auto border-x border-neutral-800/60'
        }`}
      >
        {/* Top App Bar & Simulated Android Status Bar (Tích hợp Menu 3 gạch Side Drawer) */}
        <AndroidHeader />

        {/* Tab View Container - Tràn toàn bộ chiều cao màn hình */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeTab === 'translate' && <TranslateView />}
          {activeTab === 'batch' && <React.Suspense fallback={<div className="p-4">Đang mở…</div>}><BatchTranslateView /></React.Suspense>}
          {activeTab === 'web' && <React.Suspense fallback={<div className="p-4 text-sm text-muted">Đang mở Truyện từ web…</div>}><WebImportView /></React.Suspense>}
          {activeTab === 'library' && <React.Suspense fallback={<div className="p-4">Đang mở…</div>}><LibraryView /></React.Suspense>}
          {activeTab === 'dictionary' && <React.Suspense fallback={<div className="p-4">Đang mở…</div>}><DictionaryView /></React.Suspense>}
          {activeTab === 'settings' && <React.Suspense fallback={<div className="p-4">Đang mở…</div>}><SettingsView /></React.Suspense>}
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
