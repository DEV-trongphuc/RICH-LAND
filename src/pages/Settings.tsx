import { useEffect, useState } from 'react';
import { Mail, Settings2, Save, Send, Server, Database, Activity, ChevronDown, ChevronUp } from 'lucide-react';
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

  const fetchSettings = async () => {
    try {
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
      ses_sender_name: sesSenderName
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
        <Activity size={32} className="spin" />
      </div>
    );
  }

  const providerOptions = [
    { value: 'appscript', label: 'Google Apps Script (Miễn phí, Tùy biến cao)' },
    { value: 'ses', label: 'Amazon SES (Chuyên nghiệp, SMTP)' }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
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
                  <label className="form-label">Mã Code Apps Script Tổng Hợp (Copy 1 lần duy nhất)</label>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                    Mã dưới đây <strong>bao gồm cả tính năng Gửi Email và Đẩy Data</strong>. Copy mã này vào Apps Script, chọn <strong>Deploy as web app</strong> (Quyền truy cập: Anyone), lấy URL dán vào ô bên dưới. Để đẩy Data tự động, hãy cài thêm Trigger "OnEdit" cho hàm <code style={{fontFamily:'monospace'}}>sendToDataFlow</code>.
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
// ĐOẠN MÃ TỔNG HỢP (COPY 1 LẦN DUY NHẤT)
// ==========================================

const CRM_WEBHOOK_URL = "https://open.domation.net/sale_data/webhook.php";

// 1. NHẬN YÊU CẦU GỬI MAIL TỪ CRM (Deploy as Web App)
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
}

// 2. GỬI DATA TỪ SHEET VỀ CRM (Cài đặt Trigger: OnEdit / OnChange)
function sendToDataFlow(e) {
  if (!e) return;
  const sheet = e.source.getActiveSheet();
  const row = e.range.getRow();
  if (row === 1) return; // Bỏ qua dòng tiêu đề

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const payload = {
    _meta: { spreadsheet_id: e.source.getId(), sheet_name: sheet.getName() },
    data: {}
  };
  
  headers.forEach((header, i) => {
    if (header) payload.data[header] = rowData[i];
  });
  
  UrlFetchApp.fetch(CRM_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label">SMTP Host</label>
                    <input className="form-input" placeholder="email-smtp.us-east-1.amazonaws.com" value={sesHost} onChange={e => setSesHost(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Port</label>
                    <input className="form-input" value="587" disabled style={{ background: 'var(--color-bg)' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label">SMTP Username</label>
                    <input className="form-input" placeholder="AKIA..." value={sesUser} onChange={e => setSesUser(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">SMTP Password</label>
                    <input className="form-input" type="password" placeholder="BI..." value={sesPass} onChange={e => setSesPass(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
        </div>

        {/* Right Column: Testing */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                  { value: 'assignment', label: 'Test Template Giao Data' }
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
