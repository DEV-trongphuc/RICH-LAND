import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Link2, Save, Check, X, AlertCircle, RefreshCw, Code, CheckCircle, 
  Info, ShieldAlert, Search, Calendar, FileText, MessageCircle, Eye, 
  Zap, Settings as SettingsIcon, Plus, Trash2, Edit2, Play, ExternalLink, 
  Sliders, Layers, Globe, Radio, Copy
} from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { Skeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useUIStore } from '../store/uiStore';

interface CapiLog {
  id: number;
  event_name: string;
  sent_payload: string;
  response_status: number;
  response_body: string;
  sent_at: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface CustomEventItem {
  name: string;
  label: string;
  description?: string;
}

interface OutboundTrigger {
  id: string;
  name: string;
  is_active: boolean;
  trigger_field: string;
  trigger_value: string;
  target_url: string;
  http_method: 'POST' | 'PUT';
  headers: string;
  payload_template: string;
}

interface TestResult {
  http_code: number;
  response: string;
  curl_error?: string;
  rendered_url: string;
  rendered_payload: string;
  duration_ms: number;
}

const DEFAULT_STANDARD_EVENTS: CustomEventItem[] = [
  { name: 'Skip', label: 'Không gửi (Skip)', description: 'Bỏ qua không gửi sự kiện' },
  { name: 'Disqualified', label: 'Disqualified (Not Lead)', description: 'Khách không đạt tiêu chuẩn / Hủy' },
  { name: 'CompleteRegistration', label: 'CompleteRegistration (Nhận lead)', description: 'Hoàn tất tiếp nhận thông tin' },
  { name: 'Contact', label: 'Contact (Quan tâm)', description: 'Khách quan tâm hoặc đã liên hệ' },
  { name: 'Schedule', label: 'Schedule (Thiện chí / Đặt hẹn)', description: 'Khách thiện chí, lên lịch hẹn' },
  { name: 'MeetingCompleted', label: 'MeetingCompleted (Đã gặp)', description: 'Đã gặp trực tiếp thành công' },
  { name: 'Purchase', label: 'Purchase (Booking & Đặt cọc)', description: 'Giao dịch đặt cọc / Chốt deal (kèm số tiền)' },
  { name: 'Lead', label: 'Lead (Khách tiềm năng)', description: 'Sự kiện Lead tiêu chuẩn' },
  { name: 'SubmitApplication', label: 'SubmitApplication', description: 'Khách gửi đơn đăng ký' },
  { name: 'ViewContent', label: 'ViewContent (Xem hàng)', description: 'Khách xem bảng hàng / căn hộ' }
];

const PRESET_TEMPLATES = {
  meta_standard: `[
  {
    "data": [
      {
        "event_name": "MeetingCompleted",
        "event_time": {{timestamp}},
        "event_id": "{{lead_id}}",
        "action_source": "system_generated",
        "user_data": {
          "em": null,
          "ph": "{{phone_sha256}}",
          "fn": [
            "{{first_name_sha256}}"
          ],
          "lead_id": "{{lead_id}}",
          "external_id": "phone_{{phone_sha256}}"
        },
        "original_event_data": {
          "event_name": "MeetingCompleted",
          "event_time": {{timestamp}}
        },
        "custom_data": {
          "lead_event_source": "Rich Land CRM",
          "event_source": "crm"
        }
      }
    ]
  }
]`,
  meta_purchase: `[
  {
    "data": [
      {
        "event_name": "Purchase",
        "event_time": {{timestamp}},
        "event_id": "{{lead_id}}",
        "action_source": "system_generated",
        "user_data": {
          "em": null,
          "ph": "{{phone_sha256}}",
          "fn": [
            "{{first_name_sha256}}"
          ],
          "lead_id": "{{lead_id}}",
          "external_id": "phone_{{phone_sha256}}"
        },
        "original_event_data": {
          "event_name": "Purchase",
          "event_time": {{timestamp}}
        },
        "custom_data": {
          "currency": "VND",
          "value": {{price}},
          "content_type": "real_estate",
          "lead_event_source": "Rich Land CRM",
          "event_source": "crm"
        }
      }
    ]
  }
]`,
  crm_webhook: `{
  "event": "contact_status_changed",
  "lead_id": "{{lead_id}}",
  "contact_id": {{contact_id}},
  "phone": "{{phone}}",
  "phone_sha256": "{{phone_sha256}}",
  "full_name": "{{full_name}}",
  "status": "{{status}}",
  "price": {{price}},
  "timestamp": {{timestamp}}
}`
};

export default function CapiPage() {
  const { user } = useAuth();
  const { addToast } = useUIStore();
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'capi' | 'triggers'>('capi');

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [logs, setLogs] = useState<CapiLog[]>([]);
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  
  // Mapping triggers and status list
  const [capiEventTriggers, setCapiEventTriggers] = useState<Record<string, string>>({});
  const [pipelineStatuses, setPipelineStatuses] = useState<string[]>([]);
  const [pipelineStatusLabels, setPipelineStatusLabels] = useState<Record<string, string>>({});

  // Custom declared event names (Bánh răng khai báo)
  const [customEvents, setCustomEvents] = useState<CustomEventItem[]>(DEFAULT_STANDARD_EVENTS);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');

  // Outbound Webhook Triggers
  const [outboundTriggers, setOutboundTriggers] = useState<OutboundTrigger[]>([]);
  const [editingTrigger, setEditingTrigger] = useState<OutboundTrigger | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerForm, setTriggerForm] = useState<OutboundTrigger>({
    id: '',
    name: '',
    is_active: true,
    trigger_field: 'pipeline_status',
    trigger_value: 'da_gap',
    target_url: 'https://graph.facebook.com/v19.0/{pixel_id}/events?access_token={token}',
    http_method: 'POST',
    headers: '{\n  "Content-Type": "application/json"\n}',
    payload_template: PRESET_TEMPLATES.meta_standard
  });

  // Test Trigger Runner
  const [testingTrigger, setTestingTrigger] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

  // Debug payload viewer modal
  const [viewPayload, setViewPayload] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resSettings, resLogs] = await Promise.all([
        fetchAPI('capi/settings'),
        fetchAPI('capi/logs')
      ]);

      if (resSettings.success) {
        setPixelId(resSettings.data?.meta_pixel_id || '');
        setAccessToken(resSettings.data?.meta_access_token || '');
        setCapiEventTriggers(resSettings.data?.capi_event_triggers || {});
        
        const fetchedStatuses: string[] = resSettings.data?.pipeline_statuses || [];
        if (!fetchedStatuses.includes('not_lead') && !fetchedStatuses.includes('notlead')) {
          fetchedStatuses.push('not_lead');
        }
        setPipelineStatuses(fetchedStatuses);

        const fetchedLabels: Record<string, string> = resSettings.data?.pipeline_status_labels || {};
        if (!fetchedLabels['not_lead']) fetchedLabels['not_lead'] = 'Not Lead';
        if (!fetchedLabels['notlead']) fetchedLabels['notlead'] = 'Not Lead';
        setPipelineStatusLabels(fetchedLabels);

        if (resSettings.data?.capi_custom_event_names?.length > 0) {
          setCustomEvents(resSettings.data.capi_custom_event_names);
        }
        if (Array.isArray(resSettings.data?.outbound_webhook_triggers)) {
          setOutboundTriggers(resSettings.data.outbound_webhook_triggers);
        }
      }
      if (resLogs.success) {
        setLogs(resLogs.data || []);
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi tải dữ liệu CAPI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Settings to Backend
  const handleSaveSettings = async (
    customEvtsToSave = customEvents, 
    triggersToSave = outboundTriggers,
    capiTriggersToSave = capiEventTriggers
  ) => {
    setSaving(true);
    try {
      const res = await fetchAPI('capi/settings', {
        method: 'POST',
        body: JSON.stringify({
          meta_pixel_id: pixelId,
          meta_access_token: accessToken,
          capi_event_triggers: capiTriggersToSave,
          capi_custom_event_names: customEvtsToSave,
          outbound_webhook_triggers: triggersToSave
        })
      });

      if (res.success) {
        addToast('Lưu cấu hình hệ thống thành công!', 'success');
        setSuccess('Lưu cấu hình hệ thống thành công!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        addToast(res.message || 'Lỗi lưu cấu hình', 'error');
        setError(res.message || 'Lỗi lưu cấu hình');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
      setError(e.message || 'Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  // Custom Event Declarations
  const handleAddCustomEvent = () => {
    const trimmedName = newEventName.trim();
    if (!trimmedName) {
      addToast('Vui lòng nhập tên sự kiện (Event Name)', 'error');
      return;
    }
    if (customEvents.some(e => e.name.toLowerCase() === trimmedName.toLowerCase())) {
      addToast('Sự kiện này đã tồn tại trong danh mục!', 'error');
      return;
    }
    const updated = [
      ...customEvents,
      {
        name: trimmedName,
        label: newEventLabel.trim() || trimmedName,
        description: newEventDesc.trim() || 'Sự kiện tùy chỉnh'
      }
    ];
    setCustomEvents(updated);
    setNewEventName('');
    setNewEventLabel('');
    setNewEventDesc('');
    handleSaveSettings(updated, outboundTriggers, capiEventTriggers);
    addToast(`Đã thêm sự kiện ${trimmedName}`, 'success');
  };

  const handleDeleteCustomEvent = (nameToDelete: string) => {
    if (nameToDelete === 'Skip') {
      addToast('Không thể xóa sự kiện Skip mặc định', 'error');
      return;
    }
    const updated = customEvents.filter(e => e.name !== nameToDelete);
    setCustomEvents(updated);
    handleSaveSettings(updated, outboundTriggers, capiEventTriggers);
    addToast(`Đã xóa sự kiện ${nameToDelete}`, 'info');
  };

  const handleResetDefaultEvents = () => {
    setCustomEvents(DEFAULT_STANDARD_EVENTS);
    handleSaveSettings(DEFAULT_STANDARD_EVENTS, outboundTriggers, capiEventTriggers);
    addToast('Đã khôi phục danh sách sự kiện chuẩn của hệ thống', 'success');
  };

  // Outbound Trigger Operations
  const handleOpenCreateTrigger = () => {
    setEditingTrigger(null);
    setTriggerForm({
      id: 'trg_' + Date.now(),
      name: 'Bắn Meta CAPI khi Đã Gặp',
      is_active: true,
      trigger_field: 'pipeline_status',
      trigger_value: 'da_gap',
      target_url: 'https://graph.facebook.com/v19.0/{pixel_id}/events?access_token={token}',
      http_method: 'POST',
      headers: '{\n  "Content-Type": "application/json"\n}',
      payload_template: PRESET_TEMPLATES.meta_standard
    });
    setShowTriggerModal(true);
  };

  const handleOpenEditTrigger = (trg: OutboundTrigger) => {
    setEditingTrigger(trg);
    setTriggerForm({ ...trg });
    setShowTriggerModal(true);
  };

  const handleSaveTriggerForm = () => {
    if (!triggerForm.name.trim()) {
      addToast('Vui lòng nhập tên trigger', 'error');
      return;
    }
    if (!triggerForm.target_url.trim()) {
      addToast('Vui lòng nhập API URL đích', 'error');
      return;
    }

    let updatedTriggers: OutboundTrigger[];
    if (editingTrigger) {
      updatedTriggers = outboundTriggers.map(t => t.id === editingTrigger.id ? triggerForm : t);
    } else {
      updatedTriggers = [...outboundTriggers, { ...triggerForm, id: triggerForm.id || 'trg_' + Date.now() }];
    }

    setOutboundTriggers(updatedTriggers);
    setShowTriggerModal(false);
    handleSaveSettings(customEvents, updatedTriggers, capiEventTriggers);
    addToast(`Đã lưu trigger "${triggerForm.name}"`, 'success');
  };

  const handleDeleteTrigger = (id: string) => {
    const updated = outboundTriggers.filter(t => t.id !== id);
    setOutboundTriggers(updated);
    handleSaveSettings(customEvents, updated, capiEventTriggers);
    addToast('Đã xóa trigger thành công', 'info');
  };

  const handleToggleTriggerStatus = (id: string) => {
    const updated = outboundTriggers.map(t => t.id === id ? { ...t, is_active: !t.is_active } : t);
    setOutboundTriggers(updated);
    handleSaveSettings(customEvents, updated, capiEventTriggers);
  };

  // Execute Test Trigger
  const handleTestTrigger = async (trgToTest = triggerForm) => {
    setTestingTrigger(true);
    try {
      const res = await fetchAPI('capi/test-trigger', {
        method: 'POST',
        body: JSON.stringify({
          target_url: trgToTest.target_url,
          http_method: trgToTest.http_method,
          headers: trgToTest.headers,
          payload_template: trgToTest.payload_template
        })
      });

      if (res.success && res.data) {
        setTestResult(res.data);
        setShowTestModal(true);
        // Refresh logs list
        const resLogs = await fetchAPI('capi/logs');
        if (resLogs.success) {
          setLogs(resLogs.data || []);
        }
      } else {
        addToast(res.message || 'Lỗi khi bắn thử nghiệm', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối kiểm thử', 'error');
    } finally {
      setTestingTrigger(false);
    }
  };

  // Convert customEvents into dropdown options
  const capiEventOptions = customEvents.map(evt => {
    let icon = <Code size={14} style={{ color: 'var(--color-primary)' }} />;
    if (evt.name === 'Skip') icon = <X size={14} style={{ color: 'var(--color-text-muted)' }} />;
    else if (evt.name === 'Purchase') icon = <Zap size={14} style={{ color: 'var(--color-primary)' }} />;
    else if (evt.name === 'Schedule') icon = <Calendar size={14} style={{ color: '#10b981' }} />;
    else if (evt.name === 'Contact') icon = <MessageCircle size={14} style={{ color: '#ec4899' }} />;
    else if (evt.name === 'CompleteRegistration') icon = <CheckCircle size={14} style={{ color: '#f59e0b' }} />;
    else if (evt.name === 'Disqualified') icon = <AlertCircle size={14} style={{ color: '#ef4444' }} />;
    else if (evt.name === 'Lead') icon = <Search size={14} style={{ color: '#3b82f6' }} />;
    else if (evt.name === 'ViewContent') icon = <Eye size={14} style={{ color: '#8b5cf6' }} />;

    return {
      value: evt.name,
      label: evt.label || evt.name,
      icon
    };
  });

  const appendVariableToPayload = (varName: string) => {
    setTriggerForm(prev => ({
      ...prev,
      payload_template: prev.payload_template + varName
    }));
  };

  return (
    <div className="page-container anim-fade-up" style={{ color: 'var(--color-text)' }}>
      {/* Alert Banners */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.875rem 1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', borderRadius: '10px', marginBottom: '1rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.875rem 1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--color-success)', borderRadius: '10px', marginBottom: '1rem' }}>
          <Check size={20} />
          <span>{success}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Link2 size={24} style={{ color: 'var(--color-primary)' }} />
              Tích Hợp Meta Conversion API & Automation Triggers
            </h1>
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: 'rgba(189, 29, 45, 0.06)',
                border: '1px solid rgba(189, 29, 45, 0.2)',
                padding: '4px 10px',
                borderRadius: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                color: 'var(--color-primary)',
                fontWeight: 600,
                fontSize: '0.75rem',
                transition: 'all 0.2s'
              }}
              title="Xem hướng dẫn quy tắc Conversion API & Forward-only"
            >
              <Info size={13} />
              <span>Giải thích cơ chế & Forward-only</span>
            </button>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0' }}>
            Cấu hình đẩy ngược sự kiện phễu bán hàng về Meta Ads và thiết lập các bộ Trigger bắn Webhook tự động linh hoạt
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn"
          style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
          title="Tải lại trang"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('capi')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'capi' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'capi' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Code size={16} />
          <span>Meta CAPI & Ánh Xạ Phễu</span>
        </button>

        <button
          onClick={() => setActiveTab('triggers')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'triggers' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'triggers' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Zap size={16} />
          <span>Bộ Kích Hoạt Trigger Tự Động ({outboundTriggers.length})</span>
        </button>
      </div>

      {/* TAB 1: META CAPI & ÁNH XẠ PHỄU */}
      {activeTab === 'capi' && (
        <div style={{ display: 'grid', gridTemplateColumns: isLargeScreen ? '1fr 2fr' : '1fr', gap: '1.5rem' }}>
          {/* Settings Form */}
          <div className="card" style={{ padding: '1.5rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} style={{ color: 'var(--color-primary)' }} />
                Cấu hình Meta CAPI
              </h3>
            </div>

            <form onSubmit={e => { e.preventDefault(); handleSaveSettings(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Meta Pixel ID</label>
                <input
                  type="text"
                  placeholder="VD: 1234567890"
                  value={pixelId}
                  onChange={e => setPixelId(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>System Access Token</label>
                <textarea
                  placeholder="EAAG..."
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  className="form-input font-mono"
                  style={{ height: '110px', resize: 'none', fontSize: '0.75rem' }}
                />
              </div>

              {/* Status & Event Mapping Section */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Code size={16} style={{ color: 'var(--color-primary)' }} />
                    Ánh xạ Trạng thái & Sự kiện Meta CAPI
                  </label>
                  {/* Gear ⚙️ button for custom events declaration */}
                  <button
                    type="button"
                    onClick={() => setShowEventModal(true)}
                    className="btn sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.04)',
                      border: '1px solid var(--color-border)'
                    }}
                    title="Khai báo thêm danh sách sự kiện Meta CAPI"
                  >
                    <SettingsIcon size={14} style={{ color: 'var(--color-primary)' }} />
                    <span>Khai báo sự kiện</span>
                  </button>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
                  Chỉ định sự kiện Standard Meta CAPI tương ứng sẽ tự động kích hoạt khi khách hàng chuyển sang từng trạng thái phễu.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '0.875rem', background: 'rgba(0, 0, 0, 0.015)' }}>
                  {pipelineStatuses.map(status => (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        {pipelineStatusLabels[status] || status}
                      </span>
                      <CustomSelect
                        options={capiEventOptions}
                        value={capiEventTriggers[status] || 'Skip'}
                        onChange={val => setCapiEventTriggers(prev => ({ ...prev, [status]: val }))}
                        width="190px"
                        placeholder="Chọn sự kiện..."
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className={`btn primary ${saving ? 'loading' : ''}`}
                style={{ marginTop: '0.75rem', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                <span>{saving ? 'Đang lưu cấu hình...' : 'Lưu cấu hình'}</span>
              </button>
            </form>
          </div>

          {/* Logs Table */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--color-primary)' }} />
                Nhật ký sự kiện gửi đi (CAPI Logs)
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {logs.length} bản ghi gần nhất
              </span>
            </div>

            {loading ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 650, textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
                      <th style={{ padding: '0.5rem 0', textAlign: 'left' }}>Sự kiện</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'left' }}>Khách hàng</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Mã HTTP</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Payload</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Múi giờ gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '0.75rem 0' }}><Skeleton width="60%" height={12} /></td>
                        <td style={{ padding: '0.75rem 0' }}><Skeleton width="80%" height={12} /></td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'center' }}><Skeleton width="40px" height={16} style={{ margin: '0 auto' }} /></td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'center' }}><Skeleton width="30px" height={16} style={{ margin: '0 auto' }} /></td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right' }}><Skeleton width="50%" height={12} style={{ marginLeft: 'auto' }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                <Radio size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px auto', display: 'block', opacity: 0.5 }} />
                Chưa có sự kiện nào được bắn về Meta
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 650, textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
                      <th style={{ padding: '0.5rem 0', textAlign: 'left' }}>Sự kiện</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'left' }}>Khách hàng</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Mã HTTP</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Payload</th>
                      <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Múi giờ gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '0.75rem 0', fontWeight: 700, textAlign: 'left' }}>
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: l.event_name.startsWith('TRIGGER:') ? 'var(--color-primary)' : 'inherit'
                          }}>
                            {l.event_name}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'left' }}>
                          <span style={{ fontWeight: 600 }}>
                            {l.first_name ? `${l.last_name || ''} ${l.first_name}`.trim() : 'Raw Lead'}
                          </span>
                          {l.phone && <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{l.phone}</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>
                          <span
                            className="font-mono font-bold"
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              background: l.response_status === 200 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: l.response_status === 200 ? 'var(--color-success)' : 'var(--color-danger)',
                              border: l.response_status === 200 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
                            }}
                          >
                            {l.response_status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>
                          <button
                            onClick={() => setViewPayload(l.sent_payload)}
                            className="btn sm"
                            style={{ padding: '2px 8px', height: '24px', borderRadius: '4px' }}
                            title="Xem chi tiết payload JSON đã gửi"
                          >
                            <Code size={13} />
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--color-text-light)', fontFamily: 'monospace' }}>
                          {new Date(l.sent_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BỘ KÍCH HOẠT TRIGGER TỰ ĐỘNG */}
      {activeTab === 'triggers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Action Card */}
          <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.03) 0%, rgba(0,0,0,0) 100%)', border: '1px solid var(--color-border)' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={20} style={{ color: 'var(--color-primary)' }} />
                Thiết Lập Bộ Kích Hoạt Trigger Tự Động (Outbound Automation)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                Tự động kích hoạt bắn dữ liệu sang Meta CAPI, Webhook Zapier, Make hoặc API nội bộ dựa trên 3 điều kiện: <strong>(1) Trường thay đổi</strong> ➔ <strong>(2) API Đích</strong> ➔ <strong>(3) Cấu trúc JSON</strong>.
              </p>
            </div>
            <button
              onClick={handleOpenCreateTrigger}
              className="btn primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <Plus size={16} />
              <span>Thêm Trigger Mới</span>
            </button>
          </div>

          {/* Trigger List */}
          {outboundTriggers.length === 0 ? (
            <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: '12px' }}>
              <Zap size={40} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px auto', display: 'block', opacity: 0.4 }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--color-text)' }}>Chưa có bộ kích hoạt Trigger nào</h4>
              <p style={{ fontSize: '0.825rem', maxWidth: '480px', margin: '0 auto 16px auto', lineHeight: 1.5 }}>
                Bạn có thể tạo trigger mới để linh hoạt giám sát các trạng thái phễu hoặc trường thông tin thay đổi và bắn JSON sang bất kỳ API nào.
              </p>
              <button
                onClick={handleOpenCreateTrigger}
                className="btn primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} />
                <span>Tạo Trigger Ngay</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {outboundTriggers.map(trg => (
                <div 
                  key={trg.id} 
                  className="card" 
                  style={{ 
                    padding: '1.25rem 1.5rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '1.5rem', 
                    flexWrap: 'wrap',
                    borderLeft: trg.is_active ? '4px solid var(--color-primary)' : '4px solid var(--color-text-muted)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ 
                        display: 'inline-block', 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: trg.is_active ? 'var(--color-success)' : 'var(--color-text-muted)' 
                      }} />
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                        {trg.name}
                      </h4>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '20px',
                        background: trg.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        color: trg.is_active ? 'var(--color-success)' : 'var(--color-text-muted)'
                      }}>
                        {trg.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
                      <div>
                        <strong>(1) Kích hoạt khi:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--color-text)', background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: '4px' }}>{trg.trigger_field} = {trg.trigger_value}</span>
                      </div>
                      <div>
                        <strong>(2) API Đích:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{trg.http_method} {trg.target_url.slice(0, 45)}...</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleToggleTriggerStatus(trg.id)}
                      className="btn sm"
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      title={trg.is_active ? 'Nhấn để tạm dừng trigger này' : 'Nhấn để bật trigger này'}
                    >
                      {trg.is_active ? 'Tắt' : 'Bật'}
                    </button>

                    <button
                      onClick={() => handleTestTrigger(trg)}
                      disabled={testingTrigger}
                      className="btn sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 10px', color: 'var(--color-primary)', borderColor: 'var(--color-primary-light)' }}
                      title="Bắn thử nghiệm với mẫu data giả lập"
                    >
                      <Play size={12} />
                      <span>Bắn thử</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditTrigger(trg)}
                      className="btn sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 10px' }}
                      title="Chỉnh sửa trigger"
                    >
                      <Edit2 size={12} />
                      <span>Sửa</span>
                    </button>

                    <button
                      onClick={() => handleDeleteTrigger(trg.id)}
                      className="btn sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 8px', color: 'var(--color-danger)' }}
                      title="Xóa trigger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: BÁNH RĂNG KHAI BÁO SỰ KIỆN (CUSTOM EVENTS DECLARATION) */}
      <CustomModal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        title="⚙️ Quản lý & Khai báo Sự kiện Meta CAPI"
        width="650px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(189, 29, 45, 0.04)', border: '1px solid rgba(189, 29, 45, 0.15)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Bạn có thể tự do đặt tên và khai báo thêm bất kỳ sự kiện Standard hoặc Custom nào của Meta CAPI (vd: <code>Disqualified</code>, <code>MeetingCompleted</code>, <code>Lead</code>, <code>Purchase</code>...). Sau khi khai báo, các sự kiện này sẽ hiển thị ngay trong danh sách chọn của bảng ánh xạ.
          </div>

          {/* Add New Event Form */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1rem', background: 'var(--color-bg)' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>+ Khai báo sự kiện mới</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Tên Sự kiện (Event Name) *</label>
                <input
                  type="text"
                  placeholder="VD: MeetingCompleted"
                  value={newEventName}
                  onChange={e => setNewEventName(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Nhãn hiển thị (Label) *</label>
                <input
                  type="text"
                  placeholder="VD: MeetingCompleted (Đã gặp)"
                  value={newEventLabel}
                  onChange={e => setNewEventLabel(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Mô tả ý nghĩa</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="VD: Kích hoạt khi nhân viên sale đã gặp khách trực tiếp"
                  value={newEventDesc}
                  onChange={e => setNewEventDesc(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.8rem' }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomEvent}
                  className="btn primary"
                  style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0 16px' }}
                >
                  Thêm sự kiện
                </button>
              </div>
            </div>
          </div>

          {/* List of declared events */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>
                Danh sách sự kiện đã khai báo ({customEvents.length})
              </h4>
              <button
                type="button"
                onClick={handleResetDefaultEvents}
                className="btn sm"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              >
                Khôi phục danh sách mặc định
              </button>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '8px' }}>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--color-border-light)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Event Name</th>
                    <th style={{ padding: '8px 12px' }}>Nhãn hiển thị</th>
                    <th style={{ padding: '8px 12px' }}>Mô tả</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {customEvents.map(evt => (
                    <tr key={evt.name} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                        {evt.name}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                        {evt.label}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                        {evt.description || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {evt.name !== 'Skip' ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomEvent(evt.name)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px' }}
                            title="Xóa sự kiện này"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Hệ thống</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
            <button className="btn primary" onClick={() => setShowEventModal(false)} style={{ minWidth: 90 }}>
              Đóng & Áp Dụng
            </button>
          </div>
        </div>
      </CustomModal>

      {/* MODAL 2: TẠO / SỬA TRIGGER (CREATE/EDIT TRIGGER MODAL) */}
      <CustomModal
        isOpen={showTriggerModal}
        onClose={() => setShowTriggerModal(false)}
        title={editingTrigger ? '✏️ Chỉnh Sửa Bộ Kích Hoạt Trigger' : '⚡ Tạo Mới Bộ Kích Hoạt Trigger'}
        width="820px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Condition 1: Trường nào thay đổi */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1rem', background: 'rgba(0,0,0,0.01)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>1</span>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 800, margin: 0 }}>Điều kiện: Trường nào thay đổi thì kích hoạt?</h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Tên mô tả Trigger *</label>
                <input
                  type="text"
                  placeholder="VD: Bắn CAPI khi Đã Gặp"
                  value={triggerForm.name}
                  onChange={e => setTriggerForm(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Trường giám sát thay đổi</label>
                <select
                  value={triggerForm.trigger_field}
                  onChange={e => setTriggerForm(prev => ({ ...prev, trigger_field: e.target.value }))}
                  className="form-input"
                  style={{ fontSize: '0.8rem' }}
                >
                  <option value="pipeline_status">Trạng thái phễu (pipeline_status)</option>
                  <option value="assigned_to">Nhân viên phụ trách (assigned_to)</option>
                  <option value="notes">Ghi chú (notes)</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Giá trị kích hoạt</label>
                <select
                  value={triggerForm.trigger_value}
                  onChange={e => setTriggerForm(prev => ({ ...prev, trigger_value: e.target.value }))}
                  className="form-input"
                  style={{ fontSize: '0.8rem' }}
                >
                  <option value="*">* Mọi giá trị (Bất kỳ thay đổi nào)</option>
                  {pipelineStatuses.map(st => (
                    <option key={st} value={st}>
                      {pipelineStatusLabels[st] || st} ({st})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Condition 2: Bắn tới API nào */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1rem', background: 'rgba(0,0,0,0.01)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>2</span>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 800, margin: 0 }}>API Đích: Kích hoạt bắn tới API nào?</h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>HTTP Method</label>
                <select
                  value={triggerForm.http_method}
                  onChange={e => setTriggerForm(prev => ({ ...prev, http_method: e.target.value as 'POST' | 'PUT' }))}
                  className="form-input font-bold"
                  style={{ fontSize: '0.8rem' }}
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Target Webhook API URL *</label>
                <input
                  type="text"
                  placeholder="https://graph.facebook.com/v19.0/{pixel_id}/events?access_token={token}"
                  value={triggerForm.target_url}
                  onChange={e => setTriggerForm(prev => ({ ...prev, target_url: e.target.value }))}
                  className="form-input font-mono"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Headers (JSON hoặc Key: Value)</label>
              <textarea
                value={triggerForm.headers}
                onChange={e => setTriggerForm(prev => ({ ...prev, headers: e.target.value }))}
                className="form-input font-mono"
                style={{ height: '60px', resize: 'none', fontSize: '0.75rem' }}
                placeholder='{"Content-Type": "application/json"}'
              />
            </div>
          </div>

          {/* Condition 3: Bắn JSON những thông tin nào */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1rem', background: 'rgba(0,0,0,0.01)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>3</span>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 800, margin: 0 }}>Nội dung: Bắn JSON những thông tin nào?</h4>
              </div>

              {/* Template Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Mẫu có sẵn:</span>
                <button
                  type="button"
                  onClick={() => setTriggerForm(prev => ({ ...prev, payload_template: PRESET_TEMPLATES.meta_standard }))}
                  className="btn sm"
                  style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                >
                  Meta CAPI Chuẩn
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerForm(prev => ({ ...prev, payload_template: PRESET_TEMPLATES.meta_purchase }))}
                  className="btn sm"
                  style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                >
                  Meta Purchase
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerForm(prev => ({ ...prev, payload_template: PRESET_TEMPLATES.crm_webhook }))}
                  className="btn sm"
                  style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                >
                  CRM Webhook
                </button>
              </div>
            </div>

            {/* Variable insertion chips */}
            <div style={{ marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Biến tiêu chuẩn:</span>
                {[
                  '{{lead_id}}', 
                  '{{phone_sha256}}', 
                  '{{first_name_sha256}}', 
                  '{{price}}', 
                  '{{status}}', 
                  '{{timestamp}}', 
                  '{{phone}}', 
                  '{{full_name}}'
                ].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => appendVariableToPayload(tag)}
                    style={{
                      fontSize: '0.65rem',
                      fontFamily: 'monospace',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      cursor: 'pointer'
                    }}
                    title={`Nhấp để chèn biến ${tag}`}
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600 }}>Biến Database mở rộng:</span>
                {[
                  '{{address}}',
                  '{{city}}',
                  '{{source}}',
                  '{{notes}}',
                  '{{owner_name}}',
                  '{{budget_range}}',
                  '{{utm_campaign}}',
                  '{{email}}'
                ].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => appendVariableToPayload(tag)}
                    style={{
                      fontSize: '0.65rem',
                      fontFamily: 'monospace',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      background: 'rgba(59, 130, 246, 0.05)',
                      color: 'var(--color-primary)',
                      cursor: 'pointer'
                    }}
                    title={`Nhấp để chèn biến database ${tag}`}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                ✨ <em>Hệ thống tự động hỗ trợ <strong>tất cả các trường trong Database</strong> theo cú pháp <code>{'{{tên_cột}}'}</code> (ví dụ: {'{{gender}}'}, {'{{utm_source}}'}, {'{{customer_type}}'}, {'{{bedroom_count}}'},...).</em>
              </div>
            </div>

            <textarea
              value={triggerForm.payload_template}
              onChange={e => setTriggerForm(prev => ({ ...prev, payload_template: e.target.value }))}
              className="form-input font-mono"
              style={{ height: '180px', resize: 'vertical', fontSize: '0.75rem', lineHeight: 1.4 }}
              placeholder="Nhập cấu trúc JSON..."
            />
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
            <button
              type="button"
              disabled={testingTrigger}
              onClick={() => handleTestTrigger(triggerForm)}
              className="btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)' }}
            >
              {testingTrigger ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
              <span>{testingTrigger ? 'Đang bắn thử...' : '⚡ Bắn Thử Nghiệm Ngay'}</span>
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowTriggerModal(false)}
                className="btn"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveTriggerForm}
                className="btn primary"
                style={{ minWidth: 100 }}
              >
                Lưu Trigger
              </button>
            </div>
          </div>
        </div>
      </CustomModal>

      {/* MODAL 3: KẾT QUẢ BẮN THỬ NGHIỆM (TEST TRIGGER RESULT) */}
      {showTestModal && testResult && (
        <CustomModal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          title="⚡ Kết Quả Thực Thi Bắn Thử Nghiệm"
          width="680px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Status bar */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '0.75rem 1rem', 
              borderRadius: '8px',
              background: testResult.http_code === 200 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: testResult.http_code === 200 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {testResult.http_code === 200 ? (
                  <CheckCircle size={20} color="var(--color-success)" />
                ) : (
                  <AlertCircle size={20} color="var(--color-danger)" />
                )}
                <div>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: testResult.http_code === 200 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    Mã HTTP Response: {testResult.http_code}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Thời gian phản hồi: {testResult.duration_ms}ms
                  </span>
                </div>
              </div>
            </div>

            {/* Rendered URL */}
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>API URL Đã Bắn Đến:</label>
              <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--color-border)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                {testResult.rendered_url}
              </div>
            </div>

            {/* Rendered Payload */}
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Payload Đã Tạo & Gửi Đi (Rendered JSON):</label>
              <pre style={{ padding: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', maxHeight: '180px', overflow: 'auto', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                {testResult.rendered_payload}
              </pre>
            </div>

            {/* Server Response Body */}
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Phản Hồi Từ Máy Chủ (Response Body):</label>
              <pre style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', borderRadius: '6px', maxHeight: '140px', overflow: 'auto', fontSize: '0.75rem', fontFamily: 'monospace', color: testResult.http_code === 200 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {testResult.response || testResult.curl_error || 'No content returned'}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
              <button className="btn primary" onClick={() => setShowTestModal(false)} style={{ minWidth: 90 }}>
                Đóng
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Payload Viewer Modal */}
      {viewPayload && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '540px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'scaleUp 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Code size={20} /> Chi tiết payload JSON
              </h2>
              <button onClick={() => setViewPayload(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center' }}>
                <X size={20} />
              </button>
            </div>
            <pre style={{ padding: '1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', maxHeight: '380px', overflow: 'auto', fontSize: '0.75rem', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(viewPayload), null, 2);
                } catch {
                  return viewPayload;
                }
              })()}
            </pre>
          </div>
        </div>
      )}

      {/* Explanation of CAPI rules */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Hướng dẫn Cơ chế Facebook Conversion API (CAPI)"
        width="760px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.875rem 1rem', 
            background: 'rgba(189, 29, 45, 0.04)', 
            border: '1px solid rgba(189, 29, 45, 0.15)', 
            borderRadius: 12 
          }}>
            <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              Hệ thống kết nối trực tiếp máy chủ Rich Land với Meta (Facebook) để báo cáo kết quả bán hàng từ CRM. Giúp phòng Marketing đo lường quảng cáo chính xác hơn, tránh bị chặn theo dõi bởi các ứng dụng chặn quảng cáo hoặc tính năng bảo mật trên điện thoại iPhone (iOS).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Event types */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(59, 130, 246, 0.02)', 
              borderLeft: '4px solid #3b82f6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <CheckCircle size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  1. Các loại sự kiện gửi về Facebook (Events)
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                  • <strong>Thiết lập linh hoạt</strong>: Bạn có thể tự do khai báo bất kỳ sự kiện nào bằng nút bánh răng ⚙️, hoặc ánh xạ bất kỳ trạng thái phễu nào của CRM với các sự kiện Standard của Meta ngay tại bảng điều khiển.<br />
                  • <strong>Lead (Khách tiềm năng)</strong>: Báo về Facebook khi hệ thống nhận diện được nhu cầu khách hàng.<br />
                  • <strong>Schedule (Đặt lịch hẹn)</strong>: Báo về Facebook khi nhân viên sale đặt lịch hẹn gặp khách hàng thành công.<br />
                  • <strong>Purchase (Mua hàng)</strong>: Báo về Facebook khi khách hàng ký kết hợp đồng đặt cọc thành công (tự động kèm số tiền cọc/giá trị giao dịch).
                </p>
              </div>
            </div>

            {/* Forward only rule */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(239, 68, 68, 0.02)', 
              borderLeft: '4px solid #ef4444', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  2. Nguyên tắc Bắn một chiều (Forward-only Signals)
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Khi giao dịch bị hủy (bể cọc), hệ thống <strong>tuyệt đối không gửi lệnh hủy hay hạ cấp</strong> về cho Facebook. Tín hiệu chỉ gửi đi một chiều. Điều này nhằm giữ cho trí tuệ nhân tạo (AI) của Facebook học tập chính xác chân dung khách hàng có khả năng chi trả thật, tránh làm nhiễu loạn mục tiêu chạy quảng cáo của công ty.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>Đồng ý</button>
        </div>
      </CustomModal>
    </div>
  );
}
