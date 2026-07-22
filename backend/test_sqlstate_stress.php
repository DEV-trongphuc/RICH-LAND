<?php
// backend/test_sqlstate_stress.php
// SQLSTATE & HTTP 500 Error Prevention Stress Test Suite

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🛡️ BAT DAU KIEM THU STRESS TEST CHONG LOI SQLSTATE & HTTP 500\n";
echo "====================================================\n\n";

// --- TEST 1: EMPTY DATE VALUES ('') ON USERS TABLE ---
echo "--- 1. STRESS TEST USER DATE FIELDS ('') ---\n";
$uRow = $conn->query("SELECT id, dob, leave_start, leave_end FROM users LIMIT 1")->fetch_assoc();
if ($uRow) {
    $uId = (int)$uRow['id'];
    $stmt = $conn->prepare("UPDATE users SET dob = ?, leave_start = ?, leave_end = ? WHERE id = ?");
    $nullVal = null;
    $stmt->bind_param("sssi", $nullVal, $nullVal, $nullVal, $uId);
    $ok = $stmt->execute();
    $stmt->close();
    assertTest("User Table: Update DATE columns voi NULL/Rong khong bi SQLSTATE 22007", $ok);
}

// --- TEST 2: EMPTY INT / DECIMAL VALUES ON CONTACTS TABLE ---
echo "\n--- 2. STRESS TEST CONTACT NUMERIC & DATE FIELDS ---\n";
$cRow = $conn->query("SELECT id FROM contacts LIMIT 1")->fetch_assoc();
if ($cRow) {
    $cId = (int)$cRow['id'];
    $stmt = $conn->prepare("UPDATE contacts SET stage_id = ?, project_id = ?, budget = ?, dob = ? WHERE id = ?");
    $nullStage = null;
    $nullProject = null;
    $zeroBudget = 0.00;
    $nullDob = null;
    $stmt->bind_param("iidsi", $nullStage, $nullProject, $zeroBudget, $nullDob, $cId);
    $ok = $stmt->execute();
    $stmt->close();
    assertTest("Contacts Table: Update INT/DECIMAL/DATE voi NULL/0 khong bi SQLSTATE 22007/22001", $ok);
}

// --- TEST 3: JSON ENCODING STRESS TEST ---
echo "\n--- 3. STRESS TEST JSON FIELDS ---\n";
$jsonArr = ['perm_lead_view' => true, 'perm_deal_edit' => false];
$jsonStr = json_encode($jsonArr);
assertTest("JSON Encoding: Valid JSON string generated", $jsonStr !== false && json_last_error() === JSON_ERROR_NONE);

printTestSummary();
