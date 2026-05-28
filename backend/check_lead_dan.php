<?php
// backend/check_lead_dan.php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$ids = [30210, 30212];
echo "=== TARGET LEADS SOURCE & SYNC STATUS (BY LOG ID) ===\n\n";

foreach ($ids as $id) {
    // 1. Fetch lead details via distribution_logs.id
    $stmt = $conn->prepare("
        SELECT dl.id as log_id, dl.received_at, dl.status as log_status, dl.message as log_message, dl.assigned_to as log_assigned_to,
               l.id as lead_id, l.name as lead_name, l.phone, l.email, l.source, l.connection_id, l.assigned_to, l.last_interaction_date, l.status as lead_status, l.is_accepted,
               sc.sheet_name, sc.two_way_sync, sc.google_script_url, sc.is_active as connection_active
        FROM distribution_logs dl
        JOIN leads l ON dl.lead_id = l.id
        LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
        WHERE dl.id = ?
    ");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    
    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $leadId = $row['lead_id'];
        $saleId = $row['log_assigned_to'];
        $leadName = $row['lead_name'];
        
        echo "Log ID: #{$row['log_id']}\n";
        echo "  - Lead ID: #{$leadId}\n";
        echo "  - Name: {$leadName}\n";
        echo "  - Phone: {$row['phone']}\n";
        echo "  - Source in DB: '{$row['source']}'\n";
        echo "  - Connection ID: {$row['connection_id']} (" . ($row['sheet_name'] ?? 'None') . ")\n";
        echo "  - Connection Active: " . ($row['connection_active'] ?? 'N/A') . "\n";
        echo "  - Two-Way Sync Enabled: " . ($row['two_way_sync'] ?? 'N/A') . "\n";
        echo "  - Google Script URL: " . ($row['google_script_url'] ? 'Yes (configured)' : 'No') . "\n";
        echo "  - Last Interaction Date: {$row['last_interaction_date']}\n";
        echo "  - Lead Status: '{$row['lead_status']}'\n";
        echo "  - Is Accepted (SalePortal): " . ($row['is_accepted'] ? 'Yes' : 'No') . "\n";
        echo "  - Log Status: '{$row['log_status']}' | Log Message: '{$row['log_message']}' | Assigned To Sale ID: {$saleId}\n";
        
        // Fetch Sale contact info
        $saleEmail = '';
        $saleZaloId = '';
        $saleName = '';
        if ($saleId) {
            $sStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ?");
            $sStmt->bind_param("i", $saleId);
            $sStmt->execute();
            $sRes = $sStmt->get_result();
            if ($sRes && $sRow = $sRes->fetch_assoc()) {
                $saleEmail = $sRow['email'];
                $saleZaloId = $sRow['zalo_chat_id'];
                $saleName = $sRow['name'];
                echo "  - Assigned Sale: '{$saleName}' | Email: '{$saleEmail}' | Zalo Chat ID: '" . ($saleZaloId ?: 'Chưa cấu hình') . "'\n";
            }
            $sStmt->close();
        }

        // 2. Check if this lead is in the sync queue
        $qStmt = $conn->prepare("SELECT status, attempts, next_retry_at, last_error FROM sync_queue WHERE lead_id = ?");
        $qStmt->bind_param("i", $leadId);
        $qStmt->execute();
        $qRes = $qStmt->get_result();
        if ($qRes && $qRes->num_rows > 0) {
            $qRow = $qRes->fetch_assoc();
            echo "  - Sync Queue Status: '{$qRow['status']}' | Attempts: {$qRow['attempts']} | Next Retry: {$qRow['next_retry_at']}\n";
            if ($qRow['last_error']) {
                echo "    Error: {$qRow['last_error']}\n";
            }
        } else {
            echo "  - Sync Queue Status: NOT IN QUEUE (No pending sync attempt for this lead)\n";
        }
        $qStmt->close();

        // 3. Check mail_queue for notification email to this sale about this lead
        if ($saleEmail) {
            $mailLike = '%' . $leadName . '%';
            $mStmt = $conn->prepare("SELECT id, to_email, subject, status, attempts, last_error, created_at, sent_at FROM mail_queue WHERE to_email = ? AND (subject LIKE ? OR body_html LIKE ?) ORDER BY id DESC LIMIT 5");
            $mStmt->bind_param("sss", $saleEmail, $mailLike, $mailLike);
            $mStmt->execute();
            $mRes = $mStmt->get_result();
            echo "  - Mail Notification Queue:\n";
            if ($mRes && $mRes->num_rows > 0) {
                while ($mRow = $mRes->fetch_assoc()) {
                    echo "    * Mail ID #{$mRow['id']} | Created: {$mRow['created_at']} | Status: '{$mRow['status']}' | Attempts: {$mRow['attempts']} | Sent At: " . ($mRow['sent_at'] ?: 'N/A') . "\n";
                    if ($mRow['last_error']) {
                        echo "      Error: {$mRow['last_error']}\n";
                    }
                }
            } else {
                echo "    * No email found in mail_queue for this lead name.\n";
            }
            $mStmt->close();
        }

        // 4. Check zalo_queue for notification message to this sale about this lead
        $zaloLike = '%' . $leadName . '%';
        if ($saleZaloId) {
            $zStmt = $conn->prepare("SELECT id, chat_id, status, attempts, last_error, created_at, sent_at FROM zalo_queue WHERE chat_id = ? AND body_text LIKE ? ORDER BY id DESC LIMIT 5");
            $zStmt->bind_param("ss", $saleZaloId, $zaloLike);
        } else {
            $zStmt = $conn->prepare("SELECT id, chat_id, status, attempts, last_error, created_at, sent_at FROM zalo_queue WHERE body_text LIKE ? ORDER BY id DESC LIMIT 5");
            $zStmt->bind_param("s", $zaloLike);
        }
        $zStmt->execute();
        $zRes = $zStmt->get_result();
        echo "  - Zalo Notification Queue:\n";
        if ($zRes && $zRes->num_rows > 0) {
            while ($zRow = $zRes->fetch_assoc()) {
                echo "    * Zalo Msg ID #{$zRow['id']} | Chat ID: {$zRow['chat_id']} | Created: {$zRow['created_at']} | Status: '{$zRow['status']}' | Attempts: {$zRow['attempts']} | Sent At: " . ($zRow['sent_at'] ?: 'N/A') . "\n";
                if ($zRow['last_error']) {
                    echo "      Error: {$zRow['last_error']}\n";
                }
            }
        } else {
            echo "    * No Zalo message found in zalo_queue for this lead name.\n";
        }
        $zStmt->close();
        
    } else {
        echo "Log ID: #$id | NOT FOUND IN DATABASE (No distribution log matched this ID)\n";
    }
    echo "----------------------------------------\n";
    $stmt->close();
}

// Global queries (using the already open $conn connection)
echo "\n========================================\n";
echo "=== SYSTEM SETTINGS STATUS ===\n";
$zToken = get_system_setting($conn, 'zalo_bot_token');
$fUrl = get_system_setting($conn, 'frontend_url');
echo "  - zalo_bot_token configured: " . ($zToken ? "Yes (Length: " . strlen($zToken) . ")" : "No") . "\n";
echo "  - frontend_url: " . ($fUrl ?: "Not configured") . "\n";

echo "\n========================================\n";
echo "=== RECENT 15 ITEMS IN MAIL QUEUE ===\n";
$mRes = $conn->query("SELECT id, to_email, subject, status, attempts, created_at, sent_at, last_error FROM mail_queue ORDER BY id DESC LIMIT 15");
if ($mRes && $mRes->num_rows > 0) {
    while ($mRow = $mRes->fetch_assoc()) {
        echo "  * Mail ID #{$mRow['id']} | To: {$mRow['to_email']} | Subject: {$mRow['subject']} | Status: '{$mRow['status']}' | Attempts: {$mRow['attempts']} | Created: {$mRow['created_at']} | Sent: " . ($mRow['sent_at'] ?: 'N/A') . "\n";
        if ($mRow['last_error']) {
            echo "    Error: {$mRow['last_error']}\n";
        }
    }
} else {
    echo "  * Mail queue is empty.\n";
}

echo "\n========================================\n";
echo "=== RECENT 15 ITEMS IN ZALO QUEUE ===\n";
$zRes = $conn->query("SELECT id, chat_id, status, attempts, created_at, sent_at, last_error, SUBSTRING(body_text, 1, 60) as body_preview FROM zalo_queue ORDER BY id DESC LIMIT 15");
if ($zRes && $zRes->num_rows > 0) {
    while ($zRow = $zRes->fetch_assoc()) {
        echo "  * Zalo Msg ID #{$zRow['id']} | Chat ID: {$zRow['chat_id']} | Status: '{$zRow['status']}' | Attempts: {$zRow['attempts']} | Created: {$zRow['created_at']} | Preview: '{$zRow['body_preview']}'\n";
        if ($zRow['last_error']) {
            echo "    Error: {$zRow['last_error']}\n";
        }
    }
} else {
    echo "  * Zalo queue is empty.\n";
}

$conn->close();
?>
