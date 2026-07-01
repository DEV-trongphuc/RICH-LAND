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
      const token = localStorage.getItem('richland_token') || '';
      const url = `${import.meta.env.VITE_API_URL || 'https://open.richland.net/sale_data'}/api.php?action=deposits/${depositId}/milestones/${milestoneId}/unc&token=${token}`;

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
          <h1 className="text-3xl font-black tracking-tight text-primary animate-pulse" style={{ color: 'var(--color-primary)' }}>
            Quản Lý Đặt Cọc & Tiến Độ
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Theo dõi phiếu cọc, tiến độ thanh toán căn hộ và duyệt UNC
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Plus size={18} />
          Tạo phiếu cọc mới
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải danh sách đặt cọc...</div>
      ) : deposits.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-700/50 rounded-xl text-gray-500">
          Chưa có phiếu cọc nào được ghi nhận
        </div>
      ) : (
        <div className="space-y-6">
          {deposits.map(dep => (
            <div
              key={dep.id}
              className="p-6 rounded-xl border border-gray-800 bg-black/40 backdrop-blur-md shadow-2xl space-y-6"
            >
              {/* Top Row: General info */}
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3.5 bg-primary/10 rounded-xl text-primary" style={{ color: 'var(--color-primary)' }}>
                    <CreditCard size={26} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg">
                      Căn: <span className="text-primary" style={{ color: 'var(--color-primary)' }}>{dep.unit_code}</span> | Dự án: {dep.project_name}
                    </h3>
                    <p className="text-xs text-gray-400">
                      Khách hàng: <span className="font-bold text-gray-300">{dep.last_name} {dep.first_name}</span> ({dep.phone}) • Người tạo: {dep.creator_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="block text-xs text-gray-500">Giá bán / Hoa hồng</span>
                    <span className="font-bold text-sm text-gray-300">
                      {dep.price.toLocaleString()} VND / {dep.expected_commission.toLocaleString()} VND
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                      dep.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : dep.status === 'cancelled'
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                    }`}
                  >
                    {dep.status === 'approved' ? 'Hoàn tất cọc' : dep.status === 'cancelled' ? 'Đã bể cọc' : 'Chờ duyệt UNC'}
                  </span>
                  {dep.status !== 'cancelled' && (
                    <button
                      onClick={() => handleOpenCancel(dep.id)}
                      className="p-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors"
                      title="Báo hủy / Bể cọc"
                    >
                      <Ban size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Milestones Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-800/60">
                {dep.milestones.map(m => (
                  <div
                    key={m.id}
                    className="p-4 rounded-lg bg-black/20 border border-gray-800/80 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-xs text-gray-400 line-clamp-1">{m.milestone_name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            m.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : m.status === 'paid'
                              ? 'bg-blue-500/10 text-blue-500'
                              : m.status === 'failed'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-gray-500/10 text-gray-400'
                          }`}
                        >
                          {m.status === 'approved' ? 'Đã duyệt' : m.status === 'paid' ? 'Chờ duyệt' : m.status === 'failed' ? 'UNC sai' : 'Chờ nộp'}
                        </span>
                      </div>
                      <span className="block font-black text-sm mt-1">{m.expected_amount.toLocaleString()} VND</span>
                    </div>

                    {/* Actions / Attachments */}
                    <div className="pt-2 border-t border-gray-800/50 flex gap-2 items-center justify-between">
                      {m.unc_file_path ? (
                        <a
                          href={`${import.meta.env.VITE_API_URL || 'https://open.richland.net/sale_data'}/uploads/${m.unc_file_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          <FileText size={12} />
                          Xem ảnh UNC
                        </a>
                      ) : (
                        <span className="text-[10px] text-gray-500">Chưa nộp UNC</span>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-1.5">
                        {dep.status !== 'cancelled' && m.status !== 'approved' && (
                          <label className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 cursor-pointer">
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
                              className="p-1 bg-emerald-500/20 text-emerald-500 rounded hover:bg-emerald-500/30"
                              title="Duyệt"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => handleRejectMilestone(dep.id, m.id)}
                              className="p-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h2 className="text-xl font-bold">Khởi tạo phiếu đặt cọc</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateDeposit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Khách hàng</label>
                  <select
                    required
                    value={selectedContactId}
                    onChange={e => setSelectedContactId(e.target.value)}
                    className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
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
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Dự án</label>
                  <select
                    required
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">-- Chọn dự án --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Mã căn hộ</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: A-12.05"
                    value={unitCode}
                    onChange={e => setUnitCode(e.target.value.toUpperCase())}
                    className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Giá bán (VND)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Hoa hồng (VND)</label>
                  <input
                    type="number"
                    value={expectedCommission}
                    onChange={e => setExpectedCommission(e.target.value)}
                    className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Milestones config */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-gray-300">Lịch trình thanh toán</h4>
                  <button
                    type="button"
                    onClick={handleAddMilestoneInput}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <Plus size={14} /> Thêm đợt tiền
                  </button>
                </div>

                {milestonesInput.map((m, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
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
                      className="flex-1 bg-black/40 border border-gray-800 rounded-lg px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                    />
                    <input
                      type="number"
                      required
                      placeholder="Số tiền đợt (VND)"
                      value={m.amount}
                      onChange={e =>
                        setMilestonesInput(prev =>
                          prev.map((item, i) => (i === idx ? { ...item, amount: e.target.value } : item))
                        )
                      }
                      className="w-36 bg-black/40 border border-gray-800 rounded-lg px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                    />
                    {milestonesInput.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestoneInput(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-primary hover:opacity-90 transition-opacity font-bold rounded-lg text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Tạo phiếu đặt cọc
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h2 className="text-xl font-bold text-red-500">Báo cáo bể cọc / Hủy mua</h2>
              <button onClick={() => setIsCancelOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                **Lưu ý:** Nếu chưa được duyệt bất kỳ đợt thanh toán nào, hệ thống sẽ tự động hạ 1 mức nhiệt của KHTN (decay) và chuyển trạng thái về Booking.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Lý do hủy cọc</label>
                <textarea
                  required
                  placeholder="Nhập lý do chi tiết..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:border-primary focus:outline-none"
                />
              </div>
              <button
                onClick={handleConfirmCancel}
                className="w-full py-2 bg-red-600 hover:bg-red-700 font-bold rounded-lg text-white transition-colors"
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
