import { Menu, Search, Command } from 'lucide-react';

export const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
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
