import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, FileSpreadsheet, Plus, Trash2, Database, 
  RefreshCw, AlertCircle, ExternalLink, Edit2,
  Link2, Info, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAPI } from '../../utils/api';
import { CustomSelect } from './CustomSelect';

interface InventorySyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Connection = {
  id: number;
  sheet_name: string;
  spreadsheet_id?: string;
  webhook_token: string;
  is_active: boolean;
  connection_type?: string;
  sync_interval?: number;
  sync_status?: 'idle' | 'syncing' | 'error' | string;
  last_error?: string | null;
  last_sync_at?: string;
  mappings?: Mapping[];
};

type Mapping = {
  id: number;
  connection_id: number;
  sheet_column: string;
  system_field: string;
  custom_label?: string;
};

const INVENTORY_FIELDS = [
  { value: 'sku', label: 'Mã Căn / Lô đất (Trường Khóa So Khớp)' },
  { value: 'product_name', label: 'Tên Dự Án / Sản Phẩm' },
  { value: 'price', label: 'Giá Bán / Giá Niêm Yết' },
  { value: 'import_price', label: 'Giá Nhập / Giá Gốc' },
  { value: 'qty', label: 'Số Lượng Tồn Kho' },
  { value: 'status', label: 'Trạng Thái Bán (Đã bán/Chưa bán)' },
  { value: 'category', label: 'Phân Loại (Loại hình)' },
  { value: 'unit', label: 'Đơn Vị Tính' },
  { value: 'notes', label: 'Ghi Chú / Mô Tả' }
];

export const InventorySyncModal: React.FC<InventorySyncModalProps> = ({ isOpen, onClose }) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for new connection
  const [showAddConn, setShowAddConn] = useState(false);
  const [newSpreadsheetId, setNewSpreadsheetId] = useState('');
  const [newSheetTab, setNewSheetTab] = useState('Sheet1');
  const [syncInterval, setSyncInterval] = useState(15);

  // Column fetching states
  const [columns, setColumns] = useState<string[]>([]);
  const [isFetchingColumns, setIsFetchingColumns] = useState(false);

  // New mapping row states
  const [newMappingField, setNewMappingField] = useState('sku');
  const [newMappingCol, setNewMappingCol] = useState('');
  const [newMappingCustomLabel, setNewMappingCustomLabel] = useState('');
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);

  // Force sync execution states
  const [syncLogs, setSyncLogs] = useState('');
  const [isForceSyncing, setIsForceSyncing] = useState(false);

  const generateToken = () => 'tok_' + Math.random().toString(36).slice(2, 10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const connRes = await fetchAPI('get_connections&type=inventory_sheets');
      const mapRes = await fetchAPI('get_mappings');
      
      const connsData = connRes.success ? (connRes.data || []) : [];
      const mapsData = mapRes.success ? (mapRes.data || []) : [];
      
      // Inject mappings to connections
      const mappedConns = connsData.map((c: Connection) => ({
        ...c,
        is_active: !!Number(c.is_active),
        mappings: mapsData.filter((m: Mapping) => Number(m.connection_id) === Number(c.id))
      }));
      
      setConnections(mappedConns);
      
      if (selected) {
        const updatedSelected = mappedConns.find((c: Connection) => c.id === selected.id);
        if (updatedSelected) {
          setSelected(updatedSelected);
        }
      } else if (mappedConns.length > 0) {
        setSelected(mappedConns[0]);
      }
    } catch (e: any) {
      toast.error('Lỗi tải cấu hình: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setSyncLogs('');
    }
  }, [isOpen]);

  const loadColumnsForSelected = async () => {
    if (!selected?.spreadsheet_id) return;
    setIsFetchingColumns(true);
    try {
      const res = await fetchAPI(`fetch_columns&id=${selected.spreadsheet_id}&name=${encodeURIComponent(selected.sheet_name)}`);
      if (res.success) {
        setColumns(res.data || []);
      } else {
        toast.error(res.message || 'Không thể tải danh sách cột từ Sheet');
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsFetchingColumns(false);
    }
  };

  useEffect(() => {
    if (selected && selected.id !== -1) {
      loadColumnsForSelected();
    } else {
      setColumns([]);
    }
  }, [selected?.id]);

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpreadsheetId.trim()) {
      toast.error('ID Bảng tính Google không được để trống');
      return;
    }
    
    let spreadsheetId = newSpreadsheetId.trim();
    const urlMatch = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      spreadsheetId = urlMatch[1];
    }

    const payload = {
      sheet_name: newSheetTab,
      spreadsheet_id: spreadsheetId,
      webhook_token: generateToken(),
      is_active: 1,
      sync_interval: syncInterval,
      connection_type: 'inventory_sheets',
      sync_mode: 'all',
      is_silent: 0,
      sync_saleperson: 0
    };

    setIsSaving(true);
    try {
      const res = await fetchAPI('add_connection', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        toast.success('Đã kết nối thành công');
        setShowAddConn(false);
        setNewSpreadsheetId('');
        
        const freshRes = await fetchAPI('get_connections&type=inventory_sheets');
        if (freshRes.success && freshRes.data?.length > 0) {
          const newConn = freshRes.data[0];
          setSelected({
            ...newConn,
            is_active: !!Number(newConn.is_active),
            mappings: []
          });
        }
        fetchData();
      } else {
        toast.error(res.message || 'Lỗi thêm kết nối');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selected) return;
    const newActive = !selected.is_active;
    try {
      const res = await fetchAPI(`toggle_connection&id=${selected.id}&active=${newActive ? 1 : 0}`);
      if (res.success) {
        toast.success(newActive ? 'Đã bật kết nối' : 'Đã tắt kết nối');
        fetchData();
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleDeleteConnection = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa kết nối đồng bộ này và toàn bộ ánh xạ trường liên quan?')) return;
    try {
      await fetchAPI(`delete_connection&id=${id}`);
      toast.success('Đã xóa kết nối thành công');
      setSelected(null);
      fetchData();
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!newMappingCol) {
      toast.error('Vui lòng chọn hoặc nhập tên cột trên Google Sheets');
      return;
    }

    setIsSavingMapping(true);
    try {
      const isEdit = !!editingMappingId;
      const action = isEdit ? 'edit_mapping' : 'add_mapping';
      
      const payload = isEdit
        ? { id: editingMappingId, sheet_column: newMappingCol, system_field: newMappingField, custom_label: newMappingCustomLabel.trim() }
        : { connection_id: selected.id, sheet_column: newMappingCol, system_field: newMappingField, custom_label: newMappingCustomLabel.trim() };

      const res = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        toast.success(isEdit ? 'Đã cập nhật ánh xạ trường' : 'Đã thêm ánh xạ trường');
        setNewMappingCol('');
        setNewMappingCustomLabel('');
        setEditingMappingId(null);
        fetchData();
      } else {
        toast.error(res.message || 'Lỗi lưu ánh xạ');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    } finally {
      setIsSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (id: number) => {
    try {
      await fetchAPI(`delete_mapping&id=${id}`);
      toast.success('Đã xóa ánh xạ trường');
      fetchData();
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleForceSync = async () => {
    if (!selected) return;
    setIsForceSyncing(true);
    setSyncLogs('Đang kết nối API và tải dữ liệu từ Google Sheets...');
    try {
      const res = await fetchAPI(`force_sync&id=${selected.id}`);
      if (res.success) {
        setSyncLogs(prev => prev + '\n\n--- KẾT QUẢ ĐỒNG BỘ ---\n' + (res.output || 'Đồng bộ hoàn tất thành công.'));
        toast.success('Đồng bộ hoàn tất!');
        fetchData();
      } else {
        setSyncLogs(prev => prev + '\n\n❌ LỖI ĐỒNG BỘ: ' + (res.message || 'Không rõ nguyên nhân'));
        toast.error('Lỗi đồng bộ');
      }
    } catch (e: any) {
      setSyncLogs(prev => prev + '\n\n❌ LỖI KẾT NỐI: ' + e.message);
      toast.error('Lỗi kết nối');
    } finally {
      setIsForceSyncing(false);
    }
  };

  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(
    <>
      <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', zIndex: 9999 }} onClick={onClose}>
      <div className="modal-sheet" style={{ width: '95vw', maxWidth: '1100px', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-4">
            <div style={{ background: 'var(--color-primary)', color: '#fff', width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ margin: 0 }}>Đồng bộ Giỏ hàng Real-time</h2>
              <p className="text-xs text-light" style={{ margin: 0, opacity: 0.7 }}>Kết nối bảng hàng của Chủ đầu tư qua Google Sheets để tự động cập nhật giỏ hàng.</p>
            </div>
          </div>
          <button className="btn-icon sm" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Content Container */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--color-bg)' }}>
          {/* Left Panel: List of Connections */}
          <div style={{ width: 280, borderRight: '1px solid var(--color-border)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
            <button 
              onClick={() => setShowAddConn(true)} 
              className="btn primary sm" 
              style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', height: '36px' }}
            >
              <Plus size={16} /> Kết nối Sheets mới
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {connections.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 12, border: '1px dashed var(--color-border)' }}>
                  <Database size={24} style={{ color: 'var(--color-text-muted)', margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', margin: 0 }}>Chưa có kết nối nào</p>
                </div>
              ) : (
                connections.map(conn => {
                  const isSelected = selected && selected.id === conn.id;
                  return (
                    <div
                      key={conn.id}
                      onClick={() => { setSelected(conn); setShowAddConn(false); }}
                      style={{
                        background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <span style={{ fontWeight: 700, fontSize: '0.825rem', color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                          {conn.sheet_name}
                        </span>
                        <span className={`badge ${conn.is_active ? 'success' : 'secondary'}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                          {conn.is_active ? 'Bật' : 'Tắt'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 4, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ID: {conn.spreadsheet_id}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Active Screen */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto', padding: '1.5rem' }}>
            {selected ? (
              /* Connection Details & Mapping configuration */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Connection Quick Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1rem' }}>
                  <div>
                    <h3 className="font-bold text-base" style={{ margin: 0, color: 'var(--color-text)' }}>Tab: {selected.sheet_name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      Spreadsheet ID: <span className="font-mono" style={{ background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4 }}>{selected.spreadsheet_id}</span>
                      <a href={`https://docs.google.com/spreadsheets/d/${selected.spreadsheet_id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }} title="Mở trang tính"><ExternalLink size={12} /></a>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleForceSync}
                      disabled={isForceSyncing}
                      className="btn outline sm"
                      style={{ height: '36px', gap: '0.4rem' }}
                    >
                      <RefreshCw size={14} className={isForceSyncing ? 'animate-spin' : ''} />
                      {isForceSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                    </button>

                    <button 
                      onClick={handleToggleActive}
                      className={`btn ${selected.is_active ? 'outline' : 'primary'} sm`}
                      style={{ height: '36px' }}
                    >
                      {selected.is_active ? 'Tạm dừng đồng bộ' : 'Kích hoạt đồng bộ'}
                    </button>

                    <button 
                      onClick={() => handleDeleteConnection(selected.id)}
                      className="btn danger sm"
                      style={{ height: '36px', backgroundColor: 'var(--color-red-light)', borderColor: 'var(--color-red-light)', color: 'var(--color-red)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Status or errors warning */}
                {selected.last_error && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs">
                    <AlertCircle size={16} className="mt-0.5" />
                    <div>
                      <span className="font-bold">Lỗi đồng bộ gần nhất:</span> {selected.last_error}
                      {selected.last_sync_at && <p style={{ margin: '2px 0 0', opacity: 0.8 }}>Thời gian: {selected.last_sync_at}</p>}
                    </div>
                  </div>
                )}

                {/* Force sync stdout console log panel */}
                {syncLogs && (
                  <div style={{ background: '#1e1e2e', borderRadius: 8, padding: '1rem', border: '1px solid #313244', fontSize: '0.75rem', fontFamily: 'monospace', color: '#cdd6f4', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {syncLogs}
                  </div>
                )}

                {/* Field Mappings setup */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>Cấu Hình Ánh Xạ Trường Giỏ Hàng</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                    Ánh xạ các cột tiêu đề của file Google Sheet của bạn khớp với các trường thông tin giỏ hàng căn hộ trên CRM.
                  </p>

                  {/* Mapping Add Row */}
                  <form onSubmit={handleSaveMapping} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Trường Giỏ Hàng Hệ Thống</label>
                      <CustomSelect
                        options={INVENTORY_FIELDS}
                        value={newMappingField}
                        onChange={val => {
                          setNewMappingField(String(val));
                          const field = INVENTORY_FIELDS.find(f => f.value === val);
                          if (field && val !== 'custom') {
                            setNewMappingCustomLabel('');
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Tên Cột Trên Trang Tính (Google Sheet)</label>
                      {columns.length > 0 ? (
                        <CustomSelect
                          options={columns.map(c => ({ value: c, label: c }))}
                          value={newMappingCol}
                          onChange={val => setNewMappingCol(String(val))}
                          placeholder="Chọn cột..."
                        />
                      ) : (
                        <input
                          type="text"
                          className="form-input text-xs"
                          value={newMappingCol}
                          onChange={e => setNewMappingCol(e.target.value)}
                          placeholder="Ví dụ: Mã căn, Giá bán"
                          style={{ height: 38 }}
                        />
                      )}
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Nhãn Tùy Biến (Tùy chọn)</label>
                      <input
                        type="text"
                        className="form-input text-xs"
                        value={newMappingCustomLabel}
                        onChange={e => setNewMappingCustomLabel(e.target.value)}
                        placeholder="Vd: Diện tích, Hướng nhà"
                        style={{ height: 38 }}
                      />
                    </div>

                    <div className="flex gap-2">
                      {editingMappingId && (
                        <button type="button" className="btn outline sm" onClick={() => { setEditingMappingId(null); setNewMappingCol(''); setNewMappingCustomLabel(''); }}>Hủy</button>
                      )}
                      <button type="submit" className="btn primary sm" style={{ height: 38 }}>
                        {editingMappingId ? 'Cập nhật' : 'Thêm'}
                      </button>
                    </div>
                  </form>

                  {/* Mappings Table */}
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Trường Giỏ Hàng Hệ Thống</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Cột Trên Google Sheet</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Nhãn Hiển Thị Thêm (Ghi chú)</th>
                          <th style={{ padding: '10px 14px', width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.mappings && selected.mappings.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              Chưa cấu hình ánh xạ trường nào. Vui lòng thêm ánh xạ cột phía trên để đồng bộ dữ liệu.
                            </td>
                          </tr>
                        ) : (
                          selected.mappings?.map(m => {
                            const sysFieldLabel = INVENTORY_FIELDS.find(f => f.value === m.system_field)?.label || m.system_field;
                            return (
                              <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{sysFieldLabel}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span className="font-mono" style={{ background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4 }}>{m.sheet_column}</span>
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>{m.custom_label || '-'}</td>
                                <td style={{ padding: '10px 14px' }} className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditingMappingId(m.id);
                                      setNewMappingField(m.system_field);
                                      setNewMappingCol(m.sheet_column);
                                      setNewMappingCustomLabel(m.custom_label || '');
                                    }}
                                    className="btn-icon sm"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    title="Sửa"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteMapping(m.id)}
                                    className="btn-icon sm"
                                    style={{ color: 'var(--color-red)' }}
                                    title="Xóa"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                <Database size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p style={{ fontSize: '0.875rem' }}>Chọn một kết nối Sheets ở cột bên trái để xem chi tiết hoặc cấu hình.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {showAddConn && (
        <div 
          className="overlay-backdrop" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', zIndex: 99999 }}
          onClick={() => setShowAddConn(false)}
        >
          <div 
            className="modal-sheet" 
            style={{ width: '640px', maxWidth: 'calc(100vw - 2rem)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', boxShadow: 'var(--shadow-2xl)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header" style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Kết nối Google Sheets</h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, opacity: 0.7 }}>Kết nối bảng tính của bạn để đồng bộ giỏ hàng.</p>
                </div>
              </div>
              <button className="btn-icon sm" onClick={() => setShowAddConn(false)}><X size={20} /></button>
            </div>

            {/* Body */}
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Step Tracker */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '0.5rem', position: 'relative' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>1</div>
                <div style={{ width: 60, height: 1, background: 'var(--color-border)' }}></div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>2</div>
                <div style={{ width: 60, height: 1, background: 'var(--color-border)' }}></div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>3</div>
              </div>

              {/* Step Title */}
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: 0 }}>
                  Cấu hình Google Sheets
                  <span style={{ color: 'var(--color-primary)' }}><FileSpreadsheet size={16} /></span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, margin: 0 }}>
                  Kết nối bảng tính của bạn để tự động nạp dữ liệu Khách hàng.
                </p>
              </div>

              {/* Hướng dẫn nhanh card */}
              <div style={{
                background: 'rgba(239, 68, 68, 0.04)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: 12,
                padding: '1.25rem',
                color: 'var(--color-text)',
                fontSize: '0.85rem',
                lineHeight: 1.6
              }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', marginBottom: 8 }}>
                  <Info size={16} /> Hướng dẫn nhanh:
                </div>
                <ol style={{ paddingLeft: '1.20rem', margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li>Bấm nút <strong style={{ color: 'var(--color-primary)' }}>Chia sẻ (Share)</strong> trên file Google Sheets.</li>
                  <li>Tại phần <strong style={{ color: 'var(--color-primary)' }}>Quyền truy cập chung</strong>, chọn <strong style={{ color: 'var(--color-primary)' }}>Bất kỳ ai có liên kết</strong> và đặt quyền là <strong style={{ color: 'var(--color-primary)' }}>Người xem</strong>.</li>
                  <li>Copy <strong style={{ color: 'var(--color-primary)' }}>Spreadsheet ID</strong> từ URL trình duyệt (chuỗi ký tự nằm giữa d/ và /edit).</li>
                </ol>
              </div>

              <form onSubmit={handleAddConnection} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Đường dẫn bảng tính */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
                    Đường dẫn Google Sheet (hoặc ID)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 11, left: 12, color: '#94a3b8' }}><Link2 size={16} /></div>
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 36, background: 'var(--color-bg)', border: 'none', height: 40 }}
                      value={newSpreadsheetId}
                      onChange={e => setNewSpreadsheetId(e.target.value)}
                      placeholder="Dán link hoặc Spreadsheet ID vào đây..."
                      required
                    />
                  </div>
                </div>

                {/* Tên sheet con */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
                    Tên trang tính (Sheet name)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 11, left: 12, color: '#94a3b8' }}><FileSpreadsheet size={16} /></div>
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 36, background: 'var(--color-bg)', border: 'none', height: 40 }}
                      value={newSheetTab}
                      onChange={e => setNewSheetTab(e.target.value)}
                      placeholder="Sheet1"
                      required
                    />
                  </div>
                </div>

                {/* Chu kỳ đồng bộ */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
                    Chu kỳ tự động đồng bộ
                  </label>
                  <CustomSelect
                    options={[
                      { value: '5', label: 'Mỗi 5 phút' },
                      { value: '15', label: 'Mỗi 15 phút (Khuyên dùng)' },
                      { value: '30', label: 'Mỗi 30 phút' },
                      { value: '60', label: 'Mỗi 60 phút' },
                    ]}
                    value={String(syncInterval)}
                    onChange={v => setSyncInterval(Number(v))}
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowAddConn(false)} 
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Quay lại
                  </button>
                  <button 
                    type="submit" 
                    className="btn primary" 
                    disabled={isSaving} 
                    style={{ 
                      padding: '10px 20px', 
                      borderRadius: 10, 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      boxShadow: '0 4px 12px rgba(163, 20, 34, 0.15)',
                      fontWeight: 700
                    }}
                  >
                    {isSaving && <RefreshCw size={14} className="spin" />}
                    {isSaving ? 'Đang kết nối...' : 'Kiểm tra kết nối >'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  ) : null;
};
