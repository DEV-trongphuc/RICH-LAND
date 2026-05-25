import { useState, useEffect } from 'react';
import { Search, Command, Activity, Sun, Moon, Keyboard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { useNavigate } from 'react-router-dom';
import { CustomModal } from '../ui/CustomModal';
import { fetchAPI } from '../../utils/api';

export const Header = ({ onActivityFeedClick }: { onActivityFeedClick: () => void }) => {
  const isDemo = localStorage.getItem('DOMATION_DEMO_MODE') === 'true';
  const { user } = useAuth();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  // Listen to system changes if theme is not set
  useEffect(() => {
    const localTheme = localStorage.getItem('domation_theme') as 'light' | 'dark';
    if (localTheme) {
      setTheme(localTheme);
      document.documentElement.setAttribute('data-theme', localTheme);
    } else {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('domation_theme', nextTheme);
    window.dispatchEvent(new Event('theme-change'));
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin': return 'Quản trị viên';
      case 'assistant': return 'Trợ lý';
      case 'viewer': return 'Người xem';
      case 'sale': return 'Tư vấn viên';
      default: return 'Người dùng';
    }
  };

  const handleProfileClick = () => {
    if (user?.role === 'admin' || user?.role === 'assistant') {
      window.dispatchEvent(new CustomEvent('open-profile-modal'));
    }
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [leadResults, setLeadResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

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
        const json = await fetchAPI(`get_logs&search=${encodeURIComponent(searchQuery)}`);
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

  const navItems: Array<{ name: string; path: string; description: string; shortcut: string; adminOnly?: boolean; action?: () => void }> = [
    { name: 'Dashboard', path: '/', description: 'Trang tổng quan thống kê hệ thống', shortcut: 'Alt + D' },
    { name: 'Nhật ký Lead (Data Log)', path: '/data', description: 'Xem logs danh sách lead và trạng thái cuộc gọi', shortcut: 'Alt + L' },
    { name: 'Bản tin hoạt động hệ thống', path: '#feed', description: 'Bản tin các hoạt động và phân bổ lead gần đây', shortcut: 'Alt + H', action: () => window.dispatchEvent(new CustomEvent('open-activity-feed')) },
    { name: 'Vòng xoay chia số (Rounds)', path: '/rounds', description: 'Cấu hình danh sách các vòng chia lead cho sale', adminOnly: true, shortcut: 'Alt + R' },
    { name: 'Quy tắc chia số (Rules)', path: '/rules', description: 'Thiết lập logic điều phối và skip interval', adminOnly: true, shortcut: 'Alt + W' },
    { name: 'Quản lý Tư vấn viên (Consultants)', path: '/consultants', description: 'Quản lý danh sách sale reps và trạng thái trực ca', adminOnly: true, shortcut: 'Alt + C' },
    { name: 'Ticket báo lỗi data', path: '/tickets', description: 'Phê duyệt đền bù lead lỗi hoặc trùng', adminOnly: true, shortcut: 'Alt + T' },
    { name: 'Đối soát công bằng (Fair Share)', path: '/fair-share', description: 'Đo lường độ lệch phân phối lead', adminOnly: true, shortcut: 'Alt + S' },
    { name: 'Tích hợp API & Google Sheets', path: '/integrations', description: 'Kết nối webhook và đồng bộ trang tính', adminOnly: true, shortcut: 'Alt + I' },
    { name: 'Cài đặt hệ thống', path: '/settings', description: 'Cài đặt quy chuẩn và dọn dẹp dữ liệu', adminOnly: true, shortcut: 'Alt + O' },
    { name: 'Quản lý tài khoản', path: '/accounts', description: 'Phân quyền tài khoản quản trị và trợ lý', adminOnly: true, shortcut: 'Alt + A' }
  ];

  const visibleNavItems = navItems.filter(item => !item.adminOnly || user?.role === 'admin');
  
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
            transition: 'color 0.2s',
            outline: 'none'
          }}
          title="Bảng phím tắt điều hướng nhanh (?)"
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--color-primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--color-text-muted)';
          }}
        >
          <Keyboard size={20} />
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
          className="responsive-search-box"
        >
          <Search size={16} />
          <span className="responsive-hide-mobile">Tìm kiếm toàn hệ thống...</span>
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
          title="Bản tin hoạt động hệ thống"
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
          title={theme === 'light' ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng"}
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

        <div 
          onClick={handleProfileClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            paddingLeft: '0.875rem',
            borderLeft: '1px solid var(--color-border)',
            cursor: (user?.role === 'admin' || user?.role === 'assistant') ? 'pointer' : 'default',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => {
            if (user?.role === 'admin' || user?.role === 'assistant') {
              e.currentTarget.style.background = 'var(--color-bg)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Avatar src={user?.avatar} name={user?.name} size={32} />
          <div className="responsive-hide-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{user?.name || 'User'}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{getRoleLabel(user?.role)}</span>
          </div>
        </div>
      </div>

      {/* Global Command/Search Palette Modal */}
      <CustomModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        title="Tìm kiếm toàn hệ thống"
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
              placeholder="Nhập tên, số điện thoại, email hoặc trang cần tìm..."
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
                Xóa
              </button>
            )}
          </div>

          {/* Results Area */}
          <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '4px' }}>
            {/* 1. Pages/Navigation Results */}
            {filteredNavItems.length > 0 && (
              <div>
                <h5 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
                  Liên kết nhanh ({filteredNavItems.length})
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
                  Kết quả Dữ liệu Lead
                  {searching && <span style={{ fontSize: '0.6875rem', textTransform: 'none', fontWeight: 500, color: 'var(--color-primary)' }}>Đang tìm...</span>}
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
                            {lead.lead_name || 'Ẩn danh'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                            SĐT: {lead.phone || '-'} | Email: {lead.email || '-'}
                          </span>
                          {lead.note && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                              Ghi chú: {lead.note}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: '4px' }}>
                            {lead.source || 'Nguồn khác'}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                            {lead.assigned_to_name ? `Sale: ${lead.assigned_to_name}` : 'Chưa giao'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !searching && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: '12px', textAlign: 'center', background: 'var(--color-bg)', borderRadius: '8px' }}>
                      Không tìm thấy lead nào khớp với từ khóa "{searchQuery}"
                    </div>
                  )
                )}
              </div>
            )}

            {/* 3. Empty Search Helper */}
            {!searchQuery.trim() && filteredNavItems.length === 0 && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: '16px', textAlign: 'center' }}>
                Bắt đầu gõ để tìm kiếm trang quản trị hoặc thông tin lead...
              </div>
            )}
          </div>
        </div>

        <style>{`
          .search-result-item:hover {
            background: var(--color-primary-light) !important;
            border-color: rgba(99, 102, 241, 0.15) !important;
          }
        `}</style>
      </CustomModal>
    </header>
  );
};

