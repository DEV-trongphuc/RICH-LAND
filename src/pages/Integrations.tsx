import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { withRouterFreezer } from '../components/RouterFreezer';
import { Webhook, Plus, Trash2, Copy, CheckCircle2, ChevronRight, ChevronLeft, Link2, Tag, Info, FileSpreadsheet, Zap, Clock, Target, RefreshCw, Edit2, ExternalLink, AlertCircle, Settings, Database, Radio, Send, Code, Terminal, History, Eye, Play, Sparkles, Check, Globe, HelpCircle, Layers, ArrowRight } from 'lucide-react';
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
  default_source?: string;
  default_type?: string;
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
  auto_append_unmapped_note?: number | boolean;
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

type WebhookLog = {
  id: number;
  connection_id: number;
  token: string;
  ip_address: string;
  request_method: string;
  content_type: string;
  raw_payload: string;
  parsed_data: string;
  lead_id?: number | null;
  status: string;
  message?: string;
  created_at: string;
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

const PRESET_PAYLOADS = {
  ladipage: JSON.stringify({
    hoten: "Trần Thị Minh Thư",
    sdt: "0987654321",
    email: "minhthu.tran@gmail.com",
    noidung: "Tôi muốn nhận bảng giá căn 2 phòng ngủ view sông",
    du_an: "Vinhomes Grand Park",
    ngan_sach: "3.5 tỷ",
    utm_campaign: "Camp_Vinhomes_Tet2026",
    utm_medium: "cpc",
    utm_source: "facebook",
    gio_hen: "09:30 Thứ 7 tuần này",
    so_nguoi_o: "3 người"
  }, null, 2),
  website: JSON.stringify({
    name: "Nguyễn Hoàng Nam",
    phone: "0912345678",
    email: "nam.nguyen@richland.vn",
    note: "Cần tư vấn gói vay ngân hàng và tiến độ bàn giao",
    budget: "5000000000",
    address: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1",
    city: "Hồ Chí Minh",
    district: "Quận 1",
    property_type: "Căn hộ cao cấp",
    bedroom_count: "3PN",
    preferred_location: "Aqua City",
    source: "Website richland.vn",
    type: "Nóng"
  }, null, 2),
  nested: JSON.stringify({
    event: "lead_created",
    data: {
      customer: {
        full_name: "Lê Văn Dũng",
        contact_phone: "0909112233",
        contact_email: "dung.le@enterprise.com"
      },
      requirements: {
        project_name: "Khu đô thị sinh thái",
        target_budget: "7 - 10 tỷ",
        urgent_call: true,
        preferred_time: "Sau 17h chiều"
      }
    },
    utm: {
      campaign: "Google_Search_Brand",
      adset: "Tu_Khoa_Chinh_Xac"
    }
  }, null, 2),
  custom: JSON.stringify({
    so_dien_thoai: "0938000999",
    ho_ten: "Phạm Quốc Hưng",
    ghi_chu: "Dữ liệu bắn thử nghiệm từ API đối tác ngoài",
    truong_tuy_bien_1: "Khách VIP",
    truong_tuy_bien_2: "Đã cọc thiện chí"
  }, null, 2)
};

const IntegrationsInner = () => {
  const { language, t } = useLanguage();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Connection | null>(null);
  const [mobileActiveView, setMobileActiveView] = useState<'list' | 'detail'>('list');
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [guideTab, setGuideTab] = useState<'quick_post' | 'ladipage' | 'wordpress' | 'zapier' | 'code'>('quick_post');

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

  // Universal Webhook states
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState(() => t('Webhook Ladipage Dự Án Aqua'));
  const [newWebhookSource, setNewWebhookSource] = useState('Ladipage');
  const [newWebhookType, setNewWebhookType] = useState('Nóng');
  const [newWebhookRequirePhone, setNewWebhookRequirePhone] = useState(true);
  const [newWebhookNotifyAdmin, setNewWebhookNotifyAdmin] = useState(true);
  const [newWebhookAutoAppend, setNewWebhookAutoAppend] = useState(true);
  const [newWebhookPreset, setNewWebhookPreset] = useState<'ladipage' | 'wordpress' | 'zapier' | 'custom'>('ladipage');

  // Simulator & Logs states
  const [webhookTab, setWebhookTab] = useState<'guides' | 'simulator' | 'logs' | 'mapping'>('guides');
  const [simPreset, setSimPreset] = useState<'ladipage' | 'website' | 'nested' | 'custom'>('ladipage');
  const [simPayload, setSimPayload] = useState(() => PRESET_PAYLOADS.ladipage);
  const [isFiringSim, setIsFiringSim] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [inspectingLog, setInspectingLog] = useState<WebhookLog | null>(null);

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
  const [editName, setEditName] = useState('');
  const [editDefaultSource, setEditDefaultSource] = useState('');
  const [editDefaultType, setEditDefaultType] = useState('Nóng');
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

  const handleAddWebhook = async () => {
    if (!newWebhookName.trim()) {
      toast.error(t('Vui lòng nhập tên Webhook'));
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    try {
      const payload = {
        sheet_name: newWebhookName.trim(),
        default_source: newWebhookSource.trim() || 'Webhook Ngoài',
        default_type: newWebhookType.trim() || 'Nóng',
        spreadsheet_id: '',
        webhook_token: generateToken(),
        is_active: 1,
        sync_interval: 0,
        connection_type: 'webhook',
        require_both_contact: newWebhookRequirePhone ? 1 : 0,
        notify_admin: newWebhookNotifyAdmin ? 1 : 0,
        auto_append_unmapped_note: newWebhookAutoAppend ? 1 : 0,
        lead_recall_minutes: 0
      };
      const json = await fetchAPI('add_connection', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        toast.success(t('Đã tạo Webhook Đa Năng thành công!'));
        setShowAddWebhook(false);
        setNewWebhookName(t('Webhook Ladipage Tuyển Dụng'));
        await fetchData();
      } else {
        toast.error(json.message || t('Tạo Webhook thất bại'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchWebhookLogs = async (connId: number) => {
    setIsLoadingLogs(true);
    try {
      const res = await fetchAPI(`get_webhook_logs&connection_id=${connId}`);
      if (res.success && Array.isArray(res.data)) {
        setWebhookLogs(res.data);
      } else {
        setWebhookLogs([]);
      }
    } catch (e) {
      console.error(e);
      setWebhookLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!selected) return;
    try {
      const res = await fetchAPI(`clear_webhook_logs&connection_id=${selected.id}`);
      if (res.success) {
        toast.success(t('Đã xóa sạch nhật ký Webhook!'));
        setWebhookLogs([]);
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
  };

  const handleFireSimulator = async () => {
    if (!selected) return;
    setIsFiringSim(true);
    setSimResult(null);
    try {
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(simPayload);
      } catch (parseErr) {
        toast.error(t('JSON không hợp lệ. Vui lòng kiểm tra lại cú pháp.'));
        setIsFiringSim(false);
        return;
      }

      const endpoint = webhookUrl(selected.webhook_token);
      const startMs = Date.now();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(parsedBody)
      });
      const elapsedMs = Date.now() - startMs;
      const json = await res.json();
      setSimResult({
        status: res.status,
        ok: res.ok,
        elapsedMs,
        data: json
      });
      if (res.ok && json.success) {
        toast.success(t('Bắn dữ liệu thử nghiệm thành công!'));
        fetchWebhookLogs(selected.id);
        fetchData();
      } else {
        toast.error(json.message || t('Bắn thử nghiệm thất bại'));
      }
    } catch (err: any) {
      setSimResult({
        status: 500,
        ok: false,
        elapsedMs: 0,
        data: { success: false, message: err.message }
      });
      toast.error(t('Lỗi: ') + err.message);
    } finally {
      setIsFiringSim(false);
    }
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
      sheet_name: editName || selected.sheet_name,
      default_source: editDefaultSource,
      default_type: editDefaultType,
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
      notify_admin: selected.notify_admin ? 1 : 0,
      auto_append_unmapped_note: selected.auto_append_unmapped_note ? 1 : 0
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

  const handleToggleAppendUnmapped = async (conn: any) => {
    try {
      const newAppend = conn.auto_append_unmapped_note ? 0 : 1;
      const json = await fetchAPI(`toggle_append_unmapped&id=${conn.id}&append=${newAppend}`);
      if (json.success) {
        toast.success(newAppend ? t('Đã bật tự động gom cột chưa map vào Ghi chú') : t('Đã tắt tự động gom cột chưa map'));
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
      if (selected.connection_type === 'webhook' || selected.connection_type === 'landing_page') {
        fetchWebhookLogs(selected.id);
      }
      if (selected.spreadsheet_id && selected.connection_type !== 'webhook') {
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
    } else {
      setSelectedColumns([]);
    }
  }, [selected?.id, selected?.connection_type]);

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

  const renderMappingTable = () => {
    if (!selected) return null;
    const isWebhookType = selected.connection_type === 'webhook' || selected.connection_type === 'landing_page';
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={16} color="var(--color-primary)" /> {isWebhookType ? t('Mapping Cột Tùy Biến') : t('Mapping Cột cho')} <em style={{ fontStyle: 'normal', color: 'var(--color-primary)' }}>{selected.sheet_name}</em>
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              {isWebhookType
                ? t('Ánh xạ key từ payload Webhook sang trường hệ thống (Tùy chọn - Hệ thống đã tự nhận diện thông minh)')
                : t('Ánh xạ tên cột trên Google Sheets này sang trường dữ liệu của hệ thống')}
            </p>
          </div>
        </div>

        {/* Add Mapping Row at the TOP */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', background: 'var(--color-bg)', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label" style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>
              {isWebhookType ? t('Key trong Payload') : t('Tên cột trên Sheets')}
            </label>
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
                placeholder={isWebhookType ? t("VD: phone_number, sdt, ho_ten") : t("VD: Số Điện Thoại KH")}
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
            <strong>{t('Mẹo cấu hình:')}</strong> {t('Bạn có thể map')} <strong>{t('nhiều cột / key')}</strong> {t('vào')} <strong>{t('cùng 1 trường hệ thống')}</strong> {t('(ví dụ: Nguồn Data = UTM Source + Campaign, hoặc Ghi Chú = Sở thích + Khung giờ). Toàn bộ dữ liệu dư thừa đều được tự động lưu vào Ghi chú!')}
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
                <th>{isWebhookType ? t('Key trong Payload') : t('Tên cột trên Google Sheets')}</th>
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
                        {t('Để mặc định')}
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
                    {isWebhookType
                      ? t('Chưa có mapping tùy biến nào. Dữ liệu sẽ tự động bóc tách theo AI / Smart parser.')
                      : t('Chưa có mapping nào. Hãy thêm cột ở trên.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

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
              onClick={() => setShowAddWebhook(true)} 
              className="btn primary hover-lift" 
              style={{ 
                width: '100%', 
                justifyContent: 'center', 
                height: 42, 
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                border: 'none',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.875rem'
              }}
            >
              <Webhook size={18} /> {t('Tạo Webhook Đa Năng')}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button 
                onClick={() => setShowAddConn(true)} 
                className="btn primary hover-lift" 
                style={{ 
                  justifyContent: 'center', 
                  height: 38, 
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  padding: '0 8px'
                }}
              >
                <FileSpreadsheet size={15} /> {t('Kết nối Sheets')}
              </button>
              <button 
                onClick={() => setShowAddApi(true)} 
                className="btn outline hover-lift" 
                style={{ 
                  justifyContent: 'center', 
                  height: 38, 
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  padding: '0 8px'
                }}
              >
                <Zap size={15} /> {t('API Landing')}
              </button>
            </div>
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
                    {conn.connection_type === 'webhook' ? (
                      <Webhook size={20} color={isSelected ? 'var(--color-primary)' : '#6366f1'} />
                    ) : conn.connection_type === 'landing_page' ? (
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
                      {conn.connection_type === 'webhook' ? (
                        <span style={{ color: '#6366f1', fontWeight: 600 }}>{t('Webhook • Bắt mọi nguồn')}</span>
                      ) : conn.connection_type === 'landing_page' ? (
                        t('Nhận Data qua API')
                      ) : (
                        t('{count} cột đã map').replace('{count}', String((conn.mappings || []).length))
                      )}
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
                        setEditName(selected.sheet_name || '');
                        setEditDefaultSource(selected.default_source || '');
                        setEditDefaultType(selected.default_type || '');
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

                <div style={{ marginTop: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t('Tự động gộp các cột chưa map vào Ghi chú thêm')}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {t('Nếu bật, tất cả các cột khác trên Sheets/Webhook không được cấu hình ánh xạ sẽ tự động được thu thập và gom vào phần Ghi chú thêm của Lead.')}
                    </p>
                  </div>
                  <div
                    onClick={() => handleToggleAppendUnmapped(selected)}
                    style={{
                      width: 44, height: 24, borderRadius: 24, cursor: 'pointer', position: 'relative',
                      background: selected.auto_append_unmapped_note ? 'var(--color-success)' : 'var(--color-border)',
                      transition: 'background 0.3s'
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: 'var(--color-surface)',
                      position: 'absolute', top: 3, left: selected.auto_append_unmapped_note ? 23 : 3,
                      transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>
              </div>

              {selected.connection_type === 'webhook' || selected.connection_type === 'landing_page' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Webhook Endpoint Banner */}
                  <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.07) 0%, rgba(139, 92, 246, 0.04) 100%)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ background: '#6366f1', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Webhook Đa Năng
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                            Nhận POST (JSON, Form-Data, x-www-form-urlencoded) & GET
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                          {selected.sheet_name}
                        </h3>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(webhookUrl(selected.webhook_token));
                            setCopiedId(selected.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="btn primary"
                          style={{
                            background: copiedId === selected.id ? '#10b981' : '#6366f1',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            padding: '7px 14px',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          {copiedId === selected.id ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                          {copiedId === selected.id ? t('Đã Copy Link!') : t('Copy URL Webhook')}
                        </button>
                      </div>
                    </div>

                    {/* Webhook URL Input display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-surface)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', padding: '2px 6px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 4 }}>
                        URL
                      </span>
                      <input
                        readOnly
                        value={webhookUrl(selected.webhook_token)}
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--color-text)' }}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                    </div>

                    {/* Guarantees row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      <div style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                          <strong>Bắt trọn 100% data:</strong> Tự động bóc tách SĐT, Họ Tên, Email, Nhu cầu, UTM...
                        </div>
                      </div>
                      <div style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                          <strong>Không sót thông tin:</strong> Mọi trường phụ đều tự động gom vào Ghi chú Lead.
                        </div>
                      </div>
                      <div style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Nguồn:</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {selected.default_source || 'Tự động trích xuất'}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 8 }}>Dự án:</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          {selected.default_type || 'Tự động trích xuất'}
                        </span>
                      </div>
                    </div>

                    {/* HƯỚNG DẪN BẮN POST NHANH (HIỂN THỊ TRỰC TIẾP TRÊN MÀN HÌNH) */}
                    <div style={{
                      marginTop: '1rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 10,
                      padding: '12px 16px',
                      color: '#e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: '#10b981', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 800 }}>
                            POST
                          </span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#f8fafc' }}>
                            {t('Cú pháp bắn POST trực tiếp vào Webhook này:')}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            Content-Type: application/json
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => {
                              const curlCmd = `curl -X POST "${webhookUrl(selected.webhook_token)}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Nguyễn Văn A",\n    "phone": "0912345678",\n    "email": "a@gmail.com",\n    "source": "${selected.default_source || 'Landing Page'}",\n    "note": "Cần tư vấn căn hộ"\n  }'`;
                              navigator.clipboard.writeText(curlCmd);
                              setCopiedId('quick_curl');
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            style={{
                              background: copiedId === 'quick_curl' ? '#10b981' : 'rgba(255,255,255,0.12)',
                              color: '#fff',
                              border: 'none',
                              padding: '5px 12px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontWeight: 600
                            }}
                          >
                            {copiedId === 'quick_curl' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                            {copiedId === 'quick_curl' ? t('Đã Copy cURL') : t('Copy Lệnh cURL')}
                          </button>
                          <button
                            onClick={() => {
                              setWebhookTab('guides');
                              setGuideTab('quick_post');
                            }}
                            style={{
                              background: '#6366f1',
                              color: '#fff',
                              border: 'none',
                              padding: '5px 12px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              fontWeight: 700
                            }}
                          >
                            {t('Xem Chi Tiết POST & Code')}
                          </button>
                        </div>
                      </div>
                      <pre style={{
                        margin: 0,
                        color: '#38bdf8',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        background: 'rgba(0,0,0,0.25)',
                        padding: '8px 12px',
                        borderRadius: 6
                      }}>
{`curl -X POST "${webhookUrl(selected.webhook_token)}" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Nguyễn Văn A", "phone": "0912345678", "email": "a@gmail.com", "source": "${selected.default_source || 'Landing Page'}", "note": "Cần tư vấn dự án"}'`}
                      </pre>
                    </div>
                  </div>

                  {/* Navigation Tabs (Hướng Dẫn Chi Tiết Bắn POST lên đầu tiên) */}
                  <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                      { id: 'guides', label: '📖 Hướng Dẫn Bắn POST (Chi Tiết & Code Mẫu)', count: null },
                      { id: 'simulator', label: '🚀 Bắn Thử Webhook (Simulator)', count: null },
                      { id: 'logs', label: '📜 Nhật Ký Payload (Logs)', count: webhookLogs.length },
                      { id: 'mapping', label: '🗺️ Mapping Cột Tùy Chọn', count: (selected.mappings || []).length },
                    ].map(tItem => (
                      <button
                        key={tItem.id}
                        onClick={() => setWebhookTab(tItem.id as any)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: webhookTab === tItem.id ? '#6366f1' : 'var(--color-bg)',
                          color: webhookTab === tItem.id ? '#fff' : 'var(--color-text-muted)',
                          transition: 'all 0.2s'
                        }}
                      >
                        {tItem.label}
                        {tItem.count !== null && (
                          <span style={{
                            background: webhookTab === tItem.id ? 'rgba(255,255,255,0.2)' : 'var(--color-border)',
                            padding: '2px 6px',
                            borderRadius: 10,
                            fontSize: '0.7rem'
                          }}>
                            {tItem.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tab 1: Simulator */}
                  {webhookTab === 'simulator' && (
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                            Trình Giả Lập Bắn Dữ Liệu Trực Tiếp
                          </h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                            Chọn mẫu dữ liệu hoặc tùy ý chỉnh sửa JSON và bắn trực tiếp vào CRM để kiểm tra kết quả ngay lập tức.
                          </p>
                        </div>
                        {/* Presets */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[
                            { id: 'ladipage', label: '⚡ Ladipage Lead' },
                            { id: 'website', label: '🌐 Website Form' },
                            { id: 'nested', label: '🔄 Cấu Trúc Lồng Nhau' },
                            { id: 'custom', label: '🛠️ Tùy Biến' }
                          ].map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSimPreset(p.id as any);
                                setSimPayload((PRESET_PAYLOADS as any)[p.id] || '');
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 6,
                                border: simPreset === p.id ? '1px solid #6366f1' : '1px solid var(--color-border)',
                                background: simPreset === p.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--color-surface)',
                                color: simPreset === p.id ? '#6366f1' : 'var(--color-text)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Monospace JSON editor */}
                      <div style={{ position: 'relative', marginBottom: '1rem' }}>
                        <textarea
                          rows={11}
                          value={simPayload}
                          onChange={e => setSimPayload(e.target.value)}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: '#0f172a',
                            color: '#38bdf8',
                            fontFamily: 'monospace',
                            fontSize: '0.8125rem',
                            lineHeight: 1.5,
                            padding: '1rem',
                            borderRadius: 8,
                            border: '1px solid #334155',
                            outline: 'none',
                            resize: 'vertical'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          💡 Dữ liệu bắn thử nghiệm sẽ được chia và lưu trực tiếp vào danh sách khách hàng của CRM.
                        </div>
                        <button
                          onClick={handleFireSimulator}
                          disabled={isFiringSim}
                          className="btn primary"
                          style={{
                            background: '#6366f1',
                            border: 'none',
                            padding: '0.6rem 1.25rem',
                            borderRadius: 8,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          {isFiringSim ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}
                          {isFiringSim ? t('Đang bắn dữ liệu...') : t('🚀 Bắn Thử Dữ Liệu Ngay')}
                        </button>
                      </div>

                      {/* Result Box */}
                      {simResult && (
                        <div style={{
                          marginTop: '1.25rem',
                          background: simResult.ok && simResult.data?.success ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                          border: simResult.ok && simResult.data?.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 10,
                          padding: '1rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                background: simResult.ok && simResult.data?.success ? '#10b981' : '#ef4444',
                                color: '#fff',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: '0.75rem',
                                fontWeight: 800
                              }}>
                                HTTP {simResult.status} {simResult.ok ? 'OK' : 'Error'}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                ⚡ Thời gian phản hồi: {simResult.elapsedMs}ms
                              </span>
                            </div>
                            {simResult.data?.lead_id && (
                              <span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
                                Lead ID: #{simResult.data.lead_id}
                              </span>
                            )}
                          </div>

                          <p style={{ fontSize: '0.8125rem', color: simResult.ok && simResult.data?.success ? '#059669' : '#dc2626', fontWeight: 600, margin: '0 0 8px 0' }}>
                            {simResult.data?.message || (simResult.ok ? 'Tiếp nhận thành công!' : 'Có lỗi phát sinh')}
                          </p>

                          {simResult.data?.assigned_to && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text)', marginBottom: 8 }}>
                              <strong>Nhân viên phụ trách:</strong> {simResult.data.assigned_to}
                            </div>
                          )}

                          {simResult.data?.data?.note && (
                            <div style={{ fontSize: '0.75rem', background: 'var(--color-surface)', padding: 8, borderRadius: 6, border: '1px solid var(--color-border)', marginBottom: 8 }}>
                              <strong>Ghi chú bóc tách được:</strong>
                              <pre style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                {simResult.data.data.note}
                              </pre>
                            </div>
                          )}

                          <details style={{ marginTop: 6 }}>
                            <summary style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', cursor: 'pointer', fontWeight: 600 }}>
                              Xem toàn bộ JSON response từ CRM
                            </summary>
                            <pre style={{ margin: '8px 0 0 0', padding: 8, background: '#1e293b', color: '#e2e8f0', borderRadius: 6, fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace' }}>
                              {JSON.stringify(simResult.data, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Logs */}
                  {webhookTab === 'logs' && (
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                            Nhật Ký Tiếp Nhận Payload ({webhookLogs.length})
                          </h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                            Ghi lại toàn bộ request từ bên thứ ba gửi tới Webhook này theo thời gian thực.
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => fetchWebhookLogs(selected.id)}
                            disabled={isLoadingLogs}
                            className="btn outline"
                            style={{ padding: '6px 12px', fontSize: '0.8125rem', height: 32, display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <RefreshCw size={14} className={isLoadingLogs ? 'spin' : ''} /> {t('Làm mới')}
                          </button>
                          {webhookLogs.length > 0 && (
                            <button
                              onClick={handleClearLogs}
                              className="btn outline"
                              style={{ padding: '6px 12px', fontSize: '0.8125rem', height: 32, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-danger)' }}
                            >
                              <Trash2 size={14} /> {t('Xóa lịch sử')}
                            </button>
                          )}
                        </div>
                      </div>

                      {isLoadingLogs ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                          <RefreshCw size={24} className="spin" style={{ marginBottom: 8 }} />
                          <div>Đang tải nhật ký...</div>
                        </div>
                      ) : webhookLogs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--color-bg)', borderRadius: 10, border: '1px dashed var(--color-border)' }}>
                          <Radio size={36} color="#6366f1" style={{ marginBottom: 8 }} />
                          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 4px 0' }}>Chưa có lượt gửi dữ liệu nào</h4>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            Các lượt gửi từ Ladipage, Website hoặc công cụ khác sẽ xuất hiện tại đây. Bạn có thể sang tab <strong>Bắn Thử Webhook</strong> để thử ngay!
                          </p>
                        </div>
                      ) : (
                        <div className="responsive-table-wrap">
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: '8px 10px' }}>Thời gian</th>
                                <th style={{ padding: '8px 10px' }}>Phương thức & IP</th>
                                <th style={{ padding: '8px 10px' }}>Trạng thái</th>
                                <th style={{ padding: '8px 10px' }}>Lead ID</th>
                                <th style={{ padding: '8px 10px' }}>Nội dung xử lý</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Chi tiết</th>
                              </tr>
                            </thead>
                            <tbody>
                              {webhookLogs.map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                                    {log.created_at}
                                  </td>
                                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                    <span style={{
                                      background: log.request_method === 'POST' ? '#6366f1' : '#059669',
                                      color: '#fff',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontSize: '0.7rem',
                                      fontWeight: 800,
                                      marginRight: 6
                                    }}>
                                      {log.request_method}
                                    </span>
                                    <span style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                      {log.ip_address}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <span style={{
                                      background: log.status === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: log.status === 'success' ? '#059669' : '#dc2626',
                                      padding: '3px 8px',
                                      borderRadius: 6,
                                      fontSize: '0.75rem',
                                      fontWeight: 700
                                    }}>
                                      {log.status === 'success' ? 'Thành công' : 'Lỗi'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                                    {log.lead_id ? (
                                      <span style={{ color: 'var(--color-primary)' }}>#{log.lead_id}</span>
                                    ) : (
                                      <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 10px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {log.message || 'Tiếp nhận thành công'}
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                    <button
                                      onClick={() => setInspectingLog(log)}
                                      className="btn outline"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', height: 26, borderRadius: 6 }}
                                    >
                                      🔍 Xem Payload
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Mapping */}
                  {webhookTab === 'mapping' && (
                    <div>
                      <div style={{ padding: '12px 16px', background: 'var(--color-info-light)', border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                        <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.5 }}>
                          <strong>Khả năng tự động nhận diện:</strong> Hệ thống đã cài sẵn bộ bóc tách thông minh nhận diện toàn bộ các trường tiếng Việt & tiếng Anh thông dụng (Họ tên, SĐT, Email, Nhu cầu, UTM...). Toàn bộ thông tin phụ không nhận dạng được sẽ được gom sạch vào Ghi chú Lead. Bạn chỉ cần thêm mapping dưới đây khi muốn đổi tên hiển thị trong Email hoặc ép một trường cố định.
                        </div>
                      </div>
                      {/* Mapping Component */}
                      {renderMappingTable()}
                    </div>
                  )}

                  {/* Tab 4: Guides */}
                  {webhookTab === 'guides' && (
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        {[
                          { id: 'quick_post', label: '⚡ Cú Pháp Bắn POST & JSON Chuẩn' },
                          { id: 'code', label: '💻 Code Mẫu (cURL / JS / PHP / Python)' },
                          { id: 'ladipage', label: '⚡ Ladipage' },
                          { id: 'wordpress', label: '🌐 WordPress / Elementor' },
                          { id: 'zapier', label: '🔄 Zapier / Make / n8n' }
                        ].map(g => (
                          <button
                            key={g.id}
                            onClick={() => setGuideTab(g.id as any)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 8,
                              border: guideTab === g.id ? '1px solid #6366f1' : '1px solid var(--color-border)',
                              background: guideTab === g.id ? '#6366f1' : 'var(--color-bg)',
                              color: guideTab === g.id ? '#fff' : 'var(--color-text-muted)',
                              fontWeight: 700,
                              fontSize: '0.8125rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>

                      {/* Sub-tab 1: Quick POST Guide & JSON Specification */}
                      {guideTab === 'quick_post' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <div>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Zap size={18} color="#6366f1" /> {t('Hướng Dẫn Chi Tiết Bắn POST Lên Webhook')}
                            </h4>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                              {t('Hệ thống hỗ trợ cơ chế "Bắn gì nhận nấy" - 100% dữ liệu gửi qua đều được bóc tách vào trường CRM hoặc gom sạch vào Ghi chú Lead không lo thất lạc.')}
                            </p>
                          </div>

                          {/* Endpoint specs box */}
                          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 110 }}>PHƯƠNG THỨC:</span>
                              <span style={{ background: '#10b981', color: '#fff', padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800 }}>POST</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(Khuyên dùng POST. Ngoài ra vẫn hỗ trợ GET query parameters)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 110 }}>HEADERS:</span>
                              <code style={{ background: 'var(--color-surface)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.75rem', color: '#6366f1', fontWeight: 700 }}>
                                Content-Type: application/json
                              </code>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                (Hỗ trợ cả application/x-www-form-urlencoded và multipart/form-data)
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 110 }}>WEBHOOK URL:</span>
                              <code style={{ background: '#0f172a', color: '#38bdf8', padding: '6px 10px', borderRadius: 6, fontSize: '0.75rem', flex: 1, wordBreak: 'break-all' }}>
                                {webhookUrl(selected.webhook_token)}
                              </code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(webhookUrl(selected.webhook_token));
                                  setCopiedId('guide_quick_url');
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="btn outline"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28, display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                {copiedId === 'guide_quick_url' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                {copiedId === 'guide_quick_url' ? t('Đã copy') : t('Copy URL')}
                              </button>
                            </div>
                          </div>

                          {/* JSON Sample Payload */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, margin: 0 }}>
                                {t('Mẫu JSON Chuẩn Khuyên Dùng (POST Body)')}
                              </label>
                              <button
                                onClick={() => {
                                  const jsonStr = JSON.stringify({
                                    name: "Nguyễn Văn A",
                                    phone: "0912345678",
                                    email: "nguyenvana@gmail.com",
                                    note: "Khách quan tâm căn 2 phòng ngủ hướng Đông Nam",
                                    source: selected.default_source || "Landing_AquaCity",
                                    type: selected.default_type || "Căn hộ cao cấp",
                                    budget: "3 - 5 tỷ",
                                    utm_campaign: "Camp_He_2026",
                                    gio_hen: "18h00 tối nay",
                                    dia_chi: "Quận 2, TP.HCM"
                                  }, null, 2);
                                  navigator.clipboard.writeText(jsonStr);
                                  setCopiedId('guide_json_sample');
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="btn outline"
                                style={{ padding: '3px 8px', fontSize: '0.75rem', height: 26, display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                {copiedId === 'guide_json_sample' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                {copiedId === 'guide_json_sample' ? t('Đã copy JSON') : t('Copy JSON')}
                              </button>
                            </div>
                            <pre style={{
                              margin: 0,
                              background: '#0f172a',
                              color: '#38bdf8',
                              padding: '1rem',
                              borderRadius: 8,
                              border: '1px solid #334155',
                              fontSize: '0.8125rem',
                              fontFamily: 'monospace',
                              lineHeight: 1.5,
                              overflowX: 'auto'
                            }}>
{`{
  "name": "Nguyễn Văn A",
  "phone": "0912345678",
  "email": "nguyenvana@gmail.com",
  "note": "Khách quan tâm căn 2 phòng ngủ hướng Đông Nam",
  "source": "${selected.default_source || 'Landing_AquaCity'}",
  "type": "${selected.default_type || 'Căn hộ cao cấp'}",
  "budget": "3 - 5 tỷ",
  "utm_campaign": "Camp_He_2026",
  "gio_hen": "18h00 tối nay",
  "dia_chi": "Quận 2, TP.HCM"
}`}
                            </pre>
                          </div>

                          {/* Field Mapping Reference Table */}
                          <div>
                            <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
                              {t('Bảng Bóc Tách Trường Thông Tin Tự Động (Smart Alias)')}
                            </label>
                            <div className="responsive-table-wrap">
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                <thead>
                                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 10px', width: '22%' }}>Trường Trong CRM</th>
                                    <th style={{ padding: '8px 10px', width: '38%' }}>Các Tên Key Hỗ Trợ Tự Động</th>
                                    <th style={{ padding: '8px 10px' }}>Cơ Chế Xử Lý</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-primary)' }}>Họ và tên</td>
                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#6366f1' }}>name, full_name, ho_ten, ten, fullname, khach_hang</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>Lưu vào họ tên khách hàng</td>
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-primary)' }}>Số điện thoại</td>
                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#6366f1' }}>phone, so_dien_thoai, sdt, tel, mobile, contact_phone</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>Kiểm tra chống trùng, phân bổ cho Sale</td>
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-primary)' }}>Email</td>
                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#6366f1' }}>email, mail, contact_email</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>Lưu vào email liên hệ</td>
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-primary)' }}>Ghi chú / Nhu cầu</td>
                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#6366f1' }}>note, message, ghi_chu, noi_dung, loi_nhan, nhu_cau</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>Lưu vào nội dung tư vấn chính</td>
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-primary)' }}>Nguồn (Source)</td>
                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#6366f1' }}>source, utm_source</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>Nếu không gửi, tự lấy: <strong>{selected.default_source || 'Webhook'}</strong></td>
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-primary)' }}>Phân loại / Dự án (Type)</td>
                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#6366f1' }}>type, du_an, project, san_pham</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>Nếu không gửi, tự lấy: <strong>{selected.default_type || 'Nóng'}</strong></td>
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-primary)' }}>Địa chỉ & Ngân sách</td>
                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#6366f1' }}>address, dia_chi, budget, ngan_sach, gia</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>Tự động gán vào trường tương ứng hoặc gom ghi chú</td>
                                  </tr>
                                  <tr style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 800, color: '#6366f1' }}>✨ TẤT CẢ TRƯỜNG KHÁC</td>
                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#6366f1' }}>utm_campaign, gio_hen, tuoi, custom_xyz...</td>
                                    <td style={{ padding: '8px 10px', color: '#059669', fontWeight: 700 }}>
                                      ✅ 100% tự động gom vào Ghi chú Lead không bao giờ sót thông tin!
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Quick test buttons */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => {
                                setWebhookTab('logs');
                              }}
                              className="btn outline"
                              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}
                            >
                              📜 {t('Xem Nhật Ký Nhận Data')}
                            </button>
                            <button
                              onClick={() => {
                                setWebhookTab('simulator');
                                setSimPayload(JSON.stringify({
                                  name: "Nguyễn Văn A",
                                  phone: "0912345678",
                                  email: "nguyenvana@gmail.com",
                                  note: "Khách cần tư vấn căn hộ 2 phòng ngủ",
                                  source: selected.default_source || "Landing Page",
                                  type: selected.default_type || "Căn hộ cao cấp",
                                  budget: "3 - 5 tỷ"
                                }, null, 2));
                              }}
                              className="btn primary"
                              style={{ background: '#6366f1', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}
                            >
                              🚀 {t('Bắn Thử Ngay Bằng Simulator')}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Sub-tab 2: Ladipage */}
                      {guideTab === 'ladipage' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', lineHeight: 1.6 }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                            Hướng Dẫn Kết Nối Ladipage
                          </h4>
                          <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
                            <li>Mở trang thiết kế Ladipage của bạn.</li>
                            <li>Bấm vào Form đăng ký nhận thông tin -&gt; chọn <strong>Lưu data</strong> (biểu tượng liên kết).</li>
                            <li>Bấm <strong>Thêm mới</strong> -&gt; Chọn loại tài khoản liên kết là <strong>Webhook</strong>.</li>
                            <li>Dán đường dẫn Webhook sau vào ô <strong>Webhook URL</strong>:</li>
                          </ol>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155' }}>
                            <code style={{ color: '#38bdf8', flex: 1, fontSize: '0.8125rem', wordBreak: 'break-all' }}>
                              {webhookUrl(selected.webhook_token)}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(webhookUrl(selected.webhook_token));
                                setCopiedId('guide_ladipage');
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              {copiedId === 'guide_ladipage' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                              {copiedId === 'guide_ladipage' ? 'Đã copy' : 'Copy URL'}
                            </button>
                          </div>

                          <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                            <li>Phương thức gửi: <strong>POST</strong></li>
                            <li>Kiểu dữ liệu: <strong>application/json</strong> (hoặc application/x-www-form-urlencoded đều nhận được).</li>
                            <li>Bấm <strong>Lưu</strong> và <strong>Xuất bản lại Landing Page</strong>. Khi có người điền form, data sẽ ngay lập tức đổ vào CRM!</li>
                          </ul>
                        </div>
                      )}

                      {/* Sub-tab 3: WordPress */}
                      {guideTab === 'wordpress' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', lineHeight: 1.6 }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                            Hướng Dẫn Kết Nối WordPress / Elementor / Contact Form 7
                          </h4>
                          <div style={{ fontSize: '0.875rem' }}>
                            <strong>Cách 1: Đối với Elementor Pro Form:</strong>
                            <ol style={{ paddingLeft: '1.25rem', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <li>Chỉnh sửa Form bằng Elementor -&gt; Tab <strong>Actions After Submit</strong>.</li>
                              <li>Thêm action <strong>Webhook</strong> vào danh sách.</li>
                              <li>Mở mục <strong>Webhook</strong> mới hiện ra bên dưới -&gt; Dán URL webhook của bạn vào ô <strong>Webhook URL</strong>.</li>
                              <li>Bấm Cập nhật trang.</li>
                            </ol>
                          </div>

                          <div style={{ fontSize: '0.875rem' }}>
                            <strong>Cách 2: Đối với Contact Form 7 / WPForms:</strong>
                            <ol style={{ paddingLeft: '1.25rem', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <li>Cài đặt plugin miễn phí <em>CF7 to Webhook</em> hoặc <em>WP Webhooks</em>.</li>
                              <li>Dán URL webhook của bạn vào mục cài đặt form.</li>
                            </ol>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155' }}>
                            <code style={{ color: '#38bdf8', flex: 1, fontSize: '0.8125rem', wordBreak: 'break-all' }}>
                              {webhookUrl(selected.webhook_token)}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(webhookUrl(selected.webhook_token));
                                setCopiedId('guide_wp');
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              {copiedId === 'guide_wp' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                              {copiedId === 'guide_wp' ? 'Đã copy' : 'Copy URL'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Sub-tab 4: Zapier */}
                      {guideTab === 'zapier' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', lineHeight: 1.6 }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                            Hướng Dẫn Tích Hợp Zapier / Make.com / n8n
                          </h4>
                          <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.875rem' }}>
                            <li>Tạo một Action trong Scenario/Workflow: chọn <strong>Webhooks by Zapier</strong> hoặc module <strong>HTTP</strong> trong Make / n8n.</li>
                            <li>Chọn Action Event: <strong>POST</strong>.</li>
                            <li>Ô URL: dán đường dẫn Webhook này.</li>
                            <li>Payload Type: chọn <strong>JSON</strong>.</li>
                            <li>Dữ liệu có thể chứa cấu trúc phẳng hoặc lồng nhau (CRM tự động unwrap thông minh).</li>
                          </ol>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155' }}>
                            <code style={{ color: '#38bdf8', flex: 1, fontSize: '0.8125rem', wordBreak: 'break-all' }}>
                              {webhookUrl(selected.webhook_token)}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(webhookUrl(selected.webhook_token));
                                setCopiedId('guide_zap');
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              {copiedId === 'guide_zap' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                              {copiedId === 'guide_zap' ? 'Đã copy' : 'Copy URL'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Sub-tab 5: Code */}
                      {guideTab === 'code' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                            Mã Nguồn Mẫu (cURL / JavaScript / PHP / Python)
                          </h4>

                          {/* cURL */}
                          <div style={{ position: 'relative', background: '#0f172a', padding: '1rem', borderRadius: 8, border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>cURL Command</span>
                              <button
                                onClick={() => {
                                  const code = `curl -X POST "${webhookUrl(selected.webhook_token)}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Nguyễn Văn A",\n    "phone": "0912345678",\n    "email": "a@gmail.com",\n    "source": "${selected.default_source || 'Website'}",\n    "nhu_cau": "Tư vấn dự án"\n  }'`;
                                  navigator.clipboard.writeText(code);
                                  setCopiedId('code_curl');
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                {copiedId === 'code_curl' ? 'Đã copy' : 'Copy cURL'}
                              </button>
                            </div>
                            <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '0.75rem', fontFamily: 'monospace', overflowX: 'auto' }}>
{`curl -X POST "${webhookUrl(selected.webhook_token)}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Nguyễn Văn A",
    "phone": "0912345678",
    "email": "a@gmail.com",
    "source": "${selected.default_source || 'Website'}",
    "nhu_cau": "Tư vấn dự án"
  }'`}
                            </pre>
                          </div>

                          {/* JavaScript Fetch */}
                          <div style={{ position: 'relative', background: '#0f172a', padding: '1rem', borderRadius: 8, border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>JavaScript Fetch (Browser / Node.js)</span>
                              <button
                                onClick={() => {
                                  const code = `fetch("${webhookUrl(selected.webhook_token)}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    name: "Nguyễn Văn A",\n    phone: "0912345678",\n    email: "a@gmail.com",\n    source: "${selected.default_source || 'Landing Page'}",\n    note: "Khách cần gọi lại sau 18h"\n  })\n}).then(res => res.json()).then(console.log);`;
                                  navigator.clipboard.writeText(code);
                                  setCopiedId('code_fetch');
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                {copiedId === 'code_fetch' ? 'Đã copy' : 'Copy Fetch'}
                              </button>
                            </div>
                            <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '0.75rem', fontFamily: 'monospace', overflowX: 'auto' }}>
{`fetch("${webhookUrl(selected.webhook_token)}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Nguyễn Văn A",
    phone: "0912345678",
    email: "a@gmail.com",
    source: "${selected.default_source || 'Landing Page'}",
    note: "Khách cần gọi lại sau 18h"
  })
}).then(res => res.json()).then(console.log);`}
                            </pre>
                          </div>

                          {/* PHP cURL */}
                          <div style={{ position: 'relative', background: '#0f172a', padding: '1rem', borderRadius: 8, border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>PHP (cURL)</span>
                              <button
                                onClick={() => {
                                  const code = `<?php\n$ch = curl_init("${webhookUrl(selected.webhook_token)}");\n$payload = json_encode([\n    "name" => "Nguyễn Văn A",\n    "phone" => "0912345678",\n    "email" => "a@gmail.com",\n    "source" => "${selected.default_source || 'Website'}",\n    "note" => "Tư vấn dự án"\n]);\ncurl_setopt($ch, CURLOPT_POST, true);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, $payload);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$response = curl_exec($ch);\ncurl_close($ch);\necho $response;`;
                                  navigator.clipboard.writeText(code);
                                  setCopiedId('code_php');
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                {copiedId === 'code_php' ? 'Đã copy' : 'Copy PHP'}
                              </button>
                            </div>
                            <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '0.75rem', fontFamily: 'monospace', overflowX: 'auto' }}>
{`<?php
$ch = curl_init("${webhookUrl(selected.webhook_token)}");
$payload = json_encode([
    "name" => "Nguyễn Văn A",
    "phone" => "0912345678",
    "email" => "a@gmail.com",
    "source" => "${selected.default_source || 'Website'}",
    "note" => "Tư vấn dự án"
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`}
                            </pre>
                          </div>

                          {/* Python requests */}
                          <div style={{ position: 'relative', background: '#0f172a', padding: '1rem', borderRadius: 8, border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>Python (requests)</span>
                              <button
                                onClick={() => {
                                  const code = `import requests\n\nurl = "${webhookUrl(selected.webhook_token)}"\npayload = {\n    "name": "Nguyễn Văn A",\n    "phone": "0912345678",\n    "email": "a@gmail.com",\n    "source": "${selected.default_source || 'Website'}",\n    "note": "Tư vấn dự án"\n}\nres = requests.post(url, json=payload)\nprint(res.json())`;
                                  navigator.clipboard.writeText(code);
                                  setCopiedId('code_python');
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                {copiedId === 'code_python' ? 'Đã copy' : 'Copy Python'}
                              </button>
                            </div>
                            <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '0.75rem', fontFamily: 'monospace', overflowX: 'auto' }}>
{`import requests

url = "${webhookUrl(selected.webhook_token)}"
payload = {
    "name": "Nguyễn Văn A",
    "phone": "0912345678",
    "email": "a@gmail.com",
    "source": "${selected.default_source || 'Website'}",
    "note": "Tư vấn dự án"
}
res = requests.post(url, json=payload)
print(res.json())`}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                renderMappingTable()
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

            <div>
              <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>{t('Tên kết nối')}</label>
              <input
                className="form-input"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text)' }}
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>

            {(selected?.connection_type === 'webhook' || selected?.connection_type === 'landing_page') && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>{t('Nguồn mặc định (Source)')}</label>
                  <input
                    className="form-input"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                    placeholder="VD: Ladipage, Website..."
                    value={editDefaultSource}
                    onChange={e => setEditDefaultSource(e.target.value)}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                    Áp dụng khi payload không chứa trường source
                  </span>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>{t('Loại / Dự án mặc định (Type)')}</label>
                  <input
                    className="form-input"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                    placeholder="VD: Căn hộ cao cấp..."
                    value={editDefaultType}
                    onChange={e => setEditDefaultType(e.target.value)}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                    Áp dụng khi payload không chứa trường type
                  </span>
                </div>
              </div>
            )}

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

      {/* MODAL TẠO WEBHOOK ĐA NĂNG */}
      <CustomModal
        isOpen={showAddWebhook}
        onClose={() => setShowAddWebhook(false)}
        title={t("Tạo Webhook Đa Năng (Nhận Mọi Nguồn)")}
        width="620px"
      >
        {showAddWebhook && (
          <div>
            <div style={{ padding: '1.5rem', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', flexShrink: 0
                }}>
                  <Webhook size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                    {t('Tạo Cổng Webhook Đa Năng')}
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                    {t('Bắn cái gì qua nhận được hết: Ladipage, Website, Elementor, Zapier, Make...')}
                  </p>
                </div>
              </div>

              {/* Tên Webhook */}
              <div>
                <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                  {t('Tên Webhook / Kênh tiếp nhận')} <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  className="form-input"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text)' }}
                  placeholder={t("VD: Ladipage Tuyển Dụng, Form Báo Giá Aqua City...")}
                  value={newWebhookName}
                  onChange={e => setNewWebhookName(e.target.value)}
                />
              </div>

              {/* Mẫu nguồn nhanh */}
              <div>
                <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                  {t('Mẫu cấu hình nhanh')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                  {[
                    { id: 'ladipage', label: '⚡ Ladipage', source: 'Ladipage', type: 'Hot Lead' },
                    { id: 'wordpress', label: '🌐 Website Form', source: 'Website', type: 'Tư vấn' },
                    { id: 'facebook', label: '📱 Facebook Ads', source: 'Facebook Ads', type: 'Chiến dịch Ads' },
                    { id: 'zapier', label: '🔄 Zapier / Make', source: 'Zapier', type: 'Tự động' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setNewWebhookPreset(p.id as any);
                        setNewWebhookSource(p.source);
                        setNewWebhookType(p.type);
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: newWebhookPreset === p.id ? '2px solid #6366f1' : '1px solid var(--color-border)',
                        background: newWebhookPreset === p.id ? 'rgba(99, 102, 241, 0.08)' : 'var(--color-bg)',
                        color: newWebhookPreset === p.id ? '#6366f1' : 'var(--color-text)',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nguồn mặc định & Loại mặc định */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    {t('Nguồn mặc định (Source)')}
                  </label>
                  <input
                    className="form-input"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                    placeholder="VD: Ladipage, Website..."
                    value={newWebhookSource}
                    onChange={e => setNewWebhookSource(e.target.value)}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                    Gán nếu payload không chứa nguồn
                  </span>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    {t('Loại / Dự án mặc định (Type)')}
                  </label>
                  <input
                    className="form-input"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                    placeholder="VD: Căn hộ cao cấp..."
                    value={newWebhookType}
                    onChange={e => setNewWebhookType(e.target.value)}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                    Gán nếu payload không chứa loại
                  </span>
                </div>
              </div>

              {/* Tùy chọn thông minh */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--color-bg)', padding: '1rem', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                {/* Auto append */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {t('Tự động gom thông tin phụ vào Ghi chú')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {t('Không lo sót dữ liệu: Mọi trường không khớp sẽ gom sạch vào Ghi chú Lead.')}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={newWebhookAutoAppend}
                    onChange={setNewWebhookAutoAppend}
                  />
                </div>

                {/* Require phone */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', paddingTop: 10 }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {t('Bắt buộc phải có Số Điện Thoại')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {t('Nếu tắt, CRM chấp nhận tạo lead ngay cả khi chỉ có Email hoặc Tên/Ghi chú.')}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={newWebhookRequirePhone}
                    onChange={setNewWebhookRequirePhone}
                  />
                </div>

                {/* Notify admin */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', paddingTop: 10 }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {t('Thông báo cho Quản trị viên')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {t('Bắn thông báo chuông & email cho admin khi có lead mới từ webhook này.')}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={newWebhookNotifyAdmin}
                    onChange={setNewWebhookNotifyAdmin}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn outline" onClick={() => setShowAddWebhook(false)}>
                {t('Hủy')}
              </button>
              <button
                className="btn primary"
                onClick={handleAddWebhook}
                disabled={isSaving || !newWebhookName.trim()}
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {isSaving ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
                {isSaving ? t('Đang tạo...') : t('Tạo Webhook Ngay')}
              </button>
            </div>
          </div>
        )}
      </CustomModal>

      {/* MODAL XEM CHI TIẾT LOG PAYLOAD */}
      <CustomModal
        isOpen={Boolean(inspectingLog)}
        onClose={() => setInspectingLog(null)}
        title={t("Chi Tiết Request Webhook")}
        width="750px"
      >
        {inspectingLog && (
          <div style={{ padding: '1.5rem', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Meta badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', background: 'var(--color-bg)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
              <span style={{
                background: inspectingLog.status === 'success' ? '#10b981' : '#ef4444',
                color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800
              }}>
                {inspectingLog.status === 'success' ? 'Thành công' : 'Lỗi'}
              </span>
              <span style={{ background: '#6366f1', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800 }}>
                {inspectingLog.request_method}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                IP: {inspectingLog.ip_address}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {inspectingLog.created_at}
              </span>
              {inspectingLog.lead_id && (
                <span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
                  Lead #{inspectingLog.lead_id}
                </span>
              )}
            </div>

            {/* Thông báo kết quả xử lý */}
            {inspectingLog.message && (
              <div style={{ fontSize: '0.8125rem', color: inspectingLog.status === 'success' ? '#059669' : '#dc2626', background: inspectingLog.status === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', padding: '8px 12px', borderRadius: 8, border: inspectingLog.status === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 600 }}>
                {inspectingLog.message}
              </div>
            )}

            {/* Raw Payload Block */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, margin: 0 }}>
                  {t('Payload Gốc (Raw Request Body / Parameters)')}
                </label>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inspectingLog.raw_payload || '');
                    toast.success(t('Đã copy Payload gốc!'));
                  }}
                  className="btn outline"
                  style={{ padding: '3px 8px', fontSize: '0.75rem', height: 26, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Copy size={13} /> {t('Copy Raw')}
                </button>
              </div>
              <pre style={{
                margin: 0,
                maxHeight: 240,
                overflowY: 'auto',
                background: '#0f172a',
                color: '#38bdf8',
                padding: '1rem',
                borderRadius: 8,
                border: '1px solid #334155',
                fontSize: '0.8125rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(inspectingLog.raw_payload), null, 2);
                  } catch {
                    return inspectingLog.raw_payload || '(Trống)';
                  }
                })()}
              </pre>
            </div>

            {/* Parsed Data Block */}
            {inspectingLog.parsed_data && (
              <div>
                <label className="form-label" style={{ fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
                  {t('Dữ Liệu Bóc Tách Được (Parsed Fields)')}
                </label>
                <pre style={{
                  margin: 0,
                  maxHeight: 180,
                  overflowY: 'auto',
                  background: '#1e293b',
                  color: '#e2e8f0',
                  padding: '1rem',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  fontSize: '0.8125rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(inspectingLog.parsed_data), null, 2);
                    } catch {
                      return inspectingLog.parsed_data;
                    }
                  })()}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
              <button className="btn primary" onClick={() => setInspectingLog(null)} style={{ padding: '6px 16px' }}>
                {t('Đóng')}
              </button>
            </div>
          </div>
        )}
      </CustomModal>
    </>
  );
};

export const Integrations = withRouterFreezer(IntegrationsInner, '/integrations');
