import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, UserX, Clock, X, Mail, User, Shield, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAPI } from '../utils/api';
import { ConfirmModal } from '../components/ui/ConfirmModal';

interface User {
  id: number;
  name: string;
  status: 'active' | 'inactive' | 'leave';
  leave_start?: string;
  leave_end?: string;
}

const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#0ea5e9', 
  '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#14b8a6', '#6366f1'
];

const getColorForName = (name: string) => {
  if (!name || name === '-') return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const Consultants = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    status: 'active',
    leave_start: '',
    leave_end: ''
  });

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
    setFormData({ name: '', email: '', status: 'active', leave_start: '', leave_end: '' });
    setModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({ 
      name: user.name, email: user.email, status: user.status,
      leave_start: user.leave_start || '', leave_end: user.leave_end || ''
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
      const payload = { ...formData, id: editingUser?.id };
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

  const activeCount  = users.filter(u => u.status === 'active').length;
  const leaveCount   = users.filter(u => u.status === 'leave').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text)' }}>Quản lý Tư vấn viên</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', marginTop: 2 }}>
            Danh sách nhân sự tiếp nhận và xử lý data từ hệ thống
          </p>
        </div>
        <button onClick={openAddModal} className="btn primary" style={{ fontSize: '0.875rem' }}>
          <Plus size={16} /> Thêm TVV
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
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
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Tên TVV</th>
                <th>Email</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4}>
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
                const initials = u.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                return (
                  <tr key={u.id} className="group table-row-hover">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="avatar-placeholder sm" style={{ background: getColorForName(u.name), color: 'white', border: 'none', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{u.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{u.email}</td>
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
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', opacity: 0, transition: 'opacity 0.15s' }}>
                        <button onClick={() => openEditModal(u)} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8 }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => { setDeleteId(u.id); setConfirmDeleteOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: 'var(--color-danger)' }}>
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
            style={{ width: '100%', maxWidth: 500, animation: 'slideUp 0.2s ease-out' }} 
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
            
            <form onSubmit={handleSave}>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                  <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, status: 'active' })}
                      style={{ flex: 1, padding: '0.625rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.8125rem',
                        background: formData.status === 'active' ? 'white' : 'transparent',
                        color: formData.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)',
                        boxShadow: formData.status === 'active' ? 'var(--shadow-sm)' : 'none',
                        transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                      }}
                    >Đang nhận Data</button>
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, status: 'leave' })}
                      style={{ flex: 1, padding: '0.625rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.8125rem',
                        background: formData.status === 'leave' ? 'white' : 'transparent',
                        color: formData.status === 'leave' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                        boxShadow: formData.status === 'leave' ? 'var(--shadow-sm)' : 'none',
                        transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                      }}
                    >Nghỉ phép</button>
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, status: 'inactive' })}
                      style={{ flex: 1, padding: '0.625rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.8125rem',
                        background: formData.status === 'inactive' ? 'white' : 'transparent',
                        color: formData.status === 'inactive' ? 'var(--color-danger)' : 'var(--color-text-muted)',
                        boxShadow: formData.status === 'inactive' ? 'var(--shadow-sm)' : 'none',
                        transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                      }}
                    >Ngừng HĐ</button>
                  </div>
                </div>

                {formData.status === 'leave' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#fffbeb', padding: '1rem', borderRadius: 12, border: '1px solid #fde68a' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Từ ngày</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                        value={formData.leave_start}
                        onChange={e => setFormData({ ...formData, leave_start: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Đến ngày</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                        value={formData.leave_end}
                        onChange={e => setFormData({ ...formData, leave_end: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '1.25rem', background: '#f8fafc', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
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
      <ConfirmModal 
        isOpen={confirmDeleteOpen} 
        onClose={() => setConfirmDeleteOpen(false)} 
        onConfirm={handleDelete} 
        title="Cảnh báo Xóa Tư vấn viên" 
        message="Bạn có chắc chắn muốn xóa tư vấn viên này không? CHÚ Ý: Nếu TVV này đã từng nhận Data, việc xóa sẽ làm hỏng báo cáo thống kê. Thay vào đó, bạn nên chuyển trạng thái của TVV sang 'Ngừng hoạt động' hoặc 'Nghỉ phép'." 
        confirmText="Xóa vĩnh viễn" 
      />
    </div>
  );
};
