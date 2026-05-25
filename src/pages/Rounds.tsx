import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Edit3, Zap, X, Shield, Check, LayoutGrid, List, Trash2, Search, AlertCircle, Clock, Scale } from 'lucide-react';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { RoundCardSkeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import { useLanguage } from '../contexts/LanguageContext';

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
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  const translateReason = (reasonStr: string) => {
    if (!reasonStr) return reasonStr;
    const match = reasonStr.match(/^([^(]+)(\s*\(Ghi chú:\s*.*\))?$/);
    if (match) {
      const base = match[1].trim();
      const note = match[2] ? match[2] : '';
      if (note) {
        const noteText = note.replace(/^\s*\(Ghi chú:\s*/, '').replace(/\)\s*$/, '');
        return `${t(base)} (${t('Ghi chú')}: ${noteText})`;
      }
      return t(base);
    }
    return t(reasonStr);
  };

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

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

  const [activeTab, setActiveTab] = useState<'config' | 'reports' | 'active_logs'>('config');
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [activeLogs, setActiveLogs] = useState<any[]>([]);
  const [loadingActiveLogs, setLoadingActiveLogs] = useState(false);

  // Compensation Modal State
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [compRound, setCompRound] = useState<any>(null);
  const [compData, setCompData] = useState<Record<number, number>>({});
  const [compReasons, setCompReasons] = useState<Record<number, string>>({});
  const [isSavingComp, setIsSavingComp] = useState(false);

  const getFairnessColor = (index: number) => {
    if (index >= 90) return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' };
    if (index >= 75) return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' };
    return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)' };
  };

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
      console.error(t('Không thể tải tư vấn viên:'), e.message);
    }
  };

  const fetchRounds = async () => {
    try {
      const json = await fetchAPI('get_rounds');
      if (json.success) setRounds(json.data);
    } catch (e: any) {
      toast.error(t('Không thể tải dữ liệu: ') + e.message);
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
    setCompReasons({});
    setCompModalOpen(true);
  };

  const handleSaveComp = async () => {
    if (!compRound || isSavingComp) return;
    setIsSavingComp(true);
    try {
      const payload = {
        round_id: compRound.id,
        compensations: compData,
        reasons: compReasons
      };
      const res = await fetchAPI('update_compensations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        toast.success(t('Đã cập nhật Bù Data!'));
        fetchRounds();
        setCompModalOpen(false);
      } else {
        toast.error(res.message || t('Có lỗi xảy ra'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
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
    fetchActiveLogs(r.id);
  };

  const fetchActiveLogs = async (roundId: number) => {
    setLoadingActiveLogs(true);
    try {
      const res = await fetchAPI(`get_active_compensation_logs&round_id=${roundId}`);
      if (res.success) setActiveLogs(res.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingActiveLogs(false);
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
        toast.success(action === 'approve' ? t('Đã duyệt đền bù Data!') : t('Đã từ chối báo cáo!'));
        fetchReports(editingRound.id);
        fetchRounds(); // Refresh to get updated compensations count
      } else {
        toast.error(res.message || t('Có lỗi xảy ra'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsActioning(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.round_name) return toast.error(t("Vui lòng nhập tên vòng"));
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
        toast.success(editingRound ? t('Cập nhật thành công!') : t('Thêm mới thành công!'));
        fetchRounds();
        setModalOpen(false);
      } else {
        toast.error(json.message || t('Lỗi khi lưu'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
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
        toast.success(t('Đã xóa thành công!'));
        fetchRounds();
      } else {
        toast.error(json.message || t('Lỗi khi xóa'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
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
            {t("Vòng Phân Bổ")}
          </h1>
          <p className="page-subtitle">
            {t("Quản lý vòng xoay Round-Robin và điều phối Tư vấn viên")}
          </p>
        </div>

        <div className="mobile-flex-wrap" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--color-border-light)', padding: 4, borderRadius: 'var(--radius-md)', flexShrink: 0 }}>
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
              <LayoutGrid size={16} /> <span className="hide-on-mobile">{t("Lưới")}</span>
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
              <List size={16} /> <span className="hide-on-mobile">{t("Danh sách")}</span>
            </button>
          </div>
          <button className="btn outline" onClick={() => navigate('/fair-share')} style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Scale size={16} /> <span>{t("Đối soát")}<span className="hide-on-mobile"> {t("công bằng")}</span></span>
          </button>
          <button className="btn primary" onClick={openAddModal} style={{ flexShrink: 0 }}>
            <Plus size={18} /> <span>{t("Thêm")}<span className="hide-on-mobile"> {t("Vòng")}</span></span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="responsive-grid-auto-400" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map(i => <RoundCardSkeleton key={i} />)}
        </div>
      ) : (
        <div
          className={viewMode === 'grid' ? 'responsive-grid-auto-400' : ''}
          style={{
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
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>{t("Chưa có Vòng Phân Bổ")}</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>{t("Bắt đầu bằng cách thêm mới vòng phân bổ đầu tiên của bạn để chia số cho Sale.")}</p>
              <button className="btn primary" onClick={openAddModal}><Plus size={18} /> {t("Thêm Vòng ngay")}</button>
            </div>
          ) : rounds.map((r, idx) => {
            const consList = r.consultants ? r.consultants.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
            const consIds = r.consultant_ids ? r.consultant_ids.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
            let compensatedConsultant = null;
            for (let i = 0; i < consIds.length; i++) {
              const cId = consIds[i];
              const compCount = r.compensations ? (r.compensations[cId] || 0) : 0;
              if (compCount > 0) {
                compensatedConsultant = {
                  id: cId,
                  name: consList[i],
                  count: compCount
                };
                break;
              }
            }
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
                            <span className="badge danger" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                              {t("Mặc định")}
                            </span>
                          )}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.is_active ? 'var(--color-success)' : 'var(--color-border)', display: 'inline-block' }} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            {r.is_active ? t('Đang hoạt động') : t('Tạm dừng')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Fairness score badge */}
                    {r.fairness_index !== undefined && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/fair-share?round_id=${r.id}`);
                        }}
                        style={{ 
                          cursor: 'pointer', 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 2 
                        }}
                        title={t("Click để xem chi tiết đối soát công bằng")}
                      >
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          color: 'var(--color-text-muted)', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em' 
                        }}>
                          {t("Điểm đối soát")}
                        </span>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 4, 
                          padding: '3px 8px', 
                          borderRadius: 8, 
                          background: getFairnessColor(r.fairness_index).bg,
                          color: getFairnessColor(r.fairness_index).color,
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          border: `1px solid ${getFairnessColor(r.fairness_index).color}25`,
                          transition: 'all 0.2s ease-out'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        >
                          <Scale size={12} />
                          {r.fairness_index}%
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', margin: 0, minWidth: 95 }}>
                        {t('{count} Thành viên').replace('{count}', String(consList.length))}
                      </p>
                      {consList.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {consList.slice(0, 4).map((c: string, i: number) => {
                            const matchedCons = consultants.find(x => x.name === c);
                            return (
                              <Avatar
                                key={i}
                                src={matchedCons?.avatar}
                                name={c}
                                size={32}
                                style={{
                                  border: '2px solid var(--color-surface)',
                                  marginLeft: i === 0 ? 0 : -8,
                                  position: 'relative',
                                  zIndex: 10 - i,
                                  boxShadow: 'var(--shadow-sm)'
                                }}
                              />
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
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>{t("Chưa có")}</p>
                      )}
                    </div>

                    {compensatedConsultant ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        <div style={{ padding: '0.5rem', background: 'var(--color-warning-light)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Zap size={14} color="var(--color-warning)" style={{ fill: 'var(--color-warning)' }} />
                          <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>
                            {t('Đang bù data:')} <span style={{ fontWeight: 700 }}>{compensatedConsultant.name}</span> ({t('Còn {count} lượt').replace('{count}', String(compensatedConsultant.count))})
                          </span>
                        </div>
                        {r.next_assigned_name && (
                          <div style={{ paddingLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                              {t('Lượt xoay tiếp theo:')} <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{r.next_assigned_name}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      r.next_assigned_name && (
                        <div style={{ padding: '0.5rem', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Zap size={14} color="var(--color-primary)" />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-dark)', fontWeight: 600 }}>{t('Sale lượt tới:')} {r.next_assigned_name}</span>
                        </div>
                      )
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                    <button className="btn outline sm" onClick={() => openEditModal(r)} style={{ flex: 1, padding: '0.5rem' }}>
                      <Edit3 size={13} /> {t("Sửa")}
                    </button>
                    <button className="btn primary sm" onClick={() => openCompModal(r)} style={{ flex: 1, padding: '0.5rem' }}>
                      <Zap size={13} /> {t("Bù Data")}
                    </button>
                    <button className="btn outline sm" onClick={() => { setDeleteId(r.id); setConfirmDeleteOpen(true); }} style={{ padding: '0 0.75rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger-light)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={r.id} className="card hover-lift responsive-flex-row responsive-height-auto" style={{
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
                      <span className="badge danger" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {t("Mặc định")}
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.is_active ? 'var(--color-success)' : 'var(--color-border)', display: 'inline-block' }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      {r.is_active ? t('Đang hoạt động') : t('Tạm dừng')}
                    </span>
                  </div>
                </div>

                {/* Fairness Score Badge for List View */}
                {r.fairness_index !== undefined && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/fair-share?round_id=${r.id}`);
                    }}
                    style={{ 
                      cursor: 'pointer', 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      minWidth: 100,
                      flexShrink: 0
                    }}
                    title={t("Click để xem chi tiết đối soát công bằng")}
                  >
                    <span style={{ 
                      fontSize: '0.65rem', 
                      fontWeight: 700, 
                      color: 'var(--color-text-muted)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em' 
                    }}>
                      {t("Đối soát")}
                    </span>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 4, 
                      padding: '3px 8px', 
                      borderRadius: 8, 
                      background: getFairnessColor(r.fairness_index).bg,
                      color: getFairnessColor(r.fairness_index).color,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      border: `1px solid ${getFairnessColor(r.fairness_index).color}25`,
                      transition: 'all 0.2s ease-out'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    >
                      <Scale size={11} />
                      {r.fairness_index}%
                    </div>
                  </div>
                )}

                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginRight: '0.5rem', minWidth: 90 }}>
                      {t('{count} Thành viên').replace('{count}', String(consList.length))}
                    </p>
                    {consList.slice(0, 4).map((c: string, i: number) => {
                      const matchedCons = consultants.find(cons => cons.name === c);
                      return (
                        <Avatar
                          key={i}
                          src={matchedCons?.avatar}
                          name={c}
                          size={32}
                          style={{
                            border: '2px solid white',
                            marginLeft: i > 0 ? -12 : 0,
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        />
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

                  {compensatedConsultant ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={12} color="var(--color-warning)" style={{ fill: 'var(--color-warning)' }} />
                        <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>
                          {t('Đang bù data:')} <span style={{ fontWeight: 700 }}>{compensatedConsultant.name}</span> ({t('Còn {count} lượt').replace('{count}', String(compensatedConsultant.count))})
                        </span>
                      </div>
                      {r.next_assigned_name && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500, paddingLeft: 16 }}>
                          {t('Lượt xoay tiếp theo:')} <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{r.next_assigned_name}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    r.next_assigned_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={12} color="var(--color-primary)" />
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-primary-dark)', fontWeight: 600 }}>{t('Sale lượt tới:')} {r.next_assigned_name}</span>
                      </div>
                    )
                  )}
                </div>

                <div className="mobile-round-actions" style={{ padding: '1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => openEditModal(r)} className="btn outline" style={{ flex: 1, padding: '0.625rem' }}>
                    <Edit3 size={16} /> {t("Sửa")}
                  </button>
                  <button onClick={() => openCompModal(r)} className="btn primary" style={{ flex: 1, padding: '0.625rem' }}>
                    <Zap size={16} /> {t("Bù Data")}
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
                {editingRound ? t('Cập nhật Vòng Phân Bổ') : t('Thêm Vòng Phân Bổ mới')}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ color: 'var(--color-text-muted)', padding: 4, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={20} />
              </button>
            </div>

            {editingRound && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', padding: '0 1.25rem', gap: '2rem', flexShrink: 0 }}>
                <button type="button" onClick={() => setActiveTab('config')} style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'config' ? '2px solid var(--color-primary)' : '2px solid transparent', padding: '1rem 0', color: activeTab === 'config' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: activeTab === 'config' ? 600 : 500, cursor: 'pointer' }}>{t("Cấu hình chung")}</button>
                <button type="button" onClick={() => setActiveTab('reports')} style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'reports' ? '2px solid var(--color-danger)' : '2px solid transparent', padding: '1rem 0', color: activeTab === 'reports' ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: activeTab === 'reports' ? 600 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t("Data Lỗi & Đền Bù")}
                  {reports.filter(r => r.status === 'pending').length > 0 && (
                    <span style={{ background: 'var(--color-danger)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10 }}>{reports.filter(r => r.status === 'pending').length}</span>
                  )}
                </button>
                <button type="button" onClick={() => setActiveTab('active_logs')} style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'active_logs' ? '2px solid var(--color-primary)' : '2px solid transparent', padding: '1rem 0', color: activeTab === 'active_logs' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: activeTab === 'active_logs' ? 600 : 500, cursor: 'pointer' }}>
                  {t("Log bù chủ động")}
                </button>
              </div>
            )}

            {activeTab === 'config' ? (
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'visible' }}>
                <div className="responsive-grid-1-1 modal-form-body" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flex: 1, overflow: 'visible', minHeight: 0 }}>

                  {/* LEFT COLUMN */}
                  <div className="custom-scrollbar modal-form-col" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '4px' }}>
                    <div className="form-group">
                      <label className="form-label">{t("Tên Vòng")} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <input
                        className="form-input"
                        placeholder={t("VD: Vòng 1 — Form Đăng Ký")}
                        value={formData.round_name}
                        onChange={e => setFormData({ ...formData, round_name: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t("Email CC khi chia Data")}</label>
                      <input
                        className="form-input"
                        placeholder={t("VD: giamdoc@domation.vn, quanly@domation.vn")}
                        value={formData.cc_emails}
                        onChange={e => setFormData({ ...formData, cc_emails: e.target.value })}
                      />
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t("Phân tách các email bằng dấu phẩy (,). Các email này sẽ nhận thông báo mỗi khi có Data rơi vào vòng này.")}</p>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14} /> {t("Trạng thái Vòng")}</label>
                      <div style={{ marginTop: 8 }}>
                        <ToggleSwitch
                          checked={formData.is_active === 1}
                          onChange={(checked) => setFormData({ ...formData, is_active: checked ? 1 : 0 })}
                        />
                      </div>
                    </div>

                    {formData.selected_users.length > 0 && (
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14} /> {t("Chọn Sale bắt đầu / kế tiếp (Tuỳ chọn)")}</label>
                        <div ref={startSaleDropdownRef} style={{ position: 'relative' }}>
                          <div
                            className="form-input"
                            onClick={() => setShowStartSaleDropdown(!showStartSaleDropdown)}
                            style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg)' }}
                          >
                            {formData.starting_consultant_id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {(() => {
                                  const c = consultants.find(x => Number(x.id) === formData.starting_consultant_id);
                                  if (!c) return t('-- Mặc định (Theo thứ tự thêm vào) --');
                                  return (
                                    <>
                                      <Avatar src={c.avatar} name={c.name} size={20} />
                                      <span style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--color-text)' }}>{c.name}</span>
                                    </>
                                  )
                                })()}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('-- Mặc định (Theo thứ tự thêm vào) --')}</span>
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
                                {t('-- Mặc định (Theo thứ tự thêm vào) --')}
                              </div>
                              {formData.selected_users.map(id => {
                                const c = consultants.find(x => Number(x.id) === Number(id));
                                if (!c) return null;
                                const isSelected = formData.starting_consultant_id === id;
                                return (
                                  <div
                                    key={id}
                                    onClick={() => { setFormData({ ...formData, starting_consultant_id: id }); setShowStartSaleDropdown(false); }}
                                    style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', background: isSelected ? 'var(--color-primary-light)' : 'transparent', transition: 'background 0.1s' }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg)'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                  >
                                    <Avatar src={c.avatar} name={c.name} size={24} />
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
                          {t("Người được chọn sẽ là người nhận Data tiếp theo của vòng này.")}
                        </p>
                      </div>
                    )}

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                          <Zap size={14} color="var(--color-primary)" /> {t("Đặt làm Vòng phân bổ mặc định (Fallback)")}
                        </label>
                        <div
                          className={`custom-toggle ${formData.is_fallback ? 'active' : ''}`}
                          onClick={() => setFormData({ ...formData, is_fallback: !formData.is_fallback })}
                        />
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {t("Nếu dữ liệu mới không khớp bất kỳ quy luật chia nào, hệ thống sẽ tự động phân phối vào vòng này. Chỉ có duy nhất 1 vòng được đặt làm mặc định.")}
                      </p>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: 0, flex: 1 }}>
                    {/* Custom Multi-Select with Avatars */}
                    <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> {t("Chọn Tư vấn viên vào vòng này")}</label>

                      {/* Search Input Box */}
                      <div style={{ position: 'relative' }}>
                        <input
                          className="form-input"
                          style={{ paddingLeft: '2.5rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                          placeholder={t("Tìm kiếm và chọn Tư vấn viên...")}
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
                                <Avatar src={user.avatar} name={user.name} size={28} />
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '0.875rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>{user.name}</p>
                                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{user.email} • {user.status === 'active' ? t('Đang nhận data') : t('Không nhận data')}</p>
                                </div>
                                {isSelected && <Check size={16} color="var(--color-primary)" />}
                              </div>
                            );
                          })}
                          {consultants.filter(c => c.name.toLowerCase().includes(searchUser.toLowerCase())).length === 0 && (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                              {t("Không tìm thấy tư vấn viên nào")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Consultants List Block */}
                    {formData.selected_users.length > 0 && (
                      <div className="custom-scrollbar modal-form-selected-list" style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{t("Tư vấn viên đã chọn ({count}):").replace('{count}', String(formData.selected_users.length))}</div>
                        {formData.selected_users.map(userId => {
                          const user = consultants.find(c => Number(c.id) === userId);
                          if (!user) return null;
                          return (
                            <div key={user.id} style={{
                              display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem',
                              background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10,
                              transition: 'all 0.2s'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Avatar src={user.avatar} name={user.name} size={28} style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.12)' }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center' }}>
                                    {user.name}
                                    {editingRound?.compensations?.[user.id] > 0 && (
                                      <span className="badge danger" style={{ marginLeft: 8, fontSize: '0.65rem', padding: '2px 6px' }}>
                                        {t("Nợ bù: {count}").replace('{count}', String(editingRound.compensations[user.id]))}
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
                              <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                {/* Row 1: Data per turn */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t("Nhận")}</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={formData.data_per_turns[user.id] || 1}
                                    onChange={e => setFormData({ ...formData, data_per_turns: { ...formData.data_per_turns, [user.id]: Math.max(1, parseInt(e.target.value) || 1) } })}
                                    style={{ width: 44, border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', outline: 'none', color: theme === 'dark' ? '#34d399' : '#059669', fontWeight: 700, background: theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' }}
                                  />
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t("Data liên tiếp mỗi lượt, sau mỗi")}</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={formData.ratios[user.id] || 1}
                                    onChange={e => setFormData({ ...formData, ratios: { ...formData.ratios, [user.id]: Math.max(1, parseInt(e.target.value) || 1) } })}
                                    style={{ width: 44, border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', outline: 'none', color: 'var(--color-primary)', fontWeight: 700, background: 'var(--color-bg)' }}
                                  />
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t("vòng")}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ padding: '1.25rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)', marginTop: 'auto' }}>
                  <button type="button" className="btn outline" onClick={() => { setModalOpen(false); setShowDropdown(false); }}>{t("Hủy bỏ")}</button>
                  <button type="submit" className="btn primary" disabled={isSaving}>
                    {isSaving ? t('Đang lưu...') : (editingRound ? t('Cập nhật') : t('Thêm mới'))}
                  </button>
                </div>
              </form>
            ) : activeTab === 'reports' ? (
              <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                {loadingReports ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>{t("Đang tải dữ liệu báo cáo...")}</div>
                ) : reports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: 12 }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>{t("Chưa có báo cáo lỗi nào")}</p>
                    <p style={{ fontSize: '0.875rem' }}>{t("Các BÁO CÁO DATA của vòng này sẽ xuất hiện tại đây.")}</p>
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
                          borderColor: r.status === 'pending' ? 'var(--color-warning)' : 'var(--color-border)',
                          borderRadius: '8px',
                          background: r.status === 'pending' ? 'var(--color-warning-light)' : 'var(--color-bg)',
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
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Avatar src={r.consultant_avatar} name={r.consultant_name} size={16} />
                                <span>{t('Sale:')} <strong>{r.consultant_name}</strong></span>
                              </div>
                            </div>

                            <div style={{ color: '#ef4444', fontWeight: 500, fontSize: '0.8125rem', flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #e2e8f0', paddingLeft: '0.75rem' }}>
                              <div><span style={{ fontWeight: 600 }}>{t('Lý do:')}</span> {translateReason(r.reason)}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} />
                                <span>{t('Báo cáo:')} {new Date(r.created_at).toLocaleString('vi-VN')}</span>
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
                                  {isActioning === r.id ? t('Đang xử lý...') : t('Duyệt & Đền Bù')}
                                </button>
                                <button
                                  onClick={() => handleReportAction(r.id, 'reject')}
                                  disabled={isActioning === r.id}
                                  className="btn outline sm"
                                  style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', padding: '6px 12px', fontSize: '0.75rem', height: 'auto', boxShadow: 'none' }}
                                >
                                  {t('Từ chối')}
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <div style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: r.status === 'approved' ? (theme === 'dark' ? '#34d399' : '#10b981') : 'var(--color-text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: r.status === 'approved' ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7') : (theme === 'dark' ? 'var(--color-bg)' : '#f1f5f9'),
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: r.status === 'approved' ? (theme === 'dark' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0') : (theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #cbd5e1')
                                }}>
                                  {r.status === 'approved' ? <><Check size={12} /> {t('Đã duyệt đền bù')}</> : <><X size={12} /> {t('Đã từ chối')}</>}
                                </div>
                                {r.resolved_by && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                    <Avatar src={r.resolved_by_avatar} name={r.resolved_by} size={16} />
                                    <span>
                                      {r.resolved_by} • {(() => {
                                        const d = new Date(r.resolved_at);
                                        const pad = (n: number) => n.toString().padStart(2, '0');
                                        return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                                      })()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                {loadingActiveLogs ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>{t("Đang tải dữ liệu log...")}</div>
                ) : activeLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: 12 }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>{t("Chưa có log bù chủ động nào")}</p>
                    <p style={{ fontSize: '0.875rem' }}>{t("Lịch sử bù data thủ công của vòng này sẽ xuất hiện tại đây.")}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {activeLogs.map(log => {
                      return (
                        <div 
                          key={log.id} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 18px',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '12px',
                            background: theme === 'dark' ? 'rgba(59, 130, 246, 0.02)' : 'rgba(59, 130, 246, 0.01)',
                            boxShadow: 'var(--shadow-sm)',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border-light)';
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--color-border-light)' }}>
                              <Avatar src={log.admin_avatar} name={log.admin_name} size={20} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.8125rem' }}>{log.admin_name}</span>
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{t('đã bù')}</span>
                              <span style={{ 
                                background: 'var(--color-primary-light)', 
                                color: 'var(--color-primary)', 
                                padding: '2px 8px', 
                                borderRadius: '6px', 
                                fontWeight: 800, 
                                fontSize: '0.875rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                boxShadow: 'inset 0 0 0 1px rgba(59, 130, 246, 0.1)'
                              }}>
                                +{log.amount}
                              </span>
                              <span>{t('data cho Sale')}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--color-border-light)' }}>
                              <Avatar src={log.consultant_avatar} name={log.consultant_name} size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.8125rem' }}>{log.consultant_name}</span>
                            </div>
                            {log.reason && (
                              <div style={{ 
                                fontSize: '0.775rem', 
                                color: 'var(--color-text-muted)', 
                                borderLeft: '2px solid var(--color-border)', 
                                paddingLeft: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{t('Lý do:')}</span> 
                                <span style={{ fontStyle: 'italic' }}>{translateReason(log.reason)}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ 
                            fontSize: '0.725rem', 
                            color: 'var(--color-text-muted)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            flexShrink: 0,
                            background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border-light)'
                          }}>
                            <Clock size={11} style={{ opacity: 0.7 }} />
                            <span>{new Date(log.created_at).toLocaleString('vi-VN')}</span>
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
            style={{ width: '90%', maxWidth: '550px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflow: 'hidden', boxShadow: 'var(--shadow-xl)' }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg)' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={20} color="var(--color-primary)" /> {t("Quản lý Bù Data")}
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t("Vòng:")} <strong>{compRound.round_name}</strong></div>
              </div>
              <button onClick={() => setCompModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: 'transparent' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{t("Danh sách Tư vấn viên trong vòng")}</div>
                {compRound.consultant_ids ? compRound.consultant_ids.split(',').map((idStr: string) => {
                  const id = parseInt(idStr, 10);
                  const user = consultants.find(c => Number(c.id) === id);
                  if (!user) return null;
                  const currentComp = compData[id] || 0;
                  
                  return (
                    <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: currentComp > 0 ? 'var(--color-warning-light)' : 'var(--color-bg)', border: `1px solid ${currentComp > 0 ? 'var(--color-warning)' : 'var(--color-border)'}`, borderRadius: 12, transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar src={user.avatar} name={user.name} size={36} style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{user.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{user.email}</div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button 
                            type="button"
                            onClick={() => setCompData({ ...compData, [id]: Math.max(0, currentComp - 1) })}
                            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                          >
                            -
                          </button>
                          <div style={{ width: 40, textAlign: 'center', fontSize: '1rem', fontWeight: 800, color: currentComp > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                            {currentComp}
                          </div>
                          <button 
                            type="button"
                            onClick={() => setCompData({ ...compData, [id]: currentComp + 1 })}
                            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      {currentComp > (compRound.compensations?.[id] || 0) && (
                        <div style={{ marginTop: '0.5rem', width: '100%', animation: 'slideUp 0.15s ease-out' }}>
                          <input
                            type="text"
                            placeholder={t("Nhập lý do bù chủ động (tùy chọn)...")}
                            value={compReasons[id] || ''}
                            onChange={(e) => setCompReasons({ ...compReasons, [id]: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '0.8125rem',
                              border: '1px solid var(--color-border)',
                              borderRadius: '8px',
                              background: 'var(--color-bg)',
                              color: 'var(--color-text)',
                              outline: 'none',
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          />
                        </div>
                      )}
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
            <div style={{ padding: '1.25rem', background: theme === 'dark' ? 'var(--color-bg)' : '#f8fafc', borderTop: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn outline" onClick={() => setCompModalOpen(false)}>{t("Hủy bỏ")}</button>
              <button type="button" className="btn primary" onClick={handleSaveComp} disabled={isSavingComp}>
                {isSavingComp ? t('Đang lưu...') : t('Cập nhật Bù Data')}
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
        title={t("Cảnh báo Xóa Vòng Phân Bổ")}
        message={t("Bạn có chắc chắn muốn xóa vòng này không? Lưu ý: Việc xóa vòng phân bổ sẽ ảnh hưởng trực tiếp đến các Rule định tuyến đang trỏ đến vòng này!")}
        confirmText={t("Xóa vĩnh viễn")}
      />
    </div>
  );
};
