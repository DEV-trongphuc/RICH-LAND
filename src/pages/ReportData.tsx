import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Send, Loader2, Shield, XCircle, Clock } from 'lucide-react';
import { fetchPublicAPI } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';

interface ReportReason {
  reason: string;
  note: string;
}

const DEFAULT_REPORT_REASONS: ReportReason[] = [
  { reason: 'Sai số điện thoại / Số ảo', note: 'Data có số điện thoại sai, không đúng, thiếu số, hoặc gọi thì báo không phải tên của khách hàng.' },
  { reason: 'Trùng của tôi', note: 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).' },
  { reason: 'Trùng của người khác', note: 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).' },
  { reason: 'Spam ảo / Junk lead', note: 'Data mà vừa giao gọi cuộc 1 đã báo hết nhu cầu rồi, không có đăng kí, cháu chắt phá, hoặc đăng kí cho vui.' },
  { reason: 'Khác', note: 'Là data Unqualified. Mọi data như đăng kí khác chuyên ngành như Luật/NNA, data mới cấp 3, không có tiếng anh (được ghi chú từ đầu bởi thông báo của MKT), là những data được định nghĩa Unqualified như trên Misa thì cứ báo cáo và ghi lý do ở dưới. Tạm thời c vẫn sẽ bù vòng.' }
];

const TEST_MOCK_CONTEXT = {
  lead_name: 'Trần Thị Mai Anh',
  lead_phone: '0912 345 678',
  lead_email: 'maianh.tran@gmail.com',
  lead_source: 'Facebook Ads — Chiến dịch Tuyển sinh T5/2026',
  lead_type: 'Tư vấn khóa học',
  lead_note: 'Quan tâm: Khóa Marketing Online\nNgân sách: 5–10 triệu',
  consultant_name: 'Bạn (Tài khoản Test)',
  consultant_email: 'test@example.com',
  round_name: 'Vòng A — Facebook Inbound',
  assigned_at: new Date().toISOString(),
  existing_report: null as string | null,
  duplicate_check_months: 6,
  is_accepted: 0,
  lead_recall_minutes: 2
};

// Color hash for avatars
const AVATAR_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#0ea5e9', '#3b82f6', '#BD1D2D', '#d946ef', '#ec4899', '#14b8a6'];
const getColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const initials = (name: string) => name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();

interface ReportContext {
  lead_name: string; lead_phone: string; lead_email?: string; lead_source: string; lead_type?: string; lead_note: string;
  consultant_name: string; consultant_email: string; round_name: string;
  assigned_at: string; existing_report: string | null;
  duplicate_check_months?: number;
  is_accepted?: number;
  lead_recall_minutes?: number;
}

const CountdownTimer = ({ assignedAt, recallMinutes }: { assignedAt: string; recallMinutes: number }) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const start = new Date(assignedAt).getTime();
      const limit = start + recallMinutes * 60 * 1000;
      const diff = limit - Date.now();
      return diff > 0 ? Math.floor(diff / 1000) : 0;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const left = calculateTimeLeft();
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [assignedAt, recallMinutes]);

  if (timeLeft <= 0) {
    return (
      <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <Clock size={14} />
        <span>{t('Đã hết hạn chờ / Đang thu hồi...')}</span>
      </div>
    );
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const isUrgent = timeLeft < 30; // less than 30s is urgent

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: isUrgent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
      border: isUrgent ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
      padding: '4px 10px',
      borderRadius: 8,
      color: isUrgent ? '#f87171' : '#fbbf24',
      fontWeight: 700,
      fontSize: '0.8rem',
      marginTop: 4,
      animation: isUrgent ? 'pulse 1s infinite alternate' : 'none'
    }}>
      <Clock size={14} className={isUrgent ? 'pulse-icon' : ''} />
      <span>{t('Thu hồi sau:')} {formattedTime}</span>
    </div>
  );
};

export const ReportData = () => {
  const { t } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [params] = useState({
    leadId: searchParams.get('lead_id') || '',
    saleId: searchParams.get('sale_id') || '',
    roundId: searchParams.get('round_id') || '',
    isTest: searchParams.get('test') === '1',
  });

  const [reasons, setReasons] = useState<ReportReason[]>([]);
  const [context, setContext] = useState<ReportContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [ctxError, setCtxError] = useState('');
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [expandedMobile, setExpandedMobile] = useState(false);

  useEffect(() => {
    navigate('/report-data', { replace: true });
    if (params.isTest) {
      setContext(TEST_MOCK_CONTEXT);
      setReasons(DEFAULT_REPORT_REASONS);
      setReason(DEFAULT_REPORT_REASONS[0].reason);
      setLoadingCtx(false);
      return;
    }
    const isValidId = (v: string) => /^\d+$/.test(v) && parseInt(v) > 0;
    if (!isValidId(params.leadId) || !isValidId(params.saleId) || !isValidId(params.roundId)) {
      setCtxError(t('Đường dẫn không hợp lệ hoặc đã hết hạn. Vui lòng mở lại từ Email.'));
      setLoadingCtx(false); return;
    }
    fetchPublicAPI(`get_report_context&lead_id=${params.leadId}&sale_id=${params.saleId}&round_id=${params.roundId}`)
      .then(res => {
        if (res.success) {
          setContext(res.data);
          if (res.data.is_allowed_to_report === false) {
            setCtxError(t('Tài khoản của bạn không có quyền báo cáo lỗi data.'));
          } else {
            const list = res.data.report_error_reasons || DEFAULT_REPORT_REASONS;
            setReasons(list);
            if (list.length > 0) {
              setReason(list[0].reason);
            }
          }
        } else {
          setCtxError(t(res.message) || t('Không thể xác thực.'));
        }
      })
      .catch(e => setCtxError(t(e.message) || t('Lỗi kết nối.')))
      .finally(() => setLoadingCtx(false));
  }, []);

  const isOtherReason = reason.toLowerCase().includes('khác') || reason.toLowerCase().includes('other');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (params.isTest) { setSubmitError(t('Đây là link thử nghiệm — không thể gửi báo cáo thật.')); setSubmitStatus('error'); return; }
    if (submitting || submitStatus === 'success') return;
    setSubmitting(true); setSubmitError('');
    const finalReason = isOtherReason
      ? `${reason}: ${customReason}`
      : (customReason.trim() ? `${reason} (Ghi chú: ${customReason.trim()})` : reason);
    try {
      const res = await fetchPublicAPI('submit_report', {
        method: 'POST',
        body: JSON.stringify({ lead_id: Number(params.leadId), sale_id: Number(params.saleId), round_id: Number(params.roundId), reason: finalReason })
      });
      if (res.success) setSubmitStatus('success');
      else { setSubmitStatus('error'); setSubmitError(t(res.message) || t('Có lỗi xảy ra.')); }
    } catch (err: any) { setSubmitStatus('error'); setSubmitError(t(err.message) || t('Lỗi kết nối.')); }
    finally { setSubmitting(false); }
  };

  // ── Full-screen wrapper ──────────────────────────────────────────────────────
  return (
    <div className="report-wrapper">
      {/* Blobs */}
      <div style={{ position: 'absolute', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(189, 29, 45,0.12)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(236,72,153,0.1)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, minHeight: '20px' }} /> {/* Safe top spacer */}

      <div className="report-container">
        {/* ── Header strip ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 24, flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', padding: '5px 14px', borderRadius: 20, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', fontWeight: 600 }}>
              {t("BÁO CÁO DATA")}{params.isTest ? ` ${t("(Thử nghiệm)")}` : ''}
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            {t("Báo cáo data không đạt chuẩn")}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: 4 }}>
            {t("Gửi báo cáo nếu thông tin khách hàng không chính xác")}
          </p>
        </div>

        {/* ── Main content: 2 cols ── */}
        <div className="main-content-layout">

          {loadingCtx ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
              <Loader2 size={40} className="spin" style={{ color: '#BD1D2D' }} />
              <ResponsiveStyle />
            </div>
          ) : ctxError ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', border: '1px solid var(--color-border)' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#fca5a5,#f87171)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <XCircle size={36} color="white" />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>
                  {ctxError.includes('quyền') ? t("Không có quyền truy cập") : t("Đường dẫn không hợp lệ")}
                </h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{ctxError}</p>
              </div>
            </div>
          ) : submitStatus === 'success' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', border: '1px solid var(--color-border)' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#6ee7b7,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <CheckCircle size={36} color="white" />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>{t("Gửi Báo Cáo Thành Công!")}</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.7 }}>{t("Báo cáo đã được gửi tới Admin. Nếu hợp lệ, bạn sẽ nhận Data bù ưu tiên trong lượt tiếp theo.")}</p>
              </div>
            </div>
          ) : (
            <div className="report-card">
              {/* ── LEFT: Info card (white) ── */}
              <div className="info-card">
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {t("Thông tin Data cần báo cáo")}
                </div>

                {context && (
                  <>
                    {/* Customer avatar block */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'linear-gradient(135deg, #f8faff, #f0f4ff)', borderRadius: 14, border: theme === 'dark' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid #ffe3e8' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: getColor(context.lead_name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1rem', flexShrink: 0, boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }}>
                        {initials(context.lead_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{t("Khách hàng")}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{context.lead_name}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: theme === 'dark' ? '#fbbf24' : '#d97706', marginTop: 1 }}>{context.lead_phone}</div>
                      </div>
                    </div>

                    {/* Sale avatar block */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: theme === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: 14, border: theme === 'dark' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #bbf7d0' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: getColor(context.consultant_name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0, boxShadow: '0 3px 6px rgba(0,0,0,0.12)' }}>
                        {initials(context.consultant_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: theme === 'dark' ? '#34d399' : '#86efac', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{t("Saleperson phụ trách")}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: theme === 'dark' ? '#34d399' : '#15803d' }}>{context.consultant_name}</div>
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <InfoItem label={t("Nguồn Data")} value={context.lead_source || t('Không rõ')} />

                      <button
                        type="button"
                        className="mobile-toggle-btn"
                        onClick={() => setExpandedMobile(!expandedMobile)}
                      >
                        {expandedMobile ? t('Thu gọn chi tiết ▲') : t('Xem chi tiết ▼')}
                      </button>

                      <div className={`extra-details ${expandedMobile ? 'expanded' : ''}`}>
                        {context.lead_email && (
                          <>
                            <div style={{ height: 1, background: 'var(--color-border)' }} />
                            <InfoItem label={t("Email")} value={context.lead_email} />
                          </>
                        )}
                        {context.lead_type && (
                          <>
                            <div style={{ height: 1, background: 'var(--color-border)' }} />
                            <InfoItem label={t("Loại Data")} value={context.lead_type} />
                          </>
                        )}
                        <div style={{ height: 1, background: 'var(--color-border)' }} />
                        <InfoItem label={t("Vòng phân bổ")} value={context.round_name} accent />
                        <div style={{ height: 1, background: 'var(--color-border)' }} />
                        <InfoItem label={context.is_accepted === 1 ? t("Nhận lúc") : t("Chia lúc")} value={context.assigned_at ? new Date(context.assigned_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'} />
                        {context.is_accepted === 0 && context.assigned_at && (
                          <CountdownTimer assignedAt={context.assigned_at} recallMinutes={context.lead_recall_minutes || 2} />
                        )}
                        {context.lead_note && (
                          <>
                            <div style={{ height: 1, background: 'var(--color-border)' }} />
                            <div>
                              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t("Ghi chú / Thông tin")}</div>
                              <div style={{
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                color: 'var(--color-text-light)',
                                background: 'var(--color-bg)',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                                whiteSpace: 'pre-wrap',
                                maxHeight: '120px',
                                overflowY: 'auto',
                                lineHeight: 1.4
                              }}>
                                {context.lead_note}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ── RIGHT: Form card ── */}
              <div className="form-card">
                {/* Test banner */}
                {params.isTest && (
                  <div style={{ background: 'var(--color-warning-light)', border: '1px solid var(--color-border-light)', color: 'var(--color-warning)', padding: '10px 14px', borderRadius: 12, marginBottom: 16, fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, boxShadow: '0 2px 8px rgba(245,158,11,0.08)' }}>
                    <AlertCircle size={16} color="#d97706" />
                    <span>{t("Trang xem thử — Dữ liệu mock, không gửi được.")}</span>
                  </div>
                )}

                {/* Already reported */}
                {context?.existing_report === 'pending' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#fde68a,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(245,158,11,0.3)' }}>
                      <Shield size={26} color="white" />
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Đã gửi báo cáo trước đó")}</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{t("Báo cáo đang chờ Admin xét duyệt.")}</p>
                  </div>
                )}

                {context?.existing_report === 'approved' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#6ee7b7,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={26} color="white" />
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Báo cáo đã được duyệt ✅")}</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{t("Bạn sẽ được ưu tiên nhận Data bù trong lượt tiếp theo.")}</p>
                  </div>
                )}

                {/* Main form */}
                {!context?.existing_report && (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    {submitStatus === 'error' && (
                      <div style={{ background: 'var(--color-danger-light)', border: '1px solid var(--color-border-light)', color: 'var(--color-danger)', padding: '10px 12px', borderRadius: 10, fontSize: '0.82rem', display: 'flex', alignItems: 'flex-start', gap: 7, flexShrink: 0 }}>
                        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>{submitError}</span>
                      </div>
                    )}

                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t("Chọn lý do lỗi")}</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {reasons.map(r => (
                        <label key={r.reason} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: reason === r.reason ? 8 : 0,
                          padding: '12px 14px',
                          border: '1.5px solid', borderColor: reason === r.reason ? '#BD1D2D' : 'transparent',
                          background: reason === r.reason ? (theme === 'dark' ? 'rgba(163, 20, 34, 0.15)' : 'linear-gradient(135deg, rgba(189, 29, 45,0.08), rgba(163, 20, 34,0.12))') : 'var(--color-bg)',
                          borderRadius: 12, cursor: 'pointer',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: reason === r.reason ? '0 4px 12px rgba(189, 29, 45,0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                          flexShrink: 0
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="radio" name="reason" value={r.reason} checked={reason === r.reason}
                              onChange={() => setReason(r.reason)}
                              style={{ width: 16, height: 16, accentColor: '#BD1D2D', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.85rem', color: reason === r.reason ? (theme === 'dark' ? '#a78bfa' : '#5b21b6') : 'var(--color-text-light)', fontWeight: reason === r.reason ? 700 : 500 }}>{t(r.reason)}</span>
                          </div>

                          {reason === r.reason && r.note && (
                            <div style={{
                              paddingLeft: 26,
                              fontSize: '0.78rem',
                              lineHeight: 1.4,
                              color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : '#4b5563',
                              borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(189, 29, 45, 0.15)',
                              paddingTop: 8,
                              animation: 'fadeIn 0.2s ease-out',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {t(r.note.replace(/{n}/g, String(context?.duplicate_check_months || 6)))}
                            </div>
                          )}
                        </label>
                      ))}
                    </div>

                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{t("Ghi chú thêm")}</div>
                    <textarea
                      required={isOtherReason}
                      value={customReason}
                      onChange={e => setCustomReason(e.target.value)}
                      placeholder={isOtherReason ? t('Nhập chi tiết lý do lỗi (bắt buộc)...') : t('Nhập ghi chú thêm nếu có (tùy chọn)...')}
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--color-border)', borderRadius: 10, fontSize: '0.85rem', minHeight: 70, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', flexShrink: 0, background: 'var(--color-surface)', color: 'var(--color-text)' }} />

                    <button type="submit" disabled={submitting}
                      style={{
                        width: '100%', flexShrink: 0, marginTop: 'auto',
                        background: params.isTest ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #a31422, #8a0f1b)',
                        color: 'white', padding: '14px', borderRadius: 12, border: 'none',
                        fontSize: '0.95rem', fontWeight: 700,
                        cursor: submitting || params.isTest ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: params.isTest ? '0 4px 16px rgba(245,158,11,0.3)' : '0 4px 16px rgba(138, 15, 27,0.4)',
                        opacity: submitting ? 0.7 : 1, transition: 'all 0.2s'
                      }}>
                      {submitting ? <><Loader2 size={17} className="spin" /> {t("Đang gửi...")}</>
                        : params.isTest ? t('Gửi bị tắt (Trang thử nghiệm)')
                          : <><Send size={17} /> {t("Gửi Báo Cáo")}</>}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>


        {/* Footer */}
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', paddingTop: 24, flexShrink: 0 }}>
          Powered by RICH LAND · DATA ROUTING ENGINE
        </div>
      </div>

      <div style={{ flex: 1, minHeight: '20px' }} /> {/* Safe bottom spacer */}
      <ResponsiveStyle />
    </div>
  );
};

const InfoItem = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div>
    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: '0.83rem', fontWeight: accent ? 700 : 500, color: accent ? 'var(--color-primary)' : 'var(--color-text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>{value}</div>
  </div>
);

const ResponsiveStyle = () => (
  <style>{`
    .report-wrapper {
      width: 100%;
      height: 100vh;
      background: linear-gradient(135deg, #1e1246 0%, #2d1b69 40%, #0f172a 100%);
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      padding: 20px 0;
    }
    .report-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 900px;
      margin: auto;
      z-index: 1;
      position: relative;
      box-sizing: border-box;
    }
    .main-content-layout {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: 0;
      padding: 0 24px;
      width: 100%;
      box-sizing: border-box;
    }
    .report-card {
      display: flex;
      width: 100%;
      height: 600px;
      max-height: 80vh;
      margin: auto;
      background: var(--color-surface);
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.35);
      overflow: hidden;
      box-sizing: border-box;
    }
    .info-card {
      flex: 0 0 320px;
      background: var(--color-bg);
      padding: 24px 22px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      box-sizing: border-box;
      overflow-y: auto;
    }
    .form-card {
      flex: 1;
      background: var(--color-surface);
      padding: 22px 22px;
      display: flex;
      flex-direction: column;
      border-left: 1px solid var(--color-border);
      box-sizing: border-box;
      overflow-y: auto;
    }
    .mobile-toggle-btn {
      display: none;
      width: 100%;
      padding: 10px;
      background: var(--color-bg);
      border: 1.5px dashed var(--color-border);
      border-radius: 12px;
      color: var(--color-primary);
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      margin-top: 6px;
      transition: all 0.2s;
      outline: none;
      box-sizing: border-box;
    }
    .mobile-toggle-btn:hover {
      background: var(--color-border-light);
      border-color: var(--color-primary);
    }
    .extra-details {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Custom thin scrollbar for info-card and form-card */
    .info-card::-webkit-scrollbar,
    .form-card::-webkit-scrollbar {
      width: 6px;
    }
    .info-card::-webkit-scrollbar-track,
    .form-card::-webkit-scrollbar-track {
      background: var(--color-bg);
      border-radius: 3px;
    }
    .info-card::-webkit-scrollbar-thumb,
    .form-card::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 3px;
    }
    .info-card::-webkit-scrollbar-thumb:hover,
    .form-card::-webkit-scrollbar-thumb:hover {
      background: var(--color-text-muted);
    }

    @media (max-width: 768px) {
      .report-container h1 {
        font-size: 1.2rem !important;
        text-align: center;
      }
      .report-wrapper {
        height: auto;
        min-height: 100vh;
        overflow-y: auto;
        padding: 10px 0;
      }
      .main-content-layout {
        padding: 0 12px;
      }
      .report-card {
        flex-direction: column;
        border-radius: 16px;
        height: auto;
        max-height: none;
      }
      .info-card {
        flex: none;
        width: 100%;
        max-height: none; /* remove fixed max-height since button controls fold/unfold */
        border-bottom: 1px solid var(--color-border);
        padding: 20px 16px;
      }
      .form-card {
        border-left: none;
        padding: 20px 16px;
        height: auto;
        max-height: none;
        overflow-y: visible;
      }
      .mobile-toggle-btn {
        display: block;
      }
      .extra-details {
        display: none;
      }
      .extra-details.expanded {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
    }
    .spin {
      animation: spin 1s linear infinite;
      display: block;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0% { opacity: 0.6; }
      100% { opacity: 1; }
    }
    .pulse-icon {
      animation: spin 3s linear infinite;
    }
  `}</style>
);
