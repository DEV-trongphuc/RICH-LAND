import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, GitBranch, Settings, ChevronLeft, Webhook, Link2, Database, ShieldCheck, Ticket, Plus, Scale, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useEffect, useState, Fragment } from 'react';
import { fetchAPI } from '../../utils/api';

const ALL_NAV_ITEMS = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
  { name: 'Quản lý Data', href: '/data', icon: Database },
  { name: 'Vòng phân bổ', href: '/rounds', icon: GitBranch, adminOnly: true },
  { name: 'Logic xử lý', href: '/rules', icon: Webhook, adminOnly: true },
  { name: 'Tư vấn viên', href: '/consultants', icon: Users, adminOnly: true },
  { name: 'Ticket Lỗi Data', href: '/tickets', icon: Ticket, adminOnly: true, badgeKey: 'tickets' },
  { name: 'AI Pre-screener', href: '/gatekeeper', icon: Filter, adminOnly: true, badgeKey: 'gatekeeper' },
  { name: 'Đối soát công bằng', href: '/fair-share', icon: Scale, adminOnly: true },
  { name: 'Tích hợp', href: '/integrations', icon: Link2, adminOnly: true },
  { name: 'Cài đặt hệ thống', href: '/settings', icon: Settings, adminOnly: true },
  { name: 'Quản lý Tài khoản', href: '/accounts', icon: ShieldCheck, adminOnly: true },
];

export const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose }: { isCollapsed: boolean; onToggleCollapse: () => void; isMobileOpen?: boolean; onMobileClose?: () => void }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [pendingTickets, setPendingTickets] = useState(0);
  const [heldLeadsCount, setHeldLeadsCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Poll pending ticket count every 60s
  useEffect(() => {
    if (user?.role !== 'admin') return;
    const fetchPending = async () => {
      try {
        const [resReports, resHeld] = await Promise.all([
          fetchAPI('get_reports&status=pending'),
          fetchAPI('get_held_leads&pageSize=1&date=all')
        ]);
        
        let countReports = 0;
        let countHeld = 0;
        
        if (resReports.success) {
          countReports = resReports.stats?.pending ?? (resReports.data ? resReports.data.filter((r: any) => r.status === 'pending').length : 0);
        }
        
        if (resHeld.success) {
          countHeld = resHeld.total_count ?? 0;
        }
        
        setPendingTickets(countReports);
        setHeldLeadsCount(countHeld);
      } catch { /* silent */ }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    window.addEventListener('ticket-resolved', fetchPending);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ticket-resolved', fetchPending);
    };
  }, [user]);

  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    return true;
  });

  return (
    <>
      {isMobileOpen && (
        <div
          className="responsive-sidebar-overlay"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`responsive-sidebar ${isMobileOpen ? 'responsive-sidebar-open' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: isCollapsed ? 72 : 260,
          background: '#1e1246',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 50,
          boxShadow: '4px 0 24px rgba(0,0,0,0.12)'
        }}
      >
        {/* Logo Area */}
        <div style={{
          height: 92,
          display: 'flex',
          alignItems: 'center',
          padding: isCollapsed ? '20px 0 0 0' : '20px 1.25rem 0 1.25rem',
          gap: '0.875rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          overflow: 'hidden'
        }}>
          {/* Logo Icon */}
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(192, 132, 252, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            border: '2px solid rgba(192, 132, 252, 0.8)'
          }}>
            <img src="https://crm-domation.vercel.app/LOGO.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo" />
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, whiteSpace: 'nowrap', color: 'white', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                DOMATION
              </span>
              <span style={{
                fontSize: '0.625rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #d8b4fe 0%, #c084fc 50%, #a855f7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginTop: '4px',
                whiteSpace: 'nowrap'
              }}>
                / DATA AUTOMATION
              </span>
            </div>
          )}
        </div>

        {/* Quick Action Button */}
        <div style={{ padding: isCollapsed ? '0.75rem 0.5rem' : '1.25rem 1rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {isCollapsed ? (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-quick-add-lead'))}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              title={t("Thêm Data Nhanh")}
            >
              <Plus size={20} />
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-quick-add-lead'))}
              style={{
                width: '100%', height: 44, borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.5)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.4)';
              }}
            >
              <Plus size={18} /> {t("Thêm Data Nhanh")}
            </button>
          )}
        </div>

        {/* Collapse Button */}
        <button
          onClick={onToggleCollapse}
          className="responsive-hide-mobile"
          style={{
            position: 'absolute', right: -12, top: 36, transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: 'white', color: '#1e1246',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 200, border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.2s',
            opacity: isHovered || isCollapsed ? 1 : 0,
            visibility: isHovered || isCollapsed ? 'visible' : 'hidden',
            pointerEvents: isHovered || isCollapsed ? 'auto' : 'none'
          }}
        >
          <ChevronLeft size={14} style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
        </button>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
          <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>
            {!isCollapsed && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                padding: '0.5rem 1.5rem', whiteSpace: 'nowrap'
              }}>{t("Chức năng chính")}</span>
            )}

            {NAV_ITEMS.map(({ name, href, icon: Icon, end, badgeKey }) => {
              const badgeCount = badgeKey === 'tickets' ? pendingTickets : badgeKey === 'gatekeeper' ? heldLeadsCount : 0;
              const isSettingsGroupStart = href === '/gatekeeper';
              return (
                <Fragment key={href}>
                  {isSettingsGroupStart && !isCollapsed && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                      padding: '1.25rem 1.5rem 0.5rem 1.5rem', whiteSpace: 'nowrap',
                      display: 'block'
                    }}>{t("Cài đặt hệ thống")}</span>
                  )}
                  <NavLink
                    to={href}
                    end={end}
                    title={isCollapsed ? t(name) : undefined}
                    onClick={(e) => {
                      if (location.pathname === href) {
                        e.preventDefault();
                        return;
                      }
                      if (onMobileClose) onMobileClose();
                    }}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: '0.875rem',
                      padding: isCollapsed ? '0.75rem 0' : '0.75rem 1.5rem',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                      textDecoration: 'none', fontSize: '0.9375rem',
                      fontWeight: isActive ? 700 : 500, transition: 'all 0.2s ease',
                      position: 'relative',
                      background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active indicator */}
                        {isActive && (
                          <span style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: 4, background: 'var(--color-primary)', borderRadius: '0 2px 2px 0'
                          }} />
                        )}

                        {/* Icon Box — with badge dot when collapsed */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.2s', position: 'relative'
                        }}>
                          <Icon size={18} color={isActive ? 'white' : 'rgba(255,255,255,0.5)'} />
                          {/* Collapsed badge dot */}
                          {isCollapsed && badgeCount > 0 && (
                            <span style={{
                              position: 'absolute', top: 4, right: 4,
                              width: 8, height: 8, borderRadius: '50%',
                              background: '#ef4444',
                              boxShadow: '0 0 0 2px #1e1246'
                            }} />
                          )}
                        </div>

                        {/* Label + badge count when expanded */}
                        {!isCollapsed && (
                          <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {t(name)}
                            {badgeCount > 0 && (
                              <span style={{
                                background: '#ef4444', color: 'white',
                                fontSize: '0.65rem', fontWeight: 800,
                                padding: '2px 7px', borderRadius: 20,
                                minWidth: 20, textAlign: 'center',
                                lineHeight: '1.4',
                                boxShadow: '0 2px 4px rgba(239,68,68,0.4)',
                                animation: 'pulse 2s infinite'
                              }}>
                                {badgeCount}
                              </span>
                            )}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </Fragment>
              );
            })}
          </div>
        </div>



        {/* Pulse animation */}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }`}</style>
      </aside>
    </>
  );
};
