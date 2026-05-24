import { useState, useEffect } from 'react';
import { Menu, Search, Command, Activity, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';

export const Header = ({ onMenuClick, onActivityFeedClick }: { onMenuClick: () => void; onActivityFeedClick: () => void }) => {
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
        <button onClick={onMenuClick} className="lg:hidden" style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-light)', borderRadius: 8, transition: 'all 0.2s'
        }}>
          <Menu size={20} />
        </button>

        {/* Search trigger */}
        <button style={{
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
          transition: 'border-color 0.2s'
        }} className="responsive-search-box">
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
    </header>
  );
};

