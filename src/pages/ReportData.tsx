import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Send, Loader2, User, Phone, Zap, Building2, Calendar, Shield, XCircle } from 'lucide-react';
import { fetchPublicAPI } from '../utils/api';

const REPORT_REASONS = [
  'Sai số điện thoại / Số ảo',
  'Thuê bao / Không liên lạc được',
  'Trùng của tôi (Trùng Sale)',
  'Trùng của người khác (Sale khác đã chăm)',
  'Spam / Không có nhu cầu',
  'Khác (Vui lòng ghi rõ ở phần ghi chú)'
];

interface ReportContext {
  lead_name: string;
  lead_phone: string;
  lead_source: string;
  lead_note: string;
  consultant_name: string;
  consultant_email: string;
  round_name: string;
  assigned_at: string;
  existing_report: string | null;
}

export const ReportData = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Capture params before clearing URL
  const [params] = useState({
    leadId: searchParams.get('lead_id') || '',
    saleId: searchParams.get('sale_id') || '',
    roundId: searchParams.get('round_id') || '',
  });

  const [context, setContext] = useState<ReportContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [ctxError, setCtxError] = useState('');

  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const { leadId, saleId, roundId } = params;

    // Clear URL params immediately to prevent re-use / sharing
    navigate('/report-data', { replace: true });

    if (!leadId || !saleId || !roundId) {
      setCtxError('Đường dẫn không hợp lệ. Vui lòng truy cập lại từ Email của bạn.');
      setLoadingCtx(false);
      return;
    }

    // Load and verify context from backend
    fetchPublicAPI(`get_report_context&lead_id=${leadId}&sale_id=${saleId}&round_id=${roundId}`)
      .then(res => {
        if (res.success) {
          setContext(res.data);
        } else {
          setCtxError(res.message || 'Không thể xác thực thông tin. Vui lòng thử lại từ email.');
        }
      })
      .catch(e => setCtxError(e.message || 'Lỗi kết nối máy chủ.'))
      .finally(() => setLoadingCtx(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submitStatus === 'success') return;

    setSubmitting(true);
    setSubmitError('');

    const finalReason = reason === 'Khác (Vui lòng ghi rõ ở phần ghi chú)'
      ? `Khác: ${customReason}`
      : reason;

    try {
      const res = await fetchPublicAPI('submit_report', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: Number(params.leadId),
          sale_id: Number(params.saleId),
          round_id: Number(params.roundId),
          reason: finalReason
        })
      });

      if (res.success) {
        setSubmitStatus('success');
      } else {
        setSubmitStatus('error');
        setSubmitError(res.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } catch (err: any) {
      setSubmitStatus('error');
      setSubmitError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loadingCtx) {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <Loader2 size={40} className="spin" style={{ color: '#8b5cf6', margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b', fontWeight: 500 }}>Đang xác thực thông tin...</p>
        </div>
        <SpinStyle />
      </PageShell>
    );
  }

  // ─── Context error ──────────────────────────────────────────────────────────
  if (ctxError) {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#fca5a5,#f87171)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 8px 24px rgba(239,68,68,0.3)' }}>
            <XCircle size={36} color="white" />
          </div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Đường dẫn không hợp lệ</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>{ctxError}</p>
        </div>
      </PageShell>
    );
  }

  // ─── Already reported ───────────────────────────────────────────────────────
  if (context?.existing_report === 'pending') {
    return (
      <PageShell context={context}>
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#fde68a,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(245,158,11,0.3)' }}>
            <Shield size={30} color="white" />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Đã gửi báo cáo trước đó</h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>Báo cáo của bạn đang chờ Admin xét duyệt. Bạn sẽ được đền bù nếu báo cáo hợp lệ.</p>
        </div>
      </PageShell>
    );
  }

  if (context?.existing_report === 'approved') {
    return (
      <PageShell context={context}>
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#6ee7b7,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}>
            <CheckCircle size={30} color="white" />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Báo cáo đã được duyệt ✅</h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>Admin đã duyệt báo cáo này. Bạn sẽ được ưu tiên nhận Data bù trong lượt tiếp theo.</p>
        </div>
      </PageShell>
    );
  }

  // ─── Success state ──────────────────────────────────────────────────────────
  if (submitStatus === 'success') {
    return (
      <PageShell context={context}>
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#6ee7b7,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}>
            <CheckCircle size={36} color="white" />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Gửi Báo Cáo Thành Công!</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.7, maxWidth: 340, margin: '0 auto' }}>
            Báo cáo của bạn đã được gửi tới Admin. Nếu hợp lệ, bạn sẽ được nhận Data bù ưu tiên trong lượt tiếp theo.
          </p>
        </div>
      </PageShell>
    );
  }

  // ─── Main form ──────────────────────────────────────────────────────────────
  return (
    <PageShell context={context}>
      {submitStatus === 'error' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Chọn lý do lỗi
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REPORT_REASONS.map(r => (
              <label key={r} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px',
                border: '1.5px solid', borderColor: reason === r ? '#8b5cf6' : '#e2e8f0',
                background: reason === r ? 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(124,58,237,0.1))' : 'white',
                borderRadius: 10, cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                transition: 'all 0.15s ease',
                boxShadow: reason === r ? '0 2px 8px rgba(139,92,246,0.15)' : 'none'
              }}>
                <input type="radio" name="reason" value={r} checked={reason === r}
                  onChange={() => setReason(r)} disabled={submitting}
                  style={{ width: 16, height: 16, accentColor: '#8b5cf6' }} />
                <span style={{ fontSize: '0.875rem', color: reason === r ? '#5b21b6' : '#475569', fontWeight: reason === r ? 600 : 400 }}>{r}</span>
              </label>
            ))}
          </div>
        </div>

        {reason === 'Khác (Vui lòng ghi rõ ở phần ghi chú)' && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Chi tiết lý do
            </label>
            <textarea required value={customReason} onChange={e => setCustomReason(e.target.value)}
              disabled={submitting} placeholder="Nhập chi tiết lý do tại đây..."
              style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.9rem', minHeight: 90, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        )}

        <button type="submit" disabled={submitting}
          style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', padding: '13px', borderRadius: 12, border: 'none', fontSize: '0.975rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(109,40,217,0.4)', opacity: submitting ? 0.7 : 1, transition: 'all 0.2s' }}>
          {submitting
            ? <><Loader2 size={18} className="spin" /> Đang gửi...</>
            : <><Send size={18} /> Gửi Báo Cáo</>}
        </button>
      </form>
      <SpinStyle />
    </PageShell>
  );
};

// ─── Shared shell ─────────────────────────────────────────────────────────────
const PageShell = ({ children, context }: { children: React.ReactNode; context?: ReportContext | null }) => (
  <div style={{
    position: 'fixed', inset: 0, overflowY: 'auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1e1246 0%, #2d1b69 40%, #0f172a 100%)',
    padding: '24px 16px',
  }}>
    {/* Background decorations */}
    <div style={{ position: 'absolute', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(139,92,246,0.12)', filter: 'blur(60px)', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', bottom: -100, right: -60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(236,72,153,0.1)', filter: 'blur(60px)', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', top: '40%', right: '10%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(16,185,129,0.07)', filter: 'blur(40px)', pointerEvents: 'none' }} />

    <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, marginBottom: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 600 }}>Báo cáo Data lỗi</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
          Yêu cầu đền bù Data
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem', marginTop: 6 }}>
          Gửi báo cáo nếu thông tin khách hàng không chính xác
        </p>
      </div>

      {/* Context card */}
      {context && (
        <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Thông tin Data cần báo cáo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <InfoRow icon={<User size={13} />} label="Khách hàng" value={context.lead_name || 'Ẩn danh'} highlight />
            <InfoRow icon={<Phone size={13} />} label="Số điện thoại" value={context.lead_phone || 'Không có'} />
            <InfoRow icon={<Building2 size={13} />} label="Nguồn" value={context.lead_source || 'Không rõ'} />
            <InfoRow icon={<Zap size={13} />} label="Vòng phân bổ" value={context.round_name} highlight />
            <InfoRow icon={<User size={13} />} label="Sale phụ trách" value={context.consultant_name} />
            <InfoRow icon={<Calendar size={13} />} label="Nhận lúc" value={context.assigned_at ? new Date(context.assigned_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'} />
          </div>
        </div>
      )}

      {/* Form card */}
      <div style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', borderRadius: 20, padding: '28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)' }}>
        {children}
      </div>

      {/* Footer */}
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginTop: 20 }}>
        Powered by DOMATION · Hệ thống phân bổ data tự động
      </p>
    </div>
  </div>
);

const InfoRow = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>
      {icon}
      <span style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
    <div style={{ fontSize: '0.875rem', fontWeight: highlight ? 700 : 500, color: highlight ? '#c4b5fd' : 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>
      {value}
    </div>
  </div>
);

const SpinStyle = () => (
  <style>{`
    .spin { animation: spin 1s linear infinite; display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `}</style>
);
