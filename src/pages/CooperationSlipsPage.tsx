import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Check, X, ShieldAlert, UserPlus, PenTool, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Trash2, Paperclip, ExternalLink } from 'lucide-react';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Avatar } from '../components/ui/Avatar';
import { useUIStore } from '../store/uiStore';
import { useLocation, useNavigate } from 'react-router-dom';
import { Pagination } from '../components/ui/Pagination';
import { CopyButton } from '../components/ui/CopyButton';
import { CardSkeleton } from '../components/ui/Skeleton';
import { getModulePermissionScope } from '../store/authStore';

interface CooperationSlip {
  id: number;
  contact_id: number;
  deposit_slip_id: number;
  version: number;
  total_percentage: number;
  shares_json: string;
  signatures_json: string;
  status: 'pending_signatures' | 'pending_manager_approval' | 'approved' | 'rejected' | 'disputed' | 'approved_pending_signatures';
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
  team_id?: number | string;
}

function numberToVietnameseWords(num: number): string {
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  if (num === 0) return 'Không phần trăm';
  if (num === 100) return 'Một trăm phần trăm';
  
  let words = '';
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  
  if (tens > 1) {
    words += units[tens] + ' mươi';
    if (ones === 1) {
      words += ' mốt';
    } else if (ones === 5) {
      words += ' lăm';
    } else if (ones > 0) {
      words += ' ' + units[ones];
    }
  } else if (tens === 1) {
    words += 'mười';
    if (ones === 5) {
      words += ' lăm';
    } else if (ones > 0) {
      words += ' ' + units[ones];
    }
  } else {
    words += units[ones];
  }
  
  const result = words.trim();
  return (result.charAt(0).toUpperCase() + result.slice(1) + ' phần trăm').trim();
}

export default function CooperationSlipsPage() {
  const { addToast, showConfirm } = useUIStore();
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
  const location = useLocation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [changeReason, setChangeReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterSale, dateRange, statusFilter]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
    } else {
      setStatusFilter('all');
    }
  }, [location.search]);

  // Signature Modal state
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signingSlip, setSigningSlip] = useState<CooperationSlip | null>(null);
  const [signatureMethod, setSignatureMethod] = useState<'draw' | 'upload'>('draw');
  const [uploadedSignatureImg, setUploadedSignatureImg] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const [approvalSlip, setApprovalSlip] = useState<CooperationSlip | null>(null);
  const [isApproving, setIsApproving] = useState(false);

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
    
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Scale coordinates back to canvas original width/height to support responsiveness
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
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

  const writeScope = React.useMemo(() => {
    return getModulePermissionScope(user, 'cooperation', 'write');
  }, [user]);

  const readScope = React.useMemo(() => {
    return getModulePermissionScope(user, 'cooperation', 'read');
  }, [user]);

  const isManager = React.useMemo(() => {
    if (writeScope === 'all' || writeScope === 'team') return true;
    return ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(String(user?.role).toLowerCase());
  }, [user, writeScope]);

  const isApprover = React.useMemo(() => {
    if (writeScope === 'all') return true;
    return ['admin', 'superadmin', 'super_admin', 'director'].includes(String(user?.role).toLowerCase());
  }, [user, writeScope]);

  const filteredSlips = React.useMemo(() => {
    return slips.filter(slip => {
      // 0. Permission Matrix Read Scope
      if (readScope === 'none') return false;
      if (readScope === 'own') {
        const isShareholder = slip.shareholders?.some((s: any) => String(s.user_id) === String(user?.id)) || String(slip.created_by) === String(user?.id);
        if (!isShareholder) return false;
      }
      if (readScope === 'team') {
        const userTeamId = (user as any)?.team_id || (user as any)?.consultant_profile?.team_id;
        const isShareholder = slip.shareholders?.some((s: any) => String(s.user_id) === String(user?.id)) || String(slip.created_by) === String(user?.id);
        const isSameTeam = userTeamId && Number((slip as any).team_id) === Number(userTeamId);
        if (!isShareholder && !isSameTeam) return false;
      }
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

      // 4. Filter by Status
      if (statusFilter !== 'all') {
        const hasSigned = slip.shareholders.find(s => String(s.user_id) === String(user?.id))?.signed;
        const isShareholder = slip.shareholders.some(s => String(s.user_id) === String(user?.id));
        const allSigned = slip.shareholders.every(s => s.signed);
        const isPendingSignatures = (slip.status === 'pending_signatures' || slip.status === 'approved_pending_signatures') && !allSigned;

        if (statusFilter === 'pending_me') {
          const needsMySignature = isShareholder && isPendingSignatures && !hasSigned;
          const needsMyManagerApproval = isApprover && slip.status === 'pending_manager_approval';
          if (!needsMySignature && !needsMyManagerApproval) return false;
        } else if (statusFilter === 'pending_signatures') {
          if (!isPendingSignatures) return false;
        } else if (statusFilter === 'pending_manager') {
          if (slip.status !== 'pending_manager_approval') return false;
        } else if (statusFilter === 'approved') {
          if (slip.status !== 'approved') return false;
        } else if (statusFilter === 'rejected') {
          if (slip.status !== 'rejected') return false;
        }
      }

      return true;
    });
  }, [slips, searchQuery, filterSale, dateRange, statusFilter, user?.id, isManager, isApprover, readScope]);

  const paginatedSlips = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSlips.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSlips, currentPage]);

  const totalPages = Math.ceil(filteredSlips.length / ITEMS_PER_PAGE);

  const statusCounts = React.useMemo(() => {
    let pendingMe = 0;
    let pendingSignatures = 0;
    let pendingManager = 0;
    let approved = 0;
    let rejected = 0;

    slips.forEach(slip => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const fullName = `${slip.last_name} ${slip.first_name}`.toLowerCase();
        const matchCust = fullName.includes(query) || (slip.phone && slip.phone.includes(query));
        const matchUnit = slip.unit_code && slip.unit_code.toLowerCase().includes(query);
        const matchProj = slip.project_name && slip.project_name.toLowerCase().includes(query);
        const matchId = String(slip.id).includes(query);
        if (!matchCust && !matchUnit && !matchProj && !matchId) return;
      }

      // 2. Filter by Sale
      if (filterSale !== 'all') {
        const matchSale = slip.shareholders.some(sh => String(sh.user_id) === filterSale) || String(slip.created_by) === filterSale;
        if (!matchSale) return;
      }

      // 3. Filter by Time/Date Range
      const slipDateStr = slip.created_at.slice(0, 10);
      if (slipDateStr < dateRange.from || slipDateStr > dateRange.to) return;

      // 4. Calculate statuses
      const hasSigned = slip.shareholders.find(s => String(s.user_id) === String(user?.id))?.signed;
      const isShareholder = slip.shareholders.some(s => String(s.user_id) === String(user?.id));
      const allSigned = slip.shareholders.every(s => s.signed);
      const isPendingSignatures = (slip.status === 'pending_signatures' || slip.status === 'approved_pending_signatures') && !allSigned;

      const needsMySignature = isShareholder && isPendingSignatures && !hasSigned;
      const needsMyManagerApproval = isApprover && slip.status === 'pending_manager_approval';

      if (needsMySignature || needsMyManagerApproval) {
        pendingMe++;
      }
      if (isPendingSignatures) {
        pendingSignatures++;
      }
      if (slip.status === 'pending_manager_approval') {
        pendingManager++;
      }
      if (slip.status === 'approved') {
        approved++;
      }
      if (slip.status === 'rejected') {
        rejected++;
      }
    });

    return {
      pending_me: pendingMe,
      pending_signatures: pendingSignatures,
      pending_manager: pendingManager,
      approved,
      rejected
    };
  }, [slips, searchQuery, filterSale, dateRange, user?.id, isManager, isApprover]);

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

      try {
        const resUsers = await fetchAPI('users?all=1');
        if (resUsers.success) {
          const sales = (resUsers.data || []).filter((u: any) => u.role === 'sales' || u.role === 'sale');
          setSalesAccounts(sales);
        }
      } catch (err) {
        console.warn('Failed to load users for configurations:', err);
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleCoopAttachmentUpload = async (slipId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fd = new FormData();
    fd.append('file', file);
    
    try {
      const res = await fetchAPI(`cooperation-slips/${slipId}/upload-attachment`, {
        method: 'POST',
        body: fd
      });
      if (res.success) {
        addToast('Đã tải lên tài liệu hợp tác thành công!', 'success');
        loadData();
      } else {
        addToast(res.message || 'Lỗi khi tải lên tài liệu', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi khi tải lên tài liệu', 'error');
    }
  };

  const handleRemoveCoopAttachment = (slipId: number, fileUrl: string) => {
    showConfirm({
      title: 'Xóa tài liệu đính kèm',
      message: 'Bạn có chắc chắn muốn xóa tài liệu đính kèm này không? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI(`cooperation-slips/${slipId}/delete-attachment`, {
            method: 'POST',
            body: JSON.stringify({ file_url: fileUrl })
          });
          if (res.success) {
            addToast('Đã xóa tài liệu hợp tác thành công!', 'success');
            loadData();
          } else {
            addToast(res.message || 'Lỗi khi xóa tài liệu', 'error');
          }
        } catch (err: any) {
          addToast(err.message || 'Lỗi khi xóa tài liệu', 'error');
        }
      }
    });
  };

  const handleRenameCoopAttachment = (slipId: number, fileUrl: string) => {
    const filename = fileUrl.split('/').pop() || '';
    const cleanName = filename.substring(0, filename.lastIndexOf('.')) || filename;
    showConfirm({
      title: 'Đổi tên tài liệu hợp tác',
      message: 'Nhập tên mới cho tài liệu hợp tác:',
      requirePromptInput: true,
      promptPlaceholder: cleanName,
      confirmText: 'Lưu',
      cancelText: 'Hủy',
      onConfirm: async (newName) => {
        if (!newName || !newName.trim()) return;
        try {
          const res = await fetchAPI(`cooperation-slips/${slipId}/rename-attachment`, {
            method: 'POST',
            body: JSON.stringify({ file_url: fileUrl, name: newName.trim() })
          });
          if (res.success) {
            addToast('Đã đổi tên tài liệu hợp tác thành công!', 'success');
            loadData();
          } else {
            addToast(res.message || 'Lỗi khi đổi tên tài liệu', 'error');
          }
        } catch (err: any) {
          addToast(err.message || 'Lỗi khi đổi tên tài liệu', 'error');
        }
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const slipIdParam = searchParams.get('id') || searchParams.get('slip_id');
    if (slipIdParam && slips.length > 0) {
      const sid = Number(slipIdParam);
      if (sid) {
        setExpandedSlips(prev => ({ ...prev, [sid]: true }));
        setTimeout(() => {
          const element = document.getElementById(`coop-slip-row-${sid}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.boxShadow = '0 0 0 3px rgba(189, 29, 45, 0.2)';
            element.style.transition = 'all 0.5s ease';
            setTimeout(() => {
              element.style.boxShadow = '';
            }, 2500);
            
            // Clean URL parameters
            const newParams = new URLSearchParams(location.search);
            newParams.delete('id');
            newParams.delete('slip_id');
            navigate(location.pathname + (newParams.toString() ? '?' + newParams.toString() : ''), { replace: true });
          }
        }, 400);
      }
    }
  }, [location.search, slips, location.pathname, navigate]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const signIdParam = searchParams.get('sign_id');
    if (signIdParam && slips.length > 0) {
      const match = slips.find((s: any) => String(s.id) === String(signIdParam));
      if (match) {
        const sh = match.shareholders?.find((x: any) => String(x.user_id) === String(user?.id));
        if (sh && !sh.signed) {
          setSigningSlip(match);
          setIsSignModalOpen(true);
        } else {
          navigate(location.pathname, { replace: true });
        }
      }
    }
  }, [location.search, slips, user?.id, location.pathname, navigate]);

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
        addToast('Vui lòng chọn nhân viên và nhập đầy đủ tỷ lệ', 'error');
        return;
      }
      if (sharesMap[item.user_id]) {
        addToast('Nhân viên không được bị trùng lặp trong phiếu chia', 'error');
        return;
      }
      const val = parseInt(item.percentage) || 0;
      sharesMap[item.user_id] = val;
      sum += val;
    }

    if (sum !== 100) {
      addToast(`Tổng tỷ lệ chia sẻ hoa hồng phải bằng đúng 100% (Hiện tại là ${sum}%)`, 'error');
      return;
    }

    try {
      const res = await fetchAPI(`cooperation-slips/${selectedSlipId}/shares`, {
        method: 'PUT',
        body: JSON.stringify({ shares: sharesMap, reason: changeReason })
      });

      if (res.success) {
        addToast('Đã gửi yêu cầu thay đổi tỷ lệ thành công!', 'success');
        setIsUpdateOpen(false);
        setChangeReason('');
        loadData();
      } else {
        addToast(res.message || 'Lỗi cập nhật tỷ lệ', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleSignSlip = async (slipId: number, signatureImg: string) => {
    try {
      setIsSigning(true);
      const res = await fetchAPI(`cooperation-slips/${slipId}/sign`, { 
        method: 'POST',
        body: JSON.stringify({ signature_img: signatureImg })
      });
      if (res.success) {
        addToast('Ký xác nhận phiếu hợp tác thành công!', 'success');
        setIsSignModalOpen(false);
        setSigningSlip(null);
        navigate(location.pathname, { replace: true });
        loadData();
      } else {
        addToast(res.message || 'Lỗi ký xác nhận', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSigning(false);
    }
  };

  const handleApproveSlip = (slip: CooperationSlip) => {
    setApprovalSlip(slip);
  };

  const handleRejectSlip = async (slipId: number) => {
    setCustomPrompt({
      isOpen: true,
      title: 'Từ chối phiếu hợp tác',
      label: 'Nhập lý do bác bỏ phiếu hợp tác này:',
      value: '',
      onConfirm: async (reason: string) => {
        if (!reason.trim()) {
          addToast('Lý do từ chối không được bỏ trống.', 'error');
          return;
        }
        try {
          const res = await fetchAPI(`cooperation-slips/${slipId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
          });
          if (res.success) {
            addToast('Đã từ chối phiếu hợp tác và yêu cầu ký lại', 'success');
            loadData();
          } else {
            addToast(res.message || 'Lỗi từ chối', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  const handleCreateAdjustment = (slipId: number) => {
    showConfirm({
      title: 'Xác nhận tạo phiếu điều chỉnh',
      message: 'Bạn có chắc chắn muốn tạo phiếu điều chỉnh cho phiếu hợp tác này không? Phiếu cũ sẽ vẫn có hiệu lực cho đến khi phiếu điều chỉnh mới được ký duyệt hoàn tất.',
      confirmText: 'Tạo phiếu',
      cancelText: 'Hủy',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetchAPI(`cooperation-slips/${slipId}/adjustment`, {
            method: 'POST'
          });
          if (res.success) {
            addToast('Khởi tạo phiếu điều chỉnh thành công! Vui lòng ký duyệt phiếu mới.', 'success');
            loadData();
          } else {
            addToast(res.message || 'Lỗi tạo phiếu điều chỉnh', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        } finally {
          setLoading(false);
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

        {/* Filter Status */}
        <div style={{ width: '225px' }}>
          <CustomSelect
            value={statusFilter}
            onChange={val => setStatusFilter(String(val))}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { 
                value: 'pending_me', 
                label: 'Chờ tôi duyệt / ký',
                badge: { count: statusCounts.pending_me, color: '#BD1D2D' }
              },
              { 
                value: 'pending_signatures', 
                label: 'Chờ nhân viên ký',
                badge: { count: statusCounts.pending_signatures, color: '#BD1D2D' }
              },
              isManager && { 
                value: 'pending_manager', 
                label: 'Chờ sếp duyệt',
                badge: { count: statusCounts.pending_manager, color: '#BD1D2D' }
              },
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'rejected', label: 'Bác bỏ' }
            ].filter(Boolean) as any[]}
            size="sm"
          />
        </div>

        {/* Filter Sale (Only show if Manager/Admin) */}
        {isManager && (
          <div style={{ width: '220px' }}>
            <CustomSelect
              value={filterSale}
              onChange={val => setFilterSale(val)}
              options={[
                { value: 'all', label: 'Tất cả nhân viên' },
                ...salesAccounts.map(u => ({ value: String(u.id), label: u.full_name, avatar: (u as any).avatar }))
              ]}
              size="sm"
              showAvatars
              searchable
              align="right"
            />
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <CardSkeleton height={140} />
          <CardSkeleton height={140} />
          <CardSkeleton height={140} />
        </div>
      ) : filteredSlips.length === 0 ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Không tìm thấy kết quả phù hợp</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Vui lòng thay đổi từ khóa hoặc bộ lọc để tìm lại.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '580px', overflowY: 'auto', paddingRight: '6px' }}>
          {paginatedSlips.map(slip => {
            const hasSigned = slip.shareholders.find(s => String(s.user_id) === String(user?.id))?.signed;
            const isShareholder = slip.shareholders.some(s => String(s.user_id) === String(user?.id));
            const allSigned = slip.shareholders.every(s => s.signed);
            const isPendingSignatures = (slip.status === 'pending_signatures' || slip.status === 'approved_pending_signatures') && !allSigned;
            const isExpanded = !!expandedSlips[slip.id];
            const baseComm = Number(slip.expected_commission) || Number(slip.expected_revenue) || 0;
            const baseActual = Number(slip.actual_revenue) || 0;
            const totalPercentage = slip.total_percentage !== undefined && slip.total_percentage !== null ? Number(slip.total_percentage) : 100;
            const totalComm = (baseComm * totalPercentage) / 100;
            const totalActual = (baseActual * totalPercentage) / 100;

            return (
              <div
                key={slip.id}
                id={`coop-slip-row-${slip.id}`}
                className="card animate-fade"
                style={{ 
                  padding: '1.25rem 1.5rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1rem',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  boxShadow: isExpanded ? '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)' : '0 1px 3px 0 rgba(0, 0, 0, 0.02), 0 1px 2px 0 rgba(0, 0, 0, 0.01)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'var(--color-surface)',
                  position: 'relative',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
                onClick={() => toggleSlip(slip.id)}
              >
                {/* General Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Top Row: Basic Info & Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
                    
                    {/* Left: Icon, ID, Unit, Project, Customer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ 
                        padding: '10px', 
                        background: 'var(--color-border-light)', 
                        borderRadius: '8px', 
                        color: 'var(--color-text-muted)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        border: '1px solid var(--color-border)'
                      }}>
                        <FileText size={18} />
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          fontWeight: 700, 
                          color: 'var(--color-text)', 
                          background: 'var(--color-border-light)', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          letterSpacing: '0.5px',
                          border: '1px solid var(--color-border)'
                        }}>
                          ID: #{slip.id}
                        </span>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'inline-flex', alignItems: 'center' }}>
                          Căn: <span style={{ color: 'var(--color-text)' }}>{slip.unit_code || '—'}</span>
                          {slip.unit_code && <CopyButton text={slip.unit_code} />}
                        </h3>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>•</span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-light)' }}>
                          {slip.project_name || 'Dự án khác'}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>•</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Khách:</span>
                          <Avatar 
                            name={`${slip.last_name} ${slip.first_name}`} 
                            size={18}
                          />
                          <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-text)' }}>
                            {slip.last_name} {slip.first_name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Badge Status & Header Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                      <span
                        className="badge"
                        style={{
                          background: 'var(--color-surface)',
                          color: isPendingSignatures ? 'var(--color-warning)' : slip.status === 'approved' ? 'var(--color-success)' : slip.status === 'pending_manager_approval' ? 'var(--color-warning)' : slip.status === 'rejected' ? 'var(--color-danger)' : 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {isPendingSignatures ? (
                          <>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-warning)' }} />
                            Chờ ký
                          </>
                        ) : slip.status === 'approved' ? (
                          <>
                            <Check size={12} style={{ color: 'var(--color-success)' }} />
                            Đã duyệt
                          </>
                        ) : slip.status === 'pending_manager_approval' ? (
                          <>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-warning)' }} />
                            Chờ sếp duyệt
                          </>
                        ) : slip.status === 'rejected' ? (
                          <>
                            <X size={12} style={{ color: 'var(--color-danger)' }} />
                            Bị bác bỏ
                          </>
                        ) : (
                          slip.status
                        )}
                      </span>
                      
                      {/* Delete icon */}
                      {(isApprover || (String(slip.created_by) === String(user?.id) && (slip.status === 'pending_signatures' || slip.status === 'approved_pending_signatures'))) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSlip(slip.id); }}
                          className="btn sm outline text-danger"
                          style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderColor: 'transparent', background: 'transparent' }}
                          title="Xóa phiếu hợp tác"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}

                      {/* Expand indicator */}
                      <div style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Cooperation details & financials & Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    
                    {/* Left: Shareholders & percentages */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
                      <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Tỷ lệ chia:</span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {slip.shareholders?.map((sh) => (
                          <div key={sh.user_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '3px 8px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                            <Avatar src={(sh as any).avatar} name={sh.name} size={16} />
                            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--color-text)' }}>{sh.name}</span>
                            <span style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--color-text)' }}>{sh.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Middle: Financials */}
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>H.Hồng dự kiến</span>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                          {totalComm.toLocaleString()} <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>VND</span>
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Thực thu</span>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                          {totalActual.toLocaleString()} <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>VND</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                      
                      {/* Sign / Update buttons */}
                      {(slip.status === 'pending_signatures' || slip.status === 'approved_pending_signatures') && (String(slip.created_by) === String(user?.id) || isApprover) && (
                        <button
                          onClick={() => handleOpenUpdateShares(slip)}
                          style={{
                            height: '38px',
                            padding: '0 16px',
                            fontSize: '0.85rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text)',
                            transition: 'all 0.2s'
                          }}
                        >
                          Cấu hình chia %
                        </button>
                      )}

                      {isShareholder && !hasSigned && (slip.status === 'pending_signatures' || slip.status === 'approved_pending_signatures') && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenSignModal(slip)}
                            style={{
                              height: '38px',
                              padding: '0 16px',
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              borderRadius: '8px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: 'none',
                              background: 'var(--color-success)',
                              color: '#fff',
                              transition: 'all 0.2s'
                            }}
                          >
                            <PenTool size={14} /> Ký
                          </button>
                          <button
                            onClick={() => handleRejectSlip(slip.id)}
                            style={{
                              height: '38px',
                              padding: '0 16px',
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              borderRadius: '8px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: '1px solid var(--color-danger)',
                              background: 'transparent',
                              color: 'var(--color-danger)',
                              transition: 'all 0.2s'
                            }}
                          >
                            Từ chối
                          </button>
                        </div>
                      )}

                      {/* For approved slips, show Create Adjustment button (Luật 4.12) */}
                      {slip.status === 'approved' && (isApprover || isShareholder || String(slip.created_by) === String(user?.id)) && (
                        <button
                          onClick={() => handleCreateAdjustment(slip.id)}
                          style={{
                            height: '38px',
                            padding: '0 16px',
                            fontSize: '0.85rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            border: '1px solid var(--color-warning)',
                            background: 'rgba(245, 158, 11, 0.08)',
                            color: 'var(--color-warning)',
                            transition: 'all 0.2s'
                          }}
                        >
                          Tạo phiếu điều chỉnh (Adjustment)
                        </button>
                      )}

                      {/* Request change if pending manager approval */}
                      {slip.status === 'pending_manager_approval' && 
                       (isApprover || isShareholder || String(slip.created_by) === String(user?.id)) && (
                        <button
                          onClick={() => handleOpenUpdateShares(slip)}
                          style={{
                            height: '38px',
                            padding: '0 16px',
                            fontSize: '0.85rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text)',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isApprover ? 'Cập nhật tỷ lệ' : 'Yêu cầu thay đổi tỷ lệ'}
                        </button>
                      )}

                      {/* Manager Approval actions */}
                      {isApprover && slip.status === 'pending_manager_approval' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleApproveSlip(slip)}
                            style={{
                              height: '38px',
                              padding: '0 16px',
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              borderRadius: '8px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: 'none',
                              background: '#10b981',
                              color: 'white',
                              transition: 'all 0.2s'
                            }}
                          >
                            <CheckCircle size={14} /> Duyệt
                          </button>
                          <button
                            onClick={() => handleRejectSlip(slip.id)}
                            style={{
                              height: '38px',
                              padding: '0 16px',
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              borderRadius: '8px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: 'none',
                              background: 'var(--color-danger)',
                              color: 'white',
                              transition: 'all 0.2s'
                            }}
                          >
                            <X size={14} /> Bác bỏ
                          </button>
                        </div>
                      )}
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
                                <Avatar src={(sh as any).avatar} name={sh.name} size="md" />
                                <div>
                                  <h5 style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--color-text)' }}>{sh.name}</h5>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{sh.email}</span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                                  {sh.percentage}%
                                </span>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, marginTop: '2px' }}>
                                  Dự kiến: {((baseComm * sh.percentage) / 100).toLocaleString()} VND
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, marginTop: '1px' }}>
                                  Thực tế: {((baseActual * sh.percentage) / 100).toLocaleString()} VND
                                </div>
                              </div>
                            </div>

                            <div style={{ paddingTop: '6px', borderTop: sh.signed ? '1px solid rgba(16, 185, 129, 0.1)' : '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: sh.signed ? 'var(--color-success)' : 'var(--color-warning)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {sh.signed ? (
                                  <>✓ Đã ký xác nhận</>
                                ) : (
                                  <>
                                    <span style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '50%',
                                      backgroundColor: 'var(--color-warning)',
                                      display: 'inline-block'
                                    }} />
                                    Chờ ký
                                  </>
                                )}
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
                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }} onClick={e => e.stopPropagation()}>
                      <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Paperclip size={14} /> Tài liệu đính kèm:
                      </h4>
                      {slip.attachment_url ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {slip.attachment_url.split(',').map((url, urlIdx) => (
                            <div key={urlIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-bg-light)', borderRadius: '10px', border: '1px solid var(--color-border)', maxWidth: '500px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <FileText size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <a 
                                    href={`https://open.domation.net/richland/${url}`} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  >
                                    {url.split('/').pop() || 'Xem tài liệu hợp tác đính kèm'}
                                  </a>
                                </div>
                              </div>
                              {isApprover && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '12px' }}>
                                  <button 
                                    className="btn sm outline"
                                    style={{ padding: '4px 8px', fontSize: '0.7rem', height: '26px', borderRadius: '4px' }}
                                    onClick={() => handleRenameCoopAttachment(slip.id, url)}
                                  >
                                    Đổi tên
                                  </button>
                                  <button 
                                    className="btn sm outline text-danger"
                                    style={{ padding: '4px 8px', fontSize: '0.7rem', height: '26px', borderRadius: '4px', borderColor: 'var(--color-danger)' }}
                                    onClick={() => handleRemoveCoopAttachment(slip.id, url)}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          {isApprover && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <input
                                type="file"
                                id={`coop-attachment-upload-${slip.id}`}
                                style={{ display: 'none' }}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
                                onChange={e => handleCoopAttachmentUpload(slip.id, e)}
                              />
                              <label 
                                htmlFor={`coop-attachment-upload-${slip.id}`}
                                className="btn sm outline"
                                style={{ padding: '6px 12px', fontSize: '0.725rem', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--color-text-light)', borderColor: 'var(--color-border)' }}
                              >
                                Tải lên thêm tài liệu
                              </label>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                            Chưa có tài liệu đính kèm cho phiếu hợp tác này.
                          </p>
                          {isApprover && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <input
                                type="file"
                                id={`coop-attachment-upload-${slip.id}`}
                                style={{ display: 'none' }}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
                                onChange={e => handleCoopAttachmentUpload(slip.id, e)}
                              />
                              <label 
                                htmlFor={`coop-attachment-upload-${slip.id}`}
                                className="btn sm outline"
                                style={{ padding: '6px 12px', fontSize: '0.725rem', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--color-text-light)', borderColor: 'var(--color-border)' }}
                              >
                                Tải lên tài liệu mới
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

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
        {totalPages > 1 && (
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination 
              total={filteredSlips.length}
              page={currentPage}
              pageSize={ITEMS_PER_PAGE}
              onChange={setCurrentPage}
            />
          </div>
        )}
        </>
      )}

      {/* Signature Modal */}
      {isSignModalOpen && signingSlip && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card animate-fade" style={{ maxWidth: '800px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Đọc tài liệu &amp; Ký xác nhận điện tử</h2>
              <button onClick={() => { setIsSignModalOpen(false); setSigningSlip(null); navigate(location.pathname, { replace: true }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>

            {/* Document Reader Area */}
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>1. Đọc tài liệu đính kèm:</h3>
              {signingSlip.attachment_url ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {signingSlip.attachment_url.split(',').map((url, urlIdx) => (
                    <div key={urlIdx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--color-bg-light)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                      <FileText size={24} style={{ color: 'var(--color-primary)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.825rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {url.split('/').pop() || 'Tài liệu hợp tác đính kèm'}
                        </p>
                        <a 
                          href={`https://open.domation.net/richland/${url}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline', marginTop: '2px', display: 'inline-block' }}
                        >
                          Bấm để mở xem tài liệu ở tab mới ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                  Phiếu hợp tác này không đính kèm tệp tài liệu bổ sung. Vui lòng kiểm tra tỷ lệ phân chia bên dưới.
                </div>
              )}
            </div>

            {/* Shares info recap */}
            <div style={{ padding: '12px 16px', background: 'var(--color-bg-light)', borderRadius: '10px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)' }}>Tỷ lệ phân chia của các thành viên:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {signingSlip.shareholders.map(sh => (
                  <div key={sh.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar src={(sh as any).avatar} name={sh.name} size="md" />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{sh.name}</span>
                        <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                          {numberToVietnameseWords(sh.percentage)}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {sh.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Signature Area Selector & Component */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                <button
                  type="button"
                  className={`btn sm ${signatureMethod === 'draw' ? 'primary' : 'outline'}`}
                  style={{ flex: 1, height: '36px', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => setSignatureMethod('draw')}
                >
                  <PenTool size={14} /> Vẽ chữ ký tay
                </button>
                <button
                  type="button"
                  className={`btn sm ${signatureMethod === 'upload' ? 'primary' : 'outline'}`}
                  style={{ flex: 1, height: '36px', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => setSignatureMethod('upload')}
                >
                  <Paperclip size={14} /> Tải file ảnh chữ ký
                </button>
              </div>

              {signatureMethod === 'draw' ? (
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
                    width={750}
                    height={220}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                      border: '2px dashed var(--color-border)',
                      borderRadius: '8px',
                      background: 'var(--color-bg-light)',
                      cursor: 'crosshair',
                      display: 'block',
                      touchAction: 'none',
                      width: '100%',
                      height: '220px'
                    }}
                  />
                </div>
              ) : (
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>2. Chọn file ảnh chữ ký từ máy tính của bạn:</h3>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setUploadedSignatureImg(event.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: 'block', width: '100%', padding: '10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-bg-light)', fontSize: '0.8125rem', cursor: 'pointer' }}
                  />
                  {uploadedSignatureImg && (
                    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                      <img src={uploadedSignatureImg} alt="Preview Chữ ký" style={{ maxHeight: '150px', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (isSigning) return;
                if (signatureMethod === 'upload') {
                  if (!uploadedSignatureImg) {
                    alert('Vui lòng tải file ảnh chữ ký của bạn lên trước khi bấm xác nhận.');
                    return;
                  }
                  handleSignSlip(signingSlip.id, uploadedSignatureImg);
                } else {
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
                }
              }}
              disabled={isSigning}
              className="btn primary w-full"
              style={{ height: '42px', fontWeight: 700, opacity: isSigning ? 0.7 : 1, cursor: isSigning ? 'not-allowed' : 'pointer' }}
            >
              {isSigning ? 'Đang xử lý chữ ký số...' : 'Tôi đồng ý và Ký xác nhận'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Approval Details Modal */}
      {approvalSlip && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(10px)', padding: '1.5rem' }}>
          <div className="card animate-fade" style={{ maxWidth: '640px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', background: 'var(--color-surface)', position: 'relative' }}>
            
            {/* Close Button Top Right */}
            <button 
              onClick={() => setApprovalSlip(null)} 
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--color-bg-light)', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              className="hover-lift"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                <CheckCircle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                  Xác nhận duyệt hoa hồng
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                  PHIẾU HỢP TÁC ID: #{approvalSlip.id}
                </span>
              </div>
            </div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Slip Summary Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 20px', background: 'linear-gradient(135deg, rgba(189,29,45,0.01) 0%, rgba(189,29,45,0.03) 100%)', padding: '16px 20px', borderRadius: '16px', border: '1px solid rgba(189, 29, 45, 0.08)' }}>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>CĂN HỘ / MÃ CĂN</span>
                  <span style={{ fontSize: '0.925rem', fontWeight: 800, color: 'var(--color-primary)' }}>{approvalSlip.unit_code || '—'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>DỰ ÁN</span>
                  <span style={{ fontSize: '0.925rem', fontWeight: 800, color: 'var(--color-text)' }}>{approvalSlip.project_name || 'Dự án khác'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>KHÁCH HÀNG</span>
                  <span style={{ fontSize: '0.925rem', fontWeight: 800, color: 'var(--color-text)' }}>{approvalSlip.last_name} {approvalSlip.first_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>TRẠNG THÁI</span>
                  <span className="badge warning" style={{ display: 'inline-block', fontSize: '0.725rem', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, textTransform: 'none', letterSpacing: 'normal' }}>
                    Chờ sếp duyệt
                  </span>
                </div>
              </div>

              {/* Ratios & Commission */}
              <div>
                <h4 style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--color-text-light)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', borderLeft: '3px solid var(--color-primary)', paddingLeft: '8px' }}>
                  Tỷ lệ chia sẻ & Doanh thu hoa hồng
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Financials Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '14px 18px' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 700, marginBottom: '4px' }}>H.HỒNG DỰ KIẾN ({approvalSlip.total_percentage ?? 100}%)</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-text)' }}>
                        {((Number(approvalSlip.expected_commission || approvalSlip.expected_revenue || 0) * (approvalSlip.total_percentage ?? 100)) / 100).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>VND</span>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '16px' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 700, marginBottom: '4px' }}>THỰC THU ({approvalSlip.total_percentage ?? 100}%)</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-success)' }}>
                        {((Number(approvalSlip.actual_revenue || 0) * (approvalSlip.total_percentage ?? 100)) / 100).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-success)' }}>VND</span>
                      </span>
                    </div>
                  </div>

                  {/* Shareholders distribution */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {approvalSlip.shareholders?.map((sh) => (
                      <div key={sh.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-xs)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar src={(sh as any).avatar} name={sh.name} size={32} />
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', display: 'block' }}>{sh.name}</span>
                            <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', display: 'block' }}>{sh.email}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-primary)' }}>{sh.percentage}%</span>
                            <span style={{ fontSize: '0.675rem', color: sh.signed ? 'var(--color-success)' : 'var(--color-warning)', display: 'block', fontWeight: 700, marginTop: '1px' }}>
                              {sh.signed ? '✓ Đã ký số' : '✗ Chưa ký'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Documents & Files */}
              <div>
                <h4 style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--color-text-light)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', borderLeft: '3px solid var(--color-primary)', paddingLeft: '8px' }}>
                  Tài liệu đính kèm ({approvalSlip.attachment_url ? approvalSlip.attachment_url.split(',').filter(Boolean).length : 0})
                </h4>
                {approvalSlip.attachment_url ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                    {approvalSlip.attachment_url.split(',').filter(Boolean).map((url, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--color-bg-light)', borderRadius: '12px', border: '1px solid var(--color-border)', transition: 'all 0.2s' }} className="hover-lift">
                        <FileText size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <a 
                            href={`https://open.domation.net/richland/${url}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            className="hover-underline"
                          >
                            {url.split('/').pop() || `Tài liệu đính kèm ${index + 1}`}
                          </a>
                        </div>
                        <ExternalLink size={12} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-muted)', fontSize: '0.75rem', background: 'var(--color-bg-light)' }}>
                    Không có tệp đính kèm nào.
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions - Large, Intuitive Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '1rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem' }}>
              <button 
                onClick={() => setApprovalSlip(null)} 
                className="btn outline"
                style={{ flex: 1, height: '48px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
                disabled={isApproving}
              >
                <X size={18} />
                Hủy bỏ
              </button>
              <button 
                onClick={async () => {
                  try {
                    setIsApproving(true);
                    const res = await fetchAPI(`cooperation-slips/${approvalSlip.id}/approve`, { method: 'POST' });
                    if (res.success) {
                      addToast('Phê duyệt phiếu hoa hồng thành công!', 'success');
                      setApprovalSlip(null);
                      loadData();
                    } else {
                      addToast(res.message || 'Lỗi phê duyệt', 'error');
                    }
                  } catch (e: any) {
                    addToast(e.message || 'Lỗi kết nối', 'error');
                  } finally {
                    setIsApproving(false);
                  }
                }} 
                className="btn"
                style={{ flex: 2, height: '48px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700, background: 'var(--color-success)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(52, 199, 89, 0.2)' }}
                disabled={isApproving}
              >
                {isApproving ? (
                  'Đang xử lý...'
                ) : (
                  <>
                    <Check size={20} />
                    Xác nhận &amp; Phê duyệt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Confirm Modal */}
      {customConfirm.isOpen && createPortal(
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
        </div>,
        document.body
      )}

      {/* Custom Prompt Modal */}
      {customPrompt.isOpen && createPortal(
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
        </div>,
        document.body
      )}

      {/* Configuration Modal */}
      {isUpdateOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'scaleUp 0.2s ease-out', overflow: 'visible' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Cấu hình phân chia tỷ lệ (%)</h2>
              <button onClick={() => setIsUpdateOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveShares} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'visible' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'visible' }}>
                {sharesInput.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', overflow: 'visible' }}>
                    <div style={{ flex: 1, pointerEvents: idx === 0 ? 'none' : 'auto', opacity: idx === 0 ? 0.8 : 1 }}>
                      <CustomSelect
                        value={item.user_id}
                        onChange={val =>
                          setSharesInput(prev =>
                            prev.map((valObj, i) => (i === idx ? { ...valObj, user_id: val } : valObj))
                          )
                        }
                        options={[
                          { value: '', label: '-- Chọn nhân viên --' },
                          ...salesAccounts
                            .filter(s => {
                              if (idx === 0) return true;
                              return String(s.id) !== String(user?.id);
                            })
                            .filter(s => {
                              if (idx === 0) return true;
                              const creatorId = sharesInput[0]?.user_id;
                              const creatorObj = salesAccounts.find(u => String(u.id) === String(creatorId));
                              if (!creatorObj || !creatorObj.team_id) return true;
                              return String(s.team_id) !== String(creatorObj.team_id);
                            })
                            .filter(s => {
                              if (String(s.id) === String(item.user_id)) return true;
                              return !sharesInput.some((other, otherIdx) => otherIdx !== idx && String(other.user_id) === String(s.id));
                            })
                            .map(s => ({ value: String(s.id), label: s.full_name, avatar: (s as any).avatar }))
                        ]}
                        size="sm"
                        showAvatars
                        searchable
                      />
                    </div>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      placeholder="%"
                      value={item.percentage}
                      onChange={e => {
                        const parsed = parseInt(e.target.value) || 0;
                        const otherSum = sharesInput.reduce((acc, val, i) => {
                          if (i === idx) return acc;
                          return acc + (parseInt(val.percentage) || 0);
                        }, 0);
                        const maxAllowed = Math.max(0, 100 - otherSum);
                        let finalVal = parsed;
                        if (finalVal > maxAllowed) {
                          finalVal = maxAllowed;
                        }
                        if (finalVal < 0) {
                          finalVal = 0;
                        }
                        const valStr = e.target.value === '' ? '' : String(finalVal);
                        setSharesInput(prev =>
                          prev.map((val, i) => (i === idx ? { ...val, percentage: valStr } : val))
                        );
                      }}
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
        </div>,
        document.body
      )}
    </div>
  );
}
