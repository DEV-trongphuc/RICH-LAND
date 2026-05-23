import { Menu, Search, Command, Activity } from 'lucide-react';

export const Header = ({ onMenuClick, onActivityFeedClick }: { onMenuClick: () => void; onActivityFeedClick: () => void }) => {
  const isDemo = localStorage.getItem('DOMATION_DEMO_MODE') === 'true';
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

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          paddingLeft: '0.875rem',
          borderLeft: '1px solid var(--color-border)',
          cursor: 'pointer'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '0.7rem', fontWeight: 700
          }}>AD</div>
          <div className="responsive-hide-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>Admin System</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>Quản trị viên</span>
          </div>
        </div>
      </div>
    </header>
  );
};

