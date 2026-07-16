import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from './Skeleton';
import api from '../../api/axios';
import { DEV_MODE } from '../../config/env';
import { useMockStore } from '../../store/mockStore';

interface Notification {
  id: number;
  title: string;
  body: string | null;
  type: string;
  is_read: number;
  link: string | null;
  created_at: string;
}

const MOCK_NOTIFS: Notification[] = [];

const typeIcon: Record<string, React.ReactNode> = {
  info:    <Info size={14} color="#3b82f6" />,
  success: <CheckCircle2 size={14} color="#10b981" />,
  warning: <AlertTriangle size={14} color="#f59e0b" />,
  error:   <XCircle size={14} color="#ef4444" />,
};

const fmtTime = (d: string) => {
  const dt = new Date(d);
  const diff = (Date.now() - dt.getTime()) / 1000;
  if (diff < 60)   return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400)return `${Math.floor(diff / 3600)} giờ trước`;
  return dt.toLocaleDateString('vi-VN');
};

export const NotificationsDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    if (DEV_MODE) {
      setNotifications(useMockStore.getState().notifications);
      return;
    }
    setLoading(true);
    try {
      const r = await api.get('/notifications');
      const data = r.data.data;
      // Guard: API must return an array
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // silently fail — keep empty list
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      // mark each unread individually
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => api.patch(`/notifications/${n.id}`)));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const clearAll = async () => {
    try {
      await api.delete('/notifications');
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', background: open ? 'var(--color-primary-light)' : 'var(--color-bg)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: open ? 'var(--color-primary)' : 'var(--color-text-light)', transition: 'all 0.2s' }}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-danger)', color: 'white', fontSize: '0.625rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-surface)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 380, background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--color-border)', zIndex: 500, overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Thông báo</h3>
                {unreadCount > 0 && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{unreadCount} chưa đọc</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} title="Đánh dấu tất cả đã đọc"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-light)' }}>
                    <CheckCheck size={12} /> Đọc hết
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={clearAll} title="Xóa tất cả"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {loading && notifications.length === 0 && (
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '4px 0' }}>
                      <Skeleton width={28} height={28} borderRadius="50%" />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Skeleton width="85%" height={12} />
                        <Skeleton width="50%" height={9} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!loading && notifications.length === 0 && (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                  <Bell size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '0.75rem' }} />
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Không có thông báo</p>
                </div>
              )}
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.is_read) markRead(n.id); }}
                  style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border-light)', background: !n.is_read ? 'var(--color-primary-light)' : 'transparent', cursor: 'pointer', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', transition: 'background 0.2s' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    {typeIcon[n.type] || typeIcon.info}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: n.is_read ? 400 : 600, color: 'var(--color-text)', lineHeight: 1.4 }}>{n.title}</p>
                    {n.body && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</p>}
                    <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{fmtTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
