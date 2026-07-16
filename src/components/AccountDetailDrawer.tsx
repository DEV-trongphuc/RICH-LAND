import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Camera, ChevronDown, ChevronUp, Save, Trash2, Download, 
  Paperclip, Loader2, Eye, EyeOff, User, Shield, Info, Send, 
  Link2Off, RefreshCw, KeyRound, Building2, Calendar, Clock, Plus, FileText,
  CreditCard, PhoneCall
} from 'lucide-react';
import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import toast from 'react-hot-toast';
import { CustomSelect } from './ui/CustomSelect';
import { Avatar } from './ui/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  account: any | null; // null for adding new
  onSaveSuccess: () => void;
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

export const AccountDetailDrawer: React.FC<Props> = ({ isOpen, onClose, account, onSaveSuccess }) => {
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

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    personal: true,
    erp: true,
    account: true,
    bank: false,
    emergency: false,
    schedule: false,
    documents: false
  });

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
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

  // 6. Documents / Attachments
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Zalo Bot Helpers
  const [quickMsgText, setQuickMsgText] = useState('');
  const [isSendingQuickMsg, setIsSendingQuickMsg] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // Reset/Load form on account change
  useEffect(() => {
    if (!isOpen) return;

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
          const res = await fetchAPI(`consultant-profile?consultant_id=${account.id}`);
          if (res.success && res.data) {
            const d = res.data;
            setZaloChatId(d.zalo_chat_id || '');
            setVacationMode(d.vacation_mode === 1);
            setOvertimeMode(d.overtime_mode === 1);
            setWorkStartTime(d.work_start_time || '08:00');
            setWorkEndTime(d.work_end_time || '17:30');
            setLeaveStart(d.leave_start || '');
            setLeaveEnd(d.leave_end || '');
            setDob(d.dob || '');
            setGender(d.gender || '');
            setCitizenId(d.citizen_id || '');
            setBankName(d.bank_name || '');
            setBankAccount(d.bank_account || '');

            let addressPayload = d.address || '';
            try {
              const addressObj = JSON.parse(addressPayload);
              if (addressObj && addressObj.erp_profile) {
                const erp = addressObj.erp_profile;
                setAddress(erp.address_text || '');
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
                setHometown(erp.hometown || '');
                setBankBranch(erp.bank_branch || '');
              } else {
                setAddress(addressPayload);
              }
            } catch (e) {
              setAddress(addressPayload);
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
      setWorkStartTime('08:00');
      setWorkEndTime('17:30');
      setScheduleMode('daily');
      setWorkSchedule(DEFAULT_SCHEDULE);

      setDocuments([]);
      setLoading(false);
    }
  }, [isOpen, account]);

  // Documents Management
  const fetchDocuments = async () => {
    if (!account?.id) return;
    setLoadingDocs(true);
    try {
      const res = await fetchAPI(`cloud_files?category=consultant_${account.id}&limit=100`);
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
      fd.append('visibility', 'shared');
      fd.append('name', file.name);

      const res = await fetchAPI('cloud_files', {
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
      const res = await fetchAPI(`cloud_files?id=${docId}`, {
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
          tax_id: taxId,
          insurance_id: insuranceId,
          broker_license: brokerLicense,
          degree: degree,
          nationality: nationality,
          marital_status: maritalStatus,
          personal_email: personalEmail,
          hometown: hometown,
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
        bank_account: bankAccount || null
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
          leave_start: leaveStart || null,
          leave_end: leaveEnd || null
        })
      });

      if (!resProfile.success) {
        throw new Error(resProfile.message || t('Lỗi lưu thông tin hồ sơ chi tiết.'));
      }

      toast.success(account ? t('Cập nhật nhân sự thành công!') : t('Thêm mới nhân sự thành công!'));
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('Lỗi hệ thống khi lưu'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="drawer-backdrop"
        onClick={onClose}
        style={{
          zIndex: 9998
        }}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 'var(--sidebar-width, 220px)',
          right: 0,
          zIndex: 9999,
          backgroundColor: 'var(--color-surface)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column'
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
              {account ? t('Hồ sơ Nhân sự') : t('Thêm Nhân sự')}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              {account ? `${t('Mã nhân viên')}: ${employeeId || '—'} · ${name}` : t('Khai báo hồ sơ làm việc và thông tin ERP mới.')}
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

        {/* Content Panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
              <Loader2 className="spin" size={32} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('Đang tải dữ liệu hồ sơ...')}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Avatar upload card */}
              <div style={{
                background: 'var(--color-bg-light)',
                borderRadius: '16px',
                border: '1px solid var(--color-border-light)',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem'
              }}>
                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                  <Avatar src={avatar} name={name || 'S'} size={80} />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: 'var(--color-primary)',
                    color: 'white',
                    borderRadius: '50%',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--color-surface)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <Camera size={14} />
                  </div>
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
                      <Loader2 size={18} className="spin" />
                    </div>
                  )}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>{t('Ảnh chân dung nhân sự')}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 8px' }}>
                    {t('Chấp nhận các định dạng ảnh JPG, PNG, WEBP. Tối đa 5MB.')}
                  </p>
                  <button 
                    type="button" 
                    className="btn outline sm"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ borderRadius: '8px', fontSize: '0.75rem', padding: '6px 12px' }}
                  >
                    {t('Chọn ảnh khác')}
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*" 
                    onChange={handleAvatarUpload} 
                  />
                </div>
              </div>

              {/* CARD 1: THÔNG TIN CÁ NHÂN */}
              <div style={{
                background: 'var(--color-surface)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div 
                  onClick={() => toggleSection('personal')}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: openSections.personal ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: openSections.personal ? 'var(--color-bg-light)' : 'transparent',
                    borderTopLeftRadius: '15px',
                    borderTopRightRadius: '15px',
                    borderBottomLeftRadius: openSections.personal ? '0' : '15px',
                    borderBottomRightRadius: openSections.personal ? '0' : '15px'
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                    <User size={14} style={{ color: 'var(--color-primary)' }} /> {t('THÔNG TIN CÁ NHÂN')}
                  </span>
                  {openSections.personal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {openSections.personal && (
                  <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">{t('Họ và tên')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('Nguyễn Văn A')} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Ngày sinh')}</label>
                      <input type="date" className="form-input" value={dob} onChange={e => setDob(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Giới tính')}</label>
                      <CustomSelect
                        options={[
                          { value: '', label: t('Chọn giới tính') },
                          { value: 'Nam', label: t('Nam') },
                          { value: 'Nữ', label: t('Nữ') },
                          { value: 'Khác', label: t('Khác') }
                        ]}
                        value={gender}
                        onChange={val => setGender(val.toString())}
                        width="100%"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Số CCCD / Hộ chiếu')}</label>
                      <input className="form-input" value={citizenId} onChange={e => setCitizenId(e.target.value)} placeholder="031xxxxxxxx" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Quê quán')}</label>
                      <input className="form-input" value={hometown} onChange={e => setHometown(e.target.value)} placeholder={t('Quảng Nam')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Quốc tịch')}</label>
                      <input className="form-input" value={nationality} onChange={e => setNationality(e.target.value)} placeholder={t('Việt Nam')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Tình trạng hôn nhân')}</label>
                      <CustomSelect
                        options={[
                          { value: 'single', label: t('Độc thân') },
                          { value: 'married', label: t('Đã kết hôn') },
                          { value: 'divorced', label: t('Đã ly hôn') }
                        ]}
                        value={maritalStatus}
                        onChange={val => setMaritalStatus(val.toString())}
                        width="100%"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Email cá nhân')}</label>
                      <input type="email" className="form-input" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} placeholder="a@gmail.com" />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">{t('Địa chỉ tạm trú/thường trú')}</label>
                      <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} placeholder={t('123 Đường ABC, Quận X, TP. Y')} />
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 2: THÔNG TIN NHÂN SỰ & ERP */}
              <div style={{
                background: 'var(--color-surface)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div 
                  onClick={() => toggleSection('erp')}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: openSections.erp ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: openSections.erp ? 'var(--color-bg-light)' : 'transparent',
                    borderTopLeftRadius: '15px',
                    borderTopRightRadius: '15px',
                    borderBottomLeftRadius: openSections.erp ? '0' : '15px',
                    borderBottomRightRadius: openSections.erp ? '0' : '15px'
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                    <Building2 size={14} style={{ color: 'var(--color-primary)' }} /> {t('THÔNG TIN NHÂN SỰ & ERP')}
                  </span>
                  {openSections.erp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {openSections.erp && (
                  <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
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
                      <label className="form-label">{t('Loại hợp đồng')}</label>
                      <CustomSelect
                        options={[
                          { value: 'official', label: t('Chính thức') },
                          { value: 'probation', label: t('Thử việc') },
                          { value: 'collaborator', label: t('Cộng tác viên') },
                          { value: 'internship', label: t('Thực tập sinh') }
                        ]}
                        value={contractType}
                        onChange={val => setContractType(val.toString())}
                        width="100%"
                      />
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
                      <label className="form-label">{t('Địa điểm làm việc')}</label>
                      <input className="form-input" value={workplace} onChange={e => setWorkplace(e.target.value)} placeholder={t('Văn phòng Q.2 / Q. Bình Thạnh')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Chứng chỉ môi giới')}</label>
                      <input className="form-input" value={brokerLicense} onChange={e => setBrokerLicense(e.target.value)} placeholder={t('Số chứng chỉ hành nghề')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Trình độ học vấn')}</label>
                      <CustomSelect
                        options={[
                          { value: 'undergraduate', label: t('Đại học') },
                          { value: 'postgraduate', label: t('Sau đại học') },
                          { value: 'college', label: t('Cao đẳng') },
                          { value: 'highschool', label: t('Trung học') }
                        ]}
                        value={degree}
                        onChange={val => setDegree(val.toString())}
                        width="100%"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 3: LIÊN HỆ & TÀI KHOẢN */}
              <div style={{
                background: 'var(--color-surface)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div 
                  onClick={() => toggleSection('account')}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: openSections.account ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: openSections.account ? 'var(--color-bg-light)' : 'transparent',
                    borderTopLeftRadius: '15px',
                    borderTopRightRadius: '15px',
                    borderBottomLeftRadius: openSections.account ? '0' : '15px',
                    borderBottomRightRadius: openSections.account ? '0' : '15px'
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                    <Shield size={14} style={{ color: 'var(--color-primary)' }} /> {t('LIÊN HỆ & TÀI KHOẢN')}
                  </span>
                  {openSections.account ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {openSections.account && (
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
                              onChange={val => setRole(val.toString())}
                              width="100%"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{t('Trạng thái hoạt động')}</label>
                            <CustomSelect 
                              options={[
                                { value: '1', label: t('Đang hoạt động') },
                                { value: '0', label: t('Đang bị khóa') }
                              ]}
                              value={isActive}
                              onChange={val => setIsActive(val.toString())}
                              width="100%"
                            />
                          </div>
                        </>
                      )}
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
                  </div>
                )}
              </div>

              {/* CARD 4: THANH TOÁN & THUẾ */}
              <div style={{
                background: 'var(--color-surface)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div 
                  onClick={() => toggleSection('bank')}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: openSections.bank ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: openSections.bank ? 'var(--color-bg-light)' : 'transparent',
                    borderTopLeftRadius: '15px',
                    borderTopRightRadius: '15px',
                    borderBottomLeftRadius: openSections.bank ? '0' : '15px',
                    borderBottomRightRadius: openSections.bank ? '0' : '15px'
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                    <CreditCard size={14} style={{ color: 'var(--color-primary)' }} /> {t('THANH TOÁN & THUẾ')}
                  </span>
                  {openSections.bank ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {openSections.bank && (
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
                )}
              </div>

              {/* CARD 5: LIÊN HỆ KHẨN CẤP */}
              <div style={{
                background: 'var(--color-surface)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div 
                  onClick={() => toggleSection('emergency')}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: openSections.emergency ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: openSections.emergency ? 'var(--color-bg-light)' : 'transparent',
                    borderTopLeftRadius: '15px',
                    borderTopRightRadius: '15px',
                    borderBottomLeftRadius: openSections.emergency ? '0' : '15px',
                    borderBottomRightRadius: openSections.emergency ? '0' : '15px'
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                    <PhoneCall size={14} style={{ color: 'var(--color-primary)' }} /> {t('LIÊN HỆ KHẨN CẤP')}
                  </span>
                  {openSections.emergency ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {openSections.emergency && (
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
                )}
              </div>

              {/* CARD 6: TRỰC TUYẾN & LỊCH LÀM VIỆC */}
              <div style={{
                background: 'var(--color-surface)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div 
                  onClick={() => toggleSection('schedule')}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: openSections.schedule ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: openSections.schedule ? 'var(--color-bg-light)' : 'transparent',
                    borderTopLeftRadius: '15px',
                    borderTopRightRadius: '15px',
                    borderBottomLeftRadius: openSections.schedule ? '0' : '15px',
                    borderBottomRightRadius: openSections.schedule ? '0' : '15px'
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                    <Calendar size={14} style={{ color: 'var(--color-primary)' }} /> {t('TRỰC TUYẾN & LỊCH LÀM VIỆC')}
                  </span>
                  {openSections.schedule ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {openSections.schedule && (
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
                      <input 
                        type="checkbox" 
                        checked={vacationMode} 
                        onChange={e => setVacationMode(e.target.checked)} 
                        style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                      />
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
                      <input 
                        type="checkbox" 
                        checked={overtimeMode} 
                        onChange={e => setOvertimeMode(e.target.checked)} 
                        style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                      />
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
                      <h4 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Giờ làm việc & Lịch trình')}</h4>
                      
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
                  </div>
                )}
              </div>

              {/* CARD 7: TÀI LIỆU & HỒ SƠ ĐÍNH KÈM */}
              {account && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div 
                    onClick={() => toggleSection('documents')}
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderBottom: openSections.documents ? '1px solid var(--color-border)' : 'none',
                      backgroundColor: openSections.documents ? 'var(--color-bg-light)' : 'transparent',
                      borderTopLeftRadius: '15px',
                      borderTopRightRadius: '15px',
                      borderBottomLeftRadius: openSections.documents ? '0' : '15px',
                      borderBottomRightRadius: openSections.documents ? '0' : '15px'
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                      <Paperclip size={14} style={{ color: 'var(--color-primary)' }} /> {t('HỒ SƠ & TÀI LIỆU ĐÍNH KÈM')}
                    </span>
                    {openSections.documents ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>

                  {openSections.documents && (
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
                          color: 'var(--color-text-muted)'
                        }}>
                          <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
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
                  )}
                </div>
              )}

              {/* Bottom Sticky Action Buttons */}
              <div style={{
                position: 'sticky',
                bottom: '-1.5rem',
                backgroundColor: 'var(--color-surface)',
                borderTop: '1px solid var(--color-border)',
                padding: '1rem 0 1.5rem',
                marginTop: '1rem',
                display: 'flex',
                gap: '1rem',
                zIndex: 10
              }}>
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="btn ghost" 
                  style={{ flex: 1, borderRadius: '10px' }}
                >
                  {t('Hủy')}
                </button>
                <button 
                  type="submit" 
                  className="btn primary" 
                  disabled={isSaving} 
                  style={{ flex: 1, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                  {isSaving ? t('Đang lưu...') : t('Lưu Hồ sơ Nhân sự')}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </>,
    document.body
  );
};
