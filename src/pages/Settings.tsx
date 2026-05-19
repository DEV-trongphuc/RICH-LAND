import { useEffect, useState } from 'react';
import { Mail, Settings2, Save, Send, Server, Database, Activity, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/ui/Skeleton';

export const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // States
  const [provider, setProvider] = useState('appscript');
  const [appscriptUrl, setAppscriptUrl] = useState('');
  const [frontendUrl, setFrontendUrl] = useState('');
  
  const [sesHost, setSesHost] = useState('');
  const [sesUser, setSesUser] = useState('');
  const [sesPass, setSesPass] = useState('');
  const [sesSenderEmail, setSesSenderEmail] = useState('');
  const [sesSenderName, setSesSenderName] = useState('DOMATION TEAM');
  
  const [testEmail, setTestEmail] = useState('');
  const [testType, setTestType] = useState('system');
  // Collapse state for Input Webhook Code
  const [showInputScript, setShowInputScript] = useState(false);

  // Zalo Bot config
  const [zaloBotToken, setZaloBotToken] = useState('');
  const [zaloWebhookSecret, setZaloWebhookSecret] = useState('');
  const [zaloBotLink, setZaloBotLink] = useState('');
  const [zaloDailyReportTime, setZaloDailyReportTime] = useState('');

  // Fallback round config
  const [rounds, setRounds] = useState<any[]>([]);
  const [fallbackRoundId, setFallbackRoundId] = useState('');

  // Fallback direct Admin + CC config
  const [fallbackType, setFallbackType] = useState('round');
  const [fallbackAdminId, setFallbackAdminId] = useState('');
  const [fallbackCcEmail, setFallbackCcEmail] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);

  const fetchSettings = async () => {
    try {
      const roundsJson = await fetchAPI('get_rounds');
      if (roundsJson.success) {
        setRounds(roundsJson.data || []);
      }

      const accountsJson = await fetchAPI('get_accounts');
      if (accountsJson.success) {
        setAccounts(accountsJson.data || []);
      }
      
      const json = await fetchAPI('get_settings');
      if (json.success && json.data) {
        if (json.data.email_provider) setProvider(json.data.email_provider);
        if (json.data.appscript_webhook_url) setAppscriptUrl(json.data.appscript_webhook_url);
        if (json.data.frontend_url) setFrontendUrl(json.data.frontend_url);
        if (json.data.ses_host) setSesHost(json.data.ses_host);
        if (json.data.ses_username) setSesUser(json.data.ses_username);
        if (json.data.ses_password) setSesPass(json.data.ses_password);
        if (json.data.ses_sender_email) setSesSenderEmail(json.data.ses_sender_email);
        if (json.data.ses_sender_name) setSesSenderName(json.data.ses_sender_name);
        if (json.data.zalo_bot_token) setZaloBotToken(json.data.zalo_bot_token);
        if (json.data.zalo_webhook_secret) setZaloWebhookSecret(json.data.zalo_webhook_secret);
        if (json.data.zalo_bot_link) setZaloBotLink(json.data.zalo_bot_link);
        if (json.data.zalo_daily_report_time) setZaloDailyReportTime(json.data.zalo_daily_report_time);
        if (json.data.fallback_round_id) setFallbackRoundId(json.data.fallback_round_id);
        if (json.data.fallback_type) setFallbackType(json.data.fallback_type);
        if (json.data.fallback_admin_id) setFallbackAdminId(json.data.fallback_admin_id);
        if (json.data.fallback_cc_email) setFallbackCcEmail(json.data.fallback_cc_email);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      email_provider: provider,
      appscript_webhook_url: appscriptUrl,
      frontend_url: frontendUrl, // BUG-02 fix: save frontend URL for email report links
      ses_host: sesHost,
      ses_username: sesUser,
      ses_password: sesPass,
      ses_sender_email: sesSenderEmail,
      ses_sender_name: sesSenderName,
      zalo_bot_token: zaloBotToken,
      zalo_webhook_secret: zaloWebhookSecret,
      zalo_bot_link: zaloBotLink,
      zalo_daily_report_time: zaloDailyReportTime,
      fallback_round_id: fallbackRoundId,
      fallback_type: fallbackType,
      fallback_admin_id: fallbackAdminId,
      fallback_cc_email: fallbackCcEmail
    };
    
    try {
      const json = await fetchAPI('save_settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) toast.success("Đã lưu cấu hình thành công!");
      else toast.error("Lỗi khi lưu cấu hình!");
    } catch {
      toast.error("Lỗi kết nối Server");
    }
    setSaving(false);
  };


  const handleTestEmail = async () => {
    if (!testEmail) return toast.error("Vui lòng nhập Email người nhận test.");
    setTesting(true);
    try {
      const json = await fetchAPI('test_email', {
        method: 'POST',
        body: JSON.stringify({ email: testEmail, type: testType })
      });
      if (json.success) toast.success("Gửi mail test thành công! Vui lòng kiểm tra hộp thư đến.");
      else toast.error("Gửi mail thất bại. Vui lòng kiểm tra lại cấu hình SMTP/AppScript.");
    } catch {
      toast.error("Lỗi kết nối khi gửi mail test");
    }
    setTesting(false);
  };


  const providerOptions = [
    { value: 'appscript', label: 'Google Apps Script (Miễn phí, nên dùng nếu dưới 500 mail/ngày)' },
    { value: 'ses', label: 'Amazon SES (Chuyên nghiệp, SMTP)' }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div className="page-header" style={{ 
        position: 'sticky', 
        top: '-2rem', 
        zIndex: 90, 
        background: 'var(--color-bg)', 
        paddingTop: '1.5rem', 
        paddingBottom: '1rem', 
        borderBottom: '1px solid var(--color-border)', 
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings2 size={24} color="var(--color-primary)" /> Cài đặt Hệ thống
          </h1>
          <p className="page-subtitle">Cấu hình Email, Webhooks và các tích hợp nâng cao.</p>
        </div>
        <button className="btn primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? <Activity size={16} className="spin" /> : <Save size={16} />}
          Lưu cấu hình
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <CardSkeleton height={220} /><CardSkeleton height={160} />
          </div>
          <div style={{ flex: 1 }}><CardSkeleton height={200} /></div>
        </div>
      ) : (
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
              <Mail size={20} color="var(--color-primary)" /> Phương thức Gửi Email
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Chọn phương thức gửi</label>
              <CustomSelect 
                options={providerOptions}
                value={provider}
                onChange={val => setProvider(String(val))}
              />
            </div>

            {/* BUG-02 fix: Allow admin to configure the frontend URL for email report links */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--color-bg)', padding: '1rem', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>🔗 URL Frontend (Dùng trong link Email báo cáo lỗi)</label>
              <input
                className="form-input"
                placeholder="Ví dụ: https://sale.domation.net"
                value={frontendUrl}
                onChange={e => setFrontendUrl(e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Domain website, không có dấu / ở cuối. Dùng để tạo link báo cáo trong email gửi cho Sale.</p>
            </div>

            {provider === 'appscript' && (
              <div style={{ animation: 'fadeIn 0.3s', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Server size={18} color="#10b981" /> Cấu hình Webhook Apps Script
                </h4>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Mã Code Apps Script Gửi Email (Copy 1 lần duy nhất)</label>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                    Mã dưới đây dùng để kích hoạt tính năng <strong>Gửi Email</strong> qua Google. Copy mã này vào Apps Script, chọn <strong>Deploy as web app</strong> (Quyền truy cập: Anyone), lấy URL dán vào ô bên dưới.
                  </p>
                  
                  {/* Collapsible Script Block */}
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div 
                      style={{ padding: '0.75rem 1rem', background: 'var(--color-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => setShowInputScript(!showInputScript)}
                    >
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>Xem mã Apps Script</span>
                      {showInputScript ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
                    </div>
                    
                    {showInputScript && (
                      <pre style={{ 
                        background: '#1e293b', color: '#e2e8f0', padding: '1rem', margin: 0,
                        fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.5 
                      }}>
{`// ==========================================
// ĐOẠN MÃ XỬ LÝ GỬI EMAIL (DEPLOY AS WEB APP)
// ==========================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.type === "custom") {
      MailApp.sendEmail({
        to: data.email,
        subject: data.subject,
        htmlBody: data.htmlBody
      });
      return ContentService.createTextOutput(JSON.stringify({"success": true}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({"success": false}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                      </pre>
                    )}
                  </div>
                </div>

                <div>
                  <label className="form-label">URL Webhook của Google Apps Script (doPost)</label>
                  <input 
                    className="form-input" 
                    placeholder="https://script.google.com/macros/s/AKfycbw.../exec"
                    value={appscriptUrl}
                    onChange={e => setAppscriptUrl(e.target.value)}
                  />
                </div>
              </div>
            )}

            {provider === 'ses' && (
              <div style={{ animation: 'fadeIn 0.3s', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Database size={18} color="#f59e0b" /> Thông số Amazon SES (SMTP)
                </h4>
                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label">SMTP Host</label>
                    <input className="form-input" placeholder="email-smtp.us-east-1.amazonaws.com" value={sesHost} onChange={e => setSesHost(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Port</label>
                    <input className="form-input" value="587" disabled style={{ background: 'var(--color-bg)' }} />
                  </div>
                </div>
                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label">SMTP Username</label>
                    <input className="form-input" placeholder="AKIA..." value={sesUser} onChange={e => setSesUser(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">SMTP Password</label>
                    <input className="form-input" type="password" placeholder="BI..." value={sesPass} onChange={e => setSesPass(e.target.value)} />
                  </div>
                </div>
                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Email Người Gửi (From Email)</label>
                    <input className="form-input" placeholder="no-reply@domain.com" value={sesSenderEmail} onChange={e => setSesSenderEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Tên Người Gửi (From Name)</label>
                    <input className="form-input" placeholder="DOMATION TEAM" value={sesSenderName} onChange={e => setSesSenderName(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Cấu hình Zalo Bot */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', background: '#0068ff', color: 'white', padding: 4, borderRadius: 6 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </span>
              Cấu hình Zalo Bot (Gửi thông báo Data)
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Tính năng này cho phép hệ thống gửi trực tiếp thông báo chia số tới Zalo của Tư vấn viên.<br/>
              Truy cập <a href="https://bot.zapps.me/" target="_blank" rel="noreferrer" style={{color: '#0068ff', fontWeight: 600}}>Zalo Bot Platform</a> để tạo Bot và lấy Token.
            </p>

            <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Bot Token (Zalo cung cấp)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Ví dụ: 12345689:abc-xyz"
                  value={zaloBotToken}
                  onChange={e => setZaloBotToken(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Secret Token (Webhook bảo mật)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Nhập Secret Token tự chọn (Ví dụ: MY_SECRET_123)"
                  value={zaloWebhookSecret}
                  onChange={e => setZaloWebhookSecret(e.target.value)}
                />
              </div>
            </div>

            <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Link Zalo Bot (zalo.me/xxx)</label>
                <input
                  className="form-input"
                  placeholder="VD: https://zalo.me/1185588456243371597"
                  value={zaloBotLink}
                  onChange={e => setZaloBotLink(e.target.value)}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Link chèn vào Email chào mừng TVV.
                </p>
              </div>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Giờ gửi Báo cáo Ngày (VD: 17:00)</label>
                <input
                  type="time"
                  className="form-input"
                  value={zaloDailyReportTime}
                  onChange={e => setZaloDailyReportTime(e.target.value)}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Tự động gửi thống kê chia Data/Ticket cho Admin.
                </p>
              </div>
            </div>
            
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1rem' }}>
              <label className="form-label">Link Webhook khai báo trên Zalo Bot Platform:</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <code style={{ flex: 1, background: '#f8fafc', padding: '0.5rem', borderRadius: 6, fontSize: '0.875rem', color: '#0068ff', border: '1px solid #bfdbfe' }}>
                  https://open.domation.net/sale_data/zalo_webhook.php
                </code>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
                Copy link Webhook này và Secret Token (nếu có) dán vào phần thiết lập Webhook của Zalo Bot.
              </p>
            </div>
          </div>

          {/* Fallback Round Config Card */}
          <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', background: '#ef4444', color: 'white', padding: 4, borderRadius: 6 }}>
                <Zap size={16} />
              </span>
              Cấu hình Xử lý Fallback (Khi không khớp luật)
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Khi dữ liệu (leads) mới được đẩy vào hệ thống mà <strong>không khớp với bất kỳ quy luật định tuyến nào</strong>, hệ thống sẽ tự động xử lý theo một trong các tùy chọn dưới đây.
            </p>

            {/* Selector for Fallback Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <label 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px', 
                  padding: '1rem', 
                  borderRadius: '10px', 
                  border: fallbackType === 'round' ? '2px solid #ef4444' : '1px solid var(--color-border)', 
                  background: fallbackType === 'round' ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                  <input 
                    type="radio" 
                    name="fallbackType" 
                    value="round" 
                    checked={fallbackType === 'round'} 
                    onChange={() => setFallbackType('round')}
                    style={{ accentColor: '#ef4444', margin: 0 }}
                  />
                  Phân bổ theo Vòng mặc định
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '22px' }}>
                  Chia đều cho các sale trong Vòng được chọn theo cơ chế Round-Robin.
                </span>
              </label>

              <label 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px', 
                  padding: '1rem', 
                  borderRadius: '10px', 
                  border: fallbackType === 'admin' ? '2px solid #ef4444' : '1px solid var(--color-border)', 
                  background: fallbackType === 'admin' ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                  <input 
                    type="radio" 
                    name="fallbackType" 
                    value="admin" 
                    checked={fallbackType === 'admin'} 
                    onChange={() => setFallbackType('admin')}
                    style={{ accentColor: '#ef4444', margin: 0 }}
                  />
                  Giao thẳng cho Admin + CC
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '22px' }}>
                  Gửi trực tiếp đến Admin được chỉ định và gửi email CC đến các địa chỉ cấu hình.
                </span>
              </label>
            </div>

            {fallbackType === 'round' ? (
              <div style={{ animation: 'fadeIn 0.3s' }}>
                <label className="form-label">Chọn Vòng phân bổ mặc định</label>
                <CustomSelect 
                  options={[
                    { value: '', label: '-- Không sử dụng (Để trống trạng thái Chưa phân bổ) --' },
                    ...rounds.map(r => ({
                      value: r.id.toString(),
                      label: `${r.round_name} (${r.is_active ? 'Đang hoạt động' : 'Tạm dừng'})`
                    }))
                  ]}
                  value={fallbackRoundId}
                  onChange={val => setFallbackRoundId(val.toString())}
                  width="100%"
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s' }}>
                <div>
                  <label className="form-label">Chọn tài khoản Admin nhận data</label>
                  <CustomSelect 
                    options={[
                      { value: '', label: '-- Chọn Admin nhận data --' },
                      ...accounts.filter(a => a.role === 'admin').map(a => ({
                        value: a.id.toString(),
                        label: `${a.name} (${a.email})`
                      }))
                    ]}
                    value={fallbackAdminId}
                    onChange={val => setFallbackAdminId(val.toString())}
                    width="100%"
                  />
                </div>
                <div>
                  <label className="form-label">Địa chỉ Email CC khi xảy ra Fallback</label>
                  <input 
                    className="form-input" 
                    placeholder="Ví dụ: manager@company.com, admin@company.com" 
                    value={fallbackCcEmail}
                    onChange={e => setFallbackCcEmail(e.target.value)}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Ngăn cách nhiều email bằng dấu phẩy. Hệ thống sẽ gửi bản sao thông báo data fallback về các email này.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Testing */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.5rem', 
          position: 'sticky', 
          top: '6rem', 
          alignSelf: 'start' 
        }}>
          <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(to bottom right, var(--color-surface), rgba(124, 58, 237, 0.03))' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={18} color="var(--color-primary)" /> Gửi Test Email
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Sau khi lưu cấu hình, bạn có thể gửi một email thử nghiệm để đảm bảo hệ thống đã kết nối thành công với AppScript hoặc Amazon SES.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <CustomSelect 
                options={[
                  { value: 'system', label: 'Test Hệ Thống (SMTP / AppScript)' },
                  { value: 'assignment', label: 'Test Template Giao Data' },
                  { value: 'zalo_sale', label: 'Test Welcome & Zalo (Sale)' },
                  { value: 'zalo_admin', label: 'Test Welcome & Zalo (Admin)' },
                  { value: 'ticket_admin', label: 'Test Thông báo Ticket (Admin)' },
                  { value: 'ticket_sale_success', label: 'Test Duyệt Ticket thành công (Sale)' },
                  { value: 'ticket_sale_fail', label: 'Test Từ chối Ticket (Sale)' },
                  { value: 'admin_confirm', label: 'Test Xác nhận Email (Admin)' },
                  { value: 'daily_report', label: 'Test Báo Cáo Tổng Kết Ngày' }
                ]}
                value={testType}
                onChange={val => setTestType(val.toString())}
                width="100%"
                direction="down"
              />

              <input 
                className="form-input" 
                placeholder="Nhập email nhận test..." 
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
              />
              <button 
                className="btn outline" 
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleTestEmail}
                disabled={testing}
              >
                {testing ? <Activity size={16} className="spin" /> : <Send size={16} />} 
                {testing ? "Đang gửi..." : "Gửi Email Test"}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
