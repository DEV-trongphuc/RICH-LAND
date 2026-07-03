import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Check, X, ShieldAlert, UserPlus, PenTool, CheckCircle, AlertCircle } from 'lucide-react';

interface CooperationSlip {
  id: number;
  contact_id: number;
  deposit_slip_id: number;
  version: number;
  total_percentage: number;
  shares_json: string;
  signatures_json: string;
  status: 'pending_signatures' | 'pending_manager_approval' | 'approved' | 'rejected' | 'disputed';
  dispute_details: string | null;
  created_at: string;
  created_by: number;
  first_name: string;
  last_name: string;
  phone: string;
  unit_code: string;
  project_name: string;
  expected_commission: number;
  shareholders: Shareholder[];
}

interface Shareholder {
  user_id: number;
  name: string;
  email: string;
  percentage: number;
  signed: boolean;
  signature_time: string | null;
  signature_ip: string | null;
}

interface SalesAccount {
  id: number;
  full_name: string;
  email: string;
}

export default function CooperationSlipsPage() {
  const { user } = useAuth();
  const [slips, setSlips] = useState<CooperationSlip[]>([]);
  const [salesAccounts, setSalesAccounts] = useState<SalesAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Update Shares State
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState<number | null>(null);
  const [sharesInput, setSharesInput] = useState<{ user_id: string; percentage: string }[]>([]);

  const isManager = (user?.role as string) === 'admin' || (user?.role as string) === 'superadmin' || (user?.role as string) === 'manager';

  const loadData = async () => {
    setLoading(true);
    try {
      const [resSlips, resUsers] = await Promise.all([
        fetchAPI('cooperation-slips'),
        fetchAPI('users')
      ]);

      if (resSlips.success) setSlips(resSlips.data || []);
      if (resUsers.success) {
        // Only keep sales accounts
        const sales = (resUsers.data || []).filter((u: any) => u.role === 'sales' || u.role === 'sale');
        setSalesAccounts(sales);
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

  const handleOpenUpdateShares = (slip: CooperationSlip) => {
    setSelectedSlipId(slip.id);
    const initialShares = slip.shareholders.map(s => ({
      user_id: String(s.user_id),
      percentage: String(s.percentage)
    }));
    setSharesInput(initialShares);
    setIsUpdateOpen(true);
  };

  const handleAddShareholderInput = () => {
    setSharesInput(prev => [...prev, { user_id: '', percentage: '0' }]);
  };

  const handleRemoveShareholderInput = (index: number) => {
    setSharesInput(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveShares = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlipId) return;

    // Build shares map
    const sharesMap: Record<string, number> = {};
    let sum = 0;
    for (const item of sharesInput) {
      if (!item.user_id || !item.percentage) {
        setError('Vui lòng chọn nhân viên và nhập đầy đủ tỷ lệ');
        return;
      }
      if (sharesMap[item.user_id]) {
        setError('Nhân viên không được bị trùng lặp trong phiếu chia');
        return;
      }
      const val = parseInt(item.percentage) || 0;
      sharesMap[item.user_id] = val;
      sum += val;
    }

    if (sum !== 100) {
      setError(`Tổng tỷ lệ hoa hồng phải bằng đúng 100% (Hiện tại là ${sum}%)`);
      return;
    }

    try {
      const res = await fetchAPI(`cooperation-slips/${selectedSlipId}/shares`, {
        method: 'PUT',
        body: JSON.stringify({ shares: sharesMap })
      });

      if (res.success) {
        setSuccess('Đã cập nhật tỷ lệ chia sẻ và reset chữ ký thành công!');
        setIsUpdateOpen(false);
        loadData();
      } else {
        setError(res.message || 'Lỗi cập nhật tỷ lệ');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleSignSlip = async (slipId: number) => {
    try {
      const res = await fetchAPI(`cooperation-slips/${slipId}/sign`, { method: 'POST' });
      if (res.success) {
        setSuccess('Ký xác nhận phiếu hợp tác thành công!');
        loadData();
      } else {
        setError(res.message || 'Lỗi ký xác nhận');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleApproveSlip = async (slipId: number) => {
    try {
      const res = await fetchAPI(`cooperation-slips/${slipId}/approve`, { method: 'POST' });
      if (res.success) {
        setSuccess('Phê duyệt phiếu hoa hồng thành công!');
        loadData();
      } else {
        setError(res.message || 'Lỗi phê duyệt');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleRejectSlip = async (slipId: number) => {
    const reason = window.prompt('Nhập lý do từ chối phiếu hợp tác:');
    if (reason === null) return;

    try {
      const res = await fetchAPI(`cooperation-slips/${slipId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      if (res.success) {
        setSuccess('Đã từ chối phiếu hợp tác và yêu cầu ký lại');
        loadData();
      } else {
        setError(res.message || 'Lỗi từ chối');
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
          <h1 className="page-title">Phiếu Hợp Tác &amp; Chữ Ký Số</h1>
          <p className="page-subtitle">Xác nhận tỷ lệ chia sẻ hoa hồng dự án giữa các Sales hỗ trợ và ký số điện tử</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>Đang tải danh sách phiếu hợp tác...</div>
      ) : slips.length === 0 ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Chưa phát sinh phiếu hợp tác</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Các phiếu phân chia hoa hồng tự động sinh ra khi tạo giao dịch đặt cọc thành công.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {slips.map(slip => {
            const hasSigned = slip.shareholders.find(s => s.user_id === user?.consultant_id)?.signed;
            const isShareholder = slip.shareholders.some(s => s.user_id === user?.consultant_id);

            return (
              <div
                key={slip.id}
                className="card animate-fade"
                style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
              >
                {/* General Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '10px', background: 'rgba(163, 20, 34, 0.1)', borderRadius: '12px', color: 'var(--color-primary)' }}>
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>
                        Phiếu hợp tác #{slip.id} | Căn: {slip.unit_code} ({slip.project_name})
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                        Khách hàng: <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{slip.last_name} {slip.first_name}</span> • Hoa hồng dự kiến: <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{(Number(slip.expected_commission) || 0).toLocaleString()} VND</span>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      className="badge"
                      style={{
                        background: slip.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : slip.status === 'pending_manager_approval' ? 'rgba(59, 130, 246, 0.1)' : slip.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: slip.status === 'approved' ? 'var(--color-success)' : slip.status === 'pending_manager_approval' ? '#2563eb' : slip.status === 'rejected' ? 'var(--color-danger)' : 'var(--color-warning)',
                        border: slip.status === 'approved' ? '1px solid rgba(16, 185, 129, 0.2)' : slip.status === 'pending_manager_approval' ? '1px solid rgba(59, 130, 246, 0.2)' : slip.status === 'rejected' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}
                    >
                      {slip.status === 'approved'
                        ? 'Đã duyệt hoa hồng'
                        : slip.status === 'pending_manager_approval'
                        ? 'Chờ sếp duyệt'
                        : slip.status === 'rejected'
                        ? 'Bị từ chối'
                        : 'Chờ Sales ký'}
                    </span>
                    
                    {/* Sign / Update buttons */}
                    {slip.status === 'pending_signatures' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(slip.created_by === user?.consultant_id || isManager) && (
                          <button
                            onClick={() => handleOpenUpdateShares(slip)}
                            className="btn sm outline"
                            style={{ height: '30px' }}
                          >
                            Cấu hình chia %
                          </button>
                        )}
                        {isShareholder && !hasSigned && (
                          <button
                            onClick={() => handleSignSlip(slip.id)}
                            className="btn sm primary"
                            style={{ height: '30px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <PenTool size={12} />
                            Ký xác nhận
                          </button>
                        )}
                      </div>
                    )}

                    {/* Manager Approval actions */}
                    {isManager && slip.status === 'pending_manager_approval' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleApproveSlip(slip.id)}
                          className="btn sm primary"
                          style={{ height: '30px', background: 'var(--color-success)', border: 'none' }}
                        >
                          <CheckCircle size={12} /> Duyệt hoa hồng
                        </button>
                        <button
                          onClick={() => handleRejectSlip(slip.id)}
                          className="btn sm"
                          style={{ height: '30px', background: 'var(--color-danger)', border: 'none', color: 'white' }}
                        >
                          <X size={12} /> Bác bỏ
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shareholders Distribution & Signatures */}
                <div>
                  <h4 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--color-text)' }}>Tỷ lệ phân chia &amp; Chữ ký số Sales:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    {slip.shareholders.map(sh => (
                      <div
                        key={sh.user_id}
                        className="card-panel"
                        style={{
                          padding: '1rem',
                          borderRadius: '8px',
                          background: sh.signed ? 'rgba(16, 185, 129, 0.04)' : 'var(--color-bg)',
                          border: sh.signed ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--color-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <h5 style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{sh.name}</h5>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{sh.email}</span>
                          </div>
                          <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--color-primary)' }}>
                            {sh.percentage}%
                          </span>
                        </div>

                        <div style={{ paddingTop: '8px', borderTop: sh.signed ? '1px solid rgba(16, 185, 129, 0.1)' : '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: sh.signed ? 'var(--color-success)' : 'var(--color-warning)'
                            }}
                          >
                            {sh.signed ? '✓ Đã ký xác nhận' : '⚡ Chờ ký'}
                          </span>
                          {sh.signed && (
                            <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                              IP: {sh.signature_ip}<br />
                              Lúc: {sh.signature_time ? new Date(sh.signature_time).toLocaleString() : '—'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dispute Reason */}
                {slip.status === 'rejected' && slip.dispute_details && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '0.75rem' }}>
                    <ShieldAlert size={16} />
                    <span>Lý do sếp bác bỏ: <strong>{slip.dispute_details}</strong>. Vui lòng cập nhật lại tỷ lệ chia sẻ và ký xác nhận lại.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Configuration Modal */}
      {isUpdateOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'scaleUp 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Cấu hình phân chia tỷ lệ (%)</h2>
              <button onClick={() => setIsUpdateOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveShares} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
                {sharesInput.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      required
                      value={item.user_id}
                      onChange={e =>
                        setSharesInput(prev =>
                          prev.map((val, i) => (i === idx ? { ...val, user_id: e.target.value } : val))
                        )
                      }
                      className="form-input"
                      style={{ fontSize: '0.75rem', padding: '6px 10px', flex: 1 }}
                    >
                      <option value="">-- Chọn nhân viên --</option>
                      {salesAccounts.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      required
                      placeholder="%"
                      value={item.percentage}
                      onChange={e =>
                        setSharesInput(prev =>
                          prev.map((val, i) => (i === idx ? { ...val, percentage: e.target.value } : val))
                        )
                      }
                      className="form-input"
                      style={{ fontSize: '0.75rem', padding: '6px 10px', width: '80px', textAlign: 'center' }}
                    />
                    {sharesInput.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveShareholderInput(idx)}
                        style={{ padding: '6px', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={handleAddShareholderInput}
                  style={{ fontSize: '0.75rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                  className="hover:underline"
                >
                  <UserPlus size={14} /> Thêm nhân viên hỗ trợ
                </button>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                  Tổng: {sharesInput.reduce((acc, s) => acc + (parseInt(s.percentage) || 0), 0)}% / 100%
                </span>
              </div>

              <button
                type="submit"
                className="btn primary w-full"
                style={{ height: '38px', marginTop: '0.5rem' }}
              >
                Lưu và gửi chữ ký lại
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
