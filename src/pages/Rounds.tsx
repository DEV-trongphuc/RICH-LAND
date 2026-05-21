import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Users, Edit3, Zap, X, Shield, Check, LayoutGrid, List, Trash2, Search, AlertCircle, Clock } from 'lucide-react';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { RoundCardSkeleton } from '../components/ui/Skeleton';

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
export const Rounds = () => {
  const [rounds, setRounds] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingRound, setEditingRound] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActioning, setIsActioning] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    round_name: '',
    is_active: 1,
    cc_emails: '',
    selected_users: [] as number[],
    starting_consultant_id: null as number | null,
    ratios: {} as Record<string, number>,
    data_per_turns: {} as Record<string, number>,
    compensations: {} as Record<string, number>,
    is_fallback: false
  });

  const [searchUser, setSearchUser] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showStartSaleDropdown, setShowStartSaleDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const startSaleDropdownRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'config' | 'reports'>('config');
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Compensation Modal State
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [compRound, setCompRound] = useState<any>(null);
  const [compData, setCompData] = useState<Record<number, number>>({});
  const [isSavingComp, setIsSavingComp] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (startSaleDropdownRef.current && !startSaleDropdownRef.current.contains(event.target as Node)) {
        setShowStartSaleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

  useEffect(() => {
    const handleLeadAdded = () => {
      fetchRounds();
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, []);

  const openAddModal = () => {
    setEditingRound(null);
    setFormData({ round_name: '', is_active: 1, cc_emails: '', selected_users: [], starting_consultant_id: null, ratios: {}, data_per_turns: {}, compensations: {}, is_fallback: false });
    setModalOpen(true);
  };

  const openCompModal = (r: any) => {
    setCompRound(r);
    setCompData(r.compensations || {});
    setCompModalOpen(true);
  };

  const handleSaveComp = async () => {
    if (!compRound || isSavingComp) return;
    setIsSavingComp(true);
    try {
      const payload = {
        round_id: compRound.id,
        compensations: compData
      };
      const res = await fetchAPI('update_compensations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        toast.success('Đã cập nhật Bù Data!');
        fetchRounds();
        setCompModalOpen(false);
      } else {
        toast.error(res.message || 'Có lỗi xảy ra');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSavingComp(false);
  };

  const openEditModal = (r: any) => {
    setEditingRound(r);
    setActiveTab('config');
    let matchedIds: number[] = [];
    if (r.consultant_ids) {
      matchedIds = r.consultant_ids.split(',').map((id: string) => parseInt(id, 10));
    }

    setFormData({
      round_name: r.round_name,
      is_active: Number(r.is_active),
      cc_emails: r.cc_emails || '',
      selected_users: matchedIds,
      starting_consultant_id: r.next_consultant_id ? parseInt(r.next_consultant_id) : null,
      ratios: r.ratios || {},
      data_per_turns: r.data_per_turns || {},
      compensations: r.compensations || {},
      is_fallback: !!r.is_fallback
    });
    setModalOpen(true);
    fetchReports(r.id);
  };

  const fetchReports = async (roundId: number) => {
    setLoadingReports(true);
    try {
      const res = await fetchAPI(`get_reports&round_id=${roundId}`);
      if (res.success) setReports(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoadingReports(false);
  };

  const handleReportAction = async (reportId: number, action: 'approve' | 'reject') => {
    if (isActioning) return;
    setIsActioning(reportId);
    try {
      const endpoint = action === 'approve' ? 'approve_report' : 'reject_report';
      const res = await fetchAPI(endpoint, {
        method: 'POST',
        body: JSON.stringify({ id: reportId })
      });
      if (res.success) {
        toast.success(action === 'approve' ? 'Đã duyệt đền bù Data!' : 'Đã từ chối báo cáo!');
        fetchReports(editingRound.id);
        fetchRounds(); // Refresh to get updated compensations count
      } else {
        toast.error(res.message || 'Có lỗi xảy ra');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsActioning(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.round_name) return toast.error("Vui lòng nhập tên vòng");
    if (isSaving) return;

    setIsSaving(true);
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
    setIsSaving(false);
  };

  const toggleUserSelection = (userId: number | string) => {
    const id = Number(userId);
    setFormData(prev => ({
      ...prev,
      selected_users: prev.selected_users.includes(id)
        ? prev.selected_users.filter(x => x !== id)
        : [...prev.selected_users, id]
    }));
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const json = await fetchAPI(`delete_round&id=${deleteId}`);
      if (json.success) {
        toast.success('Đã xóa thành công!');
        fetchRounds();
      } else {
        toast.error(json.message || 'Lỗi khi xóa');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsDeleting(false);
    setConfirmDeleteOpen(false);
  };

  const removeUser = (userId: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = Number(userId);
    setFormData(prev => ({
      ...prev,
      selected_users: prev.selected_users.filter(x => x !== id)
    }));
  };

  const ROUND_COLORS = ['var(--color-primary)', '#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <div style={{ animation: 'slideUp 0.3s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={24} color="var(--color-primary)" />
            Vòng Phân Bổ
          </h1>
          <p className="page-subtitle">
            Quản lý vòng xoay Round-Robin và điều phối Tư vấn viên
          </p>
        </div>

        <div className="mobile-flex-wrap" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
        <div className="responsive-grid-auto-400" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map(i => <RoundCardSkeleton key={i} />)}
        </div>
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
              <button className="btn primary" onClick={openAddModal}><Plus size={18} /> Thêm Vòng ngay</button>
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
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {r.round_name}
                          {r.is_fallback && (
                            <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>
                              Mặc định
                            </span>
                          )}
                        </h3>
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
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', margin: 0, minWidth: 95 }}>
                        {consList.length} Thành viên
                      </p>
                      {consList.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {consList.slice(0, 4).map((c: string, i: number) => {
                            const initials = c.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                            return (
                              <div key={i} title={c} style={{
                                width: 32, height: 32, borderRadius: '50%', background: getColorForName(c),
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700, border: '2px solid var(--color-surface)',
                                marginLeft: i === 0 ? 0 : -8, position: 'relative', zIndex: 10 - i, boxShadow: 'var(--shadow-sm)'
                              }}>
                                {initials}
                              </div>
                            );
                          })}
                          {consList.length > 4 && (
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg)',
                              color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 700, border: '2px solid var(--color-surface)',
                              marginLeft: -8, position: 'relative', zIndex: 5, boxShadow: 'var(--shadow-sm)'
                            }}>
                              +{consList.length - 4}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>Chưa có</p>
                      )}
                    </div>

                    {r.next_assigned_name && (
                      <div style={{ padding: '0.5rem', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={14} color="var(--color-primary)" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-dark)', fontWeight: 600 }}>Sale lượt tới: {r.next_assigned_name}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                    <button className="btn outline sm" onClick={() => openEditModal(r)} style={{ flex: 1, padding: '0.5rem' }}>
                      <Edit3 size={13} /> Sửa
                    </button>
                    <button className="btn primary sm" onClick={() => openCompModal(r)} style={{ flex: 1, padding: '0.5rem' }}>
                      <Zap size={13} /> Bù Data
                    </button>
                    <button className="btn outline sm" onClick={() => { setDeleteId(r.id); setConfirmDeleteOpen(true); }} style={{ padding: '0 0.75rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger-light)' }}>
                      <Trash2 size={14} />
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
                  <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {r.round_name}
                    {r.is_fallback && (
                      <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>
                        Mặc định
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.is_active ? 'var(--color-success)' : 'var(--color-border)', display: 'inline-block' }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      {r.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginRight: '0.5rem', minWidth: 90 }}>
                      {consList.length} Thành viên
                    </p>
                    {consList.slice(0, 4).map((c: string, i: number) => {
                      const initials = c.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                      return (
                        <div key={i} title={c} style={{
                          width: 32, height: 32, borderRadius: '50%', background: getColorForName(c), color: 'white',
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

                <div className="mobile-round-actions" style={{ padding: '1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => openEditModal(r)} className="btn outline" style={{ flex: 1, padding: '0.625rem' }}>
                    <Edit3 size={16} /> Sửa
                  </button>
                  <button onClick={() => openCompModal(r)} className="btn primary" style={{ flex: 1, padding: '0.625rem' }}>
                    <Zap size={16} /> Bù Data
                  </button>
                  <button onClick={() => { setDeleteId(r.id); setConfirmDeleteOpen(true); }} className="btn outline danger" style={{ padding: '0.625rem', width: 42, flexShrink: 0, justifyContent: 'center' }}>
                    <Trash2 size={16} />
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
            style={{ width: '100%', maxWidth: 1000, minHeight: 500, maxHeight: '90vh', animation: 'slideUp 0.2s ease-out', display: 'flex', flexDirection: 'column' }}
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

            {editingRound && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', padding: '0 1.25rem', gap: '2rem', flexShrink: 0 }}>
                <button type="button" onClick={() => setActiveTab('config')} style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'config' ? '2px solid var(--color-primary)' : '2px solid transparent', padding: '1rem 0', color: activeTab === 'config' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: activeTab === 'config' ? 600 : 500, cursor: 'pointer' }}>Cấu hình chung</button>
                <button type="button" onClick={() => setActiveTab('reports')} style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'reports' ? '2px solid var(--color-danger)' : '2px solid transparent', padding: '1rem 0', color: activeTab === 'reports' ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: activeTab === 'reports' ? 600 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Data Lỗi & Đền Bù
                  {reports.filter(r => r.status === 'pending').length > 0 && (
                    <span style={{ background: 'var(--color-danger)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10 }}>{reports.filter(r => r.status === 'pending').length}</span>
                  )}
                </button>
              </div>
            )}

            {activeTab === 'config' ? (
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'visible' }}>
                <div className="responsive-grid-1-1" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flex: 1, overflow: 'visible', minHeight: 0 }}>

                  {/* LEFT COLUMN */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
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
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14} /> Trạng thái Vòng</label>
                      <div style={{ marginTop: 8 }}>
                        <ToggleSwitch
                          checked={formData.is_active === 1}
                          onChange={(checked) => setFormData({ ...formData, is_active: checked ? 1 : 0 })}
                        />
                      </div>
                    </div>

                    {formData.selected_users.length > 0 && (
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14} /> Chọn Sale bắt đầu / kế tiếp (Tuỳ chọn)</label>
                        <div ref={startSaleDropdownRef} style={{ position: 'relative' }}>
                          <div
                            className="form-input"
                            onClick={() => setShowStartSaleDropdown(!showStartSaleDropdown)}
                            style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}
                          >
                            {formData.starting_consultant_id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {(() => {
                                  const c = consultants.find(x => Number(x.id) === formData.starting_consultant_id);
                                  if (!c) return '-- Mặc định (Theo thứ tự thêm vào) --';
                                  const initials = c.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                                  return (
                                    <>
                                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: getColorForName(c.name), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                                        {initials}
                                      </div>
                                      <span style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--color-text)' }}>{c.name}</span>
                                    </>
                                  )
                                })()}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>-- Mặc định (Theo thứ tự thêm vào) --</span>
                            )}
                            <span style={{ transform: showStartSaleDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--color-text-muted)', display: 'inline-block', fontSize: '0.75rem' }}>▼</span>
                          </div>

                          {showStartSaleDropdown && (
                            <div style={{
                              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
                              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', maxHeight: 150, overflowY: 'auto'
                            }}>
                              <div
                                onClick={() => { setFormData({ ...formData, starting_consultant_id: null }); setShowStartSaleDropdown(false); }}
                                style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', fontSize: '0.875rem', background: formData.starting_consultant_id === null ? 'var(--color-bg)' : 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                                onMouseLeave={e => e.currentTarget.style.background = formData.starting_consultant_id === null ? 'var(--color-bg)' : 'transparent'}
                              >
                                -- Mặc định (Theo thứ tự thêm vào) --
                              </div>
                              {formData.selected_users.map(id => {
                                const c = consultants.find(x => Number(x.id) === Number(id));
                                if (!c) return null;
                                const isSelected = formData.starting_consultant_id === id;
                                const initials = c.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                                return (
                                  <div
                                    key={id}
                                    onClick={() => { setFormData({ ...formData, starting_consultant_id: id }); setShowStartSaleDropdown(false); }}
                                    style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', background: isSelected ? 'var(--color-primary-light)' : 'transparent', transition: 'background 0.1s' }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg)'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                  >
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: getColorForName(c.name), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                                      {initials}
                                    </div>
                                    <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                                      {c.name}
                                    </div>
                                    {isSelected && <Check size={14} color="var(--color-primary)" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Người được chọn sẽ là người nhận Data tiếp theo của vòng này.
                        </p>
                      </div>
                    )}

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                          <Zap size={14} color="var(--color-primary)" /> Đặt làm Vòng phân bổ mặc định (Fallback)
                        </label>
                        <div
                          className={`custom-toggle ${formData.is_fallback ? 'active' : ''}`}
                          onClick={() => setFormData({ ...formData, is_fallback: !formData.is_fallback })}
                        />
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        Nếu dữ liệu mới không khớp bất kỳ quy luật chia nào, hệ thống sẽ tự động phân phối vào vòng này. Chỉ có duy nhất 1 vòng được đặt làm mặc định.
                      </p>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: 0, flex: 1 }}>
                    {/* Custom Multi-Select with Avatars */}
                    <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> Chọn Tư vấn viên vào vòng này</label>

                      {/* Search Input Box */}
                      <div style={{ position: 'relative' }}>
                        <input
                          className="form-input"
                          style={{ paddingLeft: '2.5rem', background: '#f8fafc', border: '1px solid #cbd5e1' }}
                          placeholder="Tìm kiếm và chọn Tư vấn viên..."
                          value={searchUser}
                          onChange={e => setSearchUser(e.target.value)}
                          onFocus={() => setShowDropdown(true)}
                        />
                        <div style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }}><Search size={16} /></div>
                      </div>

                      {/* Dropdown Options */}
                      {showDropdown && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', maxHeight: 220, overflowY: 'auto'
                        }}>
                          {consultants.filter(c => c.name.toLowerCase().includes(searchUser.toLowerCase())).map(user => {
                            const isSelected = formData.selected_users.includes(Number(user.id));
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
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg)'; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: getColorForName(user.name), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
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

                    {/* Selected Consultants List Block */}
                    {formData.selected_users.length > 0 && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }} className="custom-scrollbar">
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Tư vấn viên đã chọn ({formData.selected_users.length}):</div>
                        {formData.selected_users.map(userId => {
                          const user = consultants.find(c => Number(c.id) === userId);
                          if (!user) return null;
                          const initials = user.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                          return (
                            <div key={user.id} style={{
                              display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem',
                              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
                              transition: 'all 0.2s'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: getColorForName(user.name), color: 'white',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.12)'
                                }}>
                                  {initials}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center' }}>
                                    {user.name}
                                    {editingRound?.compensations?.[user.id] > 0 && (
                                      <span style={{ marginLeft: 8, padding: '2px 6px', background: 'var(--color-danger)', color: 'white', fontSize: '0.65rem', borderRadius: 10, fontWeight: 700 }}>
                                        Nợ bù: {editingRound.compensations[user.id]}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{user.email}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => removeUser(user.id, e)}
                                  style={{
                                    color: 'var(--color-text-muted)', padding: 4, borderRadius: 6,
                                    border: 'none', background: 'transparent', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'var(--color-danger-light)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {/* Special Rule: Ratio + Data Per Turn */}
                              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                {/* Row 1: Data per turn */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Nhận</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={formData.data_per_turns[user.id] || 1}
                                    onChange={e => setFormData({ ...formData, data_per_turns: { ...formData.data_per_turns, [user.id]: Math.max(1, parseInt(e.target.value) || 1) } })}
                                    style={{ width: 44, border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', outline: 'none', color: '#059669', fontWeight: 700, background: '#ecfdf5' }}
                                  />
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Data liên tiếp mỗi lượt, sau mỗi</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={formData.ratios[user.id] || 1}
                                    onChange={e => setFormData({ ...formData, ratios: { ...formData.ratios, [user.id]: Math.max(1, parseInt(e.target.value) || 1) } })}
                                    style={{ width: 44, border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', outline: 'none', color: 'var(--color-primary)', fontWeight: 700, background: 'var(--color-bg)' }}
                                  />
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>vòng</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ padding: '1.25rem', background: '#f8fafc', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)', marginTop: 'auto' }}>
                  <button type="button" className="btn outline" onClick={() => { setModalOpen(false); setShowDropdown(false); }}>Hủy bỏ</button>
                  <button type="submit" className="btn primary" disabled={isSaving}>
                    {isSaving ? 'Đang lưu...' : (editingRound ? 'Cập nhật' : 'Thêm mới')}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                {loadingReports ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Đang tải dữ liệu báo cáo...</div>
                ) : reports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', background: '#f8fafc', borderRadius: 12 }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Chưa có báo cáo lỗi nào</p>
                    <p style={{ fontSize: '0.875rem' }}>Các BÁO CÁO DATA của vòng này sẽ xuất hiện tại đây.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {reports.map(r => {
                      const initials = r.lead_name ? r.lead_name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase() : '?';
                      return (
                        <div key={r.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.625rem 1rem',
                          border: '1px solid',
                          borderColor: r.status === 'pending' ? '#fbbf24' : '#e2e8f0',
                          borderRadius: '8px',
                          background: r.status === 'pending' ? '#fffbeb' : '#f8fafc',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                          gap: '1rem',
                          flexWrap: 'wrap'
                        }}>
                          {/* Left Details */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: getColorForName(r.lead_name), color: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                            }}>
                              {initials}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{r.lead_name}</span>
                                <span style={{ color: 'var(--color-primary)', fontWeight: 500, fontSize: '0.8125rem' }}>({r.lead_phone})</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Users size={12} />
                                <span>Sale: <strong>{r.consultant_name}</strong></span>
                              </div>
                            </div>

                            <div style={{ color: '#ef4444', fontWeight: 500, fontSize: '0.8125rem', flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid #e2e8f0', paddingLeft: '0.75rem' }}>
                              <div><span style={{ fontWeight: 600 }}>Lý do:</span> {r.reason}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} />
                                <span>Báo cáo: {new Date(r.created_at).toLocaleString('vi-VN')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Actions / Status */}
                          <div style={{ flexShrink: 0 }}>
                            {r.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleReportAction(r.id, 'approve')}
                                  disabled={isActioning === r.id}
                                  className="btn primary sm"
                                  style={{ background: '#10b981', borderColor: '#10b981', padding: '6px 12px', fontSize: '0.75rem', height: 'auto', boxShadow: 'none' }}
                                >
                                  {isActioning === r.id ? 'Đang xử lý...' : 'Duyệt & Đền Bù'}
                                </button>
                                <button
                                  onClick={() => handleReportAction(r.id, 'reject')}
                                  disabled={isActioning === r.id}
                                  className="btn outline sm"
                                  style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', padding: '6px 12px', fontSize: '0.75rem', height: 'auto', boxShadow: 'none' }}
                                >
                                  Từ chối
                                </button>
                              </div>
                            ) : (
                              <div style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: r.status === 'approved' ? '#10b981' : 'var(--color-text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: r.status === 'approved' ? '#dcfce7' : '#f1f5f9',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: r.status === 'approved' ? '1px solid #bbf7d0' : '1px solid #cbd5e1'
                              }}>
                                {r.status === 'approved' ? <><Check size={12} /> Đã duyệt đền bù</> : <><X size={12} /> Đã từ chối</>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>, document.body
      )}

      {compModalOpen && compRound && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setCompModalOpen(false)}>
          <div
            className="modal-container custom-scrollbar"
            onClick={e => e.stopPropagation()}
            style={{ width: '90%', maxWidth: '550px', background: 'white', borderRadius: 'var(--radius-2xl)', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflow: 'hidden', boxShadow: 'var(--shadow-xl)' }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={20} color="var(--color-primary)" /> Quản lý Bù Data
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Vòng: <strong>{compRound.round_name}</strong></div>
              </div>
              <button onClick={() => setCompModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: 'white' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Danh sách Tư vấn viên trong vòng</div>
                {compRound.consultant_ids ? compRound.consultant_ids.split(',').map((idStr: string) => {
                  const id = parseInt(idStr, 10);
                  const user = consultants.find(c => Number(c.id) === id);
                  if (!user) return null;
                  const initials = user.name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase();
                  const currentComp = compData[id] || 0;
                  
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: currentComp > 0 ? '#fffbeb' : '#f8fafc', border: `1px solid ${currentComp > 0 ? '#fde68a' : '#e2e8f0'}`, borderRadius: 12, transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: getColorForName(user.name), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{user.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{user.email}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                          onClick={() => setCompData({ ...compData, [id]: Math.max(0, currentComp - 1) })}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                        >
                          -
                        </button>
                        <div style={{ width: 40, textAlign: 'center', fontSize: '1rem', fontWeight: 800, color: currentComp > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                          {currentComp}
                        </div>
                        <button 
                          onClick={() => setCompData({ ...compData, [id]: currentComp + 1 })}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                    Chưa có thành viên nào trong vòng này
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.25rem', background: '#f8fafc', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn outline" onClick={() => setCompModalOpen(false)}>Hủy bỏ</button>
              <button type="button" className="btn primary" onClick={handleSaveComp} disabled={isSavingComp}>
                {isSavingComp ? 'Đang lưu...' : 'Cập nhật Bù Data'}
              </button>
            </div>
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
