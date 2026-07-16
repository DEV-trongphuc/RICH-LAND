import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Key, Eye, EyeOff, Save, ShieldAlert, Mail, Activity, Clock, 
  Settings, LogOut, Camera, Loader2, Calendar, Phone, Bell, Info, 
  Layers, Receipt, Shield, ChevronDown, ChevronUp, AlertTriangle, 
  Clock3, Scale, Trash2, RefreshCw 
} from 'lucide-react';
import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Avatar } from '../components/ui/Avatar';
import { StatRowSkeleton } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';

const DEFAULT_SCHEDULE = {
  "1": { active: true, start: "08:00", end: "17:30" },
  "2": { active: true, start: "08:00", end: "17:30" },
  "3": { active: true, start: "08:00", end: "17:30" },
  "4": { active: true, start: "08:00", end: "17:30" },
  "5": { active: true, start: "08:00", end: "17:30" },
  "6": { active: true, start: "08:00", end: "17:30" },
  "7": { active: false, start: "08:00", end: "17:30" }
};

const DAY_LABELS = {
  "1": "Thứ 2",
  "2": "Thứ 3",
  "3": "Thứ 4",
  "4": "Thứ 5",
  "5": "Thứ 6",
  "6": "Thứ 7",
  "7": "Chủ Nhật"
};

export const ProfilePage: React.FC = () => {
  const { t } = useLanguage();
  const { user, login, logout, updateUser } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Collapsible sections state (all open by default for visibility)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    erp: true,
    contact: true,
    bank: true,
    emergency: true
  });

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Basic Profile State
  const [profileData, setProfileData] = useState({ name: '', email: '', avatar: '' });

  // Basic & Personal
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [citizenId, setCitizenId] = useState('');
  const [hometown, setHometown] = useState('');
  const [nationality, setNationality] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [extNumber, setExtNumber] = useState('');
  const [address, setAddress] = useState('');

  // ERP & Job
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

  // Zalo & Lead Config
  const [zaloChatId, setZaloChatId] = useState('');
  const [vacationMode, setVacationMode] = useState(false);
  const [overtimeMode, setOvertimeMode] = useState(false);

  // Work Schedule State
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('17:30');
  const [scheduleMode, setScheduleMode] = useState<'daily' | 'custom'>('daily');
  const [workSchedule, setWorkSchedule] = useState<any>(DEFAULT_SCHEDULE);
  
  // Leave Schedules State
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');

  // Bank Account State
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankBranch, setBankBranch] = useState('');

  // Emergency contact State
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  
  // Password State
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passData, setPassData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPass, setChangingPass] = useState(false);

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || user.username || '',
        avatar: user.avatar || ''
      });
    }
  }, [user]);

  // Fetch full employee/consultant profile details
  const fetchConsultantProfile = async () => {
    try {
      const res = await fetchAPI('consultant-profile');
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
            setEmergencyName(erp.emergency_contact_name || '');
            setEmergencyRelation(erp.emergency_contact_relationship || '');
            setEmergencyPhone(erp.emergency_contact_phone || '');
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
      console.error('Error fetching consultant profile:', err);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetchAPI('get_my_activity_logs');
      if (res.success) {
        setActivityLogs(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchConsultantProfile();
    fetchLogs();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('Vui lòng chọn file hình ảnh hợp lệ.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('Kích thước ảnh không được vượt quá 5MB.'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const compressedFile = await compressToWebP(file);
      const fd = new FormData();
      fd.append('avatar', compressedFile);

      const oldAvatar = profileData.avatar || '';
      const query = `upload_avatar&old_avatar=${encodeURIComponent(oldAvatar)}`;
      const res = await fetchAPI(query, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        setProfileData(prev => ({ ...prev, avatar: res.url }));
        updateUser({ avatar: res.url, avatar_url: res.url } as any);
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

  const handleUpdateProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profileData.name) {
      toast.error(t('Tên không được để trống'));
      return;
    }
    setLoading(true);
    try {
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
          emergency_contact_name: emergencyName,
          emergency_contact_relationship: emergencyRelation,
          emergency_contact_phone: emergencyPhone,
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

      // 1. Update basic profile
      const resProfile = await fetchAPI('update_profile', {
        method: 'POST',
        body: JSON.stringify({ name: profileData.name, avatar: profileData.avatar })
      });
      
      // 2. Update employee working profile details
      const resConsultant = await fetchAPI('update_consultant_self_profile', {
        method: 'POST',
        body: JSON.stringify({
          name: profileData.name,
          avatar: profileData.avatar,
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

      if (resProfile.success && resConsultant.success) {
        toast.success(t('Cập nhật thông tin thành công!'));
        const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
        if (user) {
          login(token, { ...user, name: profileData.name, avatar: profileData.avatar, avatar_url: profileData.avatar } as any);
        }
        fetchConsultantProfile();
        fetchLogs();
      } else {
        toast.error(resProfile.message || resConsultant.message || t('Lỗi cập nhật'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi hệ thống'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passData.oldPassword || !passData.newPassword || !passData.confirmPassword) {
      toast.error(t('Vui lòng nhập đầy đủ thông tin'));
      return;
    }
    if (passData.newPassword !== passData.confirmPassword) {
      toast.error(t('Mật khẩu mới không khớp'));
      return;
    }
    if (passData.newPassword.length < 6) {
      toast.error(t('Mật khẩu mới phải có ít nhất 6 ký tự'));
      return;
    }
    setChangingPass(true);
    try {
      const res = await fetchAPI('change_password', {
        method: 'POST',
        body: JSON.stringify({ old_password: passData.oldPassword, new_password: passData.newPassword })
      });
      if (res.success) {
        toast.success(t('Đổi mật khẩu thành công!'));
        setPassData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(res.message || t('Lỗi khi đổi mật khẩu'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi hệ thống'));
    } finally {
      setChangingPass(false);
    }
  };

  const handleDayActiveToggle = (dayKey: string, active: boolean) => {
    setWorkSchedule((prev: any) => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || { active: true, start: workStartTime, end: workEndTime }),
        active
      }
    }));
  };

  const handleDayTimeChange = (dayKey: string, field: 'start' | 'end', value: string) => {
    setWorkSchedule((prev: any) => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || { active: true, start: workStartTime, end: workEndTime }),
        [field]: value
      }
    }));
  };

  const formatLogDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}-${pad(d.getMonth() + 1)}`;
  };

  const onLeave = (() => {
    if (!leaveStart || !leaveEnd) return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= leaveStart && today <= leaveEnd;
  })();

  return (
    <div className="page-container anim-fade-up" style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
      
      {/* Premium Sticky Header Block */}
      <div style={{
        position: 'sticky',
        top: isMobile ? '-1rem' : '-1.5rem',
        zIndex: 100,
        background: 'var(--color-bg)',
        padding: isMobile ? '0.75rem 0' : '1.25rem 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border)',
        margin: isMobile ? '-1rem 0 1.25rem 0' : '-1.5rem 0 1.5rem 0',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.5rem', 
            fontWeight: 800, 
            color: 'var(--color-text)', 
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {t('HỒ SƠ CÁ NHÂN')}
          </h2>
          {!isMobile && (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', margin: 0 }}>
              {t('Quản lý thông tin chi tiết tài khoản, giờ làm việc và lịch trình của bạn.')}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <button
            className="btn primary"
            style={{ 
              height: isMobile ? '34px' : '38px', 
              padding: isMobile ? '0 0.85rem' : '0 1.5rem', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: isMobile ? '0.78rem' : '0.875rem',
              fontWeight: 600
            }}
            onClick={() => handleUpdateProfile()}
            disabled={loading || isUploadingAvatar}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            {t('Lưu thay đổi')}
          </button>
          
          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="btn outline danger"
            style={{ 
              height: isMobile ? '34px' : '38px', 
              padding: isMobile ? '0 0.85rem' : '0 1.25rem', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              fontSize: isMobile ? '0.78rem' : '0.875rem',
              fontWeight: 600
            }}
          >
            <LogOut size={14} />
            {!isMobile && t('Đăng xuất')}
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        
        {/* LEFT COLUMN: Large Profile forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Circular avatar and header banner card */}
          <div className="card animate-fade-in" style={{
            padding: '1.5rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ position: 'relative' }}>
              <Avatar src={profileData.avatar} name={profileData.name || 'User'} size={isMobile ? 80 : 100} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'absolute', bottom: -2, right: -2,
                  background: 'var(--color-primary)', color: 'white', border: 'none',
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  boxShadow: 'var(--shadow-md)', transition: 'transform 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Camera size={15} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" style={{ display: 'none' }} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h3 style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--color-text)' }}>
                {profileData.name || t('Chưa thiết lập tên')}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge primary" style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                  {user?.role || 'user'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {profileData.email}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Personal Details */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={16} /> {t('Thông tin cá nhân')}
              </h3>
              {openSections.basic ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
            </button>
            
            {openSections.basic && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Họ và tên')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileData.name}
                    onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                    placeholder={t("Nhập tên đầy đủ...")}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày sinh')}</label>
                    <input type="date" className="form-input" value={dob} onChange={e => setDob(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Giới tính')}</label>
                    <select className="form-input" value={gender} onChange={e => setGender(e.target.value)}>
                      <option value="">{t('-- Chọn giới tính --')}</option>
                      <option value="male">{t('Nam')}</option>
                      <option value="female">{t('Nữ')}</option>
                      <option value="other">{t('Khác')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Số CCCD / Hộ chiếu')}</label>
                  <input type="text" className="form-input" value={citizenId} onChange={e => setCitizenId(e.target.value)} placeholder="Nhập số căn cước công dân..." />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Quê quán')}</label>
                    <input type="text" className="form-input" value={hometown} onChange={e => setHometown(e.target.value)} placeholder="Tỉnh/Thành phố..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Quốc tịch')}</label>
                    <input type="text" className="form-input" value={nationality} onChange={e => setNationality(e.target.value)} placeholder="VD: Việt Nam..." />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Tình trạng hôn nhân')}</label>
                  <select className="form-input" value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)}>
                    <option value="">{t('-- Chọn tình trạng --')}</option>
                    <option value="single">{t('Độc thân')}</option>
                    <option value="married">{t('Đã kết hôn')}</option>
                    <option value="divorced">{t('Đã ly hôn')}</option>
                    <option value="other">{t('Khác')}</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: ERP & Job Info */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <button
              type="button"
              onClick={() => toggleSection('erp')}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} /> {t('Thông tin nhân sự & ERP')}
              </h3>
              {openSections.erp ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
            </button>
            
            {openSections.erp && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Mã nhân viên')}</label>
                    <input type="text" className="form-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="VD: RL-2026-089" style={{ fontWeight: 600, color: 'var(--color-primary)' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Bộ phận / Phòng ban')}</label>
                    <input type="text" className="form-input" value={department} onChange={e => setDepartment(e.target.value)} placeholder="VD: Phòng Kinh doanh 1..." />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Chức danh / Vị trí')}</label>
                    <input type="text" className="form-input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="VD: Chuyên viên tư vấn..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Loại hợp đồng')}</label>
                    <select className="form-input" value={contractType} onChange={e => setContractType(e.target.value)}>
                      <option value="official">{t('Chính thức')}</option>
                      <option value="probation">{t('Thử việc')}</option>
                      <option value="internship">{t('Thực tập / Học việc')}</option>
                      <option value="collaborator">{t('Cộng tác viên')}</option>
                      <option value="other">{t('Khác')}</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày vào làm')}</label>
                    <input type="date" className="form-input" value={dateJoined} onChange={e => setDateJoined(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Quản lý trực tiếp')}</label>
                    <input type="text" className="form-input" value={directManager} onChange={e => setDirectManager(e.target.value)} placeholder="Họ tên người quản lý..." />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Địa điểm làm việc')}</label>
                  <input type="text" className="form-input" value={workplace} onChange={e => setWorkplace(e.target.value)} placeholder="VD: Trụ sở chính TP.HCM..." />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Chứng chỉ môi giới')}</label>
                    <input type="text" className="form-input" value={brokerLicense} onChange={e => setBrokerLicense(e.target.value)} placeholder="Mã số chứng chỉ (nếu có)" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Trình độ học vấn')}</label>
                    <select className="form-input" value={degree} onChange={e => setDegree(e.target.value)}>
                      <option value="undergraduate">{t('Trung cấp / Cao đẳng')}</option>
                      <option value="graduate">{t('Đại học')}</option>
                      <option value="postgraduate">{t('Thạc sĩ / Tiến sĩ')}</option>
                      <option value="other">{t('Khác')}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Contact & Zalo ID */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <button
              type="button"
              onClick={() => toggleSection('contact')}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={16} /> {t('Liên hệ & Tài khoản')}
              </h3>
              {openSections.contact ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
            </button>
            
            {openSections.contact && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Email đăng nhập')}</label>
                  <input
                    type="email"
                    className="form-input"
                    value={profileData.email}
                    disabled
                    style={{
                      opacity: 0.7,
                      cursor: 'not-allowed',
                      background: 'var(--color-bg-alt)',
                      borderColor: 'var(--color-border-light)'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Số điện thoại cá nhân')}</label>
                    <input type="text" className="form-input" value={personalPhone} onChange={e => setPersonalPhone(e.target.value)} placeholder="Nhập SĐT cá nhân..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Số điện thoại nội bộ')}</label>
                    <input type="text" className="form-input" value={extNumber} onChange={e => setExtNumber(e.target.value)} placeholder="VD: 104..." />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Email cá nhân')}</label>
                    <input type="email" className="form-input" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} placeholder="VD: email@gmail.com..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Zalo Chat ID')}</label>
                    <input type="text" className="form-input" value={zaloChatId} onChange={e => setZaloChatId(e.target.value)} placeholder="Nhập Zalo Chat ID để nhận OTP/Thông báo..." />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Địa chỉ thường trú')}</label>
                  <textarea className="form-input" rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="Nhập địa chỉ nhà của bạn..." style={{ minHeight: '60px', padding: '10px 14px' }} />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Bank details & Tax */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <button
              type="button"
              onClick={() => toggleSection('bank')}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={16} /> {t('Thanh toán & Thuế')}
              </h3>
              {openSections.bank ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
            </button>
            
            {openSections.bank && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Tên ngân hàng')}</label>
                    <input type="text" className="form-input" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="VD: Vietcombank..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Số tài khoản')}</label>
                    <input type="text" className="form-input" value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Nhập số tài khoản..." style={{ fontWeight: 700 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Chi nhánh ngân hàng')}</label>
                    <input type="text" className="form-input" value={bankBranch} onChange={e => setBankBranch(e.target.value)} placeholder="Chi nhánh..." />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Mã số thuế cá nhân')}</label>
                    <input type="text" className="form-input" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="Mã số thuế..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Số sổ BHXH')}</label>
                    <input type="text" className="form-input" value={insuranceId} onChange={e => setInsuranceId(e.target.value)} placeholder="Mã số sổ BHXH..." />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Emergency contact */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <button
              type="button"
              onClick={() => toggleSection('emergency')}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} /> {t('Liên hệ khẩn cấp')}
              </h3>
              {openSections.emergency ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
            </button>
            
            {openSections.emergency && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Người liên hệ')}</label>
                    <input type="text" className="form-input" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Họ và tên..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('Mối quan hệ')}</label>
                    <input type="text" className="form-input" value={emergencyRelation} onChange={e => setEmergencyRelation(e.target.value)} placeholder="VD: Bố, mẹ, vợ, chồng..." />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Số điện thoại khẩn cấp')}</label>
                  <input type="text" className="form-input" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="Số điện thoại..." />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Settings & Schedules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Card 1: Vacation status */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(189, 29, 45, 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Clock3 size={20} color="#BD1D2D" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  {user?.role === 'sale' ? t('TRẠNG THÁI NHẬN DATA') : t('TRẠNG THÁI HOẠT ĐỘNG & NGHỈ PHÉP')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, lineHeight: '1.45' }}>
                  {user?.role === 'sale'
                    ? t('Khi kích hoạt: Nhận khách hàng mới theo vòng chia. Khi tắt (Nghỉ/Tạm ngưng): Dừng nhận khách hàng mới, nhưng khách hàng cũ đăng ký lại VẪN sẽ tự động chuyển và gửi tin nhắn Nhắc trùng cho bạn chăm sóc.')
                    : t('Tài khoản của bạn thuộc vai trò nhân sự trong công ty. Chế độ tạm ngưng/nghỉ phép giúp báo cáo trạng thái hoạt động hiện tại của bạn cho phòng Nhân sự.')}
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--color-bg-alt)', padding: '10px 14px', borderRadius: '12px',
              border: '1px solid var(--color-border-light)'
            }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-light)' }}>
                {t('Trạng thái hiện tại:')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontSize: '0.8rem', fontWeight: 700,
                  color: !vacationMode && !onLeave ? 'var(--color-success)' : 'var(--color-warning)',
                  background: !vacationMode && !onLeave ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  padding: '3px 8px', borderRadius: '6px'
                }}>
                  {!vacationMode && !onLeave ? t('Sẵn sàng') : onLeave ? t('Nghỉ phép') : t('Tạm ngưng')}
                </span>
                <div style={{ pointerEvents: onLeave ? 'none' : 'auto', opacity: onLeave ? 0.5 : 1 }}>
                  <ToggleSwitch checked={!vacationMode} onChange={(val) => setVacationMode(!val)} />
                </div>
              </div>
            </div>
            
            {onLeave && (
              <div style={{
                background: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: '10px 14px',
                borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{user?.role === 'sale' ? t('Bạn hiện đang trong thời gian nghỉ phép. Hệ thống tự động khóa chế độ nhận data cho đến khi kết thúc kỳ nghỉ.') : t('Bạn hiện đang trong thời gian nghỉ phép đã được đăng ký trên hệ thống.')}</span>
              </div>
            )}
          </div>

          {/* Card 2: Overtime/Night shift status */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <ShieldAlert size={20} color="var(--color-warning)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  {user?.role === 'sale' ? t('ĐĂNG KÝ TRỰC CA ĐÊM (18h-6h)') : t('ĐĂNG KÝ LÀM TĂNG CA / CA ĐÊM')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, lineHeight: '1.45' }}>
                  {user?.role === 'sale'
                    ? t('Nhận lead tự động trong ca đêm. Danh sách đăng ký tự reset vào lúc 6:00 sáng hôm sau.')
                    : t('Đăng ký làm việc ngoài giờ / tăng ca đêm (18h - 6h sáng hôm sau). Bản ghi này phục vụ mục đích chấm công và tính lương tăng ca.')}
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--color-bg-alt)', padding: '10px 14px', borderRadius: '12px',
              border: '1px solid var(--color-border-light)'
            }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-light)' }}>
                {user?.role === 'sale' ? t('Đăng ký trực hôm nay:') : t('Đăng ký tăng ca hôm nay:')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontSize: '0.8rem', fontWeight: 700,
                  color: overtimeMode ? 'var(--color-success)' : 'var(--color-text-muted)',
                  background: overtimeMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.08)',
                  padding: '3px 8px', borderRadius: '6px'
                }}>
                  {overtimeMode 
                    ? (user?.role === 'sale' ? t('Đã đăng ký trực') : t('Đã đăng ký tăng ca')) 
                    : t('Chưa đăng ký')}
                </span>
                <ToggleSwitch checked={overtimeMode} onChange={setOvertimeMode} />
              </div>
            </div>
          </div>

          {/* Card 3: Leave registration */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Calendar size={20} color="var(--color-primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  {t('ĐĂNG KÝ NGHỈ PHÉP (LEAVE)')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, lineHeight: '1.45' }}>
                  {user?.role === 'sale'
                    ? t('Đăng ký nghỉ phép tạm thời để tạm dừng nhận data phân bổ tự động.')
                    : t('Đăng ký thời gian nghỉ phép của bạn để cập nhật lịch làm việc với phòng nhân sự.')}
                </p>
              </div>
            </div>

            {onLeave && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: '0.8rem',
                background: 'var(--color-warning-light)', color: 'var(--color-warning)'
              }}>
                {t('ĐANG TRONG KỲ NGHỈ PHÉP')}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--color-text-light)', marginBottom: '4px' }}>{t('Từ ngày')}</label>
                <input
                  type="date"
                  className="form-input"
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  style={{ borderRadius: '10px', height: '38px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--color-text-light)', marginBottom: '4px' }}>{t('Đến ngày')}</label>
                <input
                  type="date"
                  className="form-input"
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  style={{ borderRadius: '10px', height: '38px', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Work schedule config */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="var(--color-primary)" />
                {t('GIỜ LÀM VIỆC & LỊCH TRÌNH')}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
                {user?.role === 'sale'
                  ? t('Thiết lập thời gian nhận lead cố định hàng ngày hoặc lịch trình tùy chỉnh theo từng thứ.')
                  : t('Thiết lập khung giờ làm việc tiêu chuẩn hàng ngày hoặc lịch trình tùy chỉnh theo từng thứ để chấm công.')}
              </p>
            </div>

            {/* Segmented Control for Schedule Mode */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-bg)', padding: '4px', borderRadius: '12px' }}>
              <button
                type="button"
                onClick={() => setScheduleMode('daily')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem',
                  background: scheduleMode === 'daily' ? 'var(--color-surface)' : 'transparent',
                  color: scheduleMode === 'daily' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: scheduleMode === 'daily' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                }}
              >{t('Cố định hàng ngày')}</button>
              <button
                type="button"
                onClick={() => {
                  setScheduleMode('custom');
                  if (!workSchedule) setWorkSchedule(DEFAULT_SCHEDULE);
                }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem',
                  background: scheduleMode === 'custom' ? 'var(--color-surface)' : 'transparent',
                  color: scheduleMode === 'custom' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: scheduleMode === 'custom' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                }}
              >{t('Tùy chỉnh thứ ngày')}</button>
            </div>

            {scheduleMode === 'daily' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-bg-alt)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>{t('Bắt đầu')}</label>
                  <input type="time" className="form-input" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} style={{ borderRadius: '8px', height: '36px' }} />
                </div>
                <div style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)', paddingTop: '16px' }}>→</div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>{t('Kết thúc')}</label>
                  <input type="time" className="form-input" value={workEndTime} onChange={e => setWorkEndTime(e.target.value)} style={{ borderRadius: '8px', height: '36px' }} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(DAY_LABELS).map(([dayKey, dayLabel]) => {
                  const config = workSchedule?.[dayKey] || { active: true, start: workStartTime, end: workEndTime };
                  return (
                    <div key={dayKey} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', border: '1px solid var(--color-border-light)',
                      borderRadius: '10px', background: config.active ? 'var(--color-surface)' : 'var(--color-bg-alt)',
                      opacity: config.active ? 1 : 0.6
                    }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', width: '60px' }}>{dayLabel}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="time"
                          className="form-input"
                          disabled={!config.active}
                          style={{ width: '85px', height: '28px', padding: '0 6px', fontSize: '0.75rem', borderRadius: '6px' }}
                          value={config.start}
                          onChange={e => handleDayTimeChange(dayKey, 'start', e.target.value)}
                        />
                        <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                        <input
                          type="time"
                          className="form-input"
                          disabled={!config.active}
                          style={{ width: '85px', height: '28px', padding: '0 6px', fontSize: '0.75rem', borderRadius: '6px' }}
                          value={config.end}
                          onChange={e => handleDayTimeChange(dayKey, 'end', e.target.value)}
                        />
                      </div>
                      <ToggleSwitch checked={config.active} onChange={val => handleDayActiveToggle(dayKey, val)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 5: Change password */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
              <Key size={16} color="var(--color-primary)" />
              {t('Đổi mật khẩu bảo mật')}
            </h3>
            
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('Mật khẩu hiện tại')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    className="form-input"
                    value={passData.oldPassword}
                    onChange={e => setPassData({ ...passData, oldPassword: e.target.value })}
                    placeholder={t("Nhập mật khẩu cũ...")}
                    style={{ paddingRight: '40px', height: '36px', fontSize: '0.85rem' }}
                  />
                  <button type="button" onClick={() => setShowOldPass(!showOldPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    {showOldPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('Mật khẩu mới')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    className="form-input"
                    value={passData.newPassword}
                    onChange={e => setPassData({ ...passData, newPassword: e.target.value })}
                    placeholder={t("Nhập mật khẩu mới...")}
                    style={{ paddingRight: '40px', height: '36px', fontSize: '0.85rem' }}
                  />
                  <button type="button" onClick={() => setShowNewPass(!showNewPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('Xác nhận mật khẩu mới')}</label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  className="form-input"
                  value={passData.confirmPassword}
                  onChange={e => setPassData({ ...passData, confirmPassword: e.target.value })}
                  placeholder={t("Nhập lại mật khẩu mới...")}
                  style={{ height: '36px', fontSize: '0.85rem' }}
                />
              </div>

              <button type="submit" className="btn primary" disabled={changingPass} style={{ alignSelf: 'flex-end', height: '36px', padding: '0 16px', background: '#10b981', fontWeight: 600, fontSize: '0.8rem', borderRadius: '8px' }}>
                {changingPass ? t('Đang đổi...') : <><Save size={14} style={{ marginRight: '6px' }} /> {t('Đổi mật khẩu')}</>}
              </button>
            </form>
          </div>

          {/* Card 6: Recent Activity Logs */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
              <Activity size={16} color="var(--color-primary)" />
              {t('Hoạt động gần đây')}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
              {loadingLogs ? (
                <>
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                </>
              ) : activityLogs.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-light)', fontSize: '0.825rem', padding: '1rem', margin: 0, fontStyle: 'italic' }}>
                  {t('Chưa có hoạt động nào.')}
                </p>
              ) : (
                activityLogs.slice(0, 10).map((log, i) => (
                  <div key={log.id || i} style={{
                    padding: '8px 12px', background: 'var(--color-bg-alt)',
                    borderRadius: '8px', border: '1px solid var(--color-border-light)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.action}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.details || log.description}</span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-light)', flexShrink: 0 }}>{formatLogDate(log.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 7: System specifications */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
              <Settings size={16} color="var(--color-primary)" />
              {t('Thông tin hệ thống')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '10px 12px', background: 'var(--color-bg-alt)', borderRadius: '10px', borderLeft: '3px solid var(--color-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600 }}>USER ID</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>#{user?.id || 'N/A'}</span>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--color-bg-alt)', borderRadius: '10px', borderLeft: '3px solid var(--color-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600 }}>TÊN ĐĂNG NHẬP</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>{user?.username || user?.email || 'N/A'}</span>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--color-bg-alt)', borderRadius: '10px', borderLeft: '3px solid var(--color-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600 }}>QUYỀN HẠN</span>
                <span className="badge success" style={{ textTransform: 'capitalize', fontSize: '0.7rem', fontWeight: 700 }}>{user?.role || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
