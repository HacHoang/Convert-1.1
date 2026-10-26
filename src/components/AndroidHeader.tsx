/**
 * Android Top App Bar & Status Bar + Google AI Studio Pattern Navigation Drawer
 * - Nút Menu 3 gạch mở ngăn kéo điều hướng chuẩn mẫu Google AI Studio
 * - Thẻ thống kê 3 block vuông bo cong nhẹ (Sách trong giá, Sách đã đọc, Số giờ đọc) + Bánh răng bé xíu xóa thống kê
 * - Hàng 4 nút tiện ích & Cài Đặt ngay trên phần tài khoản
 * - Mục dưới cùng là Link Tài Khoản Google (hỗ trợ trạng thái Đăng nhập / Chưa đăng nhập)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp, AppTheme, AppTab } from '../context/AppContext';
import { 
  Wifi, 
  Battery, 
  Smartphone, 
  Monitor, 
  Sun, 
  Moon, 
  Laptop,
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
  History,
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


  const [currentTime, setCurrentTime] = useState('12:00');
  const [isAaMenuOpen, setIsAaMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Popups bên trong Drawer
  const [isGearMenuOpen, setIsGearMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const aaMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const aaBtnRef = useRef<HTMLButtonElement>(null);
  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const gearMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Hiển thị toast thông báo ngắn gọn
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2800);
  };

  // Cập nhật đồng hồ thời gian thực mô phỏng điện thoại
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  // Đóng popups khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
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

  const [currentNavTitle, setCurrentNavTitle] = useState<string>('Dịch Nhanh');

  const handleSelectNav = (tab: AppTab, title?: string) => {
    setActiveTab(tab);
    if (title) {
      setCurrentNavTitle(title);
    } else {
      if (tab === 'translate') setCurrentNavTitle('Dịch Nhanh');
      else if (tab === 'library') setCurrentNavTitle('Thư Viện');
      else if (tab === 'dictionary') setCurrentNavTitle('Quản Lý Từ Điển');
      else if (tab === 'settings') setCurrentNavTitle('Cài Đặt');
    }
    setIsDrawerOpen(false);
  };

  const handleResetStats = () => {
    resetReadingStats();
    setIsGearMenuOpen(false);
    showToast('Đã xóa toàn bộ dữ liệu thống kê đọc!');
  };

  const handleGoogleAuthAction = () => {
    if (googleAccount.isLoggedIn) {
      setIsAccountMenuOpen(prev => !prev);
    } else {
      loginWithGoogle('readerheadless@gmail.com', 'Google Reader');
      showToast('Đã đăng nhập Google thành công (readerheadless@gmail.com)!');
    }
  };

  const handleLogout = () => {
    logoutGoogle();
    setIsAccountMenuOpen(false);
    showToast('Đã đăng xuất tài khoản Google.');
  };

  const themes: { id: AppTheme; label: string; bg: string; text: string }[] = [
    { 
      id: 'light', 
      label: 'Sáng (Light)', 
      bg: 'bg-white border-zinc-300', 
      text: 'text-zinc-900',
    },
    { 
      id: 'dark', 
      label: 'Tối (Dark)', 
      bg: 'bg-[#121212] border-zinc-700', 
      text: 'text-zinc-100',
    },
    { 
      id: 'sepia', 
      label: 'Sepia (Retro)', 
      bg: 'bg-[#FBF0D9] border-[#e2d5b8]', 
      text: 'text-[#4A3525]',
    },
    { 
      id: 'system', 
      label: 'Hệ thống (Auto)', 
      bg: 'bg-gradient-to-tr from-zinc-800 to-zinc-200 border-zinc-600', 
      text: 'text-cyan-400',
    },
  ];

  return (
    <header className="shrink-0 bg-neutral-900 border-b border-neutral-800 text-neutral-200 select-none relative z-40">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 text-white text-xs px-4 py-2.5 rounded-full border border-cyan-500/60 shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none">
          <CheckCircle2 size={15} className="text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Android Simulated Status Bar */}
      <div className="flex items-center justify-between px-4 pt-1.5 pb-1 text-[11px] font-mono text-neutral-400">
        <span className="font-semibold tracking-wider text-neutral-300">{currentTime}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-tight text-neutral-500 font-sans">5G</span>
          <Wifi size={13} className="text-neutral-400" />
          <div className="flex items-center gap-1">
            <span className="text-[10px]">98%</span>
            <Battery size={14} className="text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Main App Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2">
        {/* Bên Trái: Nút Menu 3 gạch giữ nguyên vị trí hiện tại + Tên nút vừa được ấn */}
        <div className="flex items-center gap-2.5">
          {/* Nút Menu 3 gạch mở Navigation Drawer */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 transition-all flex items-center justify-center shadow-2xs cursor-pointer group"
            title="Mở menu danh mục điều hướng"
            aria-label="Mở menu"
          >
            <Menu size={18} className="group-hover:scale-105 transition-transform" />
          </button>

          {/* Tên nút vừa được ấn hiển thị trực tiếp bên cạnh nút menu */}
          <div 
            onClick={() => handleSelectNav('translate', 'Dịch Nhanh')}
            className="flex items-center gap-1.5 cursor-pointer group select-none"
          >
            <h1 className="text-base font-bold tracking-tight text-white leading-none group-hover:text-cyan-300 transition-colors">
              {currentNavTitle}
            </h1>
          </div>
        </div>

        {/* Bên Phải: Aa Button + Theme Button + Display Mode Toggle */}
        <div className="flex items-center gap-1 sm:gap-1.5 relative">
          {/* Nút Menu Popup Aa (Cài đặt kiểu chữ & cỡ chữ) */}
          <button
            ref={aaBtnRef}
            onClick={toggleAaMenu}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              isAaMenuOpen
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-xs'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
            title="Cài đặt kiểu chữ và cỡ chữ"
            aria-label="Cài đặt kiểu chữ"
          >
            <span className="font-serif font-bold text-sm leading-none">Aa</span>
          </button>

          {/* Nút Theme Popup: Giao diện */}
          <button
            ref={themeBtnRef}
            onClick={toggleThemeMenu}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isThemeMenuOpen
                ? 'bg-zinc-800 border-cyan-500 text-cyan-400 shadow-xs'
                : 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title="Giao diện"
            aria-label="Giao diện"
          >
            {settings.theme === 'light' ? (
              <Sun size={16} className={isThemeMenuOpen ? 'text-cyan-400' : 'text-amber-400'} />
            ) : settings.theme === 'sepia' ? (
              <Palette size={16} className={isThemeMenuOpen ? 'text-cyan-400' : 'text-amber-300'} />
            ) : settings.theme === 'system' ? (
              <Laptop size={16} className={isThemeMenuOpen ? 'text-cyan-400' : 'text-cyan-400'} />
            ) : (
              <Moon size={16} className={isThemeMenuOpen ? 'text-cyan-400' : 'text-zinc-300'} />
            )}
          </button>

          {/* Nút Khung điện thoại / Toàn màn hình */}
          <button
            onClick={toggleDisplayMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors hidden sm:block border border-transparent hover:border-zinc-700"
            title={settings.displayMode === 'mobile_frame' ? 'Toàn màn hình' : 'Khung điện thoại'}
          >
            {settings.displayMode === 'mobile_frame' ? <Monitor size={16} /> : <Smartphone size={16} />}
          </button>
        </div>
      </div>

      {/* POPUP 1: Tùy Chỉnh Kiểu Chữ & Cỡ Chữ (Aa) */}
      {isAaMenuOpen && (
        <div 
          ref={aaMenuRef}
          className="absolute right-3 top-full mt-2 w-72 rounded-xl bg-[#18181b]/98 backdrop-blur-md border border-zinc-800 shadow-2xl p-3 text-zinc-100 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Type size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold text-zinc-200">Kiểu chữ &amp; Cỡ chữ</span>
            </div>
            <button
              onClick={() => setIsAaMenuOpen(false)}
              className="p-1 text-zinc-400 hover:text-white rounded-md cursor-pointer transition-colors"
              title="Đóng"
            >
              <X size={14} />
            </button>
          </div>

          {/* 1. Cỡ chữ */}
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
              <span>Cỡ chữ:</span>
              <span className="text-cyan-400 font-mono font-medium">{settings.fontSize}px</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSettings({ fontSize: Math.max(13, settings.fontSize - 1) })}
                className="w-7 h-7 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200 font-semibold text-xs flex items-center justify-center transition-colors cursor-pointer"
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
                className="flex-1 accent-cyan-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
              <button
                onClick={() => updateSettings({ fontSize: Math.min(26, settings.fontSize + 1) })}
                className="w-7 h-7 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200 font-semibold text-xs flex items-center justify-center transition-colors cursor-pointer"
                title="Tăng cỡ chữ"
              >
                A+
              </button>
            </div>
          </div>

          {/* 2. Phông chữ */}
          <div>
            <div className="text-xs text-zinc-400 mb-1.5">Phông chữ:</div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                onClick={() => updateSettings({ fontFamily: 'sans' })}
                className={`py-1.5 px-2 rounded-lg border font-sans text-center transition-colors cursor-pointer ${
                  settings.fontFamily === 'sans'
                    ? 'bg-zinc-800 border-cyan-500/60 text-cyan-300 font-medium shadow-xs'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Phông Sans-Serif"
              >
                Sans-Serif
              </button>

              <button
                onClick={() => updateSettings({ fontFamily: 'serif' })}
                className={`py-1.5 px-2 rounded-lg border font-serif text-center transition-colors cursor-pointer ${
                  settings.fontFamily === 'serif'
                    ? 'bg-zinc-800 border-cyan-500/60 text-cyan-300 font-medium shadow-xs'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Phông Serif"
              >
                Serif
              </button>
            </div>
          </div>

          {/* 3. Giãn dòng */}
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Khoảng cách dòng:</span>
              <span className="text-cyan-400 font-mono font-medium">{settings.lineHeight}x</span>
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
                      ? 'bg-zinc-800 border-cyan-500/60 text-cyan-300 font-medium'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={`${item.label} (${item.val}x)`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: Giao diện */}
      {isThemeMenuOpen && (
        <div 
          ref={themeMenuRef}
          className="absolute right-3 top-full mt-2 w-64 rounded-xl bg-[#18181b]/98 backdrop-blur-md border border-zinc-800 shadow-2xl p-2.5 text-zinc-100 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1.5"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1.5 pb-2 border-b border-zinc-800/80 mb-1">
            <div className="flex items-center gap-2">
              <Palette size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold text-zinc-200">Giao diện</span>
            </div>
            <button
              onClick={() => setIsThemeMenuOpen(false)}
              className="p-1 text-zinc-400 hover:text-white rounded-md cursor-pointer transition-colors"
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
                  onClick={() => {
                    updateSettings({ theme: t.id });
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-zinc-800/90 border-cyan-500/60 text-white shadow-xs' 
                      : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60 hover:text-white hover:border-zinc-700'
                  }`}
                  title={t.label}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${t.bg}`}>
                      <span className={`text-[9px] font-bold ${t.text}`}>A</span>
                    </div>
                    <span className="text-xs font-medium tracking-tight">
                      {t.label}
                    </span>
                  </div>

                  {isSelected && (
                    <Check size={14} className="text-cyan-400 shrink-0" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* NAVIGATION DRAWER: Chuẩn thiết kế Google AI Studio Pattern */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay nền mờ */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          />

          {/* Nội dung Ngăn kéo trượt sang trọng phong cách Google AI Studio */}
          <div className="relative w-80 sm:w-88 max-w-[88vw] h-full bg-[#121316] border-r border-neutral-800 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200 text-neutral-100 overflow-hidden font-sans">
            
            {/* VÙNG CUỘN NỘI DUNG CHÍNH (DRAWER SCROLLABLE BODY) */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scrollbar-thin scrollbar-thumb-neutral-800">
              
              {/* Drawer Top Header: Logo + Toggle Collapse Icon */}
              <div className="flex items-center justify-between pb-3.5 border-b border-neutral-800/80">
                <div 
                  onClick={() => { setActiveTab('translate'); setIsDrawerOpen(false); }}
                  className="flex items-center gap-2.5 cursor-pointer group select-none"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-cyan-950/40">
                    C
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-base font-bold text-white tracking-tight group-hover:text-cyan-300 transition-colors">
                        Convert
                      </h2>
                      <span className="text-[10px] text-cyan-400 font-mono font-medium px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-800/50">
                        1.1
                      </span>
                    </div>
                    <p className="text-[10.5px] text-neutral-400 font-medium">Vietphrase Pro Studio</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                  title="Đóng menu"
                  aria-label="Đóng menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* NHÓM 1: EXPLORE / KHÁM PHÁ */}
              <div className="space-y-1">
                <div className="px-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                  EXPLORE
                </div>

                {/* Dịch Nhanh (Playground pattern) */}
                <button
                  onClick={() => handleSelectNav('translate', 'Dịch Nhanh')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    activeTab === 'translate'
                      ? 'bg-[#28292c] text-white font-medium shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Languages size={17} className={activeTab === 'translate' ? 'text-cyan-400' : 'text-neutral-400'} />
                    <span className="text-sm">Dịch Nhanh</span>
                  </div>
                  {activeTab === 'translate' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </button>

                {/* Lịch Sử Dịch */}
                <button
                  onClick={() => {
                    handleSelectNav('translate', 'Lịch Sử Dịch');
                    showToast('Đang mở màn hình dịch & các tác vụ gần đây');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-neutral-300 hover:bg-neutral-800/70 hover:text-white transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <History size={17} className="text-neutral-400" />
                    <span className="text-sm">Lịch Sử Dịch</span>
                  </div>
                </button>
              </div>

              {/* NHÓM 2: BUILD / TỦ TRUYỆN & DỮ LIỆU */}
              <div className="space-y-1">
                <div className="px-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                  BUILD
                </div>

                {/* Thư Viện (Đã đổi tên theo yêu cầu) */}
                <button
                  onClick={() => handleSelectNav('library', 'Thư Viện')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    activeTab === 'library'
                      ? 'bg-[#28292c] text-white font-medium shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Library size={17} className={activeTab === 'library' ? 'text-cyan-400' : 'text-neutral-400'} />
                    <span className="text-sm">Thư Viện</span>
                  </div>
                  {activeTab === 'library' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </button>

                {/* Cơ Sở Dữ Liệu & Từ Điển (Hợp nhất toàn bộ database) */}
                <button
                  onClick={() => handleSelectNav('dictionary', 'Cơ Sở Dữ Liệu & Từ Điển')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    activeTab === 'dictionary'
                      ? 'bg-[#28292c] text-white font-medium shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Database size={17} className={activeTab === 'dictionary' ? 'text-cyan-400' : 'text-neutral-400'} />
                    <span className="text-sm">Cơ Sở Dữ Liệu & Từ Điển</span>
                  </div>
                  {activeTab === 'dictionary' ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  ) : (
                    <span className="text-[11px] font-mono text-neutral-500">
                      {namesList.length + Object.keys(vietphraseMap).length} mục
                    </span>
                  )}
                </button>
              </div>

              {/* NHÓM 3: MANAGE / HỆ THỐNG (Đã bỏ Bảng Điều Khiển vì có nút Cài Đặt ở dưới) */}

              <div className="space-y-1">
                <div className="px-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                  MANAGE
                </div>

                {/* Tài Liệu & Hướng Dẫn */}
                <button
                  onClick={() => {
                    setCurrentNavTitle('Tài Liệu Hướng Dẫn');
                    setIsShortcutsOpen(true);
                    setIsDrawerOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-neutral-300 hover:bg-neutral-800/70 hover:text-white transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <FileText size={17} className="text-neutral-400" />
                    <span className="text-sm">Tài Liệu Hướng Dẫn</span>
                  </div>
                  <ChevronRight size={15} className="text-neutral-500" />
                </button>
              </div>

            </div>

            {/* VÙNG ĐÁY DRAWER THEO ĐÚNG YÊU CẦU NGƯỜI DÙNG & MẪU CHỤP:
                1. Thẻ thống kê 3 block vuông + bánh răng bé xíu xóa thống kê
                2. Thanh 4 icon tiện ích (trên phần tài khoản là Cài Đặt)
                3. Phần dưới cùng là link tài khoản Google */}
            <div className="p-3 bg-[#0f1012] border-t border-neutral-800/90 space-y-2.5">
              
              {/* THẺ THỐNG KÊ NỔI BẬT (3 block vuông bo cong nhẹ + bánh răng bé xíu) */}
              <div className="rounded-2xl bg-[#1a1b1f] border border-neutral-800/90 p-3 shadow-lg relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                      Thống Kê Đọc Truyện
                    </span>
                  </div>

                  {/* Bánh răng bé xíu ở góc cạnh thanh thống kê */}
                  <div className="relative">
                    <button
                      onClick={() => setIsGearMenuOpen(prev => !prev)}
                      className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Tùy chọn thống kê"
                      aria-label="Tùy chọn thống kê"
                    >
                      <Settings size={13} />
                    </button>

                    {/* Popup với tùy chọn "Xóa thống kê" khi bấm bánh răng bé xíu */}
                    {isGearMenuOpen && (
                      <div 
                        ref={gearMenuRef}
                        className="absolute right-0 bottom-full mb-1.5 w-40 rounded-xl bg-neutral-900 border border-neutral-700 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-150"
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
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-neutral-900/90 border border-neutral-800 text-center">
                    <span className="text-base font-bold font-mono text-cyan-400 leading-none">
                      {novelsList.length}
                    </span>
                    <span className="text-[9.5px] text-neutral-400 mt-1 leading-tight line-clamp-1">
                      Sách trong giá
                    </span>
                  </div>

                  {/* Block 2: Số sách đã đọc */}
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-neutral-900/90 border border-neutral-800 text-center">
                    <span className="text-base font-bold font-mono text-amber-400 leading-none">
                      {readingStats.totalReadBooks}
                    </span>
                    <span className="text-[9.5px] text-neutral-400 mt-1 leading-tight line-clamp-1">
                      Sách đã đọc
                    </span>
                  </div>

                  {/* Block 3: Số giờ đã đọc */}
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-neutral-900/90 border border-neutral-800 text-center">
                    <span className="text-base font-bold font-mono text-emerald-400 leading-none">
                      {(readingStats.totalReadMinutes / 60).toFixed(1)}h
                    </span>
                    <span className="text-[9.5px] text-neutral-400 mt-1 leading-tight line-clamp-1">
                      Giờ đã đọc
                    </span>
                  </div>
                </div>
              </div>

              {/* THANH TIỆN ÍCH 4 NÚT HÀNG NGANG (TRÊN PHẦN TÀI KHOẢN LÀ CÀI ĐẶT) */}
              <div className="grid grid-cols-4 gap-1.5">
                {/* 1. Nút Thông báo */}
                <button
                  onClick={() => setIsNotificationsOpen(prev => !prev)}
                  className={`h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    isNotificationsOpen 
                      ? 'bg-neutral-800 border-neutral-600 text-white shadow-xs' 
                      : 'bg-[#18191c] border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Thông báo hệ thống"
                  aria-label="Thông báo"
                >
                  <Bell size={16} />
                </button>

                {/* 2. NÚT CÀI ĐẶT (Được đặt trực tiếp trên phần tài khoản) */}
                <button
                  onClick={() => handleSelectNav('settings', 'Cài Đặt')}
                  className={`h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-cyan-600/90 border-cyan-500 text-white shadow-xs'
                      : 'bg-[#18191c] border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Mở Cài Đặt ứng dụng"
                  aria-label="Cài đặt"
                >
                  <Settings size={16} />
                </button>

                {/* 3. Nút Tìm kiếm nhanh */}
                <button
                  onClick={() => setIsSearchOpen(prev => !prev)}
                  className={`h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    isSearchOpen
                      ? 'bg-neutral-800 border-neutral-600 text-white shadow-xs'
                      : 'bg-[#18191c] border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Tìm kiếm từ vựng / truyện"
                  aria-label="Tìm kiếm"
                >
                  <Search size={16} />
                </button>

                {/* 4. Nút Phím tắt / Khóa */}
                <button
                  onClick={() => {
                    setCurrentNavTitle('Phím Tắt');
                    setIsShortcutsOpen(prev => !prev);
                  }}
                  className={`h-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    isShortcutsOpen
                      ? 'bg-neutral-800 border-neutral-600 text-white shadow-xs'
                      : 'bg-[#18191c] border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Xem phím tắt nhanh"
                  aria-label="Phím tắt"
                >
                  <Key size={16} />
                </button>
              </div>

              {/* POPUP: Bảng Tìm Kiếm Nhanh */}
              {isSearchOpen && (
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-700 shadow-xl space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-cyan-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Tìm truyện hoặc từ vựng..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-hidden focus:border-cyan-500"
                    />
                    <button
                      onClick={() => setIsSearchOpen(false)}
                      className="text-neutral-400 hover:text-white p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {searchQuery.trim() && (
                    <div className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-800 flex justify-between items-center">
                      <span>Khớp {novelsList.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase())).length} bộ truyện</span>
                      <button
                        onClick={() => {
                          handleSelectNav('library', 'Thư Viện');
                          setIsSearchOpen(false);
                        }}
                        className="text-cyan-400 hover:underline cursor-pointer"
                      >
                        Đến Thư Viện &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* POPUP: Bảng Thông Báo Nhanh */}
              {isNotificationsOpen && (
                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-700 shadow-xl space-y-2 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
                    <span className="font-semibold text-neutral-200">Thông báo hệ thống</span>
                    <button onClick={() => setIsNotificationsOpen(false)} className="text-neutral-400 hover:text-white">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-neutral-300">
                    <div className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800">
                      <div className="font-medium text-cyan-400">Vietphrase Offline Sẵn Sàng</div>
                      <div className="text-neutral-400 text-[10px]">Toàn bộ cơ sở dữ liệu từ điển đã sẵn sàng dịch mà không cần internet.</div>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800">
                      <div className="font-medium text-emerald-400">Đa Nghĩa Vietphrase</div>
                      <div className="text-neutral-400 text-[10px]">Hỗ trợ chọn nghĩa phụ khi bôi đen và đảo thứ tự ưu tiên từ vựng.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* POPUP: Bảng Phím Tắt Nhanh */}
              {isShortcutsOpen && (
                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-700 shadow-xl space-y-2 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
                    <span className="font-semibold text-neutral-200">Phím Tắt Đọc &amp; Dịch</span>
                    <button onClick={() => setIsShortcutsOpen(false)} className="text-neutral-400 hover:text-white">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="space-y-1 text-[11px] text-neutral-300">
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-400">Mở / Đóng Menu</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 font-mono text-[10px]">Esc</kbd>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-400">Tra cứu nhanh từ</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 font-mono text-[10px]">Bôi đen từ</kbd>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-400">Dịch văn bản</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 font-mono text-[10px]">Ctrl + Enter</kbd>
                    </div>
                  </div>
                </div>
              )}

              {/* PHẦN DƯỚI CÙNG: LINK TÀI KHOẢN GOOGLE THEO MẪU CHỤP */}
              <div className="relative">
                {googleAccount.isLoggedIn ? (
                  // ĐÃ ĐĂNG NHẬP: Hiển thị avatar tròn + email hansvjpbg@gmail.com / readerheadless@gmail.com
                  <div 
                    onClick={handleGoogleAuthAction}
                    className="w-full p-2.5 rounded-2xl bg-[#18191c] hover:bg-[#202126] border border-neutral-800/90 flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar hình tròn */}
                      <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 overflow-hidden text-neutral-300 font-bold text-xs shadow-inner">
                        <User size={15} className="text-cyan-400" />
                      </div>
                      
                      {/* Email người dùng */}
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-semibold text-neutral-200 group-hover:text-white truncate">
                          {googleAccount.email}
                        </div>
                        <div className="text-[10px] text-neutral-500 leading-tight">
                          Tài khoản Google
                        </div>
                      </div>
                    </div>

                    <ChevronRight size={14} className="text-neutral-500 group-hover:text-neutral-300 shrink-0 ml-1" />
                  </div>
                ) : (
                  // CHƯA ĐĂNG NHẬP: Hiện tùy chọn Đăng nhập với Google
                  <button
                    onClick={handleGoogleAuthAction}
                    className="w-full p-2.5 rounded-2xl bg-[#18191c] hover:bg-neutral-800 border border-neutral-800/90 flex items-center justify-center gap-2 cursor-pointer transition-all text-neutral-200 hover:text-white group"
                  >
                    {/* Biểu tượng Google G */}
                    <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
                      <span className="text-[11px] font-bold text-neutral-900 leading-none">G</span>
                    </div>
                    <span className="text-xs font-semibold">Đăng nhập với Google</span>
                  </button>
                )}

                {/* Popup Quản lý tài khoản Google (khi đã đăng nhập và bấm vào) */}
                {isAccountMenuOpen && googleAccount.isLoggedIn && (
                  <div 
                    ref={accountMenuRef}
                    className="absolute left-0 right-0 bottom-full mb-2 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2.5"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          G
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-semibold text-white truncate">{googleAccount.name}</div>
                          <div className="text-[10px] text-neutral-400 truncate">{googleAccount.email}</div>
                        </div>
                      </div>
                      <button onClick={() => setIsAccountMenuOpen(false)} className="text-neutral-400 hover:text-white p-1">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          const customEmail = window.prompt('Nhập email Google của bạn:', googleAccount.email);
                          if (customEmail && customEmail.trim()) {
                            loginWithGoogle(customEmail.trim(), 'Google User');
                            setIsAccountMenuOpen(false);
                            showToast(`Đã đổi email thành: ${customEmail.trim()}`);
                          }
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer text-left"
                      >
                        <span>Đổi email tài khoản</span>
                        <ChevronRight size={13} className="text-neutral-500" />
                      </button>

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
        </div>
      )}
    </header>
  );
};
