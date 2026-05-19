import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Send, Loader2, Shield, XCircle } from 'lucide-react';
import { fetchPublicAPI } from '../utils/api';

const REPORT_REASONS = [
  'Sai số điện thoại / Số ảo',
  'Trùng của tôi (Trùng Sale)',
  'Trùng của người khác (Sale khác đã chăm)',
  'Spam ảo / Junk lead',
  'Khác (Vui lòng ghi rõ ở phần ghi chú)'
];

const TEST_MOCK_CONTEXT = {
  lead_name: 'Trần Thị Mai Anh',
  lead_phone: '0912 345 678',
  lead_source: 'Facebook Ads — Chiến dịch Tuyển sinh T5/2026',
  lead_note: 'Quan tâm: Khóa Marketing Online\nNgân sách: 5–10 triệu',
  consultant_name: 'Bạn (Tài khoản Test)',
  consultant_email: 'test@example.com',
  round_name: 'Vòng A — Facebook Inbound',
  assigned_at: new Date().toISOString(),
  existing_report: null as string | null,
};

// Color hash for avatars
const AVATAR_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#14b8a6'];
const getColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const initials = (name: string) => name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();

interface ReportContext {
  lead_name: string; lead_phone: string; lead_source: string; lead_note: string;
  consultant_name: string; consultant_email: string; round_name: string;
  assigned_at: string; existing_report: string | null;
}

export const ReportData = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [params] = useState({
    leadId: searchParams.get('lead_id') || '',
    saleId: searchParams.get('sale_id') || '',
    roundId: searchParams.get('round_id') || '',
    isTest: searchParams.get('test') === '1',
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
    navigate('/report-data', { replace: true });
    if (params.isTest) { setContext(TEST_MOCK_CONTEXT); setLoadingCtx(false); return; }
    // BUG-07 fix: Kiểm tra params phải là số nguyên dương hợp lệ, không chỉ "có tồn tại"
    const isValidId = (v: string) => /^\d+$/.test(v) && parseInt(v) > 0;
    if (!isValidId(params.leadId) || !isValidId(params.saleId) || !isValidId(params.roundId)) {
      setCtxError('Đường dẫn không hợp lệ hoặc đã hết hạn. Vui lòng mở lại từ Email.');
      setLoadingCtx(false); return;
    }
    fetchPublicAPI(`get_report_context&lead_id=${params.leadId}&sale_id=${params.saleId}&round_id=${params.roundId}`)
      .then(res => { if (res.success) setContext(res.data); else setCtxError(res.message || 'Không thể xác thực.'); })
      .catch(e => setCtxError(e.message || 'Lỗi kết nối.'))
      .finally(() => setLoadingCtx(false));
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (params.isTest) { setSubmitError('Đây là link thử nghiệm — không thể gửi báo cáo thật.'); setSubmitStatus('error'); return; }
    if (submitting || submitStatus === 'success') return;
    setSubmitting(true); setSubmitError('');
    const finalReason = reason === 'Khác (Vui lòng ghi rõ ở phần ghi chú)' ? `Khác: ${customReason}` : reason;
    try {
      const res = await fetchPublicAPI('submit_report', {
        method: 'POST',
        body: JSON.stringify({ lead_id: Number(params.leadId), sale_id: Number(params.saleId), round_id: Number(params.roundId), reason: finalReason })
      });
      if (res.success) setSubmitStatus('success');
      else { setSubmitStatus('error'); setSubmitError(res.message || 'Có lỗi xảy ra.'); }
    } catch (err: any) { setSubmitStatus('error'); setSubmitError(err.message || 'Lỗi kết nối.'); }
    finally { setSubmitting(false); }
  };

  // ── Full-screen wrapper ──────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%', height: '100vh',
      background: 'linear-gradient(135deg, #1e1246 0%, #2d1b69 40%, #0f172a 100%)',
      display: 'flex', flexDirection: 'column', position: 'relative',
      overflow: 'hidden !important'
    }}>
      {/* Blobs */}
      <div style={{ position: 'absolute', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(139,92,246,0.12)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(236,72,153,0.1)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, minHeight: '20px' }} /> {/* Safe top spacer */}

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 900, margin: '0 auto', zIndex: 1, position: 'relative' }}>
        {/* ── Header strip ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 24, flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', padding: '5px 14px', borderRadius: 20, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', fontWeight: 600 }}>
              BÁO CÁO DATA{params.isTest ? ' (Thử nghiệm)' : ''}
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            Báo cáo data không đạt chuẩn
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: 4 }}>
            Gửi báo cáo nếu thông tin khách hàng không chính xác
          </p>
        </div>

        {/* ── Main content: 2 cols ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, padding: '0 24px', width: '100%' }}>

          {loadingCtx ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
              <Loader2 size={40} className="spin" style={{ color: '#8b5cf6' }} />
              <SpinStyle />
            </div>
          ) : ctxError ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'white', borderRadius: 20, padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#fca5a5,#f87171)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <XCircle size={36} color="white" />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Đường dẫn không hợp lệ</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{ctxError}</p>
              </div>
            </div>
          ) : submitStatus === 'success' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'white', borderRadius: 20, padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#6ee7b7,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <CheckCircle size={36} color="white" />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Gửi Báo Cáo Thành Công!</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.7 }}>Báo cáo đã được gửi tới Admin. Nếu hợp lệ, bạn sẽ nhận Data bù ưu tiên trong lượt tiếp theo.</p>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', width: '100%', margin: 'auto',
              background: 'white', borderRadius: 20,
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
              overflow: 'hidden'
            }}>
              {/* ── LEFT: Info card (white) ── */}
              <div style={{
                flex: '0 0 320px', background: 'white',
                padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 18
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Thông tin Data cần báo cáo
                </div>

                {context && (
                  <>
                    {/* Customer avatar block */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: 'linear-gradient(135deg, #f8faff, #f0f4ff)', borderRadius: 14, border: '1px solid #e0e7ff' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: getColor(context.lead_name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1rem', flexShrink: 0, boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }}>
                        {initials(context.lead_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Khách hàng</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{context.lead_name}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#d97706', marginTop: 1 }}>{context.lead_phone}</div>
                      </div>
                    </div>

                    {/* Sale avatar block */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: 14, border: '1px solid #bbf7d0' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: getColor(context.consultant_name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0, boxShadow: '0 3px 6px rgba(0,0,0,0.12)' }}>
                        {initials(context.consultant_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Sale phụ trách</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#15803d' }}>{context.consultant_name}</div>
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <InfoItem label="Nguồn Data" value={context.lead_source || 'Không rõ'} />
                      <div style={{ height: 1, background: '#f1f5f9' }} />
                      <InfoItem label="Vòng phân bổ" value={context.round_name} accent />
                      <InfoItem label="Nhận lúc" value={context.assigned_at ? new Date(context.assigned_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'} />
                    </div>
                  </>
                )}
              </div>

              {/* ── RIGHT: Form card ── */}
              <div style={{
                flex: 1, background: 'rgba(255,255,255,0.97)',
                padding: '22px 22px', display: 'flex', flexDirection: 'column',
                borderLeft: '1px solid #f1f5f9'
              }}>
                {/* Test banner */}
                {params.isTest && (
                  <div style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a', color: '#b45309', padding: '10px 14px', borderRadius: 12, marginBottom: 16, fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, boxShadow: '0 2px 8px rgba(245,158,11,0.08)' }}>
                    <AlertCircle size={16} color="#d97706" />
                    <span>Trang xem thử — Dữ liệu mock, không gửi được.</span>
                  </div>
                )}

                {/* Already reported */}
                {context?.existing_report === 'pending' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#fde68a,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(245,158,11,0.3)' }}>
                      <Shield size={26} color="white" />
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Đã gửi báo cáo trước đó</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Báo cáo đang chờ Admin xét duyệt.</p>
                  </div>
                )}

                {context?.existing_report === 'approved' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#6ee7b7,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={26} color="white" />
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Báo cáo đã được duyệt ✅</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Bạn sẽ được ưu tiên nhận Data bù trong lượt tiếp theo.</p>
                  </div>
                )}

                {/* Main form */}
                {!context?.existing_report && (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    {submitStatus === 'error' && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 12px', borderRadius: 10, fontSize: '0.82rem', display: 'flex', alignItems: 'flex-start', gap: 7, flexShrink: 0 }}>
                        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>{submitError}</span>
                      </div>
                    )}

                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Chọn lý do lỗi</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {REPORT_REASONS.map(r => (
                        <label key={r} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px',
                          border: '1.5px solid', borderColor: reason === r ? '#8b5cf6' : 'transparent',
                          background: reason === r ? 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(124,58,237,0.12))' : '#f8fafc',
                          borderRadius: 12, cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: reason === r ? '0 4px 12px rgba(139,92,246,0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                          flexShrink: 0
                        }}>
                          <input type="radio" name="reason" value={r} checked={reason === r}
                            onChange={() => setReason(r)}
                            style={{ width: 16, height: 16, accentColor: '#8b5cf6', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.85rem', color: reason === r ? '#5b21b6' : '#475569', fontWeight: reason === r ? 700 : 400 }}>{r}</span>
                        </label>
                      ))}
                    </div>

                    {reason === 'Khác (Vui lòng ghi rõ ở phần ghi chú)' && (
                      <textarea required value={customReason} onChange={e => setCustomReason(e.target.value)}
                        placeholder="Nhập chi tiết lý do..."
                        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.85rem', minHeight: 70, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', flexShrink: 0 }} />
                    )}

                    <button type="submit" disabled={submitting}
                      style={{
                        width: '100%', flexShrink: 0, marginTop: 'auto',
                        background: params.isTest ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                        color: 'white', padding: '14px', borderRadius: 12, border: 'none',
                        fontSize: '0.95rem', fontWeight: 700,
                        cursor: submitting || params.isTest ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: params.isTest ? '0 4px 16px rgba(245,158,11,0.3)' : '0 4px 16px rgba(109,40,217,0.4)',
                        opacity: submitting ? 0.7 : 1, transition: 'all 0.2s'
                      }}>
                      {submitting ? <><Loader2 size={17} className="spin" /> Đang gửi...</>
                        : params.isTest ? 'Gửi bị tắt (Trang thử nghiệm)'
                          : <><Send size={17} /> Gửi Báo Cáo</>}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', paddingTop: 24, flexShrink: 0 }}>
          Powered by DOMATION · Hệ thống phân bổ data tự động
        </div>
      </div>

      <div style={{ flex: 1, minHeight: '20px' }} /> {/* Safe bottom spacer */}
      <SpinStyle />
    </div>
  );
};

const InfoItem = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div>
    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: '0.83rem', fontWeight: accent ? 700 : 500, color: accent ? '#7c3aed' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>{value}</div>
  </div>
);

const SpinStyle = () => (
  <style>{`.spin{animation:spin 1s linear infinite;display:block}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
);
