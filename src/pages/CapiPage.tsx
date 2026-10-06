import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Link2, Save, Check, X, AlertCircle, RefreshCw, Code, CheckCircle, 
  Info, ShieldAlert, Search, Calendar, FileText, MessageCircle, Eye, 
  Zap, Settings as SettingsIcon, Plus, Trash2, Edit2, Play, ExternalLink, 
  Sliders, Layers, Globe, Radio, Copy, Users, UserPlus, Database, Briefcase, CreditCard
} from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { Skeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Pagination } from '../components/ui/Pagination';
import { useUIStore } from '../store/uiStore';

interface CapiLog {
  id: number;
  lead_id?: number | null;
  contact_id?: number | null;
  contact_real_id?: number | null;
  event_name: string;
  sent_payload: string;
  response_status: number;
  response_body: string;
  sent_at: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email?: string | null;
  pipeline_status?: string | null;
  source?: string | null;
  avatar_url?: string | null;
  person_full_name?: string | null;
  display_name?: string | null;
  owner_name?: string | null;
}

interface CustomEventItem {
  name: string;
  label: string;
  description?: string;
}

export interface TriggerCondition {
  field: string;
  operator: string;
  value: string;
}

export interface TriggerBranch {
  conditions: TriggerCondition[]; // Các điều kiện trong nhánh kết hợp bằng AND
}

export interface OutboundTrigger {
  id: string;
  name: string;
  is_active: boolean;
  source_table: string; // 'contacts' | 'leads' | 'persons' | 'deals' | 'deposits'
  change_type: 'update' | 'insert' | 'delete' | 'all'; // Updates, Adds, Deletes
  branches: TriggerBranch[]; // Các nhánh kết hợp bằng OR
  target_url: string;
  http_method: 'POST' | 'PUT' | 'GET' | 'PATCH';
  headers: string;
  payload_template: string;
  // Legacy compatibility
  condition_logic?: 'OR' | 'AND';
  conditions?: TriggerCondition[];
  trigger_field?: string;
  trigger_value?: string;
}

export interface TestResult {
  http_code: number;
  response: string;
  curl_error?: string;
  rendered_url: string;
  rendered_payload: string;
  duration_ms: number;
  condition_passed?: boolean;
}

const TRIGGER_TABLES = [
  { id: 'contacts', name: 'contacts', label: 'Khách hàng (contacts)', desc: 'Khách hàng CRM, phân công Sale, trạng thái phễu', icon: Users },
  { id: 'leads', name: 'leads', label: 'Lead tiềm năng (leads)', desc: 'Lead mới từ Ads Facebook / TikTok / Website', icon: UserPlus },
  { id: 'persons', name: 'persons', label: 'Kho Databank (persons)', desc: 'SĐT danh tính cá nhân & kho chung công ty', icon: Database },
  { id: 'deals', name: 'deals', label: 'Giao dịch BĐS (deals)', desc: 'Hợp đồng, căn hộ giao dịch, doanh số, hoa hồng', icon: Briefcase },
  { id: 'deposits', name: 'deposits', label: 'Đặt cọc & Booking (deposits)', desc: 'Tiền cọc giữ chỗ, phiếu thu, hủy cọc', icon: CreditCard }
];

const TRIGGER_CHANGE_TYPES = [
  { id: 'update', label: 'Updates (Cập nhật)', desc: 'Kích hoạt khi dữ liệu/trạng thái thay đổi', icon: RefreshCw, color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)', border: 'rgba(37, 99, 235, 0.25)' },
  { id: 'insert', label: 'Adds (Thêm mới)', desc: 'Kích hoạt khi có bản ghi mới được tạo', icon: Plus, color: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)', border: 'rgba(22, 163, 74, 0.25)' },
  { id: 'delete', label: 'Deletes (Xóa bản ghi)', desc: 'Kích hoạt khi bản ghi bị xóa hoặc hủy', icon: Trash2, color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)', border: 'rgba(220, 38, 38, 0.25)' }
];

const TRIGGER_OPERATORS = [
  { value: '=', label: '= (Bằng)' },
  { value: '!=', label: '!= (Khác)' },
  { value: '>', label: '> (Lớn hơn - số)' },
  { value: '>=', label: '>= (Lớn hơn hoặc bằng)' },
  { value: '<', label: '< (Nhỏ hơn - số)' },
  { value: '<=', label: '<= (Nhỏ hơn hoặc bằng)' },
  { value: 'contains', label: 'Chứa chữ (contains)' },
  { value: 'is_empty', label: 'Rỗng / Chưa có dữ liệu' },
  { value: 'is_not_empty', label: 'Có dữ liệu (không rỗng)' }
];

const TABLE_SUGGESTED_FIELDS: Record<string, { field: string; label: string; type?: 'status' | 'number' | 'text' }[]> = {
  contacts: [
    { field: 'pipeline_status', label: 'Trạng thái phễu (pipeline_status)', type: 'status' },
    { field: 'status', label: 'Trạng thái chăm sóc (status)', type: 'text' },
    { field: 'budget', label: 'Ngân sách dự kiến (budget)', type: 'number' },
    { field: 'source', label: 'Nguồn khách hàng (source)', type: 'text' },
    { field: 'demand_type', label: 'Nhu cầu mua/thuê (demand_type)', type: 'text' },
    { field: 'property_type', label: 'Loại hình BĐS (property_type)', type: 'text' },
    { field: 'owner_id', label: 'ID Sale phụ trách (owner_id)', type: 'number' },
    { field: 'lead_score', label: 'Điểm tiềm năng (lead_score)', type: 'number' },
    { field: 'temperature', label: 'Nhiệt độ lead (temperature)', type: 'text' },
    { field: 'notes', label: 'Ghi chú (notes)', type: 'text' },
    { field: 'city', label: 'Tỉnh / Thành phố (city)', type: 'text' }
  ],
  leads: [
    { field: 'status', label: 'Trạng thái lead (status)', type: 'status' },
    { field: 'budget', label: 'Ngân sách (budget)', type: 'number' },
    { field: 'source', label: 'Nguồn lead (source)', type: 'text' },
    { field: 'demand_type', label: 'Nhu cầu (demand_type)', type: 'text' },
    { field: 'property_type', label: 'Loại hình (property_type)', type: 'text' },
    { field: 'assigned_to', label: 'ID Sale tiếp nhận (assigned_to)', type: 'number' },
    { field: 'utm_campaign', label: 'Chiến dịch UTM (utm_campaign)', type: 'text' },
    { field: 'form_name', label: 'Tên form ads (form_name)', type: 'text' },
    { field: 'ad_name', label: 'Tên mẫu quảng cáo (ad_name)', type: 'text' },
    { field: 'lead_phan_loai', label: 'Phân loại lead (lead_phan_loai)', type: 'text' }
  ],
  persons: [
    { field: 'is_public', label: 'Trạng thái vào kho chung (is_public: 0 hoặc 1)', type: 'number' },
    { field: 'public_count', label: 'Số lần nhả kho (public_count)', type: 'number' },
    { field: 'is_blocked', label: 'Bị khóa/chặn (is_blocked: 0 hoặc 1)', type: 'number' },
    { field: 'phone', label: 'Số điện thoại (phone)', type: 'text' },
    { field: 'email', label: 'Email (email)', type: 'text' }
  ],
  deals: [
    { field: 'status', label: 'Trạng thái deal (status)', type: 'text' },
    { field: 'actual_value', label: 'Doanh số thực tế (actual_value)', type: 'number' },
    { field: 'expected_value', label: 'Doanh thu dự kiến (expected_value)', type: 'number' },
    { field: 'pipeline_stage_id', label: 'ID Giai đoạn phễu deal (pipeline_stage_id)', type: 'number' }
  ],
  deposits: [
    { field: 'status', label: 'Trạng thái cọc (status)', type: 'text' },
    { field: 'deposit_amount', label: 'Số tiền đặt cọc (deposit_amount)', type: 'number' }
  ]
};

const normalizeTrigger = (t: any): OutboundTrigger => {
  const source_table = t.source_table || 'contacts';
  const change_type = t.change_type || 'update';
  
  let branches: TriggerBranch[] = [];

  if (Array.isArray(t.branches) && t.branches.length > 0) {
    branches = t.branches.map((b: any) => ({
      conditions: Array.isArray(b.conditions) && b.conditions.length > 0
        ? b.conditions.map((c: any) => ({
            field: c.field || c.col || 'pipeline_status',
            operator: c.operator || c.op || '=',
            value: c.value !== undefined ? String(c.value) : (c.val !== undefined ? String(c.val) : '')
          }))
        : [{ field: 'pipeline_status', operator: '=', value: '' }]
    }));
  } else if (Array.isArray(t.conditions) && t.conditions.length > 0) {
    if (t.condition_logic === 'AND') {
      branches = [{
        conditions: t.conditions.map((c: any) => ({
          field: c.field || 'pipeline_status',
          operator: c.operator || '=',
          value: c.value !== undefined ? String(c.value) : ''
        }))
      }];
    } else {
      // Default OR: each condition is an independent branch
      branches = t.conditions.map((c: any) => ({
        conditions: [{
          field: c.field || 'pipeline_status',
          operator: c.operator || '=',
          value: c.value !== undefined ? String(c.value) : ''
        }]
      }));
    }
  } else if (t.trigger_field) {
    branches = [{
      conditions: [{
        field: t.trigger_field,
        operator: '=',
        value: t.trigger_value || ''
      }]
    }];
  } else {
    branches = [
      { conditions: [{ field: 'pipeline_status', operator: '=', value: 'da_gap' }] },
      { conditions: [{ field: 'pipeline_status', operator: '=', value: 'dong_y_gap' }] }
    ];
  }

  const allConditions = branches.flatMap(b => b.conditions);
  const firstCond = allConditions[0] || { field: 'pipeline_status', operator: '=', value: 'da_gap' };

  return {
    id: t.id || 'trg_' + Date.now(),
    name: t.name || 'Trigger Webhook',
    is_active: t.is_active !== undefined ? Boolean(t.is_active) : true,
    source_table,
    change_type,
    branches,
    conditions: allConditions,
    condition_logic: 'OR',
    trigger_field: firstCond.field,
    trigger_value: firstCond.value,
    target_url: t.target_url || '',
    http_method: t.http_method || 'POST',
    headers: t.headers || '{\n  "Content-Type": "application/json"\n}',
    payload_template: t.payload_template || PRESET_TEMPLATES.meta_standard
  };
};

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
    name: 'Bắn Meta CAPI khi Đã Gặp hoặc Đồng Ý Gặp',
    is_active: true,
    source_table: 'contacts',
    change_type: 'update',
    branches: [
      { conditions: [{ field: 'pipeline_status', operator: '=', value: 'da_gap' }] },
      { conditions: [{ field: 'pipeline_status', operator: '=', value: 'dong_y_gap' }] }
    ],
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

  // Debug payload and response viewer modal
  const [viewPayload, setViewPayload] = useState<string | null>(null);
  const [viewResponse, setViewResponse] = useState<string | null>(null);
  const [showCapiConfigModal, setShowCapiConfigModal] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logFilterStatus, setLogFilterStatus] = useState<'all' | '200' | 'error'>('all');
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(25);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const getInitials = (name?: string | null) => {
    if (!name || !name.trim()) return 'KH';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarColor = (name?: string | null) => {
    if (!name) return '#6b7280';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
      '#10b981', '#06b6d4', '#6366f1', '#bd1d2d'
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    addToast('Đã sao chép vào clipboard', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
          setOutboundTriggers(resSettings.data.outbound_webhook_triggers.map(normalizeTrigger));
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
  const handleSelectTable = (tableId: string) => {
    const defaultFields = TABLE_SUGGESTED_FIELDS[tableId] || TABLE_SUGGESTED_FIELDS.contacts;
    const defaultField = defaultFields[0]?.field || 'pipeline_status';
    setTriggerForm(prev => ({
      ...prev,
      source_table: tableId,
      branches: prev.branches && prev.branches.length > 0
        ? prev.branches.map(b => ({
            conditions: b.conditions.map(c => ({ ...c, field: defaultField, value: '' }))
          }))
        : [{ conditions: [{ field: defaultField, operator: '=', value: '' }] }]
    }));
  };

  const handleAddBranch = () => {
    const currentTableFields = TABLE_SUGGESTED_FIELDS[triggerForm.source_table] || TABLE_SUGGESTED_FIELDS.contacts;
    const defaultField = currentTableFields[0]?.field || 'pipeline_status';
    setTriggerForm(prev => ({
      ...prev,
      branches: [
        ...(prev.branches || []),
        { conditions: [{ field: defaultField, operator: '=', value: '' }] }
      ]
    }));
  };

  const handleRemoveBranch = (branchIndex: number) => {
    if ((triggerForm.branches || []).length <= 1) {
      addToast('Trigger cần có ít nhất 1 nhánh điều kiện lọc', 'warning');
      return;
    }
    setTriggerForm(prev => ({
      ...prev,
      branches: prev.branches.filter((_, idx) => idx !== branchIndex)
    }));
  };

  const handleAddCondition = (branchIndex: number) => {
    const currentTableFields = TABLE_SUGGESTED_FIELDS[triggerForm.source_table] || TABLE_SUGGESTED_FIELDS.contacts;
    const defaultField = currentTableFields[0]?.field || 'pipeline_status';
    setTriggerForm(prev => {
      const nextBranches = [...(prev.branches || [])];
      if (!nextBranches[branchIndex]) return prev;
      nextBranches[branchIndex] = {
        ...nextBranches[branchIndex],
        conditions: [
          ...nextBranches[branchIndex].conditions,
          { field: defaultField, operator: '=', value: '' }
        ]
      };
      return { ...prev, branches: nextBranches };
    });
  };

  const handleRemoveCondition = (branchIndex: number, conditionIndex: number) => {
    setTriggerForm(prev => {
      const nextBranches = [...(prev.branches || [])];
      if (!nextBranches[branchIndex]) return prev;
      const curConditions = nextBranches[branchIndex].conditions;
      if (curConditions.length <= 1) {
        if (nextBranches.length > 1) {
          // If only 1 condition in this branch and multiple branches exist, remove the branch
          return {
            ...prev,
            branches: nextBranches.filter((_, idx) => idx !== branchIndex)
          };
        }
        addToast('Mỗi nhánh cần có ít nhất 1 điều kiện lọc', 'warning');
        return prev;
      }
      nextBranches[branchIndex] = {
        ...nextBranches[branchIndex],
        conditions: curConditions.filter((_, idx) => idx !== conditionIndex)
      };
      return { ...prev, branches: nextBranches };
    });
  };

  const handleUpdateCondition = (branchIndex: number, conditionIndex: number, patch: Partial<TriggerCondition>) => {
    setTriggerForm(prev => {
      const nextBranches = [...(prev.branches || [])];
      if (!nextBranches[branchIndex]) return prev;
      nextBranches[branchIndex] = {
        ...nextBranches[branchIndex],
        conditions: nextBranches[branchIndex].conditions.map((c, idx) => idx === conditionIndex ? { ...c, ...patch } : c)
      };
      return { ...prev, branches: nextBranches };
    });
  };

  const handleOpenCreateTrigger = () => {
    setEditingTrigger(null);
    setTriggerForm({
      id: 'trg_' + Date.now(),
      name: 'Bắn Meta CAPI khi Đã Gặp hoặc Đồng Ý Gặp',
      is_active: true,
      source_table: 'contacts',
      change_type: 'update',
      branches: [
        { conditions: [{ field: 'pipeline_status', operator: '=', value: 'da_gap' }] },
        { conditions: [{ field: 'pipeline_status', operator: '=', value: 'dong_y_gap' }] }
      ],
      target_url: 'https://graph.facebook.com/v19.0/{pixel_id}/events?access_token={token}',
      http_method: 'POST',
      headers: '{\n  "Content-Type": "application/json"\n}',
      payload_template: PRESET_TEMPLATES.meta_standard
    });
    setShowTriggerModal(true);
  };

  const handleOpenEditTrigger = (trg: OutboundTrigger) => {
    setEditingTrigger(trg);
    setTriggerForm(normalizeTrigger(trg));
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

    const normalized = normalizeTrigger(triggerForm);
    let updatedTriggers: OutboundTrigger[];
    if (editingTrigger) {
      updatedTriggers = outboundTriggers.map(t => t.id === editingTrigger.id ? normalized : t);
    } else {
      updatedTriggers = [...outboundTriggers, { ...normalized, id: normalized.id || 'trg_' + Date.now() }];
    }

    setOutboundTriggers(updatedTriggers);
    setShowTriggerModal(false);
    handleSaveSettings(customEvents, updatedTriggers, capiEventTriggers);
    addToast(`Đã lưu trigger "${normalized.name}"`, 'success');
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
      const normalized = normalizeTrigger(trgToTest);
      const res = await fetchAPI('capi/test-trigger', {
        method: 'POST',
        body: JSON.stringify({
          source_table: normalized.source_table,
          change_type: normalized.change_type,
          branches: normalized.branches,
          condition_logic: normalized.condition_logic,
          conditions: normalized.conditions,
          target_url: normalized.target_url,
          http_method: normalized.http_method,
          headers: normalized.headers,
          payload_template: normalized.payload_template
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--color-text)' }}>
              <Link2 size={18} style={{ color: 'var(--color-primary)' }} />
              Tích Hợp Meta Conversion API & Automation Triggers
            </h2>
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: 'rgba(189, 29, 45, 0.06)',
                border: '1px solid rgba(189, 29, 45, 0.2)',
                padding: '2px 8px',
                borderRadius: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: 'var(--color-primary)',
                fontWeight: 600,
                fontSize: '0.7rem',
                transition: 'all 0.2s'
              }}
              title="Xem hướng dẫn quy tắc Conversion API & Forward-only"
            >
              <Info size={12} />
              <span>Forward-only</span>
            </button>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            Cấu hình đẩy ngược sự kiện phễu bán hàng về Meta Ads và thiết lập các bộ Trigger bắn Webhook tự động linh hoạt
          </p>
        </div>

        {/* Action Buttons Top Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowCapiConfigModal(true)}
            className="btn primary"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 14px', 
              fontSize: '0.8rem',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(189, 29, 45, 0.2)'
            }}
            title="Mở bảng cấu hình Meta Pixel & Ánh xạ sự kiện"
          >
            <SettingsIcon size={15} />
            <span>Cài đặt</span>
          </button>
          
          <button
            onClick={loadData}
            className="btn"
            style={{ width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
            title="Tải lại trang"
          >
            <RefreshCw size={15} />
          </button>
        </div>
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

      {/* TAB 1: META CAPI & ÁNH XẠ PHỄU (FULL WIDTH DETAILED LOGS) */}
      {activeTab === 'capi' && (() => {
        const filteredLogs = logs.filter(l => {
          const q = logSearch.toLowerCase().trim();
          const matchesSearch = !q ||
            (l.event_name && l.event_name.toLowerCase().includes(q)) ||
            (l.display_name && l.display_name.toLowerCase().includes(q)) ||
            (l.first_name && l.first_name.toLowerCase().includes(q)) ||
            (l.last_name && l.last_name.toLowerCase().includes(q)) ||
            (l.phone && l.phone.includes(q)) ||
            (l.owner_name && l.owner_name.toLowerCase().includes(q)) ||
            (String(l.response_status).includes(q));

          const matchesStatus = logFilterStatus === 'all' ||
            (logFilterStatus === '200' && Number(l.response_status) === 200) ||
            (logFilterStatus === 'error' && Number(l.response_status) !== 200);

          return matchesSearch && matchesStatus;
        });

        const paginatedLogs = filteredLogs.slice((logPage - 1) * logPageSize, logPage * logPageSize);

        return (
        <div className="card" style={{ padding: '1.25rem', width: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Top toolbar inside Log card */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                  Nhật Ký Sự Kiện Gửi Đi (CAPI & Trigger Logs)
                </h3>
              </div>
              <span style={{ 
                fontSize: '0.72rem', 
                fontWeight: 700, 
                padding: '2px 8px', 
                borderRadius: '12px', 
                background: 'rgba(0,0,0,0.05)', 
                color: 'var(--color-text-muted)' 
              }}>
                {filteredLogs.length} / {logs.length} bản ghi
              </span>
            </div>

            {/* Filter controls without lower redundant setting button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Search input */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Tìm khách, SĐT, sự kiện..."
                  value={logSearch}
                  onChange={e => {
                    setLogSearch(e.target.value);
                    setLogPage(1);
                  }}
                  className="form-input"
                  style={{ paddingLeft: '30px', fontSize: '0.75rem', height: '32px' }}
                />
              </div>

              {/* Status filter buttons */}
              <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => {
                    setLogFilterStatus('all');
                    setLogPage(1);
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    border: 'none',
                    background: logFilterStatus === 'all' ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: logFilterStatus === 'all' ? '#fff' : 'var(--color-text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogFilterStatus('200');
                    setLogPage(1);
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    border: 'none',
                    borderLeft: '1px solid var(--color-border)',
                    background: logFilterStatus === '200' ? '#10b981' : 'var(--color-bg)',
                    color: logFilterStatus === '200' ? '#fff' : 'var(--color-text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  200 OK
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogFilterStatus('error');
                    setLogPage(1);
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    border: 'none',
                    borderLeft: '1px solid var(--color-border)',
                    background: logFilterStatus === 'error' ? '#ef4444' : 'var(--color-bg)',
                    color: logFilterStatus === 'error' ? '#fff' : 'var(--color-text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Lỗi (4xx/5xx)
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 850, textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
                    <th style={{ padding: '0.5rem' }}>Thời gian gửi</th>
                    <th style={{ padding: '0.5rem' }}>Kênh & Sự kiện</th>
                    <th style={{ padding: '0.5rem' }}>Khách hàng</th>
                    <th style={{ padding: '0.5rem' }}>Phụ trách</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Mã HTTP</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}><Skeleton width="90px" height={14} /></td>
                      <td style={{ padding: '0.75rem 0.5rem' }}><Skeleton width="120px" height={14} /></td>
                      <td style={{ padding: '0.75rem 0.5rem' }}><Skeleton width="160px" height={14} /></td>
                      <td style={{ padding: '0.75rem 0.5rem' }}><Skeleton width="100px" height={14} /></td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}><Skeleton width="40px" height={16} style={{ margin: '0 auto' }} /></td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}><Skeleton width="80px" height={16} style={{ margin: '0 auto' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
              <Radio size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px auto', display: 'block', opacity: 0.5 }} />
              Chưa có sự kiện nào được bắn về Meta hoặc Webhook
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 850, textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.7rem' }}>
                    <th style={{ padding: '0.65rem 0.5rem', width: '130px' }}>Thời gian gửi</th>
                    <th style={{ padding: '0.65rem 0.5rem', width: '160px' }}>Kênh & Sự kiện</th>
                    <th style={{ padding: '0.65rem 0.5rem', minWidth: '220px' }}>Khách hàng</th>
                    <th style={{ padding: '0.65rem 0.5rem', width: '140px' }}>Phụ trách</th>
                    <th style={{ padding: '0.65rem 0.5rem', width: '90px', textAlign: 'center' }}>Mã HTTP</th>
                    <th style={{ padding: '0.65rem 0.5rem', width: '150px', textAlign: 'center' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map(l => {
                      const isTrigger = l.event_name.startsWith('TRIGGER:');
                      const cleanEvent = l.event_name.replace('TRIGGER: ', '').trim() || 'CompleteRegistration';
                      const customerName = l.display_name || (l.first_name ? `${l.last_name || ''} ${l.first_name}`.trim() : (l.lead_id === 2147483647 ? 'Khách hàng mẫu (Test)' : 'Khách hàng'));
                      const isSuccess = Number(l.response_status) === 200;

                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border-light)', transition: 'background 0.15s' }}>
                          {/* 1. Time */}
                          <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                                {new Date(l.sent_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                {new Date(l.sent_at).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          </td>

                          {/* 2. Channel & Event */}
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                width: 'fit-content',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: isTrigger ? 'rgba(234, 88, 12, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                color: isTrigger ? '#ea580c' : '#3b82f6',
                                border: isTrigger ? '1px solid rgba(234, 88, 12, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)'
                              }}>
                                {isTrigger ? 'WEBHOOK TRIGGER' : 'META CAPI'}
                              </span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                {cleanEvent}
                              </span>
                            </div>
                          </td>

                          {/* 3. Customer WITH ROUND AVATAR AT THE FRONT */}
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {/* Round avatar */}
                              {l.avatar_url ? (
                                <img
                                  src={l.avatar_url}
                                  alt={customerName}
                                  style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                    border: '1px solid var(--color-border)'
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '50%',
                                    background: getAvatarColor(customerName),
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    flexShrink: 0,
                                    letterSpacing: '0.5px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                  }}
                                >
                                  {getInitials(customerName)}
                                </div>
                              )}

                              {/* Customer details */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {customerName}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {l.phone && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                      {l.phone}
                                    </span>
                                  )}
                                  {l.pipeline_status && (
                                    <span style={{
                                      fontSize: '0.64rem',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: 'rgba(0,0,0,0.05)',
                                      color: 'var(--color-text)',
                                      fontWeight: 600
                                    }}>
                                      {pipelineStatusLabels[l.pipeline_status] || l.pipeline_status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 4. Sales / Owner */}
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: l.owner_name ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                              {l.owner_name || '—'}
                            </span>
                          </td>

                          {/* 5. HTTP Status code */}
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            <span
                              className="font-mono font-bold"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                background: isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: isSuccess ? '#10b981' : '#ef4444',
                                border: isSuccess ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
                              }}
                            >
                              {isSuccess ? <Check size={11} /> : <AlertCircle size={11} />}
                              {l.response_status || 'ERR'}
                            </span>
                          </td>

                          {/* 6. Details (Payload & Response buttons) */}
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => setViewPayload(l.sent_payload)}
                                className="btn sm"
                                style={{ padding: '3px 7px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                title="Xem chi tiết Payload đã gửi"
                              >
                                <Code size={12} />
                                <span>Payload</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setViewResponse(l.response_body || 'Không có nội dung phản hồi')}
                                className="btn sm"
                                style={{ padding: '3px 7px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                title="Xem phản hồi từ API (Response)"
                              >
                                <Eye size={12} />
                                <span>Phản hồi</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredLogs.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
              <Pagination
                total={filteredLogs.length}
                page={logPage}
                pageSize={logPageSize}
                onChange={setLogPage}
                showSizeChanger
                onPageSizeChange={(newSize) => {
                  setLogPageSize(newSize);
                  setLogPage(1);
                }}
              />
            </div>
          )}
        </div>
        );
      })()}

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
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
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: '12px',
                        background: trg.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        color: trg.is_active ? 'var(--color-success)' : 'var(--color-text-muted)'
                      }}>
                        {trg.is_active ? 'Đang bật' : 'Tạm dừng'}
                      </span>

                      {/* Table pill */}
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        color: '#8b5cf6',
                        border: '1px solid rgba(139, 92, 246, 0.25)',
                        fontFamily: 'monospace',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Database size={11} />
                        <span>{trg.source_table || 'contacts'}</span>
                      </span>

                      {/* Change type pill */}
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: trg.change_type === 'insert' ? 'rgba(22, 163, 74, 0.1)' : trg.change_type === 'delete' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                        color: trg.change_type === 'insert' ? '#16a34a' : trg.change_type === 'delete' ? '#dc2626' : '#2563eb',
                        border: '1px solid currentColor',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {trg.change_type === 'insert' ? <><Plus size={11} /> Adds</> : trg.change_type === 'delete' ? <><Trash2 size={11} /> Deletes</> : <><RefreshCw size={11} /> Updates</>}
                      </span>
                    </div>

                    {/* Conditions and Target API */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.775rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Điều kiện:</span>
                        {trg.branches && trg.branches.length > 0 ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {trg.branches.map((b, bIdx) => (
                              <span key={bIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {bIdx > 0 && <span style={{ fontWeight: 800, margin: '0 4px', color: '#ea580c', fontSize: '0.7rem' }}>HOẶC</span>}
                                <span style={{ background: 'rgba(0,0,0,0.035)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-primary)' }}>N{bIdx + 1}:</span>
                                  {b.conditions.map((c, cIdx) => (
                                    <span key={cIdx} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                      {cIdx > 0 && <span style={{ fontWeight: 800, margin: '0 3px', color: '#2563eb', fontSize: '0.65rem' }}>VÀ</span>}
                                      <code style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                                        {c.field} {c.operator} {c.value || '*'}
                                      </code>
                                    </span>
                                  ))}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : trg.conditions && trg.conditions.length > 0 ? (
                          trg.conditions.map((c, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                              {i > 0 && <span style={{ fontWeight: 800, margin: '0 4px', color: trg.condition_logic === 'AND' ? '#2563eb' : '#ea580c', fontSize: '0.68rem' }}>{trg.condition_logic || 'OR'}</span>}
                              <code style={{ background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: '4px', color: 'var(--color-text)', fontWeight: 700 }}>
                                {c.field} {c.operator} {c.value || '*'}
                              </code>
                            </span>
                          ))
                        ) : (
                          <code style={{ background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: '4px', color: 'var(--color-text)', fontWeight: 700 }}>
                            {trg.trigger_field} = {trg.trigger_value}
                          </code>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: 'var(--color-text-muted)' }}>
                        <span style={{ fontWeight: 600 }}>API Đích:</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: 600 }}>{trg.http_method} {trg.target_url.slice(0, 50)}...</span>
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
        title={editingTrigger ? 'Chỉnh Sửa Bộ Kích Hoạt Trigger' : 'Tạo Mới Bộ Kích Hoạt Trigger'}
        width="960px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* ============================================================ */}
          {/* MỤC 1: ĐIỀU KIỆN KÍCH HOẠT (TABLE -> TYPE CHANGE -> CONDITIONS) */}
          {/* ============================================================ */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(0,0,0,0.015)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 800 }}>1</span>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                  Mục 1: Điều Kiện Kích Hoạt Trigger (Chi tiết)
                </h4>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Bảng ➔ Loại thao tác (Adds / Updates / Deletes) ➔ Các Nhánh quy tắc lọc
              </span>
            </div>

            {/* Tên mô tả Trigger */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Tên mô tả Bộ Trigger *</label>
              <input
                type="text"
                placeholder="VD: Bắn Meta CAPI khi Đã Gặp hoặc Đồng Ý Gặp"
                value={triggerForm.name}
                onChange={e => setTriggerForm(prev => ({ ...prev, name: e.target.value }))}
                className="form-input"
                style={{ fontSize: '0.825rem', fontWeight: 600 }}
              />
            </div>

            {/* 1.1 CHỌN TABLE */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, margin: 0 }}>
                  1. Chọn Table (Lắng nghe bảng dữ liệu nào) *
                </label>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 700 }}>Bảng đang chọn: {triggerForm.source_table}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                {TRIGGER_TABLES.map(tbl => {
                  const isSelected = triggerForm.source_table === tbl.id;
                  const Icon = tbl.icon;
                  return (
                    <button
                      key={tbl.id}
                      type="button"
                      onClick={() => handleSelectTable(tbl.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: isSelected ? 'var(--color-primary-light, rgba(189, 29, 45, 0.06))' : 'var(--color-bg)',
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                        <Icon size={15} />
                        <span>{tbl.name}</span>
                      </div>
                      <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
                        {tbl.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1.2 CHỌN TYPE CHANGE */}
            <div style={{ marginBottom: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, margin: 0 }}>
                  2. Chọn Type Change (Loại sự kiện thay đổi) *
                </label>
                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>3 loại: Adds, Updates, Deletes</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {TRIGGER_CHANGE_TYPES.map(ct => {
                  const isSelected = triggerForm.change_type === ct.id;
                  const Icon = ct.icon;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setTriggerForm(prev => ({ ...prev, change_type: ct.id as any }))}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: isSelected ? `2px solid ${ct.color}` : '1px solid var(--color-border)',
                        background: isSelected ? ct.bg : 'var(--color-bg)',
                        color: isSelected ? ct.color : 'var(--color-text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon size={14} />
                        <span style={{ fontSize: '0.825rem', fontWeight: 800 }}>
                          {ct.label}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
                        {ct.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1.3 THIẾT LẬP CÁC NHÁNH ĐIỀU KIỆN (RULES FILTER - BRANCH SYSTEM) */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', background: 'var(--color-bg)' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 800, margin: 0 }}>
                  3. Chọn Điều kiện kích hoạt (Rules Filter)
                </label>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                  Quy tắc: Các điều kiện trong cùng 1 Nhánh kết hợp bằng <strong>VÀ (AND)</strong>. Giữa các Nhánh kết hợp bằng <strong>HOẶC (OR)</strong>. Thỏa mãn bất kỳ Nhánh nào thì Trigger sẽ được kích hoạt.
                </span>
              </div>

              {/* Branches list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(triggerForm.branches || []).map((branch, bIdx) => (
                  <div
                    key={bIdx}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg, 10px)',
                      padding: '1.25rem',
                      position: 'relative',
                      background: 'var(--color-surface, #fff)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Left red accent bar */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: 4,
                      background: 'var(--color-primary, #bd1d2d)',
                      borderRadius: '10px 0 0 10px'
                    }} />

                    {/* Branch Title and Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary, #bd1d2d)', textTransform: 'uppercase', margin: 0 }}>
                          NHÁNH {bIdx + 1}
                        </h4>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          (Các điều kiện bên dưới cùng thỏa mãn - logic VÀ)
                        </span>
                      </div>

                      {(triggerForm.branches || []).length > 1 && (
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ color: 'var(--color-danger, #ef4444)', padding: 4 }}
                          onClick={() => handleRemoveBranch(bIdx)}
                          title="Xóa nhánh này"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Conditions inside Branch */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {branch.conditions.map((c, cIdx) => {
                        const isLast = cIdx === branch.conditions.length - 1;
                        const isNoValueOperator = c.operator === 'is_empty' || c.operator === 'is_not_empty';
                        const isPipelineField = c.field === 'pipeline_status' || c.field === 'status';

                        return (
                          <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
                            {/* IF / AND badge */}
                            <div style={{ position: 'relative', width: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                              {cIdx === 0 ? (
                                <div style={{
                                  background: 'var(--color-primary-light, rgba(189, 29, 45, 0.1))',
                                  color: 'var(--color-primary, #bd1d2d)',
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  flexShrink: 0,
                                  position: 'relative',
                                  zIndex: 2
                                }}>
                                  IF
                                </div>
                              ) : (
                                <div style={{
                                  background: 'var(--color-bg, #f1f5f9)',
                                  color: 'var(--color-text-muted, #64748b)',
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  flexShrink: 0,
                                  position: 'relative',
                                  zIndex: 2
                                }}>
                                  AND
                                </div>
                              )}

                              {/* Connecting vertical line */}
                              <div style={{
                                position: 'absolute',
                                top: 32,
                                bottom: isLast ? -20 : -10,
                                left: 15,
                                width: 2,
                                background: 'var(--color-border, #e2e8f0)',
                                zIndex: 1
                              }} />
                            </div>

                            {/* Field selector */}
                            <div style={{ flex: '1 1 220px' }}>
                              <select
                                value={c.field}
                                onChange={e => handleUpdateCondition(bIdx, cIdx, { field: e.target.value })}
                                className="form-input"
                                style={{ fontSize: '0.8rem', height: '36px', borderRadius: 20 }}
                              >
                                {(TABLE_SUGGESTED_FIELDS[triggerForm.source_table] || TABLE_SUGGESTED_FIELDS.contacts).map(f => (
                                  <option key={f.field} value={f.field}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Operator selector */}
                            <div style={{ width: '170px', flexShrink: 0 }}>
                              <select
                                value={c.operator}
                                onChange={e => handleUpdateCondition(bIdx, cIdx, { operator: e.target.value })}
                                className="form-input font-bold"
                                style={{ fontSize: '0.8rem', height: '36px', borderRadius: 20 }}
                              >
                                {TRIGGER_OPERATORS.map(op => (
                                  <option key={op.value} value={op.value}>
                                    {op.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Value input or quick select */}
                            <div style={{ flex: '1 1 220px' }}>
                              {isNoValueOperator ? (
                                <div style={{ height: '36px', display: 'flex', alignItems: 'center', padding: '0 16px', background: 'var(--color-bg, #f8fafc)', borderRadius: 20, border: '1px solid var(--color-border)', fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                  (Không cần nhập giá trị)
                                </div>
                              ) : isPipelineField ? (
                                <select
                                  value={c.value}
                                  onChange={e => handleUpdateCondition(bIdx, cIdx, { value: e.target.value })}
                                  className="form-input"
                                  style={{ fontSize: '0.8rem', height: '36px', borderRadius: 20 }}
                                >
                                  <option value="">-- Chọn trạng thái --</option>
                                  <option value="*">* Mọi trạng thái</option>
                                  {pipelineStatuses.map(st => (
                                    <option key={st} value={st}>
                                      {pipelineStatusLabels[st] || st} ({st})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Nhập giá trị..."
                                  value={c.value}
                                  onChange={e => handleUpdateCondition(bIdx, cIdx, { value: e.target.value })}
                                  className="form-input"
                                  style={{ fontSize: '0.8rem', height: '36px', borderRadius: 20 }}
                                />
                              )}
                            </div>

                            {/* Delete Condition Button */}
                            {branch.conditions.length > 1 && (
                              <button
                                type="button"
                                className="btn ghost"
                                style={{ color: 'var(--color-danger)', padding: '8px', flexShrink: 0 }}
                                onClick={() => handleRemoveCondition(bIdx, cIdx)}
                                title="Xóa điều kiện này"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Add condition button inside branch */}
                      <div style={{ paddingLeft: 44, marginTop: '0.5rem', position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => handleAddCondition(bIdx)}
                          style={{
                            background: 'var(--color-primary-light, rgba(189, 29, 45, 0.1))',
                            color: 'var(--color-primary, #bd1d2d)',
                            border: 'none',
                            borderRadius: 20,
                            padding: '6px 16px',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <Plus size={14} /> Thêm điều kiện (VÀ)
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Branch Button */}
              <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleAddBranch}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'transparent',
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius-lg, 10px)',
                    color: 'var(--color-primary, #bd1d2d)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Plus size={18} /> Thêm Nhánh Mới (HOẶC)
                </button>
              </div>

              {/* Live preview rule summary */}
              <div style={{
                padding: '8px 12px',
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <Zap size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <span><strong>Quy tắc hoạt động:</strong> Lắng nghe bảng <code style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{triggerForm.source_table}</code> khi có thao tác <code style={{ color: '#2563eb', fontWeight: 800 }}>{triggerForm.change_type.toUpperCase()}</code> thỏa mãn:</span>
                <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  {(triggerForm.branches || []).map((b, bIdx) => (
                    <span key={bIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {bIdx > 0 && <strong style={{ color: '#ea580c', margin: '0 4px' }}>HOẶC</strong>}
                      <span style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                        (Nhánh {bIdx + 1}: {b.conditions.map((c, cIdx) => (
                          <span key={cIdx}>
                            {cIdx > 0 && <strong style={{ color: '#2563eb', margin: '0 4px' }}>VÀ</strong>}
                            {c.field} {c.operator} {c.value || '*'}
                          </span>
                        ))})
                      </span>
                    </span>
                  ))}
                </span>
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
                <Info size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                <em>Hệ thống tự động hỗ trợ <strong>tất cả các trường trong Database</strong> theo cú pháp <code>{'{{tên_cột}}'}</code> (ví dụ: {'{{gender}}'}, {'{{utm_source}}'}, {'{{customer_type}}'}, {'{{bedroom_count}}'},...).</em>
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
              <span>{testingTrigger ? 'Đang bắn thử...' : 'Bắn Thử Nghiệm Ngay'}</span>
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
          title="Kết Quả Thực Thi Bắn Thử Nghiệm"
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

            {/* Condition Evaluation Result Banner */}
            {testResult.condition_passed !== undefined && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: testResult.condition_passed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                color: testResult.condition_passed ? '#10b981' : '#d97706',
                border: testResult.condition_passed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                {testResult.condition_passed ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>
                  {testResult.condition_passed 
                    ? 'Bộ lọc quy tắc điều kiện: ĐẠT (Khớp dữ liệu bản ghi mẫu)' 
                    : 'Bộ lọc quy tắc điều kiện: KHÔNG KHỚP (Nếu chạy thực tế sự kiện này sẽ tự động bỏ qua)'}
                </span>
              </div>
            )}

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

      {/* MODAL CÀI ĐẶT META CAPI & ÁNH XẠ PHỄU */}
      {showCapiConfigModal && (
        <CustomModal
          isOpen={showCapiConfigModal}
          onClose={() => setShowCapiConfigModal(false)}
          title="Cài Đặt Meta Conversion API & Ánh Xạ Phễu"
          width="620px"
        >
          <form onSubmit={e => { e.preventDefault(); handleSaveSettings(); setShowCapiConfigModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                {/* Gear button for custom events declaration */}
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
                      value={capiEventTriggers[status] || (status === 'not_lead' ? 'Disqualified' : 'Skip')}
                      onChange={val => setCapiEventTriggers(prev => ({ ...prev, [status]: val }))}
                      width="190px"
                      placeholder="Chọn sự kiện..."
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowCapiConfigModal(false)}
                className="btn"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`btn primary ${saving ? 'loading' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {saving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                <span>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
              </button>
            </div>
          </form>
        </CustomModal>
      )}

      {/* Payload Viewer Modal */}
      {viewPayload && (
        <CustomModal
          isOpen={!!viewPayload}
          onClose={() => setViewPayload(null)}
          title="Chi tiết JSON Payload đã gửi đi"
          width="620px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => handleCopyText(viewPayload, 'payload')}
                className="btn sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                {copiedKey === 'payload' ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
                <span>{copiedKey === 'payload' ? 'Đã sao chép' : 'Sao chép JSON'}</span>
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
        </CustomModal>
      )}

      {/* Response Viewer Modal */}
      {viewResponse && (
        <CustomModal
          isOpen={!!viewResponse}
          onClose={() => setViewResponse(null)}
          title="Chi tiết phản hồi từ máy chủ (Response Body)"
          width="580px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => handleCopyText(viewResponse, 'res')}
                className="btn sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                {copiedKey === 'res' ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
                <span>{copiedKey === 'res' ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
            <pre style={{ padding: '1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', maxHeight: '380px', overflow: 'auto', fontSize: '0.75rem', color: 'var(--color-text)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(viewResponse), null, 2);
                } catch {
                  return viewResponse;
                }
              })()}
            </pre>
          </div>
        </CustomModal>
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
