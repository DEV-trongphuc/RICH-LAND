<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Content-Type: text/plain; charset=utf-8");

try {
    require_once __DIR__ . '/db_connect.php';
    echo "=== RUNNING DATA MIGRATION ===\n";

// 1. Blacklist migration for Nhi (Skipped as requested)

// 2. Active Compensation migration for Đan
$danRes = $conn->query("SELECT id, name FROM consultants WHERE name LIKE '%Đan%' LIMIT 1");
$danId = 0;
$danName = '';
if ($danRes && $row = $danRes->fetch_assoc()) {
    $danId = $row['id'];
    $danName = $row['name'];
}

if ($danId > 0) {
    // 1. Insert/Verify active compensation log by Mai Nữ (ID 5)
    $checkMaiNu = $conn->query("SELECT id FROM active_compensation_logs WHERE consultant_id = $danId AND admin_id = 5 AND DATE(created_at) = '2026-05-23'");
    if ($checkMaiNu && $checkMaiNu->num_rows > 0) {
        echo "Active compensation log for Đan by Mai Nữ (ID 5) already exists.\n";
    } else {
        $roundId = 1; // Vòng form
        $stmt = $conn->prepare("INSERT INTO active_compensation_logs (round_id, consultant_id, admin_id, amount, reason, created_at) VALUES (?, ?, 5, 1, 'Bù chủ động (vòng form)', '2026-05-23 18:00:00')");
        $stmt->bind_param("ii", $roundId, $danId);
        $stmt->execute();
        $stmt->close();
        echo "Successfully inserted active compensation log for Đan by admin ID 5 (Mai Nữ) under round ID $roundId.\n";
    }
    
    // 2. Insert/Verify active compensation log by Turnio DEV (ID 3)
    $checkCorrect = $conn->query("SELECT id FROM active_compensation_logs WHERE consultant_id = $danId AND admin_id = 3 AND DATE(created_at) = '2026-05-21'");
    if ($checkCorrect && $checkCorrect->num_rows > 0) {
        echo "Correct active compensation log for Đan by Turnio DEV (ID 3) already exists.\n";
    } else {
        $roundId = 3; // Vòng hỗ trợ: Organic Search
        $stmt = $conn->prepare("INSERT INTO active_compensation_logs (round_id, consultant_id, admin_id, amount, reason, created_at) VALUES (?, ?, 3, 1, 'Bù chủ động (vòng hỗ trợ)', '2026-05-21 23:16:11')");
        $stmt->bind_param("ii", $roundId, $danId);
        $stmt->execute();
        $stmt->close();
        echo "Successfully inserted correct active compensation log for Đan (ID: $danId, Name: $danName) by admin ID 3 under round ID $roundId.\n";
    }
} else {
    echo "Error: Consultant with name containing 'Đan' not found.\n";
}

// 3. Migrate resolved_by for specific data_reports
$admin3Res = $conn->query("SELECT name FROM accounts WHERE id = 3 LIMIT 1");
$admin3Name = ($admin3Res && $row = $admin3Res->fetch_assoc()) ? $row['name'] : 'Turnio DEV';

$admin5Res = $conn->query("SELECT name FROM accounts WHERE id = 5 LIMIT 1");
$admin5Name = ($admin5Res && $row = $admin5Res->fetch_assoc()) ? $row['name'] : 'Mai Nữ';

// 2 rejected tickets (Từ chối) currently resolved by "Hệ thống" -> turn to admin 3
$rejectedPhones = ['0939312685', '0912457911'];
foreach ($rejectedPhones as $phone) {
    $conn->query("
        UPDATE data_reports dr
        JOIN leads l ON dr.lead_id = l.id
        SET dr.resolved_by = '$admin3Name'
        WHERE l.phone = '$phone' AND dr.status = 'rejected'
    ");
    echo "Successfully updated rejected data report for lead $phone to be resolved by $admin3Name (Admin ID 3).\n";
}

// 2 approved tickets (Đã duyệt) currently resolved by "Hệ thống" -> turn to admin 5
$approvedPhones = ['0824866886', '0586044779'];
foreach ($approvedPhones as $phone) {
    $conn->query("
        UPDATE data_reports dr
        JOIN leads l ON dr.lead_id = l.id
        SET dr.resolved_by = '$admin5Name'
        WHERE l.phone = '$phone' AND dr.status = 'approved'
    ");
    echo "Successfully updated approved data report for lead $phone to be resolved by $admin5Name (Admin ID 5).\n";
}

} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "FILE: " . $e->getFile() . "\n";
    echo "LINE: " . $e->getLine() . "\n";
    echo "TRACE:\n" . $e->getTraceAsString() . "\n";
}
echo "=== MIGRATION COMPLETED ===\n";
?>
