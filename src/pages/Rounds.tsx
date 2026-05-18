import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Users, Edit3, UserPlus, Zap, X, Shield, Check, LayoutGrid, List, Trash2 } from 'lucide-react';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';

export const Rounds = () => {
  const [rounds, setRounds] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingRound, setEditingRound] = useState<any>(null);
  const [formData, setFormData] = useState({
    round_name: '',
    is_active: 1,
    cc_emails: '',
    selected_users: [] as number[],
    starting_consultant_id: null as number | null
  });

  const [searchUser, setSearchUser] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchConsultants = async () => {
    try {
      const json = await fetchAPI('get_consultants');
      if (json.success) setConsultants(json.data);
    } catch (e: any) {
      console.error('Không thể tải tư vấn viên:', e.message);
    }
  };

  const fetchRounds = async () => {
    try {
      const json = await fetchAPI('get_rounds');
      if (json.success) setRounds(json.data);
    } catch (e: any) {
      toast.error('Không thể tải dữ liệu: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { 
    fetchRounds(); 
    fetchConsultants();
  }, []);

  const openAddModal = () => {
    setEditingRound(null);
    setFormData({ round_name: '', is_active: 1, cc_emails: '', selected_users: [], starting_consultant_id: null });
    setModalOpen(true);
  };

  const openEditModal = (r: any) => {
    setEditingRound(r);
    let matchedIds: number[] = [];
    if (r.consultant_ids) {
        matchedIds = r.consultant_ids.split(',').map((id: string) => parseInt(id, 10));
    }
    
    setFormData({ 
      round_name: r.round_name, 
      is_active: r.is_active, 
      cc_emails: r.cc_emails || '',
      selected_users: matchedIds,
      starting_consultant_id: r.next_consultant_id ? parseInt(r.next_consultant_id) : null
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.round_name) return toast.error("Vui lòng nhập tên vòng");

    try {
      const action = editingRound ? 'edit_round' : 'add_round';
      const payload = { ...formData, id: editingRound?.id, consultants: formData.selected_users };
      
      const json = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (json.success) {
        toast.success(editingRound ? 'Cập nhật thành công!' : 'Thêm mới thành công!');
        fetchRounds();
        setModalOpen(false);
      } else {
        toast.error(json.message || 'Lỗi khi lưu');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const toggleUserSelection = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      selected_users: prev.selected_users.includes(userId)
        ? prev.selected_users.filter(id => id !== userId)
        : [...prev.selected_users, userId]
    }));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const json = await fetchAPI(`delete_round&id=${deleteId}`);
      if (json.success) {
        toast.success('Đã xóa thành công!');
        fetchRounds();
      } else {
        toast.error(json.message || 'Lỗi khi xóa vòng');
      }
    } catch (e: any) { toast.error('Lỗi: ' + e.message); }
    setConfirmDeleteOpen(false);
  };

  const removeUser = (userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData(prev => ({
      ...prev,
      selected_users: prev.selected_users.filter(id => id !== userId)
    }));
  };

  const ROUND_COLORS = ['var(--color-primary)', '#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <div style={{ animation: 'slideUp 0.3s ease-out' }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={24} color="var(--color-primary)" />
            Vòng Phân Bổ
          </h1>
          <p className="page-subtitle">
            Quản lý vòng xoay Round-Robin và điều phối Tư vấn viên
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--color-border-light)', padding: 4, borderRadius: 'var(--radius-md)' }}>
            <button 
              onClick={() => setViewMode('grid')}
              style={{
                padding: '6px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6,
                background: viewMode === 'grid' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                boxShadow: viewMode === 'grid' ? 'var(--shadow-xs)' : 'none',
                fontWeight: viewMode === 'grid' ? 600 : 500, fontSize: '0.875rem', transition: 'all 0.2s'
              }}
            >
              <LayoutGrid size={16} /> Lưới
            </button>
            <button 
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6,
                background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-xs)' : 'none',
                fontWeight: viewMode === 'list' ? 600 : 500, fontSize: '0.875rem', transition: 'all 0.2s'
              }}
            >
              <List size={16} /> Danh sách
            </button>
          </div>
          
          <button className="btn primary" onClick={openAddModal}>
            <Plus size={18} /> Thêm Vòng
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', padding: '2rem' }}>Đang tải...</p>
      ) : (
        <div style={{ 
          display: viewMode === 'grid' ? 'grid' : 'flex', 
          flexDirection: viewMode === 'list' ? 'column' : 'row',
          gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(400px, 1fr))' : 'none', 
          gap: '1.25rem' 
        }}>
          {rounds.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 12, border: '1px dashed var(--color-border)', gridColumn: '1 / -1' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                <Zap size={32} color="var(--color-text-muted)" />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Chưa có Vòng Phân Bổ</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>Bắt đầu bằng cách thêm mới vòng phân bổ đầu tiên của bạn để chia số cho Sale.</p>
              <button className="btn primary" onClick={openAddModal}><Plus size={18}/> Thêm Vòng ngay</button>
            </div>
          ) : rounds.map((r, idx) => {
            const consList = r.consultants ? r.consultants.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
            const color = ROUND_COLORS[idx % ROUND_COLORS.length];

            return viewMode === 'grid' ? (
              <div key={r.id} className="card hover-lift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 4, background: color }} />
                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Zap size={18} color={color} />
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' }}>{r.round_name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.is_active ? 'var(--color-success)' : 'var(--color-border)', display: 'inline-block' }} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            {r.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: 1, marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Users size={11} /> Thành viên ({consList.length})
                    </p>
                    {consList.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {consList.map((c: string, i: number) => {
                          const initials = c.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                          return (
                            <span key={i} style={{
                              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                              padding: '2px 10px 2px 2px', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text)',
                              display: 'flex', alignItems: 'center', gap: 6
                            }}>
                              <span style={{ width: 22, height: 22, borderRadius: '50%', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                                {initials}
                              </span>
                              {c}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa gán TVV nào</p>
                    )}
                    
                    {r.next_assigned_name && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={14} color="var(--color-primary)" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-dark)', fontWeight: 600 }}>Sale lượt tới: {r.next_assigned_name}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                    <button className="btn outline sm" onClick={() => openEditModal(r)} style={{ flex: 1 }}>
                      <Edit3 size={13} /> Sửa
                    </button>
                    <button className="btn outline sm" onClick={() => { setDeleteId(r.id); setConfirmDeleteOpen(true); }} style={{ padding: '0 0.5rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger-light)' }}>
                      <Trash2 size={13} />
                    </button>
                    <button className="btn primary sm" onClick={() => openEditModal(r)} style={{ flex: 1 }}>
                      <UserPlus size={13} /> Gán TVV
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={r.id} className="card hover-lift" style={{ 
                display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.5rem',
                borderLeft: `4px solid ${color}`
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={20} color={color} />
                </div>
                
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{r.round_name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.is_active ? 'var(--color-success)' : 'var(--color-border)', display: 'inline-block' }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      {r.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginRight: '0.5rem' }}>
                      {consList.length} Thành viên
                    </p>
                    {consList.slice(0, 4).map((c: string, i: number) => {
                      const initials = c.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                      return (
                        <div key={i} title={c} style={{
                          width: 32, height: 32, borderRadius: '50%', background: color, color: 'white', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                          border: '2px solid white', marginLeft: i > 0 ? -12 : 0, boxShadow: 'var(--shadow-sm)'
                        }}>
                          {initials}
                        </div>
                      );
                    })}
                    {consList.length > 4 && (
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg)', color: 'var(--color-text-muted)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                        border: '2px solid white', marginLeft: -12, boxShadow: 'var(--shadow-sm)'
                      }}>
                        +{consList.length - 4}
                      </div>
                    )}
                  </div>
                  
                  {r.next_assigned_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={12} color="var(--color-primary)" />
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-primary-dark)', fontWeight: 600 }}>Sale lượt tới: {r.next_assigned_name}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn outline sm" onClick={() => openEditModal(r)}>
                    <Edit3 size={14} /> Sửa
                  </button>
                  <button className="btn outline sm" onClick={() => { setDeleteId(r.id); setConfirmDeleteOpen(true); }} style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger-light)', padding: '0 0.5rem' }}>
                    <Trash2 size={14} />
                  </button>
                  <button className="btn primary sm" onClick={() => openEditModal(r)}>
                    <UserPlus size={14} /> Gán TVV
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {modalOpen && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => { setModalOpen(false); setShowDropdown(false); }}>
          <div 
            className="card"
            style={{ width: '100%', maxWidth: 540, animation: 'slideUp 0.2s ease-out' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                {editingRound ? 'Cập nhật Vòng Phân Bổ' : 'Thêm Vòng Phân Bổ mới'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ color: 'var(--color-text-muted)', padding: 4, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave}>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Tên Vòng <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input 
                    className="form-input" 
                    placeholder="VD: Vòng 1 — Form Đăng Ký" 
                    value={formData.round_name}
                    onChange={e => setFormData({ ...formData, round_name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Email CC khi chia Data</label>
                  <input 
                    className="form-input" 
                    placeholder="VD: giamdoc@domation.vn, quanly@domation.vn" 
                    value={formData.cc_emails}
                    onChange={e => setFormData({ ...formData, cc_emails: e.target.value })}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Phân tách các email bằng dấu phẩy (,). Các email này sẽ nhận thông báo mỗi khi có Data rơi vào vòng này.</p>
                </div>
                
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14}/> Trạng thái Vòng</label>
                  <div style={{ marginTop: 8 }}>
                    <ToggleSwitch 
                      checked={formData.is_active === 1}
                      onChange={(checked) => setFormData({ ...formData, is_active: checked ? 1 : 0 })}
                    />
                  </div>
                </div>

                {/* Custom Multi-Select with Avatars */}
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14}/> Chọn Tư vấn viên vào vòng này</label>
                  
                  {/* Selected Tags Wrapper */}
                  <div 
                    style={{ 
                      minHeight: 44, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', 
                      padding: '4px', background: 'var(--color-surface)', display: 'flex', flexWrap: 'wrap', gap: 4,
                      cursor: 'text'
                    }}
                    onClick={() => setShowDropdown(true)}
                  >
                    {formData.selected_users.map(userId => {
                      const user = consultants.find(c => c.id === userId);
                      if (!user) return null;
                      const initials = user.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                      return (
                        <div key={user.id} style={{
                          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                          padding: '2px 6px 2px 2px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text)',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
                            {initials}
                          </span>
                          {user.name}
                          <button type="button" onClick={(e) => removeUser(user.id, e)} style={{ color: 'var(--color-text-muted)', padding: 2, borderRadius: '50%', marginLeft: 2, border: 'none', background: 'transparent', cursor: 'pointer' }} onMouseEnter={e=>(e.currentTarget.style.color='var(--color-danger)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--color-text-muted)')}>
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                    
                    {/* Search Input inline */}
                    <input 
                      style={{ flex: 1, minWidth: 100, border: 'none', outline: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem' }}
                      placeholder={formData.selected_users.length === 0 ? "Tìm kiếm TVV..." : ""}
                      value={searchUser}
                      onChange={e => setSearchUser(e.target.value)}
                      onFocus={() => setShowDropdown(true)}
                    />
                  </div>

                  {/* Dropdown Options */}
                  {showDropdown && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-lg)', maxHeight: 200, overflowY: 'auto'
                    }}>
                      {consultants.filter(c => c.name.toLowerCase().includes(searchUser.toLowerCase())).map(user => {
                        const isSelected = formData.selected_users.includes(user.id);
                        const initials = user.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                        
                        return (
                          <div 
                            key={user.id}
                            onClick={() => toggleUserSelection(user.id)}
                            style={{
                              padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
                              background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                              transition: 'background 0.1s'
                            }}
                            onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = 'var(--color-bg)'; }}
                            onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                              {initials}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '0.875rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>{user.name}</p>
                              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{user.email} • {user.status === 'active' ? 'Đang nhận data' : 'Không nhận data'}</p>
                            </div>
                            {isSelected && <Check size={16} color="var(--color-primary)" />}
                          </div>
                        );
                      })}
                      {consultants.filter(c => c.name.toLowerCase().includes(searchUser.toLowerCase())).length === 0 && (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          Không tìm thấy tư vấn viên nào
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {formData.selected_users.length > 0 && (
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14}/> Chọn Sale bắt đầu (Tuỳ chọn)</label>
                    <select 
                      className="form-input" 
                      value={formData.starting_consultant_id || ''}
                      onChange={e => setFormData({ ...formData, starting_consultant_id: e.target.value ? parseInt(e.target.value) : null })}
                      style={{ padding: '0.75rem', appearance: 'auto' }}
                    >
                      <option value="">-- Mặc định (Theo thứ tự thêm vào) --</option>
                      {formData.selected_users.map(id => {
                        const c = consultants.find(x => x.id === id);
                        return c ? <option key={id} value={id}>{c.name}</option> : null;
                      })}
                    </select>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      Người được chọn sẽ là người nhận Data tiếp theo của vòng này.
                    </p>
                  </div>
                )}

              </div>

              <div style={{ padding: '1.25rem', background: '#f8fafc', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
                <button type="button" className="btn outline" onClick={() => { setModalOpen(false); setShowDropdown(false); }}>Hủy bỏ</button>
                <button type="submit" className="btn primary">
                  {editingRound ? 'Cập nhật' : 'Thêm mới'}
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
        title="Cảnh báo Xóa Vòng Phân Bổ" 
        message="Bạn có chắc chắn muốn xóa vòng này không? Lưu ý: Việc xóa vòng phân bổ sẽ ảnh hưởng trực tiếp đến các Rule định tuyến đang trỏ đến vòng này!" 
        confirmText="Xóa vĩnh viễn" 
      />
    </div>
  );
};
