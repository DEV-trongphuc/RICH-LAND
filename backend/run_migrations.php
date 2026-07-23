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

$targetVersion = 189;
$currentVersion = 186;

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

$isForce = isset($_GET['force']) || (isset($_GET['run']) && $_GET['run'] === 'force') || ($isCli && in_array('--force', $argv));

if ($currentVersion >= $targetVersion && !$isForce) {
    $logMsg("Cơ sở dữ liệu đã ở phiên bản mới nhất (v{$currentVersion}). Đã bỏ qua các nhiệm vụ nâng cấp cũ.", "success");
    if (!$isCli) echo "</body></html>";
    return;
}

$logMsg("Bắt đầu tự đồng bộ cấu trúc cơ sở dữ liệu (Version $currentVersion -> $targetVersion)...", "info");

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

    // 3. Ensure check_ins table has all necessary columns (late_minutes, selfie_url, reason, check_out_time, early_minutes, check_out_status)
    $chkColLM = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'late_minutes'");
    if (!$chkColLM || $chkColLM->num_rows == 0) {
        $conn->query("ALTER TABLE check_ins ADD COLUMN late_minutes INT DEFAULT 0 COMMENT 'Số phút đi trễ' AFTER check_in_time");
        $logMsg("Đã bổ sung cột late_minutes vào bảng check_ins.", "success");
    }
    $chkColSelfie = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'selfie_url'");
    if (!$chkColSelfie || $chkColSelfie->num_rows == 0) {
        $conn->query("ALTER TABLE check_ins ADD COLUMN selfie_url TEXT NULL COMMENT 'Ảnh selfie chấm công' AFTER late_minutes");
        $logMsg("Đã bổ sung cột selfie_url vào bảng check_ins.", "success");
    }
    $chkColReason = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'reason'");
    if (!$chkColReason || $chkColReason->num_rows == 0) {
        $conn->query("ALTER TABLE check_ins ADD COLUMN reason TEXT NULL COMMENT 'Lý do đi trễ / bổ sung' AFTER status");
        $logMsg("Đã bổ sung cột reason vào bảng check_ins.", "success");
    }
    $chkColCO = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'check_out_time'");
    if (!$chkColCO || $chkColCO->num_rows == 0) {
        $conn->query("ALTER TABLE check_ins ADD COLUMN check_out_time DATETIME NULL COMMENT 'Thời gian chấm công ra ca' AFTER check_in_time");
        $conn->query("ALTER TABLE check_ins ADD COLUMN early_minutes INT DEFAULT 0 COMMENT 'Số phút về sớm' AFTER late_minutes");
        $conn->query("ALTER TABLE check_ins ADD COLUMN check_out_status VARCHAR(50) DEFAULT NULL COMMENT 'Trạng thái ra ca (on_time, early)' AFTER status");
        $logMsg("Đã bổ sung các cột chấm công ra ca (check_out_time, early_minutes, check_out_status) vào bảng check_ins.", "success");
    }

    // Ensure signature_url in users table is LONGTEXT to support Base64 images or long URLs safely
    $chkSigCol = $conn->query("SHOW COLUMNS FROM users LIKE 'signature_url'");
    if (!$chkSigCol || $chkSigCol->num_rows == 0) {
        $conn->query("ALTER TABLE users ADD COLUMN signature_url LONGTEXT NULL COMMENT 'Chữ ký mẫu cá nhân'");
        $logMsg("Đã bổ sung cột signature_url vào bảng users.", "success");
    } else {
        $conn->query("ALTER TABLE users MODIFY COLUMN signature_url LONGTEXT NULL COMMENT 'Chữ ký mẫu cá nhân'");
    }

    // 4. Ensure default system settings exist for advanced features
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('attendance_report_enabled', '0')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('attendance_report_trigger_day', '1')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('attendance_report_date_mode', 'previous_month')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('require_checkout', '0')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('golden_hours_max_leads_per_consultant', '0')");

    // 5. Ensure 2FA columns exist in users table
    $chk2FA = $conn->query("SHOW COLUMNS FROM users LIKE 'two_factor_enabled'");
    if (!$chk2FA || $chk2FA->num_rows == 0) {
        $conn->query("ALTER TABLE users ADD COLUMN two_factor_enabled TINYINT(1) DEFAULT 0 AFTER is_active");
        $conn->query("ALTER TABLE users ADD COLUMN two_factor_type VARCHAR(20) DEFAULT 'email' AFTER two_factor_enabled");
        $conn->query("ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255) NULL AFTER two_factor_type");
        $conn->query("ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT NULL AFTER two_factor_secret");
        $logMsg("Đã bổ sung các cột 2FA (two_factor_enabled, two_factor_type, two_factor_secret, two_factor_backup_codes) vào bảng users.", "success");
    }

    // 6. Ensure extended CRM columns exist in contacts and leads tables
    $extendedCols = [
        'phone2' => "VARCHAR(50) NULL COMMENT 'Số điện thoại 2 / phụ'",
        'gender' => "VARCHAR(20) NULL COMMENT 'Giới tính'",
        'dob' => "DATE NULL COMMENT 'Ngày sinh'",
        'citizen_id' => "VARCHAR(50) NULL COMMENT 'Số CCCD / CMND'",
        'district' => "VARCHAR(100) NULL COMMENT 'Quận / Huyện'",
        'company' => "VARCHAR(200) NULL COMMENT 'Công ty làm việc'",
        'tax_code' => "VARCHAR(50) NULL COMMENT 'Mã số thuế'",
        'budget' => "DECIMAL(15,2) NULL DEFAULT 0.00 COMMENT 'Ngân sách tài chính'",
        'demand_type' => "VARCHAR(100) NULL COMMENT 'Mục đích nhu cầu (Ở/Đầu tư/Cho thuê)'",
        'property_type' => "VARCHAR(100) NULL COMMENT 'Loại BĐS quan tâm'",
        'bedroom_count' => "VARCHAR(50) NULL COMMENT 'Số phòng ngủ mong muốn'",
        'preferred_location' => "VARCHAR(255) NULL COMMENT 'Khu vực / Dự án quan tâm'",
        'utm_campaign' => "VARCHAR(255) NULL COMMENT 'Tên chiến dịch Ads (UTM Campaign)'",
        'utm_medium' => "VARCHAR(255) NULL COMMENT 'Hình thức Ads (UTM Medium)'",
        'utm_content' => "VARCHAR(255) NULL COMMENT 'Mẫu QC / Adset (UTM Content)'",
        'utm_term' => "VARCHAR(255) NULL COMMENT 'Từ khóa Ads (UTM Term)'",
        'platform' => "VARCHAR(100) NULL COMMENT 'Nền tảng Data (Meta/Google/TikTok/Zalo)'",
        'form_name' => "VARCHAR(255) NULL COMMENT 'Tên Form / Landing Page'",
        'zalo_phone' => "VARCHAR(50) NULL COMMENT 'Số Zalo / Link Zalo'",
        'facebook_link' => "VARCHAR(255) NULL COMMENT 'Link Facebook cá nhân'"
    ];

    foreach (['contacts', 'leads'] as $tbl) {
        $tblCheck = $conn->query("SHOW TABLES LIKE '$tbl'");
        if ($tblCheck && $tblCheck->num_rows > 0) {
            foreach ($extendedCols as $colName => $colDef) {
                $colCheck = $conn->query("SHOW COLUMNS FROM `$tbl` LIKE '$colName'");
                if (!$colCheck || $colCheck->num_rows == 0) {
                    $conn->query("ALTER TABLE `$tbl` ADD COLUMN `$colName` $colDef");
                    $logMsg("Đã tự động bổ sung cột $colName vào bảng $tbl.", "success");
                }
            }
        }
    }

    // 7. Ensure email_otps table exists
    $conn->query("
        CREATE TABLE IF NOT EXISTS `email_otps` (
          `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
          `user_id` INT(11) NOT NULL,
          `email` VARCHAR(255) NOT NULL,
          `otp_code` VARCHAR(10) NOT NULL,
          `type` VARCHAR(50) NOT NULL DEFAULT '2fa',
          `expires_at` DATETIME NOT NULL,
          `is_used` TINYINT(1) NOT NULL DEFAULT 0,
          `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
          KEY `idx_email_otp_lookup` (`email`, `otp_code`, `type`, `is_used`),
          KEY `idx_user_otp` (`user_id`, `type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Ensure teams table has avatar_url column
    $teamTblCheck = $conn->query("SHOW TABLES LIKE 'teams'");
    if ($teamTblCheck && $teamTblCheck->num_rows > 0) {
        $colCheck = $conn->query("SHOW COLUMNS FROM `teams` LIKE 'avatar_url'");
        if (!$colCheck || $colCheck->num_rows == 0) {
            $conn->query("ALTER TABLE `teams` ADD COLUMN `avatar_url` TEXT NULL AFTER `name`");
            $logMsg("Đã tự động bổ sung cột avatar_url vào bảng teams.", "success");
        }
    }

    // Ensure ticket_comments table has parent_id column
    $ticketCommentsCheck = $conn->query("SHOW TABLES LIKE 'ticket_comments'");
    if ($ticketCommentsCheck && $ticketCommentsCheck->num_rows > 0) {
        $colCheck = $conn->query("SHOW COLUMNS FROM `ticket_comments` LIKE 'parent_id'");
        if (!$colCheck || $colCheck->num_rows == 0) {
            $conn->query("ALTER TABLE `ticket_comments` ADD COLUMN `parent_id` INT(11) NULL DEFAULT NULL AFTER `user_id`");
            $logMsg("Đã tự động bổ sung cột parent_id vào bảng ticket_comments.", "success");
        }
    }

    // 8. Ensure blocked_leads table exists
    $conn->query("
        CREATE TABLE IF NOT EXISTS `blocked_leads` (
          `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
          `tenant_id` INT(11) DEFAULT 1,
          `phone` VARCHAR(50) DEFAULT NULL,
          `email` VARCHAR(255) DEFAULT NULL,
          `reason` VARCHAR(255) DEFAULT NULL,
          `created_by` INT(11) DEFAULT NULL,
          `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          KEY `idx_blocked_phone` (`phone`),
          KEY `idx_blocked_email` (`email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $logMsg("Đã kiểm tra và đảm bảo bảng blocked_leads tồn tại.", "success");

    // 8.5. Add performance indexes for Scale 1M+ (Version 188)
    $chkIdxCF = $conn->query("SHOW INDEX FROM `cloud_files` WHERE Key_name = 'idx_tenant_contact'");
    if (!$chkIdxCF || $chkIdxCF->num_rows == 0) {
        $conn->query("ALTER TABLE `cloud_files` ADD INDEX `idx_tenant_contact` (`tenant_id`, `contact_id`)");
        $logMsg("Đã bổ sung index idx_tenant_contact vào bảng cloud_files.", "success");
    }
    
    $chkIdxDep = $conn->query("SHOW INDEX FROM `deposits` WHERE Key_name = 'idx_contact'");
    if (!$chkIdxDep || $chkIdxDep->num_rows == 0) {
        $conn->query("ALTER TABLE `deposits` ADD INDEX `idx_contact` (`contact_id`)");
        $logMsg("Đã bổ sung index idx_contact vào bảng deposits.", "success");
    }

    $chkIdxDM = $conn->query("SHOW INDEX FROM `deposit_milestones` WHERE Key_name = 'idx_deposit'");
    if (!$chkIdxDM || $chkIdxDM->num_rows == 0) {
        $conn->query("ALTER TABLE `deposit_milestones` ADD INDEX `idx_deposit` (`deposit_id`)");
        $logMsg("Đã bổ sung index idx_deposit vào bảng deposit_milestones.", "success");
    }

    $chkIdxCont = $conn->query("SHOW INDEX FROM `contacts` WHERE Key_name = 'idx_tenant_status_owner'");
    if (!$chkIdxCont || $chkIdxCont->num_rows == 0) {
        $conn->query("ALTER TABLE `contacts` ADD INDEX `idx_tenant_status_owner` (`tenant_id`, `status`, `owner_id`, `created_at`)");
        $logMsg("Đã bổ sung index idx_tenant_status_owner vào bảng contacts.", "success");
    }

    // 8.6. Add location columns for Check-in / Check-out (Version 189)
    $chkLat = $conn->query("SHOW COLUMNS FROM `check_ins` LIKE 'latitude'");
    if (!$chkLat || $chkLat->num_rows == 0) {
        $conn->query("ALTER TABLE `check_ins` ADD COLUMN `latitude` VARCHAR(50) NULL COMMENT 'Vĩ độ check-in', ADD COLUMN `longitude` VARCHAR(50) NULL COMMENT 'Kinh độ check-in'");
        $logMsg("Đã bổ sung cột latitude, longitude vào bảng check_ins.", "success");
    }
    $chkAddr = $conn->query("SHOW COLUMNS FROM `check_ins` LIKE 'location_address'");
    if (!$chkAddr || $chkAddr->num_rows == 0) {
        $conn->query("ALTER TABLE `check_ins` ADD COLUMN `location_address` VARCHAR(500) NULL COMMENT 'Địa chỉ check-in'");
        $logMsg("Đã bổ sung cột location_address vào bảng check_ins.", "success");
    }
    $chkCOLat = $conn->query("SHOW COLUMNS FROM `check_ins` LIKE 'checkout_latitude'");
    if (!$chkCOLat || $chkCOLat->num_rows == 0) {
        $conn->query("ALTER TABLE `check_ins` ADD COLUMN `checkout_latitude` VARCHAR(50) NULL COMMENT 'Vĩ độ check-out', ADD COLUMN `checkout_longitude` VARCHAR(50) NULL COMMENT 'Kinh độ check-out'");
        $logMsg("Đã bổ sung cột checkout_latitude, checkout_longitude vào bảng check_ins.", "success");
    }
    $chkCOAddr = $conn->query("SHOW COLUMNS FROM `check_ins` LIKE 'checkout_location_address'");
    if (!$chkCOAddr || $chkCOAddr->num_rows == 0) {
        $conn->query("ALTER TABLE `check_ins` ADD COLUMN `checkout_location_address` VARCHAR(500) NULL COMMENT 'Địa chỉ check-out'");
        $logMsg("Đã bổ sung cột checkout_location_address vào bảng check_ins.", "success");
    }

    // 9. Update DB version in system_settings
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '189') ON DUPLICATE KEY UPDATE setting_value = '189'");
    
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
