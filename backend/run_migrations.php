<?php
// backend/run_migrations.php

// Safe check: Allow CLI, inclusion by diagnostic script, or token validation
$isCli = (php_sapi_name() === 'cli');
$hasValidToken = (($_GET['token'] ?? '') === 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7') || defined('DIAG_TOKEN');
if (!$isCli && !$hasValidToken) {
    http_response_code(403);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['success' => false, 'message' => 'Forbidden: Direct access to database migrations is not allowed']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

$apply = (isset($_GET['apply']) && $_GET['apply'] === 'true')
      || (isset($_GET['run']) && $_GET['run'] === '1')
      || (isset($_POST['execute_migration']) && $_POST['execute_migration'] === '1')
      || ($isCli && in_array('--apply', $argv));

$targetVersion = 185;
$currentVersion = 185;

// Query current DB version
$checkSettings = $conn->query("SHOW TABLES LIKE 'system_settings'");
if ($checkSettings && $checkSettings->num_rows > 0) {
    $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
    if ($vStmt && $vStmt->num_rows > 0) {
        $currentVersion = (int)$vStmt->fetch_assoc()['setting_value'];
    }
}

if (!$isCli) {
    header("Content-Type: text/html; charset=utf-8");
    echo "<html><head><title>Hệ thống Cập nhật Cơ sở dữ liệu</title>";
    echo "<style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto; color: #334155; background-color: #f8fafc; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; display: flex; align-items: center; gap: 10px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .badge { display: inline-block; padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; }
        .badge-success { background: #dcfce7; color: #15803d; }
        .step-log { font-family: monospace; font-size: 0.8125rem; background: #0f172a; color: #38bdf8; padding: 1rem; border-radius: 8px; overflow-x: auto; max-height: 400px; }
        .step-log .success { color: #4ade80; }
        .step-log .error { color: #f87171; font-weight: bold; }
    </style></head><body>";
    echo "<h1>⚙️ Hệ thống Cập nhật Cơ sở dữ liệu</h1>";
} else {
    echo "=== HỆ THỐNG CẬP NHẬT CƠ SỞ DỮ LIỆU ===\n";
    echo "Phiên bản hiện tại: " . $currentVersion . "\n";
    echo "Phiên bản mục tiêu: " . $targetVersion . "\n\n";
}

$logMsg = function($msg, $type = 'info') use ($isCli) {
    if ($isCli) {
        if ($type === 'success') echo "[SUCCESS] " . $msg . "\n";
        else if ($type === 'error') echo "[ERROR] " . $msg . "\n";
        else echo "[INFO] " . $msg . "\n";
    } else {
        $class = $type === 'success' ? 'class="success"' : ($type === 'error' ? 'class="error"' : '');
        echo "<div {$class}>" . htmlspecialchars($msg) . "</div>";
        @ob_flush();
        flush();
    }
};

// Advisory Lock
$lockStmt = $conn->prepare("SELECT GET_LOCK('db_migration_lock', 30) as get_lock");
if ($lockStmt) {
    $lockStmt->execute();
    $lockRes = $lockStmt->get_result()->fetch_assoc();
    $lockStmt->close();
}

$logMsg("Bắt đầu tự đồng bộ cấu trúc cơ sở dữ liệu (Self-healing check)...", "info");

try {
    // 1. Synchronize Views (accounts & consultants) with complete columns
    $conn->query("
        CREATE OR REPLACE VIEW `accounts` AS 
        SELECT 
          `id`, 
          `username`, 
          `password_hash`,
          `password_hash` AS `password`, 
          `full_name` AS `name`,
          `job_title`,
          `email`, 
          `role`, 
          `is_confirmed`, 
          `confirm_token`, 
          `last_login_at` AS `last_login`, 
          `avatar_url` AS `avatar`,
          `signature_url`,
          `zalo_chat_id`,
          `telegram_chat_id`,
          `created_at`,
          `dob`,
          `gender`,
          `citizen_id`,
          `address`,
          `bank_name`,
          `bank_account`,
          `phone`,
          `is_active`,
          `team_id`
        FROM `users`
    ");

    $conn->query("
        CREATE OR REPLACE VIEW `consultants` AS 
        SELECT 
          `id`, 
          `full_name` AS `name`, 
          `job_title`,
          `email`, 
          `role`, 
          `status`, 
          `leave_start`, 
          `leave_end`, 
          `work_start_time`, 
          `work_end_time`, 
          `work_schedule`, 
          `avatar_url` AS `avatar`, 
          `signature_url`,
          `zalo_chat_id`,
          `telegram_chat_id`,
          `vacation_mode`, 
          `overtime_mode`,
          `team_id`,
          `dob`,
          `gender`,
          `citizen_id`,
          `address`,
          `bank_name`,
          `bank_account`,
          `extra_fields_json`,
          `use_custom_work_hours`,
          `created_at`
        FROM `users`
    ");
    $logMsg("Đã đồng bộ VIEW accounts & consultants chuẩn hoá cấu trúc mới nhất.", "success");

    // 2. Ensure task_muted_notifications table exists
    $conn->query("
        CREATE TABLE IF NOT EXISTS `task_muted_notifications` (
          `task_id` INT(11) NOT NULL,
          `user_id` INT(11) NOT NULL,
          `muted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`task_id`, `user_id`),
          KEY `idx_task_muted_user` (`user_id`, `task_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 3. Update DB version in system_settings
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '185') ON DUPLICATE KEY UPDATE setting_value = '185'");
    
    $logMsg("Hệ thống đã duy trì cấu trúc Cơ sở dữ liệu ở phiên bản mới nhất: " . $targetVersion, "success");

} catch (Throwable $e) {
    $logMsg("Lỗi trong quá trình đồng bộ: " . $e->getMessage(), "error");
} finally {
    $relStmt = $conn->prepare("SELECT RELEASE_LOCK('db_migration_lock')");
    if ($relStmt) {
        $relStmt->execute();
        $relStmt->close();
    }
    $logMsg("Đã giải phóng khóa Advisory Lock.", "info");
}

if (!$isCli) {
    echo "</body></html>";
} else {
    echo "Hoàn tất kiểm tra cơ sở dữ liệu.\n";
}
