import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { withRouterFreezer } from '../components/RouterFreezer';
import { Webhook, Plus, Trash2, Copy, CheckCircle2, ChevronRight, ChevronLeft, Link2, Tag, Info, FileSpreadsheet, Zap, Clock, Target, RefreshCw, Edit2, ExternalLink, AlertCircle, Settings, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';

const SYSTEM_FIELDS = [
  // --- Thông tin Cá nhân & Liên hệ ---
  { value: 'phone', label: 'Số Điện Thoại chính' },
  { value: 'phone2', label: 'Số Điện Thoại 2 / Phụ' },
  { value: 'name', label: 'Họ Tên' },
  { value: 'email', label: 'Email' },
  { value: 'gender', label: 'Giới tính' },
  { value: 'dob', label: 'Ngày sinh' },
  { value: 'citizen_id', label: 'Số CCCD / CMND' },
  { value: 'address', label: 'Địa chỉ thường trú / tạm trú' },
  { value: 'city', label: 'Tỉnh / Thành phố' },
  { value: 'district', label: 'Quận / Huyện' },
  { value: 'company', label: 'Công ty / Đơn vị làm việc' },
  { value: 'job_title', label: 'Nghề nghiệp / Chức danh' },
  { value: 'tax_code', label: 'Mã số thuế cá nhân' },

  // --- Nguồn Data & Tracking (UTM) ---
  { value: 'source', label: 'Nguồn Data' },
  { value: 'type', label: 'Loại Data' },
  { value: 'platform', label: 'Nền tảng Data (Meta / Google / TikTok / Zalo)' },
  { value: 'utm_campaign', label: 'Tên Chiến dịch Ads (UTM Campaign)' },
  { value: 'utm_medium', label: 'Hình thức Ads (UTM Medium)' },
  { value: 'utm_content', label: 'Mẫu Quảng cáo / Adset (UTM Content)' },
  { value: 'utm_term', label: 'Từ khóa Ads (UTM Term)' },
  { value: 'form_name', label: 'Tên Mẫu Lead Form / Landing Page' },

  // --- Nhu cầu & Tài chính ---
  { value: 'budget', label: 'Ngân sách tài chính / Doanh thu dự kiến' },
  { value: 'demand_type', label: 'Mục đích nhu cầu (Ở / Đầu tư / Cho thuê)' },
  { value: 'property_type', label: 'Loại BĐS quan tâm (Căn hộ / Nhà phố / Biệt thự)' },
  { value: 'bedroom_count', label: 'Số phòng ngủ mong muốn' },
  { value: 'preferred_location', label: 'Khu vực / Dự án quan tâm' },

  // --- Mạng Xã Hội & Khác ---
  { value: 'zalo_phone', label: 'Số Zalo / Link Zalo' },
  { value: 'facebook_link', label: 'Link Facebook cá nhân' },
  { value: 'note', label: 'Ghi Chú bổ sung' },

  // --- Phân bổ & Quản lý ---
  { value: 'assigned_to', label: 'Sale phụ trách (Trùng số nhắc lại)' },
  { value: 'saleperson', label: 'Salesperson (Tên/Email Sale)' },
];

const BASE_WEBHOOK = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/webhook.php` : `${window.location.origin}/backend/webhook.php`;

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
  notify_admin?: number | boolean;
  last_sync_at?: string;
  two_way_sync?: number | boolean;
  google_script_url?: string;
  lead_recall_minutes?: number;
  sync_status?: 'idle' | 'syncing' | 'error' | string;
  last_error?: string | null;
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

const generateDefaultTemplate = (
  mappings: { sheet_col: string; sys_field: string; custom_label?: string }[],
  t: (key: string) => string
) => {
  if (mappings.length === 0) {
    return t('Thông tin Khách hàng:\n- Họ Tên: {name}\n- Số Điện Thoại: {phone}');
  }

  let lines = [t('Thông tin Khách hàng:')];
  const mappedSystemFields = Array.from(new Set(mappings.map(m => m.sys_field)));
  const order = ['name', 'phone', 'email', 'source', 'type', 'note'];

  order.forEach(field => {
    if (mappedSystemFields.includes(field)) {
      const fieldMapping = SYSTEM_FIELDS.find(f => f.value === field);
      const label = fieldMapping ? t(fieldMapping.label) : field;
      lines.push(`- ${label}: {${field}}`);
    }
  });

  return lines.join('\n');
};

const masterAppsScriptCode = `/**
 * RICH LAND CRM - Google Apps Script Two-Way Synchronization Script
 * 
 * HƯỚNG DẪN CẤU HÌNH:
 * 1. Mở trang Google Sheet của bạn.
 * 2. Vào Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa mọi mã nguồn cũ và dán toàn bộ đoạn mã này vào.
 * 4. Nhấn nút "Triển khai" (Deploy) ở góc phải trên -> "Triển khai mới" (New deployment).
 * 5. Chọn loại triển khai là "Ứng dụng web" (Web app).
 * 6. Cấu hình cấu hình ứng dụng web:
 *    - Thực thi dưới danh nghĩa: "Tôi" (Me / tài khoản Google của bạn).
 *    - Ai có quyền truy cập: "Mọi người" (Anyone - Bắt buộc để CRM có thể kết nối).
 * 7. Nhấn "Triển khai" (Deploy), cấp quyền truy cập nếu Google yêu cầu.
 * 8. Copy đường dẫn "URL ứng dụng web" (Web app URL) nhận được.
 * 9. Dán URL này vào thiết lập Kết nối Sheets trong CRM (nút Sửa -> bật Đồng bộ 2 chiều hoặc trang Đồng bộ 2 chiều Tổng).
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "Yêu cầu không chứa dữ liệu" });
    }
    
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheet_name || "";
    
    var searchColPhone = payload.search_col_phone || "";
    var searchValPhone = payload.search_val_phone ? normalizePhone(payload.search_val_phone) : "";
    
    var searchColEmail = payload.search_col_email || "";
    var searchValEmail = payload.search_val_email ? payload.search_val_email.trim().toLowerCase() : "";
    
    var allowInsert = payload.allow_insert === true;
    var updates = payload.updates || {};
    
    if (!searchValPhone && !searchValEmail) {
      return createJsonResponse({ status: "error", message: "Thiếu thông tin khóa tìm kiếm (SĐT hoặc Email)" });
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet;
    
    if (sheetName) {
      sheet = ss.getSheetByName(sheetName);
    }
    if (!sheet) {
      sheet = ss.getSheets()[0]; // Lấy sheet đầu tiên nếu không khớp tên
    }
    
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "Không tìm thấy Sheet phù hợp" });
    }
    
    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();
    
    // Nếu sheet hoàn toàn trống
    if (lastRow < 1 || lastColumn < 1) {
      // Viết hàng tiêu đề mặc định
      var defaultHeaders = ["Thời gian", "Nguồn", "Vòng", "Sale phụ trách", "Họ tên", "Số điện thoại", "Email", "Ghi chú", "Trạng thái"];
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
      SpreadsheetApp.flush();
      lastRow = 1;
      lastColumn = defaultHeaders.length;
    }
    
    // Đọc hàng tiêu đề (Headers)
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    
    // Tìm vị trí cột khóa SĐT và Email
    var colPhoneIdx = -1;
    var colEmailIdx = -1;
    var columnIndexes = {};
    
    for (var i = 0; i < headers.length; i++) {
      var headerName = (headers[i] || "").toString().trim();
      columnIndexes[headerName] = i + 1; // 1-based index
      
      if (searchColPhone && headerName.toLowerCase() === searchColPhone.toLowerCase()) {
        colPhoneIdx = i + 1;
      }
      if (searchColEmail && headerName.toLowerCase() === searchColEmail.toLowerCase()) {
        colEmailIdx = i + 1;
      }
    }
    
    // Nếu tiêu đề tìm kiếm chưa tồn tại, tự động thêm vào cột mới
    if (colPhoneIdx === -1 && searchColPhone) {
      lastColumn++;
      sheet.getRange(1, lastColumn).setValue(searchColPhone);
      headers.push(searchColPhone);
      columnIndexes[searchColPhone] = lastColumn;
      colPhoneIdx = lastColumn;
    }
    if (colEmailIdx === -1 && searchColEmail) {
      lastColumn++;
      sheet.getRange(1, lastColumn).setValue(searchColEmail);
      headers.push(searchColEmail);
      columnIndexes[searchColEmail] = lastColumn;
      colEmailIdx = lastColumn;
    }
    
    // Kiểm tra xem tất cả các cột trong \`updates\` có tiêu đề chưa, nếu chưa thì thêm mới
    for (var colName in updates) {
      if (!columnIndexes[colName]) {
        lastColumn++;
        sheet.getRange(1, lastColumn).setValue(colName);
        headers.push(colName);
        columnIndexes[colName] = lastColumn;
      }
    }
    
    // Đọc toàn bộ dữ liệu để tìm kiếm (nếu có dữ liệu dòng 2 trở đi)
    var targetRowIndex = -1; // 2-based index thực tế trên Sheet
    if (lastRow >= 2) {
      var dataRange = sheet.getRange(2, 1, lastRow - 1, lastColumn);
      var rows = dataRange.getValues();
      
      for (var r = 0; r < rows.length; r++) {
        var currentRow = rows[r];
        var matched = false;
        
        // So khớp số điện thoại
        if (colPhoneIdx > 0 && searchValPhone) {
          var cellPhone = normalizePhone(currentRow[colPhoneIdx - 1]);
          if (cellPhone && cellPhone === searchValPhone) {
            matched = true;
          }
        }
        
        // So khớp email nếu số điện thoại chưa khớp hoặc bị thiếu
        if (!matched && colEmailIdx > 0 && searchValEmail) {
          var cellEmail = (currentRow[colEmailIdx - 1] || "").toString().trim().toLowerCase();
          if (cellEmail && cellEmail === searchValEmail) {
            matched = true;
          }
        }
        
        if (matched) {
          targetRowIndex = r + 2; // +2 vì index trong mảng là 0-based và bỏ qua header
          break; // Chỉ cập nhật dòng đầu tiên tìm thấy
        }
      }
    }
    
    var isNewRow = false;
    if (targetRowIndex === -1) {
      if (!allowInsert) {
        return createJsonResponse({ 
          status: "error", 
          message: "Không tìm thấy dòng tương ứng với SĐT: " + searchValPhone + " hoặc Email: " + searchValEmail 
        });
      } else {
        targetRowIndex = lastRow + 1;
        isNewRow = true;
      }
    }
    
    // Đọc dòng hiện tại hoặc khởi tạo dòng mới
    var rowValues = [];
    if (isNewRow) {
      for (var k = 0; k < lastColumn; k++) {
        rowValues.push("");
      }
      // Gán sẵn các khóa tìm kiếm cho dòng mới
      if (colPhoneIdx > 0 && searchValPhone) {
        rowValues[colPhoneIdx - 1] = payload.search_val_phone; // Giữ nguyên định dạng gốc của SĐT
      }
      if (colEmailIdx > 0 && searchValEmail) {
        rowValues[colEmailIdx - 1] = payload.search_val_email;
      }
    } else {
      rowValues = sheet.getRange(targetRowIndex, 1, 1, lastColumn).getValues()[0];
    }
    
    // Cập nhật các cột được chỉ định vào mảng
    var updateCount = 0;
    for (var colName in updates) {
      var colIdx = columnIndexes[colName];
      if (colIdx) {
        rowValues[colIdx - 1] = updates[colName];
        updateCount++;
      }
    }
    
    // Ghi toàn bộ dòng dữ liệu
    sheet.getRange(targetRowIndex, 1, 1, lastColumn).setValues([rowValues]);
    
    // Force spreadsheet to flush and write immediately
    SpreadsheetApp.flush();
    
    return createJsonResponse({ 
      status: "success", 
      message: (isNewRow ? "Thêm mới thành công dòng " : "Cập nhật thành công dòng ") + targetRowIndex + " (" + updateCount + " cột)" 
    });
    
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("OK");
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Chuẩn hóa số điện thoại: loại bỏ dấu cách, ký tự đặc biệt, chuyển đổi 84 -> 0
 */
function normalizePhone(phone) {
  if (!phone) return "";
  var clean = phone.toString().replace(/[\\s\\-\\.\\+\\(\\)]/g, "");
  if (clean.indexOf("84") === 0) {
    clean = "0" + clean.substr(2);
  }
  return clean;
}
}`;

const IntegrationsInner = () => {
  const { language, t } = useLanguage();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Connection | null>(null);
  const [mobileActiveView, setMobileActiveView] = useState<'list' | 'detail'>('list');
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
  const [emailTemplate, setEmailTemplate] = useState(() => t('Thông tin Khách hàng:\n- Tên KH: {name}\n- SĐT: {phone}\n- Bằng cấp: {degree}\n- Tiếng Anh: {english}'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [fetchedSheets, setFetchedSheets] = useState<string[]>([]);
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isConfirmMappingOpen, setIsConfirmMappingOpen] = useState(false);
  const [deleteMappingId, setDeleteMappingId] = useState<number | null>(null);

  // Pause warning modal
  const [showPauseWarning, setShowPauseWarning] = useState(false);

  // Mapping states
  const [newMappingCol, setNewMappingCol] = useState('');
  const [newMappingField, setNewMappingField] = useState('phone');
  const [newMappingCustomLabel, setNewMappingCustomLabel] = useState('');
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);

  // Landing Page API states
  const [showAddApi, setShowAddApi] = useState(false);
  const [newApiName, setNewApiName] = useState(() => t('Landing Page 1'));

  // Edit Connection states
  const [showEditConn, setShowEditConn] = useState(false);
  const [editSyncPreset, setEditSyncPreset] = useState<'5p' | '15p' | '1h' | '1d' | 'custom'>('15p');
  const [editCustomSyncMins, setEditCustomSyncMins] = useState<number>(15);
  const [editSyncMode, setEditSyncMode] = useState<'all' | 'new_only'>('all');
  const [editIsSilent, setEditIsSilent] = useState(false);
  const [editSyncSaleperson, setEditSyncSaleperson] = useState(false);
  const [editEmailTemplate, setEditEmailTemplate] = useState('');
  const [editTwoWaySync, setEditTwoWaySync] = useState(false);
  const [editGoogleScriptUrl, setEditGoogleScriptUrl] = useState('');
  const [editLeadRecallMinutes, setEditLeadRecallMinutes] = useState(0);

  // Master Sync states
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [masterUrl, setMasterUrl] = useState('');
  const [masterSheetName, setMasterSheetName] = useState('');
  const [isSavingMaster, setIsSavingMaster] = useState(false);
  const [isTestingMaster, setIsTestingMaster] = useState(false);
  const [customSystemFields, setCustomSystemFields] = useState<any[]>([]);

  const getSelectFields = () => {
    const isSyncActive = selected?.sync_saleperson || (showEditConn && editSyncSaleperson) || (showAddConn && syncSaleperson);
    const baseFields = isSyncActive ? SYSTEM_FIELDS : SYSTEM_FIELDS.filter(f => f.value !== 'saleperson');
    if (customSystemFields.length > 0) {
      return [...baseFields, ...customSystemFields];
    }
    return baseFields;
  };

  const fetchData = async () => {
    try {
      const [connRes, mapRes, settingsRes, customRes] = await Promise.all([
        fetchAPI('get_connections'),
        fetchAPI('get_mappings'),
        fetchAPI('get_settings'),
        fetchAPI('custom_fields').catch(() => null)
      ]);

      if (customRes) {
        const cFields = Array.isArray(customRes) ? customRes : (customRes.data || []);
        if (cFields.length > 0) {
          const formattedCF = cFields.map((cf: any) => ({
            value: `cf_${cf.id}`,
            label: `✨ ${cf.field_name || cf.name || 'Trường tùy chỉnh'} (${cf.field_type || 'Custom'})`
          }));
          setCustomSystemFields(formattedCF);
        }
      }
      if (connRes.success && mapRes.success) {
        const conns = connRes.data.map((c: any) => ({
          ...c,
          is_active: Boolean(Number(c.is_active)),
          sync_interval: Number(c.sync_interval),
          connection_type: c.connection_type,
          is_silent: Boolean(Number(c.is_silent)),
          sync_saleperson: Boolean(Number(c.sync_saleperson)),
          notify_admin: Boolean(Number(c.notify_admin !== undefined ? c.notify_admin : (c.connection_type === 'landing_page' ? 1 : 0))),
          mappings: mapRes.data.filter((m: any) => Number(m.connection_id) === Number(c.id))
        }));
        setConnections(conns);

        if (settingsRes && settingsRes.success && settingsRes.data) {
          setMasterEnabled(settingsRes.data.master_two_way_sync === '1');
          setMasterUrl(settingsRes.data.master_google_script_url || '');
          setMasterSheetName(settingsRes.data.master_sheet_name || '');
        }

        if (selected) {
          if (selected.id === -999) {
            setSelected({
              id: -999,
              sheet_name: t('Đồng bộ 2 chiều Tổng'),
              connection_type: 'master_sync',
              webhook_token: 'SYSTEM_GLOBAL',
              is_active: (settingsRes && settingsRes.data && settingsRes.data.master_two_way_sync === '1') ? 1 : 0
            } as any);
          } else {
            const updatedSelected = conns.find((c: any) => Number(c.id) === Number(selected.id));
            if (updatedSelected) setSelected(updatedSelected);
          }
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
      email_template: emailTemplate,
      lead_recall_minutes: 0,
      notify_admin: 0
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
        toast.success(t('Đã thêm kết nối thành công'));
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
      toast.error(t('Lỗi: ') + e.message);
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
      connection_type: 'landing_page',
      lead_recall_minutes: 0,
      notify_admin: 1
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
        toast.success(t('Đã tạo API Landing Page'));
        setNewApiName('Landing Page 1');
        setShowAddApi(false);
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
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
      email_template: editEmailTemplate,
      two_way_sync: editTwoWaySync ? 1 : 0,
      google_script_url: editGoogleScriptUrl,
      lead_recall_minutes: editLeadRecallMinutes,
      notify_admin: selected.notify_admin ? 1 : 0
    };

    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetchAPI('edit_connection', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        toast.success(t('Đã cập nhật cấu hình đồng bộ'));
        fetchData();
        setShowEditConn(false);
      } else {
        toast.error(t('Cập nhật thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi: ') + err.message);
    }
    setIsSaving(false);
  };

  const handleDeleteConnection = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      await fetchAPI(`delete_connection&id=${deleteId}`);
      toast.success(t('Đã xóa kết nối'));
      fetchData();
      if (selected && Number(selected.id) === Number(deleteId)) setSelected(null);
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsDeleting(false);
    setDeleteId(null);
    setIsConfirmOpen(false);
  };
  const handleSaveMapping = async () => {
    if (!newMappingCol.trim() || !selected || isSavingMapping) return;
    const colCleaned = newMappingCol.trim();
    const mappings = selected.mappings || [];

    // 1. Check duplicate sheet_col and sys_field mapping
    const isDuplicateExact = mappings.some(
      m => Number(m.id) !== Number(editingMappingId) &&
           m.sheet_column.toLowerCase() === colCleaned.toLowerCase() &&
           m.system_field === newMappingField
    );
    if (isDuplicateExact) {
      toast.error(t('Liên kết này đã tồn tại.'));
      return;
    }

    // 2. Check duplicate mapping for unique system fields
    const uniqueFields = ['phone', 'email', 'name', 'assigned_to', 'saleperson'];
    if (uniqueFields.includes(newMappingField)) {
      const isUniqueMapped = mappings.some(
        m => Number(m.id) !== Number(editingMappingId) && m.system_field === newMappingField
      );
      if (isUniqueMapped) {
        const fieldLabel = SYSTEM_FIELDS.find(f => f.value === newMappingField)?.label || newMappingField;
        toast.error(t("Trường '{fieldLabel}' đã được liên kết với một cột khác.").replace('{fieldLabel}', t(fieldLabel)));
        return;
      }
    }

    setIsSavingMapping(true);
    try {
      const action = editingMappingId ? 'edit_mapping' : 'add_mapping';
      const payload = editingMappingId
        ? { id: editingMappingId, sheet_column: colCleaned, system_field: newMappingField, custom_label: newMappingCustomLabel.trim() }
        : { connection_id: selected.id, sheet_column: colCleaned, system_field: newMappingField, custom_label: newMappingCustomLabel.trim() };

      const json = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        fetchData();
        setNewMappingCol('');
        setNewMappingCustomLabel('');
        setEditingMappingId(null);
        toast.success(editingMappingId ? t('Đã cập nhật mapping') : t('Đã thêm mapping'));
      } else {
        toast.error(json.message || t('Thao tác thất bại'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsSavingMapping(false);
  };

  const cancelEditMapping = () => {
    setEditingMappingId(null);
    setNewMappingCol('');
    setNewMappingCustomLabel('');
    setNewMappingField('phone');
  };

  const handleConfirmDeleteMapping = async () => {
    if (!deleteMappingId) return;
    try {
      await fetchAPI(`delete_mapping&id=${deleteMappingId}`);
      toast.success(t('Đã xóa mapping'));
      fetchData();
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsConfirmMappingOpen(false);
    setDeleteMappingId(null);
  };

  const handleDeleteMapping = (mappingId: number) => {
    setDeleteMappingId(mappingId);
    setIsConfirmMappingOpen(true);
  };

  // Actual API call to toggle the connection state
  const doToggleActive = async (conn: Connection) => {
    try {
      const newActive = !conn.is_active;
      const json = await fetchAPI(`toggle_connection&id=${conn.id}&active=${newActive ? 1 : 0}`);
      if (json.success) {
        toast.success(newActive ? t('Kết nối đã được bật lại') : t('Kết nối đã tạm dừng'));
        fetchData();
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
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
        toast.success(newRequire ? t('Đã bật yêu cầu Số Điện Thoại') : t('Đã tắt yêu cầu Số Điện Thoại'));
        fetchData();
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
  };

  const handleToggleNotifyAdmin = async (conn: any) => {
    try {
      const newNotify = conn.notify_admin ? 0 : 1;
      const json = await fetchAPI(`toggle_notify_admin&id=${conn.id}&notify=${newNotify}`);
      if (json.success) {
        toast.success(newNotify ? t('Đã bật báo cáo Admin') : t('Đã tắt báo cáo Admin'));
        fetchData();
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
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
      toast.error(t('Vui lòng nhập ID Sheets'));
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
        toast.error(json.message || t('Không thể lấy được danh sách cột từ Google Sheet. Hãy chắc chắn bạn đã chia sẻ quyền "Người xem" cho Sheet.'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    } finally {
      setIsFetchingColumns(false);
    }
  };

  const webhookUrl = (token: string) => `${BASE_WEBHOOK}?token=${token}`;

  return (
    <>
      <div className="responsive-flex-row responsive-height-auto" style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 66px - 3rem)', minHeight: 0, animation: 'fadeIn 0.3s' }}>
        {/* LEFT PANEL: Sheet connections list */}
        <div className={`responsive-filter-item ${mobileActiveView === 'detail' ? 'hide-on-mobile' : ''}`} style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h1 className="page-title" style={{ letterSpacing: '-0.025em', marginBottom: 4 }}>{t('Tích hợp Data')}</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('Quản lý các nguồn đổ Data')}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button 
              onClick={() => setShowAddConn(true)} 
              className="btn primary hover-lift" 
              style={{ 
                width: '100%', 
                justifyContent: 'center', 
                height: 40, 
                borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                fontWeight: 700
              }}
            >
              <FileSpreadsheet size={16} /> {t('Thêm kết nối Sheets')}
            </button>
            <button onClick={() => setShowAddApi(true)} className="btn primary hover-lift" style={{ width: '100%', justifyContent: 'center', height: 40, borderRadius: 10 }}>
              <Zap size={16} /> {t('Thêm API Landing Page')}
            </button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem' }}>
            {/* Virtual Connection for Master Sync */}
            <div
              onClick={() => {
                setSelected({
                  id: -999,
                  sheet_name: t('Đồng bộ 2 chiều Tổng'),
                  connection_type: 'master_sync',
                  webhook_token: 'SYSTEM_GLOBAL',
                  is_active: masterEnabled ? 1 : 0
                } as any);
                setMobileActiveView('detail');
              }}
              style={{
                background: selected && selected.id === -999 ? 'var(--color-primary-light)' : 'var(--color-surface)',
                border: `1px solid ${selected && selected.id === -999 ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 12, padding: '0.875rem 1rem', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', overflow: 'hidden'
              }}
            >
              {selected && selected.id === -999 && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--color-primary)' }} />}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: selected && selected.id === -999 ? 'var(--color-primary-light)' : 'var(--color-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                border: selected && selected.id === -999 ? '1px solid var(--color-primary)' : '1px solid var(--color-border)'
              }}>
                <Database size={20} color={selected && selected.id === -999 ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t('Đồng bộ 2 chiều Tổng')}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {masterEnabled ? t('Đang hoạt động') : t('Đang tắt')}
                </p>
              </div>
              <ChevronRight size={14} color="var(--color-text-muted)" />
            </div>

            {/* Separator line between Master sync and other connections */}
            <div style={{ borderBottom: '1px solid var(--color-border)', margin: '4px 0' }} />

            {connections.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 12, border: '1px dashed var(--color-border)', margin: '1rem 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: 'var(--shadow-sm)' }}>
                  <Link2 size={24} color="var(--color-text-muted)" />
                </div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>{t('Chưa có tích hợp')}</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Thêm kết nối Sheets đầu tiên của bạn.')}</p>
              </div>
            ) : connections.map(conn => {
              const isSelected = selected && Number(selected.id) === Number(conn.id);
              return (
                <div
                  key={conn.id}
                  onClick={() => { setSelected(conn); setMobileActiveView('detail'); }}
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
                  }} title={conn.is_silent ? t("Chỉ đồng bộ check trùng") : undefined}>
                    {conn.connection_type === 'landing_page' ? (
                      <Zap size={20} color={isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                    ) : conn.is_silent ? (
                      <Copy size={20} color="#eab308" style={{ opacity: isSelected ? 1 : 0.7 }} />
                    ) : (
                      <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" style={{ width: 20, height: 20, objectFit: 'contain', opacity: isSelected ? 1 : 0.6 }} alt={t("Google Sheets")} />
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conn.sheet_name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {conn.connection_type === 'landing_page' ? t('Nhận Data qua API') : t('{count} cột đã map').replace('{count}', String((conn.mappings || []).length))}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span 
                      style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        background: !conn.is_active 
                          ? 'var(--color-border)' 
                          : conn.sync_status === 'error' 
                            ? 'var(--color-danger)' 
                            : conn.sync_status === 'syncing' 
                              ? '#eab308' 
                              : 'var(--color-success)',
                        boxShadow: conn.is_active && conn.sync_status === 'error' 
                          ? '0 0 8px var(--color-danger)' 
                          : conn.is_active && conn.sync_status === 'syncing' 
                            ? '0 0 8px #eab308' 
                            : 'none'
                      }} 
                    />
                    <ChevronRight size={14} color="var(--color-text-muted)" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL: Selected sheet config */}
        <div className={mobileActiveView === 'list' ? 'hide-on-mobile' : ''} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Back button on mobile */}
          <div className="mobile-only" style={{ marginBottom: '0.25rem' }}>
            <button
              onClick={() => setMobileActiveView('list')}
              className="btn outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: 36, padding: '0 10px', fontSize: '0.8125rem' }}
            >
              <ChevronLeft size={16} /> {t('Quay lại')} danh sách
            </button>
          </div>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Webhook size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{t('Chọn một kết nối Sheets để cấu hình')}</p>
                <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>{t('hoặc tạo kết nối mới ở cột trái')}</p>
              </div>
            </div>
          ) : selected.id === -999 ? (
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Database size={24} color="var(--color-primary)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    {t('Đồng bộ 2 chiều Tổng (Master Sync)')}
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {t('Ghi nhận và đồng bộ tất cả Lead từ mọi nguồn lên 1 Sheet duy nhất')}
                  </p>
                </div>
              </div>

              {/* Configuration Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
                <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{t('Kích hoạt Đồng bộ 2 chiều Tổng')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Tự động ghi nhận lead từ mọi nguồn và cập nhật thay đổi ngược lên Sheet.')}</div>
                  </div>
                  <ToggleSwitch
                    checked={masterEnabled}
                    onChange={(val) => setMasterEnabled(val)}
                  />
                </div>

                {masterEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>
                        {t('Google Apps Script Web App URL')} <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={t("https://script.google.com/macros/s/.../exec")}
                          value={masterUrl}
                          onChange={e => setMasterUrl(e.target.value)}
                          style={{ flex: 1, background: 'var(--color-surface)', color: 'var(--color-text)' }}
                        />
                        <button
                          className="btn outline"
                          style={{ height: 40, whiteSpace: 'nowrap', padding: '0 1rem', borderRadius: 10 }}
                          disabled={isTestingMaster || !masterUrl.trim()}
                          onClick={async () => {
                            setIsTestingMaster(true);
                            try {
                              const res = await fetchAPI('test_master_sync', {
                                method: 'POST',
                                body: JSON.stringify({
                                  google_script_url: masterUrl,
                                  sheet_name: masterSheetName
                                })
                              });
                              if (res.success) {
                                toast.success(t('Kết nối thử nghiệm thành công! Hãy kiểm tra sheet của bạn.'));
                              } else {
                                toast.error(t('Kiểm thử thất bại: ') + (res.message || ''));
                              }
                            } catch (e: any) {
                              toast.error(t('Lỗi kết nối thử nghiệm: ') + e.message);
                            } finally {
                              setIsTestingMaster(false);
                            }
                          }}
                        >
                          {isTestingMaster ? t('Đang kiểm tra...') : t('Kiểm thử')}
                        </button>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {t('URL Web App Google Apps Script triển khai từ Sheet Tổng.')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>
                        {t('Tên Trang tính (Sheet Name)')}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t("e.g. Sheet1, để trống để dùng trang tính đầu tiên")}
                        value={masterSheetName}
                        onChange={e => setMasterSheetName(e.target.value)}
                        style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
                  <button
                    className="btn primary"
                    style={{ height: 38, padding: '0 1.5rem', background: 'var(--color-primary)', color: '#fff', borderRadius: 10, fontWeight: 600 }}
                    disabled={isSavingMaster || (masterEnabled && !masterUrl.trim())}
                    onClick={async () => {
                      setIsSavingMaster(true);
                      try {
                        const res = await fetchAPI('save_settings', {
                          method: 'POST',
                          body: JSON.stringify({
                            master_two_way_sync: masterEnabled ? '1' : '0',
                            master_google_script_url: masterUrl,
                            master_sheet_name: masterSheetName
                          })
                        });
                        if (res.success) {
                          toast.success(t('Đã lưu cấu hình Đồng bộ 2 chiều Tổng!'));
                          // Refresh to update left list active label
                          fetchData();
                        } else {
                          toast.error(t('Lưu thất bại: ') + (res.message || ''));
                        }
                      } catch (e: any) {
                        toast.error(t('Lỗi kết nối: ') + e.message);
                      } finally {
                        setIsSavingMaster(false);
                      }
                    }}
                  >
                    {isSavingMaster ? t('Đang lưu...') : t('Lưu cài đặt')}
                  </button>
                </div>
              </div>

              {/* Instructions & Code Block */}
              <div style={{ background: 'rgba(189, 29, 45,0.05)', border: '1px solid rgba(189, 29, 45,0.2)', padding: '1.25rem', borderRadius: 12, fontSize: '0.85rem', color: 'var(--color-text-light)', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--color-primary)' }}>
                  <Info size={16} /> {t('Hướng dẫn cài đặt Google Apps Script cho Sheet Tổng:')}
                </div>
                <ol style={{ paddingLeft: '1.25rem', margin: '0 0 1rem 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li>{t('Tạo 1 bảng tính Google Sheet mới để chứa toàn bộ dữ liệu tổng.')}</li>
                  <li>{t('Chọn')} <strong>{t('Tiện ích mở rộng (Extensions)')}</strong> &gt; <strong>{t('Apps Script')}</strong>.</li>
                  <li>{t('Xóa mã mặc định và dán đoạn mã bên dưới vào.')}</li>
                  <li>{t('Nhấp vào')} <strong>{t('Triển khai (Deploy)')}</strong> &gt; <strong>{t('Triển khai mới (New deployment)')}</strong>.</li>
                  <li>{t('Chọn loại cấu hình là')} <strong>{t('Ứng dụng web (Web app)')}</strong>.</li>
                  <li>{t('Cấu hình: Người thực thi:')} <em>{t('"Tôi" (Me)')}</em>{t(', Ai có quyền truy cập:')} <em>{t('"Bất kỳ ai" (Anyone)')}</em>.</li>
                  <li>{t('Nhấp Triển khai, phê duyệt quyền truy cập của Google, sau đó sao chép')} <strong>{t('URL ứng dụng web (Web app URL)')}</strong> {t('và dán vào cấu hình phía trên.')}</li>
                </ol>

                <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('Mã nguồn Google Apps Script:')}</span>
                  <button
                    className="btn outline"
                    style={{ height: 26, padding: '0 8px', fontSize: '0.75rem', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => {
                      navigator.clipboard.writeText(masterAppsScriptCode);
                      toast.success(t('Đã sao chép mã nguồn Apps Script!'));
                    }}
                  >
                    <Copy size={12} /> {t('Sao chép')}
                  </button>
                </div>
                <pre style={{
                  maxHeight: '200px', overflowY: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  padding: '10px', borderRadius: 8, fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-muted)'
                }}>
                  {masterAppsScriptCode}
                </pre>
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
                    }} title={selected.is_silent ? t("Chỉ đồng bộ check trùng") : undefined}>
                      {selected.connection_type === 'landing_page' ? (
                        <Zap size={24} color="var(--color-primary)" />
                      ) : selected.is_silent ? (
                        <Copy size={24} color="#eab308" />
                      ) : (
                        <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" style={{ width: 24, height: 24, objectFit: 'contain' }} alt={t("Google Sheets")} />
                      )}
                    </div>
                    <div>
                      {selected.spreadsheet_id ? (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${selected.spreadsheet_id}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t("Mở Google Sheets")}
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
                        {t('Lần cuối:')} {new Date(selected.last_sync_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
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
                              toast.success(t('Đã đồng bộ dữ liệu thủ công!'));
                              fetchData(); // Refresh to update last_sync_at on screen
                            } else {
                              toast.error(t('Đồng bộ thất bại: ') + (res.message || ''));
                            }
                          } catch (e: any) {
                            toast.error(t('Lỗi kết nối: ') + e.message);
                          }
                          setIsSyncing(false);
                        }}
                      >
                        <RefreshCw size={14} className={isSyncing ? 'spin' : ''} /> {isSyncing ? t('Đang đồng bộ...') : t('Đồng bộ ngay')}
                      </button>
                    )}

                    <button
                      className="btn outline"
                      style={{ padding: 8, borderRadius: 8, height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                      title={t("Chỉnh sửa cấu hình đồng bộ & email")}
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
                        setEditTwoWaySync(Boolean(Number(selected.two_way_sync)));
                        setEditGoogleScriptUrl(selected.google_script_url || '');
                        setEditLeadRecallMinutes(Number(selected.lead_recall_minutes) || 0);
                        const existingTemplate = selected.email_template || '';
                        setEditEmailTemplate(
                          existingTemplate ||
                          generateDefaultTemplate(
                            (selected.mappings || []).map(m => ({
                              sheet_col: m.sheet_column,
                              sys_field: m.system_field,
                              custom_label: m.custom_label
                            })),
                            t
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
                      <Target size={14} color="var(--color-text-muted)" /> {selected.stats.total} {t('Tổng')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> {selected.stats.assigned} {t('Đã chia')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <Copy size={14} /> {selected.stats.duplicate} {t('Trùng')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <RefreshCw size={14} /> {selected.stats.reminder} {t('Nhắc lại')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <AlertCircle size={14} /> {selected.stats.error} {t('Lỗi')}
                    </div>
                  </div>
                )}

                {selected.spreadsheet_id && selected.sync_status === 'error' && (
                  <div style={{
                    marginTop: '1rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 12,
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    animation: 'fadeIn 0.2s ease-out'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-danger)'
                      }}>
                        <AlertCircle size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-danger)', margin: 0 }}>
                          {t('LỖI ĐỒNG BỘ TRANG TÍNH')}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'rgba(220, 38, 38, 0.8)', marginTop: 2 }}>
                          {t('Phát hiện sự cố đồng bộ tự động với Google Sheets')}
                        </p>
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.02)',
                      border: '1px solid rgba(239, 68, 68, 0.1)',
                      borderRadius: 8,
                      padding: '0.75rem',
                      fontSize: '0.8125rem',
                      fontFamily: 'monospace',
                      color: 'var(--color-danger)',
                      wordBreak: 'break-all'
                    }}>
                      {selected.last_error || 'Unknown error occurred during CSV parsing.'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: 6, alignItems: 'center', lineHeight: '1.4' }}>
                      <Info size={14} style={{ flexShrink: 0 }} />
                      <span><strong>{t('Hướng dẫn khắc phục:')}</strong> {t('Vui lòng đảm bảo bảng tính có ID:')} <code>{selected.spreadsheet_id}</code> {t('được thiết lập chia sẻ quyền truy cập "Người xem" (Viewer) công khai cho bất kỳ ai có liên kết, và tên Sheet được khớp chính xác.')}</span>
                    </div>
                  </div>
                )}

                {selected.spreadsheet_id && selected.sync_status === 'syncing' && (
                  <div style={{
                    marginTop: '1rem',
                    background: 'rgba(234, 179, 8, 0.08)',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    borderRadius: 12,
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    animation: 'fadeIn 0.2s ease-out'
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(234, 179, 8, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#d97706'
                    }}>
                      <RefreshCw size={18} className="spin" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#d97706', margin: 0 }}>
                        {t('ĐANG ĐỒNG BỘ DỮ LIỆU...')}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 2 }}>
                        {t('Tiến trình quét và chia data từ Google Sheets đang chạy ngầm')}
                      </p>
                    </div>
                  </div>
                )}

                {selected.spreadsheet_id && selected.sync_status !== 'error' && selected.sync_status !== 'syncing' && (
                  <div style={{
                    marginTop: '1rem',
                    background: 'rgba(21, 128, 61, 0.05)',
                    border: '1px solid rgba(21, 128, 61, 0.22)',
                    borderRadius: 12,
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    animation: 'fadeIn 0.2s ease-out'
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(21, 128, 61, 0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#15803d'
                    }}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#15803d', margin: 0 }}>
                        {t('ĐỒNG BỘ HOẠT ĐỘNG BÌNH THƯỜNG')}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: '#166534', opacity: 0.9, marginTop: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        {t('Kết nối với ID')} 
                        <code style={{
                          fontFamily: 'monospace',
                          background: 'rgba(21, 128, 61, 0.08)',
                          color: '#15803d',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(21, 128, 61, 0.18)',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          wordBreak: 'break-all'
                        }}>
                          {selected.spreadsheet_id}
                        </code> 
                        {t('hoạt động ổn định và sẵn sàng đồng bộ')}
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t('Yêu cầu bắt buộc có Số Điện Thoại')}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {t('Nếu bật, dòng dữ liệu trên Sheets phải có')} <strong>{t('Số Điện Thoại (Phone)')}</strong> {t('mới được đồng bộ vào hệ thống.')}
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
                      width: 18, height: 18, borderRadius: '50%', background: 'var(--color-surface)',
                      position: 'absolute', top: 3, left: selected.require_both_contact ? 23 : 3,
                      transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>

                <div style={{ marginTop: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t('Thông báo cho Admin khi có Data mới')}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {t('Nếu bật, hệ thống sẽ tự động gửi báo cáo chi tiết cho các Admin qua Zalo/Email mỗi khi có data mới đổ về.')}
                    </p>
                  </div>
                  <div
                    onClick={() => handleToggleNotifyAdmin(selected)}
                    style={{
                      width: 44, height: 24, borderRadius: 24, cursor: 'pointer', position: 'relative',
                      background: selected.notify_admin ? 'var(--color-success)' : 'var(--color-border)',
                      transition: 'background 0.3s'
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: 'var(--color-surface)',
                      position: 'absolute', top: 3, left: selected.notify_admin ? 23 : 3,
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
                        {t('Nhúng đoạn mã sau vào Landing Page của bạn (HTML hoặc Script)')}
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: '12px 16px', background: 'var(--color-info-light)', border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.5 }}>
                      <strong>{t('Cơ chế tự động gom Ghi chú:')}</strong>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                        <li>{t('Hệ thống tự nhận các key chuẩn:')} <code>phone, email, name, source, type</code></li>
                        <li><strong>{t('Tất cả các key khác')}</strong> {t('(VD:')} <code>utm_campaign, chieu_cao</code>{t(') sẽ tự động được gộp lại và lưu vào trường')} <strong>{t('Ghi Chú (note)')}</strong>.</li>
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
                      {copiedId === selected.id ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copiedId === selected.id ? t('Đã copy') : t('Copy Code')}
                    </button>
                    <pre style={{ margin: 0, color: '#dadada', fontSize: '0.8125rem', fontFamily: 'monospace', marginTop: 12 }}>
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
                        <Tag size={16} color="var(--color-primary)" /> {t('Mapping Cột cho')} <em style={{ fontStyle: 'normal', color: 'var(--color-primary)' }}>{selected.sheet_name}</em>
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {t('Ánh xạ tên cột trên Google Sheets này sang trường dữ liệu của hệ thống')}
                      </p>
                    </div>
                  </div>

                  {/* Add Mapping Row at the TOP */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', background: 'var(--color-bg)', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label className="form-label" style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>{t('Tên cột trên Sheets')}</label>
                      {isFetchingSelectedCols ? (
                        <div style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-border)' }}>
                          <RefreshCw size={14} className="spin" /> {t('Đang quét cột...')}
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
                          placeholder={t("VD: Số Điện Thoại KH")}
                          value={newMappingCol}
                          onChange={e => setNewMappingCol(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveMapping()}
                        />
                      )}
                    </div>
                    <div style={{ flex: '1 1 180px' }}>
                      <label className="form-label" style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>{t('Trường hệ thống')}</label>
                      <CustomSelect
                        options={getSelectFields()}
                        value={newMappingField}
                        onChange={(val) => setNewMappingField(String(val))}
                      />
                    </div>
                    <div style={{ flex: '1 1 220px' }}>
                      <label className="form-label" style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>{t('Tên hiển thị trong Email (Tùy chọn)')}</label>
                      <input
                        className="form-input"
                        placeholder={t("VD: Khung giờ tư vấn")}
                        value={newMappingCustomLabel}
                        onChange={e => setNewMappingCustomLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveMapping()}
                      />
                    </div>
                    <div className="mapping-btn-container" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <button className="btn primary" onClick={handleSaveMapping} disabled={isSavingMapping} style={{ flexShrink: 0, height: 42, background: editingMappingId ? 'var(--color-warning)' : 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                        {isSavingMapping ? t('Đang lưu...') : (editingMappingId ? t('Cập nhật') : <><Plus size={16} /> {t('Thêm')}</>)}
                      </button>
                      {editingMappingId && (
                        <button className="btn outline" onClick={cancelEditMapping} style={{ flexShrink: 0, height: 42, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, padding: '0 0.75rem' }}>
                          {t('Hủy')}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '12px 16px', background: 'var(--color-info-light)', border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.5 }}>
                      <strong>{t('Mẹo cấu hình:')}</strong> {t('Bạn có thể map')} <strong>{t('nhiều cột trên Sheets')}</strong> {t('vào')} <strong>{t('cùng 1 trường hệ thống')}</strong> {t('(ví dụ: Nguồn Data = Cột UTM Source + Cột Campaign, hoặc Ghi Chú = Sở thích + Khung giờ). Hệ thống sẽ tự động gộp dữ liệu lại cho bạn!')}
                    </p>
                  </div>

                  {/* Mappings Table BELOW */}
                  <div className="responsive-table-wrap" style={{ marginBottom: '1rem' }}>
                    <table style={{ tableLayout: 'fixed', width: '100%', minWidth: 650 }}>
                      <colgroup>
                        <col style={{ width: '45%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '8%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>{t('Tên cột trên Google Sheets')}</th>
                          <th>{t('Trường hiển thị trong Email')}</th>
                          <th>{t('Trường hệ thống')}</th>
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
                                <span className="badge success" style={{ padding: '4px 10px', fontSize: '0.875rem' }}>
                                  {m.custom_label}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>
                                  {t('Để mặc định (Tên cột)')}
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '4px 10px', borderRadius: 6, fontSize: '0.875rem', fontWeight: 700 }}>
                                {t(SYSTEM_FIELDS.find(f => f.value === m.system_field)?.label || m.system_field)}
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
                                title={t("Chỉnh sửa mapping")}
                                style={{ padding: 6, borderRadius: 8, color: 'var(--color-text-muted)', transition: 'all 0.2s', background: editingMappingId === m.id ? 'var(--color-warning-light)' : 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget.style.color = 'var(--color-warning)'); (e.currentTarget.style.background = 'var(--color-warning-light)'); }}
                                onMouseLeave={e => { (e.currentTarget.style.color = 'var(--color-text-muted)'); (e.currentTarget.style.background = editingMappingId === m.id ? 'var(--color-warning-light)' : 'transparent'); }}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteMapping(m.id)}
                                title={t("Xóa mapping")}
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
                              {t('Chưa có mapping nào. Hãy thêm cột ở trên.')}
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
        title={t("Kết nối Google Sheets")}
        width="700px"
      >
        {showAddConn && (
          <div style={{ padding: '1.5rem', background: 'var(--color-surface)' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 1, background: 'var(--color-border)', zIndex: 0 }}></div>
            {[1, 2, 3].map(step => (
              <div key={step} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: addStep >= step ? 'var(--color-primary)' : 'var(--color-bg)',
                color: addStep >= step ? 'white' : 'var(--color-text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.875rem', position: 'relative', zIndex: 1,
                border: addStep >= step ? 'none' : '1px solid var(--color-border)'
              }}>
                {step}
              </div>
            ))}
          </div>

          {addStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t('Cấu hình Google Sheets')} <div style={{ background: 'var(--color-primary)', color: 'white', padding: '2px 6px', borderRadius: 6, fontSize: '0.75rem' }}><FileSpreadsheet size={14} /></div>
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Kết nối bảng tính của bạn để tự động nạp dữ liệu Khách hàng.')}</p>
              </div>

              <div style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-hover)', borderRadius: 12, padding: '1rem 1.25rem', color: 'var(--color-primary)', fontSize: '0.875rem' }}>
                <p style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><Info size={16} /> {t('Hướng dẫn nhanh:')}</p>
                <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.6 }}>
                  <li>{t('Bấm nút')} <strong>{t('Chia sẻ (Share)')}</strong> {t('trên file Google Sheets.')}</li>
                  <li>{t('Tại phần')} <strong>{t('Quyền truy cập chung')}</strong>{t(', chọn')} <strong>{t('Bất kỳ ai có liên kết')}</strong> {t('và đặt quyền là')} <strong>{t('Người xem')}</strong>.</li>
                  <li>{t('Copy')} <strong>Spreadsheet ID</strong> {t('từ URL trình duyệt (chuỗi ký tự nằm giữa d/ và /edit).')}</li>
                </ol>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>{t('Đường dẫn Google Sheet (hoặc ID)')}</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 10, left: 12, color: '#94a3b8' }}><Link2 size={16} /></div>
                  <input
                    className="form-input"
                    style={{ paddingLeft: 36, background: 'var(--color-bg)', border: 'none' }}
                    placeholder={t("Dán link hoặc Spreadsheet ID vào đây...")}
                    value={newSpreadsheetId}
                    onChange={e => handleUrlChange(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>{t('Tên trang tính (Sheet Name)')}</label>
                {isFetchingSheets ? (
                  <div style={{ padding: '10px 12px', background: 'var(--color-border-light)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
                      style={{ background: 'var(--color-bg)', border: 'none', fontWeight: 600, color: 'var(--color-text)' }}
                      placeholder={t("VD: Sheet1")}
                      value={newConnName}
                      onChange={e => setNewConnName(e.target.value)}
                    />
                    {newSpreadsheetId.length >= 40 && (
                      <p style={{ fontSize: '0.75rem', color: '#eab308', marginTop: 4 }}>
                        💡 {t('Không quét được tự động. Vui lòng chia sẻ quyền')} "{t('Người xem')}" {t('cho Sheet để quét được danh sách trang tính.')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Chỉ đồng bộ check trùng */}
              <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{t('Chỉ đồng bộ check trùng (Không chia số)')}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>{t('Nếu bật, dữ liệu sẽ chỉ lưu vào CRM làm căn cứ lọc trùng, tuyệt đối không phân phối cho Sale và không thông báo.')}</div>
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
                  <div style={{ background: 'var(--color-success-light)', border: '1px dashed var(--color-success)', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s ease-in-out' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '0.875rem' }}>{t('Đồng bộ Salesperson & Báo trùng')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Tìm và gắn Sale phụ trách (theo email). Nếu trùng khớp với Sale đang có trong CRM, hệ thống sẽ gửi thông báo báo trùng cho Sale.')}</div>
                    </div>
                    <ToggleSwitch
                      checked={syncSaleperson}
                      onChange={setSyncSaleperson}
                    />
                  </div>
                  {syncSaleperson && (
                    <div style={{ background: 'var(--color-info-light)', border: '1px solid var(--color-info)', padding: '1rem', borderRadius: 12, marginTop: '-0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--color-info)', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Info size={14} color="#3b82f6" /> Hướng dẫn cấu hình:
                      </div>
                      {t('Vui lòng tiến hành')} <strong>{t('Cấu hình trường (Mapping)')}</strong> {t('ở Bước kế tiếp: Map cột chứa Email (hoặc Tên) của Sale trên Google Sheets với trường hệ thống')} <strong>"{t('Salesperson (Tên/Email Sale)')}"</strong> {t('để kích hoạt tính năng này.')}
                    </div>
                  )}
                </>
              )}

              {!isSilent && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, margin: 0 }}>{t('Chu kỳ đồng bộ')}</label>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer' }}>{t('(?) Cơ chế hoạt động?')}</span>
                  </div>

                  <div className="responsive-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
                    {[
                      { id: '5p', icon: <Zap size={20} />, time: '5p', label: t('NHANH') },
                      { id: '15p', icon: <Clock size={20} />, time: '15p', label: t('CHUẨN') },
                      { id: '1h', icon: <Clock size={20} />, time: '1h', label: t('ỔN ĐỊNH') },
                      { id: '1d', icon: <Target size={20} />, time: t('1 ngày'), label: t('TIẾT KIỆM') },
                      { id: 'custom', icon: <Plus size={20} />, time: t('Khác'), label: t('TÙY CHỈNH') }
                    ].map(preset => (
                      <div
                        key={preset.id}
                        onClick={() => setSyncPreset(preset.id as any)}
                        style={{
                          border: syncPreset === preset.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background: syncPreset === preset.id ? 'var(--color-primary-light)' : 'var(--color-surface)',
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
                <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ width: 140 }}>
                    <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>{t('Số phút tùy chỉnh')}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number" min={1} className="form-input"
                        value={customSyncMins} onChange={e => setCustomSyncMins(Number(e.target.value))}
                        style={{ border: 'none', fontWeight: 700, fontSize: '1rem' }}
                      />
                      <span style={{ position: 'absolute', right: 12, top: 10, color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>{t('phút')}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    Lưu ý: Thời gian quá ngắn (dưới 5 phút) có thể khiến Google giới hạn băng thông.
                  </div>
                </div>
              )}

              {!isSilent && (
                <div style={{ marginTop: '1rem', background: 'var(--color-bg)', padding: '1rem', borderRadius: 12 }}>
                  <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, marginBottom: '0.5rem', display: 'block' }}>{t('Chế độ quét dữ liệu')}</label>
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
                        <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{t('Quét toàn bộ Data hiện có')}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Hút toàn bộ dữ liệu đang có sẵn trên Sheets vào CRM (Mặc định).')}</div>
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
                        <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{t('Chỉ quét Data mới (Bỏ qua Data cũ)')}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Hệ thống sẽ chạy ngầm đánh dấu bỏ qua toàn bộ dòng cũ. Chỉ những dòng được thêm vào SAU KHI kết nối mới được hút vào CRM.')}</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div style={{ position: 'sticky', bottom: '-24px', background: 'var(--color-surface)', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', paddingBottom: '1rem', borderTop: '1px solid var(--color-border)', marginLeft: '-24px', marginRight: '-24px', paddingLeft: '24px', paddingRight: '24px' }}>
                <span onClick={() => setShowAddConn(false)} style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>{t('Quay lại')}</span>
                <button
                  className="btn"
                  onClick={handleFetchColumns}
                  disabled={isFetchingColumns}
                  style={{ background: 'var(--color-primary)', color: 'white', fontWeight: 700, padding: '0.75rem 1.5rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {isFetchingColumns ? <RefreshCw size={16} className="spin" /> : null}
                  {isFetchingColumns ? t('Đang kiểm tra...') : t('Kiểm tra kết nối')} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {addStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Cấu hình Trường dữ liệu')}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Ánh xạ các cột trên Google Sheets của bạn vào hệ thống Rich Land DATA.')}</p>
              </div>

              {/* Add Mapping Row at the TOP */}
              <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('Cột trên Sheets')}</label>
                  {fetchedColumns.length > 0 ? (
                    <CustomSelect
                      options={fetchedColumns.map(c => ({ value: c, label: c }))}
                      value={newMappingCol}
                      onChange={v => setNewMappingCol(String(v))}
                    />
                  ) : (
                    <input className="form-input" style={{ border: '1px solid var(--color-border)' }} value={newMappingCol} onChange={e => setNewMappingCol(e.target.value)} placeholder={t("VD: Nguồn KH")} />
                  )}
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('Trường hệ thống')}</label>
                  <CustomSelect options={getSelectFields()} value={newMappingField} onChange={v => setNewMappingField(String(v))} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('Tên hiển thị trong Email (Tùy chọn)')}</label>
                  <input
                    className="form-input"
                    style={{ border: '1px solid var(--color-border)', height: 38 }}
                    placeholder={t("VD: Khung giờ tư vấn")}
                    value={newMappingCustomLabel}
                    onChange={e => setNewMappingCustomLabel(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    if (!newMappingCol) return;
                    const colCleaned = newMappingCol.trim();
                    if (!colCleaned) return;

                    // 1. Check duplicate sheet_col and sys_field mapping
                    const isDuplicateExact = tempMappings.some(
                      m => m.sheet_col.toLowerCase() === colCleaned.toLowerCase() && m.sys_field === newMappingField
                    );
                    if (isDuplicateExact) {
                      toast.error(t('Liên kết này đã tồn tại trong danh sách.'));
                      return;
                    }

                    // 2. Check duplicate mapping for unique system fields
                    const uniqueFields = ['phone', 'email', 'name', 'assigned_to', 'saleperson'];
                    if (uniqueFields.includes(newMappingField)) {
                      const isUniqueMapped = tempMappings.some(m => m.sys_field === newMappingField);
                      if (isUniqueMapped) {
                        const fieldLabel = SYSTEM_FIELDS.find(f => f.value === newMappingField)?.label || newMappingField;
                        toast.error(t("Trường '{fieldLabel}' đã được liên kết với một cột khác.").replace('{fieldLabel}', t(fieldLabel)));
                        return;
                      }
                    }

                    setTempMappings([...tempMappings, { sheet_col: colCleaned, sys_field: newMappingField, custom_label: newMappingCustomLabel.trim() }]);
                    setNewMappingCustomLabel('');
                  }}
                  className="btn"
                  style={{ background: 'var(--color-primary)', color: 'white', height: 38, padding: '0 1rem', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                >
                  <Plus size={16} /> Thêm
                </button>
              </div>

              {/* Mappings Table BELOW */}
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }} className="responsive-table-wrap">
                <div className="responsive-mapping-header" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 40px', background: 'var(--color-bg)', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  <div>{t('Tên cột trên Sheets')}</div>
                  <div>{t('Trường hiển thị trong Email')}</div>
                  <div>{t('Trường hệ thống')}</div>
                  <div></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {tempMappings.map((m, idx) => (
                    <div key={idx} className="responsive-mapping-row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 40px', padding: '0.75rem 1rem', borderBottom: idx < tempMappings.length - 1 ? '1px solid var(--color-border-light)' : 'none', alignItems: 'center' }}>
                      <div
                        title={m.sheet_col}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: 'var(--color-text)',
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
                          <span className="badge success" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
                            {m.custom_label}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>{t('Mặc định')}</span>
                        )}
                      </div>
                      <div style={{ color: 'var(--color-text-secondary, #475569)', fontSize: '0.875rem', fontWeight: 700 }}>{t(SYSTEM_FIELDS.find(f => f.value === m.sys_field)?.label || m.sys_field)}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => setTempMappings(tempMappings.filter((_, i) => i !== idx))} style={{ color: 'var(--color-danger)', background: 'var(--color-danger-light)', border: 'none', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {tempMappings.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                      {t('Chưa có mapping nào. Hãy thêm cột ở trên.')}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ position: 'sticky', bottom: '-24px', background: 'var(--color-surface)', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', paddingBottom: '1rem', borderTop: '1px solid var(--color-border)', marginLeft: '-24px', marginRight: '-24px', paddingLeft: '24px', paddingRight: '24px' }}>
                <span onClick={() => setAddStep(1)} style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>{t('Quay lại')}</span>
                <button
                  className="btn"
                  onClick={() => {
                    if (tempMappings.length === 0) {
                      toast.error(t('Vui lòng thêm ít nhất một liên kết cột.'));
                      return;
                    }
                    const hasPhone = tempMappings.some(m => m.sys_field === 'phone');
                    const hasEmail = tempMappings.some(m => m.sys_field === 'email');
                    if (!hasPhone && !hasEmail) {
                      toast.error(t('Bắt buộc phải liên kết cột Số Điện Thoại hoặc Email.'));
                      return;
                    }
                    setEmailTemplate(generateDefaultTemplate(tempMappings, t));
                    setAddStep(3);
                  }}
                  style={{ background: 'var(--color-primary)', color: 'white', fontWeight: 700, padding: '0.75rem 1.5rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {t('Tiếp tục thiết lập Email')} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {addStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Thiết lập Mẫu Email giao Data')}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Cấu hình nội dung thông tin Khách hàng sẽ được gửi cho Sale khi có Data mới.')}</p>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>{t('Mẫu nội dung (Hỗ trợ biến)')}</label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    className="form-input"
                    style={{ minHeight: 150, background: 'var(--color-bg)', border: '1px solid var(--color-border)', lineHeight: 1.6, fontFamily: 'monospace', fontSize: '0.875rem' }}
                    value={emailTemplate}
                    onChange={e => setEmailTemplate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {getSelectFields().map(f => (
                    <span key={f.value} onClick={() => setEmailTemplate(emailTemplate + `\n${f.label}: {${f.value}}`)} style={{ cursor: 'pointer', background: 'var(--color-border-light)', color: 'var(--color-text)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border)' }}>
                      {'{'}{f.value}{'}'}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ position: 'sticky', bottom: '-24px', background: 'var(--color-surface)', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', paddingBottom: '1rem', borderTop: '1px solid var(--color-border)', marginLeft: '-24px', marginRight: '-24px', paddingLeft: '24px', paddingRight: '24px' }}>
                <span onClick={() => setAddStep(2)} style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>{t('Quay lại')}</span>
                <button className="btn" onClick={handleAddConnection} style={{ background: 'var(--color-primary)', color: 'white', fontWeight: 700, padding: '0.75rem 1.5rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t('Hoàn tất kết nối')} <CheckCircle2 size={16} />
                </button>
              </div>
            </div>
          )}

        </div>
        )}
      </CustomModal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDeleteConnection}
        title={t("Xóa Kết Nối Sheets")}
        message={t("Bạn có chắc chắn muốn xóa kết nối Sheets này? Toàn bộ Mapping sẽ bị xóa vĩnh viễn và không thể phục hồi.")}
      />

      <ConfirmModal
        isOpen={showPauseWarning}
        onClose={() => setShowPauseWarning(false)}
        onConfirm={() => selected && doToggleActive(selected)}
        title={t("⏸ Tạm dừng kết nối?")}
        message={t('Khi tạm dừng kết nối "{name}":\n\n• Cổng nhận dữ liệu sẽ ngừng tiếp nhận khách hàng mới từ Google Sheets.\n• Tiến trình đồng bộ tự động sẽ dừng hoàn toàn.\n• Dữ liệu hiện có sẽ được giữ nguyên.\n\nBạn có thể bật lại bất cứ lúc nào.').replace('{name}', selected?.sheet_name || '')}
        confirmText={t("Tạm dừng")}
        cancelText={t('Hủy bỏ')}
      />

      <ConfirmModal
        isOpen={isConfirmMappingOpen}
        onClose={() => setIsConfirmMappingOpen(false)}
        onConfirm={handleConfirmDeleteMapping}
        title={t("Xóa mapping cột")}
        message={t("Bạn có chắc chắn muốn xóa mapping cột dữ liệu này không?")}
      />

      <CustomModal
        isOpen={showEditConn}
        onClose={() => setShowEditConn(false)}
        title={selected?.connection_type === 'landing_page' ? t("Chỉnh sửa cấu hình Landing Page") : t("Chỉnh sửa cấu hình đồng bộ")}
        width="600px"
      >
        {showEditConn && (
          <div style={{ padding: '1.5rem', background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {selected?.connection_type === 'landing_page' ? t('Cấu hình Landing Page') : t('Cấu hình chu kỳ đồng bộ')}
                <div style={{ background: 'var(--color-primary)', color: 'white', width: 22, height: 22, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected?.connection_type === 'landing_page' ? <Zap size={14} /> : <Clock size={14} />}
                </div>
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                {selected?.connection_type === 'landing_page'
                  ? t('Thay đổi cấu hình nhận dữ liệu và email cho {name}.').replace('{name}', selected?.sheet_name || 'Landing Page')
                  : t('Thay đổi thời gian hệ thống tự động tải dữ liệu từ {name}.').replace('{name}', selected?.sheet_name || 'Sheets')}
              </p>
            </div>

            {/* Chỉ đồng bộ check trùng */}
            <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{t('Chỉ đồng bộ check trùng (Không chia số)')}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Nếu bật, dữ liệu sẽ chỉ lưu vào CRM làm căn cứ lọc trùng, tuyệt đối không phân phối cho Sale và không thông báo.')}</div>
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
                <div style={{ background: 'var(--color-success-light)', border: '1px dashed var(--color-success)', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', transition: 'all 0.3s ease-in-out' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '0.875rem' }}>{t('Đồng bộ Salesperson & Báo trùng')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Tìm và gắn Sale phụ trách (theo email). Nếu trùng khớp với Sale đang có trong CRM, hệ thống sẽ gửi thông báo báo trùng cho Sale.')}</div>
                  </div>
                  <ToggleSwitch
                    checked={editSyncSaleperson}
                    onChange={setEditSyncSaleperson}
                  />
                </div>
                {editSyncSaleperson && (
                  <div style={{ background: 'var(--color-info-light)', border: '1px solid var(--color-info)', padding: '1rem', borderRadius: 12, marginTop: '-0.5rem', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--color-info)', lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Info size={14} color="#3b82f6" /> Hướng dẫn cấu hình:
                    </div>
                    {t('Hãy đảm bảo đã vào mục')} <strong>{t('Cấu hình trường (Mapping)')}</strong> {t('ở bảng chi tiết ngoài màn hình chính để map cột tương ứng với trường hệ thống')} <strong>"{t('Salesperson (Tên/Email Sale)')}"</strong>.
                  </div>
                )}
              </>
            )}

            {selected?.connection_type !== 'landing_page' && !editIsSilent && (
              <>
                {/* {t('Chu kỳ đồng bộ')} */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, margin: 0 }}>{t('Chu kỳ đồng bộ')}</label>
                  </div>

                  <div className="responsive-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
                    {[
                      { id: '5p', icon: <Zap size={20} />, time: '5p', label: t('NHANH') },
                      { id: '15p', icon: <Clock size={20} />, time: '15p', label: t('CHUẨN') },
                      { id: '1h', icon: <Clock size={20} />, time: '1h', label: t('ỔN ĐỊNH') },
                      { id: '1d', icon: <Target size={20} />, time: t('1 ngày'), label: t('TIẾT KIỆM') },
                      { id: 'custom', icon: <Plus size={20} />, time: t('Khác'), label: t('TÙY CHỈNH') }
                    ].map(preset => (
                      <div
                        key={preset.id}
                        onClick={() => setEditSyncPreset(preset.id as any)}
                        style={{
                          border: editSyncPreset === preset.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background: editSyncPreset === preset.id ? 'var(--color-primary-light)' : 'var(--color-surface)',
                          borderRadius: 12, padding: '0.75rem 0', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          transition: 'all 0.2s', opacity: editSyncPreset === preset.id ? 1 : 0.6
                        }}
                      >
                        <div style={{ color: editSyncPreset === preset.id ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{preset.icon}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: editSyncPreset === preset.id ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{preset.time}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: editSyncPreset === preset.id ? 'var(--color-primary-hover)' : 'var(--color-text-muted)' }}>{preset.label}</div>
                      </div>
                    ))}
                  </div>

                  {editSyncPreset === 'custom' && (
                    <div style={{ marginTop: 12, background: 'var(--color-bg)', padding: 12, borderRadius: 8, border: '1px dashed var(--color-border)' }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{t('Nhập số phút tùy chỉnh:')}</label>
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
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('phút')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* {t('Chế độ đồng bộ')} */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, margin: 0 }}>{t('Chế độ đồng bộ')}</label>
                  </div>

                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    <div
                      onClick={() => setEditSyncMode('all')}
                      style={{
                        border: editSyncMode === 'all' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: editSyncMode === 'all' ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        borderRadius: 12, padding: '1rem', cursor: 'pointer',
                        display: 'flex', gap: 12, transition: 'all 0.2s', opacity: editSyncMode === 'all' ? 1 : 0.6
                      }}
                    >
                      <div style={{ color: editSyncMode === 'all' ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: 2 }}><RefreshCw size={20} /></div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: editSyncMode === 'all' ? 'var(--color-primary)' : 'var(--color-text)' }}>{t('Tất cả dữ liệu')}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.4 }}>{t('Phân luồng từ dòng 1 đến cuối. (Phù hợp File mới hoàn toàn)')}</div>
                      </div>
                    </div>

                    <div
                      onClick={() => setEditSyncMode('new_only')}
                      style={{
                        border: editSyncMode === 'new_only' ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
                        background: editSyncMode === 'new_only' ? 'var(--color-warning-light)' : 'var(--color-surface)',
                        borderRadius: 12, padding: '1rem', cursor: 'pointer',
                        display: 'flex', gap: 12, transition: 'all 0.2s', opacity: editSyncMode === 'new_only' ? 1 : 0.6
                      }}
                    >
                      <div style={{ color: editSyncMode === 'new_only' ? 'var(--color-warning)' : 'var(--color-text-muted)', marginTop: 2 }}><Zap size={20} /></div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: editSyncMode === 'new_only' ? 'var(--color-warning)' : 'var(--color-text)' }}>{t('Chỉ dữ liệu mới')}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.4 }}>{t('Bỏ qua các dòng đã có. Chỉ phân luồng dòng mới phát sinh từ thời điểm bật.')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Đồng bộ 2 chiều (Two-Way Sync) */}
            {selected?.connection_type !== 'landing_page' && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{t('Đồng bộ 2 chiều (Ghi ngược về Google Sheet)')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Hệ thống tự động ghi nhận trạng thái và nhân viên phụ trách trực tiếp về file Sheet.')}</div>
                  </div>
                  <ToggleSwitch
                    checked={editTwoWaySync}
                    onChange={(val) => setEditTwoWaySync(val)}
                  />
                </div>

                {editTwoWaySync && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>
                        {t('Google Script Web App URL')}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t("https://script.google.com/macros/s/.../exec")}
                        value={editGoogleScriptUrl}
                        onChange={e => setEditGoogleScriptUrl(e.target.value)}
                        style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                        {t('URL triển khai từ Google Apps Script Web App để ghi dữ liệu về sheet.')}
                      </span>
                    </div>

                    <div style={{ background: 'rgba(189, 29, 45,0.05)', border: '1px solid rgba(189, 29, 45,0.2)', padding: '1rem', borderRadius: 12, fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--color-primary)' }}>
                        <Info size={14} /> {t('Hướng dẫn cài đặt Google Apps Script:')}
                      </div>
                      <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <li>{t('Mở bảng tính Google Sheets của bạn.')}</li>
                        <li>{t('Chọn')} <strong>{t('Tiện ích mở rộng (Extensions)')}</strong> &gt; <strong>{t('Apps Script')}</strong>.</li>
                        <li>{t('Sao chép toàn bộ code từ file')} <code>two_way_sync.gs</code> {t('trong thư mục backend của hệ thống và dán vào.')}</li>
                        <li>{t('Nhấp vào')} <strong>{t('Triển khai (Deploy)')}</strong> &gt; <strong>{t('Triển khai mới (New deployment)')}</strong>.</li>
                        <li>{t('Chọn loại cấu hình là')} <strong>{t('Ứng dụng web (Web app)')}</strong>.</li>
                        <li>{t('Cấu hình: Người thực thi:')} <em>{t('"Tôi" (Me)')}</em>{t(', Ai có quyền truy cập:')} <em>{t('"Bất kỳ ai" (Anyone)')}</em>.</li>
                        <li>{t('Nhấp Triển khai và cấp quyền, sau đó sao chép')} <strong>{t('URL ứng dụng web')}</strong> {t('dán vào trường trên.')}</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tiếp nhận lead & Đếm ngược tự động thu hồi */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editLeadRecallMinutes > 0 ? '1rem' : 0 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{t('Tiếp nhận lead & Đếm ngược tự động thu hồi')}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Yêu cầu Sale bấm tiếp nhận lead trong khoảng thời gian quy định, nếu không hệ thống sẽ tự động thu hồi.')}</div>
                </div>
                <ToggleSwitch
                  checked={editLeadRecallMinutes > 0}
                  onChange={(val) => setEditLeadRecallMinutes(val ? 15 : 0)}
                />
              </div>

              {editLeadRecallMinutes > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', animation: 'fadeIn 0.2s ease-out' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>
                    {t('Thời gian chờ tiếp nhận (phút)')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="form-input"
                    placeholder={t("Nhập số phút (Ví dụ: 15)")}
                    value={editLeadRecallMinutes}
                    onChange={e => setEditLeadRecallMinutes(Math.max(1, parseInt(e.target.value) || 0))}
                    style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {t('Sau số phút này, nếu Sale chưa bấm tiếp nhận, lead sẽ bị thu hồi và chia cho Sale tiếp theo.')}
                  </span>
                </div>
              )}
            </div>

            {/* Mẫu nội dung Email */}
            <div>
              <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>{t('Mẫu nội dung Email (Hỗ trợ biến)')}</label>
              <div style={{ position: 'relative' }}>
                <textarea
                  className="form-input"
                  rows={6}
                  style={{ minHeight: 120, background: 'var(--color-bg)', border: '1px solid var(--color-border)', lineHeight: 1.6, fontFamily: 'monospace', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
                  placeholder={t("Nhập mẫu email. Ví dụ:\nThông tin khách hàng:\n- Họ tên: {name}\n- Điện thoại: {phone}")}
                  value={editEmailTemplate}
                  onChange={e => setEditEmailTemplate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {getSelectFields().map(f => (
                  <span
                    key={f.value}
                    onClick={() => setEditEmailTemplate(editEmailTemplate + (editEmailTemplate && !editEmailTemplate.endsWith('\n') ? '\n' : '') + `${f.label}: {${f.value}}`)}
                    style={{ cursor: 'pointer', background: 'var(--color-border-light)', color: 'var(--color-text)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border)' }}
                  >
                    {'{'}{f.value}{'}'}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
              <button className="btn outline" onClick={() => setShowEditConn(false)} style={{ padding: '0.5rem 1.25rem' }}>{t('Hủy bỏ')}</button>
              <button className="btn primary" onClick={handleSaveEditConn} disabled={isSaving} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {isSaving ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />} {t('Lưu cấu hình')}
              </button>
            </div>
          </div>
        </div>
        )}
      </CustomModal>

      <CustomModal
        isOpen={showAddApi}
        onClose={() => setShowAddApi(false)}
        title={t("Tạo API Landing Page")}
        width="500px"
      >
        {showAddApi && (
          <>
            <div style={{ padding: '1.5rem', background: 'var(--color-surface)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t('Kết nối Landing Page')} <div style={{ background: 'var(--color-primary)', color: 'white', padding: '2px 6px', borderRadius: 6, fontSize: '0.75rem' }}><Zap size={14} /></div>
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {t('Tạo một Endpoint (Đường dẫn API) để gắn vào trang đích của bạn.')}
                </p>
              </div>
  
              <div>
                <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>{t('Tên kết nối')}</label>
                <input
                  className="form-input"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text)' }}
                  placeholder={t("VD: Landing Page Bất Động Sản")}
                  value={newApiName}
                  onChange={e => setNewApiName(e.target.value)}
                />
              </div>
            </div>
          </div>
  
          <div style={{ padding: '1rem 1.5rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button className="btn outline" onClick={() => setShowAddApi(false)}>{t('Hủy')}</button>
            <button className="btn primary" onClick={handleAddApiConnection} disabled={isSaving || !newApiName.trim()} style={{ background: 'var(--color-primary)', border: 'none' }}>
              {isSaving ? t('Đang tạo...') : t('Tạo API Endpoint')}
            </button>
          </div>
        </>
        )}
      </CustomModal>
    </>
  );
};

export const Integrations = withRouterFreezer(IntegrationsInner, '/integrations');
