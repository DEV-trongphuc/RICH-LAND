import React, { useState, useEffect } from 'react';
import { CustomModal } from './CustomModal';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { fetchAPI } from '../../utils/api';
import { useLanguage } from '../../contexts/LanguageContext';

interface NotificationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'email' | 'zalo';
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  leadSource: string;
  leadType: string;
  leadNote: string;
  assignedToName: string;
  sentAt: string;
  isReminder?: boolean;
  leadId?: number;
  assignedToId?: number;
  roundId?: number;
  roundName?: string;
  aiEvaluation?: string;
  aiStatus?: string;
}

export const NotificationPreviewModal: React.FC<NotificationPreviewModalProps> = ({
  isOpen,
  onClose,
  type,
  leadName,
  leadPhone,
  leadEmail,
  leadSource,
  leadType,
  leadNote,
  assignedToName,
  sentAt,
  isReminder = false,
  leadId = 0,
  assignedToId = 0,
  roundId = 0,
  roundName = '',
  aiEvaluation = '',
  aiStatus = ''
}) => {
  const { t } = useLanguage();
  const isEmail = type === 'email';
  const modalTitle = isEmail 
    ? "Xem chi tiết Mẫu Email đã gửi cho Sale"
    : "Xem chi tiết Mẫu Zalo đã gửi cho Sale";

  // State for dynamic settings, consultant, and round
  const [settings, setSettings] = useState<any>(null);
  const [consultant, setConsultant] = useState<any>(null);
  const [round, setRound] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      // 1. Fetch system settings
      fetchAPI('get_settings')
        .then(res => {
          if (res && res.success && res.data) {
            setSettings(res.data);
          }
        })
        .catch(err => console.error("Error fetching settings:", err));

      // 2. Fetch consultants to find the email of the assigned sale
      fetchAPI('get_consultants')
        .then(res => {
          if (res && res.success && res.data) {
            const found = res.data.find((c: any) => c.name === assignedToName);
            if (found) {
              setConsultant(found);
            }
          }
        })
        .catch(err => console.error("Error fetching consultants:", err));

      // 3. Fetch rounds to get cc_emails
      fetchAPI('get_rounds')
        .then(res => {
          if (res && res.success && res.data) {
            const found = res.data.find((r: any) => r.round_name === roundName || r.id === roundId);
            if (found) {
              setRound(found);
            }
          }
        })
        .catch(err => console.error("Error fetching rounds:", err));
    } else {
      setSettings(null);
      setConsultant(null);
      setRound(null);
    }
  }, [isOpen, assignedToName, roundName, roundId]);

  // Dynamic values
  const displayRound = roundName || leadType || 'Form';
  const displaySource = leadSource || 'Facebook Ads - Form';
  const displayType = leadType || 'Lead 4 CT Đặt lịch';
  const displayEmail = leadEmail && leadEmail !== '-' ? leadEmail : 'Không có';
  const displayNote = leadNote && leadNote !== '-' ? leadNote : 'Không có';
  
  // App base URL construct
  const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const portalUrl = `${appBaseUrl}/sale-portal`;
  const reportUrl = `${appBaseUrl}/report-data?lead_id=${leadId}&sale_id=${assignedToId || consultant?.id || 0}&round_id=${roundId || round?.id || 0}`;

  // Helper to parse leadNote for custom key-value pairs (like mailer.php)
  const parseLeadNoteToRows = (noteText: string) => {
    const rows: { key: string; value: string }[] = [];
    let actualNote = '';
    if (noteText && noteText !== '-') {
      const normalized = noteText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = normalized.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed === '') return;
        
        // Clean leading bullets
        const cleanLine = trimmed.replace(/^[\s\-*•–+\u2022\u2013]+/u, '').trim();
        if (cleanLine === '') return;
        
        const colonPos = cleanLine.indexOf(':');
        if (colonPos !== -1) {
          const key = cleanLine.substring(0, colonPos).trim();
          const val = cleanLine.substring(colonPos + 1).trim();
          
          // Check if it's a section header or a key-value pair
          const lowerKey = key.toLowerCase();
          if (val === '') {
            if (lowerKey !== 'thông tin khách hàng' && lowerKey !== 'thông tin chi tiết khách hàng' && lowerKey !== 'thông tin chi tiết' && lowerKey !== 'thông tin liên hệ') {
              rows.push({ key, value: '' });
            }
          } else {
            rows.push({ key, value: val });
          }
        } else {
          actualNote += cleanLine + '\n';
        }
      });
    }
    return { rows, actualNote: actualNote.trim() };
  };

  const { rows: parsedNoteRows, actualNote: parsedActualNote } = parseLeadNoteToRows(leadNote);

  // 1. ZALO MESSAGE TEMPLATE (Matches zalo_bot.php)
  const getZaloMessageText = () => {
    if (isReminder) {
      const emailLine = displayEmail && displayEmail !== 'Không có' ? `  • Email: ${displayEmail}\n` : '';
      const typeLine = displayType && displayType !== '-' ? `  • Loại Data: ${displayType}\n` : '';

      return `🔄 [ KHÁCH HÀNG ĐĂNG KÝ LẠI ] 🔄\n` +
        `🕒 Đây là tin nhắn thông báo không tính vào vòng phân bổ\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `Chào ${assignedToName || 'Tư vấn viên'},\n` +
        `khách hàng cũ của bạn vừa đăng ký lại trên hệ thống:\n\n` +
        `👤 THÔNG TIN KHÁCH HÀNG:\n` +
        `  • Tên KH: ${leadName || 'Không có'}\n` +
        `  • Số ĐT: ${leadPhone || 'Không có'}\n` +
        emailLine +
        typeLine +
        `  • Nguồn: ${displaySource}\n` +
        (displayRound ? `  • Vòng: ${displayRound}\n` : '') +
        `\n📝 GHI CHÚ MỚI:\n` +
        `  ${parsedActualNote || displayNote}\n\n` +
        `📜 LỊCH SỬ PHÂN BỔ GẦN NHẤT:\n` +
        `  • ${sentAt || 'Vừa xong'} - Đã bàn giao (Vòng: ${displayRound} | Sale: ${assignedToName})\n\n` +
        `⚡ Vui lòng liên hệ lại với khách hàng sớm nhất có thể!\n` +
        `━━━━━━━━━━━━━━━━━━━━━`;
    } else {
      const roundTitle = displayRound ? ` - ${displayRound.toUpperCase()}` : "";
      const emailLine = displayEmail && displayEmail !== 'Không có' ? `  • Email: ${displayEmail}\n` : '';
      const typeLine = displayType && displayType !== '-' ? `  • Loại Data: ${displayType}\n` : '';
      const roundLine = displayRound ? `  • Vòng phân bổ: ${displayRound}\n` : '';

      let aiSection = '';
      if (aiStatus === 'passed' && aiEvaluation) {
        aiSection = `\n🤖 ĐÁNH GIÁ AI:\n` +
          `  ${aiEvaluation.replace(/\n/g, '\n  ')}\n`;
      }

      return `📥 [ THÔNG BÁO DATA MỚI${roundTitle} ] 📥\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `Chào ${assignedToName || 'Tư vấn viên'},\n` +
        `hệ thống vừa phân bổ cho bạn một khách hàng mới:\n\n` +
        `👤 THÔNG TIN KHÁCH HÀNG:\n` +
        `  • Tên KH: ${leadName || 'Không có'}\n` +
        `  • Số ĐT: ${leadPhone || 'Không có'}\n` +
        emailLine +
        typeLine +
        `  • Nguồn: ${displaySource}\n` +
        roundLine +
        `\n📝 GHI CHÚ:\n` +
        `  ${parsedActualNote || displayNote}\n` +
        aiSection +
        `\n⚠️ Nếu Data bị sai SĐT hoặc trùng lặp, vui lòng báo cáo tại đây:\n` +
        `👉 Link: ${reportUrl}\n` +
        `━━━━━━━━━━━━━━━━━━━━━`;
    }
  };

  // 2. EMAIL SUBJECT (Matches mailer.php)
  const getEmailSubject = () => {
    if (isReminder) {
      return `Khách hàng cũ đăng ký lại — ${leadName}`;
    } else {
      const roundStr = displayRound ? ` vòng ${displayRound}` : '';
      return `Bạn vừa nhận được Lead ${leadName}${roundStr}`;
    }
  };

  const getEmailContent = () => {
    if (isReminder) {
      return (
        <>
          {/* Centered Circle Icon for reminder */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              backgroundColor: '#ffe3e8',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '32px' }}>🔄</span>
            </div>
            <h2 style={{ color: '#0f172a', margin: '0 0 8px', fontSize: '22px', fontWeight: 700 }}>Khách hàng đăng ký lại</h2>
            <p style={{ color: '#64748b', fontSize: '15px', margin: 0, lineHeight: 1.5 }}>
              Chào <strong>{assignedToName}</strong>, một khách hàng cũ của bạn vừa đăng ký lại trên hệ thống.
            </p>
          </div>

          {/* Customer Info Box */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <p style={{ color: '#0f172a', fontSize: '15px', margin: '0 0 16px 0', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              Thông tin khách hàng
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#334155' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', width: '140px', color: '#64748b', verticalAlign: 'top', fontWeight: 600 }}>Tên KH:</td>
                  <td style={{ padding: '8px 0', fontWeight: 700, color: '#0f172a', verticalAlign: 'top' }}>{leadName}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#64748b', verticalAlign: 'top', fontWeight: 600 }}>Số điện thoại:</td>
                  <td style={{ padding: '8px 0', fontWeight: 700, color: '#3b82f6', verticalAlign: 'top' }}>
                    <a href={`tel:${leadPhone}`} style={{ color: '#3b82f6', textDecoration: 'underline' }}>{leadPhone}</a>
                  </td>
                </tr>
                {leadEmail && leadEmail !== '-' && (
                  <tr>
                    <td style={{ padding: '8px 0', color: '#64748b', verticalAlign: 'top', fontWeight: 600 }}>Email:</td>
                    <td style={{ padding: '8px 0', fontWeight: 700, color: '#0f172a', verticalAlign: 'top' }}>
                      <a href={`mailto:${displayEmail}`} style={{ color: '#0f172a', textDecoration: 'none' }}>{displayEmail}</a>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '8px 0', color: '#64748b', verticalAlign: 'top', fontWeight: 600 }}>Nguồn:</td>
                  <td style={{ padding: '8px 0', color: '#0f172a', verticalAlign: 'top' }}>{displaySource}</td>
                </tr>
                {leadType && leadType !== '-' && (
                  <tr>
                    <td style={{ padding: '8px 0', color: '#64748b', verticalAlign: 'top', fontWeight: 600 }}>Loại Data:</td>
                    <td style={{ padding: '8px 0', color: '#0f172a', verticalAlign: 'top' }}>{displayType}</td>
                  </tr>
                )}
                {displayRound && (
                  <tr>
                    <td style={{ padding: '8px 0', color: '#64748b', verticalAlign: 'top', fontWeight: 600 }}>Vòng:</td>
                    <td style={{ padding: '8px 0', fontWeight: 700, color: '#0f172a', verticalAlign: 'top' }}>{displayRound}</td>
                  </tr>
                )}
                
                {/* Dynamically parsed note rows */}
                {parsedNoteRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '8px 0', color: '#64748b', verticalAlign: 'top', fontWeight: 600 }}>{row.key}:</td>
                    <td style={{ padding: '8px 0', fontWeight: 700, color: '#334155', verticalAlign: 'top' }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* History Box */}
          <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <p style={{ color: '#0f172a', fontSize: '14px', margin: '0 0 12px 0', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
              Lịch sử phân bổ gần nhất
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#334155' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', color: '#64748b', width: '130px', verticalAlign: 'top' }}>{sentAt || '2026-05-29 23:30:04'}</td>
                  <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                    <strong>Nhắc trùng</strong> | Vòng: {displayRound} | Sale: {assignedToName}
                    <br />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Khách cũ đăng ký lại &lt; 6 tháng (đồng bộ hệ thống).</span>
                  </td>
                </tr>
                <tr style={{ borderTop: '1px dashed #cbd5e1' }}>
                  <td style={{ padding: '6px 0', color: '#64748b', width: '130px', verticalAlign: 'top', paddingTop: '12px' }}>2026-05-25 08:47:42</td>
                  <td style={{ padding: '6px 0', verticalAlign: 'top', paddingTop: '12px' }}>
                    <strong>Đồng bộ ẩn</strong> | Vòng: {displayRound} | Sale: {assignedToName}
                    <br />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Chỉ đồng bộ check trùng, không định tuyến (Trùng số).</span>
                  </td>
                </tr>
                <tr style={{ borderTop: '1px dashed #cbd5e1' }}>
                  <td style={{ padding: '6px 0', color: '#64748b', width: '130px', verticalAlign: 'top', paddingTop: '12px' }}>2026-05-21 11:12:45</td>
                  <td style={{ padding: '6px 0', verticalAlign: 'top', paddingTop: '12px' }}>
                    <strong>Đồng bộ ẩn</strong> | Vòng: {displayRound} | Sale: {assignedToName}
                    <br />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Chỉ đồng bộ check trùng, không định tuyến (Mới).</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* New Notes Box */}
          {parsedActualNote && (
            <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '20px 24px', borderRadius: '0 12px 12px 0', marginBottom: '32px' }}>
              <p style={{ color: '#92400e', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' }}>
                GHI CHÚ MỚI
              </p>
              <p style={{ color: '#0f172a', fontSize: '14px', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                {parsedActualNote}
              </p>
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Vui lòng liên hệ lại với khách hàng sớm nhất có thể.</p>
          </div>
        </>
      );
    } else {
      // NEW LEAD EMAIL TEMPLATE (Exactly matches the uploaded image & mailer.php)
      return (
        <>
          {/* Greeting text directly at the top */}
          <p style={{ color: '#475569', fontSize: '16px', lineHeight: 1.7, marginBottom: '24px' }}>
            Chào <strong>{assignedToName}</strong>,<br /><br />
            Hệ thống vừa phân bổ tự động cho bạn 1 khách hàng mới từ {displayRound ? `vòng ${displayRound}` : 'chiến dịch Inbound'}.
          </p>

          {/* Customer Info Box (yellow background, yellow left border) */}
          <div style={{ backgroundColor: '#fefce8', borderLeft: '4px solid #eab308', padding: '24px', margin: '30px 0', borderRadius: '0 12px 12px 0' }}>
            <p style={{ color: '#0f172a', fontSize: '16px', margin: '0 0 15px 0', fontWeight: 'bold', lineHeight: 1.6, borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              Thông tin chi tiết Khách hàng:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', lineHeight: 1.6, color: '#334155' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', fontWeight: 600, width: '140px', verticalAlign: 'top', color: '#64748b' }}>Họ Tên:</td>
                  <td style={{ padding: '6px 0', fontWeight: 700, color: '#0f172a', verticalAlign: 'top' }}>{leadName}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', fontWeight: 600, verticalAlign: 'top', color: '#64748b' }}>Số Điện Thoại:</td>
                  <td style={{ padding: '6px 0', fontWeight: 700, color: '#d97706', verticalAlign: 'top' }}>{leadPhone}</td>
                </tr>
                {leadEmail && leadEmail !== '-' && (
                  <tr>
                    <td style={{ padding: '6px 0', fontWeight: 600, verticalAlign: 'top', color: '#64748b' }}>Email:</td>
                    <td style={{ padding: '6px 0', fontWeight: 500, verticalAlign: 'top' }}>
                      <a href={`mailto:${leadEmail}`} style={{ color: '#3b82f6', textDecoration: 'underline' }}>{leadEmail}</a>
                    </td>
                  </tr>
                )}
                {leadType && leadType !== '-' && (
                  <tr>
                    <td style={{ padding: '6px 0', fontWeight: 600, verticalAlign: 'top', color: '#64748b' }}>Loại Data:</td>
                    <td style={{ padding: '6px 0', color: '#0f172a', verticalAlign: 'top' }}>{displayType}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '6px 0', fontWeight: 600, verticalAlign: 'top', color: '#64748b' }}>Nguồn Data:</td>
                  <td style={{ padding: '6px 0', color: '#0f172a', verticalAlign: 'top' }}>{displaySource}</td>
                </tr>
                {displayRound && (
                  <tr>
                    <td style={{ padding: '6px 0', fontWeight: 600, verticalAlign: 'top', color: '#64748b' }}>Vòng:</td>
                    <td style={{ padding: '6px 0', fontWeight: 700, color: '#0f172a', verticalAlign: 'top' }}>{displayRound}</td>
                  </tr>
                )}
                
                {/* Dynamically parsed note rows */}
                {parsedNoteRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '6px 0', fontWeight: 600, verticalAlign: 'top', color: '#64748b' }}>{row.key}:</td>
                    <td style={{ padding: '6px 0', fontWeight: 700, color: '#334155', verticalAlign: 'top' }}>{row.value}</td>
                  </tr>
                ))}

                {parsedActualNote && (
                  <tr>
                    <td style={{ padding: '6px 0', fontWeight: 600, verticalAlign: 'top', color: '#64748b' }}>Ghi chú / Khác:</td>
                    <td style={{ padding: '6px 0', color: '#0f172a', verticalAlign: 'top', lineHeight: 1.5 }}>{parsedActualNote}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* AI Block (purple background, purple left border) */}
          {aiStatus === 'passed' && aiEvaluation && (
            <div style={{ backgroundColor: '#fff5f6', borderLeft: '4px solid #a31422', padding: '24px', margin: '30px 0', borderRadius: '0 12px 12px 0' }}>
              <p style={{ color: '#8a0f1b', fontSize: '16px', margin: '0 0 12px 0', fontWeight: 'bold', lineHeight: 1.6, borderBottom: '1px solid #ddd6fe', paddingBottom: '8px' }}>
                🤖 Đánh giá AI:
              </p>
              <p style={{ color: '#5b21b6', fontSize: '15px', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                {aiEvaluation}
              </p>
            </div>
          )}
        </>
      );
    }
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={t(modalTitle)}
      width={isEmail ? 680 : 520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '75vh', overflow: 'hidden' }}>
        
        {/* Info Header */}
        <div style={{
          background: isEmail ? '#fff5f6' : '#e0f2fe',
          border: isEmail ? '1px solid #ffccd5' : '1px solid #bae6fd',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '1rem',
          fontSize: '0.8rem',
          color: isEmail ? '#700913' : '#0369a1',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {isEmail ? <Mail size={14} style={{ color: '#a31422' }} /> : <MessageCircle size={14} style={{ color: '#0068ff' }} />}
          <span>
            {t("Thông báo này được gửi tự động lúc")} <strong>{sentAt}</strong> {t("đến Sale")} <strong>{assignedToName}</strong>
          </span>
        </div>

        {/* Content Container */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {isEmail ? (
            /* EMAIL CLIENT MOCKUP */
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontFamily: 'Inter, sans-serif',
              boxShadow: 'var(--shadow-sm)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Email Headers (No MINTH CRM references) */}
              <div style={{
                background: '#ffffff',
                padding: '16px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.8rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', width: '70px', fontWeight: 600 }}>{t("Tiêu đề:")}</span>
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>{getEmailSubject()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', width: '70px', fontWeight: 600 }}>{t("Từ:")}</span>
                  <span style={{ color: '#0f172a' }}>
                    {settings?.ses_sender_name || 'DOMATION TEAM'} &lt;{settings?.ses_sender_email || 'noreply@domation.net'}&gt;
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', width: '70px', fontWeight: 600 }}>{t("Tới:")}</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>
                    {assignedToName} &lt;{consultant?.email || 'sale@domation.net'}&gt;
                  </span>
                </div>
                {round?.cc_emails && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', width: '70px', fontWeight: 600 }}>Cc:</span>
                    <span style={{ color: '#0f172a' }}>{round.cc_emails}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', width: '70px', fontWeight: 600 }}>{t("Thời gian:")}</span>
                  <span style={{ color: '#64748b' }}>{sentAt}</span>
                </div>
              </div>

              {/* Email Body */}
              <div style={{
                padding: '24px',
                background: '#f1f5f9',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <div style={{
                  background: '#ffffff',
                  width: '100%',
                  maxWidth: '560px',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  marginBottom: '24px'
                }}>
                  {/* Email Top Brand Accent Gradient matching mailer.php */}
                  <div style={{
                    background: 'linear-gradient(135deg, #eab308, #ea580c)',
                    padding: '32px 20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.25)', borderRadius: '50%', width: '48px', height: '48px', lineHeight: '48px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <img src="https://open.domation.net/sale_data/Compress_ICON.png" alt="Domation Logo" style={{ width: '28px', height: '28px', verticalAlign: 'middle', display: 'inline-block', borderRadius: '50%' }} />
                      </div>
                    </div>
                    <h1 style={{ color: '#ffffff', fontSize: '24px', margin: 0, fontWeight: 900, letterSpacing: '2px', textAlign: 'center', fontFamily: "'Inter', Helvetica, Arial, sans-serif" }}>DOMATION</h1>
                    <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '12px', margin: '4px 0 0', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}>
                      {isReminder ? 'DATA ROUTING ENGINE' : 'CÓ DATA MỚI VỀ!'}
                    </p>
                  </div>

                  {/* Email Body Content */}
                  <div style={{ padding: '32px 24px', color: '#475569', fontSize: '15px', lineHeight: 1.6 }}>
                    {getEmailContent()}

                    {/* Email Action Links (Same row matching updated mailer.php) */}
                    <div style={{ textAlign: 'center', marginTop: '32px', paddingTop: '24px', borderTop: '1px dashed #cbd5e1', paddingBottom: '8px' }}>
                      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px', lineHeight: 1.5 }}>
                        Xem danh sách dữ liệu tại Trang Tư vấn viên hoặc báo cáo lỗi (sai SĐT, trùng lặp...) để nhận data bù:
                      </p>
                      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                        <a href={portalUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#a31422', color: 'white', textDecoration: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 6px -1px rgba(163, 20, 34, 0.2)' }}>
                          DATA CỦA BẠN
                        </a>
                        <a href={reportUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#ef4444', color: 'white', textDecoration: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}>
                          BÁO CÁO DATA
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Email Footer */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    padding: '24px',
                    textAlign: 'center',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
                      © 2026 Domation Ecosystem. All rights reserved.<br/>
                      Email này được gửi tự động từ hệ thống quản trị DOMATION.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ZALO CHAT MOCKUP */
            <div style={{
              background: '#e4e7ec',
              border: '1px solid #ccc',
              borderRadius: '16px',
              fontFamily: 'Inter, sans-serif',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: '660px'
            }}>
              {/* Phone Status Bar Mock */}
              <div style={{
                background: '#0068ff',
                color: '#ffffff',
                padding: '6px 16px',
                fontSize: '0.65rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: 0.95
              }}>
                <span>20:01</span>
                <span style={{ display: 'flex', gap: 4 }}>📶 🔋 98%</span>
              </div>

              {/* Zalo Header */}
              <div style={{
                background: '#0068ff',
                color: '#ffffff',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ fontSize: '1.2rem', cursor: 'pointer' }}>←</div>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  color: '#0068ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}>
                  Zalo
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Zalo Notification Bot</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>Vừa mới hoạt động</div>
                </div>
              </div>

              {/* Zalo Message Pane */}
              <div style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {/* Sent Time Centered */}
                <div style={{
                  alignSelf: 'center',
                  background: 'rgba(0, 0, 0, 0.08)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '0.65rem',
                  color: '#4a5568'
                }}>
                  {sentAt}
                </div>

                {/* Message Bubble Container */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  maxWidth: '92%'
                }}>
                  {/* Bot avatar symbol */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#0068ff',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    Bot
                  </div>

                  {/* Message Bubble */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    borderTopLeftRadius: '2px',
                    padding: '10px 12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    fontSize: '0.85rem',
                    color: '#1a202c',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace'
                  }}>
                    {getZaloMessageText()}
                  </div>
                </div>
              </div>

              {/* Bottom Chat bar mockup */}
              <div style={{
                background: '#ffffff',
                padding: '8px 12px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ fontSize: '1rem', color: '#64748b' }}>⌨️</span>
                <div style={{
                  flex: 1,
                  background: '#f1f5f9',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  color: '#94a3b8'
                }}>
                  {t("Nhập tin nhắn...")}
                </div>
                <Send size={14} style={{ color: '#0068ff', cursor: 'pointer' }} />
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '1.25rem',
          borderTop: '1px solid var(--color-border-light)',
          paddingTop: '12px'
        }}>
          <button
            onClick={onClose}
            className="btn ghost"
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              color: 'var(--color-text)'
            }}
          >
            {t("Đóng")}
          </button>
        </div>

      </div>
    </CustomModal>
  );
};
