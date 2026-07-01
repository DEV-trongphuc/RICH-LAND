import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { Link2, Save, Check, X, AlertCircle, RefreshCw, Code, CheckCircle } from 'lucide-react';

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
  const [logs, setLogs] = useState<CapiLog[]>([]);
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="lg:grid-cols-3">
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
        <div className="card lg:col-span-2" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
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
                <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
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
    </div>
  );
}
