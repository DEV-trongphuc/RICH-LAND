import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, Plus, Check, X, Upload, AlertCircle, Trash2, Calendar, FileText, Ban } from 'lucide-react';

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

export default function DepositsPage() {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      if (resCont.success) setContacts(resCont.items || []);
      if (resProj.success) setProjects(resProj.data || []);
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
    const formData = new FormData();
    formData.append('file', file);

    try {
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

  const handleRejectMilestone = async (depositId: number, milestoneId: number) => {
    const reason = window.prompt('Nhập lý do từ chối UNC:');
    if (reason === null) return; // cancelled prompt

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
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <CreditCard size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Chưa có phiếu cọc nào</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Theo dõi phiếu cọc, tiến độ thanh toán căn hộ và duyệt UNC.</p>
          <button className="btn primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> Tạo phiếu cọc mới
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {deposits.map(dep => (
            <div
              key={dep.id}
              className="card animate-fade"
              style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              {/* Top Row: General info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '10px', background: 'rgba(163, 20, 34, 0.1)', borderRadius: '12px', color: 'var(--color-primary)' }}>
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>
                      Căn: <span style={{ color: 'var(--color-primary)' }}>{dep.unit_code}</span> | Dự án: {dep.project_name}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                      Khách hàng: <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{dep.last_name} {dep.first_name}</span> ({dep.phone}) • Người tạo: {dep.creator_name}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Giá bán / Hoa hồng</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {dep.price.toLocaleString()} VND / {dep.expected_commission.toLocaleString()} VND
                    </span>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: dep.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : dep.status === 'cancelled' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: dep.status === 'approved' ? 'var(--color-success)' : dep.status === 'cancelled' ? 'var(--color-danger)' : 'var(--color-warning)',
                      border: dep.status === 'approved' ? '1px solid rgba(16, 185, 129, 0.2)' : dep.status === 'cancelled' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}
                  >
                    {dep.status === 'approved' ? 'Hoàn tất cọc' : dep.status === 'cancelled' ? 'Đã bể cọc' : 'Chờ duyệt UNC'}
                  </span>
                  {dep.status !== 'cancelled' && (
                    <button
                      onClick={() => handleOpenCancel(dep.id)}
                      className="btn sm outline"
                      style={{ padding: '6px', height: '30px', color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      title="Báo hủy / Bể cọc"
                    >
                      <Ban size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Milestones Schedule */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
                {dep.milestones.map(m => (
                  <div
                    key={m.id}
                    className="card-panel"
                    style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-text-light)' }} className="line-clamp-1">{m.milestone_name}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            background: m.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : m.status === 'paid' ? 'rgba(59, 130, 246, 0.1)' : m.status === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                            color: m.status === 'approved' ? 'var(--color-success)' : m.status === 'paid' ? '#2563eb' : m.status === 'failed' ? 'var(--color-danger)' : 'var(--color-text-muted)'
                          }}
                        >
                          {m.status === 'approved' ? 'Đã duyệt' : m.status === 'paid' ? 'Chờ duyệt' : m.status === 'failed' ? 'UNC sai' : 'Chờ nộp'}
                        </span>
                      </div>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: '0.875rem', marginTop: '4px', color: 'var(--color-text)' }}>{m.expected_amount.toLocaleString()} VND</span>
                    </div>

                    {/* Actions / Attachments */}
                    <div style={{ paddingTop: '8px', borderTop: '1px solid var(--color-border-light)', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                      {m.unc_file_path ? (
                        <a
                          href={`${import.meta.env.VITE_API_URL || '/backend'}/uploads/${m.unc_file_path}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                          className="hover:underline"
                        >
                          <FileText size={12} />
                          Xem ảnh UNC
                        </a>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Chưa nộp UNC</span>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {dep.status !== 'cancelled' && m.status !== 'approved' && (
                          <label className="btn sm outline" style={{ padding: '4px 6px', height: '24px', cursor: 'pointer' }} title="Tải UNC lên">
                            <Upload size={12} />
                            <input
                              type="file"
                              className="hidden"
                              onChange={e => handleUploadUnc(e, dep.id, m.id)}
                            />
                          </label>
                        )}
                        {isAdmin && m.status === 'paid' && (
                          <>
                            <button
                              onClick={() => handleApproveMilestone(dep.id, m.id)}
                              className="btn sm"
                              style={{ padding: '4px 6px', height: '24px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: 'none' }}
                              title="Duyệt"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => handleRejectMilestone(dep.id, m.id)}
                              className="btn sm"
                              style={{ padding: '4px 6px', height: '24px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: 'none' }}
                              title="Từ chối"
                            >
                              <X size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'scaleUp 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Khởi tạo phiếu đặt cọc</h2>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Khách hàng</label>
                  <select
                    required
                    value={selectedContactId}
                    onChange={e => setSelectedContactId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Chọn khách hàng --</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.last_name} {c.first_name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Dự án</label>
                  <select
                    required
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Chọn dự án --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Mã căn hộ</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: A-12.05"
                    value={unitCode}
                    onChange={e => setUnitCode(e.target.value.toUpperCase())}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Giá bán (VND)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Hoa hồng (VND)</label>
                  <input
                    type="number"
                    value={expectedCommission}
                    onChange={e => setExpectedCommission(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Milestones config */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
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
                      style={{ fontSize: '0.75rem', padding: '6px 10px', flex: 1 }}
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
                      style={{ fontSize: '0.75rem', padding: '6px 10px', width: '130px' }}
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
        </div>
      )}

      {/* Cancel Modal */}
      {isCancelOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
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
