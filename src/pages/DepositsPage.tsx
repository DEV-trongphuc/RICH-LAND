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
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import { CurrencyInput } from '../components/ui/CurrencyInput';

const formatNumberWithCommas = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const cleanVal = String(val).replace(/[^0-9]/g, '');
  if (!cleanVal) return '';
  return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

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
  avatar_url?: string;
  project_name: string;
  creator_name: string;
  milestones: Milestone[];
  created_by?: number;
  contact_owner_id?: number;
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
  expected_revenue?: number | string;
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
  const { showConfirm, addToast } = useUIStore();
  const { t } = useLanguage();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [allowedCollaborators, setAllowedCollaborators] = useState<{ id: string; name: string; isOwner: boolean }[]>([]);
  const [collaboratorShares, setCollaboratorShares] = useState<Record<string, number>>({});

  // Manage Milestones State
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedDepForManage, setSelectedDepForManage] = useState<Deposit | null>(null);
  const [tempMilestones, setTempMilestones] = useState<any[]>([]);
  const [isSavingMilestones, setIsSavingMilestones] = useState(false);

  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [sharesData, setSharesData] = useState<any[]>([]);

  const [tempExpectedCommission, setTempExpectedCommission] = useState<number>(0);
  const [tempSharesData, setTempSharesData] = useState<any[]>([]);

  const handleTempSharePercentChange = (sIdx: number, val: string) => {
    const updated = [...tempSharesData];
    updated[sIdx].percentage = parseInt(val) || 0;
    setTempSharesData(updated);
  };

  const handleOpenContactDrawer = async (contactId: number) => {
    try {
      const res = await fetchAPI(`contacts/${contactId}`);
      const c = res.data || res;
      if (c) {
        setSelectedContact(c);
        setShowContactDrawer(true);
      }
    } catch (err) {
      addToast('Không thể tải thông tin khách hàng', 'error');
    }
  };

  useEffect(() => {
    if (selectedDepForManage) {
      setSharesData([]);
      setTempExpectedCommission(Number(selectedDepForManage.expected_commission) || 0);
      setTempSharesData([]);
      fetchAPI(`cooperation-slips?contact_id=${selectedDepForManage.contact_id}`)
        .then(res => {
          const slips = res.data || res || [];
          if (slips.length > 0) {
            const matchedSlip = slips.find((s: any) => Number(s.deposit_slip_id) === Number(selectedDepForManage.id)) || slips[0];
            if (matchedSlip && matchedSlip.shareholders) {
              setSharesData(matchedSlip.shareholders);
              setTempSharesData(matchedSlip.shareholders.map((sh: any) => ({ ...sh })));
            }
          }
        })
        .catch(err => console.error("Error loading cooperation shares:", err));
    }
  }, [selectedDepForManage]);

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
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check for pre-existing cooperation slip and load collaborators when selectedContactId changes
  useEffect(() => {
    if (!selectedContactId) {
      setHasExistingCoop(false);
      setExistingCoopShares([]);
      setAllowedCollaborators([]);
      setCollaboratorShares({});
      setIsCooperation(false);
      return;
    }

    const cid = Number(selectedContactId);
    
    // Auto-fill price (expected revenue) from contact details if available
    const matchedContact = contacts.find((c: any) => Number(c.id) === cid);
    if (matchedContact) {
      const defaultRevenue = matchedContact.expected_revenue || '';
      setPrice(String(defaultRevenue));
    }

    // 1. Load Collaborators strictly from quyen_truy_cap (Luật 4.5)
    fetchAPI(`contacts/${cid}/collaborators`)
      .then((res: any) => {
        if (res.success && res.data) {
          const owner = res.data.owner;
          const helpers = res.data.helpers || [];

          const colList: any[] = [];
          if (owner) {
            colList.push({
              id: String(owner.id),
              name: `${owner.full_name || owner.name || owner.username} (Chủ sở hữu)`,
              isOwner: true
            });
          }

          helpers.forEach((h: any) => {
            colList.push({
              id: String(h.user_id),
              name: h.full_name || h.name || h.username || `TVV ID: ${h.user_id}`,
              isOwner: false
            });
          });

          setAllowedCollaborators(colList);

          // Default initial shares: Owner gets 100%, others get 0%
          const initialShares: Record<string, number> = {};
          colList.forEach(c => {
            initialShares[c.id] = c.isOwner ? 100 : 0;
          });
          setCollaboratorShares(initialShares);
          setIsCooperation(false);
        }
      })
      .catch(() => {
        setAllowedCollaborators([]);
        setCollaboratorShares({});
      });

    // 2. Check for pre-existing cooperation slip
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
      addToast('Vui lòng điền đầy đủ thông tin khách hàng, dự án, căn hộ, giá bán', 'error');
      return;
    }

    // Verify milestones total sum
    const totalM = milestonesInput.reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
    if (Math.abs(totalM - parseFloat(price)) > 1) {
      addToast(`Tổng tiền các đợt (${totalM.toLocaleString()} VND) phải bằng đúng Giá bán (${parseFloat(price).toLocaleString()} VND)`, 'error');
      return;
    }

    // Verify cooperation shares sum
    if (!hasExistingCoop && isCooperation) {
      const sum = Object.values(collaboratorShares).reduce((acc, c) => acc + (c || 0), 0);
      if (sum !== 100) {
        addToast(`Tổng tỷ lệ chia sẻ hoa hồng phải bằng đúng 100% (Hiện tại là ${sum}%)`, 'error');
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
          collaborators: isCooperation
            ? Object.entries(collaboratorShares).map(([uid, pct]) => ({
                user_id: uid,
                percentage: pct
              }))
            : []
        })
      });

      if (res.success) {
        addToast('Tạo phiếu cọc và lịch thanh toán thành công!', 'success');
        setIsCreateOpen(false);
        // Reset Form
        setSelectedContactId('');
        setSelectedProjectId('');
        setUnitCode('');
        setPrice('');
        setExpectedCommission('');
        setMilestonesInput([{ name: 'Đợt 1 - Cọc giữ chỗ', amount: '' }]);
        setIsCooperation(false);
        setAllowedCollaborators([]);
        setCollaboratorShares({});
        loadData();
      } else {
        addToast(res.message || 'Lỗi tạo phiếu cọc', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
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
        addToast('Tải ảnh UNC thành công, vui lòng chờ Admin duyệt', 'success');
        loadData();
      } else {
        addToast(res.message || 'Lỗi tải UNC', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleApproveMilestone = async (depositId: number, milestoneId: number) => {
    try {
      const res = await fetchAPI(`deposits/${depositId}/milestones/${milestoneId}/approve`, { method: 'POST' });
      if (res.success) {
        addToast('Phê duyệt đợt tiền thành công!', 'success');
        loadData();
      } else {
        addToast(res.message || 'Lỗi phê duyệt', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
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
            addToast('Đã từ chối UNC thành công', 'success');
            loadData();
          } else {
            addToast(res.message || 'Lỗi xử lý', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
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
        addToast('Đã báo cáo bể cọc thành công', 'success');
        setIsCancelOpen(false);
        loadData();
      } else {
        addToast(res.message || 'Lỗi báo hủy', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
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
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      const compressedFile = await compressToWebP(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
      const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=upload&token=${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Auth-Token': token
        },
        body: formData
      });

      const res = await response.json();
      if (res.success && res.data?.url) {
        addToast('Tải ảnh UNC thành công! Hãy nhấn "Lưu lịch trình" để hoàn tất lưu.', 'success');
        const updated = [...tempMilestones];
        updated[index] = { ...updated[index], status: 'paid', unc_file_path: res.data.url };
        setTempMilestones(updated);
      } else {
        addToast(res.message || 'Lỗi tải UNC', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleApproveFromModal = async (index: number) => {
    const m = tempMilestones[index];
    if (!selectedDepForManage || !m.id) return;
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${m.id}/approve`, { method: 'POST' });
      if (res.success) {
        addToast('Phê duyệt đợt tiền thành công!', 'success');
        const updated = [...tempMilestones];
        updated[index] = { ...updated[index], status: 'approved' };
        setTempMilestones(updated);
        loadData();
      } else {
        addToast(res.message || 'Lỗi phê duyệt', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
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
            addToast('Đã từ chối UNC thành công', 'success');
            const updated = [...tempMilestones];
            updated[index] = { ...updated[index], status: 'failed' };
            setTempMilestones(updated);
            loadData();
          } else {
            addToast(res.message || 'Lỗi xử lý', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  const handleSaveMilestones = async () => {
    if (!selectedDepForManage) return;
    for (let m of tempMilestones) {
      if (!m.milestone_name.trim()) {
        addToast('Tên đợt không được để trống.', 'error');
        return;
      }
    }

    const hasProof = tempMilestones.some(m => m.unc_file_path && m.unc_file_path.trim() !== '');
    if (!hasProof) {
      addToast('Lịch trình thanh toán bắt buộc phải có ít nhất 1 minh chứng.', 'error');
      return;
    }

    if (isAdmin && tempSharesData && tempSharesData.length > 0) {
      const totalPct = tempSharesData.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
      if (totalPct !== 100) {
        addToast('Tổng tỷ lệ chia sẻ hoa hồng phải bằng 100%.', 'error');
        return;
      }
    }

    try {
      setIsSavingMilestones(true);
      const payload: any = { milestones: tempMilestones };
      if (isAdmin) {
        payload.expected_commission = tempExpectedCommission;
        payload.shares = tempSharesData.map(sh => ({
          user_id: sh.user_id,
          percentage: sh.percentage
        }));
      }
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        addToast('Cập nhật lịch trình thanh toán thành công!', 'success');
        setShowManageModal(false);
        loadData();
      } else {
        addToast(res.message || 'Lỗi khi lưu lịch trình', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSavingMilestones(false);
    }
  };

  return (
    <div className="page-container anim-fade-up" style={{ color: 'var(--color-text)' }}>
      {/* Notifications */}

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
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', cursor: 'pointer' }}
                      className="table-row-hover"
                      onClick={() => handleOpenManageMilestones(dep)}
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
                          <Avatar src={dep.avatar_url} name={`${dep.last_name || ''} ${dep.first_name || ''}`} size="sm" style={{ width: 24, height: 24, fontSize: 10 }} />
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
                      <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {/* Update Button */}
                          {dep.status !== 'cancelled' && (() => {
                            const isCreator = String(dep.created_by) === String(user?.id);
                            const isOwner = String(dep.contact_owner_id) === String(user?.id);
                            const isStaff = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director'].includes(user.role);
                            
                            if (isStaff || isCreator || isOwner) {
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenManageMilestones(dep);
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    height: '32px',
                                    background: 'rgba(59, 130, 246, 0.08)',
                                    border: '1px solid rgba(59, 130, 246, 0.2)',
                                    color: '#2563eb',
                                    borderRadius: '8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <Edit size={13} />
                                  <span>Cập nhật</span>
                                </button>
                              );
                            }
                            return null;
                          })()}

                          {/* Cancellation Button */}
                          {dep.status !== 'cancelled' && (() => {
                            const isCreator = String(dep.created_by) === String(user?.id);
                            const isOwner = String(dep.contact_owner_id) === String(user?.id);
                            const isStaff = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director'].includes(user.role);
                            
                            if (isStaff || isCreator || isOwner) {
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenCancel(dep.id);
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    height: '32px',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    color: '#ef4444',
                                    borderRadius: '8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <Ban size={13} />
                                  <span>Bể cọc</span>
                                </button>
                              );
                            }
                            return null;
                          })()}
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
                <CurrencyInput
                  value={price}
                  onChange={val => setPrice(String(val))}
                  placeholder="0"
                  showTextHelper={false}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Hoa hồng (VND)</label>
                <CurrencyInput
                  value={expectedCommission}
                  onChange={val => setExpectedCommission(String(val))}
                  placeholder="0"
                  showTextHelper={false}
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
                  <div style={{ width: '150px', flexShrink: 0 }}>
                    <CurrencyInput
                      value={m.amount}
                      required
                      onChange={val =>
                        setMilestonesInput(prev =>
                          prev.map((item, i) => (i === idx ? { ...item, amount: String(val) } : item))
                        )
                      }
                      placeholder="Số tiền (VND)"
                      showTextHelper={false}
                    />
                  </div>
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
                  {allowedCollaborators.length <= 1 ? (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      KHTN này chưa phát sinh lịch sử mời hỗ trợ chăm sóc chung. Giao dịch sẽ mặc định là Bán độc lập (Chủ sở hữu hưởng 100% hoa hồng và tự động duyệt phiếu).
                    </p>
                  ) : (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={isCooperation}
                          onChange={e => setIsCooperation(e.target.checked)}
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
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                            Phân chia tỷ lệ hoa hồng cho thành viên (Luật 4.5):
                          </span>

                          {allowedCollaborators.map((col) => (
                            <div key={col.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: col.isOwner ? 700 : 500, color: col.isOwner ? 'var(--color-primary)' : 'var(--color-text)' }}>
                                {col.name}
                              </span>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="number"
                                  placeholder="%"
                                  required
                                  min={0}
                                  max={100}
                                  value={collaboratorShares[col.id] !== undefined ? collaboratorShares[col.id] : ''}
                                  onChange={e => {
                                    const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                    setCollaboratorShares(prev => ({
                                      ...prev,
                                      [col.id]: val
                                    }));
                                  }}
                                  className="form-input"
                                  style={{ width: '70px', height: '32px', fontSize: '0.75rem', padding: '0 8px', textAlign: 'center' }}
                                />
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>%</span>
                              </div>
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
                              color: Object.values(collaboratorShares).reduce((acc, curr) => acc + Number(curr), 0) === 100 ? '#10b981' : '#ef4444'
                            }}>
                              {Object.values(collaboratorShares).reduce((acc, curr) => acc + Number(curr), 0)}% / 100%
                            </span>
                          </div>
                        </div>
                      )}
                    </>
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
      <CustomModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Báo cáo bể cọc / Hủy mua"
        width="400px"
      >
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
      </CustomModal>
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
        width="980px"
      >
        {selectedDepForManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Brief Info with Customer Details and Sales Team */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '1.5rem',
              background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-hover) 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid var(--color-border-light)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
            }}>
              {/* Left Column: Customer details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRight: '1px solid var(--color-border-light)', paddingRight: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    onClick={() => handleOpenContactDrawer(selectedDepForManage.contact_id)}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <Avatar
                      src={selectedDepForManage.avatar_url}
                      name={`${selectedDepForManage.last_name} ${selectedDepForManage.first_name}`}
                      size="lg"
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>Khách hàng</span>
                    <h4
                      onClick={() => handleOpenContactDrawer(selectedDepForManage.contact_id)}
                      style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        textDecoration: 'underline decoration-dotted',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      {selectedDepForManage.last_name} {selectedDepForManage.first_name}
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      SĐT: {selectedDepForManage.phone}
                    </p>
                  </div>
                </div>

                {/* Sales team section */}
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Nhân sự chăm sóc & tỷ lệ chia hoa hồng:
                  </span>
                  {isAdmin && tempSharesData && tempSharesData.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {tempSharesData.map((sh, sIdx) => (
                        <div
                          key={sIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            maxWidth: '360px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={sh.avatar} name={sh.name} size="sm" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{sh.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={sh.percentage}
                              onChange={(e) => handleTempSharePercentChange(sIdx, e.target.value)}
                              className="form-input"
                              style={{ width: '60px', height: '28px', textAlign: 'center', padding: '2px', fontSize: '0.8rem' }}
                            />
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>%</span>
                          </div>
                        </div>
                      ))}
                      {(() => {
                        const totalPct = tempSharesData.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
                        if (totalPct !== 100) {
                          return (
                            <span style={{ fontSize: '0.725rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                              * Tổng tỷ lệ phải bằng 100% (Hiện tại: {totalPct}%)
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : sharesData && sharesData.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {sharesData.map((sh, sIdx) => (
                        <div
                          key={sIdx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            padding: '3px 8px',
                            borderRadius: '16px',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          <Avatar src={sh.avatar} name={sh.name} size="sm" />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{sh.name}</span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#2563eb',
                            padding: '1px 5px',
                            borderRadius: '8px'
                          }}>
                            {sh.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      Bán độc lập (Chỉ có chủ sở hữu cọc)
                    </span>
                  )}
                </div>
              </div>

              {/* Right Column: Transaction details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Dự án & Căn hộ</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{selectedDepForManage.project_name} - Căn {selectedDepForManage.unit_code}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Thời gian tạo phiếu</span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {new Date(selectedDepForManage.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Tổng giá trị căn hộ</span>
                    <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '1rem' }}>{formatMoney(selectedDepForManage.price)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Hoa hồng dự kiến</span>
                    {isAdmin ? (
                      <CurrencyInput
                        value={tempExpectedCommission}
                        onChange={(val) => setTempExpectedCommission(val || 0)}
                        className="form-input"
                        style={{ height: '32px', fontSize: '0.9rem', fontWeight: 800, color: '#059669', width: '100%', maxWidth: '160px' }}
                      />
                    ) : (
                      <span style={{ fontWeight: 800, color: '#059669', fontSize: '1rem' }}>{formatMoney(selectedDepForManage.expected_commission)}</span>
                    )}
                  </div>
                </div>
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
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  + Thêm đợt
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1fr 1.5fr',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--color-surface-hover)',
                  borderBottom: '2px solid var(--color-border)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <div>Tên đợt thanh toán</div>
                  <div>Ngày tạo</div>
                  <div>Số tiền (VND)</div>
                  <div style={{ textAlign: 'center' }}>Trạng thái</div>
                  <div style={{ textAlign: 'center' }}>Minh chứng</div>
                  <div style={{ textAlign: 'right' }}>Thao tác</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', paddingRight: 4 }}>
                  {tempMilestones.map((m, idx) => {
                    const isLocked = m.status === 'approved' || m.status === 'paid';
                    return (
                      <div
                        key={m.tempId || m.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1fr 1.5fr',
                          gap: '12px',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '8px',
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}
                      >
                        {/* Name input */}
                        <div>
                          <input
                            type="text"
                            placeholder="Tên đợt (ví dụ: Đợt 1 - Cọc giữ chỗ)"
                            value={m.milestone_name}
                            onChange={e => handleUpdateMilestoneField(idx, 'milestone_name', e.target.value)}
                            className="form-input"
                            style={{ width: '100%', height: '34px', fontSize: '0.775rem', padding: '0 10px', borderRadius: '6px' }}
                          />
                        </div>

                        {/* Created Date */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '4px', fontWeight: 500 }}>
                          {new Date(m.created_at || selectedDepForManage.created_at).toLocaleDateString('vi-VN')}
                        </div>

                        {/* Amount input */}
                        <div>
                          <input
                            type="text"
                            placeholder="Số tiền"
                            value={formatNumberWithCommas(m.expected_amount)}
                            disabled={isLocked}
                            onChange={e => {
                              const rawVal = e.target.value.replace(/[^0-9]/g, '');
                              handleUpdateMilestoneField(idx, 'expected_amount', rawVal ? parseInt(rawVal, 10) : 0);
                            }}
                            className="form-input"
                            style={{ width: '100%', height: '34px', fontSize: '0.775rem', padding: '0 10px', borderRadius: '6px' }}
                          />
                        </div>

                        {/* Status + dates */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '4px 8px',
                            borderRadius: '9999px',
                            background: m.status === 'approved' ? 'rgba(16, 185, 129, 0.12)' : m.status === 'paid' ? 'rgba(37, 99, 235, 0.12)' : m.status === 'failed' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(107, 114, 128, 0.12)',
                            color: m.status === 'approved' ? '#10b981' : m.status === 'paid' ? '#2563eb' : m.status === 'failed' ? '#ef4444' : '#6b7280',
                            textAlign: 'center',
                            display: 'inline-block',
                            whiteSpace: 'nowrap'
                          }}>
                            {m.status === 'approved' ? 'Đã duyệt' : m.status === 'paid' ? 'Chờ duyệt' : m.status === 'failed' ? 'Từ chối' : 'Chờ nộp'}
                          </span>
                          {m.approval_date && m.status === 'approved' && (
                            <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 500 }}>
                              Duyệt: {new Date(m.approval_date).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </div>

                        {/* UNC proof */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                          {/* Upload UNC */}
                          {m.status !== 'approved' && (
                            <label
                              className="btn sm"
                              style={{
                                padding: '0 8px',
                                height: '30px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-text-muted)',
                                transition: 'all 0.15s'
                              }}
                              title="Tải ảnh chuyển khoản (UNC)"
                            >
                              <Upload size={13} />
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
                              href={m.unc_file_path.startsWith('uploads/') ? `${import.meta.env.VITE_API_URL || '/backend'}/${m.unc_file_path}` : `${import.meta.env.VITE_API_URL || '/backend'}/uploads/${m.unc_file_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn sm"
                              style={{
                                padding: '0 8px',
                                height: '30px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#2563eb',
                                border: 'none',
                                transition: 'all 0.15s'
                              }}
                              title="Xem UNC đã tải lên"
                            >
                              <Eye size={13} />
                            </a>
                          )}
                        </div>

                        {/* Actions (Approve/Reject or Delete) */}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {/* Admin approval/rejection */}
                          {isAdmin && m.status === 'paid' && (
                            <>
                              <button
                                onClick={() => handleApproveFromModal(idx)}
                                style={{
                                  padding: '0 8px',
                                  height: '30px',
                                  background: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  fontWeight: 700
                                }}
                                title="Phê duyệt đợt tiền này"
                              >
                                <Check size={13} style={{ marginRight: 2 }} /> Duyệt
                              </button>
                              <button
                                onClick={() => handleRejectFromModal(idx)}
                                style={{
                                  padding: '0 8px',
                                  height: '30px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  fontWeight: 700
                                }}
                                title="Bác bỏ minh chứng"
                              >
                                <X size={13} style={{ marginRight: 2 }} /> Bác bỏ
                              </button>
                            </>
                          )}

                          {/* Delete row */}
                          {!isLocked && (
                            <button
                              onClick={() => handleRemoveMilestoneRow(idx)}
                              style={{
                                padding: '0 8px',
                                height: '30px',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                background: 'transparent',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              title="Xóa đợt thanh toán"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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

      {showContactDrawer && selectedContact && (
        <CustomerProfileDrawer
          isOpen={showContactDrawer}
          onClose={() => setShowContactDrawer(false)}
          contact={selectedContact}
          onUpdate={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
