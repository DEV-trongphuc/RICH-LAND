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
    if (function_exists('releaseAdvisoryLock')) {
        releaseAdvisoryLock($conn, $lockKey, $lockReleased);
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

// Check if request is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method Not Allowed"]);
    exit();
}

// Get raw POST data
$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid JSON payload"]);
    exit();
}

// Extract token or spreadsheet_id to verify sheet_connection
$token = $_GET['token'] ?? '';
$spreadsheet_id = $data['_meta']['spreadsheet_id'] ?? '';

$connData = null;
if (!empty($token)) {
    $stmt = $conn->prepare("SELECT id, sheet_name, require_both_contact, connection_type, is_silent, sync_saleperson, spreadsheet_id, notify_admin, webhook_token FROM sheet_connections WHERE webhook_token = ? AND is_active = 1");
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
    $stmt = $conn->prepare("SELECT id, sheet_name, require_both_contact, connection_type, is_silent, sync_saleperson, webhook_token, notify_admin FROM sheet_connections WHERE spreadsheet_id = ? AND is_active = 1 LIMIT 1");
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
$connectionId = $connData['id'];
$requirePhone = $connData['require_both_contact'];
$connectionType = $connData['connection_type'] ?? 'sheets';
$isSilent = (int) ($connData['is_silent'] ?? 0);
$syncSaleperson = (int) ($connData['sync_saleperson'] ?? 0);
$mappings = [];

if ($connectionType === 'landing_page') {
    // API Landing Page Logic: map standard fields natively, bundle everything else to note
    $phone = normalizePhone($data['phone'] ?? '');
    $email = trim($data['email'] ?? '');
    $name = trim($data['name'] ?? '');
    $source = trim($data['source'] ?? '');
    $type = trim($data['type'] ?? '');
    $note = trim($data['note'] ?? '');

    $standardKeys = ['phone', 'email', 'name', 'source', 'type', 'note', '_meta'];
    $extraNotes = [];
    foreach ($data as $key => $val) {
        if (!in_array($key, $standardKeys) && !is_array($val) && trim((string)$val) !== '') {
            $extraNotes[] = "$key: $val";
        }
    }
    if (!empty($extraNotes)) {
        $note = $note . "\n" . implode("\n", $extraNotes);
        $note = trim($note);
    }
} else {
    // Legacy Google Sheets Logic with manual mappings
$mapStmt = $conn->prepare("SELECT sheet_column, system_field, custom_label FROM field_mappings WHERE connection_id = ?");
$mapStmt->bind_param("i", $connectionId);
$mapStmt->execute();
$mappingsResult = $mapStmt->get_result();
$mappings = [];
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

// Extract mapped values from incoming data (handle multiple mapped columns by concatenating them)
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
    // For unique/specific system fields & custom fields, return the raw value directly of the first matched non-empty column
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

// normalizePhone is defined in webhook_logic.php (already required above)

    $phone = normalizePhone(extractMappedValues($mappings, 'phone', $data));
    $email = extractMappedValues($mappings, 'email', $data);
    $source = extractMappedValues($mappings, 'source', $data);
    $type = extractMappedValues($mappings, 'type', $data);
    $note = extractMappedValues($mappings, 'note', $data);
    $name = extractMappedValues($mappings, 'name', $data);
}

if (isLeadBlocked($conn, $phone, $email)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "This contact is permanently blocked in the system."]);
    exit();
}

if ($requirePhone == 1) {
    if (empty($phone)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Phone number is required"]);
        exit();
    }
} else {
    if (empty($phone) && empty($email)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Phone or email is required"]);
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

$ruleResult = evaluateRules($conn, $data, $source, $type, $connectionId, $connectionType);
$targetRoundId = null;
$inject = [];
$status = 'unassigned';
$message = 'No matching rule found.';

if (is_array($ruleResult)) {
    $targetRoundId = $ruleResult['target_round_id'];
    $inject = $ruleResult['inject'] ?? [];
    
    // Áp dụng ghi đè dữ liệu (Inject Fields)
    $standardFields = ['source', 'type', 'note', 'name', 'phone', 'email'];
    foreach ($inject as $k => $v) {
        if (in_array($k, $standardFields)) {
            if ($k === 'source') $source = $v;
            if ($k === 'type') $type = $v;
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
if ($targetRoundId) {
    $stmtQ = $conn->prepare("SELECT round_name, cc_emails FROM distribution_rounds WHERE id = ?");
    if ($stmtQ) {
        $stmtQ->bind_param("i", $targetRoundId);
        $stmtQ->execute();
        $qRound = $stmtQ->get_result();
        if ($qRound && $qRound->num_rows > 0) {
            $rData = $qRound->fetch_assoc();
            $ccEmails = $rData['cc_emails'] ?? '';
            $roundName = $rData['round_name'] ?? '';
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
        if ($crmCheckResult['leadExists']) {
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

if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < $dupCheckMonths && !empty($crmCheckResult['assignedTo'])) {
    $assignedTo = $crmCheckResult['assignedTo'];
    $conn->begin_transaction();
    try {
        // Update last interaction
        $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note, $connectionId, null, $name);
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

    if ($targetRoundId) {
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
    "status" => "assigned",
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

                try {
                    sendLeadAssignedEmailToSale($c['email'], $c['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $leadId, $assignedConsultantId, $targetRoundId);
                } catch (Exception $mailEx) {
                    error_log("Error sending webhook assigned sale email: " . $mailEx->getMessage());
                }
                try {
                    sendLeadAssignedZaloMessageToSale($assignedConsultantId, $c['name'], $name, $phone, $note, $source, $roundName, $leadId, $targetRoundId, $email, $type);
                } catch (Exception $zaloEx) {
                    error_log("Error sending webhook assigned sale Zalo: " . $zaloEx->getMessage());
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



