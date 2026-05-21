<?php
// webhook.php - Endpoint for Google Sheets
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'db_connect.php';

require_once 'webhook_logic.php';

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
    $stmt = $conn->prepare("SELECT id, require_both_contact, connection_type, is_silent, sync_saleperson, spreadsheet_id FROM sheet_connections WHERE webhook_token = ? AND is_active = 1");
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
    $stmt = $conn->prepare("SELECT id, require_both_contact, connection_type, is_silent, sync_saleperson, webhook_token FROM sheet_connections WHERE spreadsheet_id = ? AND is_active = 1 LIMIT 1");
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
    // For unique/specific system fields, return the raw value directly of the first matched non-empty column to keep it clean and prevent corruption.
    if (in_array($systemField, ['phone', 'email', 'name', 'assigned_to', 'saleperson'])) {
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
// BUG-CRIT-01 fix: Dùng prepared statement cho RELEASE_LOCK, tránh SQL Injection
register_shutdown_function(function() use ($conn, $lockKey, &$lockReleased) {
    if (!$lockReleased && $conn && $conn instanceof mysqli && @$conn->ping()) {
        $relStmt = $conn->prepare("SELECT RELEASE_LOCK(?)");
        if ($relStmt) {
            $relStmt->bind_param("s", $lockKey);
            $relStmt->execute();
            $relStmt->close();
        }
        $lockReleased = true;
    }
});

// --- 0. Check Global Blacklist / Exclusions ---
if (checkGlobalExclusion($conn, $data, $phone, $email)) {
    // If blacklisted, return ignored immediately without saving to DB
    echo json_encode(["success" => true, "status" => "ignored", "message" => "Data matches exclusion list."]);
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
            $admStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id = ? AND role = 'admin' LIMIT 1");
            if ($admStmt) {
                $admStmt->bind_param("i", $fbAdminId);
                $admStmt->execute();
                $admRes = $admStmt->get_result();
                if ($admRes->num_rows > 0) {
                    $fallbackAdminData = $admRes->fetch_assoc();
                    $isFallbackAdmin = true;
                    $status = 'assigned';
                    $message = 'No matching rule. Routed directly to fallback Admin: ' . $fallbackAdminData['name'];
                    $fallbackCcEmails = $fbCc;
                }
                $admStmt->close();
            }
        }
    } else {
        $fbRoundId = (int)($fbSettings['fallback_round_id'] ?? 0);
        if ($fbRoundId > 0) {
            $targetRoundId = $fbRoundId;
            $message = 'No matching rule found. Routed to fallback round.';
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
        if ($crmCheckResult['isDuplicate']) {
            $ownerId = !empty($crmCheckResult['assignedTo']) ? $crmCheckResult['assignedTo'] : $assignedToId;
            $leadId = updateLead($conn, $phone, $email, $ownerId, $source, $type, $note, $connectionId, null, $name);
        } else {
            $leadId = insertLead($conn, $data, $assignedToId, $phone, $email, $name, $source, $type, $note, $connectionId);
        }
        $actualOwnerId = ($crmCheckResult['isDuplicate'] && !empty($crmCheckResult['assignedTo'])) ? $crmCheckResult['assignedTo'] : $assignedToId;
        logDistribution($conn, $leadId, $actualOwnerId, null, 'silent', 'Chỉ đồng bộ check trùng, không định tuyến.');
        $conn->commit();
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Lỗi Database: Hệ thống đang bận, vui lòng thử lại sau."]);
        exit();
    }

    // If duplicate, check if we need to send duplicate reminder
    if ($crmCheckResult['isDuplicate'] && $syncSaleperson == 1) {
        $ownerId = $crmCheckResult['assignedTo'];
        if (!empty($ownerId) && (empty($assignedToId) || (int)$ownerId === (int)$assignedToId)) {
            $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
            $stmtC->bind_param("i", $ownerId);
            $stmtC->execute();
            $cRow = $stmtC->get_result()->fetch_assoc();
            $stmtC->close();
            if ($cRow && $cRow['status'] === 'active') {
                require_once __DIR__ . '/mailer.php';
                require_once __DIR__ . '/zalo_bot.php';
                $timeline = getLeadHistoryTimeline($conn, $leadId);
                sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $timeline);
                sendLeadReminderZaloMessageToSale($ownerId, $cRow['name'], $name, $phone, $note, $source, $roundName, $timeline);
            }
        }
    }

    echo json_encode(["success" => true, "status" => "silent", "message" => "Chỉ đồng bộ check trùng, không định tuyến."]);
    exit();
}

if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < $dupCheckMonths && !empty($crmCheckResult['assignedTo'])) {
    $assignedTo = $crmCheckResult['assignedTo'];
    $conn->begin_transaction();
    try {
        // Update last interaction
        $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note, $connectionId, null, $name);
        logDistribution($conn, $leadId, $assignedTo, null, 'reminder', 'Khách cũ đăng ký lại < ' . $dupCheckMonths . ' tháng.');
        $conn->commit();

        $stmtC = $conn->prepare("SELECT name, email, status FROM consultants WHERE id = ?");
        $stmtC->bind_param("i", $assignedTo);
        $stmtC->execute();
        $cRow = $stmtC->get_result()->fetch_assoc();
        $stmtC->close();
        if ($cRow && $cRow['status'] === 'active') {
            require_once __DIR__ . '/mailer.php';
            require_once __DIR__ . '/zalo_bot.php';
            $timeline = getLeadHistoryTimeline($conn, $leadId);
            sendLeadReminderEmailToSale($cRow['email'], $cRow['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $timeline);
            sendLeadReminderZaloMessageToSale($assignedTo, $cRow['name'], $name, $phone, $note, $source, $roundName, $timeline);
        }
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Lỗi Database: Hệ thống đang bận, vui lòng thử lại sau."]);
        exit();
    }
    echo json_encode(["success" => true, "status" => "duplicate", "assignedTo" => $assignedTo, "message" => "Duplicate < " . $dupCheckMonths . " months."]);
    exit();
}

// --- 3. Round-Robin Assignment & 4. Process new Lead and Log Distribution (Unified Transaction) ---
$conn->begin_transaction();
try {
    if ($targetRoundId) {
        $assignResult = getNextConsultantInRound($conn, $targetRoundId);
        if ($assignResult) {
            $assignedConsultantId = $assignResult['id'];
            $status = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
            $message = $assignResult['is_compensation'] ? 'Assigned via compensation.' : 'Assigned via round-robin.';

            // Check working hours
            $whStmt = $conn->prepare("SELECT work_start_time, work_end_time FROM consultants WHERE id = ?");
            $whStmt->bind_param("i", $assignedConsultantId);
            $whStmt->execute();
            $whRes = $whStmt->get_result();
            if ($whRes && $whRow = $whRes->fetch_assoc()) {
                $whStart = $whRow['work_start_time'] ?? '00:00';
                $whEnd = $whRow['work_end_time'] ?? '23:59';
                $currentTime = date('H:i');
                if (!isConsultantInWorkHours($currentTime, $whStart, $whEnd)) {
                    $status = 'pending_work_hours';
                    $message .= ' (Delayed: outside working hours ' . $whStart . '-' . $whEnd . ')';
                }
            }
            $whStmt->close();
        } else {
            $status = 'pending';
            $message = 'No active consultants in this round.';
        }
    }

    if ($crmCheckResult['isDuplicate']) {
        // Existed but older than 6 months -> new assignment
        $leadId = updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note, $connectionId, null, $name);
    } else {
        $leadId = insertLead($conn, $data, $assignedConsultantId, $phone, $email, $name, $source, $type, $note, $connectionId);
    }
    logDistribution($conn, $leadId, $assignedConsultantId, $targetRoundId, $status, $message);
    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["success" => false, "message" => "Lỗi Database: Hệ thống đang bận, vui lòng thử lại sau."]);
    exit();
}

if ($status === 'unassigned' || $status === 'pending') {
    echo json_encode(["success" => true, "status" => $status, "message" => $message]);
    exit();
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

if ($isFallbackAdmin && $fallbackAdminData) {
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
    if (!empty($fallbackAdminData['zalo_chat_id'])) {
        sendLeadAssignedZaloMessageToAdmin(
            $fallbackAdminData['zalo_chat_id'], 
            $fallbackAdminData['name'], 
            $name, 
            $phone, 
            $note, 
            $source
        );
    }
} else {
    $stmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
    $stmt->bind_param("i", $assignedConsultantId);
    $stmt->execute();
    $cRes = $stmt->get_result();
    if ($cRes->num_rows > 0 && $status !== 'pending_work_hours') {
        $c = $cRes->fetch_assoc();
        sendLeadAssignedEmailToSale($c['email'], $c['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $leadId, $assignedConsultantId, $targetRoundId);
        sendLeadAssignedZaloMessageToSale($assignedConsultantId, $c['name'], $name, $phone, $note, $source, $roundName, $leadId, $targetRoundId);
    }
    $stmt->close();
}

// Release advisory lock before closing connection
if (!$lockReleased && $conn && $conn instanceof mysqli && @$conn->ping()) {
    $relStmt = $conn->prepare("SELECT RELEASE_LOCK(?)");
    if ($relStmt) {
        $relStmt->bind_param("s", $lockKey);
        $relStmt->execute();
        $relStmt->close();
    }
    $lockReleased = true;
}

$conn->close();



