import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Copy, CheckCircle2, ChevronRight, Link2, Tag, Info, FileSpreadsheet, Zap, Clock, Target, RefreshCw, Edit2, ExternalLink, AlertCircle, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';

const SYSTEM_FIELDS = [
  { value: 'phone', label: 'Số Điện Thoại' },
  { value: 'name', label: 'Họ Tên' },
  { value: 'email', label: 'Email' },
  { value: 'source', label: 'Nguồn Data' },
  { value: 'type', label: 'Loại Data' },
  { value: 'note', label: 'Ghi Chú' },
  { value: 'assigned_to', label: 'Sale phụ trách (Trùng số nhắc lại)' },
  { value: 'saleperson', label: 'Salesperson (Tên/Email Sale)' },
];

const BASE_WEBHOOK = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/webhook.php` : "https://open.domation.net/sale_data/webhook.php";

type Connection = {
  id: number;
  sheet_name: string;
  spreadsheet_id?: string;
  webhook_token: string;
  is_active: boolean;
  connection_type?: string;
  sync_interval?: number;
  sync_mode?: 'all' | 'new_only' | string;
  is_silent?: number | boolean;
  sync_saleperson?: number | boolean;
  email_template?: string;
  mappings?: Mapping[];
  require_both_contact?: number | boolean;
  last_sync_at?: string;
  stats?: {
    total: number;
    assigned: number;
    duplicate: number;
    reminder: number;
    error: number;
  };
};

type Mapping = {
  id: number;
  connection_id: number;
  sheet_column: string;
  system_field: string;
  custom_label?: string;
};

import { fetchAPI } from '../utils/api';

const generateToken = () => 'tok_' + Math.random().toString(36).slice(2, 10);

const generateDefaultTemplate = (mappings: { sheet_col: string; sys_field: string; custom_label?: string }[]) => {
  if (mappings.length === 0) {
    return 'Thông tin Khách hàng:\n- Họ Tên: {name}\n- Số Điện Thoại: {phone}';
  }

  let lines = ['Thông tin Khách hàng:'];
  const mappedSystemFields = Array.from(new Set(mappings.map(m => m.sys_field)));
  const order = ['name', 'phone', 'email', 'source', 'type', 'note'];

  order.forEach(field => {
    if (mappedSystemFields.includes(field)) {
      const fieldMapping = SYSTEM_FIELDS.find(f => f.value === field);
      const label = fieldMapping ? fieldMapping.label : field;
      lines.push(`- ${label}: {${field}}`);
    }
  });

  return lines.join('\n');
};

export const Integrations = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Connection | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  // Modal states
  const [showAddConn, setShowAddConn] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [newConnName, setNewConnName] = useState('Sheet1');
  const [newSpreadsheetId, setNewSpreadsheetId] = useState('');
  const [syncPreset, setSyncPreset] = useState<'5p' | '15p' | '1h' | '1d' | 'custom'>('15p');
  const [customSyncMins, setCustomSyncMins] = useState<number>(15);
  const [isSilent, setIsSilent] = useState(false);
  const [syncSaleperson, setSyncSaleperson] = useState(false);
  const [tempMappings, setTempMappings] = useState<{ sheet_col: string, sys_field: string, custom_label?: string }[]>([]);
  const [fetchedColumns, setFetchedColumns] = useState<string[]>([]);
  const [isFetchingColumns, setIsFetchingColumns] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [isFetchingSelectedCols, setIsFetchingSelectedCols] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState('Thông tin Khách hàng:\n- Tên KH: {name}\n- SĐT: {phone}\n- Bằng cấp: {degree}\n- Tiếng Anh: {english}');
  const [isSyncing, setIsSyncing] = useState(false);
  const [fetchedSheets, setFetchedSheets] = useState<string[]>([]);
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Pause warning modal
  const [showPauseWarning, setShowPauseWarning] = useState(false);

  // Mapping states
  const [newMappingCol, setNewMappingCol] = useState('');
  const [newMappingField, setNewMappingField] = useState('phone');
  const [newMappingCustomLabel, setNewMappingCustomLabel] = useState('');
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);

  // Landing Page API states
  const [showAddApi, setShowAddApi] = useState(false);
  const [newApiName, setNewApiName] = useState('Landing Page 1');

  // Edit Connection states
  const [showEditConn, setShowEditConn] = useState(false);
  const [editSyncPreset, setEditSyncPreset] = useState<'5p' | '15p' | '1h' | '1d' | 'custom'>('15p');
  const [editCustomSyncMins, setEditCustomSyncMins] = useState<number>(15);
  const [editSyncMode, setEditSyncMode] = useState<'all' | 'new_only'>('all');
  const [editIsSilent, setEditIsSilent] = useState(false);
  const [editSyncSaleperson, setEditSyncSaleperson] = useState(false);
  const [editEmailTemplate, setEditEmailTemplate] = useState('');

  const getSelectFields = () => {
    const isSyncActive = selected?.sync_saleperson || (showEditConn && editSyncSaleperson) || (showAddConn && syncSaleperson);
    if (isSyncActive) {
      return SYSTEM_FIELDS;
    }
    return SYSTEM_FIELDS.filter(f => f.value !== 'saleperson');
  };

  const fetchData = async () => {
    try {
      const [connRes, mapRes] = await Promise.all([
        fetchAPI('get_connections'),
        fetchAPI('get_mappings')
      ]);
      if (connRes.success && mapRes.success) {
        const conns = connRes.data.map((c: any) => ({
          ...c,
          is_active: Boolean(Number(c.is_active)),
          sync_interval: Number(c.sync_interval),
          connection_type: c.connection_type,
          is_silent: Boolean(Number(c.is_silent)),
          sync_saleperson: Boolean(Number(c.sync_saleperson)),
          mappings: mapRes.data.filter((m: any) => Number(m.connection_id) === Number(c.id))
        }));
        setConnections(conns);
        if (selected) {
          const updatedSelected = conns.find((c: any) => Number(c.id) === Number(selected.id));
          if (updatedSelected) setSelected(updatedSelected);
        } else if (conns.length > 0) {
          setSelected(conns[0]);
        }
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchSheetNames = async (id: string) => {
    setIsFetchingSheets(true);
    try {
      const json = await fetchAPI(`fetch_sheets&id=${id}`);
      if (json.success && json.sheets && json.sheets.length > 0) {
        setFetchedSheets(json.sheets);
        // Automatically select the first sheet if the current one isn't in the list
        if (!json.sheets.includes(newConnName)) {
          setNewConnName(json.sheets[0]);
        }
      } else {
        setFetchedSheets([]);
      }
    } catch (e) {
      console.error(e);
      setFetchedSheets([]);
    } finally {
      setIsFetchingSheets(false);
    }
  };

  const handleUrlChange = (val: string) => {
    setNewSpreadsheetId(val);
    const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
    let extractedId = val;
    if (match && match[1]) {
      extractedId = match[1];
      setNewSpreadsheetId(match[1]);
    }
    if (extractedId.length >= 40) {
      fetchSheetNames(extractedId);
    } else {
      setFetchedSheets([]);
    }
  };

  // Sync mode state
  const [syncMode, setSyncMode] = useState<'all' | 'new_only'>('all');

  const handleAddConnection = async () => {
    let finalInterval = 15;
    if (syncPreset === '5p') finalInterval = 5;
    if (syncPreset === '15p') finalInterval = 15;
    if (syncPreset === '1h') finalInterval = 60;
    if (syncPreset === '1d') finalInterval = 1440;
    if (syncPreset === 'custom') finalInterval = customSyncMins;

    const payload = {
      sheet_name: newConnName,
      spreadsheet_id: newSpreadsheetId,
      webhook_token: generateToken(),
      is_active: 1,
      sync_interval: finalInterval,
      sync_mode: isSilent ? 'all' : syncMode,
      is_silent: isSilent ? 1 : 0,
      sync_saleperson: syncSaleperson ? 1 : 0,
      email_template: emailTemplate
    };

    if (isSaving) return;
    setIsSaving(true);

    try {
      const json = await fetchAPI('add_connection', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        // Add mappings
        const connId = json.id;
        for (const m of tempMappings) {
          await fetchAPI('add_mapping', {
            method: 'POST',
            body: JSON.stringify({ connection_id: connId, sheet_column: m.sheet_col, system_field: m.sys_field, custom_label: m.custom_label })
          });
        }
        fetchData();
        toast.success('Đã thêm kết nối thành công');
        setNewConnName('Sheet1');
        setNewSpreadsheetId('');
        setSyncPreset('15p');
        setCustomSyncMins(15);
        setSyncMode('all');
        setIsSilent(false);
        setSyncSaleperson(false);
        setTempMappings([]);
        setAddStep(1);
        setShowAddConn(false);
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSaving(false);
  };

  const handleAddApiConnection = async () => {
    const payload = {
      sheet_name: newApiName,
      spreadsheet_id: '',
      webhook_token: generateToken(),
      is_active: 1,
      sync_interval: 0,
      connection_type: 'landing_page'
    };

    if (isSaving) return;
    setIsSaving(true);

    try {
      const json = await fetchAPI('add_connection', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        fetchData();
        toast.success('Đã tạo API Landing Page');
        setNewApiName('Landing Page 1');
        setShowAddApi(false);
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSaving(false);
  };

  const handleSaveEditConn = async () => {
    if (!selected) return;
    let finalInterval = 15;
    if (editSyncPreset === '5p') finalInterval = 5;
    if (editSyncPreset === '15p') finalInterval = 15;
    if (editSyncPreset === '1h') finalInterval = 60;
    if (editSyncPreset === '1d') finalInterval = 1440;
    if (editSyncPreset === 'custom') finalInterval = editCustomSyncMins;

    const payload = {
      id: selected.id,
      sheet_name: selected.sheet_name,
      spreadsheet_id: selected.spreadsheet_id,
      is_active: selected.is_active,
      sync_interval: finalInterval,
      require_both_contact: selected.require_both_contact,
      connection_type: selected.connection_type,
      sync_mode: editIsSilent ? 'all' : editSyncMode,
      is_silent: editIsSilent ? 1 : 0,
      sync_saleperson: editSyncSaleperson ? 1 : 0,
      email_template: editEmailTemplate
    };

    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetchAPI('edit_connection', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        toast.success('Đã cập nhật cấu hình đồng bộ');
        fetchData();
        setShowEditConn(false);
      } else {
        toast.error('Cập nhật thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    }
    setIsSaving(false);
  };

  const handleDeleteConnection = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      await fetchAPI(`delete_connection&id=${deleteId}`);
      toast.success('Đã xóa kết nối');
      fetchData();
      if (selected && Number(selected.id) === Number(deleteId)) setSelected(null);
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsDeleting(false);
    setDeleteId(null);
    setIsConfirmOpen(false);
  };
  const handleSaveMapping = async () => {
    if (!newMappingCol.trim() || !selected || isSavingMapping) return;
    setIsSavingMapping(true);
    try {
      const action = editingMappingId ? 'edit_mapping' : 'add_mapping';
      const payload = editingMappingId
        ? { id: editingMappingId, sheet_column: newMappingCol, system_field: newMappingField, custom_label: newMappingCustomLabel }
        : { connection_id: selected.id, sheet_column: newMappingCol, system_field: newMappingField, custom_label: newMappingCustomLabel };

      const json = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        fetchData();
        setNewMappingCol('');
        setNewMappingCustomLabel('');
        setEditingMappingId(null);
        toast.success(editingMappingId ? 'Đã cập nhật mapping' : 'Đã thêm mapping');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSavingMapping(false);
  };

  const cancelEditMapping = () => {
    setEditingMappingId(null);
    setNewMappingCol('');
    setNewMappingCustomLabel('');
    setNewMappingField('phone');
  };

  const handleDeleteMapping = async (mappingId: number) => {
    if (!selected) return;
    try {
      await fetchAPI(`delete_mapping&id=${mappingId}`);
      toast.success('Đã xóa mapping');
      fetchData();
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  // Actual API call to toggle the connection state
  const doToggleActive = async (conn: Connection) => {
    try {
      const newActive = !conn.is_active;
      const json = await fetchAPI(`toggle_connection&id=${conn.id}&active=${newActive ? 1 : 0}`);
      if (json.success) {
        toast.success(newActive ? 'Kết nối đã được bật lại' : 'Kết nối đã tạm dừng');
        fetchData();
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  // Toggle handler: show warning modal when pausing, toggle immediately when resuming
  const handleToggleActive = (conn: Connection) => {
    if (conn.is_active) {
      // Currently ON → about to PAUSE → show warning
      setShowPauseWarning(true);
    } else {
      // Currently OFF → about to RESUME → no warning needed
      doToggleActive(conn);
    }
  };

  const handleToggleRequireBoth = async (conn: any) => {
    try {
      const newRequire = conn.require_both_contact ? 0 : 1;
      const json = await fetchAPI(`toggle_require_both&id=${conn.id}&require=${newRequire}`);
      if (json.success) {
        toast.success(newRequire ? 'Đã bật yêu cầu Số Điện Thoại' : 'Đã tắt yêu cầu Số Điện Thoại');
        fetchData();
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  useEffect(() => {
    if (connections.length > 0 && !selected) {
      setSelected(connections[0]);
    }
  }, [connections]);

  useEffect(() => {
    if (selected) {
      const fetchSelectedColumns = async () => {
        setIsFetchingSelectedCols(true);
        try {
          const json = await fetchAPI(`fetch_columns&id=${selected.spreadsheet_id}&name=${encodeURIComponent(selected.sheet_name)}`);
          if (json.success && json.columns) {
            setSelectedColumns(json.columns);
            setNewMappingCol(json.columns[0] || '');
          } else {
            setSelectedColumns([]);
          }
        } catch (e) {
          setSelectedColumns([]);
        } finally {
          setIsFetchingSelectedCols(false);
        }
      };
      fetchSelectedColumns();
    } else {
      setSelectedColumns([]);
    }
  }, [selected]);

  const handleFetchColumns = async () => {
    if (!newSpreadsheetId) {
      toast.error('Vui lòng nhập ID Sheets');
      return;
    }
    setIsFetchingColumns(true);
    try {
      const json = await fetchAPI(`fetch_columns&id=${newSpreadsheetId}&name=${encodeURIComponent(newConnName)}`);
      if (json.success && json.columns && json.columns.length > 0) {
        setFetchedColumns(json.columns);
        setNewMappingCol(json.columns[0]);
        setAddStep(2);
      } else {
        toast.error(json.message || 'Không thể lấy được danh sách cột từ Google Sheet. Hãy chắc chắn bạn đã chia sẻ quyền "Người xem" cho Sheet.');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối: ' + e.message);
    } finally {
      setIsFetchingColumns(false);
    }
  };

  const webhookUrl = (token: string) => `${BASE_WEBHOOK}?token=${token}`;

  return (
    <>
      <div className="responsive-flex-row responsive-height-auto" style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 66px - 3rem)', minHeight: 0, animation: 'fadeIn 0.3s' }}>
        {/* LEFT PANEL: Sheet connections list */}
        <div className="responsive-filter-item" style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', marginBottom: 4 }}>Tích hợp Data</h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Quản lý các nguồn đổ Data</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setShowAddConn(true)} className="btn outline" style={{ width: '100%', justifyContent: 'center', height: 40, borderRadius: 10 }}>
              <FileSpreadsheet size={16} /> Thêm kết nối Sheets
            </button>
            <button onClick={() => setShowAddApi(true)} className="btn primary" style={{ width: '100%', justifyContent: 'center', height: 40, borderRadius: 10, background: 'var(--color-primary)' }}>
              <Zap size={16} /> Thêm API Landing Page
            </button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem' }}>
            {connections.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 12, border: '1px dashed var(--color-border)', margin: '1rem 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: 'var(--shadow-sm)' }}>
                  <Link2 size={24} color="var(--color-text-muted)" />
                </div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Chưa có tích hợp</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Thêm kết nối Sheets đầu tiên của bạn.</p>
              </div>
            ) : connections.map(conn => {
              const isSelected = selected && Number(selected.id) === Number(conn.id);
              return (
                <div
                  key={conn.id}
                  onClick={() => setSelected(conn)}
                  style={{
                    background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                    border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: 12, padding: '0.875rem 1rem', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', overflow: 'hidden'
                  }}
                >
                  {isSelected && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--color-primary)' }} />}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)'
                  }} title={conn.is_silent ? "Chỉ đồng bộ check trùng" : undefined}>
                    {conn.connection_type === 'landing_page' ? (
                      <Zap size={20} color={isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                    ) : conn.is_silent ? (
                      <Copy size={20} color="#eab308" style={{ opacity: isSelected ? 1 : 0.7 }} />
                    ) : (
                      <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" style={{ width: 20, height: 20, objectFit: 'contain', opacity: isSelected ? 1 : 0.6 }} alt="Google Sheets" />
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conn.sheet_name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {conn.connection_type === 'landing_page' ? 'Nhận Data qua API' : `${(conn.mappings || []).length} cột đã map`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: conn.is_active ? 'var(--color-success)' : 'var(--color-border)' }} />
                    <ChevronRight size={14} color="var(--color-text-muted)" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL: Selected sheet config */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Webhook size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Chọn một kết nối Sheets để cấu hình</p>
                <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>hoặc tạo kết nối mới ở cột trái</p>
              </div>
            </div>
          ) : (
            <>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }} title={selected.is_silent ? "Chỉ đồng bộ check trùng" : undefined}>
                      {selected.connection_type === 'landing_page' ? (
                        <Zap size={24} color="var(--color-primary)" />
                      ) : selected.is_silent ? (
                        <Copy size={24} color="#eab308" />
                      ) : (
                        <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" style={{ width: 24, height: 24, objectFit: 'contain' }} alt="Google Sheets" />
                      )}
                    </div>
                    <div>
                      {selected.spreadsheet_id ? (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${selected.spreadsheet_id}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Mở Google Sheets"
                          style={{
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--color-text)',
                            transition: 'color 0.2s ease',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#16a34a';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = 'var(--color-text)';
                          }}
                        >
                          <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            {selected.sheet_name}
                            <ExternalLink size={14} style={{ color: 'inherit' }} />
                          </h2>
                        </a>
                      ) : (
                        <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {selected.sheet_name}
                        </h2>
                      )}
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Token: <code style={{ fontFamily: 'monospace', background: 'var(--color-bg)', padding: '1px 6px', borderRadius: 4, fontSize: '0.75rem' }}>{selected.webhook_token}</code>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {selected.last_sync_at && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Lần cuối: {new Date(selected.last_sync_at).toLocaleString('vi-VN')}
                      </div>
                    )}
                    {selected.connection_type !== 'landing_page' && (
                      <button
                        className="btn outline"
                        style={{ padding: '6px 12px', fontSize: '0.8125rem', height: 32 }}
                        disabled={isSyncing}
                        onClick={async () => {
                          setIsSyncing(true);
                          try {
                            const res = await fetchAPI(`force_sync&id=${selected.id}`);
                            if (res.success) {
                              toast.success('Đã đồng bộ dữ liệu thủ công!');
                              fetchData(); // Refresh to update last_sync_at on screen
                            } else {
                              toast.error('Đồng bộ thất bại: ' + (res.message || ''));
                            }
                          } catch (e: any) {
                            toast.error('Lỗi kết nối: ' + e.message);
                          }
                          setIsSyncing(false);
                        }}
                      >
                        <RefreshCw size={14} className={isSyncing ? 'spin' : ''} /> {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                      </button>
                    )}

                    <button
                      className="btn outline"
                      style={{ padding: 8, borderRadius: 8, height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                      title="Chỉnh sửa cấu hình đồng bộ & email"
                      onClick={() => {
                        let preset: any = 'custom';
                        let customVal = selected.sync_interval;
                        if (customVal === 5) preset = '5p';
                        else if (customVal === 15) preset = '15p';
                        else if (customVal === 60) preset = '1h';
                        else if (customVal === 1440) preset = '1d';
                        
                        setEditSyncPreset(preset);
                        setEditCustomSyncMins(customVal || 15);
                        setEditSyncMode((selected.sync_mode as 'all' | 'new_only') || 'all');
                        setEditIsSilent(Boolean(Number(selected.is_silent)));
                        setEditSyncSaleperson(Boolean(Number(selected.sync_saleperson)));
                        const existingTemplate = selected.email_template || '';
                        setEditEmailTemplate(
                          existingTemplate ||
                          generateDefaultTemplate(
                            (selected.mappings || []).map(m => ({
                              sheet_col: m.sheet_column,
                              sys_field: m.system_field,
                              custom_label: m.custom_label
                            }))
                          )
                        );
                        setShowEditConn(true);
                      }}
                    >
                      <Settings size={16} />
                    </button>

                    <ToggleSwitch
                      checked={selected.is_active}
                      onChange={() => handleToggleActive(selected)}
                    />
                    <button
                      onClick={() => { setDeleteId(selected.id); setIsConfirmOpen(true); }}
                      style={{ padding: 8, borderRadius: 8, color: 'var(--color-text-muted)', transition: 'all 0.2s', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, width: 32, cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget.style.color = 'var(--color-danger)'); (e.currentTarget.style.background = 'var(--color-danger-light)'); }}
                      onMouseLeave={e => { (e.currentTarget.style.color = 'var(--color-text-muted)'); (e.currentTarget.style.background = 'transparent'); }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* STATS SECTION */}
                {selected.stats && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface)', padding: '6px 12px', borderRadius: 20, border: '1px solid var(--color-border)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <Target size={14} color="var(--color-text-muted)" /> {selected.stats.total} Tổng
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> {selected.stats.assigned} Đã chia
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <Copy size={14} /> {selected.stats.duplicate} Trùng
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <RefreshCw size={14} /> {selected.stats.reminder} Nhắc lại
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <AlertCircle size={14} /> {selected.stats.error} Lỗi
                    </div>
                  </div>
                )}

                {selected.spreadsheet_id && (
                  <div style={{ marginTop: '1rem', background: 'var(--color-success-light)', border: '1px solid var(--color-success)', borderRadius: 8, padding: '0.5rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }}></span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-success)', fontWeight: 600 }}>Cronjob Sync đang hoạt động với ID: {selected.spreadsheet_id}</span>
                  </div>
                )}

                <div style={{ marginTop: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Yêu cầu bắt buộc có Số Điện Thoại
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      Nếu bật, dòng dữ liệu trên Sheets phải có <strong>Số Điện Thoại (Phone)</strong> mới được đồng bộ vào hệ thống.
                    </p>
                  </div>
                  <div
                    onClick={() => handleToggleRequireBoth(selected)}
                    style={{
                      width: 44, height: 24, borderRadius: 24, cursor: 'pointer', position: 'relative',
                      background: selected.require_both_contact ? 'var(--color-success)' : 'var(--color-border)',
                      transition: 'background 0.3s'
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      position: 'absolute', top: 3, left: selected.require_both_contact ? 23 : 3,
                      transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>
              </div>

              {selected.connection_type === 'landing_page' ? (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={16} color="var(--color-primary)" /> Tích hợp API Landing Page
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        Nhúng đoạn mã sau vào Landing Page của bạn (HTML hoặc Script)
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.5 }}>
                      <strong>Cơ chế tự động gom Ghi chú:</strong>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                        <li>Hệ thống tự nhận các key chuẩn: <code>phone, email, name, source, type</code></li>
                        <li><strong>Tất cả các key khác</strong> (VD: <code>utm_campaign, chieu_cao</code>) sẽ tự động được gộp lại và lưu vào trường <strong>Ghi Chú (note)</strong>.</li>
                      </ul>
                    </div>
                  </div>

                  <div style={{ position: 'relative', background: '#1e293b', padding: '1rem', borderRadius: 8, overflowX: 'auto', border: '1px solid #334155' }}>
                    <button
                      onClick={() => {
                        const code = `// Gửi dữ liệu bằng JS fetch API (JSON)\nfetch("${webhookUrl(selected.webhook_token)}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    name: "Nguyễn Văn A",\n    phone: "0912345678",\n    email: "a@gmail.com",\n    source: "Landing_X",\n    tuoi: 25,\n    nhu_cau: "Tư vấn gấp"\n  })\n});`;
                        navigator.clipboard.writeText(code);
                        setCopiedId(selected.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      style={{ position: 'absolute', top: 8, right: 8, padding: '4px 8px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: 6, fontSize: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {copiedId === selected.id ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copiedId === selected.id ? 'Đã copy' : 'Copy Code'}
                    </button>
                    <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '0.8125rem', fontFamily: 'monospace', marginTop: 12 }}>
                      {`// Gửi dữ liệu bằng JS fetch API (JSON)
fetch("${webhookUrl(selected.webhook_token)}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Nguyễn Văn A",
    phone: "0912345678",
    email: "a@gmail.com",
    source: "Landing_X",
    tuoi: 25,
    nhu_cau: "Tư vấn gấp"
  })
});`}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Tag size={16} color="var(--color-primary)" /> Mapping Cột cho <em style={{ fontStyle: 'normal', color: 'var(--color-primary)' }}>{selected.sheet_name}</em>
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        Ánh xạ tên cột trên Google Sheets này sang trường dữ liệu của hệ thống
                      </p>
                    </div>
                  </div>

                  {/* Add Mapping Row at the TOP */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', background: 'var(--color-bg)', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label className="form-label" style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>Tên cột trên Sheets</label>
                      {isFetchingSelectedCols ? (
                        <div style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-border)' }}>
                          <RefreshCw size={14} className="spin" /> Đang quét cột...
                        </div>
                      ) : selectedColumns.length > 0 ? (
                        <CustomSelect
                          options={selectedColumns.map(c => ({ value: c, label: c }))}
                          value={newMappingCol}
                          onChange={v => setNewMappingCol(String(v))}
                        />
                      ) : (
                        <input
                          className="form-input"
                          placeholder="VD: Số Điện Thoại KH"
                          value={newMappingCol}
                          onChange={e => setNewMappingCol(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveMapping()}
                        />
                      )}
                    </div>
                    <div style={{ flex: '1 1 180px' }}>
                      <label className="form-label" style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>Trường hệ thống</label>
                      <CustomSelect
                        options={getSelectFields()}
                        value={newMappingField}
                        onChange={(val) => setNewMappingField(String(val))}
                      />
                    </div>
                    <div style={{ flex: '1 1 220px' }}>
                      <label className="form-label" style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>Tên hiển thị trong Email (Tùy chọn)</label>
                      <input
                        className="form-input"
                        placeholder="VD: Khung giờ tư vấn"
                        value={newMappingCustomLabel}
                        onChange={e => setNewMappingCustomLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveMapping()}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <button className="btn primary" onClick={handleSaveMapping} disabled={isSavingMapping} style={{ flexShrink: 0, height: 42, background: editingMappingId ? 'var(--color-warning)' : 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                        {isSavingMapping ? 'Đang lưu...' : (editingMappingId ? 'Cập nhật' : <><Plus size={16} /> Thêm</>)}
                      </button>
                      {editingMappingId && (
                        <button className="btn outline" onClick={cancelEditMapping} style={{ flexShrink: 0, height: 42, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, padding: '0 0.75rem' }}>
                          Hủy
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.5 }}>
                      <strong>Mẹo cấu hình:</strong> Bạn có thể map <strong>nhiều cột trên Sheets</strong> vào <strong>cùng 1 trường hệ thống</strong> (ví dụ: Nguồn Data = Cột UTM Source + Cột Campaign, hoặc Ghi Chú = Sở thích + Khung giờ). Hệ thống sẽ tự động gộp dữ liệu lại cho bạn!
                    </p>
                  </div>

                  {/* Mappings Table BELOW */}
                  <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                    <table style={{ tableLayout: 'fixed', width: '100%' }}>
                      <colgroup>
                        <col style={{ width: '45%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '8%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Tên cột trên Google Sheets</th>
                          <th>Trường hiển thị trong Email</th>
                          <th>Trường hệ thống</th>
                          <th style={{ width: 60 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.mappings || []).map(m => (
                          <tr key={m.id}>
                            <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span
                                title={m.sheet_column}
                                style={{
                                  fontFamily: 'monospace',
                                  background: 'var(--color-bg)',
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  fontSize: '0.875rem',
                                  border: '1px solid var(--color-border)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: 'inline-block',
                                  maxWidth: '100%',
                                  verticalAlign: 'middle'
                                }}
                              >
                                {m.sheet_column}
                              </span>
                            </td>
                            <td>
                              {m.custom_label ? (
                                <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600 }}>
                                  {m.custom_label}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>
                                  Để mặc định (Tên cột)
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '4px 10px', borderRadius: 6, fontSize: '0.875rem', fontWeight: 700 }}>
                                {SYSTEM_FIELDS.find(f => f.value === m.system_field)?.label || m.system_field}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button
                                onClick={() => {
                                  setEditingMappingId(m.id);
                                  setNewMappingCol(m.sheet_column);
                                  setNewMappingField(m.system_field);
                                  setNewMappingCustomLabel(m.custom_label || '');
                                }}
                                title="Chỉnh sửa mapping"
                                style={{ padding: 6, borderRadius: 8, color: 'var(--color-text-muted)', transition: 'all 0.2s', background: editingMappingId === m.id ? 'var(--color-warning-light)' : 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget.style.color = 'var(--color-warning)'); (e.currentTarget.style.background = 'var(--color-warning-light)'); }}
                                onMouseLeave={e => { (e.currentTarget.style.color = 'var(--color-text-muted)'); (e.currentTarget.style.background = editingMappingId === m.id ? 'var(--color-warning-light)' : 'transparent'); }}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteMapping(m.id)}
                                title="Xóa mapping"
                                style={{ padding: 6, borderRadius: 8, color: 'var(--color-text-muted)', transition: 'all 0.2s' }}
                                onMouseEnter={e => { (e.currentTarget.style.color = 'var(--color-danger)'); (e.currentTarget.style.background = 'var(--color-danger-light)'); }}
                                onMouseLeave={e => { (e.currentTarget.style.color = 'var(--color-text-muted)'); (e.currentTarget.style.background = 'transparent'); }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(selected.mappings || []).length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                              Chưa có mapping nào. Hãy thêm cột ở trên.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>

      <CustomModal
        isOpen={showAddConn}
        onClose={() => { setShowAddConn(false); setAddStep(1); }}
        title="Kết nối Google Sheets"
        width="700px"
      >
        <div style={{ padding: '1.5rem', background: 'white' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 1, background: '#e2e8f0', zIndex: 0 }}></div>
            {[1, 2, 3].map(step => (
              <div key={step} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: addStep >= step ? 'var(--color-primary)' : '#f8fafc',
                color: addStep >= step ? 'white' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.875rem', position: 'relative', zIndex: 1,
                border: addStep >= step ? 'none' : '1px solid #e2e8f0'
              }}>
                {step}
              </div>
            ))}
          </div>

          {addStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Cấu hình Google Sheets <div style={{ background: 'var(--color-primary)', color: 'white', padding: '2px 6px', borderRadius: 6, fontSize: '0.75rem' }}><FileSpreadsheet size={14} /></div>
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>Kết nối bảng tính của bạn để tự động nạp dữ liệu Khách hàng.</p>
              </div>

              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '1rem 1.25rem', color: '#0369a1', fontSize: '0.875rem' }}>
                <p style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><Info size={16} /> Hướng dẫn nhanh:</p>
                <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.6 }}>
                  <li>Bấm nút <strong>Chia sẻ (Share)</strong> trên file Google Sheets.</li>
                  <li>Tại phần <strong>Quyền truy cập chung</strong>, chọn <strong>Bất kỳ ai có liên kết</strong> và đặt quyền là <strong>Người xem</strong>.</li>
                  <li>Copy <strong>Spreadsheet ID</strong> từ URL trình duyệt (chuỗi ký tự nằm giữa d/ và /edit).</li>
                </ol>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Đường dẫn Google Sheet (hoặc ID)</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 10, left: 12, color: '#94a3b8' }}><Link2 size={16} /></div>
                  <input
                    className="form-input"
                    style={{ paddingLeft: 36, background: '#f8fafc', border: 'none' }}
                    placeholder="Dán link hoặc Spreadsheet ID vào đây..."
                    value={newSpreadsheetId}
                    onChange={e => handleUrlChange(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Tên trang tính (Sheet Name)</label>
                {isFetchingSheets ? (
                  <div style={{ padding: '10px 12px', background: '#f1f5f9', borderRadius: 8, fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={16} className="spin" /> Đang quét danh sách các Sheet...
                  </div>
                ) : fetchedSheets.length > 0 ? (
                  <CustomSelect
                    options={fetchedSheets.map(s => ({ value: s, label: s }))}
                    value={newConnName}
                    onChange={v => setNewConnName(String(v))}
                  />
                ) : (
                  <div>
                    <input
                      className="form-input"
                      style={{ background: '#f8fafc', border: 'none', fontWeight: 600, color: '#0f172a' }}
                      placeholder="VD: Sheet1"
                      value={newConnName}
                      onChange={e => setNewConnName(e.target.value)}
                    />
                    {newSpreadsheetId.length >= 40 && (
                      <p style={{ fontSize: '0.75rem', color: '#eab308', marginTop: 4 }}>
                        💡 Không quét được tự động. Vui lòng chia sẻ quyền "Người xem" cho Sheet để quét được danh sách trang tính.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Chỉ đồng bộ check trùng */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>Chỉ đồng bộ check trùng (Không chia số)</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Nếu bật, dữ liệu sẽ chỉ lưu vào CRM làm căn cứ lọc trùng, tuyệt đối không phân phối cho Sale và không thông báo.</div>
                </div>
                <ToggleSwitch
                  checked={isSilent}
                  onChange={(val) => {
                    setIsSilent(val);
                    if (!val) setSyncSaleperson(false);
                  }}
                />
              </div>

              {isSilent && (
                <>
                  <div style={{ background: '#f0fdf4', border: '1px dashed #bbf7d0', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s ease-in-out' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.875rem' }}>Đồng bộ Salesperson & Báo trùng</div>
                      <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: 4 }}>Tìm và gắn Sale phụ trách (theo email). Nếu trùng khớp với Sale đang có trong CRM, hệ thống sẽ gửi thông báo báo trùng cho Sale.</div>
                    </div>
                    <ToggleSwitch
                      checked={syncSaleperson}
                      onChange={setSyncSaleperson}
                    />
                  </div>
                  {syncSaleperson && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem', borderRadius: 12, marginTop: '-0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Info size={14} color="#3b82f6" /> Hướng dẫn cấu hình:
                      </div>
                      Vui lòng tiến hành <strong>Cấu hình trường (Mapping)</strong> ở Bước kế tiếp: Map cột chứa Email (hoặc Tên) của Sale trên Google Sheets với trường hệ thống <strong>"Salesperson (Tên/Email Sale)"</strong> để kích hoạt tính năng này.
                    </div>
                  )}
                </>
              )}

              {!isSilent && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, margin: 0 }}>Chu kỳ đồng bộ</label>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer' }}>(?) Cơ chế hoạt động?</span>
                  </div>

                  <div className="responsive-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {[
                      { id: '5p', icon: <Zap size={20} />, time: '5p', label: 'NHANH' },
                      { id: '15p', icon: <Clock size={20} />, time: '15p', label: 'CHUẨN' },
                      { id: '1h', icon: <Clock size={20} />, time: '1h', label: 'ỔN ĐỊNH' },
                      { id: '1d', icon: <Target size={20} />, time: '1 ngày', label: 'TIẾT KIỆM' },
                      { id: 'custom', icon: <Plus size={20} />, time: 'Khác', label: 'TÙY CHỈNH' }
                    ].map(preset => (
                      <div
                        key={preset.id}
                        onClick={() => setSyncPreset(preset.id as any)}
                        style={{
                          border: syncPreset === preset.id ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
                          background: syncPreset === preset.id ? 'var(--color-primary-light)' : '#ffffff',
                          borderRadius: 12, padding: '0.75rem 0', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          transition: 'all 0.2s', opacity: syncPreset === preset.id ? 1 : 0.6
                        }}
                      >
                        <div style={{ color: syncPreset === preset.id ? 'var(--color-primary)' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{preset.icon}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: syncPreset === preset.id ? 'var(--color-primary)' : '#64748b' }}>{preset.time}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: syncPreset === preset.id ? 'var(--color-primary-hover)' : '#94a3b8' }}>{preset.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isSilent && syncPreset === 'custom' && (
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ width: 140 }}>
                    <label className="form-label" style={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Số phút tùy chỉnh</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number" min={1} className="form-input"
                        value={customSyncMins} onChange={e => setCustomSyncMins(Number(e.target.value))}
                        style={{ border: 'none', fontWeight: 700, fontSize: '1rem' }}
                      />
                      <span style={{ position: 'absolute', right: 12, top: 10, color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>phút</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                    Lưu ý: Thời gian quá ngắn (dưới 5 phút) có thể khiến Google giới hạn băng thông.
                  </div>
                </div>
              )}

              {!isSilent && (
                <div style={{ marginTop: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                  <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, marginBottom: '0.5rem', display: 'block' }}>Chế độ quét dữ liệu</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="sync_mode"
                        checked={syncMode === 'all'}
                        onChange={() => setSyncMode('all')}
                        style={{ marginTop: 2, accentColor: 'var(--color-primary)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>Quét toàn bộ Data hiện có</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>Hút toàn bộ dữ liệu đang có sẵn trên Sheets vào CRM (Mặc định).</div>
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="sync_mode"
                        checked={syncMode === 'new_only'}
                        onChange={() => setSyncMode('new_only')}
                        style={{ marginTop: 2, accentColor: 'var(--color-primary)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>Chỉ quét Data mới (Bỏ qua Data cũ)</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>Hệ thống sẽ chạy ngầm đánh dấu bỏ qua toàn bộ dòng cũ. Chỉ những dòng được thêm vào SAU KHI kết nối mới được hút vào CRM.</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div style={{ position: 'sticky', bottom: '-24px', background: 'white', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', paddingBottom: '1rem', borderTop: '1px solid #f1f5f9', marginLeft: '-24px', marginRight: '-24px', paddingLeft: '24px', paddingRight: '24px' }}>
                <span onClick={() => setShowAddConn(false)} style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Quay lại</span>
                <button
                  className="btn"
                  onClick={handleFetchColumns}
                  disabled={isFetchingColumns}
                  style={{ background: 'var(--color-primary)', color: 'white', fontWeight: 700, padding: '0.75rem 1.5rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {isFetchingColumns ? <RefreshCw size={16} className="spin" /> : null}
                  {isFetchingColumns ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {addStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Cấu hình Trường dữ liệu</h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>Ánh xạ các cột trên Google Sheets của bạn vào hệ thống Domation DATA.</p>
              </div>

              {/* Add Mapping Row at the TOP */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Cột trên Sheets</label>
                  {fetchedColumns.length > 0 ? (
                    <CustomSelect
                      options={fetchedColumns.map(c => ({ value: c, label: c }))}
                      value={newMappingCol}
                      onChange={v => setNewMappingCol(String(v))}
                    />
                  ) : (
                    <input className="form-input" style={{ border: '1px solid #cbd5e1' }} value={newMappingCol} onChange={e => setNewMappingCol(e.target.value)} placeholder="VD: Nguồn KH" />
                  )}
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Trường hệ thống</label>
                  <CustomSelect options={getSelectFields()} value={newMappingField} onChange={v => setNewMappingField(String(v))} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Tên hiển thị trong Email (Tùy chọn)</label>
                  <input
                    className="form-input"
                    style={{ border: '1px solid #cbd5e1', height: 38 }}
                    placeholder="VD: Khung giờ tư vấn"
                    value={newMappingCustomLabel}
                    onChange={e => setNewMappingCustomLabel(e.target.value)}
                  />
                </div>
                <button onClick={() => { if (newMappingCol) { setTempMappings([...tempMappings, { sheet_col: newMappingCol, sys_field: newMappingField, custom_label: newMappingCustomLabel }]); setNewMappingCustomLabel(''); } }} className="btn" style={{ background: 'var(--color-primary)', color: 'white', height: 38, padding: '0 1rem', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <Plus size={16} /> Thêm
                </button>
              </div>

              {/* Mappings Table BELOW */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }} className="responsive-table-wrap">
                <div className="responsive-mapping-header" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 40px', background: '#f8fafc', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                  <div>Tên cột trên Sheets</div>
                  <div>Trường hiển thị trong Email</div>
                  <div>Trường hệ thống</div>
                  <div></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {tempMappings.map((m, idx) => (
                    <div key={idx} className="responsive-mapping-row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 40px', padding: '0.75rem 1rem', borderBottom: idx < tempMappings.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
                      <div
                        title={m.sheet_col}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: '#0f172a',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          paddingRight: '10px'
                        }}
                      >
                        {m.sheet_col}
                      </div>
                      <div>
                        {m.custom_label ? (
                          <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                            {m.custom_label}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>Mặc định</span>
                        )}
                      </div>
                      <div style={{ color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 700 }}>{SYSTEM_FIELDS.find(f => f.value === m.sys_field)?.label || m.sys_field}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => setTempMappings(tempMappings.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: '#fef2f2', border: 'none', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {tempMappings.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                      Chưa có mapping nào. Hãy thêm cột ở trên.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ position: 'sticky', bottom: '-24px', background: 'white', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', paddingBottom: '1rem', borderTop: '1px solid #f1f5f9', marginLeft: '-24px', marginRight: '-24px', paddingLeft: '24px', paddingRight: '24px' }}>
                <span onClick={() => setAddStep(1)} style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Quay lại</span>
                <button className="btn" onClick={() => { setEmailTemplate(generateDefaultTemplate(tempMappings)); setAddStep(3); }} style={{ background: 'var(--color-primary)', color: 'white', fontWeight: 700, padding: '0.75rem 1.5rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Tiếp tục thiết lập Email <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {addStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Thiết lập Mẫu Email giao Data</h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>Cấu hình nội dung thông tin Khách hàng sẽ được gửi cho Sale khi có Data mới.</p>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Mẫu nội dung (Hỗ trợ biến)</label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    className="form-input"
                    style={{ minHeight: 150, background: '#f8fafc', border: '1px solid #cbd5e1', lineHeight: 1.6, fontFamily: 'monospace', fontSize: '0.875rem' }}
                    value={emailTemplate}
                    onChange={e => setEmailTemplate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {getSelectFields().map(f => (
                    <span key={f.value} onClick={() => setEmailTemplate(emailTemplate + `\n${f.label}: {${f.value}}`)} style={{ cursor: 'pointer', background: '#f1f5f9', color: '#0f172a', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                      {'{'}{f.value}{'}'}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ position: 'sticky', bottom: '-24px', background: 'white', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', paddingBottom: '1rem', borderTop: '1px solid #f1f5f9', marginLeft: '-24px', marginRight: '-24px', paddingLeft: '24px', paddingRight: '24px' }}>
                <span onClick={() => setAddStep(2)} style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Quay lại</span>
                <button className="btn" onClick={handleAddConnection} style={{ background: 'var(--color-primary)', color: 'white', fontWeight: 700, padding: '0.75rem 1.5rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Hoàn tất kết nối <CheckCircle2 size={16} />
                </button>
              </div>
            </div>
          )}

        </div>
      </CustomModal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDeleteConnection}
        title="Xóa Kết Nối Sheets"
        message="Bạn có chắc chắn muốn xóa kết nối Sheets này? Toàn bộ Mapping sẽ bị xóa vĩnh viễn và không thể phục hồi."
      />

      <ConfirmModal
        isOpen={showPauseWarning}
        onClose={() => setShowPauseWarning(false)}
        onConfirm={() => selected && doToggleActive(selected)}
        title="⏸ Tạm dừng kết nối?"
        message={`Khi tạm dừng kết nối "${selected?.sheet_name}":\n\n• Webhook sẽ ngừng nhận dữ liệu mới từ Google Sheets.\n• Cronjob đồng bộ tự động sẽ dừng hoàn toàn.\n• Dữ liệu hiện có sẽ được giữ nguyên.\n\nBạn có thể bật lại bất cứ lúc nào.`}
        confirmText="Tạm dừng"
        cancelText="Hủy bỏ"
      />

      <CustomModal
        isOpen={showEditConn}
        onClose={() => setShowEditConn(false)}
        title={selected?.connection_type === 'landing_page' ? "Chỉnh sửa cấu hình Landing Page" : "Chỉnh sửa cấu hình đồng bộ"}
        width="600px"
      >
        <div style={{ padding: '1.5rem', background: 'white' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                {selected?.connection_type === 'landing_page' ? 'Cấu hình Landing Page' : 'Cấu hình chu kỳ đồng bộ'}
                <div style={{ background: 'var(--color-primary)', color: 'white', width: 22, height: 22, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected?.connection_type === 'landing_page' ? <Zap size={14} /> : <Clock size={14} />}
                </div>
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>
                {selected?.connection_type === 'landing_page'
                  ? `Thay đổi cấu hình nhận dữ liệu và email cho ${selected?.sheet_name || 'Landing Page'}.`
                  : `Thay đổi thời gian hệ thống tự động tải dữ liệu từ ${selected?.sheet_name || 'Sheets'}.`}
              </p>
            </div>

            {/* Chỉ đồng bộ check trùng */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>Chỉ đồng bộ check trùng (Không chia số)</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Nếu bật, dữ liệu sẽ chỉ lưu vào CRM làm căn cứ lọc trùng, tuyệt đối không phân phối cho Sale và không thông báo.</div>
              </div>
              <ToggleSwitch
                checked={editIsSilent}
                onChange={(val) => {
                  setEditIsSilent(val);
                  if (!val) setEditSyncSaleperson(false);
                }}
              />
            </div>

            {editIsSilent && (
              <>
                <div style={{ background: '#f0fdf4', border: '1px dashed #bbf7d0', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', transition: 'all 0.3s ease-in-out' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.875rem' }}>Đồng bộ Salesperson & Báo trùng</div>
                    <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: 4 }}>Tìm và gắn Sale phụ trách (theo email). Nếu trùng khớp với Sale đang có trong CRM, hệ thống sẽ gửi thông báo báo trùng cho Sale.</div>
                  </div>
                  <ToggleSwitch
                    checked={editSyncSaleperson}
                    onChange={setEditSyncSaleperson}
                  />
                </div>
                {editSyncSaleperson && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem', borderRadius: 12, marginTop: '-0.5rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Info size={14} color="#3b82f6" /> Hướng dẫn cấu hình:
                    </div>
                    Hãy đảm bảo đã vào mục <strong>Cấu hình trường (Mapping)</strong> ở bảng chi tiết ngoài màn hình chính để map cột tương ứng với trường hệ thống <strong>"Salesperson (Tên/Email Sale)"</strong>.
                  </div>
                )}
              </>
            )}

            {selected?.connection_type !== 'landing_page' && !editIsSilent && (
              <>
                {/* Chu kỳ đồng bộ */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, margin: 0 }}>Chu kỳ đồng bộ</label>
                  </div>

                  <div className="responsive-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {[
                      { id: '5p', icon: <Zap size={20} />, time: '5p', label: 'NHANH' },
                      { id: '15p', icon: <Clock size={20} />, time: '15p', label: 'CHUẨN' },
                      { id: '1h', icon: <Clock size={20} />, time: '1h', label: 'ỔN ĐỊNH' },
                      { id: '1d', icon: <Target size={20} />, time: '1 ngày', label: 'TIẾT KIỆM' },
                      { id: 'custom', icon: <Plus size={20} />, time: 'Khác', label: 'TÙY CHỈNH' }
                    ].map(preset => (
                      <div
                        key={preset.id}
                        onClick={() => setEditSyncPreset(preset.id as any)}
                        style={{
                          border: editSyncPreset === preset.id ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
                          background: editSyncPreset === preset.id ? 'var(--color-primary-light)' : '#ffffff',
                          borderRadius: 12, padding: '0.75rem 0', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          transition: 'all 0.2s', opacity: editSyncPreset === preset.id ? 1 : 0.6
                        }}
                      >
                        <div style={{ color: editSyncPreset === preset.id ? 'var(--color-primary)' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{preset.icon}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: editSyncPreset === preset.id ? 'var(--color-primary)' : '#64748b' }}>{preset.time}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: editSyncPreset === preset.id ? 'var(--color-primary-hover)' : '#94a3b8' }}>{preset.label}</div>
                      </div>
                    ))}
                  </div>

                  {editSyncPreset === 'custom' && (
                    <div style={{ marginTop: 12, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Nhập số phút tùy chỉnh:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: 100 }}
                          min={1}
                          max={10080}
                          value={editCustomSyncMins}
                          onChange={e => setEditCustomSyncMins(Number(e.target.value))}
                        />
                        <span style={{ fontSize: '0.875rem', color: '#64748b' }}>phút</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chế độ đồng bộ */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, margin: 0 }}>Chế độ đồng bộ</label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div
                      onClick={() => setEditSyncMode('all')}
                      style={{
                        border: editSyncMode === 'all' ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
                        background: editSyncMode === 'all' ? 'var(--color-primary-light)' : '#ffffff',
                        borderRadius: 12, padding: '1rem', cursor: 'pointer',
                        display: 'flex', gap: 12, transition: 'all 0.2s', opacity: editSyncMode === 'all' ? 1 : 0.6
                      }}
                    >
                      <div style={{ color: editSyncMode === 'all' ? 'var(--color-primary)' : '#94a3b8', marginTop: 2 }}><RefreshCw size={20} /></div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: editSyncMode === 'all' ? 'var(--color-primary)' : '#0f172a' }}>Tất cả dữ liệu</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>Phân luồng từ dòng 1 đến cuối. (Phù hợp File mới hoàn toàn)</div>
                      </div>
                    </div>

                    <div
                      onClick={() => setEditSyncMode('new_only')}
                      style={{
                        border: editSyncMode === 'new_only' ? '2px solid var(--color-warning)' : '1px solid #e2e8f0',
                        background: editSyncMode === 'new_only' ? 'var(--color-warning-light)' : '#ffffff',
                        borderRadius: 12, padding: '1rem', cursor: 'pointer',
                        display: 'flex', gap: 12, transition: 'all 0.2s', opacity: editSyncMode === 'new_only' ? 1 : 0.6
                      }}
                    >
                      <div style={{ color: editSyncMode === 'new_only' ? 'var(--color-warning)' : '#94a3b8', marginTop: 2 }}><Zap size={20} /></div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: editSyncMode === 'new_only' ? 'var(--color-warning-dark)' : '#0f172a' }}>Chỉ dữ liệu mới</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>Bỏ qua các dòng đã có. Chỉ phân luồng dòng mới phát sinh từ thời điểm bật.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Mẫu nội dung Email */}
            <div>
              <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Mẫu nội dung Email (Hỗ trợ biến)</label>
              <div style={{ position: 'relative' }}>
                <textarea
                  className="form-input"
                  rows={6}
                  style={{ minHeight: 120, background: '#f8fafc', border: '1px solid #cbd5e1', lineHeight: 1.6, fontFamily: 'monospace', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
                  placeholder={"Nhập mẫu email. Ví dụ:\nThông tin khách hàng:\n- Họ tên: {name}\n- Điện thoại: {phone}"}
                  value={editEmailTemplate}
                  onChange={e => setEditEmailTemplate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {getSelectFields().map(f => (
                  <span
                    key={f.value}
                    onClick={() => setEditEmailTemplate(editEmailTemplate + (editEmailTemplate && !editEmailTemplate.endsWith('\n') ? '\n' : '') + `${f.label}: {${f.value}}`)}
                    style={{ cursor: 'pointer', background: '#f1f5f9', color: '#0f172a', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, border: '1px solid #e2e8f0' }}
                  >
                    {'{'}{f.value}{'}'}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
              <button className="btn outline" onClick={() => setShowEditConn(false)} style={{ padding: '0.5rem 1.25rem' }}>Hủy bỏ</button>
              <button className="btn primary" onClick={handleSaveEditConn} disabled={isSaving} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {isSaving ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />} Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={showAddApi}
        onClose={() => setShowAddApi(false)}
        title="Tạo API Landing Page"
        width="500px"
      >
        <div style={{ padding: '1.5rem', background: 'white' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                Kết nối Landing Page <div style={{ background: 'var(--color-primary)', color: 'white', padding: '2px 6px', borderRadius: 6, fontSize: '0.75rem' }}><Zap size={14} /></div>
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>
                Tạo một Endpoint (Đường dẫn API) để gắn vào trang đích của bạn.
              </p>
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Tên kết nối</label>
              <input
                className="form-input"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, color: '#0f172a' }}
                placeholder="VD: Landing Page Bất Động Sản"
                value={newApiName}
                onChange={e => setNewApiName(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn outline" onClick={() => setShowAddApi(false)}>Hủy</button>
          <button className="btn primary" onClick={handleAddApiConnection} disabled={isSaving || !newApiName.trim()} style={{ background: 'var(--color-primary)', border: 'none' }}>
            {isSaving ? 'Đang tạo...' : 'Tạo API Endpoint'}
          </button>
        </div>
      </CustomModal>
    </>
  );
};
