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

$stmt = null;
if (!empty($token)) {
    $stmt = $conn->prepare("SELECT id, require_both_contact FROM sheet_connections WHERE webhook_token = ? AND is_active = 1");
    $stmt->bind_param("s", $token);
} else if (!empty($spreadsheet_id)) {
    $stmt = $conn->prepare("SELECT id, require_both_contact FROM sheet_connections WHERE spreadsheet_id = ? AND is_active = 1 LIMIT 1");
    $stmt->bind_param("s", $spreadsheet_id);
} else {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Missing token or spreadsheet_id"]);
    exit();
}

$stmt->execute();
$connRes = $stmt->get_result();

if ($connRes->num_rows === 0) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Invalid or inactive connection"]);
    exit();
}
$connData = $connRes->fetch_assoc();
$connectionId = $connData['id'];
$requirePhone = $connData['require_both_contact'];

// Fetch field mappings
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
    // For phone, email, name: return the raw value directly to keep it clean.
    // For other fields (note, type, source): always keep the Label: Value format so it goes to a new line nicely.
    if (count($values) === 1 && in_array($systemField, ['phone', 'email', 'name'])) {
        $colName = $mappingsArray[$systemField][0]['sheet_column'];
        return $data[$colName] ?? '';
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
$lockKey = 'webhook_lead_' . md5($phone . '_' . $email);
$lockStmt = $conn->prepare("SELECT GET_LOCK(?, 10) as get_lock");
$lockStmt->bind_param("s", $lockKey);
$lockStmt->execute();
$lockRes = $lockStmt->get_result()->fetch_assoc();
if ($lockRes['get_lock'] != 1) {
    http_response_code(429);
    echo json_encode(["success" => false, "message" => "Too many concurrent requests for this lead. Please try again later."]);
    exit();
}

// Ensure lock is released even if script fails
register_shutdown_function(function() use ($conn, $lockKey) {
    if ($conn) {
        $conn->query("SELECT RELEASE_LOCK('$lockKey')");
    }
});

// --- 1. Check CRM (Duplication & 6-month rule) ---
$crmCheckResult = checkCRMInteraction($conn, $phone, $email);

if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < 6 && !empty($crmCheckResult['assignedTo'])) {
    $assignedTo = $crmCheckResult['assignedTo'];
    $conn->begin_transaction();
    try {
        // Update last interaction
        $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note);
        logDistribution($conn, $leadId, $assignedTo, null, 'duplicate', 'Duplicate < 6 months, returned to previous consultant.');
        $conn->commit();
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Lỗi Database: " . $e->getMessage()]);
        exit();
    }
    echo json_encode(["success" => true, "status" => "duplicate", "assignedTo" => $assignedTo, "message" => "Duplicate < 6 months."]);
    exit();
}

// --- 2. Evaluate Dynamic Rules to determine the Target Round ---
$targetRoundId = evaluateRules($conn, $data, $source, $type);
$assignedConsultantId = null;
$status = 'unassigned';
$message = 'No matching rule found.';

if ($targetRoundId) {
    // --- 3. Round-Robin Assignment ---
    $assignedConsultantId = getNextConsultantInRound($conn, $targetRoundId);
    if ($assignedConsultantId) {
        $status = 'assigned';
        $message = 'Assigned via round-robin.';
    } else {
        $status = 'pending';
        $message = 'No active consultants in this round.';
    }
}

// --- 4. Process new Lead and Log Distribution ---
$conn->begin_transaction();
try {
    if ($crmCheckResult['isDuplicate']) {
        // Existed but older than 6 months -> new assignment
        $leadId = updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note);
    } else {
        $leadId = insertLead($conn, $data, $assignedConsultantId, $phone, $email, $name, $source, $type, $note);
    }

    logDistribution($conn, $leadId, $assignedConsultantId, $targetRoundId, $status, $message);
    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["success" => false, "message" => "Lỗi Database: " . $e->getMessage()]);
    exit();
}

if ($status === 'unassigned' || $status === 'pending') {
    echo json_encode(["success" => true, "status" => $status, "message" => $message]);
    exit();
}

// TODO: Notify via email
require_once __DIR__ . '/mailer.php';

$ccEmails = '';
$roundName = '';
if ($targetRoundId) {
    $stmtQ = $conn->prepare("SELECT round_name, cc_emails FROM distribution_rounds WHERE id = ?");
    $stmtQ->bind_param("i", $targetRoundId);
    $stmtQ->execute();
    $qRound = $stmtQ->get_result();
    if ($qRound && $qRound->num_rows > 0) {
        $rData = $qRound->fetch_assoc();
        $ccEmails = $rData['cc_emails'] ?? '';
        $roundName = $rData['round_name'] ?? '';
    }
}

$stmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
$stmt->bind_param("i", $assignedConsultantId);
$stmt->execute();
$cRes = $stmt->get_result();
if ($cRes->num_rows > 0) {
    $c = $cRes->fetch_assoc();
    sendLeadAssignedEmailToSale($c['email'], $c['name'], $name, $phone, $note, $source, $ccEmails, $roundName, $leadId, $assignedConsultantId, $targetRoundId);
}

echo json_encode([
    "success" => true,
    "status" => "assigned",
    "assignedTo" => $assignedConsultantId,
    "roundId" => $targetRoundId
]);

$conn->close();

