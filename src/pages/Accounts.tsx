import React, { useEffect, useState } from 'react';
import { Shield, Plus, Edit3, Trash2, KeyRound, UserCog } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
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
    role: 'viewer'
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

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
    setFormData({ username: '', password: '', name: '', role: 'viewer' });
    setModalOpen(true);
  };

  const openEditModal = (acc: any) => {
    setEditingAccount(acc);
    setFormData({ username: acc.username, password: '', name: acc.name, role: acc.role });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.name) return toast.error('Vui lòng nhập đủ tên và username');
    if (!editingAccount && !formData.password) return toast.error('Vui lòng nhập mật khẩu cho tài khoản mới');

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
  };

  const handleDelete = async () => {
    if (!deleteId) return;
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
    setConfirmOpen(false);
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') return <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--color-primary)', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Admin</span>;
    if (role === 'assistant') return <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Assistant</span>;
    return <span style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>Viewer</span>;
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCog size={28} color="var(--color-primary)" /> Quản lý Tài khoản
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Quản trị hệ thống và phân quyền truy cập cho nhân viên.</p>
        </div>
        <button onClick={openAddModal} className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', fontSize: '0.875rem' }}>
          <Plus size={18} /> Thêm tài khoản
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Đang tải dữ liệu...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tên người dùng</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tên đăng nhập</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Phân quyền</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s' }} className="hover:bg-slate-50">
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{acc.name}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={14} /> {acc.username}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>{getRoleBadge(acc.role)}</td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={() => openEditModal(acc)} className="btn ghost" style={{ padding: 8, color: 'var(--color-primary)' }} title="Sửa">
                          <Edit3 size={16} />
                        </button>
                        {acc.id !== 1 && (
                          <button onClick={() => { setDeleteId(acc.id); setConfirmOpen(true); }} className="btn ghost" style={{ padding: 8, color: 'var(--color-danger)' }} title="Xóa">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={4}>
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
            <label className="form-label">Tên đăng nhập <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input 
              className="form-input" 
              placeholder="VD: admin_nhansu" 
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              required
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
            <select 
              className="form-input" 
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
              style={{ padding: '0.75rem', appearance: 'auto' }}
            >
              <option value="admin">Admin (Toàn quyền)</option>
              <option value="assistant">Assistant (Trợ lý / Phân bổ Data)</option>
              <option value="viewer">Viewer (Chỉ xem Data)</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn ghost" style={{ flex: 1 }}>Hủy</button>
            <button type="submit" className="btn primary" style={{ flex: 1 }}>Lưu Tài khoản</button>
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
    </div>
  );
};
