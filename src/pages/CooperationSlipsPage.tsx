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
        const sales = (resUsers.data || []).filter((u: any) => u.role === 'sales');
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
    <div className="container mx-auto p-6 space-y-6" style={{ color: 'var(--color-text)' }}>
      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="ml-auto" onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg">
          <Check size={20} />
          <span>{success}</span>
          <button className="ml-auto" onClick={() => setSuccess('')}><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary" style={{ color: 'var(--color-primary)' }}>
            Phiếu Hợp Tác & Chữ Ký Số
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Xác nhận tỷ lệ chia sẻ hoa hồng dự án giữa các Sales hỗ trợ và ký số điện tử
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải danh sách phiếu hợp tác...</div>
      ) : slips.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-700/50 rounded-xl text-gray-500">
          Chưa phát sinh phiếu hợp tác chia hoa hồng nào
        </div>
      ) : (
        <div className="space-y-6">
          {slips.map(slip => {
            const hasSigned = slip.shareholders.find(s => s.user_id === user?.consultant_id)?.signed;
            const isShareholder = slip.shareholders.some(s => s.user_id === user?.consultant_id);

            return (
              <div
                key={slip.id}
                className="p-6 rounded-xl border border-gray-800 bg-black/40 backdrop-blur-md shadow-2xl space-y-6"
              >
                {/* General Info */}
                <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-gray-800/60">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3.5 bg-primary/10 rounded-xl text-primary" style={{ color: 'var(--color-primary)' }}>
                      <FileText size={26} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg">
                        Phiếu hợp tác #{slip.id} | Căn: {slip.unit_code} ({slip.project_name})
                      </h3>
                      <p className="text-xs text-gray-400">
                        Khách hàng: <span className="font-bold text-gray-300">{slip.last_name} {slip.first_name}</span> • Hoa hồng dự kiến: <span className="font-bold text-emerald-500">{slip.expected_commission.toLocaleString()} VND</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                        slip.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : slip.status === 'pending_manager_approval'
                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          : slip.status === 'rejected'
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                          : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                      }`}
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
                      <>
                        {(slip.created_by === user?.consultant_id || isManager) && (
                          <button
                            onClick={() => handleOpenUpdateShares(slip)}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 font-bold text-xs rounded-lg text-white"
                          >
                            Cấu hình chia %
                          </button>
                        )}
                        {isShareholder && !hasSigned && (
                          <button
                            onClick={() => handleSignSlip(slip.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white font-bold text-xs rounded-lg hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                          >
                            <PenTool size={14} />
                            Ký xác nhận
                          </button>
                        )}
                      </>
                    )}

                    {/* Manager Approval actions */}
                    {isManager && slip.status === 'pending_manager_approval' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveSlip(slip.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          <CheckCircle size={14} /> Duyệt hoa hồng
                        </button>
                        <button
                          onClick={() => handleRejectSlip(slip.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          <X size={14} /> Bác bỏ
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shareholders Distribution & Signatures */}
                <div>
                  <h4 className="font-extrabold text-sm mb-3">Tỷ lệ phân chia & Chữ ký số Sales:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {slip.shareholders.map(sh => (
                      <div
                        key={sh.user_id}
                        className={`p-4 rounded-lg border flex flex-col justify-between space-y-2 ${
                          sh.signed
                            ? 'border-emerald-500/20 bg-emerald-500/5'
                            : 'border-gray-800 bg-black/25'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-bold text-sm">{sh.name}</h5>
                            <span className="text-xs text-gray-500">{sh.email}</span>
                          </div>
                          <span className="font-black text-base text-primary" style={{ color: 'var(--color-primary)' }}>
                            {sh.percentage}%
                          </span>
                        </div>

                        <div className="pt-2 border-t border-gray-800/40 flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold ${
                              sh.signed ? 'text-emerald-500' : 'text-yellow-500'
                            }`}
                          >
                            {sh.signed ? '✓ Đã ký xác nhận' : '⚡ Chờ ký'}
                          </span>
                          {sh.signed && (
                            <span className="text-[9px] text-gray-500 text-right">
                              IP: {sh.signature_ip}<br />
                              Lúc: {new Date(sh.signature_time!).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dispute Reason */}
                {slip.status === 'rejected' && slip.dispute_details && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs flex gap-2 items-center">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h2 className="text-xl font-bold">Cấu hình phân chia tỷ lệ (%)</h2>
              <button onClick={() => setIsUpdateOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveShares} className="space-y-4">
              <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
                {sharesInput.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      required
                      value={item.user_id}
                      onChange={e =>
                        setSharesInput(prev =>
                          prev.map((val, i) => (i === idx ? { ...val, user_id: e.target.value } : val))
                        )
                      }
                      className="flex-1 bg-black/40 border border-gray-800 rounded-lg px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
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
                      className="w-20 bg-black/40 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-center focus:border-primary focus:outline-none"
                    />
                    {sharesInput.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveShareholderInput(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleAddShareholderInput}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <UserPlus size={14} /> Thêm nhân viên hỗ trợ
                </button>
                <span className="text-xs text-gray-400 font-bold">
                  Tổng: {sharesInput.reduce((acc, s) => acc + (parseInt(s.percentage) || 0), 0)}% / 100%
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-primary hover:opacity-90 font-bold rounded-lg text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
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
