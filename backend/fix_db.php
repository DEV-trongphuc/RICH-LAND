<?php
// backend/fix_db.php
// Script to restore missing distribution logs for orphaned leads

require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=utf-8");

$code = $_GET['code'] ?? '';
if ($code !== 'restore2026') {
    http_response_code(403);
    die("Forbidden: Invalid passcode.");
}

echo "=== DATABASE RECOVERY FOR ORPHANED LEADS ===\n\n";

// 1. Query all leads that do not have a record in distribution_logs
$queryLeads = "
    SELECT l.id, l.phone, l.name, l.assigned_to, l.connection_id, l.created_at, sc.is_silent 
    FROM leads l
    LEFT JOIN distribution_logs dl ON l.id = dl.lead_id
    LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
    WHERE dl.lead_id IS NULL
";

$leadsRes = $conn->query($queryLeads);
if (!$leadsRes) {
    die("Error querying database: " . $conn->error);
}

$totalOrphans = $leadsRes->num_rows;
echo "Found $totalOrphans leads without any distribution logs.\n\n";

$restoredCount = 0;

if ($totalOrphans > 0) {
    while ($lead = $leadsRes->fetch_assoc()) {
        $leadId = (int)$lead['id'];
        $phone = $lead['phone'];
        $name = $lead['name'];
        $assignedTo = !empty($lead['assigned_to']) ? (int)$lead['assigned_to'] : null;
        $connId = !empty($lead['connection_id']) ? (int)$lead['connection_id'] : null;
        $createdAt = $lead['created_at'];
        $isSilent = !empty($lead['is_silent']) ? (int)$lead['is_silent'] : 0;

        echo "Processing Lead #$leadId ($name - $phone):\n";

        // Guess round ID from other logs of the same connection
        $roundId = null;
        if ($connId > 0) {
            $rQuery = "
                SELECT dl.round_id 
                FROM distribution_logs dl 
                JOIN leads l ON dl.lead_id = l.id 
                WHERE l.connection_id = $connId AND dl.round_id IS NOT NULL 
                LIMIT 1
            ";
            $rRes = $conn->query($rQuery);
            if ($rRes && $rRow = $rRes->fetch_assoc()) {
                $roundId = (int)$rRow['round_id'];
                echo "  - Identified round ID: $roundId (from other leads in connection #$connId)\n";
            }
        }

        // Determine status and message
        if ($isSilent) {
            $status = 'silent';
            $msg = 'Chỉ đồng bộ check trùng, không định tuyến.';
        } else if ($assignedTo) {
            $status = 'assigned';
            $msg = 'Đồng bộ khôi phục nhật ký (không gửi lại thông báo).';
        } else {
            $status = 'no_consultant';
            $msg = 'Không có Sale nhận.';
        }

        // Insert into distribution_logs with the same created_at time
        $stmt = $conn->prepare("
            INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message, received_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        
        if ($stmt) {
            $stmt->bind_param("iiisss", $leadId, $assignedTo, $roundId, $status, $msg, $createdAt);
            if ($stmt->execute()) {
                $restoredCount++;
                echo "  - Successfully restored log status '$status' with timestamp $createdAt.\n";
            } else {
                echo "  - Error inserting log: " . $stmt->error . "\n";
            }
            $stmt->close();
        } else {
            echo "  - Error preparing statement: " . $conn->error . "\n";
        }
    }
}

echo "\n============================================\n";
echo "RECOVERY COMPLETE:\n";
echo "- Total checked: $totalOrphans\n";
echo "- Successfully restored: $restoredCount\n";

// Self-delete the file for security
if (@unlink(__FILE__)) {
    echo "\n[INFO] This script has successfully self-deleted from the server.\n";
} else {
    echo "\n[WARNING] Failed to self-delete this script. Please delete this file manually.\n";
}

$conn->close();
?>
