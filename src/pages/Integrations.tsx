import React, { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Copy, CheckCircle2, ChevronRight, Link2, Tag, Info, FileSpreadsheet, Zap, Clock, Target, RefreshCw, Edit2 } from 'lucide-react';
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
];

const BASE_WEBHOOK = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/webhook.php` : "https://open.domation.net/sale_data/webhook.php";

type Connection = {
  id: number;
  sheet_name: string;
  spreadsheet_id?: string;
  webhook_token: string;
  is_active: boolean;
  sync_interval?: number;
  mappings?: Mapping[];
  require_both_contact?: number | boolean;
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

const generateDefaultTemplate = (mappings: {sheet_col: string; sys_field: string; custom_label?: string}[]) => {
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
  
  // Modal states
  const [showAddConn, setShowAddConn] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [newConnName, setNewConnName] = useState('Sheet1');
  const [newSpreadsheetId, setNewSpreadsheetId] = useState('');
  const [syncPreset, setSyncPreset] = useState<'5p' | '15p' | '1h' | '1d' | 'custom'>('15p');
  const [customSyncMins, setCustomSyncMins] = useState<number>(15);
  const [tempMappings, setTempMappings] = useState<{sheet_col: string, sys_field: string, custom_label?: string}[]>([]);
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

  // Mapping states
  const [newMappingCol, setNewMappingCol] = useState('');
  const [newMappingField, setNewMappingField] = useState('phone');
  const [newMappingCustomLabel, setNewMappingCustomLabel] = useState('');
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);

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
          mappings: mapRes.data.filter((m: any) => m.connection_id === c.id)
        }));
        setConnections(conns);
        if (selected) {
          const updatedSelected = conns.find((c: any) => c.id === selected.id);
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

  const handleCopyWebhook = (conn: Connection) => {
    navigator.clipboard.writeText(`${BASE_WEBHOOK}?token=${conn.webhook_token}`);
    setCopiedId(conn.id);
    toast.success('Đã copy đường dẫn Webhook');
    setTimeout(() => setCopiedId(null), 2000);
  };

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
      sync_interval: finalInterval
    };
    
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
        setTempMappings([]);
        setAddStep(1);
        setShowAddConn(false);
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleDeleteConnection = async () => {
    if (!deleteId) return;
    try {
      await fetchAPI(`delete_connection&id=${deleteId}`);
      toast.success('Đã xóa kết nối');
      fetchData();
      if (selected?.id === deleteId) setSelected(null);
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setDeleteId(null);
    setIsConfirmOpen(false);
  };
  const handleSaveMapping = async () => {
    if (!newMappingCol.trim() || !selected) return;
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

  const handleToggleActive = async (e: React.MouseEvent, conn: Connection) => {
    e.stopPropagation();
    try {
        const newActive = !conn.is_active;
        const json = await fetchAPI(`toggle_connection&id=${conn.id}&active=${newActive ? 1 : 0}`);
        if (json.success) {
            toast.success(newActive ? 'Đã bật kết nối' : 'Đã tắt kết nối');
            fetchData();
        }
    } catch (e: any) {
        toast.error('Lỗi: ' + e.message);
    }
  };

  const handleToggleRequireBoth = async (conn: any) => {
    try {
        const newRequire = conn.require_both_contact ? 0 : 1;
        const json = await fetchAPI(`toggle_require_both&id=${conn.id}&require=${newRequire}`);
        if (json.success) {
            toast.success(newRequire ? 'Đã bật yêu cầu đủ SĐT và Email' : 'Đã tắt yêu cầu đủ SĐT và Email');
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
      <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 66px - 3rem)', minHeight: 0, animation: 'fadeIn 0.3s' }}>
        {/* LEFT PANEL: Sheet connections list */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', marginBottom: 4 }}>Tích hợp Sheets</h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Kết nối Google Sheets</p>
        </div>

        <button onClick={() => setShowAddConn(true)} className="btn primary" style={{ width: '100%', justifyContent: 'center', height: 44, borderRadius: 10, background: 'var(--color-primary)' }}>
          <Plus size={16} /> Thêm kết nối Sheets
        </button>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem' }}>
          {connections.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 12, border: '1px dashed var(--color-border)', margin: '1rem 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: 'var(--shadow-sm)' }}>
                <Link2 size={24} color="var(--color-text-muted)" />
              </div>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Chưa có tích hợp</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Thêm kết nối Sheets đầu tiên của bạn.</p>
            </div>
          ) : connections.map(conn => (
            <div
              key={conn.id}
              onClick={() => setSelected(conn)}
              style={{
                background: selected?.id === conn.id ? 'var(--color-primary-light)' : 'var(--color-surface)',
                border: `1px solid ${selected?.id === conn.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 12, padding: '0.875rem 1rem', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', overflow: 'hidden'
              }}
            >
              {selected?.id === conn.id && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--color-primary)' }} />}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: selected?.id === conn.id ? 'var(--color-primary)' : 'var(--color-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
              }}>
                <Link2 size={16} color={selected?.id === conn.id ? 'white' : 'var(--color-text-light)'} />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {conn.sheet_name}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {(conn.mappings || []).length} cột đã map
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: conn.is_active ? 'var(--color-success)' : 'var(--color-border)' }} />
                <ChevronRight size={14} color="var(--color-text-muted)" />
              </div>
            </div>
          ))}
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
                    width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--color-primary), #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Webhook size={22} color="white" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text)' }}>{selected.sheet_name}</h2>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      Token: <code style={{ fontFamily: 'monospace', background: 'var(--color-bg)', padding: '1px 6px', borderRadius: 4, fontSize: '0.75rem' }}>{selected.webhook_token}</code>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn outline"
                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                    disabled={isSyncing}
                    onClick={async () => {
                      setIsSyncing(true);
                      try {
                        const res = await fetchAPI(`force_sync&id=${selected.id}`);
                        if (res.success) toast.success('Đã đồng bộ dữ liệu thủ công!');
                        else toast.error('Đồng bộ thất bại: ' + (res.message || ''));
                      } catch (e: any) {
                        toast.error('Lỗi kết nối: ' + e.message);
                      }
                      setIsSyncing(false);
                    }}
                  >
                    <RefreshCw size={14} className={isSyncing ? 'spin' : ''} /> {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                  </button>

                  <ToggleSwitch 
                    checked={selected.is_active} 
                    onChange={() => handleToggleActive(null as any, selected)}
                  />
                  <button
                    onClick={() => { setDeleteId(selected.id); setIsConfirmOpen(true); }}
                    style={{ padding: 8, borderRadius: 8, color: 'var(--color-text-muted)', transition: 'all 0.2s', border: '1px solid var(--color-border)' }}
                    onMouseEnter={e => { (e.currentTarget.style.color = 'var(--color-danger)'); (e.currentTarget.style.background = 'var(--color-danger-light)'); }}
                    onMouseLeave={e => { (e.currentTarget.style.color = 'var(--color-text-muted)'); (e.currentTarget.style.background = 'transparent'); }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {selected.spreadsheet_id && (
                <div style={{ marginTop: '1rem', background: 'var(--color-success-light)', border: '1px solid var(--color-success)', borderRadius: 8, padding: '0.5rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }}></span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-success)', fontWeight: 600 }}>Cronjob Sync đang hoạt động với ID: {selected.spreadsheet_id}</span>
                </div>
              )}

              <div style={{ marginTop: '1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                <span style={{ flex: 1, padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: 'var(--color-text-light)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {webhookUrl(selected.webhook_token)}
                </span>
                <button onClick={() => handleCopyWebhook(selected)} className="btn primary sm" style={{ borderRadius: 8, flexShrink: 0, margin: '4px' }}>
                  {copiedId === selected.id ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copiedId === selected.id ? 'Đã copy' : 'Copy URL'}
                </button>
              </div>

              <div style={{ marginTop: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Yêu cầu đủ SĐT và Email
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Nếu bật, dòng dữ liệu trên Sheets phải có <strong>CẢ SĐT LẪN EMAIL</strong> mới được đồng bộ vào hệ thống.
                  </p>
                </div>
                <ToggleSwitch 
                  checked={!!selected.require_both_contact} 
                  onChange={() => handleToggleRequireBoth(selected)}
                />
              </div>
            </div>

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
                    options={SYSTEM_FIELDS} 
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
                  <button className="btn primary" onClick={handleSaveMapping} style={{ flexShrink: 0, height: 42, background: editingMappingId ? 'var(--color-warning)' : 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                    {editingMappingId ? 'Cập nhật' : <><Plus size={16} /> Thêm</>}
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

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, margin: 0 }}>Chu kỳ đồng bộ</label>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer' }}>(?) Cơ chế hoạt động?</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
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

              {syncPreset === 'custom' && (
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
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>Ánh xạ các cột trên Google Sheets của bạn vào hệ thống CRM.</p>
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
                  <CustomSelect options={SYSTEM_FIELDS} value={newMappingField} onChange={v => setNewMappingField(String(v))} />
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
                <button onClick={() => { if(newMappingCol) { setTempMappings([...tempMappings, { sheet_col: newMappingCol, sys_field: newMappingField, custom_label: newMappingCustomLabel }]); setNewMappingCustomLabel(''); } }} className="btn" style={{ background: 'var(--color-primary)', color: 'white', height: 38, padding: '0 1rem', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <Plus size={16} /> Thêm
                </button>
              </div>

              {/* Mappings Table BELOW */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 40px', background: '#f8fafc', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                  <div>Tên cột trên Sheets</div>
                  <div>Trường hiển thị trong Email</div>
                  <div>Trường hệ thống</div>
                  <div></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {tempMappings.map((m, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 40px', padding: '0.75rem 1rem', borderBottom: idx < tempMappings.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
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
                  {SYSTEM_FIELDS.map(f => (
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
    </>
  );
};
