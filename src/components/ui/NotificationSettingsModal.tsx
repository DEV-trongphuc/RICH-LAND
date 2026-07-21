import React, { useState, useEffect } from 'react';
import { CustomModal } from './CustomModal';
import { Bell, MessageCircle, Send, Mail, Power, CheckCircle, AlertTriangle, ShieldCheck, ExternalLink } from 'lucide-react';
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

type MatrixState = Record<string, EventConfig>;

const DEFAULT_EVENTS = [
  {
    key: 'CHECKIN_LATE',
    name: 'Báo cáo Đi trễ & Bổ sung công',
    desc: 'Khi bạn hoặc nhân viên gửi báo cáo đi trễ hoặc yêu cầu cập nhật công bổ sung',
    icon: '⏰'
  },
  {
    key: 'ATTENDANCE_APPROVAL_RESULT',
    name: 'Kết quả Phê duyệt Chấm công',
    desc: 'Khi yêu cầu đi trễ hoặc bổ sung công của bạn được Admin duyệt/từ chối',
    icon: '✅'
  },
  {
    key: 'EXPENSE_REQUEST',
    name: 'Đề xuất Chi phí & Thanh toán',
    desc: 'Khi có khoản chi phí mới được tạo cần ban giám đốc/quản lý phê duyệt',
    icon: '💸'
  },
  {
    key: 'TICKET_NEW',
    name: 'Ticket Hỗ trợ Kỹ thuật & CRM',
    desc: 'Khi có ticket yêu cầu hỗ trợ mới được tạo từ nhân viên hoặc gửi tới bạn',
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

  const [matrix, setMatrix] = useState<MatrixState>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'error' = 'warning') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchAPI('get_notification_settings')
        .then(res => {
          if (res && res.success && res.data) {
            if (res.data.user_info) {
              setUserInfo(res.data.user_info);
            }
            const savedMatrix = res.data.matrix_config || {};
            // Initialize matrix with defaults for missing keys
            const initialMatrix: MatrixState = {};
            DEFAULT_EVENTS.forEach(evt => {
              initialMatrix[evt.key] = savedMatrix[evt.key] || {
                master: true,
                zalo: true,
                telegram: true,
                email: true,
              };
            });
            setMatrix(initialMatrix);
          }
        })
        .catch(err => {
          console.error("Error loading notification settings:", err);
          showToast("Không thể tải cài đặt thông báo", "error");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleMasterToggle = (eventKey: string) => {
    setMatrix(prev => {
      const current = prev[eventKey] || { master: true, zalo: true, telegram: true, email: true };
      const nextMaster = !current.master;
      return {
        ...prev,
        [eventKey]: {
          ...current,
          master: nextMaster,
          // If turning ON master, make sure at least one available channel is enabled
          zalo: nextMaster ? (userInfo.has_zalo ? true : false) : false,
          telegram: nextMaster ? (userInfo.has_telegram ? true : false) : false,
          email: nextMaster ? true : false,
        }
      };
    });
  };

  const handleChannelToggle = (eventKey: string, channel: 'zalo' | 'telegram' | 'email') => {
    const evtCfg = matrix[eventKey] || { master: true, zalo: true, telegram: true, email: true };

    if (!evtCfg.master) {
      showToast("Vui lòng bật Công tắc Nguồn trước khi tùy chỉnh từng kênh!", "warning");
      return;
    }

    // Account Linking Guards
    if (channel === 'zalo' && !userInfo.has_zalo) {
      showToast("Tài khoản của bạn chưa liên kết Zalo Bot! Vui lòng kết nối Zalo ở phía trên trước.", "warning");
      return;
    }
    if (channel === 'telegram' && !userInfo.has_telegram) {
      showToast("Tài khoản của bạn chưa liên kết Telegram Bot! Vui lòng kết nối Telegram ở phía trên trước.", "warning");
      return;
    }

    const nextVal = !evtCfg[channel];

    // Check minimum 1 channel constraint when master is ON
    if (!nextVal) {
      const activeChannels = ['zalo', 'telegram', 'email'].filter(c => c !== channel && evtCfg[c as keyof EventConfig]);
      if (activeChannels.length === 0) {
        showToast("Bắt buộc giữ ít nhất 1 kênh nhận tin khi đang bật sự kiện này! (Hoặc gạt TẮT Nguồn tổng nếu không muốn nhận nữa)", "warning");
        return;
      }
    }

    setMatrix(prev => ({
      ...prev,
      [eventKey]: {
        ...evtCfg,
        [channel]: nextVal
      }
    }));
  };

  const handleSave = () => {
    setSaving(true);
    fetchAPI('update_notification_settings', {
      method: 'POST',
      body: JSON.stringify({ matrix_config: matrix })
    })
      .then(res => {
        if (res && res.success) {
          showToast("Đã lưu ma trận cấu hình thông báo thành công!", "success");
          setTimeout(() => onClose(), 1000);
        } else {
          showToast(res?.message || "Lỗi lưu cài đặt", "error");
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
      title="Cấu Hình Thông Báo Hệ Thống (Matrix Multi-Channel Control)"
      width={900}
    >
      <div className="space-y-6 text-slate-800">

        {/* Toast alert */}
        {toastMessage && (
          <div className={`p-3 rounded-xl flex items-center gap-3 text-sm font-medium animate-fadeIn ${
            toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
            toastMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
            'bg-amber-50 text-amber-900 border border-amber-200'
          }`}>
            {toastMessage.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Account Linking Status Header Bar */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg border border-slate-800">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-100">Trạng Thái Kết Nối Kênh Thông Báo Cá Nhân</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Zalo Status */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">Z</div>
                <div>
                  <div className="font-semibold text-slate-200">Zalo Bot</div>
                  <div className={userInfo.has_zalo ? "text-emerald-400 font-medium" : "text-slate-400"}>
                    {userInfo.has_zalo ? "Đã liên kết" : "Chưa liên kết"}
                  </div>
                </div>
              </div>
              {!userInfo.has_zalo && (
                <a
                  href="/settings?tab=integrations"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-1 transition"
                >
                  Kết nối <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Telegram Status */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Telegram Bot</div>
                  <div className={userInfo.has_telegram ? "text-emerald-400 font-medium" : "text-slate-400"}>
                    {userInfo.has_telegram ? "Đã liên kết" : "Chưa liên kết"}
                  </div>
                </div>
              </div>
              {!userInfo.has_telegram && (
                <a
                  href="/settings?tab=integrations"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium flex items-center gap-1 transition"
                >
                  Kết nối <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Email Status */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Email SMTP</div>
                  <div className="text-emerald-400 font-medium truncate max-w-[120px]">
                    {userInfo.email || "Đã sẵn sàng"}
                  </div>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
          </div>
        </div>

        {/* Matrix Grid Control Table */}
        {loading ? (
          <div className="p-12 text-center text-slate-400">Đang tải cấu hình ma trận thông báo...</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 min-w-[240px]">Sự Kiện Thông Báo Hệ Thống</th>
                    <th className="py-3.5 px-3 text-center w-[110px]">Nguồn Tổng</th>
                    <th className="py-3.5 px-3 text-center w-[110px] text-blue-600">Zalo Bot</th>
                    <th className="py-3.5 px-3 text-center w-[110px] text-sky-600">Telegram</th>
                    <th className="py-3.5 px-3 text-center w-[110px] text-rose-600">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {DEFAULT_EVENTS.map(evt => {
                    const cfg = matrix[evt.key] || { master: true, zalo: true, telegram: true, email: true };
                    return (
                      <tr key={evt.key} className={`transition hover:bg-slate-50/80 ${!cfg.master ? 'bg-slate-50/50 opacity-60' : ''}`}>
                        {/* Event Name & Description */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            <span className="text-xl leading-none mt-0.5">{evt.icon}</span>
                            <div>
                              <div className="font-semibold text-slate-900">{evt.name}</div>
                              <div className="text-xs text-slate-500 leading-snug mt-0.5">{evt.desc}</div>
                            </div>
                          </div>
                        </td>

                        {/* Master Switch Toggle */}
                        <td className="py-3.5 px-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => handleMasterToggle(evt.key)}
                            className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out mx-auto ${
                              cfg.master ? 'bg-slate-900' : 'bg-slate-300'
                            }`}
                          >
                            <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                              cfg.master ? 'translate-x-5.5' : 'translate-x-0'
                            }`}>
                              <Power className={`w-2.5 h-2.5 ${cfg.master ? 'text-slate-900' : 'text-slate-400'}`} />
                            </div>
                          </button>
                        </td>

                        {/* Zalo Channel Toggle */}
                        <td className="py-3.5 px-3 text-center align-middle">
                          <button
                            type="button"
                            disabled={!cfg.master}
                            onClick={() => handleChannelToggle(evt.key, 'zalo')}
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

                        {/* Telegram Channel Toggle */}
                        <td className="py-3.5 px-3 text-center align-middle">
                          <button
                            type="button"
                            disabled={!cfg.master}
                            onClick={() => handleChannelToggle(evt.key, 'telegram')}
                            className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out mx-auto ${
                              !cfg.master ? 'bg-slate-200 cursor-not-allowed' :
                              cfg.telegram && userInfo.has_telegram ? 'bg-sky-500' : 'bg-slate-300'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                              cfg.telegram && userInfo.has_telegram ? 'translate-x-5 text-sky-500' : 'translate-x-0 text-slate-400'
                            }`}>
                              <Send className="w-2.5 h-2.5" />
                            </div>
                          </button>
                        </td>

                        {/* Email Channel Toggle */}
                        <td className="py-3.5 px-3 text-center align-middle">
                          <button
                            type="button"
                            disabled={!cfg.master}
                            onClick={() => handleChannelToggle(evt.key, 'email')}
                            className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out mx-auto ${
                              !cfg.master ? 'bg-slate-200 cursor-not-allowed' :
                              cfg.email ? 'bg-rose-500' : 'bg-slate-300'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                              cfg.email ? 'translate-x-5 text-rose-500' : 'translate-x-0 text-slate-400'
                            }`}>
                              <Mail className="w-2.5 h-2.5" />
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

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            💡 <strong>Mẹo:</strong> Chuông In-App hệ thống luôn duy trì nhận tin để đảm bảo không bỏ lỡ lịch sử hoạt động.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? "Đang lưu..." : "Lưu Cấu Hình Ma Trận"}
            </button>
          </div>
        </div>

      </div>
    </CustomModal>
  );
};
