import React, { useState, useEffect } from 'react';
import { Users, Shield, Sliders, Plus, Pencil, Trash2, X, Tag as TagIcon, LayoutList, GripVertical, Check, Loader2, Mail, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import api from '../api/axios';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';

const ROLES = ['admin', 'manager', 'sales', 'viewer'];
const R_LABEL: Record<string, string> = { admin: 'Quản trị viên', manager: 'Quản lý', sales: 'Sale', viewer: 'Xem' };
const R_COLOR: Record<string, string> = { admin: 'danger', manager: 'warning', sales: 'info', viewer: 'cool' };


const TABS = [
  { id: 'users', label: 'Người dùng', icon: Users },
  { id: 'roles', label: 'Phân quyền', icon: Shield },
  { id: 'pipeline', label: 'Pipeline', icon: Sliders },
  { id: 'tags', label: 'Quản lý Tags', icon: TagIcon },
  { id: 'custom_fields', label: 'Trường tùy chỉnh', icon: LayoutList },
];

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast, showConfirm } = useUIStore();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'sales', password: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [pipelines, setPipelines] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);

  const fetchUsers = async () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      setUsers([...state.users]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get('/users');
      setUsers(r.data.data || []);
    } catch (e: any) {
      setUsers([]);
      addToast('Không thể tải danh sách người dùng', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelines = async () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      setPipelines([...state.pipeline_stages].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get('/pipeline-stages');
      setPipelines((r.data.data || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)));
    } catch (e: any) {
      addToast('Lỗi tải danh sách Pipeline', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      setTags([...state.tags]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get('/tags');
      setTags(r.data.data || []);
    } catch (e: any) {
      addToast('Lỗi tải danh sách Tags', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async () => {
    if (DEV_MODE) {
      setCustomFields([
        { id: 1, label: 'Mã số thuế', entity_type: 'company', field_type: 'text', is_required: false },
        { id: 2, label: 'Ngày sinh', entity_type: 'contact', field_type: 'date', is_required: false }
      ]);
      return;
    }
    setLoading(true);
    try {
      const r = await api.get('/custom-fields');
      setCustomFields(r.data.data || []);
    } catch (e: any) {
      addToast('Lỗi tải danh sách trường tùy chỉnh', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    else if (tab === 'pipeline') fetchPipelines();
    else if (tab === 'tags') fetchTags();
    else if (tab === 'custom_fields') fetchCustomFields();
  }, [tab]);

  const [activeModal, setActiveModal] = useState<{ type: 'pipeline' | 'tag' | 'field' | null, item: any }>({ type: null, item: null });
  const [genericForm, setGenericForm] = useState<any>({});

  const openGenericModal = (type: 'pipeline' | 'tag' | 'field', item?: any) => {
    setActiveModal({ type, item });
    if (item) {
      setGenericForm({ ...item });
    } else {
      if (type === 'pipeline') setGenericForm({ name: '', color: '#3b82f6' });
      if (type === 'tag') setGenericForm({ name: '', color: '#10b981' });
      if (type === 'field') setGenericForm({ label: '', entity_type: 'contact', field_type: 'text', is_required: false, options: '' });
    }
  };

  const handleGenericSave = async () => {
    if (activeModal.type === 'field') {
      if (!genericForm.label) { addToast('Vui lòng nhập tên trường', 'error'); return; }
    } else {
      if (!genericForm.name) { addToast('Vui lòng nhập tên', 'error'); return; }
    }

    try {
      if (activeModal.type === 'pipeline') {
        if (activeModal.item) await api.put(`/pipeline-stages/${activeModal.item.id}`, genericForm);
        else await api.post('/pipeline-stages', genericForm);
        fetchPipelines();
      }
      if (activeModal.type === 'tag') {
        if (activeModal.item) await api.put(`/tags/${activeModal.item.id}`, genericForm);
        else await api.post('/tags', genericForm);
        fetchTags();
      }
      if (activeModal.type === 'field') {
        const payload = { ...genericForm };
        if (['dropdown', 'multiselect'].includes(payload.field_type) && typeof payload.options === 'string') {
          payload.options = payload.options.split(',').map((s:string) => s.trim()).filter(Boolean);
        }
        if (activeModal.item) await api.put(`/custom-fields/${activeModal.item.id}`, payload);
        else await api.post('/custom-fields', payload);
        fetchCustomFields();
      }

      addToast('Đã lưu cấu hình', 'success');
      setActiveModal({ type: null, item: null });
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Lỗi lưu cấu hình', 'error');
    }
  };

  const movePipelineStage = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === pipelines.length - 1)) return;
    
    const newPipelines = [...pipelines];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newPipelines[index];
    newPipelines[index] = newPipelines[targetIndex];
    newPipelines[targetIndex] = temp;
    
    // Optimistic UI update
    setPipelines(newPipelines);
    
    try {
      // Update order_index in backend
      await Promise.all([
        api.put(`/pipeline-stages/${newPipelines[index].id}`, { order_index: index }),
        api.put(`/pipeline-stages/${newPipelines[targetIndex].id}`, { order_index: targetIndex })
      ]);
      addToast('Đã cập nhật thứ tự', 'success');
      fetchPipelines();
    } catch (e: any) {
      addToast('Lỗi khi cập nhật thứ tự', 'error');
      fetchPipelines(); // Revert
    }
  };

  const handleSave = async () => {
    // 1. Basic validation
    if (!form.full_name.trim()) { addToast('Vui lòng nhập họ và tên', 'error'); return; }
    if (!form.email.trim()) { addToast('Vui lòng nhập email', 'error'); return; }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) { addToast('Email không đúng định dạng', 'error'); return; }

    // 3. Password validation for new users
    if (!editUser && (!form.password || form.password.length < 6)) {
      addToast('Mật khẩu phải có ít nhất 6 ký tự', 'error');
      return;
    }

    if (form.role === 'admin' && editUser?.role !== 'admin') {
      showConfirm({
        title: 'Xác nhận cấp quyền Admin?',
        message: 'Bạn đang cấp quyền Quản trị viên (Admin) cho người dùng này. Họ sẽ có toàn quyền thay đổi hệ thống, bao gồm cả việc xóa bạn hoặc các dữ liệu quan trọng.',
        isDanger: true,
        confirmText: 'Tôi đã hiểu, tiếp tục',
        onConfirm: () => performSave()
      });
      return;
    }

    performSave();
  };

  const performSave = async () => {
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, form);
        addToast('Đã cập nhật người dùng thành công', 'success');
      } else {
        await api.post('/users', form);
        addToast('Đã tạo tài khoản người dùng mới', 'success');
      }
      fetchUsers();
      setShowModal(false);
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Lỗi hệ thống khi lưu người dùng', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = (u: any) => {
    showConfirm(
      'Xóa người dùng?',
      `Bạn có chắc chắn muốn xóa vĩnh viễn người dùng "${u.full_name}"? Thao tác này không thể hoàn tác.`,
      async () => {
        try {
          await api.delete(`/users/${u.id}`);
          addToast('Đã xóa người dùng thành công', 'success');
          fetchUsers();
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Lỗi khi xóa người dùng', 'error');
        }
      }
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cài đặt hệ thống</h1>
      </div>

      {/* Mobile Tab Selector */}
      <div className="mobile-only" style={{ width: '100%', marginBottom: '1.5rem' }}>
        <select 
          value={tab} 
          onChange={e => setTab(e.target.value)}
          className="form-select"
          style={{ width: '100%', height: 44 }}
        >
          {TABS.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      {/* Desktop/Tablet Tab Buttons */}
      <div className="hide-on-mobile" style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--color-bg)', padding: '0.375rem', borderRadius: 'var(--radius-lg)', width: 'fit-content' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.125rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', background: tab === id ? 'var(--color-surface)' : 'transparent', color: tab === id ? 'var(--color-text)' : 'var(--color-text-light)', boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-light">{users.length} người dùng trong hệ thống</p>
            <button className="btn primary sm" onClick={() => { setEditUser(null); setForm({ full_name: '', email: '', role: 'sales', password: '', is_active: true }); setShowModal(true); }}>
              <Plus size={14} /> Thêm người dùng
            </button>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Người dùng</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Trạng thái</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Đăng nhập cuối</th>
                  <th style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.full_name} src={u.avatar_url} size={36} />
                        <div>
                          <p className="text-sm font-semi">{u.full_name}</p>
                          <p className="text-xs text-light">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}><span className={`badge ${R_COLOR[u.role]}`}>{R_LABEL[u.role]}</span></td>
                    <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}><span className={`badge ${u.is_active ? 'success' : 'danger'}`}>{u.is_active ? 'Đang hoạt động' : 'Vô hiệu hóa'}</span></td>
                    <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                      <span className="text-sm text-light">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                      <div className="flex gap-2">
                        <button className="btn ghost sm" onClick={() => { setEditUser(u); setForm({ full_name: u.full_name, email: u.email, role: u.role, password: '', is_active: u.is_active }); setShowModal(true); }}><Pencil size={13} /></button>
                        {u.id !== user?.id && u.role !== 'admin' && <button className="btn ghost sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteUser(u)}><Trash2 size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Phân quyền theo Role</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tính năng</th>
                    <th>Admin</th><th>Manager</th><th>Sales</th><th>Viewer</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Xem khách hàng', <Check size={16} color="var(--color-success)" />, <Check size={16} color="var(--color-success)" />, <Check size={16} color="var(--color-success)" />, <Check size={16} color="var(--color-success)" />],
                    ['Thêm/sửa khách hàng', <Check size={16} color="var(--color-success)" />, <Check size={16} color="var(--color-success)" />, <Check size={16} color="var(--color-success)" />, <X size={16} color="var(--color-text-muted)" />],
                    ['Xóa khách hàng', <Check size={16} color="var(--color-success)" />, <Check size={16} color="var(--color-success)" />, <X size={16} color="var(--color-text-muted)" />, <X size={16} color="var(--color-text-muted)" />],
                    ['Xem deal', <Check size={16} color="var(--color-success)" />, <Check size={16} color="var(--color-success)" />, <span className="badge info sm" style={{ padding: '2px 6px', fontSize: '10px' }}>Của mình</span>, <X size={16} color="var(--color-text-muted)" />],
                    ['Xóa deal', <Check size={16} color="var(--color-success)" />, <Check size={16} color="var(--color-success)" />, <X size={16} color="var(--color-text-muted)" />, <X size={16} color="var(--color-text-muted)" />],
                    ['Xem báo cáo', <Check size={16} color="var(--color-success)" />, <Check size={16} color="var(--color-success)" />, <span className="badge info sm" style={{ padding: '2px 6px', fontSize: '10px' }}>Của mình</span>, <X size={16} color="var(--color-text-muted)" />],
                    ['Quản lý người dùng', <Check size={16} color="var(--color-success)" />, <X size={16} color="var(--color-text-muted)" />, <X size={16} color="var(--color-text-muted)" />, <X size={16} color="var(--color-text-muted)" />],
                    ['Cài đặt hệ thống', <Check size={16} color="var(--color-success)" />, <X size={16} color="var(--color-text-muted)" />, <X size={16} color="var(--color-text-muted)" />, <X size={16} color="var(--color-text-muted)" />],
                  ].map(([feat, ...perms]) => (
                    <tr key={feat as string}>
                      <td className="font-semi">{feat}</td>
                      {perms.map((p, i) => <td key={i} style={{ textAlign: 'center' }}>{p}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'pipeline' && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontWeight: 700 }}>Cấu hình các giai đoạn Pipeline</h3>
              <button className="btn primary sm" onClick={() => openGenericModal('pipeline')}>
                <Plus size={14} /> Thêm giai đoạn
              </button>
            </div>
            {pipelines.map((s, i) => (
              <div 
                key={s.id} 
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-surface)', transition: 'background 0.2s' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', color: 'var(--color-text-muted)' }}>
                  <button className="btn-icon-bare" disabled={i === 0} onClick={() => movePipelineStage(i, 'up')} style={{ padding: 2, opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={16} /></button>
                  <button className="btn-icon-bare" disabled={i === pipelines.length - 1} onClick={() => movePipelineStage(i, 'down')} style={{ padding: 2, opacity: i === pipelines.length - 1 ? 0.3 : 1 }}><ChevronDown size={16} /></button>
                </div>
                <span style={{ width: 8, height: 32, background: s.color, borderRadius: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p className="font-semi text-sm">{s.name}</p>
                  <p className="text-xs text-light">{s.deals || 0} deals đang ở giai đoạn này</p>
                </div>
                <button className="btn ghost sm" onClick={() => openGenericModal('pipeline', s)}><Pencil size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'tags' && (
        <div className="animate-fade">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Quản lý Tags Hệ thống</h3>
              <p className="text-sm text-light">Thiết lập trước các Tags chung cho toàn công ty.</p>
            </div>
            <button className="btn primary sm" onClick={() => openGenericModal('tag')}>
              <Plus size={14} /> Thêm Tag mới
            </button>
          </div>
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {tags.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.color }} />
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px' }}>{t.count || 0}</span>
                  <button className="btn-icon-bare" style={{ marginLeft: '0.5rem', color: 'var(--color-text-light)' }} onClick={() => openGenericModal('tag', t)}><Pencil size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'custom_fields' && (
        <div className="animate-fade">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Các trường tùy chỉnh (Custom Fields)</h3>
              <p className="text-sm text-light">Định nghĩa dữ liệu thu thập thêm cho Liên hệ và Công ty.</p>
            </div>
            <button className="btn primary sm" onClick={() => openGenericModal('field')}>
              <Plus size={14} /> Thêm trường mới
            </button>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 40, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}></th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Tên trường</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Module</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Loại dữ liệu</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Bắt buộc</th>
                  <th style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {customFields.map((f, i) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text-muted)', cursor: 'grab' }}><GripVertical size={16} /></td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>{f.label}</td>
                    <td style={{ padding: '0.875rem 1rem' }}><span className="badge info">{f.entity_type === 'contact' ? 'Liên hệ' : f.entity_type === 'company' ? 'Công ty' : 'Cơ hội'}</span></td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>{f.field_type}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <CustomCheckbox 
                        checked={f.is_required} 
                        onChange={async () => {
                          try {
                            await api.put(`/custom-fields/${f.id}`, { is_required: !f.is_required });
                            fetchCustomFields();
                          } catch (e: any) {
                            addToast('Lỗi cập nhật trường', 'error');
                          }
                        }} 
                      />
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <button className="btn-icon-bare text-light" onClick={() => openGenericModal('field', f)}><Pencil size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Modal - Enhanced UI */}
      <CustomModal
        isOpen={showModal}
        onClose={() => !saving && setShowModal(false)}
        title={editUser ? 'Cập nhật thành viên' : 'Thêm thành viên mới'}
        width="480px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: '-0.5rem', marginBottom: '-0.5rem' }}>
            Thiết lập thông tin truy cập hệ thống.
          </p>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Họ & Tên nhân viên <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Ví dụ: Nguyễn Văn A"
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
              />
              <Users size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Email công việc <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="email"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="email@company.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
              <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Vai trò (Role)</label>
              <CustomSelect 
                options={ROLES.map(r => ({ 
                  value: r, 
                  label: R_LABEL[r],
                  sublabel: r === 'admin' ? 'Quyền cao nhất' : r === 'manager' ? 'Quản lý phòng ban' : r === 'sales' ? 'Nhân viên kinh doanh' : 'Chỉ xem dữ liệu'
                }))}
                value={form.role}
                onChange={val => setForm({ ...form, role: val.toString() })}
                direction="up"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>{editUser ? 'Mật khẩu mới' : 'Mật khẩu truy cập *'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type="password"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder={editUser ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <Shield size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              </div>
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)' }}>
            <CustomCheckbox 
              checked={form.is_active} 
              onChange={() => setForm({ ...form, is_active: !form.is_active })} 
              label="Kích hoạt tài khoản"
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '2rem', marginTop: '-0.25rem' }}>Cho phép người dùng này đăng nhập ngay.</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '1.25rem 0 0 0', marginTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn secondary" onClick={() => setShowModal(false)} disabled={saving}>Hủy</button>
          <button
            className="btn primary"
            onClick={handleSave}
            disabled={saving}
            style={{ minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {saving ? (
              <><Loader2 size={16} className="spin" /> Đang xử lý...</>
            ) : (
              <>{editUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}</>
            )}
          </button>
        </div>
      </CustomModal>
      {/* Generic Modal for Settings */}
      <CustomModal
        isOpen={!!activeModal.type}
        onClose={() => setActiveModal({ type: null, item: null })}
        title={(activeModal.item ? 'Chỉnh sửa ' : 'Thêm mới ') + (activeModal.type === 'pipeline' ? 'giai đoạn Pipeline' : activeModal.type === 'tag' ? 'Tag' : 'Trường tùy chỉnh')}
        width="460px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Tên {activeModal.type === 'pipeline' ? 'giai đoạn' : activeModal.type === 'tag' ? 'Tag' : 'trường'} *</label>
            <input className="form-input" value={activeModal.type === 'field' ? (genericForm.label || '') : (genericForm.name || '')} onChange={e => setGenericForm({ ...genericForm, [activeModal.type === 'field' ? 'label' : 'name']: e.target.value })} autoFocus />
          </div>

          {(activeModal.type === 'pipeline' || activeModal.type === 'tag') && (
            <div className="form-group">
              <label className="form-label">Màu sắc</label>
              <input type="color" value={genericForm.color || '#000000'} onChange={e => setGenericForm({ ...genericForm, color: e.target.value })} style={{ width: '100%', height: 40, padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer' }} />
            </div>
          )}

          {activeModal.type === 'field' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Module áp dụng</label>
                  <CustomSelect 
                    options={[
                      { value: 'contact', label: 'Liên hệ' },
                      { value: 'company', label: 'Công ty' },
                      { value: 'deal', label: 'Cơ hội (Deal)' }
                    ]} 
                    value={genericForm.entity_type || 'contact'} 
                    onChange={val => setGenericForm({ ...genericForm, entity_type: val.toString() })} 
                    direction="up"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Loại dữ liệu</label>
                  <CustomSelect 
                    options={[
                      { value: 'text', label: 'Văn bản (Text)' },
                      { value: 'number', label: 'Số (Number)' },
                      { value: 'date', label: 'Ngày tháng (Date)' },
                      { value: 'dropdown', label: 'Chọn 1 (Dropdown)' },
                      { value: 'multiselect', label: 'Chọn nhiều (Multi-select)' },
                      { value: 'checkbox', label: 'Hộp kiểm (Checkbox)' }
                    ]} 
                    value={genericForm.field_type || 'text'} 
                    onChange={val => setGenericForm({ ...genericForm, field_type: val.toString() })} 
                    direction="up"
                  />
                </div>
              </div>
              {['dropdown', 'multiselect'].includes(genericForm.field_type) && (
                <div className="form-group">
                  <label className="form-label">Các tùy chọn (cách nhau bởi dấu phẩy)</label>
                  <input className="form-input" value={Array.isArray(genericForm.options) ? genericForm.options.join(', ') : (genericForm.options || '')} onChange={e => setGenericForm({ ...genericForm, options: e.target.value })} placeholder="VD: Vàng, Bạc, Đồng" />
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.25rem 0 0 0', marginTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
          {activeModal.item ? (
            <button className="btn danger sm" onClick={() => {
              showConfirm(
                'Xác nhận xóa?',
                'Bạn có chắc chắn muốn xóa mục này? Thao tác này không thể hoàn tác.',
                async () => {
                  try {
                    if (activeModal.type === 'pipeline') {
                      const dealCount = activeModal.item.deals || 0;
                      if (dealCount > 0) {
                        showConfirm({
                          title: 'Không thể xóa giai đoạn!',
                          message: `Giai đoạn này đang chứa ${dealCount} deal. Bạn phải di chuyển tất cả deal sang giai đoạn khác trước khi xóa.`,
                          confirmText: 'Đã hiểu',
                          onConfirm: () => {}
                        });
                        return;
                      }
                      
                      showConfirm({
                        title: 'Xóa giai đoạn Pipeline?',
                        message: `Bạn có chắc chắn muốn xóa giai đoạn "${activeModal.item.name}"? Thao tác này không thể hoàn tác.`,
                        isDanger: true,
                        confirmText: 'Xóa vĩnh viễn',
                        onConfirm: async () => {
                          try {
                            await api.delete(`/pipeline-stages/${activeModal.item.id}`);
                            addToast('Đã xóa giai đoạn', 'success');
                            fetchPipelines();
                            setActiveModal({ type: null, item: null });
                          } catch (e: any) {
                            addToast(e.response?.data?.message || 'Lỗi khi xóa', 'error');
                          }
                        }
                      });
                    }
                    if (activeModal.type === 'tag') {
                      const usageCount = activeModal.item.count || 0;
                      showConfirm({
                        title: 'Xác nhận xóa Tag?',
                        message: `Bạn có chắc chắn muốn xóa Tag "${activeModal.item.name}"?`,
                        impactInfo: usageCount > 0 ? `Cảnh báo: Tag này đang được sử dụng bởi ${usageCount} mục.` : undefined,
                        isDanger: true,
                        requireWordMatch: usageCount > 10 ? 'DELETE' : undefined,
                        confirmText: 'Xác nhận xóa',
                        onConfirm: async () => {
                          try {
                            await api.delete(`/tags/${activeModal.item.id}`);
                            addToast('Đã xóa Tag', 'success');
                            fetchTags();
                            setActiveModal({ type: null, item: null });
                          } catch (e: any) {
                            addToast(e.response?.data?.message || 'Lỗi khi xóa', 'error');
                          }
                        }
                      });
                    }
                    if (activeModal.type === 'field') {
                      showConfirm({
                        title: 'Xóa trường tùy chỉnh?',
                        message: `Dữ liệu trong trường "${activeModal.item.label}" sẽ bị xóa vĩnh viễn trên toàn bộ hệ thống.`,
                        isDanger: true,
                        confirmText: 'Xác nhận xóa',
                        onConfirm: async () => {
                          try {
                            await api.delete(`/custom-fields/${activeModal.item.id}`);
                            fetchCustomFields();
                            setActiveModal({ type: null, item: null });
                            addToast('Đã xóa trường tùy chỉnh', 'success');
                          } catch (e: any) {
                            addToast('Lỗi xóa trường tùy chỉnh', 'error');
                          }
                        }
                      });
                    }
                    setActiveModal({ type: null, item: null });
                    addToast('Đã xóa', 'success');
                  } catch (e: any) {
                    addToast(e.response?.data?.message || 'Lỗi khi xóa', 'error');
                  }
                }
              );
            }}><Trash2 size={14} /> Xóa</button>
          ) : <div />}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn secondary" onClick={() => setActiveModal({ type: null, item: null })}>Hủy</button>
            <button className="btn primary" onClick={handleGenericSave}>Lưu cấu hình</button>
          </div>
        </div>
      </CustomModal>
    </div>
  );
};
