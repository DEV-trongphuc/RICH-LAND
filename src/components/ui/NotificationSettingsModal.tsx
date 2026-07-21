import React, { useState, useEffect } from 'react';
import { CustomModal } from './CustomModal';
import { Power, CheckCircle, AlertTriangle, ShieldCheck, ExternalLink, RotateCcw, ArrowLeft, Check, Copy, Smartphone } from 'lucide-react';
import { fetchAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
}

interface EventConfig {
  master: boolean;
  zalo: boolean;
  telegram: boolean;
  email: boolean;
}

type EventSettingsState = Record<string, EventConfig>;

const EVENT_CATEGORIES = [
  {
    category: 'SALE_CONSULTANT',
    title: 'Dành Cho Nhân Viên & Sale (Nhận Tin Cá Nhân)',
    badge: 'Cá nhân & Sale',
    badgeColor: '#0284c7',
    badgeBg: '#f0f9ff',
    events: [
      {
        key: 'LEAD_ASSIGNMENT',
        name: 'Lead / Khách hàng Mới được chia',
        desc: 'Khi có khách hàng tiềm năng mới được hệ thống tự động phân bổ cho bạn',
        icon: '🎯'
      },
      {
        key: 'CUSTOMER_UPDATE',
        name: 'Cập nhật Khách hàng & Tương tác',
        desc: 'Khi thông tin khách hàng của bạn có ghi chú mới, cập nhật nhãn hoặc chuyển giai đoạn',
        icon: '👤'
      },
      {
        key: 'SECURITY_DEADLINE_WARNING',
        name: 'Cảnh báo Hạn bảo mật Lead / Data',
        desc: 'Nhắc nhở trước khi khách hàng tiềm năng bị giải phóng ra Kho Data chung do hết hạn chăm sóc',
        icon: '⏳'
      },
      {
        key: 'MENTION_TAGGED',
        name: 'Tag tên & Nhắc đến (@Mention)',
        desc: 'Khi đồng nghiệp nhắc tên bạn (@bạn) trong bình luận dự án, ghi chú, công việc hoặc ticket',
        icon: '🏷️'
      },
      {
        key: 'WORKFLOW_TASK_ASSIGNED',
        name: 'Gán Công việc & Nhiệm vụ CRM',
        desc: 'Khi bạn được giao nhiệm vụ/công việc mới thuộc quy trình làm việc hoặc dự án',
        icon: '📋'
      },
      {
        key: 'ATTENDANCE_REMINDER',
        name: 'Nhắc nhở Chấm công & Điểm danh hàng ngày',
        desc: 'Thông báo nhắc nhở trước giờ vào ca làm việc hành chính hàng ngày',
        icon: '⏰'
      },
      {
        key: 'ATTENDANCE_APPROVAL_RESULT',
        name: 'Kết quả Phê duyệt Chấm công',
        desc: 'Khi yêu cầu đi trễ hoặc bổ sung công của bạn được Admin/Quản lý duyệt hoặc từ chối',
        icon: '✅'
      },
      {
        key: 'MY_DEPOSIT_UPDATE',
        name: 'Cập nhật Duyệt Đặt cọc & Giao dịch',
        desc: 'Khi giao dịch cọc hoặc hợp đồng của bạn được duyệt thành công hoặc có phản hồi',
        icon: '💳'
      },
      {
        key: 'NIGHT_SHIFT_BOOKING',
        name: 'Lịch Trực ca & Trực đêm Cá nhân',
        desc: 'Thông báo xác nhận lịch trực đêm hoặc thay đổi ca trực của bạn',
        icon: '🌙'
      },
      {
        key: 'CHECKOUT_REMINDER',
        name: 'Nhắc nhở Chấm công Ra ca (Cuối ngày)',
        desc: 'Thông báo nhắc nhở chấm công ra về vào đúng giờ kết thúc ca làm việc',
        icon: '🌆'
      },
      {
        key: 'HOLIDAY_REGISTRATION_OPENED',
        name: 'Admin Mở Đăng ký Trực lễ',
        desc: 'Thông báo khi Ban quản trị mở đăng ký trực ca các ngày Lễ, Tết',
        icon: '🎉'
      },
      {
        key: 'HOLIDAY_UPDATE',
        name: 'Thông báo Lịch nghỉ Lễ & Công ty',
        desc: 'Thông báo chính thức về lịch nghỉ lễ hoặc điều chỉnh ngày làm việc của công ty',
        icon: '🌴'
      },
      {
        key: 'MONTHLY_ATTENDANCE_REPORT',
        name: 'Báo cáo Tổng kết Chấm công & Trực ca',
        desc: 'Báo cáo định kỳ thống kê số ngày chấm công, trễ, ca trực đêm và ca cuối tuần',
        icon: '📊'
      },
      {
        key: 'PROFILE_ACCOUNT_UPDATE',
        name: 'Cập nhật Hồ sơ & Mật khẩu Tài khoản',
        desc: 'Cảnh báo bảo mật khi thông tin cá nhân, hồ sơ hoặc mật khẩu tài khoản được cập nhật',
        icon: '🔒'
      }
    ]
  },
  {
    category: 'ADMIN_MANAGER',
    title: 'Dành Cho Quản Lý & Admin (Phê Duyệt & Giám Sát)',
    badge: 'Quản lý & Admin',
    badgeColor: '#BD1D2D',
    badgeBg: '#fef2f2',
    events: [
      {
        key: 'CHECKIN_LATE',
        name: 'Báo cáo Đi trễ & Bổ sung công',
        desc: 'Khi nhân viên cấp dưới gửi báo cáo đi trễ hoặc yêu cầu bổ sung công ngày cũ',
        icon: '⏰'
      },
      {
        key: 'EXPENSE_REQUEST',
        name: 'Đề xuất Chi phí & Thanh toán',
        desc: 'Khi có khoản chi phí/đề xuất thanh toán mới từ nhân viên cần duyệt',
        icon: '💸'
      },
      {
        key: 'DEPOSIT_NEW',
        name: 'Giao dịch Đặt cọc Mới từ Sales',
        desc: 'Khi có yêu cầu duyệt cọc giao dịch bất động sản mới từ đội ngũ bán hàng',
        icon: '🏠'
      },
      {
        key: 'TICKET_NEW',
        name: 'Ticket Hỗ trợ Kỹ thuật & CRM',
        desc: 'Khi có ticket yêu cầu hỗ trợ mới gửi tới ban quản trị/kỹ thuật',
        icon: '🎫'
      },
      {
        key: 'COOPERATION_PENDING_APPROVAL',
        name: 'Phiếu Hợp tác Chia sẻ Hoa hồng',
        desc: 'Khi phiếu hợp tác gom đủ chữ ký các bên và chuyển sang chờ duyệt',
        icon: '✍️'
      },
      {
        key: 'LEAVE_REQUEST',
        name: 'Đơn xin Nghỉ phép từ Nhân viên',
        desc: 'Khi có đơn xin nghỉ phép từ nhân viên thuộc nhóm/phòng ban phụ trách',
        icon: '🏖️'
      },
      {
        key: 'PROJECT_ROSTER_UPDATE',
        name: 'Dự án & Phân công Lịch Roster',
        desc: 'Khi có cập nhật danh sách phân công dự án hoặc thay đổi lịch trực Roster nhóm',
        icon: '🏢'
      }
    ]
  }
];

const ALL_EVENTS = EVENT_CATEGORIES.flatMap(cat => cat.events);

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ isOpen, onClose, onBack }) => {
  const currentUser = useAuthStore(state => state.user);
  const role = (currentUser?.role || '').toLowerCase();
  const isAdminOrManager = role === 'admin' || role === 'superadmin' || role === 'director' || role === 'manager' || role === 'leader' || role === 'head_of_department' || role === 'truongphong' || role === 'quanly' || role === 'giamdoc' || role.includes('admin') || role.includes('manager') || role.includes('leader') || role.includes('director') || role.includes('head');

  const visibleCategories = React.useMemo(() => {
    return EVENT_CATEGORIES.filter(cat => {
      if (cat.category === 'ADMIN_MANAGER') {
        return isAdminOrManager;
      }
      return true;
    }).map(cat => {
      if (cat.category === 'SALE_CONSULTANT') {
        return {
          ...cat,
          badge: isAdminOrManager ? 'Cá nhân & Quản lý' : 'Cá nhân & Sale',
          title: isAdminOrManager 
            ? 'Dành Cho Quản Trị & Ban Giám Đốc (Thông Tin Cá Nhân & Phụ Trách Direct)' 
            : 'Dành Cho Nhân Viên & Sale (Nhận Tin Cá Nhân)',
          events: cat.events.map(evt => {
            if (evt.key === 'LEAD_ASSIGNMENT' && isAdminOrManager) {
              return { ...evt, desc: 'Khi có khách hàng tiềm năng mới được tự động phân bổ cho bạn hoặc cấp quản lý' };
            }
            if (evt.key === 'MY_DEPOSIT_UPDATE' && isAdminOrManager) {
              return { ...evt, desc: 'Khi giao dịch cọc cá nhân hoặc giao dịch thuộc team có cập nhật trạng thái duyệt/bể cọc' };
            }
            if (evt.key === 'SECURITY_DEADLINE_WARNING' && isAdminOrManager) {
              return { ...evt, desc: 'Cảnh báo trước khi data thuộc danh sách quản lý bị thu hồi về Kho Data chung' };
            }
            if (evt.key === 'ATTENDANCE_APPROVAL_RESULT' && isAdminOrManager) {
              return { ...evt, desc: 'Khi yêu cầu bổ sung công / đi trễ của cá nhân hoặc phòng ban có kết quả phê duyệt' };
            }
            return evt;
          })
        };
      }
      return cat;
    });
  }, [isAdminOrManager]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    user_id?: number;
    email: string;
    zalo_chat_id: string;
    telegram_chat_id: string;
    has_zalo: boolean;
    has_telegram: boolean;
    has_email: boolean;
    zalo_bot_link?: string;
    telegram_bot_username?: string;
  }>({
    user_id: undefined,
    email: '',
    zalo_chat_id: '',
    telegram_chat_id: '',
    has_zalo: false,
    has_telegram: false,
    has_email: false,
    zalo_bot_link: '',
    telegram_bot_username: '',
  });

  const [isZaloModalOpen, setIsZaloModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [eventSettings, setEventSettings] = useState<EventSettingsState>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'error' = 'warning') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleConnectZalo = () => {
    const link = userInfo.zalo_bot_link?.trim();
    if (!link) {
      showToast('Hệ thống chưa setup nhận thông báo qua Zalobot', 'warning');
      toast.error('Hệ thống chưa setup nhận thông báo qua Zalobot');
      return;
    }
    setIsZaloModalOpen(true);
  };

  const handleConnectTelegram = () => {
    const username = userInfo.telegram_bot_username?.trim();
    if (!username) {
      showToast('Hệ thống chưa setup nhận thông báo qua Telegram Bot', 'warning');
      toast.error('Hệ thống chưa setup nhận thông báo qua Telegram Bot');
      return;
    }
    const connectUserId = userInfo.user_id || currentUser?.id;
    const telegramUrl = `https://t.me/${username}?start=connect_${connectUserId}`;
    window.open(telegramUrl, '_blank');
  };

// Default Matrix Configurations:
// - Email: ON (true) for all events
// - Zalo & Telegram: ON (true) ONLY for important/urgent events
// - Master Bell: ON (true) for all events
const DEFAULT_EVENT_CONFIGS: Record<string, EventConfig> = {
  // IMPORTANT EVENTS -> Zalo & Telegram = ON, Email = ON
  LEAD_ASSIGNMENT: { master: true, zalo: true, telegram: true, email: true },
  SECURITY_DEADLINE_WARNING: { master: true, zalo: true, telegram: true, email: true },
  MENTION_TAGGED: { master: true, zalo: true, telegram: true, email: true },
  MY_DEPOSIT_UPDATE: { master: true, zalo: true, telegram: true, email: true },
  CHECKIN_LATE: { master: true, zalo: true, telegram: true, email: true },
  EXPENSE_REQUEST: { master: true, zalo: true, telegram: true, email: true },
  COOPERATION_PENDING_APPROVAL: { master: true, zalo: true, telegram: true, email: true },
  DEPOSIT_NEW: { master: true, zalo: true, telegram: true, email: true },

  // ROUTINE / STANDARD EVENTS -> Zalo & Telegram = OFF, Email = ON
  CUSTOMER_UPDATE: { master: true, zalo: false, telegram: false, email: true },
  WORKFLOW_TASK_ASSIGNED: { master: true, zalo: false, telegram: false, email: true },
  ATTENDANCE_APPROVAL_RESULT: { master: true, zalo: false, telegram: false, email: true },
  NIGHT_SHIFT_BOOKING: { master: true, zalo: false, telegram: false, email: true },
  PROFILE_ACCOUNT_UPDATE: { master: true, zalo: false, telegram: false, email: true },
  ATTENDANCE_UPDATE: { master: true, zalo: false, telegram: false, email: true },
  TICKET_NEW: { master: true, zalo: false, telegram: false, email: true },
  LEAVE_REQUEST: { master: true, zalo: false, telegram: false, email: true },
  PROJECT_ROSTER_UPDATE: { master: true, zalo: false, telegram: false, email: true },
  MONTHLY_ATTENDANCE_REPORT: { master: true, zalo: false, telegram: false, email: true },
  HOLIDAY_ROSTER_OPEN: { master: true, zalo: false, telegram: false, email: true },
  HOLIDAY_ANNOUNCEMENT: { master: true, zalo: false, telegram: false, email: true },
};

const getDefaultConfig = (key: string): EventConfig => {
  return DEFAULT_EVENT_CONFIGS[key] || { master: true, zalo: false, telegram: false, email: true };
};

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchAPI('notifications/settings')
        .then(res => {
          if (res && res.success && res.data) {
            const uInfo = res.data.user_info || { has_zalo: false, has_telegram: false, has_email: true };
            setUserInfo(uInfo);
            
            const savedSettings = res.data.matrix_config || {};
            const initialSettings: EventSettingsState = {};
            ALL_EVENTS.forEach(evt => {
              initialSettings[evt.key] = savedSettings[evt.key] || getDefaultConfig(evt.key);
            });
            setEventSettings(initialSettings);
          }
        })
        .catch(err => {
          console.error("Error loading notification settings:", err);
          showToast("Không thể tải cài đặt thông báo. Vui lòng kiểm tra kết nối.", "error");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleResetDefault = () => {
    const defaultState: EventSettingsState = {};
    ALL_EVENTS.forEach(evt => {
      defaultState[evt.key] = getDefaultConfig(evt.key);
    });
    setEventSettings(defaultState);
    showToast("Đã khôi phục về cấu hình mặc định chuẩn! Bấm 'Lưu Cấu Hình Chuyên Sâu' để hoàn tất.", "success");
  };

  const handleMasterToggle = (eventKey: string) => {
    setEventSettings(prev => {
      const current = prev[eventKey] || { master: true, zalo: true, telegram: true, email: true };
      const nextMaster = !current.master;
      return {
        ...prev,
        [eventKey]: {
          ...current,
          master: nextMaster,
          zalo: nextMaster ? true : false,
          telegram: nextMaster ? true : false,
          email: nextMaster ? true : false,
        }
      };
    });
  };

  const handleChannelToggle = (eventKey: string, channel: 'zalo' | 'telegram' | 'email') => {
    const evtCfg = eventSettings[eventKey] || { master: true, zalo: true, telegram: true, email: true };

    if (!evtCfg.master) {
      showToast("Vui lòng gạt BẬT Nguồn tổng trước khi chọn kênh thông báo!", "warning");
      return;
    }

    if (channel === 'zalo' && !userInfo.has_zalo) {
      showToast("Tài khoản của bạn chưa kết nối Zalo Bot! Vui lòng kết nối Zalo ở phía trên trước.", "warning");
      return;
    }
    if (channel === 'telegram' && !userInfo.has_telegram) {
      showToast("Tài khoản của bạn chưa kết nối Telegram! Vui lòng kết nối Telegram ở phía trên trước.", "warning");
      return;
    }

    const nextVal = !evtCfg[channel];

    if (!nextVal) {
      const activeChannels = ['zalo', 'telegram', 'email'].filter(c => c !== channel && evtCfg[c as keyof EventConfig]);
      if (activeChannels.length === 0) {
        showToast("Phải giữ tối thiểu 1 kênh nhận tin khi sự kiện đang bật! (Hoặc gạt TẮT Nguồn tổng nếu muốn tắt hẳn)", "warning");
        return;
      }
    }

    setEventSettings(prev => ({
      ...prev,
      [eventKey]: {
        ...evtCfg,
        [channel]: nextVal
      }
    }));
  };

  const handleSave = () => {
    setSaving(true);
    fetchAPI('notifications/settings', {
      method: 'POST',
      body: JSON.stringify({ matrix_config: eventSettings })
    })
      .then(res => {
        if (res && res.success) {
          toast.success("Đã lưu cấu hình tùy chỉnh thông báo thành công!");
          showToast("Đã lưu cấu hình tùy chỉnh thông báo thành công!", "success");
          setTimeout(() => onClose(), 1000);
        } else {
          toast.error(res?.message || "Không thể lưu cài đặt");
          showToast(res?.message || "Không thể lưu cài đặt", "error");
        }
      })
      .catch(err => {
        console.error("Save error:", err);
        toast.error("Lỗi kết nối máy chủ");
        showToast("Lỗi kết nối máy chủ", "error");
      })
      .finally(() => setSaving(false));
  };

  return (
    <>
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="Cấu Hình Thông Báo Tùy Chỉnh Chuyên Sâu"
      width={920}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>

        {/* Top Header Bar with Back Button */}
        {onBack && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: '-4px' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: '#BD1D2D',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              <ArrowLeft size={16} />
              Quay lại danh sách thông báo
            </button>
          </div>
        )}

        {/* Toast alert message */}
        {toastMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 600,
            background: toastMessage.type === 'success' ? '#f0fdf4' : toastMessage.type === 'error' ? '#fef2f2' : '#fffbeb',
            color: toastMessage.type === 'success' ? '#166534' : toastMessage.type === 'error' ? '#991b1b' : '#92400e',
            border: `1px solid ${toastMessage.type === 'success' ? '#bbf7d0' : toastMessage.type === 'error' ? '#fecaca' : '#fde68a'}`
          }}>
            {toastMessage.type === 'success' ? <CheckCircle size={20} color="#166534" /> : <AlertTriangle size={20} color="#b45309" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Account Linking Status Header Card - Pure White Elegant Style */}
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '16px 20px',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <ShieldCheck size={20} color="#BD1D2D" />
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
              Trạng Thái Kết Nối Kênh Thông Báo Cá Nhân
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {/* Zalo Card */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 22, height: 22, objectFit: 'contain' }} alt="Zalo" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0f172a' }}>Zalo Bot</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: userInfo.has_zalo ? '#16a34a' : '#d97706' }}>
                    {userInfo.has_zalo ? "● Đã liên kết" : "○ Chưa liên kết"}
                  </div>
                </div>
              </div>
              {!userInfo.has_zalo && (
                <button
                  type="button"
                  onClick={handleConnectZalo}
                  style={{
                    padding: '4px 10px',
                    background: '#0068ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Liên kết <ExternalLink size={12} />
                </button>
              )}
            </div>

            {/* Telegram Card */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/3840px-Telegram_logo.svg.png" style={{ width: 22, height: 22, objectFit: 'contain' }} alt="Telegram" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0f172a' }}>Telegram Bot</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: userInfo.has_telegram ? '#16a34a' : '#d97706' }}>
                    {userInfo.has_telegram ? "● Đã liên kết" : "○ Chưa liên kết"}
                  </div>
                </div>
              </div>
              {!userInfo.has_telegram && (
                <button
                  type="button"
                  onClick={handleConnectTelegram}
                  style={{
                    padding: '4px 10px',
                    background: '#0284c7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Liên kết <ExternalLink size={12} />
                </button>
              )}
            </div>

            {/* Email Card */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/imgs/gmail-icon-free-png.webp" style={{ width: 22, height: 22, objectFit: 'contain' }} alt="Email" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0f172a' }}>Email SMTP</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                    {userInfo.email || "● Đã sẵn sàng"}
                  </div>
                </div>
              </div>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            </div>
          </div>
        </div>

        {/* Custom Settings Table */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>Đang tải cài đặt thông báo tùy chỉnh...</div>
        ) : (
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '14px 18px' }}>Sự Kiện Thông Báo Hệ Thống</th>
                  <th style={{ padding: '14px 10px', textAlign: 'center', width: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#0068ff' }}>
                      <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 16, height: 16, objectFit: 'contain' }} alt="Zalo" />
                      <span>Zalo</span>
                    </div>
                  </th>
                  <th style={{ padding: '14px 10px', textAlign: 'center', width: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#0284c7' }}>
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/3840px-Telegram_logo.svg.png" style={{ width: 16, height: 16, objectFit: 'contain' }} alt="Telegram" />
                      <span>Telegram</span>
                    </div>
                  </th>
                  <th style={{ padding: '14px 10px', textAlign: 'center', width: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#BD1D2D' }}>
                      <img src="/imgs/gmail-icon-free-png.webp" style={{ width: 16, height: 16, objectFit: 'contain' }} alt="Email" />
                      <span>Email</span>
                    </div>
                  </th>
                  <th style={{ padding: '14px 10px', textAlign: 'center', width: 130, color: '#16a34a', fontWeight: 800, borderLeft: '1px solid #e2e8f0' }}>Bật thông báo</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '0.875rem' }}>
                {visibleCategories.map(cat => (
                  <React.Fragment key={cat.category}>
                    {/* Category Header Row */}
                    <tr style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                      <td colSpan={5} style={{ padding: '10px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            color: cat.badgeColor,
                            background: cat.badgeBg,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}>
                            {cat.badge}
                          </span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>
                            {cat.title}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Events in Category */}
                    {cat.events.map((evt, idx) => {
                      const cfg = eventSettings[evt.key] || { master: true, zalo: true, telegram: true, email: true };
                      return (
                        <tr
                          key={evt.key}
                          style={{
                            borderBottom: idx < cat.events.length - 1 ? '1px solid #f1f5f9' : 'none',
                            background: !cfg.master ? '#f8fafc' : 'white',
                            opacity: !cfg.master ? 0.65 : 1,
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Event details */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{evt.icon}</span>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{evt.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', lineHeight: 1.35 }}>{evt.desc}</div>
                              </div>
                            </div>
                          </td>

                          {/* Zalo Checkbox */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: (!cfg.master || !userInfo.has_zalo) ? 'not-allowed' : 'pointer',
                                margin: '0 auto'
                              }}
                              title={!userInfo.has_zalo ? "Chưa liên kết Zalo" : (cfg.zalo ? "Tắt Zalo" : "Bật Zalo")}
                            >
                              <input
                                type="checkbox"
                                disabled={!cfg.master || !userInfo.has_zalo}
                                checked={cfg.zalo && userInfo.has_zalo}
                                onChange={() => handleChannelToggle(evt.key, 'zalo')}
                                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                              />
                              <span
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '6px',
                                  border: (cfg.zalo && userInfo.has_zalo) ? '2px solid #BD1D2D' : '2px solid #cbd5e1',
                                  background: (cfg.zalo && userInfo.has_zalo) ? '#BD1D2D' : '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  transition: 'all 0.15s ease',
                                  opacity: !cfg.master ? 0.4 : 1,
                                  boxShadow: (cfg.zalo && userInfo.has_zalo) ? '0 2px 5px rgba(189, 29, 45, 0.25)' : 'none'
                                }}
                              >
                                {(cfg.zalo && userInfo.has_zalo) && <Check size={14} strokeWidth={3.5} />}
                              </span>
                            </label>
                          </td>

                          {/* Telegram Checkbox */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: (!cfg.master || !userInfo.has_telegram) ? 'not-allowed' : 'pointer',
                                margin: '0 auto'
                              }}
                              title={!userInfo.has_telegram ? "Chưa liên kết Telegram" : (cfg.telegram ? "Tắt Telegram" : "Bật Telegram")}
                            >
                              <input
                                type="checkbox"
                                disabled={!cfg.master || !userInfo.has_telegram}
                                checked={cfg.telegram && userInfo.has_telegram}
                                onChange={() => handleChannelToggle(evt.key, 'telegram')}
                                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                              />
                              <span
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '6px',
                                  border: (cfg.telegram && userInfo.has_telegram) ? '2px solid #BD1D2D' : '2px solid #cbd5e1',
                                  background: (cfg.telegram && userInfo.has_telegram) ? '#BD1D2D' : '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  transition: 'all 0.15s ease',
                                  opacity: !cfg.master ? 0.4 : 1,
                                  boxShadow: (cfg.telegram && userInfo.has_telegram) ? '0 2px 5px rgba(189, 29, 45, 0.25)' : 'none'
                                }}
                              >
                                {(cfg.telegram && userInfo.has_telegram) && <Check size={14} strokeWidth={3.5} />}
                              </span>
                            </label>
                          </td>

                          {/* Email Checkbox */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: !cfg.master ? 'not-allowed' : 'pointer',
                                margin: '0 auto'
                              }}
                              title={cfg.email ? "Tắt Email" : "Bật Email"}
                            >
                              <input
                                type="checkbox"
                                disabled={!cfg.master}
                                checked={cfg.email}
                                onChange={() => handleChannelToggle(evt.key, 'email')}
                                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                              />
                              <span
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '6px',
                                  border: cfg.email ? '2px solid #BD1D2D' : '2px solid #cbd5e1',
                                  background: cfg.email ? '#BD1D2D' : '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  transition: 'all 0.15s ease',
                                  opacity: !cfg.master ? 0.4 : 1,
                                  boxShadow: cfg.email ? '0 2px 5px rgba(189, 29, 45, 0.25)' : 'none'
                                }}
                              >
                                {cfg.email && <Check size={14} strokeWidth={3.5} />}
                              </span>
                            </label>
                          </td>

                          {/* Master Power Switch (Far Right with divider) */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle', borderLeft: '1px solid #f1f5f9' }}>
                            <button
                              type="button"
                              onClick={() => handleMasterToggle(evt.key)}
                              title={cfg.master ? "Tắt thông báo" : "Bật thông báo"}
                              style={{
                                position: 'relative',
                                width: 36,
                                height: 20,
                                borderRadius: 20,
                                border: 'none',
                                background: cfg.master ? '#16a34a' : '#cbd5e1',
                                cursor: 'pointer',
                                padding: 0,
                                margin: '0 auto',
                                display: 'block',
                                transition: 'background 0.2s ease',
                                outline: 'none'
                              }}
                            >
                              <span style={{
                                position: 'absolute',
                                top: 3,
                                left: cfg.master ? 19 : 3,
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                transition: 'left 0.2s ease'
                              }} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Actions (Sticky Bottom Bar - Flush to bottom) */}
        <div style={{
          position: 'sticky',
          bottom: '-24px',
          margin: '20px -24px -24px -24px',
          padding: '14px 24px',
          background: '#ffffff',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #e2e8f0',
          boxShadow: '0 -6px 20px rgba(0, 0, 0, 0.07)',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px',
          gap: '16px'
        }}>
          {/* Left Side: Hủy bỏ button & Tip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#64748b',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Hủy bỏ
            </button>
            <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
              💡 <strong>Mẹo:</strong> Chuông In-App luôn duy trì tự động.
            </div>
          </div>

          {/* Right Side: Reset & Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleResetDefault}
              title="Khôi phục về cài đặt mặc định ban đầu"
              style={{
                padding: '8px 14px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#475569',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <RotateCcw size={14} />
              Khôi phục mặc định
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '10px 20px',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'white',
                background: '#BD1D2D',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(189, 29, 45, 0.28)',
                opacity: saving ? 0.6 : 1,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {saving ? "Đang lưu..." : "Lưu Cấu Hình Chuyên Sâu"}
            </button>
          </div>
        </div>

      </div>
    </CustomModal>

    {/* Zalo Bot Connect Modal */}
    {isZaloModalOpen && (
      <CustomModal
        isOpen={isZaloModalOpen}
        onClose={() => setIsZaloModalOpen(false)}
        title="Kết Nối Zalo Bot Nhận Thông Báo"
        width={640}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '6px 2px' }}>
          {/* Header banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            padding: '14px 16px',
            borderRadius: '12px'
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0068ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 22, height: 22 }} alt="Zalo" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e3a8a' }}>
                Xác Thực Tài Khoản Zalo Cá Nhân
              </div>
              <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: 2 }}>
                Gửi mã kết nối bên dưới đến Zalo Bot để hoàn tất liên kết
              </div>
            </div>
          </div>

          {/* 2-column layout: instructions left, QR right */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>

            {/* Left: Steps */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Bước 1 */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0068ff', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>1</span>
                  Nhấn liên kết mở Zalo Bot:
                </div>
                <a
                  href={userInfo.zalo_bot_link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 18px',
                    background: '#0068ff',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    textDecoration: 'none',
                    boxShadow: '0 3px 8px rgba(0,104,255,0.25)'
                  }}
                >
                  Mở Zalo Bot Trực Tiếp <ExternalLink size={14} />
                </a>
              </div>

              {/* Bước 2 */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', flex: 1 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0068ff', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>2</span>
                  Gửi mã kết nối cho Zalo Bot:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    flex: 1,
                    background: '#0f172a',
                    color: '#38bdf8',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    letterSpacing: '1px',
                    textAlign: 'center',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {userInfo.user_id || currentUser?.id}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const code = `CONNECT ${userInfo.user_id || currentUser?.id || ''}`;
                      navigator.clipboard.writeText(code);
                      setCopiedCode(true);
                      toast.success('Đã sao chép mã kết nối Zalo Bot!');
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    style={{
                      padding: '10px 16px',
                      background: copiedCode ? '#16a34a' : '#0068ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      transition: 'all 0.2s'
                    }}
                  >
                    {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                    {copiedCode ? 'Đã sao chép' : 'Sao chép mã'}
                  </button>
                </div>
              </div>

            </div>

            {/* Right: QR Code */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              minWidth: 160
            }}>
              <div style={{
                background: '#fff',
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {userInfo.zalo_bot_link ? (
                  <QRCodeCanvas
                    value={userInfo.zalo_bot_link}
                    size={120}
                    level="H"
                    includeMargin={false}
                  />
                ) : (
                  <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    <Smartphone size={40} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                <Smartphone size={13} /> Quét bằng điện thoại
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', textAlign: 'center', lineHeight: 1.4 }}>
                Mở camera để quét &amp; chat trực tiếp
              </div>
            </div>

          </div>

          <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: 2 }}>
            ✨ Ngay khi nhắn mã thành công, Zalo Bot sẽ tự động phản hồi xác nhận liên kết tài khoản của bạn!
          </div>
        </div>
      </CustomModal>
    )}
    </>
  );
};

