import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CreditCard, Plus, Check, X, Upload, AlertCircle, Trash2, Calendar, FileText, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyCard } from '../components/ui/EmptyCard';

interface Deposit {
  id: number;
  contact_id: number;
  project_id: number;
  unit_code: string;
  price: number;
  expected_commission: number;
  status: string;
  cancelled_reason: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  phone: string;
  project_name: string;
  creator_name: string;
  milestones: Milestone[];
}

interface Milestone {
  id: number;
  deposit_id: number;
  milestone_name: string;
  expected_amount: number;
  unc_file_path: string | null;
  status: 'pending' | 'paid' | 'approved' | 'failed';
  approval_date: string | null;
}

interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
}

interface Project {
  id: number;
  name: string;
  code: string;
}

const formatMoney = (val: string | number) => {
  const num = Number(val);
  if (isNaN(num)) return '0 đ';
  return num.toLocaleString('vi-VN') + ' đ';
};

export default function DepositsPage() {
  const { user } = useAuth();
  const { showConfirm } = useUIStore();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const paginatedDeposits = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return deposits.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [deposits, currentPage]);

  const totalPages = Math.ceil(deposits.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [deposits.length]);

  // Creation State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [price, setPrice] = useState('');
  const [expectedCommission, setExpectedCommission] = useState('');
  const [milestonesInput, setMilestonesInput] = useState<{ name: string; amount: string }[]>([
    { name: 'Đợt 1 - Cọc giữ chỗ', amount: '' }
  ]);

  // Cancel Deposit State
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelDepositId, setCancelDepositId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const isAdmin = (user?.role as string) === 'admin' || (user?.role as string) === 'superadmin' || (user?.role as string) === 'assistant';

  const loadData = async () => {
    setLoading(true);
    try {
      const [resDep, resCont, resProj] = await Promise.all([
        fetchAPI('deposits'),
        fetchAPI('contacts'),
        fetchAPI('projects')
      ]);

      if (resDep.success) setDeposits(resDep.data || []);
      if (resCont.success) {
        const allContacts = resCont.items || [];
        const filteredContacts = (user?.role === 'sale') 
          ? allContacts.filter((c: any) => String(c.owner_id) === String(user.id))
          : allContacts;
        setContacts(filteredContacts);
      }
      if (resProj.success) {
        setProjects(resProj.data || []);
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMilestoneInput = () => {
    setMilestonesInput(prev => [...prev, { name: `Đợt ${prev.length + 1}`, amount: '' }]);
  };

  const handleRemoveMilestoneInput = (index: number) => {
    setMilestonesInput(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !selectedProjectId || !unitCode || !price) {
      setError('Vui lòng điền đầy đủ thông tin khách hàng, dự án, căn hộ, giá bán');
      return;
    }

    // Verify milestones total sum
    const totalM = milestonesInput.reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
    if (Math.abs(totalM - parseFloat(price)) > 1) {
      setError(`Tổng tiền các đợt (${totalM.toLocaleString()} VND) phải bằng đúng Giá bán (${parseFloat(price).toLocaleString()} VND)`);
      return;
    }

    try {
      const res = await fetchAPI('deposits', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: selectedContactId,
          project_id: selectedProjectId,
          unit_code: unitCode,
          price: parseFloat(price),
          expected_commission: parseFloat(expectedCommission) || 0,
          milestones: milestonesInput
        })
      });

      if (res.success) {
        setSuccess('Tạo phiếu cọc và lịch thanh toán thành công!');
        setIsCreateOpen(false);
        // Reset Form
        setSelectedContactId('');
        setSelectedProjectId('');
        setUnitCode('');
        setPrice('');
        setExpectedCommission('');
        setMilestonesInput([{ name: 'Đợt 1 - Cọc giữ chỗ', amount: '' }]);
        loadData();
      } else {
        setError(res.message || 'Lỗi tạo phiếu cọc');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleUploadUnc = async (e: React.ChangeEvent<HTMLInputElement>, depositId: number, milestoneId: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      const compressedFile = await compressToWebP(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
      const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=deposits/${depositId}/milestones/${milestoneId}/unc&token=${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Auth-Token': token
        },
        body: formData
      });

      const res = await response.json();
      if (res.success) {
        setSuccess('Tải ảnh UNC thành công, vui lòng chờ Admin duyệt');
        loadData();
      } else {
        setError(res.message || 'Lỗi tải UNC');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleApproveMilestone = async (depositId: number, milestoneId: number) => {
    try {
      const res = await fetchAPI(`deposits/${depositId}/milestones/${milestoneId}/approve`, { method: 'POST' });
      if (res.success) {
        setSuccess('Phê duyệt đợt tiền thành công!');
        loadData();
      } else {
        setError(res.message || 'Lỗi phê duyệt');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleRejectMilestone = (depositId: number, milestoneId: number) => {
    showConfirm({
      title: 'Từ chối UNC',
      message: 'Vui lòng nhập lý do từ chối bản xác nhận thanh toán này:',
      confirmText: 'Từ chối UNC',
      cancelText: 'Hủy',
      isDanger: true,
      requirePromptInput: true,
      promptPlaceholder: 'Nhập lý do từ chối (bắt buộc)...',
      onConfirm: async (reason) => {
        try {
          const res = await fetchAPI(`deposits/${depositId}/milestones/${milestoneId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'UNC không hợp lệ' })
          });
          if (res.success) {
            setSuccess('Đã từ chối UNC thành công');
            loadData();
          } else {
            setError(res.message || 'Lỗi xử lý');
          }
        } catch (e: any) {
          setError(e.message || 'Lỗi kết nối');
        }
      }
    });
  };

  const handleOpenCancel = (depositId: number) => {
    setCancelDepositId(depositId);
    setCancelReason('');
    setIsCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelDepositId || !cancelReason) return;

    try {
      const res = await fetchAPI(`deposits/${cancelDepositId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason })
      });

      if (res.success) {
        setSuccess('Đã báo cáo bể cọc thành công');
        setIsCancelOpen(false);
        loadData();
      } else {
        setError(res.message || 'Lỗi báo hủy');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  return (
    <div className="page-container anim-fade-up" style={{ color: 'var(--color-text)' }}>
      {/* Notifications */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', borderRadius: '8px' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--color-success)', borderRadius: '8px' }}>
          <Check size={20} />
          <span>{success}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản Lý Đặt Cọc &amp; Tiến Độ</h1>
          <p className="page-subtitle">Theo dõi phiếu cọc, tiến độ thanh toán căn hộ và duyệt UNC</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn primary"
          style={{ height: '38px' }}
        >
          <Plus size={16} />
          Tạo phiếu cọc mới
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>Đang tải danh sách đặt cọc...</div>
      ) : deposits.length === 0 ? (
        <EmptyCard
          icon={<CreditCard />}
          title="Chưa có phiếu cọc nào"
          description="Theo dõi phiếu cọc, tiến độ thanh toán căn hộ và duyệt UNC."
          actionText="Tạo phiếu cọc mới"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="card" style={{ padding: 0, borderRadius: '16px', border: '1px solid var(--color-border-light)', overflow: 'hidden', background: 'var(--color-surface)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
          <div className="table-wrap" style={{ maxHeight: '480px', overflowY: 'auto' }}>
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '110px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Căn hộ</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Dự án & Khách hàng</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '220px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Giá trị / Hoa hồng</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '130px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Trạng thái</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '240px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Tiến độ đợt tiền</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '240px', textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDeposits.map(dep => {
                  let statusText = 'Đang giao dịch';
                  let statusBg = 'rgba(245, 158, 11, 0.08)';
                  let statusColor = '#d97706';

                  if (dep.status === 'approved') {
                    statusText = 'Hoàn tất cọc';
                    statusBg = 'rgba(16, 185, 129, 0.08)';
                    statusColor = '#059669';
                  } else if (dep.status === 'cancelled') {
                    statusText = 'Đã bể cọc';
                    statusBg = 'rgba(239, 68, 68, 0.08)';
                    statusColor = '#dc2626';
                  }

                  return (
                    <tr 
                      key={dep.id} 
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s' }}
                      className="table-row-hover"
                    >
                      {/* Unit code */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        <span style={{ 
                          padding: '5px 9px', 
                          background: 'rgba(189, 29, 45, 0.06)', 
                          color: 'var(--color-primary)', 
                          borderRadius: '8px', 
                          fontWeight: 800, 
                          fontSize: '0.8rem',
                          display: 'inline-block'
                        }}>
                          {dep.unit_code}
                        </span>
                      </td>

                      {/* Project & Client */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{dep.project_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          Khách: <strong style={{ color: 'var(--color-text)' }}>{dep.last_name} {dep.first_name}</strong> ({dep.phone})
                        </div>
                      </td>

                      {/* Value / Commission */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>
                          {formatMoney(dep.price)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '2px', fontWeight: 600 }}>
                          HH: {formatMoney(dep.expected_commission)}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span
                          style={{
                            background: statusBg,
                            color: statusColor,
                            border: `1px solid ${statusColor}18`,
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {statusText}
                        </span>
                      </td>

                      {/* Milestones steps */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {dep.milestones.map((m, idx) => {
                            let dotColor = '#6b7280';
                            let tooltipText = `${m.milestone_name}: Chờ nộp UNC (${formatMoney(m.expected_amount)})`;
                            if (m.status === 'approved') {
                              dotColor = '#10b981';
                              tooltipText = `${m.milestone_name}: Đã duyệt (${formatMoney(m.expected_amount)})`;
                            } else if (m.status === 'paid') {
                              dotColor = '#2563eb';
                              tooltipText = `${m.milestone_name}: Chờ duyệt UNC (${formatMoney(m.expected_amount)})`;
                            } else if (m.status === 'failed') {
                              dotColor = '#ef4444';
                              tooltipText = `${m.milestone_name}: UNC sai (${formatMoney(m.expected_amount)})`;
                            }

                            return (
                              <div 
                                key={m.id}
                                style={{ 
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  background: `${dotColor}08`,
                                  border: `1px solid ${dotColor}15`,
                                  fontSize: '0.675rem',
                                  fontWeight: 600,
                                  color: dotColor
                                }}
                                title={tooltipText}
                              >
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor }} />
                                <span>Đ{idx + 1}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {dep.milestones.map((m, idx) => {
                            if (m.status === 'approved') return null;

                            return (
                              <div key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {/* Upload button */}
                                {dep.status !== 'cancelled' && (
                                  <label
                                    className="btn sm"
                                    style={{
                                      padding: '2px 6px',
                                      height: '24px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontSize: '0.675rem',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      background: 'transparent',
                                      border: '1px solid rgba(189, 29, 45, 0.25)',
                                      color: 'var(--color-primary)'
                                    }}
                                    title={`Tải UNC Đợt ${idx + 1}`}
                                  >
                                    <Upload size={11} />
                                    <span>Tải UNC Đ{idx + 1}</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      onChange={e => handleUploadUnc(e, dep.id, m.id)}
                                    />
                                  </label>
                                )}

                                {/* View UNC link if uploaded */}
                                {m.unc_file_path && (
                                  <a
                                    href={`${import.meta.env.VITE_API_URL || '/backend'}/uploads/${m.unc_file_path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn sm"
                                    style={{
                                      padding: '2px 6px',
                                      height: '24px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontSize: '0.675rem',
                                      borderRadius: '6px',
                                      background: 'rgba(59, 130, 246, 0.08)',
                                      color: '#2563eb',
                                      border: 'none',
                                      fontWeight: 600
                                    }}
                                  >
                                    <FileText size={11} />
                                    <span>Xem UNC Đ{idx + 1}</span>
                                  </a>
                                )}

                                {/* Admin approval / reject buttons */}
                                {isAdmin && m.status === 'paid' && (
                                  <div style={{ display: 'inline-flex', gap: '3px' }}>
                                    <button
                                      onClick={() => handleApproveMilestone(dep.id, m.id)}
                                      style={{
                                        padding: '0 6px',
                                        height: '24px',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        fontSize: '0.675rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Check size={11} />
                                      Duyệt Đ{idx + 1}
                                    </button>
                                    <button
                                      onClick={() => handleRejectMilestone(dep.id, m.id)}
                                      style={{
                                        padding: '0 6px',
                                        height: '24px',
                                        background: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        fontSize: '0.675rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <X size={11} />
                                      Hủy Đ{idx + 1}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Cancellation Button */}
                          {dep.status !== 'cancelled' && (
                            <button
                              onClick={() => handleOpenCancel(dep.id)}
                              style={{
                                padding: '2px 6px',
                                height: '24px',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'transparent',
                                fontSize: '0.675rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Báo bể cọc"
                            >
                              <Ban size={11} />
                              <span>Bể cọc</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ 
              padding: '1rem 1.25rem', 
              borderTop: '1px solid var(--color-border-light)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              background: 'var(--color-surface)',
              borderBottomLeftRadius: '16px',
              borderBottomRightRadius: '16px'
            }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Hiển thị <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, deposits.length)}</span> trên <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{deposits.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                  disabled={currentPage === 1} 
                  className="btn sm outline" 
                  style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(() => {
                    const maxVisible = 5;
                    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                    let end = Math.min(totalPages, start + maxVisible - 1);
                    if (end - start + 1 < maxVisible) {
                      start = Math.max(1, end - maxVisible + 1);
                    }
                    const pageNumbers = [];
                    for (let p = start; p <= end; p++) {
                      pageNumbers.push(p);
                    }
                    return pageNumbers.map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          width: 32, height: 32, borderRadius: 8, fontSize: '0.8125rem', fontWeight: 700,
                          border: currentPage === pageNum ? 'none' : '1px solid var(--color-border-light)',
                          background: currentPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: currentPage === pageNum ? 'white' : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        className={currentPage === pageNum ? '' : 'hover-lift'}
                      >
                        {pageNum}
                      </button>
                    ));
                  })()}
                </div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                  disabled={currentPage === totalPages} 
                  className="btn sm outline" 
                  style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <CustomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Khởi tạo phiếu đặt cọc"
        width="620px"
      >
        <div style={{ padding: '0.5rem 0' }}>
          <form onSubmit={handleCreateDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Khách hàng</label>
                <CustomSelect
                  options={contacts.map(c => ({
                    value: String(c.id),
                    label: `${c.last_name} ${c.first_name} (${c.phone})`
                  }))}
                  value={selectedContactId}
                  onChange={val => setSelectedContactId(val.toString())}
                  placeholder="-- Chọn khách hàng --"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Dự án</label>
                <CustomSelect
                  options={projects.map(p => ({
                    value: String(p.id),
                    label: p.name
                  }))}
                  value={selectedProjectId}
                  onChange={val => setSelectedProjectId(val.toString())}
                  placeholder="-- Chọn dự án --"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Mã căn hộ</label>
                <input
                  type="text"
                  required
                  placeholder="VD: A-12.05"
                  value={unitCode}
                  onChange={e => setUnitCode(e.target.value.toUpperCase())}
                  className="form-input"
                  style={{ height: '38px', padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Giá bán (VND)</label>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="form-input"
                  style={{ height: '38px', padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Hoa hồng (VND)</label>
                <input
                  type="number"
                  value={expectedCommission}
                  onChange={e => setExpectedCommission(e.target.value)}
                  className="form-input"
                  style={{ height: '38px', padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Milestones config */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Lịch trình thanh toán</h4>
                <button
                  type="button"
                  onClick={handleAddMilestoneInput}
                  style={{ fontSize: '0.75rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                  className="hover:underline"
                >
                  <Plus size={14} /> Thêm đợt tiền
                </button>
              </div>

              {milestonesInput.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    required
                    placeholder={`Tên đợt ${idx + 1}`}
                    value={m.name}
                    onChange={e =>
                      setMilestonesInput(prev =>
                        prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                      )
                    }
                    className="form-input"
                    style={{ height: '38px', padding: '8px 12px', fontSize: '0.85rem', flex: 1 }}
                  />
                  <input
                    type="number"
                    required
                    placeholder="Số tiền (VND)"
                    value={m.amount}
                    onChange={e =>
                      setMilestonesInput(prev =>
                        prev.map((item, i) => (i === idx ? { ...item, amount: e.target.value } : item))
                      )
                    }
                    className="form-input"
                    style={{ height: '38px', padding: '8px 12px', fontSize: '0.85rem', width: '150px' }}
                  />
                  {milestonesInput.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMilestoneInput(idx)}
                      style={{ padding: '6px', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="btn primary w-full"
              style={{ height: '38px', marginTop: '0.5rem' }}
            >
              Tạo phiếu đặt cọc
            </button>
          </form>
        </div>
      </CustomModal>

      {/* Cancel Modal */}
      {isCancelOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'scaleUp 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-danger)' }}>Báo cáo bể cọc / Hủy mua</h2>
              <button onClick={() => setIsCancelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                <strong>Lưu ý:</strong> Nếu chưa được duyệt bất kỳ đợt thanh toán nào, hệ thống sẽ tự động hạ 1 mức nhiệt của KHTN (decay) và chuyển trạng thái về Booking.
              </p>
              <div>
                <label className="form-label">Lý do hủy cọc</label>
                <textarea
                  required
                  placeholder="Nhập lý do chi tiết..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="form-input"
                  style={{ height: '96px', resize: 'none' }}
                />
              </div>
              <button
                onClick={handleConfirmCancel}
                className="btn primary w-full"
                style={{ height: '38px', backgroundColor: 'var(--color-danger)', border: 'none' }}
              >
                Xác nhận bể cọc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
