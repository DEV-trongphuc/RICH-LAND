import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CreditCard, Plus, Check, X, Upload, AlertCircle, Trash2, Calendar, FileText, Ban, ChevronLeft, ChevronRight, Info, Eye, Edit } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { Avatar } from '../components/ui/Avatar';
import { TableSkeleton } from '../components/ui/Skeleton';

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
  const isViewer = user?.role === 'viewer';
  const { showConfirm } = useUIStore();
  const { t } = useLanguage();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const filteredDepositsList = React.useMemo(() => {
    if (user?.role === 'sale') {
      return deposits.filter((d: any) => 
        String(d.created_by) === String(user.id) || 
        String(d.owner_id) === String(user.id) || 
        (d.contact_owner_id && String(d.contact_owner_id) === String(user.id)) ||
        (d.shareholders && Array.isArray(d.shareholders) && d.shareholders.some((sh: any) => String(sh.user_id) === String(user.id)))
      );
    }
    return deposits;
  }, [deposits, user]);

  const paginatedDeposits = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDepositsList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredDepositsList, currentPage]);

  const totalPages = Math.ceil(filteredDepositsList.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredDepositsList.length]);

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

  // Co-op and Sales Method Selection States
  const [coopSlips, setCoopSlips] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [hasExistingCoop, setHasExistingCoop] = useState(false);
  const [existingCoopShares, setExistingCoopShares] = useState<any[]>([]);
  const [isCooperation, setIsCooperation] = useState(false);
  const [collaborators, setCollaborators] = useState<{ user_id: string; percentage: number }[]>([]);

  // Manage Milestones State
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedDepForManage, setSelectedDepForManage] = useState<Deposit | null>(null);
  const [tempMilestones, setTempMilestones] = useState<any[]>([]);
  const [isSavingMilestones, setIsSavingMilestones] = useState(false);

  // Cancel Deposit State
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelDepositId, setCancelDepositId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director'].includes(user.role);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resDep, resCont, resProj, resCoop, resUsr] = await Promise.all([
        fetchAPI('deposits'),
        fetchAPI('contacts?limit=1000'),
        fetchAPI('projects?bypass_roster=1'),
        fetchAPI('cooperation-slips').catch(() => ({ success: false, data: [] })),
        fetchAPI('users?all=1').catch(() => ({ success: false, data: [] }))
      ]);

      if (resDep.success) setDeposits(resDep.data || []);
      if (resCont.success) {
        const allContacts = resCont.data?.items || resCont.data || [];
        const filteredContacts = (user?.role === 'sale') 
          ? allContacts.filter((c: any) => String(c.owner_id) === String(user.id))
          : allContacts;
        setContacts(filteredContacts);
      }
      if (resProj.success) {
        setProjects(resProj.data || []);
      }
      if (resCoop.success) {
        setCoopSlips(resCoop.data || []);
      }
      if (resUsr.success) {
        setUsersList(resUsr.data || []);
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

  // Check for pre-existing cooperation slip when selectedContactId changes
  useEffect(() => {
    if (!selectedContactId || coopSlips.length === 0) {
      setHasExistingCoop(false);
      setExistingCoopShares([]);
      return;
    }

    const cid = Number(selectedContactId);
    const existing = coopSlips.find((s: any) => Number(s.contact_id) === cid);
    if (existing) {
      setHasExistingCoop(true);
      
      let parsedShares: Record<string, number> = {};
      try {
        parsedShares = typeof existing.shares_json === 'string' 
          ? JSON.parse(existing.shares_json) 
          : (existing.shares_json || {});
      } catch {
        parsedShares = {};
      }

      const sharesList = Object.entries(parsedShares).map(([uid, pct]) => {
        const u = usersList.find((x: any) => String(x.id) === String(uid));
        return {
          user_id: uid,
          name: u?.full_name || u?.name || u?.username || `ID: ${uid}`,
          percentage: pct
        };
      });

      setExistingCoopShares(sharesList);
    } else {
      setHasExistingCoop(false);
      setExistingCoopShares([]);
    }
  }, [selectedContactId, coopSlips, usersList]);

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

    // Verify cooperation shares sum
    if (!hasExistingCoop && isCooperation) {
      if (collaborators.length === 0) {
        setError('Vui lòng thêm ít nhất một nhân viên hợp tác hoặc bỏ chọn Hợp tác chia sẻ.');
        return;
      }
      const sum = collaborators.reduce((acc, c) => acc + (c.percentage || 0), 0);
      if (sum !== 100) {
        setError(`Tổng tỷ lệ chia sẻ hoa hồng phải bằng đúng 100% (Hiện tại là ${sum}%)`);
        return;
      }
      if (collaborators.some(c => !c.user_id)) {
        setError('Vui lòng chọn đầy đủ nhân viên hợp tác trên từng dòng.');
        return;
      }
    }

    if (isSaving) return;

    try {
      setIsSaving(true);
      const res = await fetchAPI('deposits', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: selectedContactId,
          project_id: selectedProjectId,
          unit_code: unitCode,
          price: parseFloat(price),
          expected_commission: parseFloat(expectedCommission) || 0,
          milestones: milestonesInput,
          is_cooperation: isCooperation,
          collaborators: collaborators
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
        setIsCooperation(false);
        setCollaborators([]);
        loadData();
      } else {
        setError(res.message || 'Lỗi tạo phiếu cọc');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    } finally {
      setIsSaving(false);
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
    if (!cancelDepositId || !cancelReason || isSaving) return;

    try {
      setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenManageMilestones = (dep: Deposit) => {
    setSelectedDepForManage(dep);
    setTempMilestones((dep.milestones || []).map(m => ({ ...m })));
    setShowManageModal(true);
  };

  const handleAddMilestoneRow = () => {
    setTempMilestones([
      ...tempMilestones,
      {
        tempId: Date.now() + Math.random(),
        milestone_name: `Đợt ${tempMilestones.length + 1}`,
        expected_amount: 0,
        status: 'pending'
      }
    ]);
  };

  const handleUpdateMilestoneField = (index: number, field: string, value: any) => {
    const updated = [...tempMilestones];
    updated[index] = { ...updated[index], [field]: value };
    setTempMilestones(updated);
  };

  const handleRemoveMilestoneRow = (index: number) => {
    const updated = [...tempMilestones];
    updated.splice(index, 1);
    setTempMilestones(updated);
  };

  const handleUploadUncFromModal = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const m = tempMilestones[index];
    if (!m.id) {
      setError('Vui lòng nhấn "Lưu lịch trình" trước khi tải UNC cho đợt thanh toán mới này.');
      return;
    }
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      const compressedFile = await compressToWebP(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
      const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=deposits/${selectedDepForManage?.id}/milestones/${m.id}/unc&token=${token}`;

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
        const updated = [...tempMilestones];
        updated[index] = { ...updated[index], status: 'paid', unc_file_path: res.data?.unc_file_path || 'temp_path' };
        setTempMilestones(updated);
        loadData();
      } else {
        setError(res.message || 'Lỗi tải UNC');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleApproveFromModal = async (index: number) => {
    const m = tempMilestones[index];
    if (!selectedDepForManage || !m.id) return;
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${m.id}/approve`, { method: 'POST' });
      if (res.success) {
        setSuccess('Phê duyệt đợt tiền thành công!');
        const updated = [...tempMilestones];
        updated[index] = { ...updated[index], status: 'approved' };
        setTempMilestones(updated);
        loadData();
      } else {
        setError(res.message || 'Lỗi phê duyệt');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    }
  };

  const handleRejectFromModal = async (index: number) => {
    const m = tempMilestones[index];
    if (!selectedDepForManage || !m.id) return;
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
          const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${m.id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'UNC không hợp lệ' })
          });
          if (res.success) {
            setSuccess('Đã từ chối UNC thành công');
            const updated = [...tempMilestones];
            updated[index] = { ...updated[index], status: 'failed' };
            setTempMilestones(updated);
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

  const handleSaveMilestones = async () => {
    if (!selectedDepForManage) return;
    for (let m of tempMilestones) {
      if (!m.milestone_name.trim()) {
        setError('Tên đợt không được để trống.');
        return;
      }
    }

    try {
      setIsSavingMilestones(true);
      setError('');
      setSuccess('');
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones`, {
        method: 'PUT',
        body: JSON.stringify({ milestones: tempMilestones })
      });
      if (res.success) {
        setSuccess('Cập nhật lịch trình thanh toán thành công!');
        setShowManageModal(false);
        loadData();
      } else {
        setError(res.message || 'Lỗi khi lưu lịch trình');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    } finally {
      setIsSavingMilestones(false);
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
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {t("Quản Lý Đặt Cọc & Tiến Độ")}
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: 'rgba(0, 0, 0, 0.02)',
                border: '1px solid var(--color-border)',
                padding: '3px 8px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'all 0.2s',
                height: '24px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                e.currentTarget.style.background = 'var(--color-primary-light)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
              }}
              title={t("Xem hướng dẫn quy tắc đặt cọc & đổi căn")}
            >
              <Info size={12} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
            </button>
          </h1>
          <p className="page-subtitle">{t("Theo dõi phiếu cọc, tiến độ thanh toán căn hộ và duyệt UNC")}</p>
        </div>
        {!isViewer && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn primary"
            style={{ height: '38px' }}
          >
            <Plus size={16} />
            Tạo phiếu cọc mới
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : filteredDepositsList.length === 0 ? (
        <EmptyCard
          icon={<CreditCard />}
          title="Chưa có phiếu cọc nào"
          description="Theo dõi phiếu cọc, tiến độ thanh toán căn hộ và duyệt UNC."
          actionText={isViewer ? undefined : "Tạo phiếu cọc mới"}
          onAction={isViewer ? undefined : () => setIsCreateOpen(true)}
        />
      ) : (
        <div className="card" style={{ padding: 0, borderRadius: '16px', border: '1px solid var(--color-border-light)', overflow: 'hidden', background: 'var(--color-surface)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
          <div className="table-wrap" style={{ maxHeight: '480px', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <Avatar name={`${dep.last_name || ''} ${dep.first_name || ''}`} size="sm" style={{ width: 18, height: 18, fontSize: 8 }} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Khách: <strong style={{ color: 'var(--color-text)' }}>{dep.last_name} {dep.first_name}</strong> ({dep.phone})
                          </span>
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

                          {/* Manage Milestones Button */}
                          {dep.status !== 'cancelled' && (
                            <button
                              onClick={() => handleOpenManageMilestones(dep)}
                              style={{
                                padding: '2px 6px',
                                height: '24px',
                                color: 'var(--color-primary)',
                                border: '1px solid rgba(189, 29, 45, 0.25)',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'transparent',
                                fontSize: '0.675rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Chi tiết & Lịch thanh toán"
                            >
                              <Edit size={11} />
                              <span>Lịch đợt</span>
                            </button>
                          )}

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
                Hiển thị <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, filteredDepositsList.length)}</span> trên <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{filteredDepositsList.length}</span>
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
                    label: `${c.last_name} ${c.first_name} (${c.phone})`,
                    avatar: (c as any).avatar_url || (c as any).avatar
                  }))}
                  value={selectedContactId}
                  onChange={val => setSelectedContactId(val.toString())}
                  placeholder="-- Chọn khách hàng --"
                  showAvatars
                  searchable
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
                  searchable
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

            {/* Sales Method & Cooperation Config */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>Phương thức bán hàng & Hoa hồng</h4>
              
              {hasExistingCoop ? (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  fontSize: '0.8rem'
                }}>
                  <p style={{ color: '#10b981', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Phát hiện có Phiếu hợp tác đã lập từ trước
                  </p>
                  <p style={{ color: 'var(--color-text-muted)', marginBottom: '8px', fontSize: '0.75rem' }}>
                    Phiếu cọc này sẽ tự động liên kết với phiếu hợp tác sẵn có. Phân chia tỷ lệ hoa hồng:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {existingCoopShares.map((sh: any) => (
                      <span key={sh.user_id} style={{
                        background: 'var(--color-surface)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border-light)',
                        fontWeight: 600
                      }}>
                        {sh.name}: {sh.percentage}%
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={isCooperation}
                      onChange={e => {
                        setIsCooperation(e.target.checked);
                        if (e.target.checked && collaborators.length === 0) {
                          setCollaborators([{ user_id: '', percentage: 0 }]);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Có hợp tác chia sẻ hoa hồng (Cooperation Deal)</span>
                  </label>

                  {isCooperation && (
                    <div style={{
                      padding: '12px',
                      background: 'var(--color-surface-hover)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Danh sách TVV hợp tác & Tỷ lệ %</span>
                        <button
                          type="button"
                          onClick={() => setCollaborators(prev => [...prev, { user_id: '', percentage: 0 }])}
                          style={{
                            fontSize: '0.725rem',
                            color: '#10b981',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          + Thêm TVV
                        </button>
                      </div>

                      {collaborators.map((col, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select
                            value={col.user_id}
                            required
                            onChange={e => {
                              const updated = [...collaborators];
                              updated[idx].user_id = e.target.value;
                              setCollaborators(updated);
                            }}
                            className="form-input"
                            style={{ flex: 1, height: '32px', fontSize: '0.75rem', padding: '0 8px' }}
                          >
                            <option value="">-- Chọn TVV hợp tác --</option>
                            {usersList.map(u => (
                              <option key={u.id} value={String(u.id)}>
                                {u.full_name || u.name || u.username}
                              </option>
                            ))}
                          </select>
                          
                          <input
                            type="number"
                            placeholder="%"
                            required
                            min={0}
                            max={100}
                            value={col.percentage || ''}
                            onChange={e => {
                              const updated = [...collaborators];
                              updated[idx].percentage = parseInt(e.target.value) || 0;
                              setCollaborators(updated);
                            }}
                            className="form-input"
                            style={{ width: '70px', height: '32px', fontSize: '0.75rem', padding: '0 8px', textAlign: 'center' }}
                          />

                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...collaborators];
                              updated.splice(idx, 1);
                              setCollaborators(updated);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-danger)',
                              cursor: 'pointer',
                              display: 'flex',
                              padding: 4
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}

                      {/* Total share sum indicator */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid var(--color-border-light)',
                        paddingTop: '6px',
                        marginTop: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        <span>Tổng tỷ lệ chia sẻ:</span>
                        <span style={{
                          color: collaborators.reduce((acc, curr) => acc + Number(curr.percentage), 0) === 100 ? '#10b981' : '#ef4444'
                        }}>
                          {collaborators.reduce((acc, curr) => acc + Number(curr.percentage), 0)}% / 100%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="btn primary w-full"
              style={{ height: '38px', marginTop: '0.5rem', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
            >
              {isSaving ? 'Đang khởi tạo...' : 'Tạo phiếu đặt cọc'}
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
                disabled={isSaving}
                className="btn primary w-full"
                style={{ height: '38px', backgroundColor: 'var(--color-danger)', border: 'none', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? 'Đang xử lý...' : 'Xác nhận bể cọc'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Explanation of Deposit & Unit Switch Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Quy trình Đặt cọc & Chính sách Bể cọc / Đổi căn")}
        width="760px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.875rem 1rem', 
            background: 'var(--color-primary-light)', 
            border: '1px solid rgba(163, 20, 34, 0.15)', 
            borderRadius: 12 
          }}>
            <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {t("Hệ thống quản lý đặt cọc căn hộ và kiểm soát doanh thu môi giới. Nhằm bảo vệ quyền lợi của Tư vấn viên (TVV) và tính toàn vẹn của dữ liệu, vui lòng tuân thủ các quy tắc sau:")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Quy tắc 1 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(59, 130, 246, 0.02)', 
              borderLeft: '4px solid #3b82f6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <CreditCard size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Đợt thanh toán & Phê duyệt UNC")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Mỗi phiếu cọc có thể chia thành nhiều đợt thanh toán (milestones). TVV có nhiệm vụ tải lên hình ảnh UNC (Ủy nhiệm chi). Khi được Kế toán/Admin phê duyệt trạng thái \"Đã đóng\", doanh thu thực tế mới được ghi nhận vào hệ thống.")}
                </p>
              </div>
            </div>

            {/* Quy tắc 2 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(239, 68, 68, 0.02)', 
              borderLeft: '4px solid #ef4444', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Ban size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Quy tắc Bể cọc (Deposit Cancellation)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("• Chưa phát sinh doanh thu: Nếu khách hàng hủy đặt cọc trước khi đóng bất kỳ đợt thanh toán nào, trạng thái của KHTN/Person sẽ bị hạ về mức trước đó (Booking/Đã Gặp). Đồng hồ bảo mật của lead kích hoạt trở lại và lead có thể bị tự động giải phóng ra Databank chung nếu hết hạn.")}
                  <br />
                  {t("• Đã phát sinh doanh thu (đã đóng đợt 1): Trạng thái KHTN được giữ nguyên là Đặt Cọc để bảo vệ quyền sở hữu trọn đời của TVV chăm sóc.")}
                </p>
              </div>
            </div>

            {/* Quy tắc 3 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(245, 158, 11, 0.02)', 
              borderLeft: '4px solid #f59e0b', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Calendar size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Cơ chế Đổi căn / Đổi dự án (Unit Switching)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Khi khách hàng muốn chuyển sang căn hộ hoặc dự án giao dịch khác, bắt buộc thực hiện theo đúng vết kiểm toán (audit trail):")}
                  <br />
                  {t("• Đóng deal/phiếu cọc cũ lại (đánh dấu thất bại hoặc đã đổi).")}
                  <br />
                  {t("• Tạo một deal/phiếu cọc mới hoàn toàn.")}
                  <br />
                  {t("• Gắn liên kết ghi rõ \"Đổi từ căn [Mã Căn Cũ]\" ở deal mới để lưu trọn vẹn lịch sử phí môi giới.")}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
        </div>
      </CustomModal>

      {/* Manage Milestones Modal */}
      <CustomModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title={`Chi tiết & Lịch trình thanh toán - Căn ${selectedDepForManage?.unit_code}`}
        width="650px"
      >
        {selectedDepForManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Brief Info */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              background: 'var(--color-surface-hover)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8125rem'
            }}>
              <div>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Dự án</p>
                <p style={{ fontWeight: 700 }}>{selectedDepForManage.project_name}</p>
              </div>
              <div>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Khách hàng</p>
                <p style={{ fontWeight: 700 }}>{selectedDepForManage.last_name} {selectedDepForManage.first_name} ({selectedDepForManage.phone})</p>
              </div>
              <div>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Tổng giá trị căn hộ</p>
                <p style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatMoney(selectedDepForManage.price)}</p>
              </div>
              <div>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Hoa hồng dự kiến</p>
                <p style={{ fontWeight: 700, color: '#059669' }}>{formatMoney(selectedDepForManage.expected_commission)}</p>
              </div>
            </div>

            {/* Milestones List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>Các đợt thanh toán</h4>
                <button
                  className="btn sm"
                  onClick={handleAddMilestoneRow}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    color: '#10b981',
                    border: 'none',
                    fontWeight: 700,
                    borderRadius: '6px'
                  }}
                >
                  + Thêm đợt
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: 4 }}>
                {tempMilestones.map((m, idx) => {
                  const isLocked = m.status === 'approved' || m.status === 'paid';
                  return (
                    <div
                      key={m.tempId || m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '6px'
                      }}
                    >
                      {/* Name input */}
                      <input
                        type="text"
                        placeholder="Tên đợt (ví dụ: Đợt 1 - Cọc giữ chỗ)"
                        value={m.milestone_name}
                        onChange={e => handleUpdateMilestoneField(idx, 'milestone_name', e.target.value)}
                        className="input"
                        style={{ flex: 2, height: '28px', fontSize: '0.75rem', padding: '0 6px' }}
                      />

                      {/* Amount input */}
                      <input
                        type="number"
                        placeholder="Số tiền"
                        value={m.expected_amount || ''}
                        disabled={isLocked}
                        onChange={e => handleUpdateMilestoneField(idx, 'expected_amount', parseFloat(e.target.value) || 0)}
                        className="input"
                        style={{ width: '110px', height: '28px', fontSize: '0.75rem', padding: '0 6px' }}
                      />

                      {/* Status */}
                      <span style={{
                        fontSize: '0.675rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: m.status === 'approved' ? '#10b98115' : m.status === 'paid' ? '#2563eb15' : m.status === 'failed' ? '#ef444415' : 'rgba(0,0,0,0.05)',
                        color: m.status === 'approved' ? '#10b981' : m.status === 'paid' ? '#2563eb' : m.status === 'failed' ? '#ef4444' : '#6b7280',
                        minWidth: '55px',
                        textAlign: 'center'
                      }}>
                        {m.status === 'approved' ? 'Đã duyệt' : m.status === 'paid' ? 'Chờ duyệt' : m.status === 'failed' ? 'Từ chối' : 'Chờ nộp'}
                      </span>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {/* Upload UNC */}
                        {m.status !== 'approved' && (
                          <label
                            className="btn sm"
                            style={{
                              padding: '0 6px',
                              height: '24px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                              border: '1px solid rgba(0,0,0,0.1)',
                              fontSize: '0.675rem'
                            }}
                            title="Tải UNC"
                          >
                            <Upload size={11} />
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={e => handleUploadUncFromModal(e, idx)}
                            />
                          </label>
                        )}

                        {/* View UNC link */}
                        {m.unc_file_path && (
                          <a
                            href={`${import.meta.env.VITE_API_URL || '/backend'}/uploads/${m.unc_file_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn sm"
                            style={{
                              padding: '0 6px',
                              height: '24px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                              background: 'rgba(59, 130, 246, 0.08)',
                              color: '#2563eb',
                              fontSize: '0.675rem'
                            }}
                            title="Xem UNC"
                          >
                            <Eye size={11} />
                          </a>
                        )}

                        {/* Admin ticks */}
                        {isAdmin && m.status === 'paid' && (
                          <>
                            <button
                              onClick={() => handleApproveFromModal(idx)}
                              className="btn sm"
                              style={{ padding: '0 6px', height: '24px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px' }}
                              title="Duyệt đợt tiền"
                            >
                              <Check size={11} />
                            </button>
                            <button
                              onClick={() => handleRejectFromModal(idx)}
                              className="btn sm"
                              style={{ padding: '0 6px', height: '24px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px' }}
                              title="Từ chối UNC"
                            >
                              <X size={11} />
                            </button>
                          </>
                        )}

                        {/* Delete row */}
                        {!isLocked && (
                          <button
                            onClick={() => handleRemoveMilestoneRow(idx)}
                            className="btn sm"
                            style={{ padding: '0 6px', height: '24px', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.15)', background: 'transparent', borderRadius: '6px' }}
                            title="Xóa đợt"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <button className="btn" onClick={() => setShowManageModal(false)} style={{ minWidth: 80 }}>
                Hủy
              </button>
              <button className="btn primary" onClick={handleSaveMilestones} style={{ minWidth: 100 }} disabled={isSavingMilestones}>
                {isSavingMilestones ? 'Đang lưu...' : 'Lưu lịch trình'}
              </button>
            </div>
          </div>
        )}
      </CustomModal>

    </div>
  );
}
