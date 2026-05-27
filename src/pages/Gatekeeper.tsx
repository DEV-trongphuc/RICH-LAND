import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import {
  ShieldAlert, RefreshCw, Filter, Zap, Trash2, Plus,
  CheckCircle, AlertTriangle, ChevronLeft, ChevronRight,
  Phone, Mail, Clock, Tag, XCircle,
  ExternalLink, Check, Shield, Save, Sparkles, X, Settings,
  BarChart2
} from 'lucide-react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { CustomModal } from '../components/ui/CustomModal';
import { Avatar } from '../components/ui/Avatar';
import { TableSkeleton } from '../components/ui/Skeleton';

type Lead = {
  id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  assigned_to_name: string;
  assigned_to_avatar?: string;
  round_name: string;
  created_at: string;
  type?: string;
  note?: string;
  report_status?: string;
  resolved_by?: string | null;
  resolved_at?: string | null;
  last_activity_at?: string | null;
  ai_screener_status?: string;
  ai_evaluation?: string;
};

const maskPhone = (phone: string) => {
  if (!phone || phone === '-') return phone;
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length < 8) return phone;
  const start = clean.slice(0, clean.length - 6);
  const end = clean.slice(-3);
  return `${start}***${end}`;
};

const maskEmail = (email: string) => {
  if (!email || email === '-') return email;
  const parts = email.split('@');
  if (parts.length < 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 3) {
    return `${name.slice(0, 1)}***@${domain}`;
  }
  return `${name.slice(0, 3)}***${name.slice(-1)}@${domain}`;
};

const parseNote = (noteText: string) => {
  if (!noteText) return { cleanNote: '', errorNotes: [], blacklistNotes: [] };
  const normalized = noteText.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');
  const cleanLines: string[] = [];
  const errorNotes: string[] = [];
  const blacklistNotes: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (/^(?:Nhập dữ liệu cũ|Nhap du lieu cu)\s*(?:\(Silent\))?$/i.test(trimmed)) {
      return;
    }
    if (trimmed.startsWith('[LỖI -') || trimmed.startsWith('[LỖI ')) {
      errorNotes.push(trimmed);
    } else if (
      trimmed.startsWith('[Bị chặn bởi') ||
      trimmed.startsWith('[Chặn bởi') ||
      trimmed.toLowerCase().startsWith('[bị chặn bởi') ||
      trimmed.toLowerCase().startsWith('[chặn bởi')
    ) {
      blacklistNotes.push(trimmed);
    } else {
      cleanLines.push(line);
    }
  });

  return {
    cleanNote: cleanLines.join('\n').trim(),
    errorNotes,
    blacklistNotes
  };
};

const parseBlacklistNote = (note: string) => {
  let admin = 'Hệ thống';
  let time = 'Hệ thống';
  let reason = '';

  const adminMatch = note.match(/bởi\s+Admin\s+([^\s]+(?:\s+[^\s]+)*?)(?:\s+lúc|$)/i);
  if (adminMatch && adminMatch[1]) {
    admin = adminMatch[1].trim();
  }

  const timeMatch = note.match(/lúc\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
  if (timeMatch && timeMatch[1]) {
    time = timeMatch[1].trim();
  }

  const reasonMatch = note.match(/Lý\s+do:\s*(.*?)\]?$/i);
  if (reasonMatch && reasonMatch[1]) {
    reason = reasonMatch[1].trim();
  }

  return { admin, time, reason };
};

interface AIScreenerConfig {
  id: string;
  name: string;
  rounds: number[];
  mode: 'ai' | 'manual' | 'hybrid';
  ai_rules: string;
  manual_action: 'hold' | 'skip';
  manual_rules: any[];
  below_standard_fallback_enabled?: boolean;
  below_standard_fallback_round_id?: number | '';
  below_standard_auto_approve?: boolean;
}

export const Gatekeeper = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
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

  // Search Params
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFilter = searchParams.get('date') || 'Tháng này';
  const currentPage = Number(searchParams.get('page') || '1');

  // Lists & Configs States
  const [heldLeads, setHeldLeads] = useState<any[]>([]);
  const [heldLeadsTotalCount, setHeldLeadsTotalCount] = useState<number>(0);
  const [heldLeadsLoading, setHeldLeadsLoading] = useState<boolean>(false);
  const [heldLeadsSearch, setHeldLeadsSearch] = useState<string>('');
  const [rounds, setRounds] = useState<any[]>([]);

  // Settings states
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [aiScreenerEnabled, setAiScreenerEnabled] = useState(false);
  const [aiScreenerConfigs, setAiScreenerConfigs] = useState<AIScreenerConfig[]>([]);

  // Modals & Action States
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [heldActionModalOpen, setHeldActionModalOpen] = useState<'approve' | 'reject' | 'blacklist' | null>(null);
  const [actioningHeldLead, setActioningHeldLead] = useState<any | null>(null);
  const [selectedApproveRoundId, setSelectedApproveRoundId] = useState<number | null>(null);
  const [heldActionReason, setHeldActionReason] = useState<string>('');
  const [previewedConsultant, setPreviewedConsultant] = useState<any>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Custom Settings & Guide Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isDynamicFlowExpanded, setIsDynamicFlowExpanded] = useState<boolean>(false);
  const [activeRoundsDropdown, setActiveRoundsDropdown] = useState<string | null>(null);

  // Stats Modal States
  const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [statsPage, setStatsPage] = useState<number>(1);
  const STATS_ITEMS_PER_PAGE = 50;

  const paginatedRecentLeads = useMemo(() => {
    if (!statsData?.recent_below_standard) return [];
    const start = (statsPage - 1) * STATS_ITEMS_PER_PAGE;
    return statsData.recent_below_standard.slice(start, start + STATS_ITEMS_PER_PAGE);
  }, [statsData?.recent_below_standard, statsPage]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveRoundsDropdown(null);
    };
    if (activeRoundsDropdown) {
      window.addEventListener('click', handleGlobalClick);
    }
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [activeRoundsDropdown]);

  // Custom Date Picker Modal
  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const ITEMS_PER_PAGE = 50;

  const updateParams = (key: string, value: string) => {
    setSearchParams(prev => {
      if (value === '' || (key !== 'status' && value === 'all')) prev.delete(key);
      else prev.set(key, value);
      if (key !== 'page') prev.delete('page');
      return prev;
    }, { replace: true });
  };

  const getDisplayDateFilterText = (filter: string) => {
    if (filter.includes('đến')) {
      return filter.replace(/\s*đến\s*/i, ` ${t('đến')} `);
    }
    return t(filter);
  };

  const dateOptions = [
    { value: 'all', label: t('Tất cả thời gian') },
    { value: 'Hôm nay', label: t('Hôm nay') },
    { value: 'Hôm qua', label: t('Hôm qua') },
    { value: 'Tuần này', label: t('Tuần này') },
    { value: 'Tuần trước', label: t('Tuần trước') },
    { value: 'Tuần trước nữa', label: t('Tuần trước nữa') },
    { value: '7 ngày qua', label: t('7 ngày qua') },
    { value: '30 ngày qua', label: t('30 ngày qua') },
    { value: 'Tháng này', label: t('Tháng này') },
    { value: 'Tháng trước', label: t('Tháng trước') }
  ];

  const defaultFilters = ['all', 'Hôm nay', 'Hôm qua', 'Tuần này', 'Tuần trước', 'Tuần trước nữa', '7 ngày qua', '30 ngày qua', 'Tháng này', 'Tháng trước', 'Tùy chỉnh'];
  if (!defaultFilters.includes(dateFilter)) {
    dateOptions.push({ value: dateFilter, label: getDisplayDateFilterText(dateFilter) });
  }
  dateOptions.push({ value: 'Tùy chỉnh', label: t('Tùy chỉnh...') });

  const handleCustomDateSubmit = () => {
    if (!startDate || !endDate) {
      toast.error(t("Vui lòng chọn đầy đủ Từ ngày và Đến ngày"));
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error(t("Từ ngày không được lớn hơn Đến ngày"));
      return;
    }
    const label = `${startDate} ${t('đến')} ${endDate}`;
    updateParams('date', label);
    setShowDateModal(false);
  };

  // ── API Fetchers ──
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetchAPI(`get_gatekeeper_stats&date=${encodeURIComponent(dateFilter)}`);
      if (res.success) {
        setStatsData(res);
      } else {
        toast.error(t('Lỗi tải thống kê bộ lọc'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối Server: ') + e.message);
    }
    setStatsLoading(false);
  };

  useEffect(() => {
    if (isStatsModalOpen) {
      setStatsPage(1);
      fetchStats();
    }
  }, [isStatsModalOpen, dateFilter]);

  const fetchHeldLeads = async () => {
    setHeldLeadsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(currentPage));
      queryParams.set('pageSize', String(ITEMS_PER_PAGE));
      if (heldLeadsSearch) queryParams.set('search', heldLeadsSearch);
      if (dateFilter) queryParams.set('date', dateFilter);

      const res = await fetchAPI(`get_held_leads&${queryParams.toString()}`);
      if (res.success) {
        const data = res.data || [];
        setHeldLeads(data);
        setHeldLeadsTotalCount(res.total_count ?? 0);
        if (data.length === 0 && !heldLeadsSearch) {
          setIsDynamicFlowExpanded(true);
        }
      }
    } catch (e: any) {
      toast.error(t('Lỗi tải dữ liệu AI Pre-screener: ') + e.message);
    }
    setHeldLeadsLoading(false);
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetchAPI('get_settings');
      if (res.success && res.data) {
        setAiScreenerEnabled(res.data.ai_screener_enabled === '1' || res.data.ai_screener_enabled === 1);

        // Fetch multiple configurations
        let configsArray: AIScreenerConfig[] = [];
        if (res.data.ai_screener_configs) {
          try {
            const parsed = typeof res.data.ai_screener_configs === 'string'
              ? JSON.parse(res.data.ai_screener_configs)
              : res.data.ai_screener_configs;
            if (Array.isArray(parsed)) {
              configsArray = parsed;
            }
          } catch (e) {
            console.error('Error parsing aiScreenerConfigs', e);
          }
        }

        // Fallback: migrate single configuration to multi-ruleset if none exists
        if (configsArray.length === 0) {
          const oldRounds = res.data.ai_screener_rounds
            ? res.data.ai_screener_rounds.split(',').map(Number).filter((n: any) => !isNaN(n) && n > 0)
            : [];
          if (oldRounds.length > 0 || res.data.ai_screener_rules || res.data.ai_screener_manual_rules) {
            let oldManualRules: any[] = [];
            if (res.data.ai_screener_manual_rules) {
              try {
                const parsedRules = typeof res.data.ai_screener_manual_rules === 'string'
                  ? JSON.parse(res.data.ai_screener_manual_rules)
                  : res.data.ai_screener_manual_rules;
                if (Array.isArray(parsedRules)) oldManualRules = parsedRules;
              } catch { }
            }
            configsArray = [{
              id: 'config_' + Date.now(),
              name: t('Cấu hình mặc định'),
              rounds: oldRounds,
              mode: (res.data.ai_screener_mode as any) || 'ai',
              ai_rules: res.data.ai_screener_rules || '',
              manual_action: (res.data.ai_screener_manual_action as any) || 'hold',
              manual_rules: oldManualRules
            }];
          }
        }
        setAiScreenerConfigs(configsArray);
      }
    } catch (e: any) {
      console.error('Error fetching settings:', e);
    }
    setSettingsLoading(false);
  };

  const fetchRounds = async () => {
    try {
      const res = await fetchAPI('get_rounds');
      if (res.success && res.data) {
        setRounds(res.data);
      }
    } catch (e) {
      console.error('Error fetching rounds:', e);
    }
  };

  useEffect(() => {
    fetchRounds();
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchHeldLeads();
  }, [searchParams, heldLeadsSearch]);

  // ── Lead Action Handlers ──
  const handleOpenApproveHeldLead = async (lead: any) => {
    setActioningHeldLead(lead);
    setHeldActionModalOpen('approve');
    setSelectedApproveRoundId(lead.target_round_id ? Number(lead.target_round_id) : null);
    setPreviewLoadingId(lead.id);
    setPreviewedConsultant(null);
    try {
      const rId = lead.target_round_id ? Number(lead.target_round_id) : '';
      const res = await fetchAPI(`preview_held_lead_assignment&lead_id=${lead.id}&round_id=${rId}`);
      if (res.success) {
        setPreviewedConsultant(res.consultant);
      } else {
        toast.error(res.message || t('Lỗi tải thông tin Sale tiếp nhận.'));
      }
    } catch (err: any) {
      console.error(err);
    }
    setPreviewLoadingId(null);
  };

  const handleApproveRoundChange = async (newRoundId: number) => {
    setSelectedApproveRoundId(newRoundId);
    if (!actioningHeldLead) return;
    setPreviewLoadingId(actioningHeldLead.id);
    setPreviewedConsultant(null);
    try {
      const res = await fetchAPI(`preview_held_lead_assignment&lead_id=${actioningHeldLead.id}&round_id=${newRoundId}`);
      if (res.success) {
        setPreviewedConsultant(res.consultant);
      } else {
        toast.error(res.message || t('Lỗi tải thông tin Sale tiếp nhận.'));
      }
    } catch (err: any) {
      console.error(err);
    }
    setPreviewLoadingId(null);
  };

  const handleApproveHeldLeadSubmit = async () => {
    if (!actioningHeldLead) return;
    const currentLeadId = actioningHeldLead.id;
    setHeldActionModalOpen(null);
    setActionLoading(true);
    try {
      const res = await fetchAPI('approve_held_lead', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: currentLeadId,
          round_id: selectedApproveRoundId
        })
      });
      if (res.success) {
        toast.success(t('Đã duyệt và phân bổ lead thành công!'));
        fetchHeldLeads();
        window.dispatchEvent(new Event('ticket-resolved'));
      } else {
        toast.error(res.message || t('Lỗi khi duyệt lead'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setActionLoading(false);
  };

  const handleRejectHeldLeadSubmit = async () => {
    if (!actioningHeldLead || !heldActionReason.trim()) {
      toast.error(t('Vui lòng nhập lý do từ chối.'));
      return;
    }
    const currentLeadId = actioningHeldLead.id;
    setHeldActionModalOpen(null);
    setActionLoading(true);
    try {
      const res = await fetchAPI('reject_held_lead', {
        method: 'POST',
        body: JSON.stringify({ lead_id: currentLeadId, reason: heldActionReason })
      });
      if (res.success) {
        toast.success(t('Đã xác nhận dưới chuẩn thành công!'));
        setHeldActionReason('');
        fetchHeldLeads();
        window.dispatchEvent(new Event('ticket-resolved'));
      } else {
        toast.error(res.message || t('Lỗi khi xác nhận dưới chuẩn'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setActionLoading(false);
  };

  const handleBlacklistHeldLeadSubmit = async () => {
    if (!actioningHeldLead || !heldActionReason.trim()) {
      toast.error(t('Vui lòng nhập lý do chặn.'));
      return;
    }
    const currentLeadId = actioningHeldLead.id;
    setHeldActionModalOpen(null);
    setActionLoading(true);
    try {
      const res = await fetchAPI('blacklist_held_lead', {
        method: 'POST',
        body: JSON.stringify({ lead_id: currentLeadId, reason: heldActionReason })
      });
      if (res.success) {
        toast.success(t('Đã chặn số và đưa vào Blacklist thành công!'));
        setHeldActionReason('');
        fetchHeldLeads();
        window.dispatchEvent(new Event('ticket-resolved'));
      } else {
        toast.error(res.message || t('Lỗi khi chặn lead'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setActionLoading(false);
  };

  // ── Config Action Handlers ──
  const handleSaveConfig = async () => {
    // Validate each config card's fallback settings
    for (const cfg of aiScreenerConfigs) {
      if (cfg.below_standard_fallback_enabled) {
        if (!cfg.below_standard_fallback_round_id) {
          toast.error(t("Vui lòng chọn Vòng phân bổ fallback cho nhóm: ") + (cfg.name || t("Chưa đặt tên")));
          return;
        }
        if (cfg.rounds.includes(Number(cfg.below_standard_fallback_round_id))) {
          toast.error(t("Vòng fallback không được nằm trong các vòng áp dụng của nhóm: ") + (cfg.name || t("Chưa đặt tên")));
          return;
        }
        // Fallback round cannot be selected in the screened rounds of ANY config
        const isSelectedInConfigs = aiScreenerConfigs.some(c =>
          c.rounds.includes(Number(cfg.below_standard_fallback_round_id))
        );
        if (isSelectedInConfigs) {
          toast.error(t("Vòng fallback không được trùng với các vòng đang bật bộ lọc AI ở bất kỳ nhóm nào."));
          return;
        }
      }
    }

    setSavingSettings(true);
    const payload = {
      ai_screener_enabled: aiScreenerEnabled ? '1' : '0',
      ai_screener_configs: aiScreenerConfigs,
      ai_screener_below_standard_fallback_enabled: aiScreenerConfigs.length > 0 && aiScreenerConfigs[0].below_standard_fallback_enabled ? '1' : '0',
      ai_screener_below_standard_fallback_round_id: aiScreenerConfigs.length > 0 && aiScreenerConfigs[0].below_standard_fallback_round_id ? String(aiScreenerConfigs[0].below_standard_fallback_round_id) : '',
      ai_screener_below_standard_auto_approve: aiScreenerConfigs.length > 0 && aiScreenerConfigs[0].below_standard_auto_approve ? '1' : '0',
      // Retain old settings keys for backward compatibility using first config
      ai_screener_rounds: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].rounds.join(',') : '',
      ai_screener_rules: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].ai_rules : '',
      ai_screener_mode: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].mode : 'ai',
      ai_screener_manual_action: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].manual_action : 'hold',
      ai_screener_manual_rules: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].manual_rules : []
    };

    try {
      const json = await fetchAPI('save_settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        toast.success(t("Đã lưu cấu hình bộ lọc thành công!"));
        // Dispatch to update badge count if toggled off
        window.dispatchEvent(new Event('ticket-resolved'));
      } else {
        toast.error(t("Lỗi khi lưu cấu hình bộ lọc!"));
      }
    } catch {
      toast.error(t("Lỗi kết nối Server"));
    }
    setSavingSettings(false);
  };


  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* ── Page Header ── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <span style={{ display: 'inline-flex', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: 'white', padding: 8, borderRadius: 12, boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>
              <Shield size={24} />
            </span>
            {t('Bộ Lọc AI (Pre-screener)')}
          </h1>
        </div>

        {/* Header Actions */}
        <div className="mobile-flex-wrap" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

          {/* Guide Button */}
          <button
            onClick={() => setIsGuideModalOpen(true)}
            title={t("Hướng dẫn sử dụng")}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', cursor: 'pointer',
              color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.8125rem', fontWeight: 700, transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <Sparkles size={14} color="var(--color-primary)" /> {t('Hướng dẫn')}
          </button>

          <div className="hide-on-mobile" style={{ width: 1, height: 16, background: 'rgba(124,58,237,0.15)' }} />

          {/* Settings Button */}
          <button
            onClick={() => {
              fetchSettings();
              setIsSettingsModalOpen(true);
            }}
            title={t("Cấu hình quy tắc")}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', cursor: 'pointer',
              color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.8125rem', fontWeight: 700, transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <Settings size={14} color="var(--color-primary)" />
            <span className="hide-on-mobile">{t('Cấu hình quy tắc')}</span>
            <span className="mobile-only">{t('Cấu hình')}</span>
          </button>

          <div className="hide-on-mobile" style={{ width: 1, height: 16, background: 'rgba(124,58,237,0.15)' }} />

          {/* Lọc AI Toggle */}
          <div
            onClick={() => {
              fetchSettings();
              setIsSettingsModalOpen(true);
            }}
            title={t("Cấu hình quy tắc lọc AI")}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 8,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(124,58,237,0.05)';
              const label = e.currentTarget.querySelector('.auto-approve-label') as HTMLSpanElement;
              if (label) label.style.color = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              const label = e.currentTarget.querySelector('.auto-approve-label') as HTMLSpanElement;
              if (label) label.style.color = 'var(--color-text-muted)';
            }}
          >
            <span
              className="auto-approve-label"
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                transition: 'color 0.2s',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted'
              }}
            >
              {t('Lọc AI')}
            </span>
            <div
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: aiScreenerEnabled ? 'var(--color-success)' : 'rgba(148,163,184,0.3)',
                position: 'relative', transition: 'background 0.2s',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{
                position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%',
                background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                left: aiScreenerEnabled ? 19 : 3, transition: 'left 0.2s'
              }} />
            </div>
          </div>

        </div>

      </div>

      {/* Intro explain card styled identically to FairShareAudit */}
      <div className="hide-on-mobile" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.1) 100%)',
        border: '1px solid var(--color-primary-light)', borderLeft: '4px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', width: '100%' }}>
          <div style={{
            background: 'var(--color-card, #fff)',
            width: 40, height: 40, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', boxShadow: 'var(--shadow-sm)', color: 'var(--color-primary)'
          }}>
            <Sparkles size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: 4, marginTop: 0 }}>
              {t("Bộ Lọc AI Pre-screener hoạt động thế nào?")}
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6, margin: 0 }}>
              {t("Hệ thống tự động tiếp nhận dữ liệu từ webhook nguồn, chuyển qua đánh giá chất lượng tự động (DOMATION AI hoặc Luật thủ công cấu hình). Những dữ liệu không đạt chuẩn sẽ được tạm giữ phê duyệt và gửi tin báo cho Quản trị viên, giúp tiết kiệm thời gian Telesale.")}
            </p>
          </div>
          <button
            onClick={() => setIsDynamicFlowExpanded(!isDynamicFlowExpanded)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-primary-light)',
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              alignSelf: 'center',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            {isDynamicFlowExpanded ? t('Thu gọn') : t('Cách hoạt động')}
            <span style={{ transform: isDynamicFlowExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', fontSize: '10px' }}>▼</span>
          </button>
        </div>

        {/* Dynamic step-by-step logic panel */}
        {isDynamicFlowExpanded && (
          <div style={{
            marginTop: '0.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px dashed var(--color-primary-light)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {t('LUỒNG XỬ LÝ HIỆN TẠI (DYNAMIC FLOW):')}
            </h5>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
              position: 'relative'
            }}>
              {/* Step 1 */}
              <div className="flow-step-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                    color: '#fff',
                    fontWeight: 800,
                    width: 24, height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                    flexShrink: 0
                  }}>1</span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                    {t('Webhook tiếp nhận')}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                  {t('Lead mới được gửi realtime từ các kênh Google Sheets, Facebook Lead Ads, Landing Page...')}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: 'rgba(124, 58, 237, 0.08)',
                    color: '#7c3aed',
                    border: '1px solid rgba(124, 58, 237, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#7c3aed' }} />
                    {t('Thời gian thực (Realtime)')}
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flow-step-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                      color: '#fff',
                      fontWeight: 800,
                      width: 24, height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                      flexShrink: 0
                    }}>2</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {t('Kiểm tra bộ lọc AI')}
                    </span>
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: aiScreenerEnabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(124, 58, 237, 0.08)',
                    border: aiScreenerEnabled ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(124, 58, 237, 0.2)',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: aiScreenerEnabled ? '#10b981' : '#7c3aed'
                  }}>
                    {aiScreenerEnabled ? (
                      <>
                        <span style={{
                          width: 6, height: 6,
                          borderRadius: '50%',
                          background: '#10b981',
                          boxShadow: '0 0 6px #10b981',
                          display: 'inline-block'
                        }} />
                        {t('Đang BẬT')}
                      </>
                    ) : (
                      t('Ví dụ cấu hình')
                    )}
                  </div>
                </div>

                {aiScreenerEnabled ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                      {t('Kiểm tra vòng của Lead. Áp dụng cho các vòng:')}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {(() => {
                        const allRounds = aiScreenerConfigs.reduce<number[]>((acc: number[], cfg: AIScreenerConfig) => [...acc, ...cfg.rounds], []);
                        if (allRounds.length === 0) {
                          return (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                              {t('Chưa chọn vòng nào (Ví dụ: Form, BBA...)')}
                            </span>
                          );
                        }
                        return rounds
                          .filter((r: any) => allRounds.includes(Number(r.id)))
                          .map((r: any) => (
                            <span key={r.id} style={{
                              fontSize: '0.6875rem',
                              background: 'var(--color-bg-alt)',
                              border: '1px solid var(--color-border)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              color: 'var(--color-text)',
                              fontWeight: 500
                            }}>
                              {r.round_name}
                            </span>
                          ));
                      })()}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                      {t('Kiểm tra vòng của Lead. Áp dụng cho các vòng được chọn (Ví dụ):')}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      <span style={{
                        fontSize: '0.6875rem',
                        background: 'var(--color-bg-alt)',
                        border: '1px solid var(--color-border)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        color: 'var(--color-text)',
                        fontWeight: 500
                      }}>{t('Vòng Form')}</span>
                      <span style={{
                        fontSize: '0.6875rem',
                        background: 'var(--color-bg-alt)',
                        border: '1px solid var(--color-border)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        color: 'var(--color-text)',
                        fontWeight: 500
                      }}>{t('Vòng BBA')}</span>
                      <span style={{
                        fontSize: '0.6875rem',
                        background: 'var(--color-bg-alt)',
                        border: '1px solid var(--color-border)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        color: 'var(--color-text)',
                        fontWeight: 500
                      }}>{t('Facebook Ads')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3 */}
              <div className="flow-step-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                      color: '#fff',
                      fontWeight: 800,
                      width: 24, height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                      flexShrink: 0
                    }}>3</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {t('Đánh giá chất lượng')}
                    </span>
                  </div>
                  {!aiScreenerEnabled && (
                    <div style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: 'rgba(124, 58, 237, 0.08)',
                      color: '#7c3aed',
                      border: '1px solid rgba(124, 58, 237, 0.2)',
                      whiteSpace: 'nowrap'
                    }}>
                      {t('Ví dụ cấu hình')}
                    </div>
                  )}
                </div>

                {aiScreenerEnabled ? (
                  aiScreenerConfigs.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                      {t('Chưa có nhóm cấu hình lọc nào hoạt động.')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
                      {aiScreenerConfigs.map((cfg: AIScreenerConfig, idx: number) => {
                        const roundNames = rounds.filter((r: any) => cfg.rounds.includes(Number(r.id))).map((r: any) => r.round_name).join(', ');
                        return (
                          <div key={cfg.id} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            borderBottom: idx < aiScreenerConfigs.length - 1 ? '1px dashed var(--color-border)' : 'none',
                            paddingBottom: idx < aiScreenerConfigs.length - 1 ? 6 : 0
                          }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                              {cfg.name || `${t('Nhóm')} ${idx + 1}`}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {t('Vòng:')} {roundNames || t('Chưa chọn')}
                            </span>
                            {cfg.mode === 'ai' && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={cfg.ai_rules}>
                                <strong>{t('Quy tắc AI:')}</strong> {cfg.ai_rules || t('Chưa thiết lập')}
                              </span>
                            )}
                            {cfg.mode === 'manual' && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text)' }}>
                                <strong>{t('Quy tắc:')}</strong> {cfg.manual_rules && cfg.manual_rules.length > 0 ? `${cfg.manual_rules.length} ${t('nhánh lọc thủ công')}` : t('Chưa thiết lập')}
                              </span>
                            )}
                            {cfg.mode === 'hybrid' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text)' }}>
                                  <strong>{t('Match logic:')}</strong> {cfg.manual_rules && cfg.manual_rules.length > 0 ? `${cfg.manual_rules.length} ${t('nhánh thủ công')}` : t('Chưa thiết lập')}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={cfg.ai_rules}>
                                  <strong>{t('Quy tắc AI:')}</strong> {cfg.ai_rules || t('Chưa thiết lập')}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      borderBottom: '1px dashed var(--color-border)',
                      paddingBottom: 6
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {t('Ví dụ: Nhóm Lọc Tự Động')}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {t('Vòng:')} {t('Vòng Form, Facebook Ads')}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <strong>{t('Quy tắc AI:')}</strong> {t('Đạt chuẩn (đã đi làm hoặc có nhu cầu học ngay)...')}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {t('Ví dụ: Nhóm Duyệt Tay')}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {t('Vòng:')} {t('Vòng BBA')}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text)' }}>
                        <strong>{t('Quy tắc:')}</strong> {t('2 nhánh lọc thủ công (Loại trừ số rác...)')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4 */}
              <div className="flow-step-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                      color: '#fff',
                      fontWeight: 800,
                      width: 24, height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                      flexShrink: 0
                    }}>4</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {t('Phân bổ & Hàng chờ')}
                    </span>
                  </div>
                  {!aiScreenerEnabled && (
                    <div style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: 'rgba(124, 58, 237, 0.08)',
                      color: '#7c3aed',
                      border: '1px solid rgba(124, 58, 237, 0.2)',
                      whiteSpace: 'nowrap'
                    }}>
                      {t('Ví dụ cấu hình')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    {t('Sau khi đánh giá xong, Lead sẽ được phân luồng xử lý:')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.7rem', color: 'var(--color-text)', marginTop: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                      <span><strong>{t('Đạt chuẩn:')}</strong> {t('Tự động chia vòng & đồng bộ Sheets.')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
                      <span><strong>{t('Không đạt:')}</strong> {t('Giữ lại bảng này chờ Admin duyệt.')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main content card showing held queue ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', minHeight: '500px' }}>


        {/* Filter bar */}
        <div className="responsive-filter-row" style={{
          position: 'relative', zIndex: 100,
          display: 'flex', gap: 12, padding: '14px 18px',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.04) 0%, rgba(99,102,241,0.02) 100%)',
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7c3aed', fontWeight: 700, fontSize: '0.8125rem' }}>
            <Filter size={14} />
            <span>{t('Bộ lọc')}</span>
          </div>
          <div className="hide-on-mobile" style={{ width: 1, height: 20, background: 'rgba(124,58,237,0.2)', margin: '0 4px' }} />

          <div className="mobile-stack" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: 260 }}>
            {/* Search Input + Refresh Button */}
            <div className="mobile-w-full" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: 350 }}>
              <input
                type="text"
                value={heldLeadsSearch}
                onChange={e => setHeldLeadsSearch(e.target.value)}
                placeholder={t("Tìm kiếm Tên, SĐT, Email...")}
                className="form-input mobile-w-full"
                style={{ height: 44, fontSize: '0.85rem', width: '100%', maxWidth: 350, borderRadius: 'var(--radius-lg)', padding: '0 1rem', flex: 1 }}
              />
              <button
                onClick={fetchHeldLeads}
                disabled={heldLeadsLoading}
                title={t("Làm mới")}
                className="btn outline mobile-only"
                style={{
                  padding: 0,
                  borderRadius: 'var(--radius-lg)',
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-muted)',
                  cursor: heldLeadsLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  flexShrink: 0
                }}
              >
                <RefreshCw size={15} style={{ animation: heldLeadsLoading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>

            {/* Date Select + Stats Button */}
            <div className="mobile-w-full" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: 180 }}>
              <div style={{ position: 'relative', width: '100%' }} className="mobile-flex-1">
                <CustomSelect
                  options={dateOptions}
                  value={dateFilter}
                  onChange={val => {
                    if (val === 'Tùy chỉnh') {
                      setShowDateModal(true);
                      return;
                    }
                    updateParams('date', val.toString());
                  }}
                  width="100%"
                />
              </div>

              <button
                onClick={() => setIsStatsModalOpen(true)}
                className="btn primary mobile-only"
                style={{
                  height: 44,
                  fontSize: '0.825rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flex: 1,
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                  border: 'none',
                  boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                  color: '#fff',
                  fontWeight: 600
                }}
              >
                <BarChart2 size={15} />
                <span>{t('Thống kê')}</span>
              </button>
            </div>

            {/* Desktop filter buttons */}
            <button
              onClick={fetchHeldLeads}
              disabled={heldLeadsLoading}
              title={t("Làm mới")}
              className="btn outline hide-on-mobile"
              style={{
                padding: 0,
                borderRadius: 'var(--radius-lg)',
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-muted)',
                cursor: heldLeadsLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                flexShrink: 0
              }}
            >
              <RefreshCw size={15} style={{ animation: heldLeadsLoading ? 'spin 1s linear infinite' : 'none' }} />
            </button>

            <button
              onClick={() => setIsStatsModalOpen(true)}
              className="btn primary hide-on-mobile"
              style={{
                height: 44,
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: 'auto',
                padding: '0 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              <BarChart2 size={15} />
              <span>{t('Thống kê dưới chuẩn')}</span>
            </button>
          </div>
        </div>

        {/* Held Leads Queue Table */}
        {heldLeadsLoading ? (
          <div style={{ padding: '2rem' }}><TableSkeleton rows={8} cols={4} /></div>
        ) : heldLeads.length === 0 ? (
          <div style={{ padding: '8rem 2rem', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <CheckCircle size={40} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
              {heldLeadsSearch ? t('Không tìm thấy liên hệ nào') : t('Không có liên hệ nào đang tạm giữ')}
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0' }}>
              {heldLeadsSearch ? t('Thử đổi từ khóa tìm kiếm.') : t('Hệ thống AI chưa tạm giữ bất kỳ liên hệ dưới chuẩn nào.')}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop View Table */}
            <div className="table-wrap hide-on-mobile" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
              <table className="mobile-table-compact" style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', width: 240, minWidth: 240, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Thông tin Lead')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', width: 180, minWidth: 180, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Vòng phân bổ dự kiến')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Lý do AI tạm giữ')}</th>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', width: 280, minWidth: 280, position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Thao tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {heldLeads.map((l: any) => (
                    <tr
                      key={l.id}
                      onClick={() => {
                        setSelectedLead({
                          id: l.id,
                          name: l.name,
                          phone: l.phone,
                          email: l.email || '-',
                          source: l.source || '-',
                          status: l.status,
                          assigned_to_name: '-',
                          round_name: l.round_name || '-',
                          created_at: l.created_at,
                          type: l.type || '-',
                          note: l.note || '',
                          ai_screener_status: l.ai_screener_status,
                          ai_evaluation: l.ai_evaluation
                        });
                      }}
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', background: 'transparent', cursor: 'pointer' }}
                      className="lead-row"
                    >
                      <td style={{ padding: '1.25rem 1.5rem', width: 240, minWidth: 240, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar name={l.name} size={36} />
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{l.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{maskPhone(l.phone)}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                              {new Date(l.created_at).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', width: 180, minWidth: 180 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
                          <Zap size={12} /> {l.round_name || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {l.ai_screener_status === 'error' ? (
                            <span style={{ padding: '4px 10px', alignSelf: 'flex-start', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertTriangle size={12} /> {t('Lỗi kết nối AI (AI Error)')}
                            </span>
                          ) : (
                            <span style={{ padding: '4px 10px', alignSelf: 'flex-start', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <ShieldAlert size={12} /> {t('Dưới chuẩn (AI Held)')}
                            </span>
                          )}
                          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', lineHeight: 1.4, marginTop: 4, whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 450 }}>
                            <strong>{l.ai_screener_status === 'error' ? t('Chi tiết lỗi:') : (l.ai_evaluation?.includes('bộ lọc thủ công') || l.ai_evaluation?.includes('khớp luật thủ công') || l.ai_evaluation?.includes('Bỏ qua gọi AI')) ? t('Match logic:') : t('AI Đánh giá:')}</strong> {l.ai_evaluation || (l.ai_screener_status === 'error' ? t('Mất kết nối với dịch vụ AI.') : t('Không đáp ứng yêu cầu bộ lọc.'))}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              setActioningHeldLead(l);
                              setHeldActionReason('');
                              setHeldActionModalOpen('blacklist');
                            }}
                            className="btn outline sm"
                            style={{
                              color: 'var(--color-danger)',
                              borderColor: 'var(--color-danger)',
                              boxShadow: 'none',
                              padding: '0 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '32px',
                              height: '32px'
                            }}
                            title={t("Đưa khách hàng vào danh sách đen & Xác nhận dưới chuẩn (Blacklist)")}
                          >
                            <ShieldAlert size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setActioningHeldLead(l);
                              setHeldActionReason('');
                              setHeldActionModalOpen('reject');
                            }}
                            className="btn primary sm"
                            style={{ background: 'var(--color-warning)', borderColor: 'var(--color-warning)', color: '#ffffff', boxShadow: 'none' }}
                            title={t("Không duyệt và đánh dấu dưới chuẩn")}
                          >
                            {t('Xác nhận dưới chuẩn')}
                          </button>
                          <button
                            onClick={() => handleOpenApproveHeldLead(l)}
                            className="btn primary sm"
                            style={{
                              background: '#10b981',
                              borderColor: '#10b981',
                              boxShadow: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            title={t("Xem thử AI sẽ giao cho ai và Phê duyệt")}
                          >
                            <Check size={14} />
                            {t('Duyệt giao')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
              {heldLeads.map((l: any) => (
                <div
                  key={l.id}
                  onClick={() => {
                    setSelectedLead({
                      id: l.id,
                      name: l.name,
                      phone: l.phone,
                      email: l.email || '-',
                      source: l.source || '-',
                      status: l.status,
                      assigned_to_name: '-',
                      round_name: l.round_name || '-',
                      created_at: l.created_at,
                      type: l.type || '-',
                      note: l.note || '',
                      ai_screener_status: l.ai_screener_status,
                      ai_evaluation: l.ai_evaluation
                    });
                  }}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  className="hover-lift"
                >
                  {/* Header: Lead Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Avatar name={l.name} size={32} />
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.95rem' }}>{l.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          <Phone size={12} style={{ opacity: 0.6 }} />
                          <span>{l.phone ? maskPhone(l.phone) : '-'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--color-text-light)' }}>
                        <Clock size={12} style={{ opacity: 0.6 }} />
                        <span>
                          {new Date(l.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                          {new Date(l.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      {l.round_name && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
                          <Zap size={10} /> {l.round_name}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--color-border-light)' }} />

                  {/* AI Evaluation details callout */}
                  <div style={{
                    background: l.ai_screener_status === 'error' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(239, 68, 68, 0.04)',
                    borderLeft: `3px solid ${l.ai_screener_status === 'error' ? '#d97706' : 'var(--color-danger)'}`,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {l.ai_screener_status === 'error' ? (
                        <>
                          <AlertTriangle size={12} color="#d97706" />
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#d97706' }}>
                            {t('Lỗi kết nối AI (AI Error)')}
                          </span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={12} color="var(--color-danger)" />
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-danger)' }}>
                            {t('Dưới chuẩn (AI Held)')}
                          </span>
                        </>
                      )}
                    </div>
                    
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      <strong>{l.ai_screener_status === 'error' ? t('Chi tiết lỗi:') : (l.ai_evaluation?.includes('bộ lọc thủ công') || l.ai_evaluation?.includes('khớp luật thủ công') || l.ai_evaluation?.includes('Bỏ qua gọi AI')) ? t('Match logic:') : t('AI Đánh giá:')}</strong>{' '}
                      {l.ai_evaluation || (l.ai_screener_status === 'error' ? t('Mất kết nối với dịch vụ AI.') : t('Không đáp ứng yêu cầu bộ lọc.'))}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }} onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => {
                        setActioningHeldLead(l);
                        setHeldActionReason('');
                        setHeldActionModalOpen('blacklist');
                      }}
                      className="btn outline sm" 
                      style={{ 
                        color: 'var(--color-danger)', 
                        borderColor: 'var(--color-danger)', 
                        boxShadow: 'none', 
                        width: 36, 
                        height: 36, 
                        padding: 0, 
                        borderRadius: 10, 
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                      title={t("Chặn & Blacklist")}
                    >
                      <ShieldAlert size={16} />
                    </button>
                    
                    <button 
                      onClick={() => {
                        setActioningHeldLead(l);
                        setHeldActionReason('');
                        setHeldActionModalOpen('reject');
                      }}
                      className="btn primary sm" 
                      style={{ background: 'var(--color-warning)', borderColor: 'var(--color-warning)', color: '#ffffff', boxShadow: 'none', height: 36, borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      title={t('Dưới chuẩn')}
                    >
                      <XCircle size={14} />
                      <span>{t('Dưới chuẩn')}</span>
                    </button>

                    <button 
                      onClick={() => handleOpenApproveHeldLead(l)}
                      className="btn primary sm" 
                      style={{ background: '#10b981', borderColor: '#10b981', boxShadow: 'none', height: 36, borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      title={t('Duyệt')}
                    >
                      <Check size={14} />
                      <span>{t('Duyệt')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {!heldLeadsLoading && heldLeadsTotalCount > ITEMS_PER_PAGE && (
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, heldLeadsTotalCount)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{heldLeadsTotalCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => updateParams('page', String(Math.max(currentPage - 1, 1)))}
                disabled={currentPage === 1}
                style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: currentPage === 1 ? 'var(--color-bg)' : 'var(--color-surface)', color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={16} />
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: Math.min(5, Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE)) }, (_, i) => {
                  const totalHeldPages = Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE);
                  let startPage = 1;
                  if (totalHeldPages > 5) {
                    if (currentPage > 3) {
                      startPage = currentPage - 2;
                      if (startPage + 4 > totalHeldPages) {
                        startPage = totalHeldPages - 4;
                      }
                    }
                  }
                  const pageNum = startPage + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => updateParams('page', pageNum.toString())}
                      style={{
                        width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                        border: currentPage === pageNum ? 'none' : '1px solid var(--color-border)',
                        background: currentPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: currentPage === pageNum ? 'white' : 'var(--color-text)',
                        cursor: 'pointer'
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => updateParams('page', String(Math.min(currentPage + 1, Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE))))}
                disabled={currentPage === Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE)}
                style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: currentPage === Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE) ? 'var(--color-bg)' : 'var(--color-surface)', color: currentPage === Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE) ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal (Cấu hình Bộ lọc AI) */}
      <CustomModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title={t("Cấu hình Bộ lọc AI")}
        width="950px"
      >
        <style>{`
          div:has(> .settings-modal-container) {
            overflow: hidden !important;
            padding: 0 !important;
          }
        `}</style>
        <div className="settings-modal-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(80vh - 100px)', padding: '1.5rem', overflowX: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {settingsLoading ? (
                <TableSkeleton rows={4} cols={2} />
              ) : (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1.25rem',
                    background: 'var(--color-bg-alt)', borderRadius: '12px', border: '1px dashed var(--color-border)'
                  }}>
                    <ToggleSwitch
                      checked={aiScreenerEnabled}
                      onChange={setAiScreenerEnabled}
                    />
                    <div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {t('Kích hoạt AI Pre-screener (Pre-screener Gatekeeper)')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                        {t('Khi bật, mọi data mới thuộc các vòng được chọn sẽ đi qua bộ lọc AI đánh giá trước khi phân bổ tự động.')}
                      </div>
                    </div>
                  </div>



                  {aiScreenerEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>

                      {/* Configuration Cards List */}
                      {aiScreenerConfigs.map((config: AIScreenerConfig, index: number) => {
                        return (
                          <div
                            key={config.id}
                            style={{
                              border: '1px solid var(--color-border)',
                              borderRadius: '12px',
                              padding: '1.25rem',
                              position: 'relative',
                              background: 'var(--color-surface)',
                              boxShadow: 'var(--shadow-sm)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1rem'
                            }}
                          >
                            {/* Card Decorative Left border */}
                            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: 'var(--color-primary)', borderRadius: '12px 0 0 12px' }} />

                            {/* Card Header: Title input and Delete button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, marginRight: '1.5rem' }}>
                                <span style={{
                                  background: 'rgba(124, 58, 237, 0.1)',
                                  color: 'var(--color-primary)',
                                  fontWeight: 800,
                                  width: 24, height: 24,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.8rem',
                                  flexShrink: 0
                                }}>{index + 1}</span>
                                <input
                                  type="text"
                                  value={config.name}
                                  onChange={e => {
                                    const updated = [...aiScreenerConfigs];
                                    updated[index].name = e.target.value;
                                    setAiScreenerConfigs(updated);
                                  }}
                                  placeholder={t("Tên nhóm cấu hình (Ví dụ: Nhóm Vòng tiếng Anh)")}
                                  className="form-input"
                                  style={{ height: 36, fontSize: '0.875rem', fontWeight: 700, width: '100%', maxWidth: 350, border: 'none', background: 'transparent', padding: '0 4px', borderBottom: '1px dashed var(--color-border)' }}
                                />
                              </div>
                              <button
                                type="button"
                                className="btn ghost"
                                style={{ color: 'var(--color-danger)', padding: 4 }}
                                onClick={() => {
                                  setAiScreenerConfigs(aiScreenerConfigs.filter((cfg: AIScreenerConfig) => cfg.id !== config.id));
                                }}
                                title={t("Xóa nhóm cấu hình lọc này")}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            {/* Section 1: Choose Rounds (Tags Select with Dropdown) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                              <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                {t('Chọn các vòng áp dụng cho nhóm này')}
                              </label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                {/* Display already selected rounds */}
                                {config.rounds.map((roundId: number) => {
                                  const r = rounds.find((x: any) => Number(x.id) === roundId);
                                  if (!r) return null;
                                  return (
                                    <span
                                      key={roundId}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '5px 12px',
                                        borderRadius: '9999px',
                                        fontSize: '0.8125rem',
                                        fontWeight: 600,
                                        border: '1px solid var(--color-primary)',
                                        background: 'var(--color-primary)',
                                        color: '#ffffff',
                                        boxShadow: '0 2px 8px rgba(124, 58, 237, 0.2)',
                                        transition: 'all 0.2s ease'
                                      }}
                                    >
                                      <Tag size={12} style={{ opacity: 0.9 }} />
                                      {r.round_name}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...aiScreenerConfigs];
                                          updated[index].rounds = config.rounds.filter((id: number) => id !== roundId);
                                          setAiScreenerConfigs(updated);
                                        }}
                                        style={{
                                          border: 'none',
                                          background: 'rgba(255, 255, 255, 0.15)',
                                          color: '#ffffff',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          padding: '2px',
                                          borderRadius: '50%',
                                          marginLeft: '4px',
                                          outline: 'none',
                                          transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
                                          e.currentTarget.style.color = '#ffffff';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                          e.currentTarget.style.color = '#ffffff';
                                        }}
                                      >
                                        <X size={10} />
                                      </button>
                                    </span>
                                  );
                                })}

                                {/* Plus Button to add more rounds */}
                                <div style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveRoundsDropdown(activeRoundsDropdown === config.id ? null : config.id);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '5px 12px',
                                      borderRadius: '9999px',
                                      fontSize: '0.8125rem',
                                      fontWeight: 600,
                                      border: '1px dashed var(--color-primary-light)',
                                      background: 'rgba(124, 58, 237, 0.02)',
                                      color: 'var(--color-primary)',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      outline: 'none',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                                      e.currentTarget.style.transform = 'translateY(-0.5px)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(124, 58, 237, 0.02)';
                                      e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                                      e.currentTarget.style.transform = 'none';
                                    }}
                                  >
                                    <Plus size={12} />
                                    <span>{t('Thêm vòng')}</span>
                                  </button>

                                  {/* Dropdown Menu */}
                                  {activeRoundsDropdown === config.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 6px)',
                                        left: 0,
                                        zIndex: 55,
                                        minWidth: '220px',
                                        background: 'var(--color-surface)',
                                        border: '1px solid rgba(124, 58, 237, 0.15)',
                                        borderRadius: '12px',
                                        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.3)',
                                        maxHeight: '220px',
                                        overflowY: 'auto',
                                        padding: '6px'
                                      }}
                                    >
                                      {(() => {
                                        // Filter rounds that are NOT selected in this config
                                        const availableRounds = rounds.filter((r: any) => !config.rounds.includes(Number(r.id)));

                                        if (availableRounds.length === 0) {
                                          return (
                                            <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                              {t('Không còn vòng nào khả dụng')}
                                            </div>
                                          );
                                        }

                                        return availableRounds.map((r: any) => {
                                          const roundId = Number(r.id);
                                          const isInactive = Number(r.is_active) !== 1;
                                          // Check if selected in another config
                                          const selectedElsewhere = aiScreenerConfigs.some((cfg: AIScreenerConfig, idx: number) => idx !== index && cfg.rounds.includes(roundId)) || aiScreenerConfigs.some(cfg => cfg.below_standard_fallback_enabled && Number(roundId) === Number(cfg.below_standard_fallback_round_id));

                                          return (
                                            <button
                                              key={roundId}
                                              type="button"
                                              disabled={selectedElsewhere || isInactive}
                                              onClick={() => {
                                                const updated = [...aiScreenerConfigs];
                                                updated[index].rounds = [...config.rounds, roundId];
                                                setAiScreenerConfigs(updated);
                                                setActiveRoundsDropdown(null);
                                              }}
                                              style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                fontSize: '0.8125rem',
                                                fontWeight: 550,
                                                textAlign: 'left',
                                                border: 'none',
                                                background: 'transparent',
                                                color: (selectedElsewhere || isInactive) ? 'var(--color-text-muted)' : 'var(--color-text)',
                                                opacity: (selectedElsewhere || isInactive) ? 0.45 : 1,
                                                cursor: (selectedElsewhere || isInactive) ? 'not-allowed' : 'pointer',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '10px',
                                                transition: 'all 0.15s ease',
                                                outline: 'none'
                                              }}
                                              onMouseEnter={(e) => {
                                                if (!selectedElsewhere && !isInactive) {
                                                  e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                                                  e.currentTarget.style.color = 'var(--color-primary)';
                                                }
                                              }}
                                              onMouseLeave={(e) => {
                                                if (!selectedElsewhere && !isInactive) {
                                                  e.currentTarget.style.background = 'transparent';
                                                  e.currentTarget.style.color = 'var(--color-text)';
                                                }
                                              }}
                                            >
                                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (selectedElsewhere || isInactive) ? 'var(--color-text-muted)' : 'var(--color-primary)' }} />
                                                {r.round_name}
                                              </span>
                                              {isInactive ? (
                                                <span style={{
                                                  fontSize: '0.6875rem',
                                                  color: 'var(--color-text-muted)',
                                                  background: 'rgba(0, 0, 0, 0.05)',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  fontWeight: 600,
                                                  flexShrink: 0
                                                }}>
                                                  {t('Không hoạt động')}
                                                </span>
                                              ) : selectedElsewhere && (
                                                <span style={{
                                                  fontSize: '0.6875rem',
                                                  color: 'var(--color-danger)',
                                                  background: 'rgba(239, 68, 68, 0.08)',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  fontWeight: 600,
                                                  flexShrink: 0,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '4px'
                                                }}>
                                                  <Shield size={10} />
                                                  {t('Nhóm khác')}
                                                </span>
                                              )}
                                            </button>
                                          );
                                        });
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>


                            {/* Section 2: Choose Mode */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                {t('Chế độ Lọc Pre-screener')}
                              </label>
                              <CustomSelect
                                options={[
                                  { value: 'manual', label: t('Sử dụng Quy tắc Thủ công (Manual Rules)') },
                                  { value: 'hybrid', label: t('Kết hợp: Lọc Thủ công + AI (Ưu tiên thủ công trước)') },
                                  { value: 'ai', label: t('Sử dụng Trí tuệ Nhân tạo (Gemini AI)') }
                                ]}
                                value={config.mode}
                                onChange={val => {
                                  const updated = [...aiScreenerConfigs];
                                  updated[index].mode = val as any;
                                  setAiScreenerConfigs(updated);
                                }}
                                width="100%"
                              />
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                                {config.mode === 'hybrid' && (
                                  <span style={{ color: '#059669', fontWeight: 500 }}>
                                    {t('Chế độ Kết hợp: Hệ thống chạy bộ lọc thủ công trước. Nếu khớp, thực hiện ngay hành động và BỎ QUA gọi AI để tiết kiệm tối đa chi phí. Nếu không khớp, mới gọi AI đánh giá.')}
                                  </span>
                                )}
                                {config.mode === 'manual' && (
                                  <span>
                                    {t('Chế độ Thủ công: Chỉ áp dụng quy tắc khớp cột dữ liệu đã cấu hình.')}
                                  </span>
                                )}
                                {config.mode === 'ai' && (
                                  <span>
                                    {t('Chế độ AI: DOMATION AI để đánh giá theo yêu cầu cấu hình dưới.')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Conditional Prompt Area */}
                            {(config.mode === 'ai' || config.mode === 'hybrid') && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                  {t('Quy tắc đạt chuẩn duy nhất')}
                                </label>
                                <textarea
                                  value={config.ai_rules}
                                  onChange={e => {
                                    const updated = [...aiScreenerConfigs];
                                    updated[index].ai_rules = e.target.value;
                                    setAiScreenerConfigs(updated);
                                  }}
                                  rows={4}
                                  className="form-input"
                                  style={{ resize: 'vertical' }}
                                  placeholder={t("Ví dụ: Tiếng Anh: Đạt chuẩn (đã đi làm hoặc có IELTS), Không đạt chuẩn (học sinh cấp 1, 2)...")}
                                />
                              </div>
                            )}

                            {/* Conditional Manual Rules Area */}
                            {(config.mode === 'manual' || config.mode === 'hybrid') && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                    {t('Danh sách Quy tắc Lọc Thủ công')}
                                  </label>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Hành động khi khớp:')}</span>
                                    <div style={{ width: 140 }}>
                                      <CustomSelect
                                        options={[
                                          { value: 'hold', label: t('Tạm giữ') },
                                          { value: 'skip', label: t('Bỏ qua/Duyệt') }
                                        ]}
                                        value={config.manual_action}
                                        onChange={val => {
                                          const updated = [...aiScreenerConfigs];
                                          updated[index].manual_action = val as any;
                                          setAiScreenerConfigs(updated);
                                        }}
                                        width="100%"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                  {(config.manual_rules || []).map((branch: any, bIndex: number) => (
                                    <div key={bIndex} style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1.25rem', position: 'relative', background: 'var(--color-bg-alt)' }}>
                                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: '#10b981', borderRadius: '12px 0 0 12px' }} />
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', margin: 0 }}>
                                          {t("Nhánh {num}").replace('{num}', String(bIndex + 1))}
                                        </h4>
                                        <button
                                          type="button"
                                          className="btn ghost"
                                          style={{ color: 'var(--color-danger)', padding: 4 }}
                                          onClick={() => {
                                            const updated = [...aiScreenerConfigs];
                                            updated[index].manual_rules = config.manual_rules.filter((_: any, idx: number) => idx !== bIndex);
                                            setAiScreenerConfigs(updated);
                                          }}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>

                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {(branch.conditions || []).map((c: any, i: number) => {
                                          const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
                                          const isLast = i === branch.conditions.length - 1;
                                          return (
                                            <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                              <div style={{ position: 'relative', width: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                {i === 0 ? (
                                                  <div style={{ background: '#d1fae5', color: '#047857', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, zIndex: 2 }}>IF</div>
                                                ) : (
                                                  <div style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0, zIndex: 2 }}>AND</div>
                                                )}
                                                {!isLast && (
                                                  <div style={{ position: 'absolute', top: 32, bottom: -16, width: 2, background: 'var(--color-border)', zIndex: 1 }} />
                                                )}
                                              </div>

                                              <div style={{ width: 140 }}>
                                                <CustomSelect
                                                  options={[
                                                    { value: 'source', label: t('Nguồn (Source)') },
                                                    { value: 'name', label: t('Tên KH (Name)') },
                                                    { value: 'phone', label: t('Số ĐT (Phone)') },
                                                    { value: 'email', label: t('Email') },
                                                    { value: 'note', label: t('Ghi chú (Note)') }
                                                  ]}
                                                  value={c.col || 'source'}
                                                  onChange={val => {
                                                    const updated = [...aiScreenerConfigs];
                                                    updated[index].manual_rules[bIndex].conditions[i].col = String(val);
                                                    setAiScreenerConfigs(updated);
                                                  }}
                                                  width="100%"
                                                />
                                              </div>

                                              <div style={{ width: 150 }}>
                                                <CustomSelect
                                                  options={[
                                                    { value: 'contains', label: t('Có chứa') },
                                                    { value: 'not_contains', label: t('Không chứa') },
                                                    { value: 'equals', label: t('Bằng') },
                                                    { value: 'starts_with', label: t('Bắt đầu bằng') },
                                                    { value: 'ends_with', label: t('Kết thúc bằng') },
                                                    { value: 'is_empty', label: t('Rỗng') },
                                                    { value: 'is_not_empty', label: t('Không rỗng') }
                                                  ]}
                                                  value={c.op || 'contains'}
                                                  onChange={val => {
                                                    const updated = [...aiScreenerConfigs];
                                                    updated[index].manual_rules[bIndex].conditions[i].op = String(val);
                                                    if (val === 'is_empty' || val === 'is_not_empty') {
                                                      updated[index].manual_rules[bIndex].conditions[i].val = '';
                                                    }
                                                    setAiScreenerConfigs(updated);
                                                  }}
                                                  width="100%"
                                                />
                                              </div>

                                              {!isNoValueOp && (
                                                <div style={{ flex: 1, minWidth: 150 }}>
                                                  <input
                                                    type="text"
                                                    value={c.val || ''}
                                                    onChange={e => {
                                                      const updated = [...aiScreenerConfigs];
                                                      updated[index].manual_rules[bIndex].conditions[i].val = e.target.value;
                                                      setAiScreenerConfigs(updated);
                                                    }}
                                                    placeholder={t("Giá trị so khớp...")}
                                                    className="form-input"
                                                    style={{ height: 36, fontSize: '0.825rem', width: '100%' }}
                                                  />
                                                </div>
                                              )}

                                              <button
                                                type="button"
                                                className="btn ghost"
                                                style={{ color: 'var(--color-text-muted)', padding: 4 }}
                                                onClick={() => {
                                                  const updated = [...aiScreenerConfigs];
                                                  const remaining = config.manual_rules[bIndex].conditions.filter((_: any, idx: number) => idx !== i);
                                                  if (remaining.length === 0) {
                                                    updated[index].manual_rules = config.manual_rules.filter((_: any, idx: number) => idx !== bIndex);
                                                  } else {
                                                    updated[index].manual_rules[bIndex].conditions = remaining;
                                                  }
                                                  setAiScreenerConfigs(updated);
                                                }}
                                              >
                                                <XCircle size={16} />
                                              </button>
                                            </div>
                                          );
                                        })}

                                        <div style={{ paddingLeft: 32, marginTop: 4 }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = [...aiScreenerConfigs];
                                              updated[index].manual_rules[bIndex].conditions.push({ col: 'source', op: 'contains', val: '' });
                                              setAiScreenerConfigs(updated);
                                            }}
                                            className="btn ghost"
                                            style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4 }}
                                          >
                                            <Plus size={12} /> {t("Thêm điều kiện (AND)")}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...aiScreenerConfigs];
                                        updated[index].manual_rules = [...(config.manual_rules || []), { conditions: [{ col: 'source', op: 'contains', val: '' }] }];
                                        setAiScreenerConfigs(updated);
                                      }}
                                      className="btn outline"
                                      style={{ gap: 6, fontWeight: 700, borderRadius: 20, borderColor: 'var(--color-primary)', color: 'var(--color-primary)', padding: '6px 14px', fontSize: '0.8125rem' }}
                                    >
                                      <Plus size={14} /> {t("Thêm nhánh quy tắc")}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Section: Substandard Lead Fallback Settings (per branch) */}
                            <div style={{
                              borderTop: '1px dashed var(--color-border)',
                              paddingTop: '1.25rem',
                              marginTop: '0.5rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <ToggleSwitch
                                  checked={!!config.below_standard_fallback_enabled}
                                  onChange={checked => {
                                    const updated = [...aiScreenerConfigs];
                                    updated[index].below_standard_fallback_enabled = checked;
                                    setAiScreenerConfigs(updated);
                                  }}
                                />
                                <div>
                                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {t('Fallback lead dưới chuẩn vào vòng khác')}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                    {t('Nếu bật, lead dưới chuẩn thuộc nhóm này sẽ được chuyển vào một vòng chỉ định thay vì hủy bỏ.')}
                                  </div>
                                </div>
                              </div>

                              {config.below_standard_fallback_enabled && (
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                  gap: '1.5rem',
                                  paddingLeft: '3.25rem',
                                  alignItems: 'start',
                                  animation: 'fadeIn 0.15s ease-out'
                                }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                      {t('Vòng nhận lead dưới chuẩn (Fallback Round)')}
                                    </label>
                                    <CustomSelect
                                      options={[
                                        { value: '', label: `-- ${t('Chọn Vòng phân bổ fallback')} --` },
                                        ...rounds.map((r: any) => ({ 
                                          value: String(r.id), 
                                          label: r.round_name,
                                          disabled: Number(r.is_active) !== 1,
                                          disabledType: 'round' as const
                                        }))
                                      ]}
                                      value={config.below_standard_fallback_round_id ? String(config.below_standard_fallback_round_id) : ''}
                                      onChange={val => {
                                        const updated = [...aiScreenerConfigs];
                                        updated[index].below_standard_fallback_round_id = val ? Number(val) : '';
                                        setAiScreenerConfigs(updated);
                                      }}
                                      width="100%"
                                    />
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: '22px' }}>
                                    <ToggleSwitch
                                      checked={!!config.below_standard_auto_approve}
                                      onChange={checked => {
                                        const updated = [...aiScreenerConfigs];
                                        updated[index].below_standard_auto_approve = checked;
                                        setAiScreenerConfigs(updated);
                                      }}
                                    />
                                    <div>
                                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                        {t('Tự động duyệt lead dưới chuẩn (Không tạm giữ)')}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.45 }}>
                                        {t('Nếu bật, data dưới chuẩn sẽ được chuyển thẳng đến vòng fallback mà không đưa vào hàng chờ.')}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>
                        );
                      })}

                      {/* Add Group Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setAiScreenerConfigs([...aiScreenerConfigs, {
                            id: 'config_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            name: '',
                            rounds: [],
                            mode: 'ai',
                            ai_rules: '',
                            manual_action: 'hold',
                            manual_rules: []
                          }]);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '1.25rem',
                          borderRadius: '12px',
                          border: '2px dashed var(--color-primary-light)',
                          background: 'rgba(124, 58, 237, 0.02)',
                          color: 'var(--color-primary)',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          width: '100%'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(124, 58, 237, 0.06)';
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(124, 58, 237, 0.02)';
                          e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                        }}
                      >
                        <Plus size={16} /> {t("Thêm nhóm cấu hình lọc mới")}
                      </button>

                    </div>
                  )}
                </>
              )}
            </div>

          </div>

          {/* Sticky Bottom Actions Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: '1px solid var(--color-border)',
            paddingTop: '1rem',
            marginTop: '0.75rem',
            flexShrink: 0
          }}>
            <button className="btn outline" onClick={() => setIsSettingsModalOpen(false)}>
              {t("Đóng")}
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={savingSettings}
              className="btn primary"
              style={{ gap: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', padding: '10px 24px' }}
            >
              {savingSettings ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
              {t("Lưu cấu hình bộ lọc")}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Guide Modal */}
      <CustomModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        title={t("Ưu điểm & Hướng dẫn sử dụng Bộ lọc AI")}
        width="950px"
      >
        <style>{`
          div:has(> .guide-modal-container) {
            overflow: hidden !important;
            padding: 0 !important;
          }
        `}</style>
        <div className="guide-modal-container" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowX: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }} className="responsive-grid-1-1">
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={18} color="#eab308" />
                  {t('Mẹo cấu hình Gemini AI')}
                </h4>
                <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  <li>
                    <strong>{t('Đặt tiêu chuẩn rõ ràng:')}</strong> {t('AI hoạt động tốt nhất khi được cung cấp quy tắc dạng logic như "Tiếng Anh: Đạt chuẩn (đã đi làm hoặc sinh viên muốn IELTS), Không đạt (học sinh cấp 1, cấp 2 hoặc không nghe điện thoại)".')}
                  </li>
                  <li>
                    <strong>{t('Không cần viết code:')}</strong> {t('Hãy dùng ngôn ngữ tự nhiên bình thường. AI có khả năng đọc ghi chú, thông tin học vấn hay nguồn để suy luận rất tốt.')}
                  </li>
                  <li>
                    <strong>{t('Luôn chỉ rõ trường hợp loại trừ:')}</strong> {t('Ví dụ: "Số điện thoại bị thiếu số hoặc ghi chú ghi là test thì luôn đánh giá không đạt chuẩn".')}
                  </li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={18} color="#3b82f6" />
                  {t('Hướng dẫn xử lý duyệt')}
                </h4>
                <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  <li>
                    <strong>{t('Duyệt giao:')}</strong> {t('Lead sẽ được giao tự động cho Sale tiếp theo trong vòng chia số hiện tại. Bạn có thể xem trước Sale nhận ở popup trước khi ấn duyệt.')}
                  </li>
                  <li>
                    <strong>{t('Xác nhận dưới chuẩn:')}</strong> {t('Hệ thống đánh dấu lead này dưới chuẩn và loại bỏ khỏi hàng chờ. Nó sẽ không được chia số và không làm tốn lượt của tư vấn viên.')}
                  </li>
                  <li>
                    <strong>{t('Chặn & Blacklist:')}</strong> {t('Đưa số điện thoại này vào Global Blacklist để tự động từ chối tuyệt đối tất cả các lead có số điện thoại này ở các lần đổ sau.')}
                  </li>
                </ul>
              </div>
            </div>

          </div>

          {/* Sticky Bottom Actions Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: '1px solid var(--color-border)',
            paddingTop: '1rem',
            marginTop: '0.75rem',
            flexShrink: 0
          }}>
            <button className="btn outline" onClick={() => setIsGuideModalOpen(false)}>
              {t("Đóng")}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Custom Date Picker Modal */}
      <CustomModal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        title={t("Tùy chỉnh thời gian")}
        width="400px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
          <div>
            <label className="form-label">{t("Từ ngày")}</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">{t("Đến ngày")}</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn outline" onClick={() => setShowDateModal(false)}>{t("Hủy")}</button>
            <button className="btn primary" onClick={handleCustomDateSubmit}>{t("Áp dụng")}</button>
          </div>
        </div>
      </CustomModal>

      {/* AI Pre-screener Filter Stats Modal */}
      <CustomModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        title={t("Thống kê bộ lọc AI Pre-screener")}
        width="1000px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem 0' }}>

          {/* Header/Subtitle containing selected Date Filter */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            background: 'rgba(124, 58, 237, 0.06)',
            border: '1px solid rgba(124, 58, 237, 0.15)',
            borderRadius: '10px',
            marginBottom: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} color="var(--color-primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                {t('Đang áp dụng bộ lọc thời gian:')}
              </span>
              <span style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
                boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2)'
              }}>
                {getDisplayDateFilterText(dateFilter)}
              </span>
            </div>
            {statsLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                <span>{t('Đang tải dữ liệu mới...')}</span>
              </div>
            )}
          </div>

          {statsLoading && !statsData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '3rem 0', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={32} color="var(--color-primary)" style={{ animation: 'spin 1.5s linear infinite' }} />
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('Đang tính toán thống kê...')}</span>
            </div>
          ) : !statsData ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              {t('Không có dữ liệu thống kê.')}
            </div>
          ) : (
            <>
              {/* Breakdowns columns grid (Rounds, Sources, Reasons) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px',
                marginTop: '10px'
              }}>
                {/* 1. Breakdown by Rounds */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed' }}></span>
                    {t('Vòng phân bổ dưới chuẩn nhiều nhất')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                    {statsData.rounds_breakdown?.length === 0 ? (
                      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {t('Không có dữ liệu phân bố vòng')}
                      </div>
                    ) : (
                      statsData.rounds_breakdown?.map((item: any, idx: number) => {
                        const totalBS = statsData.stats?.total_below_standard || 1;
                        const pct = Math.round((item.count / totalBS) * 100);
                        return (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{item.round_name}</span>
                              <span>{item.count} ({pct}%)</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #7c3aed, #9061f9)' }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. Breakdown by Sources */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }}></span>
                    {t('Nguồn kết nối dưới chuẩn nhiều nhất')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                    {statsData.sources_breakdown?.length === 0 ? (
                      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {t('Không có dữ liệu phân bố nguồn')}
                      </div>
                    ) : (
                      statsData.sources_breakdown?.map((item: any, idx: number) => {
                        const totalBS = statsData.stats?.total_below_standard || 1;
                        const pct = Math.round((item.count / totalBS) * 100);
                        return (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{item.source_name}</span>
                              <span>{item.count} ({pct}%)</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 3. Breakdown by Rejection Reason */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }}></span>
                    {t('Lý do AI loại / giữ nhiều nhất')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                    {statsData.reasons_breakdown?.length === 0 ? (
                      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {t('Không có dữ liệu phân bố lý do')}
                      </div>
                    ) : (
                      statsData.reasons_breakdown?.map((item: any, idx: number) => {
                        const totalBS = statsData.stats?.total_below_standard || 1;
                        const pct = Math.round((item.count / totalBS) * 100);
                        return (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{t(item.reason)}</span>
                              <span>{item.count} ({pct}%)</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #ef4444, #f87171)' }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Table of below-standard leads with pagination */}
              <div style={{ marginTop: '10px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={16} color="var(--color-danger)" />
                  {t('Danh sách lead dưới chuẩn')}
                </h4>
                <div style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.01)'
                }}>
                  <div className="responsive-table-wrap" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Thời gian')}</th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Họ tên / SĐT')}</th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Nguồn / Vòng')}</th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Đánh giá của AI')}</th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', width: '110px' }}>{t('Trạng thái')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRecentLeads.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              {t('Không có lead nào dưới chuẩn')}
                            </td>
                          </tr>
                        ) : (
                          paginatedRecentLeads.map((l: any, idx: number) => {
                            let statusBadge = null;
                            if (l.status === 'pending_approval') {
                              statusBadge = (
                                <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                                  {t('Tạm giữ')}
                                </span>
                              );
                            } else if (l.status === 'rejected') {
                              statusBadge = (
                                <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-danger)' }}>
                                  {t('Đã hủy')}
                                </span>
                              );
                            } else if (l.status === 'blacklisted') {
                              statusBadge = (
                                <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(0, 0, 0, 0.3)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
                                  {t('Blacklist')}
                                </span>
                              );
                            }

                            return (
                              <tr key={idx} style={{ borderBottom: idx < paginatedRecentLeads.length - 1 ? '1px solid var(--color-border)' : 'none', background: 'transparent' }}>
                                <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                  {new Date(l.created_at).toLocaleString('vi-VN')}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{l.name}</div>
                                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>
                                    {maskPhone(l.phone)}
                                  </div>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ color: 'var(--color-text)' }}>{l.source || '-'}</div>
                                  <div style={{ color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600, marginTop: '1.5px' }}>
                                    {l.round_name || '-'}
                                  </div>
                                </td>
                                <td style={{ padding: '10px 14px', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word', color: 'var(--color-text-muted)' }}>
                                  {l.ai_evaluation || l.note || t('Không có đánh giá')}
                                </td>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  {statusBadge}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {statsData.recent_below_standard && statsData.recent_below_standard.length > STATS_ITEMS_PER_PAGE && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderTop: '1px solid var(--color-border)',
                      background: 'rgba(255,255,255,0.01)',
                      fontSize: '0.8rem'
                    }}>
                      <div style={{ color: 'var(--color-text-muted)' }}>
                        {t('Hiển thị')}{' '}
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {(statsPage - 1) * STATS_ITEMS_PER_PAGE + 1}
                        </span>{' '}
                        -{' '}
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {Math.min(statsPage * STATS_ITEMS_PER_PAGE, statsData.recent_below_standard.length)}
                        </span>{' '}
                        {t('trên')}{' '}
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {statsData.recent_below_standard.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => setStatsPage(p => Math.max(p - 1, 1))}
                          disabled={statsPage === 1}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                            background: statsPage === 1 ? 'var(--color-bg)' : 'var(--color-surface)',
                            color: statsPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)',
                            cursor: statsPage === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ChevronLeft size={12} />
                          {t('Trước')}
                        </button>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                          {t('Trang')} {statsPage} / {Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE)}
                        </span>
                        <button
                          onClick={() => setStatsPage(p => Math.min(p + 1, Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE)))}
                          disabled={statsPage === Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                            background: statsPage === Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE) ? 'var(--color-bg)' : 'var(--color-surface)',
                            color: statsPage === Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE) ? 'var(--color-text-muted)' : 'var(--color-text)',
                            cursor: statsPage === Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {t('Sau')}
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}


        </div>
      </CustomModal>

      {/* Approve Held Lead Modal */}
      <CustomModal
        isOpen={heldActionModalOpen === 'approve'}
        onClose={() => setHeldActionModalOpen(null)}
        title={t("Phê duyệt & Phân bổ Lead")}
        width="450px"
      >
        <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {t("Hệ thống sẽ thực hiện phân bổ lead này cho Sale tiếp theo trong vòng phân phối tương ứng. Thông tin người tiếp nhận:")}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
              {t('Vòng phân phối:')}
            </label>
            <CustomSelect
              options={rounds.map((r: any) => ({ 
                value: String(r.id), 
                label: r.round_name,
                disabled: Number(r.is_active) !== 1,
                disabledType: 'round' as const
              }))}
              value={selectedApproveRoundId ? String(selectedApproveRoundId) : ''}
              onChange={val => {
                if (val) {
                  handleApproveRoundChange(Number(val));
                }
              }}
              width="100%"
            />
          </div>

          <div style={{
            padding: '1.25rem',
            background: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.02))',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            {previewLoadingId !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>{t("Đang tính toán Sale tiếp theo...")}</span>
              </div>
            ) : previewedConsultant ? (
              <>
                <Avatar src={previewedConsultant.avatar} name={previewedConsultant.name} size={40} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem' }}>
                    {previewedConsultant.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {t("Nhận từ vòng:")} <strong>{rounds.find(r => Number(r.id) === selectedApproveRoundId)?.round_name || actioningHeldLead?.round_name}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', fontWeight: 600 }}>
                {t("Không tìm thấy Sale hợp lệ trong vòng để nhận lead này.")}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn outline" onClick={() => setHeldActionModalOpen(null)}>
              {t("Hủy bỏ")}
            </button>
            <button
              className="btn primary"
              onClick={handleApproveHeldLeadSubmit}
              disabled={previewLoadingId !== null || actionLoading}
              style={{ background: '#10b981', borderColor: '#10b981' }}
            >
              {actionLoading ? t("Đang duyệt...") : t("Xác nhận duyệt")}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Reject Held Lead Modal */}
      <CustomModal
        isOpen={heldActionModalOpen === 'reject'}
        onClose={() => setHeldActionModalOpen(null)}
        title={t("Xác nhận dưới chuẩn")}
        width="450px"
      >
        <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {t("Vui lòng nhập lý do xác nhận dưới chuẩn cho lead này. Liên hệ sẽ bị đánh dấu là Không duyệt và không phân bổ.")}
          </p>

          <div>
            <label className="form-label">{t("Lý do từ chối")}</label>
            <textarea
              className="form-input"
              rows={3}
              value={heldActionReason}
              onChange={e => setHeldActionReason(e.target.value)}
              placeholder={t("Ví dụ: Khách hàng không có nhu cầu thật, sai số...")}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn outline" onClick={() => setHeldActionModalOpen(null)}>
              {t("Hủy bỏ")}
            </button>
            <button
              className="btn primary"
              onClick={handleRejectHeldLeadSubmit}
              disabled={!heldActionReason.trim() || actionLoading}
              style={{ background: 'var(--color-warning)', borderColor: 'var(--color-warning)' }}
            >
              {actionLoading ? t("Đang xử lý...") : t("Xác nhận dưới chuẩn")}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Blacklist Held Lead Modal */}
      <CustomModal
        isOpen={heldActionModalOpen === 'blacklist'}
        onClose={() => setHeldActionModalOpen(null)}
        title={t("Chặn & Đưa vào Blacklist")}
        width="450px"
      >
        <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {t("Xác nhận chặn số điện thoại này. Số điện thoại sẽ bị lưu vào danh sách đen (Global Exclusion Contacts) để tự động từ chối trong tương lai.")}
          </p>

          <div>
            <label className="form-label">{t("Lý do chặn blacklist")}</label>
            <textarea
              className="form-input"
              rows={3}
              value={heldActionReason}
              onChange={e => setHeldActionReason(e.target.value)}
              placeholder={t("Ví dụ: Số ảo phá hoại, spam, đối thủ cạnh tranh...")}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn outline" onClick={() => setHeldActionModalOpen(null)}>
              {t("Hủy bỏ")}
            </button>
            <button
              className="btn primary"
              onClick={handleBlacklistHeldLeadSubmit}
              disabled={!heldActionReason.trim() || actionLoading}
              style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
            >
              {actionLoading ? t("Đang chặn...") : t("Xác nhận chặn")}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Customer Detail Drawer/Modal */}
      <CustomModal
        isOpen={selectedLead !== null}
        onClose={() => {
          setSelectedLead(null);
        }}
        title={t("Chi tiết Khách hàng")}
        width="850px"
      >
        {selectedLead && (
          <div style={{ padding: '1.5rem', background: 'transparent' }}>
            <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem' }}>

              {/* Cột Trái: Chi Tiết */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <Avatar name={selectedLead.name} size={48} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{selectedLead.name}</h2>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>ID: #{selectedLead.id}</div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Phone size={14} /> {t("Phone")}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {user?.role === 'admin' ? selectedLead.phone : maskPhone(selectedLead.phone)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Mail size={14} /> {t("Email")}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {user?.role === 'admin' ? selectedLead.email : maskEmail(selectedLead.email)}
                    </div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><ExternalLink size={14} /> {t("Nguồn Data")}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.source}</div>
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Tag size={14} /> {t("Trạng thái")}</div>
                    <div>
                      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>{t("AI Pre-screener")}</span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const { cleanNote, blacklistNotes } = parseNote(selectedLead.note || '');
                  return (
                    <>
                      {/* AI Screener Evaluation Details */}
                      {selectedLead.ai_screener_status && selectedLead.ai_screener_status !== 'not_screened' && (
                        <div style={{
                          marginBottom: '1.25rem',
                          padding: '1.25rem',
                          background: selectedLead.ai_screener_status === 'error'
                            ? 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.02))'
                            : 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.06), rgba(239, 68, 68, 0.02))',
                          border: selectedLead.ai_screener_status === 'error'
                            ? '1px solid rgba(245, 158, 11, 0.15)'
                            : '1px solid rgba(239, 68, 68, 0.15)',
                          borderRadius: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: selectedLead.ai_screener_status === 'error' ? '#d97706' : 'var(--color-danger)', fontWeight: 700, fontSize: '0.9rem' }}>
                            {selectedLead.ai_screener_status === 'error' ? <AlertTriangle size={16} /> : <ShieldAlert size={16} />}
                            <span>{selectedLead.ai_screener_status === 'error' ? t('Lỗi Kết Nối AI Pre-screener') : t('AI Pre-screener Tạm Giữ')}</span>
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                            <strong>{selectedLead.ai_screener_status === 'error' ? t('Chi tiết lỗi:') : t('Kết quả đánh giá AI:')}</strong> {selectedLead.ai_evaluation || (selectedLead.ai_screener_status === 'error' ? t('Mất kết nối với dịch vụ AI.') : t('Không đạt chuẩn phân chia.'))}
                          </div>
                        </div>
                      )}

                      {/* Clean Note Card */}
                      <div style={{
                        background: 'var(--color-warning-light)',
                        border: '1px solid var(--color-warning-light)',
                        padding: '1.25rem',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: 'none'
                      }}
                        className="premium-alert-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            background: theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                            padding: '8px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: theme === 'dark' ? '#f59e0b' : '#d97706'
                          }}>
                            <Tag size={18} strokeWidth={2.5} />
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme === 'dark' ? '#fbbf24' : '#92400e', letterSpacing: '-0.01em' }}>{t("Ghi chú & Phân loại")}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.85rem', color: theme === 'dark' ? '#dadada' : '#78350f' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', marginRight: '6px' }}>{t("Loại Data:")}</span>
                            <span style={{ fontWeight: 600 }}>{selectedLead.type !== '-' ? selectedLead.type : t('Không có')}</span>
                          </div>

                          <div style={{ borderTop: theme === 'dark' ? '1px dashed rgba(245, 158, 11, 0.2)' : '1px dashed rgba(217, 119, 6, 0.15)', paddingTop: '8px', marginTop: '4px' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', display: 'block', marginBottom: '4px' }}>{t("Nội dung ghi chú:")}</span>
                            <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#f3f4f6' : '#451a03', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 500 }}>
                              {cleanNote ? cleanNote : <em style={{ color: theme === 'dark' ? '#cbd5e1' : '#b45309', opacity: 0.6 }}>{t("Không có ghi chú thêm")}</em>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Blacklist Notes */}
                      {blacklistNotes && blacklistNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          {blacklistNotes.map((note, index) => {
                            const parsed = parseBlacklistNote(note);
                            return (
                              <div key={index} style={{
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.15)',
                                padding: '1.25rem',
                                borderRadius: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
                                    <ShieldAlert size={18} />
                                  </div>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-danger)' }}>{t("Lịch sử chặn Blacklist")}</span>
                                </div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                                  <strong>{t("Lý do chặn:")}</strong> {parsed.reason || t("Không rõ")}
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 4 }}>
                                  <span>{t("Thực hiện bởi:")} <strong>{parsed.admin}</strong></span>
                                  <span>•</span>
                                  <span>{t("Thời gian:")} <strong>{parsed.time}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Cột Phải: Thao tác Duyệt nhanh */}
              <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '2rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1.25rem' }}>{t("Xử lý phê duyệt")}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  <button
                    onClick={() => {
                      setSelectedLead(null);
                      handleOpenApproveHeldLead(selectedLead);
                    }}
                    className="btn primary"
                    style={{ width: '100%', height: 46, background: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700 }}
                  >
                    <Check size={18} />
                    {t("Duyệt & Phân bổ Lead")}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedLead(null);
                      setActioningHeldLead(selectedLead);
                      setHeldActionReason('');
                      setHeldActionModalOpen('reject');
                    }}
                    className="btn primary"
                    style={{ width: '100%', height: 46, background: 'var(--color-warning)', borderColor: 'var(--color-warning)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700 }}
                  >
                    <XCircle size={18} />
                    {t("Xác nhận dưới chuẩn")}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedLead(null);
                      setActioningHeldLead(selectedLead);
                      setHeldActionReason('');
                      setHeldActionModalOpen('blacklist');
                    }}
                    className="btn outline"
                    style={{ width: '100%', height: 46, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700 }}
                  >
                    <ShieldAlert size={18} />
                    {t("Chặn số & Blacklist")}
                  </button>

                  <div style={{
                    marginTop: '1rem', padding: '1rem',
                    background: 'var(--color-bg-alt)', borderRadius: '12px', border: '1px solid var(--color-border)',
                    fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5
                  }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={14} color="#7c3aed" />
                      {t("Thông tin thêm")}
                    </div>
                    <div>
                      {t("Khách hàng này được đổ về từ nguồn")} <strong>{selectedLead.source}</strong> {t("vào lúc")} {new Date(selectedLead.created_at).toLocaleString('vi-VN')}. {t("Lead này đã kích hoạt đánh giá tự động và đang được giữ lại để chờ Admin phê duyệt trước khi đi vào hàng chờ phân chia số.")}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}
      </CustomModal>

      <style>{`
        .lead-row:hover {
          background-color: var(--color-bg-alt) !important;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .flow-step-card {
          background: var(--color-surface);
          border-radius: 8px;
          padding: 1rem;
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: var(--shadow-sm);
          cursor: default;
        }
      `}</style>

    </div>
  );
};
