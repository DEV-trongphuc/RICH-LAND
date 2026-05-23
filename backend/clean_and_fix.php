<?php
// backend/clean_and_fix.php
// Script to clean up incorrect distribution logs and restore ONLY the actual leads lost during the reset

require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=utf-8");

$code = $_GET['code'] ?? '';
if ($code !== 'restore2026') {
    http_response_code(403);
    die("Forbidden: Invalid passcode.");
}

echo "=== DATABASE CLEANUP & TARGETED RECOVERY ===\n\n";

// 1. Delete all logs incorrectly created by the previous run
$cleanupQuery = "
    DELETE FROM distribution_logs 
    WHERE message IN (
        'Đồng bộ khôi phục nhật ký (không gửi lại thông báo).',
        'Chỉ đồng bộ check trùng, không định tuyến.',
        'Không có Sale nhận.'
    ) AND received_at < '2026-05-21 12:25:02'
";

if ($conn->query($cleanupQuery)) {
    $deletedCount = $conn->affected_rows;
    echo "Successfully cleaned up $deletedCount incorrect distribution logs.\n\n";
} else {
    die("Error during cleanup: " . $conn->error);
}

// 2. Query only the actual leads that were lost during the database reset (created between May 19 and May 21 12:25:02, assigned to a consultant)
$queryLeads = "
    SELECT l.id, l.phone, l.name, l.assigned_to, l.connection_id, l.created_at, sc.is_silent 
    FROM leads l
    LEFT JOIN distribution_logs dl ON l.id = dl.lead_id
    LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
    WHERE dl.lead_id IS NULL
      AND (
        (
          l.created_at BETWEEN '2026-05-19 00:00:00' AND '2026-05-21 12:25:02'
          AND l.assigned_to IS NOT NULL 
          AND l.assigned_to > 0
          AND (l.source != 'Excel Import' OR l.source IS NULL)
          AND (l.note NOT LIKE '%Nhap du lieu cu%' OR l.note IS NULL)
          AND (sc.is_silent = 0 OR sc.is_silent IS NULL)
        )
        OR l.phone IN ('0938297768', '0938187025', '0907635229')
      )
";

$leadsRes = $conn->query($queryLeads);
if (!$leadsRes) {
    die("Error querying database for actual leads: " . $conn->error);
}

$totalOrphans = $leadsRes->num_rows;
echo "Found $totalOrphans actual leads to restore.\n\n";

$restoredCount = 0;

if ($totalOrphans > 0) {
    while ($lead = $leadsRes->fetch_assoc()) {
        $leadId = (int)$lead['id'];
        $phone = $lead['phone'];
        $name = $lead['name'];
        $assignedTo = (int)$lead['assigned_to'];
        $connId = !empty($lead['connection_id']) ? (int)$lead['connection_id'] : null;
        $createdAt = $lead['created_at'];

        echo "Restoring Lead #$leadId ($name - $phone):\n";

        // Guess round ID from other logs of the same connection or consultants
        $roundId = null;
        if ($connId > 0) {
            // 1. Try to find round ID from other leads in the same connection and assigned to the same consultant
            $rQuery = "
                SELECT dl.round_id 
                FROM distribution_logs dl 
                JOIN leads l ON dl.lead_id = l.id 
                WHERE l.connection_id = $connId AND dl.assigned_to = $assignedTo AND dl.round_id IS NOT NULL 
                LIMIT 1
            ";
            $rRes = $conn->query($rQuery);
            if ($rRes && $rRow = $rRes->fetch_assoc()) {
                $roundId = (int)$rRow['round_id'];
                echo "  - Identified round ID: $roundId (from same connection & consultant)\n";
            }
            
            // 2. If not found, try to find round ID from other leads in the same connection
            if (!$roundId) {
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
                    echo "  - Identified round ID: $roundId (from other leads in connection)\n";
                }
            }
        }
        
        // 3. Fallback: Try to find round ID from round_consultants where this consultant belongs
        if (!$roundId) {
            $rQuery = "
                SELECT round_id 
                FROM round_consultants 
                WHERE consultant_id = $assignedTo 
                LIMIT 1
            ";
            $rRes = $conn->query($rQuery);
            if ($rRes && $rRow = $rRes->fetch_assoc()) {
                $roundId = (int)$rRow['round_id'];
                echo "  - Identified round ID: $roundId (fallback from consultant's rounds)\n";
            }
        }

        $status = 'assigned';
        $msg = 'Đồng bộ khôi phục nhật ký (không gửi lại thông báo).';

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
echo "CLEANUP AND RECOVERY COMPLETE:\n";
echo "- Total incorrect logs deleted: $deletedCount\n";
echo "- Total actual leads restored: $restoredCount\n";

// Self-delete the file for security
if (@unlink(__FILE__)) {
    echo "\n[INFO] This script has successfully self-deleted from the server.\n";
} else {
    echo "\n[WARNING] Failed to self-delete this script. Please delete this file manually.\n";
}

$conn->close();
?>
