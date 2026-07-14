import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { Link2, Save, Check, X, AlertCircle, RefreshCw, Code, CheckCircle, Info, ShieldAlert, ArrowRight } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';

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
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [logs, setLogs] = useState<CapiLog[]>([]);
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
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
          meta_access_token: accessToken
        })
      });

      if (res.success) {
        setSuccess('Cấu hình Meta Conversion API thành công!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(res.message || 'Lỗi lưu cấu hình');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    } finally {
      setSaving(false);
    }
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
            <button
              type="submit"
              disabled={saving}
              className="btn primary"
              style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
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
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>Đang tải nhật ký...</div>
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
              Hệ thống Conversion API (CAPI) kết nối trực tiếp máy chủ CRM với Meta Events Manager, giúp ghi nhận dữ liệu chính xác tuyệt đối mà không bị ảnh hưởng bởi trình chặn quảng cáo (AdBlock) hay cơ chế hạn chế cookies của iOS.
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
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  • <strong>Lead (Nhận số)</strong>: Bắn đi ngay khi lead được chia thành công cho Sale.<br />
                  • <strong>Schedule (Đặt lịch hẹn)</strong>: Bắn đi khi có hoạt động hẹn gặp khách hàng phát sinh.<br />
                  • <strong>Purchase (Mua hàng)</strong>: Bắn đi khi đợt thanh toán cọc đầu tiên của deal được duyệt.
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
                  Tuyệt đối <strong>không bắn lùi tín hiệu</strong> (không gửi sự kiện hoàn trả, giảm cấp hoặc hủy) về Meta khi deal/cọc bị bể hoặc tụt trạng thái. Tín hiệu chỉ đi một chiều (Forward-only) để bảo đảm độ chính xác cho AI học máy của Facebook Ads tối ưu chiến dịch.
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
