import { useEffect, useState } from 'react';
import { Mail, Settings2, Save, Send, Server, Database, Activity, ChevronDown, ChevronUp, Zap, Shield, MessageCircle, RefreshCw, Settings as SettingsIcon, BarChart2, Clock, Users } from 'lucide-react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';

export const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'processing' | 'mail' | 'zalo' | 'report'>('processing');
  
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
  const [dailyReportAdmins, setDailyReportAdmins] = useState<number[]>([]);

  // Fallback round config
  const [rounds, setRounds] = useState<any[]>([]);
  const [fallbackRoundId, setFallbackRoundId] = useState('');
  const [duplicateCheckMonths, setDuplicateCheckMonths] = useState(6);

  // Fallback direct Admin + CC config
  const [fallbackType, setFallbackType] = useState('round');
  const [fallbackAdminId, setFallbackAdminId] = useState('');
  const [fallbackCcEmail, setFallbackCcEmail] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);

  // Blacklist Config
  const [exclusionKeys, setExclusionKeys] = useState('');
  const [exclusionContacts, setExclusionContacts] = useState('');

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
        if (json.data.daily_report_admins) {
          try {
            const parsed = JSON.parse(json.data.daily_report_admins);
            if (Array.isArray(parsed)) setDailyReportAdmins(parsed.map(Number));
          } catch { /* ignore */ }
        }
        if (json.data.fallback_round_id) setFallbackRoundId(json.data.fallback_round_id);
        if (json.data.fallback_type) setFallbackType(json.data.fallback_type);
        if (json.data.fallback_admin_id) setFallbackAdminId(json.data.fallback_admin_id);
        if (json.data.fallback_cc_email) setFallbackCcEmail(json.data.fallback_cc_email);
        if (json.data.global_exclusion_keys) setExclusionKeys(json.data.global_exclusion_keys);
        if (json.data.global_exclusion_contacts) setExclusionContacts(json.data.global_exclusion_contacts);
        if (json.data.duplicate_check_months) setDuplicateCheckMonths(Number(json.data.duplicate_check_months));
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
      frontend_url: frontendUrl,
      ses_host: sesHost,
      ses_username: sesUser,
      ses_password: sesPass,
      ses_sender_email: sesSenderEmail,
      ses_sender_name: sesSenderName,
      zalo_bot_token: zaloBotToken,
      zalo_webhook_secret: zaloWebhookSecret,
      zalo_bot_link: zaloBotLink,
      zalo_daily_report_time: zaloDailyReportTime,
      daily_report_admins: dailyReportAdmins,
      fallback_round_id: fallbackRoundId,
      fallback_type: fallbackType,
      fallback_admin_id: fallbackAdminId,
      fallback_cc_email: fallbackCcEmail,
      global_exclusion_keys: exclusionKeys,
      global_exclusion_contacts: exclusionContacts,
      duplicate_check_months: duplicateCheckMonths
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

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
        <button 
          onClick={() => setActiveTab('processing')}
          style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: activeTab === 'processing' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'processing' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <SettingsIcon size={18} /> Cấu hình Xử lý
        </button>
        <button 
          onClick={() => setActiveTab('mail')}
          style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: activeTab === 'mail' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'mail' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <Mail size={18} /> Cấu hình Email
        </button>
        <button 
          onClick={() => setActiveTab('zalo')}
          style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: activeTab === 'zalo' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'zalo' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <MessageCircle size={18} /> Cấu hình Zalo Bot
        </button>
        <button 
          onClick={() => setActiveTab('report')}
          style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: activeTab === 'report' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'report' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <BarChart2 size={18} /> Báo cáo Ngày
        </button>
      </div>

      {loading ? (
        <div className="responsive-flex-row" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
            <CardSkeleton height={220} /><CardSkeleton height={160} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}><CardSkeleton height={200} /></div>
        </div>
      ) : (
      <div className="responsive-flex-row" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          
          {activeTab === 'mail' && (
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
          )}

          {/* Cấu hình Zalo Bot */}
          {activeTab === 'zalo' && (
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

            <div style={{ marginBottom: '1rem' }}>
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
          )}

          {/* ===== TAB: BÁO CÁO NGÀY ===== */}
          {activeTab === 'report' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s' }}>

            {/* Giờ gửi */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', background: 'var(--color-primary)', color: 'white', padding: 4, borderRadius: 6 }}><Clock size={16} /></span>
                Lịch gửi Báo cáo Tự động
              </h3>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.875rem 1rem', minWidth: 220 }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
                    <strong>Cửa sổ thời gian:</strong> Nếu gửi lúc <strong>{zaloDailyReportTime || '17:00'}</strong>, hệ thống sẽ tổng kết chia số từ <strong>{zaloDailyReportTime || '17:00'} hôm qua</strong> đến <strong>{zaloDailyReportTime || '17:00'} hôm nay</strong> — không bỏ sót data đêm.
                  </p>
                </div>
                <div style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column' }}>
                  <input
                    type="time"
                    className="form-input"
                    value={zaloDailyReportTime}
                    onChange={e => setZaloDailyReportTime(e.target.value)}
                    style={{ flex: 1, height: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Chọn Admin nhận báo cáo */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', background: '#0ea5e9', color: 'white', padding: 4, borderRadius: 6 }}><Users size={16} /></span>
                Admin nhận Báo cáo
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Chọn các tài khoản sẽ nhận báo cáo qua <strong>Email</strong> và <strong>Zalo Bot</strong>. Nếu không chọn, hệ thống sẽ gửi cho tất cả Admin.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {accounts.filter(a => a.role === 'admin' || a.id === 1).map((admin: any) => {
                  const isSelected = dailyReportAdmins.includes(Number(admin.id));
                  return (
                    <label
                      key={admin.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.875rem',
                        padding: '0.875rem 1rem', borderRadius: 10, cursor: 'pointer',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setDailyReportAdmins(prev =>
                            isSelected ? prev.filter(id => id !== Number(admin.id)) : [...prev, Number(admin.id)]
                          );
                        }}
                        style={{ accentColor: 'var(--color-primary)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <Avatar name={admin.name || admin.username} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                          {admin.name || admin.username}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {admin.email && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Mail size={11} /> {admin.email}
                            </span>
                          )}
                          {admin.zalo_chat_id ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0068ff' }}>
                              <MessageCircle size={11} /> Zalo đã liên kết
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b' }}>
                              <MessageCircle size={11} /> Chưa liên kết Zalo
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span style={{ background: 'var(--color-primary)', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, flexShrink: 0 }}>Đã chọn</span>
                      )}
                    </label>
                  );
                })}
                {accounts.filter(a => a.role === 'admin' || a.id === 1).length === 0 && (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>Chưa có tài khoản Admin nào trong hệ thống.</p>
                )}
              </div>
              {dailyReportAdmins.length === 0 && (
                <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={14} style={{ color: '#b45309', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.8125rem', color: '#92400e', margin: 0 }}>Chưa chọn Admin nào — hệ thống sẽ tự động gửi cho <strong>tất cả tài khoản Admin</strong>.</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Fallback & Blacklist Configs (Processing Tab) */}
          {activeTab === 'processing' && (
          <>
          <div className="card" style={{ padding: '1.5rem', marginTop: 0 }}>
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
            <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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
                        label: a.name,
                        sublabel: a.email
                      }))
                    ]}
                    value={fallbackAdminId}
                    onChange={val => setFallbackAdminId(val.toString())}
                    width="100%"
                    showAvatars={true}
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

          {/* Cấu hình Lọc trùng */}
          <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', background: 'var(--color-primary)', color: 'white', padding: 4, borderRadius: 6 }}>
                <RefreshCw size={16} />
              </span>
              Cấu hình Nhận diện & Lọc Trùng Lặp
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Nếu khách hàng đăng ký lại trong khoảng thời gian này, hệ thống sẽ bỏ qua quy trình phân chia mới và tự động định tuyến về Sale cũ phụ trách để chăm sóc tiếp.
            </p>
            <div>
              <label className="form-label">Thời hạn nhận diện trùng lặp (Tháng)</label>
              <div style={{ position: 'relative', width: 200 }}>
                <input 
                  type="number" 
                  min={1} 
                  className="form-input" 
                  value={duplicateCheckMonths}
                  onChange={e => setDuplicateCheckMonths(Math.max(1, Number(e.target.value)))}
                  style={{ paddingRight: 60 }}
                />
                <span style={{ position: 'absolute', right: 12, top: 10, color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>Tháng</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                Mặc định là 6 tháng. Đặt 12 tháng nếu muốn giữ khách cũ cho Sale trong vòng 1 năm.
              </p>
            </div>
          </div>

          {/* Blacklist Config Card */}
          <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', background: '#374151', color: 'white', padding: 4, borderRadius: 6 }}>
                <Shield size={16} />
              </span>
              Danh sách đen & Loại trừ Data
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Data chứa các thông tin này sẽ bị chặn đứng ngay lập tức và <strong>KHÔNG</strong> được giao cho bất kỳ vòng nào (Kể cả vòng Fallback).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Từ khóa loại trừ (Keys)
                </label>
                <textarea 
                  className="form-input" 
                  style={{ minHeight: 80, resize: 'vertical' }}
                  placeholder="Ví dụ: spam, test, rác..." 
                  value={exclusionKeys}
                  onChange={e => setExclusionKeys(e.target.value)}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Ngăn cách bằng dấu phẩy. Nếu dữ liệu (Tên, Nguồn, Ghi chú...) chứa bất kỳ từ khóa nào trong danh sách này, hệ thống sẽ tự động bỏ qua.
                </p>
              </div>

              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Số điện thoại / Email loại trừ
                </label>
                <textarea 
                  className="form-input" 
                  style={{ minHeight: 80, resize: 'vertical' }}
                  placeholder="Ví dụ: 0909123456, admin@test.com..." 
                  value={exclusionContacts}
                  onChange={e => setExclusionContacts(e.target.value)}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Ngăn cách bằng dấu phẩy. Chặn đứng các Data Spam từ số điện thoại hoặc Email cụ thể.
                </p>
              </div>
            </div>
          </div>
          </>
          )}
        </div>

        {/* Right Column: Testing */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.5rem', 
          position: 'sticky', 
          top: '6rem', 
          alignSelf: 'start',
          minWidth: 0,
          width: '100%'
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
