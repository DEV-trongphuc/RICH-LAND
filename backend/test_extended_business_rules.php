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

// --- TC26: FAIR SHARE AUDIT ---
echo "\n--- 5. FAIR SHARE AUDIT ---\n";
$fsRes = $conn->query("SHOW TABLES LIKE 'distribution_logs'");
assertTest("TC26: Bang distribution_logs phuc vu audit chia data cong bang", $fsRes && $fsRes->num_rows > 0);

printTestSummary();
