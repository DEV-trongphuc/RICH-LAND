import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Plus, Edit3, Trash2, KeyRound, UserCog, Send, X, Link2Off, Check, RefreshCw, History, ChevronLeft, ChevronRight, Camera, RotateCcw, Loader2 } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { Avatar } from '../components/ui/Avatar';
import { fetchAPI } from '../utils/api';
import { AccountDetailDrawer } from '../components/AccountDetailDrawer';
import { compressToWebP } from '../utils/imageCompress';
import toast from 'react-hot-toast';
import { useUIStore } from '../store/uiStore';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useLanguage } from '../contexts/LanguageContext';
import { withRouterFreezer } from '../components/RouterFreezer';
import { useAuth } from '../contexts/AuthContext';
import { CopyButton } from '../components/ui/CopyButton';

const AccountsInner = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showConfirm } = useUIStore();
  const isSale = user?.role === 'sale';

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
    avatar: '',
    phone: '',
    is_active: '1',
    dob: '',
    gender: '',
    citizen_id: '',
    address: '',
    bank_name: '',
    bank_account: ''
  });

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('Vui lòng chọn file hình ảnh hợp lệ.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('Kích thước ảnh không được vượt quá 5MB.'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const compressedFile = await compressToWebP(file);
      const fd = new FormData();
      fd.append('avatar', compressedFile);

      const oldAvatar = formData.avatar || '';
      const query = `upload_avatar&old_avatar=${encodeURIComponent(oldAvatar)}`;
      const res = await fetchAPI(query, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        setFormData(prev => ({ ...prev, avatar: res.url }));
        toast.success(t('Tải ảnh đại diện lên thành công!'));
      } else {
        toast.error(res.message || t('Lỗi khi tải ảnh lên'));
      }
    } catch (err: any) {
      toast.error(`${t('Lỗi kết nối')}: ` + err.message);
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
        toast.success(res.message || t('Đã gửi tin nhắn thành công!'));
        setQuickMsgText('');
      } else {
        toast.error(res.message || t('Lỗi khi gửi tin'));
      }
    } catch (e: any) {
      toast.error(`${t('Lỗi')}: ` + e.message);
    } finally {
      setIsSendingQuickMsg(false);
    }
  };

  const handleUnlinkZaloInModal = () => {
    if (!editingAccount) return;
    showConfirm({
      title: t('Hủy liên kết Zalo'),
      message: t('Bạn có chắc chắn muốn hủy liên kết Zalo của tài khoản này không?'),
      confirmText: t('Hủy liên kết'),
      cancelText: t('Hủy'),
      isDanger: true,
      onConfirm: async () => {
        setIsUnlinking(true);
        try {
          const json = await fetchAPI('unlink_zalo', {
            method: 'POST',
            body: JSON.stringify({ id: editingAccount.id, type: 'account' })
          });
          if (json.success) {
            toast.success(t('Đã hủy liên kết Zalo thành công!'));
            setFormData(prev => ({ ...prev, zalo_chat_id: '' }));
            setEditingAccount((prev: any) => ({ ...prev, zalo_chat_id: null }));
            fetchAccounts();
          } else {
            toast.error(json.message || t('Lỗi khi hủy liên kết'));
          }
        } catch (e: any) {
          toast.error(`${t('Lỗi')}: ` + e.message);
        } finally {
          setIsUnlinking(false);
        }
      }
    });
  };

  const handleDeleteClickInModal = () => {
    if (!editingAccount) return;
    const id = editingAccount.id;
    setModalOpen(false);
    triggerDeleteFlow(id);
  };

  const [activeTab, setActiveTab] = useState<'accounts' | 'logs'>('accounts');
  const [accountsPage, setAccountsPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const ACCOUNTS_PER_PAGE = 10;
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [rollingBackLogId, setRollingBackLogId] = useState<number | null>(null);

  const handleRollback = (logId: number) => {
    showConfirm({
      title: t('Hoàn tác hành động'),
      message: t('Bạn có chắc chắn muốn hoàn tác hành động này không?'),
      confirmText: t('Hoàn tác'),
      cancelText: t('Hủy'),
      isDanger: true,
      onConfirm: async () => {
        setRollingBackLogId(logId);
        try {
          const res = await fetchAPI('rollback_admin_action', {
            method: 'POST',
            body: JSON.stringify({ log_id: logId })
          });
          if (res.success) {
            toast.success(res.message || t('Hoàn tác thành công!'));
            fetchLogs();
          } else {
            toast.error(res.message || t('Hoàn tác thất bại'));
          }
        } catch (e: any) {
          toast.error(`${t('Lỗi')}: ` + e.message);
        } finally {
          setRollingBackLogId(null);
        }
      }
    });
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogsPage(1);
    try {
      const json = await fetchAPI('get_admin_logs');
      if (json.success) setLogs(json.data);
    } catch (e: any) {
      toast.error(`${t('Không thể tải nhật ký hoạt động')}: ` + e.message);
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
      toast.error(`${t('Không thể tải dữ liệu')}: ` + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (isSale && accounts.length > 0) {
      const acc = accounts[0];
      setEditingAccount(acc);
      setFormData({
        username: acc.username || '',
        password: '',
        name: acc.name || '',
        email: acc.email || '',
        zalo_chat_id: acc.zalo_chat_id || '',
        role: acc.role || 'sale',
        avatar: acc.avatar || '',
        phone: acc.phone || '',
        is_active: String(acc.is_active ?? '1'),
        dob: acc.dob || '',
        gender: acc.gender || '',
        citizen_id: acc.citizen_id || '',
        address: acc.address || '',
        bank_name: acc.bank_name || '',
        bank_account: acc.bank_account || ''
      });
    }
  }, [accounts, isSale]);

  const openAddModal = () => {
    setEditingAccount(null);
    setFormData({
      username: '',
      password: '',
      name: '',
      email: '',
      zalo_chat_id: '',
      role: 'viewer',
      avatar: '',
      phone: '',
      is_active: '1',
      dob: '',
      gender: '',
      citizen_id: '',
      address: '',
      bank_name: '',
      bank_account: ''
    });
    setQuickMsgText('');
    setModalOpen(true);
  };

  const openEditModal = (acc: any) => {
    setEditingAccount(acc);
    setFormData({
      username: acc.username,
      password: '',
      name: acc.name,
      email: acc.email || '',
      zalo_chat_id: acc.zalo_chat_id || '',
      role: acc.role,
      avatar: acc.avatar || '',
      phone: acc.phone || '',
      is_active: String(acc.is_active ?? '1'),
      dob: acc.dob || '',
      gender: acc.gender || '',
      citizen_id: acc.citizen_id || '',
      address: acc.address || '',
      bank_name: acc.bank_name || '',
      bank_account: acc.bank_account || ''
    });
    setQuickMsgText('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalUsername = formData.username;
    if (!finalUsername && formData.email) {
      finalUsername = formData.email.split('@')[0];
    }
    if (!finalUsername) {
      finalUsername = 'admin_' + Math.random().toString(36).substring(2, 7);
    }

    if (!formData.name) return toast.error(t('Vui lòng nhập đủ tên hiển thị'));
    if (!editingAccount && !formData.password) return toast.error(t('Vui lòng nhập mật khẩu cho tài khoản mới'));
    // Email bắt buộc trừ Super Admin (id=1)
    const isSuperAdmin = Number(editingAccount?.id) === 1;
    if (!isSuperAdmin) {
      if (!formData.email) return toast.error(t('Email là bắt buộc để đăng nhập'));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return toast.error(t('Định dạng email không hợp lệ'));
    }
    if (isSaving) return;
    
    setIsSaving(true);
    const action = editingAccount ? 'edit_account' : 'add_account';
    const payload = { ...formData, username: finalUsername, id: editingAccount?.id };

    try {
      const json = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        const roleLabel = getRoleLabelText(formData.role);
        const activeLabel = formData.is_active === '1' ? t('Đang hoạt động') : t('Đang tạm khóa');
        toast.success(
          editingAccount 
            ? `${t('Cập nhật thành công!')} ${t('Vai trò')}: ${roleLabel} (${activeLabel})` 
            : `${t('Thêm mới thành công!')} ${t('Vai trò')}: ${roleLabel} (${activeLabel})`
        );
        fetchAccounts();
        setModalOpen(false);
      } else {
        toast.error(json.message || t('Lỗi khi lưu'));
      }
    } catch (e: any) {
      toast.error(`${t('Lỗi')}: ` + e.message);
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
        toast.error(json.message || t('Lỗi khi kiểm tra tài khoản'));
      }
    } catch (e: any) {
      toast.error(`${t('Lỗi kiểm tra')}: ` + e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const json = await fetchAPI(`delete_account&id=${deleteId}`);
      if (json.success) {
        toast.success(t('Đã xóa thành công!'));
        fetchAccounts();
      } else {
        toast.error(json.message || t('Lỗi khi xóa'));
      }
    } catch (e: any) {
      toast.error(`${t('Lỗi')}: ` + e.message);
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
        toast.success(t('Đã chuyển giao cấu hình và xóa tài khoản thành công!'));
        fetchAccounts();
        setShowReplacementModal(false);
      } else {
        toast.error(json.message || t('Lỗi khi xóa'));
      }
    } catch (e: any) {
      toast.error(`${t('Lỗi')}: ` + e.message);
    }
    setIsDeleting(false);
  };

  const [resendingEmailId, setResendingEmailId] = useState<number | null>(null);

  const handleResendConfirm = async (accId: number) => {
    setResendingEmailId(accId);
    try {
      const json = await fetchAPI('resend_confirm_email', {
        method: 'POST',
        body: JSON.stringify({ id: accId })
      });
      if (json.success) {
        toast.success(t('Đã gửi lại link xác thực. Vui lòng kiểm tra email.'));
      } else {
        toast.error(json.message || t('Lỗi khi gửi email'));
      }
    } catch (e: any) {
      toast.error(`${t('Lỗi')}: ` + e.message);
    } finally {
      setResendingEmailId(null);
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
        toast.success(t('Đã gửi lại email nhắc xác thực Zalo.'));
        setZaloRemindedId(accId);
        setTimeout(() => setZaloRemindedId(null), 5000);
      } else {
        toast.error(json.message || t('Lỗi khi gửi email'));
      }
    } catch (e: any) {
      toast.error(`${t('Lỗi')}: ` + e.message);
    }
    setZaloRemindingId(null);
  };



  const getRoleBadge = (role: string) => {
    if (role === 'superadmin' || role === 'super_admin') return <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Super Admin</span>;
    if (role === 'admin') return <span style={{ background: 'rgba(163, 20, 34, 0.1)', color: 'var(--color-primary)', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Admin</span>;
    if (role === 'director') return <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Director</span>;
    if (role === 'manager') return <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Manager</span>;
    if (role === 'assistant') return <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Assistant</span>;
    if (role === 'sale' || role === 'sales') return <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Sales</span>;
    return <span style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Viewer</span>;
  };

  const getRoleLabelText = (role: string) => {
    if (role === 'superadmin' || role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Admin';
    if (role === 'director') return 'Director';
    if (role === 'manager') return 'Manager';
    if (role === 'assistant') return 'Assistant';
    if (role === 'sale' || role === 'sales') return 'Sales';
    return t('Chỉ xem');
  };

  const LOGS_PER_PAGE = 50;
  const totalLogPages = Math.ceil(logs.length / LOGS_PER_PAGE);
  const paginatedLogs = logs.slice((logsPage - 1) * LOGS_PER_PAGE, logsPage * LOGS_PER_PAGE);

  const filteredAccounts = accounts.filter(acc => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (acc.name && acc.name.toLowerCase().includes(query)) ||
      (acc.email && acc.email.toLowerCase().includes(query)) ||
      (acc.username && acc.username.toLowerCase().includes(query)) ||
      (acc.role && acc.role.toLowerCase().includes(query))
    );
  });

  const totalAccountsPages = Math.ceil(filteredAccounts.length / ACCOUNTS_PER_PAGE);
  const paginatedAccounts = filteredAccounts.slice((accountsPage - 1) * ACCOUNTS_PER_PAGE, accountsPage * ACCOUNTS_PER_PAGE);

  if (isSale) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '600px', margin: '2rem auto', padding: '1.5rem' }}>
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--color-text)' }}>
            {t('Thông tin cá nhân & Tài khoản')}
          </h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <style>{`
              .password-input-with-icon {
                padding-left: 36px !important;
              }
            `}</style>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem', position: 'relative' }}>
              <div style={{ position: 'relative', width: '96px', height: '96px' }}>
                <Avatar src={formData.avatar} name={formData.name || 'User'} size={96} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    background: 'var(--color-primary)', color: 'white',
                    border: 'none', borderRadius: '50%', width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  <Camera size={14} />
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" style={{ display: 'none' }} />
              {isUploadingAvatar && <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--color-primary)' }}>{t('Đang tải lên...')}</span>}
            </div>

            <div>
              <label className="form-label">{t('Tên hiển thị')}</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">{t('Username')}</label>
              <input
                type="text"
                className="form-input"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">{t('Email')}</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">{t('Số điện thoại')}</label>
              <input
                type="tel"
                className="form-input"
                placeholder="VD: 0901234567"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">{t('Zalo Chat ID')}</label>
              <input
                type="text"
                className="form-input"
                value={formData.zalo_chat_id}
                onChange={e => setFormData({ ...formData, zalo_chat_id: e.target.value })}
                placeholder={t('Ví dụ: 123456789')}
              />
            </div>

            <div>
              <label className="form-label">{t('Ngày sinh')}</label>
              <input
                type="date"
                className="form-input"
                value={formData.dob}
                onChange={e => setFormData({ ...formData, dob: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">{t('Giới tính')}</label>
              <CustomSelect
                options={[
                  { value: '', label: t('Chọn giới tính') },
                  { value: 'Nam', label: t('Nam') },
                  { value: 'Nữ', label: t('Nữ') },
                  { value: 'Khác', label: t('Khác') }
                ]}
                value={formData.gender}
                onChange={val => setFormData({ ...formData, gender: val.toString() })}
                width="100%"
                direction="down"
              />
            </div>

            <div>
              <label className="form-label">{t('Số CCCD')}</label>
              <input
                type="text"
                className="form-input"
                placeholder={t('Nhập số CCCD')}
                value={formData.citizen_id}
                onChange={e => setFormData({ ...formData, citizen_id: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">{t('Địa chỉ')}</label>
              <input
                type="text"
                className="form-input"
                placeholder={t('Nhập địa chỉ tạm trú/thường trú')}
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">{t('Tên ngân hàng')}</label>
              <input
                type="text"
                className="form-input"
                placeholder={t('VD: Vietcombank')}
                value={formData.bank_name}
                onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">{t('Số tài khoản')}</label>
              <input
                type="text"
                className="form-input"
                placeholder={t('Nhập số tài khoản')}
                value={formData.bank_account}
                onChange={e => setFormData({ ...formData, bank_account: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">{t('Mật khẩu mới')}</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: 12, top: 9, color: 'var(--color-text-muted)' }} />
                <input
                  type="password"
                  className="form-input password-input-with-icon"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder={t('Để trống nếu không muốn đổi')}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label className="form-label">{t('Vai trò (Role)')}</label>
                <CustomSelect
                  options={[
                    { value: 'admin', label: t('Quản trị viên (Admin)') },
                    { value: 'director', label: t('Giám đốc kinh doanh (Director)') },
                    { value: 'manager', label: t('Trưởng phòng / Trưởng nhóm (Manager)') },
                    { value: 'assistant', label: t('Trợ lý (Assistant)') },
                    { value: 'sale', label: t('Sale / Nhân viên (Sales)') },
                    { value: 'viewer', label: t('Chỉ xem dữ liệu (Viewer)') }
                  ]}
                  value={formData.role}
                  onChange={val => setFormData({ ...formData, role: val.toString() })}
                  disabled={editingAccount?.id === user?.id}
                  width="100%"
                  direction="up"
                />
                {editingAccount?.id === user?.id && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{t('Bạn không thể thay đổi vai trò của chính mình.')}</p>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '1.25rem' }}>
                <CustomCheckbox
                  checked={formData.is_active === '1'}
                  onChange={() => setFormData({ ...formData, is_active: formData.is_active === '1' ? '0' : '1' })}
                  label={t('Kích hoạt tài khoản')}
                  disabled={editingAccount?.id === user?.id}
                />
                <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: '2px', marginLeft: '24px' }}>
                  {editingAccount?.id === user?.id 
                    ? t('Bạn không thể vô hiệu hóa tài khoản của chính mình.') 
                    : t('Cho phép đăng nhập hệ thống.')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              {editingAccount && Number(editingAccount.id) !== 1 && editingAccount.id !== user?.id && (
                <button
                  type="button"
                  onClick={handleDeleteClickInModal}
                  className="btn outline"
                  style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={16} />
                  {t('Xóa tài khoản')}
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="btn primary"
                style={{ flex: 1, padding: '0.75rem', justifyContent: 'center' }}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : t('Lưu thay đổi')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCog size={28} color="var(--color-primary)" /> {t('Quản lý Tài khoản')}
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{t('Quản trị hệ thống và phân quyền truy cập cho nhân viên.')}</p>
        </div>
        <button onClick={openAddModal} className="btn primary responsive-btn-full" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', fontSize: '0.875rem' }}>
          <Plus size={18} /> <span>{t('Thêm')}<span className="hide-on-mobile"> {t('tài khoản')}</span></span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-border-light)', borderRadius: '12px', padding: '4px', alignSelf: 'flex-start', marginBottom: '1.5rem', width: 'fit-content', gap: '4px' }}>
        <button 
          onClick={() => setActiveTab('accounts')}
          style={{
            padding: '8px 20px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'accounts' ? 'var(--color-surface)' : 'transparent',
            color: activeTab === 'accounts' ? 'var(--color-primary)' : 'var(--color-text-light)',
            boxShadow: activeTab === 'accounts' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0
          }}
          className={activeTab === 'accounts' ? '' : 'hover-lift'}
        >
          <UserCog size={16} /> <span><span className="hide-on-mobile">{t('Danh sách')} </span>{t('Tài khoản')}</span>
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '8px 20px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'logs' ? 'var(--color-surface)' : 'transparent',
            color: activeTab === 'logs' ? 'var(--color-primary)' : 'var(--color-text-light)',
            boxShadow: activeTab === 'logs' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0
          }}
          className={activeTab === 'logs' ? '' : 'hover-lift'}
        >
          <History size={16} /> <span>{t('Nhật ký')}<span className="hide-on-mobile"> {t('hoạt động Admin')}</span></span>
        </button>
      </div>
 
      {activeTab === 'accounts' ? (
        <div className="card subtab-enter-active" style={{ overflow: 'hidden' }}>
          {loading ? (
            <TableSkeleton cols={6} rows={5} />
          ) : (
            <>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-surface)',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
                <input
                  type="text"
                  placeholder={t('Tìm kiếm tên, email, chức vụ...')}
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setAccountsPage(1);
                  }}
                  className="form-input"
                  style={{
                    paddingLeft: '12px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    width: '100%'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setAccountsPage(1);
                    }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {t('Tổng số')}: <strong style={{ color: 'var(--color-text)' }}>{filteredAccounts.length}</strong> / {accounts.length} {t('tài khoản')}
              </div>
            </div>
            <div className="table-wrap responsive-table-wrap mobile-card-table" style={{ border: 'none', borderRadius: 0 }}>
              <table className="mobile-table-compact" style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Tên người dùng')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Email đăng nhập')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Zalo Chat ID')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Phân quyền')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Hoạt động')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Thao tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAccounts.map(acc => (
                    <tr key={acc.id} onClick={() => openEditModal(acc)} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', cursor: 'pointer' }} className="table-row-hover">
                      <td data-label={t('Tên người dùng')} style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar src={acc.avatar} name={acc.name} size={36} />
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {acc.name}
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 2 }}>ID: {acc.id}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label={t('Email đăng nhập')} style={{ padding: '1rem 1.5rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {acc.email ? (
                            <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" alt="Gmail" style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }} />
                          ) : (
                            <Shield size={14} />
                          )}
                          <span>{acc.email || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa có email')}</span>}</span>
                          {acc.email && <CopyButton text={acc.email} />}
                          {acc.email && (
                            Number(acc.is_confirmed) === 1 ? (
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-success)', background: 'var(--color-success-light)', padding: '2px 6px', borderRadius: 12, fontWeight: 700 }}>{t('Đã xác thực')}</span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: 12, fontWeight: 700 }}>{t('Chưa xác thực')}</span>
                            )
                          )}
                        </div>
                        {acc.email && Number(acc.is_confirmed) === 0 && (
                          <div style={{ marginTop: 6, paddingLeft: 20 }}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleResendConfirm(acc.id); }} 
                              disabled={resendingEmailId === acc.id}
                              className="btn ghost" 
                              style={{ 
                                fontSize: '0.75rem', 
                                padding: '2px 8px', 
                                color: 'var(--color-primary)',
                                opacity: resendingEmailId === acc.id ? 0.6 : 1,
                                cursor: resendingEmailId === acc.id ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {resendingEmailId === acc.id ? (
                                <Loader2 size={12} className="animate-spin" style={{ marginRight: 4 }} />
                              ) : (
                                <Send size={12} style={{ marginRight: 4 }} />
                              )}
                              {resendingEmailId === acc.id ? t('Đang gửi...') : t('Gửi lại link')}
                            </button>
                          </div>
                        )}
                      </td>
                      <td data-label={t("Zalo Chat ID")} style={{ padding: '1rem 1.5rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
                        {acc.zalo_chat_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title={acc.zalo_chat_id}>
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: 6, 
                              padding: '4px 10px', borderRadius: 20, 
                              background: '#e5f0ff', color: '#0068ff', fontSize: '0.75rem', fontWeight: 600
                            }}>
                              <img src="https://stc-zpl.zdn.vn/favicon.ico" alt="Zalo" style={{ width: 14, height: 14, borderRadius: '2px' }} /> {t('Đã liên kết')}
                            </span>
                            <CopyButton text={acc.zalo_chat_id} />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: 6, 
                              padding: '4px 10px', borderRadius: 20, 
                              background: 'var(--color-bg)', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 500
                            }}>
                              {t('Chưa liên kết')}
                            </span>
                            {acc.email && (
                              zaloRemindedId === acc.id ? (
                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                  <Check size={12} /> {t('Đã nhắc')}
                                </span>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleResendZaloVerify(acc.id); }} className="btn ghost" style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }} title={t("Gửi email nhắc xác thực Zalo")} disabled={zaloRemindingId === acc.id}>
                                  {zaloRemindingId === acc.id ? <RefreshCw size={12} className="spin" /> : <Send size={12} />} {zaloRemindingId === acc.id ? t('Đang gửi...') : t('Nhắc')}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </td>
                      <td data-label={t('Phân quyền')} style={{ padding: '1rem 1.5rem' }}>
                        {getRoleBadge(acc.role)}
                      </td>
                      <td data-label={t('Hoạt động')} style={{ padding: '1rem 1.5rem' }}>
                        {acc.last_login ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)', fontWeight: 600 }}>{new Date(acc.last_login).toLocaleDateString('vi-VN')}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(acc.last_login).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>{t('Chưa đăng nhập')}</span>
                        )}
                      </td>
                      <td data-label={t('Thao tác')} style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(acc); }} className="btn ghost" style={{ padding: 8, color: 'var(--color-primary)' }} title={t("Sửa")}>
                            <Edit3 size={16} />
                          </button>
                          {Number(acc.id) !== 1 && acc.id !== user?.id && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); triggerDeleteFlow(acc.id); }} 
                              className="btn ghost" 
                              style={{ padding: 8, color: 'var(--color-danger)' }} 
                              title={t("Xóa")}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr className="empty-state-row">
                      <td colSpan={6}>
                        <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                            <UserCog size={32} color="var(--color-text-muted)" />
                          </div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>{t('Chưa có tài khoản')}</h3>
                          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>{t('Hãy thêm tài khoản đầu tiên để cấp quyền truy cập hệ thống.')}</p>
                          <button className="btn primary" onClick={openAddModal}><Plus size={18}/> {t('Thêm Tài khoản')}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Accounts Pagination */}
            {!loading && totalAccountsPages > 1 && (
              <div className="responsive-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(accountsPage - 1) * ACCOUNTS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(accountsPage * ACCOUNTS_PER_PAGE, accounts.length)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{accounts.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setAccountsPage(prev => Math.max(prev - 1, 1))}
                    disabled={accountsPage === 1}
                    style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: accountsPage === 1 ? 'var(--color-bg)' : 'var(--color-surface)', color: accountsPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: accountsPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: Math.min(5, totalAccountsPages) }, (_, i) => {
                      let startPage = 1;
                      if (totalAccountsPages > 5) {
                        if (accountsPage > 3) {
                          startPage = accountsPage - 2;
                          if (startPage + 4 > totalAccountsPages) {
                            startPage = totalAccountsPages - 4;
                          }
                        }
                      }
                      const pageNum = startPage + i;
                      return (
                         <button
                           key={pageNum}
                           onClick={() => setAccountsPage(pageNum)}
                           style={{ 
                             width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                             border: accountsPage === pageNum ? 'none' : '1px solid var(--color-border)',
                             background: accountsPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                             color: accountsPage === pageNum ? 'white' : 'var(--color-text)',
                             cursor: 'pointer'
                           }}
                         >
                           {pageNum}
                         </button>
                      );
                    })}
                  </div>
                  <button 
                    onClick={() => setAccountsPage(prev => Math.min(prev + 1, totalAccountsPages))}
                    disabled={accountsPage === totalAccountsPages || totalAccountsPages === 0}
                    style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: accountsPage === totalAccountsPages || totalAccountsPages === 0 ? 'var(--color-bg)' : 'var(--color-surface)', color: accountsPage === totalAccountsPages || totalAccountsPages === 0 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: accountsPage === totalAccountsPages || totalAccountsPages === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      ) : (
        <div className="card subtab-enter-active" style={{ overflow: 'hidden' }}>
          {loadingLogs ? (
            <TableSkeleton cols={5} rows={8} />
          ) : (
            <>
              <div className="table-wrap responsive-table-wrap mobile-card-table" style={{ border: 'none', borderRadius: 0, maxHeight: '600px', overflowY: 'auto' }}>
              <table className="mobile-table-compact" style={{ width: '100%', minWidth: 950, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>{t('Thời gian')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>{t('Người thực hiện')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>{t('Hành động')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>{t('Chi tiết')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>IP Address</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>{t('Thao tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map(log => {
                    const renderLogDetails = (detailsRaw: any) => {
                      try {
                        const details = typeof detailsRaw === 'string' ? JSON.parse(detailsRaw) : detailsRaw;
                        if (!details || Object.keys(details).length === 0) {
                          return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Không có chi tiết')}</span>;
                        }
                        if (details.message && Object.keys(details).length === 1) {
                          return <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{details.message}</span>;
                        }

                        const KEY_LABELS: Record<string, string> = {
                          round_id: t('Vòng (ID)'),
                          round_name: t('Tên vòng'),
                          compensations: t('Bù data'),
                          log_id: t('ID log'),
                          lead_id: t('ID lead'),
                          lead_name: t('Tên lead'),
                          phone: t('Số điện thoại'),
                          new_consultant_id: t('ID TVV mới'),
                          new_consultant_name: t('Tên TVV mới'),
                          is_duplicate: t('Trùng lặp'),
                          keys: t('Cấu hình thay đổi'),
                          id: t('ID'),
                          name: t('Tên hiển thị'),
                          email: t('Email đăng nhập'),
                          status: t('Trạng thái'),
                          target_round_id: t('Vòng chuyển hướng'),
                          logical_operator: t('Điều kiện logic'),
                          sheet_name: t('Tên trang tính'),
                          sheet_column: t('Cột trang tính'),
                          system_field: t('Trường hệ thống'),
                          connection_id: t('ID kết nối'),
                          message: t('Thông báo'),
                          admin_ids: t('Admin nhận thông báo'),
                          compensate_skipped: t('Bù cho người cũ'),
                          skipped_consultant_id: t('ID người cũ')
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
                                    background: Number(count) > 0 ? 'rgba(163, 20, 34, 0.1)' : 'var(--color-bg)',
                                    color: Number(count) > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                    border: Number(count) > 0 ? '1px solid rgba(163, 20, 34, 0.2)' : '1px solid var(--color-border)',
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
                              <span style={{ color: 'var(--color-danger)', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>{t('Có (Trùng)')}</span>
                            ) : (
                              <span style={{ color: 'var(--color-success)', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>{t('Không')}</span>
                            );
                          }

                          if (typeof val === 'object' && val !== null) {
                            return <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{JSON.stringify(val)}</span>;
                          }

                          if (key === 'status') {
                            if (val === 'active') return <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{t('Hoạt động')}</span>;
                            if (val === 'inactive') return <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{t('Ngừng hoạt động')}</span>;
                            return <span>{String(val)}</span>;
                          }

                          return <span style={{ color: 'var(--color-text)', wordBreak: 'break-word' }}>{String(val)}</span>;
                        };

                        return (
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap',
                            gap: '4px 12px', 
                            padding: '6px 10px', 
                            background: theme === 'dark' ? 'var(--color-bg)' : '#f8fafc', 
                            borderRadius: '8px', 
                            border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)',
                            maxWidth: '650px',
                            minWidth: '240px',
                            fontSize: '0.75rem',
                            lineHeight: '1.4'
                          }}>
                            {Object.entries(details).map(([key, val]) => {
                              const label = KEY_LABELS[key] || key;
                              const isBlockElement = (key === 'compensations' || key === 'keys' || key === 'admin_ids');
                              return (
                                <div key={key} style={{ 
                                  display: 'flex', 
                                  flexDirection: isBlockElement ? 'column' : 'row',
                                  alignItems: isBlockElement ? 'flex-start' : 'center',
                                  gap: isBlockElement ? '2px' : '4px',
                                }}>
                                  <span style={{ 
                                    fontWeight: 600, 
                                    color: 'var(--color-text-muted)', 
                                    flexShrink: 0
                                  }}>
                                    {label}:
                                  </span>
                                  <div style={{ color: 'var(--color-text)' }}>{renderValue(key, val)}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } catch {
                        return <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: theme === 'dark' ? 'var(--color-bg)' : '#f8fafc', padding: '6px 10px', borderRadius: 6, border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)' }}>{String(detailsRaw || '')}</span>;
                      }
                    };

                    const rollbackableActions = ['REASSIGN_LEAD', 'EDIT_CONSULTANT', 'TOGGLE_CONSULTANT_VACATION', 'APPROVE_REPORT', 'REJECT_REPORT'];
                    const isRollbackable = rollbackableActions.includes(log.action);
                    const isRolledBack = Number(log.is_rolled_back) === 1;

                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', opacity: isRolledBack ? 0.65 : 1 }} className="table-row-hover">
                        <td data-label={t('Thời gian')} style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)', fontWeight: 600 }}>{new Date(log.created_at).toLocaleDateString('vi-VN')}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                        </td>
                        <td data-label={t('Người thực hiện')} style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar src={log.account_avatar} name={log.account_name || 'System'} size={28} />
                            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                              {log.account_name || t('Hệ thống')}
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 2 }}>{log.account_email}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label={t('Hành động')} style={{ padding: '1rem 1.5rem' }}>
                          <span style={{
                            background: log.action === 'LOGIN' ? 'rgba(59, 130, 246, 0.1)' : isRolledBack ? 'var(--color-border)' : 'rgba(163, 20, 34, 0.1)',
                            color: log.action === 'LOGIN' ? '#3b82f6' : isRolledBack ? 'var(--color-text-muted)' : 'var(--color-primary)',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textDecoration: isRolledBack ? 'line-through' : 'none'
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td data-label={t('Chi tiết')} style={{ padding: '1rem 1.5rem', fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>
                          {renderLogDetails(log.details)}
                        </td>
                        <td data-label="IP Address" style={{ padding: '1rem 1.5rem', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          {log.ip_address}
                        </td>
                        <td data-label={t('Thao tác')} style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          {isRolledBack ? (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              color: 'var(--color-text-muted)', 
                              background: 'var(--color-bg)',
                              padding: '4px 8px', 
                              borderRadius: '6px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <Check size={12} /> {t('Đã hoàn tác')}
                            </span>
                          ) : isRollbackable ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRollback(log.id); }}
                              disabled={rollingBackLogId === log.id}
                              className="btn ghost sm"
                              style={{ 
                                padding: '4px 8px', 
                                color: 'var(--color-danger)', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4,
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                              title={t("Hoàn tác hành động này")}
                            >
                              {rollingBackLogId === log.id ? (
                                <RefreshCw size={12} className="spin" />
                              ) : (
                                <RotateCcw size={12} />
                              )}
                              <span>{t('Hoàn tác')}</span>
                            </button>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr className="empty-state-row">
                      <td colSpan={6}>
                        <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          {t('Chưa có lịch sử hoạt động nào được ghi lại.')}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loadingLogs && totalLogPages > 0 && (
              <div className="responsive-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(logsPage - 1) * LOGS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(logsPage * LOGS_PER_PAGE, logs.length)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{logs.length}</span>
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

      <AccountDetailDrawer 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        account={editingAccount} 
        onSaveSuccess={fetchAccounts} 
      />

      <ConfirmModal 
        isOpen={confirmOpen} 
        onClose={() => setConfirmOpen(false)} 
        onConfirm={handleDelete} 
        title={t('Xóa Tài khoản')} 
        message={t('Bạn có chắc chắn muốn xóa tài khoản này không? Hành động này không thể hoàn tác và user sẽ không thể đăng nhập được nữa.')} 
        confirmText={t('Xóa vĩnh viễn')} 
      />



      {showReplacementModal && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setShowReplacementModal(false)}>
          <div
            className="card"
            style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', animation: 'modalSpring 0.4s cubic-bezier(0.34, 1.18, 0.64, 1) both', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)' }}>
                <Shield size={20} /> {t('Yêu cầu Chuyển giao Vai trò')}
              </h3>
              <button type="button" onClick={() => setShowReplacementModal(false)} style={{ color: 'var(--color-text-muted)', padding: 4, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                {t('Tài khoản này hiện đang đóng vai trò quan trọng trong hệ thống:')}
              </p>
              
              <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                {usageInfo?.usage.fallback && (
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)' }} />
                    {t('Đang nhận Lead mặc định (Fallback Admin)')}
                  </li>
                )}
                {usageInfo?.usage.ticket && (
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)' }} />
                    {t('Đang đăng ký nhận thông báo Tickets')}
                  </li>
                )}
              </ul>

              {usageInfo?.other_admins && usageInfo.other_admins.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Chọn Admin thay thế để chuyển giao cấu hình:')}</label>
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
                    {t('Hệ thống sẽ tự động cập nhật cấu hình Fallback / Ticket sang Admin được chọn và thực hiện xóa tài khoản cũ.')}
                  </p>
                </div>
              ) : (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, border: '1px dashed rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', fontSize: '0.8125rem', lineHeight: '1.4' }}>
                  {t('Không tìm thấy Admin khác trong hệ thống để thay thế. Vui lòng tạo một tài khoản Admin mới trước khi xóa tài khoản này.')}
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem', background: theme === 'dark' ? 'var(--color-surface)' : '#f8fafc', borderTop: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)', display: 'flex', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)', marginTop: 'auto' }}>
              <button type="button" className="btn outline" style={{ flex: 1 }} onClick={() => setShowReplacementModal(false)}>{t('Hủy bỏ')}</button>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1, background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                disabled={isDeleting || !replacementId}
                onClick={handleDeleteWithReplacement}
              >
                {isDeleting ? t('Đang xóa...') : t('Chuyển giao & Xóa')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export const Accounts = withRouterFreezer(AccountsInner, '/accounts');
