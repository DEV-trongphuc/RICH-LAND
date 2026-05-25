import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Plus, Edit3, Trash2, KeyRound, UserCog, Send, X, Link2Off, Check, RefreshCw, History, MessageCircle, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Avatar } from '../components/ui/Avatar';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../components/ui/Skeleton';

export const Accounts = () => {
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

  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    zalo_chat_id: '',
    role: 'viewer',
    avatar: ''
  });

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [usageInfo, setUsageInfo] = useState<any>(null);
  const [replacementId, setReplacementId] = useState<number | null>(null);
  const [showReplacementModal, setShowReplacementModal] = useState(false);

  const [quickMsgText, setQuickMsgText] = useState('');
  const [isSendingQuickMsg, setIsSendingQuickMsg] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleSendQuickMsgInModal = async () => {
    if (!quickMsgText.trim() || !editingAccount) return;
    setIsSendingQuickMsg(true);
    try {
      const res = await fetchAPI('send_quick_zalo_message', {
        method: 'POST',
        body: JSON.stringify({ account_id: editingAccount.id, message: quickMsgText })
      });
      if (res.success) {
        toast.success(res.message || 'Đã gửi tin nhắn thành công!');
        setQuickMsgText('');
      } else {
        toast.error(res.message || 'Lỗi khi gửi tin');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    } finally {
      setIsSendingQuickMsg(false);
    }
  };

  const handleUnlinkZaloInModal = async () => {
    if (!editingAccount) return;
    if (!window.confirm("Bạn có chắc chắn muốn hủy liên kết Zalo của tài khoản này không?")) return;
    setIsUnlinking(true);
    try {
      const json = await fetchAPI('unlink_zalo', {
        method: 'POST',
        body: JSON.stringify({ id: editingAccount.id, type: 'account' })
      });
      if (json.success) {
        toast.success('Đã hủy liên kết Zalo thành công!');
        setFormData(prev => ({ ...prev, zalo_chat_id: '' }));
        setEditingAccount((prev: any) => ({ ...prev, zalo_chat_id: null }));
        fetchAccounts();
      } else {
        toast.error(json.message || 'Lỗi khi hủy liên kết');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleDeleteClickInModal = () => {
    if (!editingAccount) return;
    const id = editingAccount.id;
    setModalOpen(false);
    triggerDeleteFlow(id);
  };

  const [activeTab, setActiveTab] = useState<'accounts' | 'logs'>('accounts');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogsPage(1);
    try {
      const json = await fetchAPI('get_admin_logs');
      if (json.success) setLogs(json.data);
    } catch (e: any) {
      toast.error('Không thể tải nhật ký hoạt động: ' + e.message);
    }
    setLoadingLogs(false);
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  const fetchAccounts = async () => {
    try {
      const json = await fetchAPI('get_accounts');
      if (json.success) setAccounts(json.data);
    } catch (e: any) {
      toast.error('Không thể tải dữ liệu: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openAddModal = () => {
    setEditingAccount(null);
    setFormData({ username: '', password: '', name: '', email: '', zalo_chat_id: '', role: 'viewer', avatar: '' });
    setQuickMsgText('');
    setModalOpen(true);
  };

  const openEditModal = (acc: any) => {
    setEditingAccount(acc);
    setFormData({ username: acc.username, password: '', name: acc.name, email: acc.email || '', zalo_chat_id: acc.zalo_chat_id || '', role: acc.role, avatar: acc.avatar || '' });
    setQuickMsgText('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.name) return toast.error('Vui lòng nhập đủ tên và username');
    if (!editingAccount && !formData.password) return toast.error('Vui lòng nhập mật khẩu cho tài khoản mới');
    // Email bắt buộc trừ Super Admin (id=1)
    const isSuperAdmin = Number(editingAccount?.id) === 1;
    if (!isSuperAdmin) {
      if (!formData.email) return toast.error('Email là bắt buộc để đăng nhập');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return toast.error('Định dạng email không hợp lệ');
    }
    if (isSaving) return;
    
    setIsSaving(true);
    const action = editingAccount ? 'edit_account' : 'add_account';
    const payload = { ...formData, id: editingAccount?.id };

    try {
      const json = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        toast.success(editingAccount ? 'Cập nhật thành công!' : 'Thêm mới thành công!');
        fetchAccounts();
        setModalOpen(false);
      } else {
        toast.error(json.message || 'Lỗi khi lưu');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSaving(false);
  };

  const triggerDeleteFlow = async (id: number) => {
    setDeleteId(id);
    try {
      const json = await fetchAPI(`check_delete_account&id=${id}`);
      if (json.success) {
        if (json.in_use) {
          setUsageInfo(json);
          setReplacementId(json.other_admins.length > 0 ? json.other_admins[0].id : null);
          setShowReplacementModal(true);
        } else {
          setConfirmOpen(true);
        }
      } else {
        toast.error(json.message || 'Lỗi khi kiểm tra tài khoản');
      }
    } catch (e: any) {
      toast.error('Lỗi kiểm tra: ' + e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const json = await fetchAPI(`delete_account&id=${deleteId}`);
      if (json.success) {
        toast.success('Đã xóa thành công!');
        fetchAccounts();
      } else {
        toast.error(json.message || 'Lỗi khi xóa');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsDeleting(false);
    setConfirmOpen(false);
  };

  const handleDeleteWithReplacement = async () => {
    if (!deleteId || !replacementId || isDeleting) return;
    setIsDeleting(true);
    try {
      const json = await fetchAPI(`delete_account&id=${deleteId}&replacement_id=${replacementId}`);
      if (json.success) {
        toast.success('Đã chuyển giao cấu hình và xóa tài khoản thành công!');
        fetchAccounts();
        setShowReplacementModal(false);
      } else {
        toast.error(json.message || 'Lỗi khi xóa');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsDeleting(false);
  };

  const handleResendConfirm = async (accId: number) => {
    try {
      const json = await fetchAPI('resend_confirm_email', {
        method: 'POST',
        body: JSON.stringify({ id: accId })
      });
      if (json.success) {
        toast.success('Đã gửi lại link xác thực. Vui lòng kiểm tra email.');
      } else {
        toast.error(json.message || 'Lỗi khi gửi email');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const [zaloRemindingId, setZaloRemindingId] = useState<number | null>(null);
  const [zaloRemindedId, setZaloRemindedId] = useState<number | null>(null);

  const handleResendZaloVerify = async (accId: number) => {
    setZaloRemindingId(accId);
    try {
      const json = await fetchAPI('resend_zalo_verify_account', {
        method: 'POST',
        body: JSON.stringify({ id: accId })
      });
      if (json.success) {
        toast.success('Đã gửi lại email nhắc xác thực Zalo.');
        setZaloRemindedId(accId);
        setTimeout(() => setZaloRemindedId(null), 5000);
      } else {
        toast.error(json.message || 'Lỗi khi gửi email');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setZaloRemindingId(null);
  };



  const getRoleBadge = (role: string) => {
    if (role === 'admin') return <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--color-primary)', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Admin</span>;
    if (role === 'assistant') return <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Assistant</span>;
    return <span style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Viewer</span>;
  };

  const LOGS_PER_PAGE = 50;
  const totalLogPages = Math.ceil(logs.length / LOGS_PER_PAGE);
  const paginatedLogs = logs.slice((logsPage - 1) * LOGS_PER_PAGE, logsPage * LOGS_PER_PAGE);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCog size={28} color="var(--color-primary)" /> Quản lý Tài khoản
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Quản trị hệ thống và phân quyền truy cập cho nhân viên.</p>
        </div>
        <button onClick={openAddModal} className="btn primary responsive-btn-full" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', fontSize: '0.875rem' }}>
          <Plus size={18} /> <span>Thêm<span className="hide-on-mobile"> tài khoản</span></span>
        </button>
      </div>

      {/* Tabs */}
      <div className="mobile-filter-tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem', paddingBottom: '0.25rem' }}>
        <button 
          onClick={() => setActiveTab('accounts')}
          style={{
            padding: '0.75rem 1rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'accounts' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'accounts' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            fontWeight: activeTab === 'accounts' ? 700 : 500,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0
          }}
        >
          <UserCog size={16} /> <span><span className="hide-on-mobile">Danh sách </span>Tài khoản</span>
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '0.75rem 1rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'logs' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'logs' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            fontWeight: activeTab === 'logs' ? 700 : 500,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0
          }}
        >
          <History size={16} /> <span>Nhật ký<span className="hide-on-mobile"> hoạt động Admin</span></span>
        </button>
      </div>
 
      {activeTab === 'accounts' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <TableSkeleton cols={6} rows={5} />
          ) : (
            <div className="table-wrap responsive-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="mobile-table-compact" style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tên người dùng</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Email đăng nhập</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Zalo Chat ID</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Phân quyền</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Hoạt động</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(acc => (
                    <tr key={acc.id} onClick={() => openEditModal(acc)} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', cursor: 'pointer' }} className="table-row-hover">
                      <td data-label="Tên người dùng" style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar src={acc.avatar} name={acc.name} size={36} />
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {acc.name}
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 2 }}>ID: {acc.id}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Email đăng nhập" style={{ padding: '1rem 1.5rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Shield size={14} />
                          <span>{acc.email || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa có email</span>}</span>
                          {acc.email && (
                            Number(acc.is_confirmed) === 1 ? (
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-success)', background: 'var(--color-success-light)', padding: '2px 6px', borderRadius: 12, fontWeight: 700 }}>Đã xác thực</span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: 12, fontWeight: 700 }}>Chưa xác thực</span>
                            )
                          )}
                        </div>
                        {acc.email && Number(acc.is_confirmed) === 0 && (
                          <div style={{ marginTop: 6, paddingLeft: 20 }}>
                            <button onClick={(e) => { e.stopPropagation(); handleResendConfirm(acc.id); }} className="btn ghost" style={{ fontSize: '0.75rem', padding: '2px 8px', color: 'var(--color-primary)' }}>
                              <Send size={12} style={{ marginRight: 4 }} /> Gửi lại link
                            </button>
                          </div>
                        )}
                      </td>
                      <td data-label="Zalo Chat ID" style={{ padding: '1rem 1.5rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
                        {acc.zalo_chat_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title={acc.zalo_chat_id}>
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
                            {acc.email && (
                              zaloRemindedId === acc.id ? (
                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                  <Check size={12} /> Đã nhắc
                                </span>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleResendZaloVerify(acc.id); }} className="btn ghost" style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }} title="Gửi email nhắc xác thực Zalo" disabled={zaloRemindingId === acc.id}>
                                  {zaloRemindingId === acc.id ? <RefreshCw size={12} className="spin" /> : <Send size={12} />} {zaloRemindingId === acc.id ? 'Đang gửi...' : 'Nhắc'}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </td>
                      <td data-label="Phân quyền" style={{ padding: '1rem 1.5rem' }}>
                        {getRoleBadge(acc.role)}
                      </td>
                      <td data-label="Hoạt động" style={{ padding: '1rem 1.5rem' }}>
                        {acc.last_login ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)', fontWeight: 600 }}>{new Date(acc.last_login).toLocaleDateString('vi-VN')}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(acc.last_login).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>Chưa đăng nhập</span>
                        )}
                      </td>
                      <td data-label="Thao tác" style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(acc); }} className="btn ghost" style={{ padding: 8, color: 'var(--color-primary)' }} title="Sửa">
                            <Edit3 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                            <UserCog size={32} color="var(--color-text-muted)" />
                          </div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Chưa có tài khoản</h3>
                          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>Hãy thêm tài khoản đầu tiên để cấp quyền truy cập hệ thống.</p>
                          <button className="btn primary" onClick={openAddModal}><Plus size={18}/> Thêm Tài khoản</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {loadingLogs ? (
            <TableSkeleton cols={5} rows={8} />
          ) : (
            <>
              <div className="table-wrap responsive-table-wrap mobile-card-table" style={{ border: 'none', borderRadius: 0, maxHeight: '600px', overflowY: 'auto' }}>
              <table className="mobile-table-compact" style={{ width: '100%', minWidth: 950, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>Thời gian</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>Người thực hiện</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>Hành động</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>Chi tiết</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map(log => {
                    const renderLogDetails = (detailsRaw: any) => {
                      try {
                        const details = typeof detailsRaw === 'string' ? JSON.parse(detailsRaw) : detailsRaw;
                        if (!details || Object.keys(details).length === 0) {
                          return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Không có chi tiết</span>;
                        }
                        if (details.message && Object.keys(details).length === 1) {
                          return <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{details.message}</span>;
                        }

                        const KEY_LABELS: Record<string, string> = {
                          round_id: 'Vòng (ID)',
                          round_name: 'Tên vòng',
                          compensations: 'Bù data',
                          log_id: 'ID log',
                          lead_id: 'ID lead',
                          lead_name: 'Tên lead',
                          phone: 'Số điện thoại',
                          new_consultant_id: 'ID TVV mới',
                          new_consultant_name: 'Tên TVV mới',
                          is_duplicate: 'Trùng lặp',
                          keys: 'Cấu hình thay đổi',
                          id: 'ID',
                          name: 'Tên hiển thị',
                          email: 'Email đăng nhập',
                          status: 'Trạng thái',
                          target_round_id: 'Vòng chuyển hướng',
                          logical_operator: 'Điều kiện logic',
                          sheet_name: 'Tên trang tính',
                          sheet_column: 'Cột trang tính',
                          system_field: 'Trường hệ thống',
                          connection_id: 'ID kết nối',
                          message: 'Thông báo',
                          admin_ids: 'Admin nhận thông báo',
                          compensate_skipped: 'Bù cho người cũ',
                          skipped_consultant_id: 'ID người cũ'
                        };

                        const renderValue = (key: string, val: any) => {
                          if (key === 'compensations' && typeof val === 'object' && val !== null) {
                            return (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                {Object.entries(val as any).map(([cid, count]: [string, any]) => (
                                  <span key={cid} style={{ 
                                    display: 'inline-flex', 
                                    padding: '2px 8px', 
                                    borderRadius: '12px', 
                                    background: Number(count) > 0 ? 'rgba(124, 58, 237, 0.1)' : 'var(--color-bg)',
                                    color: Number(count) > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                    border: Number(count) > 0 ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid var(--color-border)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600
                                  }}>
                                    ID {cid}: {String(count)} lượt
                                  </span>
                                ))}
                              </div>
                            );
                          }

                          if (key === 'keys' && Array.isArray(val)) {
                            const showAll = val.length <= 5;
                            const visibleKeys = showAll ? val : val.slice(0, 4);
                            const remainingCount = val.length - 4;
                            const tooltipText = !showAll ? val.slice(4).join(', ') : '';
                            return (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                {visibleKeys.map((k: string) => (
                                  <span key={k} style={{ 
                                    display: 'inline-flex', 
                                    padding: '2px 8px', 
                                    borderRadius: '6px', 
                                    background: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text-light)',
                                    fontSize: '0.7rem',
                                    fontFamily: 'monospace'
                                  }}>
                                    {k}
                                  </span>
                                ))}
                                {!showAll && (
                                  <span 
                                    title={tooltipText}
                                    style={{ 
                                      display: 'inline-flex', 
                                      padding: '2px 8px', 
                                      borderRadius: '6px', 
                                      background: 'rgba(59, 130, 246, 0.1)',
                                      border: '1px dashed rgba(59, 130, 246, 0.3)',
                                      color: '#3b82f6',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      cursor: 'help'
                                    }}
                                  >
                                    +{remainingCount} khác...
                                  </span>
                                )}
                              </div>
                            );
                          }

                          if (key === 'admin_ids' && Array.isArray(val)) {
                            return (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                {val.map((id: any) => (
                                  <span key={id} style={{ 
                                    display: 'inline-flex', 
                                    padding: '2px 8px', 
                                    borderRadius: '12px', 
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    color: '#3b82f6',
                                    border: '1px solid rgba(59, 130, 246, 0.2)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600
                                  }}>
                                    Admin ID {id}
                                  </span>
                                ))}
                              </div>
                            );
                          }

                          if (typeof val === 'boolean') {
                            return val ? (
                              <span style={{ color: 'var(--color-danger)', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>Có (Trùng)</span>
                            ) : (
                              <span style={{ color: 'var(--color-success)', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>Không</span>
                            );
                          }

                          if (typeof val === 'object' && val !== null) {
                            return <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{JSON.stringify(val)}</span>;
                          }

                          if (key === 'status') {
                            if (val === 'active') return <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Hoạt động</span>;
                            if (val === 'inactive') return <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Ngừng HĐ</span>;
                            return <span>{String(val)}</span>;
                          }

                          return <span style={{ color: 'var(--color-text)', wordBreak: 'break-word' }}>{String(val)}</span>;
                        };

                        return (
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '6px', 
                            padding: '8px 12px', 
                            background: theme === 'dark' ? 'var(--color-bg)' : '#f8fafc', 
                            borderRadius: '8px', 
                            border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)',
                            maxWidth: '450px',
                            minWidth: '240px',
                            fontSize: '0.8rem' 
                          }}>
                            {Object.entries(details).map(([key, val]) => {
                              const label = KEY_LABELS[key] || key;
                              const isBlockElement = (key === 'compensations' || key === 'keys' || key === 'admin_ids');
                              return (
                                <div key={key} style={{ 
                                  display: 'flex', 
                                  flexDirection: isBlockElement ? 'column' : 'row',
                                  alignItems: isBlockElement ? 'flex-start' : 'center',
                                  gap: isBlockElement ? '2px' : '8px',
                                  lineHeight: '1.4'
                                }}>
                                  <span style={{ 
                                    fontWeight: 600, 
                                    color: 'var(--color-text-muted)', 
                                    minWidth: isBlockElement ? 'auto' : '100px',
                                    flexShrink: 0
                                  }}>
                                    {label}:
                                  </span>
                                  <div style={{ flexGrow: 1 }}>{renderValue(key, val)}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } catch {
                        return <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: theme === 'dark' ? 'var(--color-bg)' : '#f8fafc', padding: '6px 10px', borderRadius: 6, border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)' }}>{String(detailsRaw || '')}</span>;
                      }
                    };

                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s' }} className="table-row-hover">
                        <td data-label="Thời gian" style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)', fontWeight: 600 }}>{new Date(log.created_at).toLocaleDateString('vi-VN')}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                        </td>
                        <td data-label="Người thực hiện" style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar src={log.account_avatar} name={log.account_name || 'System'} size={28} />
                            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                              {log.account_name || 'Hệ thống'}
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 2 }}>{log.account_email}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Hành động" style={{ padding: '1rem 1.5rem' }}>
                          <span style={{
                            background: log.action === 'LOGIN' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                            color: log.action === 'LOGIN' ? '#3b82f6' : 'var(--color-primary)',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td data-label="Chi tiết" style={{ padding: '1rem 1.5rem', fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>
                          {renderLogDetails(log.details)}
                        </td>
                        <td data-label="IP Address" style={{ padding: '1rem 1.5rem', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          {log.ip_address}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          Chưa có lịch sử hoạt động nào được ghi lại.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loadingLogs && totalLogPages > 0 && (
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Hiển thị <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(logsPage - 1) * LOGS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(logsPage * LOGS_PER_PAGE, logs.length)}</span> trên <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{logs.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                    disabled={logsPage === 1}
                    style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: logsPage === 1 ? 'var(--color-bg)' : 'var(--color-surface)', color: logsPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: logsPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: Math.min(5, totalLogPages) }, (_, i) => {
                      let startPage = 1;
                      if (totalLogPages > 5) {
                        if (logsPage > 3) {
                          startPage = logsPage - 2;
                          if (startPage + 4 > totalLogPages) {
                            startPage = totalLogPages - 4;
                          }
                        }
                      }
                      const pageNum = startPage + i;
                      return (
                         <button
                           key={pageNum}
                           onClick={() => setLogsPage(pageNum)}
                           style={{ 
                             width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                             border: logsPage === pageNum ? 'none' : '1px solid var(--color-border)',
                             background: logsPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                             color: logsPage === pageNum ? 'white' : 'var(--color-text)',
                             cursor: 'pointer'
                           }}
                         >
                           {pageNum}
                         </button>
                      );
                    })}
                  </div>
                  <button 
                    onClick={() => setLogsPage(prev => Math.min(prev + 1, totalLogPages))}
                    disabled={logsPage === totalLogPages || totalLogPages === 0}
                    style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: logsPage === totalLogPages || totalLogPages === 0 ? 'var(--color-bg)' : 'var(--color-surface)', color: logsPage === totalLogPages || totalLogPages === 0 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: logsPage === totalLogPages || totalLogPages === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      <CustomModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingAccount ? "Sửa Tài khoản" : "Thêm Tài khoản Mới"} width="680px">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Avatar Upload Area */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1.25rem', 
            padding: '1rem', 
            background: 'var(--color-bg)', 
            borderRadius: '12px', 
            border: '1px solid var(--color-border)',
            marginBottom: '0.25rem'
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar src={formData.avatar} name={formData.name || 'User'} size={64} />
              {isUploadingAvatar && (
                <div style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  background: 'rgba(0,0,0,0.5)', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  Tải...
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                Ảnh đại diện
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn outline sm"
                  style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto', background: 'white', borderRadius: '6px' }}
                  disabled={isUploadingAvatar}
                >
                  <Camera size={12} style={{ marginRight: 4 }} /> Chọn ảnh
                </button>
                {formData.avatar && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, avatar: '' })}
                    className="btn outline sm"
                    style={{ 
                      fontSize: '0.75rem', 
                      padding: '4px 8px', 
                      height: 'auto', 
                      color: 'var(--color-danger)', 
                      borderColor: 'rgba(239, 68, 68, 0.2)', 
                      background: 'white',
                      borderRadius: '6px'
                    }}
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
                Chấp nhận tệp ảnh JPG, PNG, WEBP (tối đa 5MB)
              </span>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            <div className="form-group">
              <label className="form-label">Tên hiển thị <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                className="form-input"
                placeholder="VD: Nguyễn Văn A"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Username <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(dùng nội bộ)</span></label>
              <input
                className="form-input"
                placeholder="VD: admin_nhansu"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Email đăng nhập {Number(editingAccount?.id) !== 1 && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                {Number(editingAccount?.id) === 1 && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.8rem' }}> (tùy chọn với Super Admin)</span>}
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="VD: ten@company.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                required={Number(editingAccount?.id) !== 1}
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Zalo Bot Chat ID <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(tùy chọn)</span></label>
              <input
                className="form-input"
                placeholder="VD: 43521235123551"
                value={formData.zalo_chat_id}
                onChange={e => setFormData({ ...formData, zalo_chat_id: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{editingAccount ? "Mật khẩu mới (Để trống nếu không đổi)" : "Mật khẩu"} {editingAccount ? '' : <span style={{ color: 'var(--color-danger)' }}>*</span>}</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--color-text-muted)' }} />
                <input 
                  type="password"
                  className="form-input" 
                  style={{ paddingLeft: 36 }}
                  placeholder={editingAccount ? "Nhập để đổi mật khẩu mới" : "Tối thiểu 6 ký tự"} 
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  required={!editingAccount}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phân quyền <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <CustomSelect 
                options={[
                  { value: 'admin', label: 'Admin (Toàn quyền)' },
                  { value: 'assistant', label: 'Assistant (Trợ lý / Phân bổ Data)' },
                  { value: 'viewer', label: 'Viewer (Chỉ xem Data)' }
                ]}
                value={formData.role}
                onChange={val => setFormData({ ...formData, role: val.toString() })}
                width="100%"
                direction="up"
              />
            </div>
          </div>

          {editingAccount && editingAccount.zalo_chat_id && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              padding: '0.75rem',
              background: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '8px',
              marginTop: '0.5rem'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MessageCircle size={14} fill="#3b82f6" color="white" /> Tính năng Zalo Bot
              </span>
              
              {/* Quick Message Input & Button */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.75rem', padding: '6px 10px', height: 'auto', flex: 1 }}
                  placeholder="Nhập tin nhắn gửi nhanh..."
                  value={quickMsgText}
                  onChange={e => setQuickMsgText(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSendQuickMsgInModal}
                  disabled={isSendingQuickMsg || !quickMsgText.trim()}
                  className="btn primary sm"
                  style={{ fontSize: '0.75rem', padding: '6px 12px', height: 'auto', borderRadius: '6px' }}
                >
                  {isSendingQuickMsg ? <RefreshCw size={12} className="spin" /> : <Send size={12} />}
                </button>
              </div>

              {/* Unlink Zalo Button */}
              <button
                type="button"
                onClick={handleUnlinkZaloInModal}
                disabled={isUnlinking}
                className="btn outline sm"
                style={{ 
                  fontSize: '0.75rem', 
                  padding: '4px 8px', 
                  height: 'auto', 
                  color: 'var(--color-warning)', 
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  alignSelf: 'flex-start',
                  background: 'white',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {isUnlinking ? <RefreshCw size={12} className="spin" /> : <Link2Off size={14} />} Hủy liên kết Zalo
              </button>
            </div>
          )}

          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            💡 <strong>Lưu ý:</strong> Zalo Chat ID dùng để nhận thông báo khẩn qua Zalo Bot thay vì nhận Email.
          </div>

          {editingAccount && Number(editingAccount.id) !== 1 && (
            <div style={{
              marginTop: '0.25rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px dashed rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-danger)' }}>Vùng nguy hiểm</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Xóa vĩnh viễn tài khoản quản trị này khỏi hệ thống.</span>
              </div>
              <button
                type="button"
                onClick={handleDeleteClickInModal}
                className="btn outline sm"
                style={{
                  color: 'var(--color-danger)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  background: 'white',
                  fontSize: '0.75rem',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0
                }}
              >
                <Trash2 size={14} /> Xóa tài khoản
              </button>
            </div>
          )}

          <div style={{
            position: 'sticky',
            bottom: '-1.5rem',
            background: 'var(--color-surface)',
            padding: '1rem 0 1.5rem',
            marginTop: '1rem',
            display: 'flex',
            gap: '1rem',
            borderTop: '1px solid var(--color-border)',
            zIndex: 10
          }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn ghost" style={{ flex: 1, borderRadius: '8px' }}>Hủy</button>
            <button type="submit" className="btn primary" disabled={isSaving} style={{ flex: 1, borderRadius: '8px' }}>
              {isSaving ? 'Đang lưu...' : 'Lưu Tài khoản'}
            </button>
          </div>
        </form>
      </CustomModal>

      <ConfirmModal 
        isOpen={confirmOpen} 
        onClose={() => setConfirmOpen(false)} 
        onConfirm={handleDelete} 
        title="Xóa Tài khoản" 
        message="Bạn có chắc chắn muốn xóa tài khoản này không? Hành động này không thể hoàn tác và user sẽ không thể đăng nhập được nữa." 
        confirmText="Xóa vĩnh viễn" 
      />



      {showReplacementModal && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setShowReplacementModal(false)}>
          <div
            className="card"
            style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', animation: 'slideUp 0.2s ease-out', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)' }}>
                <Shield size={20} /> Yêu cầu Chuyển giao Vai trò
              </h3>
              <button type="button" onClick={() => setShowReplacementModal(false)} style={{ color: 'var(--color-text-muted)', padding: 4, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                Tài khoản này hiện đang đóng vai trò quan trọng trong hệ thống:
              </p>
              
              <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                {usageInfo?.usage.fallback && (
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)' }} />
                    Đang nhận Lead mặc định (Fallback Admin)
                  </li>
                )}
                {usageInfo?.usage.ticket && (
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)' }} />
                    Đang đăng ký nhận thông báo Tickets
                  </li>
                )}
              </ul>

              {usageInfo?.other_admins && usageInfo.other_admins.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Chọn Admin thay thế để chuyển giao cấu hình:</label>
                  <CustomSelect
                    options={usageInfo.other_admins.map((a: any) => ({
                      value: a.id,
                      label: a.name,
                      sublabel: a.email || a.username
                    }))}
                    value={replacementId || ''}
                    onChange={val => setReplacementId(Number(val))}
                    width="100%"
                    showAvatars={true}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Hệ thống sẽ tự động cập nhật cấu hình Fallback / Ticket sang Admin được chọn và thực hiện xóa tài khoản cũ.
                  </p>
                </div>
              ) : (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, border: '1px dashed rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', fontSize: '0.8125rem', lineHeight: '1.4' }}>
                  Không tìm thấy Admin khác trong hệ thống để thay thế. Vui lòng tạo một tài khoản Admin mới trước khi xóa tài khoản này.
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem', background: theme === 'dark' ? 'var(--color-surface)' : '#f8fafc', borderTop: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)', display: 'flex', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)', marginTop: 'auto' }}>
              <button type="button" className="btn outline" style={{ flex: 1 }} onClick={() => setShowReplacementModal(false)}>Hủy bỏ</button>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1, background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                disabled={isDeleting || !replacementId}
                onClick={handleDeleteWithReplacement}
              >
                {isDeleting ? 'Đang xóa...' : 'Chuyển giao & Xóa'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
