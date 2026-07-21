import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, Activity, Sun, Moon, Keyboard, ChevronDown, User, AlertTriangle, LogOut, Menu, LayoutGrid, LayoutDashboard, Users, Building2, Clock, Truck, Boxes, Receipt, Settings, CheckCircle2, Fingerprint, Bell, MessageSquare, Info, Trash2, Check, Eye, EyeOff, CheckSquare, FileText, ArrowLeft, ShieldAlert, Laptop } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { useUIStore } from '../../store/uiStore';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { SIDEBAR_GROUPS } from './Sidebar';
import { Avatar } from '../ui/Avatar';
import { useNavigate } from 'react-router-dom';
import { CustomModal } from '../ui/CustomModal';
import { NotificationSettingsModal } from '../ui/NotificationSettingsModal';
import { fetchAPI } from '../../utils/api';
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

export const Header = ({ 
  onActivityFeedClick, 
  onMenuClick, 
  version,
  pendingInboxCount,
  onUnifiedInboxClick
}: { 
  onActivityFeedClick: () => void; 
  onMenuClick?: () => void; 
  version?: string;
  pendingInboxCount?: number;
  onUnifiedInboxClick?: () => void;
}) => {
  const isDemo = localStorage.getItem('RICH LAND_DEMO_MODE') === 'true';
  const { user, logout } = useAuth();
  const { showConfirm } = useUIStore();
  const { language, setLanguage, t } = useLanguage();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);



  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [headerVacationMode, setHeaderVacationMode] = useState<boolean>(false);
  const [headerCheckIn, setHeaderCheckIn] = useState<any>(null);
  const [headerNightShiftRegistered, setHeaderNightShiftRegistered] = useState<boolean>(false);
  const managerBehaviorMode = user?.manager_behavior_mode || 'combined';
  const isSales = user?.role === 'sale' || (user?.role === 'manager' && managerBehaviorMode === 'combined');
  const currentHour = new Date().getHours();
  const isOvertime = (currentHour >= 18 && currentHour < 22) || (currentHour >= 0 && currentHour < 6);


  const [uncontactedCount, setUncontactedCount] = useState(() => {
    return Number(sessionStorage.getItem('sale-uncontacted-count')) || 0;
  });

  useEffect(() => {
    const handleUncontactedCountChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setUncontactedCount(Number(detail) || 0);
    };

    window.addEventListener('uncontacted-count-changed', handleUncontactedCountChanged);
    return () => {
      window.removeEventListener('uncontacted-count-changed', handleUncontactedCountChanged);
    };
  }, []);

  // --- Notifications State & Logic ---
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifAvatars, setNotifAvatars] = useState<any>({});
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  // --- Tab Title Flashing & Browser Push notifications ---
  const prevNotifIds = useRef<Set<number>>(new Set());
  const flashIntervalRef = useRef<any>(null);
  const isWindowFocused = useRef(true);

  // Stop title flashing
  const stopFlashingTitle = () => {
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    let cleanTitle = document.title;
    if (cleanTitle.startsWith('🔴 ') || cleanTitle.startsWith('🔔 ')) {
      cleanTitle = cleanTitle.replace(/^(🔴|🔔)\s*(?:\(\d+\)\s*)?/, '');
    }
    document.title = cleanTitle;
  };

  // Start title flashing
  const startFlashingTitle = (count: number) => {
    stopFlashingTitle(); // Reset first
    if (count <= 0) return;
    
    let isRedDot = true;
    const baseTitle = document.title.replace(/^(🔴|🔔)\s*(?:\(\d+\)\s*)?/, '');
    
    flashIntervalRef.current = setInterval(() => {
      if (isRedDot) {
        document.title = `🔴 (${count}) ${baseTitle}`;
      } else {
        document.title = `🔔 (${count}) ${baseTitle}`;
      }
      isRedDot = !isRedDot;
    }, 1000);
  };

  // Window Focus Events
  useEffect(() => {
    const handleFocus = () => {
      isWindowFocused.current = true;
      stopFlashingTitle();
    };
    const handleBlur = () => {
      isWindowFocused.current = false;
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
    };
  }, []);

  // Request browser permission for notifications
  const requestBrowserNotificationPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        // Trigger state refresh to update settings UI
        setNotifications(prev => [...prev]);
        if (permission === 'granted') {
          toast.success('Đã kích hoạt thông báo trình duyệt thành công!');
          new Notification('RICH LAND', {
            body: 'Bạn đã kích hoạt nhận thông báo trình duyệt thành công.',
            icon: '/LOGO.jpg'
          });
        } else {
          toast('Bạn đã từ chối nhận thông báo trình duyệt.', { icon: '⚠️' });
        }
      });
    }
  };

  // Auto-request or check on mount (only once to avoid prompt spam)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const alreadyAsked = localStorage.getItem('asked_browser_notifications');
      if (!alreadyAsked) {
        Notification.requestPermission().then(() => {
          localStorage.setItem('asked_browser_notifications', '1');
        });
      }
    }
  }, []);

  // Watch pendingInboxCount for new gatekeeper/approval hold requests (for managers/admins)
  const prevPendingInboxCount = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (pendingInboxCount !== undefined) {
      const prev = prevPendingInboxCount.current;
      prevPendingInboxCount.current = pendingInboxCount;
      if (prev !== undefined && pendingInboxCount > prev) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Hộp kiểm duyệt RICH LAND', {
            body: `Có dữ liệu mới đang chờ xử lý trong Hộp kiểm duyệt (${pendingInboxCount} yêu cầu).`,
            icon: '/LOGO.jpg'
          });
        }
        if (!isWindowFocused.current) {
          startFlashingTitle(unreadCount + pendingInboxCount);
        }
      }
    }
  }, [pendingInboxCount, unreadCount]);

  // When notification modal opens, stop flashing title
  useEffect(() => {
    if (isNotifModalOpen) {
      stopFlashingTitle();
    }
  }, [isNotifModalOpen]);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'read'>('all');

  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<any>({
    email_warning: 1,
    email_mention: 1,
    email_approval_request: 1,
    email_project_document: 0,
    email_project_comment: 0,
    email_project_roster: 0,
    email_info: 0
  });

  const fetchNotifications = async () => {
    try {
      const res = await fetchAPI('notifications');
      if (res.success && res.data) {
        const items = res.data.items || [];
        const newUnreadCount = res.data.unread_count || 0;
        
        setNotifications(items);
        setUnreadCount(newUnreadCount);
        setNotifAvatars(res.data.avatars || {});
        
        if (newUnreadCount === 0) {
          stopFlashingTitle();
        }

        // Browser notification trigger logic
        if (items.length > 0) {
          const isFirstLoad = prevNotifIds.current.size === 0;
          let hasNewUnread = false;
          let latestNotif = null;
          
          items.forEach((item) => {
            if (!prevNotifIds.current.has(item.id)) {
              prevNotifIds.current.add(item.id);
              if (!isFirstLoad && !item.is_read) {
                hasNewUnread = true;
                if (!latestNotif) {
                  latestNotif = item;
                }
              }
            }
          });
          
          if (newUnreadCount > 0 && hasNewUnread && latestNotif) {
            // Trigger desktop notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(latestNotif.title || 'Thông báo RICH LAND', {
                body: latestNotif.body || 'Bạn có thông báo mới.',
                icon: '/LOGO.jpg'
              });
            }
            
            // Dispatch event for auto-refreshing other active components
            window.dispatchEvent(new CustomEvent('new-notification-received'));
            
            // Trigger tab title flash if not focused or modal is not open
            if (!isWindowFocused.current || !isNotifModalOpen) {
              startFlashingTitle(newUnreadCount);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const fetchNotifPrefs = async () => {
    try {
      const res = await fetchAPI('notifications/settings');
      if (res.success && res.data) {
        const settingsData = res.data.settings || res.data;
        setNotifPrefs({
          email_warning: settingsData.email_warning ?? 1,
          email_mention: settingsData.email_mention ?? 1,
          email_approval_request: settingsData.email_approval_request ?? 1,
          email_project_document: settingsData.email_project_document ?? 0,
          email_project_comment: settingsData.email_project_comment ?? 0,
          email_project_roster: settingsData.email_project_roster ?? 0,
          email_info: settingsData.email_info ?? 0,
        });
      }
    } catch (err) {
      console.error("Error fetching notification settings:", err);
    }
  };

  const handleTogglePref = async (key: string, value: number) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    try {
      await fetchAPI('notifications/settings', {
        method: 'PATCH',
        body: JSON.stringify(updated)
      });
      toast.success('Đã lưu cấu hình');
    } catch (err) {
      console.error("Error updating notification setting:", err);
      toast.error('Không thể lưu cấu hình');
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchNotifPrefs();
    const interval = setInterval(fetchNotifications, 30000); // Polling fallback every 30s
    
    const handleRealtimeUpdate = () => {
      fetchNotifications();
    };

    window.addEventListener('notification-trigger', fetchNotifications);
    window.addEventListener('realtime-update-received', handleRealtimeUpdate);
    window.addEventListener('new-notification-received', handleRealtimeUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification-trigger', fetchNotifications);
      window.removeEventListener('realtime-update-received', handleRealtimeUpdate);
      window.removeEventListener('new-notification-received', handleRealtimeUpdate);
    };
  }, [showNotifSettings]);

  const handleMarkRead = async (id: number, isReadVal: number = 1) => {
    try {
      const res = await fetchAPI(`notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_read: isReadVal })
      });
      if (res.success) {
        fetchNotifications();
        toast.success(isReadVal === 1 ? 'Đã đánh dấu đã đọc' : 'Đã đánh dấu chưa đọc');
      }
    } catch (err) {
      console.error("Error updating notification status:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetchAPI('notifications', {
        method: 'PATCH'
      });
      if (res.success) {
        fetchNotifications();
        toast.success('Đã đánh dấu tất cả là đã đọc');
      }
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleDeleteNotif = async (id: number) => {
    try {
      const res = await fetchAPI(`notifications/${id}`, {
        method: 'DELETE'
      });
      if (res.success) {
        fetchNotifications();
        toast.success('Đã xóa thông báo');
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleClearAllNotif = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ thông báo?')) return;
    try {
      const res = await fetchAPI('notifications', {
        method: 'DELETE'
      });
      if (res.success) {
        fetchNotifications();
        toast.success('Đã xóa toàn bộ thông báo');
      }
    } catch (err) {
      console.error("Error clearing notifications:", err);
    }
  };

  const handleNotifClick = async (notif: any) => {
    if (!notif.is_read) {
      await fetchAPI(`notifications/${notif.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_read: 1 })
      });
      fetchNotifications();
    }
    setIsNotifModalOpen(false);

    let contactIdFromRef: string | null = null;
    if (notif.body && (
      !notif.link || 
      notif.link.includes('contact') || 
      (notif.title && (notif.title.toLowerCase().includes('trùng số') || notif.title.toLowerCase().includes('rửa nguồn')))
    )) {
      const refMatch = notif.body.match(/Contact ID:\s*(\d+)/i) || notif.body.match(/ID:\s*(\d+)/i);
      if (refMatch) {
        contactIdFromRef = refMatch[1];
      }
    }

    if (contactIdFromRef) {
      navigate(`/contacts?open_contact_id=${contactIdFromRef}`);
      return;
    }

    if (notif.link) {
      let targetLink = notif.link;
      
      const noteMatch = targetLink.match(/^\/notes\/(\d+)$/);
      if (noteMatch) {
        try {
          const res = await fetchAPI(`notes/${noteMatch[1]}`);
          if (res.success && res.data) {
            const note = res.data;
            if (note.entity_type === 'contact') {
              targetLink = `/contacts?open_contact_id=${note.entity_id}&highlight_note_id=${noteMatch[1]}`;
            } else if (note.entity_type === 'deal') {
              targetLink = `/deals?id=${note.entity_id}&highlight_note_id=${noteMatch[1]}`;
            } else if (note.entity_type === 'company') {
              targetLink = `/companies?id=${note.entity_id}`;
            } else if (note.entity_type === 'project') {
              targetLink = `/projects?id=${note.entity_id}`;
            }
          }
        } catch (e) {
          console.error("Error resolving note redirect link:", e);
        }
      }

      const activityMatch = targetLink.match(/^\/activities\/(\d+)(?:\?.*)?$/);
      if (activityMatch) {
        try {
          const res = await fetchAPI(`activities/${activityMatch[1]}`);
          if (res.success && res.data) {
            const act = res.data;
            const actUrlObj = new URL(targetLink, window.location.origin);
            const commentId = actUrlObj.searchParams.get('comment_id') || actUrlObj.searchParams.get('highlight_comment_id');
            const commentQuery = commentId ? `&highlight_comment_id=${commentId}` : '';
            if (act.contact_id) {
              targetLink = `/contacts?open_contact_id=${act.contact_id}&highlight_activity_id=${activityMatch[1]}${commentQuery}`;
            } else if (act.related_type === 'contact') {
              targetLink = `/contacts?open_contact_id=${act.related_id}&highlight_activity_id=${activityMatch[1]}${commentQuery}`;
            } else if (act.related_type === 'deal') {
              targetLink = `/deals?id=${act.related_id}&highlight_activity_id=${activityMatch[1]}${commentQuery}`;
            }
          }
        } catch (e) {
          console.error("Error resolving activity redirect link:", e);
        }
      }

      const urlObj = new URL(targetLink, window.location.origin);
      const contactMatch = targetLink.match(/^\/contacts\/(\d+)$/) || targetLink.match(/\/contacts\?(?:open_contact_id|id)=(\d+)/);
      if (contactMatch) {
        urlObj.searchParams.set('open_contact_id', contactMatch[1]);
        targetLink = `/contacts?${urlObj.searchParams.toString()}`;
      } else {
        const activityMatch = targetLink.match(/^\/activities\/(\d+)$/) || targetLink.match(/\/activities\?(?:task_id|id)=(\d+)/);
        if (activityMatch) {
          if (['sale', 'sales'].includes(user?.role || '')) {
            urlObj.searchParams.set('task_id', activityMatch[1]);
            targetLink = `/workspace?${urlObj.searchParams.toString()}`;
          } else {
            urlObj.searchParams.set('id', activityMatch[1]);
            targetLink = `/activities?${urlObj.searchParams.toString()}`;
          }
        }
        const projectMatch = targetLink.match(/^\/projects\/(\d+)$/) || targetLink.match(/\/projects\?(?:id)=(\d+)/);
        if (projectMatch) {
          urlObj.searchParams.set('id', projectMatch[1]);
          targetLink = `/projects?${urlObj.searchParams.toString()}`;
        }
        const ticketMatch = targetLink.match(/^\/tickets\/(\d+)$/) || targetLink.match(/\/tickets\?(?:id)=(\d+)/);
        if (ticketMatch) {
          urlObj.searchParams.set('id', ticketMatch[1]);
          targetLink = `/support-tickets?${urlObj.searchParams.toString()}`;
        }
      }
      navigate(targetLink);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fetchHeaderPortalData = async () => {
    if (!isSales) return;
    try {
      const nightRes = await fetchAPI('get_night_shift_status');
      if (nightRes && nightRes.success) {
        setHeaderNightShiftRegistered(nightRes.registered);
      }
    } catch (err) {
      console.error("Error fetching night shift status in Header:", err);
    }
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
      if (json.success) {
        if (json.vacation_mode !== undefined) {
          setHeaderVacationMode(Boolean(Number(json.vacation_mode)));
        }
        if (json.uncontacted_count !== undefined) {
          const count = Number(json.uncontacted_count) || 0;
          setUncontactedCount(count);
          sessionStorage.setItem('sale-uncontacted-count', String(count));
          window.dispatchEvent(new CustomEvent('uncontacted-count-changed', { detail: count }));
        } else if (json.leads) {
          const count = json.leads.filter((l: any) => 
            Number(l.is_accepted) === 1 && 
            l.contact_id && 
            !l.contact_last_contact && 
            l.status !== 'reminder'
          ).length;
          setUncontactedCount(count);
          sessionStorage.setItem('sale-uncontacted-count', String(count));
          window.dispatchEvent(new CustomEvent('uncontacted-count-changed', { detail: count }));
        }
      }
    } catch (err) {
      console.error("Error fetching vacation mode in Header:", err);
    }
  };

  useEffect(() => {
    fetchHeaderPortalData();
  }, [user, isSales]);

  useEffect(() => {
    const handleVacationChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setHeaderVacationMode(customEvent.detail);
    };
    const handleCheckInChange = () => {
      fetchHeaderPortalData();
    };
    const handleContactUpdate = () => {
      fetchHeaderPortalData();
    };
    window.addEventListener('vacation-status-changed', handleVacationChange);
    window.addEventListener('checkin-status-changed', handleCheckInChange);
    window.addEventListener('contact-updated', handleContactUpdate);
    window.addEventListener('lead-claimed', handleContactUpdate);
    window.addEventListener('lead-added', handleContactUpdate);
    return () => {
      window.removeEventListener('vacation-status-changed', handleVacationChange);
      window.removeEventListener('checkin-status-changed', handleCheckInChange);
      window.removeEventListener('contact-updated', handleContactUpdate);
      window.removeEventListener('lead-claimed', handleContactUpdate);
      window.removeEventListener('lead-added', handleContactUpdate);
    };
  }, [user]);

  const handleToggleHeaderVacation = async () => {
    const isCurrentlyReceiving = !headerVacationMode;
    const title = isCurrentlyReceiving ? 'Tạm ngưng nhận data?' : 'Bật nhận data?';
    const message = isCurrentlyReceiving 
      ? 'Hậu quả khi TẠM NGƯNG nhận data:\n\n• Bạn sẽ bị LOẠI khỏi vòng xoay phân bổ khách hàng (Round-Robin) ngay lập tức.\n• Hệ thống sẽ KHÔNG chia thêm bất kỳ data mới nào từ Landing Page, Ads, v.v. cho bạn.\n• Cơ hội và khách hàng tiềm năng lẽ ra thuộc về bạn sẽ chuyển cho các tư vấn viên khác đang hoạt động.\n• Điều này có thể ảnh hưởng trực tiếp đến doanh thu và chỉ tiêu KPI cá nhân của bạn.'
      : 'Yêu cầu và nghĩa vụ khi BẬT NHẬN DATA:\n\n• Bạn sẽ quay trở lại danh sách phân bổ khách hàng của vòng xoay Round-Robin.\n• Hệ thống sẽ tự động phân bổ data khách hàng mới cho bạn khi đến lượt.\n• Bạn CẦN đảm bảo trực máy và thực hiện cuộc gọi tương tác/gặp mặt khách hàng trong vòng thời gian quy định.\n• Nếu không tương tác kịp thời, tài khoản của bạn sẽ bị cộng dồn chỉ số "chưa tương tác" và có thể bị khóa nhận số tự động.';

    showConfirm({
      title,
      message,
      confirmText: isCurrentlyReceiving ? 'Tạm ngưng nhận' : 'Bật nhận data',
      cancelText: 'Hủy bỏ',
      isDanger: isCurrentlyReceiving,
      onConfirm: async () => {
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
      }
    });
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
      case 'director': return t('Giám đốc kinh doanh');
      default: return t('Người dùng');
    }
  };

  const handleProfileClick = () => {
    setIsProfileMenuOpen(false);
    navigate('/account');
  };

  const handleActivityClick = () => {
    window.dispatchEvent(new CustomEvent('open-profile-modal', { detail: { tab: 'activity' } }));
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

  // Listen to open-quick-menu event from sidebar logo click
  useEffect(() => {
    const handleOpenQuickMenu = () => {
      setIsAppLauncherOpen(true);
    };
    window.addEventListener('open-quick-menu', handleOpenQuickMenu);
    return () => window.removeEventListener('open-quick-menu', handleOpenQuickMenu);
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
        const json = await fetchAPI(`get_logs&search=${encodeURIComponent(searchQuery.trim())}&page=1&pageSize=5`);
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
          onClick={() => setIsAppLauncherOpen(true)}
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)',
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
          <LayoutGrid size={24} />
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
        {isSales && (
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px', marginRight: isMobile ? '2px' : '8px' }}>

            {/* Receiving Data Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: isMobile ? '4px 6px' : '4px 10px', height: isMobile ? '30px' : '36px' }}>
              {!isMobile && (
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: !headerVacationMode ? '#10b981' : '#f59e0b', whiteSpace: 'nowrap' }}>
                  {!headerVacationMode ? t('Nhận data') : t('Tạm ngưng')}
                </span>
              )}
              <ToggleSwitch
                checked={!headerVacationMode}
                onChange={handleToggleHeaderVacation}
              />
            </div>

            {/* Check-in status / trigger button */}
            {(!headerCheckIn || headerCheckIn.status === 'rejected' || headerCheckIn.status === 'approved') ? null : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: 'var(--color-warning)', borderRadius: '8px', padding: isMobile ? '4px 6px' : '4px 10px', height: isMobile ? '30px' : '36px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                <Clock size={12} />
                <span>{isMobile ? 'Chờ duyệt' : `${t('Chờ duyệt trễ')} (${headerCheckIn.check_in_time.substring(0, 5)})`}</span>
              </div>
            )}
          </div>
        )}



        {/* Live Activity Feed Button */}
        {user?.role !== 'sale' && (
          <button 
            onClick={onActivityFeedClick}
            className="responsive-hide-mobile"
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
        )}

        {/* Unified Approvals/Issues Inbox Button */}
        {!['sale', 'sales'].includes(user?.role || '') && pendingInboxCount !== undefined && (
          <button
            onClick={onUnifiedInboxClick}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: pendingInboxCount > 0 ? '#ef4444' : 'var(--color-text-light)',
              borderRadius: 8,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
              outline: 'none'
            }}
            title={t("Các vấn đề cần xử lý")}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--color-bg)';
              if (pendingInboxCount === 0) {
                e.currentTarget.style.color = 'var(--color-primary)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = pendingInboxCount > 0 ? '#ef4444' : 'var(--color-text-light)';
            }}
          >
            <ShieldAlert size={20} className={pendingInboxCount > 0 ? "animate-pulse" : ""} style={{ color: pendingInboxCount > 0 ? '#ef4444' : 'inherit' }} />
            {pendingInboxCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                background: '#ef4444',
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxShadow: '0 0 0 2px var(--color-surface)',
                lineHeight: 1
              }}>
                {pendingInboxCount}
              </span>
            )}
          </button>
        )}

        {/* Notification Bell Button */}
        <button
          onClick={() => setIsNotifModalOpen(true)}
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
          title={t("Thông báo")}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-bg)';
            e.currentTarget.style.color = 'var(--color-primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--color-text-light)';
          }}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: '#ef4444',
              color: 'white',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 0 0 2px var(--color-surface)',
              lineHeight: 1
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
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

        {/* Language Selector Dropdown (Temporarily Hidden) */}
        {false && (
        <div className="responsive-hide-mobile" style={{ position: 'relative' }}>
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
        )}

        <div
          onMouseEnter={() => setIsProfileMenuOpen(true)}
          onMouseLeave={() => setIsProfileMenuOpen(false)}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <div style={{ width: '1px', height: '24px', background: 'var(--color-border)' }} />
          <div 
            onClick={handleProfileClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'background 0.2s',
              background: isProfileMenuOpen ? 'var(--color-bg)' : 'transparent'
            }}
          >
            <Avatar src={user?.avatar} name={user?.name} size={32} />
            <div className="responsive-hide-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{user?.name || 'User'}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>
                {(() => {
                  const u = user as any;
                  const jt = u?.job_title || u?.erp_profile?.job_title;
                  if (jt) return jt;
                  if (u?.address) {
                    try {
                      const p = typeof u.address === 'string' ? JSON.parse(u.address) : u.address;
                      if (p?.erp_profile?.job_title) return p.erp_profile.job_title;
                    } catch(e) {}
                  }
                  return getRoleLabel(user?.role);
                })()}
              </span>
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

                {((user?.role as any) === 'sale' || (user?.role as any) === 'sales') && (
                  <>
                    <button
                      onClick={() => {
                        navigate('/consultants?tab=teams');
                        setIsProfileMenuOpen(false);
                      }}
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
                      <Users size={14} style={{ color: 'var(--color-primary)' }} />
                      {t('Thông tin Team')}
                    </button>
                    <div style={{ borderBottom: '1px solid var(--color-border)', margin: '4px 0' }} />
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

                {/* 
                <a
                  href="/download"
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
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  <Laptop size={14} style={{ color: 'var(--color-primary)' }} />
                  {t('Tải App Desktop')}
                </a>

                <div style={{ borderBottom: '1px solid var(--color-border)', margin: '4px 0' }} />
                */}

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Search Input inside App Launcher */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          background: 'var(--color-bg-light)', 
          border: '1px solid var(--color-border)', 
          borderRadius: '9999px', 
          padding: '8px 20px',
          height: '44px',
          flexShrink: 0,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
          transition: 'all 0.2s',
          maxWidth: '600px',
          margin: '0 auto 1rem auto',
          width: '100%'
        }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            value={launcherSearch}
            onChange={(e) => setLauncherSearch(e.target.value)}
            placeholder={t("Tìm kiếm nhanh chức năng...")}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: '0.9rem'
            }}
          />
          {launcherSearch && (
            <button 
              onClick={() => setLauncherSearch('')}
              style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              {t("Xóa")}
            </button>
          )}
        </div>

        {(() => {
          const role = user?.role as string;
          const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin';

          const getItemColor = (itemName: string) => {
            const lowercase = itemName.toLowerCase();
            if (lowercase.includes('dashboard')) return { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#ffffff' };
            if (lowercase.includes('bàn làm việc') || lowercase.includes('chấm công') || lowercase.includes('hoạt động')) return { bg: 'linear-gradient(135deg, #10b981, #047857)', color: '#ffffff' };
            if (lowercase.includes('báo cáo') || lowercase.includes('thống kê')) return { bg: 'linear-gradient(135deg, #6366f1, #4338ca)', color: '#ffffff' };
            if (lowercase.includes('databank') || lowercase.includes('kho data')) return { bg: 'linear-gradient(135deg, #f59e0b, #b45309)', color: '#ffffff' };
            if (lowercase.includes('khách hàng') || lowercase.includes('contacts')) return { bg: 'linear-gradient(135deg, #f43f5e, #be123c)', color: '#ffffff' };
            if (lowercase.includes('pipeline') || lowercase.includes('chi phí')) return { bg: 'linear-gradient(135deg, #a855f7, #7e22ce)', color: '#ffffff' };
            if (lowercase.includes('phân bổ') || lowercase.includes('chiến dịch')) return { bg: 'linear-gradient(135deg, #ff7a00, #d05300)', color: '#ffffff' };
            if (lowercase.includes('đối soát') || lowercase.includes('phân quyền')) return { bg: 'linear-gradient(135deg, #ec4899, #be185d)', color: '#ffffff' };
            if (lowercase.includes('ai') || lowercase.includes('gatekeeper')) return { bg: 'linear-gradient(135deg, #14b8a6, #0f766e)', color: '#ffffff' };
            if (lowercase.includes('ticket')) return { bg: 'linear-gradient(135deg, #0ea5e9, #0369a1)', color: '#ffffff' };
            if (lowercase.includes('dự án') || lowercase.includes('công ty')) return { bg: 'linear-gradient(135deg, #64748b, #475569)', color: '#ffffff' };
            if (lowercase.includes('giỏ hàng') || lowercase.includes('sản phẩm')) return { bg: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#ffffff' };
            if (lowercase.includes('tài liệu')) return { bg: 'linear-gradient(135deg, #eab308, #a16207)', color: '#ffffff' };
            if (lowercase.includes('chủ đầu tư')) return { bg: 'linear-gradient(135deg, #84cc16, #4d7c0f)', color: '#ffffff' };
            if (lowercase.includes('báo giá') || lowercase.includes('hóa đơn')) return { bg: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff' };
            if (lowercase.includes('đặt cọc') || lowercase.includes('hợp tác')) return { bg: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#ffffff' };
            if (lowercase.includes('chi nhánh') || lowercase.includes('team') || lowercase.includes('nhân viên')) return { bg: 'linear-gradient(135deg, #8b5cf6, #5b21b6)', color: '#ffffff' };
            return { bg: 'linear-gradient(135deg, #475569, #334155)', color: '#ffffff' };
          };

          const ITEM_DESC: Record<string, string> = {
            'Dashboard': 'Biểu đồ, chỉ số doanh thu và hiệu năng kinh doanh',
            'Bàn làm việc': 'Lịch trình cá nhân, danh sách nhiệm vụ và chấm công',
            'Báo cáo': 'Thống kê chi tiết, doanh thu và năng suất nhân sự',
            'Kho Databank': 'Kho lưu trữ dữ liệu tập trung (Databank)',
            'Khách hàng': 'Quản lý thông tin khách hàng và nhật ký liên hệ',
            'Pipeline': 'Quy trình giao dịch và phễu chuyển đổi bán hàng',
            'Lịch biểu': 'Xem lịch làm việc và đăng ký ngày phép',
            'Kho Data': 'Xem danh sách toàn bộ data phân bổ',
            'Quy tắc phân bổ': 'Tự động phân bổ khách hàng tiềm năng cho nhân viên',
            'Đối soát công bằng': 'Đối soát phân chia dữ liệu khách hàng công bằng',
            'AI Pre-screener': 'Thiết lập AI Gatekeeper đánh giá khách hàng',
            'Ticket data lỗi': 'Báo cáo lỗi dữ liệu khách hàng',
            'Ticket hỗ trợ': 'Gửi ticket yêu cầu IT hỗ trợ',
            'Dự án': 'Danh sách dự án bất động sản',
            'Giỏ hàng': 'Bảng giỏ hàng và danh mục căn hộ',
            'Chiến dịch': 'Chiến dịch marketing và nguồn phân bổ',
            'Tài liệu': 'Kho tài liệu mật và biểu mẫu của công ty',
            'Công ty': 'Quản lý danh mục đối tác doanh nghiệp',
            'Chủ đầu tư': 'Danh mục các chủ đầu tư dự án',
            'Báo giá': 'Tạo và phê duyệt báo giá dịch vụ',
            'Phiếu đặt cọc': 'Danh sách phiếu đặt cọc giao dịch',
            'Phiếu hợp tác': 'Quản lý các phiếu hợp tác bán hàng',
            'Duyệt hợp tác': 'Phê duyệt các phiếu hợp tác bán hàng',
            'Hóa đơn': 'Danh sách thu chi và hóa đơn khách hàng',
            'Chi phí vận hành': 'Báo cáo chi phí phát sinh theo dự án',
            'Tài khoản cá nhân': 'Thông tin hồ sơ và đổi mật khẩu',
            'Chi nhánh': 'Quản lý các văn phòng và chi nhánh',
            'Team': 'Danh sách các đội nhóm kinh doanh',
            'Nhân viên kinh doanh': 'Hồ sơ và lịch làm việc của tư vấn viên',
            'Quản lý chấm công': 'Báo cáo check-in và xin nghỉ phép',
            'Chấm công': 'Ghi nhận check-in và xin nghỉ phép của tôi',
            'Cài đặt hệ thống': 'Các thông số và cấu hình chung toàn hệ thống',
            'Quản lý tài khoản': 'Phân quyền tài khoản quản trị viên',
            'Logic xử lý': 'Thiết lập quy định chặn, skip và check-in',
            'Tích hợp Data': 'Cấu hình webhook và liên kết Google Sheets',
            'CAPI': 'Cấu hình sự kiện Meta Conversion API'
          };

          const visibleGroups = SIDEBAR_GROUPS.map(group => {
            const filteredItems = group.items.filter((item: any) => {
              if (item.adminOnly && !isAdmin) return false;
              if (item.hideForRoles && item.hideForRoles.includes(role)) return false;
              return true;
            });
            return { ...group, items: filteredItems };
          }).filter(group => group.items.length > 0);

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

          const recentTargets = ['Dashboard', 'Bàn làm việc', 'Báo cáo', 'Khách hàng', 'Pipeline', 'Giỏ hàng', 'Kho Databank', 'Lịch biểu', 'Dự án'];
          const recentItems = recentTargets
            .map(name => allVisibleItems.find(item => item.name === name))
            .filter(Boolean)
            .slice(0, isMobile ? 9 : 7);

          return (
            <div style={{ paddingRight: '4px' }}>
              {launcherSearch.trim() ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h5 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    {t("Kết quả tìm kiếm")} ({filteredItems.length})
                  </h5>
                  {filteredItems.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px 24px' }}>
                      {filteredItems.map(item => {
                        const IconComponent = item.icon;
                        const colors = getItemColor(item.name);
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
                              padding: '8px 12px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease-in-out',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: colors.bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                            }}>
                              <IconComponent size={16} color={colors.color} strokeWidth={2} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t(item.name)}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t(desc)}
                              </span>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.75rem' }}>
                  {/* Gần đây (Recent items) */}
                  {recentItems.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: isMobile ? '1rem' : '1.5rem' }}>
                      <span style={{ fontSize: isMobile ? '0.72rem' : '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('Gần đây')}
                      </span>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: isMobile ? '8px' : '16px'
                      }}>
                        {recentItems.map(item => {
                          const colors = getItemColor(item.name);
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.name}
                              onClick={() => {
                                navigate(item.href);
                                setIsAppLauncherOpen(false);
                              }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: isMobile ? '6px' : '12px',
                                padding: isMobile ? '12px 8px' : '20px 16px',
                                background: 'var(--color-bg)',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: '18px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                boxShadow: 'var(--shadow-sm)',
                                transition: 'all 0.2s ease-in-out'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'var(--color-bg)';
                                e.currentTarget.style.borderColor = 'var(--color-border-light)';
                              }}
                            >
                              <div style={{
                                width: isMobile ? '40px' : '56px',
                                height: isMobile ? '40px' : '56px',
                                borderRadius: '16px',
                                background: colors.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                              }}>
                                <Icon size={isMobile ? 20 : 28} color={colors.color} strokeWidth={2} />
                              </div>
                              <span style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                {t(item.name)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Categories */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1.25rem' : '2rem' }}>
                    {visibleGroups.map(group => (
                      <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <h4 style={{ fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, whiteSpace: 'nowrap' }}>
                            {t(group.title)}
                          </h4>
                          <div style={{ flex: 1, height: '1px', background: 'var(--color-border-light)' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? '10px' : '12px 24px' }}>
                          {group.items.map(item => {
                            const IconComponent = item.icon;
                            const colors = getItemColor(item.name);
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
                                  padding: isMobile ? '10px 12px' : '8px 12px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease-in-out',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <div style={{
                                  width: isMobile ? '34px' : '32px',
                                  height: isMobile ? '34px' : '32px',
                                  borderRadius: '50%',
                                  background: colors.bg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                                }}>
                                  <IconComponent size={isMobile ? 18 : 16} color={colors.color} strokeWidth={2} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                  <span style={{ fontSize: isMobile ? '0.92rem' : '0.85rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {t(item.name)}
                                  </span>
                                  {!isMobile && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {t(desc)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
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

       {isSales && !isOvertime && (!headerCheckIn || headerCheckIn.status === 'rejected') && (
        <>
          <style>{`
            @media (max-width: 768px) {
              .floating-checkin-btn {
                bottom: 144px !important;
                right: 16px !important;
              }
            }
          `}</style>
          <button
            className="floating-checkin-btn"
            onClick={() => {
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
        </>
      )}

      {/* Notifications Modal */}
      <CustomModal
        isOpen={isNotifModalOpen}
        onClose={() => {
          setIsNotifModalOpen(false);
          setShowNotifSettings(false);
        }}
        title={t("Thông báo hệ thống")}
        width={700}
        headerAction={
          <button
            onClick={() => {
              if (showNotifSettings) {
                setShowNotifSettings(false);
              } else {
                fetchNotifPrefs();
                setShowNotifSettings(true);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2rem',
              height: '2rem',
              borderRadius: 'var(--radius-md)',
              color: showNotifSettings ? 'var(--color-primary)' : 'var(--color-text-light)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s, color 0.2s',
              outline: 'none'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg)';
              e.currentTarget.style.color = 'var(--color-text)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = showNotifSettings ? 'var(--color-primary)' : 'var(--color-text-light)';
            }}
            title={showNotifSettings ? t("Quay lại thông báo") : t("Cấu hình Email")}
          >
            <Settings size={20} />
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '400px', height: isMobile ? '80vh' : 'auto', maxHeight: isMobile ? '80vh' : '70vh' }}>
          {showNotifSettings ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  Cấu hình Email thông báo cá nhân
                </h3>
                <button
                  onClick={() => setShowNotifSettings(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ArrowLeft size={16} />
                  {t("Quay lại thông báo")}
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '55vh', paddingRight: '4px' }} className="custom-scrollbar">
                {/* Advanced Multi-Channel Notification Settings List Item */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    gap: '1rem',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)',
                    marginBottom: '4px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Tùy chỉnh thông báo chuyên sâu
                      </span>
                      <span style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        color: '#BD1D2D',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        textTransform: 'uppercase'
                      }}>
                        Đa kênh
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      Tùy chỉnh nguồn tổng và bật/tắt Zalo, Telegram, Email cho từng sự kiện.
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {/* Overlapping 3 Channel Logos OUTSIDE & ABOVE button */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', border: '1.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
                        <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 14, height: 14, objectFit: 'contain' }} alt="Zalo" />
                      </div>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', border: '1.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -7, zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/3840px-Telegram_logo.svg.png" style={{ width: 14, height: 14, objectFit: 'contain' }} alt="Telegram" />
                      </div>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', border: '1.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -7, zIndex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
                        <img src="/imgs/gmail-icon-free-png.webp" style={{ width: 14, height: 14, objectFit: 'contain' }} alt="Email" />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsNotifModalOpen(false);
                        setIsMatrixModalOpen(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 14px',
                        background: '#BD1D2D',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 6px rgba(189, 29, 45, 0.22)'
                      }}
                    >
                      <Settings size={13} />
                      <span>Cấu hình</span>
                    </button>
                  </div>
                </div>
                {/* Browser Notifications Preference */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    gap: '1rem',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)',
                    marginBottom: '4px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Thông báo trình duyệt (Browser Push)
                      </span>
                      <span style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        color: 'var(--color-primary)',
                        background: 'var(--color-primary-light)',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        textTransform: 'uppercase'
                      }}>
                        Khuyên dùng
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      Nhận thông báo đẩy trực tiếp trên màn hình thiết bị ngay khi có thông báo mới.
                    </span>
                  </div>
                  
                  {(() => {
                    if (!('Notification' in window)) {
                      return <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Không hỗ trợ</span>;
                    }
                    const perm = Notification.permission;
                    if (perm === 'granted') {
                      return (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                          Đã kích hoạt
                        </span>
                      );
                    }
                    if (perm === 'denied') {
                      return (
                        <button
                          type="button"
                          onClick={() => alert('Vui lòng vào cài đặt trình duyệt để cho phép trang web này gửi thông báo.')}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#BD1D2D',
                            border: '1px solid rgba(189, 29, 45, 0.2)',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Bị chặn (Xem HD)
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={requestBrowserNotificationPermission}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--color-primary-light)',
                          color: 'var(--color-primary)',
                          border: '1px solid var(--color-primary-hover)',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Bật thông báo
                      </button>
                    );
                  })()}
                </div>
                {[
                  { key: 'email_warning', title: 'Cảnh báo trùng số & rửa nguồn', desc: 'Cảnh báo khi có trùng số điện thoại hoặc các hành vi rửa nguồn data.', isImportant: true },
                  { key: 'email_mention', title: 'Nhắc nhở & gắn thẻ (@)', desc: 'Khi bạn được gắn thẻ vào bình luận dự án, công việc hoặc ticket.', isImportant: true },
                  { key: 'email_approval_request', title: 'Yêu cầu hợp tác & phê duyệt', desc: 'Khi có yêu cầu hợp tác đại lý hoặc phê duyệt data.', isImportant: true },
                  { key: 'email_project_document', title: 'Tài liệu dự án mới', desc: 'Khi có tài liệu dự án mới được tải lên hệ thống.', isImportant: false },
                  { key: 'email_project_comment', title: 'Thảo luận dự án', desc: 'Cho các bình luận mới trong dự án của bạn (không tag trực tiếp).', isImportant: false },
                  { key: 'email_project_roster', title: 'Thay đổi nhân sự dự án', desc: 'Khi có thành viên mới gia nhập hoặc rời khỏi dự án.', isImportant: false },
                  { key: 'email_info', title: 'Báo cáo hiệu suất & thông tin khác', desc: 'Báo cáo định kỳ tự động và các thông tin hệ thống chung.', isImportant: false },
                ].map(pref => (
                  <div
                    key={pref.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      gap: '1rem',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          {pref.title}
                        </span>
                        {pref.isImportant && (
                          <span style={{
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            color: '#BD1D2D',
                            background: 'rgba(189, 29, 45, 0.08)',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            textTransform: 'uppercase'
                          }}>
                            Mặc định
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsNotifModalOpen(false);
                            setIsMatrixModalOpen(true);
                          }}
                          style={{
                            fontSize: '0.75rem',
                            color: '#BD1D2D',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            padding: 0,
                            marginLeft: '6px'
                          }}
                        >
                          (Custom &gt;)
                        </button>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                        {pref.desc}
                      </span>
                    </div>
                    
                    <label style={{ position: 'relative', display: 'inline-block', width: 42, height: 22, flexShrink: 0, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={notifPrefs[pref.key] === 1}
                        onChange={e => handleTogglePref(pref.key, e.target.checked ? 1 : 0)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: notifPrefs[pref.key] === 1 ? '#BD1D2D' : '#cbd5e1',
                        transition: 'all 0.2s ease',
                        borderRadius: '20px'
                      }}>
                        <span style={{
                          position: 'absolute',
                          height: 16,
                          width: 16,
                          left: notifPrefs[pref.key] === 1 ? 23 : 3,
                          bottom: 3,
                          backgroundColor: 'white',
                          transition: 'all 0.2s ease',
                          borderRadius: '50%',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Header Controls */}
              <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row', 
                justifyContent: 'space-between', 
                alignItems: isMobile ? 'stretch' : 'center', 
                borderBottom: '1px solid var(--color-border-light)', 
                paddingBottom: '0.75rem', 
                marginBottom: '1rem',
                gap: '8px'
              }}>
                {/* Filter Tabs */}
                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem', 
                  overflowX: isMobile ? 'auto' : 'visible', 
                  scrollbarWidth: 'none',
                  paddingBottom: isMobile ? '4px' : '0',
                  borderBottom: isMobile ? '1px dashed var(--color-border-light)' : 'none'
                }} className="hide-scrollbar">
                  {(['all', 'unread', 'read'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setNotifFilter(tab)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: notifFilter === tab ? 'var(--color-primary-light)' : 'transparent',
                        color: notifFilter === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        outline: 'none',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      {tab === 'all' && t("Tất cả")}
                      {tab === 'unread' && `${t("Chưa đọc")} (${unreadCount})`}
                      {tab === 'read' && t("Đã đọc")}
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: isMobile ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <Check size={14} />
                      {t("Đọc tất cả")}
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAllNotif}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                    >
                      <Trash2 size={14} />
                      {t("Xóa toàn bộ")}
                    </button>
                  )}
                </div>
              </div>

              {/* List area */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px', paddingLeft: '6px', paddingTop: '6px', paddingBottom: '6px' }} className="custom-scrollbar">
                {(() => {
                  const filtered = notifications.filter(n => {
                    if (notifFilter === 'unread') return !n.is_read;
                    if (notifFilter === 'read') return !!n.is_read;
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '1rem', color: 'var(--color-text-muted)' }}>
                        <Bell size={48} style={{ opacity: 0.25 }} />
                        <p style={{ fontSize: '0.875rem' }}>{t("Không có thông báo nào")}</p>
                      </div>
                    );
                  }

                  const parseActorName = (body: string) => {
                    if (!body) return null;
                    let cleanBody = body;
                    if (cleanBody.startsWith('Nhân viên ')) {
                      cleanBody = cleanBody.substring(10);
                    }
                    const match = cleanBody.match(/^(.+?)(?:\s*\([^)]*\))?\s+(?:đã|vừa|gửi|báo|có|check-in)\s+/u);
                    if (match) {
                      return match[1].trim();
                    }
                    return null;
                  };

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {filtered.map(notif => {
                        const isWarning = notif.type === 'warning' || (notif.title && (notif.title.toLowerCase().includes('trùng số') || notif.title.toLowerCase().includes('rửa nguồn') || notif.title.toLowerCase().includes('cảnh báo')));
                        const isAttendanceUpdate = notif.type === 'attendance_update' || (notif.title && notif.title.toLowerCase().includes('cập nhật công'));
                        // Không parse actorName cho cảnh báo hệ thống (tránh hiển thị tên sai)
                        const actorName = isWarning ? null : parseActorName(notif.body);
                        const isRichland = !actorName && Boolean((notif.title && (notif.title.toLowerCase().includes('richland') || notif.title.toLowerCase().includes('rich land'))) || (notif.body && (notif.body.toLowerCase().includes('richland') || notif.body.toLowerCase().includes('rich land'))));
                        
                        const bgBase = notif.is_read 
                          ? 'var(--color-surface)' 
                          : (isWarning ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.02) 0%, rgba(239, 68, 68, 0.06) 100%)' 
                             : isAttendanceUpdate ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, rgba(139, 92, 246, 0.06) 100%)'
                             : 'linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(59, 130, 246, 0.06) 100%)');
                        
                        const borderColor = notif.is_read
                          ? 'var(--color-border-light)'
                          : (isWarning ? 'rgba(239, 68, 68, 0.2)' 
                             : isAttendanceUpdate ? 'rgba(139, 92, 246, 0.25)' 
                             : 'rgba(59, 130, 246, 0.2)');

                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotifClick(notif)}
                            style={{
                              display: 'flex',
                              alignItems: 'start',
                              gap: '0.875rem',
                              padding: '14px 16px',
                              borderRadius: '12px',
                              background: bgBase,
                              border: `1px solid ${borderColor}`,
                              cursor: notif.link || isWarning ? 'pointer' : 'default',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              position: 'relative',
                              boxShadow: notif.is_read ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.03)',
                              opacity: notif.is_read ? 0.75 : 1
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = isWarning ? '#ef4444' : isAttendanceUpdate ? '#8b5cf6' : '#3b82f6';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.08)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              if (notif.is_read) {
                                e.currentTarget.style.opacity = '1';
                              }
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = borderColor;
                              e.currentTarget.style.boxShadow = notif.is_read ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.03)';
                              e.currentTarget.style.transform = 'none';
                              if (notif.is_read) {
                                e.currentTarget.style.opacity = '0.75';
                              }
                            }}
                          >
                            <div style={{ position: 'relative', display: 'flex', flexShrink: 0, marginTop: 2 }}>
                              {isWarning ? (
                                /* Cảnh báo hệ thống → logo Richland */
                                <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', flexShrink: 0 }}>
                                  <img src="/LOGO.jpg" alt="Richland" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              ) : actorName ? (
                                /* Sale / Admin gửi → avatar đúng người */
                                <div style={{ position: 'relative', display: 'inline-flex' }}>
                                  <Avatar src={notifAvatars[actorName] || undefined} name={actorName} size={38} />
                                  <span style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: (() => { switch (notif.type) { case 'warning': return '#ef4444'; case 'mention': case 'task_assignment': case 'task_participant': case 'approval_request': return '#3b82f6'; case 'project_roster': return '#10b981'; case 'project_document': return '#f59e0b'; case 'project_comment': case 'attendance_update': return '#8b5cf6'; case 'attendance': return '#eab308'; default: return '#6b7280'; } })(), border: '1.5px solid var(--color-surface, #ffffff)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {(() => { switch (notif.type) { case 'mention': case 'task_assignment': case 'task_participant': case 'approval_request': return <CheckSquare size={11} style={{ color: 'white' }} />; case 'project_roster': return <Users size={11} style={{ color: 'white' }} />; case 'project_document': return <FileText size={11} style={{ color: 'white' }} />; case 'project_comment': return <MessageSquare size={11} style={{ color: 'white' }} />; case 'warning': return <AlertTriangle size={11} style={{ color: 'white' }} />; case 'attendance_update': return <Clock size={11} style={{ color: 'white' }} />; default: return <Info size={11} style={{ color: 'white' }} />; } })()}
                                  </span>
                                </div>
                              ) : isRichland ? (
                                /* Thông báo hệ thống Admin Richland → logo */
                                <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', flexShrink: 0 }}>
                                  <img src="/LOGO.jpg" alt="Richland" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              ) : (
                                /* Fallback → icon circle */
                                <div style={{ width: 38, height: 38, borderRadius: '50%', background: isAttendanceUpdate ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.02)' }}>
                                  {(() => { switch (notif.type) { case 'mention': case 'task_assignment': case 'task_participant': case 'approval_request': return <CheckSquare size={18} style={{ color: '#3b82f6' }} />; case 'project_roster': return <Users size={18} style={{ color: '#10b981' }} />; case 'project_document': return <FileText size={18} style={{ color: '#f59e0b' }} />; case 'project_comment': return <MessageSquare size={18} style={{ color: '#8b5cf6' }} />; case 'attendance_update': return <Clock size={18} style={{ color: '#8b5cf6' }} />; default: return <Info size={18} style={{ color: '#6b7280' }} />; } })()}
                                </div>
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative' }}>
                              <div style={{ paddingRight: '56px' }}>
                                <h4 style={{
                                  margin: 0,
                                  fontSize: '0.875rem',
                                  fontWeight: notif.is_read ? 700 : 800,
                                  color: 'var(--color-text)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}>
                                  {notif.title}
                                  {!notif.is_read && (
                                    <span style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      background: isWarning ? '#ef4444' : '#3b82f6',
                                      display: 'inline-block',
                                      marginLeft: '6px',
                                      boxShadow: `0 0 6px ${isWarning ? '#ef4444' : '#3b82f6'}`
                                    }} />
                                  )}
                                </h4>
                              </div>

                              <span style={{ 
                                fontSize: '0.72rem', 
                                color: 'var(--color-text-muted)', 
                                fontWeight: 600, 
                                whiteSpace: 'nowrap',
                                marginTop: '1px'
                              }}>
                                {(() => {
                                  if (!notif.created_at) return '';
                                  const d = new Date(notif.created_at.replace(' ', 'T'));
                                  if (isNaN(d.getTime())) return notif.created_at;
                                  
                                  const now = new Date();
                                  const diffMs = now.getTime() - d.getTime();
                                  const diffMins = Math.floor(diffMs / 60000);
                                  
                                  if (diffMins < 1) return t("Vừa xong");
                                  if (diffMins < 60) return `${diffMins} ${t("phút trước")}`;
                                  if (diffMins < 1440) {
                                    const hrs = Math.floor(diffMins / 60);
                                    return `${hrs} ${t("giờ trước")}`;
                                  }
                                  const days = Math.floor(diffMins / 1440);
                                  return `${days} ${t("ngày trước")}`;
                                })()}
                              </span>

                              <p style={{
                                margin: '4px 0 0 0',
                                fontSize: '0.8125rem',
                                color: 'var(--color-text-muted)',
                                lineHeight: '1.4',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {notif.body}
                              </p>
                            </div>

                            <div 
                              className="notif-actions"
                              style={{ 
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                display: 'flex', 
                                gap: '2px', 
                                zIndex: 10
                              }}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleMarkRead(notif.id, notif.is_read ? 0 : 1)}
                                style={{
                                  padding: '6px',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--color-text-light)',
                                  borderRadius: '6px',
                                  transition: 'all 0.2s',
                                  outline: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title={notif.is_read ? t("Đánh dấu chưa đọc") : t("Đánh dấu đã đọc")}
                                onMouseEnter={e => {
                                  e.currentTarget.style.color = 'var(--color-primary)';
                                  e.currentTarget.style.background = 'var(--color-primary-light)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.color = 'var(--color-text-light)';
                                  e.currentTarget.style.background = 'none';
                                }}
                              >
                                {notif.is_read ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                onClick={() => handleDeleteNotif(notif.id)}
                                style={{
                                  padding: '6px',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--color-text-light)',
                                  borderRadius: '6px',
                                  transition: 'all 0.2s',
                                  outline: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title={t("Xóa")}
                                onMouseEnter={e => {
                                  e.currentTarget.style.color = '#ef4444';
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.color = 'var(--color-text-light)';
                                  e.currentTarget.style.background = 'none';
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </CustomModal>

      {/* Advanced Matrix Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isMatrixModalOpen}
        onClose={() => setIsMatrixModalOpen(false)}
        onBack={() => {
          setIsMatrixModalOpen(false);
          setIsNotifModalOpen(true);
        }}
      />
    </header>
  );
};

