import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Camera, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Save, Trash2, Download, 
  Paperclip, Loader2, Eye, EyeOff, User, Shield, Info, Send, 
  Link2Off, RefreshCw, KeyRound, Building2, Calendar, Clock, Plus, FileText,
  CreditCard, PhoneCall, Lock, Search, Check, Award, AlertCircle
} from 'lucide-react';
import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import toast from 'react-hot-toast';
import { CustomSelect } from './ui/CustomSelect';
import { AddressSelect } from './ui/AddressSelect';
import { Avatar } from './ui/Avatar';
import { CustomModal } from './ui/CustomModal';
import { ToggleSwitch } from './ui/ToggleSwitch';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import styles from '../pages/EntityDrawer.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  account: any | null; // null for adding new
  onSaveSuccess: () => void;
  readOnly?: boolean;
}

const DEFAULT_SCHEDULE = {
  "1": { active: true, start: "08:00", end: "17:30" },
  "2": { active: true, start: "08:00", end: "17:30" },
  "3": { active: true, start: "08:00", end: "17:30" },
  "4": { active: true, start: "08:00", end: "17:30" },
  "5": { active: true, start: "08:00", end: "17:30" },
  "6": { active: true, start: "08:00", end: "17:30" },
  "7": { active: false, start: "08:00", end: "17:30" }
};

const DAY_LABELS: Record<string, string> = {
  "1": "Thứ 2",
  "2": "Thứ 3",
  "3": "Thứ 4",
  "4": "Thứ 5",
  "5": "Thứ 6",
  "6": "Thứ 7",
  "7": "Chủ Nhật"
};

const getDefaultPermissionsForRole = (role: string) => {
  const normRole = (role || '').toLowerCase();
  if (normRole === 'admin' || normRole === 'superadmin' || normRole === 'super_admin') {
    return {
      leads: { read: 'all', write: 'all', delete: 'all' },
      deals: { read: 'all', write: 'all', delete: 'all' },
      cooperation: { read: 'all', write: 'all', delete: 'all' },
      quotes: { read: 'all', write: 'all', delete: 'all' },
      projects: { read: 'all', write: 'all', delete: 'all' },
      settings: { read: 'all', write: 'all', delete: 'all' }
    };
  }
  if (normRole === 'director') {
    return {
      leads: { read: 'all', write: 'all', delete: 'none' },
      deals: { read: 'all', write: 'all', delete: 'all' },
      cooperation: { read: 'all', write: 'all', delete: 'all' },
      quotes: { read: 'all', write: 'all', delete: 'all' },
      projects: { read: 'all', write: 'all', delete: 'none' },
      settings: { read: 'none', write: 'none', delete: 'none' }
    };
  }
  if (normRole === 'manager') {
    return {
      leads: { read: 'team', write: 'team', delete: 'none' },
      deals: { read: 'team', write: 'team', delete: 'none' },
      cooperation: { read: 'team', write: 'own', delete: 'none' },
      quotes: { read: 'team', write: 'team', delete: 'none' },
      projects: { read: 'all', write: 'none', delete: 'none' },
      settings: { read: 'none', write: 'none', delete: 'none' }
    };
  }
  if (normRole === 'assistant') {
    return {
      leads: { read: 'all', write: 'all', delete: 'none' },
      deals: { read: 'all', write: 'all', delete: 'all' },
      cooperation: { read: 'all', write: 'all', delete: 'none' },
      quotes: { read: 'all', write: 'all', delete: 'none' },
      projects: { read: 'all', write: 'all', delete: 'none' },
      settings: { read: 'all', write: 'all', delete: 'none' }
    };
  }
  if (normRole === 'sale' || normRole === 'sales') {
    return {
      leads: { read: 'own', write: 'own', delete: 'none' },
      deals: { read: 'own', write: 'own', delete: 'none' },
      cooperation: { read: 'own', write: 'own', delete: 'none' },
      quotes: { read: 'own', write: 'own', delete: 'none' },
      projects: { read: 'all', write: 'none', delete: 'none' },
      settings: { read: 'none', write: 'none', delete: 'none' }
    };
  }
  // Default to viewer
  return {
    leads: { read: 'all', write: 'none', delete: 'none' },
    deals: { read: 'all', write: 'none', delete: 'none' },
    cooperation: { read: 'all', write: 'none', delete: 'none' },
    quotes: { read: 'all', write: 'none', delete: 'none' },
    projects: { read: 'all', write: 'none', delete: 'none' },
    settings: { read: 'none', write: 'none', delete: 'none' }
  };
};

const resolveAttachmentUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl = import.meta.env.VITE_API_URL || '/backend';
  return `${baseUrl}/${path.replace(/^\/+/, '')}`;
};

export const AccountDetailDrawer: React.FC<Props> = ({ isOpen, onClose, account, onSaveSuccess, readOnly = false }) => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'superadmin' || (currentUser?.role as string) === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;
  const isManager = currentUser?.role === 'manager';

  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Theme check
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => setIsMobileOrTablet(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<'personal' | 'erp' | 'account' | 'bank' | 'emergency' | 'schedule' | 'documents' | 'certificates' | 'hr_records' | ''>(() => window.innerWidth <= 1024 ? '' : 'personal');
  const [addressTemporary, setAddressTemporary] = useState('');
  const [certificates, setCertificates] = useState<{ id: string, name: string, code: string, issuer: string, link: string, image: string, issuedDate: string, expiryDate: string }[]>([]);
  const [hrRecords, setHrRecords] = useState<{ id: string, type: 'award' | 'warning' | 'discipline', title: string, date: string, amount: string, reason: string, decisionNumber: string, documentLink: string }[]>([]);

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    personal: true,
    erp: true,
    account: true,
    bank: true,
    emergency: true,
    schedule: true,
    documents: true
  });

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const renderColoredIcon = (IconComponent: any, bgColor: string) => {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        backgroundColor: bgColor,
        color: 'white',
        flexShrink: 0
      }}>
        <IconComponent size={14} />
      </div>
    );
  };

  // 1. Basic Account Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [zaloChatId, setZaloChatId] = useState('');
  const [role, setRole] = useState('sale');
  const [avatar, setAvatar] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState('1');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [managerBehaviorMode, setManagerBehaviorMode] = useState('combined');

  // Delete account states
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteCheckResult, setDeleteCheckResult] = useState<any>(null);
  const [replacementAdminId, setReplacementAdminId] = useState<string>('');
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  // 2. Personal Profile Fields
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [citizenId, setCitizenId] = useState('');
  const [hometown, setHometown] = useState('');
  const [nationality, setNationality] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('single');
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [extNumber, setExtNumber] = useState('');
  const [address, setAddress] = useState('');

  // 3. Personnel & ERP Fields
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [contractType, setContractType] = useState('official');
  const [dateJoined, setDateJoined] = useState('');
  const [directManager, setDirectManager] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [brokerLicense, setBrokerLicense] = useState('');
  const [degree, setDegree] = useState('undergraduate');
  const [taxId, setTaxId] = useState('');
  const [insuranceId, setInsuranceId] = useState('');
  const [bankBranch, setBankBranch] = useState('');

  // 4. Emergency Contact
  interface EmergencyContact {
    name: string;
    relationship: string;
    phone: string;
  }
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { name: '', relationship: '', phone: '' }
  ]);

  // 5. Schedules & Vacation
  const [vacationMode, setVacationMode] = useState(false);
  const [overtimeMode, setOvertimeMode] = useState(false);
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('17:30');
  const [scheduleMode, setScheduleMode] = useState<'daily' | 'custom'>('daily');
  const [workSchedule, setWorkSchedule] = useState<any>(DEFAULT_SCHEDULE);
  const [useCustomWorkHours, setUseCustomWorkHours] = useState(false);
  const [holidayShifts, setHolidayShifts] = useState<any[]>([]);
  const [weekendShifts, setWeekendShifts] = useState<any[]>([]);
  const [nightShifts, setNightShifts] = useState<any[]>([]);

  // 6. Documents / Attachments
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [permissionsJson, setPermissionsJson] = useState<any>({});
  const [managerTeams, setManagerTeams] = useState<number[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<{ key: string; action: string } | null>(null);

  // Zalo Bot Helpers
  const [quickMsgText, setQuickMsgText] = useState('');
  const [isSendingQuickMsg, setIsSendingQuickMsg] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // Reset/Load form on account change
  useEffect(() => {
    if (!isOpen) return;

    // Fetch all teams
    const fetchTeams = async () => {
      try {
        const res = await fetchAPI('teams');
        if (res && Array.isArray(res)) {
          setAllTeams(res);
        } else if (res?.success && Array.isArray(res.data)) {
          setAllTeams(res.data);
        }
      } catch (e) {
        console.error("Lỗi tải danh sách teams:", e);
      }
    };
    fetchTeams();

    if (account) {
      setLoading(true);
      // Load Basic Info
      setUsername(account.username || '');
      setPassword('');
      setName(account.name || '');
      setEmail(account.email || '');
      setZaloChatId(account.zalo_chat_id || '');
      setRole(account.role || 'sale');
      setAvatar(account.avatar || '');
      setPhone(account.phone || '');
      setIsActive(String(account.is_active ?? '1'));

      // Fetch Full Consultant Profile (for ERP metadata, Schedules, etc.)
      const fetchFullDetails = async () => {
        try {
          const param = account.username ? `user_id=${account.id}` : `consultant_id=${account.id}`;
          const res = await fetchAPI(`consultant-profile?${param}`);
          if (res.success && res.data) {
            const d = res.data;
            setZaloChatId(d.zalo_chat_id || '');
            setVacationMode(d.vacation_mode === 1);
            setOvertimeMode(d.overtime_mode === 1);
            setUseCustomWorkHours(d.use_custom_work_hours === 1);
            setHolidayShifts(d.holiday_shifts || []);
            setWeekendShifts(d.weekend_shifts || []);
            setNightShifts(d.night_shifts || []);
            setWorkStartTime(d.work_start_time || '08:00');
            setWorkEndTime(d.work_end_time || '17:30');
            setLeaveStart(d.leave_start || '');
            setLeaveEnd(d.leave_end || '');
            setDob(d.dob || '');
            setGender(d.gender || '');
            setCitizenId(d.citizen_id || '');
            setBankName(d.bank_name || '');
            setBankAccount(d.bank_account || '');
            setManagerTeams(d.manager_teams || []);
            setManagerBehaviorMode(d.manager_behavior_mode || 'combined');
            try {
              const defaultPerms = getDefaultPermissionsForRole(d.role || account?.role || '');
              const parsed = d.permissions_json ? JSON.parse(d.permissions_json) : {};
              const merged = { ...defaultPerms };
              Object.keys(parsed).forEach(k => {
                if (parsed[k]) {
                  merged[k] = { ...(merged[k] || {}), ...parsed[k] };
                }
              });
              setPermissionsJson(merged);
            } catch {
              setPermissionsJson(getDefaultPermissionsForRole(d.role || account?.role || ''));
            }

            let addressPayload = d.address || '';
            try {
              const addressObj = JSON.parse(addressPayload);
              if (addressObj && addressObj.erp_profile) {
                const erp = addressObj.erp_profile;
                setAddress(erp.address_text || '');
                setAddressTemporary(erp.address_temporary || '');
                setEmployeeId(erp.employee_id || '');
                setDepartment(erp.department || '');
                setJobTitle(erp.job_title || '');
                setContractType(erp.contract_type || 'official');
                setDateJoined(erp.date_joined || '');
                setDirectManager(erp.direct_manager || '');
                setWorkplace(erp.workplace || '');
                setPersonalPhone(erp.personal_phone || '');
                setExtNumber(erp.ext_number || '');
                if (Array.isArray(erp.emergency_contacts) && erp.emergency_contacts.length > 0) {
                  setEmergencyContacts(erp.emergency_contacts);
                } else if (erp.emergency_contact_name || erp.emergency_contact_relationship || erp.emergency_contact_phone) {
                  setEmergencyContacts([
                    {
                      name: erp.emergency_contact_name || '',
                      relationship: erp.emergency_contact_relationship || '',
                      phone: erp.emergency_contact_phone || ''
                    }
                  ]);
                } else {
                  setEmergencyContacts([{ name: '', relationship: '', phone: '' }]);
                }
                setTaxId(erp.tax_id || '');
                setInsuranceId(erp.insurance_id || '');
                setBrokerLicense(erp.broker_license || '');
                setDegree(erp.degree || 'undergraduate');
                setNationality(erp.nationality || '');
                setMaritalStatus(erp.marital_status || 'single');
                setPersonalEmail(erp.personal_email || '');
                setHometown('');
                setCertificates(erp.certificates || []);
                setHrRecords(erp.hr_records || []);
                setBankBranch(erp.bank_branch || '');
              } else {
                setAddress(addressPayload);
                setAddressTemporary('');
                setCertificates([]);
                setHrRecords([]);
              }
            } catch (e) {
              setAddress(addressPayload);
              setAddressTemporary('');
              setCertificates([]);
              setHrRecords([]);
            }

            if (d.work_schedule && typeof d.work_schedule === 'object') {
              setWorkSchedule(d.work_schedule);
              setScheduleMode('custom');
            } else if (d.work_schedule && typeof d.work_schedule === 'string') {
              try {
                setWorkSchedule(JSON.parse(d.work_schedule));
                setScheduleMode('custom');
              } catch(e) {
                setWorkSchedule(DEFAULT_SCHEDULE);
                setScheduleMode('daily');
              }
            } else {
              setWorkSchedule(DEFAULT_SCHEDULE);
              setScheduleMode('daily');
            }
          }
        } catch (err) {
          console.error('Error fetching full account profile:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchFullDetails();
      fetchDocuments();
    } else {
      // Clear fields for new account creation
      setUsername('');
      setPassword('');
      setName('');
      setEmail('');
      setZaloChatId('');
      setRole('sale');
      setAvatar('');
      setPhone('');
      setIsActive('1');
      setBankName('');
      setBankAccount('');

      setDob('');
      setGender('');
      setCitizenId('');
      setHometown('');
      setNationality('');
      setMaritalStatus('single');
      setPersonalEmail('');
      setPersonalPhone('');
      setExtNumber('');
      setAddress('');
      setAddressTemporary('');
      setCertificates([]);
      setHrRecords([]);

      setEmployeeId('');
      setDepartment('');
      setJobTitle('');
      setContractType('official');
      setDateJoined('');
      setDirectManager('');
      setWorkplace('');
      setBrokerLicense('');
      setDegree('undergraduate');
      setTaxId('');
      setInsuranceId('');
      setBankBranch('');

      setVacationMode(false);
      setOvertimeMode(false);
      setLeaveStart('');
      setLeaveEnd('');
      setUseCustomWorkHours(false);
      setHolidayShifts([]);
      setWeekendShifts([]);
      setNightShifts([]);
      setWorkStartTime('08:00');
      setWorkEndTime('17:30');
      setScheduleMode('daily');
      setWorkSchedule(DEFAULT_SCHEDULE);
      setPermissionsJson(getDefaultPermissionsForRole('sale'));
      setManagerTeams([]);
      setManagerBehaviorMode('combined');

      setDocuments([]);
      setLoading(false);
    }
  }, [isOpen, account]);

  useEffect(() => {
    if (!isPermissionModalOpen) {
      setActiveDropdown(null);
      setTeamSearchQuery('');
      return;
    }
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.custom-permission-select-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isPermissionModalOpen]);

  // Documents Management
  const fetchDocuments = async () => {
    if (!account?.id) return;
    setLoadingDocs(true);
    try {
      const res = await fetchAPI(`cloud-files?category=consultant_${account.id}&limit=100`);
      if (res.success && res.data) {
        setDocuments(res.data.items || []);
      }
    } catch (err) {
      console.error('Error loading user documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !account?.id) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('Dung lượng tệp tối đa cho phép là 10MB'));
      return;
    }

    setIsUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', `consultant_${account.id}`);
      fd.append('visibility', 'personal');
      fd.append('name', file.name);

      const res = await fetchAPI('cloud-files', {
        method: 'POST',
        body: fd
      });

      if (res.success) {
        toast.success(t('Tải tài liệu lên thành công!'));
        fetchDocuments();
      } else {
        toast.error(res.message || t('Lỗi khi tải tài liệu lên'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setIsUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn xóa tài liệu này không?'))) return;

    try {
      const res = await fetchAPI(`cloud-files/${docId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        toast.success(t('Đã xóa tài liệu'));
        fetchDocuments();
      } else {
        toast.error(res.message || t('Lỗi khi xóa tài liệu'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi hệ thống'));
    }
  };

  // Avatar Upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('Vui lòng chọn file hình ảnh hợp lệ.'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const compressedFile = await compressToWebP(file);
      const fd = new FormData();
      fd.append('avatar', compressedFile);
      if (avatar) fd.append('previous_url', avatar);

      const res = await fetchAPI(`upload_avatar&old_avatar=${encodeURIComponent(avatar)}`, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        setAvatar(res.url);
        toast.success(t('Tải ảnh đại diện lên thành công!'));
      } else {
        toast.error(res.message || t('Lỗi khi tải ảnh lên'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Zalo Quick Actions
  const handleSendQuickMsg = async () => {
    if (!quickMsgText.trim() || !account) return;
    setIsSendingQuickMsg(true);
    try {
      const res = await fetchAPI('send_quick_zalo_message', {
        method: 'POST',
        body: JSON.stringify({ account_id: account.id, message: quickMsgText })
      });
      if (res.success) {
        toast.success(res.message || t('Đã gửi tin nhắn thành công!'));
        setQuickMsgText('');
      } else {
        toast.error(res.message || t('Lỗi khi gửi tin'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi') + ': ' + e.message);
    } finally {
      setIsSendingQuickMsg(false);
    }
  };

  const handleUnlinkZalo = async () => {
    if (!account) return;
    if (!window.confirm(t('Bạn có chắc chắn muốn hủy liên kết Zalo của tài khoản này không?'))) return;
    
    setIsUnlinking(true);
    try {
      const json = await fetchAPI('unlink_zalo', {
        method: 'POST',
        body: JSON.stringify({ id: account.id, type: 'account' })
      });
      if (json.success) {
        toast.success(t('Đã hủy liên kết Zalo thành công!'));
        setZaloChatId('');
      } else {
        toast.error(json.message || t('Lỗi khi hủy liên kết'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi') + ': ' + e.message);
    } finally {
      setIsUnlinking(false);
    }
  };

  // Save changes
  const handleCertificateImageUpload = async (index: number, file: File) => {
    try {
      const compressedFile = await compressToWebP(file);
      const fd = new FormData();
      fd.append('avatar', compressedFile);

      const currentImg = certificates[index]?.image || '';
      const query = `upload_avatar&old_avatar=${encodeURIComponent(currentImg)}`;

      const res = await fetchAPI(query, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        const updated = [...certificates];
        updated[index] = {
          ...updated[index],
          image: res.url
        };
        setCertificates(updated);
        toast.success(t('Tải lên ảnh chứng chỉ thành công!'));
      } else {
        toast.error(res.message || t('Lỗi tải ảnh chứng chỉ lên'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối tải ảnh: ') + err.message);
    }
  };

  const handleOpenDeleteConfirm = async () => {
    if (!account?.id) return;
    try {
      const res = await fetchAPI(`check_delete_account&id=${account.id}`);
      if (res && res.success) {
        setDeleteCheckResult(res);
        if (res.other_admins && res.other_admins.length > 0) {
          setReplacementAdminId(String(res.other_admins[0].id));
        }
        setDeleteConfirmText('');
        setIsDeleteConfirmOpen(true);
      } else {
        toast.error(res?.message || 'Không thể kiểm tra trạng thái xóa tài khoản');
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const handleDeleteAccount = async () => {
    if (!account?.id) return;
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Vui lòng nhập chính xác "DELETE" để xác nhận');
      return;
    }
    setIsDeleting(true);
    try {
      const payload: any = {
        method: 'POST'
      };
      const query = `delete_account&id=${account.id}${deleteCheckResult?.in_use ? `&replacement_id=${replacementAdminId}` : ''}`;
      const res = await fetchAPI(query, payload);
      if (res && res.success) {
        toast.success(t('Xóa tài khoản nhân sự thành công!'));
        setIsDeleteConfirmOpen(false);
        onClose();
        onSaveSuccess();
      } else {
        toast.error(res?.message || 'Không thể xóa tài khoản');
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) return toast.error(t('Họ và tên không được để trống'));
    if (!account && !password) return toast.error(t('Vui lòng nhập mật khẩu cho tài khoản mới'));

    let finalUsername = username;
    if (!finalUsername && email) {
      finalUsername = email.split('@')[0];
    }
    if (!finalUsername) {
      finalUsername = 'staff_' + Math.random().toString(36).substring(2, 7);
    }

    setIsSaving(true);
    try {
      const firstEmergency = emergencyContacts[0] || { name: '', relationship: '', phone: '' };
      const addressPayload = JSON.stringify({
        erp_profile: {
          address_text: address,
          address_temporary: addressTemporary,
          employee_id: employeeId,
          department: department,
          job_title: jobTitle,
          contract_type: contractType,
          date_joined: dateJoined,
          direct_manager: directManager,
          workplace: workplace,
          personal_phone: personalPhone,
          ext_number: extNumber,
          emergency_contact_name: firstEmergency.name,
          emergency_contact_relationship: firstEmergency.relationship,
          emergency_contact_phone: firstEmergency.phone,
          emergency_contacts: emergencyContacts,
          certificates: certificates,
          hr_records: hrRecords,
          tax_id: taxId,
          insurance_id: insuranceId,
          broker_license: brokerLicense,
          degree: degree,
          nationality: nationality,
          marital_status: maritalStatus,
          personal_email: personalEmail,
          hometown: '',
          bank_branch: bankBranch
        }
      });

      // 2. Call Save Account (username, credentials, role, status)
      const action = account ? 'edit_account' : 'add_account';
      const payload: any = {
        id: account?.id,
        username: finalUsername,
        password: password || undefined,
        name,
        email,
        zalo_chat_id: zaloChatId,
        role,
        avatar,
        phone,
        is_active: isActive,
        dob: dob || null,
        gender: gender || null,
        citizen_id: citizenId || null,
        address: addressPayload,
        bank_name: bankName || null,
        bank_account: bankAccount || null,
        permissions_json: JSON.stringify(permissionsJson),
        manager_teams: managerTeams,
        manager_behavior_mode: managerBehaviorMode
      };

      const resAccount = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!resAccount.success) {
        throw new Error(resAccount.message || t('Lỗi lưu thông tin tài khoản cơ bản.'));
      }

      const savedUserId = account?.id || resAccount.id;

      // 3. Call update_consultant_self_profile to save schedules, vacations, and full ERP payload
      const resProfile = await fetchAPI('update_consultant_self_profile', {
        method: 'POST',
        body: JSON.stringify({
          consultant_id: savedUserId,
          name,
          avatar,
          work_start_time: workStartTime,
          work_end_time: workEndTime,
          work_schedule: scheduleMode === 'custom' ? workSchedule : null,
          dob: dob || null,
          gender: gender || null,
          citizen_id: citizenId || null,
          address: addressPayload,
          bank_name: bankName || null,
          bank_account: bankAccount || null,
          zalo_chat_id: zaloChatId,
          overtime_mode: overtimeMode ? 1 : 0,
          use_custom_work_hours: useCustomWorkHours ? 1 : 0,
          leave_start: leaveStart || null,
          leave_end: leaveEnd || null
        })
      });

      if (!resProfile.success) {
        throw new Error(resProfile.message || t('Lỗi lưu thông tin hồ sơ chi tiết.'));
      }

      toast.success(account ? t('Cập nhật nhân sự thành công!') : t('Thêm mới nhân sự thành công!'));
      onSaveSuccess();
      if (!account) {
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi hệ thống khi lưu'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const isAddMode = !account;

  if (isAddMode) {
    return createPortal(
      <div
        className="drawer-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          zIndex: 10500
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-2xl)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--color-border)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface)'
          }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('Thêm Nhân sự mới')}
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                {t('Khai báo hồ sơ làm việc và tài khoản mới.')}
              </p>
            </div>
            <button 
              onClick={onClose}
              style={{
                padding: '6px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="hover-bg-muted"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <form id="account-detail-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">{t('Họ và tên')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('Nguyễn Văn A')} required autoComplete="off" />
                </div>
                
                <div className="form-group">
                  <label className="form-label">{t('Email đăng nhập')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required autoComplete="off" />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('Tên đăng nhập (Username)')}</label>
                  <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="nguyenvana" autoComplete="off" />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
                    {t('Để trống hệ thống sẽ tự sinh từ Email.')}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('Mật khẩu')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('Tối thiểu 6 ký tự')} required autoComplete="new-password" />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('Số điện thoại liên hệ')}</label>
                  <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxx" autoComplete="off" />
                </div>

                {isAdmin && (
                  <div className="form-group">
                    <label className="form-label">{t('Phân quyền')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <CustomSelect 
                      options={[
                        { value: 'superadmin', label: t('Super Admin (Quản trị cấp cao)') },
                        { value: 'admin', label: t('Admin (Toàn quyền)') },
                        { value: 'director', label: t('Director (Giám đốc kinh doanh)') },
                        { value: 'manager', label: t('Manager (Trưởng nhóm kinh doanh)') },
                        { value: 'assistant', label: t('Assistant (Trợ lý / Phân bổ Data)') },
                        { value: 'sale', label: t('Sales (Nhân viên kinh doanh)') },
                        { value: 'viewer', label: t('Viewer (Chỉ xem Data)') }
                      ]}
                      value={role}
                      onChange={val => {
                        const newRole = val.toString();
                        setRole(newRole);
                        setPermissionsJson(getDefaultPermissionsForRole(newRole));
                      }}
                      width="100%"
                    />
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Footer */}
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: 'var(--color-surface)'
          }}>
            <button type="button" className="btn outline" onClick={onClose} style={{ minWidth: '100px' }}>
              {t('Hủy')}
            </button>
            <button 
              type="submit" 
              form="account-detail-form" 
              disabled={isSaving} 
              className="btn primary" 
              style={{ minWidth: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {isSaving ? t('Đang tạo...') : t('Tạo tài khoản')}
            </button>
          </div>
        </motion.div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <>
      <div
        className="drawer-backdrop"
        onClick={onClose}
        style={{
          zIndex: 10500
        }}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        onClick={e => e.stopPropagation()}
        className="drawer-sheet"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 'var(--sidebar-width, 220px)',
          right: 0,
          zIndex: 10600,
          backgroundColor: 'var(--color-surface)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--color-surface)',
          minHeight: '60px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            {/* Close Button as "<" ChevronLeft on the Left */}
            <button 
              onClick={onClose}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--color-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              className="hover-bg-muted"
              title={t('Quay lại')}
            >
              <ChevronLeft size={20} />
            </button>
            
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {account ? t('Hồ sơ Nhân sự') : t('Thêm Nhân sự')}
              </h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {account ? `${t('Mã nhân viên')}: ${employeeId || '—'} · ${name}` : t('Khai báo hồ sơ làm việc.')}
              </p>
            </div>
          </div>
          
          {/* Save Button with ONLY icon on the Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {!loading && !readOnly && (
              <button 
                type="submit"
                form="account-detail-form"
                disabled={isSaving}
                className="btn primary sm"
                style={{
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  padding: 0,
                  fontSize: '0.8125rem',
                  fontWeight: 600
                }}
                title={t('Lưu Hồ sơ Nhân sự')}
              >
                {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={18} />}
              </button>
            )}
          </div>
        </div>

        {/* Content Panel */}
        <div className={styles.drawerBody} style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: isMobileOrTablet ? 'column' : 'row' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', gap: '12px' }}>
              <Loader2 className="spin" size={32} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('Đang tải dữ liệu hồ sơ...')}</span>
            </div>
          ) : (
            <>
              {/* Sidebar Tabs */}
              {/* Sidebar Tabs */}
              {(!isMobileOrTablet || !activeTab) && (
                <div 
                  className={!isMobileOrTablet ? styles.sidebarTabs : undefined} 
                  style={isMobileOrTablet ? { 
                    width: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem', 
                    padding: '1.25rem 1rem', 
                    overflowY: 'auto', 
                    background: 'var(--color-bg)',
                    height: '100%'
                  } : { width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRight: '1px solid var(--color-border)', padding: '1.5rem 1rem', background: 'var(--color-surface)', height: '100%' }}
                >
                  {/* Profile Card inside Sidebar */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingBottom: '1.25rem', borderBottom: '1px solid var(--color-border-light)', marginBottom: '0.75rem' }}>
                    <div style={{ position: 'relative', cursor: readOnly ? 'default' : 'pointer' }} onClick={() => !readOnly && fileInputRef.current?.click()}>
                      <Avatar src={avatar} name={name || 'S'} size={72} />
                      {!readOnly && (
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          backgroundColor: 'var(--color-primary)',
                          color: 'white',
                          borderRadius: '50%',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid var(--color-surface)',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          <Camera size={12} />
                        </div>
                      )}
                      {isUploadingAvatar && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white'
                        }}>
                          <Loader2 size={16} className="spin" />
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 4 }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', wordBreak: 'break-word' }}>{name || t('Chưa cập nhật')}</h4>
                      <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                        {employeeId ? `${t('Mã nhân viên')}: ${employeeId}` : ''}
                      </p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      accept="image/*" 
                      onChange={handleAvatarUpload} 
                    />
                  </div>

                  {/* Tab buttons */}
                  {isMobileOrTablet ? (
                    /* ── Mobile iOS-style list menu ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', width: '100%' }}>
                      {/* Group 1: Cá nhân & Lịch trực */}
                      <div style={{ fontSize: '0.65rem', fontWeight: 750, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
                        {t('Cá nhân & Lịch trực')}
                      </div>
                      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <button
                          type="button"
                          onClick={() => setActiveTab('schedule')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border-light)', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                            {renderColoredIcon(Calendar, '#f09a37')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Lịch trực nhận data')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('personal')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                            {renderColoredIcon(User, '#eb4e3d')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Thông tin cá nhân')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                      </div>

                      {/* Group 2: Quản lý hồ sơ */}
                      <div style={{ fontSize: '0.65rem', fontWeight: 750, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px', marginTop: '0.5rem' }}>
                        {t('Quản lý hồ sơ')}
                      </div>
                      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <button
                          type="button"
                          onClick={() => setActiveTab('erp')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border-light)', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                            {renderColoredIcon(Building2, '#5856d6')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Hồ sơ & ERP')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('certificates')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border-light)', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                            {renderColoredIcon(Award, '#f2a20b')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Bằng cấp & Chứng chỉ')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('hr_records')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border-light)', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                            {renderColoredIcon(AlertCircle, '#ff9500')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Khen thưởng & Kỷ luật')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('bank')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border-light)', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                            {renderColoredIcon(CreditCard, '#34c759')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Tài khoản Ngân hàng')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('emergency')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border-light)', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                            {renderColoredIcon(Shield, '#ff2d55')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Liên hệ khẩn cấp')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('documents')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                            {renderColoredIcon(Paperclip, '#8e8e93')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Lưu trữ tài liệu')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                      </div>

                      {/* Group 3: Quản trị hệ thống */}
                      <div style={{ fontSize: '0.65rem', fontWeight: 750, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px', marginTop: '0.5rem' }}>
                        {t('Quản trị hệ thống')}
                      </div>
                      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <button
                          type="button"
                          onClick={() => setActiveTab('account')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--color-danger)', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {renderColoredIcon(Lock, '#ef4444')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Tài khoản & Quyền')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-danger)' }} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Desktop Tab Menu ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto', flex: 1 }}>
                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${activeTab === 'personal' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setActiveTab('personal')}
                        style={{ padding: '8px 0.75rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', border: 'none', background: activeTab === 'personal' ? 'var(--color-bg-light)' : 'transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'personal' ? 700 : 500 }}
                      >
                        {renderColoredIcon(User, '#eb4e3d')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Thông tin cá nhân')}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${activeTab === 'erp' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setActiveTab('erp')}
                        style={{ padding: '8px 0.75rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', border: 'none', background: activeTab === 'erp' ? 'var(--color-bg-light)' : 'transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'erp' ? 700 : 500 }}
                      >
                        {renderColoredIcon(Building2, '#5856d6')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Hồ sơ & ERP')}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${activeTab === 'certificates' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setActiveTab('certificates')}
                        style={{ padding: '8px 0.75rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', border: 'none', background: activeTab === 'certificates' ? 'var(--color-bg-light)' : 'transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'certificates' ? 700 : 500 }}
                      >
                        {renderColoredIcon(Award, '#f2a20b')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Bằng cấp & Chứng chỉ')}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${activeTab === 'hr_records' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setActiveTab('hr_records')}
                        style={{ padding: '8px 0.75rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', border: 'none', background: activeTab === 'hr_records' ? 'var(--color-bg-light)' : 'transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'hr_records' ? 700 : 500 }}
                      >
                        {renderColoredIcon(AlertCircle, '#ff9500')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Khen thưởng & Kỷ luật')}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${activeTab === 'bank' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setActiveTab('bank')}
                        style={{ padding: '8px 0.75rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', border: 'none', background: activeTab === 'bank' ? 'var(--color-bg-light)' : 'transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'bank' ? 700 : 500 }}
                      >
                        {renderColoredIcon(CreditCard, '#34c759')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Tài khoản Ngân hàng')}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${activeTab === 'emergency' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setActiveTab('emergency')}
                        style={{ padding: '8px 0.75rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', border: 'none', background: activeTab === 'emergency' ? 'var(--color-bg-light)' : 'transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'emergency' ? 700 : 500 }}
                      >
                        {renderColoredIcon(Shield, '#ff2d55')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Liên hệ khẩn cấp')}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${activeTab === 'schedule' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setActiveTab('schedule')}
                        style={{ padding: '8px 0.75rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', border: 'none', background: activeTab === 'schedule' ? 'var(--color-bg-light)' : 'transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'schedule' ? 700 : 500 }}
                      >
                        {renderColoredIcon(Calendar, '#f09a37')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Lịch trực nhận data')}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${activeTab === 'documents' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setActiveTab('documents')}
                        style={{ padding: '8px 0.75rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', border: 'none', background: activeTab === 'documents' ? 'var(--color-bg-light)' : 'transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'documents' ? 700 : 500 }}
                      >
                        {renderColoredIcon(Paperclip, '#8e8e93')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Lưu trữ tài liệu')}</span>
                      </button>

                      <div style={{ height: '1px', backgroundColor: 'var(--color-border-light)', margin: '6px 0.5rem' }} />

                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${activeTab === 'account' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setActiveTab('account')}
                        style={{ 
                          padding: '8px 0.75rem', 
                          fontSize: '0.825rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px', 
                          width: '100%', 
                          border: 'none', 
                          background: activeTab === 'account' ? 'rgba(239, 68, 68, 0.08)' : 'transparent', 
                          borderRadius: '8px', 
                          cursor: 'pointer', 
                          textAlign: 'left', 
                          fontWeight: activeTab === 'account' ? 700 : 500,
                          color: 'var(--color-danger)'
                        }}
                      >
                        {renderColoredIcon(Lock, '#ef4444')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Đăng nhập & Bảo mật')}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Main Content Area */}
              {(!isMobileOrTablet || activeTab) && (
                <div 
                  className={!isMobileOrTablet ? styles.contentArea : undefined} 
                  style={isMobileOrTablet ? { 
                    flex: 1, 
                    padding: '1.25rem 1rem', 
                    overflowY: 'auto', 
                    backgroundColor: 'var(--color-bg)', 
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                  } : undefined}
                >
                  {isMobileOrTablet && activeTab && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        fontSize: '0.825rem',
                        fontWeight: 650,
                        cursor: 'pointer',
                        marginBottom: '1rem',
                        boxShadow: 'var(--shadow-sm)',
                        alignSelf: 'flex-start'
                      }}
                    >
                      <ChevronLeft size={14} />
                      {t('Quay lại')}
                    </button>
                  )}
                  <form id="account-detail-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0, display: 'contents' }}>

              {/* CARD 1: THÔNG TIN CÁ NHÂN */}
              {activeTab === 'personal' && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div 
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-light)',
                      borderTopLeftRadius: '15px',
                      borderTopRightRadius: '15px'
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                      <User size={14} style={{ color: 'var(--color-primary)' }} /> {t('THÔNG TIN CÁ NHÂN')}
                    </span>
                  </div>

                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Grid A: Standard inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">{t('Họ và tên')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('Nguyễn Văn A')} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Ngày sinh')}</label>
                        <input type="date" className="form-input" value={dob} onChange={e => setDob(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Số CCCD / Hộ chiếu')}</label>
                        <input className="form-input" value={citizenId} onChange={e => setCitizenId(e.target.value)} placeholder="031xxxxxxxx" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Quốc tịch')}</label>
                        <input className="form-input" value={nationality} onChange={e => setNationality(e.target.value)} placeholder={t('Việt Nam')} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Email cá nhân')}</label>
                        <input type="email" className="form-input" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} placeholder="a@gmail.com" />
                      </div>
                      <div className="form-group" style={{ gridColumn: isMobileOrTablet ? 'span 1' : 'span 3' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <AddressSelect
                              label={t('Địa chỉ thường trú')}
                              value={address}
                              onChange={(val) => setAddress(val)}
                              placeholder={t('Chọn địa chỉ thường trú...')}
                              disabled={readOnly}
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <AddressSelect
                              label={t('Địa chỉ tạm trú')}
                              value={addressTemporary}
                              onChange={(val) => setAddressTemporary(val)}
                              placeholder={t('Chọn địa chỉ tạm trú...')}
                              disabled={readOnly}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider line */}
                    <div style={{ height: '1px', backgroundColor: 'var(--color-border-light)' }} />

                    {/* Grid B: Visual choice cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('Giới tính')}</label>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', width: 'fit-content' }}>
                          {[
                            { value: 'Nam', label: '♂ ' + t('Nam') },
                            { value: 'Nữ', label: '♀ ' + t('Nữ') },
                            { value: 'Khác', label: '⚪ ' + t('Khác') }
                          ].map(opt => {
                            const isSelected = gender === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setGender(opt.value)}
                                style={{
                                  height: '28px',
                                  padding: '0 12px',
                                  borderRadius: '6px',
                                  border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                  background: isSelected ? 'rgba(189, 29, 45, 0.04)' : 'var(--color-bg)',
                                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                  fontSize: '0.75rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  minWidth: '70px'
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('Tình trạng hôn nhân')}</label>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', width: 'fit-content' }}>
                          {[
                            { value: 'single', label: t('Độc thân') },
                            { value: 'married', label: t('Đã kết hôn') },
                            { value: 'divorced', label: t('Đã ly hôn') }
                          ].map(opt => {
                            const isSelected = maritalStatus === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setMaritalStatus(opt.value)}
                                style={{
                                  height: '28px',
                                  padding: '0 12px',
                                  borderRadius: '6px',
                                  border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                  background: isSelected ? 'rgba(189, 29, 45, 0.04)' : 'var(--color-bg)',
                                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                  fontSize: '0.75rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  minWidth: '80px'
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CARD 2: THÔNG TIN NHÂN SỰ & ERP */}
              {activeTab === 'erp' && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div 
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-light)',
                      borderTopLeftRadius: '15px',
                      borderTopRightRadius: '15px'
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                      <Building2 size={14} style={{ color: 'var(--color-primary)' }} /> {t('THÔNG TIN NHÂN SỰ & ERP')}
                    </span>
                  </div>

                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Grid A: Standard inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">{t('Mã nhân viên')}</label>
                        <input className="form-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="RL-10025" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Phòng ban')}</label>
                        <input className="form-input" value={department} onChange={e => setDepartment(e.target.value)} placeholder={t('Kinh doanh / Marketing')} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Chức danh')}</label>
                        <input className="form-input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder={t('Chuyên viên tư vấn')} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Ngày vào làm')}</label>
                        <input type="date" className="form-input" value={dateJoined} onChange={e => setDateJoined(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Quản lý trực tiếp')}</label>
                        <input className="form-input" value={directManager} onChange={e => setDirectManager(e.target.value)} placeholder={t('Tên quản lý')} />
                      </div>
                      <div className="form-group">
                        <AddressSelect
                          label={t('Địa điểm làm việc')}
                          value={workplace}
                          onChange={(val) => setWorkplace(val)}
                          placeholder={t('Chọn địa điểm làm việc...')}
                          disabled={readOnly}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Chứng chỉ môi giới')}</label>
                        <input className="form-input" value={brokerLicense} onChange={e => setBrokerLicense(e.target.value)} placeholder={t('Số chứng chỉ hành nghề')} />
                      </div>
                    </div>

                    {/* Divider line */}
                    <div style={{ height: '1px', backgroundColor: 'var(--color-border-light)' }} />

                    {/* Grid B: Visual choice cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('Loại hợp đồng')}</label>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', width: 'fit-content' }}>
                          {[
                            { value: 'official', label: t('Chính thức') },
                            { value: 'probation', label: t('Thử việc') },
                            { value: 'collaborator', label: t('Cộng tác viên') },
                            { value: 'internship', label: t('Thực tập sinh') }
                          ].map(opt => {
                            const isSelected = contractType === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setContractType(opt.value)}
                                style={{
                                  height: '28px',
                                  padding: '0 12px',
                                  borderRadius: '6px',
                                  border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                  background: isSelected ? 'rgba(189, 29, 45, 0.04)' : 'var(--color-bg)',
                                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                  fontSize: '0.75rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px'
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('Trình độ học vấn')}</label>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', width: 'fit-content' }}>
                          {[
                            { value: 'undergraduate', label: t('Đại học') },
                            { value: 'postgraduate', label: t('Sau đại học') },
                            { value: 'college', label: t('Cao đẳng') },
                            { value: 'highschool', label: t('Trung học') }
                          ].map(opt => {
                            const isSelected = degree === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setDegree(opt.value)}
                                style={{
                                  height: '28px',
                                  padding: '0 12px',
                                  borderRadius: '6px',
                                  border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                  background: isSelected ? 'rgba(189, 29, 45, 0.04)' : 'var(--color-bg)',
                                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                  fontSize: '0.75rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px'
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CARD 3: LIÊN HỆ & TÀI KHOẢN */}
              {activeTab === 'account' && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div 
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-light)',
                      borderTopLeftRadius: '15px',
                      borderTopRightRadius: '15px'
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                      <Lock size={14} style={{ color: 'var(--color-primary)' }} /> {t('LIÊN HỆ & TÀI KHOẢN')}
                    </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                    {isAdmin && account && (
                      <button
                        type="button"
                        className="btn primary sm hover-lift"
                        onClick={() => setIsPermissionModalOpen(true)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          height: '26px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderRadius: '6px',
                          background: 'var(--color-primary)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: 700
                        }}
                      >
                        <Shield size={12} /> {t('Phân quyền chi tiết')}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">{t('Tên đăng nhập (Username)')}</label>
                        <input 
                          className="form-input" 
                          value={username} 
                          onChange={e => setUsername(e.target.value)} 
                          placeholder="staff.name" 
                          disabled={!!account}
                          style={account ? { backgroundColor: 'var(--color-bg-light)', cursor: 'not-allowed' } : {}}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">
                          {account ? t('Mật khẩu mới (Để trống nếu không đổi)') : t('Mật khẩu')} {account ? '' : <span style={{ color: 'var(--color-danger)' }}>*</span>}
                        </label>
                        <input 
                          type="password" 
                          className="form-input" 
                          value={password} 
                          onChange={e => setPassword(e.target.value)} 
                          placeholder={account ? t('Nhập mật khẩu mới') : t('Tối thiểu 6 ký tự')}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Email đăng nhập')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Số điện thoại liên hệ')}</label>
                        <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxx" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Số điện thoại nội bộ (Extension)')}</label>
                        <input className="form-input" value={extNumber} onChange={e => setExtNumber(e.target.value)} placeholder="102" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Zalo Chat ID</label>
                        <input className="form-input" value={zaloChatId} disabled style={{ backgroundColor: 'var(--color-bg-light)', cursor: 'not-allowed' }} placeholder={t('Chưa liên kết Zalo')} />
                      </div>

                      {isAdmin && (
                        <>
                          <div className="form-group">
                            <label className="form-label">{t('Phân quyền')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <CustomSelect 
                              options={[
                                { value: 'superadmin', label: t('Super Admin (Quản trị cấp cao)') },
                                { value: 'admin', label: t('Admin (Toàn quyền)') },
                                { value: 'director', label: t('Director (Giám đốc kinh doanh)') },
                                { value: 'manager', label: t('Manager (Trưởng nhóm kinh doanh)') },
                                { value: 'assistant', label: t('Assistant (Trợ lý / Phân bổ Data)') },
                                { value: 'sale', label: t('Sales (Nhân viên kinh doanh)') },
                                { value: 'viewer', label: t('Viewer (Chỉ xem Data)') }
                              ]}
                              value={role}
                              onChange={val => {
                                const newRole = val.toString();
                                setRole(newRole);
                                setPermissionsJson(getDefaultPermissionsForRole(newRole));
                              }}
                              width="100%"
                              disabled={readOnly}
                            />
                          </div>
                          {role === 'manager' && (
                            <div className="form-group">
                              <label className="form-label">{t('Chế độ hoạt động Trưởng nhóm')}</label>
                              <CustomSelect 
                                options={[
                                  { value: 'combined', label: t('Trưởng nhóm kiêm Sale') },
                                  { value: 'pure', label: t('Trưởng nhóm thuần túy') }
                                ]}
                                value={managerBehaviorMode}
                                onChange={val => setManagerBehaviorMode(val.toString())}
                                width="100%"
                                disabled={readOnly}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Manager Mode Explanation (if role === 'manager') */}
                    {role === 'manager' && (
                      <div style={{
                        padding: '1rem',
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '12px',
                        fontSize: '0.8125rem',
                        lineHeight: 1.5,
                        color: 'var(--color-text-muted)'
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Info size={14} style={{ color: 'var(--color-primary)' }} />
                          {t('Thông tin về Chế độ hoạt động Trưởng nhóm:')}
                        </div>
                        <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <li><strong>{t('Trưởng nhóm kiêm Sale:')}</strong> {t('Đồng hồ bảo mật và phân chia data chạy như một nhân viên sales bình thường. Trưởng nhóm phải chấm công và có thể nhận phân bổ data từ hệ thống.')}</li>
                          <li><strong>{t('Trưởng nhóm thuần túy:')}</strong> {t('Không tham gia nhận chia data tự động, không cần check-in chấm công hàng ngày. Đóng vai trò quản lý cấp cao duyệt đơn đi trễ/SLA cho nhân viên.')}</li>
                        </ul>
                      </div>
                    )}

                    {/* Active Status Toggle (Full-width row) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '1.25rem',
                      borderTop: '1px solid var(--color-border-light)',
                      marginTop: '0.5rem'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', display: 'block' }}>
                          {t('Trạng thái hoạt động')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>
                          {isActive === '1' ? t('Tài khoản đang hoạt động bình thường và được phép đăng nhập') : t('Tài khoản đang bị khóa và không thể truy cập hệ thống')}
                        </span>
                      </div>
                      <ToggleSwitch 
                        checked={isActive === '1'}
                        onChange={checked => setIsActive(checked ? '1' : '0')}
                        disabled={readOnly}
                      />
                    </div>

                    {account && zaloChatId && (
                      <div style={{
                        padding: '1rem',
                        background: 'rgba(59, 130, 246, 0.05)',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {t('Tương tác Zalo Bot')}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '0.75rem', height: '36px' }}
                            placeholder={t('Nhập tin nhắn gửi nhanh qua Zalo...')}
                            value={quickMsgText}
                            onChange={e => setQuickMsgText(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={handleSendQuickMsg}
                            disabled={isSendingQuickMsg || !quickMsgText.trim()}
                            className="btn primary sm"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '36px', borderRadius: '8px' }}
                          >
                            {isSendingQuickMsg ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleUnlinkZalo}
                          disabled={isUnlinking}
                          className="btn outline sm"
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--color-warning)',
                            borderColor: 'rgba(245, 158, 11, 0.3)',
                            background: 'var(--color-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            alignSelf: 'flex-start'
                          }}
                        >
                          <Link2Off size={12} /> {t('Hủy liên kết Zalo')}
                        </button>
                      </div>
                    )}

                    {isAdmin && account && (
                      <div style={{
                        marginTop: '2rem',
                        paddingTop: '1.5rem',
                        borderTop: '1px solid var(--color-border-light)',
                        display: 'flex',
                        justifyContent: 'flex-end'
                      }}>
                        <button
                          type="button"
                          onClick={handleOpenDeleteConfirm}
                          className="btn-danger-light"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Trash2 size={16} />
                          {t('Xóa tài khoản nhân sự')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CARD 4: THANH TOÁN & THUẾ */}
              {activeTab === 'bank' && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div 
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-light)',
                      borderTopLeftRadius: '15px',
                      borderTopRightRadius: '15px'
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                      <CreditCard size={14} style={{ color: 'var(--color-primary)' }} /> {t('THANH TOÁN & THUẾ')}
                    </span>
                  </div>

                  <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">{t('Tên ngân hàng')}</label>
                      <input className="form-input" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Vietcombank" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Số tài khoản (STK)')}</label>
                      <input className="form-input" value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="1903xxxxxxxx" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Chi nhánh ngân hàng')}</label>
                      <input className="form-input" value={bankBranch} onChange={e => setBankBranch(e.target.value)} placeholder={t('Hồ Chí Minh')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Mã số thuế cá nhân')}</label>
                      <input className="form-input" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="81xxxxxx" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Số sổ bảo hiểm xã hội (BHXH)')}</label>
                      <input className="form-input" value={insuranceId} onChange={e => setInsuranceId(e.target.value)} placeholder="01xxxxxxxx" />
                    </div>
                  </div>
                </div>
              )}

              {/* CARD 5: LIÊN HỆ KHẨN CẤP */}
              {activeTab === 'emergency' && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div 
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-light)',
                      borderTopLeftRadius: '15px',
                      borderTopRightRadius: '15px'
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                      <Shield size={14} style={{ color: 'var(--color-primary)' }} /> {t('LIÊN HỆ KHẨN CẤP')}
                    </span>
                  </div>

                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {emergencyContacts.map((contact, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        padding: '1rem',
                        background: 'var(--color-bg-light)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '12px',
                        alignItems: 'flex-end'
                      }}>
                        <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
                          <label className="form-label">{t('Tên người liên hệ khẩn cấp')}</label>
                          <input 
                            className="form-input" 
                            value={contact.name} 
                            onChange={e => {
                              const list = [...emergencyContacts];
                              list[index].name = e.target.value;
                              setEmergencyContacts(list);
                            }} 
                            placeholder={t('Tên người thân')} 
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
                          <label className="form-label">{t('Mối quan hệ')}</label>
                          <input 
                            className="form-input" 
                            value={contact.relationship} 
                            onChange={e => {
                              const list = [...emergencyContacts];
                              list[index].relationship = e.target.value;
                              setEmergencyContacts(list);
                            }} 
                            placeholder={t('Bố/Mẹ/Vợ/Chồng')} 
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
                          <label className="form-label">{t('Số điện thoại khẩn cấp')}</label>
                          <input 
                            className="form-input" 
                            value={contact.phone} 
                            onChange={e => {
                              const list = [...emergencyContacts];
                              list[index].phone = e.target.value;
                              setEmergencyContacts(list);
                            }} 
                            placeholder="09xxxxxxx" 
                          />
                        </div>
                        {emergencyContacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const list = emergencyContacts.filter((_, i) => i !== index);
                              setEmergencyContacts(list);
                            }}
                            className="btn outline sm"
                            style={{
                              padding: '10px',
                              borderRadius: '8px',
                              color: 'var(--color-danger)',
                              borderColor: 'rgba(239, 68, 68, 0.2)',
                              minWidth: 'auto',
                              height: '42px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEmergencyContacts([...emergencyContacts, { name: '', relationship: '', phone: '' }])}
                      className="btn outline sm"
                      style={{
                        alignSelf: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        padding: '6px 12px',
                        borderRadius: '8px'
                      }}
                    >
                      <Plus size={14} /> {t('Thêm liên hệ khẩn cấp')}
                    </button>
                  </div>
                </div>
              )}

              {/* CARD 6: TRỰC TUYẾN & LỊCH LÀM VIỆC */}
              {activeTab === 'schedule' && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div 
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-light)',
                      borderTopLeftRadius: '15px',
                      borderTopRightRadius: '15px'
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                      <Calendar size={14} style={{ color: 'var(--color-primary)' }} /> {t('TRỰC TUYẾN & LỊCH LÀM VIỆC')}
                    </span>
                  </div>

                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Vacation mode */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem',
                      background: 'var(--color-bg-light)',
                      borderRadius: '12px',
                      border: '1px solid var(--color-border-light)'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{t('Chế độ Nghỉ phép (Vacation Mode)')}</span>
                          {vacationMode && <span className="badge success" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{t('Đang nghỉ phép')}</span>}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0', maxWidth: '580px' }}>
                          {role === 'sale' 
                            ? t('Khi được kích hoạt, hệ thống sẽ tạm dừng phân bổ lead tự động cho chuyên viên này. Hệ thống sẽ tự động khóa trực nhận lead nếu phát hiện nghỉ phép không lý do.')
                            : t('Khi được kích hoạt, trạng thái công việc của nhân sự sẽ tự động báo cáo cho bộ phận nhân sự là đang nghỉ phép/nghỉ lễ.')}
                        </p>
                      </div>
                      <div 
                        onClick={() => setVacationMode(!vacationMode)}
                        style={{
                          width: '46px',
                          height: '24px',
                          borderRadius: '12px',
                          backgroundColor: vacationMode ? '#10B981' : '#E2E8F0',
                          padding: '2px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        <div 
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                            transform: vacationMode ? 'translateX(22px)' : 'translateX(0px)',
                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        />
                      </div>
                    </div>

                    {/* Overtime mode */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem',
                      background: 'var(--color-bg-light)',
                      borderRadius: '12px',
                      border: '1px solid var(--color-border-light)'
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{t('Đăng ký trực đêm / Tăng ca (Overtime Mode)')}</span>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0', maxWidth: '580px' }}>
                          {role === 'sale' 
                            ? t('Kích hoạt để chuyên viên này tham gia trực đêm và nhận lead tự động ngoài giờ làm việc hành chính.')
                            : t('Ghi nhận thông tin tăng ca đêm của nhân sự để phục vụ cho việc tính ngày công tăng ca hàng tháng.')}
                        </p>
                      </div>
                      <div 
                        onClick={() => setOvertimeMode(!overtimeMode)}
                        style={{
                          width: '46px',
                          height: '24px',
                          borderRadius: '12px',
                          backgroundColor: overtimeMode ? '#10B981' : '#E2E8F0',
                          padding: '2px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        <div 
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                            transform: overtimeMode ? 'translateX(22px)' : 'translateX(0px)',
                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        />
                      </div>
                    </div>

                    {/* Leave Range picker */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">{t('Nghỉ phép từ ngày')}</label>
                        <input type="date" className="form-input" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('Đến hết ngày')}</label>
                        <input type="date" className="form-input" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                      </div>
                    </div>

                    {/* Working Hours */}
                    <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div>
                          <h4 style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0, color: 'var(--color-text)' }}>{t('Giờ làm việc & Lịch trình')}</h4>
                          <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                            {t('Cấu hình giờ làm việc riêng biệt cho chuyên viên này thay vì áp dụng lịch công ty chung.')}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: useCustomWorkHours ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                            {useCustomWorkHours ? t('Bật giờ cá nhân') : t('Mặc định công ty')}
                          </span>
                          <div 
                            onClick={() => setUseCustomWorkHours(!useCustomWorkHours)}
                            style={{
                              width: '40px',
                              height: '20px',
                              borderRadius: '10px',
                              backgroundColor: useCustomWorkHours ? '#10B981' : '#E2E8F0',
                              padding: '2px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              flexShrink: 0
                            }}
                          >
                            <div 
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                transform: useCustomWorkHours ? 'translateX(20px)' : 'translateX(0px)',
                                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {!useCustomWorkHours ? (
                        <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.04)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.12)', marginBottom: '1rem' }}>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-primary)', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Info size={14} style={{ marginRight: "6px" }} /> Đang áp dụng giờ làm việc chung của công ty. Kích hoạt nút gạt ở trên nếu muốn cấu hình lịch làm việc riêng biệt cho nhân sự này.
                          </p>
                        </div>
                      ) : null}

                      <div style={{ opacity: useCustomWorkHours ? 1 : 0.45, pointerEvents: useCustomWorkHours ? 'auto' : 'none', transition: 'all 0.2s ease' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', background: 'var(--color-bg-light)', padding: '4px', borderRadius: '8px', width: 'max-content' }}>
                          <button
                            type="button"
                            onClick={() => setScheduleMode('daily')}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: scheduleMode === 'daily' ? 'var(--color-surface)' : 'transparent',
                              color: scheduleMode === 'daily' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              boxShadow: scheduleMode === 'daily' ? 'var(--shadow-sm)' : 'none'
                            }}
                          >
                            {t('Hằng ngày (Cố định)')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setScheduleMode('custom')}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: scheduleMode === 'custom' ? 'var(--color-surface)' : 'transparent',
                              color: scheduleMode === 'custom' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              boxShadow: scheduleMode === 'custom' ? 'var(--shadow-sm)' : 'none'
                            }}
                          >
                            {t('Tự chọn (Lịch tuần)')}
                          </button>
                        </div>

                        {scheduleMode === 'daily' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--color-bg-light)', padding: '1rem', borderRadius: '12px' }}>
                            <div className="form-group">
                              <label className="form-label">{t('Giờ bắt đầu hành chính')}</label>
                              <input type="time" className="form-input" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">{t('Giờ kết thúc hành chính')}</label>
                              <input type="time" className="form-input" value={workEndTime} onChange={e => setWorkEndTime(e.target.value)} />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {Object.keys(DAY_LABELS).map((dayKey) => {
                              const dayConfig = workSchedule[dayKey] || { active: false, start: "08:00", end: "17:30" };
                              return (
                                <div key={dayKey} style={{
                                  display: 'grid',
                                  gridTemplateColumns: '120px 80px 1fr',
                                  alignItems: 'center',
                                  gap: '1rem',
                                  padding: '8px 12px',
                                  background: 'var(--color-bg-light)',
                                  borderRadius: '8px'
                                }}>
                                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{DAY_LABELS[dayKey]}</span>
                                  <input 
                                    type="checkbox" 
                                    checked={dayConfig.active} 
                                    onChange={e => {
                                      setWorkSchedule({
                                        ...workSchedule,
                                        [dayKey]: { ...dayConfig, active: e.target.checked }
                                      });
                                    }} 
                                    style={{ cursor: 'pointer' }}
                                  />
                                  {dayConfig.active ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <input 
                                        type="time" 
                                        className="form-input" 
                                        style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto', width: '90px' }}
                                        value={dayConfig.start} 
                                        onChange={e => {
                                          setWorkSchedule({
                                            ...workSchedule,
                                            [dayKey]: { ...dayConfig, start: e.target.value }
                                          });
                                        }} 
                                      />
                                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('đến')}</span>
                                      <input 
                                        type="time" 
                                        className="form-input" 
                                        style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto', width: '90px' }}
                                        value={dayConfig.end} 
                                        onChange={e => {
                                          setWorkSchedule({
                                            ...workSchedule,
                                            [dayKey]: { ...dayConfig, end: e.target.value }
                                          });
                                        }} 
                                      />
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Nghỉ tuần')}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Section: Roster and Shift Registrations */}
                      <div style={{ borderTop: '1px solid var(--color-border-light)', marginTop: '1.5rem', paddingTop: '1rem' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} style={{ marginRight: "6px" }} /> Lịch trực đã đăng ký (Data Roster)
                        </h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
                          {/* Column 1: Lịch trực ngày lễ */}
                          <div style={{ background: 'var(--color-bg-light)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                            <h5 style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text)', marginBottom: '0.75rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '6px' }}>
                              Trực lễ ({holidayShifts.length})
                            </h5>
                            {holidayShifts.length === 0 ? (
                              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>Chưa có đăng ký trực lễ.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                {holidayShifts.map((s, idx) => (
                                  <div key={s.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '4px 8px', background: 'var(--color-surface)', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                                    <div>
                                      <strong style={{ color: 'var(--color-text)' }}>{s.holiday_name}</strong>
                                      <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>({new Date(s.shift_date).toLocaleDateString('vi-VN')})</span>
                                    </div>
                                    <span className={`badge ${s.approved ? 'success' : 'warning'}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                                      {s.approved ? 'Đã duyệt' : 'Chờ duyệt'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Column 2: Lịch trực tuần (Đêm & Cuối tuần) */}
                          <div style={{ background: 'var(--color-bg-light)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                            <h5 style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text)', marginBottom: '0.75rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '6px' }}>
                              Trực đêm & Cuối tuần ({nightShifts.length + weekendShifts.length})
                            </h5>
                            {nightShifts.length === 0 && weekendShifts.length === 0 ? (
                              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>Chưa có đăng ký trực tuần.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                {[
                                  ...nightShifts.map(x => ({ ...x, type: 'Ca đêm', badge: 'warning' })),
                                  ...weekendShifts.map(x => ({ ...x, type: 'Cuối tuần', badge: 'primary' }))
                                ]
                                  .sort((a, b) => new Date(b.shift_date).getTime() - new Date(a.shift_date).getTime())
                                  .map((s, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '4px 8px', background: 'var(--color-surface)', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                                      <div>
                                        <span className={`badge ${s.badge}`} style={{ fontSize: '0.6rem', padding: '1px 4px', marginRight: '6px' }}>{s.type}</span>
                                        <strong style={{ color: 'var(--color-text)' }}>{new Date(s.shift_date).toLocaleDateString('vi-VN')}</strong>
                                      </div>
                                      <span className={`badge ${s.approved ? 'success' : 'secondary'}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                                        {s.approved ? 'Đã duyệt' : 'Chờ duyệt'}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CARD 7: TÀI LIỆU & HỒ SƠ ĐÍNH KÈM */}
              {activeTab === 'certificates' && (
                <div className="card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={18} color="var(--color-primary)" />
                    {t('BẰNG CẤP & CHỨNG CHỈ HÀNH NGHỀ')}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    {t('Cập nhật các bằng cấp, chứng chỉ chuyên môn của nhân viên để phục vụ công tác thẩm định hồ sơ.')}
                  </p>

                  {certificates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--color-bg)', borderRadius: '12px', border: '1px dashed var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        {t('Chưa có chứng chỉ hoặc bằng cấp nào được thêm.')}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {certificates.map((cert, index) => (
                        <div key={cert.id || index} style={{
                          display: 'flex',
                          flexDirection: isMobileOrTablet ? 'column' : 'row',
                          gap: '1.5rem',
                          padding: '1.5rem',
                          background: 'var(--color-bg-alt)',
                          borderRadius: '12px',
                          border: '1px solid var(--color-border-light)',
                          position: 'relative'
                        }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(t('Bạn có chắc chắn muốn xóa chứng chỉ này?'))) {
                                setCertificates(certificates.filter((_, i) => i !== index));
                              }
                            }}
                            style={{
                              position: 'absolute', top: '12px', right: '12px',
                              background: 'rgba(239, 68, 68, 0.08)', border: 'none',
                              color: 'var(--color-danger)', cursor: 'pointer',
                              padding: '6px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                            className="hover-bg-danger-light"
                            title={t('Xóa chứng chỉ')}
                          >
                            <Trash2 size={16} />
                          </button>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
                            <div style={{
                              width: '140px',
                              height: '90px',
                              borderRadius: '8px',
                              border: '2px dashed var(--color-border)',
                              background: 'var(--color-surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              position: 'relative',
                              boxShadow: 'var(--shadow-sm)'
                            }}>
                              {cert.image ? (
                                <img src={resolveAttachmentUrl(cert.image)} alt="Certificate" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>
                                  <Camera size={20} />
                                  <span style={{ fontSize: '0.65rem' }}>{t('Chưa có ảnh')}</span>
                                </div>
                              )}
                            </div>

                            <label style={{
                              background: 'var(--color-primary-light)',
                              color: 'var(--color-primary)',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'center',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }} className="hover-lift">
                              <Plus size={12} />
                              {cert.image ? t('Thay ảnh') : t('Tải ảnh')}
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleCertificateImageUpload(index, file);
                                }}
                              />
                            </label>
                          </div>

                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? '1fr' : '1.5fr 1fr', gap: '1rem' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{t('Tên bằng cấp / chứng chỉ')}</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={cert.name || ''}
                                  onChange={(e) => {
                                    const updated = [...certificates];
                                    updated[index] = { ...updated[index], name: e.target.value };
                                    setCertificates(updated);
                                  }}
                                  placeholder={t('Ví dụ: Chứng chỉ hành nghề Môi giới BĐS')}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{t('Mã số chứng chỉ')}</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={cert.code || ''}
                                  onChange={(e) => {
                                    const updated = [...certificates];
                                    updated[index] = { ...updated[index], code: e.target.value };
                                    setCertificates(updated);
                                  }}
                                  placeholder={t('Số hiệu / Mã số')}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{t('Tổ chức cấp')}</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={cert.issuer || ''}
                                  onChange={(e) => {
                                    const updated = [...certificates];
                                    updated[index] = { ...updated[index], issuer: e.target.value };
                                    setCertificates(updated);
                                  }}
                                  placeholder={t('Ví dụ: Sở Xây Dựng TP.HCM')}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{t('Đường dẫn liên kết (Link)')}</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={cert.link || ''}
                                  onChange={(e) => {
                                    const updated = [...certificates];
                                    updated[index] = { ...updated[index], link: e.target.value };
                                    setCertificates(updated);
                                  }}
                                  placeholder={t('Ví dụ: https://example.com/certificate')}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày cấp')}</label>
                                <input
                                  type="date"
                                  className="form-input"
                                  value={cert.issuedDate || ''}
                                  onChange={(e) => {
                                    const updated = [...certificates];
                                    updated[index] = { ...updated[index], issuedDate: e.target.value };
                                    setCertificates(updated);
                                  }}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày hết hạn')}</label>
                                <input
                                  type="date"
                                  className="form-input"
                                  value={cert.expiryDate || ''}
                                  onChange={(e) => {
                                    const updated = [...certificates];
                                    updated[index] = { ...updated[index], expiryDate: e.target.value };
                                    setCertificates(updated);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn outline"
                    onClick={() => {
                      setCertificates([...certificates, {
                        id: 'cert_' + Math.random().toString(36).substring(2, 9),
                        name: '',
                        code: '',
                        issuer: '',
                        link: '',
                        image: '',
                        issuedDate: '',
                        expiryDate: ''
                      }]);
                    }}
                    style={{ width: 'fit-content', alignSelf: 'flex-start', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} />
                    {t('Thêm bằng cấp / chứng chỉ')}
                  </button>
                </div>
              )}

              {activeTab === 'hr_records' && (
                <div className="card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={18} color="var(--color-primary)" />
                    {t('KHEN THƯỞNG, CẢNH CÁO & KỶ LUẬT')}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    {t('Lịch sử ghi nhận thành tích, nhắc nhở hoặc các quyết định kỷ luật nhân sự.')}
                  </p>

                  {hrRecords.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--color-bg)', borderRadius: '12px', border: '1px dashed var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        {t('Chưa có ghi nhận khen thưởng hoặc kỷ luật nào.')}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {hrRecords.map((record, index) => {
                        const isAward = record.type === 'award';
                        const isWarning = record.type === 'warning';

                        const badgeColor = isAward ? 'var(--color-success)' : (isWarning ? 'var(--color-warning)' : 'var(--color-danger)');
                        const badgeBg = isAward ? 'rgba(16, 185, 129, 0.1)' : (isWarning ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)');
                        
                        return (
                          <div key={record.id || index} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            padding: '1.25rem',
                            background: 'var(--color-bg-alt)',
                            borderRadius: '12px',
                            border: '1px solid var(--color-border-light)',
                            position: 'relative'
                          }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t('Bạn có chắc chắn muốn xóa ghi nhận này?'))) {
                                  setHrRecords(hrRecords.filter((_, i) => i !== index));
                                }
                              }}
                              style={{
                                position: 'absolute', top: '12px', right: '12px',
                                background: 'rgba(239, 68, 68, 0.08)', border: 'none',
                                color: 'var(--color-danger)', cursor: 'pointer',
                                padding: '6px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s'
                              }}
                              className="hover-bg-danger-light"
                              title={t('Xóa ghi nhận')}
                            >
                              <Trash2 size={16} />
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? '1fr' : '1fr 1.5fr 1fr', gap: '1rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Phân loại')}</label>
                                  <CustomSelect
                                    options={[
                                      { value: 'award', label: t('Khen thưởng') },
                                      { value: 'warning', label: t('Cảnh cáo') },
                                      { value: 'discipline', label: t('Kỷ luật') }
                                    ]}
                                    value={record.type}
                                    onChange={val => {
                                      const updated = [...hrRecords];
                                      updated[index] = { ...updated[index], type: val as any };
                                      setHrRecords(updated);
                                    }}
                                    placeholder={t('Chọn loại...')}
                                    disabled={readOnly}
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Tiêu đề / Tên quyết định')}</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={record.title || ''}
                                    onChange={(e) => {
                                      const updated = [...hrRecords];
                                      updated[index] = { ...updated[index], title: e.target.value };
                                      setHrRecords(updated);
                                    }}
                                    placeholder={t('Ví dụ: Vinh danh chuyên xuất sắc quý 2')}
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Số quyết định')}</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={record.decisionNumber || ''}
                                    onChange={(e) => {
                                      const updated = [...hrRecords];
                                      updated[index] = { ...updated[index], decisionNumber: e.target.value };
                                      setHrRecords(updated);
                                    }}
                                    placeholder="Ví dụ: QĐ-12/2026/RL"
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? '1fr' : '1fr 1fr 1.5fr', gap: '1rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày quyết định')}</label>
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={record.date || ''}
                                    onChange={(e) => {
                                      const updated = [...hrRecords];
                                      updated[index] = { ...updated[index], date: e.target.value };
                                      setHrRecords(updated);
                                    }}
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Giá trị phạt/thưởng (nếu có)')}</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={record.amount || ''}
                                    onChange={(e) => {
                                      const updated = [...hrRecords];
                                      updated[index] = { ...updated[index], amount: e.target.value };
                                      setHrRecords(updated);
                                    }}
                                    placeholder="Ví dụ: +1,000,000đ hoặc -500,000đ"
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Đường dẫn văn bản đính kèm')}</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={record.documentLink || ''}
                                    onChange={(e) => {
                                      const updated = [...hrRecords];
                                      updated[index] = { ...updated[index], documentLink: e.target.value };
                                      setHrRecords(updated);
                                    }}
                                    placeholder="https://example.com/decision.pdf"
                                  />
                                </div>
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{t('Lý do & Nội dung chi tiết')}</label>
                                <textarea
                                  className="form-input"
                                  rows={2}
                                  value={record.reason || ''}
                                  onChange={(e) => {
                                    const updated = [...hrRecords];
                                    updated[index] = { ...updated[index], reason: e.target.value };
                                    setHrRecords(updated);
                                  }}
                                  placeholder={t('Ghi chú chi tiết lý do và nội dung sự việc')}
                                  style={{ minHeight: '60px' }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn outline"
                    onClick={() => {
                      setHrRecords([...hrRecords, {
                        id: 'hr_' + Math.random().toString(36).substring(2, 9),
                        type: 'award',
                        title: '',
                        decisionNumber: '',
                        date: new Date().toISOString().split('T')[0],
                        amount: '',
                        documentLink: '',
                        reason: ''
                      }]);
                    }}
                    style={{ width: 'fit-content', alignSelf: 'flex-start', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} />
                    {t('Thêm khen thưởng / kỷ luật')}
                  </button>
                </div>
              )}

              {account && activeTab === 'documents' && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div 
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-light)',
                      borderTopLeftRadius: '15px',
                      borderTopRightRadius: '15px'
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                      <Paperclip size={14} style={{ color: 'var(--color-primary)' }} /> {t('HỒ SƠ & TÀI LIỆU ĐÍNH KÈM')}
                    </span>
                  </div>

                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                          {t('Danh sách các bằng cấp, chứng chỉ, hồ sơ nhân sự.')}
                        </span>
                        <button
                          type="button"
                          className="btn primary sm"
                          onClick={() => docInputRef.current?.click()}
                          disabled={isUploadingDoc}
                          style={{ borderRadius: '8px', fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {isUploadingDoc ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
                          {t('Thêm tài liệu')}
                        </button>
                        <input 
                          type="file" 
                          ref={docInputRef} 
                          style={{ display: 'none' }} 
                          onChange={handleDocUpload}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        />
                      </div>

                      {loadingDocs ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                          <Loader2 size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                      ) : documents.length === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '2.5rem 1rem',
                          border: '2px dashed var(--color-border-light)',
                          borderRadius: '12px',
                          color: 'var(--color-text-muted)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}>
                          <FileText size={32} style={{ opacity: 0.5 }} />
                          <span style={{ fontSize: '0.8125rem' }}>{t('Chưa có hồ sơ tài liệu đính kèm.')}</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {documents.map((doc) => (
                            <div key={doc.id} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 12px',
                              background: 'var(--color-bg-light)',
                              border: '1px solid var(--color-border-light)',
                              borderRadius: '10px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <Paperclip size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {doc.name}
                                  </p>
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                                    {Math.round(doc.file_size / 1024)} KB · {new Date(doc.created_at).toLocaleDateString('vi-VN')} {t('bởi')} {doc.uploader_name || t('Hệ thống')}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <a 
                                  href={doc.file_path.startsWith('http') ? doc.file_path : `${import.meta.env.VITE_API_URL || '/backend'}/${doc.file_path}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="btn outline sm"
                                  style={{ padding: '6px', borderRadius: '6px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Download size={13} />
                                </a>
                                <button
                                  type="button"
                                  className="btn outline sm"
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  style={{ padding: '6px', borderRadius: '6px', minWidth: 'auto', color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                    </fieldset>
                  </form>
            </div>
          )}
          </>
        )}
      </div>
      </motion.div>

      {/* Detailed Permission Modal */}
      <AnimatePresence>
        {isPermissionModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--color-surface)',
                borderRadius: '24px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-xl)',
                width: '1000px',
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '85vh',
                overflow: 'hidden'
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--color-bg-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--color-primary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)'
                  }}>
                    <Shield size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--color-text)', margin: 0 }}>
                      Phân quyền chi tiết: {name}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                      Cài đặt các nhóm quản lý và quyền thao tác chi tiết trên từng module.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPermissionModalOpen(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
                
                {/* 1. DETAILED MODULE PERMISSIONS */}
                <div>
                  <h4 style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    1. Quyền thao tác các Modules (Module Permissions)
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                    Cấu hình sâu quyền hạn của người dùng đối với các mục dữ liệu trong hệ thống.
                  </p>

                  {/* Preset Options */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    padding: '10px 14px',
                    background: 'var(--color-bg-light)',
                    borderRadius: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      Chọn nhanh mẫu (Presets):
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[
                        { 
                          label: 'Chỉ Xem (Viewer)', 
                          role: 'viewer',
                          data: {
                            leads: { read: 'all', write: 'none', delete: 'none' },
                            deals: { read: 'all', write: 'none', delete: 'none' },
                            cooperation: { read: 'all', write: 'none', delete: 'none' },
                            quotes: { read: 'all', write: 'none', delete: 'none' },
                            projects: { read: 'all', write: 'none', delete: 'none' },
                            settings: { read: 'none', write: 'none', delete: 'none' }
                          }
                        },
                        { 
                          label: 'Nhân Viên (Sales)', 
                          role: 'sales',
                          data: {
                            leads: { read: 'own', write: 'own', delete: 'none' },
                            deals: { read: 'own', write: 'own', delete: 'none' },
                            cooperation: { read: 'own', write: 'own', delete: 'none' },
                            quotes: { read: 'own', write: 'own', delete: 'none' },
                            projects: { read: 'all', write: 'none', delete: 'none' },
                            settings: { read: 'none', write: 'none', delete: 'none' }
                          }
                        },
                        { 
                          label: 'Trưởng Nhóm (Manager)', 
                          role: 'manager',
                          data: {
                            leads: { read: 'team', write: 'team', delete: 'none' },
                            deals: { read: 'team', write: 'team', delete: 'none' },
                            cooperation: { read: 'team', write: 'own', delete: 'none' },
                            quotes: { read: 'team', write: 'team', delete: 'none' },
                            projects: { read: 'all', write: 'none', delete: 'none' },
                            settings: { read: 'none', write: 'none', delete: 'none' }
                          }
                        },
                        { 
                          label: 'Giám Đốc (Director)', 
                          role: 'director',
                          data: {
                            leads: { read: 'all', write: 'all', delete: 'none' },
                            deals: { read: 'all', write: 'all', delete: 'all' },
                            cooperation: { read: 'all', write: 'all', delete: 'all' },
                            quotes: { read: 'all', write: 'all', delete: 'all' },
                            projects: { read: 'all', write: 'all', delete: 'none' },
                            settings: { read: 'none', write: 'none', delete: 'none' }
                          }
                        },
                        { 
                          label: 'Quản Trị (Admin)', 
                          role: 'admin',
                          data: {
                            leads: { read: 'all', write: 'all', delete: 'all' },
                            deals: { read: 'all', write: 'all', delete: 'all' },
                            cooperation: { read: 'all', write: 'all', delete: 'all' },
                            quotes: { read: 'all', write: 'all', delete: 'all' },
                            projects: { read: 'all', write: 'all', delete: 'all' },
                            settings: { read: 'all', write: 'all', delete: 'all' }
                          }
                        }
                      ].map((preset) => (
                        <button
                          key={preset.role}
                          type="button"
                          onClick={() => {
                            setPermissionsJson(preset.data);
                            toast.success(`Đã áp dụng cấu hình nhanh cho vai trò: ${preset.label}`);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                            e.currentTarget.style.color = 'var(--color-primary)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                            e.currentTarget.style.color = 'var(--color-text)';
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '14px', overflow: 'visible' }}>
                    <style dangerouslySetInnerHTML={{ __html: `
                      .no-hover-table tbody tr:hover,
                      .no-hover-table tbody tr:hover td {
                        background: var(--color-surface) !important;
                        background-color: var(--color-surface) !important;
                      }
                      .no-hover-table tbody tr td:first-child::before {
                        display: none !important;
                      }
                    ` }} />
                    <table className="no-hover-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, overflow: 'visible', textAlign: 'left', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-bg-light)', borderBottom: '1px solid var(--color-border)' }}>
                          <th rowSpan={2} style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--color-text)', width: '22%', verticalAlign: 'middle', borderRight: '1px solid var(--color-border-light)' }}>Module</th>
                          <th colSpan={3} style={{ padding: '8px 14px', fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', borderRight: '1px solid var(--color-border-light)' }}>Xem (Read)</th>
                          <th colSpan={3} style={{ padding: '8px 14px', fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', borderRight: '1px solid var(--color-border-light)' }}>Sửa (Write)</th>
                          <th colSpan={3} style={{ padding: '8px 14px', fontWeight: 700, color: 'var(--color-text)', textAlign: 'center' }}>Xóa (Delete)</th>
                        </tr>
                        <tr style={{ background: 'var(--color-bg-light)', borderBottom: '1px solid var(--color-border)' }}>
                          {/* Xem */}
                          <th style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', width: '8.5%' }}>C.Nhân</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', width: '8.5%' }}>Nhóm</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', width: '9%', borderRight: '1px solid var(--color-border-light)' }}>T.Bộ</th>
                          
                          {/* Sửa */}
                          <th style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', width: '8.5%' }}>C.Nhân</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', width: '8.5%' }}>Nhóm</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', width: '9%', borderRight: '1px solid var(--color-border-light)' }}>T.Bộ</th>
                          
                          {/* Xóa */}
                          <th style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', width: '8.5%' }}>C.Nhân</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', width: '8.5%' }}>Nhóm</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', width: '9%' }}>T.Bộ</th>
                        </tr>
                      </thead>
                      <tbody style={{ overflow: 'visible' }}>
                        {[
                          { key: 'leads', label: 'Khách hàng (Leads/Contacts)' },
                          { key: 'deals', label: 'Đặt cọc & Hợp đồng (Deals/Deposits)' },
                          { key: 'cooperation', label: 'Phiếu Hợp tác (Cooperation Slips)' },
                          { key: 'quotes', label: 'Báo giá & Hóa đơn (Quotes/Invoices)' },
                          { key: 'projects', label: 'Dự án & Roster (Projects)' },
                          { key: 'settings', label: 'Cấu hình & Tích hợp (Settings)' }
                        ].map((mod) => {
                          const getVal = (action: 'read' | 'write' | 'delete') => {
                            return permissionsJson[mod.key]?.[action] || 'none';
                          };
                          const setVal = (action: 'read' | 'write' | 'delete', val: string) => {
                            setPermissionsJson((prev: any) => ({
                              ...prev,
                              [mod.key]: {
                                ...(prev[mod.key] || {}),
                                [action]: val
                              }
                            }));
                          };

                          const renderCheckbox = (action: 'read' | 'write' | 'delete', scope: 'own' | 'team' | 'all') => {
                            const val = getVal(action);
                            const isChecked = val === scope;
                            const activeColor = mod.key === 'settings' ? 'var(--color-danger)' : 'var(--color-primary)';
                            return (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '36px' }}>
                                <label style={{
                                  position: 'relative',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '5px',
                                  border: `2px solid ${isChecked ? activeColor : 'var(--color-border)'}`,
                                  background: isChecked ? activeColor : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setVal(action, e.target.checked ? scope : 'none');
                                    }}
                                    style={{
                                      position: 'absolute',
                                      opacity: 0,
                                      width: 0,
                                      height: 0,
                                      cursor: 'pointer'
                                    }}
                                  />
                                  {isChecked && (
                                    <Check size={11} color="white" strokeWidth={3} />
                                  )}
                                </label>
                              </div>
                            );
                          };

                          const isSettings = mod.key === 'settings';

                          return (
                            <tr key={mod.key} style={{ overflow: 'visible', background: isSettings ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                              <td style={{ 
                                padding: '12px 14px', 
                                fontWeight: 700, 
                                color: isSettings ? 'var(--color-danger)' : 'var(--color-text)', 
                                borderBottom: '1px solid var(--color-border-light)', 
                                borderRight: '1px solid var(--color-border-light)', 
                                overflow: 'visible' 
                              }}>
                                {mod.label}
                              </td>
                              
                              {/* Xem (Read) - 3 columns */}
                              <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)', overflow: 'visible' }}>
                                {renderCheckbox('read', 'own')}
                              </td>
                              <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)', overflow: 'visible' }}>
                                {renderCheckbox('read', 'team')}
                              </td>
                              <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)', borderRight: '1px solid var(--color-border-light)', overflow: 'visible' }}>
                                {renderCheckbox('read', 'all')}
                              </td>
                              
                              {/* Sửa (Write) - 3 columns */}
                              <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)', overflow: 'visible' }}>
                                {renderCheckbox('write', 'own')}
                              </td>
                              <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)', overflow: 'visible' }}>
                                {renderCheckbox('write', 'team')}
                              </td>
                              <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)', borderRight: '1px solid var(--color-border-light)', overflow: 'visible' }}>
                                {renderCheckbox('write', 'all')}
                              </td>
                              
                              {/* Xóa (Delete) - 3 columns */}
                              <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)', overflow: 'visible' }}>
                                {renderCheckbox('delete', 'own')}
                              </td>
                              <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)', overflow: 'visible' }}>
                                {renderCheckbox('delete', 'team')}
                              </td>
                              <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)', overflow: 'visible' }}>
                                {renderCheckbox('delete', 'all')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 0 }} />

                {/* 2. TEAM LEADERSHIP */}
                <div>
                  <h4 style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    2. Nhóm quản lý (Manager Team Control)
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                    Chọn các nhóm/phòng ban mà nhân viên này trực tiếp quản lý, chỉ đạo (áp dụng cho vai trò Trưởng nhóm/Manager).
                  </p>

                  {/* Team Search Box */}
                  <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '320px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Tìm kiếm nhóm..."
                      value={teamSearchQuery}
                      onChange={e => setTeamSearchQuery(e.target.value)}
                      style={{
                        paddingLeft: '12px',
                        paddingRight: '2.25rem',
                        height: '36px',
                        fontSize: '0.8125rem',
                        borderRadius: '10px',
                        borderColor: 'var(--color-border)'
                      }}
                    />
                    {teamSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => setTeamSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--color-text-muted)',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <Search 
                        size={14} 
                        style={{ 
                          position: 'absolute', 
                          right: '12px', 
                          top: '50%', 
                          transform: 'translateY(-50%)', 
                          color: 'var(--color-text-muted)',
                          pointerEvents: 'none'
                        }} 
                      />
                    )}
                  </div>
                  
                  {allTeams.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', background: 'var(--color-bg-light)', borderRadius: '12px', color: 'var(--color-text-light)' }}>
                      Chưa có nhóm nào trên hệ thống
                    </div>
                  ) : (
                    (() => {
                      const filteredTeams = allTeams.filter((team: any) => {
                        const q = teamSearchQuery.trim().toLowerCase();
                        if (!q) return true;
                        return (team.name || '').toLowerCase().includes(q) || (team.leader_name || '').toLowerCase().includes(q);
                      });

                      if (filteredTeams.length === 0) {
                        return (
                          <div style={{ padding: '1rem', textAlign: 'center', background: 'var(--color-bg-light)', borderRadius: '12px', color: 'var(--color-text-light)', fontSize: '0.8125rem' }}>
                            Không tìm thấy nhóm phù hợp
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                          {filteredTeams.map((team: any) => {
                            const isChecked = managerTeams.includes(team.id);
                            return (
                              <label
                                key={team.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '10px 12px',
                                  background: isChecked ? 'var(--color-primary-light)' : 'var(--color-bg-light)',
                                  border: `1px solid ${isChecked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  color: isChecked ? 'var(--color-primary)' : 'var(--color-text)'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setManagerTeams([...managerTeams, team.id]);
                                    } else {
                                      setManagerTeams(managerTeams.filter(id => id !== team.id));
                                    }
                                  }}
                                  style={{
                                    accentColor: 'var(--color-primary)',
                                    width: '15px',
                                    height: '15px',
                                    cursor: 'pointer'
                                  }}
                                />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p style={{ margin: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</p>
                                  {team.leader_name && (
                                    <span style={{ fontSize: '0.6875rem', color: isChecked ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                                      Trưởng nhóm: {team.leader_name}
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--color-border-light)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: 'var(--color-bg-light)'
              }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => setIsPermissionModalOpen(false)}
                  style={{ minWidth: '100px', height: '36px' }}
                >
                  {t('Hủy')}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setIsPermissionModalOpen(false);
                    toast.success(t('Đã lưu cấu hình phân quyền chi tiết. Vui lòng bấm "Lưu thay đổi" ở góc dưới để cập nhật lên máy chủ.'));
                  }}
                  style={{ minWidth: '120px', height: '36px' }}
                >
                  {t('Xác nhận')}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '1.5rem'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--color-surface)',
                borderRadius: '20px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-xl)',
                width: '450px',
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(239, 68, 68, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444'
                  }}>
                    <AlertCircle size={16} />
                  </div>
                  <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
                    {t('Xác nhận xóa tài khoản')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', margin: 0, lineHeight: 1.5 }}>
                  {t('Hành động này không thể hoàn tác. Bạn đang thực hiện xóa vĩnh viễn tài khoản')} <strong>{username}</strong> ({name}).
                </p>

                {deleteCheckResult?.in_use && (
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Info size={14} /> {t('Tài khoản đang được sử dụng')}
                    </span>
                    <p style={{ fontSize: '0.75rem', color: '#b45309', margin: 0, lineHeight: 1.4 }}>
                      {deleteCheckResult.usage.fallback && t('• Tài khoản này đang cấu hình làm Admin Fallback nhận data chia lỗi.')}
                      {deleteCheckResult.usage.ticket && t(' • Tài khoản này đang cấu hình nhận thông báo SLA Ticket.')}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {t('Chọn Admin/Superadmin thay thế')} <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      {deleteCheckResult.other_admins && deleteCheckResult.other_admins.length > 0 ? (
                        <CustomSelect
                          options={deleteCheckResult.other_admins.map((adm: any) => ({
                            value: String(adm.id),
                            label: `${adm.name} (${adm.username})`
                          }))}
                          value={replacementAdminId}
                          onChange={val => setReplacementAdminId(val.toString())}
                          width="100%"
                        />
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                          {t('Không có quản trị viên thay thế khác. Không thể thực hiện xóa.')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                    {t('Nhập "DELETE" để xác nhận xóa')}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="DELETE"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    style={{
                      height: '40px',
                      textAlign: 'center',
                      fontWeight: 700,
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      border: deleteConfirmText === 'DELETE' ? '1px solid var(--color-success)' : '1px solid var(--color-border)'
                    }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--color-border-light)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                background: 'var(--color-bg-light)'
              }}>
                <button
                  type="button"
                  className="btn outline sm"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  disabled={isDeleting}
                  style={{ height: '36px' }}
                >
                  {t('Hủy')}
                </button>
                <button
                  type="button"
                  className="btn danger sm"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmText !== 'DELETE' || (deleteCheckResult?.in_use && !replacementAdminId)}
                  style={{
                    height: '36px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    fontWeight: 700,
                    opacity: (deleteConfirmText === 'DELETE' && (!deleteCheckResult?.in_use || replacementAdminId)) ? 1 : 0.5,
                    cursor: (deleteConfirmText === 'DELETE' && (!deleteCheckResult?.in_use || replacementAdminId)) ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isDeleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                  {t('Xác nhận xóa')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};
