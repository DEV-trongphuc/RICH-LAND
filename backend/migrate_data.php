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
    // Clean up the previous incorrect active compensation log under admin 5
    $conn->query("DELETE FROM active_compensation_logs WHERE consultant_id = $danId AND admin_id = 5 AND DATE(created_at) = '2026-05-23'");
    
    // Insert/Verify correct active compensation log under admin 3
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

} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "FILE: " . $e->getFile() . "\n";
    echo "LINE: " . $e->getLine() . "\n";
    echo "TRACE:\n" . $e->getTraceAsString() . "\n";
}
echo "=== MIGRATION COMPLETED ===\n";
?>
