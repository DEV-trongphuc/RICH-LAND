import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, Plus, Trash2, Upload, AlertCircle, Loader2, Clock, Activity,
  CreditCard, Wallet, Edit, Check, Ban, Send, FileText, UserCheck, MessageSquare, Bell
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { CustomSelect } from './ui/CustomSelect';
import { CurrencyInput } from './ui/CurrencyInput';
import { Avatar } from './ui/Avatar';
import { MentionInput } from './ui/MentionInput';
import { CustomModal } from './ui/CustomModal';
import { ConfirmModal } from './ui/ConfirmModal';
import { compressToWebP } from '../utils/imageCompress';
import { fetchAPI } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import { numberToVietnameseText } from '../utils/numberToText';
import { VietnameseDateInput } from './ui/VietnameseDateInput';
import { formatCommentBody } from '../utils/commentFormatter';

interface Deposit {
  id: number;
  contact_id: number;
  project_id: number;
  price: number;
  expected_commission: number;
  currency?: string;
  status: string;
  unit_code: string;
  created_by: number;
  contact_owner_id?: number;
  full_name?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  project_name?: string;
  creator_name?: string;
  creator_avatar?: string;
  milestones?: any[];
  auto_remind?: number;
  remind_days_before?: number;
  remind_at_hour?: number;
  remind_target?: number;
}

interface DepositDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deposit: any;
  onSaveSuccess: () => void;
  zIndex?: number;
}

export const DepositDetailDrawer: React.FC<DepositDetailDrawerProps> = ({
  isOpen,
  onClose,
  deposit,
  onSaveSuccess,
  zIndex
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addToast, showConfirm } = useUIStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeDrawerTab, setActiveDrawerTab] = useState<'comments' | 'history'>('comments');
  const [mobileDrawerTab, setMobileDrawerTab] = useState<'info' | 'discussion'>('info');
  
  const [selectedDepForManage, setSelectedDepForManage] = useState<any>(deposit);
  const [tempMilestones, setTempMilestones] = useState<any[]>(deposit?.milestones || []);
  const [isSavingMilestones, setIsSavingMilestones] = useState(false);
  const [actioningMilestoneId, setActioningMilestoneId] = useState<any>(null);
  const [actioningType, setActioningType] = useState<'approve' | 'reject' | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
  const [previewReminderMilestone, setPreviewReminderMilestone] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentEndRef = useRef<HTMLDivElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  const [sharesData, setSharesData] = useState<any[]>([]);
  const [tempExpectedCommission, setTempExpectedCommission] = useState<number>(deposit?.expected_commission || 0);
  const [tempSharesData, setTempSharesData] = useState<any[]>([]);
  const [isEditingCommission, setIsEditingCommission] = useState(false);
  
  const [autoRemindManage, setAutoRemindManage] = useState(deposit ? Number(deposit.auto_remind) === 1 : false);
  const [remindDaysBeforeManage, setRemindDaysBeforeManage] = useState(deposit ? Number(deposit.remind_days_before) || 3 : 3);
  const [remindAtHourManage, setRemindAtHourManage] = useState(deposit ? Number(deposit.remind_at_hour) || 8 : 8);
  const [remindTargetManage, setRemindTargetManage] = useState(deposit ? Number(deposit.remind_target) || 2 : 2);
  const [manualRemindTarget, setManualRemindTarget] = useState<number>(2);

  // Edit SO modal states
  const [isEditSOOpen, setIsEditSOOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editUnitCode, setEditUnitCode] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCurrency, setEditCurrency] = useState('VND');
  const [editExchangeRate, setEditExchangeRate] = useState<number>(1);
  const [editCreatedBy, setEditCreatedBy] = useState('');
  const [editExpectedCommissionVal, setEditExpectedCommissionVal] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');
  const [isSavingSOInfo, setIsSavingSOInfo] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  // Cancel transaction states
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director', 'accountant', 'marketing'].includes(user.role);
  const canEditExpectedCommission = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'accountant'].includes(user.role);
  const canEditAllSOInfo = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'accountant'].includes(user.role);
  const canEditMilestones = isAdmin || (selectedDepForManage && (
    String(selectedDepForManage.created_by) === String(user?.id) ||
    String(selectedDepForManage.contact_owner_id) === String(user?.id)
  ));

  const handleOpenEditSO = async () => {
    if (!selectedDepForManage) return;
    setEditFullName(selectedDepForManage.full_name || selectedDepForManage.client_name || selectedDepForManage.contact_name || '');
    setEditPhone(selectedDepForManage.phone || '');
    setEditEmail(selectedDepForManage.email || '');
    setEditProjectId(String(selectedDepForManage.project_id || ''));
    setEditUnitCode(selectedDepForManage.unit_code || '');
    setEditPrice(Number(selectedDepForManage.price) || 0);
    setEditCurrency(selectedDepForManage.currency || 'VND');
    setEditExchangeRate(Number(selectedDepForManage.exchange_rate) || 1);
    setEditCreatedBy(String(selectedDepForManage.created_by || ''));
    setEditExpectedCommissionVal(Number(selectedDepForManage.expected_commission) || 0);
    setEditNotes(selectedDepForManage.notes || '');

    if (availableProjects.length === 0) {
      try {
        const pRes = await fetchAPI('projects');
        if (pRes?.data && Array.isArray(pRes.data)) setAvailableProjects(pRes.data);
        else if (Array.isArray(pRes)) setAvailableProjects(pRes);
      } catch (e) {}
    }
    if (availableUsers.length === 0) {
      try {
        const uRes = await fetchAPI('users');
        if (uRes?.data && Array.isArray(uRes.data)) setAvailableUsers(uRes.data);
        else if (Array.isArray(uRes)) setAvailableUsers(uRes);
      } catch (e) {}
    }

    setIsEditSOOpen(true);
  };

  const handleSaveSOInfo = async () => {
    if (!selectedDepForManage?.id) return;
    if (!editFullName.trim()) {
      addToast('Tên khách hàng không được để trống.', 'error');
      return;
    }
    if (!editProjectId) {
      addToast('Vui lòng chọn dự án.', 'error');
      return;
    }
    setIsSavingSOInfo(true);
    try {
      const payload = {
        contact_name: editFullName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        project_id: Number(editProjectId),
        unit_code: editUnitCode.trim(),
        price: editPrice,
        currency: editCurrency,
        exchange_rate: editExchangeRate,
        created_by: editCreatedBy ? Number(editCreatedBy) : selectedDepForManage.created_by,
        expected_commission: editExpectedCommissionVal,
        notes: editNotes.trim()
      };
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        addToast('Cập nhật thông tin phiếu cọc thành công!', 'success');
        const projName = availableProjects.find(p => String(p.id) === String(editProjectId))?.name || selectedDepForManage.project_name;
        const creatorName = availableUsers.find(u => String(u.id) === String(editCreatedBy))?.name || selectedDepForManage.creator_name;
        
        setSelectedDepForManage((prev: any) => ({
          ...prev,
          full_name: editFullName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          project_id: Number(editProjectId),
          project_name: projName,
          unit_code: editUnitCode.trim(),
          price: editPrice,
          currency: editCurrency,
          exchange_rate: editExchangeRate,
          created_by: editCreatedBy ? Number(editCreatedBy) : prev?.created_by,
          creator_name: creatorName,
          expected_commission: editExpectedCommissionVal,
          notes: editNotes.trim()
        }));
        setIsEditSOOpen(false);
        onSaveSuccess();
        loadHistory();
      } else {
        addToast(res.message || 'Lỗi cập nhật thông tin phiếu cọc', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSavingSOInfo(false);
    }
  };

  // Initialize and load dependencies when deposit changes
  useEffect(() => {
    if (deposit) {
      setSelectedDepForManage(deposit);
      setTempMilestones((deposit.milestones || []).map((m: any) => ({ ...m })));
      setSharesData([]);
      setTempExpectedCommission(Number(deposit.expected_commission) || 0);
      setTempSharesData([]);
      setIsEditingCommission(false);
      setAutoRemindManage(Number(deposit.auto_remind) === 1);
      setRemindDaysBeforeManage(Number(deposit.remind_days_before) || 3);
      setRemindAtHourManage(Number(deposit.remind_at_hour) || 8);
      setRemindTargetManage(Number(deposit.remind_target) || 2);

      // Fetch customer details if email is missing
      if (!deposit.email && deposit.contact_id) {
        fetchAPI(`contacts/${deposit.contact_id}`)
          .then(res => {
            const c = res.data || res;
            if (c && c.email) {
              setSelectedDepForManage((prev: any) => prev ? { ...prev, email: c.email } : null);
            }
          })
          .catch(err => console.error("Error fetching contact email:", err));
      }

      // Load co-op shares
      fetchAPI(`cooperation-slips?contact_id=${deposit.contact_id}`)
        .then(res => {
          const slips = res.data || res || [];
          if (slips.length > 0) {
            const matchedSlip = slips.find((s: any) => Number(s.deposit_slip_id) === Number(deposit.id));
            if (matchedSlip && matchedSlip.shareholders) {
              setSharesData(matchedSlip.shareholders);
              setTempSharesData(matchedSlip.shareholders.map((sh: any) => ({ ...sh })));
            }
          }
        })
        .catch(err => console.error("Error loading cooperation shares:", err));
    }
  }, [deposit]);

  // Load comments and history when open
  const loadComments = async (isInitial = false) => {
    if (!selectedDepForManage?.id) return;
    setLoadingComments(true);
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/comments`);
      if (res.success) {
        const commentsList = res.data || [];
        setComments(commentsList);
        const searchParams = new URLSearchParams(window.location.search);
        const highlightCommentId = searchParams.get('highlight_comment_id');

        if (highlightCommentId) {
          setActiveDrawerTab('comments');
          setMobileDrawerTab('discussion');
          setTimeout(() => {
            const el = document.getElementById(`deposit-comment-${highlightCommentId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 350);
        } else if (isInitial) {
          if (commentsList.length === 0) {
            setActiveDrawerTab('history');
          } else {
            setActiveDrawerTab('comments');
          }
        }
        setTimeout(() => {
          if (!highlightCommentId && commentsContainerRef.current) {
            commentsContainerRef.current.scrollTop = 0;
          }
        }, 50);
      }
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!selectedDepForManage?.id) return;
    try {
      const res = await fetchAPI(`deposits/comments/${commentId}`, { method: 'DELETE' });
      if (res.success) {
        addToast(t('Đã xóa bình luận!'), 'success');
        loadComments();
      } else {
        addToast(res.message || t('Không thể xóa bình luận'), 'error');
      }
    } catch (err: any) {
      addToast(t('Lỗi khi xóa bình luận: ') + err.message, 'error');
    }
  };

  const loadHistory = async () => {
    if (!selectedDepForManage?.id) return;
    setLoadingHistory(true);
    try {
      const res = await fetchAPI(`activities?related_type=deposit&related_id=${selectedDepForManage.id}`);
      if (res && res.success) {
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
        setHistoryLogs(list);
      } else {
        setHistoryLogs([]);
      }
    } catch (err) {
      console.error("Error loading history:", err);
      setHistoryLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedDepForManage?.id) {
      loadComments(true);
      loadHistory();
    }
  }, [isOpen, selectedDepForManage?.id]);

  const handleAddComment = async () => {
    const hasContent = newCommentText.includes('<img') || 
                       newCommentText.includes('comment-attachment-chip') || 
                       newCommentText.includes('<a') ||
                       !!newCommentText.replace(/<[^>]*>/g, '').trim();
    if (!hasContent || !selectedDepForManage?.id || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: newCommentText })
      });
      if (res.success) {
        setNewCommentText('');
        addToast('Gửi bình luận thành công!', 'success');
        setActiveDrawerTab('comments');
        await Promise.all([loadComments(), loadHistory()]);
      } else {
        addToast(res.message || 'Lỗi gửi bình luận', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleTempSharePercentChange = (sIdx: number, val: string) => {
    const updated = [...tempSharesData];
    updated[sIdx].percentage = parseInt(val) || 0;
    setTempSharesData(updated);
  };

  const handleAddMilestoneRow = () => {
    const isForeign = selectedDepForManage && selectedDepForManage.currency !== 'VND';
    setTempMilestones([
      ...tempMilestones,
      {
        tempId: Date.now() + Math.random(),
        milestone_name: `Đợt ${tempMilestones.length + 1}`,
        expected_amount: 0,
        original_amount: isForeign ? 0 : null,
        status: 'pending',
        expected_pay_date: new Date().toLocaleDateString('sv-SE')
      }
    ]);
  };

  const handleUpdateMilestoneField = (index: number, field: string, value: any) => {
    const updated = [...tempMilestones];
    updated[index] = { ...updated[index], [field]: value };
    setTempMilestones(updated);
  };

  const handleRemoveMilestoneRow = (index: number) => {
    showConfirm({
      title: 'Xóa đợt thanh toán',
      message: 'Bạn có chắc chắn muốn xóa đợt thanh toán này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: () => {
        const updated = [...tempMilestones];
        updated.splice(index, 1);
        setTempMilestones(updated);
        return Promise.resolve();
      }
    });
  };

  const handleUploadUncFromModal = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const m = tempMilestones[index];
    if (!selectedDepForManage || !m.id) return;
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      let fileToUpload: File = file;
      if (file.type.startsWith('image/')) {
        try {
          fileToUpload = await compressToWebP(file);
        } catch (cErr) {
          fileToUpload = file;
        }
      }
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${m.id}`, {
        method: 'POST',
        body: formData
      });

      if (res.success && res.data?.unc_file_path) {
        addToast('Tải chứng từ UNC thành công!', 'success');
        const updated = [...tempMilestones];
        updated[index] = { ...updated[index], status: 'paid', unc_file_path: res.data.unc_file_path };
        setTempMilestones(updated);
        onSaveSuccess();
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
    if (actioningMilestoneId !== null) return;

    const performApproval = async (actualAmt?: number) => {
      setActioningMilestoneId(m.id);
      setActioningType('approve');
      try {
        const body = actualAmt !== undefined ? { actual_amount: actualAmt } : {};
        const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${m.id}/approve`, { 
          method: 'POST',
          body: JSON.stringify(body)
        });
        if (res.success) {
          addToast('Ghi nhận đợt tiền thành công!', 'success');
          const updated = [...tempMilestones];
          updated[index] = { ...updated[index], status: 'approved', actual_amount: actualAmt || m.expected_amount };
          setTempMilestones(updated);
          onSaveSuccess();
        } else {
          addToast(res.message || 'Lỗi ghi nhận', 'error');
        }
      } catch (e: any) {
        addToast(e.message || 'Lỗi kết nối', 'error');
      } finally {
        setActioningMilestoneId(null);
        setActioningType(null);
      }
    };

    const studentName = selectedDepForManage.full_name || selectedDepForManage.client_name || selectedDepForManage.contact_name || 'Khách hàng';
    const payDateFormatted = m.expected_pay_date ? new Date(m.expected_pay_date).toLocaleDateString('vi-VN') : 'Chưa thiết lập';

    const amountFormatted = formatMoney(m.expected_amount || 0, 'VND');
    showConfirm({
      title: 'Xác nhận ghi nhận thanh toán',
      message: `Bạn có chắc chắn muốn ghi nhận đợt thanh toán này?\n\n• Nội dung: ${m.milestone_name || 'Đợt thanh toán'}\n• Khách hàng: ${studentName}\n• Ngày thanh toán: ${payDateFormatted}\n• Số tiền: ${amountFormatted}`,
      confirmText: 'Xác nhận ghi nhận',
      cancelText: 'Hủy bỏ',
      onConfirm: async () => {
        await performApproval();
      }
    });
  };

  const handleRejectFromModal = async (index: number) => {
    const m = tempMilestones[index];
    if (!selectedDepForManage || !m.id) return;
    if (actioningMilestoneId !== null) return;
    showConfirm({
      title: 'Từ chối UNC',
      message: 'Vui lòng nhập lý do từ chối bản xác nhận thanh toán này:',
      confirmText: 'Từ chối UNC',
      cancelText: 'Hủy',
      isDanger: true,
      requirePromptInput: true,
      promptPlaceholder: 'Nhập lý do từ chối (bắt buộc)...',
      onConfirm: async (reason) => {
        setActioningMilestoneId(m.id);
        setActioningType('reject');
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
            onSaveSuccess();
          } else {
            addToast(res.message || 'Lỗi xử lý', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        } finally {
          setActioningMilestoneId(null);
          setActioningType(null);
        }
      }
    });
  };

  const handleSaveMilestones = async () => {
    if (!selectedDepForManage) return;
    for (let i = 0; i < tempMilestones.length; i++) {
      const m = tempMilestones[i];
      if (!m.milestone_name.trim()) {
        addToast('Tên đợt không được để trống.', 'error');
        return;
      }
      const amt = m.expected_amount;
      if (!amt || parseFloat(String(amt)) <= 0) {
        addToast(`Vui lòng nhập số tiền hợp lệ cho đợt "${m.milestone_name}".`, 'error');
        return;
      }
      if (!m.expected_pay_date) {
        addToast(`Vui lòng chọn ngày thanh toán dự kiến cho đợt "${m.milestone_name}".`, 'error');
        return;
      }
    }

    const totalM = tempMilestones.reduce((acc, m) => acc + (parseFloat(String(m.expected_amount)) || 0), 0);
    const syncPrice = Math.max(parseFloat(String(selectedDepForManage.price)) || 0, totalM);

    if (isAdmin && tempSharesData && tempSharesData.length > 0) {
      const totalPct = tempSharesData.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
      if (totalPct !== 100) {
        addToast('Tổng tỷ lệ chia sẻ hoa hồng phải bằng 100%.', 'error');
        return;
      }
    }

    try {
      setIsSavingMilestones(true);
      const payload: any = {
        milestones: tempMilestones,
        price: syncPrice,
        auto_remind: autoRemindManage ? 1 : 0,
        remind_days_before: remindDaysBeforeManage,
        remind_at_hour: remindAtHourManage,
        remind_target: remindTargetManage
      };
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
        onClose();
        onSaveSuccess();
      } else {
        addToast(res.message || 'Lỗi khi lưu lịch trình', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSavingMilestones(false);
    }
  };

  const handleOpenCancel = () => {
    setCancelReason('');
    setIsCancelOpen(true);
  };

  const handleCancelDeposit = async () => {
    if (!selectedDepForManage) return;
    if (!cancelReason.trim()) {
      addToast('Vui lòng nhập lý do hủy giao dịch.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason })
      });
      if (res.success) {
        addToast('Đã báo bể cọc và hủy giao dịch thành công!', 'success');
        setIsCancelOpen(false);
        onClose();
        onSaveSuccess();
      } else {
        addToast(res.message || 'Lỗi hủy giao dịch', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatMoney = (amount: number | string | undefined, curr = 'VND') => {
    const val = parseFloat(String(amount || 0));
    return val.toLocaleString('vi-VN') + ' ₫';
  };

  if (!isOpen || !selectedDepForManage) return null;

  const totalApprovedMilestones = tempMilestones
    .filter(m => m.status === 'approved')
    .reduce((sum, m) => {
      const amt = m.actual_amount !== null && m.actual_amount !== undefined ? m.actual_amount : m.expected_amount;
      return sum + (parseFloat(amt) || 0);
    }, 0);

  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 280);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isClosing]);

  const baseZIndex = Math.min(zIndex || 2000000, 2147483630);

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && !isClosing && (
          <div style={{ position: 'fixed', inset: 0, zIndex: baseZIndex, display: 'flex', justifyContent: 'flex-end' }}>
            {/* Overlay */}
            <motion.div
              className="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as any }}
              onClick={handleClose}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: baseZIndex + 5
              }}
            />
            {/* Drawer panel */}
            <motion.div
              initial={window.innerWidth < 768 ? { y: '100%' } : { opacity: 0, x: '250px' }}
              animate={{ y: 0, x: 0, opacity: 1 }}
              exit={window.innerWidth < 768 ? { y: '60%', opacity: 0 } : { opacity: 0, x: '60%' }}
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as any }}
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: window.innerWidth < 768 ? 0 : 'var(--sidebar-width, 220px)',
                right: 0,
                backgroundColor: 'var(--color-surface)',
                boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: baseZIndex + 10
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleClose}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '8px',
                      color: 'var(--color-text-muted)',
                      transition: 'background 0.2s, color 0.2s',
                      marginLeft: '-4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-surface-hover)';
                      e.currentTarget.style.color = 'var(--color-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = 'var(--color-text-muted)';
                    }}
                    title="Quay lại"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <h2 style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', whiteSpace: isMobile ? 'nowrap' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Chi tiết & Lịch trình phiếu đặt cọc
                  </h2>
                </div>

                {/* Actions & Close area top right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Sửa thông tin SO button for Accountant / Admin */}
                  {canEditAllSOInfo && (
                    <button
                      type="button"
                      onClick={handleOpenEditSO}
                      style={{
                        padding: '6px 12px',
                        height: '34px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        color: '#2563eb',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
                      title="Chỉnh sửa thông tin phiếu đặt cọc"
                    >
                      <Edit size={14} />
                      <span>Sửa phiếu cọc</span>
                    </button>
                  )}

                  {/* Hủy giao dịch button */}
                  {selectedDepForManage.status !== 'cancelled' && (() => {
                    const isCreator = String(selectedDepForManage.created_by) === String(user?.id);
                    const isOwner = String(selectedDepForManage.contact_owner_id) === String(user?.id);
                    const isStaff = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director', 'accountant', 'marketing'].includes(user.role);
                    if (isStaff || isCreator || isOwner) {
                      return (
                        <button
                          onClick={handleOpenCancel}
                          style={{
                            padding: '6px 14px',
                            height: '34px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          }}
                        >
                          <Ban size={14} />
                          <span>Hủy giao dịch</span>
                        </button>
                      );
                    }
                    return null;
                  })()}

                  {/* Lưu lịch trình button */}
                  {canEditMilestones && (
                    <button
                      className="btn primary"
                      onClick={handleSaveMilestones}
                      style={{ height: '34px', minWidth: 100, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      disabled={isSavingMilestones}
                    >
                      {isSavingMilestones ? 'Đang lưu...' : 'Lưu lịch trình'}
                    </button>
                  )}

                  {/* Close button X */}
                  <button
                    onClick={handleClose}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: '8px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s',
                      zIndex: 10
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    title="Đóng"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Mobile Navigation Tabs */}
              {isMobile && (
                <div style={{
                  display: 'flex',
                  background: 'var(--color-bg)',
                  padding: '6px',
                  borderBottom: '1px solid var(--color-border-light)',
                  gap: '4px',
                  flexShrink: 0
                }}>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerTab('info')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: mobileDrawerTab === 'info' ? 'var(--color-surface)' : 'transparent',
                      color: mobileDrawerTab === 'info' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: mobileDrawerTab === 'info' ? 750 : 600,
                      fontSize: '0.8125rem',
                      boxShadow: mobileDrawerTab === 'info' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <FileText size={14} />
                    <span>Thông tin chi tiết</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerTab('discussion')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: mobileDrawerTab === 'discussion' ? 'var(--color-surface)' : 'transparent',
                      color: mobileDrawerTab === 'discussion' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: mobileDrawerTab === 'discussion' ? 750 : 600,
                      fontSize: '0.8125rem',
                      boxShadow: mobileDrawerTab === 'discussion' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <MessageSquare size={14} />
                    <span>Thảo luận {comments.length > 0 ? `(${comments.length})` : ''}</span>
                  </button>
                </div>
              )}

              {/* Drawer Body (Dual Pane) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>
                {/* Left Pane (Details & Milestones) */}
                {(!isMobile || mobileDrawerTab === 'info') && (
                <div className="custom-scrollbar" style={{ flex: isMobile ? 1 : 1.3, width: isMobile ? '100%' : 'auto', minWidth: 0, padding: isMobile ? '1rem 1rem 120px 1rem' : '1.5rem 1.5rem 150px 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    background: 'var(--color-surface)',
                    padding: isMobile ? '14px' : '20px',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border-light)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {/* Top Row: Customer & Project */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: isMobile ? '12px' : '20px' }}>
                      {/* Left: Customer Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Avatar
                          src={selectedDepForManage.avatar_url}
                          name={selectedDepForManage.full_name || ''}
                          size="lg"
                          style={{ width: '52px', height: '52px', fontSize: '1.2rem' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>
                            {selectedDepForManage.full_name}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            SĐT: <strong style={{ color: 'var(--color-text)' }}>{selectedDepForManage.phone || '—'}</strong>
                          </span>
                          {selectedDepForManage.email && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                              Email: <strong style={{ color: 'var(--color-text)' }}>{selectedDepForManage.email}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Project */}
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                        <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dự án & Căn hộ</span>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-text)', wordBreak: 'break-word' }}>
                          {selectedDepForManage.unit_code && selectedDepForManage.unit_code !== '—' && selectedDepForManage.unit_code !== '-' && selectedDepForManage.unit_code.trim() !== ''
                            ? `${selectedDepForManage.project_name} (${selectedDepForManage.unit_code})`
                            : selectedDepForManage.project_name}
                        </span>
                      </div>
                    </div>

                    <div style={{ height: '1px', background: 'var(--color-border-light)' }} />

                    {/* Bottom Row: Caretaker & Financials */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 2fr', gap: isMobile ? '14px' : '20px', alignItems: 'center' }}>
                      {/* Left: Caretaker info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Nhân sự phụ trách & hoa hồng
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
                                  background: 'var(--color-bg-light)',
                                  border: '1px solid var(--color-border-light)',
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  width: '100%'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Avatar src={sh.avatar} name={sh.name} size="md" style={{ width: '28px', height: '28px' }} />
                                  <span style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--color-text)' }}>{sh.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={sh.percentage}
                                    onChange={(e) => handleTempSharePercentChange(sIdx, e.target.value)}
                                    className="form-input"
                                    style={{ width: '55px', height: '24px', textAlign: 'center', padding: '2px', fontSize: '0.75rem', margin: 0 }}
                                  />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : sharesData && sharesData.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            {sharesData.map((sh, sIdx) => (
                              <div
                                key={sIdx}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <Avatar src={sh.avatar} name={sh.name} size="md" style={{ width: '28px', height: '28px' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                  <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-text)' }}>{sh.name}</span>
                                  <span style={{
                                    fontSize: '0.675rem',
                                    fontWeight: 700,
                                    color: '#2563eb'
                                  }}>
                                    Đóng góp: {sh.percentage}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={selectedDepForManage.owner_avatar || selectedDepForManage.creator_avatar} name={selectedDepForManage.owner_name || selectedDepForManage.creator_name || 'Chưa xác định'} size="md" style={{ width: '28px', height: '28px' }} />
                            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedDepForManage.owner_name || selectedDepForManage.creator_name || 'Chưa xác định'}</span>
                          </div>
                        )}
                      </div>

                      {/* Financial Stat Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', width: '100%' }}>
                        {/* Card 1: Tổng giá trị & Thực thu */}
                        <div className="stat-card hover-lift" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '1rem',
                          minHeight: '120px',
                          borderRadius: '12px',
                          border: '1px solid var(--color-border-light)',
                          position: 'relative',
                          overflow: 'hidden',
                          justifyContent: 'space-between',
                          background: 'var(--color-surface)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Tổng giá trị
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: 'var(--color-primary, #BD1D2D)' }}>
                              <CreditCard size={16} />
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                              {formatMoney(selectedDepForManage.price, 'VND')}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                                Thực thu: <strong style={{ color: '#2563eb' }}>{formatMoney(totalApprovedMilestones, 'VND')}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card 2: Hoa hồng dự kiến */}
                        <div className="stat-card hover-lift" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '1rem',
                          minHeight: '120px',
                          borderRadius: '12px',
                          border: '1px solid var(--color-border-light)',
                          position: 'relative',
                          overflow: 'hidden',
                          justifyContent: 'space-between',
                          background: 'var(--color-surface)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Hoa hồng dự kiến
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                              <Wallet size={16} />
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669', lineHeight: 1.1 }}>
                              {formatMoney(tempExpectedCommission || selectedDepForManage.expected_commission || 0, 'VND')}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>
                              Quy chuẩn theo quy chế công ty
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Milestones Payment Section */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    background: 'var(--color-surface)',
                    padding: isMobile ? '14px' : '20px',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border-light)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} style={{ color: 'var(--color-primary)' }} />
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                          Lịch trình các đợt thanh toán ({tempMilestones.length} đợt)
                        </h4>
                      </div>
                      {canEditMilestones && (
                        <button
                          type="button"
                          onClick={handleAddMilestoneRow}
                          className="btn sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(189, 29, 45, 0.08)',
                            color: 'var(--color-primary, #BD1D2D)',
                            border: '1px solid rgba(189, 29, 45, 0.2)'
                          }}
                        >
                          <Plus size={14} /> Thêm đợt
                        </button>
                      )}
                    </div>

                    {/* Milestones list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tempMilestones.map((m, idx) => {
                        const isApproved = m.status === 'approved';
                        const isPaid = m.status === 'paid';
                        const isFailed = m.status === 'failed';

                        return (
                          <div
                            key={m.id || m.tempId || idx}
                            style={{
                              display: 'flex',
                              flexDirection: isMobile ? 'column' : 'row',
                              alignItems: isMobile ? 'stretch' : 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              padding: '12px 14px',
                              borderRadius: '12px',
                              background: isApproved ? 'rgba(16, 185, 129, 0.04)' : isPaid ? 'rgba(59, 130, 246, 0.04)' : isFailed ? 'rgba(239, 68, 68, 0.04)' : 'var(--color-bg-light)',
                              border: isApproved ? '1px solid rgba(16, 185, 129, 0.2)' : isPaid ? '1px solid rgba(59, 130, 246, 0.2)' : isFailed ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--color-border-light)'
                            }}
                          >
                            {/* Left: Info & inputs */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
                              <span style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: isApproved ? '#10b981' : isPaid ? '#2563eb' : isFailed ? '#ef4444' : '#6b7280',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 800
                              }}>
                                {idx + 1}
                              </span>

                              <input
                                type="text"
                                value={m.milestone_name || ''}
                                onChange={(e) => handleUpdateMilestoneField(idx, 'milestone_name', e.target.value)}
                                placeholder="Tên đợt..."
                                className="form-input"
                                style={{ width: isMobile ? '100%' : '140px', height: '32px', fontSize: '0.8rem', fontWeight: 700, margin: 0 }}
                                disabled={!canEditMilestones}
                              />

                              <div style={{ width: isMobile ? '100%' : '160px' }}>
                                <CurrencyInput
                                  value={m.expected_amount || 0}
                                  onChange={(val) => handleUpdateMilestoneField(idx, 'expected_amount', val)}
                                  disabled={!canEditMilestones || isApproved}
                                  style={{ height: '32px', fontSize: '0.8rem', fontWeight: 700, margin: 0 }}
                                />
                              </div>

                              <div style={{ width: isMobile ? '100%' : '140px' }}>
                                <VietnameseDateInput
                                  value={m.expected_pay_date || ''}
                                  onChange={(val) => handleUpdateMilestoneField(idx, 'expected_pay_date', val)}
                                  disabled={!canEditMilestones}
                                  style={{ height: '32px', fontSize: '0.75rem', margin: 0 }}
                                />
                              </div>
                            </div>

                            {/* Right: Actions (UNC upload, Approval, Rejection) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                              {/* UNC upload / view */}
                              {m.id && (
                                <label style={{
                                  cursor: 'pointer',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: m.unc_file_path ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                                  color: m.unc_file_path ? '#059669' : '#2563eb',
                                  border: m.unc_file_path ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  margin: 0
                                }}>
                                  <Upload size={12} />
                                  <span>{m.unc_file_path ? 'Đổi UNC' : 'Nộp UNC'}</span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleUploadUncFromModal(e, idx)}
                                    style={{ display: 'none' }}
                                  />
                                </label>
                              )}

                              {/* View UNC link */}
                              {m.unc_file_path && (
                                <a
                                  href={m.unc_file_path.startsWith('http') ? m.unc_file_path : `${import.meta.env.VITE_API_URL || '/backend'}/${m.unc_file_path}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background: 'rgba(107, 114, 128, 0.08)',
                                    color: 'var(--color-text)',
                                    border: '1px solid var(--color-border-light)',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <span>Xem UNC</span>
                                </a>
                              )}

                              {/* Approve button for Manager/Admin */}
                              {isAdmin && !isApproved && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveFromModal(idx)}
                                  disabled={actioningMilestoneId === m.id}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: '#10b981',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Check size={12} /> Duyệt tiền
                                </button>
                              )}

                              {/* Reject UNC button for Manager/Admin */}
                              {isAdmin && isPaid && (
                                <button
                                  type="button"
                                  onClick={() => handleRejectFromModal(idx)}
                                  disabled={actioningMilestoneId === m.id}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <X size={12} /> Từ chối UNC
                                </button>
                              )}

                              {/* Delete row button */}
                              {canEditMilestones && !isApproved && tempMilestones.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMilestoneRow(idx)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px'
                                  }}
                                  title="Xóa đợt"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                )}

                {/* Right Pane (Discussion & Comments & History) */}
                {(!isMobile || mobileDrawerTab === 'discussion') && (
                <div style={{
                  flex: isMobile ? 1 : 1,
                  width: isMobile ? '100%' : 'auto',
                  borderLeft: isMobile ? 'none' : '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--color-surface)'
                }}>
                  {/* Discussion & History Navigation Tabs */}
                  <div style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '8px 12px',
                    gap: '8px',
                    background: 'var(--color-surface)'
                  }}>
                    <button
                      type="button"
                      onClick={() => setActiveDrawerTab('comments')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeDrawerTab === 'comments' ? 'rgba(189, 29, 45, 0.08)' : 'transparent',
                        color: activeDrawerTab === 'comments' ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted)',
                        fontWeight: activeDrawerTab === 'comments' ? 800 : 600,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <MessageSquare size={14} />
                      <span>Thảo luận ({comments.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDrawerTab('history')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeDrawerTab === 'history' ? 'rgba(189, 29, 45, 0.08)' : 'transparent',
                        color: activeDrawerTab === 'history' ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted)',
                        fontWeight: activeDrawerTab === 'history' ? 800 : 600,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Activity size={14} />
                      <span>Hoạt động ({Array.isArray(historyLogs) ? historyLogs.length : 0})</span>
                    </button>
                  </div>

                  {/* Tab contents */}
                  <div ref={commentsContainerRef} className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-bg-light, #f8f9fa)' }}>
                    {activeDrawerTab === 'comments' ? (
                      <>
                        {loadingComments ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                            <Loader2 size={20} className="animate-spin" />
                          </div>
                        ) : comments.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', gap: '8px' }}>
                            <MessageSquare size={28} style={{ opacity: 0.4 }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Chưa có thảo luận nào cho phiếu cọc này</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {comments.map((c) => {
                              const isCurrentUserAdmin = user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role);
                              const isCommentAuthor = user?.id && String(user.id) === String(c.user_id);
                              const canDeleteComment = isCurrentUserAdmin || isCommentAuthor;
                              const searchParams = new URLSearchParams(window.location.search);
                              const highlightCommentId = searchParams.get('highlight_comment_id');
                              const isHighlighted = highlightCommentId && String(c.id) === String(highlightCommentId);

                              return (
                                <div 
                                  key={c.id} 
                                  id={`deposit-comment-${c.id}`}
                                  style={{ 
                                    display: 'flex', 
                                    gap: '12px', 
                                    background: isHighlighted ? 'rgba(189, 29, 45, 0.08)' : 'var(--color-surface, #fff)', 
                                    border: isHighlighted ? '2px solid var(--color-primary, #BD1D2D)' : '1px solid var(--color-border-light)', 
                                    padding: '14px 18px', 
                                    borderRadius: '16px', 
                                    boxShadow: isHighlighted ? '0 0 16px rgba(189, 29, 45, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.02)',
                                    boxSizing: 'border-box',
                                    transition: 'all 0.3s ease'
                                  }}
                                >
                                  <Avatar src={c.avatar_url} name={c.user_name} size={32} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text)' }}>{c.user_name}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                          {new Date(c.created_at).toLocaleString('vi-VN')}
                                        </span>
                                        {canDeleteComment && (
                                          <button
                                            onClick={() => handleDeleteComment(c.id)}
                                            style={{ 
                                              background: 'none', 
                                              border: 'none', 
                                              color: 'var(--color-danger, #ef4444)', 
                                              cursor: 'pointer', 
                                              display: 'inline-flex', 
                                              alignItems: 'center', 
                                              padding: '4px' 
                                            }}
                                            title="Xóa bình luận"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ marginTop: '6px', textAlign: 'left' }}>
                                      {c.body && (/<[a-z][\s\S]*>/i.test(c.body) || /[📕📄📊📝📦🖼️📎]/.test(c.body)) ? (
                                        <div 
                                          className="rich-comment-content"
                                          dangerouslySetInnerHTML={{ __html: formatCommentBody(c.body) }}
                                          style={{ fontSize: '0.825rem', color: 'var(--color-text-light)', lineHeight: '1.45', textAlign: 'left' }}
                                        />
                                      ) : (
                                        <div style={{ fontSize: '0.825rem', color: 'var(--color-text-light)', lineHeight: '1.45', whiteSpace: 'pre-wrap', textAlign: 'left', wordBreak: 'break-word' }}>
                                          {c.body}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={commentEndRef} />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {loadingHistory ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                            <Loader2 size={20} className="animate-spin" />
                          </div>
                        ) : (!Array.isArray(historyLogs) || historyLogs.length === 0) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', gap: '8px' }}>
                            <Clock size={28} style={{ opacity: 0.4 }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Chưa ghi nhận lịch sử nào</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', paddingLeft: '28px' }}>
                            <div style={{ position: 'absolute', top: '18px', bottom: '18px', left: '12px', width: '2px', background: 'var(--color-border-light, #e2e8f0)' }} />
                            {(Array.isArray(historyLogs) ? historyLogs : []).map((log) => (
                              <div key={log.id} style={{ position: 'relative' }}>
                                <div style={{
                                  position: 'absolute',
                                  top: '18px',
                                  left: '-21px',
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: '#cbd5e1',
                                  border: '2px solid var(--color-surface, #fff)',
                                  boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.03)',
                                  zIndex: 2
                                }} />
                                <div style={{ display: 'flex', gap: '10px', background: 'transparent', border: 'none', padding: '6px 0' }}>
                                  <Avatar src={log.avatar_url} name={log.user_name || 'Hệ thống'} size={24} />
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                        {log.user_name || 'Hệ thống'}
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>•</span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                        {new Date(log.created_at).toLocaleString('vi-VN')}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', lineHeight: 1.4 }}>
                                      {log.description || log.action || log.note || 'Cập nhật phiếu đặt cọc'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Send Comment Input */}
                  {activeDrawerTab === 'comments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border)', padding: '12px', background: 'var(--color-bg-light, #f8f9fa)' }}>
                      <div style={{ background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border-light)', padding: '10px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'var(--shadow-sm)' }}>
                        <MentionInput
                          value={newCommentText}
                          onChange={(e: any) => setNewCommentText(e.target.value)}
                          placeholder="Viết bình luận... Gõ @ để nhắc tên đồng nghiệp"
                          style={{ 
                            width: '100%', 
                            minHeight: '65px', 
                            border: 'none', 
                            borderRadius: 0, 
                            outline: 'none', 
                            background: 'transparent', 
                            color: 'var(--color-text)', 
                            boxSizing: 'border-box'
                          }}
                          disabled={isSubmittingComment}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '6px', borderTop: '1px dashed var(--color-border-light)' }}>
                          {(() => {
                            const hasContent = newCommentText.includes('<img') || 
                                               newCommentText.includes('comment-attachment-chip') || 
                                               newCommentText.includes('<a') ||
                                               !!(newCommentText && newCommentText.replace(/<[^>]*>/g, '').trim());
                            return (
                              <button
                                type="button"
                                disabled={isSubmittingComment || !hasContent}
                                onClick={handleAddComment}
                                className="btn primary sm"
                                style={{
                                  padding: '6px 18px',
                                  fontSize: '0.78rem',
                                  borderRadius: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  background: 'var(--color-primary, #BD1D2D)',
                                  borderColor: 'var(--color-primary, #BD1D2D)',
                                  color: '#fff',
                                  cursor: hasContent ? 'pointer' : 'not-allowed',
                                  opacity: hasContent ? 1 : 0.6,
                                  border: 'none'
                                }}
                              >
                                {isSubmittingComment ? (
                                  <>
                                    <Loader2 size={13} className="spin animate-spin" /> Đang gửi...
                                  </>
                                ) : (
                                  <>
                                    <Send size={13} /> <span>Gửi</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit SO Modal for Accountant & Admin */}
      <CustomModal
        isOpen={isEditSOOpen}
        onClose={() => setIsEditSOOpen(false)}
        title="Chỉnh sửa thông tin phiếu đặt cọc"
        width="650px"
        zIndex={baseZIndex + 60}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '75vh', overflowY: 'auto', padding: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Họ và tên khách hàng *</label>
              <input
                type="text"
                className="form-input"
                value={editFullName}
                onChange={e => setEditFullName(e.target.value)}
                placeholder="Nhập tên khách hàng..."
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Số điện thoại</label>
              <input
                type="text"
                className="form-input"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                placeholder="Nhập số điện thoại..."
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Dự án *</label>
              <CustomSelect
                value={editProjectId}
                onChange={val => setEditProjectId(val)}
                options={availableProjects.map(p => ({ label: p.name, value: String(p.id) }))}
                placeholder="Chọn dự án..."
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Mã căn hộ</label>
              <input
                type="text"
                className="form-input"
                value={editUnitCode}
                onChange={e => setEditUnitCode(e.target.value)}
                placeholder="Ví dụ: A-12.05..."
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Giá trị giao dịch (VND) *</label>
              <CurrencyInput
                value={editPrice}
                onChange={val => setEditPrice(val)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Hoa hồng dự kiến (VND)</label>
              <CurrencyInput
                value={editExpectedCommissionVal}
                onChange={val => setEditExpectedCommissionVal(val)}
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Ghi chú đơn hàng</label>
            <textarea
              className="form-input"
              rows={3}
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="Ghi chú thêm..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', marginTop: '6px' }}>
            <button className="btn" onClick={() => setIsEditSOOpen(false)}>
              Hủy
            </button>
            <button className="btn primary" onClick={handleSaveSOInfo} disabled={isSavingSOInfo}>
              {isSavingSOInfo ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Cancel Transaction Modal */}
      <CustomModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Báo bể cọc / Hủy giao dịch"
        width="500px"
        zIndex={baseZIndex + 60}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.825rem' }}>
            <AlertCircle size={18} />
            <span>Hành động này sẽ đánh dấu giao dịch bị hủy và trả lead về trạng thái trước đó.</span>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Lý do hủy giao dịch *</label>
            <textarea
              className="form-input"
              rows={4}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Nhập lý do khách hàng hủy cọc..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
            <button className="btn" onClick={() => setIsCancelOpen(false)}>
              Đóng
            </button>
            <button 
              className="btn" 
              style={{ background: '#ef4444', color: '#fff', border: 'none' }}
              onClick={handleCancelDeposit} 
              disabled={isSaving}
            >
              {isSaving ? 'Đang xử lý...' : 'Xác nhận hủy giao dịch'}
            </button>
          </div>
        </div>
      </CustomModal>
    </>,
    document.body
  );
};
