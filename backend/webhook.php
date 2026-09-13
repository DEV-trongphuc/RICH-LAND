<?php
// webhook.php - Endpoint for Google Sheets
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'db_connect.php';

require_once 'webhook_logic.php';

function respondAndNotifyAdmin($conn, $connData, $leadId, $customerData, $distData, $responseJson, $lockKey, &$lockReleased) {
    global $webhookLogId;
    if (function_exists('releaseAdvisoryLock')) {
        releaseAdvisoryLock($conn, $lockKey, $lockReleased);
    }

    if (!empty($webhookLogId) && $conn && $conn instanceof mysqli && @$conn->ping()) {
        try {
            $logStatus = $responseJson['status'] ?? (!empty($responseJson['success']) ? 'success' : 'error');
            $logMsg = $responseJson['message'] ?? '';
            $upStmt = $conn->prepare("UPDATE webhook_logs SET lead_id = ?, status = ?, message = ? WHERE id = ?");
            if ($upStmt) {
                $leadIdVal = !empty($leadId) ? (int)$leadId : null;
                $upStmt->bind_param("issi", $leadIdVal, $logStatus, $logMsg, $webhookLogId);
                $upStmt->execute();
                $upStmt->close();
            }
        } catch (Throwable $e) {}
    }

    if (function_exists('fastcgi_finish_request')) {
        echo json_encode($responseJson);
        fastcgi_finish_request();
    } else {
        ignore_user_abort(true);
        ob_start();
        echo json_encode($responseJson);
        $size = ob_get_length();
        header("Content-Length: $size");
        header("Connection: close");
        ob_end_flush();
        @ob_flush();
        flush();
    }

    $notifyAdmin = (int) ($connData['notify_admin'] ?? 1);
    if ($notifyAdmin === 1 && !empty($leadId)) {
        try {
            require_once __DIR__ . '/webhook_logic.php';
            sendNewLeadApiNotificationToAdmins($conn, $connData, $leadId, $customerData, $distData);
        } catch (Exception $e) {
            error_log("Error in sendNewLeadApiNotificationToAdmins: " . $e->getMessage());
        }
    }
    
    $conn->close();
    exit();
}

// Handle CORS Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$webhookLogId = null;

function logWebhookResult($conn, $logId, $leadId = null, $status = 'success', $message = '') {
    if (!$logId || !$conn || !($conn instanceof mysqli)) return;
    try {
        $upStmt = $conn->prepare("UPDATE webhook_logs SET lead_id = ?, status = ?, message = ? WHERE id = ?");
        if ($upStmt) {
            $upStmt->bind_param("issi", $leadId, $status, $message, $logId);
            $upStmt->execute();
            $upStmt->close();
        }
    } catch (Throwable $e) {
        error_log("logWebhookResult error: " . $e->getMessage());
    }
}

// Allow both POST and GET
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method Not Allowed"]);
    exit();
}

// Universal Inbound Payload Extractor
$rawInput = file_get_contents("php://input");
$contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
$data = null;

// 1. Try JSON decoding
if (!empty($rawInput)) {
    $trimmed = trim($rawInput);
    if ((str_starts_with($trimmed, '{') && str_ends_with($trimmed, '}')) || 
        (str_starts_with($trimmed, '[') && str_ends_with($trimmed, ']'))) {
        $decoded = json_decode($rawInput, true);
        if (is_array($decoded)) {
            $data = $decoded;
        }
    }
}

// 2. If not JSON, check $_POST (Form-data / x-www-form-urlencoded)
if (empty($data) && !empty($_POST)) {
    $data = $_POST;
}

// 3. If $_POST empty but rawInput exists, try parse_str (url-encoded raw body)
if (empty($data) && !empty($rawInput)) {
    parse_str($rawInput, $parsed);
    if (!empty($parsed) && is_array($parsed)) {
        $data = $parsed;
    }
}

// 4. Fallback to $_GET
if (empty($data) && !empty($_GET)) {
    $getCopy = $_GET;
    unset($getCopy['token']);
    if (!empty($getCopy)) {
        $data = $getCopy;
    }
}

if (!is_array($data)) {
    $data = [];
}

// Support top-level indexed array [ { "phone": "..." } ]
if (array_keys($data) === range(0, count($data) - 1) && isset($data[0]) && is_array($data[0])) {
    $data = $data[0];
}

// Helper to unwrap nested payloads (Meta Webhooks, Ladipage, Zapier, Make, n8n wrappers)
if (!function_exists('unwrapWebhookPayload')) {
    function unwrapWebhookPayload($payload) {
        if (!is_array($payload)) return [];
        // Meta / Facebook Lead Ads Webhook: entry[0].changes[0].value
        if (isset($payload['entry'][0]['changes'][0]['value']) && is_array($payload['entry'][0]['changes'][0]['value'])) {
            $metaVal = $payload['entry'][0]['changes'][0]['value'];
            unset($payload['entry']);
            $payload = array_merge($payload, $metaVal);
        }
        // Common wrapper keys
        $wrapperKeys = ['data', 'payload', 'lead', 'form_data', 'contact', 'body', 'fields', 'customer', 'item', 'info', 'record'];
        foreach ($wrapperKeys as $wKey) {
            if (isset($payload[$wKey]) && is_array($payload[$wKey]) && !empty($payload[$wKey])) {
                $inner = $payload[$wKey];
                unset($payload[$wKey]);
                // Flatten associative keys or take first item if indexed array
                if (array_keys($inner) !== range(0, count($inner) - 1)) {
                    $payload = array_merge($inner, $payload);
                } else if (isset($inner[0]) && is_array($inner[0])) {
                    $payload = array_merge($inner[0], $payload);
                }
                break;
            }
        }
        return $payload;
    }
}
$data = unwrapWebhookPayload($data);

// Extract token from Query, Body, Headers (Bearer / X-Webhook-Token / X-Token)
$token = $_GET['token'] ?? $data['token'] ?? $data['_meta']['token'] ?? ($_POST['token'] ?? '');
if (empty($token)) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = trim($matches[1]);
    } else if (!empty($_SERVER['HTTP_X_WEBHOOK_TOKEN'])) {
        $token = trim($_SERVER['HTTP_X_WEBHOOK_TOKEN']);
    } else if (!empty($_SERVER['HTTP_X_TOKEN'])) {
        $token = trim($_SERVER['HTTP_X_TOKEN']);
    }
}
$spreadsheet_id = $data['_meta']['spreadsheet_id'] ?? ($data['spreadsheet_id'] ?? ($_POST['spreadsheet_id'] ?? ''));

$connData = null;
if (!empty($token)) {
    $stmt = $conn->prepare("SELECT id, sheet_name, default_source, default_type, require_both_contact, connection_type, is_silent, sync_saleperson, spreadsheet_id, notify_admin, auto_append_unmapped_note, webhook_token FROM sheet_connections WHERE webhook_token = ? AND is_active = 1");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $connRes = $stmt->get_result();
    if ($connRes->num_rows > 0) {
        $connData = $connRes->fetch_assoc();
        if (!empty($spreadsheet_id) && !empty($connData['spreadsheet_id']) && $connData['spreadsheet_id'] !== $spreadsheet_id) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Spreadsheet ID does not match this token connection"]);
            exit();
        }
    } else {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "Invalid or inactive token"]);
        exit();
    }
    $stmt->close();
} else if (!empty($spreadsheet_id)) {
    $stmt = $conn->prepare("SELECT id, sheet_name, default_source, default_type, require_both_contact, connection_type, is_silent, sync_saleperson, webhook_token, notify_admin, auto_append_unmapped_note FROM sheet_connections WHERE spreadsheet_id = ? AND is_active = 1 LIMIT 1");
    $stmt->bind_param("s", $spreadsheet_id);
    $stmt->execute();
    $connRes = $stmt->get_result();
    if ($connRes->num_rows > 0) {
        $connData = $connRes->fetch_assoc();
        if (!empty($connData['webhook_token'])) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Token is required for this connection"]);
            exit();
        }
    } else {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "Invalid or inactive connection ID"]);
        exit();
    }
    $stmt->close();
} else {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Missing token or spreadsheet_id"]);
    exit();
}

$connectionId = (int)$connData['id'];
$requirePhone = (int)$connData['require_both_contact'];
$connectionType = $connData['connection_type'] ?? 'sheets';
$isSilent = (int) ($connData['is_silent'] ?? 0);
$syncSaleperson = (int) ($connData['sync_saleperson'] ?? 0);
$autoAppendNote = (int) ($connData['auto_append_unmapped_note'] ?? 1);

// Record initial request in webhook_logs
try {
    $rawToLog = !empty($rawInput) ? $rawInput : json_encode($data, JSON_UNESCAPED_UNICODE);
    $ipAddr = $_SERVER['REMOTE_ADDR'] ?? '';
    $reqMeth = $_SERVER['REQUEST_METHOD'] ?? 'POST';
    $logStmt = $conn->prepare("INSERT INTO webhook_logs (connection_id, token, ip_address, request_method, content_type, raw_payload, parsed_data, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'processing')");
    if ($logStmt) {
        $parsedJson = json_encode($data, JSON_UNESCAPED_UNICODE);
        $tokVal = !empty($token) ? $token : ($connData['webhook_token'] ?? null);
        $logStmt->bind_param("issssss", $connectionId, $tokVal, $ipAddr, $reqMeth, $contentType, $rawToLog, $parsedJson);
        $logStmt->execute();
        $webhookLogId = $logStmt->insert_id;
        $logStmt->close();
    }
} catch (Throwable $e) {
    error_log("Webhook logs insert error: " . $e->getMessage());
}

// Load explicit field mappings (if configured)
$mappings = [];
$mapStmt = $conn->prepare("SELECT sheet_column, system_field, custom_label FROM field_mappings WHERE connection_id = ?");
$mapStmt->bind_param("i", $connectionId);
$mapStmt->execute();
$mappingsResult = $mapStmt->get_result();
while($row = $mappingsResult->fetch_assoc()) {
    $sysField = $row['system_field'];
    if (!isset($mappings[$sysField])) {
        $mappings[$sysField] = [];
    }
    $mappings[$sysField][] = [
        'sheet_column' => $row['sheet_column'],
        'custom_label' => $row['custom_label']
    ];
}
$mapStmt->close();

function extractMappedValues($mappingsArray, $systemField, $data) {
    if (!isset($mappingsArray[$systemField])) return '';
    $values = [];
    foreach ($mappingsArray[$systemField] as $mapItem) {
        $colName = $mapItem['sheet_column'];
        $customLabel = $mapItem['custom_label'];
        if (isset($data[$colName]) && $data[$colName] !== '') {
            $label = !empty($customLabel) ? $customLabel : $colName;
            $values[] = $label . ': ' . $data[$colName];
        }
    }
    $knownSingleFields = [
        'phone', 'phone2', 'name', 'email', 'source', 'type', 'assigned_to', 'saleperson',
        'gender', 'dob', 'citizen_id', 'address', 'city', 'district', 'company', 'job_title', 'tax_code',
        'budget', 'demand_type', 'property_type', 'bedroom_count', 'preferred_location',
        'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'platform', 'form_name',
        'zalo_phone', 'facebook_link'
    ];
    if (in_array($systemField, $knownSingleFields) || strpos($systemField, 'cf_') === 0 || strpos($systemField, 'custom_field_') === 0) {
        foreach ($mappingsArray[$systemField] as $mapItem) {
            $colName = $mapItem['sheet_column'];
            if (isset($data[$colName]) && $data[$colName] !== '') {
                return $data[$colName];
            }
        }
        return '';
    }
    return implode("\n", $values);
}

// Smart Field Alias Matcher for Universal Webhooks
$matchedKeys = ['_meta', 'token', 'spreadsheet_id'];
$findSmartField = function($sysField, $aliases) use ($mappings, &$data, &$matchedKeys) {
    // 1. Check explicit field mappings first
    $mappedVal = extractMappedValues($mappings, $sysField, $data);
    if (!empty($mappedVal)) {
        if (isset($mappings[$sysField])) {
            foreach ($mappings[$sysField] as $m) {
                $matchedKeys[] = $m['sheet_column'];
            }
        }
        return $mappedVal;
    }
    // 2. Direct exact alias match
    foreach ($aliases as $alias) {
        if (isset($data[$alias]) && !is_array($data[$alias]) && trim((string)$data[$alias]) !== '') {
            $matchedKeys[] = $alias;
            return trim((string)$data[$alias]);
        }
    }
    // 3. Case-insensitive & normalized key match (handles "Số điện thoại", "so_dien_thoai", "SoDienThoai")
    $normalizedData = [];
    foreach ($data as $k => $v) {
        if (!is_array($v)) {
            $cleanKey = strtolower(str_replace([' ', '-', '_', '.', ':'], '', $k));
            $normalizedData[$cleanKey] = ['originalKey' => $k, 'val' => $v];
        }
    }
    foreach ($aliases as $alias) {
        $cleanAlias = strtolower(str_replace([' ', '-', '_', '.', ':'], '', $alias));
        if (isset($normalizedData[$cleanAlias]) && trim((string)$normalizedData[$cleanAlias]['val']) !== '') {
            $matchedKeys[] = $normalizedData[$cleanAlias]['originalKey'];
            return trim((string)$normalizedData[$cleanAlias]['val']);
        }
    }
    return '';
};

$phone = normalizePhone($findSmartField('phone', ['phone', 'sdt', 'so_dien_thoai', 'so_dt', 'mobile', 'tel', 'dien_thoai', 'telephone', 'customer_phone', 'phone_number', 'sdt_khach', 'phonenumber', 'dt', 'cellphone', 'contact_number', 'so_dien_thoai_khach', 'dien_thoai_khach', 'sdt_lh', 'phone1', 'caller_id']));
$phone2 = normalizePhone($findSmartField('phone2', ['phone2', 'sdt2', 'sdt_phu', 'so_dien_thoai_2', 'secondary_phone', 'phone_secondary', 'so_phu']));
$name = $findSmartField('name', ['name', 'full_name', 'fullname', 'ho_ten', 'hoten', 'customer_name', 'ten_khach', 'contact_name', 'first_name', 'last_name', 'ten', 'ho_va_ten', 'khach_hang', 'ho_ten_khach', 'ten_khach_hang', 'ho_ten_khach_hang', 'client_name', 'sender_name', 'customer']);
$email = trim($findSmartField('email', ['email', 'mail', 'contact_email', 'customer_email', 'gmail', 'e_mail', 'dia_chi_email', 'client_email', 'email_address']));
$note = $findSmartField('note', ['note', 'ghi_chu', 'ghichu', 'message', 'noidung', 'noi_dung', 'content', 'message_content', 'comment', 'description', 'thong_tin_them', 'loi_nhan', 'nhu_cau_chi_tiet', 'yeu_cau', 'nhu_cau', 'chi_tiet', 'remark']);
$source = $findSmartField('source', ['source', 'nguon', 'utm_source', 'origin', 'channel', 'lead_source', 'nguon_data', 'source_name']);
$type = $findSmartField('type', ['type', 'loai', 'loai_data', 'lead_type', 'demand', 'loai_hinh', 'loai_khach', 'phan_loai']);
$platform = $findSmartField('platform', ['platform', 'nen_tang', 'utm_platform', 'ad_platform', 'kenh', 'traffic_source']);
$utm_campaign = $findSmartField('utm_campaign', ['utm_campaign', 'campaign', 'campaign_name', 'ten_chien_dich', 'chien_dich', 'campaign_id']);
$utm_medium = $findSmartField('utm_medium', ['utm_medium', 'medium', 'hinh_thuc']);
$utm_content = $findSmartField('utm_content', ['utm_content', 'content_ad', 'adset_name', 'ad_name', 'mau_quang_cao', 'adset']);
$utm_term = $findSmartField('utm_term', ['utm_term', 'term', 'tu_khoa', 'keyword']);
$form_name = $findSmartField('form_name', ['form_name', 'form_id', 'ten_form', 'form', 'landing_page_name', 'page_name']);
$budget = $findSmartField('budget', ['budget', 'ngan_sach', 'tai_chinh', 'price', 'gia', 'gia_tien', 'muc_gia', 'khoang_gia']);
$demand_type = $findSmartField('demand_type', ['demand_type', 'muc_dich', 'muc_dich_mua', 'nhu_cau_mua', 'purpose']);
$property_type = $findSmartField('property_type', ['property_type', 'loai_bds', 'loai_bat_dong_san', 'product_type', 'loai_can_ho', 'san_pham']);
$bedroom_count = $findSmartField('bedroom_count', ['bedroom_count', 'so_phong_ngu', 'phong_ngu', 'bedrooms', 'so_pn']);
$preferred_location = $findSmartField('preferred_location', ['preferred_location', 'project', 'du_an', 'vi_tri', 'khu_vuc', 'project_name', 'ten_du_an']);
$address = $findSmartField('address', ['address', 'dia_chi', 'full_address', 'dia_chi_nha']);
$city = $findSmartField('city', ['city', 'tinh', 'thanh_pho', 'province', 'tinh_thanh']);
$district = $findSmartField('district', ['district', 'quan', 'huyen', 'quan_huyen']);
$company = $findSmartField('company', ['company', 'cong_ty', 'don_vi', 'co_quan']);
$job_title = $findSmartField('job_title', ['job_title', 'chuc_vu', 'nghe_nghiep', 'occupation']);
$citizen_id = $findSmartField('citizen_id', ['citizen_id', 'cccd', 'cmnd', 'so_cccd', 'so_cmnd', 'id_card']);
$gender = $findSmartField('gender', ['gender', 'gioi_tinh']);
$dob = $findSmartField('dob', ['dob', 'ngay_sinh', 'birthday', 'birthdate']);
$zalo_phone = $findSmartField('zalo_phone', ['zalo_phone', 'zalo', 'so_zalo', 'link_zalo']);
$facebook_link = $findSmartField('facebook_link', ['facebook_link', 'facebook', 'link_fb', 'fb', 'profile_fb']);

// Fallbacks for Source & Type
if (empty($source)) {
    $source = !empty($connData['default_source']) ? $connData['default_source'] : $connData['sheet_name'];
}
if (empty($type)) {
    $type = !empty($connData['default_type']) ? $connData['default_type'] : 'Nóng';
}

// Universal Catch-All: Collect 100% of residual / extra fields into Note
if ($autoAppendNote === 1 || $connectionType === 'webhook' || $connectionType === 'landing_page') {
    $extraNotes = [];
    foreach ($data as $k => $v) {
        if (in_array($k, $matchedKeys)) continue;
        if (is_array($v)) {
            $valStr = json_encode($v, JSON_UNESCAPED_UNICODE);
        } else {
            $valStr = trim((string)$v);
        }
        if ($valStr !== '') {
            $extraNotes[] = "• $k: $valStr";
        }
    }
    if (!empty($extraNotes)) {
        $extraHeader = "\n\n[Dữ liệu Webhook bổ sung]:\n" . implode("\n", $extraNotes);
        $note = !empty($note) ? ($note . $extraHeader) : trim($extraHeader);
    }
}

if (isLeadBlocked($conn, $phone, $email)) {
    http_response_code(400);
    logWebhookResult($conn, $webhookLogId, null, 'blocked', 'This contact is permanently blocked in the system.');
    echo json_encode(["success" => false, "message" => "This contact is permanently blocked in the system."]);
    exit();
}

if ($requirePhone == 1) {
    if (empty($phone)) {
        http_response_code(400);
        logWebhookResult($conn, $webhookLogId, null, 'error', 'Phone number is required');
        echo json_encode(["success" => false, "message" => "Phone number is required"]);
        exit();
    }
} else {
    if (empty($phone) && empty($email) && empty($name) && empty($note)) {
        http_response_code(400);
        logWebhookResult($conn, $webhookLogId, null, 'error', 'At least one contact or note field is required');
        echo json_encode(["success" => false, "message" => "At least one contact or note field is required"]);
        exit();
    }
}

// --- 0. Advisory Lock to prevent simultaneous identical webhooks ---
$lockKey = '';
if (!empty($phone)) {
    $lockKey = 'webhook_lead_phone_' . $phone;
} else if (!empty($email)) {
    $lockKey = 'webhook_lead_email_' . md5($email);
} else {
    $lockKey = 'webhook_lead_empty_' . md5(json_encode($data));
}

$lockStmt = $conn->prepare("SELECT GET_LOCK(?, 10) as get_lock");
$lockStmt->bind_param("s", $lockKey);
$lockStmt->execute();
$lockRes = $lockStmt->get_result()->fetch_assoc();
$lockStmt->close();
if ($lockRes['get_lock'] != 1) {
    http_response_code(429);
    echo json_encode(["success" => false, "message" => "Too many concurrent requests for this lead. Please try again later."]);
    exit();
}

$lockReleased = false;

if (!function_exists('releaseAdvisoryLock')) {
    function releaseAdvisoryLock($conn, $lockKey, &$lockReleased) {
        if (!$lockReleased && $conn && $conn instanceof mysqli && @$conn->ping()) {
            $relStmt = $conn->prepare("SELECT RELEASE_LOCK(?)");
            if ($relStmt) {
                $relStmt->bind_param("s", $lockKey);
                $relStmt->execute();
                $relStmt->close();
            }
            $lockReleased = true;
        }
    }
}

// BUG-CRIT-01 fix: Dùng prepared statement cho RELEASE_LOCK, tránh SQL Injection
register_shutdown_function(function() use ($conn, $lockKey, &$lockReleased) {
    releaseAdvisoryLock($conn, $lockKey, $lockReleased);
});

// --- 0. Check Global Blacklist / Exclusions ---
if (checkGlobalExclusion($conn, $data, $phone, $email, true, $name, $source, $type, $note)) {
    // If blacklisted, return ignored immediately without saving to DB
    echo json_encode(["success" => true, "status" => "ignored", "message" => "Data matches exclusion list."]);
    releaseAdvisoryLock($conn, $lockKey, $lockReleased);
    exit();
}

// --- 1. Evaluate Dynamic Rules to determine the Target Round & Apply Injects ---
$data['phone'] = $phone;
$data['email'] = $email;
$data['name'] = $name;
$data['note'] = $note;
$data['source'] = $source;
$data['type'] = $type;
if (!empty($platform)) $data['platform'] = $platform;
if (!empty($budget)) $data['budget'] = $budget;
if (!empty($utm_campaign)) $data['utm_campaign'] = $utm_campaign;
if (!empty($utm_medium)) $data['utm_medium'] = $utm_medium;
if (!empty($utm_content)) $data['utm_content'] = $utm_content;
if (!empty($utm_term)) $data['utm_term'] = $utm_term;
if (!empty($form_name)) $data['form_name'] = $form_name;

$ruleResult = evaluateRules($conn, $data, $source, $type, $connectionId, $connectionType);
$targetRoundId = null;
$inject = [];
$status = 'unassigned';
$message = 'No matching rule found.';

if (is_array($ruleResult)) {
    $targetRoundId = $ruleResult['target_round_id'];
    $inject = $ruleResult['inject'] ?? [];
    
    // Áp dụng ghi đè dữ liệu (Inject Fields)
    $standardFields = ['source', 'type', 'note', 'name', 'phone', 'email', 'platform', 'budget'];
    foreach ($inject as $k => $v) {
        if (in_array($k, $standardFields)) {
            if ($k === 'source') $source = $v;
            if ($k === 'type') $type = $v;
            if ($k === 'platform') $platform = $v;
            if ($k === 'budget') $budget = $v;
            if ($k === 'note') $note = $v;
            if ($k === 'name') $name = $v;
            if ($k === 'phone') $phone = normalizePhone($v);
            if ($k === 'email') $email = trim($v);
        } else {
            // Append custom fields to note
            $note .= "\n[$k]: $v";
        }
    }
} else {
    $targetRoundId = $ruleResult;
}

$inactiveRoundName = '';
if ($targetRoundId) {
    $chkRound = $conn->prepare("SELECT is_active, round_name FROM distribution_rounds WHERE id = ?");
    if ($chkRound) {
        $chkRound->bind_param("i", $targetRoundId);
        $chkRound->execute();
        $chkRes = $chkRound->get_result()->fetch_assoc();
        $chkRound->close();
        if (!$chkRes || (int)$chkRes['is_active'] !== 1) {
            $inactiveRoundName = $chkRes['round_name'] ?? ('ID ' . $targetRoundId);
            $targetRoundId = null;
        }
    }
}

$isFallbackAdmin = false;
$fallbackAdminData = null;
$fallbackCcEmails = '';

if (!$targetRoundId) {
    $fbSettings = [];
    $fbRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('fallback_type', 'fallback_round_id', 'fallback_admin_id', 'fallback_cc_email')");
    if ($fbRes) {
        while ($row = $fbRes->fetch_assoc()) {
            $fbSettings[$row['setting_key']] = $row['setting_value'];
        }
    }
    
    $fbType = $fbSettings['fallback_type'] ?? 'round';
    $fbCc = $fbSettings['fallback_cc_email'] ?? '';
    
    if ($fbType === 'admin') {
        $fbAdminId = (int)($fbSettings['fallback_admin_id'] ?? 0);
        if ($fbAdminId > 0) {
            $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND (role = 'admin' OR role = 'superadmin') LIMIT 1");
            if ($admStmt) {
                $admStmt->bind_param("i", $fbAdminId);
                $admStmt->execute();
                $admRes = $admStmt->get_result();
                if ($admRes->num_rows > 0) {
                    $fallbackAdminData = $admRes->fetch_assoc();
                    $isFallbackAdmin = true;
                    $status = 'fallback';
                    $message = !empty($inactiveRoundName)
                        ? "Vòng matched ($inactiveRoundName) tạm dừng. Chuyển hướng sang Admin dự phòng: " . $fallbackAdminData['name']
                        : 'No matching rule. Routed directly to fallback Admin: ' . $fallbackAdminData['name'];
                    $fallbackCcEmails = $fbCc;
                }
                $admStmt->close();
            }
        }
    } else {
        $fbRoundId = (int)($fbSettings['fallback_round_id'] ?? 0);
        if ($fbRoundId > 0) {
            $chkFb = $conn->prepare("SELECT is_active FROM distribution_rounds WHERE id = ?");
            if ($chkFb) {
                $chkFb->bind_param("i", $fbRoundId);
                $chkFb->execute();
                $chkFbRes = $chkFb->get_result()->fetch_assoc();
                $chkFb->close();
                if ($chkFbRes && (int)$chkFbRes['is_active'] === 1) {
                    $targetRoundId = $fbRoundId;
                    $isFallbackRound = true;
                    $message = !empty($inactiveRoundName)
                        ? "Vòng matched ($inactiveRoundName) tạm dừng. Chuyển hướng sang vòng dự phòng."
                        : 'No matching rule found. Routed to fallback round.';
                } else {
                    $targetRoundId = null;
                }
            }
        }
    }
}

// Fetch round details (cc_emails, round_name)
$ccEmails = '';
$roundName = '';
$roundType = 'round_robin';
$grabCountdownSeconds = 300;
$grabCooldownSeconds = 3600;
if ($targetRoundId) {
    $stmtQ = $conn->prepare("SELECT round_name, cc_emails, round_type, grab_countdown_seconds, grab_cooldown_seconds FROM distribution_rounds WHERE id = ?");
    if ($stmtQ) {
        $stmtQ->bind_param("i", $targetRoundId);
        $stmtQ->execute();
        $qRound = $stmtQ->get_result();
        if ($qRound && $qRound->num_rows > 0) {
            $rData = $qRound->fetch_assoc();
            $ccEmails = $rData['cc_emails'] ?? '';
            $roundName = $rData['round_name'] ?? '';
            $roundType = $rData['round_type'] ?? 'round_robin';
            $grabCountdownSeconds = (int)($rData['grab_countdown_seconds'] ?? 300);
            $grabCooldownSeconds = (int)($rData['grab_cooldown_seconds'] ?? 3600);
        }
        $stmtQ->close();
    }
} else if ($isFallbackAdmin && !empty($fallbackCcEmails)) {
    $ccEmails = $fallbackCcEmails;
}

// --- 2. Check CRM (Duplication & dynamic threshold rule) ---
$crmCheckResult = checkCRMInteraction($conn, $phone, $email);

// Load dynamic duplicate check threshold
$dupCheckMonths = (int)get_system_setting($conn, 'duplicate_check_months');
if ($dupCheckMonths <= 0) {
    $dupCheckMonths = 6;
}

$isFacebookLead = false;
$isGoogleLead = false;
if (!empty($source)) {
    $srcLower = strtolower($source);
    if ($srcLower === 'facebook' || $srcLower === 'fb' || strpos($srcLower, 'facebook') !== false || strpos($srcLower, 'fb') !== false || $srcLower === 'messenger' || $srcLower === 'mess') {
        $isFacebookLead = true;
    }
    if ($srcLower === 'google' || $srcLower === 'google_lp' || strpos($srcLower, 'google') !== false) {
        $isGoogleLead = true;
    }
}

$gopGoogleLeadId = null;
if ($isGoogleLead && $crmCheckResult['leadExists'] && !empty($phone)) {
    $todayStart = date('Y-m-d 00:00:00');
    $todayEnd = date('Y-m-d 23:59:59');
    $chkStmt = $conn->prepare("SELECT id FROM leads WHERE phone = ? AND connection_id = ? AND created_at BETWEEN ? AND ? LIMIT 1");
    if ($chkStmt) {
        $chkStmt->bind_param("siss", $phone, $connectionId, $todayStart, $todayEnd);
        $chkStmt->execute();
        $chkRes = $chkStmt->get_result()->fetch_assoc();
        $chkStmt->close();
        if ($chkRes) {
            $gopGoogleLeadId = (int)$chkRes['id'];
        }
    }
}

if ($gopGoogleLeadId) {
    $conn->begin_transaction();
    try {
        $noteStmt = $conn->prepare("SELECT note FROM leads WHERE id = ?");
        $noteStmt->bind_param("i", $gopGoogleLeadId);
        $noteStmt->execute();
        $oldNote = $noteStmt->get_result()->fetch_assoc()['note'] ?? '';
        $noteStmt->close();
        
        $newNote = $oldNote;
        if (!empty($note)) {
            $newNote = !empty($newNote) ? $newNote . "\n---\n" . $note : $note;
        }
        
        $updStmt = $conn->prepare("UPDATE leads SET note = ?, last_interaction_date = NOW() WHERE id = ?");
        $updStmt->bind_param("si", $newNote, $gopGoogleLeadId);
        $updStmt->execute();
        $updStmt->close();
        
        $conn->commit();
        triggerTwoWaySync($conn, $gopGoogleLeadId);
    } catch (Exception $e) {
        $conn->rollback();
    }
    echo json_encode(["success" => true, "status" => "gop_lead", "message" => "Gộp lead Google cùng ngày thành công."]);
    releaseAdvisoryLock($conn, $lockKey, $lockReleased);
    exit();
}

if ($isSilent == 1) {
    $assignedToId = null;
    if ($syncSaleperson == 1) {
        if ($connectionType === 'landing_page') {
            $assignedToVal = trim($data['saleperson'] ?? $data['assigned_to'] ?? '');
        } else {
            $assignedToVal = extractMappedValues($mappings, 'saleperson', $data);
            if (empty($assignedToVal)) {
                $assignedToVal = extractMappedValues($mappings, 'assigned_to', $data);
            }
        }
        if (!empty($assignedToVal)) {
            $assignedToId = findConsultantByEmailOrName($conn, $assignedToVal);
        }
    }
    
    $conn->begin_transaction();
    try {
        if ($crmCheckResult['leadExists'] && !$isFacebookLead) {
            $ownerId = !empty($crmCheckResult['assignedTo']) ? $crmCheckResult['assignedTo'] : $assignedToId;
            $leadId = updateLead($conn, $phone, $email, $ownerId, $source, $type, $note, $connectionId, null, $name, false, true);
        } else {
            $leadId = insertLead($conn, $data, $assignedToId, $phone, $email, $name, $source, $type, $note, $connectionId, null, true);
        }
        $actualOwnerId = ($crmCheckResult['isDuplicate'] && !empty($crmCheckResult['assignedTo'])) ? $crmCheckResult['assignedTo'] : $assignedToId;
        logDistribution($conn, $leadId, $actualOwnerId, null, 'silent', 'Chỉ đồng bộ check trùng, không định tuyến.', false);
        $conn->commit();
        if (!empty($leadId)) {
            triggerTwoWaySync($conn, $leadId);
        }
    } catch (Exception $e) {
        $conn->rollback();
        if ($e instanceof mysqli_sql_exception && ($e->getCode() === 1062 || strpos($e->getMessage(), 'Duplicate entry') !== false)) {
            echo json_encode(["success" => true, "status" => "silent", "message" => "Chỉ đồng bộ check trùng, dữ liệu trùng lặp (Duplicate Key) đã tồn tại."]);
        } else {
            echo json_encode(["success" => false, "message" => "Lỗi Database: Hệ thống đang bận, vui lòng thử lại sau."]);
        }
        releaseAdvisoryLock($conn, $lockKey, $lockReleased);
        exit();
    }

    // If duplicate, check if we need to send duplicate reminder
    if ($crmCheckResult['isDuplicate'] && $syncSaleperson == 1) {
        $ownerId = $crmCheckResult['assignedTo'];
        if (!empty($ownerId) && (empty($assignedToId) || (int)$ownerId === (int)$assignedToId)) {
            $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
            if ($stmtC) {
                $stmtC->bind_param("i", $ownerId);
                $stmtC->execute();
                $cRow = $stmtC->get_result()->fetch_assoc();
                $stmtC->close();
                if ($cRow && ($cRow['status'] === 'active' || $cRow['status'] === 'leave')) {
                    require_once __DIR__ . '/mailer.php';
                    require_once __DIR__ . '/zalo_bot.php';
                    $timeline = getLeadHistoryTimeline($conn, $leadId, true);
                    try {
                        sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $timeline, $leadId);
                    } catch (Exception $mailEx) {
                        error_log("Error sending silent sync duplicate reminder email: " . $mailEx->getMessage());
                    }
                    try {
                        sendLeadReminderZaloMessageToSale($ownerId, $cRow['name'], $name, $phone, $note, $source, $roundName, $timeline, $leadId, $email, $type);
                    } catch (Exception $zaloEx) {
                        error_log("Error sending silent sync duplicate reminder Zalo: " . $zaloEx->getMessage());
                    }
                }
            }
        }
    }

    $custData = ['name' => $name, 'phone' => $phone, 'email' => $email, 'source' => $source, 'type' => $type, 'note' => $note];
    $distData = [
        'status' => 'silent',
        'assigned_to_id' => $actualOwnerId,
        'round_name' => '',
        'message' => 'Chỉ đồng bộ check trùng, không định tuyến.'
    ];
    respondAndNotifyAdmin($conn, $connData, $leadId, $custData, $distData, ["success" => true, "status" => "silent", "message" => "Chỉ đồng bộ check trùng, không định tuyến."], $lockKey, $lockReleased);
}

// --- Intercept Duplicate lead marked as Notlead by MKT ---
$isMktNotlead = false;
if (isset($data['notlead']) && ($data['notlead'] == 1 || $data['notlead'] === 'true' || $data['notlead'] === 'notlead' || $data['notlead'] === 'yes')) {
    $isMktNotlead = true;
} else if (isset($data['is_notlead']) && ($data['is_notlead'] == 1 || $data['is_notlead'] === 'true' || $data['is_notlead'] === 'yes')) {
    $isMktNotlead = true;
} else if (isset($data['status']) && $data['status'] === 'notlead') {
    $isMktNotlead = true;
}

if ($crmCheckResult['leadExists'] && $isMktNotlead) {
    $conn->begin_transaction();
    try {
        $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, $connectionId, null, $name);
        
        $updHeld = $conn->prepare("UPDATE leads SET status = 'pending_approval', is_accepted = 0, assigned_to = NULL, ai_screener_status = 'failed', ai_evaluation = 'Trùng số nhưng MKT đánh dấu Notlead' WHERE id = ?");
        $updHeld->bind_param("i", $leadId);
        $updHeld->execute();
        $updHeld->close();
        
        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', 'Lead cũ trùng số được MKT đánh dấu Notlead. Đã đưa vào danh sách chờ duyệt (Pending).', false);
        $conn->commit();
        if (!empty($leadId)) {
            triggerTwoWaySync($conn, $leadId);
        }
    } catch (Exception $e) {
        $conn->rollback();
        if ($e instanceof mysqli_sql_exception && ($e->getCode() === 1062 || strpos($e->getMessage(), 'Duplicate entry') !== false)) {
            echo json_encode(["success" => true, "status" => "pending_approval", "message" => "Dữ liệu trùng lặp đã tồn tại trong hàng chờ duyệt."]);
        } else {
            echo json_encode(["success" => false, "message" => "Lỗi Database: " . $e->getMessage()]);
        }
        releaseAdvisoryLock($conn, $lockKey, $lockReleased);
        exit();
    }
    
    $custData = ['name' => $name, 'phone' => $phone, 'email' => $email, 'source' => $source, 'type' => $type, 'note' => $note];
    $distData = [
        'status' => 'pending_approval',
        'assigned_to_id' => null,
        'round_id' => $targetRoundId,
        'message' => 'Lead cũ trùng số được MKT đánh dấu Notlead. Chuyển về Pending.'
    ];
    respondAndNotifyAdmin($conn, $connData, $leadId, $custData, $distData, ["success" => true, "status" => "pending_approval", "message" => "Lead cũ trùng số được MKT đánh dấu Notlead. Chuyển về Pending."], $lockKey, $lockReleased);
}

if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < $dupCheckMonths && !empty($crmCheckResult['assignedTo'])) {
    $assignedTo = $crmCheckResult['assignedTo'];
    $conn->begin_transaction();
    try {
        if ($isFacebookLead) {
            $leadId = insertLead($conn, $data, $assignedTo, $phone, $email, $name, $source, $type, $note, $connectionId);
        } else {
            $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note, $connectionId, null, $name);
        }
        logDistribution($conn, $leadId, $assignedTo, null, 'reminder', 'Khách cũ đăng ký lại < ' . $dupCheckMonths . ' tháng.', false);
        $conn->commit();
        if (!empty($leadId)) {
            triggerTwoWaySync($conn, $leadId);
        }
    } catch (Exception $e) {
        $conn->rollback();
        if ($e instanceof mysqli_sql_exception && ($e->getCode() === 1062 || strpos($e->getMessage(), 'Duplicate entry') !== false)) {
            echo json_encode(["success" => true, "status" => "duplicate", "assignedTo" => $assignedTo, "message" => "Khách cũ trùng lặp (Duplicate Key) đã tồn tại."]);
        } else {
            echo json_encode(["success" => false, "message" => "Lỗi Database: Hệ thống đang bận, vui lòng thử lại sau."]);
        }
        releaseAdvisoryLock($conn, $lockKey, $lockReleased);
        exit();
    }

    try {
        $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
        if ($stmtC) {
            $stmtC->bind_param("i", $assignedTo);
            $stmtC->execute();
            $cRow = $stmtC->get_result()->fetch_assoc();
            $stmtC->close();
            if ($cRow && ($cRow['status'] === 'active' || $cRow['status'] === 'leave')) {
                require_once __DIR__ . '/mailer.php';
                require_once __DIR__ . '/zalo_bot.php';
                $timeline = getLeadHistoryTimeline($conn, $leadId, true);
                try {
                    sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $timeline, $leadId);
                } catch (Exception $mailEx) {
                    error_log("Error sending webhook duplicate reminder email: " . $mailEx->getMessage());
                }
                try {
                    sendLeadReminderZaloMessageToSale($assignedTo, $cRow['name'], $name, $phone, $note, $source, $roundName, $timeline, $leadId, $email, $type);
                } catch (Exception $zaloEx) {
                    error_log("Error sending webhook duplicate reminder Zalo: " . $zaloEx->getMessage());
                }
            }
        }
    } catch (Exception $notifyEx) {
        error_log("Error during webhook duplicate reminder notifications: " . $notifyEx->getMessage());
    }

    $custData = ['name' => $name, 'phone' => $phone, 'email' => $email, 'source' => $source, 'type' => $type, 'note' => $note];
    $distData = [
        'status' => 'duplicate',
        'assigned_to_id' => $assignedTo,
        'round_name' => $roundName,
        'message' => 'Trùng khách cũ chăm sóc lại trong vòng ' . $dupCheckMonths . ' tháng.'
    ];
    respondAndNotifyAdmin($conn, $connData, $leadId, $custData, $distData, ["success" => true, "status" => "duplicate", "assignedTo" => $assignedTo, "message" => "Duplicate < " . $dupCheckMonths . " months."], $lockKey, $lockReleased);
}

// --- 2.2. If existing lead is currently held in pending_approval, keep it held and skip assignment/AI ---
if ($crmCheckResult['leadExists'] && $crmCheckResult['leadStatus'] === 'pending_approval') {
    $conn->begin_transaction();
    try {
        $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, $connectionId, null, $name);
        
        $updHeld = $conn->prepare("UPDATE leads SET status = 'pending_approval', assigned_to = NULL WHERE id = ?");
        $updHeld->bind_param("i", $leadId);
        $updHeld->execute();
        $updHeld->close();
        
        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', 'Dữ liệu trùng lặp đang chờ AI/Admin phê duyệt.', false);
        $conn->commit();
        if (!empty($leadId)) {
            triggerTwoWaySync($conn, $leadId);
        }
    } catch (Exception $e) {
        $conn->rollback();
        if ($e instanceof mysqli_sql_exception && ($e->getCode() === 1062 || strpos($e->getMessage(), 'Duplicate entry') !== false)) {
            echo json_encode(["success" => true, "status" => "pending_approval", "message" => "Dữ liệu trùng lặp (Duplicate Key) đang chờ AI/Admin phê duyệt."]);
        } else {
            echo json_encode(["success" => false, "message" => "Lỗi Database: Dữ liệu đang được xử lý, vui lòng thử lại sau."]);
        }
        releaseAdvisoryLock($conn, $lockKey, $lockReleased);
        exit();
    }

    $custData = ['name' => $name, 'phone' => $phone, 'email' => $email, 'source' => $source, 'type' => $type, 'note' => $note];
    $distData = [
        'status' => 'pending_approval',
        'assigned_to_id' => null,
        'round_id' => $targetRoundId,
        'message' => 'Dữ liệu trùng lặp đang chờ AI/Admin phê duyệt.'
    ];
    respondAndNotifyAdmin($conn, $connData, $leadId, $custData, $distData, ["success" => true, "status" => "pending_approval", "message" => "Dữ liệu trùng lặp đang chờ AI/Admin phê duyệt."], $lockKey, $lockReleased);
}

// --- 2.5. AI Screener & Gatekeeper evaluation (Only if new lead / duplicate older than N months) ---
$aiScreenerResult = evaluateScreener($conn, $targetRoundId, $data);

$isSubstandardAutoApprove = false;
if ($aiScreenerResult && $aiScreenerResult['status'] === 'failed') {
    $bsFallbackEnabled = (int) ($aiScreenerResult['below_standard_fallback_enabled'] ?? 0);
    $bsAutoApprove = (int) ($aiScreenerResult['below_standard_auto_approve'] ?? 0);
    $bsFallbackRoundId = (int) ($aiScreenerResult['below_standard_fallback_round_id'] ?? 0);

    if ($bsFallbackEnabled === 1 && $bsAutoApprove === 1 && $bsFallbackRoundId > 0) {
        $targetRoundId = $bsFallbackRoundId;
        $isSubstandardAutoApprove = true;
        // Update roundName for the logs
        $rQuery = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ? LIMIT 1");
        if ($rQuery) {
            $rQuery->bind_param("i", $targetRoundId);
            $rQuery->execute();
            $rRes = $rQuery->get_result()->fetch_assoc();
            if ($rRes) {
                $roundName = $rRes['round_name'];
            }
            $rQuery->close();
        }
    }
}

if ($aiScreenerResult && $aiScreenerResult['status'] === 'pending') {
    $conn->begin_transaction();
    try {
        if ($crmCheckResult['leadExists']) {
            $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, $connectionId, null, $name);
        } else {
            $leadId = insertLead($conn, $data, null, $phone, $email, $name, $source, $type, $note, $connectionId);
        }
        
        $updHeld = $conn->prepare("UPDATE leads SET status = 'pending_approval', target_round_id = ?, ai_screener_status = 'pending', ai_evaluation = 'Chờ AI đánh giá', assigned_to = NULL WHERE id = ?");
        $updHeld->bind_param("ii", $targetRoundId, $leadId);
        $updHeld->execute();
        $updHeld->close();
        
        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', 'Đang chờ AI đánh giá (Chạy ngầm)', false);
        $conn->commit();
        
        if (!empty($leadId)) {
            triggerTwoWaySync($conn, $leadId);
        }
    } catch (Exception $e) {
        $conn->rollback();
        if ($e instanceof mysqli_sql_exception && ($e->getCode() === 1062 || strpos($e->getMessage(), 'Duplicate entry') !== false)) {
            echo json_encode(["success" => true, "status" => "pending_approval", "message" => "Dữ liệu trùng lặp (Duplicate Key) đã tồn tại trong hàng chờ duyệt AI."]);
        } else {
            echo json_encode(["success" => false, "message" => "Lỗi Database: Hệ thống đang bận, vui lòng thử lại sau."]);
        }
        releaseAdvisoryLock($conn, $lockKey, $lockReleased);
        exit();
    }
    
    $custData = ['name' => $name, 'phone' => $phone, 'email' => $email, 'source' => $source, 'type' => $type, 'note' => $note];
    $distData = [
        'status' => 'pending_approval',
        'assigned_to_id' => null,
        'round_id' => $targetRoundId,
        'message' => 'Lead đã được lưu và đưa vào hàng chờ duyệt AI.'
    ];
    respondAndNotifyAdmin($conn, $connData, $leadId, $custData, $distData, ["success" => true, "status" => "pending_approval", "message" => "Lead đã được lưu và đưa vào hàng chờ duyệt AI."], $lockKey, $lockReleased);
}

if ($aiScreenerResult && ($aiScreenerResult['status'] === 'failed' || $aiScreenerResult['status'] === 'error') && !$isSubstandardAutoApprove) {
    $conn->begin_transaction();
    try {
        if ($crmCheckResult['leadExists']) {
            $leadId = updateLead($conn, $phone, $email, null, $source, $type, $note, $connectionId, null, $name);
        } else {
            $leadId = insertLead($conn, $data, null, $phone, $email, $name, $source, $type, $note, $connectionId);
        }
        
        $updHeld = $conn->prepare("UPDATE leads SET status = 'pending_approval', target_round_id = ?, ai_screener_status = ?, ai_evaluation = ?, assigned_to = NULL WHERE id = ?");
        $updHeld->bind_param("issi", $targetRoundId, $aiScreenerResult['status'], $aiScreenerResult['reason'], $leadId);
        $updHeld->execute();
        $updHeld->close();
        
        $logMsg = $aiScreenerResult['status'] === 'error' ? "Lỗi kết nối AI: " . $aiScreenerResult['reason'] : "Tạm giữ bởi AI: " . $aiScreenerResult['reason'];
        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', $logMsg, false);
        $conn->commit();
        
        if (!empty($leadId)) {
            triggerTwoWaySync($conn, $leadId);
        }
    } catch (Exception $e) {
        $conn->rollback();
        if ($e instanceof mysqli_sql_exception && ($e->getCode() === 1062 || strpos($e->getMessage(), 'Duplicate entry') !== false)) {
            echo json_encode(["success" => true, "status" => "pending_approval", "message" => "Dữ liệu trùng lặp (Duplicate Key) đã tồn tại trong hàng chờ duyệt AI."]);
        } else {
            echo json_encode(["success" => false, "message" => "Lỗi Database: Hệ thống đang bận, vui lòng thử lại sau."]);
        }
        releaseAdvisoryLock($conn, $lockKey, $lockReleased);
        exit();
    }
    
    // Background notifications to admins (outside transaction)
    try {
        sendHeldLeadNotifications($conn, $leadId, $name, $phone, $aiScreenerResult['reason'], $roundName, $email, $source, $type, $note);
    } catch (Exception $notifyEx) {
        error_log("Error during AI screener notifications: " . $notifyEx->getMessage());
    }
    
    $custData = ['name' => $name, 'phone' => $phone, 'email' => $email, 'source' => $source, 'type' => $type, 'note' => $note];
    $distData = [
        'status' => 'pending_approval',
        'assigned_to_id' => null,
        'round_id' => $targetRoundId,
        'message' => 'Dữ liệu bị tạm giữ bởi AI Pre-screener: ' . $aiScreenerResult['reason']
    ];
    respondAndNotifyAdmin($conn, $connData, $leadId, $custData, $distData, ["success" => true, "status" => "pending_approval", "message" => "Dữ liệu bị tạm giữ bởi AI Pre-screener: " . $aiScreenerResult['reason']], $lockKey, $lockReleased);
}

// --- 3. Round-Robin Assignment & 4. Process new Lead and Log Distribution (Unified Transaction) ---
$conn->begin_transaction();
try {
    $dupSuffix = '';
    if ($crmCheckResult['isDuplicate']) {
        $oldSaleName = !empty($crmCheckResult['assignedName']) ? $crmCheckResult['assignedName'] : 'Không rõ';
        $oldSaleMonths = $crmCheckResult['monthsSinceLastInteraction'];
        $dupSuffix = " (Trùng số: Sale cũ $oldSaleName > $oldSaleMonths tháng).";
    }

    $eligibleConsultants = [];
    if ($targetRoundId) {
        if ($roundType === 'grab') {
            // Fetch active consultants of this round
            $cStmt = $conn->prepare("
                SELECT c.id, c.name, c.email, c.work_start_time, c.work_end_time, c.work_schedule
                FROM round_consultants rc 
                JOIN consultants c ON rc.consultant_id = c.id 
                WHERE rc.round_id = ? 
                  AND rc.is_active = 1 
                  AND c.status = 'active'
                  AND c.vacation_mode = 0
            ");
            $cStmt->bind_param("i", $targetRoundId);
            $cStmt->execute();
            $cRes = $cStmt->get_result();
            $activeConsultants = $cRes->fetch_all(MYSQLI_ASSOC);
            $cStmt->close();

            $currentTime = date('H:i');
            foreach ($activeConsultants as $c) {
                // Check cooldown (grab_cooldown_seconds)
                $cooldownStmt = $conn->prepare("
                    SELECT 1 FROM distribution_logs 
                    WHERE assigned_to = ? 
                      AND round_id = ? 
                      AND status = 'grabbed' 
                      AND received_at >= DATE_SUB(NOW(), INTERVAL ? SECOND) 
                    LIMIT 1
                ");
                $cooldownStmt->bind_param("iii", $c['id'], $targetRoundId, $grabCooldownSeconds);
                $cooldownStmt->execute();
                $isOnCooldown = $cooldownStmt->get_result()->num_rows > 0;
                $cooldownStmt->close();

                if ($isOnCooldown) {
                    continue;
                }

                // Check gates
                if (checkConsultantGates($conn, $c['id'], $data, true) === true) {
                    $eligibleConsultants[] = $c;
                }
            }

            if (!empty($eligibleConsultants)) {
                $status = 'pending_claim';
                $assignedConsultantId = null;
                $message = 'Lead được đưa vào hàng tranh nhận cho ' . count($eligibleConsultants) . ' tư vấn viên.';
                $message .= $dupSuffix;
            } else {
                $status = 'pending_work_hours';
                $message = 'Ngoài khung giờ làm việc / Tất cả TVV trong hàng tranh nhận đang bận/cooldown. Hệ thống tạm giữ Lead.' . $dupSuffix;
                $assignedConsultantId = null;
            }
        } else {
            $assignResult = getNextConsultantInRound($conn, $targetRoundId, $data);
            if ($assignResult) {
                $assignedConsultantId = $assignResult['id'];
                $status = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
                $message = $assignResult['is_compensation'] 
                    ? (isset($assignResult['is_starvation']) ? 'Được phân bổ bù lượt ngoài giờ/nghỉ phép (Starvation Prevention).' : 'Được phân bổ đền bù lượt lỗi.') 
                    : 'Được phân bổ tự động qua vòng xoay.';
                $message .= $dupSuffix;

                // Check working hours
                $whStmt = $conn->prepare("SELECT work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
                $whStmt->bind_param("i", $assignedConsultantId);
                $whStmt->execute();
                $whRes = $whStmt->get_result();
                if ($whRes && $whRow = $whRes->fetch_assoc()) {
                    $whStart = $whRow['work_start_time'] ?? '00:00';
                    $whEnd = $whRow['work_end_time'] ?? '23:59';
                    $workSchedule = $whRow['work_schedule'] ?? null;
                    $currentTime = date('H:i');
                    if (!isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule, $assignedConsultantId, $conn)) {
                        $status = 'pending_work_hours';
                        $message .= ' (Trì hoãn: ngoài khung giờ làm việc)';
                        $assignedConsultantId = null; // Do NOT pre-assign to any sale! Hold by system!
                    }
                }
                $whStmt->close();
            } else {
                $status = 'pending_work_hours';
                $message = 'Ngoài khung giờ làm việc / Chưa có TVV trực ca. Hệ thống tạm giữ Lead.' . $dupSuffix;
                $assignedConsultantId = null;
            }
        }
    } else {
        $status = 'unassigned';
        $message = 'Không khớp vòng phân bổ hoặc vòng không hoạt động.' . $dupSuffix;
        $assignedConsultantId = null;
    }

    if ($crmCheckResult['leadExists']) {
        // Existed but older than N months -> new assignment
        if (!empty($crmCheckResult['originalAssignedTo'])) {
            $prevName = $crmCheckResult['assignedName'] ?? 'Sale cũ';
            $prevDate = !empty($crmCheckResult['lastInteractionDate']) ? date('d/m/Y', strtotime($crmCheckResult['lastInteractionDate'])) : 'Không rõ';
            $dupMonths = $crmCheckResult['monthsSinceLastInteraction'] ?? $dupCheckMonths;
            $noteAppend = "\n[Lưu ý: Trùng số của $prevName trên $dupMonths tháng. Cập nhật lần cuối: $prevDate]";
            $note = trim($note) === '' ? trim($noteAppend, "\n") : $note . $noteAppend;
        }
        $leadId = updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note, $connectionId, null, $name);
    } else {
        $leadId = insertLead($conn, $data, $assignedConsultantId, $phone, $email, $name, $source, $type, $note, $connectionId);
    }

    if ($leadId && !empty($mappings)) {
        saveMappedExtendedFields($conn, $leadId, $data, $mappings);
    }
    
    // Save AI screening result if evaluated
    if ($aiScreenerResult) {
        $updAi = $conn->prepare("UPDATE leads SET ai_screener_status = ?, ai_evaluation = ? WHERE id = ?");
        $updAi->bind_param("ssi", $aiScreenerResult['status'], $aiScreenerResult['reason'], $leadId);
        $updAi->execute();
        $updAi->close();
    }

    if ($status === 'pending_claim' && $leadId && !empty($eligibleConsultants)) {
        // Set lead status to pending_claim in database
        $updL = $conn->prepare("UPDATE leads SET status = 'pending_claim', is_accepted = 0, assigned_to = NULL WHERE id = ?");
        $updL->bind_param("i", $leadId);
        $updL->execute();
        $updL->close();

        // Create offers
        $offerStmt = $conn->prepare("
            INSERT INTO lead_offers (lead_id, user_id, round_id, expires_at, status) 
            VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), 'pending')
        ");
        $competingNames = [];
        foreach ($eligibleConsultants as $c) {
            $competingNames[] = $c['name'] ?? 'TVV';
        }
        foreach ($eligibleConsultants as $c) {
            $offerStmt->bind_param("iiii", $leadId, $c['id'], $targetRoundId, $grabCountdownSeconds);
            $offerStmt->execute();
            sendGrabOfferNotification($conn, $leadId, $c['id'], $targetRoundId, $grabCountdownSeconds, $competingNames);
        }
        $offerStmt->close();
    }

    logDistribution($conn, $leadId, $assignedConsultantId, $targetRoundId, $status, $message, false);
    $conn->commit();
    if (!empty($leadId)) {
        triggerTwoWaySync($conn, $leadId);
    }
} catch (Exception $e) {
    $conn->rollback();
    if ($e instanceof mysqli_sql_exception && ($e->getCode() === 1062 || strpos($e->getMessage(), 'Duplicate entry') !== false)) {
        echo json_encode(["success" => true, "status" => "duplicate", "message" => "Dữ liệu trùng lặp (Duplicate Key) đã tồn tại và đã được phân bổ."]);
    } else {
        echo json_encode(["success" => false, "message" => "Lỗi Database: Hệ thống đang bận, vui lòng thử lại sau."]);
    }
    releaseAdvisoryLock($conn, $lockKey, $lockReleased);
    exit();
}

if ($status === 'unassigned' || $status === 'pending' || ($status === 'fallback' && !$isFallbackAdmin)) {
    $custData = ['name' => $name, 'phone' => $phone, 'email' => $email, 'source' => $source, 'type' => $type, 'note' => $note];
    $distData = [
        'status' => $status,
        'assigned_to_id' => null,
        'round_id' => $targetRoundId,
        'message' => $message
    ];
    respondAndNotifyAdmin($conn, $connData, $leadId, $custData, $distData, ["success" => true, "status" => $status, "message" => $message], $lockKey, $lockReleased);
}

// Send success response immediately to prevent Google Sheets Webhook timeout
$response = [
    "success" => true,
    "status" => $status === 'pending_claim' ? 'pending_claim' : 'assigned',
    "assignedTo" => $assignedConsultantId,
    "roundId" => $targetRoundId
];

if (function_exists('fastcgi_finish_request')) {
    echo json_encode($response);
    fastcgi_finish_request();
} else {
    ignore_user_abort(true);
    ob_start();
    echo json_encode($response);
    $size = ob_get_length();
    header("Content-Length: $size");
    header("Connection: close");
    ob_end_flush();
    @ob_flush();
    flush();
}

// Background Task: Notify via email (this takes 2-5s so it's done after responding to webhook)
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/zalo_bot.php';

try {
    if ($isFallbackAdmin && $fallbackAdminData) {
        try {
            sendLeadAssignedEmailToSale(
                $fallbackAdminData['email'], 
                $fallbackAdminData['name'], 
                $name, 
                $phone, 
                $note, 
                $source, 
                $fallbackCcEmails, 
                'Fallback Admin', 
                $leadId, 
                0, 
                0
            );
        } catch (Exception $mailEx) {
            error_log("Error sending webhook fallback admin email: " . $mailEx->getMessage());
        }
        if (!empty($fallbackAdminData['zalo_chat_id'])) {
            try {
                sendLeadAssignedZaloMessageToAdmin(
                    $fallbackAdminData['zalo_chat_id'], 
                    $fallbackAdminData['name'], 
                    $name, 
                    $phone, 
                    $note, 
                    $source,
                    $leadId,
                    $email,
                    $type
                );
            } catch (Exception $zaloEx) {
                error_log("Error sending webhook fallback admin Zalo: " . $zaloEx->getMessage());
            }
        }
    } else {
        $stmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $assignedConsultantId);
            $stmt->execute();
            $cRes = $stmt->get_result();
            if ($cRes->num_rows > 0 && $status !== 'pending_work_hours') {
                $c = $cRes->fetch_assoc();

                // Get contact id if exists
                $contactId = null;
                $stmtContact = $conn->prepare("SELECT id FROM contacts WHERE phone = ? AND owner_id = ? LIMIT 1");
                if ($stmtContact) {
                    $stmtContact->bind_param("si", $phone, $assignedConsultantId);
                    $stmtContact->execute();
                    $resContact = $stmtContact->get_result();
                    if ($resContact && $resContact->num_rows > 0) {
                        $contactId = (int)$resContact->fetch_assoc()['id'];
                    }
                    $stmtContact->close();
                }

                // Insert database notification for assigned consultant
                $stmtDbNotif = $conn->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, 1, ?, ?, 'lead_assignment', ?)");
                if ($stmtDbNotif) {
                    $notifTitle = "Bạn được phân bổ khách hàng mới";
                    $notifBody = "Khách hàng \"" . ($name ?: "Khách hàng") . "\" (" . $phone . ") đã được phân bổ cho bạn từ nguồn \"" . ($source ?: "Nguồn khác") . "\".";
                    $notifLink = $contactId ? "/contacts?open_contact_id=" . $contactId : "/contacts";
                    $stmtDbNotif->bind_param("isss", $assignedConsultantId, $notifTitle, $notifBody, $notifLink);
                    $stmtDbNotif->execute();
                    $stmtDbNotif->close();
                }
            }
            $stmt->close();
        }
    }
} catch (Exception $notifyEx) {
    error_log("Error during webhook new assignment notifications: " . $notifyEx->getMessage());
}

// Notify Admin if enabled
$notifyAdmin = (int) ($connData['notify_admin'] ?? 1);
if ($notifyAdmin === 1 && !empty($leadId)) {
    try {
        $custData = ['name' => $name, 'phone' => $phone, 'email' => $email, 'source' => $source, 'type' => $type, 'note' => $note];
        $distData = [
            'status' => $status,
            'assigned_to_id' => $isFallbackAdmin ? null : $assignedConsultantId,
            'assigned_to_name' => $isFallbackAdmin ? ($fallbackAdminData['name'] ?? 'Admin dự phòng') : null,
            'round_id' => $targetRoundId,
            'round_name' => $isFallbackAdmin ? 'Fallback Admin' : null,
            'message' => $message
        ];
        sendNewLeadApiNotificationToAdmins($conn, $connData, $leadId, $custData, $distData);
    } catch (Exception $e) {
        error_log("Error in sendNewLeadApiNotificationToAdmins: " . $e->getMessage());
    }
}

// Release advisory lock before closing connection
releaseAdvisoryLock($conn, $lockKey, $lockReleased);

$conn->close();



