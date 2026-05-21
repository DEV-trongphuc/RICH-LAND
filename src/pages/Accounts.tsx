import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Plus, Edit3, Trash2, KeyRound, UserCog, Send, X, Link2Off, Check, RefreshCw, History, MessageCircle, Bell } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Avatar } from '../components/ui/Avatar';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';

export const Accounts = () => {
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
    role: 'viewer'
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [checkingDelete, setCheckingDelete] = useState(false);
  const [usageInfo, setUsageInfo] = useState<any>(null);
  const [replacementId, setReplacementId] = useState<number | null>(null);
  const [showReplacementModal, setShowReplacementModal] = useState(false);

  const [unlinkId, setUnlinkId] = useState<number | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);

  // Quick Message State
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessageTarget, setQuickMessageTarget] = useState<any>(null);
  const [quickMessageText, setQuickMessageText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  const [activeTab, setActiveTab] = useState<'accounts' | 'logs'>('accounts');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchLogs = async () => {
    setLoadingLogs(true);
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
    setFormData({ username: '', password: '', name: '', email: '', zalo_chat_id: '', role: 'viewer' });
    setModalOpen(true);
  };

  const openEditModal = (acc: any) => {
    setEditingAccount(acc);
    setFormData({ username: acc.username, password: '', name: acc.name, email: acc.email || '', zalo_chat_id: acc.zalo_chat_id || '', role: acc.role });
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
    setCheckingDelete(true);
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
    setCheckingDelete(false);
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

  const confirmUnlinkZalo = (id: number) => {
    setUnlinkId(id);
    setUnlinkConfirmOpen(true);
  };

  const handleUnlinkZalo = async () => {
    if (!unlinkId) return;
    try {
      const json = await fetchAPI('unlink_zalo', {
        method: 'POST',
        body: JSON.stringify({ id: unlinkId, type: 'account' })
      });
      if (json.success) {
        toast.success('Đã hủy liên kết Zalo thành công!');
        fetchAccounts();
      } else {
        toast.error(json.message || 'Lỗi khi hủy liên kết');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setUnlinkConfirmOpen(false);
    setUnlinkId(null);
  };

  const handleSendQuickMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessageText.trim() || !quickMessageTarget) return;
    setIsSendingMsg(true);
    try {
      const res = await fetchAPI('send_quick_zalo_message', {
        method: 'POST',
        body: JSON.stringify({ account_id: quickMessageTarget.id, message: quickMessageText })
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

  const getRoleBadge = (role: string) => {
    if (role === 'admin') return <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--color-primary)', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Admin</span>;
    if (role === 'assistant') return <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Assistant</span>;
    return <span style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Viewer</span>;
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCog size={28} color="var(--color-primary)" /> Quản lý Tài khoản
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Quản trị hệ thống và phân quyền truy cập cho nhân viên.</p>
        </div>
        <button onClick={openAddModal} className="btn primary responsive-btn-full" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', fontSize: '0.875rem' }}>
          <Plus size={18} /> Thêm tài khoản
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem', paddingBottom: '0.25rem' }}>
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
            gap: 8
          }}
        >
          <UserCog size={16} /> Danh sách Tài khoản
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
            gap: 8
          }}
        >
          <History size={16} /> Nhật ký hoạt động Admin
        </button>
      </div>

      {activeTab === 'accounts' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Đang tải dữ liệu...</div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                    <tr key={acc.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s' }} className="table-row-hover">
                      <td data-label="Tên người dùng" style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar name={acc.name} size={36} />
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
                            <button onClick={() => handleResendConfirm(acc.id)} className="btn ghost" style={{ fontSize: '0.75rem', padding: '2px 8px', color: 'var(--color-primary)' }}>
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
                                <button onClick={() => handleResendZaloVerify(acc.id)} className="btn ghost" style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }} title="Gửi email nhắc xác thực Zalo" disabled={zaloRemindingId === acc.id}>
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
                          {acc.zalo_chat_id && (
                            <>
                              <button onClick={() => { setQuickMessageTarget({ id: acc.id, name: acc.name }); setQuickMessageOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: '#0068ff' }} title="Nhắn Zalo Bot cho Admin">
                                <Bell size={14} />
                              </button>
                              <button onClick={() => confirmUnlinkZalo(acc.id)} className="btn ghost" style={{ padding: 8, color: 'var(--color-warning)' }} title="Hủy liên kết Zalo">
                                <Link2Off size={16} />
                              </button>
                            </>
                          )}
                          <button onClick={() => openEditModal(acc)} className="btn ghost" style={{ padding: 8, color: 'var(--color-primary)' }} title="Sửa">
                            <Edit3 size={16} />
                          </button>
                          {Number(acc.id) !== 1 && (
                            <button
                              onClick={() => triggerDeleteFlow(acc.id)}
                              disabled={checkingDelete && deleteId === acc.id}
                              className="btn ghost"
                              style={{ padding: 8, color: 'var(--color-danger)' }}
                              title="Xóa"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
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
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Đang tải nhật ký...</div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Thời gian</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Người thực hiện</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Hành động</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Chi tiết</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
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
                            return (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                {val.map((k: string) => (
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
                            background: '#f8fafc', 
                            borderRadius: '8px', 
                            border: '1px solid var(--color-border-light)',
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
                        return <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border-light)' }}>{String(detailsRaw || '')}</span>;
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
                            <Avatar name={log.account_name || 'System'} size={28} />
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
          )}
        </div>
      )}

      <CustomModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingAccount ? "Sửa Tài khoản" : "Thêm Tài khoản Mới"}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Dùng để nhận thông báo khẩn qua Zalo Bot thay vì nhận Email.
            </div>
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
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn ghost" style={{ flex: 1 }}>Hủy</button>
            <button type="submit" className="btn primary" disabled={isSaving} style={{ flex: 1 }}>
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

      <ConfirmModal 
        isOpen={unlinkConfirmOpen} 
        onClose={() => setUnlinkConfirmOpen(false)} 
        onConfirm={handleUnlinkZalo} 
        title="Hủy liên kết Zalo Bot" 
        message="Bạn có chắc chắn muốn hủy liên kết Zalo của tài khoản này không? Hệ thống sẽ ngừng gửi mọi thông báo qua Zalo cho tài khoản này ngay lập tức." 
        confirmText="Hủy liên kết" 
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

            <div style={{ padding: '1.25rem', background: '#f8fafc', borderTop: '1px solid var(--color-border-light)', display: 'flex', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)', marginTop: 'auto' }}>
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
      {/* Quick Message Modal */}
      <CustomModal isOpen={quickMessageOpen} onClose={() => setQuickMessageOpen(false)} title={`Nhắn tin cho ${quickMessageTarget?.name || 'Tài khoản'}`}>
        <form onSubmit={handleSendQuickMessage}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>Tin nhắn sẽ được tự động gửi qua Zalo Bot (nếu có) và Email với tiêu đề [ TIN NHẮN TỪ BAN QUẢN TRỊ ]</p>
            <div className="form-group">
              <label className="form-label">Nội dung tin nhắn <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <textarea
                className="form-input"
                placeholder="Nhập nội dung cần thông báo..."
                value={quickMessageText}
                onChange={e => setQuickMessageText(e.target.value)}
                required
                autoFocus
                style={{ minHeight: 100, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setQuickMessageOpen(false)}>Hủy</button>
              <button type="submit" className="btn primary" disabled={isSendingMsg} style={{ background: '#0068ff', borderColor: '#0068ff' }}>
                {isSendingMsg ? 'Đang gửi...' : 'Gửi tin nhắn'}
              </button>
            </div>
          </div>
        </form>
      </CustomModal>
    </div>
  );
};
