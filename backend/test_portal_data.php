<?php
require_once __DIR__ . '/db_connect.php';

header('Content-Type: application/json; charset=utf-8');

$isSale = true;
$saleId = 1000;
$saleUserId = 1000;
$tid = 1; // Assuming tenant_id = 1
$dateMode = '7_days';

$contactsDateCondition = "c.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
$contactsWhere = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
$contactsParams = [$tid];
$contactsTypes = "i";

if ($isSale) {
    $contactsWhere[] = "c.owner_id = ?";
    $contactsParams[] = $saleUserId;
    $contactsTypes .= "i";
}

$contactsWhereClause = implode(" AND ", $contactsWhere) . " AND " . $contactsDateCondition;

// Test 1: Total Contacts Count
$stmtContactsCount = $conn->prepare("SELECT COUNT(*) as cnt FROM contacts c WHERE $contactsWhereClause");
$contactsCount = 0;
if ($stmtContactsCount) {
    $stmtContactsCount->bind_param($contactsTypes, ...$contactsParams);
    $stmtContactsCount->execute();
    $contactsCount = (int) ($stmtContactsCount->get_result()->fetch_assoc()['cnt'] ?? 0);
    $stmtContactsCount->close();
}

// Test 2: Databank Count
$stmtDatabank = $conn->prepare("
    SELECT COUNT(DISTINCT c.id) as cnt 
    FROM contacts c 
    WHERE $contactsWhereClause 
      AND (c.source = 'databank' OR EXISTS (
          SELECT 1 FROM leads l2 
          JOIN distribution_logs dl2 ON dl2.lead_id = l2.id 
          JOIN users u2 ON u2.id = c.owner_id
          JOIN consultants cons2 ON u2.email = cons2.email
          WHERE l2.person_id = c.person_id AND dl2.assigned_to = cons2.id AND dl2.status = 'databank_claim'
      ))
");
$databankCount = 0;
if ($stmtDatabank) {
    $stmtDatabank->bind_param($contactsTypes, ...$contactsParams);
    $stmtDatabank->execute();
    $databankCount = (int) ($stmtDatabank->get_result()->fetch_assoc()['cnt'] ?? 0);
    $stmtDatabank->close();
}

// Test 3: Distributed Count
$stmtDistributed = $conn->prepare("
    SELECT COUNT(DISTINCT c.id) as cnt 
    FROM contacts c 
    WHERE $contactsWhereClause 
      AND (c.source != 'databank' AND EXISTS (
          SELECT 1 FROM leads l2 
          JOIN distribution_logs dl2 ON dl2.lead_id = l2.id 
          JOIN users u2 ON u2.id = c.owner_id
          JOIN consultants cons2 ON u2.email = cons2.email
          WHERE l2.person_id = c.person_id AND dl2.assigned_to = cons2.id AND dl2.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours', 'fallback', 'success')
      ))
");
$distributedCount = 0;
if ($stmtDistributed) {
    $stmtDistributed->bind_param($contactsTypes, ...$contactsParams);
    $stmtDistributed->execute();
    $distributedCount = (int) ($stmtDistributed->get_result()->fetch_assoc()['cnt'] ?? 0);
    $stmtDistributed->close();
}

$selfCount = max(0, $contactsCount - $databankCount - $distributedCount);

echo json_encode([
    'contactsWhereClause' => $contactsWhereClause,
    'contactsParams' => $contactsParams,
    'contactsCount' => $contactsCount,
    'databankCount' => $databankCount,
    'distributedCount' => $distributedCount,
    'selfCount' => $selfCount
], JSON_PRETTY_PRINT);
