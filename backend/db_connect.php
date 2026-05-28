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

if (!function_exists('get_normalized_report_error_reasons')) {
    function get_normalized_report_error_reasons($conn) {
        $rawReasons = json_decode(get_system_setting($conn, 'report_error_reasons') ?: '[]', true) ?: [];
        $normalizedReasons = [];
        $defaultReasons = [
            [
                'reason' => 'Sai số điện thoại / Số ảo',
                'note' => 'Data có số điện thoại sai, không đúng, thiếu số, hoặc gọi thì báo không phải tên của khách hàng.'
            ],
            [
                'reason' => 'Trùng của tôi (Trùng Saleperson)',
                'note' => 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).'
            ],
            [
                'reason' => 'Trùng của người khác (Saleperson khác đã chăm)',
                'note' => 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).'
            ],
            [
                'reason' => 'Spam ảo / Junk lead',
                'note' => 'Data mà vừa giao gọi cuộc 1 đã báo hết nhu cầu rồi, không có đăng kí, cháu chắt phá, hoặc đăng kí cho vui.'
            ],
            [
                'reason' => 'Khác (Vui lòng ghi rõ ở phần ghi chú)',
                'note' => 'Là data Unqualified. Mọi data như đăng kí khác chuyên ngành như Luật/NNA, data mới cấp 3, không có tiếng anh (được ghi chú từ đầu bởi thông báo của MKT), là những data được định nghĩa Unqualified như trên Misa thì cứ báo cáo và ghi lý do ở dưới. Tạm thời c vẫn sẽ bù vòng.'
            ]
        ];

        if (empty($rawReasons)) {
            $normalizedReasons = $defaultReasons;
        } else {
            foreach ($rawReasons as $item) {
                if (is_string($item)) {
                    $matchedNote = '';
                    foreach ($defaultReasons as $d) {
                        if ($d['reason'] === $item) {
                            $matchedNote = $d['note'];
                            break;
                        }
                    }
                    $normalizedReasons[] = [
                        'reason' => $item,
                        'note' => $matchedNote
                    ];
                } else if (is_array($item)) {
                    $normalizedReasons[] = [
                        'reason' => $item['reason'] ?? '',
                        'note' => $item['note'] ?? ''
                    ];
                }
            }
        }
        return $normalizedReasons;
    }
}

if (!function_exists('getAllFallbackRoundIds')) {
    function getAllFallbackRoundIds($conn) {
        $configsJson = get_system_setting($conn, 'ai_screener_configs');
        $configs = json_decode($configsJson, true);
        $roundIds = [];
        if (is_array($configs)) {
            foreach ($configs as $config) {
                if (!empty($config['below_standard_fallback_enabled']) && !empty($config['below_standard_fallback_round_id'])) {
                    $roundIds[] = (int) $config['below_standard_fallback_round_id'];
                }
            }
        }
        // Legacy global setting compatibility
        $globalFallbackEnabled = (int) get_system_setting($conn, 'ai_screener_below_standard_fallback_enabled');
        $globalFallbackRoundId = (int) get_system_setting($conn, 'ai_screener_below_standard_fallback_round_id');
        if ($globalFallbackEnabled === 1 && $globalFallbackRoundId > 0) {
            $roundIds[] = $globalFallbackRoundId;
        }
        return array_unique($roundIds);
    }
}

if (!function_exists('pruneAdminLogs')) {
    function pruneAdminLogs($conn) {
        // [TỐI ƯU PRODUCTION] Đã tắt dọn dẹp admin_logs tự động để tránh nghẽn khi scale lớn
        /*
        $conn->query("DELETE FROM admin_logs WHERE id < (
            SELECT MIN(id) FROM (
                SELECT id FROM admin_logs ORDER BY id DESC LIMIT 1000
            ) tmp
        )");
        */
        
        // [TỐI ƯU PRODUCTION] Không tự động dọn dẹp distribution_logs để giữ số liệu báo cáo lịch sử đầy đủ
        /*
        $conn->query("DELETE FROM distribution_logs WHERE id < (
            SELECT MIN(id) FROM (
                SELECT id FROM distribution_logs ORDER BY id DESC LIMIT 1000
            ) tmp
        )");
        */
    }
}


$runMigration = true;
$checkSettings = $conn->query("SHOW TABLES LIKE 'system_settings'");
if ($checkSettings && $checkSettings->num_rows > 0) {
    $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
    if ($vStmt && $vStmt->num_rows > 0) {
        $dbVer = (int)$vStmt->fetch_assoc()['setting_value'];
        if ($dbVer >= 132) {
            $runMigration = false;
        }
    }
}

if ($runMigration) {
    // Acquire Advisory Lock to prevent concurrent DDL executions under heavy HTTP/Cron loads
    $lockStmt = $conn->prepare("SELECT GET_LOCK('db_migration_lock', 30) as get_lock");
    if ($lockStmt) {
        $lockStmt->execute();
        $lockRes = $lockStmt->get_result()->fetch_assoc();
        $lockStmt->close();
        
        if ($lockRes && (int)$lockRes['get_lock'] === 1) {
            // Double-Check: re-evaluate if migration version has been updated while waiting for lock
            $checkSettings = $conn->query("SHOW TABLES LIKE 'system_settings'");
            if ($checkSettings && $checkSettings->num_rows > 0) {
                $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
                if ($vStmt && $vStmt->num_rows > 0) {
                    $dbVer = (int)$vStmt->fetch_assoc()['setting_value'];
                    if ($dbVer >= 132) {
                        $runMigration = false;
                    }
                }
            }
        } else {
            // Failed to acquire lock in 30 seconds, disable migration run to prevent lock starvation
            $runMigration = false;
        }
    }
}

if ($runMigration) {
    // Auto-migrate: ensure last_error column exists in sheet_connections
    $checkColLE = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'last_error'");
    if ($checkColLE && $checkColLE->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN last_error VARCHAR(255) NULL COMMENT 'Chi tiết lỗi đồng bộ gần nhất'");
    }

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

    // leads phone index (drop redundant non-unique index if exists)
    $chkIdx2 = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_phone'");
    if ($chkIdx2 && $chkIdx2->num_rows > 0) {
        $conn->query("DROP INDEX `idx_phone` ON leads");
    }

    // leads last_interaction_date index
    $chkIdxLastDate = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_last_interaction_date'");
    if ($chkIdxLastDate && $chkIdxLastDate->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD INDEX `idx_last_interaction_date` (`last_interaction_date`)");
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

    // leads name index
    $chkIdxName = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_name'");
    if ($chkIdxName && $chkIdxName->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD INDEX `idx_name` (`name`)");
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

    // distribution_logs assigned_to & received_at composite index for consultant stats optimization
    $chkIdxAssignedDateStatus = $conn->query("SHOW INDEX FROM distribution_logs WHERE Key_name='idx_assigned_date_status'");
    if ($chkIdxAssignedDateStatus && $chkIdxAssignedDateStatus->num_rows === 0) {
        $conn->query("ALTER TABLE distribution_logs ADD INDEX `idx_assigned_date_status` (`assigned_to`, `received_at`, `status`)");
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

    // admin_logs created_at index for sorting
    $chkIdxAdminCreated = $conn->query("SHOW INDEX FROM admin_logs WHERE Key_name='idx_created_at'");
    if ($chkIdxAdminCreated && $chkIdxAdminCreated->num_rows === 0) {
        $conn->query("ALTER TABLE admin_logs ADD INDEX `idx_created_at` (`created_at`)");
    }

    // admin_logs action & created_at composite index for statistics/filtering
    $chkIdxAdminActionCreated = $conn->query("SHOW INDEX FROM admin_logs WHERE Key_name='idx_action_created'");
    if ($chkIdxAdminActionCreated && $chkIdxAdminActionCreated->num_rows === 0) {
        $conn->query("ALTER TABLE admin_logs ADD INDEX `idx_action_created` (`action`, `created_at`)");
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

    // Auto-migrate: ensure avatar column exists in consultants
    $chkAvatar = $conn->query("SHOW COLUMNS FROM consultants LIKE 'avatar'");
    if ($chkAvatar && $chkAvatar->num_rows === 0) {
        $conn->query("ALTER TABLE consultants ADD COLUMN avatar VARCHAR(255) NULL COMMENT 'Đường dẫn ảnh đại diện của Sale'");
    }

    // Auto-migrate: ensure avatar column exists in accounts
    $chkAccAvatar = $conn->query("SHOW COLUMNS FROM accounts LIKE 'avatar'");
    if ($chkAccAvatar && $chkAccAvatar->num_rows === 0) {
        $conn->query("ALTER TABLE accounts ADD COLUMN avatar VARCHAR(255) NULL COMMENT 'Đường dẫn ảnh đại diện của Admin/Assistant'");
    }

    // Auto-migrate: clean up notes with "Nhap du lieu cu (Silent)" or "Nhap du lieu cu" (including Vietnamese accented variations)
    $conn->query("UPDATE leads SET note = TRIM(BOTH '\n' FROM REPLACE(note, 'Nhap du lieu cu (Silent)', '')) WHERE note LIKE '%Nhap du lieu cu (Silent)%'");
    $conn->query("UPDATE leads SET note = TRIM(BOTH '\n' FROM REPLACE(note, 'Nhap du lieu cu', '')) WHERE note LIKE '%Nhap du lieu cu%'");
    $conn->query("UPDATE leads SET note = TRIM(BOTH '\n' FROM REPLACE(note, 'Nhập dữ liệu cũ (Silent)', '')) WHERE note LIKE '%Nhập dữ liệu cũ (Silent)%'");
    $conn->query("UPDATE leads SET note = TRIM(BOTH '\n' FROM REPLACE(note, 'Nhập dữ liệu cũ', '')) WHERE note LIKE '%Nhập dữ liệu cũ%'");

    // Auto-migrate: ensure active_compensation_logs table exists
    $conn->query("CREATE TABLE IF NOT EXISTS active_compensation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        round_id INT NOT NULL,
        consultant_id INT NOT NULL,
        admin_id INT NOT NULL,
        amount INT NOT NULL,
        reason VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (round_id) REFERENCES distribution_rounds(id) ON DELETE CASCADE,
        FOREIGN KEY (consultant_id) REFERENCES consultants(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Auto-migrate: ensure two_way_sync columns in sheet_connections
    $chkColTWS = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'two_way_sync'");
    if ($chkColTWS && $chkColTWS->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN two_way_sync TINYINT(1) DEFAULT 0 COMMENT 'Đồng bộ 2 chiều ngược về Sheet'");
    }
    $chkColGSU = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'google_script_url'");
    if ($chkColGSU && $chkColGSU->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN google_script_url VARCHAR(512) NULL COMMENT 'URL Web App Google Apps Script'");
    }

    // Auto-migrate: ensure lead_recall_minutes in sheet_connections
    $chkColLRM = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'lead_recall_minutes'");
    if ($chkColLRM && $chkColLRM->num_rows === 0) {
        $conn->query("ALTER TABLE sheet_connections ADD COLUMN lead_recall_minutes INT DEFAULT 0 COMMENT 'Thời gian tự động thu hồi lead không tiếp nhận (phút, 0=tắt)'");
    }

    // Auto-migrate: ensure vacation_mode column in consultants
    $chkColVM = $conn->query("SHOW COLUMNS FROM consultants LIKE 'vacation_mode'");
    if ($chkColVM && $chkColVM->num_rows === 0) {
        $conn->query("ALTER TABLE consultants ADD COLUMN vacation_mode TINYINT(1) DEFAULT 0 COMMENT 'Chế độ nghỉ phép nhanh'");
    }

    // Auto-migrate: ensure is_accepted and accepted_at in leads
    $chkColIA = $conn->query("SHOW COLUMNS FROM leads LIKE 'is_accepted'");
    if ($chkColIA && $chkColIA->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN is_accepted TINYINT(1) DEFAULT 0 COMMENT 'Sale đã bấm tiếp nhận'");
    }
    $chkColAA = $conn->query("SHOW COLUMNS FROM leads LIKE 'accepted_at'");
    if ($chkColAA && $chkColAA->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN accepted_at DATETIME NULL COMMENT 'Thời gian Sale bấm tiếp nhận'");
    }

    // Auto-migrate: ensure Zalo Queue table exists
    $conn->query("CREATE TABLE IF NOT EXISTS zalo_queue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bot_token VARCHAR(255) NOT NULL,
        chat_id VARCHAR(255) NOT NULL,
        body_text TEXT NOT NULL,
        status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME NULL,
        attempts INT DEFAULT 0,
        last_error TEXT NULL,
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Auto-migrate: ensure ai_attempts in leads
    $chkColAiAtt = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_attempts'");
    if ($chkColAiAtt && $chkColAiAtt->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN ai_attempts INT DEFAULT 0 COMMENT 'Số lần thử gọi AI'");
    }

    // Save migration version to skip next time
    $conn->query("CREATE TABLE IF NOT EXISTS system_settings (setting_key VARCHAR(100) PRIMARY KEY, setting_value MEDIUMTEXT NULL)");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('master_two_way_sync', '0')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('master_google_script_url', '')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('master_sheet_name', '')");
    
    // Auto-migrate: Version 121 - sync_queue table
    $conn->query("CREATE TABLE IF NOT EXISTS sync_queue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT UNIQUE,
        connection_id INT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        attempts INT DEFAULT 0,
        next_retry_at DATETIME,
        last_error TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY (connection_id) REFERENCES sheet_connections(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Auto-migrate: Version 121 - skipped_credit column
    $chkColSK = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'skipped_credit'");
    if ($chkColSK && $chkColSK->num_rows === 0) {
        $conn->query("ALTER TABLE round_consultants ADD COLUMN skipped_credit INT DEFAULT 0 COMMENT 'Lượt bù tích lũy do ngoài giờ/nghỉ phép'");
    }

    // Auto-migrate: Version 121 - default starvation prevention settings
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('starvation_prevention_enabled', '0')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('starvation_max_leads_per_hour', '5')");

    // Auto-migrate: Version 122 - default error reporting settings
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('report_error_reasons', '[\"Sai số điện thoại / Số ảo\",\"Trùng của tôi (Trùng Saleperson)\",\"Trùng của người khác (Saleperson khác đã chăm)\",\"Spam ảo / Junk lead\",\"Khác (Vui lòng ghi rõ ở phần ghi chú)\"]')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('report_error_allowed_roles', 'sale,admin,assistant')");

    // Auto-migrate: Version 123 - AI Pre-screener and Gatekeeper Approval Queue
    $chkColStatus = $conn->query("SHOW COLUMNS FROM leads LIKE 'status'");
    if ($chkColStatus && $chkColStatus->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN status VARCHAR(50) DEFAULT 'active' COMMENT 'Trạng thái lead (active, pending_approval, rejected, blacklisted)'");
    }
    $chkColTR = $conn->query("SHOW COLUMNS FROM leads LIKE 'target_round_id'");
    if ($chkColTR && $chkColTR->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN target_round_id INT NULL COMMENT 'Vòng xoay phân bổ dự kiến'");
    }
    $chkColAIS = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_screener_status'");
    if ($chkColAIS && $chkColAIS->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN ai_screener_status VARCHAR(50) DEFAULT 'not_screened' COMMENT 'Đánh giá AI (passed, failed, skipped, error)'");
    }
    $chkColAIE = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_evaluation'");
    if ($chkColAIE && $chkColAIE->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN ai_evaluation TEXT NULL COMMENT 'Chi tiết đánh giá của AI'");
    }

    $chkFkTR = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_target_round_id'");
    if ($chkFkTR && $chkFkTR->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD INDEX `idx_target_round_id` (`target_round_id`)");
    }

    $chkFkStatus = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_leads_status'");
    if ($chkFkStatus && $chkFkStatus->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD INDEX `idx_leads_status` (`status`)");
    }

    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_enabled', '0')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_rules', 'Tiếng Anh: Đạt chuẩn (đã học tiếng Anh, có nền tảng tốt, có thể giao tiếp cơ bản, có chứng chỉ tiếng Anh như IELTS, TOEIC, v.v.).\\nKhông đạt chuẩn (không có tiếng Anh, mất gốc hoàn toàn, không muốn học tiếng Anh, v.v.). Nếu ghi chú thể hiện rõ ràng là không học tiếng Anh hoặc mất gốc hoàn toàn thì đánh giá là Không đạt chuẩn.')");
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_model', 'gemini-2.5-flash-lite') ON DUPLICATE KEY UPDATE setting_value = IF(setting_value = 'gemini-2.5-flash', 'gemini-2.5-flash-lite', setting_value)");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_rounds', '')");

    // Auto-migrate: Version 126 - Dual mode AI & Manual pre-screening settings
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_mode', 'ai')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_manual_rules', '[]')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_manual_action', 'hold')");

    // Auto-migrate: Version 127 - Optimize sync_queue polling with composite index
    $chkIdxSyncQueue = $conn->query("SHOW INDEX FROM sync_queue WHERE Key_name='idx_status_retry'");
    if ($chkIdxSyncQueue && $chkIdxSyncQueue->num_rows === 0) {
        $conn->query("ALTER TABLE sync_queue ADD INDEX `idx_status_retry` (`status`, `next_retry_at`)");
    }

    // Auto-migrate: Version 129 - zalo_notify_status and email_notify_status columns in leads table
    $chkColZNS = $conn->query("SHOW COLUMNS FROM leads LIKE 'zalo_notify_status'");
    if ($chkColZNS && $chkColZNS->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN zalo_notify_status VARCHAR(50) DEFAULT 'none' COMMENT 'Trạng thái gửi thông báo Zalo'");
    }
    $chkColENS = $conn->query("SHOW COLUMNS FROM leads LIKE 'email_notify_status'");
    if ($chkColENS && $chkColENS->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN email_notify_status VARCHAR(50) DEFAULT 'none' COMMENT 'Trạng thái gửi thông báo Email'");
    }

    // Auto-migrate: Version 130 - lead_id columns in mail_queue and zalo_queue
    $chkColMQ = $conn->query("SHOW COLUMNS FROM mail_queue LIKE 'lead_id'");
    if ($chkColMQ && $chkColMQ->num_rows === 0) {
        $conn->query("ALTER TABLE mail_queue ADD COLUMN lead_id INT NULL COMMENT 'ID của Lead liên kết'");
        $chkIdxMQ = $conn->query("SHOW INDEX FROM mail_queue WHERE Key_name='idx_lead_id'");
        if ($chkIdxMQ && $chkIdxMQ->num_rows === 0) {
            $conn->query("ALTER TABLE mail_queue ADD INDEX idx_lead_id (lead_id)");
        }
    }
    $chkColZQ = $conn->query("SHOW COLUMNS FROM zalo_queue LIKE 'lead_id'");
    if ($chkColZQ && $chkColZQ->num_rows === 0) {
        $conn->query("ALTER TABLE zalo_queue ADD COLUMN lead_id INT NULL COMMENT 'ID của Lead liên kết'");
        $chkIdxZQ = $conn->query("SHOW INDEX FROM zalo_queue WHERE Key_name='idx_lead_id'");
        if ($chkIdxZQ && $chkIdxZQ->num_rows === 0) {
            $conn->query("ALTER TABLE zalo_queue ADD INDEX idx_lead_id (lead_id)");
        }
    }

    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '130') ON DUPLICATE KEY UPDATE setting_value = '130'");

    // Auto-migrate: Version 131 - Backfill historic leads assigned to consultants to 'sent' for both notify columns
    $conn->query("UPDATE leads SET zalo_notify_status = 'sent' WHERE assigned_to IS NOT NULL AND assigned_to > 0 AND zalo_notify_status = 'none'");
    $conn->query("UPDATE leads SET email_notify_status = 'sent' WHERE assigned_to IS NOT NULL AND assigned_to > 0 AND email_notify_status = 'none'");
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '131') ON DUPLICATE KEY UPDATE setting_value = '131'");

    // Auto-migrate: Version 132 - zalo_notify_sent_at and email_notify_sent_at columns in leads table
    $chkColZNST = $conn->query("SHOW COLUMNS FROM leads LIKE 'zalo_notify_sent_at'");
    if ($chkColZNST && $chkColZNST->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN zalo_notify_sent_at DATETIME NULL COMMENT 'Thời gian gửi thông báo Zalo thành công'");
        
        // Backfill zalo_notify_sent_at
        $conn->query("UPDATE leads l JOIN zalo_queue z ON l.id = z.lead_id SET l.zalo_notify_sent_at = z.sent_at WHERE z.status = 'sent' AND l.zalo_notify_sent_at IS NULL");
        $conn->query("UPDATE leads SET zalo_notify_sent_at = created_at WHERE zalo_notify_status = 'sent' AND zalo_notify_sent_at IS NULL");
    }
    
    $chkColENST = $conn->query("SHOW COLUMNS FROM leads LIKE 'email_notify_sent_at'");
    if ($chkColENST && $chkColENST->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN email_notify_sent_at DATETIME NULL COMMENT 'Thời gian gửi thông báo Email thành công'");
        
        // Backfill email_notify_sent_at
        $conn->query("UPDATE leads l JOIN mail_queue m ON l.id = m.lead_id SET l.email_notify_sent_at = m.sent_at WHERE m.status = 'sent' AND l.email_notify_sent_at IS NULL");
        $conn->query("UPDATE leads SET email_notify_sent_at = created_at WHERE email_notify_status = 'sent' AND email_notify_sent_at IS NULL");
    }
    
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '132') ON DUPLICATE KEY UPDATE setting_value = '132'");

    // Release Advisory Lock
    $relStmt = $conn->prepare("SELECT RELEASE_LOCK('db_migration_lock')");
    if ($relStmt) {
        $relStmt->execute();
        $relStmt->close();
    }
}

?>
