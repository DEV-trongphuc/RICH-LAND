<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
require_once __DIR__ . '/env.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');

$servername = $_ENV['DB_HOST'] ?? "localhost";
$username = $_ENV['DB_USER'] ?? "vhvxoigh_mail_auto";
$password = $_ENV['DB_PASS'] ?? "Ideas@812";
$dbname = $_ENV['DB_NAME'] ?? "vhvxoigh_sale_data";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
}

$conn->set_charset("utf8mb4");
// BUG-FIX: Đảm bảo MySQL chạy cùng múi giờ với PHP để hàm NOW(), CURDATE() thống kê chính xác
$conn->query("SET time_zone = '+07:00'");

// Global helper: Cache system_settings in memory to prevent N+1 Query bottlenecks during cron/webhook loops
if (!function_exists('get_system_setting')) {
    function get_system_setting($conn, $key = null) {
        static $settings_cache = null;
        if ($settings_cache === null) {
            $settings_cache = [];
            $res = $conn->query("SELECT setting_key, setting_value FROM system_settings");
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $settings_cache[$row['setting_key']] = $row['setting_value'];
                }
            }
        }
        if ($key === null) {
            return $settings_cache;
        }
        return $settings_cache[$key] ?? '';
    }
}

if (!function_exists('pruneAdminLogs')) {
    function pruneAdminLogs($conn) {
        $conn->query("DELETE FROM admin_logs WHERE id < (
            SELECT MIN(id) FROM (
                SELECT id FROM admin_logs ORDER BY id DESC LIMIT 1000
            ) tmp
        )");
    }
}


$runMigration = true;
$checkSettings = $conn->query("SHOW TABLES LIKE 'system_settings'");
if ($checkSettings && $checkSettings->num_rows > 0) {
    $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
    if ($vStmt && $vStmt->num_rows > 0) {
        $dbVer = (int)$vStmt->fetch_assoc()['setting_value'];
        if ($dbVer >= 108) {
            $runMigration = false;
        }
    }
}

if ($runMigration) {
    // Auto-migrate: ensure custom_label column exists in field_mappings
    $checkCol = $conn->query("SHOW COLUMNS FROM field_mappings LIKE 'custom_label'");
    if ($checkCol && $checkCol->num_rows === 0) {
        $conn->query("ALTER TABLE field_mappings ADD COLUMN custom_label VARCHAR(255) NULL COMMENT 'Tên hiển thị tùy chỉnh trong Email'");
    }

    // Auto-migrate: ensure require_both_contact column exists in sheet_connections
    $checkColSC = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'require_both_contact'");
    if ($checkColSC && $checkColSC->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN require_both_contact BOOLEAN DEFAULT FALSE COMMENT 'Yêu cầu có cả SĐT và Email'");
    }

    // Auto-migrate: ensure is_silent column exists in sheet_connections
    $checkColSC = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'is_silent'");
    if ($checkColSC && $checkColSC->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN is_silent TINYINT(1) DEFAULT 0 COMMENT 'Không chia số, chỉ đồng bộ check trùng'");
    }

    // Auto-migrate: ensure email_template column exists in sheet_connections
    $checkColTpl = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'email_template'");
    if ($checkColTpl && $checkColTpl->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN email_template MEDIUMTEXT NULL COMMENT 'Mẫu nội dung email gửi Sale'");
    }


    // Auto-migrate: ensure receive_ratio column exists in round_consultants
    $checkColRR = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'receive_ratio'");
    if ($checkColRR && $checkColRR->num_rows === 0) {
        $conn->query("ALTER TABLE round_consultants ADD COLUMN receive_ratio INT DEFAULT 1");
    }

    // Auto-migrate: ensure skip_count column exists in round_consultants
    $checkColSC = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'skip_count'");
    if ($checkColSC && $checkColSC->num_rows === 0) {
        $conn->query("ALTER TABLE round_consultants ADD COLUMN skip_count INT DEFAULT 0");
    }

    // Auto-migrate: ensure sheet_sync_records table exists
    $conn->query("CREATE TABLE IF NOT EXISTS sheet_sync_records (
        connection_id INT,
        row_hash VARCHAR(64),
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (connection_id, row_hash),
        FOREIGN KEY (connection_id) REFERENCES sheet_connections(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Auto-migrate: ensure conditions_json column exists in routing_rules for multi-conditions
    $checkColRRJson = $conn->query("SHOW COLUMNS FROM routing_rules LIKE 'conditions_json'");
    if ($checkColRRJson && $checkColRRJson->num_rows === 0) {
        $conn->query("ALTER TABLE routing_rules ADD COLUMN conditions_json LONGTEXT NULL COMMENT 'Mảng điều kiện JSON'");
    }

    // Auto-migrate: ensure logical_operator column exists in routing_rules for multi-conditions
    $checkColRROp = $conn->query("SHOW COLUMNS FROM routing_rules LIKE 'logical_operator'");
    if ($checkColRROp && $checkColRROp->num_rows === 0) {
        $conn->query("ALTER TABLE routing_rules ADD COLUMN logical_operator VARCHAR(10) DEFAULT 'AND' COMMENT 'Toán tử logic giữa các điều kiện'");
    }

    // Auto-migrate: ensure compensation_count column exists in round_consultants
    $checkColComp = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'compensation_count'");
    if ($checkColComp && $checkColComp->num_rows === 0) {
        $conn->query("ALTER TABLE round_consultants ADD COLUMN compensation_count INT DEFAULT 0 COMMENT 'Số data cần đền bù'");
    }

    // Auto-migrate: create data_reports table
    $conn->query("CREATE TABLE IF NOT EXISTS data_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT,
        consultant_id INT,
        round_id INT,
        reason VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        reject_reason VARCHAR(255) NULL COMMENT 'Lý do từ chối ticket',
        approval_reason VARCHAR(255) NULL COMMENT 'Lý do duyệt ticket',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME NULL,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY (consultant_id) REFERENCES consultants(id) ON DELETE CASCADE,
        FOREIGN KEY (round_id) REFERENCES distribution_rounds(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    // Auto-migrate: Performance Indexes — only add if they don't already exist
    // BUG-15 fix: wrapped in SHOW INDEX checks to avoid ALTER TABLE on every request

    // Unique key for round_consultants
    $chkIdx1 = $conn->query("SHOW INDEX FROM round_consultants WHERE Key_name='idx_round_consultant_unique'");
    if ($chkIdx1 && $chkIdx1->num_rows === 0) {
        $conn->query("ALTER TABLE round_consultants ADD UNIQUE KEY `idx_round_consultant_unique` (`round_id`, `consultant_id`)");
    }

    // leads phone index
    $chkIdx2 = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_phone'");
    if ($chkIdx2 && $chkIdx2->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD INDEX `idx_phone` (`phone`)");
    }

    // leads email index
    $chkIdx3 = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_email'");
    if ($chkIdx3 && $chkIdx3->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD INDEX `idx_email` (`email`)");
    }

    // leads created_at index
    $chkIdxLeadTime = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_created_at'");
    if ($chkIdxLeadTime && $chkIdxLeadTime->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD INDEX `idx_created_at` (`created_at`)");
    }

    // Auto-migrate: ensure connection_id column exists in leads
    $checkColConn = $conn->query("SHOW COLUMNS FROM leads LIKE 'connection_id'");
    if ($checkColConn && $checkColConn->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN connection_id INT DEFAULT NULL");
    }

    // leads connection_id index
    $chkIdxConn = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_connection_id'");
    if ($chkIdxConn && $chkIdxConn->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD INDEX `idx_connection_id` (`connection_id`)");
    }

    // distribution_logs lead_id index
    $chkIdx4 = $conn->query("SHOW INDEX FROM distribution_logs WHERE Key_name='idx_lead_id'");
    if ($chkIdx4 && $chkIdx4->num_rows === 0) {
        $conn->query("ALTER TABLE distribution_logs ADD INDEX `idx_lead_id` (`lead_id`)");
    }

    // distribution_logs received_at index
    $chkIdxTime = $conn->query("SHOW INDEX FROM distribution_logs WHERE Key_name='idx_received_at'");
    if ($chkIdxTime && $chkIdxTime->num_rows === 0) {
        $conn->query("ALTER TABLE distribution_logs ADD INDEX `idx_received_at` (`received_at`)");
    }

    // data_reports round_id index
    $chkIdx5 = $conn->query("SHOW INDEX FROM data_reports WHERE Key_name='idx_round_id'");
    if ($chkIdx5 && $chkIdx5->num_rows === 0) {
        $conn->query("ALTER TABLE data_reports ADD INDEX `idx_round_id` (`round_id`)");
    }

    // Auto-migrate: data_per_turn — bao nhiêu data mỗi lần đến lượt
    $checkColDPT = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'data_per_turn'");
    if ($checkColDPT && $checkColDPT->num_rows === 0) {
        $conn->query("ALTER TABLE round_consultants ADD COLUMN data_per_turn INT DEFAULT 1 COMMENT 'Số Data nhận mỗi lần đến lượt'");
    }

    // Auto-migrate: current_turn_remaining — còn bao nhiêu data trong lượt hiện tại cần giao
    $checkColCTR = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'current_turn_remaining'");
    if ($checkColCTR && $checkColCTR->num_rows === 0) {
        $conn->query("ALTER TABLE round_consultants ADD COLUMN current_turn_remaining INT DEFAULT 0 COMMENT 'Data còn lại trong lượt hiện tại'");
    }

    // distribution_logs duplicate check index
    $chkIdxDupLog = $conn->query("SHOW INDEX FROM distribution_logs WHERE Key_name='idx_duplicate_check'");
    if ($chkIdxDupLog && $chkIdxDupLog->num_rows === 0) {
        $conn->query("ALTER TABLE distribution_logs ADD INDEX `idx_duplicate_check` (`lead_id`, `assigned_to`, `round_id`)");
    }

    // data_reports lookup index
    $chkIdxReportLook = $conn->query("SHOW INDEX FROM data_reports WHERE Key_name='idx_report_lookup'");
    if ($chkIdxReportLook && $chkIdxReportLook->num_rows === 0) {
        $conn->query("ALTER TABLE data_reports ADD INDEX `idx_report_lookup` (`lead_id`, `consultant_id`, `round_id`)");
    }

    // distribution_logs stats group index
    $chkIdxStatsGroup = $conn->query("SHOW INDEX FROM distribution_logs WHERE Key_name='idx_stats_group'");
    if ($chkIdxStatsGroup && $chkIdxStatsGroup->num_rows === 0) {
        $conn->query("ALTER TABLE distribution_logs ADD INDEX `idx_stats_group` (`received_at`, `status`)");
    }

    // Auto-migrate: thêm cột email vào accounts để đăng nhập bằng email
    $chkAccEmail = $conn->query("SHOW COLUMNS FROM accounts LIKE 'email'");
    if ($chkAccEmail && $chkAccEmail->num_rows === 0) {
        $conn->query("ALTER TABLE accounts ADD COLUMN email VARCHAR(255) NULL UNIQUE COMMENT 'Email đăng nhập (bắt buộc với admin thường, tùy chọn với Super Admin)'");
    }

    // Auto-migrate: ticket_notify_settings bảng cấu hình ai nhận email ticket
    $conn->query("CREATE TABLE IF NOT EXISTS ticket_notify_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE KEY unique_account (account_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Auto-migrate: thêm cột zalo_chat_id vào accounts
    $chkAccZalo = $conn->query("SHOW COLUMNS FROM accounts LIKE 'zalo_chat_id'");
    if ($chkAccZalo && $chkAccZalo->num_rows === 0) {
        $conn->query("ALTER TABLE accounts ADD COLUMN zalo_chat_id VARCHAR(255) NULL COMMENT 'Zalo Bot Chat ID'");
    }

    // Auto-migrate: thêm cột reject_reason vào data_reports
    $chkRejectReason = $conn->query("SHOW COLUMNS FROM data_reports LIKE 'reject_reason'");
    if ($chkRejectReason && $chkRejectReason->num_rows === 0) {
        $conn->query("ALTER TABLE data_reports ADD COLUMN reject_reason VARCHAR(255) NULL COMMENT 'Lý do từ chối ticket'");
    }

    // Auto-migrate: thêm cột approval_reason vào data_reports
    $chkApprovalReason = $conn->query("SHOW COLUMNS FROM data_reports LIKE 'approval_reason'");
    if ($chkApprovalReason && $chkApprovalReason->num_rows === 0) {
        $conn->query("ALTER TABLE data_reports ADD COLUMN approval_reason VARCHAR(255) NULL COMMENT 'Lý do duyệt ticket'");
    }

    // Auto-migrate: thêm cột is_confirmed và confirm_token vào accounts
    $chkAccConfirmed = $conn->query("SHOW COLUMNS FROM accounts LIKE 'is_confirmed'");
    if ($chkAccConfirmed && $chkAccConfirmed->num_rows === 0) {
        $conn->query("ALTER TABLE accounts ADD COLUMN is_confirmed TINYINT(1) DEFAULT 0 COMMENT 'Xác nhận Email'");
        $conn->query("ALTER TABLE accounts ADD COLUMN confirm_token VARCHAR(64) NULL COMMENT 'Token xác nhận Email'");
        // Đánh dấu các tài khoản cũ là đã xác nhận
        $conn->query("UPDATE accounts SET is_confirmed = 1");
    }

    // Auto-migrate: id sale migrate lên 4 chữ số
    $chkMaxId = $conn->query("SELECT MAX(id) as max_id FROM consultants");
    if ($chkMaxId) {
        $row = $chkMaxId->fetch_assoc();
        if (isset($row['max_id']) && $row['max_id'] > 0 && $row['max_id'] < 1000) {
            $conn->query("SET FOREIGN_KEY_CHECKS=0;");
            $offset = 1000;
            $conn->query("UPDATE consultants SET id = id + $offset WHERE id < 1000");
            $conn->query("UPDATE data_reports SET consultant_id = consultant_id + $offset WHERE consultant_id < 1000");
            $conn->query("UPDATE distribution_logs SET assigned_to = assigned_to + $offset WHERE assigned_to < 1000");
            $conn->query("UPDATE distribution_rounds SET last_assigned_consultant_id = last_assigned_consultant_id + $offset WHERE last_assigned_consultant_id < 1000");
            $conn->query("UPDATE leads SET assigned_to = assigned_to + $offset WHERE assigned_to < 1000");
            $conn->query("UPDATE round_consultants SET consultant_id = consultant_id + $offset WHERE consultant_id < 1000");
            $conn->query("SET FOREIGN_KEY_CHECKS=1;");
        }
    }
    $conn->query("ALTER TABLE consultants AUTO_INCREMENT = 1000;");

    // Auto-migrate: thêm cột last_login vào accounts để ghi nhận lịch sử đăng nhập
    $chkLastLogin = $conn->query("SHOW COLUMNS FROM accounts LIKE 'last_login'");
    if ($chkLastLogin && $chkLastLogin->num_rows === 0) {
        $conn->query("ALTER TABLE accounts ADD COLUMN last_login DATETIME DEFAULT NULL");
    }

    // Auto-migrate: bảng admin_logs để lưu lịch sử hoạt động admin
    $conn->query("CREATE TABLE IF NOT EXISTS admin_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        details LONGTEXT DEFAULT NULL COMMENT 'JSON details',
        ip_address VARCHAR(45) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Auto-migrate: thêm cột attempts và last_error vào mail_queue
    $chkMailAttempts = $conn->query("SHOW COLUMNS FROM mail_queue LIKE 'attempts'");
    if ($chkMailAttempts && $chkMailAttempts->num_rows === 0) {
        $conn->query("ALTER TABLE mail_queue ADD COLUMN attempts INT DEFAULT 0");
    }
    $chkMailErr = $conn->query("SHOW COLUMNS FROM mail_queue LIKE 'last_error'");
    if ($chkMailErr && $chkMailErr->num_rows === 0) {
        $conn->query("ALTER TABLE mail_queue ADD COLUMN last_error TEXT NULL");
    }

    // Auto-migrate: thêm cài đặt mặc định cho last_daily_report_timestamp nếu chưa có
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('last_daily_report_timestamp', '')");

    // Auto-migrate: thêm cột sync_saleperson vào sheet_connections
    $chkSyncSaleperson = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'sync_saleperson'");
    if ($chkSyncSaleperson && $chkSyncSaleperson->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN sync_saleperson TINYINT(1) DEFAULT 0 COMMENT 'Đồng bộ salesperson bằng email'");
    }

    // Auto-migrate: thêm cột is_initialized vào sheet_connections
    $chkIsInitialized = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'is_initialized'");
    if ($chkIsInitialized && $chkIsInitialized->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN is_initialized TINYINT(1) DEFAULT 0 COMMENT 'Đánh dấu đã đồng bộ lần đầu'");
    }

    // Auto-migrate: thêm cột sync_mode vào sheet_connections
    $chkSyncMode = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'sync_mode'");
    if ($chkSyncMode && $chkSyncMode->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN sync_mode ENUM('all', 'new_only') DEFAULT 'all' COMMENT 'Chế độ quét dữ liệu' AFTER require_both_contact");
    }

    // Auto-migrate: thêm cài đặt mặc định cho báo cáo tuần
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('zalo_weekly_report_day', '0')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('zalo_weekly_report_time', '08:00')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('last_weekly_report_date', '')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('last_weekly_report_timestamp', '')");

    // Auto-migrate: ensure work_start_time and work_end_time exist in consultants
    $chkWorkStart = $conn->query("SHOW COLUMNS FROM consultants LIKE 'work_start_time'");
    if ($chkWorkStart && $chkWorkStart->num_rows === 0) {
        $conn->query("ALTER TABLE consultants ADD COLUMN work_start_time VARCHAR(5) DEFAULT '00:00' COMMENT 'Giờ làm việc bắt đầu (HH:MM)'");
    }
    $chkWorkEnd = $conn->query("SHOW COLUMNS FROM consultants LIKE 'work_end_time'");
    if ($chkWorkEnd && $chkWorkEnd->num_rows === 0) {
        $conn->query("ALTER TABLE consultants ADD COLUMN work_end_time VARCHAR(5) DEFAULT '23:59' COMMENT 'Giờ làm việc kết thúc (HH:MM)'");
    }

    // distribution_logs covering index for dashboard optimization
    $chkIdxDashboardOpt = $conn->query("SHOW INDEX FROM distribution_logs WHERE Key_name='idx_dashboard_opt'");
    if ($chkIdxDashboardOpt && $chkIdxDashboardOpt->num_rows === 0) {
        $conn->query("ALTER TABLE distribution_logs ADD INDEX `idx_dashboard_opt` (`received_at`, `status`, `assigned_to`, `round_id`)");
    }

    // data_reports created_at index for sorting
    $chkIdxReportCreated = $conn->query("SHOW INDEX FROM data_reports WHERE Key_name='idx_created_at'");
    if ($chkIdxReportCreated && $chkIdxReportCreated->num_rows === 0) {
        $conn->query("ALTER TABLE data_reports ADD INDEX `idx_created_at` (`created_at`)");
    }

    // data_reports status index for filtering
    $chkIdxReportStatus = $conn->query("SHOW INDEX FROM data_reports WHERE Key_name='idx_status'");
    if ($chkIdxReportStatus && $chkIdxReportStatus->num_rows === 0) {
        $conn->query("ALTER TABLE data_reports ADD INDEX `idx_status` (`status`)");
    }

    // Auto-migrate: ensure work_schedule column exists in consultants
    $chkWorkSchedule = $conn->query("SHOW COLUMNS FROM consultants LIKE 'work_schedule'");
    if ($chkWorkSchedule && $chkWorkSchedule->num_rows === 0) {
        $conn->query("ALTER TABLE consultants ADD COLUMN work_schedule LONGTEXT DEFAULT NULL COMMENT 'Cấu hình lịch làm việc chi tiết dạng JSON'");
    }

    // Auto-migrate: ensure resolved_by column exists in data_reports
    $chkResolvedBy = $conn->query("SHOW COLUMNS FROM data_reports LIKE 'resolved_by'");
    if ($chkResolvedBy && $chkResolvedBy->num_rows === 0) {
        $conn->query("ALTER TABLE data_reports ADD COLUMN resolved_by VARCHAR(100) NULL COMMENT 'Tên admin duyệt ticket' AFTER resolved_at");
    }

    // Save migration version to skip next time
    $conn->query("CREATE TABLE IF NOT EXISTS system_settings (setting_key VARCHAR(100) PRIMARY KEY, setting_value MEDIUMTEXT NULL)");
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '108') ON DUPLICATE KEY UPDATE setting_value = '108'");
}

?>
