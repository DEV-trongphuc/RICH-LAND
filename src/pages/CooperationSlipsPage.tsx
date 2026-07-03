import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Check, X, ShieldAlert, UserPlus, PenTool, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Trash2, Paperclip } from 'lucide-react';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';

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
  attachment_url?: string | null;
  created_at: string;
  created_by: number;
  first_name: string;
  last_name: string;
  phone: string;
  unit_code: string;
  project_name: string;
  expected_commission: number;
  expected_revenue?: number;
  actual_revenue?: number;
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

  const [expandedSlips, setExpandedSlips] = useState<Record<number, boolean>>({});

  const [period, setPeriod] = useState<Period>('30d');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRange('30d'));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSale, setFilterSale] = useState('all');
  const [changeReason, setChangeReason] = useState('');

  // Signature Modal state
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signingSlip, setSigningSlip] = useState<CooperationSlip | null>(null);

  // Custom Confirm/Prompt Modal state
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [customPrompt, setCustomPrompt] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    value: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    label: '',
    value: '',
    onConfirm: () => {}
  });

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    const first = parts[0].charAt(0).toUpperCase();
    const last = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first}${last}`;
  };
  
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDrawing = React.useRef(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a'; // dark slate/black color for signature
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    isDrawing.current = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prevent scrolling on touch devices
    if (e.cancelable) {
      e.preventDefault();
    }

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleOpenSignModal = (slip: CooperationSlip) => {
    setSigningSlip(slip);
    setIsSignModalOpen(true);
  };

  const toggleSlip = (id: number) => {
    setExpandedSlips(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const isManager = (user?.role as string) === 'admin' || (user?.role as string) === 'superadmin' || (user?.role as string) === 'manager';

  const filteredSlips = React.useMemo(() => {
    return slips.filter(slip => {
      // 1. Search Query (Customer name, phone, project, unit code)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const fullName = `${slip.last_name} ${slip.first_name}`.toLowerCase();
        const matchCust = fullName.includes(query) || (slip.phone && slip.phone.includes(query));
        const matchUnit = slip.unit_code && slip.unit_code.toLowerCase().includes(query);
        const matchProj = slip.project_name && slip.project_name.toLowerCase().includes(query);
        const matchId = String(slip.id).includes(query);
        if (!matchCust && !matchUnit && !matchProj && !matchId) return false;
      }

      // 2. Filter by Sale
      if (filterSale !== 'all') {
        const matchSale = slip.shareholders.some(sh => String(sh.user_id) === filterSale) || String(slip.created_by) === filterSale;
        if (!matchSale) return false;
      }

      // 3. Filter by Time/Date Range
      const slipDateStr = slip.created_at.slice(0, 10);
      if (slipDateStr < dateRange.from || slipDateStr > dateRange.to) {
        return false;
      }

      return true;
    });
  }, [slips, searchQuery, filterSale, dateRange]);

  const handleDeleteSlip = async (slipId: number) => {
    setCustomConfirm({
      isOpen: true,
      title: 'Xác nhận xóa phiếu',
      message: 'Bạn có chắc chắn muốn xóa phiếu hợp tác này không? Thao tác này không thể hoàn tác.',
      onConfirm: async () => {
        try {
          const res = await fetchAPI(`cooperation-slips/${slipId}`, { method: 'DELETE' });
          if (res.success) {
            setSuccess('Đã xóa phiếu hợp tác thành công!');
            loadData();
          } else {
            setError(res.message || 'Lỗi khi xóa phiếu');
          }
        } catch (e: any) {
          setError(e.message || 'Lỗi kết nối');
        }
      }
    });
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const resSlips = await fetchAPI('cooperation-slips');
      if (resSlips.success) {
        setSlips(resSlips.data || []);
      } else {
        setError(resSlips.message || 'Lỗi tải danh sách phiếu hợp tác');
      }

      const role = user?.role as string;
      const isAdminOrManager = role === 'admin' || role === 'superadmin' || role === 'super_admin' || role === 'manager';
      if (isAdminOrManager) {
        try {
          const resUsers = await fetchAPI('users');
          if (resUsers.success) {
            const sales = (resUsers.data || []).filter((u: any) => u.role === 'sales' || u.role === 'sale');
            setSalesAccounts(sales);
          }
        } catch (err) {
          console.warn('Failed to load users for configurations:', err);
        }
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
        body: JSON.stringify({ shares: sharesMap, reason: changeReason })
      });

      if (res.success) {
        setSuccess('Đã cập nhật tỷ lệ chia sẻ và gửi yêu cầu phê duyệt thành công!');
        setIsUpdateOpen(false);
        setChangeReason('');
        loadData();
      } else {
        setError(res.message || 'Lỗi cập nhật tỷ lệ');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleSignSlip = async (slipId: number, signatureImg: string) => {
    try {
      const res = await fetchAPI(`cooperation-slips/${slipId}/sign`, { 
        method: 'POST',
        body: JSON.stringify({ signature_img: signatureImg })
      });
      if (res.success) {
        setSuccess('Ký xác nhận phiếu hợp tác thành công!');
        setIsSignModalOpen(false);
        setSigningSlip(null);
        loadData();
      } else {
        setError(res.message || 'Lỗi ký xác nhận');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleApproveSlip = async (slipId: number) => {
    setCustomConfirm({
      isOpen: true,
      title: 'Xác nhận duyệt hoa hồng',
      message: 'Bạn có chắc chắn muốn phê duyệt phiếu hợp tác này không?',
      onConfirm: async () => {
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
      }
    });
  };

  const handleRejectSlip = async (slipId: number) => {
    setCustomPrompt({
      isOpen: true,
      title: 'Từ chối phiếu hợp tác',
      label: 'Nhập lý do bác bỏ phiếu hợp tác này:',
      value: '',
      onConfirm: async (reason: string) => {
        if (!reason.trim()) {
          setError('Lý do từ chối không được bỏ trống.');
          return;
        }
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
      }
    });
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

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
        {/* Search */}
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Tìm theo khách hàng, số điện thoại, căn hộ, dự án..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-light)',
              color: 'var(--color-text)',
              fontSize: '0.875rem'
            }}
          />
        </div>

        {/* Filter Time */}
        <div>
          <PeriodFilter
            value={period}
            onChange={(p, r) => {
              setPeriod(p);
              setDateRange(r);
            }}
          />
        </div>

        {/* Filter Sale (Only show if Manager/Admin) */}
        {isManager && (
          <div style={{ width: '180px' }}>
            <select
              value={filterSale}
              onChange={e => setFilterSale(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-light)',
                color: 'var(--color-text)',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tất cả nhân viên</option>
              {salesAccounts.map(u => (
                <option key={u.id} value={String(u.id)}>{u.full_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>Đang tải danh sách phiếu hợp tác...</div>
      ) : filteredSlips.length === 0 ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Không tìm thấy kết quả phù hợp</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Vui lòng thay đổi từ khóa hoặc bộ lọc để tìm lại.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredSlips.map(slip => {
            const hasSigned = slip.shareholders.find(s => s.user_id === user?.consultant_id)?.signed;
            const isShareholder = slip.shareholders.some(s => s.user_id === user?.consultant_id);
            const isExpanded = !!expandedSlips[slip.id];
            const totalComm = Number(slip.expected_commission) || Number(slip.expected_revenue) || 0;
            const totalActual = Number(slip.actual_revenue) || 0;

            return (
              <div
                key={slip.id}
                className="card animate-fade"
                style={{ 
                  padding: '1.25rem 1.5rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1.25rem',
                  cursor: 'pointer',
                  border: isExpanded ? '1px solid var(--color-primary-light)' : '1px solid var(--color-border)',
                  boxShadow: isExpanded ? '0 4px 14px rgba(0, 0, 0, 0.04)' : '0 2px 8px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.25s ease',
                  background: 'var(--color-surface)'
                }}
                onClick={() => toggleSlip(slip.id)}
              >
                {/* General Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', background: 'rgba(163, 20, 34, 0.1)', borderRadius: '10px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Phiếu hợp tác #{slip.id} | Căn: {slip.unit_code || '—'} ({slip.project_name || 'Dự án khác'})
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        Khách hàng:
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: '#3b82f6',
                          color: '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.6rem',
                          flexShrink: 0,
                          lineHeight: 1
                        }}>
                          {getInitials(`${slip.last_name} ${slip.first_name}`)}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{slip.last_name} {slip.first_name}</span>
                        • Hoa hồng dự kiến: <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{totalComm.toLocaleString()} VND</span> • Thực thu: <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{totalActual.toLocaleString()} VND</span>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={e => e.stopPropagation()}>
                    <span
                      className="badge"
                      style={{
                        background: slip.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : slip.status === 'pending_manager_approval' ? 'rgba(245, 158, 11, 0.1)' : slip.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: slip.status === 'approved' ? 'var(--color-success)' : slip.status === 'pending_manager_approval' ? 'var(--color-warning)' : slip.status === 'rejected' ? 'var(--color-danger)' : '#6366f1',
                        border: slip.status === 'approved' ? '1px solid rgba(16, 185, 129, 0.2)' : slip.status === 'pending_manager_approval' ? '1px solid rgba(245, 158, 11, 0.2)' : slip.status === 'rejected' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
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
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {(slip.created_by === user?.consultant_id || isManager) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenUpdateShares(slip); }}
                            className="btn sm outline"
                            style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem' }}
                          >
                            Cấu hình chia %
                          </button>
                        )}
                        {isShareholder && !hasSigned && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenSignModal(slip); }}
                              className="btn sm primary"
                              style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <PenTool size={12} /> Ký
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRejectSlip(slip.id); }}
                              className="btn sm outline"
                              style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            >
                              Phản ánh / Từ chối
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Request change if already approved or pending manager approval */}
                    {(slip.status === 'approved' || slip.status === 'pending_manager_approval') && 
                     (isManager || isShareholder || slip.created_by === user?.consultant_id) && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenUpdateShares(slip); }}
                          className="btn sm outline"
                          style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                        >
                          Yêu cầu thay đổi tỷ lệ
                        </button>
                      </div>
                    )}

                    {/* Manager Approval actions */}
                    {isManager && slip.status === 'pending_manager_approval' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApproveSlip(slip.id); }}
                          className="btn sm primary"
                          style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem', background: 'var(--color-success)', border: 'none' }}
                        >
                          <CheckCircle size={12} /> Duyệt
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRejectSlip(slip.id); }}
                          className="btn sm"
                          style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem', background: 'var(--color-danger)', border: 'none', color: 'white' }}
                        >
                          <X size={12} /> Bác bỏ
                        </button>
                      </div>
                    )}

                    {/* Delete button */}
                    {(isManager || (slip.created_by === user?.consultant_id && slip.status === 'pending_signatures')) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSlip(slip.id); }}
                        className="btn sm outline text-danger"
                        style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderColor: 'transparent', background: 'transparent' }}
                        title="Xóa phiếu hợp tác"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    {/* Expand/Collapse Indicator */}
                    <div style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', paddingLeft: '4px' }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border-light)', animation: 'fadeIn 0.2s ease-out' }}>
                    {/* Shareholders Distribution & Signatures */}
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: '0.825rem', marginBottom: '0.75rem', color: 'var(--color-text)' }}>Tỷ lệ phân chia &amp; Chữ ký số Sales:</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                        {slip.shareholders.map(sh => (
                          <div
                            key={sh.user_id}
                            className="card-panel"
                            style={{
                              padding: '0.75rem 1rem',
                              borderRadius: '8px',
                              background: sh.signed ? 'rgba(16, 185, 129, 0.04)' : 'var(--color-bg)',
                              border: sh.signed ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--color-border)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '0.5rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: '#e0f2fe',
                                  color: '#0284c7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  border: '1px solid #bae6fd',
                                  flexShrink: 0
                                }}>
                                  {getInitials(sh.name)}
                                </div>
                                <div>
                                  <h5 style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--color-text)' }}>{sh.name}</h5>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{sh.email}</span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-primary)' }}>
                                  {sh.percentage}%
                                </span>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 700, marginTop: '2px' }}>
                                  Dự kiến: {((totalComm * sh.percentage) / 100).toLocaleString()} VND
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 700, marginTop: '1px' }}>
                                  Thực tế: {((totalActual * sh.percentage) / 100).toLocaleString()} VND
                                </div>
                              </div>
                            </div>

                            <div style={{ paddingTop: '6px', borderTop: sh.signed ? '1px solid rgba(16, 185, 129, 0.1)' : '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
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
                            {sh.signed && (sh as any).signature_img && (
                              <div style={{ marginTop: '8px', borderTop: '1px dashed var(--color-border-light)', paddingTop: '6px', textAlign: 'center' }}>
                                <img src={(sh as any).signature_img} style={{ height: '40px', objectFit: 'contain', display: 'inline-block' }} alt="Chữ ký" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Attachment preview inside expanded card panel */}
                    {slip.attachment_url && (
                      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }} onClick={e => e.stopPropagation()}>
                        <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Paperclip size={14} /> Tài liệu đính kèm:
                        </h4>
                        {(slip.attachment_url.toLowerCase().endsWith('.png') ||
                          slip.attachment_url.toLowerCase().endsWith('.jpg') ||
                          slip.attachment_url.toLowerCase().endsWith('.jpeg') ||
                          slip.attachment_url.toLowerCase().endsWith('.webp')) ? (
                          <div style={{ display: 'inline-block', position: 'relative', cursor: 'zoom-in' }} onClick={(e) => { e.stopPropagation(); window.open(`https://open.domation.net/richland/${slip.attachment_url}`, '_blank'); }}>
                            <img 
                              src={`https://open.domation.net/richland/${slip.attachment_url}`} 
                              style={{ maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--color-border)', objectFit: 'contain' }} 
                              alt="Tài liệu hợp tác đính kèm"
                            />
                            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Click để xem kích thước lớn</div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--color-bg-light)', borderRadius: '8px', border: '1px solid var(--color-border)', width: 'fit-content' }}>
                            <FileText size={16} color="var(--color-primary)" />
                            <a 
                              href={`https://open.domation.net/richland/${slip.attachment_url}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'underline' }}
                              onClick={e => e.stopPropagation()}
                            >
                              Xem tài liệu hợp tác đính kèm
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dispute Reason */}
                    {slip.status === 'rejected' && slip.dispute_details && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '0.75rem' }}>
                        <ShieldAlert size={16} />
                        <span>Ý kiến phản hồi / Lý do từ chối: <strong>{slip.dispute_details}</strong>. Vui lòng cập nhật lại tỷ lệ chia sẻ và ký xác nhận lại.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Signature Modal */}
      {isSignModalOpen && signingSlip && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card animate-fade" style={{ maxWidth: '600px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Đọc tài liệu &amp; Ký xác nhận điện tử</h2>
              <button onClick={() => { setIsSignModalOpen(false); setSigningSlip(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>

            {/* Document Reader Area */}
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>1. Đọc tài liệu đính kèm:</h3>
              {signingSlip.attachment_url ? (
                <>
                  {(signingSlip.attachment_url.toLowerCase().endsWith('.png') ||
                    signingSlip.attachment_url.toLowerCase().endsWith('.jpg') ||
                    signingSlip.attachment_url.toLowerCase().endsWith('.jpeg') ||
                    signingSlip.attachment_url.toLowerCase().endsWith('.webp')) ? (
                    <div style={{ textAlign: 'center', background: 'var(--color-bg-light)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <img 
                        src={`https://open.domation.net/richland/${signingSlip.attachment_url}`} 
                        style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'contain' }} 
                        alt="Tài liệu hợp tác" 
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '1rem', background: 'rgba(163, 20, 34, 0.04)', borderRadius: '8px', border: '1px dashed var(--color-primary)' }}>
                      <FileText size={24} color="var(--color-primary)" />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>Tài liệu hợp tác đính kèm</p>
                        <a 
                          href={`https://open.domation.net/richland/${signingSlip.attachment_url}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                        >
                          Bấm để tải về / Xem tài liệu ở tab mới
                        </a>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                  Phiếu hợp tác này không đính kèm tệp tài liệu bổ sung. Vui lòng kiểm tra tỷ lệ phân chia bên dưới.
                </div>
              )}
            </div>

            {/* Shares info recap */}
            <div style={{ background: 'var(--color-bg-light)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}>
              <strong>Tỷ lệ phân chia: </strong>
              {signingSlip.shareholders.map((s, idx) => {
                const sComm = ((Number(signingSlip.expected_commission) || Number(signingSlip.expected_revenue) || 0) * s.percentage) / 100;
                return (
                  <span key={s.user_id}>
                    {s.name} ({s.percentage}% - {sComm.toLocaleString()} VND)
                    {idx < signingSlip.shareholders.length - 1 ? ', ' : ''}
                  </span>
                );
              })}
            </div>

            {/* Signature Area */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>2. Vẽ chữ ký của bạn lên khung dưới đây:</h3>
                <button 
                  onClick={clearCanvas} 
                  style={{ fontSize: '0.75rem', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  Xóa vẽ lại
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={560}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{
                  width: '100%',
                  height: '160px',
                  background: '#ffffff',
                  border: '2px dashed var(--color-border)',
                  borderRadius: '8px',
                  cursor: 'crosshair',
                  touchAction: 'none'
                }}
              />
            </div>

            <button
              onClick={() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                
                const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
                const isBlank = !buffer.some(color => color !== 0);
                if (isBlank) {
                  alert('Vui lòng vẽ chữ ký của bạn trước khi bấm xác nhận.');
                  return;
                }

                const signatureImg = canvas.toDataURL('image/png');
                handleSignSlip(signingSlip.id, signatureImg);
              }}
              className="btn primary w-full"
              style={{ height: '42px', fontWeight: 700 }}
            >
              Tôi đồng ý và Ký xác nhận
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {customConfirm.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card animate-fade" style={{ maxWidth: '400px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{customConfirm.title}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{customConfirm.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setCustomConfirm(prev => ({ ...prev, isOpen: false }))} 
                className="btn outline sm"
                style={{ height: '36px', padding: '0 16px' }}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => {
                  customConfirm.onConfirm();
                  setCustomConfirm(prev => ({ ...prev, isOpen: false }));
                }} 
                className="btn primary sm"
                style={{ height: '36px', padding: '0 16px', background: 'var(--color-primary)' }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Prompt Modal */}
      {customPrompt.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card animate-fade" style={{ maxWidth: '440px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{customPrompt.title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)' }}>{customPrompt.label}</label>
              <textarea
                value={customPrompt.value}
                onChange={e => setCustomPrompt(prev => ({ ...prev, value: e.target.value }))}
                placeholder="Nhập lý do tại đây..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-light)',
                  color: 'var(--color-text)',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button 
                onClick={() => setCustomPrompt(prev => ({ ...prev, isOpen: false }))} 
                className="btn outline sm"
                style={{ height: '36px', padding: '0 16px' }}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => {
                  customPrompt.onConfirm(customPrompt.value);
                  setCustomPrompt(prev => ({ ...prev, isOpen: false }));
                }} 
                className="btn primary sm"
                style={{ height: '36px', padding: '0 16px', background: 'var(--color-danger)', border: 'none', color: 'white' }}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '0.5rem' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Lý do thay đổi / Yêu cầu điều chỉnh</label>
                <textarea
                  placeholder="VD: Điều chỉnh thêm sale hỗ trợ ký hợp đồng hoặc chỉnh sửa tỷ lệ..."
                  value={changeReason}
                  onChange={e => setChangeReason(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.75rem', padding: '8px 10px', height: '60px', resize: 'vertical' }}
                  required
                />
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
