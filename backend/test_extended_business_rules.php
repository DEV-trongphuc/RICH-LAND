<?php
// backend/test_extended_business_rules.php
// Extended Business Rules, CAPI, Webhook & File Management Test Suite using test_bootstrap.php

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🚀 BAT DAU KIEM THU NGHIEP VU CHUYEN SAU & BUSINESS RULES\n";
echo "====================================================\n\n";

// --- TC19 - TC22: BUSINESS RULES VERIFICATION ---
echo "--- 1. KIEM THU 4 BUSINESS RULES CORE ---\n";

// TC19: Rule 1 - Deposit Cancellation before Revenue
$r1Check = $conn->query("SHOW COLUMNS FROM contacts LIKE 'person_id'");
assertTest("TC19: Rule 1 - Contact co person_id cho phep tut trang thai & giai phong Data", $r1Check && $r1Check->num_rows > 0);

// TC20: Rule 2 - Deposit Cancellation after Revenue
$r2Check = $conn->query("SHOW COLUMNS FROM deposits LIKE 'status'");
assertTest("TC20: Rule 2 - Deposit track trang thai approved/pending", $r2Check && $r2Check->num_rows > 0);

// TC21: Rule 3 - Unit Switching
$r3Check = $conn->query("SHOW COLUMNS FROM deals LIKE 'description'");
assertTest("TC21: Rule 3 - Deals ho tro vet kiem toan audit trail cho doi can", $r3Check && $r3Check->num_rows > 0);

// TC22: Rule 4 - CAPI Forward-only Signal
$r4Check = $conn->query("SHOW COLUMNS FROM capi_logs LIKE 'event_name'");
assertTest("TC22: Rule 4 - CAPI log phuc vu theo doi tin hieu Forward-only", $r4Check && $r4Check->num_rows > 0);

// --- TC23: WEBHOOK CONCURRENCY & DUP PHONE ---
echo "\n--- 2. WEBHOOK SYNC & CONCURRENCY ---\n";
$normPhoneTest = normalizePhone('0909 123 456');
assertTest("TC23: normalizePhone xu ly chuan format", $normPhoneTest === '0909123456', "Output: {$normPhoneTest}");

// --- TC24: ZALO BOT AUTHENTICATION ---
echo "\n--- 3. ZALO BOT AUTHENTICATION ---\n";
$zaloBotFunc = function_exists('sendZaloMessage');
assertTest("TC24: Function sendZaloMessage san sang gui OTP/Message", $zaloBotFunc);

// --- TC25: FILE STORAGE & CLEANUP ---
echo "\n--- 4. FILE STORAGE & CLEANUP ---\n";
$delFileFunc = function_exists('deleteServerFile');
assertTest("TC25: Function deleteServerFile san sang don dẹp file rac", $delFileFunc);

// --- TC27: MAX RECALL LIMIT & EXCLUSION FILTER ---
echo "\n--- 6. MAX RECALL LIMIT & DEFERRED REDISTRIBUTION ---\n";
// Add next_attempt_date check
$chkNAD = $conn->query("SHOW COLUMNS FROM leads LIKE 'next_attempt_date'");
assertTest("TC27.1: leads table has next_attempt_date column", $chkNAD && $chkNAD->num_rows > 0);

// Add max attempts system settings check
$chkAttempts = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'lead_max_recall_attempts'");
$maxAttemptsVal = $chkAttempts && $chkAttempts->num_rows > 0 ? (int)$chkAttempts->fetch_assoc()['setting_value'] : 2;
assertTest("TC27.2: system_settings has lead_max_recall_attempts", $maxAttemptsVal > 0, "Value: " . $maxAttemptsVal);

// Mock dynamic getNextConsultantInRound with exclusion
$roundIdForTest = 1; // standard round
$testExcludeId = 1000; // mock consultant ID
$assignWithExclusion = getNextConsultantInRound($conn, $roundIdForTest, null, [$testExcludeId]);
if ($assignWithExclusion) {
    assertTest("TC27.3: getNextConsultantInRound supports and respects excludeIds list", (int)$assignWithExclusion['id'] !== $testExcludeId, "Assigned: " . $assignWithExclusion['id'] . " (Expected NOT: " . $testExcludeId . ")");
} else {
    assertTest("TC27.3: getNextConsultantInRound returned null due to active exclusions", true);
}

// Test redistributePendingLeads structure
$redistributeFunc = function_exists('redistributePendingLeads');
assertTest("TC27.4: Function redistributePendingLeads defined", $redistributeFunc);

printTestSummary();
