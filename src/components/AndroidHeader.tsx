/**
 * Android Top App Bar & Status Bar + Google AI Studio Pattern Navigation Drawer
 * - Nút Menu 3 gạch mở ngăn kéo điều hướng chuẩn mẫu Google AI Studio
 * - Thẻ thống kê 3 block vuông bo cong nhẹ (Truyện đã lưu, Đã đọc, Số giờ đọc) + Bánh răng bé xíu xóa thống kê
 * - Hàng 4 nút tiện ích & Cài đặt ngay trên phần tài khoản
 * - Mục dưới cùng là Link Tài Khoản Google (hỗ trợ trạng thái Đăng nhập / Chưa đăng nhập)
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpDialog } from './HelpDialog';
import { GoogleSignInButton } from './GoogleSignInButton';
import { useApp, AppTheme, AppTab } from '../context/AppContext';
import { 
  Smartphone, 
  Monitor, 
  Sun, 
  Moon, 
  MonitorCog,
  BookOpen,
  Type,
  Menu,
  X,
  Languages,
  Library,
  BookMarked,
  Settings,
  ChevronRight,
  Palette,
  Check,
  Bell,
  Search,
  Key,
  Files,
  LayoutDashboard,
  FileText,
  Sparkles,
  Trash2,
  LogIn,
  LogOut,
  User,
  CheckCircle2,
  Sliders,
  HelpCircle,
  Database
} from 'lucide-react';


export const AndroidHeader: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    activeTab, 
    setActiveTab,
    namesList,
    vietphraseMap,
    novelsList,
    savedChapters,
    readingStats,
    resetReadingStats,
    googleAccount,
    loginWithGoogle,
    logoutGoogle
  } = useApp();


  const [isAaMenuOpen, setIsAaMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Popups bên trong Drawer
  const [isGearMenuOpen, setIsGearMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [guideSection, setGuideSection] = useState<'guide' | 'shortcuts'>('guide');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const aaMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const aaBtnRef = useRef<HTMLButtonElement>(null);
  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const gearMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Hiển thị toast thông báo ngắn gọn
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2800);
  };


  // Đóng popups khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) setIsNotificationsOpen(false);
      if (
        isAaMenuOpen &&
        aaMenuRef.current &&
        !aaMenuRef.current.contains(target) &&
        aaBtnRef.current &&
        !aaBtnRef.current.contains(target)
      ) {
        setIsAaMenuOpen(false);
      }
      if (
        isThemeMenuOpen &&
        themeMenuRef.current &&
        !themeMenuRef.current.contains(target) &&
        themeBtnRef.current &&
        !themeBtnRef.current.contains(target)
      ) {
        setIsThemeMenuOpen(false);
      }
      if (
        isGearMenuOpen &&
        gearMenuRef.current &&
        !gearMenuRef.current.contains(target)
      ) {
        setIsGearMenuOpen(false);
      }
      if (
        isAccountMenuOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(target)
      ) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
        setIsAaMenuOpen(false);
        setIsThemeMenuOpen(false);
        setIsGearMenuOpen(false);
        setIsAccountMenuOpen(false);
        setIsNotificationsOpen(false);
        setIsShortcutsOpen(false);
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAaMenuOpen, isThemeMenuOpen, isGearMenuOpen, isAccountMenuOpen]);

  // Toggle Aa popup
  const toggleAaMenu = () => {
    setIsThemeMenuOpen(false);
    setIsAaMenuOpen(prev => !prev);
  };

  // Toggle Theme popup
  const toggleThemeMenu = () => {
    setIsAaMenuOpen(false);
    setIsThemeMenuOpen(prev => !prev);
  };

  const toggleDisplayMode = () => {
    updateSettings({
      displayMode: settings.displayMode === 'mobile_frame' ? 'responsive' : 'mobile_frame'
    });
  };

  const currentNavTitle = { translate: 'Dịch nhanh', batch: 'Dịch nhiều chương', web: 'Truyện từ web', library: 'Thư viện', dictionary: 'Từ điển', settings: 'Cài đặt' }[activeTab];

  const handleSelectNav = (tab: AppTab, _title?: string) => {
    setActiveTab(tab);
    setIsDrawerOpen(false);
  };

  const handleResetStats = () => {
    resetReadingStats();
    setIsGearMenuOpen(false);
    showToast('Đã xóa toàn bộ dữ liệu thống kê đọc!');
  };

  const handleGoogleAuthAction = () => {
    setIsAccountMenuOpen(prev => !prev);
  };

  const handleLogout = async () => {
    try {
      await logoutGoogle();
      setIsAccountMenuOpen(false);
      showToast('Đã đăng xuất.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không đăng xuất được.'); }
  };

  const themes = [
    { id: 'light' as AppTheme, label: 'Sáng', icon: Sun },
    { id: 'dark' as AppTheme, label: 'Tối', icon: Moon },
    { id: 'sepia' as AppTheme, label: 'Giấy', icon: BookOpen },
    { id: 'system' as AppTheme, label: 'Theo hệ thống', icon: MonitorCog },
  ];
  const ThemeIcon = themes.find(theme => theme.id === settings.theme)?.icon || MonitorCog;
  const headerControlClass = (open: boolean) => 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ' + (open ? 'bg-accent-soft border-accent/40 text-accent' : 'bg-transparent border-transparent text-muted hover:bg-hover hover:text-main');

  const PRESET_TEXT_COLORS = [
    { label: 'Mặc định', value: '', bg: 'bg-hover' },
    { label: 'Trắng tinh', value: '#ffffff', bg: 'bg-surface' },
    { label: 'Trắng dịu', value: '#e4e4e7', bg: 'bg-raised' },
    { label: 'Hổ phách', value: '#fde68a', bg: 'bg-amber-200' },
    { label: 'Xanh lơ', value: '#a5f3fc', bg: 'bg-accent-soft' },
    { label: 'Xanh lá', value: '#bbf7d0', bg: 'bg-emerald-200' },
    { label: 'Sepia', value: '#43302b', bg: 'bg-surface' },
    { label: 'Đen mun', value: '#18181b', bg: 'bg-surface' },
  ];

  return (
    <header className="shrink-0 bg-surface border-b border-line text-main select-none relative z-40">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-surface/95 text-main text-xs px-4 py-2.5 rounded-full border border-accent/60 shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none">
          <CheckCircle2 size={15} className="text-accent shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}


      {/* Main App Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2">
        {/* Bên Trái: Nút Menu 3 gạch giữ nguyên vị trí hiện tại + Tên nút vừa được ấn */}
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Nút Menu 3 gạch mở Navigation Drawer */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="w-8 h-8 rounded-lg bg-raised hover:bg-hover text-main hover:text-main border border-line transition-all flex items-center justify-center shadow-2xs cursor-pointer group"
            title="Mở menu danh mục điều hướng"
            aria-label="Mở menu"
          >
            <Menu size={18} className="group-hover:scale-105 transition-transform" />
          </button>

          {/* Tên nút vừa được ấn hiển thị trực tiếp bên cạnh nút menu */}
          <div 
            onClick={() => handleSelectNav('translate', 'Dịch nhanh')}
            className="flex min-w-0 items-center gap-1.5 cursor-pointer group select-none"
          >
            <h1 className="truncate text-sm font-semibold tracking-tight text-main leading-tight group-hover:text-accent transition-colors">
              {currentNavTitle}
            </h1>
          </div>

          {/* Thanh điều hướng nhanh cho PC (Chỉ hiển thị trên PC md:flex) */}
          <div className="hidden @min-[760px]/app:flex items-center gap-1 ml-3 pl-3 border-l border-line text-xs">
            <button
              onClick={() => handleSelectNav('translate', 'Dịch nhanh')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                activeTab === 'translate'
                  ? 'bg-raised text-accent font-semibold'
                  : 'text-muted hover:text-main hover:bg-raised/60'
              }`}
            >
              Dịch nhanh
            </button>
            <button
              onClick={() => handleSelectNav('batch', 'Dịch nhiều chương')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                activeTab === 'batch'
                  ? 'bg-accent text-main font-semibold shadow-xs'
                  : 'text-main hover:text-main hover:bg-raised/60'
              }`}
              title="Dịch nhiều chương"
            >
              <span>Dịch nhiều chương</span>
            </button>
            <button onClick={() => handleSelectNav('web')} className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === 'web' ? 'bg-raised text-accent' : 'text-muted hover:text-main hover:bg-raised/60'}`}>Truyện từ web</button>
            <button
              onClick={() => handleSelectNav('library', 'Thư viện')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-raised text-accent font-semibold'
                  : 'text-muted hover:text-main hover:bg-raised/60'
              }`}
            >
              Thư viện
            </button>
          </div>
        </div>

        {/* Bên Phải: Aa Button + Theme Button + Display Mode Toggle */}
        <div className="flex items-center gap-1 sm:gap-1.5 relative">
          {/* Nút Menu Popup Aa (Cài đặt kiểu chữ & cỡ chữ) */}
          <button
            ref={aaBtnRef}
            aria-expanded={isAaMenuOpen}
            aria-controls="typography-popover"
            onClick={toggleAaMenu}
            className={headerControlClass(isAaMenuOpen)}
            title="Cài đặt kiểu chữ và cỡ chữ"
            aria-label="Cài đặt kiểu chữ"
          >
            <Type size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>

          {/* Nút Theme Popup: Giao diện */}
          <button
            ref={themeBtnRef}
            aria-expanded={isThemeMenuOpen}
            aria-controls="theme-popover"
            onClick={toggleThemeMenu}
            className={headerControlClass(isThemeMenuOpen)}
            title="Giao diện"
            aria-label="Giao diện"
          >
            <ThemeIcon size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>

          {/* Nút Khung điện thoại / Toàn màn hình */}
          <button
            onClick={toggleDisplayMode}
            className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-raised transition-colors hidden sm:block border border-transparent hover:border-line"
            title={settings.displayMode === 'mobile_frame' ? 'Toàn màn hình' : 'Khung điện thoại'}
          >
            {settings.displayMode === 'mobile_frame' ? <Monitor size={16} /> : <Smartphone size={16} />}
          </button>
        </div>
      </div>

      {/* POPUP 1: Tùy Chỉnh Kiểu Chữ & Cỡ Chữ (Aa) */}
      {isAaMenuOpen && (
        <div 
          id="typography-popover" ref={aaMenuRef}
          className="absolute right-3 top-full mt-2 w-72 rounded-xl bg-surface/98 backdrop-blur-md border border-line shadow-2xl p-3 text-main z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-line/80">
            <div className="flex items-center gap-2">
              <Type size={14} className="text-accent" />
              <span className="text-xs font-semibold text-main">Kiểu chữ &amp; Cỡ chữ</span>
            </div>
            <button
              onClick={() => setIsAaMenuOpen(false)}
              className="p-1 text-muted hover:text-main rounded-md cursor-pointer transition-colors"
              title="Đóng"
            >
              <X size={14} />
            </button>
          </div>

          {/* 1. Cỡ chữ */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted mb-1.5">
              <span>Cỡ chữ:</span>
              <span className="text-accent font-mono font-medium">{settings.fontSize}px</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSettings({ fontSize: Math.max(13, settings.fontSize - 1) })}
                className="w-7 h-7 rounded-lg bg-raised/80 hover:bg-hover border border-line/60 text-main font-semibold text-xs flex items-center justify-center transition-colors cursor-pointer"
                title="Giảm cỡ chữ"
              >
                A-
              </button>
              <input
                type="range"
                min="13"
                max="26"
                step="1"
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                className="flex-1 accent-cyan-500 cursor-pointer h-1.5 bg-raised rounded-lg"
              />
              <button
                onClick={() => updateSettings({ fontSize: Math.min(26, settings.fontSize + 1) })}
                className="w-7 h-7 rounded-lg bg-raised/80 hover:bg-hover border border-line/60 text-main font-semibold text-xs flex items-center justify-center transition-colors cursor-pointer"
                title="Tăng cỡ chữ"
              >
                A+
              </button>
            </div>
          </div>

          {/* 2. Phông chữ */}
          <div>
            <div className="text-xs text-muted mb-1.5">Phông chữ:</div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                onClick={() => updateSettings({ fontFamily: 'sans' })}
                className={`py-1.5 px-2 rounded-lg border font-sans text-center transition-colors cursor-pointer ${
                  settings.fontFamily === 'sans'
                    ? 'bg-raised border-accent/60 text-accent font-medium shadow-xs'
                    : 'bg-surface/60 border-line text-muted hover:text-main'
                }`}
                title="Phông Sans-Serif"
              >
                Sans-Serif
              </button>

              <button
                onClick={() => updateSettings({ fontFamily: 'serif' })}
                className={`py-1.5 px-2 rounded-lg border font-serif text-center transition-colors cursor-pointer ${
                  settings.fontFamily === 'serif'
                    ? 'bg-raised border-accent/60 text-accent font-medium shadow-xs'
                    : 'bg-surface/60 border-line text-muted hover:text-main'
                }`}
                title="Phông Serif"
              >
                Serif
              </button>
            </div>
          </div>

          {/* 3. Giãn dòng */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>Khoảng cách dòng:</span>
              <span className="text-accent font-mono font-medium">{settings.lineHeight}x</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                { val: 1.4, label: 'Vừa' },
                { val: 1.7, label: 'Thoáng' },
                { val: 2.0, label: 'Rộng' }
              ].map(item => (
                <button
                  key={item.val}
                  onClick={() => updateSettings({ lineHeight: item.val })}
                  className={`py-1 rounded-lg border text-center transition-colors cursor-pointer ${
                    settings.lineHeight === item.val
                      ? 'bg-raised border-accent/60 text-accent font-medium'
                      : 'bg-surface/60 border-line text-muted hover:text-main'
                  }`}
                  title={`${item.label} (${item.val}x)`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Màu chữ đọc truyện (Bảng màu chọn sẵn + Chọn mã màu tùy ý) */}
          <div className="pt-2 border-t border-line/80">
            <div className="flex items-center justify-between text-xs text-muted mb-1.5">
              <span>Màu chữ đọc truyện:</span>
              <span className="text-accent font-mono text-[11px]">
                {settings.customTextColor || 'Theo chủ đề'}
              </span>
            </div>

            {/* Bảng màu chọn sẵn */}
            <div className="grid grid-cols-4 gap-1 mb-2">
              {PRESET_TEXT_COLORS.map(c => {
                const isSelected = (settings.customTextColor || '') === c.value;
                return (
                  <button
                    key={c.label}
                    onClick={() => updateSettings({ customTextColor: c.value })}
                    className={`py-1 px-1 rounded-lg border text-[10.5px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-raised border-accent text-accent shadow-xs font-semibold'
                        : 'bg-surface/60 border-line text-muted hover:text-main hover:border-line'
                    }`}
                    title={c.label}
                  >
                    <span style={{ backgroundColor: c.value || 'var(--ui-text)' }} className="w-2.5 h-2.5 rounded-full border border-black/30 shrink-0" />
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bộ chọn mã màu tùy ý (HTML Color Picker) */}
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-surface/80 border border-line">
              <span className="text-[11px] text-muted">Mã màu tùy ý:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={settings.customTextColor || '#ffffff'}
                  onChange={(e) => updateSettings({ customTextColor: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border border-line bg-transparent p-0"
                  title="Chọn mã màu tùy chọn"
                />
                <span className="text-[11px] font-mono text-main uppercase">
                  {settings.customTextColor || 'Mặc định'}
                </span>
                {settings.customTextColor && (
                  <button
                    onClick={() => updateSettings({ customTextColor: '' })}
                    className="p-0.5 text-muted hover:text-rose-400 rounded cursor-pointer"
                    title="Đặt lại màu chữ mặc định theo chế độ giao diện"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: Giao diện */}
      {isThemeMenuOpen && (
        <div 
          id="theme-popover" ref={themeMenuRef}
          className="absolute right-3 top-full mt-2 w-64 rounded-xl bg-surface/98 backdrop-blur-md border border-line shadow-2xl p-2.5 text-main z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1.5"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1.5 pb-2 border-b border-line/80 mb-1">
            <div className="flex items-center gap-2">
              <Palette size={14} className="text-accent" />
              <span className="text-xs font-semibold text-main">Giao diện</span>
            </div>
            <button
              onClick={() => setIsThemeMenuOpen(false)}
              className="p-1 text-muted hover:text-main rounded-md cursor-pointer transition-colors"
              title="Đóng"
            >
              <X size={14} />
            </button>
          </div>

          {/* Danh sách 4 chế độ: Sáng (Light), Tối (Dark), Sepia (Retro), Hệ thống (Auto) */}
          <div className="space-y-1">
            {themes.map(t => {
              const isSelected = settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  aria-pressed={isSelected}
                  onClick={() => {
                    updateSettings({ theme: t.id });
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-raised/90 border-accent/60 text-main shadow-xs' 
                      : 'bg-surface/60 border-line/80 text-main hover:bg-raised/60 hover:text-main hover:border-line'
                  }`}
                  title={t.label}
                >
                  <div className="flex items-center gap-2.5">
                    <t.icon size={18} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />
                    <span className="text-xs font-medium tracking-tight">
                      {t.label}
                    </span>
                  </div>

                  {isSelected && (
                    <Check size={14} className="text-accent shrink-0" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* NAVIGATION DRAWER: Chuẩn thiết kế Google AI Studio Pattern */}
      {isDrawerOpen && createPortal(
        <div data-navigation-overlay className="absolute inset-0 z-50 flex">
          {/* Overlay nền mờ */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/55"
          />

          {/* Nội dung Ngăn kéo trượt sang trọng phong cách Google AI Studio */}
          <div className="studio-drawer relative w-72 max-w-[90%] h-full bg-surface border-r border-line flex flex-col justify-between z-10 text-main overflow-hidden font-sans">
            
            {/* VÙNG CUỘN NỘI DUNG CHÍNH (DRAWER SCROLLABLE BODY) */}
            <div role="navigation" aria-label="Điều hướng chính" className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-neutral-800">
              
              {/* Drawer Top Header: Logo + Toggle Collapse Icon */}
              <div className="flex items-center justify-between pb-3.5 border-b border-line/80">
                <div 
                  onClick={() => { setActiveTab('translate'); setIsDrawerOpen(false); }}
                  className="flex items-center gap-2.5 cursor-pointer group select-none"
                >
                  <div className="w-8 h-8 rounded-lg border border-line bg-raised text-main flex items-center justify-center font-medium text-sm">
                    C
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-base font-bold text-main tracking-tight group-hover:text-accent transition-colors">
                        Convert
                      </h2>
                      <span className="text-[10px] text-muted font-normal">
                        1.1
                      </span>
                    </div>
                    <p className="text-[10.5px] text-muted font-medium">Dịch và đọc truyện</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-muted hover:text-main hover:bg-raised rounded-lg transition-colors cursor-pointer"
                  title="Đóng menu"
                  aria-label="Đóng menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* NHÓM 1: Dịch / KHÁM PHÁ */}
              <div className="space-y-1">
                <div data-nav-section className="px-3 text-muted uppercase">
                  Dịch
                </div>

                {/* Dịch nhanh (Playground pattern) */}
                <button
                  onClick={() => handleSelectNav('translate', 'Dịch nhanh')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    activeTab === 'translate'
                      ? 'bg-surface text-main font-medium shadow-sm'
                      : 'text-main hover:bg-raised/70 hover:text-main'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Languages size={17} className={activeTab === 'translate' ? 'text-accent' : 'text-muted'} />
                    <span className="text-sm">Dịch nhanh</span>
                  </div>
                  {activeTab === 'translate' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-soft" />
                  )}
                </button>

                {/* Dịch nhiều chương (Chỉ trên PC) */}
                <button
                  onClick={() => handleSelectNav('batch', 'Dịch nhiều chương')}
                  className={`flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    activeTab === 'batch'
                      ? 'bg-surface text-main font-medium shadow-sm'
                      : 'text-main hover:bg-raised/70 hover:text-main'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Files size={17} className={activeTab === 'batch' ? 'text-accent' : 'text-muted'} />
                    <span className="text-sm">Dịch nhiều chương</span>
                  </div>
                  {activeTab === 'batch' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-soft" />
                  )}
                </button>
              </div>

              <button onClick={() => handleSelectNav('web')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${activeTab === 'web' ? 'bg-surface text-accent' : 'text-main hover:bg-raised/70'}`}>
                <Files size={17} />Truyện từ web
              </button>

              {/* NHÓM 2: Dữ liệu / TỦ TRUYỆN & DỮ LIỆU */}
              <div className="space-y-1">
                <div data-nav-section className="px-3 text-muted uppercase">
                  Dữ liệu
                </div>

                {/* Thư viện (Đã đổi tên theo yêu cầu) */}
                <button
                  onClick={() => handleSelectNav('library', 'Thư viện')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    activeTab === 'library'
                      ? 'bg-surface text-main font-medium shadow-sm'
                      : 'text-main hover:bg-raised/70 hover:text-main'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Library size={17} className={activeTab === 'library' ? 'text-accent' : 'text-muted'} />
                    <span className="text-sm">Thư viện</span>
                  </div>
                  {activeTab === 'library' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-soft" />
                  )}
                </button>

                {/* Từ điển (Hợp nhất toàn bộ database) */}
                <button
                  onClick={() => handleSelectNav('dictionary', 'Từ điển')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    activeTab === 'dictionary'
                      ? 'bg-surface text-main font-medium shadow-sm'
                      : 'text-main hover:bg-raised/70 hover:text-main'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Database size={17} className={activeTab === 'dictionary' ? 'text-accent' : 'text-muted'} />
                    <span className="text-sm">Từ điển</span>
                  </div>
                  {activeTab === 'dictionary' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-soft" />
                  )}
                </button>
              </div>

              {/* NHÓM 3: Hỗ trợ / HỆ THỐNG (Đã bỏ Bảng Điều Khiển vì có nút Cài đặt ở dưới) */}

              <div className="space-y-1">
                <div data-nav-section className="px-3 text-muted uppercase">
                  Hỗ trợ
                </div>

                {/* Tài Liệu & Hướng Dẫn */}
                <button
                  onClick={() => {
                    setGuideSection('guide');
                    setIsShortcutsOpen(true);
                    setIsDrawerOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-main hover:bg-raised/70 hover:text-main transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <FileText size={17} className="text-muted" />
                    <span className="text-sm">Hướng dẫn</span>
                  </div>
                  <ChevronRight size={15} className="text-muted" />
                </button>
              </div>

            </div>

            {/* VÙNG ĐÁY DRAWER THEO ĐÚNG YÊU CẦU NGƯỜI DÙNG & MẪU CHỤP:
                1. Thẻ thống kê 3 block vuông + bánh răng bé xíu xóa thống kê
                2. Thanh 4 icon tiện ích (trên phần tài khoản là Cài đặt)
                3. Phần dưới cùng là link tài khoản Google */}
            <div className="p-3 bg-surface border-t border-line/90 space-y-2.5">
              
              {/* THẺ THỐNG KÊ NỔI BẬT (3 block vuông bo cong nhẹ + bánh răng bé xíu) */}
              <div data-drawer-stats className="rounded-xl border border-line/90 p-2.5 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-main">
                      Thống kê
                    </span>
                  </div>

                  {/* Bánh răng bé xíu ở góc cạnh thanh thống kê */}
                  <div className="relative">
                    <button
                      onClick={() => setIsGearMenuOpen(prev => !prev)}
                      className="p-1 rounded-md text-muted hover:text-main hover:bg-raised transition-colors cursor-pointer"
                      title="Tùy chọn thống kê"
                      aria-label="Tùy chọn thống kê"
                    >
                      <Settings size={13} />
                    </button>

                    {/* Popup với tùy chọn "Xóa thống kê" khi bấm bánh răng bé xíu */}
                    {isGearMenuOpen && (
                      <div 
                        ref={gearMenuRef}
                        className="absolute right-0 bottom-full mb-1.5 w-40 rounded-xl bg-surface border border-line shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-150"
                      >
                        <button
                          onClick={handleResetStats}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer text-left"
                        >
                          <Trash2 size={13} className="shrink-0" />
                          <span>Xóa thống kê</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3 Block vuông bo cong nhẹ */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Block 1: Số sách trong giá */}
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-surface/90 border border-line text-center">
                    <span className="text-base font-bold font-mono text-accent leading-none">
                      {novelsList.length}
                    </span>
                    <span className="text-[9.5px] text-muted mt-1 leading-tight line-clamp-1">
                      Truyện đã lưu
                    </span>
                  </div>

                  {/* Block 2: Số sách đã đọc */}
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-surface/90 border border-line text-center">
                    <span className="text-base font-bold font-mono text-amber-400 leading-none">
                      {readingStats.totalReadBooks}
                    </span>
                    <span className="text-[9.5px] text-muted mt-1 leading-tight line-clamp-1">
                      Đã đọc
                    </span>
                  </div>

                  {/* Block 3: Số giờ đã đọc */}
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-surface/90 border border-line text-center">
                    <span className="text-base font-bold font-mono text-emerald-400 leading-none">
                      {(readingStats.totalReadMinutes / 60).toFixed(1)}h
                    </span>
                    <span className="text-[9.5px] text-muted mt-1 leading-tight line-clamp-1">
                      Giờ đọc
                    </span>
                  </div>
                </div>
              </div>

              {/* THANH TIỆN ÍCH 4 NÚT HÀNG NGANG (TRÊN PHẦN TÀI KHOẢN LÀ CÀI ĐẶT) */}
              <div ref={notificationsRef} className="relative">
              {/* POPUP: Bảng Thông Báo Nhanh */}
              {isNotificationsOpen && (
                <div id="notifications-panel" role="region" aria-label="Thông báo hệ thống" className="absolute inset-x-0 bottom-full mb-2 z-50 max-h-[min(22rem,60dvh)] overflow-y-auto overscroll-contain p-3 rounded-xl bg-surface border border-line shadow-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-line">
                    <span className="font-semibold text-main">Thông báo hệ thống</span>
                    <button aria-label="Đóng thông báo" onClick={() => setIsNotificationsOpen(false)} className="text-muted hover:text-main">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-main">
                    <div className="p-2 rounded-lg bg-canvas/80 border border-line">
                      <div className="font-medium text-accent">Vietphrase Offline Sẵn Sàng</div>
                      <div className="text-muted text-[10px]">Toàn bộ cơ sở dữ liệu từ điển đã sẵn sàng dịch mà không cần internet.</div>
                    </div>
                    <div className="p-2 rounded-lg bg-canvas/80 border border-line">
                      <div className="font-medium text-emerald-400">Đa Nghĩa Vietphrase</div>
                      <div className="text-muted text-[10px]">Hỗ trợ chọn nghĩa phụ khi bôi đen và đảo thứ tự ưu tiên từ vựng.</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-1.5">
                {/* 1. Nút Thông báo */}
                <button
                  onClick={() => setIsNotificationsOpen(prev => !prev)}
                  className={`h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    isNotificationsOpen 
                      ? 'bg-raised border-line text-main shadow-xs' 
                      : 'bg-surface border-line text-muted hover:text-main hover:bg-raised'
                  }`}
                  title="Thông báo hệ thống"
                  aria-label="Thông báo"
                  aria-expanded={isNotificationsOpen}
                  aria-controls="notifications-panel"
                >
                  <Bell size={16} />
                </button>

                {/* 2. NÚT CÀI ĐẶT (Được đặt trực tiếp trên phần tài khoản) */}
                <button
                  onClick={() => handleSelectNav('settings', 'Cài đặt')}
                  className={`h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-accent/90 border-accent text-main shadow-xs'
                      : 'bg-surface border-line text-muted hover:text-main hover:bg-raised'
                  }`}
                  title="Mở Cài đặt ứng dụng"
                  aria-label="Cài đặt"
                >
                  <Settings size={16} />
                </button>

                {/* 3. Nút Tìm kiếm nhanh */}
                <button
                  onClick={() => setIsSearchOpen(prev => !prev)}
                  className={`h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    isSearchOpen
                      ? 'bg-raised border-line text-main shadow-xs'
                      : 'bg-surface border-line text-muted hover:text-main hover:bg-raised'
                  }`}
                  title="Tìm kiếm từ vựng / truyện"
                  aria-label="Tìm kiếm"
                >
                  <Search size={16} />
                </button>

                {/* 4. Nút Phím tắt / Khóa */}
                <button
                  onClick={() => {
                    setGuideSection('shortcuts');
                    setIsShortcutsOpen(true);
                    setIsDrawerOpen(false);
                  }}
                  className={`h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    isShortcutsOpen
                      ? 'bg-raised border-line text-main shadow-xs'
                      : 'bg-surface border-line text-muted hover:text-main hover:bg-raised'
                  }`}
                  title="Xem phím tắt nhanh"
                  aria-label="Phím tắt"
                >
                  <Key size={16} />
                </button>
              </div>

              </div>

              {/* POPUP: Bảng Tìm Kiếm Nhanh */}
              {isSearchOpen && (
                <div className="p-2.5 rounded-xl bg-surface border border-line shadow-xl space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-accent shrink-0" />
                    <input
                      type="text"
                      placeholder="Tìm truyện hoặc từ vựng..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-canvas border border-line rounded-lg px-2 py-1 text-xs text-main focus:outline-hidden focus:border-accent"
                    />
                    <button
                      onClick={() => setIsSearchOpen(false)}
                      className="text-muted hover:text-main p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {searchQuery.trim() && (
                    <div className="text-[11px] text-muted pt-1 border-t border-line flex justify-between items-center">
                      <span>Khớp {novelsList.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase())).length} bộ truyện</span>
                      <button
                        onClick={() => {
                          handleSelectNav('library', 'Thư viện');
                          setIsSearchOpen(false);
                        }}
                        className="text-accent hover:underline cursor-pointer"
                      >
                        Đến Thư viện &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* PHẦN DƯỚI CÙNG: LINK TÀI KHOẢN GOOGLE THEO MẪU CHỤP */}
              <div className="relative">
                {googleAccount.isLoggedIn ? (
                  // Verified Google profile, restored from the server session.
                  <div 
                    onClick={handleGoogleAuthAction}
                    className="w-full p-2.5 rounded-2xl bg-surface hover:bg-surface border border-line/90 flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar hình tròn */}
                      <div className="w-7 h-7 rounded-full bg-raised border border-line flex items-center justify-center shrink-0 overflow-hidden text-main font-bold text-xs shadow-inner">
                        {googleAccount.avatarUrl ? <img src={googleAccount.avatarUrl} alt={googleAccount.name} referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <User size={15} className="text-accent" />}
                      </div>
                      
                      {/* Email người dùng */}
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-semibold text-main group-hover:text-main truncate">
                          {googleAccount.email}
                        </div>
                        <div className="text-[10px] text-muted leading-tight">
                          Tài khoản Google
                        </div>
                      </div>
                    </div>

                    <ChevronRight size={14} className="text-muted group-hover:text-main shrink-0 ml-1" />
                  </div>
                ) : (
                  <GoogleSignInButton onCredential={async (credential, csrf) => {
                    await loginWithGoogle(credential, csrf);
                    showToast('Đã đăng nhập với Google.');
                  }} />
                )}

                {/* Popup Quản lý tài khoản Google (khi đã đăng nhập và bấm vào) */}
                {isAccountMenuOpen && googleAccount.isLoggedIn && (
                  <div 
                    ref={accountMenuRef}
                    className="absolute left-0 right-0 bottom-full mb-2 rounded-2xl bg-surface border border-line shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2.5"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-line">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-accent text-main flex items-center justify-center text-xs font-bold shrink-0">
                          G
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-semibold text-main truncate">{googleAccount.name}</div>
                          <div className="text-[10px] text-muted truncate">{googleAccount.email}</div>
                        </div>
                      </div>
                      <button onClick={() => setIsAccountMenuOpen(false)} className="text-muted hover:text-main p-1">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="space-y-1">

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer text-left"
                      >
                        <LogOut size={13} className="shrink-0" />
                        <span>Đăng xuất tài khoản</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>, document.getElementById('app-frame') || document.body
      )}
      {isShortcutsOpen && <HelpDialog initialSection={guideSection} onClose={() => setIsShortcutsOpen(false)} />}
    </header>
  );
};
