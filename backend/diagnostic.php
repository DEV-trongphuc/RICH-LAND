<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

// Check connection
$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "=== DIAGNOSING USERS TABLE STRUCTURE ===\n";
$res = $conn->query("DESCRIBE users");
if (!$res) {
    echo "Error describing users: " . $conn->error . "\n";
} else {
    while ($row = $res->fetch_assoc()) {
        echo "Field: {$row['Field']} | Type: {$row['Type']} | Null: {$row['Null']} | Default: " . ($row['Default'] ?? 'NULL') . "\n";
    }
}

echo "\n=== DIAGNOSING CONSULTANTS VIEW/TABLE STRUCTURE ===\n";
$res = $conn->query("DESCRIBE consultants");
if (!$res) {
    echo "Error describing consultants: " . $conn->error . "\n";
} else {
    while ($row = $res->fetch_assoc()) {
        echo "Field: {$row['Field']} | Type: {$row['Type']} | Null: {$row['Null']} | Default: " . ($row['Default'] ?? 'NULL') . "\n";
    }
}

echo "\n=== PREPARE TEST ON USERS UPDATE ===\n";
$sql = "UPDATE users SET full_name=?, work_start_time=?, work_end_time=?, work_schedule=?, avatar_url=?, dob=?, gender=?, citizen_id=?, address=?, bank_name=?, bank_account=?, leave_start=?, leave_end=?, zalo_chat_id=?, overtime_mode=? WHERE id=?";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo "FAILED to prepare users UPDATE: " . $conn->error . "\n";
} else {
    echo "SUCCESS to prepare users UPDATE\n";
    $stmt->close();
}

echo "\n=== PREPARE TEST ON CONSULTANTS UPDATE ===\n";
$sqlC = "UPDATE consultants SET name=?, work_start_time=?, work_end_time=?, work_schedule=?, avatar=?, dob=?, gender=?, citizen_id=?, address=?, bank_name=?, bank_account=?, leave_start=?, leave_end=?, zalo_chat_id=?, overtime_mode=? WHERE id=?";
$stmtC = $conn->prepare($sqlC);
if (!$stmtC) {
    echo "FAILED to prepare consultants UPDATE: " . $conn->error . "\n";
} else {
    echo "SUCCESS to prepare consultants UPDATE\n";
    $stmtC->close();
}
