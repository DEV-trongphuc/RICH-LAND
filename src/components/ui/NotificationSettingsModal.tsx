import React, { useState, useEffect } from 'react';
import { CustomModal } from './CustomModal';
import { Power, CheckCircle, AlertTriangle, ShieldCheck, ExternalLink, ArrowRight, Settings } from 'lucide-react';
import { fetchAPI } from '../../utils/api';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EventConfig {
  master: boolean;
  zalo: boolean;
  telegram: boolean;
  email: boolean;
}

type EventSettingsState = Record<string, EventConfig>;

const DEFAULT_EVENTS = [
  {
    key: 'CHECKIN_LATE',
    name: 'Báo cáo Đi trễ & Bổ sung công',
    desc: 'Khi nhân viên gửi báo cáo đi trễ hoặc gửi yêu cầu cập nhật công bổ sung ngày cũ',
    icon: '⏰'
  },
  {
    key: 'ATTENDANCE_APPROVAL_RESULT',
    name: 'Kết quả Phê duyệt Chấm công',
    desc: 'Khi yêu cầu đi trễ hoặc bổ sung công của bạn được Admin chấp thuận / từ chối',
    icon: '✅'
  },
  {
    key: 'EXPENSE_REQUEST',
    name: 'Đề xuất Chi phí & Thanh toán',
    desc: 'Khi có khoản chi phí mới cần ban giám đốc / quản lý phê duyệt',
    icon: '💸'
  },
  {
    key: 'TICKET_NEW',
    name: 'Ticket Hỗ trợ Kỹ thuật & CRM',
    desc: 'Khi có ticket yêu cầu hỗ trợ mới được tạo gửi tới bộ phận của bạn',
    icon: '🎫'
  },
  {
    key: 'COOPERATION_PENDING_APPROVAL',
    name: 'Phiếu Hợp tác Chia sẻ Hoa hồng',
    desc: 'Khi phiếu hợp tác gom đủ chữ ký các bên và chuyển sang trạng thái chờ duyệt',
    icon: '✍️'
  },
  {
    key: 'DEPOSIT_NEW',
    name: 'Giao dịch Đặt cọc Mới',
    desc: 'Khi có yêu cầu duyệt cọc giao dịch bất động sản mới',
    icon: '🏠'
  },
  {
    key: 'NIGHT_SHIFT_BOOKING',
    name: 'Đăng ký Trực ca & Trực đêm',
    desc: 'Khi có lịch đăng ký ca trực đêm mới trên hệ thống Roster',
    icon: '🌙'
  },
  {
    key: 'LEAVE_REQUEST',
    name: 'Đơn xin Nghỉ phép',
    desc: 'Khi có đơn xin nghỉ phép từ nhân viên thuộc nhóm phụ trách',
    icon: '🏖️'
  }
];

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ isOpen, onClose }) => {
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
            if (res.data.user_info) {
              setUserInfo(res.data.user_info);
            }
            const savedSettings = res.data.matrix_config || {};
            const initialSettings: EventSettingsState = {};
            DEFAULT_EVENTS.forEach(evt => {
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
          showToast("Không thể tải cài đặt thông báo. Vui lòng kiểm tra lại kết nối.", "error");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleMasterToggle = (eventKey: string) => {
    setEventSettings(prev => {
      const current = prev[eventKey] || { master: true, zalo: true, telegram: true, email: true };
      const nextMaster = !current.master;
      return {
        ...prev,
        [eventKey]: {
          ...current,
          master: nextMaster,
          zalo: nextMaster ? (userInfo.has_zalo ? true : false) : false,
          telegram: nextMaster ? (userInfo.has_telegram ? true : false) : false,
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

    // Account Linking Guards
    if (channel === 'zalo' && !userInfo.has_zalo) {
      showToast("Tài khoản của bạn chưa kết nối Zalo Bot! Vui lòng bấm 'Liên kết Zalo' ở thanh phía trên.", "warning");
      return;
    }
    if (channel === 'telegram' && !userInfo.has_telegram) {
      showToast("Tài khoản của bạn chưa kết nối Telegram! Vui lòng bấm 'Liên kết Telegram' ở thanh phía trên.", "warning");
      return;
    }

    const nextVal = !evtCfg[channel];

    // Minimum 1 channel constraint when master is ON
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
      width={900}
    >
      <div className="space-y-5 text-slate-800 font-sans">

        {/* Toast alert */}
        {toastMessage && (
          <div className={`p-3.5 rounded-xl flex items-center gap-3 text-sm font-medium animate-fadeIn ${
            toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
            toastMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
            'bg-amber-50 text-amber-900 border border-amber-200'
          }`}>
            {toastMessage.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Account Linking Status Top Bar - Clean Red Theme Accent */}
        <div className="bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 border border-red-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-200/60">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-bold text-red-950">Trạng Thái Kết Nối Kênh Nhận Thông Báo Cá Nhân</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Zalo Status Card */}
            <div className="bg-white/90 p-3 rounded-xl border border-red-100 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <img src="https://stc-zpl.zdn.vn/favicon.ico" className="w-5 h-5 object-contain" alt="Zalo" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Zalo Bot</div>
                  <div className={userInfo.has_zalo ? "text-emerald-600 font-semibold" : "text-amber-600 font-medium"}>
                    {userInfo.has_zalo ? "● Đã liên kết" : "○ Chưa liên kết"}
                  </div>
                </div>
              </div>
              {!userInfo.has_zalo && (
                <a
                  href="/settings?tab=integrations"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-1 transition shadow-xs"
                >
                  Liên kết <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Telegram Status Card */}
            <div className="bg-white/90 p-3 rounded-xl border border-red-100 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/3840px-Telegram_logo.svg.png" className="w-5 h-5 object-contain" alt="Telegram" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Telegram Bot</div>
                  <div className={userInfo.has_telegram ? "text-emerald-600 font-semibold" : "text-amber-600 font-medium"}>
                    {userInfo.has_telegram ? "● Đã liên kết" : "○ Chưa liên kết"}
                  </div>
                </div>
              </div>
              {!userInfo.has_telegram && (
                <a
                  href="/settings?tab=integrations"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-1 transition shadow-xs"
                >
                  Liên kết <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Email Status Card */}
            <div className="bg-white/90 p-3 rounded-xl border border-red-100 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                  <img src="/imgs/gmail-icon-free-png.webp" className="w-5 h-5 object-contain" alt="Email" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Email SMTP</div>
                  <div className="text-emerald-600 font-semibold truncate max-w-[130px]">
                    {userInfo.email || "● Đã sẵn sàng"}
                  </div>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
        </div>

        {/* Custom Settings Table Header & Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium">Đang tải cấu hình thông báo tùy chỉnh...</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3.5 px-4 min-w-[250px]">Sự Kiện Thông Báo Hệ Thống</th>
                    <th className="py-3.5 px-3 text-center w-[110px] text-slate-900">Nguồn Tổng</th>
                    <th className="py-3.5 px-3 text-center w-[120px]">
                      <div className="flex items-center justify-center gap-1.5 text-blue-600">
                        <img src="https://stc-zpl.zdn.vn/favicon.ico" className="w-4 h-4 object-contain" alt="Zalo" />
                        <span>Zalo</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-3 text-center w-[120px]">
                      <div className="flex items-center justify-center gap-1.5 text-sky-600">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/3840px-Telegram_logo.svg.png" className="w-4 h-4 object-contain" alt="Telegram" />
                        <span>Telegram</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-3 text-center w-[120px]">
                      <div className="flex items-center justify-center gap-1.5 text-rose-600">
                        <img src="/imgs/gmail-icon-free-png.webp" className="w-4 h-4 object-contain" alt="Email" />
                        <span>Email</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {DEFAULT_EVENTS.map(evt => {
                    const cfg = eventSettings[evt.key] || { master: true, zalo: true, telegram: true, email: true };
                    return (
                      <tr key={evt.key} className={`transition hover:bg-red-50/20 ${!cfg.master ? 'bg-slate-50/60 opacity-60' : ''}`}>
                        {/* Event Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            <span className="text-xl leading-none mt-0.5">{evt.icon}</span>
                            <div>
                              <div className="font-bold text-slate-900">{evt.name}</div>
                              <div className="text-xs text-slate-500 leading-snug mt-0.5">{evt.desc}</div>
                            </div>
                          </div>
                        </td>

                        {/* Master Switch */}
                        <td className="py-3.5 px-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => handleMasterToggle(evt.key)}
                            title={cfg.master ? "Tắt nguồn tổng sự kiện này" : "Bật nguồn tổng sự kiện này"}
                            className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out mx-auto ${
                              cfg.master ? 'bg-red-600' : 'bg-slate-300'
                            }`}
                          >
                            <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                              cfg.master ? 'translate-x-5.5' : 'translate-x-0'
                            }`}>
                              <Power className={`w-2.5 h-2.5 ${cfg.master ? 'text-red-600 font-bold' : 'text-slate-400'}`} />
                            </div>
                          </button>
                        </td>

                        {/* Zalo Toggle */}
                        <td className="py-3.5 px-3 text-center align-middle">
                          <button
                            type="button"
                            disabled={!cfg.master}
                            onClick={() => handleChannelToggle(evt.key, 'zalo')}
                            title={!userInfo.has_zalo ? "Chưa liên kết Zalo" : (cfg.zalo ? "Tắt Zalo" : "Bật Zalo")}
                            className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out mx-auto ${
                              !cfg.master ? 'bg-slate-200 cursor-not-allowed' :
                              cfg.zalo && userInfo.has_zalo ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out flex items-center justify-center font-bold text-[10px] ${
                              cfg.zalo && userInfo.has_zalo ? 'translate-x-5 text-blue-600' : 'translate-x-0 text-slate-400'
                            }`}>
                              Z
                            </div>
                          </button>
                        </td>

                        {/* Telegram Toggle */}
                        <td className="py-3.5 px-3 text-center align-middle">
                          <button
                            type="button"
                            disabled={!cfg.master}
                            onClick={() => handleChannelToggle(evt.key, 'telegram')}
                            title={!userInfo.has_telegram ? "Chưa liên kết Telegram" : (cfg.telegram ? "Tắt Telegram" : "Bật Telegram")}
                            className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out mx-auto ${
                              !cfg.master ? 'bg-slate-200 cursor-not-allowed' :
                              cfg.telegram && userInfo.has_telegram ? 'bg-sky-500' : 'bg-slate-300'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                              cfg.telegram && userInfo.has_telegram ? 'translate-x-5 text-sky-500' : 'translate-x-0 text-slate-400'
                            }`}>
                              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.49 1.02-.75 3.99-1.74 6.66-2.89 8.01-3.45 3.81-1.59 4.6-1.87 5.12-1.88.11 0 .37.03.54.18.14.12.18.28.2.45-.02.07-.01.21-.04.37z" />
                              </svg>
                            </div>
                          </button>
                        </td>

                        {/* Email Toggle */}
                        <td className="py-3.5 px-3 text-center align-middle">
                          <button
                            type="button"
                            disabled={!cfg.master}
                            onClick={() => handleChannelToggle(evt.key, 'email')}
                            title={cfg.email ? "Tắt Email" : "Bật Email"}
                            className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out mx-auto ${
                              !cfg.master ? 'bg-slate-200 cursor-not-allowed' :
                              cfg.email ? 'bg-rose-500' : 'bg-slate-300'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                              cfg.email ? 'translate-x-5 text-rose-500' : 'translate-x-0 text-slate-400'
                            }`}>
                              <svg className="w-2.5 h-2.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                <rect width="20" height="16" x="2" y="4" rx="2"/>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                              </svg>
                            </div>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            💡 <strong>Mẹo:</strong> Chuông In-App hệ thống luôn duy trì để đảm bảo bạn không bao giờ bỏ lỡ lịch sử làm việc.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? "Đang lưu..." : "Lưu Cấu Hình Tùy Chỉnh"}
            </button>
          </div>
        </div>

      </div>
    </CustomModal>
  );
};
