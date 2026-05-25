<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Content-Type: text/plain; charset=utf-8");

try {
    require_once __DIR__ . '/db_connect.php';
    echo "=== RUNNING DATA MIGRATION ===\n";

// 1. Blacklist migration for Nhi (ID: 1003)
// We look for BLOCK_LEAD_BLACKLIST admin_logs on 2026-05-23
$nhiId = 1003;
$blacklistRes = $conn->query("SELECT id, details FROM admin_logs WHERE action = 'BLOCK_LEAD_BLACKLIST' AND details LIKE '%Nhi%'");
$updatedBlacklist = 0;
if ($blacklistRes && $blacklistRes->num_rows > 0) {
    while ($row = $blacklistRes->fetch_assoc()) {
        $logId = $row['id'];
        $details = json_decode($row['details'], true);
        if ($details) {
            $details['compensate_sale'] = true;
            $updatedDetails = json_encode($details, JSON_UNESCAPED_UNICODE);
            $stmt = $conn->prepare("UPDATE admin_logs SET details = ? WHERE id = ?");
            $stmt->bind_param("si", $updatedDetails, $logId);
            $stmt->execute();
            $stmt->close();
            $updatedBlacklist++;
            echo "Updated admin_logs ID: $logId with compensate_sale = true\n";
        }
    }
}

if ($updatedBlacklist === 0) {
    // If no log with 'Nhi' was found, look for any BLOCK_LEAD_BLACKLIST on 2026-05-23
    $blacklistRes2 = $conn->query("SELECT id, details FROM admin_logs WHERE action = 'BLOCK_LEAD_BLACKLIST' AND (created_at LIKE '2026-05-23%' OR details LIKE '%Turnio DEV%')");
    if ($blacklistRes2 && $blacklistRes2->num_rows > 0) {
        while ($row = $blacklistRes2->fetch_assoc()) {
            $logId = $row['id'];
            $details = json_decode($row['details'], true);
            if ($details) {
                $details['compensate_sale'] = true;
                // Ensure consultant ID is set to Nhi
                $details['old_consultant_id'] = $nhiId;
                $details['old_consultant_name'] = 'Lê Đinh Ý Nhi';
                $updatedDetails = json_encode($details, JSON_UNESCAPED_UNICODE);
                $stmt = $conn->prepare("UPDATE admin_logs SET details = ? WHERE id = ?");
                $stmt->bind_param("si", $updatedDetails, $logId);
                $stmt->execute();
                $stmt->close();
                $updatedBlacklist++;
                echo "Fallback updated admin_logs ID: $logId with compensate_sale = true and assigned to Nhi\n";
            }
        }
    }
}

if ($updatedBlacklist === 0) {
    // If still not found, insert a mock log so it registers in the statistics
    $dlRes = $conn->query("SELECT id, lead_id, round_id FROM distribution_logs WHERE assigned_to = $nhiId AND status = 'blacklisted' LIMIT 1");
    if ($dlRes && $dlRes->num_rows > 0) {
        $dlRow = $dlRes->fetch_assoc();
        $dlId = $dlRow['id'];
        $leadId = $dlRow['lead_id'];
        
        $leadName = 'Khách hàng';
        $leadPhone = '';
        $leadEmail = '';
        $lRes = $conn->query("SELECT name, phone, email FROM leads WHERE id = $leadId");
        if ($lRes && $lRow = $lRes->fetch_assoc()) {
            $leadName = $lRow['name'];
            $leadPhone = $lRow['phone'];
            $leadEmail = $lRow['email'];
        }

        $mockDetails = [
            'log_id' => $dlId,
            'lead_id' => $leadId,
            'lead_name' => $leadName,
            'phone' => $leadPhone,
            'email' => $leadEmail,
            'reason' => 'SPAM',
            'compensate_sale' => true,
            'old_consultant_id' => $nhiId,
            'old_consultant_name' => 'Lê Đinh Ý Nhi',
            'round_name' => 'Vòng chia'
        ];
        $detailsJson = json_encode($mockDetails, JSON_UNESCAPED_UNICODE);
        
        $adminId = 5; // Default fallback
        $adminRes = $conn->query("SELECT id FROM accounts ORDER BY id ASC LIMIT 1");
        if ($adminRes && $rowAdmin = $adminRes->fetch_assoc()) {
            $adminId = (int)$rowAdmin['id'];
        }

        $stmt = $conn->prepare("INSERT INTO admin_logs (account_id, action, details, created_at) VALUES (?, 'BLOCK_LEAD_BLACKLIST', ?, '2026-05-23 17:20:59')");
        $stmt->bind_param("is", $adminId, $detailsJson);
        $stmt->execute();
        $stmt->close();
        echo "Inserted mock BLOCK_LEAD_BLACKLIST log in admin_logs for Nhi.\n";
    } else {
        echo "Warning: No blacklisted distribution log found for Nhi to associate with.\n";
    }
}

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
