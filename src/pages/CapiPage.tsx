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
    <div className="container mx-auto p-6 space-y-6" style={{ color: 'var(--color-text)' }}>
      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="ml-auto" onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg">
          <Check size={20} />
          <span>{success}</span>
          <button className="ml-auto" onClick={() => setSuccess('')}><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
            <Link2 />
            Tích Hợp Meta Conversion API (CAPI)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cấu hình Pixel ID và Access Token, giám sát nhật ký các sự kiện đẩy ngược về Facebook Ads
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          title="Tải lại trang"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="p-6 rounded-xl border border-gray-800 bg-black/40 backdrop-blur-md shadow-2xl space-y-4">
          <h3 className="font-extrabold text-lg border-b border-gray-800/80 pb-2">Cấu hình CAPI</h3>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Meta Pixel ID</label>
              <input
                type="text"
                placeholder="VD: 1234567890"
                value={pixelId}
                onChange={e => setPixelId(e.target.value)}
                className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">System Access Token</label>
              <textarea
                placeholder="EAAG..."
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-sm h-36 resize-none focus:border-primary focus:outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 bg-primary hover:opacity-90 font-bold rounded-lg text-white flex items-center justify-center gap-1.5 transition-opacity"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Save size={16} />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </form>
        </div>

        {/* Logs Table */}
        <div className="lg:col-span-2 p-6 rounded-xl border border-gray-800 bg-black/40 backdrop-blur-md shadow-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-lg border-b border-gray-800/80 pb-2 mb-4">Nhật ký sự kiện gửi đi (CAPI Logs)</h3>
            {loading ? (
              <div className="text-center py-12 text-gray-400">Đang tải nhật ký...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-lg">
                Chưa có sự kiện nào được bắn về Meta
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 uppercase font-black tracking-wider">
                      <th className="py-2">Sự kiện</th>
                      <th className="py-2">Khách hàng</th>
                      <th className="py-2 text-center">Mã HTTP</th>
                      <th className="py-2 text-center">Payload</th>
                      <th className="py-2 text-right">Múi giờ gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                        <td className="py-2.5 font-bold text-gray-200">
                          {l.event_name}
                        </td>
                        <td className="py-2.5">
                          {l.first_name ? `${l.last_name} ${l.first_name}` : 'Raw Lead'}
                          {l.phone && <span className="block text-[10px] text-gray-500">{l.phone}</span>}
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                              l.response_status === 200
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                            }`}
                          >
                            {l.response_status}
                          </span>
                        </td>
                        <td className="py-2.5 text-center">
                          <button
                            onClick={() => setViewPayload(l.sent_payload)}
                            className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
                          >
                            <Code size={12} />
                          </button>
                        </td>
                        <td className="py-2.5 text-right text-gray-400 font-mono">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h2 className="text-xl font-bold flex items-center gap-1.5">
                <Code size={20} /> Chi tiết payload JSON
              </h2>
              <button onClick={() => setViewPayload(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <pre className="p-4 bg-black/50 border border-gray-800 rounded-lg max-h-96 overflow-auto text-xs text-emerald-400 font-mono resize-none">
              {JSON.stringify(JSON.parse(viewPayload), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
