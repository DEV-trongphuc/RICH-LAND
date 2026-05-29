<?php
// e:/GIAO_DATA_GOOGLESHEETS/backend/audit_database_state.php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=UTF-8");

echo "=== SYSTEM SETTINGS ===\n";
$settingsRes = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('duplicate_check_months', 'reassign_if_owner_inactive')");
if ($settingsRes) {
    while ($row = $settingsRes->fetch_assoc()) {
        echo "{$row['setting_key']}: {$row['setting_value']}\n";
    }
}

echo "\n=== ACTIVE CONSULTANTS LEAVE LOGIC AUDIT ===\n";
$stmt = $conn->query("SELECT id, name, status, vacation_mode, leave_start, leave_end FROM consultants");
if ($stmt) {
    $today = date('Y-m-d');
    while ($row = $stmt->fetch_assoc()) {
        $status = $row['status'];
        $leaveStart = $row['leave_start'] ?? null;
        $leaveEnd = $row['leave_end'] ?? null;
        
        $isActuallyOnLeave = false;
        if ($status === 'leave') {
            $isActuallyOnLeave = true;
        } else if ($status === 'active' && !empty($leaveStart)) {
            if ($today >= $leaveStart && (empty($leaveEnd) || $today <= $leaveEnd)) {
                $isActuallyOnLeave = true;
            }
        }
        
        $isOnVacation = ($row['vacation_mode'] == 1 || (!empty($row['leave_start']) && $today >= $row['leave_start'] && (empty($row['leave_end']) || $today <= $row['leave_end'])));
        
        echo "Consultant: {$row['name']} (ID: {$row['id']})\n";
        echo "  - DB Status: {$status}\n";
        echo "  - Vacation Mode: {$row['vacation_mode']}\n";
        echo "  - Leave Start: " . ($leaveStart ?: 'NULL') . "\n";
        echo "  - Leave End: " . ($leaveEnd ?: 'NULL') . "\n";
        echo "  - Evaluated on leave (checkCRM): " . ($isActuallyOnLeave ? 'YES (BUG-RISK if status is active!)' : 'NO') . "\n";
        echo "  - Evaluated on vacation (round-robin): " . ($isOnVacation ? 'YES (BUG-RISK if status is active!)' : 'NO') . "\n";
        echo "----------------------------------------\n";
    }
}

echo "\n=== LEAD 886 HISTORY AUDIT ===\n";
$stmt2 = $conn->query("SELECT id, name, phone, email, assigned_to, created_at, status, last_interaction_date FROM leads WHERE phone = '0907474739'");
if ($stmt2) {
    while ($row = $stmt2->fetch_assoc()) {
        print_r($row);
    }
}

echo "\n=== LEAD 886 DISTRIBUTION LOGS ===\n";
$stmt3 = $conn->query("SELECT dl.id, dl.assigned_to, c.name as consultant_name, dl.round_id, dl.status, dl.message, dl.received_at FROM distribution_logs dl LEFT JOIN consultants c ON dl.assigned_to = c.id WHERE dl.lead_id = (SELECT id FROM leads WHERE phone = '0907474739' LIMIT 1) ORDER BY dl.id ASC");
if ($stmt3) {
    while ($row = $stmt3->fetch_assoc()) {
        print_r($row);
    }
}
