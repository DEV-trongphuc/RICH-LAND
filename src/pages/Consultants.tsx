import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, UserX, Clock, X, Mail, User, Shield, Users, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Avatar } from '../components/ui/Avatar';
import { fetchAPI } from '../utils/api';
import { TableRowSkeleton } from '../components/ui/Skeleton';

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

export const Consultants = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Quick message state
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessageTarget, setQuickMessageTarget] = useState<any>(null);
  const [quickMessageText, setQuickMessageText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    status: 'active',
    leave_start: '',
    leave_end: '',
    zalo_chat_id: ''
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
    setFormData({ name: '', email: '', status: 'active', leave_start: '', leave_end: '', zalo_chat_id: '' });
    setModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({ 
      name: user.name, email: user.email, status: user.status,
      leave_start: user.leave_start || '', leave_end: user.leave_end || '',
      zalo_chat_id: user.zalo_chat_id || ''
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

  const handleUnlinkZalo = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy liên kết Zalo của tư vấn viên này không?')) return;
    try {
      const json = await fetchAPI('unlink_zalo', {
        method: 'POST',
        body: JSON.stringify({ id, type: 'consultant' })
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
        toast.success('Đã gửi tin nhắn thành công!');
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

  const activeCount  = users.filter(u => u.status === 'active').length;
  const leaveCount   = users.filter(u => u.status === 'leave').length;

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
      <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
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
                  <tr key={u.id} className="group table-row-hover">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={u.name} size={32} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                            {u.name}
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
                          <button
                            onClick={() => handleUnlinkZalo(u.id)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: '#fee2e2',
                              color: '#ef4444',
                              border: 'none',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2
                            }}
                            title="Hủy liên kết Zalo"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: 6, 
                          padding: '4px 10px', borderRadius: 20, 
                          background: 'var(--color-bg)', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 500
                        }}>
                          Chưa liên kết
                        </span>
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
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', opacity: 0, transition: 'opacity 0.15s' }}>
                        {(u.zalo_chat_id || u.email) && (
                          <button onClick={() => { setQuickMessageTarget(u); setQuickMessageOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: '#0068ff' }} title="Gửi tin nhắn nhanh (Email/Zalo)">
                            <MessageCircle size={14} />
                          </button>
                        )}
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
            style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out' }} 
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
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
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
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#fffbeb', padding: '1rem', borderRadius: 12, border: '1px solid #fde68a' }}>
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

                <div className="form-group" style={{ padding: '1rem', background: 'rgba(0, 104, 255, 0.05)', borderRadius: 12, border: '1px solid rgba(0, 104, 255, 0.1)' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0068ff' }}>
                    <MessageCircle size={14} /> Zalo Chat ID (Tự động cấp)
                  </label>
                  <input 
                    className="form-input" 
                    placeholder="Chưa liên kết. Sale cần nhắn mã ID cho Zalo Bot." 
                    value={formData.zalo_chat_id}
                    onChange={e => setFormData({ ...formData, zalo_chat_id: e.target.value })}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
                    Sale nhắn mã ID của mình vào Bot, hệ thống sẽ tự điền ID này. Admin cũng có thể nhập tay nếu biết Zalo Chat ID.
                  </p>
                </div>
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
              <div style={{ padding: '1.25rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
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
