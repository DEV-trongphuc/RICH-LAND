import React, { useState, useEffect } from 'react';
import { CustomModal } from './CustomModal';
import { Power, CheckCircle, AlertTriangle, ShieldCheck, ExternalLink, RotateCcw, ArrowLeft } from 'lucide-react';
import { fetchAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

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
    badgeColor: '#dc2626',
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
  const isAdminOrManager = role === 'admin' || role === 'director' || role === 'manager' || role === 'leader' || role === 'head_of_department';

  const visibleCategories = EVENT_CATEGORIES.filter(cat => {
    if (cat.category === 'ADMIN_MANAGER') {
      return isAdminOrManager;
    }
    return true;
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    email: string;
    zalo_chat_id: string;
    telegram_chat_id: string;
    has_zalo: boolean;
    has_telegram: boolean;
    has_email: boolean;
  }>({
    email: '',
    zalo_chat_id: '',
    telegram_chat_id: '',
    has_zalo: false,
    has_telegram: false,
    has_email: false,
  });

  const [eventSettings, setEventSettings] = useState<EventSettingsState>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'error' = 'warning') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
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
              initialSettings[evt.key] = savedSettings[evt.key] || {
                master: true,
                zalo: true,
                telegram: true,
                email: true,
              };
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
      defaultState[evt.key] = {
        master: true,
        zalo: true,
        telegram: true,
        email: true
      };
    });
    setEventSettings(defaultState);
    showToast("Đã khôi phục về mặc định ban đầu! Bấm 'Lưu Cấu Hình Chuyên Sâu' để hoàn tất.", "success");
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
          showToast("Đã lưu cấu hình tùy chỉnh thông báo thành công!", "success");
          setTimeout(() => onClose(), 1000);
        } else {
          showToast(res?.message || "Không thể lưu cài đặt", "error");
        }
      })
      .catch(err => {
        console.error("Save error:", err);
        showToast("Lỗi kết nối máy chủ", "error");
      })
      .finally(() => setSaving(false));
  };

  return (
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
                color: '#dc2626',
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
            <ShieldCheck size={20} color="#dc2626" />
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
                <a
                  href="/settings?tab=integrations"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '4px 10px',
                    background: '#0068ff',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Liên kết <ExternalLink size={12} />
                </a>
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
                <a
                  href="/settings?tab=integrations"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '4px 10px',
                    background: '#0284c7',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Liên kết <ExternalLink size={12} />
                </a>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#dc2626' }}>
                      <img src="/imgs/gmail-icon-free-png.webp" style={{ width: 16, height: 16, objectFit: 'contain' }} alt="Email" />
                      <span>Email</span>
                    </div>
                  </th>
                  <th style={{ padding: '14px 10px', textAlign: 'center', width: 130, color: '#16a34a', fontWeight: 800 }}>Bật thông báo</th>
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

                          {/* Zalo Toggle */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              disabled={!cfg.master}
                              onClick={() => handleChannelToggle(evt.key, 'zalo')}
                              title={!userInfo.has_zalo ? "Chưa liên kết Zalo" : (cfg.zalo ? "Tắt Zalo" : "Bật Zalo")}
                              style={{
                                position: 'relative',
                                width: 36,
                                height: 20,
                                borderRadius: 20,
                                border: 'none',
                                background: !cfg.master ? '#e2e8f0' : (cfg.zalo && userInfo.has_zalo ? '#16a34a' : '#cbd5e1'),
                                cursor: !cfg.master ? 'not-allowed' : 'pointer',
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
                                left: (cfg.zalo && userInfo.has_zalo) ? 19 : 3,
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                transition: 'left 0.2s ease'
                              }} />
                            </button>
                          </td>

                          {/* Telegram Toggle */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              disabled={!cfg.master}
                              onClick={() => handleChannelToggle(evt.key, 'telegram')}
                              title={!userInfo.has_telegram ? "Chưa liên kết Telegram" : (cfg.telegram ? "Tắt Telegram" : "Bật Telegram")}
                              style={{
                                position: 'relative',
                                width: 36,
                                height: 20,
                                borderRadius: 20,
                                border: 'none',
                                background: !cfg.master ? '#e2e8f0' : (cfg.telegram && userInfo.has_telegram ? '#16a34a' : '#cbd5e1'),
                                cursor: !cfg.master ? 'not-allowed' : 'pointer',
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
                                left: (cfg.telegram && userInfo.has_telegram) ? 19 : 3,
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                transition: 'left 0.2s ease'
                              }} />
                            </button>
                          </td>

                          {/* Email Toggle */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              disabled={!cfg.master}
                              onClick={() => handleChannelToggle(evt.key, 'email')}
                              title={cfg.email ? "Tắt Email" : "Bật Email"}
                              style={{
                                position: 'relative',
                                width: 36,
                                height: 20,
                                borderRadius: 20,
                                border: 'none',
                                background: !cfg.master ? '#e2e8f0' : (cfg.email ? '#16a34a' : '#cbd5e1'),
                                cursor: !cfg.master ? 'not-allowed' : 'pointer',
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
                                left: cfg.email ? 19 : 3,
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                transition: 'left 0.2s ease'
                              }} />
                            </button>
                          </td>

                          {/* Master Power Switch (Far Right) */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
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

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '14px',
          borderTop: '1px solid #f1f5f9',
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
                background: '#dc2626',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
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
  );
};

