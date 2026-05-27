import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Mail, Settings2, Save, Send, Server, Database, Activity, ChevronDown, ChevronUp, Zap, Shield, MessageCircle, RefreshCw, Settings as SettingsIcon, BarChart2, Clock, Users, CheckCircle, Plus, Trash2, Edit2, FileSpreadsheet, Upload, Download, X, Search, UserCheck } from 'lucide-react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import * as XLSX from 'xlsx';

const thStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'var(--color-bg)',
  zIndex: 1,
  padding: '10px 16px',
  boxShadow: 'inset 0 -1px 0 var(--color-border)',
  textAlign: 'left'
};

const maskPhone = (phone: string) => {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.length <= 6) {
    return trimmed.slice(0, 2) + '*'.repeat(trimmed.length - 2);
  }
  return trimmed.slice(0, 3) + '****' + trimmed.slice(-3);
};

const maskEmail = (email: string) => {
  if (!email) return '';
  const trimmed = email.trim();
  const parts = trimmed.split('@');
  if (parts.length !== 2) return trimmed;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 3) {
    return name.slice(0, 1) + '***@' + domain;
  }
  return name.slice(0, 2) + '***' + name.slice(-1) + '@' + domain;
};

const formatExcelDate = (val: string) => {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (num > 20000 && num < 60000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
      }
    }
  }
  return trimmed;
};

const DEFAULT_REPORT_REASONS = [
  { reason: 'Sai số điện thoại / Số ảo', note: 'Data có số điện thoại sai, không đúng, thiếu số, hoặc gọi thì báo không phải tên của khách hàng.' },
  { reason: 'Trùng của tôi (Trùng Saleperson)', note: 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).' },
  { reason: 'Trùng của người khác (Saleperson khác đã chăm)', note: 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).' },
  { reason: 'Spam ảo / Junk lead', note: 'Data mà vừa giao gọi cuộc 1 đã báo hết nhu cầu rồi, không có đăng kí, cháu chắt phá, hoặc đăng kí cho vui.' },
  { reason: 'Khác (Vui lòng ghi rõ ở phần ghi chú)', note: 'Là data Unqualified. Mọi data như đăng kí khác chuyên ngành như Luật/NNA, data mới cấp 3, không có tiếng anh (được ghi chú từ đầu bởi thông báo của MKT), là những data được định nghĩa Unqualified như trên Misa thì cứ báo cáo và ghi lý do ở dưới. Tạm thời c vẫn sẽ bù vòng.' }
];

export const Settings = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'processing' | 'communications' | 'report' | 'duplicate_check' | 'ai'>('processing');

  const tabOptions = [
    { value: 'processing', label: t('Cấu hình Xử lý'), icon: <SettingsIcon size={16} /> },
    { value: 'communications', label: t('Cấu hình Gửi tin & Email'), icon: <Send size={16} /> },
    { value: 'report', label: t('Báo cáo'), icon: <BarChart2 size={16} /> },
    { value: 'duplicate_check', label: t('Ánh xạ dữ liệu cũ'), icon: <FileSpreadsheet size={16} /> },
    { value: 'ai', label: t('Cấu hình Trợ lý AI'), icon: <Zap size={16} /> }
  ];

  // States for Gemini API Connection
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');

  // AI Screener Config
  const [aiScreenerEnabled, setAiScreenerEnabled] = useState(false);
  const [aiScreenerRules, setAiScreenerRules] = useState('');
  const [aiScreenerRounds, setAiScreenerRounds] = useState<number[]>([]);
  const [aiScreenerMode, setAiScreenerMode] = useState('ai');
  const [aiScreenerManualAction, setAiScreenerManualAction] = useState('hold');
  const [aiScreenerManualRules, setAiScreenerManualRules] = useState<any[]>([]);

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

  // Weekly report config
  const [zaloWeeklyReportDay, setZaloWeeklyReportDay] = useState('0');
  const [zaloWeeklyReportTime, setZaloWeeklyReportTime] = useState('08:00');

  // Fallback round config
  const [rounds, setRounds] = useState<any[]>([]);
  const [fallbackRoundId, setFallbackRoundId] = useState('');
  const [duplicateCheckMonths, setDuplicateCheckMonths] = useState(6);
  const [reassignIfOwnerInactive, setReassignIfOwnerInactive] = useState(true);
  const [starvationPreventionEnabled, setStarvationPreventionEnabled] = useState(false);
  const [starvationMaxLeadsPerHour, setStarvationMaxLeadsPerHour] = useState(3);
  const [reportErrorReasons, setReportErrorReasons] = useState<{ reason: string; note: string }[]>([]);

  const handleAddReasonRow = () => {
    setReportErrorReasons(prev => [...prev, { reason: '', note: '' }]);
  };

  const handleUpdateReasonRow = (index: number, key: 'reason' | 'note', value: string) => {
    setReportErrorReasons(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  const handleRemoveReasonRow = (index: number) => {
    setReportErrorReasons(prev => prev.filter((_, idx) => idx !== index));
  };

  // Fallback direct Admin + CC config
  const [fallbackType, setFallbackType] = useState('round');
  const [fallbackAdminId, setFallbackAdminId] = useState('');
  const [fallbackCcEmail, setFallbackCcEmail] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);

  // Blacklist Config
  const [exclusionKeys, setExclusionKeys] = useState('');
  const [exclusionContacts, setExclusionContacts] = useState('');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [newContactInput, setNewContactInput] = useState('');
  const [blacklistSearchQuery, setBlacklistSearchQuery] = useState('');
  const [blacklistContactTab, setBlacklistContactTab] = useState<'phone' | 'email'>('phone');

  // Ticket Auto-Approve config
  const [ticketAutoApproveEnabled, setTicketAutoApproveEnabled] = useState(false);
  const [ticketAutoApproveKeywords, setTicketAutoApproveKeywords] = useState('');
  const [consultants, setConsultants] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [ticketAutoApproveRules, setTicketAutoApproveRules] = useState<any[]>([]);

  // Rule edit modal state
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null); // null = add, rule object = edit

  // Rule form states
  const [ruleName, setRuleName] = useState('');
  const [ruleActive, setRuleActive] = useState(true);
  const [ruleRounds, setRuleRounds] = useState<any[]>(['all']);
  const [ruleSales, setRuleSales] = useState<any[]>(['all']);
  const [ruleConnections, setRuleConnections] = useState<any[]>(['all']);
  const [ruleKeywords, setRuleKeywords] = useState('');

  // Batch Duplicate Checker States
  const selectedSheetId = 'local';
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localRows, setLocalRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneCol, setPhoneCol] = useState<string>('');
  const [emailCol, setEmailCol] = useState<string>('');
  const [nameCol, setNameCol] = useState<string>('');
  const [dateCol, setDateCol] = useState<string>('');
  const [salepersonCol, setSalepersonCol] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [checkedResults, setCheckedResults] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'duplicate' | 'new'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [totalHistoryCount, setTotalHistoryCount] = useState<number>(0);
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  const [confirmDeleteLogsOpen, setConfirmDeleteLogsOpen] = useState(false);
  const [logsToDelete, setLogsToDelete] = useState<{ log_id: number; lead_id: number }[]>([]);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);

  const fetchImportHistory = async (page: number = 1) => {
    setLoadingHistory(true);
    try {
      const json = await fetchAPI(`get_import_history&page=${page}&pageSize=50`);
      if (json.success) {
        setImportHistory(json.data || []);
        setTotalHistoryCount(json.total_count ?? (json.data || []).length);
      }
    } catch (err) {
      console.error("Error fetching import history:", err);
    }
    setLoadingHistory(false);
  };

  const handleDeleteHistory = (logs: { log_id: number; lead_id: number }[]) => {
    if (!logs || logs.length === 0) return;
    setLogsToDelete(logs);
    setConfirmDeleteLogsOpen(true);
  };

  const executeDeleteHistory = async () => {
    if (logsToDelete.length === 0) return;
    try {
      const logIds = logsToDelete.map(item => item.log_id);
      const leadIds = logsToDelete.map(item => item.lead_id);

      const res = await fetchAPI('delete_import_history', {
        method: 'POST',
        body: JSON.stringify({ log_ids: logIds, lead_ids: leadIds })
      });

      if (res.success) {
        toast.success(res.message || t("Đã xóa thành công!"));
        setSelectedLogs([]);
        fetchImportHistory(historyPage);
      } else {
        toast.error(res.message || t("Lỗi khi xóa dữ liệu"));
      }
    } catch (err: any) {
      toast.error(err.message || t("Lỗi kết nối hệ thống"));
    }
    setConfirmDeleteLogsOpen(false);
    setLogsToDelete([]);
  };
  const [resultsPage, setResultsPage] = useState(1);
  const [importSubTab, setImportSubTab] = useState<'list' | 'upload'>('list');
  const [historyPage, setHistoryPage] = useState(1);

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

      const consultantsJson = await fetchAPI('get_consultants');
      if (consultantsJson.success) {
        setConsultants(consultantsJson.data || []);
      }

      const connectionsJson = await fetchAPI('get_connections');
      if (connectionsJson.success) {
        setConnections(connectionsJson.data || []);
      }

      const json = await fetchAPI('get_settings');
      if (json.success && json.data) {
        if (json.data.email_provider) {
          setProvider(json.data.email_provider);
          if (json.data.email_provider === 'appscript') {
            setShowInputScript(true);
          }
        }
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
        if (json.data.zalo_weekly_report_day) setZaloWeeklyReportDay(json.data.zalo_weekly_report_day);
        if (json.data.zalo_weekly_report_time) setZaloWeeklyReportTime(json.data.zalo_weekly_report_time);
        if (json.data.fallback_round_id) setFallbackRoundId(json.data.fallback_round_id);
        if (json.data.fallback_type) setFallbackType(json.data.fallback_type);
        if (json.data.fallback_admin_id) setFallbackAdminId(json.data.fallback_admin_id);
        if (json.data.fallback_cc_email) setFallbackCcEmail(json.data.fallback_cc_email);
        if (json.data.global_exclusion_keys) setExclusionKeys(json.data.global_exclusion_keys);
        if (json.data.global_exclusion_contacts) setExclusionContacts(json.data.global_exclusion_contacts);
        if (json.data.duplicate_check_months) setDuplicateCheckMonths(Number(json.data.duplicate_check_months));
        setReassignIfOwnerInactive(json.data.reassign_if_owner_inactive === undefined || json.data.reassign_if_owner_inactive === '1' || json.data.reassign_if_owner_inactive === 1);
        if (json.data.starvation_prevention_enabled !== undefined) {
          setStarvationPreventionEnabled(json.data.starvation_prevention_enabled === '1' || json.data.starvation_prevention_enabled === 1);
        }
        if (json.data.starvation_max_leads_per_hour !== undefined) {
          setStarvationMaxLeadsPerHour(Number(json.data.starvation_max_leads_per_hour));
        }
        setTicketAutoApproveEnabled(json.data.ticket_auto_approve_enabled === '1' || json.data.ticket_auto_approve_enabled === 1);
        setTicketAutoApproveKeywords(json.data.ticket_auto_approve_keywords || '');
        if (json.data.report_error_reasons) {
          try {
            const parsed = JSON.parse(json.data.report_error_reasons);
            if (Array.isArray(parsed)) {
              const normalized = parsed.map((item: any) => {
                if (typeof item === 'string') {
                  const defaultMatch = DEFAULT_REPORT_REASONS.find(d => d.reason === item);
                  return { reason: item, note: defaultMatch ? defaultMatch.note : '' };
                } else if (item && typeof item === 'object') {
                  return { reason: item.reason || '', note: item.note || '' };
                }
                return { reason: '', note: '' };
              });
              setReportErrorReasons(normalized);
            }
          } catch {
            setReportErrorReasons([]);
          }
        } else {
          setReportErrorReasons(DEFAULT_REPORT_REASONS);
        }
        if (json.data.ticket_auto_approve_rules) {
          try {
            const parsed = JSON.parse(json.data.ticket_auto_approve_rules);
            if (Array.isArray(parsed)) setTicketAutoApproveRules(parsed);
          } catch { /* ignore */ }
        }
        if (json.data.gemini_api_key) setGeminiApiKey(json.data.gemini_api_key);
        if (json.data.gemini_model) setGeminiModel(json.data.gemini_model);
        setAiScreenerEnabled(json.data.ai_screener_enabled === '1' || json.data.ai_screener_enabled === 1);
        if (json.data.ai_screener_rules) setAiScreenerRules(json.data.ai_screener_rules);
        if (json.data.ai_screener_rounds) {
          setAiScreenerRounds(json.data.ai_screener_rounds.split(',').map(Number).filter((n: any) => !isNaN(n) && n > 0));
        } else {
          setAiScreenerRounds([]);
        }
        setAiScreenerMode(json.data.ai_screener_mode || 'ai');
        setAiScreenerManualAction(json.data.ai_screener_manual_action || 'hold');
        if (json.data.ai_screener_manual_rules) {
          try {
            const parsed = typeof json.data.ai_screener_manual_rules === 'string'
              ? JSON.parse(json.data.ai_screener_manual_rules)
              : json.data.ai_screener_manual_rules;
            if (Array.isArray(parsed)) {
              setAiScreenerManualRules(parsed);
            } else {
              setAiScreenerManualRules([]);
            }
          } catch {
            setAiScreenerManualRules([]);
          }
        } else {
          setAiScreenerManualRules([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['processing', 'mail', 'zalo', 'report', 'duplicate_check', 'ai'].includes(tabParam)) {
      setActiveTab(tabParam as any);
      if (window.location.hash === '#auto-approve') {
        setTimeout(() => {
          const el = document.getElementById('auto-approve');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'duplicate_check') {
      fetchImportHistory(historyPage);
    }
  }, [activeTab, historyPage]);

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
      zalo_weekly_report_day: zaloWeeklyReportDay,
      zalo_weekly_report_time: zaloWeeklyReportTime,
      fallback_round_id: fallbackRoundId,
      fallback_type: fallbackType,
      fallback_admin_id: fallbackAdminId,
      fallback_cc_email: fallbackCcEmail,
      global_exclusion_keys: exclusionKeys,
      global_exclusion_contacts: exclusionContacts,
      duplicate_check_months: duplicateCheckMonths,
      reassign_if_owner_inactive: reassignIfOwnerInactive ? '1' : '0',
      starvation_prevention_enabled: starvationPreventionEnabled ? 1 : 0,
      starvation_max_leads_per_hour: starvationMaxLeadsPerHour,
      ticket_auto_approve_enabled: ticketAutoApproveEnabled ? 1 : 0,
      ticket_auto_approve_keywords: ticketAutoApproveKeywords,
      ticket_auto_approve_rules: ticketAutoApproveRules,
      report_error_reasons: reportErrorReasons,
      gemini_api_key: geminiApiKey,
      gemini_model: geminiModel,
      ai_screener_enabled: aiScreenerEnabled ? '1' : '0',
      ai_screener_rules: aiScreenerRules,
      ai_screener_rounds: aiScreenerRounds.join(','),
      ai_screener_mode: aiScreenerMode,
      ai_screener_manual_action: aiScreenerManualAction,
      ai_screener_manual_rules: aiScreenerManualRules
    };

    try {
      const json = await fetchAPI('save_settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) toast.success(t("Đã lưu cấu hình thành công!"));
      else toast.error(t("Lỗi khi lưu cấu hình!"));
    } catch {
      toast.error(t("Lỗi kết nối Server"));
    }
    setSaving(false);
  };


  const handleTestEmail = async () => {
    if (!testEmail) return toast.error(t("Vui lòng nhập Email người nhận test."));
    setTesting(true);
    try {
      const json = await fetchAPI('test_email', {
        method: 'POST',
        body: JSON.stringify({ email: testEmail, type: testType })
      });
      if (json.success) toast.success(t("Gửi mail test thành công! Vui lòng kiểm tra hộp thư đến."));
      else toast.error(t("Gửi mail thất bại. Vui lòng kiểm tra lại cấu hình SMTP/AppScript."));
    } catch {
      toast.error(t("Lỗi kết nối khi gửi mail test"));
    }
    setTesting(false);
  };


  const providerOptions = [
    { value: 'appscript', label: t('Google Apps Script (Miễn phí, nên dùng nếu dưới 500 mail/ngày)') },
    { value: 'ses', label: t('Amazon SES (Chuyên nghiệp, SMTP)') }
  ];

  const roundOptions = [
    { value: 'all', label: t('Tất cả các vòng'), icon: <Zap size={14} style={{ color: 'var(--color-primary)' }} /> },
    ...rounds.map(r => ({
      value: Number(r.id),
      label: r.round_name,
      icon: <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />,
      disabled: Number(r.is_active) !== 1,
      disabledType: 'round' as const
    }))
  ];

  const saleOptions = [
    { value: 'all', label: t('Tất cả Salepersons'), icon: <Users size={14} style={{ color: 'var(--color-primary)' }} /> },
    ...consultants.map(c => ({
      value: Number(c.id),
      label: c.name,
      icon: <Users size={14} style={{ color: 'var(--color-text-muted)' }} />,
      disabled: c.status !== 'active',
      disabledType: 'sale' as const
    }))
  ];

  const connectionOptions = [
    { value: 'all', label: t('Tất cả các nguồn'), icon: <Database size={14} style={{ color: 'var(--color-primary)' }} /> },
    ...connections.map(conn => ({
      value: Number(conn.id),
      label: conn.sheet_name,
      icon: <Database size={14} style={{ color: 'var(--color-text-muted)' }} />
    }))
  ];

  const processUploadedFile = (file: File) => {
    if (!file) return;
    setLocalFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length > 0) {
          const fileHeaders = data[0].map(h => String(h || '').trim());
          setHeaders(fileHeaders);

          // Find default columns by heuristic names
          const phoneIdx = fileHeaders.findIndex(h => /sđt|phone|điện thoại|sdt/i.test(h));
          const emailIdx = fileHeaders.findIndex(h => /email|mail/i.test(h));
          const nameIdx = fileHeaders.findIndex(h => /tên|name|họ tên/i.test(h));
          const dateIdx = fileHeaders.findIndex(h => /ngày|date|time|ngày tạo|ngày đăng ký|created_at/i.test(h));
          const salepersonIdx = fileHeaders.findIndex(h => /sale|nv|nhân viên|phụ trách|salesperson|assigned|owner/i.test(h));

          if (phoneIdx !== -1) setPhoneCol(fileHeaders[phoneIdx]);
          if (emailIdx !== -1) setEmailCol(fileHeaders[emailIdx]);
          if (nameIdx !== -1) setNameCol(fileHeaders[nameIdx]);
          if (dateIdx !== -1) setDateCol(fileHeaders[dateIdx]);
          if (salepersonIdx !== -1) setSalepersonCol(fileHeaders[salepersonIdx]);

          // Parse rows
          const rows: any[] = [];
          for (let i = 1; i < data.length; i++) {
            const rowArr = data[i];
            if (!rowArr || rowArr.length === 0 || rowArr.every(cell => cell === null || cell === undefined || cell === '')) continue;
            const rowObj: Record<string, any> = {};
            fileHeaders.forEach((h, idx) => {
              rowObj[h] = rowArr[idx] !== undefined ? String(rowArr[idx]).trim() : '';
            });
            rows.push(rowObj);
          }
          setLocalRows(rows);
          toast.success(t('Đã đọc thành công {count} dòng từ file.').replace('{count}', String(rows.length)));
        } else {
          toast.error(t("File rỗng."));
        }
      } catch (err: any) {
        toast.error(t("Không thể đọc file: ") + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        processUploadedFile(file);
      } else {
        toast.error(t("Vui lòng tải lên file Excel hoặc CSV (.xlsx, .xls, .csv)"));
      }
    }
  };

  const handleBlacklistUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length > 0) {
          const foundContacts: string[] = [];
          
          data.forEach(row => {
            if (!row || !Array.isArray(row)) return;
            row.forEach(cell => {
              if (cell === null || cell === undefined) return;
              const val = String(cell).trim();
              if (!val) return;
              
              if (val.includes('@') && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(val)) {
                foundContacts.push(val);
              } else {
                const cleanedPhone = val.replace(/[\s\.\-\(\)]/g, '');
                if (/^\+?\d{8,15}$/.test(cleanedPhone)) {
                  foundContacts.push(cleanedPhone);
                }
              }
            });
          });

          if (foundContacts.length === 0) {
            toast.error(t("Không tìm thấy số điện thoại hoặc email hợp lệ nào trong file."));
            return;
          }

          const currentContacts = exclusionContacts ? exclusionContacts.split(',').map(c => c.trim()).filter(Boolean) : [];
          const newContactsList = [...currentContacts];
          let addedCount = 0;
          
          foundContacts.forEach(c => {
            if (!newContactsList.includes(c)) {
              newContactsList.push(c);
              addedCount++;
            }
          });

          setExclusionContacts(newContactsList.join(', '));
          toast.success(t('Đã thêm thành công {count} liên hệ rác mới vào danh sách đen!').replace('{count}', String(addedCount)));
        } else {
          toast.error(t("File rỗng."));
        }
      } catch (err: any) {
        toast.error(t("Lỗi khi đọc file: ") + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleRunBatchCheck = async () => {
    setCheckedResults([]);
    setResultsPage(1);

    if (selectedSheetId === 'local') {
      if (localRows.length === 0) {
        toast.error(t("Vui lòng tải lên file Excel hoặc CSV!"));
        return;
      }
      if (!phoneCol && !emailCol) {
        toast.error(t("Vui lòng chọn ít nhất cột Số điện thoại hoặc Email để lọc trùng!"));
        return;
      }

      setChecking(true);
      try {
        const mappedLeads = localRows.map(row => ({
          phone: phoneCol ? String(row[phoneCol] || '').trim() : '',
          email: emailCol ? String(row[emailCol] || '').trim() : '',
          name: nameCol ? String(row[nameCol] || '').trim() : ''
        }));

        // Chunk requests of 200 items to prevent gate timeout
        const chunkSize = 200;
        let allResults: any[] = [];
        for (let i = 0; i < mappedLeads.length; i += chunkSize) {
          const chunk = mappedLeads.slice(i, i + chunkSize);
          const res = await fetchAPI('batch_check_duplicates', {
            method: 'POST',
            body: JSON.stringify({ leads: chunk })
          });
          if (res.success) {
            allResults = [...allResults, ...res.results];
          } else {
            throw new Error(res.message || t("Lỗi kiểm tra dữ liệu"));
          }
        }
        setCheckedResults(allResults);
        setImportSubTab('list');
        toast.success(t('Đã hoàn tất lọc trùng {count} dòng.').replace('{count}', String(allResults.length)));
      } catch (err: any) {
        toast.error(t("Lỗi lọc trùng: ") + err.message);
      }
      setChecking(false);
    } else {
      setChecking(true);
      try {
        const res = await fetchAPI('check_sheet_duplicates', {
          method: 'POST',
          body: JSON.stringify({ connection_id: Number(selectedSheetId) })
        });
        if (res.success) {
          setCheckedResults(res.results);
          setImportSubTab('list');
          toast.success(t('Đã hoàn tất lọc trùng {count} dòng từ Google Sheet.').replace('{count}', String(res.results.length)));
        } else {
          toast.error(res.message || t("Lỗi khi tải và kiểm tra dữ liệu Google Sheet."));
        }
      } catch (err: any) {
        toast.error(t("Lỗi: ") + err.message);
      }
      setChecking(false);
    }
  };

  const handleImportLeads = () => {
    if (selectedSheetId !== 'local') {
      toast.error(t("Tính năng nhập dữ liệu trực tiếp hiện tại chỉ áp dụng khi tải file Excel hoặc CSV từ máy tính."));
      return;
    }
    if (localRows.length === 0) {
      toast.error(t("Vui lòng tải lên file Excel hoặc CSV!"));
      return;
    }
    if (!phoneCol && !emailCol) {
      toast.error(t("Vui lòng chọn ít nhất cột Số điện thoại hoặc Email để lọc trùng và nhập liệu!"));
      return;
    }
    setConfirmImportOpen(true);
  };

  const executeImportLeads = async () => {
    setConfirmImportOpen(false);
    setImporting(true);
    try {
      const mappedLeads = localRows.map(row => ({
        phone: phoneCol ? String(row[phoneCol] || '').trim() : '',
        email: emailCol ? String(row[emailCol] || '').trim() : '',
        name: nameCol ? String(row[nameCol] || '').trim() : '',
        date: dateCol ? String(row[dateCol] || '').trim() : '',
        saleperson: salepersonCol ? String(row[salepersonCol] || '').trim() : ''
      }));

      const chunkSize = 200;
      let totalNew = 0;
      let totalDup = 0;
      let totalImported = 0;

      for (let i = 0; i < mappedLeads.length; i += chunkSize) {
        const chunk = mappedLeads.slice(i, i + chunkSize);
        const res = await fetchAPI('batch_import_leads', {
          method: 'POST',
          body: JSON.stringify({
            leads: chunk,
            is_silent: 1,
            sync_saleperson: 0
          })
        });
        if (res.success) {
          totalNew += res.new_count || 0;
          totalDup += res.duplicate_count || 0;
          totalImported += res.imported_count || 0;
        } else {
          throw new Error(res.message || t("Lỗi nhập dữ liệu"));
        }
      }

      toast.success(t('Nhập dữ liệu thành công! Đã xử lý {total} dòng ({newCount} lead mới, {dupCount} lead trùng).').replace('{total}', String(totalImported)).replace('{newCount}', String(totalNew)).replace('{dupCount}', String(totalDup)));

      // Clear file state, results state and show the list sub-tab with refreshed history
      setCheckedResults([]);
      setLocalFile(null);
      setLocalRows([]);
      setHeaders([]);
      setPhoneCol('');
      setEmailCol('');
      setNameCol('');
      setDateCol('');
      setSalepersonCol('');
      setImportSubTab('list');
      setHistoryPage(1);
      await fetchImportHistory(1);
    } catch (err: any) {
      toast.error(t("Lỗi nhập dữ liệu: ") + err.message);
    }
    setImporting(false);
  };

  const handleExportResults = () => {
    if (!checkedResults || checkedResults.length === 0) return;

    // Combine original rows with checking results
    const exportData = checkedResults.map((res, idx) => {
      const original = selectedSheetId === 'local' ? (localRows[idx] || {}) : { [t('Họ và tên')]: res.name, [t('Số điện thoại')]: res.phone, [t('Email')]: res.email };
      return {
        ...original,
        [t('Trạng thái CRM')]: res.has_record ? t('TRÙNG LẶP') : t('MỚI HOÀN TOÀN'),
        [t('Sale cũ sở hữu')]: res.consultant_name || '',
        [t('Trạng thái Sale cũ')]: res.consultant_status === 'active' ? t('Đang hoạt động') : (res.consultant_status === 'leave' ? t('Nghỉ phép') : t('Ngưng hoạt động')),
        [t('Thời gian tương tác cuối')]: res.last_interaction_date || '',
        [t('Số tháng kể từ tương tác cuối')]: res.months_since_last_interaction !== null ? Number(res.months_since_last_interaction).toFixed(1) : ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t("Kết quả lọc trùng"));
    XLSX.writeFile(workbook, `Ket_qua_loc_trung_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(t("Đã xuất file kết quả lọc trùng thành công!"));
  };

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
            <Settings2 size={24} color="var(--color-primary)" /> {t('Cài đặt Hệ thống')}
          </h1>
          <p className="page-subtitle">{t('Cấu hình Email, Webhooks và các tích hợp nâng cao.')}</p>
        </div>
        <button className="btn primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? <Activity size={16} className="spin" /> : <Save size={16} />}
          <span className="hide-on-mobile">{t('Lưu cấu hình')}</span>
        </button>
      </div>

      {/* Mobile Tab Selector */}
      <div className="mobile-only" style={{ marginBottom: '1.5rem' }}>
        <CustomSelect
          options={tabOptions}
          value={activeTab}
          onChange={(val) => setActiveTab(val)}
          width="100%"
        />
      </div>

      <div className="mobile-filter-tabs hide-on-mobile" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setActiveTab('processing')}
          style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: activeTab === 'processing' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'processing' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
        >
          <SettingsIcon size={18} /> {t('Cấu hình Xử lý')}
        </button>
        <button
          onClick={() => setActiveTab('communications')}
          style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: activeTab === 'communications' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'communications' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
        >
          <Send size={18} /> {t('Cấu hình Gửi tin & Email')}
        </button>
        <button
          onClick={() => setActiveTab('report')}
          style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: activeTab === 'report' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'report' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
        >
          <BarChart2 size={18} /> Báo cáo
        </button>
        <button
          onClick={() => setActiveTab('duplicate_check')}
          style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: activeTab === 'duplicate_check' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'duplicate_check' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
        >
          <FileSpreadsheet size={18} /> Ánh xạ dữ liệu cũ
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: activeTab === 'ai' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'ai' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
        >
          <Zap size={18} /> Cấu hình Trợ lý AI
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
          <div style={{ flex: (activeTab === 'duplicate_check' || activeTab === 'ai') ? 1 : 2, display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, width: '100%' }}>
            {/* AI Assistant Tab Content */}
            <div style={{ display: activeTab === 'ai' ? 'block' : 'none', animation: activeTab === 'ai' ? 'fadeIn 0.2s ease-out' : 'none' }}>
              <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', background: 'var(--color-primary)', color: 'white', padding: 6, borderRadius: 6 }}>
                    <Zap size={16} />
                  </span>
                  {t('Cấu hình Trợ lý AI (Gemini Key)')}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {t('Cấu hình khóa kết nối Google Gemini API để Trợ lý AI Chatbot có thể đọc dữ liệu thống kê trực tiếp và trả lời một cách thông minh, linh hoạt cho người dùng bằng mô hình')} <strong>Gemini 2.5 Flash Lite</strong>.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                    {t('Gemini API Key')}
                  </label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={e => setGeminiApiKey(e.target.value)}
                    placeholder={t("Nhập API Key của Google Gemini (AIzaSy...)")}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      width: '100%'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {t('Khóa API này được lưu trữ an toàn ở phía máy chủ và được sử dụng làm thông tin xác thực để gửi truy vấn trực tiếp đến Google Gemini.')}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                    {t('Mô hình AI sử dụng (AI Model)')}
                  </label>
                  <input
                    type="text"
                    value={geminiModel}
                    onChange={e => setGeminiModel(e.target.value)}
                    placeholder="gemini-2.5-flash"
                    style={{
                      padding: '10px 12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      width: '100%'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {t('Mặc định sử dụng')} <strong>gemini-2.5-flash</strong> {t('(hoặc bạn có thể chỉ định mô hình tương thích khác như')} <code>gemini-2.5-flash-lite</code> {t('nếu cần).')}
                  </span>
                </div>
              </div>


            </div>

            <div style={{ display: activeTab === 'duplicate_check' ? 'block' : 'none', animation: activeTab === 'duplicate_check' ? 'fadeIn 0.2s ease-out' : 'none' }}>
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {checkedResults.length > 0 ? (
                  // Screen 1: Checked Results Table
                  (() => {
                    const total = checkedResults.length;
                    const dupCount = checkedResults.filter(r => r.has_record).length;
                    const newCount = total - dupCount;
                    const dupPercent = ((dupCount / total) * 100).toFixed(1);
                    const newPercent = ((newCount / total) * 100).toFixed(1);

                    const filtered = checkedResults.filter(res => {
                      if (filterType === 'duplicate' && !res.has_record) return false;
                      if (filterType === 'new' && res.has_record) return false;
                      if (searchTerm) {
                        const search = searchTerm.toLowerCase();
                        return String(res.phone || '').toLowerCase().includes(search) ||
                          String(res.email || '').toLowerCase().includes(search) ||
                          String(res.name || '').toLowerCase().includes(search);
                      }
                      return true;
                    });

                    const pageSize = 50;
                    const totalPages = Math.ceil(filtered.length / pageSize);
                    const paginatedResults = filtered.slice((resultsPage - 1) * pageSize, resultsPage * pageSize);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Results Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                              <span style={{ display: 'inline-flex', background: 'var(--color-primary)', color: 'white', padding: 4, borderRadius: 6 }}>
                                <RefreshCw size={16} />
                              </span>
                              Kết quả lọc trùng
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                              Tổng cộng {total} dòng dữ liệu vừa được kiểm tra trùng lặp với hệ thống CRM.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setCheckedResults([]);
                              setLocalFile(null);
                              setLocalRows([]);
                              setImportSubTab('list');
                            }}
                            className="btn outline"
                            style={{ gap: 6, padding: '8px 16px', height: 38, fontWeight: 700, borderColor: '#ef4444', color: '#ef4444' }}
                          >
                            ← Quay lại Lịch sử
                          </button>
                        </div>

                        {/* Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                          <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Tổng Data')}</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 4 }}>{total}</div>
                          </div>
                          <div style={{ background: 'var(--color-danger-light)', padding: '1rem', borderRadius: 10, border: '1px solid var(--color-danger-light)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-danger)', textTransform: 'uppercase' }}>{t('Trùng CRM')}</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              {dupCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-danger)' }}>({dupPercent}%)</span>
                            </div>
                          </div>
                          <div style={{ background: 'var(--color-success-light)', padding: '1rem', borderRadius: 10, border: '1px solid var(--color-success-light)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)', textTransform: 'uppercase' }}>{t('Mới hoàn toàn')}</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              {newCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-success)' }}>({newPercent}%)</span>
                            </div>
                          </div>
                        </div>

                        {/* Filters */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className={`btn ${filterType === 'all' ? 'primary' : 'outline'}`} style={{ padding: '6px 12px', fontSize: '0.8rem', height: 32 }} onClick={() => { setFilterType('all'); setResultsPage(1); }}>Tất cả ({total})</button>
                            <button type="button" className={`btn ${filterType === 'duplicate' ? 'danger' : 'outline'}`} style={{ padding: '6px 12px', fontSize: '0.8rem', height: 32, background: filterType === 'duplicate' ? 'var(--color-danger)' : '', color: filterType === 'duplicate' ? 'white' : '' }} onClick={() => { setFilterType('duplicate'); setResultsPage(1); }}>Trùng lặp ({dupCount})</button>
                            <button type="button" className={`btn ${filterType === 'new' ? 'success' : 'outline'}`} style={{ padding: '6px 12px', fontSize: '0.8rem', height: 32, background: filterType === 'new' ? 'var(--color-success)' : '', color: filterType === 'new' ? 'white' : '' }} onClick={() => { setFilterType('new'); setResultsPage(1); }}>Mới ({newCount})</button>
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%', maxWidth: '400px', flex: '1 1 300px' }}>
                            <input className="form-input" placeholder={t("Tìm kiếm theo Tên, SĐT, Email...")} value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setResultsPage(1); }} style={{ height: 34, fontSize: '0.825rem' }} />
                            <button type="button" className="btn success" style={{ gap: 6, padding: '6px 14px', height: 34, flexShrink: 0, fontWeight: 700 }} onClick={handleExportResults}><Download size={14} /> {t('Xuất File')}</button>
                          </div>
                        </div>

                        {/* Table View */}
                        <div className="responsive-table-wrap" style={{ border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto', maxHeight: '550px', overflowY: 'auto', background: 'var(--color-surface)' }}>
                          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--color-bg)' }}>
                                <th style={{ ...thStyle, width: '50px' }}>{t('STT')}</th>
                                <th style={thStyle}>{t('Khách hàng')}</th>
                                <th style={thStyle}>{t('Liên hệ')}</th>
                                <th style={thStyle}>{t('Sale Sở Hữu')}</th>
                                <th style={thStyle}>{t('Tương Tác Cuối')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedResults.length > 0 ? (
                                paginatedResults.map((item, idx) => {
                                  const globalIdx = (resultsPage - 1) * pageSize + idx + 1;
                                  const statusBadge = item.has_record
                                    ? <span className="badge danger" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>{t('TRÙNG CRM')}</span>
                                    : <span className="badge success" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>{t('MỚI')}</span>;

                                  let ownerStatusBadge = null;
                                  if (item.consultant_status) {
                                    const statusBg = item.consultant_status === 'active' ? 'var(--color-success-light)' : (item.consultant_status === 'leave' ? 'var(--color-warning-light)' : 'var(--color-border)');
                                    const statusText = item.consultant_status === 'active' ? 'var(--color-success)' : (item.consultant_status === 'leave' ? 'var(--color-warning)' : 'var(--color-text-muted)');
                                    const statusLabel = item.consultant_status === 'active' ? t('Hoạt động') : (item.consultant_status === 'leave' ? t('Nghỉ phép') : t('Nghỉ việc'));
                                    ownerStatusBadge = <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 4, background: statusBg, color: statusText, fontWeight: 700, marginLeft: 6 }}>{statusLabel}</span>;
                                  }

                                  return (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', transition: 'background-color 0.15s' }}>
                                      <td style={{ padding: '10px 16px', color: 'var(--color-text-muted)' }}>{globalIdx}</td>
                                      <td style={{ padding: '10px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                          <Avatar name={item.name || t('Không có tên')} size={32} />
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ fontWeight: 600 }}>{item.name || <em style={{ color: '#cbd5e1', fontWeight: 400 }}>{t('Chưa cập nhật')}</em>}</span>
                                            <div>{statusBadge}</div>
                                          </div>
                                        </div>
                                      </td>
                                      <td style={{ padding: '10px 16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{item.phone ? maskPhone(item.phone) : <em style={{ color: '#cbd5e1', fontWeight: 400 }}>{t('Trống')}</em>}</span>
                                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>{item.email ? maskEmail(item.email) : <em style={{ color: '#cbd5e1', fontWeight: 400 }}>{t('Trống')}</em>}</span>
                                        </div>
                                      </td>
                                      <td style={{ padding: '10px 16px' }}>
                                        {item.consultant_name ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Avatar src={consultants.find(c => c.name === item.consultant_name)?.avatar} name={item.consultant_name} size={24} />
                                            <strong style={{ fontWeight: 600 }}>{item.consultant_name}</strong>
                                            {ownerStatusBadge}
                                          </div>
                                        ) : <span style={{ color: 'var(--color-text-muted)' }}>-</span>}
                                      </td>
                                      <td style={{ padding: '10px 16px', color: 'var(--color-text-muted)' }}>
                                        {item.last_interaction_date ? (
                                          <span>
                                            {item.last_interaction_date.split(' ')[0]}
                                            <br /><span style={{ fontSize: '0.75rem' }}>({item.months_since_last_interaction !== null ? Number(item.months_since_last_interaction).toFixed(1) : ''} tháng)</span>
                                          </span>
                                        ) : <span>-</span>}
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>{t('Không tìm thấy kết quả phù hợp.')}</td></tr>}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination Footer */}
                        {totalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
                              Hiển thị {(resultsPage - 1) * pageSize + 1} - {Math.min(resultsPage * pageSize, filtered.length)} trên {filtered.length} dòng
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn outline"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                                disabled={resultsPage === 1}
                                onClick={() => setResultsPage(p => p - 1)}
                              >
                                Trước
                              </button>
                              <span style={{ padding: '4px 10px', fontSize: '0.775rem', fontWeight: 600 }}>
                                Trang {resultsPage} / {totalPages}
                              </span>
                              <button
                                type="button"
                                className="btn outline"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                                disabled={resultsPage === totalPages}
                                onClick={() => setResultsPage(p => p + 1)}
                              >
                                Sau
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : importSubTab === 'upload' ? (
                  // Screen 2: Upload / Mapping UI
                  <>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                          <span style={{ display: 'inline-flex', background: 'var(--color-primary)', color: 'white', padding: 4, borderRadius: 6 }}>
                            <Upload size={16} />
                          </span>
                          Nhập dữ liệu mới từ File
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                          Tải lên file Excel hoặc CSV chứa dữ liệu khách hàng cũ để đồng bộ và lưu vào CRM làm dữ liệu đối chiếu trùng lặp.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setImportSubTab('list');
                          setLocalFile(null);
                          setLocalRows([]);
                        }}
                        className="btn outline"
                        style={{ gap: 6, padding: '8px 16px', height: 38, fontWeight: 700 }}
                      >
                        ← Quay lại danh sách
                      </button>
                    </div>

                    {/* File Upload Zone */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderBottom: '1px dashed var(--color-border)', paddingBottom: '1.25rem' }}>
                      <div style={{ width: '100%' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Chọn file hoặc kéo thả (.xlsx, .xls, .csv)')}</label>
                        <div style={{ position: 'relative', width: '100%' }}>
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            id="bulk-file-upload"
                          />
                          {localFile ? (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 16px',
                              border: '1px solid var(--color-border)',
                              borderRadius: 10,
                              background: '#f0fdf4',
                              borderLeft: '4px solid #10b981',
                              width: '100%'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ background: '#d1fae5', padding: 8, borderRadius: 8, color: '#047857', display: 'flex', alignItems: 'center' }}>
                                  <FileSpreadsheet size={18} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                                    {localFile.name}
                                  </div>
                                  <div style={{ fontSize: '0.725rem', color: '#047857', fontWeight: 500 }}>
                                    {(localFile.size / 1024).toFixed(1)} KB • {localRows.length} dòng dữ liệu
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setLocalFile(null);
                                  setLocalRows([]);
                                  setHeaders([]);
                                  setPhoneCol('');
                                  setEmailCol('');
                                  setNameCol('');
                                  setDateCol('');
                                  setSalepersonCol('');
                                  setCheckedResults([]);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: 6,
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-danger-light)'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <label
                              htmlFor="bulk-file-upload"
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                e.currentTarget.style.background = 'var(--color-border-light)';
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                e.currentTarget.style.background = 'var(--color-bg)';
                              }}
                              onDrop={handleFileDrop}
                              style={{
                                width: '100%',
                                minHeight: '110px',
                                border: '2px dashed var(--color-border)',
                                background: 'var(--color-bg)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                borderRadius: '10px',
                                padding: '16px',
                                transition: 'all 0.2s ease-in-out'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                e.currentTarget.style.background = '#f1f5f9';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                e.currentTarget.style.background = '#f8fafc';
                              }}
                            >
                              <div style={{
                                display: 'inline-flex',
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: 'var(--color-primary)',
                                padding: '8px',
                                borderRadius: '50%'
                              }}>
                                <Upload size={20} />
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                  Nhấp để duyệt tệp hoặc kéo thả vào đây
                                </span>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                                  Hỗ trợ định dạng .xlsx, .xls, .csv
                                </p>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Column Mapping */}
                    {headers.length > 0 && (
                      <div style={{ background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <SettingsIcon size={14} /> {t('Ánh xạ cột lọc trùng')}
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('Cột Số Điện Thoại (Bắt buộc)')}</label>
                            <CustomSelect
                              options={[{ value: '', label: t('-- Chọn cột --') }, ...headers.map(h => ({ value: h, label: h }))]}
                              value={phoneCol}
                              onChange={val => setPhoneCol(String(val))}
                              width="100%"
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('Cột Email (Tùy chọn)')}</label>
                            <CustomSelect
                              options={[{ value: '', label: t('-- Chọn cột --') }, ...headers.map(h => ({ value: h, label: h }))]}
                              value={emailCol}
                              onChange={val => setEmailCol(String(val))}
                              width="100%"
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('Cột Họ Tên (Tùy chọn)')}</label>
                            <CustomSelect
                              options={[{ value: '', label: t('-- Chọn cột --') }, ...headers.map(h => ({ value: h, label: h }))]}
                              value={nameCol}
                              onChange={val => setNameCol(String(val))}
                              width="100%"
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>
                              {t('Cột Ngày (Tùy chọn)')}
                            </label>
                            <CustomSelect
                              options={[{ value: '', label: t('-- Chọn cột --') }, ...headers.map(h => ({ value: h, label: h }))]}
                              value={dateCol}
                              onChange={val => setDateCol(String(val))}
                              width="100%"
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>
                              {t('Cột Sale phụ trách (Tùy chọn)')}
                            </label>
                            <CustomSelect
                              options={[{ value: '', label: t('-- Chọn cột --') }, ...headers.map(h => ({ value: h, label: h }))]}
                              value={salepersonCol}
                              onChange={val => setSalepersonCol(String(val))}
                              width="100%"
                            />
                          </div>
                        </div>
                        <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: '8px 0 0', lineHeight: 1.4 }}>
                          {t('* Định dạng ngày được chấp nhận:')} <strong>dd-mm-yyyy</strong> {t('(ví dụ: 20-05-2026) hoặc')} <strong>yyyy-mm-dd</strong>{t('. Hệ thống sẽ tự động đưa về định dạng chuẩn của ngày và bỏ qua phần giờ để so khớp đối chiếu hợp lý.')}
                        </p>
                      </div>
                    )}

                    {/* Cấu hình lưu dữ liệu vào CRM */}
                    {headers.length > 0 && (
                      <div style={{ background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 10, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Shield size={14} color="var(--color-primary)" /> Quy tắc nhập dữ liệu vào CRM
                        </h4>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                          {t('Tất cả dữ liệu ánh xạ lịch sử khi nhập')} <strong>{t('luôn luôn chạy ở chế độ Đồng bộ ngầm (Silent Mode)')}</strong>{t('. Hệ thống sẽ chỉ ghi nhận lịch sử và gán cho Sale sở hữu mà không phân bổ lại cho Sale khác, đồng thời hoàn toàn không gửi bất kỳ thông báo nhắc nhở nào để tránh gây phiền hà cho đội ngũ Sale.')}
                        </div>
                      </div>
                    )}

                    {/* Submit Actions */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'flex-start' }}>
                      <button
                        type="button"
                        onClick={handleRunBatchCheck}
                        disabled={checking || localRows.length === 0}
                        style={{
                          minWidth: 160,
                          height: 42,
                          fontWeight: 700,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                          color: 'white',
                          border: 'none',
                          cursor: checking || localRows.length === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {checking ? <Activity size={16} className="spin" /> : t("Chạy lọc trùng")}
                      </button>
                      <button
                        type="button"
                        onClick={handleImportLeads}
                        disabled={checking || importing || localRows.length === 0}
                        style={{
                          minWidth: 180,
                          height: 42,
                          fontWeight: 700,
                          gap: 8,
                          borderRadius: 8,
                          background: checking || importing || localRows.length === 0 ? '#e2e8f0' : 'linear-gradient(135deg, var(--color-primary) 0%, #2563eb 100%)',
                          color: checking || importing || localRows.length === 0 ? '#94a3b8' : 'white',
                          border: 'none',
                          cursor: checking || importing || localRows.length === 0 ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: checking || importing || localRows.length === 0 ? 'none' : '0 4px 6px -1px rgba(59, 130, 246, 0.2), 0 2px 4px -1px rgba(59, 130, 246, 0.1)',
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        {importing ? (
                          <>
                            <Activity size={16} className="spin" /> Đang nhập dữ liệu...
                          </>
                        ) : (
                          <>
                            <Database size={16} /> Bắt đầu Nhập dữ liệu
                          </>
                        )}
                      </button>
                    </div>

                    {/* Guidelines */}
                    <div style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      fontSize: '0.75rem',
                      padding: '10px 14px',
                      borderRadius: 8,
                      width: '100%',
                      textAlign: 'left',
                      lineHeight: 1.5,
                      border: '1px solid #bae6fd',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start'
                    }}>
                      <span style={{ fontSize: '1rem' }}>💡</span>
                      <div>
                        <strong>{t('Cơ chế khớp trùng CRM:')}</strong> {t('Công cụ đối chiếu thời gian thực bằng cách sử dụng chung một hàm nghiệp vụ với luồng xử lý Webhook và Google Sheets. Hệ thống chỉ đánh dấu Trùng lặp đối với Sale đang')} <strong>{t('Hoạt động')}</strong>{t('. Nếu Sale sở hữu đang')} <strong>{t('Nghỉ phép')}</strong> {t('hoặc')} <strong>{t('Nghỉ việc')}</strong>{t(', hệ thống tự động đánh dấu là lead được phép chia mới cho Sale khác.')}
                      </div>
                    </div>
                  </>
                ) : (
                  // Screen 3: Import History List
                  (() => {
                    const historyPageSize = 50;
                    const totalHistoryPages = Math.ceil(totalHistoryCount / historyPageSize);
                    const paginatedHistory = importHistory;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* History Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                              <span style={{ display: 'inline-flex', background: 'var(--color-primary)', color: 'white', padding: 4, borderRadius: 6 }}>
                                <RefreshCw size={16} />
                              </span>
                              Ánh xạ dữ liệu cũ (Bulk Duplicate Checker)
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                              Hiển thị lịch sử các lần đối chiếu và nhập dữ liệu cũ vào hệ thống CRM.
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {selectedLogs.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const logsToDelete = importHistory.filter(item => selectedLogs.includes(item.log_id));
                                  handleDeleteHistory(logsToDelete);
                                }}
                                className="btn danger"
                                style={{ gap: 6, padding: '8px 16px', height: 38, fontWeight: 700, display: 'flex', alignItems: 'center', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8 }}
                              >
                                <Trash2 size={16} />
                                Xóa đã chọn ({selectedLogs.length})
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setImportSubTab('upload');
                              }}
                              className="btn primary"
                              style={{ gap: 6, padding: '8px 16px', height: 38, fontWeight: 700 }}
                            >
                              + Thêm mới
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            Các bản ghi dữ liệu đã được nhập gần đây:
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            Tổng cộng: {totalHistoryCount} bản ghi
                          </span>
                        </div>

                        {/* Table View */}
                        <div className="responsive-table-wrap" style={{ border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto', maxHeight: '550px', overflowY: 'auto', background: 'var(--color-surface)' }}>
                          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--color-bg)' }}>
                                <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={paginatedHistory.length > 0 && paginatedHistory.every(item => selectedLogs.includes(item.log_id))}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const pageLogIds = paginatedHistory.map(item => item.log_id);
                                        setSelectedLogs(prev => Array.from(new Set([...prev, ...pageLogIds])));
                                      } else {
                                        const pageLogIds = paginatedHistory.map(item => item.log_id);
                                        setSelectedLogs(prev => prev.filter(id => !pageLogIds.includes(id)));
                                      }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </th>
                                <th style={{ ...thStyle, width: '50px' }}>{t('STT')}</th>
                                <th style={thStyle}>{t('Khách hàng')}</th>
                                <th style={thStyle}>{t('Liên hệ')}</th>
                                <th style={thStyle}>{t('Sale Sở Hữu')}</th>
                                <th style={thStyle}>{t('Tương Tác Cuối')}</th>
                                <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>{t('Hành động')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {loadingHistory ? (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                    {t('Đang tải lịch sử nhập...')}
                                  </td>
                                </tr>
                              ) : paginatedHistory.length > 0 ? (
                                paginatedHistory.map((item, idx) => {
                                  const globalIdx = (historyPage - 1) * historyPageSize + idx + 1;
                                  let ownerStatusBadge = null;
                                  if (item.consultant_status) {
                                    const statusBg = item.consultant_status === 'active' ? '#e6f4ea' : (item.consultant_status === 'leave' ? '#fef3c7' : '#f1f5f9');
                                    const statusText = item.consultant_status === 'active' ? '#137333' : (item.consultant_status === 'leave' ? '#b06000' : '#5f6368');
                                    const statusLabel = item.consultant_status === 'active' ? t('Hoạt động') : (item.consultant_status === 'leave' ? t('Nghỉ phép') : t('Nghỉ việc'));
                                    ownerStatusBadge = <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 4, background: statusBg, color: statusText, fontWeight: 700, marginLeft: 6 }}>{statusLabel}</span>;
                                  }

                                  const isSelected = selectedLogs.includes(item.log_id);

                                  return (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', transition: 'background-color 0.15s', backgroundColor: isSelected ? 'var(--color-bg)' : 'transparent' }}>
                                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedLogs(prev => [...prev, item.log_id]);
                                            } else {
                                              setSelectedLogs(prev => prev.filter(id => id !== item.log_id));
                                            }
                                          }}
                                          style={{ cursor: 'pointer' }}
                                        />
                                      </td>
                                      <td style={{ padding: '10px 16px', color: 'var(--color-text-muted)' }}>{globalIdx}</td>
                                      <td style={{ padding: '10px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                          <Avatar name={item.name || t('Không có tên')} size={32} />
                                          <span style={{ fontWeight: 600 }}>{item.name || <em style={{ color: '#cbd5e1', fontWeight: 400 }}>{t('Chưa cập nhật')}</em>}</span>
                                        </div>
                                      </td>
                                      <td style={{ padding: '10px 16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{item.phone ? maskPhone(item.phone) : <em style={{ color: '#cbd5e1', fontWeight: 400 }}>{t('Trống')}</em>}</span>
                                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>{item.email ? maskEmail(item.email) : <em style={{ color: '#cbd5e1', fontWeight: 400 }}>{t('Trống')}</em>}</span>
                                        </div>
                                      </td>
                                      <td style={{ padding: '10px 16px' }}>
                                        {item.consultant_name ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Avatar src={consultants.find(c => c.name === item.consultant_name)?.avatar} name={item.consultant_name} size={24} />
                                            <strong style={{ fontWeight: 600 }}>{item.consultant_name}</strong>
                                            {ownerStatusBadge}
                                          </div>
                                        ) : <span style={{ color: 'var(--color-text-muted)' }}>-</span>}
                                      </td>
                                      <td style={{ padding: '10px 16px', color: 'var(--color-text-muted)' }}>
                                        {item.last_interaction_date ? (
                                          <span>
                                            {item.last_interaction_date.split(' ')[0]}
                                          </span>
                                        ) : <span>-</span>}
                                      </td>
                                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            handleDeleteHistory([item]);
                                          }}
                                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
                                          title={t("Xóa bản ghi này")}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 2rem', color: 'var(--color-text-muted)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '1.5rem' }}>📋</span>
                                      <span>{t('Chưa có dữ liệu đối chiếu hoặc lịch sử nhập. Vui lòng bấm nút "+ Thêm mới" ở trên để bắt đầu.')}</span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination Footer */}
                        {totalHistoryPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
                              Hiển thị {(historyPage - 1) * historyPageSize + 1} - {Math.min(historyPage * historyPageSize, totalHistoryCount)} trên {totalHistoryCount} dòng
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn outline"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                                disabled={historyPage === 1}
                                onClick={() => setHistoryPage(p => p - 1)}
                              >
                                Trước
                              </button>
                              <span style={{ padding: '4px 10px', fontSize: '0.775rem', fontWeight: 600 }}>
                                Trang {historyPage} / {totalHistoryPages}
                              </span>
                              <button
                                type="button"
                                className="btn outline"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                                disabled={historyPage === totalHistoryPages}
                                onClick={() => setHistoryPage(p => p + 1)}
                              >
                                Sau
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Cấu hình Gửi tin & Email */}
            <div style={{ display: activeTab === 'communications' ? 'block' : 'none', animation: activeTab === 'communications' ? 'fadeIn 0.2s ease-out' : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
                    <Mail size={20} color="var(--color-primary)" /> Phương thức Gửi Email
                  </h3>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">{t('Chọn phương thức gửi')}</label>
                    <CustomSelect
                      options={providerOptions}
                      value={provider}
                      onChange={val => {
                        const pVal = String(val);
                        setProvider(pVal);
                        if (pVal === 'appscript') {
                          setShowInputScript(true);
                        }
                      }}
                    />
                  </div>

                  {/* BUG-02 fix: Allow admin to configure the frontend URL for email report links */}
                  <div style={{ marginBottom: '1.5rem', background: 'var(--color-bg)', padding: '1rem', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('🔗 URL Frontend (Dùng trong link Email báo cáo lỗi)')}</label>
                    <input
                      className="form-input"
                      placeholder={t("Ví dụ: https://sale.domation.net")}
                      value={frontendUrl}
                      onChange={e => setFrontendUrl(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Domain website, không có dấu / ở cuối. Dùng để tạo link báo cáo trong email gửi cho Sale.')}</p>
                  </div>

                  {provider === 'appscript' && (
                    <div style={{ animation: 'fadeIn 0.3s', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Server size={18} color="#10b981" /> {t('Cấu hình Webhook Apps Script')}
                      </h4>

                      <div style={{ marginBottom: '1rem' }}>
                        <label className="form-label">{t('Mã Code Apps Script Gửi Email (Copy 1 lần duy nhất)')}</label>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                          {t('Mã dưới đây dùng để kích hoạt tính năng')} <strong>{t('Gửi Email')}</strong> {t('qua Google. Copy mã này vào Apps Script, chọn')} <strong>Deploy as web app</strong> {t('(Quyền truy cập: Anyone), lấy URL dán vào ô bên dưới.')}
                        </p>

                        {/* Collapsible Script Block */}
                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                          <div
                            style={{ padding: '0.75rem 1rem', background: 'var(--color-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setShowInputScript(!showInputScript)}
                          >
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Xem mã Apps Script')}</span>
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
      var options = {
        to: data.email,
        subject: data.subject,
        htmlBody: data.htmlBody
      };
      if (data.cc) {
        options.cc = data.cc;
      }
      MailApp.sendEmail(options);
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
                        <label className="form-label">{t('URL Webhook của Google Apps Script (doPost)')}</label>
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
                          <label className="form-label">{t('Email Người Gửi (From Email)')}</label>
                          <input className="form-input" placeholder="no-reply@domain.com" value={sesSenderEmail} onChange={e => setSesSenderEmail(e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label">{t('Tên Người Gửi (From Name)')}</label>
                          <input className="form-input" placeholder="DOMATION TEAM" value={sesSenderName} onChange={e => setSesSenderName(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', background: '#0068ff', color: 'white', padding: 4, borderRadius: 6 }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                    </span>
                    Cấu hình Zalo Bot (Gửi thông báo Data)
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                    Tính năng này cho phép hệ thống gửi trực tiếp thông báo chia số tới Zalo của Tư vấn viên.<br />
                    Truy cập <a href="https://bot.zapps.me/" target="_blank" rel="noreferrer" style={{ color: '#0068ff', fontWeight: 600 }}>Zalo Bot Platform</a> để tạo Bot và lấy Token.
                  </p>

                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('Bot Token (Zalo cung cấp)')}</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder={t("Ví dụ: 12345689:abc-xyz")}
                        value={zaloBotToken}
                        onChange={e => setZaloBotToken(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('Secret Token (Webhook bảo mật)')}</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder={t("Nhập Secret Token tự chọn (Ví dụ: MY_SECRET_123)")}
                        value={zaloWebhookSecret}
                        onChange={e => setZaloWebhookSecret(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('Link Zalo Bot (zalo.me/xxx)')}</label>
                    <input
                      className="form-input"
                      placeholder={t("VD: https://zalo.me/1185588456243371597")}
                      value={zaloBotLink}
                      onChange={e => setZaloBotLink(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {t('Link chèn vào Email chào mừng TVV.')}
                    </p>
                  </div>

                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1rem' }}>
                    <label className="form-label">{t('Link Webhook khai báo trên Zalo Bot Platform:')}</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <code style={{ flex: 1, background: 'var(--color-bg)', padding: '0.5rem', borderRadius: 6, fontSize: '0.875rem', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}>
                        https://open.domation.net/sale_data/zalo_webhook.php
                      </code>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
                      {t('Copy link Webhook này và Secret Token (nếu có) dán vào phần thiết lập Webhook của Zalo Bot.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== TAB: BÁO CÁO NGÀY ===== */}
            <div style={{ display: activeTab === 'report' ? 'block' : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: activeTab === 'report' ? 'fadeIn 0.2s ease-out' : 'none' }}>

                {/* Giờ gửi */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', background: 'var(--color-primary)', color: 'white', padding: 4, borderRadius: 6 }}><Clock size={16} /></span>
                    {t('Lịch gửi Báo cáo Tự động')}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.875rem 1rem', minWidth: 220 }}>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
                        <strong>{t('Cửa sổ thời gian:')}</strong> {t('Nếu gửi lúc')} <strong>{zaloDailyReportTime || '17:00'}</strong>, {t('hệ thống sẽ tổng kết chia số từ')} <strong>{zaloDailyReportTime || '17:00'} {t('hôm qua')}</strong> {t('đến')} <strong>{zaloDailyReportTime || '17:00'} {t('hôm nay')}</strong> — {t('không bỏ sót data đêm.')}
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

                {/* Báo cáo Tuần */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', background: '#8b5cf6', color: 'white', padding: 4, borderRadius: 6 }}><BarChart2 size={16} /></span>
                    {t('Lịch gửi Báo cáo Tuần (cho Sale)')}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                    {t('Tự động gửi thống kê nhận data và tình trạng ticket đền bù của tuần qua trực tiếp cho từng Sale qua Email và Zalo.')}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label className="form-label">{t('Ngày gửi trong tuần')}</label>
                      <CustomSelect
                        options={[
                          { value: '0', label: t('Tắt báo cáo tuần') },
                          { value: '1', label: t('Thứ 2 hàng tuần') },
                          { value: '2', label: t('Thứ 3 hàng tuần') },
                          { value: '3', label: t('Thứ 4 hàng tuần') },
                          { value: '4', label: t('Thứ 5 hàng tuần') },
                          { value: '5', label: t('Thứ 6 hàng tuần') },
                          { value: '6', label: t('Thứ 7 hàng tuần') },
                          { value: '7', label: t('Chủ Nhật hàng tuần') }
                        ]}
                        value={zaloWeeklyReportDay}
                        onChange={val => setZaloWeeklyReportDay(val.toString())}
                        width="100%"
                      />
                    </div>
                    <div style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column' }}>
                      <label className="form-label">{t('Giờ gửi báo cáo')}</label>
                      <input
                        type="time"
                        className="form-input"
                        value={zaloWeeklyReportTime}
                        onChange={e => setZaloWeeklyReportTime(e.target.value)}
                        style={{ flex: 1, height: '42px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Chọn Admin nhận báo cáo */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', background: '#0ea5e9', color: 'white', padding: 4, borderRadius: 6 }}><Users size={16} /></span>
                    {t('Admin nhận Báo cáo')}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                    {t('Chọn các tài khoản sẽ nhận báo cáo qua')} <strong>{t('Email')}</strong> {t('và')} <strong>{t('Zalo Bot')}</strong>. {t('Nếu không chọn, hệ thống sẽ gửi cho tất cả Admin.')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {accounts.filter(a => a.role === 'admin' || Number(a.id) === 1).map((admin: any) => {
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
                          <Avatar src={admin.avatar} name={admin.name || admin.username} size={36} />
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
                                  <MessageCircle size={11} /> {t('Zalo đã liên kết')}
                                </span>
                              ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b' }}>
                                  <MessageCircle size={11} /> {t('Chưa liên kết Zalo')}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span style={{ background: 'var(--color-primary)', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, flexShrink: 0 }}>{t('Đã chọn')}</span>
                          )}
                        </label>
                      );
                    })}
                    {accounts.filter(a => a.role === 'admin' || Number(a.id) === 1).length === 0 && (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>{t('Chưa có tài khoản Admin nào trong hệ thống.')}</p>
                    )}
                  </div>
                  {dailyReportAdmins.length === 0 && (
                    <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Activity size={14} style={{ color: '#b45309', flexShrink: 0 }} />
                      <p style={{ fontSize: '0.8125rem', color: '#92400e', margin: 0 }}>{t('Chưa chọn Admin nào — hệ thống sẽ tự động gửi cho')} <strong>{t('tất cả tài khoản Admin')}</strong>.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fallback & Blacklist Configs (Processing Tab) */}
            <div style={{ display: activeTab === 'processing' ? 'block' : 'none', animation: activeTab === 'processing' ? 'fadeIn 0.2s ease-out' : 'none' }}>
              <div className="card" style={{ padding: '1.5rem', marginTop: 0 }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', background: '#ef4444', color: 'white', padding: 4, borderRadius: 6 }}>
                    <Zap size={16} />
                  </span>
                  {t('Cấu hình Xử lý Fallback (Khi không khớp luật)')}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  {t('Khi dữ liệu (leads) mới được đẩy vào hệ thống mà')} <strong>{t('không khớp với bất kỳ quy luật định tuyến nào')}</strong>{t(', hệ thống sẽ tự động xử lý theo một trong các tùy chọn dưới đây.')}
                </p>

                {/* Selector for Fallback Type */}
                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '1.25rem',
                      borderRadius: '14px',
                      border: fallbackType === 'round' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: fallbackType === 'round' ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      boxShadow: fallbackType === 'round' ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative'
                    }}
                    className="hover-lift"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: fallbackType === 'round' ? '5px solid var(--color-primary)' : '2px solid var(--color-text-muted)',
                        background: 'var(--color-surface)',
                        transition: 'all 0.2s',
                        flexShrink: 0
                      }} />
                      <input
                        type="radio"
                        name="fallbackType"
                        value="round"
                        checked={fallbackType === 'round'}
                        onChange={() => setFallbackType('round')}
                        style={{ display: 'none' }}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={16} style={{ color: fallbackType === 'round' ? 'var(--color-primary)' : 'var(--color-text-light)' }} />
                        {t('Phân bổ theo Vòng mặc định')}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', paddingLeft: '28px', lineHeight: 1.4 }}>
                      {t('Chia đều cho các sale trong Vòng được chọn theo cơ chế Round-Robin.')}
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '1.25rem',
                      borderRadius: '14px',
                      border: fallbackType === 'admin' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: fallbackType === 'admin' ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      boxShadow: fallbackType === 'admin' ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative'
                    }}
                    className="hover-lift"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: fallbackType === 'admin' ? '5px solid var(--color-primary)' : '2px solid var(--color-text-muted)',
                        background: 'var(--color-surface)',
                        transition: 'all 0.2s',
                        flexShrink: 0
                      }} />
                      <input
                        type="radio"
                        name="fallbackType"
                        value="admin"
                        checked={fallbackType === 'admin'}
                        onChange={() => setFallbackType('admin')}
                        style={{ display: 'none' }}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserCheck size={16} style={{ color: fallbackType === 'admin' ? 'var(--color-primary)' : 'var(--color-text-light)' }} />
                        {t('Giao cho Admin')}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', paddingLeft: '28px', lineHeight: 1.4 }}>
                      {t('Gửi trực tiếp đến Admin được chỉ định và gửi email CC đến các địa chỉ cấu hình.')}
                    </span>
                  </label>
                </div>

                {fallbackType === 'round' ? (
                  <div style={{ animation: 'fadeIn 0.3s' }}>
                    <label className="form-label">{t('Chọn Vòng phân bổ mặc định')}</label>
                    <CustomSelect
                      options={[
                        { value: '', label: t('-- Không sử dụng (Để trống trạng thái Chưa phân bổ) --') },
                        ...rounds.map(r => ({
                          value: r.id.toString(),
                          label: `${r.round_name} (${Number(r.is_active) === 1 ? t('Đang hoạt động') : t('Tạm dừng')})`,
                          disabled: Number(r.is_active) !== 1,
                          disabledType: 'round' as const
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
                      <label className="form-label">{t('Chọn tài khoản Admin nhận data')}</label>
                      <CustomSelect
                        options={[
                          { value: '', label: t('-- Chọn Admin nhận data --') },
                          ...accounts.filter(a => a.role === 'admin' || Number(a.id) === 1).map(a => ({
                            value: a.id.toString(),
                            label: a.name,
                            sublabel: a.email,
                            avatar: a.avatar
                          }))
                        ]}
                        value={fallbackAdminId}
                        onChange={val => setFallbackAdminId(val.toString())}
                        width="100%"
                        showAvatars={true}
                      />
                    </div>
                    <div>
                      <label className="form-label">{t('Địa chỉ Email CC khi xảy ra Fallback')}</label>
                      <input
                        className="form-input"
                        placeholder={t("Ví dụ: manager@company.com, admin@company.com")}
                        value={fallbackCcEmail}
                        onChange={e => setFallbackCcEmail(e.target.value)}
                      />
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {t('Ngăn cách nhiều email bằng dấu phẩy. Hệ thống sẽ gửi bản sao thông báo data fallback về các email này.')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Cấu hình Tự động duyệt Ticket */}
              <div id="auto-approve" className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', background: '#10b981', color: 'white', padding: 4, borderRadius: 6 }}>
                    <CheckCircle size={16} />
                  </span>
                  {t('Cấu hình Tự Động Duyệt Ticket')}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  {t('Tự động phê duyệt và cộng lượt đền bù khi lý do báo lỗi của Sale chứa các từ khóa định sẵn. Đồng thời gửi thông báo Zalo/Email tự động.')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9rem' }}>{t('Kích hoạt Tự động duyệt')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {t('Cho phép hệ thống quét từ khóa và tự động duyệt khi Sale gửi ticket báo lỗi')}
                      </div>
                    </div>
                    <div
                      onClick={() => setTicketAutoApproveEnabled(!ticketAutoApproveEnabled)}
                      style={{
                        width: 40, height: 22, borderRadius: 11,
                        background: ticketAutoApproveEnabled ? 'var(--color-success)' : 'var(--color-border)',
                        position: 'relative', transition: 'background 0.2s', cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
                        background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        left: ticketAutoApproveEnabled ? 21 : 3, transition: 'left 0.2s'
                      }} />
                    </div>
                  </div>

                  {ticketAutoApproveEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.95rem' }}>
                          {t('Danh sách luật duyệt tự động')}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRule(null);
                            setRuleName('');
                            setRuleActive(true);
                            setRuleRounds(['all']);
                            setRuleSales(['all']);
                            setRuleConnections(['all']);
                            setRuleKeywords('');
                            setRuleModalOpen(true);
                          }}
                          className="btn btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.85rem' }}
                        >
                          <Plus size={16} /> {t('Thêm Luật Mới')}
                        </button>
                      </div>

                      {ticketAutoApproveRules.length === 0 ? (
                        <div style={{
                          textAlign: 'center', padding: '2rem', border: '2px dashed var(--color-border)',
                          borderRadius: 'var(--radius-lg)', color: 'var(--color-text-muted)', fontSize: '0.875rem'
                        }}>
                          {t('Chưa có luật tự động duyệt nào. Nhấp "Thêm Luật Mới" để bắt đầu thiết lập.')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {ticketAutoApproveRules.map((rule) => {
                            // Gather human-friendly names
                            const targetRounds = rule.rounds.includes('all')
                              ? t('Tất cả vòng')
                              : rounds.filter(r => rule.rounds.map(String).includes(String(r.id))).map(r => r.round_name).join(', ') || t('Không xác định');

                            const targetSales = rule.sales.includes('all')
                              ? t('Tất cả Salepersons')
                              : consultants.filter(c => rule.sales.map(String).includes(String(c.id))).map(c => c.name).join(', ') || t('Không xác định');

                            const targetConns = (rule.connections || []).includes('all') || !rule.connections
                              ? t('Tất cả nguồn')
                              : connections.filter(conn => (rule.connections || []).map(String).includes(String(conn.id))).map(conn => conn.sheet_name).join(', ') || t('Không xác định');

                            const kwList = Array.isArray(rule.keywords) ? rule.keywords : (rule.keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean);

                            return (
                              <div
                                key={rule.id}
                                style={{
                                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                                  background: rule.active ? 'var(--color-surface)' : 'rgba(0,0,0,0.02)',
                                  padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                  position: 'relative', transition: 'all 0.2s',
                                  opacity: rule.active ? 1 : 0.65
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {rule.name}
                                      {!rule.active && (
                                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 4 }}>
                                          {t('Tắt')}
                                        </span>
                                      )}
                                    </h4>
                                  </div>

                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {/* Quick toggle */}
                                    <div
                                      onClick={() => {
                                        setTicketAutoApproveRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
                                      }}
                                      style={{
                                        width: 32, height: 18, borderRadius: 9,
                                        background: rule.active ? 'var(--color-success)' : 'var(--color-border)',
                                        position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                                        alignSelf: 'center', marginRight: '0.5rem'
                                      }}
                                    >
                                      <div style={{
                                        position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
                                        background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                        left: rule.active ? 16 : 2, transition: 'left 0.2s'
                                      }} />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRule(rule);
                                        setRuleName(rule.name);
                                        setRuleActive(rule.active);
                                        setRuleRounds(rule.rounds);
                                        setRuleSales(rule.sales);
                                        setRuleConnections(rule.connections || ['all']);
                                        setRuleKeywords(Array.isArray(rule.keywords) ? rule.keywords.join(', ') : rule.keywords);
                                        setRuleModalOpen(true);
                                      }}
                                      style={{ padding: 4, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                                      className="btn-icon-hover"
                                      title={t("Chỉnh sửa")}
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(t('Bạn có chắc chắn muốn xóa luật "{name}"?').replace('{name}', rule.name))) {
                                          setTicketAutoApproveRules(prev => prev.filter(r => r.id !== rule.id));
                                        }
                                      }}
                                      style={{ padding: 4, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                                      className="btn-icon-hover"
                                      title={t("Xóa")}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* Details/Tags */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem' }}>
                                  <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{t('Vòng:')}</span>
                                    <span style={{ fontWeight: 600 }}>{targetRounds}</span>
                                  </div>
                                  <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{t('Sales:')}</span>
                                    <span style={{ fontWeight: 600 }}>{targetSales}</span>
                                  </div>
                                  <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{t('Nguồn:')}</span>
                                    <span style={{ fontWeight: 600 }}>{targetConns}</span>
                                  </div>
                                </div>

                                {/* Keywords list */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', marginTop: 2 }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginRight: 4 }}>{t('Từ khóa')} ({kwList.length}):</span>
                                  {kwList.map((kw: string, i: number) => (
                                    <span
                                      key={i}
                                      style={{
                                        fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(16,185,129,0.1)',
                                        color: 'var(--color-success)', borderRadius: 4, fontWeight: 600
                                      }}
                                    >
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cấu hình Lọc trùng */}
              <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', background: 'var(--color-primary)', color: 'white', padding: 4, borderRadius: 6 }}>
                    <RefreshCw size={16} />
                  </span>
                  {t('Cấu hình Nhận diện & Lọc Trùng Lặp')}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  {t('Nếu khách hàng đăng ký lại trong khoảng thời gian này, hệ thống sẽ bỏ qua quy trình phân chia mới và tự động định tuyến về Sale cũ phụ trách để chăm sóc tiếp.')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label className="form-label">{t('Thời hạn nhận diện trùng lặp (Tháng)')}</label>
                    <div style={{ position: 'relative', width: 200 }}>
                      <input
                        type="number"
                        min={1}
                        className="form-input"
                        value={duplicateCheckMonths}
                        onChange={e => setDuplicateCheckMonths(Math.max(1, Number(e.target.value)))}
                        style={{ paddingRight: 60 }}
                      />
                      <span style={{ position: 'absolute', right: 12, top: 10, color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>{t('Tháng')}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                      {t('Mặc định là 6 tháng. Đặt 12 tháng nếu muốn giữ khách cũ cho Sale trong vòng 1 năm.')}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <ToggleSwitch
                      checked={reassignIfOwnerInactive}
                      onChange={setReassignIfOwnerInactive}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t('Giao lại khi Sale cũ không còn hoạt động (Mặc định BẬT)')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                        {t('Nếu bật: Khi phát hiện trùng số nhưng Sale cũ phụ trách số đó đã ngừng hoạt động / nghỉ việc / nghỉ phép, lead sẽ được coi là mới và tự động chia lại cho Sale mới đang hoạt động. Nếu tắt: Giữ nguyên Sale cũ phụ trách, cập nhật tương tác mới và không phân bổ lại. (Lưu ý: Với dữ liệu ánh xạ/import lịch sử, lead luôn được giữ nguyên Sale phụ trách cũ và đồng bộ ngầm để tránh spam thông báo).')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cấu hình Ticket / Báo cáo lỗi */}
              <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', background: '#ef4444', color: 'white', padding: 4, borderRadius: 6 }}>
                    <Shield size={16} />
                  </span>
                  {t('Cấu hình Báo Cáo Lỗi & Rule Hướng Dẫn')}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  {t('Cấu hình các tùy chọn lý do báo lỗi và ghi chú quy tắc báo lỗi cụ thể cho từng lý do. Ghi chú quy tắc này sẽ hiển thị trực tiếp cho người dùng ở trang báo lỗi để hướng dẫn họ.')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {reportErrorReasons.map((item, index) => (
                      <div
                        key={index}
                        className="mobile-stack"
                        style={{
                          display: 'flex',
                          gap: '1rem',
                          alignItems: 'start',
                          padding: '1rem',
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '12px',
                          transition: 'all 0.2s ease',
                          position: 'relative'
                        }}
                      >
                        {/* Reason Column */}
                        <div className="mobile-w-full" style={{ width: '260px', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('Lý do báo lỗi')}
                          </div>
                          <input
                            type="text"
                            className="form-input"
                            value={item.reason}
                            onChange={e => handleUpdateReasonRow(index, 'reason', e.target.value)}
                            placeholder={t("Ví dụ: Sai số điện thoại / Số ảo...")}
                            style={{ height: '42px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px' }}
                          />
                        </div>

                        {/* Guide Note Column */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('Quy tắc / Ghi chú hướng dẫn báo lỗi')}
                          </div>
                          <textarea
                            rows={2}
                            className="form-input"
                            value={item.note}
                            onChange={e => handleUpdateReasonRow(index, 'note', e.target.value)}
                            placeholder={t("Nhập các điều kiện để được duyệt báo lỗi (ví dụ: data tương tác cuối > {n} tháng...)")}
                            style={{
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              minHeight: '64px',
                              height: '64px',
                              padding: '8px 12px',
                              fontSize: '0.875rem',
                              lineHeight: 1.5,
                              borderRadius: '8px'
                            }}
                          />
                        </div>

                        {/* Action: Delete Column */}
                        <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', paddingTop: '1.25rem' }}>
                          <button
                            type="button"
                            className="btn-danger-light"
                            onClick={() => handleRemoveReasonRow(index)}
                            style={{
                              height: '42px',
                              width: '42px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              cursor: 'pointer'
                            }}
                            title={t('Xóa lý do này')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {reportErrorReasons.length > 0 && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      background: 'var(--color-bg)',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      marginTop: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{t('Mẹo:')}</span>
                      <span>
                        {t('Sử dụng cụm')} <code>{'{n}'}</code> {t('để tự động thay thế bằng số tháng đã thiết lập ở tab "Ánh xạ dữ liệu cũ" (hiện tại là')} {duplicateCheckMonths} {t('tháng).')}
                      </span>
                    </div>
                  )}

                  {reportErrorReasons.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--color-border)', borderRadius: 10, color: 'var(--color-text-muted)' }}>
                      {t('Chưa có lý do báo lỗi nào. Nhấn nút bên dưới để thêm mới.')}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddReasonRow}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      width: 'fit-content',
                      alignSelf: 'flex-start',
                      padding: '0.5rem 1rem'
                    }}
                  >
                    <Plus size={16} /> {t('Thêm lý do báo lỗi')}
                  </button>
                </div>
              </div>

              {/* Cấu hình Bù Lượt Thiếu (Fairness Starvation Prevention) */}
              <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', background: 'var(--color-primary)', color: 'white', padding: 4, borderRadius: 6 }}>
                    <Activity size={16} />
                  </span>
                  {t('Cấu hình Bù Lượt Thiếu (Fairness Starvation Prevention)')}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  {t('Khi Sale nghỉ phép hoặc ngoài giờ làm việc, hệ thống sẽ bỏ qua lượt của họ. Khi họ quay lại ca trực, cơ chế này sẽ ưu tiên bù lượt cho họ (giới hạn theo giờ để tránh dồn dập).')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <ToggleSwitch
                      checked={starvationPreventionEnabled}
                      onChange={setStarvationPreventionEnabled}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t('Kích hoạt Bù Lượt Thiếu')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                        {t('Tự động tích lũy và ưu tiên bù lượt cho Sale khi quay lại ca trực (mặc định TẮT)')}
                      </div>
                    </div>
                  </div>

                  {starvationPreventionEnabled && (
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', animation: 'fadeIn 0.3s' }}>
                      <label className="form-label">{t('Số lượt bù tối đa mỗi giờ (Để tránh dồn dập)')}</label>
                      <div style={{ position: 'relative', width: 200 }}>
                        <input
                          type="number"
                          min={1}
                          className="form-input"
                          value={starvationMaxLeadsPerHour}
                          onChange={e => setStarvationMaxLeadsPerHour(Math.max(1, Number(e.target.value)))}
                          style={{ paddingRight: 90 }}
                        />
                        <span style={{ position: 'absolute', right: 12, top: 10, color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>{t('Lead/giờ')}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                        {t('Giới hạn tối đa số lượng leads bù cho mỗi Sale trong vòng 1 giờ để tránh dồn dập quá tải')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Blacklist Config Card */}
              <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', background: '#374151', color: 'white', padding: 4, borderRadius: 6 }}>
                    <Shield size={16} />
                  </span>
                  {t('Danh sách đen & Loại trừ Data')}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  {t('Data chứa các thông tin này sẽ bị chặn đứng ngay lập tức và')} <strong>{t('KHÔNG')}</strong> {t('được giao cho bất kỳ vòng nào (Kể cả vòng Fallback).')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Part 1: Exclusion Keys */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{t('Từ khóa loại trừ (Keys)')}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>
                        {t('Ngăn cách bằng dấu phẩy hoặc nhấn Enter khi nhập')}
                      </span>
                    </label>
                    
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t("Nhập từ khóa cần chặn (VD: spam, test, rac...)")}
                        value={newKeyInput}
                        onChange={e => setNewKeyInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const keys = exclusionKeys ? exclusionKeys.split(',').map(k => k.trim()).filter(Boolean) : [];
                            const val = newKeyInput.trim();
                            if (val && !keys.includes(val)) {
                              setExclusionKeys([...keys, val].join(', '));
                              setNewKeyInput('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn primary"
                        style={{ padding: '0 16px', background: 'var(--color-primary)' }}
                        onClick={() => {
                          const keys = exclusionKeys ? exclusionKeys.split(',').map(k => k.trim()).filter(Boolean) : [];
                          const val = newKeyInput.trim();
                          if (val && !keys.includes(val)) {
                            setExclusionKeys([...keys, val].join(', '));
                            setNewKeyInput('');
                          }
                        }}
                      >
                        {t('Thêm')}
                      </button>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      padding: '8px',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '8px',
                      minHeight: '45px',
                    }}>
                      {(() => {
                        const keys = exclusionKeys ? exclusionKeys.split(',').map(k => k.trim()).filter(Boolean) : [];
                        if (keys.length === 0) {
                          return <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px' }}>{t('Chưa có từ khóa loại trừ nào.')}</span>;
                        }
                        return keys.map((key, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'var(--color-danger-light)',
                              color: 'var(--color-danger)',
                              border: '1px solid var(--color-danger-light)',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            {key}
                            <X
                              size={12}
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setExclusionKeys(keys.filter((_, i) => i !== idx).join(', '));
                              }}
                            />
                          </span>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Part 2: Exclusion Contacts */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                        {t('Số điện thoại / Email loại trừ')}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="file"
                          id="blacklist-file-upload"
                          accept=".xlsx, .xls, .csv"
                          style={{ display: 'none' }}
                          onChange={handleBlacklistUpload}
                        />
                        <label
                          htmlFor="blacklist-file-upload"
                          className="btn outline"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          <Upload size={14} /> {t('Nhập từ Excel/CSV')}
                        </label>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t("Nhập SĐT hoặc Email (VD: 0909123456 hoặc spam@gmail.com)")}
                        value={newContactInput}
                        onChange={e => setNewContactInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const contacts = exclusionContacts ? exclusionContacts.split(',').map(c => c.trim()).filter(Boolean) : [];
                            const val = newContactInput.trim();
                            if (val && !contacts.includes(val)) {
                              setExclusionContacts([...contacts, val].join(', '));
                              if (val.includes('@')) {
                                setBlacklistContactTab('email');
                              } else {
                                setBlacklistContactTab('phone');
                              }
                              setNewContactInput('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn primary"
                        style={{ padding: '0 16px', background: 'var(--color-primary)' }}
                        onClick={() => {
                          const contacts = exclusionContacts ? exclusionContacts.split(',').map(c => c.trim()).filter(Boolean) : [];
                          const val = newContactInput.trim();
                          if (val && !contacts.includes(val)) {
                            setExclusionContacts([...contacts, val].join(', '));
                            if (val.includes('@')) {
                              setBlacklistContactTab('email');
                            } else {
                              setBlacklistContactTab('phone');
                            }
                            setNewContactInput('');
                          }
                        }}
                      >
                        {t('Thêm')}
                      </button>
                    </div>

                    {/* Search & Stats bar */}
                    {(() => {
                      const contacts = exclusionContacts ? exclusionContacts.split(',').map(c => c.trim()).filter(Boolean) : [];
                      if (contacts.length === 0) return null;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '10px' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder={t("Tìm nhanh SĐT/Email trong danh sách đen...")}
                              value={blacklistSearchQuery}
                              onChange={e => setBlacklistSearchQuery(e.target.value)}
                              style={{ paddingLeft: '32px', height: '32px', fontSize: '0.8125rem' }}
                            />
                            <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--color-text-muted)' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                            {t('Tổng số: {count} liên hệ').replace('{count}', String(contacts.length))}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Sub-tabs selectors for SĐT / Email */}
                    {(() => {
                      const contacts = exclusionContacts ? exclusionContacts.split(',').map(c => c.trim()).filter(Boolean) : [];
                      if (contacts.length === 0) return null;
                      const phones = contacts.filter(c => !c.includes('@'));
                      const emails = contacts.filter(c => c.includes('@'));
                      return (
                        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border-light)', marginBottom: '10px' }}>
                          <button
                            type="button"
                            onClick={() => setBlacklistContactTab('phone')}
                            style={{
                              padding: '8px 16px',
                              fontSize: '0.8125rem',
                              fontWeight: 700,
                              background: 'none',
                              border: 'none',
                              borderBottom: blacklistContactTab === 'phone' ? '2px solid var(--color-primary)' : '2px solid transparent',
                              color: blacklistContactTab === 'phone' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              outline: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {t('Số điện thoại')}
                            <span style={{
                              fontSize: '0.7rem',
                              background: blacklistContactTab === 'phone' ? 'rgba(124, 58, 237, 0.1)' : 'var(--color-bg)',
                              color: blacklistContactTab === 'phone' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              transition: 'all 0.2s'
                            }}>
                              {phones.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setBlacklistContactTab('email')}
                            style={{
                              padding: '8px 16px',
                              fontSize: '0.8125rem',
                              fontWeight: 700,
                              background: 'none',
                              border: 'none',
                              borderBottom: blacklistContactTab === 'email' ? '2px solid var(--color-primary)' : '2px solid transparent',
                              color: blacklistContactTab === 'email' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              outline: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {t('Email')}
                            <span style={{
                              fontSize: '0.7rem',
                              background: blacklistContactTab === 'email' ? 'rgba(124, 58, 237, 0.1)' : 'var(--color-bg)',
                              color: blacklistContactTab === 'email' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              transition: 'all 0.2s'
                            }}>
                              {emails.length}
                            </span>
                          </button>
                        </div>
                      );
                    })()}

                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      padding: '12px',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '8px',
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}>
                      {(() => {
                        const contacts = exclusionContacts ? exclusionContacts.split(',').map(c => c.trim()).filter(Boolean) : [];
                        if (contacts.length === 0) {
                          return <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa có liên hệ loại trừ nào.')}</span>;
                        }
                        
                        const phones = contacts.filter(c => !c.includes('@'));
                        const emails = contacts.filter(c => c.includes('@'));
                        const activeList = blacklistContactTab === 'phone' ? phones : emails;

                        const filtered = activeList.filter(c =>
                          c.toLowerCase().includes(blacklistSearchQuery.toLowerCase())
                        );

                        if (filtered.length === 0) {
                          return <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            {blacklistSearchQuery ? t('Không tìm thấy liên hệ khớp với tìm kiếm.') : (blacklistContactTab === 'phone' ? t('Chưa có số điện thoại nào trong danh sách.') : t('Chưa có email nào trong danh sách.'))}
                          </span>;
                        }

                        const maxDisplay = 100;
                        const displayed = filtered.slice(0, maxDisplay);

                        return (
                          <>
                            {displayed.map((c, idx) => (
                              <span
                                key={idx}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'var(--color-bg)',
                                  color: 'var(--color-text-light)',
                                  border: '1px solid var(--color-border)',
                                  padding: '2px 8px',
                                  borderRadius: '20px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600
                                }}
                              >
                                {c}
                                <X
                                  size={12}
                                  style={{ cursor: 'pointer', color: '#64748b' }}
                                  onClick={() => {
                                    const actualIdx = contacts.indexOf(c);
                                    if (actualIdx !== -1) {
                                      setExclusionContacts(contacts.filter((_, i) => i !== actualIdx).join(', '));
                                    }
                                  }}
                                />
                              </span>
                            ))}
                            {filtered.length > maxDisplay && (
                              <div style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                marginTop: '6px',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                fontStyle: 'italic',
                                padding: '4px 0'
                              }}>
                                {t('... và {count} liên hệ khác. Sử dụng ô tìm kiếm để lọc thêm.').replace('{count}', String(filtered.length - maxDisplay))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Testing */}
          {activeTab !== 'duplicate_check' && activeTab !== 'ai' && (
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
                  <Send size={18} color="var(--color-primary)" /> {t('Gửi Test Email')}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
                  {t('Sau khi lưu cấu hình, bạn có thể gửi một email thử nghiệm để đảm bảo hệ thống đã kết nối thành công với AppScript hoặc Amazon SES.')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <CustomSelect
                    options={[
                      { value: 'system', label: t('Test Hệ Thống (SMTP / AppScript)') },
                      { value: 'assignment', label: t('Test Template Giao Data') },
                      { value: 'zalo_sale', label: t('Test Welcome & Zalo (Sale)') },
                      { value: 'zalo_admin', label: t('Test Welcome & Zalo (Admin)') },
                      { value: 'ticket_admin', label: t('Test Thông báo Ticket (Admin)') },
                      { value: 'ticket_sale_success', label: t('Test Duyệt Ticket thành công (Sale)') },
                      { value: 'ticket_sale_fail', label: t('Test Từ chối Ticket (Sale)') },
                      { value: 'admin_confirm', label: t('Test Xác nhận Email (Admin)') },
                      { value: 'daily_report', label: t('Test Báo Cáo Tổng Kết Ngày') }
                    ]}
                    value={testType}
                    onChange={val => setTestType(val.toString())}
                    width="100%"
                    direction="down"
                  />

                  <input
                    className="form-input"
                    placeholder={t("Nhập email nhận test...")}
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
                    {testing ? t("Đang gửi...") : t("Gửi Email Test")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Custom Modal for Auto-Approve Rule */}
      <CustomModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title={editingRule ? t("Chỉnh sửa Luật Tự Động Duyệt") : t("Thêm Luật Tự Động Duyệt Mới")}
        width="650px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>
          {/* Name */}
          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>{t('Tên luật duyệt tự động')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder={t("Ví dụ: Lỗi số điện thoại — Vòng A")}
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
            />
          </div>

          {/* Scope: Rounds */}
          <div>
            <CustomSelect
              label={t("Áp dụng cho Vòng phân bổ")}
              options={roundOptions}
              value={ruleRounds}
              onChange={setRuleRounds}
              multiple={true}
              searchable={true}
              placeholder={t("Chọn vòng phân bổ...")}
            />
          </div>

          {/* Scope: Sales */}
          <div>
            <CustomSelect
              label={t("Áp dụng cho Tư vấn viên (Sales)")}
              options={saleOptions}
              value={ruleSales}
              onChange={setRuleSales}
              multiple={true}
              searchable={true}
              placeholder={t("Chọn tư vấn viên...")}
            />
          </div>

          {/* Scope: Sources (Sheet Connections) */}
          <div>
            <CustomSelect
              label={t("Áp dụng cho Nguồn dữ liệu (Sources)")}
              options={connectionOptions}
              value={ruleConnections}
              onChange={setRuleConnections}
              multiple={true}
              searchable={true}
              placeholder={t("Chọn nguồn dữ liệu...")}
            />
          </div>

          {/* Keywords / Reasons */}
          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>{t('Từ khóa / Lý do lỗi kích hoạt (Cách nhau bằng dấu phẩy)')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <textarea
              className="form-input"
              placeholder={t("Ví dụ: sai số, thuê bao, nhầm số, không liên lạc được")}
              value={ruleKeywords}
              onChange={e => setRuleKeywords(e.target.value)}
              style={{ minHeight: 80, resize: 'vertical' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
              {t('Khi lý do báo lỗi của Sale chứa bất kỳ từ khóa nào trong danh sách trên, ticket sẽ được duyệt tự động.')}
            </span>
          </div>

          {/* Active status */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)', marginTop: '0.25rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>{t('Trạng thái hoạt động')}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Kích hoạt hoặc tạm ngưng áp dụng luật này')}</span>
            </div>
            <div
              onClick={() => setRuleActive(!ruleActive)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: ruleActive ? 'var(--color-success)' : 'var(--color-border)',
                position: 'relative', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
                boxShadow: ruleActive ? '0 0 8px rgba(16, 185, 129, 0.2)' : 'none'
              }}
            >
              <div style={{
                position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                background: 'white', left: ruleActive ? 23 : 3, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
              }} />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              className="btn outline"
              onClick={() => setRuleModalOpen(false)}
            >
              {t('Hủy')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!ruleName.trim()) {
                  toast.error(t("Vui lòng nhập tên luật!"));
                  return;
                }
                if (!ruleKeywords.trim()) {
                  toast.error(t("Vui lòng nhập từ khóa duyệt!"));
                  return;
                }
                if (ruleRounds.length === 0) {
                  toast.error(t("Vui lòng chọn ít nhất một vòng áp dụng!"));
                  return;
                }
                if (ruleSales.length === 0) {
                  toast.error(t("Vui lòng chọn ít nhất một Sale áp dụng!"));
                  return;
                }
                if (ruleConnections.length === 0) {
                  toast.error(t("Vui lòng chọn ít nhất một nguồn áp dụng!"));
                  return;
                }

                const keywordsArray = ruleKeywords.split(',')
                  .map(k => k.trim())
                  .filter(k => k.length > 0);

                const newRule = {
                  id: editingRule ? editingRule.id : Date.now(),
                  name: ruleName.trim(),
                  active: ruleActive,
                  rounds: ruleRounds,
                  sales: ruleSales,
                  connections: ruleConnections,
                  keywords: keywordsArray
                };

                if (editingRule) {
                  setTicketAutoApproveRules(prev => prev.map(r => r.id === editingRule.id ? newRule : r));
                  toast.success(t("Đã cập nhật luật thành công!"));
                } else {
                  setTicketAutoApproveRules(prev => [...prev, newRule]);
                  toast.success(t("Đã thêm luật mới thành công!"));
                }
                setRuleModalOpen(false);
              }}
            >
              {t('Xác nhận')}
            </button>
          </div>
        </div>
      </CustomModal>

      <ConfirmModal
        isOpen={confirmDeleteLogsOpen}
        onClose={() => setConfirmDeleteLogsOpen(false)}
        onConfirm={executeDeleteHistory}
        title={t("Xác nhận xóa bản ghi")}
        message={logsToDelete.length === 1
          ? t("Bạn có chắc chắn muốn xóa bản ghi nhập này không? Thao tác này cũng sẽ xóa Lead tương ứng khỏi CRM.")
          : t("Bạn có chắc chắn muốn xóa {count} bản ghi nhập đã chọn? Thao tác này cũng sẽ xóa các Lead tương ứng khỏi CRM.").replace('{count}', String(logsToDelete.length))}
        confirmText={t("Xóa bản ghi")}
        cancelText={t("Hủy")}
      />

      <ConfirmModal
        isOpen={confirmImportOpen}
        onClose={() => setConfirmImportOpen(false)}
        onConfirm={executeImportLeads}
        title={t("Xác nhận nhập dữ liệu")}
        message={t("Bạn có chắc chắn muốn nhập {count} dòng dữ liệu từ file vào hệ thống không?").replace('{count}', String(localRows.length))}
        confirmText={t("Bắt đầu nhập")}
        cancelText={t("Hủy")}
        confirmType="primary"
        width="750px"
      >
        {localRows.length > 0 && (
          <div style={{ marginTop: '1rem', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--color-surface)' }}>
            <div style={{ background: 'var(--color-bg)', padding: '10px 16px', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
              {t('Xem trước 5 dòng dữ liệu đầu tiên:')}
            </div>
            <div className="responsive-table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Khách hàng')}</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Liên hệ')}</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Ngày')}</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Sale phụ trách')}</th>
                  </tr>
                </thead>
                <tbody>
                  {localRows.slice(0, 5).map((row, idx) => {
                    const phone = phoneCol ? String(row[phoneCol] || '').trim() : '';
                    const email = emailCol ? String(row[emailCol] || '').trim() : '';
                    const name = nameCol ? String(row[nameCol] || '').trim() : '';
                    const date = dateCol ? String(row[dateCol] || '').trim() : '';
                    const salepersonVal = salepersonCol ? String(row[salepersonCol] || '').trim() : '';

                    // Match with consultants list on frontend
                    const matchedSale = consultants.find(c => 
                      (c.name && c.name.toLowerCase() === salepersonVal.toLowerCase()) || 
                      (c.email && c.email.toLowerCase() === salepersonVal.toLowerCase()) ||
                      (c.email && c.email.toLowerCase().split('@')[0] === salepersonVal.toLowerCase()) ||
                      (c.username && c.username.toLowerCase() === salepersonVal.toLowerCase())
                    );

                    const saleDisplayName = matchedSale ? matchedSale.name : salepersonVal;
                    const saleSubText = matchedSale ? matchedSale.email : (salepersonVal.includes('@') ? salepersonVal : '');

                    return (
                      <tr key={idx} style={{ borderBottom: idx < Math.min(localRows.length, 5) - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar name={name || t('Không có tên')} size={32} />
                            <span style={{ fontWeight: 600 }}>{name || <em style={{ color: '#cbd5e1', fontWeight: 400 }}>{t('Chưa cập nhật')}</em>}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{phone ? maskPhone(phone) : <em style={{ color: '#cbd5e1', fontWeight: 400 }}>{t('Trống')}</em>}</span>
                            <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>{email ? maskEmail(email) : <em style={{ color: '#cbd5e1', fontWeight: 400 }}>{t('Trống')}</em>}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--color-text-muted)' }}>
                          {date ? formatExcelDate(date) : <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>-</span>}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {saleDisplayName ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Avatar src={matchedSale?.avatar} name={saleDisplayName} size={24} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <strong style={{ fontWeight: 600 }}>{saleDisplayName}</strong>
                                {saleSubText && <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>{saleSubText}</span>}
                              </div>
                            </div>
                          ) : <span style={{ color: 'var(--color-text-muted)' }}>-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ConfirmModal>

      {/* Floating Save Button on Mobile */}
      {!loading && activeTab !== 'duplicate_check' && (
        <div className="mobile-only" style={{
          position: 'fixed',
          bottom: '2rem',
          right: '1.5rem',
          zIndex: 99,
        }}>
          <button 
            className="btn primary" 
            onClick={handleSave} 
            disabled={saving} 
            style={{ 
              borderRadius: '50%', 
              width: 56, 
              height: 56, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: 0,
              boxShadow: '0 4px 14px 0 rgba(124, 58, 237, 0.4)'
            }}
            title={t("Lưu cấu hình")}
          >
            {saving ? <Activity size={24} className="spin" /> : <Save size={24} />}
          </button>
        </div>
      )}
    </div>
  );
};
