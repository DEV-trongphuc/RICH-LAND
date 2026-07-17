import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { Link2, Save, Check, X, AlertCircle, RefreshCw, Code, CheckCircle, Info, ShieldAlert, ArrowRight, Search, Calendar, FileText, MessageCircle, Eye, Zap } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { Skeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useUIStore } from '../store/uiStore';

interface CapiLog {
  id: number;
  event_name: string;
  sent_payload: string;
  response_status: number;
  response_body: string;
  sent_at: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

export default function CapiPage() {
  const { user } = useAuth();
  const { addToast } = useUIStore();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [logs, setLogs] = useState<CapiLog[]>([]);
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  
  // Mapping triggers and status list
  const [capiEventTriggers, setCapiEventTriggers] = useState<Record<string, string>>({});
  const [pipelineStatuses, setPipelineStatuses] = useState<string[]>([]);
  const [pipelineStatusLabels, setPipelineStatusLabels] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debug payload viewer modal
  const [viewPayload, setViewPayload] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resSettings, resLogs] = await Promise.all([
        fetchAPI('capi/settings'),
        fetchAPI('capi/logs')
      ]);

      if (resSettings.success) {
        setPixelId(resSettings.data?.meta_pixel_id || '');
        setAccessToken(resSettings.data?.meta_access_token || '');
        setCapiEventTriggers(resSettings.data?.capi_event_triggers || {});
        setPipelineStatuses(resSettings.data?.pipeline_statuses || []);
        setPipelineStatusLabels(resSettings.data?.pipeline_status_labels || {});
      }
      if (resLogs.success) {
        setLogs(resLogs.data || []);
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi tải dữ liệu CAPI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchAPI('capi/settings', {
        method: 'POST',
        body: JSON.stringify({
          meta_pixel_id: pixelId,
          meta_access_token: accessToken,
          capi_event_triggers: capiEventTriggers
        })
      });

      if (res.success) {
        addToast('Cấu hình Meta Conversion API thành công!', 'success');
        setSuccess('Cấu hình Meta Conversion API thành công!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        addToast(res.message || 'Lỗi lưu cấu hình', 'error');
        setError(res.message || 'Lỗi lưu cấu hình');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
      setError(e.message || 'Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  const capiEventOptions = [
    { value: 'Skip', label: 'Không gửi (Skip)', icon: <X size={14} style={{ color: 'var(--color-text-muted)' }} /> },
    { value: 'Lead', label: 'Lead (Khách tiềm năng)', icon: <Search size={14} style={{ color: '#3b82f6' }} /> },
    { value: 'Schedule', label: 'Schedule (Hẹn gặp)', icon: <Calendar size={14} style={{ color: '#10b981' }} /> },
    { value: 'CompleteRegistration', label: 'CompleteRegistration', icon: <CheckCircle size={14} style={{ color: '#f59e0b' }} /> },
    { value: 'SubmitApplication', label: 'SubmitApplication', icon: <FileText size={14} style={{ color: '#6366f1' }} /> },
    { value: 'Contact', label: 'Contact (Liên hệ)', icon: <MessageCircle size={14} style={{ color: '#ec4899' }} /> },
    { value: 'ViewContent', label: 'ViewContent (Xem hàng)', icon: <Eye size={14} style={{ color: '#8b5cf6' }} /> },
    { value: 'Purchase', label: 'Purchase (Đặt cọc)', icon: <Zap size={14} style={{ color: 'var(--color-primary)' }} /> }
  ];

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 />
            Tích Hợp Meta Conversion API (CAPI)
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
              title="Xem hướng dẫn quy tắc Conversion API"
            >
              <Info size={12} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Giải thích cơ chế</span>
            </button>
          </h1>
          <p className="page-subtitle">
            Cấu hình Pixel ID và Access Token, giám sát nhật ký các sự kiện đẩy ngược về Facebook Ads
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn"
          style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Tải lại trang"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isLargeScreen ? '1fr 2fr' : '1fr', gap: '1.5rem' }}>
        {/* Settings Form */}
        <div className="card" style={{ padding: '1.5rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Cấu hình CAPI</h3>
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Meta Pixel ID</label>
              <input
                type="text"
                placeholder="VD: 1234567890"
                value={pixelId}
                onChange={e => setPixelId(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">System Access Token</label>
              <textarea
                placeholder="EAAG..."
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                className="form-input font-mono"
                style={{ height: '144px', resize: 'none' }}
              />
            </div>
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code size={16} style={{ color: 'var(--color-primary)' }} />
                Ánh xạ Trạng thái & Sự kiện Meta CAPI
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
                Chỉ định sự kiện Standard Meta CAPI tương ứng sẽ tự động kích hoạt khi khách hàng chuyển sang từng trạng thái phễu.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--color-border-light)', borderRadius: '8px', padding: '0.75rem', background: 'rgba(0, 0, 0, 0.01)' }}>
                {pipelineStatuses.map(status => (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {pipelineStatusLabels[status] || status}
                    </span>
                    <CustomSelect
                      options={capiEventOptions}
                      value={capiEventTriggers[status] || 'Skip'}
                      onChange={val => setCapiEventTriggers(prev => ({ ...prev, [status]: val }))}
                      width="185px"
                      placeholder="Chọn sự kiện..."
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn primary"
              style={{ marginTop: '0.75rem', alignSelf: 'flex-start' }}
            >
              <Save size={16} />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </form>
        </div>

        {/* Logs Table */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Nhật ký sự kiện gửi đi (CAPI Logs)
            </h3>
            {loading ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 650, textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
                      <th style={{ padding: '0.5rem 0', textAlign: 'left' }}>Sự kiện</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'left' }}>Khách hàng</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Mã HTTP</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Payload</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Múi giờ gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '0.75rem 0' }}><Skeleton width="60%" height={12} /></td>
                        <td style={{ padding: '0.75rem 0' }}><Skeleton width="80%" height={12} /></td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'center' }}><Skeleton width="40px" height={16} style={{ margin: '0 auto' }} /></td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'center' }}><Skeleton width="30px" height={16} style={{ margin: '0 auto' }} /></td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right' }}><Skeleton width="50%" height={12} style={{ marginLeft: 'auto' }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
                Chưa có sự kiện nào được bắn về Meta
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 650, textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
                      <th style={{ padding: '0.5rem 0', textAlign: 'left' }}>Sự kiện</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'left' }}>Khách hàng</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Mã HTTP</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Payload</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Múi giờ gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '0.75rem 0', fontWeight: 700, textAlign: 'left' }}>
                          {l.event_name}
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'left' }}>
                          {l.first_name ? `${l.last_name} ${l.first_name}` : 'Raw Lead'}
                          {l.phone && <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)' }}>{l.phone}</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>
                          <span
                            className="font-mono font-bold"
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              background: l.response_status === 200 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: l.response_status === 200 ? 'var(--color-success)' : 'var(--color-danger)',
                              border: l.response_status === 200 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                            }}
                          >
                            {l.response_status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>
                          <button
                            onClick={() => setViewPayload(l.sent_payload)}
                            className="btn sm"
                            style={{ padding: '2px 6px', height: '24px' }}
                          >
                            <Code size={12} />
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--color-text-light)', fontFamily: 'monospace' }}>
                          {new Date(l.sent_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payload Viewer Modal */}
      {viewPayload && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'scaleUp 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code size={20} /> Chi tiết payload JSON
              </h2>
              <button onClick={() => setViewPayload(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center' }}>
                <X size={20} />
              </button>
            </div>
            <pre style={{ padding: '1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', maxHeight: '380px', overflow: 'auto', fontSize: '0.75rem', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
              {JSON.stringify(JSON.parse(viewPayload), null, 2)}
            </pre>
          </div>
        </div>
      )}
      {/* Explanation of CAPI rules */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Hướng dẫn Cơ chế Facebook Conversion API (CAPI)"
        width="760px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.875rem 1rem', 
            background: 'rgba(189, 29, 45, 0.04)', 
            border: '1px solid rgba(189, 29, 45, 0.15)', 
            borderRadius: 12 
          }}>
            <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              Hệ thống kết nối trực tiếp máy chủ Rich Land với Meta (Facebook) để báo cáo kết quả bán hàng từ CRM. Giúp phòng Marketing đo lường quảng cáo chính xác hơn, tránh bị chặn theo dõi bởi các ứng dụng chặn quảng cáo hoặc tính năng bảo mật trên điện thoại iPhone (iOS).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Event types */}
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
              <CheckCircle size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  1. Các loại sự kiện gửi về Facebook (Events)
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                  • <strong>Thiết lập linh hoạt</strong>: Bạn có thể tự do ánh xạ bất kỳ trạng thái phễu nào của CRM với các sự kiện Standard của Meta (hoặc chọn 'Không gửi') ngay tại bảng điều khiển cấu hình bên cạnh.<br />
                  • <strong>Lead (Khách tiềm năng)</strong>: Báo về Facebook khi hệ thống nhận diện được nhu cầu khách hàng.<br />
                  • <strong>Schedule (Đặt lịch hẹn)</strong>: Báo về Facebook khi nhân viên sale đặt lịch hẹn gặp khách hàng thành công.<br />
                  • <strong>Purchase (Mua hàng)</strong>: Báo về Facebook khi khách hàng ký kết hợp đồng đặt cọc thành công.
                </p>
              </div>
            </div>

            {/* Forward only rule */}
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
              <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  2. Nguyên tắc Bắn một chiều (Forward-only Signals)
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Khi giao dịch bị hủy (bể cọc), hệ thống <strong>tuyệt đối không gửi lệnh hủy hay hạ cấp</strong> về cho Facebook. Tín hiệu chỉ gửi đi một chiều. Điều này nhằm giữ cho trí tuệ nhân tạo (AI) của Facebook học tập chính xác chân dung khách hàng có khả năng chi trả thật, tránh làm nhiễu loạn mục tiêu chạy quảng cáo của công ty.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>Đồng ý</button>
        </div>
      </CustomModal>
    </div>
  );
}
