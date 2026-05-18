import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Send, Loader2 } from 'lucide-react';
import { fetchPublicAPI } from '../utils/api';

const REPORT_REASONS = [
  'Sai số điện thoại / Số ảo',
  'Thuê bao / Không liên lạc được',
  'Trùng của tôi (Trùng Sale)',
  'Trùng của người khác (Sale khác đã chăm)',
  'Spam / Không có nhu cầu',
  'Khác (Vui lòng ghi rõ ở phần ghi chú)'
];

export const ReportData = () => {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const saleId = searchParams.get('sale_id');
  const roundId = searchParams.get('round_id');

  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-validate URL params on mount
  useEffect(() => {
    if (!leadId || !saleId || !roundId) {
      setStatus('error');
      setErrorMessage('Đường dẫn không hợp lệ. Vui lòng truy cập lại từ Email của bạn.');
    }
  }, [leadId, saleId, roundId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'error') return;
    
    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    const finalReason = reason === 'Khác (Vui lòng ghi rõ ở phần ghi chú)' 
      ? `Khác: ${customReason}` 
      : reason;

    try {
      const res = await fetchPublicAPI('submit_report', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: Number(leadId),
          sale_id: Number(saleId),
          round_id: Number(roundId),
          reason: finalReason
        })
      });

      if (res.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(res.message || 'Có lỗi xảy ra, vui lòng thử lại sau.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20 }}>
      <div style={{ background: 'white', padding: 40, borderRadius: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.05)', maxWidth: 480, width: '100%' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ background: '#fef2f2', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#ef4444' }}>
            <AlertCircle size={32} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Báo Cáo Data Lỗi</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Gửi yêu cầu kiểm tra và đền bù Data nếu thông tin khách hàng bị sai lệch.</p>
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ color: '#10b981', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <CheckCircle size={48} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Gửi Báo Cáo Thành Công!</h3>
            <p style={{ color: '#64748b', margin: 0, lineHeight: 1.6 }}>Báo cáo của bạn đã được gửi cho Quản trị viên duyệt. Nếu hợp lệ, bạn sẽ được nhận Data bù vào lượt tiếp theo một cách ưu tiên nhất.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            
            {status === 'error' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '12px 16px', borderRadius: 12, marginBottom: 24, fontSize: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Vui lòng chọn lý do lỗi</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {REPORT_REASONS.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid', borderColor: reason === r ? '#8b5cf6' : '#e2e8f0', background: reason === r ? '#f5f3ff' : 'white', borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.2s ease' }}>
                    <input 
                      type="radio" 
                      name="reason"
                      value={r} 
                      checked={reason === r} 
                      onChange={() => setReason(r)}
                      disabled={loading}
                      style={{ width: 18, height: 18, accentColor: '#8b5cf6' }}
                    />
                    <span style={{ fontSize: '0.95rem', color: reason === r ? '#4c1d95' : '#475569', fontWeight: reason === r ? 600 : 400 }}>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            {reason === 'Khác (Vui lòng ghi rõ ở phần ghi chú)' && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Chi tiết lý do khác</label>
                <textarea 
                  required
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  disabled={loading}
                  placeholder="Nhập chi tiết lý do tại đây..."
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: '0.95rem', minHeight: 100, outline: 'none', resize: 'vertical', opacity: loading ? 0.6 : 1 }}
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || (status === 'error' && !leadId)}
              style={{ width: '100%', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', padding: '14px', borderRadius: 12, border: 'none', fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}
            >
              {loading ? (
                <><Loader2 size={20} className="spin" /> Đang xử lý...</>
              ) : (
                <><Send size={20} /> Gửi Báo Cáo Lỗi</>
              )}
            </button>
          </form>
        )}
      </div>
      
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
