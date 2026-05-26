<?php
// cron_queue_worker.php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

function processSyncQueue($conn) {
    // Prevent duplicate execution using a file lock
    $lockFile = __DIR__ . '/cron_queue_worker.lock';
    $fp = @fopen($lockFile, 'c+');
    if (!$fp || !@flock($fp, LOCK_EX | LOCK_NB)) {
        return;
    }

    // 1. Fetch pending items with pessimistic locking (FOR UPDATE SKIP LOCKED) to support concurrent multi-server execution
    $conn->begin_transaction();
    $res = $conn->query("
        SELECT id, lead_id, attempts 
        FROM sync_queue 
        WHERE status = 'pending' 
          AND next_retry_at <= NOW() 
        LIMIT 20
        FOR UPDATE SKIP LOCKED
    ");

    $items = [];
    $ids = [];
    while ($row = $res->fetch_assoc()) {
        $items[] = $row;
        $ids[] = (int)$row['id'];
    }

    if (empty($items)) {
        $conn->commit();
        @flock($fp, LOCK_UN);
        @fclose($fp);
        return;
    }

    $idsStr = implode(',', $ids);
    $conn->query("UPDATE sync_queue SET status = 'processing' WHERE id IN ($idsStr)");
    $conn->commit();

    // 2. Process each sync request
    foreach ($items as $item) {
        $queueId = (int)$item['id'];
        $leadId = (int)$item['lead_id'];
        $attempts = (int)$item['attempts'];

        $errorMsg = null;
        $success = executeTwoWaySyncActual($conn, $leadId, $errorMsg);

        if ($success) {
            // Race-condition guard: Only delete if the status hasn't been reset to 'pending' by a new trigger
            $conn->query("DELETE FROM sync_queue WHERE id = $queueId AND status = 'processing'");
        } else {
            $newAttempts = $attempts + 1;
            $status = 'pending';
            $intervalMinutes = 1;

            if ($newAttempts === 1) {
                $intervalMinutes = 1;
            } elseif ($newAttempts === 2) {
                $intervalMinutes = 5;
            } elseif ($newAttempts === 3) {
                $intervalMinutes = 15;
            } else {
                $status = 'failed';
            }

            // Race-condition guard: Only update if status is still 'processing'
            $updStmt = $conn->prepare("
                UPDATE sync_queue 
                SET status = ?, 
                    attempts = ?, 
                    next_retry_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), 
                    last_error = ? 
                WHERE id = ? AND status = 'processing'
            ");
            if ($updStmt) {
                $updStmt->bind_param("siisi", $status, $newAttempts, $intervalMinutes, $errorMsg, $queueId);
                $updStmt->execute();
                $updStmt->close();
            }
        }
    }

    @flock($fp, LOCK_UN);
    @fclose($fp);
}

// Call directly if run from CLI or scheduled cron
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    processSyncQueue($conn);
}
