import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, Activity, Sun, Moon, Keyboard, ChevronDown, User, AlertTriangle, LogOut, Menu, LayoutGrid, LayoutDashboard, Users, Building2, Clock, Truck, Boxes, Receipt, Settings, CheckCircle2, Fingerprint } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { SIDEBAR_GROUPS } from './Sidebar';
import { Avatar } from '../ui/Avatar';
import { useNavigate } from 'react-router-dom';
import { CustomModal } from '../ui/CustomModal';
import { fetchAPI } from '../../utils/api';
import { DEV_MODE } from '../../config/env';
import vnFlag from '../../assets/vn.svg';
import usFlag from '../../assets/us.svg';
import jpFlag from '../../assets/jp.svg';
import cnFlag from '../../assets/cn.svg';

const languagesList = [
  { code: 'vi', name: 'Tiếng Việt', flag: vnFlag },
  { code: 'en', name: 'English', flag: usFlag },
  { code: 'ja', name: '日本語', flag: jpFlag },
  { code: 'zh', name: '简体中文', flag: cnFlag }
] as const;

const maskPhone = (phone: string) => {
  if (!phone || phone === '-') return phone;
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length < 8) return phone;
  const start = clean.slice(0, clean.length - 6);
  const end = clean.slice(-3);
  return `${start}***${end}`;
};

export const Header = ({ onActivityFeedClick, onMenuClick, version }: { onActivityFeedClick: () => void; onMenuClick?: () => void; version?: string }) => {
  const isDemo = localStorage.getItem('RICH LAND_DEMO_MODE') === 'true';
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const [headerVacationMode, setHeaderVacationMode] = useState<boolean>(false);
  const [headerCheckIn, setHeaderCheckIn] = useState<any>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fetchHeaderPortalData = async () => {
    if (user?.role !== 'sale') return;
    try {
      const res = await fetchAPI('check-ins&today_only=1');
      if (res.success) {
        setHeaderCheckIn(res.data);
      }
    } catch (err) {
      console.error("Error fetching check-in in Header:", err);
    }
    try {
      const json = await fetchAPI('get_sale_portal_data');
      if (json.success && json.vacation_mode !== undefined) {
        setHeaderVacationMode(Boolean(Number(json.vacation_mode)));
      }
    } catch (err) {
      console.error("Error fetching vacation mode in Header:", err);
    }
  };

  useEffect(() => {
    fetchHeaderPortalData();
  }, [user]);

  useEffect(() => {
    const handleVacationChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setHeaderVacationMode(customEvent.detail);
    };
    const handleCheckInChange = () => {
      fetchHeaderPortalData();
    };
    window.addEventListener('vacation-status-changed', handleVacationChange);
    window.addEventListener('checkin-status-changed', handleCheckInChange);
    return () => {
      window.removeEventListener('vacation-status-changed', handleVacationChange);
      window.removeEventListener('checkin-status-changed', handleCheckInChange);
    };
  }, [user]);

  const handleToggleHeaderVacation = async () => {
    try {
      const json = await fetchAPI('toggle_consultant_vacation', {
        method: 'POST',
        body: JSON.stringify({ id: user?.consultant_id })
      });
      if (json.success) {
        const nextMode = Boolean(Number(json.vacation_mode));
        setHeaderVacationMode(nextMode);
        toast.success(t('Đã thay đổi trạng thái Tạm ngưng'));
        window.dispatchEvent(new CustomEvent('vacation-status-changed', { detail: nextMode }));
      } else {
        toast.error(json.message || t('Lỗi thay đổi trạng thái'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi thay đổi trạng thái: ') + e.message);
    }
  };

  useEffect(() => {
    if (!isLangOpen) return;
    const handleClose = () => setIsLangOpen(false);
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [isLangOpen]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  // Listen to system changes if theme is not set and sync with external theme changes
  useEffect(() => {
    const localTheme = localStorage.getItem('richland_theme') as 'light' | 'dark';
    if (localTheme) {
      setTheme(localTheme);
      document.documentElement.setAttribute('data-theme', localTheme);
    } else {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }

    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };

    window.addEventListener('theme-change', handleThemeChange);
    return () => {
      window.removeEventListener('theme-change', handleThemeChange);
    };
  }, []);

  const toggleTheme = (event?: React.MouseEvent) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';

    // Check if View Transition is supported and user does not prefer reduced motion
    if (!(document as any).startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('richland_theme', nextTheme);
      window.dispatchEvent(new Event('theme-change'));
      return;
    }

    // Get click position or fallback to center of the viewport
    const x = event ? event.clientX : window.innerWidth / 2;
    const y = event ? event.clientY : window.innerHeight / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as any).startViewTransition(() => {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('richland_theme', nextTheme);
      window.dispatchEvent(new Event('theme-change'));
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];
      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 600,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'superadmin': return t('Super Admin');
      case 'admin': return t('Quản trị viên');
      case 'assistant': return t('Trợ lý');
      case 'viewer': return t('Người xem');
      case 'sale': return t('Tư vấn viên');
      default: return t('Người dùng');
    }
  };

  const handleProfileClick = () => {
    if (user?.role === 'admin' || user?.role === 'assistant' || user?.role === 'superadmin') {
      window.dispatchEvent(new CustomEvent('open-profile-modal'));
    }
  };

  const handleActivityClick = () => {
    if (user?.role === 'admin' || user?.role === 'assistant' || user?.role === 'superadmin') {
      window.dispatchEvent(new CustomEvent('open-profile-modal', { detail: { tab: 'activity' } }));
    }
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false);
  const [launcherSearch, setLauncherSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [leadResults, setLeadResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Listen to Cmd+K or Ctrl+K
  useEffect(() => {
    const handleSearchKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.hasAttribute('contenteditable')
      );

      if (isInputActive) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleSearchKeyDown);
    return () => window.removeEventListener('keydown', handleSearchKeyDown);
  }, []);

  // Search logic for Lead Data with 200ms debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setLeadResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const json = await fetchAPI(`get_logs&search=${encodeURIComponent(searchQuery)}&page=1&pageSize=5`);
        if (json.success && Array.isArray(json.data)) {
          setLeadResults(json.data.slice(0, 5));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const navItems: Array<{ name: string; path: string; description: string; shortcut: string; adminOnly?: boolean; superAdminOnly?: boolean; action?: () => void }> = [
    { name: t('Dashboard'), path: '/', description: t('Trang tổng quan thống kê hệ thống'), shortcut: 'Alt + D' },
    { name: t('Nhật ký Lead (Data Log)'), path: '/data', description: t('Xem logs danh sách lead và trạng thái cuộc gọi'), shortcut: 'Alt + L' },
    { name: t('Bản tin hoạt động hệ thống'), path: '#feed', description: t('Bản tin các hoạt động và phân bổ lead gần đây'), shortcut: 'Alt + H', action: () => window.dispatchEvent(new CustomEvent('open-activity-feed')) },
    { name: t('Vòng xoay chia số (Rounds)'), path: '/rounds', description: t('Cấu hình danh sách các vòng chia lead cho sale'), adminOnly: true, shortcut: 'Alt + R' },
    { name: t('Quy tắc chia số (Rules)'), path: '/rules', description: t('Thiết lập logic điều phối và skip interval'), adminOnly: true, shortcut: 'Alt + W' },
    { name: t('Quản lý Tư vấn viên (Consultants)'), path: '/consultants', description: t('Quản lý danh sách sale reps và trạng thái trực ca'), adminOnly: true, shortcut: 'Alt + C' },
    { name: t('Ticket báo lỗi data'), path: '/tickets', description: t('Phê duyệt đền bù lead lỗi hoặc trùng'), adminOnly: true, shortcut: 'Alt + T' },
    { name: t('Đối soát công bằng (Fair Share)'), path: '/fair-share', description: t('Đo lường độ lệch phân phối lead'), adminOnly: true, shortcut: 'Alt + S' },
    { name: t('Tích hợp API & Google Sheets'), path: '/integrations', description: t('Kết nối webhook và đồng bộ trang tính'), adminOnly: true, shortcut: 'Alt + I' },
    { name: t('Cài đặt hệ thống'), path: '/settings', description: t('Cài đặt quy chuẩn và dọn dẹp dữ liệu'), adminOnly: true, shortcut: 'Alt + O' },
    { name: t('Quản lý tài khoản'), path: '/accounts', description: t('Phân quyền tài khoản quản trị và trợ lý'), superAdminOnly: true, shortcut: 'Alt + A' }
  ];

  const visibleNavItems = navItems.filter(item => {
    if (item.superAdminOnly && user?.role !== 'superadmin') return false;
    if (item.adminOnly && user?.role !== 'admin' && user?.role !== 'superadmin') return false;
    return true;
  });
  
  const filteredNavItems = searchQuery.trim()
    ? visibleNavItems.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : visibleNavItems;

  const handleOpenSearch = () => {
    setSearchQuery('');
    setLeadResults([]);
    setIsSearchOpen(true);
  };

  return (
    <header style={{
      height: 66,
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.25rem',
      flexShrink: 0,
      zIndex: 40
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        {/* Mobile menu trigger */}
        <button 
          onClick={onMenuClick}
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-light)',
            borderRadius: 8,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            transition: 'color 0.2s',
            outline: 'none',
            display: 'none'
          }}
          className="mobile-menu-btn"
          title={t("Menu")}
        >
          <Menu size={24} />
        </button>

        {/* App Launcher Button (4-frame icon) */}
        <button 
          onClick={() => setIsAppLauncherOpen(true)}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            borderRadius: 8,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
          className="responsive-hide-mobile"
          title={t("Menu điều hướng nhanh")}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--color-primary)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--color-text-muted)';
            e.currentTarget.style.background = 'none';
          }}
         >
          <LayoutGrid size={20} />
        </button>

        {/* Search trigger */}
        <button 
          onClick={handleOpenSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 9999,
            padding: '0.4rem 0.875rem',
            color: 'var(--color-text-light)',
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            width: 320,
            maxWidth: '100%'
          }} 
          className="responsive-search-box responsive-hide-mobile"
        >
          <Search size={16} />
          <span className="responsive-hide-mobile">{t("Tìm kiếm toàn hệ thống...")}</span>
          <span className="responsive-hide-mobile" style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'var(--color-border)',
            color: 'var(--color-text-muted)',
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: '0.7rem'
          }}>
            <Command size={12} />K
          </span>
        </button>

        {/* Keyboard Shortcuts Trigger Button */}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-keyboard-shortcuts'))}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            borderRadius: 8,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
          className="responsive-hide-mobile"
          title={t("Bảng phím tắt điều hướng nhanh (?)")}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--color-primary)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--color-text-muted)';
            e.currentTarget.style.background = 'none';
          }}
         >
          <Keyboard size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        {isDemo && (
          <div className="responsive-hide-mobile" style={{
            background: 'linear-gradient(to right, #f59e0b, #d97706)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: '0.7rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.2)'
          }}>
            DEMO MODE
          </div>
        )}
        
        {/* Sales widgets for receiving data and check-in */}
        {user?.role === 'sale' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
            {/* Receiving Data Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '4px 10px', height: '36px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: !headerVacationMode ? '#10b981' : '#f59e0b' }}>
                {!headerVacationMode ? t('Nhận data') : t('Tạm ngưng')}
              </span>
              <ToggleSwitch
                checked={!headerVacationMode}
                onChange={handleToggleHeaderVacation}
              />
            </div>

            {/* Check-in status / trigger button */}
            {(!headerCheckIn || headerCheckIn.status === 'rejected') ? null : headerCheckIn.status === 'approved' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--color-success)', borderRadius: '8px', padding: '4px 10px', height: '36px', fontSize: '0.75rem', fontWeight: 700 }}>
                <CheckCircle2 size={12} />
                <span>{t('Đã Chấm công')} ({headerCheckIn.check_in_time.substring(0, 5)})</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: 'var(--color-warning)', borderRadius: '8px', padding: '4px 10px', height: '36px', fontSize: '0.75rem', fontWeight: 700 }}>
                <Clock size={12} />
                <span>{t('Chờ duyệt trễ')} ({headerCheckIn.check_in_time.substring(0, 5)})</span>
              </div>
            )}
          </div>
        )}

        {/* Version Badge */}
        <div style={{
          padding: '4px 10px',
          background: 'rgba(59, 130, 246, 0.08)',
          color: '#3b82f6',
          border: '1px solid rgba(59, 130, 246, 0.18)',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginRight: 4,
          userSelect: 'none'
        }}>
          v{version || '1.5.3'}
        </div>


        {/* Live Activity Feed Button */}
        <button 
          onClick={onActivityFeedClick}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-light)',
            borderRadius: 8,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
            outline: 'none'
          }}
          title={t("Bản tin hoạt động hệ thống")}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-bg)';
            e.currentTarget.style.color = 'var(--color-primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--color-text-light)';
          }}
        >
          <Activity size={20} />
          <span style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 0 2px var(--color-surface)',
            animation: 'pulse 2s infinite'
          }} />
        </button>


        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-light)',
            borderRadius: 8,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
          title={theme === 'light' ? t("Chuyển sang giao diện tối") : t("Chuyển sang giao diện sáng")}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-bg)';
            e.currentTarget.style.color = 'var(--color-primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--color-text-light)';
          }}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} style={{ color: '#fbbf24' }} />}
        </button>

        {/* Language Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsLangOpen(!isLangOpen);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--color-bg)',
              border: `1px solid ${isLangOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: '6px',
              padding: '3px 6px',
              cursor: 'pointer',
              color: 'var(--color-text)',
              fontSize: '0.75rem',
              fontWeight: 500,
              transition: 'all 0.2s',
              height: 30,
              outline: 'none',
              boxShadow: 'none',
            }}
            title={t('Chọn ngôn ngữ')}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = isLangOpen ? 'var(--color-primary)' : 'var(--color-border)';
            }}
          >
            <img 
              src={languagesList.find(l => l.code === language)?.flag || vnFlag} 
              style={{ 
                width: 24, 
                height: 16, 
                borderRadius: '1.5px', 
                objectFit: 'cover',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                display: 'block' 
              }} 
              alt={t(languagesList.find(l => l.code === language)?.name || 'Tiếng Việt')} 
            />
            <ChevronDown 
              size={12} 
              style={{ 
                color: 'var(--color-text-muted)',
                transform: isLangOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s'
              }} 
            />
          </button>

          <AnimatePresence>
            {isLangOpen && (
              <motion.div
                initial={{ opacity: 0, y: -15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0.05 }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '135px',
                  zIndex: 50,
                  transformOrigin: 'top right'
                }}
              >
                {languagesList.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsLangOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      background: language === lang.code ? 'var(--color-bg)' : 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: '0.8125rem',
                      fontWeight: language === lang.code ? 600 : 400,
                      textAlign: 'left',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => {
                      if (language !== lang.code) e.currentTarget.style.background = 'var(--color-bg)';
                    }}
                    onMouseLeave={e => {
                      if (language !== lang.code) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <img 
                      src={lang.flag} 
                      style={{ width: 20, height: 14, borderRadius: '1.5px', objectFit: 'cover', border: '1px solid rgba(0, 0, 0, 0.08)' }} 
                      alt={lang.name} 
                    />
                    {lang.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          onMouseEnter={() => setIsProfileMenuOpen(true)}
          onMouseLeave={() => setIsProfileMenuOpen(false)}
          style={{ position: 'relative' }}
        >
          <div 
            onClick={handleProfileClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              paddingLeft: '0.875rem',
              borderLeft: '1px solid var(--color-border)',
              cursor: (user?.role === 'admin' || user?.role === 'assistant' || user?.role === 'superadmin') ? 'pointer' : 'default',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'background 0.2s',
              background: isProfileMenuOpen ? 'var(--color-bg)' : 'transparent'
            }}
          >
            <Avatar src={user?.avatar} name={user?.name} size={32} />
            <div className="responsive-hide-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{user?.name || 'User'}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{getRoleLabel(user?.role)}</span>
            </div>
          </div>

          <AnimatePresence>
            {isProfileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0.05 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '150px',
                  zIndex: 50,
                  transformOrigin: 'top right'
                }}
              >
                {(user?.role === 'admin' || user?.role === 'assistant' || user?.role === 'superadmin') && (
                  <>
                    <button
                      onClick={handleProfileClick}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 10px',
                        border: 'none',
                        background: 'transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                        fontSize: '0.8125rem',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <User size={14} />
                      {t('Thông tin')}
                    </button>
                    <button
                      onClick={handleActivityClick}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 10px',
                        border: 'none',
                        background: 'transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                        fontSize: '0.8125rem',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Activity size={14} />
                      {t('Hoạt động (Nhật ký)')}
                    </button>
                  </>
                )}

                <a
                  href="https://zalo.me/0378859736"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: '0.8125rem',
                    textAlign: 'left',
                    textDecoration: 'none',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} />
                  {t('Báo lỗi')}
                </a>

                <div style={{ borderBottom: '1px solid var(--color-border)', margin: '4px 0' }} />

                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--color-danger)',
                    fontSize: '0.8125rem',
                    textAlign: 'left',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={14} />
                  {t('Đăng xuất')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    {/* App Launcher Modal (SIDEBAR items in card format) */}
    <CustomModal
      isOpen={isAppLauncherOpen}
      onClose={() => setIsAppLauncherOpen(false)}
      title={t("Menu điều hướng nhanh")}
      width="1160px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Search Input inside App Launcher */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          background: 'var(--color-bg-light)', 
          border: '1px solid var(--color-border)', 
          borderRadius: '12px', 
          padding: '10px 16px',
          flexShrink: 0
        }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            value={launcherSearch}
            onChange={(e) => setLauncherSearch(e.target.value)}
            placeholder={t("Tìm kiếm nhanh chức năng, cài đặt...")}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: '0.9375rem'
            }}
          />
          {launcherSearch && (
            <button 
              onClick={() => setLauncherSearch('')}
              style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}
            >
              {t("Xóa")}
            </button>
          )}
        </div>

        {(() => {
          const role = user?.role as string;
          const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin';
          
          const ITEM_DESC: Record<string, string> = {
            'Dashboard': 'Tổng quan số liệu kinh doanh & phễu chia lead',
            'Báo cáo': 'Báo cáo chi tiết cuộc gọi, tags và hiệu suất',
            'Khách hàng': 'Quản lý thông tin liên hệ và lịch sử KHTN',
            'Kho Data': 'Danh sách lead công khai chờ khai thác (Databank)',
            'Pipeline': 'Quản lý các thương vụ và trạng thái cơ hội',
            'Quy tắc phân bổ': 'Cấu hình roster, lịch trực và thứ tự chia lead',
            'Đối soát công bằng': 'Đối soát số lượng lead nhận và pending compensation',
            'AI Pre-screener': 'Trạng thái lead chờ duyệt và chấm điểm AI',
            'Ticket data lỗi': 'Báo cáo lỗi trùng lắp hoặc sai thông tin khách hàng',
            'Dự án': 'Xem danh sách và roster các dự án phân phối',
            'Chiến dịch': 'Chiến dịch marketing và nguồn phân bổ',
            'Tài liệu': 'Kho tài liệu mật và biểu mẫu của công ty',
            'Chi nhánh': 'Quản lý các văn phòng và chi nhánh',
            'Team': 'Danh sách các đội nhóm kinh doanh',
            'Nhân viên kinh doanh': 'Hồ sơ và lịch làm việc của tư vấn viên',
            'Quản lý chấm công': 'Báo cáo check-in và xin nghỉ phép',
            'Công ty': 'Quản lý danh mục đối tác doanh nghiệp',
            'Chủ đầu tư': 'Danh mục các chủ đầu tư dự án',
            'Giỏ hàng': 'Bảng giỏ hàng và danh mục căn hộ',
            'Hóa đơn': 'Danh sách thu chi và hóa đơn khách hàng',
            'Báo giá': 'Tạo và phê duyệt báo giá dịch vụ',
            'Chi phí vận hành': 'Báo cáo chi phí phát sinh theo dự án',
            'Tích hợp Data': 'Cấu hình webhook và liên kết Google Sheets',
            'Vòng đời khách hàng': 'Cài đặt trạng thái và chu kỳ chăm sóc',
            'Logic xử lý': 'Thiết lập quy định chặn, skip và check-in',
            'CAPI': 'Cấu hình sự kiện Meta Conversion API',
            'Quản lý tài khoản': 'Phân quyền tài khoản quản trị viên',
            'Phân quyền': 'Quản lý vai trò và phân quyền chi tiết',
            'Cài đặt hệ thống': 'Các thông số và cấu hình chung toàn hệ thống'
          };

          const CATEGORY_ICONS: Record<string, any> = {
            'TỔNG QUAN': LayoutDashboard,
            'KHÁCH HÀNG': Users,
            'DỰ ÁN': Building2,
            'NHÂN SỰ': Clock,
            'ĐỐI TÁC': Truck,
            'SẢN PHẨM': Boxes,
            'TÀI CHÍNH': Receipt,
            'CÀI ĐẶT HỆ THỐNG': Settings
          };

          const visibleGroups = SIDEBAR_GROUPS.map(group => {
            const filteredItems = group.items.filter((item: any) => {
              if (item.adminOnly && !isAdmin) return false;
              if (item.hideForRoles && item.hideForRoles.includes(role)) return false;
              return true;
            });
            return { ...group, items: filteredItems };
          }).filter(group => group.items.length > 0);

          // Flatten and filter items for global search
          const allVisibleItems = visibleGroups.flatMap(g => 
            g.items.map(item => ({ ...item, groupTitle: g.title }))
          );
          
          const filteredItems = launcherSearch.trim()
            ? allVisibleItems.filter(item => 
                item.name.toLowerCase().includes(launcherSearch.toLowerCase()) ||
                (ITEM_DESC[item.name] && ITEM_DESC[item.name].toLowerCase().includes(launcherSearch.toLowerCase())) ||
                item.groupTitle.toLowerCase().includes(launcherSearch.toLowerCase())
              )
            : [];

          return (
            <div style={{ paddingRight: '4px' }}>
              {launcherSearch.trim() ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h5 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    {t("Kết quả tìm kiếm")} ({filteredItems.length})
                  </h5>
                  {filteredItems.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
                      {filteredItems.map(item => {
                        const IconComponent = item.icon;
                        const desc = ITEM_DESC[item.name] || 'Xem chi tiết thông tin';
                        return (
                          <div
                            key={item.name}
                            onClick={() => {
                              navigate(item.href);
                              setIsAppLauncherOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px 14px',
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease-in-out',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--color-primary)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              const iconContainer = e.currentTarget.querySelector('.app-icon-container') as HTMLElement;
                              if (iconContainer) iconContainer.style.color = 'var(--color-primary)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--color-border)';
                              e.currentTarget.style.transform = 'none';
                                const iconContainer = e.currentTarget.querySelector('.app-icon-container') as HTMLElement;
                                if (iconContainer) iconContainer.style.color = 'var(--color-text-muted)';
                            }}
                          >
                            <div className="app-icon-container" style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.2s' }}>
                              <IconComponent size={18} strokeWidth={1.75} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>{t(item.name)}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{t(desc)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      {t("Không tìm thấy chức năng nào phù hợp.")}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {visibleGroups.map(group => (
                    <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, whiteSpace: 'nowrap' }}>
                          {t(group.title)}
                        </h4>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
                        {group.items.map(item => {
                          const IconComponent = item.icon;
                          const desc = ITEM_DESC[item.name] || 'Xem chi tiết thông tin';
                          return (
                            <div
                              key={item.name}
                              onClick={() => {
                                navigate(item.href);
                                setIsAppLauncherOpen(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 14px',
                                background: 'var(--color-bg)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                const iconContainer = e.currentTarget.querySelector('.app-icon-container') as HTMLElement;
                                if (iconContainer) iconContainer.style.color = 'var(--color-primary)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                e.currentTarget.style.transform = 'none';
                                const iconContainer = e.currentTarget.querySelector('.app-icon-container') as HTMLElement;
                                if (iconContainer) iconContainer.style.color = 'var(--color-text-muted)';
                              }}
                            >
                              <div className="app-icon-container" style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.2s' }}>
                                <IconComponent size={18} strokeWidth={1.75} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>{t(item.name)}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{t(desc)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </CustomModal>

    {/* Global Command/Search Palette Modal */}
    <CustomModal
      isOpen={isSearchOpen}
      onClose={() => setIsSearchOpen(false)}
      title={t("Tìm kiếm toàn hệ thống")}
      width="600px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Search Input Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '8px 12px' }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)' }} />
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Nhập tên, số điện thoại, email hoặc trang cần tìm...")}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: '0.9375rem',
              padding: '4px 0'
            }}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}
            >
              {t("Xóa")}
            </button>
          )}
        </div>

        {/* Results Area */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '4px' }}>
          {/* 1. Pages/Navigation Results */}
          {filteredNavItems.length > 0 && (
            <div>
              <h5 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
                {t("Liên kết nhanh")} ({filteredNavItems.length})
              </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredNavItems.map((item) => (
                    <div
                      key={item.path}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        } else {
                          navigate(item.path);
                        }
                        setIsSearchOpen(false);
                      }}
                      className="search-result-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: '1px solid transparent'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{item.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.description}</span>
                      </div>
                      {item.shortcut && (
                        <kbd className="shortcuts-kbd" style={{ fontSize: '0.6875rem', padding: '2px 6px' }}>{item.shortcut}</kbd>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Lead Results */}
            {searchQuery.trim() !== '' && (
              <div>
                <h5 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t("Kết quả Dữ liệu Lead")}
                  {searching && <span style={{ fontSize: '0.6875rem', textTransform: 'none', fontWeight: 500, color: 'var(--color-primary)' }}>{t("Đang tìm...")}</span>}
                </h5>
                {leadResults.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {leadResults.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => {
                          navigate(`/data?search=${encodeURIComponent(lead.phone || lead.lead_name)}`);
                          setIsSearchOpen(false);
                        }}
                        className="search-result-item"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: '1px solid transparent'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {lead.lead_name || t('Ẩn danh')}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                            SĐT: {lead.phone ? maskPhone(lead.phone) : '-'} | Email: {lead.email || '-'}
                          </span>
                          {lead.note && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                              {t('Ghi chú')}: {lead.note}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: '4px' }}>
                            {lead.source || t('Nguồn khác')}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                            {lead.assigned_to_name ? `${t('Sale')}: ${lead.assigned_to_name}` : t('Chưa giao')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !searching && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: '12px', textAlign: 'center', background: 'var(--color-bg)', borderRadius: '8px' }}>
                      {t("Không tìm thấy lead nào khớp với từ khóa")} "{searchQuery}"
                    </div>
                  )
                )}
              </div>
            )}

            {/* 3. Empty Search Helper */}
            {!searchQuery.trim() && filteredNavItems.length === 0 && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: '16px', textAlign: 'center' }}>
                {t("Bắt đầu gõ để tìm kiếm trang quản trị hoặc thông tin lead...")}
              </div>
            )}
          </div>
        </div>

        <style>{`
          .search-result-item:hover {
            background: var(--color-primary-light) !important;
            border-color: rgba(189, 29, 45, 0.15) !important;
          }
        `}</style>
      </CustomModal>

      {user?.role === 'sale' && (!headerCheckIn || headerCheckIn.status === 'rejected') && (
        <button
          onClick={() => {
            localStorage.setItem('trigger_checkin', '1');
            window.dispatchEvent(new CustomEvent('trigger-checkin-modal'));
          }}
          style={{
            position: 'fixed',
            bottom: 88,
            right: 24,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
            zIndex: 90,
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            outline: 'none'
          }}
          title={t('Chấm công ngay')}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Fingerprint size={24} />
        </button>
      )}
    </header>
  );
};

