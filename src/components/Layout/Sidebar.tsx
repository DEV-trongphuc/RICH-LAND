import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, GitBranch, Settings, ChevronLeft, LogOut, Webhook, Link2, Database, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const ALL_NAV_ITEMS = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
  { name: 'Quản lý Data', href: '/data', icon: Database },
  { name: 'Tích hợp', href: '/integrations', icon: Link2, adminOnly: true },
  { name: 'Vòng phân bổ', href: '/rounds', icon: GitBranch, adminOnly: true },
  { name: 'Luật xử lý', href: '/rules', icon: Webhook, adminOnly: true },
  { name: 'Cài đặt hệ thống', href: '/settings', icon: Settings, adminOnly: true },
  { name: 'Tư vấn viên', href: '/consultants', icon: Users, adminOnly: true },
  { name: 'Quản lý Tài khoản', href: '/accounts', icon: ShieldCheck, adminOnly: true },
];

export const Sidebar = ({ isCollapsed, onToggleCollapse }: { isCollapsed: boolean; onToggleCollapse: () => void }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside style={{
      width: isCollapsed ? 72 : 260,
      background: '#1e1246',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 20,
      boxShadow: '4px 0 24px rgba(0,0,0,0.12)'
    }}>
      {/* Logo Area */}
      <div style={{
        height: 72,
        display: 'flex',
        alignItems: 'center',
        padding: isCollapsed ? '0' : '0 1.25rem',
        gap: '0.875rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        overflow: 'hidden'
      }}>
        {/* Logo Icon */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}>
          <img src="https://crm-domation.vercel.app/LOGO.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            alt="logo" />
        </div>

        {!isCollapsed && (
          <span style={{
            fontSize: '1.1rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            flex: 1,
            letterSpacing: '-0.02em'
          }}>DOMATION</span>
        )}
      </div>

      {/* Collapse Button */}
      <button
        onClick={onToggleCollapse}
        style={{
          position: 'absolute',
          right: -12,
          top: 36,
          transform: 'translateY(-50%)',
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'white',
          color: '#1e1246',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 200,
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.2s'
        }}
      >
        <ChevronLeft size={14} style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
      </button>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
        <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>
          {!isCollapsed && (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.3)',
              padding: '0.5rem 1.5rem',
              whiteSpace: 'nowrap'
            }}>Chức năng chính</span>
          )}

          {NAV_ITEMS.map(({ name, href, icon: Icon, end }) => (
            <NavLink
              key={href}
              to={href}
              end={end}
              title={isCollapsed ? name : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: isCollapsed ? '0.75rem 0' : '0.75rem 1.5rem',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                textDecoration: 'none',
                fontSize: '0.9375rem',
                fontWeight: isActive ? 700 : 500,
                transition: 'all 0.2s ease',
                position: 'relative',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator */}
                  {isActive && (
                    <span style={{
                      position: 'absolute',
                      left: 0, top: 0, bottom: 0,
                      width: 4,
                      background: 'var(--color-primary)',
                      borderRadius: '0 2px 2px 0'
                    }} />
                  )}

                  {/* Icon Box */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s'
                  }}>
                    <Icon size={18} color={isActive ? 'white' : 'rgba(255,255,255,0.5)'} />
                  </div>

                  {!isCollapsed && <span>{name}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Footer User */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '0.75rem',
        background: 'rgba(0,0,0,0.15)',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.625rem',
          borderRadius: 10,
          cursor: 'pointer',
          justifyContent: isCollapsed ? 'center' : 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0
            }}>{user?.name?.[0]?.toUpperCase() || 'U'}</div>

            {!isCollapsed && (
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'User'}</p>
                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>{user?.role}</p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={handleLogout}
              style={{ color: 'rgba(255,255,255,0.3)', padding: 6, borderRadius: 8, transition: 'all 0.2s', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
              title="Đăng xuất"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>

        {isCollapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <button
              onClick={handleLogout}
              style={{ color: 'rgba(255,255,255,0.3)', padding: 6, borderRadius: 8, transition: 'all 0.2s', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
              title="Đăng xuất"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
