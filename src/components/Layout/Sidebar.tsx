import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, GitBranch, Settings, ChevronLeft, Webhook, Link2, Database, ShieldCheck, Ticket, Plus, Scale, Filter, Cpu, Building2, TrendingUp, FileText, Calendar, Package, Receipt, CreditCard, BarChart2, Truck, File, Boxes, Layers, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useEffect, useState, useRef, Fragment } from 'react';
import { fetchAPI } from '../../utils/api';

interface SidebarItem {
  name: string;
  href: string;
  icon: any;
  end?: boolean;
  adminOnly?: boolean;
  badgeKey?: string;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    title: 'TỔNG QUAN',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
      { name: 'Báo cáo', href: '/reports-crm', icon: BarChart2 }
    ]
  },
  {
    title: 'KHÁCH HÀNG',
    items: [
      { name: 'Khách hàng', href: '/contacts', icon: Users },
      { name: 'Kho Data', href: '/data', icon: Database },
      { name: 'Pipeline', href: '/deals', icon: TrendingUp },
      { name: 'Quy tắc phân bổ', href: '/rounds', icon: GitBranch, adminOnly: true },
      { name: 'Đối soát công bằng', href: '/fair-share', icon: Scale, adminOnly: true },
      { name: 'AI Pre-screener', href: '/gatekeeper', icon: Filter, adminOnly: true, badgeKey: 'gatekeeper' },
      { name: 'Ticket data lỗi', href: '/tickets', icon: Ticket, adminOnly: true, badgeKey: 'tickets' }
    ]
  },
  {
    title: 'DỰ ÁN',
    items: [
      { name: 'Dự án', href: '/projects', icon: Building2 },
      { name: 'Chiến dịch', href: '/projects?tab=campaigns', icon: Layers },
      { name: 'Tài liệu', href: '/files', icon: File }
    ]
  },
  {
    title: 'NHÂN SỰ',
    items: [
      { name: 'Chi nhánh', href: '/consultants?tab=branches', icon: Building2 },
      { name: 'Team', href: '/consultants?tab=teams', icon: Users },
      { name: 'Nhân viên kinh doanh', href: '/consultants', icon: Users, adminOnly: true },
      { name: 'Quản lý chấm công', href: '/attendance', icon: Clock, adminOnly: true }
    ]
  },
  {
    title: 'ĐỐI TÁC',
    items: [
      { name: 'Công ty', href: '/companies', icon: Building2 },
      { name: 'Chủ đầu tư', href: '/suppliers', icon: Truck }
    ]
  },
  {
    title: 'SẢN PHẨM',
    items: [
      { name: 'Giỏ hàng', href: '/inventory', icon: Boxes }
    ]
  },
  {
    title: 'TÀI CHÍNH',
    items: [
      { name: 'Hóa đơn', href: '/invoices', icon: Receipt },
      { name: 'Báo giá', href: '/quotes', icon: FileText, adminOnly: true },
      { name: 'Chi phí vận hành', href: '/expenses', icon: CreditCard, adminOnly: true }
    ]
  },
  {
    title: 'CÀI ĐẶT HỆ THỐNG',
    items: [
      { name: 'Tích hợp Data', href: '/integrations', icon: Link2, adminOnly: true },
      { name: 'Vòng đời khách hàng', href: '/settings?tab=lifecycle', icon: Settings, adminOnly: true },
      { name: 'Logic xử lý', href: '/rules', icon: Webhook, adminOnly: true },
      { name: 'CAPI', href: '/capi', icon: Link2, adminOnly: true },
      { name: 'Quản lý tài khoản', href: '/accounts', icon: ShieldCheck },
      { name: 'Phân quyền', href: '/accounts?tab=permissions', icon: ShieldCheck, adminOnly: true },
      { name: 'Cài đặt hệ thống', href: '/settings', icon: Settings, adminOnly: true }
    ]
  }
];

export const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose }: { isCollapsed: boolean; onToggleCollapse: () => void; isMobileOpen?: boolean; onMobileClose?: () => void }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [pendingTickets, setPendingTickets] = useState(0);
  const [heldLeadsCount, setHeldLeadsCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const [sliderStyle, setSliderStyle] = useState({ top: 0, height: 0 });
  const navContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (navContainerRef.current) {
        const activeElement = navContainerRef.current.querySelector('.active') as HTMLElement;
        if (activeElement) {
          setSliderStyle({
            top: activeElement.offsetTop,
            height: activeElement.offsetHeight
          });
        } else {
          setSliderStyle({ top: 0, height: 0 });
        }
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [location.pathname, isCollapsed]);

  // Poll pending ticket count every 60s
  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'superadmin') return;
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

  const visibleGroups = SIDEBAR_GROUPS.map(group => {
    const filteredItems = group.items.filter(item => {
      const role = user?.role as string;
      const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin';

      if (item.adminOnly) {
        return isAdmin;
      }
      return true;
    });
    return { ...group, items: filteredItems };
  }).filter(group => group.items.length > 0);

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
          background: 'var(--sidebar-bg)',
          color: '#dadada',
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
            background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(189, 29, 45, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            border: '2px solid rgba(189, 29, 45, 0.8)'
          }}>
            <img src="/LOGO.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo" />
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, whiteSpace: 'nowrap', color: 'white', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                RICH LAND
              </span>
              <span style={{
                fontSize: '0.625rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #f45b69 0%, #e63946 50%, #BD1D2D 100%)',
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
          {((user?.role as string) === 'sale' || (user?.role as string) === 'sales') ? (
            isCollapsed ? (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-ai-infinity-view'));
                  if (onMobileClose) onMobileClose();
                }}
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                  color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(189, 29, 45, 0.4)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                title={t("AI Infinity")}
              >
                <Cpu size={18} />
              </button>
            ) : (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-ai-infinity-view'));
                  if (onMobileClose) onMobileClose();
                }}
                className="btn primary"
                style={{
                  width: '100%', height: 38, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                  color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(189, 29, 45, 0.4)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(189, 29, 45, 0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(189, 29, 45, 0.4)';
                }}
              >
                <Cpu size={16} /> {t("AI Infinity")}
              </button>
            )
          ) : (
            isCollapsed ? (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                  if (onMobileClose) onMobileClose();
                }}
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a31422 0%, #a31422 100%)',
                  color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(163, 20, 34, 0.4)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                title={t("Thêm Data Nhanh")}
              >
                <Plus size={18} />
              </button>
            ) : (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                  if (onMobileClose) onMobileClose();
                }}
                className="btn primary"
                style={{
                  width: '100%', height: 38, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #a31422 0%, #a31422 100%)',
                  color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(163, 20, 34, 0.4)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(163, 20, 34, 0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(163, 20, 34, 0.4)';
                }}
              >
                <Plus size={16} /> {t("Thêm Data Nhanh")}
              </button>
            )
          )}
        </div>

        {/* Collapse Button */}
        <button
          onClick={onToggleCollapse}
          className="responsive-hide-mobile"
          style={{
            position: 'absolute', right: -12, top: 36, transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: 'var(--color-surface)', color: 'var(--color-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 200, border: '1px solid var(--color-border)',
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
          <div ref={navContainerRef} style={{ position: 'relative', padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>

            {/* Sliding Active Indicator */}
            {sliderStyle.height > 0 && (
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 4,
                height: sliderStyle.height,
                background: 'var(--color-primary)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: `translateY(${sliderStyle.top}px)`,
                borderRadius: '0 2px 2px 0',
                pointerEvents: 'none',
                zIndex: 10
              }} />
            )}

            {visibleGroups.map((group, groupIdx) => (
              <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: isCollapsed ? '0.5rem' : '1.25rem' }}>
                {!isCollapsed && (
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.28)',
                    padding: '0.5rem 1.5rem',
                    whiteSpace: 'nowrap',
                    display: 'block'
                  }}>
                    {t(group.title)}
                  </span>
                )}
                {group.items.map(({ name, href, icon: Icon, end, badgeKey }) => {
                  const badgeCount = badgeKey === 'tickets' ? pendingTickets : badgeKey === 'gatekeeper' ? heldLeadsCount : 0;
                  const isActive = location.pathname + location.search === href || (href.indexOf('?') === -1 && location.pathname === href);

                  return (
                    <NavLink
                      key={name + href}
                      to={href}
                      end={end}
                      className={() => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                      title={isCollapsed ? t(name) : undefined}
                      onClick={(e) => {
                        if (location.pathname + location.search === href) {
                          e.preventDefault();
                          return;
                        }
                        if (onMobileClose) onMobileClose();
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.875rem',
                        padding: isCollapsed ? '0.75rem 0' : '0.625rem 1.5rem',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        color: isActive ? '#dadada' : 'rgba(255,255,255,0.5)',
                        textDecoration: 'none', fontSize: '0.9rem',
                        fontWeight: isActive ? 700 : 500, transition: 'all 0.2s ease',
                        position: 'relative',
                        background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                        whiteSpace: 'nowrap', overflow: 'hidden',
                      }}
                    >
                      {() => (
                        <>
                          {/* Icon Box — with badge dot when collapsed */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 0.2s', position: 'relative'
                          }}>
                            <Icon size={18} color={isActive ? '#dadada' : 'rgba(255,255,255,0.5)'} />
                            {isCollapsed && badgeCount > 0 && (
                              <div style={{
                                position: 'absolute', top: 4, right: 4, width: 8, height: 8,
                                borderRadius: '50%', background: badgeKey === 'gatekeeper' ? '#f59e0b' : '#ef4444'
                              }} />
                            )}
                          </div>

                          {!isCollapsed && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                              <span>{t(name)}</span>
                              {badgeCount > 0 && (
                                <span style={{
                                  fontSize: '0.7rem',
                                  minWidth: '18px',
                                  height: '18px',
                                  borderRadius: '9px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: badgeCount > 9 ? '0 5px' : '0',
                                  background: badgeKey === 'gatekeeper' ? '#f59e0b' : '#ef4444',
                                  color: 'white',
                                  fontWeight: 700,
                                  lineHeight: 1
                                }}>
                                  {badgeCount}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>
        </div>



        {/* Pulse animation */}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }`}</style>
      </aside>
    </>
  );
};
