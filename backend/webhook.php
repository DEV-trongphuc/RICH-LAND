<?php
// webhook.php - Endpoint for Google Sheets
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'db_connect.php';

require_once 'webhook_logic.php';

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
    $stmt = $conn->prepare("SELECT id FROM sheet_connections WHERE webhook_token = ? AND is_active = 1");
    $stmt->bind_param("s", $token);
} else if (!empty($spreadsheet_id)) {
    $stmt = $conn->prepare("SELECT id FROM sheet_connections WHERE spreadsheet_id = ? AND is_active = 1 LIMIT 1");
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
$connectionId = $connRes->fetch_assoc()['id'];

// Fetch field mappings
$mapStmt = $conn->prepare("SELECT sheet_column, system_field FROM field_mappings WHERE connection_id = ?");
$mapStmt->bind_param("i", $connectionId);
$mapStmt->execute();
$mappingsResult = $mapStmt->get_result();
$mappings = [];
while($row = $mappingsResult->fetch_assoc()) {
    $sysField = $row['system_field'];
    if (!isset($mappings[$sysField])) {
        $mappings[$sysField] = [];
    }
    $mappings[$sysField][] = $row['sheet_column'];
}

// Extract mapped values from incoming data (handle multiple mapped columns by concatenating them)
function extractMappedValues($mappingsArray, $systemField, $data) {
    if (!isset($mappingsArray[$systemField])) return '';
    $values = [];
    foreach ($mappingsArray[$systemField] as $colName) {
        if (isset($data[$colName]) && $data[$colName] !== '') {
            $values[] = $colName . ': ' . $data[$colName];
        }
    }
    // If it's just one value, return the value directly without the column prefix to keep it clean (e.g. for phone/name)
    // If multiple (like notes), join them.
    if (count($values) === 1 && $systemField !== 'note') {
        $colName = $mappingsArray[$systemField][0];
        return $data[$colName] ?? '';
    }
    return implode("\n", $values);
}

$phone = extractMappedValues($mappings, 'phone', $data);
$email = extractMappedValues($mappings, 'email', $data);
$source = extractMappedValues($mappings, 'source', $data);
$type = extractMappedValues($mappings, 'type', $data);
$note = extractMappedValues($mappings, 'note', $data);
$name = extractMappedValues($mappings, 'name', $data);

if (empty($phone) && empty($email)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Phone or email is required"]);
    exit();
}

// --- 1. Check CRM (Duplication & 6-month rule) ---
$crmCheckResult = checkCRMInteraction($conn, $phone, $email);

if ($crmCheckResult['isDuplicate'] && $crmCheckResult['monthsSinceLastInteraction'] < 6) {
    $assignedTo = $crmCheckResult['assignedTo'];
    // Update last interaction
    $leadId = updateLead($conn, $phone, $email, $assignedTo, $source, $type, $note);
    logDistribution($conn, $leadId, $assignedTo, null, 'duplicate', 'Duplicate < 6 months, returned to previous consultant.');
    echo json_encode(["success" => true, "status" => "duplicate", "assignedTo" => $assignedTo, "message" => "Duplicate < 6 months."]);
    exit();
}

// --- 2. Evaluate Dynamic Rules to determine the Target Round ---
$targetRoundId = evaluateRules($conn, $data, $source, $type);

if (!$targetRoundId) {
    logDistribution($conn, null, null, null, 'unassigned', 'No matching rule found.');
    echo json_encode(["success" => true, "status" => "unassigned", "message" => "No matching rule found for this data."]);
    exit();
}

// --- 3. Round-Robin Assignment ---
$assignedConsultantId = getNextConsultantInRound($conn, $targetRoundId);

if (!$assignedConsultantId) {
    logDistribution($conn, null, null, $targetRoundId, 'pending', 'No active consultants in this round.');
    echo json_encode(["success" => true, "status" => "pending", "message" => "No active consultants in round $targetRoundId."]);
    exit();
}

// --- 4. Process new Lead and Log Distribution ---
if ($crmCheckResult['isDuplicate']) {
    // Existed but older than 6 months -> new assignment
    $leadId = updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note);
} else {
    $leadId = insertLead($conn, $data, $assignedConsultantId, $phone, $email, $name, $source, $type, $note);
}

logDistribution($conn, $leadId, $assignedConsultantId, $targetRoundId, 'assigned', 'Assigned via round-robin.');

// TODO: Notify via email
require_once __DIR__ . '/mailer.php';

$ccEmails = '';
if ($targetRoundId) {
    $stmtQ = $conn->prepare("SELECT cc_emails FROM distribution_rounds WHERE id = ?");
    $stmtQ->bind_param("i", $targetRoundId);
    $stmtQ->execute();
    $qRound = $stmtQ->get_result();
    if ($qRound && $qRound->num_rows > 0) {
        $ccEmails = $qRound->fetch_assoc()['cc_emails'] ?? '';
    }
}

$stmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
$stmt->bind_param("i", $assignedConsultantId);
$stmt->execute();
$cRes = $stmt->get_result();
if ($cRes->num_rows > 0) {
    $c = $cRes->fetch_assoc();
    sendLeadAssignedEmailToSale($c['email'], $c['name'], $name, $phone, $note, $source, $ccEmails);
}

echo json_encode([
    "success" => true,
    "status" => "assigned",
    "assignedTo" => $assignedConsultantId,
    "roundId" => $targetRoundId
]);

$conn->close();

