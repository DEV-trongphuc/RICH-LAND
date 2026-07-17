import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, GitBranch, Settings, ChevronLeft, Webhook, Link2, Database, ShieldCheck, Ticket, Plus, Scale, Filter, Cpu, Building2, TrendingUp, FileText, Calendar, Package, Receipt, CreditCard, BarChart2, Truck, File, Boxes, Layers, Clock, Home, CheckSquare, LifeBuoy, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useEffect, useState, useRef, Fragment } from 'react';
import { fetchAPI } from '../../utils/api';

export interface SidebarItem {
  name: string;
  href: string;
  icon: any;
  end?: boolean;
  adminOnly?: boolean;
  badgeKey?: string;
  hideForRoles?: string[];
}

export interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    title: 'TỔNG QUAN',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
      { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
      { name: 'Báo cáo', href: '/reports-crm', icon: BarChart2 },
      { name: 'Kho Databank', href: '/databank', icon: Layers, hideForRoles: ['viewer'] }
    ]
  },
  {
    title: 'KHÁCH HÀNG',
    items: [
      { name: 'Khách hàng', href: '/contacts', icon: Users },
      { name: 'Pipeline', href: '/deals', icon: TrendingUp },
      { name: 'Lịch biểu', href: '/calendar', icon: Calendar },
      { name: 'Kho Data', href: '/data', icon: Database, hideForRoles: ['sale'] },
      { name: 'Quy tắc phân bổ', href: '/rounds', icon: GitBranch, adminOnly: true, hideForRoles: ['manager', 'assistant', 'sale', 'sales'] },
      { name: 'Đối soát công bằng', href: '/fair-share', icon: Scale },
      { name: 'AI Pre-screener', href: '/gatekeeper', icon: Filter, adminOnly: true, badgeKey: 'gatekeeper', hideForRoles: ['manager', 'assistant', 'sale', 'sales'] },
      { name: 'Ticket data lỗi', href: '/tickets', icon: Ticket, badgeKey: 'tickets' },
      { name: 'Ticket hỗ trợ', href: '/support-tickets', icon: LifeBuoy }
    ]
  },
  {
    title: 'DỰ ÁN & SẢN PHẨM',
    items: [
      { name: 'Dự án', href: '/projects', icon: Building2 },
      { name: 'Giỏ hàng', href: '/inventory', icon: Boxes },
      { name: 'Chiến dịch', href: '/projects?tab=campaigns', icon: Layers },
      { name: 'Tài liệu', href: '/files', icon: File },
      { name: 'Công ty', href: '/companies', icon: Building2 },
      { name: 'Chủ đầu tư', href: '/suppliers', icon: Truck }
    ]
  },
  {
    title: 'TÀI CHÍNH',
    items: [
      { name: 'Báo giá', href: '/quotes', icon: FileText, hideForRoles: ['viewer'] },
      { name: 'Phiếu đặt cọc', href: '/deposits', icon: Receipt, hideForRoles: ['viewer'] },
      { name: 'Phiếu hợp tác', href: '/cooperation-slips', icon: Scale, hideForRoles: ['admin', 'superadmin', 'super_admin', 'manager', 'director'], badgeKey: 'coopSlips' },
      { name: 'Duyệt hợp tác', href: '/cooperation-slips', icon: Scale, hideForRoles: ['sale', 'viewer', 'sales'], badgeKey: 'coopSlips' },
      { name: 'Hóa đơn', href: '/invoices', icon: Receipt, hideForRoles: ['viewer'] },
      { name: 'Chi phí vận hành', href: '/expenses', icon: CreditCard, hideForRoles: ['sale', 'viewer', 'sales'] }
    ]
  },
  {
    title: 'NHÂN SỰ',
    items: [
      { name: 'Tài khoản cá nhân', href: '/account', icon: User },
      { name: 'Chi nhánh', href: '/consultants?tab=branches', icon: Building2, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales'] },
      { name: 'Team', href: '/consultants?tab=teams', icon: Users, hideForRoles: ['assistant', 'viewer'] },
      { name: 'Nhân viên kinh doanh', href: '/consultants', icon: Users, hideForRoles: ['assistant', 'viewer'] },
      { name: 'Quản lý chấm công', href: '/attendance', icon: Clock, hideForRoles: ['assistant', 'sale', 'viewer', 'sales'] },
      { name: 'Chấm công', href: '/attendance', icon: Clock, hideForRoles: ['admin', 'superadmin', 'super_admin', 'manager', 'viewer'] }
    ]
  },
  {
    title: 'CÀI ĐẶT HỆ THỐNG',
    items: [
      { name: 'Cài đặt hệ thống', href: '/settings', icon: Settings, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales'] },
      { name: 'Quản lý tài khoản', href: '/accounts', icon: ShieldCheck, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales'] },
      { name: 'Logic xử lý', href: '/rules', icon: Webhook, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales'] },
      { name: 'Tích hợp Data', href: '/integrations', icon: Link2, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales'] },
      { name: 'CAPI', href: '/capi', icon: Link2, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales'] }
    ]
  }
];

export const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose }: { isCollapsed: boolean; onToggleCollapse: () => void; isMobileOpen?: boolean; onMobileClose?: () => void }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [pendingTickets, setPendingTickets] = useState(0);
  const [heldLeadsCount, setHeldLeadsCount] = useState(0);
  const [pendingCoopCount, setPendingCoopCount] = useState(0);
  const [undoneTasksCount, setUndoneTasksCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Poll pending counts every 60s
  useEffect(() => {
    if (!user) return;
    const fetchPending = async () => {
      try {
        const role = user.role as string;
        const isAdminOrManager = role === 'admin' || role === 'superadmin' || role === 'super_admin' || role === 'manager' || role === 'director';

        // Fetch undone tasks for all roles
        const resTasks = await fetchAPI('activities&type=task&limit=100');
        if (resTasks && resTasks.success) {
          const rawTasks = resTasks.data?.items || resTasks.data || [];
          if (Array.isArray(rawTasks)) {
            const count = rawTasks.filter((task: any) => task.status !== 'done').length;
            setUndoneTasksCount(count);
          }
        }

        if (isAdminOrManager) {
          const [resReports, resHeld, resCoop] = await Promise.all([
            fetchAPI('get_reports&status=pending'),
            fetchAPI('get_held_leads&pageSize=1&date=all'),
            fetchAPI('cooperation-slips')
          ]);

          let countReports = 0;
          let countHeld = 0;
          let countCoop = 0;

          if (resReports.success) {
            countReports = resReports.stats?.pending ?? (resReports.data ? resReports.data.filter((r: any) => r.status === 'pending').length : 0);
          }

          if (resHeld.success) {
            countHeld = resHeld.total_count ?? 0;
          }

          if (resCoop.success) {
            countCoop = (resCoop.data || []).filter((s: any) => s.status === 'pending_manager_approval').length;
          }

          setPendingTickets(countReports);
          setHeldLeadsCount(countHeld);
          setPendingCoopCount(countCoop);
        } else if (role === 'sale' || role === 'sales') {
          const resCoop = await fetchAPI('cooperation-slips');
          let countUnsigned = 0;
          if (resCoop.success) {
            const slips = resCoop.data || [];
            countUnsigned = slips.filter((s: any) => {
              const sh = s.shareholders?.find((x: any) => String(x.user_id) === String(user.id));
              return s.status !== 'rejected' && sh && !sh.signed;
            }).length;
          }
          setPendingCoopCount(countUnsigned);
        }
      } catch { /* silent */ }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    window.addEventListener('ticket-resolved', fetchPending);
    window.addEventListener('task-updated', fetchPending);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ticket-resolved', fetchPending);
      window.removeEventListener('task-updated', fetchPending);
    };
  }, [user]);

  const visibleGroups = SIDEBAR_GROUPS.map(group => {
    let items = [...group.items];
    if (group.title === 'TỔNG QUAN' && user?.role === 'sale') {
      items = [
        { name: 'Tổng quan', href: '/', icon: LayoutDashboard, end: true },
        { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
        { name: 'Kho Databank', href: '/databank', icon: Layers, hideForRoles: ['viewer'] }
      ];
    }
    const filteredItems = items.filter((item: any) => {
      const role = user?.role as string;
      const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin';
      const isManagerOrAdmin = isAdmin || role === 'manager' || role === 'director';

      if (item.adminOnly && !isManagerOrAdmin) {
        return false;
      }
      if (item.hideForRoles && item.hideForRoles.includes(role)) {
        return false;
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
          width: isCollapsed ? 60 : 220,
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
        <div 
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-quick-menu'));
          }}
          style={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            padding: isCollapsed ? '12px 0 0 0' : '12px 1rem 0 1rem',
            gap: '0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {/* Logo Icon */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
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
              <span style={{ fontSize: '1.2rem', fontWeight: 900, whiteSpace: 'nowrap', color: 'white', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                RICH LAND
              </span>
              <span style={{
                fontSize: '0.55rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #f45b69 0%, #e63946 50%, #BD1D2D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginTop: '3px',
                whiteSpace: 'nowrap'
              }}>
                / DATA AUTOMATION
              </span>
            </div>
          )}
        </div>

        {/* Quick Action Button */}
        <div style={{ padding: isCollapsed ? '0.5rem 0.25rem' : '0.875rem 0.75rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {isCollapsed ? (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                if (onMobileClose) onMobileClose();
              }}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #BD1D2D 0%, #9e1824 50%, #660f17 100%)',
                color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(189, 29, 45, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(189, 29, 45, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(189, 29, 45, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
              }}
              title={((user?.role as string) === 'sale' || (user?.role as string) === 'sales') ? t("Thêm data cá nhân") : t("Thêm data nhanh")}
            >
              <Plus size={16} />
            </button>
          ) : (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                if (onMobileClose) onMobileClose();
              }}
              className="btn primary"
              style={{
                width: '100%', height: 34, borderRadius: '8px',
                background: 'linear-gradient(135deg, #BD1D2D 0%, #9e1824 50%, #660f17 100%)',
                color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(189, 29, 45, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(189, 29, 45, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(189, 29, 45, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
              }}
            >
              <Plus size={14} /> {((user?.role as string) === 'sale' || (user?.role as string) === 'sales') ? t("Thêm data cá nhân") : t("Thêm data nhanh")}
            </button>
          )}
        </div>

        {/* Collapse Button */}
        <button
          onClick={onToggleCollapse}
          className="responsive-hide-mobile no-active-scale"
          style={{
            position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary)', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 200, border: 'none',
            boxShadow: '0 2px 10px rgba(189, 29, 45, 0.4)', transition: 'all 0.2s',
            opacity: isHovered ? 1 : 0,
            visibility: isHovered ? 'visible' : 'hidden',
            pointerEvents: isHovered ? 'auto' : 'none'
          }}
        >
          <ChevronLeft size={14} style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
        </button>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
          <div style={{ position: 'relative', padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>

            {visibleGroups.map((group, groupIdx) => (
              <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: isCollapsed ? '0.375rem' : '0.875rem' }}>
                {!isCollapsed && (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.28)',
                    padding: '0.375rem 1rem',
                    whiteSpace: 'nowrap',
                    display: 'block'
                  }}>
                    {t(group.title)}
                  </span>
                )}
                 {group.items.map(({ name, href, icon: Icon, end, badgeKey }) => {
                   const badgeCount = badgeKey === 'tickets' ? pendingTickets : badgeKey === 'gatekeeper' ? heldLeadsCount : badgeKey === 'coopSlips' ? pendingCoopCount : badgeKey === 'workspaceTasks' ? undoneTasksCount : 0;
                   const checkIsActive = (locationPath: string, locationSearch: string, itemHref: string) => {
                     const qIdx = itemHref.indexOf('?');
                     if (qIdx !== -1) {
                       const itemPath = itemHref.substring(0, qIdx);
                       if (locationPath !== itemPath) return false;
                       const itemParams = new URLSearchParams(itemHref.substring(qIdx));
                       const locParams = new URLSearchParams(locationSearch);
                       let match = true;
                       itemParams.forEach((val, key) => {
                         if (locParams.get(key) !== val) match = false;
                       });
                       return match;
                     } else {
                       if (locationPath !== itemHref) return false;
                       const locParams = new URLSearchParams(locationSearch);
                       if (locParams.get('tab')) return false;
                       return true;
                     }
                   };
                   const isActive = checkIsActive(location.pathname, location.search, href);
                  const displayName = t(name);

                  return (
                    <NavLink
                      key={name + href}
                      to={href}
                      end={end}
                      className={() => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                      title={isCollapsed ? displayName : undefined}
                      onClick={(e) => {
                        const targetPath = href.split('?')[0];
                        if (location.pathname === targetPath) {
                          window.dispatchEvent(new CustomEvent('refresh-page', { detail: { path: targetPath } }));
                        }
                        if (onMobileClose) onMobileClose();
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: isCollapsed ? '0.5rem 0' : '0.45rem 1rem',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        color: isActive ? '#dadada' : 'rgba(255,255,255,0.5)',
                        textDecoration: 'none', fontSize: '0.825rem',
                        fontWeight: isActive ? 700 : 500, transition: 'all 0.2s ease',
                        position: 'relative',
                        background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                        whiteSpace: 'nowrap', overflow: 'hidden',
                      }}
                    >
                      {() => (
                        <>
                          {isActive && (
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 4,
                              background: 'var(--color-primary)',
                              borderRadius: '0 2px 2px 0',
                              zIndex: 10
                            }} />
                          )}
                          {/* Icon Box — with badge dot when collapsed */}
                          <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 0.2s', position: 'relative'
                          }}>
                            <Icon size={15} color={isActive ? '#dadada' : 'rgba(255,255,255,0.5)'} />
                            {isCollapsed && badgeCount > 0 && (
                              <div style={{
                                position: 'absolute', top: 3, right: 3, width: 6, height: 6,
                                borderRadius: '50%', background: badgeKey === 'gatekeeper' ? '#f59e0b' : '#ef4444'
                              }} />
                            )}
                          </div>

                          {!isCollapsed && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                              <span>{displayName}</span>
                              {badgeCount > 0 && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  minWidth: '15px',
                                  height: '15px',
                                  borderRadius: '8px',
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
