import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, Trash2, Mail, MessageCircle, Shield, UserX, Clock, X, Link2Off, User, Send, Check, RefreshCw, BarChart2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Avatar } from '../components/ui/Avatar';
import { fetchAPI } from '../utils/api';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { CustomSelect } from '../components/ui/CustomSelect';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell
} from 'recharts';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'inactive';
  telegram_id: string | null;
  zalo_chat_id: string | null;
  created_at: string;
}

const DEFAULT_SCHEDULE = {
  "1": { active: true, start: "08:00", end: "17:30" },
  "2": { active: true, start: "08:00", end: "17:30" },
  "3": { active: true, start: "08:00", end: "17:30" },
  "4": { active: true, start: "08:00", end: "17:30" },
  "5": { active: true, start: "08:00", end: "17:30" },
  "6": { active: true, start: "08:00", end: "17:30" },
  "7": { active: true, start: "08:00", end: "17:30" }
};

const dayNames: { [key: string]: string } = {
  "1": "Thứ 2",
  "2": "Thứ 3",
  "3": "Thứ 4",
  "4": "Thứ 5",
  "5": "Thứ 6",
  "6": "Thứ 7",
  "7": "Chủ Nhật"
};

const formatScheduleTooltip = (schedule: any): string => {
  if (!schedule) return '';
  return Object.entries(dayNames).map(([dayKey, dayLabel]) => {
    const config = schedule[dayKey];
    if (!config) return `${dayLabel}: Không hoạt động`;
    if (!config.active) return `${dayLabel}: Nghỉ`;
    return `${dayLabel}: ${config.start} - ${config.end}`;
  }).join('\n');
};

export const Consultants = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [unlinkId, setUnlinkId] = useState<number | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  
  // Quick message state
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessageTarget, setQuickMessageTarget] = useState<any>(null);
  const [quickMessageText, setQuickMessageText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  // Consultant stats state
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsConsultant, setStatsConsultant] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsDateMode, setStatsDateMode] = useState<string>('this_month');
  const [statsStartDate, setStatsStartDate] = useState<string>('');
  const [statsEndDate, setStatsEndDate] = useState<string>('');
  
  const [scheduleMode, setScheduleMode] = useState<'daily' | 'custom'>('daily');
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    status: string;
    leave_start: string;
    leave_end: string;
    zalo_chat_id: string;
    work_start_time: string;
    work_end_time: string;
    work_schedule: any;
    avatar: string;
  }>({
    name: '',
    email: '',
    status: 'active',
    leave_start: '',
    leave_end: '',
    zalo_chat_id: '',
    work_start_time: '00:00',
    work_end_time: '23:59',
    work_schedule: null,
    avatar: ''
  });

  const handleDayChange = (dayKey: string, field: 'active' | 'start' | 'end', value: any) => {
    setFormData(prev => {
      const currentSchedule = prev.work_schedule || DEFAULT_SCHEDULE;
      const updatedDayConfig = {
        ...currentSchedule[dayKey],
        [field]: value
      };
      return {
        ...prev,
        work_schedule: {
          ...currentSchedule,
          [dayKey]: updatedDayConfig
        }
      };
    });
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const json = await fetchAPI('get_consultants');
      if (json.success) setUsers(json.data);
    } catch (e: any) {
      toast.error('Không thể tải dữ liệu: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setScheduleMode('daily');
    setFormData({ 
      name: '', 
      email: '', 
      status: 'active', 
      leave_start: '', 
      leave_end: '', 
      zalo_chat_id: '',
      work_start_time: '00:00',
      work_end_time: '23:59',
      work_schedule: null,
      avatar: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    const hasCustomSchedule = !!user.work_schedule;
    setScheduleMode(hasCustomSchedule ? 'custom' : 'daily');
    setFormData({ 
      name: user.name, 
      email: user.email, 
      status: user.status,
      leave_start: user.leave_start || '', 
      leave_end: user.leave_end || '',
      zalo_chat_id: user.zalo_chat_id || '',
      work_start_time: user.work_start_time || '00:00',
      work_end_time: user.work_end_time || '23:59',
      work_schedule: user.work_schedule || null,
      avatar: user.avatar || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return toast.error('Vui lòng điền đầy đủ thông tin');
    if (isSaving) return;

    setIsSaving(true);
    try {
      const action = editingUser ? 'edit_consultant' : 'add_consultant';
      const payload = { 
        ...formData, 
        id: editingUser?.id,
        work_schedule: scheduleMode === 'custom' ? formData.work_schedule : null
      };
      const json = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (json.success) {
        toast.success(editingUser ? 'Cập nhật thành công!' : 'Thêm mới thành công!');
        fetchUsers();
        setModalOpen(false);
      } else {
        toast.error(json.message || 'Lỗi khi lưu');
      }
    } catch (e: any) { toast.error('Lỗi: ' + e.message); }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const json = await fetchAPI(`delete_consultant&id=${deleteId}`);
      if (json.success) {
        toast.success('Đã xóa thành công!');
        fetchUsers();
      } else {
        toast.error(json.message || 'Lỗi khi xóa');
      }
    } catch (e: any) { toast.error('Lỗi: ' + e.message); }
    setIsDeleting(false);
    setConfirmDeleteOpen(false);
  };

  const confirmUnlinkZalo = (id: number) => {
    setUnlinkId(id);
    setUnlinkConfirmOpen(true);
  };

  const handleUnlinkZalo = async () => {
    if (!unlinkId) return;
    try {
      const json = await fetchAPI('unlink_zalo', {
        method: 'POST',
        body: JSON.stringify({ id: unlinkId, type: 'consultant' })
      });
      if (json.success) {
        toast.success('Đã hủy liên kết Zalo thành công!');
        fetchUsers();
      } else {
        toast.error(json.message || 'Lỗi khi hủy liên kết');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setUnlinkConfirmOpen(false);
    setUnlinkId(null);
  };
  const [zaloRemindingId, setZaloRemindingId] = useState<number | null>(null);
  const [zaloRemindedId, setZaloRemindedId] = useState<number | null>(null);

  const handleResendZaloVerify = async (consId: number) => {
    setZaloRemindingId(consId);
    try {
      const json = await fetchAPI('resend_zalo_verify_consultant', {
        method: 'POST',
        body: JSON.stringify({ id: consId })
      });
      if (json.success) {
        toast.success('Đã gửi lại email nhắc xác thực Zalo.');
        setZaloRemindedId(consId);
        setTimeout(() => setZaloRemindedId(null), 5000);
      } else {
        toast.error(json.message || 'Lỗi khi gửi email');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setZaloRemindingId(null);
  };

  const handleSendQuickMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessageText.trim() || !quickMessageTarget) return;
    setIsSendingMsg(true);
    try {
      const res = await fetchAPI('send_quick_zalo_message', {
        method: 'POST',
        body: JSON.stringify({ consultant_id: quickMessageTarget.id, message: quickMessageText })
      });
      if (res.success) {
        toast.success(res.message || 'Đã gửi tin nhắn thành công!');
        setQuickMessageOpen(false);
        setQuickMessageText('');
      } else {
        toast.error(res.message || 'Lỗi khi gửi tin');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSendingMsg(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file hình ảnh hợp lệ.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB.');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);

      const res = await fetchAPI('upload_avatar', {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        setFormData(prev => ({ ...prev, avatar: res.url }));
        toast.success('Tải ảnh đại diện lên thành công!');
      } else {
        toast.error(res.message || 'Lỗi khi tải ảnh lên');
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối: ' + err.message);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchConsultantStats = async (consId: number, mode: string, start?: string, end?: string) => {
    setStatsLoading(true);
    try {
      let query = `get_consultant_stats&consultant_id=${consId}&date_mode=${mode}`;
      if (mode === 'custom' && start && end) {
        query += `&start_date=${start}&end_date=${end}`;
      }
      const json = await fetchAPI(query);
      if (json.success) {
        setStatsData(json);
      } else {
        toast.error(json.message || 'Lỗi khi tải báo cáo thống kê');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối: ' + e.message);
    }
    setStatsLoading(false);
  };

  useEffect(() => {
    if (statsModalOpen && statsConsultant) {
      if (statsDateMode !== 'custom' || (statsStartDate && statsEndDate)) {
        fetchConsultantStats(statsConsultant.id, statsDateMode, statsStartDate, statsEndDate);
      }
    }
  }, [statsModalOpen, statsConsultant, statsDateMode, statsStartDate, statsEndDate]);

  const activeCount   = users.filter(u => u.status === 'active').length;
  const leaveCount    = users.filter(u => u.status === 'leave').length;
  const inactiveCount = users.filter(u => u.status === 'inactive').length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Tư vấn viên</h1>
          <p className="page-subtitle">
            Danh sách nhân sự tiếp nhận và xử lý data từ hệ thống
          </p>
        </div>
        <button onClick={openAddModal} className="btn primary responsive-btn-full">
          <Plus size={16} /> Thêm TVV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card hover-lift">
          <div className="stat-label">Tổng TVV</div>
          <div className="stat-value">{users.length}</div>
        </div>
        <div className="stat-card hover-lift">
          <div className="stat-label" style={{ color: 'var(--color-success)' }}>Đang nhận Data</div>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>{activeCount}</div>
        </div>
        <div className="stat-card hover-lift">
          <div className="stat-label" style={{ color: 'var(--color-warning)' }}>Đang nghỉ phép</div>
          <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{leaveCount}</div>
        </div>
        <div className="stat-card hover-lift">
          <div className="stat-label" style={{ color: 'var(--color-danger)' }}>Ngừng hoạt động</div>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{inactiveCount}</div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="mobile-table-compact">
            <thead>
              <tr>
                <th>Tên TVV</th>
                <th>Email</th>
                <th>Zalo Bot</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={4} />)
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                        <Users size={32} color="var(--color-text-muted)" />
                      </div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Chưa có Tư vấn viên</h3>
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>Thêm tư vấn viên đầu tiên để bắt đầu chia số tự động.</p>
                      <button className="btn primary" onClick={openAddModal}><Plus size={18}/> Thêm Tư vấn viên</button>
                    </div>
                  </td>
                </tr>
              ) : users.map((u) => {
                return (
                  <tr 
                    key={u.id} 
                    className="group table-row-hover"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openEditModal(u)}
                    title="Nhấp để chỉnh sửa thông tin"
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar src={u.avatar} name={u.name} size={32} />
                        <div>
                          <div 
                            style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)', transition: 'color 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text)'}
                          >
                            {u.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>ID: {u.id}</span>
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-text-muted)' }} />
                            {u.work_schedule ? (
                              <span 
                                style={{ 
                                  fontSize: '0.75rem', 
                                  color: '#0ea5e9', 
                                  fontWeight: 600, 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: 4,
                                  cursor: 'help',
                                  borderBottom: '1px dotted #0ea5e9'
                                }} 
                                title={formatScheduleTooltip(u.work_schedule)}
                              >
                                <Clock size={12} /> Lịch tuần
                              </span>
                            ) : (
                              (u.work_start_time === '00:00' && u.work_end_time === '23:59') || (!u.work_start_time && !u.work_end_time) ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }} title="Nhận data 24/24">
                                  <Clock size={12} /> 24/24
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }} title={`Nhận data từ ${u.work_start_time} đến ${u.work_end_time}`}>
                                  <Clock size={12} /> {u.work_start_time} - {u.work_end_time}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{u.email}</td>
                    <td>
                      {u.zalo_chat_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: 6, 
                            padding: '4px 10px', borderRadius: 20, 
                            background: '#e5f0ff', color: '#0068ff', fontSize: '0.75rem', fontWeight: 600
                          }}>
                            <MessageCircle size={14} fill="#0068ff" color="white" /> Đã liên kết
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: 6, 
                            padding: '4px 10px', borderRadius: 20, 
                            background: 'var(--color-bg)', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 500
                          }}>
                            Chưa liên kết
                          </span>
                          {u.email && (
                            zaloRemindedId === u.id ? (
                              <span style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                <Check size={12} /> Đã nhắc
                              </span>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); handleResendZaloVerify(u.id); }} className="btn ghost" style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }} title="Gửi email nhắc xác thực Zalo" disabled={zaloRemindingId === u.id}>
                                {zaloRemindingId === u.id ? <RefreshCw size={12} className="spin" /> : <Send size={12} />} {zaloRemindingId === u.id ? 'Đang gửi...' : 'Nhắc'}
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {u.status === 'active' ? (
                        <span className="badge success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                          Đang nhận Data
                        </span>
                      ) : u.status === 'leave' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className="badge warning" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                            <Clock size={12} /> Nghỉ phép
                          </span>
                          {(u.leave_start || u.leave_end) && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                              {u.leave_start ? new Date(u.leave_start).toLocaleDateString('vi-VN') : '...'} - {u.leave_end ? new Date(u.leave_end).toLocaleDateString('vi-VN') : '...'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="badge danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <UserX size={12} /> Ngừng HĐ
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div className="row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', opacity: 0, transition: 'opacity 0.15s' }}>
                        <button 
                          onClick={() => { 
                            setStatsConsultant(u); 
                            setStatsDateMode('this_month');
                            setStatsStartDate('');
                            setStatsEndDate('');
                            setStatsModalOpen(true); 
                          }} 
                          className="btn ghost sm" 
                          style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: 'var(--color-primary)' }} 
                          title="Thống kê hiệu suất"
                        >
                          <BarChart2 size={14} />
                        </button>
                        <button onClick={() => { setDeleteId(u.id); setConfirmDeleteOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: 'var(--color-danger)' }} title="Xóa nhân sự">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setModalOpen(false)}>
          <div 
            className="card"
            style={{ width: '100%', maxWidth: 800, maxHeight: '95vh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                {editingUser ? 'Cập nhật Tư vấn viên' : 'Thêm Tư vấn viên mới'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ color: 'var(--color-text-muted)', padding: 4, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                  
                  {/* Cột 1: Thông tin cá nhân & Trạng thái */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Avatar Upload */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                      <div style={{ position: 'relative' }}>
                        <Avatar src={formData.avatar} name={formData.name || 'Sale'} size={64} />
                        {isUploadingAvatar && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <RefreshCw size={16} className="spin" />
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                          Ảnh đại diện TVV
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="btn outline sm"
                            style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto', background: 'var(--color-surface)' }}
                            disabled={isUploadingAvatar}
                          >
                            Tải ảnh lên
                          </button>
                          {formData.avatar && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, avatar: '' })}
                              className="btn outline sm"
                              style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto', color: 'var(--color-danger)', borderColor: 'var(--color-danger-light)', background: 'var(--color-surface)' }}
                            >
                              Xóa ảnh
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleAvatarUpload}
                          accept="image/*"
                          style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                          Định dạng JPG, PNG, WEBP (tối đa 5MB)
                        </span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={14}/> Họ và Tên <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <input 
                        className="form-input" 
                        placeholder="VD: Nguyễn Văn A" 
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={14}/> Email <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <input 
                        type="email"
                        className="form-input" 
                        placeholder="VD: email@domain.com" 
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14}/> Trạng thái</label>
                      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
                        <button 
                          type="button" 
                          onClick={() => setFormData({ ...formData, status: 'active' })}
                          style={{ flex: 1, padding: '0.5rem 0.25rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.75rem',
                            background: formData.status === 'active' ? (theme === 'dark' ? 'var(--color-surface)' : 'white') : 'transparent',
                            color: formData.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)',
                            boxShadow: formData.status === 'active' ? 'var(--shadow-sm)' : 'none',
                            transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                          }}
                        >Đang nhận Data</button>
                        <button 
                          type="button" 
                          onClick={() => setFormData({ ...formData, status: 'leave' })}
                          style={{ flex: 1, padding: '0.5rem 0.25rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.75rem',
                            background: formData.status === 'leave' ? (theme === 'dark' ? 'var(--color-surface)' : 'white') : 'transparent',
                            color: formData.status === 'leave' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                            boxShadow: formData.status === 'leave' ? 'var(--shadow-sm)' : 'none',
                            transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                          }}
                        >Nghỉ phép</button>
                        <button 
                          type="button" 
                          onClick={() => setFormData({ ...formData, status: 'inactive' })}
                          style={{ flex: 1, padding: '0.5rem 0.25rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.75rem',
                            background: formData.status === 'inactive' ? (theme === 'dark' ? 'var(--color-surface)' : 'white') : 'transparent',
                            color: formData.status === 'inactive' ? 'var(--color-danger)' : 'var(--color-text-muted)',
                            boxShadow: formData.status === 'inactive' ? 'var(--shadow-sm)' : 'none',
                            transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                          }}
                        >Ngừng HĐ</button>
                      </div>
                    </div>

                    {formData.status === 'leave' && (
                      <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--color-warning-light)', padding: '0.75rem', borderRadius: 12, border: '1px solid var(--color-border)', animation: 'slideUp 0.15s ease-out' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Từ ngày</label>
                          <input 
                            type="date" 
                            className="form-input" 
                            style={{ padding: '6px 10px', fontSize: '0.8125rem' }}
                            value={formData.leave_start}
                            onChange={e => setFormData({ ...formData, leave_start: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Đến ngày</label>
                          <input 
                            type="date" 
                            className="form-input" 
                            style={{ padding: '6px 10px', fontSize: '0.8125rem' }}
                            value={formData.leave_end}
                            onChange={e => setFormData({ ...formData, leave_end: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {editingUser && (
                      <div className="form-group" style={{ padding: '0.75rem 1rem', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', marginTop: '1.25rem' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                          <Send size={14} color="var(--color-primary)" /> Tương tác nhanh với Sale
                        </label>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: 8 }}>
                          {(editingUser.zalo_chat_id || editingUser.email) && (
                            <button
                              type="button"
                              onClick={() => { setQuickMessageTarget(editingUser); setQuickMessageOpen(true); }}
                              className="btn outline"
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.75rem', padding: '8px 12px', height: 'auto', borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = theme === 'dark' ? 'var(--color-bg)' : '#e5f0ff' }}
                              onMouseLeave={e => { e.currentTarget.style.background = theme === 'dark' ? 'var(--color-surface)' : 'white' }}
                            >
                              <MessageCircle size={14} /> Nhắn tin nhanh
                            </button>
                          )}
                          {editingUser.zalo_chat_id && (
                            <button
                              type="button"
                              onClick={() => confirmUnlinkZalo(editingUser.id)}
                              className="btn outline"
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.75rem', padding: '8px 12px', height: 'auto', borderColor: 'var(--color-warning)', color: 'var(--color-warning)', background: 'var(--color-surface)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-warning-light)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = theme === 'dark' ? 'var(--color-surface)' : 'white' }}
                            >
                              <Link2Off size={14} /> Hủy liên kết Zalo
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cột 2: Cấu hình ca làm việc & Liên kết Zalo */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} /> Giờ làm việc của Sale
                      </label>
                      
                      {/* Segmented Control for Schedule Mode */}
                      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-lg)', marginBottom: '0.75rem' }}>
                        <button 
                          type="button" 
                          onClick={() => setScheduleMode('daily')}
                          style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.75rem',
                            background: scheduleMode === 'daily' ? (theme === 'dark' ? 'var(--color-surface)' : 'white') : 'transparent',
                            color: scheduleMode === 'daily' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            boxShadow: scheduleMode === 'daily' ? 'var(--shadow-sm)' : 'none',
                            transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                          }}
                        >Cố định hàng ngày</button>
                        <button 
                          type="button" 
                          onClick={() => {
                            setScheduleMode('custom');
                            if (!formData.work_schedule) {
                              setFormData(prev => ({ ...prev, work_schedule: DEFAULT_SCHEDULE }));
                            }
                          }}
                          style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.75rem',
                            background: scheduleMode === 'custom' ? (theme === 'dark' ? 'var(--color-surface)' : 'white') : 'transparent',
                            color: scheduleMode === 'custom' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            boxShadow: scheduleMode === 'custom' ? 'var(--shadow-sm)' : 'none',
                            transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                          }}
                        >Tùy chỉnh (Thứ 2 - CN)</button>
                      </div>

                      {scheduleMode === 'daily' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--color-bg)', padding: '12px', borderRadius: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input 
                              type="checkbox" 
                              id="work_24h"
                              checked={(formData.work_start_time === '00:00' && formData.work_end_time === '23:59') || (!formData.work_start_time && !formData.work_end_time)} 
                              onChange={e => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, work_start_time: '00:00', work_end_time: '23:59', work_schedule: null });
                                } else {
                                  setFormData({ ...formData, work_start_time: '08:00', work_end_time: '22:00', work_schedule: null });
                                }
                              }}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                            <label htmlFor="work_24h" style={{ fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', color: 'var(--color-text)' }}>
                              Hoạt động 24/24 (Mặc định)
                            </label>
                          </div>
                          
                          {!((formData.work_start_time === '00:00' && formData.work_end_time === '23:59') || (!formData.work_start_time && !formData.work_end_time)) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4, animation: 'slideUp 0.15s ease-out' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Từ</label>
                                <input 
                                  type="time" 
                                  className="form-input" 
                                  style={{ padding: '6px 10px', fontSize: '0.875rem', width: '100%' }}
                                  value={formData.work_start_time}
                                  onChange={e => setFormData({ ...formData, work_start_time: e.target.value })}
                                />
                              </div>
                              <div style={{ alignSelf: 'flex-end', paddingBottom: 10, color: 'var(--color-text-muted)' }}>-</div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Đến</label>
                                <input 
                                  type="time" 
                                  className="form-input" 
                                  style={{ padding: '6px 10px', fontSize: '0.875rem', width: '100%' }}
                                  value={formData.work_end_time}
                                  onChange={e => setFormData({ ...formData, work_end_time: e.target.value })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Weekly Schedule Custom Configuration
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--color-bg)', padding: '12px', borderRadius: 12, maxHeight: '180px', overflowY: 'auto' }}>
                          {Object.entries(dayNames).map(([dayKey, dayLabel]) => {
                            const schedule = formData.work_schedule || DEFAULT_SCHEDULE;
                            const dayConfig = schedule[dayKey] || { active: true, start: '08:00', end: '17:30' };
                            
                            return (
                              <div key={dayKey} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '6px 0', borderBottom: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)' }}>
                                <div style={{ width: '60px', fontWeight: 600, fontSize: '0.75rem' }}>
                                  {dayLabel}
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <ToggleSwitch 
                                    checked={dayConfig.active}
                                    onChange={checked => handleDayChange(dayKey, 'active', checked)}
                                    small
                                  />
                                  <span style={{ fontSize: '0.7rem', fontWeight: 600, minWidth: '24px', color: dayConfig.active ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                    {dayConfig.active ? 'Bật' : 'Nghỉ'}
                                  </span>
                                </div>
                                
                                {dayConfig.active && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', animation: 'slideUp 0.1s ease-out' }}>
                                    <input 
                                      type="time"
                                      value={dayConfig.start}
                                      onChange={e => handleDayChange(dayKey, 'start', e.target.value)}
                                      style={{ padding: '2px 4px', fontSize: '0.7rem', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                                    />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>-</span>
                                    <input 
                                      type="time"
                                      value={dayConfig.end}
                                      onChange={e => handleDayChange(dayKey, 'end', e.target.value)}
                                      style={{ padding: '2px 4px', fontSize: '0.7rem', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 6, lineHeight: '1.3' }}>
                        Ngoài ca làm việc, data sẽ được hệ thống tạm giữ lại và tự động bàn giao khi Sale bắt đầu ca kế tiếp.
                      </p>
                    </div>

                    <div className="form-group" style={{ padding: '0.75rem 1rem', background: 'var(--color-info-light)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme === 'dark' ? '#60a5fa' : '#0068ff', fontSize: '0.8125rem' }}>
                        <MessageCircle size={14} /> Zalo Chat ID (Tự động cấp)
                      </label>
                      <input 
                        className="form-input" 
                        placeholder="Sale nhắn mã ID cho Zalo Bot để lấy..." 
                        value={formData.zalo_chat_id}
                        onChange={e => setFormData({ ...formData, zalo_chat_id: e.target.value })}
                        style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
                      />
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 6, lineHeight: '1.3' }}>
                        Hệ thống tự điền khi Sale xác thực Zalo. Admin có thể nhập tay nếu cần.
                      </p>
                    </div>


                  </div>

                </div>
              </div>

              <div style={{ padding: '1.25rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
                <button type="button" className="btn outline" onClick={() => setModalOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn primary" disabled={isSaving}>
                  {isSaving ? 'Đang lưu...' : (editingUser ? 'Cập nhật' : 'Thêm mới')}
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* Inline style for modal animation */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Quick Message Modal */}
      {quickMessageOpen && quickMessageTarget && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setQuickMessageOpen(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 400, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={20} fill="#0068ff" color="white" />
                Nhắn tin cho {quickMessageTarget.name}
              </h3>
              <button type="button" onClick={() => setQuickMessageOpen(false)} style={{ color: 'var(--color-text-muted)', padding: 4, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSendQuickMessage} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
                <div className="form-group">
                  <label className="form-label">Nội dung tin nhắn <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <textarea 
                    className="form-input" 
                    placeholder="Nhập nội dung cần thông báo cho Sale..." 
                    value={quickMessageText}
                    onChange={e => setQuickMessageText(e.target.value)}
                    required
                    autoFocus
                    style={{ minHeight: 100, resize: 'vertical' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>Tin nhắn sẽ được tự động gửi qua Zalo Bot (nếu có) và Email với tiêu đề [ TIN NHẮN TỪ QUẢN TRỊ VIÊN ]</p>
                </div>
              </div>
              <div style={{ padding: '1.25rem', background: theme === 'dark' ? 'var(--color-surface)' : 'var(--color-bg)', borderTop: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
                <button type="button" className="btn ghost" onClick={() => setQuickMessageOpen(false)}>Hủy</button>
                <button type="submit" className="btn primary" disabled={isSendingMsg} style={{ background: '#0068ff', borderColor: '#0068ff' }}>
                  {isSendingMsg ? 'Đang gửi...' : 'Gửi tin nhắn'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* Statistics Modal */}
      {statsModalOpen && statsConsultant && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setStatsModalOpen(false)}>
          <div 
            className="card" 
            style={{ 
              width: '100%', 
              maxWidth: 900, 
              maxHeight: '92vh', 
              display: 'flex', 
              flexDirection: 'column', 
              animation: 'slideUp 0.2s ease-out' 
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="stats-header-container" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                <Avatar src={statsConsultant.avatar} name={statsConsultant.name} size={44} />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)' }}>Báo cáo hiệu suất TVV</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <strong>{statsConsultant.name}</strong> • ID: {statsConsultant.id} • {statsConsultant.email}
                  </p>
                </div>
              </div>

              {/* Timeframe Filter Dropdown in Header */}
              <div className="stats-header-filters">
                <Calendar size={18} color="var(--color-text-light)" style={{ display: 'flex', alignItems: 'center' }} />
                <div style={{ position: 'relative', zIndex: 100 }}>
                  <CustomSelect
                    options={[
                      { value: 'this_month', label: 'Tháng này (Mặc định)' },
                      { value: 'today', label: 'Hôm nay' },
                      { value: 'yesterday', label: 'Hôm qua' },
                      { value: '7_days', label: '7 ngày qua' },
                      { value: '30_days', label: '30 ngày qua' },
                      { value: 'last_month', label: 'Tháng trước' },
                      { value: 'all', label: 'Tất cả thời gian' },
                      { value: 'custom', label: 'Tự chọn ngày...' }
                    ]}
                    value={statsDateMode}
                    onChange={val => setStatsDateMode(String(val))}
                    width={180}
                  />
                </div>

                {statsDateMode === 'custom' && (
                  <div className="stats-custom-dates" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', animation: 'slideUp 0.15s ease-out', flexShrink: 0 }}>
                    <input 
                      type="date" 
                      className="form-input" 
                      style={{ padding: '4px 10px', fontSize: '0.8125rem', height: 32, width: 130 }}
                      value={statsStartDate}
                      onChange={e => setStatsStartDate(e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>đến</span>
                    <input 
                      type="date" 
                      className="form-input" 
                      style={{ padding: '4px 10px', fontSize: '0.8125rem', height: 32, width: 130 }}
                      value={statsEndDate}
                      onChange={e => setStatsEndDate(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <button 
                type="button" 
                onClick={() => setStatsModalOpen(false)} 
                className="stats-header-close"
                style={{ color: 'var(--color-text-muted)', padding: 4, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')} 
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
              {statsLoading && !statsData ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', gap: '1rem' }}>
                  <RefreshCw size={32} className="spin" color="var(--color-primary)" />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Đang tải báo cáo...</span>
                </div>
              ) : !statsData ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                  Không có dữ liệu thống kê.
                </div>
              ) : (
                <>
                  {/* Subtle Loading overlay if reloading in background */}
                  {statsLoading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--color-primary-light)', zIndex: 10, overflow: 'hidden' }}>
                      <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
                    </div>
                  )}
                  <style>{`
                    @keyframes loadingBar {
                      0% { transform: translateX(-100%); }
                      100% { transform: translateX(330%); }
                    }
                  `}</style>
                  
                  {/* KPI Cards Row (4 Columns) */}
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--color-primary-light)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(124, 58, 237, 0.1)' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thành công</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
                        {statsData.summary.successful}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Data đã bàn giao</div>
                    </div>
                    
                    <div style={{ background: 'var(--color-warning-light)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nhắc lại</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: 4 }}>
                        {statsData.summary.reminder || 0}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Yêu cầu gọi lại</div>
                    </div>

                    <div style={{ background: 'var(--color-danger-light)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lỗi</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 4 }}>
                        {statsData.summary.error || 0}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Trùng lặp / Lỗi chia</div>
                    </div>

                    <div style={{ background: 'var(--color-success-light)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỷ lệ</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 4 }}>
                        {statsData.summary.system_total_successful > 0 
                          ? Math.round((statsData.summary.successful / statsData.summary.system_total_successful) * 100) 
                          : 0}%
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Thành công / Tổng của tất cả sale</div>
                    </div>
                  </div>

                  {/* Row 1: Daily trend bar chart (Full Width) */}
                  <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', width: '100%' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>Lưu lượng nhận Data theo Ngày</h4>
                    {statsData.by_date && statsData.by_date.length > 0 ? (
                       <div style={{ height: 180, width: '100%' }}>
                         <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={statsData.by_date} margin={{ left: -20, right: 5, top: 10, bottom: 0 }}>
                             <defs>
                               <linearGradient id="statsDateGradient" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="0%" stopColor="#c084fc" stopOpacity={1} />
                                 <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8} />
                               </linearGradient>
                             </defs>
                             <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                             <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                             <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                             <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                             <Bar dataKey="count" fill="url(#statsDateGradient)" radius={[4, 4, 0, 0]} maxBarSize={30} name="Data thành công" />
                           </BarChart>
                         </ResponsiveContainer>
                       </div>
                    ) : (
                      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        Không có dữ liệu phân bổ theo ngày
                      </div>
                    )}
                  </div>

                  {/* Row 2: Status Ratio (Donut) & Rounds Breakdown */}
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Donut chart for status ratio */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>Tỷ lệ Trạng thái Data</h4>
                      {(() => {
                        const statusChartData = [
                          { name: 'Thành công', value: statsData.summary.successful, color: '#7c3aed' },
                          { name: 'Nhắc lại', value: statsData.summary.reminder, color: '#f59e0b' },
                          { name: 'Lỗi', value: statsData.summary.error, color: '#ef4444' }
                        ].filter(item => item.value > 0);

                        return statsData.summary.total > 0 && statusChartData.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', justifyContent: 'center' }}>
                            <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={statusChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={55}
                                    paddingAngle={4}
                                    dataKey="value"
                                  >
                                    {statusChartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
                              {statusChartData.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                    {item.name}: <strong style={{ fontSize: '0.8125rem' }}>{item.value}</strong> ({Math.round(item.value / statsData.summary.total * 100)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2rem 0' }}>
                            Không có dữ liệu lưu lượng
                          </div>
                        );
                      })()}
                    </div>

                    {/* Rounds breakdown chart */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>Phân bổ theo Vòng (Round)</h4>
                      {statsData.rounds.length > 0 ? (
                        <div style={{ height: 160, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statsData.rounds} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light)" />
                              <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis dataKey="round_name" type="category" width={90} tick={{ fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                              <Bar dataKey="successful_count" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} barSize={12} name="Thành công" />
                              <Bar dataKey="reminder_count" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={12} name="Nhắc lại" />
                              <Bar dataKey="error_count" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12} name="Lỗi" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2rem 0' }}>
                          Không có dữ liệu chia số theo vòng
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Marketing Sources & Tickets Reports */}
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Source breakdown list */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>Tỷ lệ Nguồn Data (Chi tiết)</h4>
                      {statsData.by_source && statsData.by_source.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
                          {statsData.by_source.map((src: any, idx: number) => {
                            const sourcePercent = statsData.summary.successful > 0 
                              ? Math.round((src.count / statsData.summary.successful) * 100)
                              : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{src.source}</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{src.count} data ({sourcePercent}%)</span>
                                </div>
                                <div style={{ width: '100%', height: 4, background: 'var(--color-border-light)', borderRadius: 2 }}>
                                  <div style={{ width: `${sourcePercent}%`, height: '100%', background: '#8b5cf6', borderRadius: 2 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '1.5rem 0' }}>
                          Không có dữ liệu nguồn data
                        </div>
                      )}
                    </div>

                    {/* Tickets Reports statistics */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>Thống kê Ticket báo lỗi Data</h4>
                      {statsData.tickets ? (
                        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                          <div style={{ background: 'var(--color-bg)', padding: '6px', borderRadius: 8, border: '1px solid var(--color-border-light)' }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>GỬI ĐI</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{statsData.tickets.total}</div>
                          </div>
                          <div style={{ background: 'var(--color-success-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--color-success)', fontWeight: 700 }}>ĐÃ BÙ</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 2 }}>{statsData.tickets.approved}</div>
                          </div>
                          <div style={{ background: 'var(--color-warning-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--color-warning)', fontWeight: 700 }}>ĐANG CHỜ</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: 2 }}>{statsData.tickets.pending}</div>
                          </div>
                          <div style={{ background: 'var(--color-danger-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--color-danger)', fontWeight: 700 }}>TỪ CHỐI</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 2 }}>{statsData.tickets.rejected}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '1rem 0' }}>
                          Không có dữ liệu ticket
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.25rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
              <button type="button" className="btn primary sm" onClick={() => setStatsModalOpen(false)}>Đóng</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal 
        isOpen={confirmDeleteOpen} 
        onClose={() => setConfirmDeleteOpen(false)} 
        onConfirm={handleDelete} 
        title="Cảnh báo Xóa Tư vấn viên" 
        message="Bạn có chắc chắn muốn xóa tư vấn viên này không? CHÚ Ý: Nếu TVV này đã từng nhận Data, việc xóa sẽ làm hỏng báo cáo thống kê. Thay vào đó, bạn nên chuyển trạng thái của TVV sang 'Ngừng hoạt động' hoặc 'Nghỉ phép'." 
        confirmText="Xóa vĩnh viễn" 
      />

      <ConfirmModal 
        isOpen={unlinkConfirmOpen} 
        onClose={() => setUnlinkConfirmOpen(false)} 
        onConfirm={handleUnlinkZalo} 
        title="Hủy liên kết Zalo Bot" 
        message="Bạn có chắc chắn muốn hủy liên kết Zalo của tư vấn viên này không? Hệ thống sẽ ngừng gửi data và mọi thông báo qua Zalo cho tài khoản này ngay lập tức." 
        confirmText="Hủy liên kết" 
      />
    </div>
  );
};
