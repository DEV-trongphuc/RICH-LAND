<?php
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

// Safe check: Allow CLI or check session authorization
$isCli = (php_sapi_name() === 'cli');
$apply = (isset($_GET['apply']) && $_GET['apply'] === 'true')
      || (isset($_GET['run']) && $_GET['run'] === '1')
      || (isset($_POST['execute_migration']) && $_POST['execute_migration'] === '1')
      || ($isCli && in_array('--apply', $argv));

$targetVersion = 158;
$currentVersion = 0;

// Query current DB version
$checkSettings = $conn->query("SHOW TABLES LIKE 'system_settings'");
if ($checkSettings && $checkSettings->num_rows > 0) {
    $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
    if ($vStmt && $vStmt->num_rows > 0) {
        $currentVersion = (int)$vStmt->fetch_assoc()['setting_value'];
    }
}

// ----------------------------------------------------
// UI Styles & Header
// ----------------------------------------------------
if (!$isCli) {
    header("Content-Type: text/html; charset=utf-8");
    echo "<html><head><title>Hệ thống Cập nhật Cơ sở dữ liệu</title>";
    echo "<style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto; color: #334155; background-color: #f8fafc; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; display: flex; align-items: center; gap: 10px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .badge { display: inline-block; padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; }
        .badge-info { background: #e0f2fe; color: #0369a1; }
        .badge-success { background: #dcfce7; color: #15803d; }
        .badge-warning { background: #fef9c3; color: #a16207; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.875rem; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-weight: 600; color: #475569; }
        .btn { display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 0.625rem 1.25rem; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; transition: all 0.2s; }
        .btn:hover { background: #4338ca; transform: translateY(-1px); }
        .btn-warn { background: #ea580c; }
        .btn-warn:hover { background: #c2410c; }
        .step-log { font-family: monospace; font-size: 0.8125rem; background: #0f172a; color: #38bdf8; padding: 1rem; border-radius: 8px; overflow-x: auto; max-height: 400px; }
        .step-log .success { color: #4ade80; }
        .step-log .error { color: #f87171; font-weight: bold; }
        .version-box { display: flex; gap: 2rem; margin-bottom: 1rem; }
        .version-num { font-size: 2.25rem; font-weight: 800; color: #0f172a; }
        .version-label { font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: bold; }
    </style></head><body>";
    echo "<h1>⚙️ Hệ thống Cập nhật Cơ sở dữ liệu</h1>";
} else {
    echo "=== HỆ THỐNG CẬP NHẬT CƠ SỞ DỮ LIỆU ===\n";
    echo "Phiên bản hiện tại: " . $currentVersion . "\n";
    echo "Phiên bản mục tiêu: " . $targetVersion . "\n\n";
}

// ----------------------------------------------------
// Mode: Dry Run (Check pending updates)
// ----------------------------------------------------
if (!$apply) {
    // Calculate dry-run statistics for migration 135 & 136
    $zaloQueueCount = 0;
    $mailQueueCount = 0;
    $zaloLeadsCount = 0;
    $emailLeadsCount = 0;
    $zaloBloatCount = 0;
    $emailBloatCount = 0;

    $zaloQTableExists = $conn->query("SHOW TABLES LIKE 'zalo_queue'")->num_rows > 0;
    if ($zaloQTableExists) {
        $checkZaloQ = $conn->query("SELECT COUNT(*) as cnt FROM zalo_queue WHERE status IN ('sent', 'failed')");
        if ($checkZaloQ) $zaloQueueCount = (int)$checkZaloQ->fetch_assoc()['cnt'];
    }

    $mailQTableExists = $conn->query("SHOW TABLES LIKE 'mail_queue'")->num_rows > 0;
    if ($mailQTableExists) {
        $checkMailQ = $conn->query("SELECT COUNT(*) as cnt FROM mail_queue WHERE status IN ('sent', 'failed')");
        if ($checkMailQ) $mailQueueCount = (int)$checkMailQ->fetch_assoc()['cnt'];
    }

    // True counts from queues
    $trueZaloQueue = 0;
    $zaloQTableExists = $conn->query("SHOW TABLES LIKE 'zalo_queue'")->num_rows > 0;
    if ($zaloQTableExists) {
        $resZaloQ = $conn->query("SELECT COUNT(*) as cnt FROM zalo_queue WHERE status IN ('sent', 'failed')");
        if ($resZaloQ) $trueZaloQueue = (int)$resZaloQ->fetch_assoc()['cnt'];
    }

    $trueEmailQueue = 0;
    $mailQTableExists = $conn->query("SHOW TABLES LIKE 'mail_queue'")->num_rows > 0;
    if ($mailQTableExists) {
        $resEmailQ = $conn->query("SELECT COUNT(*) as cnt FROM mail_queue WHERE status IN ('sent', 'failed')");
        if ($resEmailQ) $trueEmailQueue = (int)$resEmailQ->fetch_assoc()['cnt'];
    }

    $commLogsExist = $conn->query("SHOW TABLES LIKE 'communication_logs'")->num_rows > 0;
    if ($commLogsExist) {
        // Total rows currently in communication_logs
        $currentZaloLogs = 0;
        $resZalo = $conn->query("SELECT COUNT(*) as cnt FROM communication_logs WHERE type = 'zalo'");
        if ($resZalo) $currentZaloLogs = (int)$resZalo->fetch_assoc()['cnt'];
        
        $currentEmailLogs = 0;
        $resEmail = $conn->query("SELECT COUNT(*) as cnt FROM communication_logs WHERE type = 'email'");
        if ($resEmail) $currentEmailLogs = (int)$resEmail->fetch_assoc()['cnt'];

        $zaloBloatCount = max(0, $currentZaloLogs - $trueZaloQueue);
        $emailBloatCount = max(0, $currentEmailLogs - $trueEmailQueue);
    }

    $totalBackfillRows = $zaloQueueCount + $mailQueueCount;

    if (!$isCli) {
        echo "<div class='card'>";
        echo "<div class='version-box'>";
        echo "<div><div class='version-label'>Phiên bản Hiện tại</div><div class='version-num'>" . $currentVersion . "</div></div>";
        echo "<div style='border-left: 1px solid #e2e8f0; padding-left: 2rem;'><div class='version-label'>Phiên bản Mục tiêu</div><div class='version-num' style='color: #4f46e5;'>" . $targetVersion . "</div></div>";
        echo "</div>";
        
        if ($currentVersion >= $targetVersion) {
            echo "<p><span class='badge badge-success'>✓ Hệ thống đã cập nhật</span> Cơ sở dữ liệu đang ở phiên bản mới nhất. Không cần thực hiện migration.</p>";
        } else {
            echo "<p><span class='badge badge-warning'>⚠️ Phát hiện bản cập nhật mới</span> Cần thực hiện cập nhật cấu trúc cơ sở dữ liệu lên phiên bản " . $targetVersion . ".</p>";
        }
        echo "</div>";

        if ($currentVersion < $targetVersion) {
            echo "<div class='card'>";
            echo "<h3>📋 Chi tiết các bước cập nhật dự kiến</h3>";
            echo "<table>";
            echo "<thead><tr><th>Phiên bản</th><th>Mô tả hoạt động</th><th>Trạng thái</th></tr></thead>";
            echo "<tbody>";
            
            // Legacy / Base version updates summary
            if ($currentVersion < 130) {
                echo "<tr><td>v121 - v130</td><td>Khởi tạo các bảng cấu hình cơ bản, thêm các cột hỗ trợ đồng bộ, cấu hình đền bù và lưu trữ trạng thái duyệt tin nhắn.</td><td><span class='badge badge-info'>Đang chờ</span></td></tr>";
            }
            
            // Version 131
            echo "<tr><td>v131</td><td>Đồng bộ và cập nhật lại trạng thái thông báo cũ của các Lead sang 'sent' nếu đã được phân bổ cho Sale.</td><td>" . ($currentVersion >= 131 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            
            // Version 132
            echo "<tr><td>v132</td><td>Thêm cột thời gian gửi thông báo zalo_notify_sent_at, email_notify_sent_at và đồng bộ lịch sử.</td><td>" . ($currentVersion >= 132 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            
            // Version 133
            echo "<tr><td>v133</td><td>Thêm cột hoàn tác is_rolled_back vào bảng admin_logs để hỗ trợ quản lý lịch sử.</td><td>" . ($currentVersion >= 133 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            
            // Version 134
            echo "<tr><td>v134</td><td>Thêm các cột thống kê token AI (ai_prompt_tokens, ai_completion_tokens, ai_total_tokens) vào bảng leads.</td><td>" . ($currentVersion >= 134 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            
            // Version 135
            echo "<tr><td>v135</td><td>Tạo bảng <strong>communication_logs</strong> lưu nhật ký gửi tin Zalo & Email vĩnh viễn và thực hiện <strong>backfill từ hàng đợi</strong>.</td><td>" . ($currentVersion >= 135 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            
            // Version 136
            echo "<tr><td>v136</td><td>Dọn dẹp bản ghi giao tiếp dư thừa trong communication_logs do lỗi gán trạng thái cũ trong leads.</td><td>" . ($currentVersion >= 136 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";

            // Version 137
            echo "<tr><td>v137</td><td>Tái tạo nhật ký giao tiếp bao gồm tin nhắn Zalo gửi trực tiếp từ log file.</td><td>" . ($currentVersion >= 137 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";

            // Version 138
            echo "<tr><td>v138</td><td>Thêm cột sync_error_count để hỗ trợ đếm số lần lỗi đồng bộ liên tiếp, cho phép tự chữa lành trước khi báo lỗi thực sự.</td><td>" . ($currentVersion >= 138 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            
            // Version 139
            echo "<tr><td>v139</td><td>Thêm INDEX idx_name vào bảng consultants để tối ưu hóa tìm kiếm Sale theo tên.</td><td>" . ($currentVersion >= 139 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            
            // Version 140
            echo "<tr><td>v140</td><td>Tối ưu hóa khóa concurrency và trạng thái queue, thêm ai_screening_started_at.</td><td>" . ($currentVersion >= 140 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            
            // Version 141
            echo "<tr><td>v141</td><td>Thêm chỉ mục index cho trường source trong bảng leads để tối ưu hóa hiệu năng.</td><td>" . ($currentVersion >= 141 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";

            // Version 142
            echo "<tr><td>v142</td><td>Thêm cột notify_admin vào bảng sheet_connections để cấu hình thông báo cho Admin.</td><td>" . ($currentVersion >= 142 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";

            // Version 143
            echo "<tr><td>v143</td><td>Cập nhật mặc định notify_admin: landing page mặc định bật, sheets mặc định tắt.</td><td>" . ($currentVersion >= 143 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";

            // Version 144
            echo "<tr><td>v144</td><td>Thêm thiết lập gửi báo cáo tháng cho Sale và lịch gửi vào ngày 1 hàng tháng.</td><td>" . ($currentVersion >= 144 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";

            // Version 145
            echo "<tr><td>v145</td><td>Tối ưu hóa hiệu năng bằng cách thêm cột ảo log_type và chỉ mục tương ứng cho admin_logs.</td><td>" . ($currentVersion >= 145 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";

            // Version 146
            echo "<tr><td>v146</td><td>Đồng bộ thời gian log phân bổ cũ bị từ chối/blacklist với ngày tạo Lead để thống kê chính xác theo ngày phát sinh Lead.</td><td>" . ($currentVersion >= 146 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";

            echo "</tbody></table>";
            echo "</div>";

            // Dry Run Backfill Statistics Card
            if ($currentVersion < 135) {
                echo "<div class='card'>";
                echo "<h3>📊 Ước lượng Dữ liệu sẽ Backfill (Migration v135)</h3>";
                echo "<ul>";
                echo "<li><strong>Tin nhắn từ Zalo Queue:</strong> " . number_format($zaloQueueCount) . " tin</li>";
                echo "<li><strong>Email từ Mail Queue:</strong> " . number_format($mailQueueCount) . " thư</li>";
                echo "<li><strong>Tổng số dòng sẽ ghi nhận mới vào communication_logs:</strong> <strong style='color:#4f46e5;'>" . number_format($totalBackfillRows) . " dòng</strong></li>";
                echo "</ul>";
                echo "<p style='font-size:0.8125rem; color:#64748b;'><em>Lưu ý: Dữ liệu backfill sử dụng cơ chế INSERT IGNORE để đảm bảo không ghi đè hoặc trùng lặp dữ liệu đã tồn tại.</em></p>";
                echo "</div>";
            }

            // Dry Run Cleanup Statistics Card (v136)
            if ($currentVersion < 136 && ($zaloBloatCount > 0 || $emailBloatCount > 0)) {
                echo "<div class='card' style='background: #fff5f5; border-color: #fee2e2; color: #991b1b;'>";
                echo "<h3>🧹 Dọn dẹp Bản ghi Dư thừa (Migration v136)</h3>";
                echo "<ul>";
                echo "<li><strong>Tin nhắn Zalo dư thừa sẽ xóa:</strong> " . number_format($zaloBloatCount) . " tin</li>";
                echo "<li><strong>Email gửi đi dư thừa sẽ xóa:</strong> " . number_format($emailBloatCount) . " thư</li>";
                echo "</ul>";
                echo "<p style='font-size:0.8125rem; color: #4b5563;'><em>Lý do: Các bản ghi này trước đó bị backfill nhầm dựa trên trạng thái leads.assigned_to (toàn bộ lead đã phân bổ), thay vì lịch sử gửi tin thực tế từ hàng đợi.</em></p>";
                echo "</div>";
            }

            // Dry Run Reconstruction Statistics Card (v137)
            if ($currentVersion < 137) {
                // Count direct Zalo messages in log file
                $directZaloLogsCount = 0;
                $zaloLogFile = __DIR__ . '/zalo_send_log.txt';
                if (file_exists($zaloLogFile)) {
                    $content = file_get_contents($zaloLogFile);
                    if ($content) {
                        $lines = explode("\n", $content);
                        foreach ($lines as $line) {
                            if (preg_match('/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+Target\s+ChatId:\s*([^,]+),\s*HTTP:\s*(\d+)/i', $line)) {
                                $directZaloLogsCount++;
                            }
                        }
                    }
                }
                
                echo "<div class='card' style='background: #e0f2fe; border-color: #bae6fd; color: #0369a1;'>";
                echo "<h3>📊 Đồng bộ Dữ liệu thực tế (Migration v137)</h3>";
                echo "<ul>";
                echo "<li><strong>Tin nhắn từ Zalo Queue:</strong> " . number_format($trueZaloQueue) . " tin</li>";
                echo "<li><strong>Tin Zalo gửi trực tiếp (zalo_send_log.txt):</strong> ~" . number_format($directZaloLogsCount) . " tin</li>";
                echo "<li><strong>Email từ Mail Queue:</strong> " . number_format($trueEmailQueue) . " thư</li>";
                echo "</ul>";
                echo "<p style='font-size:0.8125rem; color: #0369a1;'><em>Lưu ý: Hệ thống sẽ tự động dọn dẹp các tin nhắn trùng lặp giữa file log trực tiếp và hàng đợi để hiển thị con số chính xác nhất trên Dashboard.</em></p>";
                echo "</div>";
            }

            echo "<div class='card' style='background: #fffbeb; border-color: #fef3c7;'>";
            echo "<h4>⚠️ Xác nhận chạy cập nhật thực tế (Live Migration)</h4>";
            echo "<p>Quá trình này sẽ trực tiếp cập nhật cấu trúc cơ sở dữ liệu MySQL trên hệ thống. Vui lòng đảm bảo bạn đã backup dữ liệu trước khi chạy thực tế.</p>";
            echo "<div style='margin-top: 1rem;'>";
            echo "<form method='POST' action='run_migrations.php' style='margin: 0;'>";
            echo "<input type='hidden' name='execute_migration' value='1'>";
            echo "<button type='submit' class='btn btn-warn'>Xác nhận và Áp dụng Migration 🚀</button>";
            echo "</form>";
            echo "</div>";
            echo "</div>";
        }
        echo "</body></html>";
    } else {
        if ($currentVersion >= $targetVersion) {
            echo "Hệ thống đã ở phiên bản mới nhất. Không cần cập nhật.\n";
        } else {
            echo "Có bản cập nhật mới. Tổng số dòng backfill dự kiến: " . $totalBackfillRows . " dòng.\n";
            echo "Chạy lệnh sau để áp dụng cập nhật: php backend/run_migrations.php --apply\n";
        }
    }
    exit();
}

// ----------------------------------------------------
// Mode: Live Run (Execute updates)
// ----------------------------------------------------
if (!$isCli) {
    echo "<div class='card'>";
    echo "<h3>🚀 Tiến trình chạy Migration thực tế</h3>";
    echo "<div class='step-log'>";
}

$logMsg = function($msg, $type = 'info') use ($isCli) {
    if ($isCli) {
        if ($type === 'success') echo "[SUCCESS] " . $msg . "\n";
        else if ($type === 'error') echo "[ERROR] " . $msg . "\n";
        else echo "[INFO] " . $msg . "\n";
    } else {
        $class = $type === 'success' ? 'class="success"' : ($type === 'error' ? 'class="error"' : '');
        echo "<div {$class}>" . htmlspecialchars($msg) . "</div>";
        // Flush buffer
        @ob_flush();
        flush();
    }
};

// Advisory Lock
$lockStmt = $conn->prepare("SELECT GET_LOCK('db_migration_lock', 30) as get_lock");
if (!$lockStmt) {
    $logMsg("Không thể chuẩn bị truy vấn Get Lock.", "error");
    if (!$isCli) echo "</div></div></body></html>";
    exit();
}
$lockStmt->execute();
$lockRes = $lockStmt->get_result()->fetch_assoc();
$lockStmt->close();

if (!$lockRes || (int)$lockRes['get_lock'] !== 1) {
    $logMsg("Không thể lấy khóa Advisory Lock (tiến trình khác đang chạy migration). Vui lòng thử lại sau.", "error");
    if (!$isCli) echo "</div></div></body></html>";
    exit();
}

$logMsg("Đã lấy khóa Advisory Lock thành công. Bắt đầu chạy migrations...", "info");

// Double check version
$checkSettings = $conn->query("SHOW TABLES LIKE 'system_settings'");
if ($checkSettings && $checkSettings->num_rows > 0) {
    $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
    if ($vStmt && $vStmt->num_rows > 0) {
        $currentVersion = (int)$vStmt->fetch_assoc()['setting_value'];
    }
}

$logMsg("Phiên bản hiện tại: " . $currentVersion . ". Phiên bản mục tiêu: " . $targetVersion, "info");

try {
    // --------------------------------------------------
    // Step 1: Base migrations (Only run if current version is < 130 or not set)
    // --------------------------------------------------
    if ($currentVersion < 130) {
        $logMsg("Đang chạy các bước cập nhật cơ sở dữ liệu cơ bản (v121-v130)...", "info");
        
        // Auto-migrate: ensure last_error column exists in sheet_connections
        $checkColLE = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'last_error'");
        if ($checkColLE && $checkColLE->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN last_error VARCHAR(255) NULL COMMENT 'Chi tiết lỗi đồng bộ gần nhất'");
            $logMsg("Đã thêm cột last_error vào sheet_connections", "success");
        }

        // Auto-migrate: ensure custom_label column exists in field_mappings
        $checkCol = $conn->query("SHOW COLUMNS FROM field_mappings LIKE 'custom_label'");
        if ($checkCol && $checkCol->num_rows === 0) {
            $conn->query("ALTER TABLE field_mappings ADD COLUMN custom_label VARCHAR(255) NULL COMMENT 'Tên hiển thị tùy chỉnh trong Email'");
            $logMsg("Đã thêm cột custom_label vào field_mappings", "success");
        }

        // Auto-migrate: ensure require_both_contact column exists in sheet_connections
        $checkColSC = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'require_both_contact'");
        if ($checkColSC && $checkColSC->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN require_both_contact BOOLEAN DEFAULT FALSE COMMENT 'Yêu cầu có cả SĐT và Email'");
            $logMsg("Đã thêm cột require_both_contact vào sheet_connections", "success");
        }

        // Auto-migrate: ensure is_silent column exists in sheet_connections
        $checkColSC = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'is_silent'");
        if ($checkColSC && $checkColSC->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN is_silent TINYINT(1) DEFAULT 0 COMMENT 'Không chia số, chỉ đồng bộ check trùng'");
            $logMsg("Đã thêm cột is_silent vào sheet_connections", "success");
        }

        // Auto-migrate: ensure email_template column exists in sheet_connections
        $checkColTpl = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'email_template'");
        if ($checkColTpl && $checkColTpl->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN email_template MEDIUMTEXT NULL COMMENT 'Mẫu nội dung email gửi Sale'");
            $logMsg("Đã thêm cột email_template vào sheet_connections", "success");
        }

        // Auto-migrate: ensure receive_ratio column exists in round_consultants
        $checkColRR = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'receive_ratio'");
        if ($checkColRR && $checkColRR->num_rows === 0) {
            $conn->query("ALTER TABLE round_consultants ADD COLUMN receive_ratio INT DEFAULT 1");
            $logMsg("Đã thêm cột receive_ratio vào round_consultants", "success");
        }

        // Auto-migrate: ensure skip_count column exists in round_consultants
        $checkColSC = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'skip_count'");
        if ($checkColSC && $checkColSC->num_rows === 0) {
            $conn->query("ALTER TABLE round_consultants ADD COLUMN skip_count INT DEFAULT 0");
            $logMsg("Đã thêm cột skip_count vào round_consultants", "success");
        }

        // Auto-migrate: ensure sheet_sync_records table exists
        $conn->query("CREATE TABLE IF NOT EXISTS sheet_sync_records (
            connection_id INT,
            row_hash VARCHAR(64),
            synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (connection_id, row_hash),
            FOREIGN KEY (connection_id) REFERENCES sheet_connections(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $logMsg("Khởi tạo bảng sheet_sync_records thành công", "success");

        // Auto-migrate: ensure conditions_json column exists in routing_rules for multi-conditions
        $checkColRRJson = $conn->query("SHOW COLUMNS FROM routing_rules LIKE 'conditions_json'");
        if ($checkColRRJson && $checkColRRJson->num_rows === 0) {
            $conn->query("ALTER TABLE routing_rules ADD COLUMN conditions_json LONGTEXT NULL COMMENT 'Mảng điều kiện JSON'");
            $logMsg("Đã thêm cột conditions_json vào routing_rules", "success");
        }

        // Auto-migrate: ensure logical_operator column exists in routing_rules for multi-conditions
        $checkColRROp = $conn->query("SHOW COLUMNS FROM routing_rules LIKE 'logical_operator'");
        if ($checkColRROp && $checkColRROp->num_rows === 0) {
            $conn->query("ALTER TABLE routing_rules ADD COLUMN logical_operator VARCHAR(10) DEFAULT 'AND' COMMENT 'Toán tử logic giữa các điều kiện'");
            $logMsg("Đã thêm cột logical_operator vào routing_rules", "success");
        }

        // Auto-migrate: ensure compensation_count column exists in round_consultants
        $checkColComp = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'compensation_count'");
        if ($checkColComp && $checkColComp->num_rows === 0) {
            $conn->query("ALTER TABLE round_consultants ADD COLUMN compensation_count INT DEFAULT 0 COMMENT 'Số data cần đền bù'");
            $logMsg("Đã thêm cột compensation_count vào round_consultants", "success");
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
        $logMsg("Khởi tạo bảng data_reports thành công", "success");

        // Unique key for round_consultants
        $chkIdx1 = $conn->query("SHOW INDEX FROM round_consultants WHERE Key_name='idx_round_consultant_unique'");
        if ($chkIdx1 && $chkIdx1->num_rows === 0) {
            $conn->query("ALTER TABLE round_consultants ADD UNIQUE KEY `idx_round_consultant_unique` (`round_id`, `consultant_id`)");
            $logMsg("Đã thêm Unique Key cho round_consultants", "success");
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
            $logMsg("Đã thêm cột connection_id vào leads", "success");
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

        // Auto-migrate: data_per_turn
        $checkColDPT = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'data_per_turn'");
        if ($checkColDPT && $checkColDPT->num_rows === 0) {
            $conn->query("ALTER TABLE round_consultants ADD COLUMN data_per_turn INT DEFAULT 1 COMMENT 'Số Data nhận mỗi lần đến lượt'");
        }

        // Auto-migrate: current_turn_remaining
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

        // Self-healing database performance indexes optimization
        $indices_to_create = [
            'contacts' => [
                'idx_contacts_phone' => ['phone'],
                'idx_contacts_email' => ['email'],
                'idx_contacts_owner_id' => ['owner_id'],
                'idx_contacts_stage_id' => ['stage_id'],
                'idx_contacts_status' => ['status'],
                'idx_contacts_pipeline_status' => ['pipeline_status'],
                'idx_contacts_created_at' => ['created_at'],
                'idx_contacts_deleted_at' => ['deleted_at'],
            ],
            'activities' => [
                'idx_activities_tenant_user' => ['tenant_id', 'user_id'],
                'idx_activities_related' => ['related_type', 'related_id'],
                'idx_activities_due_date' => ['due_date'],
            ],
            'activity_comments' => [
                'idx_comments_activity_id' => ['activity_id'],
            ],
            'deposits' => [
                'idx_deposits_contact_id' => ['contact_id'],
                'idx_deposits_project_id' => ['project_id'],
            ],
            'notifications' => [
                'idx_notifications_user_unread' => ['user_id', 'is_read'],
            ],
            'deals' => [
                'idx_deals_contact_id' => ['contact_id'],
                'idx_deals_company_id' => ['company_id'],
                'idx_deals_created_at' => ['created_at'],
            ],
            'invoices' => [
                'idx_invoices_deal_id' => ['deal_id'],
                'idx_invoices_contact_id' => ['contact_id'],
                'idx_invoices_status' => ['status'],
            ],
            'quotes' => [
                'idx_quotes_deal_id' => ['deal_id'],
                'idx_quotes_contact_id' => ['contact_id'],
            ],
            'expenses' => [
                'idx_expenses_project_id' => ['project_id'],
                'idx_expenses_supplier_id' => ['supplier_id'],
            ],
            'tickets' => [
                'idx_tickets_contact_id' => ['contact_id'],
                'idx_tickets_assigned_to' => ['assigned_to'],
                'idx_tickets_status' => ['status'],
            ],
        ];

        foreach ($indices_to_create as $table => $indexes) {
            foreach ($indexes as $index_name => $columns) {
                $chk = $conn->query("SHOW INDEX FROM `$table` WHERE Key_name='$index_name'");
                if ($chk && $chk->num_rows === 0) {
                    $cols_str = implode("`, `", $columns);
                    $conn->query("ALTER TABLE `$table` ADD INDEX `$index_name` (`$cols_str`)");
                    $logMsg("Đã tạo INDEX $index_name trên bảng $table", "success");
                }
            }
        }

        // Auto-migrate: email in accounts
        $chkAccEmail = $conn->query("SHOW COLUMNS FROM accounts LIKE 'email'");
        if ($chkAccEmail && $chkAccEmail->num_rows === 0) {
            $conn->query("ALTER TABLE accounts ADD COLUMN email VARCHAR(255) NULL UNIQUE COMMENT 'Email đăng nhập (bắt buộc với admin thường, tùy chọn với Super Admin)'");
            $logMsg("Đã thêm cột email vào accounts", "success");
        }

        // Auto-migrate: ticket_notify_settings
        $conn->query("CREATE TABLE IF NOT EXISTS ticket_notify_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            account_id INT NOT NULL,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            UNIQUE KEY unique_account (account_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Auto-migrate: zalo_chat_id in accounts
        $chkAccZalo = $conn->query("SHOW COLUMNS FROM accounts LIKE 'zalo_chat_id'");
        if ($chkAccZalo && $chkAccZalo->num_rows === 0) {
            $conn->query("ALTER TABLE accounts ADD COLUMN zalo_chat_id VARCHAR(255) NULL COMMENT 'Zalo Bot Chat ID'");
        }

        // Auto-migrate: reject_reason / approval_reason in data_reports
        $chkRejectReason = $conn->query("SHOW COLUMNS FROM data_reports LIKE 'reject_reason'");
        if ($chkRejectReason && $chkRejectReason->num_rows === 0) {
            $conn->query("ALTER TABLE data_reports ADD COLUMN reject_reason VARCHAR(255) NULL COMMENT 'Lý do từ chối ticket'");
        }
        $chkApprovalReason = $conn->query("SHOW COLUMNS FROM data_reports LIKE 'approval_reason'");
        if ($chkApprovalReason && $chkApprovalReason->num_rows === 0) {
            $conn->query("ALTER TABLE data_reports ADD COLUMN approval_reason VARCHAR(255) NULL COMMENT 'Lý do duyệt ticket'");
        }

        // Auto-migrate: email confirm fields
        $chkAccConfirmed = $conn->query("SHOW COLUMNS FROM accounts LIKE 'is_confirmed'");
        if ($chkAccConfirmed && $chkAccConfirmed->num_rows === 0) {
            $conn->query("ALTER TABLE accounts ADD COLUMN is_confirmed TINYINT(1) DEFAULT 0 COMMENT 'Xác nhận Email'");
            $conn->query("ALTER TABLE accounts ADD COLUMN confirm_token VARCHAR(64) NULL COMMENT 'Token xác nhận Email'");
            $conn->query("UPDATE accounts SET is_confirmed = 1");
            $logMsg("Đã thêm các trường xác nhận Email vào accounts", "success");
        }

        // Auto-migrate: consultants ID migration (4 digits)
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
                $logMsg("Đã nâng mã Sale (ID) lên 4 chữ số (bắt đầu từ 1000)", "success");
            }
        }
        $conn->query("ALTER TABLE consultants AUTO_INCREMENT = 1000;");

        // Auto-migrate: last_login in accounts
        $chkLastLogin = $conn->query("SHOW COLUMNS FROM accounts LIKE 'last_login'");
        if ($chkLastLogin && $chkLastLogin->num_rows === 0) {
            $conn->query("ALTER TABLE accounts ADD COLUMN last_login DATETIME DEFAULT NULL");
        }

        // Auto-migrate: admin_logs
        $conn->query("CREATE TABLE IF NOT EXISTS admin_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            account_id INT NOT NULL,
            action VARCHAR(100) NOT NULL,
            details LONGTEXT DEFAULT NULL COMMENT 'JSON details',
            ip_address VARCHAR(45) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Auto-migrate: attempts / last_error in mail_queue
        $chkMailAttempts = $conn->query("SHOW COLUMNS FROM mail_queue LIKE 'attempts'");
        if ($chkMailAttempts && $chkMailAttempts->num_rows === 0) {
            $conn->query("ALTER TABLE mail_queue ADD COLUMN attempts INT DEFAULT 0");
        }
        $chkMailErr = $conn->query("SHOW COLUMNS FROM mail_queue LIKE 'last_error'");
        if ($chkMailErr && $chkMailErr->num_rows === 0) {
            $conn->query("ALTER TABLE mail_queue ADD COLUMN last_error TEXT NULL");
        }

        // Default setting for last_daily_report_timestamp
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('last_daily_report_timestamp', '')");

        // Auto-migrate: sync_saleperson, is_initialized, sync_mode
        $chkSyncSaleperson = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'sync_saleperson'");
        if ($chkSyncSaleperson && $chkSyncSaleperson->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN sync_saleperson TINYINT(1) DEFAULT 0 COMMENT 'Đồng bộ salesperson bằng email'");
        }
        $chkIsInitialized = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'is_initialized'");
        if ($chkIsInitialized && $chkIsInitialized->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN is_initialized TINYINT(1) DEFAULT 0 COMMENT 'Đánh dấu đã đồng bộ lần đầu'");
        }
        $chkSyncMode = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'sync_mode'");
        if ($chkSyncMode && $chkSyncMode->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN sync_mode ENUM('all', 'new_only') DEFAULT 'all' COMMENT 'Chế độ quét dữ liệu' AFTER require_both_contact");
        }

        // Weekly report defaults
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('zalo_weekly_report_day', '0')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('zalo_weekly_report_time', '08:00')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('last_weekly_report_date', '')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('last_weekly_report_timestamp', '')");

        // Work schedule in consultants
        $chkWorkStart = $conn->query("SHOW COLUMNS FROM consultants LIKE 'work_start_time'");
        if ($chkWorkStart && $chkWorkStart->num_rows === 0) {
            $conn->query("ALTER TABLE consultants ADD COLUMN work_start_time VARCHAR(5) DEFAULT '00:00'");
        }
        $chkWorkEnd = $conn->query("SHOW COLUMNS FROM consultants LIKE 'work_end_time'");
        if ($chkWorkEnd && $chkWorkEnd->num_rows === 0) {
            $conn->query("ALTER TABLE consultants ADD COLUMN work_end_time VARCHAR(5) DEFAULT '23:59'");
        }

        // More indexes
        $chkIdxDashboardOpt = $conn->query("SHOW INDEX FROM distribution_logs WHERE Key_name='idx_dashboard_opt'");
        if ($chkIdxDashboardOpt && $chkIdxDashboardOpt->num_rows === 0) {
            $conn->query("ALTER TABLE distribution_logs ADD INDEX `idx_dashboard_opt` (`received_at`, `status`, `assigned_to`, `round_id`)");
        }
        $chkIdxAssignedDateStatus = $conn->query("SHOW INDEX FROM distribution_logs WHERE Key_name='idx_assigned_date_status'");
        if ($chkIdxAssignedDateStatus && $chkIdxAssignedDateStatus->num_rows === 0) {
            $conn->query("ALTER TABLE distribution_logs ADD INDEX `idx_assigned_date_status` (`assigned_to`, `received_at`, `status`)");
        }
        $chkIdxReportCreated = $conn->query("SHOW INDEX FROM data_reports WHERE Key_name='idx_created_at'");
        if ($chkIdxReportCreated && $chkIdxReportCreated->num_rows === 0) {
            $conn->query("ALTER TABLE data_reports ADD INDEX `idx_created_at` (`created_at`)");
        }
        $chkIdxReportStatus = $conn->query("SHOW INDEX FROM data_reports WHERE Key_name='idx_status'");
        if ($chkIdxReportStatus && $chkIdxReportStatus->num_rows === 0) {
            $conn->query("ALTER TABLE data_reports ADD INDEX `idx_status` (`status`)");
        }
        $chkIdxAdminCreated = $conn->query("SHOW INDEX FROM admin_logs WHERE Key_name='idx_created_at'");
        if ($chkIdxAdminCreated && $chkIdxAdminCreated->num_rows === 0) {
            $conn->query("ALTER TABLE admin_logs ADD INDEX `idx_created_at` (`created_at`)");
        }
        $chkIdxAdminActionCreated = $conn->query("SHOW INDEX FROM admin_logs WHERE Key_name='idx_action_created'");
        if ($chkIdxAdminActionCreated && $chkIdxAdminActionCreated->num_rows === 0) {
            $conn->query("ALTER TABLE admin_logs ADD INDEX `idx_action_created` (`action`, `created_at`)");
        }

        $chkWorkSchedule = $conn->query("SHOW COLUMNS FROM consultants LIKE 'work_schedule'");
        if ($chkWorkSchedule && $chkWorkSchedule->num_rows === 0) {
            $conn->query("ALTER TABLE consultants ADD COLUMN work_schedule LONGTEXT DEFAULT NULL");
        }
        $chkResolvedBy = $conn->query("SHOW COLUMNS FROM data_reports LIKE 'resolved_by'");
        if ($chkResolvedBy && $chkResolvedBy->num_rows === 0) {
            $conn->query("ALTER TABLE data_reports ADD COLUMN resolved_by VARCHAR(100) NULL AFTER resolved_at");
        }
        $chkAvatar = $conn->query("SHOW COLUMNS FROM consultants LIKE 'avatar'");
        if ($chkAvatar && $chkAvatar->num_rows === 0) {
            $conn->query("ALTER TABLE consultants ADD COLUMN avatar VARCHAR(255) NULL");
        }
        $chkAccAvatar = $conn->query("SHOW COLUMNS FROM accounts LIKE 'avatar'");
        if ($chkAccAvatar && $chkAccAvatar->num_rows === 0) {
            $conn->query("ALTER TABLE accounts ADD COLUMN avatar VARCHAR(255) NULL");
        }

        // Clean notes
        $conn->query("UPDATE leads SET note = TRIM(BOTH '\n' FROM REPLACE(note, 'Nhap du lieu cu (Silent)', '')) WHERE note LIKE '%Nhap du lieu cu (Silent)%'");
        $conn->query("UPDATE leads SET note = TRIM(BOTH '\n' FROM REPLACE(note, 'Nhap du lieu cu', '')) WHERE note LIKE '%Nhap du lieu cu%'");
        $conn->query("UPDATE leads SET note = TRIM(BOTH '\n' FROM REPLACE(note, 'Nhập dữ liệu cũ (Silent)', '')) WHERE note LIKE '%Nhập dữ liệu cũ (Silent)%'");
        $conn->query("UPDATE leads SET note = TRIM(BOTH '\n' FROM REPLACE(note, 'Nhập dữ liệu cũ', '')) WHERE note LIKE '%Nhập dữ liệu cũ%'");

        // active_compensation_logs
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

        // two_way_sync, google_script_url, lead_recall_minutes, vacation_mode, is_accepted, accepted_at
        $chkColTWS = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'two_way_sync'");
        if ($chkColTWS && $chkColTWS->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN two_way_sync TINYINT(1) DEFAULT 0");
        }
        $chkColGSU = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'google_script_url'");
        if ($chkColGSU && $chkColGSU->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN google_script_url VARCHAR(512) NULL");
        }
        $chkColLRM = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'lead_recall_minutes'");
        if ($chkColLRM && $chkColLRM->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN lead_recall_minutes INT DEFAULT 0");
        }
        $chkColVM = $conn->query("SHOW COLUMNS FROM consultants LIKE 'vacation_mode'");
        if ($chkColVM && $chkColVM->num_rows === 0) {
            $conn->query("ALTER TABLE consultants ADD COLUMN vacation_mode TINYINT(1) DEFAULT 0");
        }
        $chkColIA = $conn->query("SHOW COLUMNS FROM leads LIKE 'is_accepted'");
        if ($chkColIA && $chkColIA->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN is_accepted TINYINT(1) DEFAULT 0");
        }
        $chkColAA = $conn->query("SHOW COLUMNS FROM leads LIKE 'accepted_at'");
        if ($chkColAA && $chkColAA->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN accepted_at DATETIME NULL");
        }

        // zalo_queue
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

        // ai_attempts
        $chkColAiAtt = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_attempts'");
        if ($chkColAiAtt && $chkColAiAtt->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN ai_attempts INT DEFAULT 0");
        }

        // Settings master defaults
        $conn->query("CREATE TABLE IF NOT EXISTS system_settings (setting_key VARCHAR(100) PRIMARY KEY, setting_value MEDIUMTEXT NULL)");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('master_two_way_sync', '0')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('master_google_script_url', '')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('master_sheet_name', '')");

        // sync_queue
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

        // skipped_credit
        $chkColSK = $conn->query("SHOW COLUMNS FROM round_consultants LIKE 'skipped_credit'");
        if ($chkColSK && $chkColSK->num_rows === 0) {
            $conn->query("ALTER TABLE round_consultants ADD COLUMN skipped_credit INT DEFAULT 0");
        }

        // starvation settings
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('starvation_prevention_enabled', '0')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('starvation_max_leads_per_hour', '5')");

        // Error report settings
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('report_error_reasons', '[\"Sai số điện thoại / Số ảo\",\"Trùng của tôi (Trùng Saleperson)\",\"Trùng của người khác (Saleperson khác đã chăm)\",\"Spam ảo / Junk lead\",\"Khác (Vui lòng ghi rõ ở phần ghi chú)\"]')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('report_error_allowed_roles', 'sale,admin,assistant')");

        // AI fields
        $chkColStatus = $conn->query("SHOW COLUMNS FROM leads LIKE 'status'");
        if ($chkColStatus && $chkColStatus->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN status VARCHAR(50) DEFAULT 'active'");
        }
        $chkColTR = $conn->query("SHOW COLUMNS FROM leads LIKE 'target_round_id'");
        if ($chkColTR && $chkColTR->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN target_round_id INT NULL");
        }
        $chkColAIS = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_screener_status'");
        if ($chkColAIS && $chkColAIS->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN ai_screener_status VARCHAR(50) DEFAULT 'not_screened'");
        }
        $chkColAIE = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_evaluation'");
        if ($chkColAIE && $chkColAIE->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN ai_evaluation TEXT NULL");
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
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_mode', 'ai')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_manual_rules', '[]')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_screener_manual_action', 'hold')");

        $chkIdxSyncQueue = $conn->query("SHOW INDEX FROM sync_queue WHERE Key_name='idx_status_retry'");
        if ($chkIdxSyncQueue && $chkIdxSyncQueue->num_rows === 0) {
            $conn->query("ALTER TABLE sync_queue ADD INDEX `idx_status_retry` (`status`, `next_retry_at`)");
        }

        // Notification flags
        $chkColZNS = $conn->query("SHOW COLUMNS FROM leads LIKE 'zalo_notify_status'");
        if ($chkColZNS && $chkColZNS->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN zalo_notify_status VARCHAR(50) DEFAULT 'none'");
        }
        $chkColENS = $conn->query("SHOW COLUMNS FROM leads LIKE 'email_notify_status'");
        if ($chkColENS && $chkColENS->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN email_notify_status VARCHAR(50) DEFAULT 'none'");
        }

        // lead_id in queues
        $chkColMQ = $conn->query("SHOW COLUMNS FROM mail_queue LIKE 'lead_id'");
        if ($chkColMQ && $chkColMQ->num_rows === 0) {
            $conn->query("ALTER TABLE mail_queue ADD COLUMN lead_id INT NULL");
            $conn->query("ALTER TABLE mail_queue ADD INDEX idx_lead_id (lead_id)");
        }
        $chkColZQ = $conn->query("SHOW COLUMNS FROM zalo_queue LIKE 'lead_id'");
        if ($chkColZQ && $chkColZQ->num_rows === 0) {
            $conn->query("ALTER TABLE zalo_queue ADD COLUMN lead_id INT NULL");
            $conn->query("ALTER TABLE zalo_queue ADD INDEX idx_lead_id (lead_id)");
        }

        // Set DB version to 130
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '130') ON DUPLICATE KEY UPDATE setting_value = '130'");
        $currentVersion = 130;
        $logMsg("Đã áp dụng các cấu trúc cơ sở v121-v130 thành công.", "success");
    }

    // --------------------------------------------------
    // Step 2: Version 131 (Backfill notify status)
    // --------------------------------------------------
    if ($currentVersion < 131) {
        $logMsg("Đang chạy cập nhật phiên bản 131...", "info");
        $conn->query("UPDATE leads SET zalo_notify_status = 'sent' WHERE assigned_to IS NOT NULL AND assigned_to > 0 AND zalo_notify_status = 'none'");
        $conn->query("UPDATE leads SET email_notify_status = 'sent' WHERE assigned_to IS NOT NULL AND assigned_to > 0 AND email_notify_status = 'none'");
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '131') ON DUPLICATE KEY UPDATE setting_value = '131'");
        $currentVersion = 131;
        $logMsg("Hoàn thành cập nhật phiên bản 131.", "success");
    }

    // --------------------------------------------------
    // Step 3: Version 132 (Add notify sent timestamps and backfill)
    // --------------------------------------------------
    if ($currentVersion < 132) {
        $logMsg("Đang chạy cập nhật phiên bản 132...", "info");
        
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
        $currentVersion = 132;
        $logMsg("Hoàn thành cập nhật phiên bản 132.", "success");
    }

    // --------------------------------------------------
    // Step 4: Version 133 (Add is_rolled_back to admin_logs)
    // --------------------------------------------------
    if ($currentVersion < 133) {
        $logMsg("Đang chạy cập nhật phiên bản 133...", "info");
        
        $chkColRolledBack = $conn->query("SHOW COLUMNS FROM admin_logs LIKE 'is_rolled_back'");
        if ($chkColRolledBack && $chkColRolledBack->num_rows === 0) {
            $conn->query("ALTER TABLE admin_logs ADD COLUMN is_rolled_back TINYINT(1) DEFAULT 0 COMMENT 'Đánh dấu log đã được hoàn tác'");
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '133') ON DUPLICATE KEY UPDATE setting_value = '133'");
        $currentVersion = 133;
        $logMsg("Hoàn thành cập nhật phiên bản 133.", "success");
    }

    // --------------------------------------------------
    // Step 5: Version 134 (Add AI Gemini Token columns to leads)
    // --------------------------------------------------
    if ($currentVersion < 134) {
        $logMsg("Đang chạy cập nhật phiên bản 134...", "info");
        
        $chkColPromptT = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_prompt_tokens'");
        if ($chkColPromptT && $chkColPromptT->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN ai_prompt_tokens INT DEFAULT 0 COMMENT 'Số token prompt AI sử dụng'");
        }
        $chkColCompT = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_completion_tokens'");
        if ($chkColCompT && $chkColCompT->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN ai_completion_tokens INT DEFAULT 0 COMMENT 'Số token completion AI sử dụng'");
        }
        $chkColTotalT = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_total_tokens'");
        if ($chkColTotalT && $chkColTotalT->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN ai_total_tokens INT DEFAULT 0 COMMENT 'Tổng số token AI sử dụng'");
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '134') ON DUPLICATE KEY UPDATE setting_value = '134'");
        $currentVersion = 134;
        $logMsg("Hoàn thành cập nhật phiên bản 134.", "success");
    }

    // --------------------------------------------------
    // Step 6: Version 135 (Create communication_logs and backfill)
    // --------------------------------------------------
    if ($currentVersion < 135) {
        $logMsg("Đang chạy cập nhật phiên bản 135 (Tạo bảng communication_logs và backfill dữ liệu lịch sử)...", "info");
        
        // 1. Create table
        $conn->query("CREATE TABLE IF NOT EXISTS communication_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            lead_id INT NULL,
            type ENUM('zalo', 'email') NOT NULL,
            recipient VARCHAR(255) NOT NULL,
            status ENUM('sent', 'failed') NOT NULL,
            error_message TEXT NULL,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_type_sent (type, sent_at),
            INDEX idx_lead_id (lead_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $logMsg("Đã tạo bảng communication_logs.", "success");

        // 2. Backfill from zalo_queue
        $logMsg("Đang backfill dữ liệu từ zalo_queue...", "info");
        $conn->query("INSERT IGNORE INTO communication_logs (lead_id, type, recipient, status, error_message, sent_at)
            SELECT lead_id, 'zalo', chat_id, status, last_error, COALESCE(sent_at, created_at)
            FROM zalo_queue
            WHERE status IN ('sent', 'failed')");
        $logMsg("Đã hoàn tất backfill từ zalo_queue.", "success");

        // 3. Backfill from mail_queue
        $logMsg("Đang backfill dữ liệu từ mail_queue...", "info");
        $conn->query("INSERT IGNORE INTO communication_logs (lead_id, type, recipient, status, error_message, sent_at)
            SELECT lead_id, 'email', to_email, status, last_error, COALESCE(sent_at, created_at)
            FROM mail_queue
            WHERE status IN ('sent', 'failed')");
        $logMsg("Đã hoàn tất backfill từ mail_queue.", "success");

        // Update version to 135
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '135') ON DUPLICATE KEY UPDATE setting_value = '135'");
        $currentVersion = 135;
        $logMsg("Hoàn thành cập nhật phiên bản 135.", "success");
    }

    // --------------------------------------------------
    // Step 7: Version 136 (Clean up bloated communication logs by reconstructing cleanly from queues)
    // --------------------------------------------------
    if ($currentVersion < 136) {
        $logMsg("Đang chạy dọn dẹp bản ghi giao tiếp dư thừa (phiên bản 136)...", "info");
        
        $conn->query("TRUNCATE TABLE communication_logs");
        $logMsg("Đã làm trống bảng communication_logs.", "info");
        
        $conn->query("INSERT IGNORE INTO communication_logs (lead_id, type, recipient, status, error_message, sent_at)
            SELECT lead_id, 'zalo', chat_id, status, last_error, COALESCE(sent_at, created_at)
            FROM zalo_queue
            WHERE status IN ('sent', 'failed')");
        $logMsg("Đã tái cấu trúc dữ liệu Zalo Bot từ hàng đợi.", "success");

        $conn->query("INSERT IGNORE INTO communication_logs (lead_id, type, recipient, status, error_message, sent_at)
            SELECT lead_id, 'email', to_email, status, last_error, COALESCE(sent_at, created_at)
            FROM mail_queue
            WHERE status IN ('sent', 'failed')");
        $logMsg("Đã tái cấu trúc dữ liệu Email gửi đi từ hàng đợi.", "success");
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '136') ON DUPLICATE KEY UPDATE setting_value = '136'");
        $currentVersion = 136;
        $logMsg("Hoàn thành dọn dẹp và làm sạch toàn bộ nhật ký giao tiếp.", "success");
    }

    // --------------------------------------------------
    // Step 8: Version 137 (Reconstruct communication logs including direct cURL sends from log file)
    // --------------------------------------------------
    if ($currentVersion < 137) {
        $logMsg("Đang chạy cập nhật phiên bản 137 (Tái tạo nhật ký giao tiếp bao gồm tin nhắn Zalo trực tiếp)...", "info");
        
        // 1. Truncate table to clean up
        $conn->query("TRUNCATE TABLE communication_logs");
        $logMsg("Đã làm trống bảng communication_logs.", "info");
        
        // 2. Re-insert from zalo_queue
        $conn->query("INSERT IGNORE INTO communication_logs (lead_id, type, recipient, status, error_message, sent_at)
            SELECT lead_id, 'zalo', chat_id, status, last_error, COALESCE(sent_at, created_at)
            FROM zalo_queue
            WHERE status IN ('sent', 'failed')");
        $logMsg("Đã đồng bộ tin nhắn Zalo từ hàng đợi.", "success");

        // 3. Re-insert from mail_queue
        $conn->query("INSERT IGNORE INTO communication_logs (lead_id, type, recipient, status, error_message, sent_at)
            SELECT lead_id, 'email', to_email, status, last_error, COALESCE(sent_at, created_at)
            FROM mail_queue
            WHERE status IN ('sent', 'failed')");
        $logMsg("Đã đồng bộ Email từ hàng đợi.", "success");

        // 4. Parse zalo_send_log.txt and insert direct messages (deduplicated)
        $zaloLogFile = __DIR__ . '/zalo_send_log.txt';
        if (file_exists($zaloLogFile)) {
            $logMsg("Đang quét file log Zalo direct: zalo_send_log.txt...", "info");
            $handle = fopen($zaloLogFile, 'r');
            if ($handle) {
                $stmtCheck = $conn->prepare("SELECT id FROM communication_logs WHERE type = 'zalo' AND recipient = ? AND ABS(TIMESTAMPDIFF(SECOND, sent_at, ?)) <= 180 LIMIT 1");
                $stmtDirect = $conn->prepare("INSERT IGNORE INTO communication_logs (lead_id, type, recipient, status, error_message, sent_at) VALUES (NULL, 'zalo', ?, ?, ?, ?)");
                
                $insertedDirectCount = 0;
                while (($line = fgets($handle)) !== false) {
                    if (empty(trim($line))) continue;
                    
                    if (preg_match('/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+Target\s+ChatId:\s*([^,]+),\s*HTTP:\s*(\d+)/i', $line, $matches)) {
                        $time = $matches[1];
                        $chatId = trim($matches[2]);
                        $httpCode = (int)$matches[3];
                        
                        $isDup = false;
                        if ($stmtCheck) {
                            $stmtCheck->bind_param("ss", $chatId, $time);
                            $stmtCheck->execute();
                            $stmtCheck->store_result();
                            if ($stmtCheck->num_rows > 0) {
                                $isDup = true;
                            }
                            $stmtCheck->free_result();
                        }
                        
                        if ($isDup) {
                            continue;
                        }
                        
                        $status = ($httpCode >= 200 && $httpCode < 300) ? 'sent' : 'failed';
                        $errMsg = null;
                        if ($status === 'failed') {
                            $respStart = strpos($line, 'Response: ');
                            if ($respStart !== false) {
                                $errMsg = substr($line, $respStart + 10);
                            } else {
                                $errMsg = "HTTP Code: " . $httpCode;
                            }
                        }
                        
                        if ($stmtDirect) {
                            $stmtDirect->bind_param("ssss", $chatId, $status, $errMsg, $time);
                            $stmtDirect->execute();
                            $insertedDirectCount++;
                        }
                    }
                }
                if ($stmtCheck) $stmtCheck->close();
                if ($stmtDirect) $stmtDirect->close();
                fclose($handle);
                $logMsg("Đã đồng bộ thành công $insertedDirectCount tin nhắn Zalo trực tiếp từ file log.", "success");
            }
        } else {
            $logMsg("Không tìm thấy file log zalo_send_log.txt để đồng bộ tin trực tiếp.", "info");
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '137') ON DUPLICATE KEY UPDATE setting_value = '137'");
        $currentVersion = 137;
        $logMsg("Hoàn thành cập nhật phiên bản 137.", "success");
    }

    // --------------------------------------------------
    // Step 9: Version 138 (Add sync_error_count column to sheet_connections)
    // --------------------------------------------------
    if ($currentVersion < 138) {
        $logMsg("Đang chạy cập nhật phiên bản 138 (Thêm cột sync_error_count vào sheet_connections)...", "info");
        
        $chkColSEC = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'sync_error_count'");
        if ($chkColSEC && $chkColSEC->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN sync_error_count INT DEFAULT 0 COMMENT 'Số lần lỗi đồng bộ liên tiếp'");
            $logMsg("Đã thêm cột sync_error_count vào sheet_connections.", "success");
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '138') ON DUPLICATE KEY UPDATE setting_value = '138'");
        $currentVersion = 138;
        $logMsg("Hoàn thành cập nhật phiên bản 138.", "success");
    }

    // --------------------------------------------------
    // Step 10: Version 139 (Add index on consultants name column)
    // --------------------------------------------------
    if ($currentVersion < 139) {
        $logMsg("Đang chạy cập nhật phiên bản 139 (Thêm INDEX idx_name vào consultants)...", "info");
        
        $chkIdxName = $conn->query("SHOW INDEX FROM consultants WHERE Key_name='idx_name'");
        if ($chkIdxName && $chkIdxName->num_rows === 0) {
            $conn->query("ALTER TABLE consultants ADD INDEX `idx_name` (`name`)");
            $logMsg("Đã thêm INDEX idx_name vào consultants.", "success");
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '139') ON DUPLICATE KEY UPDATE setting_value = '139'");
        $currentVersion = 139;
        $logMsg("Hoàn thành cập nhật phiên bản 139.", "success");
    }

    // --------------------------------------------------
    // Step 11: Version 140 (Add ai_screening_started_at to leads, add 'processing' to mail_queue/zalo_queue enums, add updated_at)
    // --------------------------------------------------
    if ($currentVersion < 140) {
        $logMsg("Đang chạy cập nhật phiên bản 140 (Tối ưu hóa khóa concurrency và trạng thái queue)...", "info");
        
        // 1. Column ai_screening_started_at in leads
        $chkColASSA = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_screening_started_at'");
        if ($chkColASSA && $chkColASSA->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN ai_screening_started_at DATETIME NULL COMMENT 'Thời điểm bắt đầu gọi AI'");
            $logMsg("Đã thêm cột ai_screening_started_at vào leads.", "success");
        }
        
        // 2. Modify mail_queue status & add updated_at
        $conn->query("ALTER TABLE mail_queue MODIFY COLUMN status ENUM('pending','processing','sent','failed') DEFAULT 'pending'");
        $logMsg("Đã cập nhật ENUM status của mail_queue.", "success");
        
        $chkColMailUA = $conn->query("SHOW COLUMNS FROM mail_queue LIKE 'updated_at'");
        if ($chkColMailUA && $chkColMailUA->num_rows === 0) {
            $conn->query("ALTER TABLE mail_queue ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            $logMsg("Đã thêm cột updated_at vào mail_queue.", "success");
        }
        
        // 3. Modify zalo_queue status & add updated_at
        $conn->query("ALTER TABLE zalo_queue MODIFY COLUMN status ENUM('pending','processing','sent','failed') DEFAULT 'pending'");
        $logMsg("Đã cập nhật ENUM status của zalo_queue.", "success");
        
        $chkColZaloUA = $conn->query("SHOW COLUMNS FROM zalo_queue LIKE 'updated_at'");
        if ($chkColZaloUA && $chkColZaloUA->num_rows === 0) {
            $conn->query("ALTER TABLE zalo_queue ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            $logMsg("Đã thêm cột updated_at vào zalo_queue.", "success");
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '140') ON DUPLICATE KEY UPDATE setting_value = '140'");
        $currentVersion = 140;
        $logMsg("Hoàn thành cập nhật phiên bản 140.", "success");
    }

    // --------------------------------------------------
    // Step 12: Version 141 (Add idx_leads_source index on leads table for performance optimization)
    // --------------------------------------------------
    if ($currentVersion < 141) {
        $logMsg("Đang chạy cập nhật phiên bản 141 (Thêm chỉ mục index cho trường source trong bảng leads)...", "info");
        
        $chkIdxSource = $conn->query("SHOW INDEX FROM leads WHERE Key_name='idx_leads_source'");
        if ($chkIdxSource && $chkIdxSource->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD INDEX `idx_leads_source` (`source`)");
            $logMsg("Đã thêm chỉ mục idx_leads_source vào bảng leads.", "success");
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '141') ON DUPLICATE KEY UPDATE setting_value = '141'");
        $currentVersion = 141;
        $logMsg("Hoàn thành cập nhật phiên bản 141.", "success");
    }

    // --------------------------------------------------
    // Step 13: Version 142 (Add notify_admin column to sheet_connections table)
    // --------------------------------------------------
    if ($currentVersion < 142) {
        $logMsg("Đang chạy cập nhật phiên bản 142 (Thêm cột notify_admin vào sheet_connections)...", "info");
        
        $chkColNotify = $conn->query("SHOW COLUMNS FROM sheet_connections LIKE 'notify_admin'");
        if ($chkColNotify && $chkColNotify->num_rows === 0) {
            $conn->query("ALTER TABLE sheet_connections ADD COLUMN notify_admin TINYINT(1) DEFAULT 1 COMMENT 'Thông báo cho Admin khi có Data mới'");
            $logMsg("Đã thêm cột notify_admin vào sheet_connections.", "success");
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '142') ON DUPLICATE KEY UPDATE setting_value = '142'");
        $currentVersion = 142;
        $logMsg("Hoàn thành cập nhật phiên bản 142.", "success");
    }

    // --------------------------------------------------
    // Step 14: Version 143 (Set default of notify_admin to 0, update existing sheet connections: landing page to 1, sheets to 0)
    // --------------------------------------------------
    if ($currentVersion < 143) {
        $logMsg("Đang chạy cập nhật phiên bản 143 (Cập nhật mặc định notify_admin: landing page bật, sheets tắt)...", "info");
        
        // Alter column default to 0
        $conn->query("ALTER TABLE sheet_connections MODIFY COLUMN notify_admin TINYINT(1) DEFAULT 0 COMMENT 'Thông báo cho Admin khi có Data mới'");
        $logMsg("Đã thay đổi mặc định notify_admin thành 0.", "success");
        
        // Update existing values
        $conn->query("UPDATE sheet_connections SET notify_admin = 1 WHERE connection_type = 'landing_page'");
        $conn->query("UPDATE sheet_connections SET notify_admin = 0 WHERE connection_type != 'landing_page' OR connection_type IS NULL");
        $logMsg("Đã cập nhật các giá trị notify_admin hiện tại (Landing Page = 1, các loại khác = 0).", "success");
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '143') ON DUPLICATE KEY UPDATE setting_value = '143'");
        $currentVersion = 143;
        $logMsg("Hoàn thành cập nhật phiên bản 143.", "success");
    }

    // --------------------------------------------------
    // Step 15: Version 144 (Add monthly report configuration settings)
    // --------------------------------------------------
    if ($currentVersion < 144) {
        $logMsg("Đang chạy cập nhật phiên bản 144 (Thêm cấu hình gửi báo cáo tháng cho Sale)...", "info");
        
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('zalo_monthly_report_enabled', '0')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('zalo_monthly_report_time', '08:00')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('last_monthly_report_date', '')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('last_monthly_report_timestamp', '')");
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '144') ON DUPLICATE KEY UPDATE setting_value = '144'");
        $currentVersion = 144;
        $logMsg("Hoàn thành cập nhật phiên bản 144.", "success");
    }

    // --------------------------------------------------
    // Step 16: Version 145 (Optimize admin_logs performance with VIRTUAL generated column log_type and idx_action_log_type_created index)
    // --------------------------------------------------
    if ($currentVersion < 145) {
        $logMsg("Đang chạy cập nhật phiên bản 145 (Tối ưu hóa hiệu năng admin_logs)...", "info");
        
        $chkColLogType = $conn->query("SHOW COLUMNS FROM admin_logs LIKE 'log_type'");
        if ($chkColLogType && $chkColLogType->num_rows === 0) {
            $conn->query("ALTER TABLE admin_logs ADD COLUMN log_type VARCHAR(50) GENERATED ALWAYS AS (JSON_VALUE(details, '$.type')) VIRTUAL");
            $logMsg("Đã thêm cột ảo log_type vào admin_logs.", "success");
        }
        
        $chkIdxLogType = $conn->query("SHOW INDEX FROM admin_logs WHERE Key_name='idx_action_log_type_created'");
        if ($chkIdxLogType && $chkIdxLogType->num_rows === 0) {
            $conn->query("ALTER TABLE admin_logs ADD INDEX `idx_action_log_type_created` (`action`, `log_type`, `created_at`)");
            $logMsg("Đã thêm INDEX idx_action_log_type_created vào admin_logs.", "success");
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '145') ON DUPLICATE KEY UPDATE setting_value = '145'");
        $currentVersion = 145;
        $logMsg("Hoàn thành cập nhật phiên bản 145.", "success");
    }

    // --------------------------------------------------
    // Step 17: Version 146 (Migrate historical rejected & blacklisted distribution logs to match lead creation date)
    // --------------------------------------------------
    if ($currentVersion < 146) {
        $logMsg("Đang chạy cập nhật phiên bản 146 (Đồng bộ thời gian log phân bổ cũ bị từ chối/blacklist với ngày tạo Lead)...", "info");
        
        $updateQuery = "UPDATE distribution_logs dl
                        JOIN leads l ON dl.lead_id = l.id
                        SET dl.received_at = l.created_at
                        WHERE dl.status IN ('rejected', 'blacklisted') AND dl.received_at > l.created_at";
        
        if ($conn->query($updateQuery)) {
            $affectedRows = $conn->affected_rows;
            $logMsg("Đã cập nhật ngày nhận của $affectedRows dòng log phân bổ (rejected/blacklisted) cũ về ngày tạo Lead.", "success");
        } else {
            throw new Exception("Lỗi khi chạy query cập nhật distribution_logs: " . $conn->error);
        }

        // Đồng bộ thời gian gửi và thời gian duyệt/từ chối ticket cũ trong data_reports về ngày tạo Lead gốc (từ Sheets)
        $updateTicketQuery = "UPDATE data_reports dr
                              JOIN leads l ON dr.lead_id = l.id
                              SET dr.created_at = l.created_at,
                                  dr.resolved_at = l.created_at
                              WHERE dr.status IN ('approved', 'rejected') 
                                AND (dr.created_at > l.created_at OR dr.resolved_at > l.created_at)";

        if ($conn->query($updateTicketQuery)) {
            $affectedTickets = $conn->affected_rows;
            $logMsg("Đã cập nhật ngày gửi và ngày duyệt của $affectedTickets ticket (approved/rejected) cũ về ngày tạo Lead gốc.", "success");
        } else {
            throw new Exception("Lỗi khi chạy query cập nhật data_reports: " . $conn->error);
        }
        
        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '146') ON DUPLICATE KEY UPDATE setting_value = '146'");
        $currentVersion = 146;
        $logMsg("Hoàn thành cập nhật phiên bản 146.", "success");
    }

    // --------------------------------------------------
    // Step 18: Version 147 (Create teams table and add team_id column to consultants / users)
    // --------------------------------------------------
    if ($currentVersion < 147) {
        $logMsg("Đang chạy cập nhật phiên bản 147 (Khởi tạo bảng quản lý Team hierarchy)...", "info");

        // 1. Create teams table
        $conn->query("CREATE TABLE IF NOT EXISTS `teams` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `name` varchar(255) NOT NULL,
            `branch` varchar(255) DEFAULT NULL,
            `leader_id` int(11) DEFAULT NULL,
            `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
            `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $logMsg("Đã tạo hoặc kiểm tra bảng teams.", "success");

        // 2. Add team_id to consultants
        $chkColTeamCon = $conn->query("SHOW COLUMNS FROM consultants LIKE 'team_id'");
        if ($chkColTeamCon && $chkColTeamCon->num_rows === 0) {
            $conn->query("ALTER TABLE consultants ADD COLUMN team_id int(11) DEFAULT NULL");
            $logMsg("Đã thêm cột team_id vào bảng consultants.", "success");
        }

        // 3. Add team_id to users (if exists in unified schema)
        $chkTableUsers = $conn->query("SHOW TABLES LIKE 'users'");
        if ($chkTableUsers && $chkTableUsers->num_rows > 0) {
            $chkColTeamUsers = $conn->query("SHOW COLUMNS FROM users LIKE 'team_id'");
            if ($chkColTeamUsers && $chkColTeamUsers->num_rows === 0) {
                $conn->query("ALTER TABLE users ADD COLUMN team_id int(11) DEFAULT NULL");
                $logMsg("Đã thêm cột team_id vào bảng users.", "success");
            }
        }

        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '147') ON DUPLICATE KEY UPDATE setting_value = '147'");
        $currentVersion = 147;
        $logMsg("Hoàn thành cập nhật phiên bản 147.", "success");
    }

    // Step 19: Version 148 (Insert business settings and thresholds)
    // --------------------------------------------------
    if ($currentVersion < 148) {
        $logMsg("Đang chạy cập nhật phiên bản 148 (Khởi tạo tham số cấu hình thời gian và nghiệp vụ)...", "info");

        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('temperature_decay_days', '5')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('lead_response_timeout_minutes', '2')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('uncontacted_lead_share_hours', '3')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('night_shift_start_time', '18:00')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('night_shift_end_time', '06:00')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('golden_hours_start_time', '06:00')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('golden_hours_end_time', '08:30')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_limit_per_day', '2')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_limit_per_hour', '3')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_limit_per_month', '300')");

        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '148') ON DUPLICATE KEY UPDATE setting_value = '148'");
        $currentVersion = 148;
        $logMsg("Hoàn thành cập nhật phiên bản 148.", "success");
    }

    // --------------------------------------------------
    if ($currentVersion < 149) {
        $logMsg("Đang chạy cập nhật phiên bản 149 (Chuyển đổi cột pipeline_status từ ENUM sang VARCHAR để hỗ trợ cấu hình động)...", "info");

        // Alter table contacts modifying pipeline_status to VARCHAR(50)
        $conn->query("ALTER TABLE contacts MODIFY COLUMN pipeline_status VARCHAR(50) NOT NULL DEFAULT 'chua_xac_dinh'");

        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '149') ON DUPLICATE KEY UPDATE setting_value = '149'");
        $currentVersion = 149;
        $logMsg("Hoàn thành cập nhật phiên bản 149.", "success");
    }

    // --------------------------------------------------
    if ($currentVersion < 150) {
        $logMsg("Đang chạy cập nhật phiên bản 150 (Tạo bảng check_ins và cấu hình van chống ôm)...", "info");

        // 1. Create check_ins table
        $conn->query("
            CREATE TABLE IF NOT EXISTS `check_ins` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `user_id` int(11) NOT NULL,
              `check_in_date` date NOT NULL,
              `check_in_time` time NOT NULL,
              `selfie_url` varchar(255) DEFAULT NULL,
              `status` enum('approved', 'pending_approval', 'rejected') NOT NULL DEFAULT 'approved',
              `reason` varchar(255) DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `user_date` (`user_id`, `check_in_date`),
              FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // 2. Insert backpressure_limit configuration
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('backpressure_limit', '5')");

        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '150') ON DUPLICATE KEY UPDATE setting_value = '150'");
        $currentVersion = 150;
        $logMsg("Hoàn thành cập nhật phiên bản 150.", "success");
    }

    // --------------------------------------------------
    if ($currentVersion < 151) {
        $logMsg("Đang chạy cập nhật phiên bản 151 (Bổ sung cột ai_attempts bị thiếu trong bảng leads)...", "info");

        $chkColAiAtt = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_attempts'");
        if ($chkColAiAtt && $chkColAiAtt->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN ai_attempts INT DEFAULT 0 AFTER ai_evaluation");
            $logMsg("Đã bổ sung cột ai_attempts vào bảng leads.", "info");
        }

        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '151') ON DUPLICATE KEY UPDATE setting_value = '151'");
        $currentVersion = 151;
        $logMsg("Hoàn thành cập nhật phiên bản 151.", "success");
    }

    // Self-healing database check (to repair databases where db_version was manually set but tables/columns were skipped)
    $logMsg("Bắt đầu tự sửa đổi cấu trúc (Self-healing check)...", "info");

    // 1. teams table
    $conn->query("CREATE TABLE IF NOT EXISTS `teams` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        `branch` varchar(255) DEFAULT NULL,
        `leader_id` int(11) DEFAULT NULL,
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // 1b. Add extra fields to teams table for advanced settings
    $chkColTeamsDesc = $conn->query("SHOW COLUMNS FROM teams LIKE 'description'");
    if ($chkColTeamsDesc && $chkColTeamsDesc->num_rows === 0) {
        $conn->query("ALTER TABLE teams ADD COLUMN description TEXT NULL");
    }
    $chkColTeamsKpi = $conn->query("SHOW COLUMNS FROM teams LIKE 'kpi_target'");
    if ($chkColTeamsKpi && $chkColTeamsKpi->num_rows === 0) {
        $conn->query("ALTER TABLE teams ADD COLUMN kpi_target DECIMAL(15,2) DEFAULT NULL");
    }
    $chkColTeamsMax = $conn->query("SHOW COLUMNS FROM teams LIKE 'max_members'");
    if ($chkColTeamsMax && $chkColTeamsMax->num_rows === 0) {
        $conn->query("ALTER TABLE teams ADD COLUMN max_members INT DEFAULT NULL");
    }
    $chkColTeamsWeight = $conn->query("SHOW COLUMNS FROM teams LIKE 'priority_weight'");
    if ($chkColTeamsWeight && $chkColTeamsWeight->num_rows === 0) {
        $conn->query("ALTER TABLE teams ADD COLUMN priority_weight INT DEFAULT 1");
    }
    $chkColTeamsProject = $conn->query("SHOW COLUMNS FROM teams LIKE 'focus_project'");
    if ($chkColTeamsProject && $chkColTeamsProject->num_rows === 0) {
        $conn->query("ALTER TABLE teams ADD COLUMN focus_project VARCHAR(255) DEFAULT NULL");
    }

    // 2. team_id in consultants
    $chkCol = $conn->query("SHOW COLUMNS FROM consultants LIKE 'team_id'");
    if ($chkCol && $chkCol->num_rows === 0) {
        $conn->query("ALTER TABLE consultants ADD COLUMN team_id int(11) DEFAULT NULL");
        $logMsg("Đã thêm team_id cho consultants", "success");
    }

    // 3. team_id in users
    $chkCol = $conn->query("SHOW COLUMNS FROM users LIKE 'team_id'");
    if ($chkCol && $chkCol->num_rows === 0) {
        $conn->query("ALTER TABLE users ADD COLUMN team_id int(11) DEFAULT NULL");
        $logMsg("Đã thêm team_id cho users", "success");
    }

    // 3b. image_url in expenses
    $chkCol = $conn->query("SHOW COLUMNS FROM expenses LIKE 'image_url'");
    if ($chkCol && $chkCol->num_rows === 0) {
        $conn->query("ALTER TABLE expenses ADD COLUMN image_url varchar(500) DEFAULT NULL");
        $logMsg("Đã thêm image_url cho expenses", "success");
    }

    // 3c. default lost stage in pipeline_stages
    $tenantsRes = $conn->query("SELECT id FROM tenants");
    if ($tenantsRes) {
        while ($tRow = $tenantsRes->fetch_assoc()) {
            $tid = (int)$tRow['id'];
            $chkLost = $conn->query("SELECT id FROM pipeline_stages WHERE tenant_id={$tid} AND is_lost=1");
            if ($chkLost && $chkLost->num_rows === 0) {
                $oRes = $conn->query("SELECT MAX(order_index) FROM pipeline_stages WHERE tenant_id={$tid}");
                $maxIdx = $oRes ? (int)$oRes->fetch_row()[0] + 1 : 7;
                $conn->query("INSERT INTO pipeline_stages (tenant_id, name, color, order_index, is_won, is_lost) VALUES ({$tid}, 'Thất bại/Từ chối', '#ef4444', {$maxIdx}, 0, 1)");
                $logMsg("Đã tạo giai đoạn Thất bại/Từ chối cho tenant {$tid}", "success");
            }
        }
    }

    // 4. check_ins table
    $conn->query("
        CREATE TABLE IF NOT EXISTS `check_ins` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `user_id` int(11) NOT NULL,
          `check_in_date` date NOT NULL,
          `check_in_time` time NOT NULL,
          `selfie_url` varchar(255) DEFAULT NULL,
          `status` enum('approved', 'pending_approval', 'rejected') NOT NULL DEFAULT 'approved',
          `reason` varchar(255) DEFAULT NULL,
          PRIMARY KEY (`id`),
          UNIQUE KEY `user_date` (`user_id`, `check_in_date`),
          FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 5. ai_attempts in leads
    $chkCol = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_attempts'");
    if ($chkCol && $chkCol->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN ai_attempts INT DEFAULT 0 AFTER ai_evaluation");
        $logMsg("Đã thêm ai_attempts cho leads", "success");
    }

    // 5b. projects, project_roster, project_documents tables (Module 6)
    $conn->query("CREATE TABLE IF NOT EXISTS `projects` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `tenant_id` int(11) NOT NULL DEFAULT 1,
      `name` varchar(255) NOT NULL,
      `code` varchar(100) NOT NULL UNIQUE,
      `description` text DEFAULT NULL,
      `status` enum('active','completed','draft') DEFAULT 'active',
      `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
      `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    $chkLoc = $conn->query("SHOW COLUMNS FROM projects LIKE 'location'");
    if ($chkLoc && $chkLoc->num_rows === 0) {
        $conn->query("ALTER TABLE projects ADD COLUMN location VARCHAR(255) NULL AFTER description");
        $logMsg("Đã thêm location cho projects", "success");
    }
    $chkDev = $conn->query("SHOW COLUMNS FROM projects LIKE 'developer'");
    if ($chkDev && $chkDev->num_rows === 0) {
        $conn->query("ALTER TABLE projects ADD COLUMN developer VARCHAR(255) NULL AFTER location");
        $logMsg("Đã thêm developer cho projects", "success");
    }

    $conn->query("CREATE TABLE IF NOT EXISTS `project_roster` (
      `project_id` int(11) NOT NULL,
      `user_id` int(11) NOT NULL,
      `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (`project_id`, `user_id`),
      FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
      FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    $conn->query("CREATE TABLE IF NOT EXISTS `project_documents` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `project_id` int(11) NOT NULL,
      `name` varchar(255) NOT NULL,
      `file_path` varchar(500) NOT NULL,
      `file_size` bigint(20) DEFAULT 0,
      `mime_type` varchar(100) DEFAULT NULL,
      `uploaded_by` int(11) NOT NULL,
      `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (`id`),
      FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
      FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    $logMsg("Đã tạo hoặc kiểm tra cấu trúc bảng projects/roster/documents", "success");

    // 6. Default Settings
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('checkin_approval_sla_minutes', '15')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('broadcast_exclusion_rules', 'not_lead,opt_out,active_khtn')");
    $chkSlaNotif = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'sla_notified_at'");
    if ($chkSlaNotif && $chkSlaNotif->num_rows === 0) {
        $conn->query("ALTER TABLE check_ins ADD COLUMN sla_notified_at DATETIME DEFAULT NULL");
        $logMsg("Đã thêm cột sla_notified_at cho check_ins", "success");
    }
    $chkActTags = $conn->query("SHOW COLUMNS FROM activities LIKE 'tags'");
    if ($chkActTags && $chkActTags->num_rows === 0) {
        $conn->query("ALTER TABLE activities ADD COLUMN tags VARCHAR(255) NULL DEFAULT NULL AFTER related_id");
        $logMsg("Đã thêm cột tags cho activities", "success");
    }
    $chkActParticipants = $conn->query("SHOW COLUMNS FROM activities LIKE 'participant_ids'");
    if ($chkActParticipants && $chkActParticipants->num_rows === 0) {
        $conn->query("ALTER TABLE activities ADD COLUMN participant_ids VARCHAR(255) NULL DEFAULT NULL AFTER tags");
        $logMsg("Đã thêm cột participant_ids cho activities", "success");
    }
    $chkActProgress = $conn->query("SHOW COLUMNS FROM activities LIKE 'progress'");
    if ($chkActProgress && $chkActProgress->num_rows === 0) {
        $conn->query("ALTER TABLE activities ADD COLUMN progress INT(11) NOT NULL DEFAULT 0 AFTER participant_ids");
        $logMsg("Đã thêm cột progress cho activities", "success");
    }
    $chkActReqApproval = $conn->query("SHOW COLUMNS FROM activities LIKE 'require_approval'");
    if ($chkActReqApproval && $chkActReqApproval->num_rows === 0) {
        $conn->query("ALTER TABLE activities ADD COLUMN require_approval TINYINT(1) NOT NULL DEFAULT 0 AFTER progress");
        $logMsg("Đã thêm cột require_approval cho activities", "success");
    }
    $chkActApprover = $conn->query("SHOW COLUMNS FROM activities LIKE 'approver_id'");
    if ($chkActApprover && $chkActApprover->num_rows === 0) {
        $conn->query("ALTER TABLE activities ADD COLUMN approver_id INT(11) NULL DEFAULT NULL AFTER require_approval");
        $logMsg("Đã thêm cột approver_id cho activities", "success");
    }
    $chkActApprovalStatus = $conn->query("SHOW COLUMNS FROM activities LIKE 'approval_status'");
    if ($chkActApprovalStatus && $chkActApprovalStatus->num_rows === 0) {
        $conn->query("ALTER TABLE activities ADD COLUMN approval_status VARCHAR(50) NULL DEFAULT NULL AFTER approver_id");
        $logMsg("Đã thêm cột approval_status cho activities", "success");
    }
    $chkActLink = $conn->query("SHOW COLUMNS FROM activities LIKE 'link'");
    if ($chkActLink && $chkActLink->num_rows === 0) {
        $conn->query("ALTER TABLE activities ADD COLUMN link VARCHAR(255) NULL DEFAULT NULL AFTER approval_status");
        $logMsg("Đã thêm cột link cho activities", "success");
    }
    // Create workflow_task_templates table
    $conn->query("CREATE TABLE IF NOT EXISTS `workflow_task_templates` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `tenant_id` int(11) NOT NULL,
        `stage_id` int(11) NOT NULL,
        `team_id` int(11) DEFAULT NULL,
        `title` varchar(255) NOT NULL,
        `description` text DEFAULT NULL,
        `priority` enum('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
        `due_days_offset` int(11) NOT NULL DEFAULT 1,
        `require_approval` tinyint(4) NOT NULL DEFAULT 0,
        `is_active` tinyint(4) NOT NULL DEFAULT 1,
        `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `tenant_id` (`tenant_id`),
        KEY `stage_id` (`stage_id`),
        KEY `team_id` (`team_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $logMsg("Đã tạo bảng workflow_task_templates thành công", "success");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('temperature_decay_days', '5')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('lead_response_timeout_minutes', '2')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('uncontacted_lead_share_hours', '3')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('night_shift_start_time', '18:00')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('night_shift_end_time', '06:00')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('golden_hours_start_time', '06:00')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('golden_hours_end_time', '08:30')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_limit_per_day', '2')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_limit_per_hour', '3')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_limit_per_month', '300')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('security_timer_chua_xac_dinh', '+3 hours')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('security_timer_quan_tam', '+1 day')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('security_timer_thien_chi', '+3 days')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('security_timer_dong_y_gap', '+4 days')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('security_timer_da_gap', '+5 days')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('security_timer_booking', '+3 months')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_applicable_sources', 'R3_Fb,R3,R2,broadcast')");
    // Databank migrations
    $chkIsPublic = $conn->query("SHOW COLUMNS FROM persons LIKE 'is_public'");
    if ($chkIsPublic && $chkIsPublic->num_rows === 0) {
        $conn->query("ALTER TABLE persons ADD COLUMN is_public TINYINT(1) DEFAULT 0");
        $logMsg("Đã thêm is_public cho persons", "success");
    }
    $chkReleasedAt = $conn->query("SHOW COLUMNS FROM persons LIKE 'released_to_kho_at'");
    if ($chkReleasedAt && $chkReleasedAt->num_rows === 0) {
        $conn->query("ALTER TABLE persons ADD COLUMN released_to_kho_at DATETIME DEFAULT NULL");
        $logMsg("Đã thêm released_to_kho_at cho persons", "success");
    }
    $chkPublicCount = $conn->query("SHOW COLUMNS FROM persons LIKE 'public_count'");
    if ($chkPublicCount && $chkPublicCount->num_rows === 0) {
        $conn->query("ALTER TABLE persons ADD COLUMN public_count INT DEFAULT 0");
        $logMsg("Đã thêm public_count cho persons", "success");
    }
    $chkSecExpires = $conn->query("SHOW COLUMNS FROM contacts LIKE 'security_expires_at'");
    if ($chkSecExpires && $chkSecExpires->num_rows === 0) {
        $conn->query("ALTER TABLE contacts ADD COLUMN security_expires_at DATETIME DEFAULT NULL");
        $logMsg("Đã thêm security_expires_at cho contacts", "success");
    }
    $chkParallelAssigned = $conn->query("SHOW COLUMNS FROM contacts LIKE 'parallel_assigned'");
    if ($chkParallelAssigned && $chkParallelAssigned->num_rows === 0) {
        $conn->query("ALTER TABLE contacts ADD COLUMN parallel_assigned TINYINT(1) DEFAULT 0");
        $logMsg("Đã thêm parallel_assigned cho contacts", "success");
    }

    // Self-healing check: map contacts.owner_id from consultant_id to user_id matching email
    $conn->query("
        UPDATE contacts c
        JOIN consultants cons ON c.owner_id = cons.id
        JOIN users u ON cons.email = u.email
        SET c.owner_id = u.id
    ");

    // Self-healing check: ensure notification columns exist in leads table
    $chkColZNS = $conn->query("SHOW COLUMNS FROM leads LIKE 'zalo_notify_status'");
    if ($chkColZNS && $chkColZNS->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN zalo_notify_status VARCHAR(50) DEFAULT 'none'");
    }
    $chkColENS = $conn->query("SHOW COLUMNS FROM leads LIKE 'email_notify_status'");
    if ($chkColENS && $chkColENS->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN email_notify_status VARCHAR(50) DEFAULT 'none'");
    }
    $chkColZNSA = $conn->query("SHOW COLUMNS FROM leads LIKE 'zalo_notify_sent_at'");
    if ($chkColZNSA && $chkColZNSA->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN zalo_notify_sent_at DATETIME NULL");
    }
    $chkColENSA = $conn->query("SHOW COLUMNS FROM leads LIKE 'email_notify_sent_at'");
    if ($chkColENSA && $chkColENSA->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN email_notify_sent_at DATETIME NULL");
    }
    $chkColASSA = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_screening_started_at'");
    if ($chkColASSA && $chkColASSA->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN ai_screening_started_at DATETIME NULL COMMENT 'Thời điểm bắt đầu gọi AI'");
    }
    $chkColPromptT = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_prompt_tokens'");
    if ($chkColPromptT && $chkColPromptT->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN ai_prompt_tokens INT DEFAULT 0 COMMENT 'Số token prompt AI sử dụng'");
    }
    $chkColCompT = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_completion_tokens'");
    if ($chkColCompT && $chkColCompT->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN ai_completion_tokens INT DEFAULT 0 COMMENT 'Số token completion AI sử dụng'");
    }
    $chkColTotalT = $conn->query("SHOW COLUMNS FROM leads LIKE 'ai_total_tokens'");
    if ($chkColTotalT && $chkColTotalT->num_rows === 0) {
        $conn->query("ALTER TABLE leads ADD COLUMN ai_total_tokens INT DEFAULT 0 COMMENT 'Tổng số token AI sử dụng'");
    }

    // Self-healing check: ensure attachment_url exists in cooperation_slips
    $chkColCoopAttach = $conn->query("SHOW COLUMNS FROM cooperation_slips LIKE 'attachment_url'");
    if ($chkColCoopAttach && $chkColCoopAttach->num_rows === 0) {
        $conn->query("ALTER TABLE cooperation_slips ADD COLUMN attachment_url VARCHAR(500) DEFAULT NULL");
    }

    // Self-healing check: ensure attachment_url exists in notes
    $chkColNoteAttach = $conn->query("SHOW COLUMNS FROM notes LIKE 'attachment_url'");
    if ($chkColNoteAttach && $chkColNoteAttach->num_rows === 0) {
        $conn->query("ALTER TABLE notes ADD COLUMN attachment_url VARCHAR(500) DEFAULT NULL");
    }

    // Bếp Đun Nước (Luồng 3): Bổ sung các cột ghi chú cấu trúc
    $newNoteCols = [
        'channel' => 'VARCHAR(50) DEFAULT NULL',
        'note_type' => 'VARCHAR(50) DEFAULT NULL',
        'duration_minutes' => 'INT DEFAULT 0',
        'client_feedback' => 'TEXT DEFAULT NULL',
        'stuck_tag' => 'VARCHAR(100) DEFAULT NULL',
        'suggested_temperature' => 'VARCHAR(20) DEFAULT NULL',
        'sale_temperature' => 'VARCHAR(20) DEFAULT NULL',
        'documents_sent' => 'TEXT DEFAULT NULL',
        'is_heritage' => 'TINYINT(1) DEFAULT 0'
    ];
    foreach ($newNoteCols as $col => $definition) {
        $chkCol = $conn->query("SHOW COLUMNS FROM notes LIKE '$col'");
        if ($chkCol && $chkCol->num_rows === 0) {
            $conn->query("ALTER TABLE notes ADD COLUMN `$col` $definition");
            $logMsg("Đã bổ sung cột `$col` vào bảng `notes`", "success");
        }
    }

    // Self-healing check: ensure detailed fields exist in suppliers table
    $newSupplierCols = [
        'contact_position' => 'VARCHAR(255) DEFAULT NULL',
        'website' => 'VARCHAR(255) DEFAULT NULL',
        'scale_capital' => 'VARCHAR(255) DEFAULT NULL',
        'typical_projects' => 'TEXT DEFAULT NULL',
        'focused_type' => 'VARCHAR(255) DEFAULT NULL',
        'prestige_tier' => 'VARCHAR(50) DEFAULT NULL',
        'cooperation_status' => "VARCHAR(50) DEFAULT 'active'",
        'bank_account' => 'VARCHAR(255) DEFAULT NULL'
    ];
    foreach ($newSupplierCols as $col => $definition) {
        $chkCol = $conn->query("SHOW COLUMNS FROM suppliers LIKE '$col'");
        if ($chkCol && $chkCol->num_rows === 0) {
            $conn->query("ALTER TABLE suppliers ADD COLUMN `$col` $definition");
        }
    }



    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '153') ON DUPLICATE KEY UPDATE setting_value = '153'");

    // Ensure 'director' is in the users role enum
    $conn->query("ALTER TABLE users MODIFY COLUMN role enum('super_admin','admin','manager','assistant','sales','viewer','superadmin','director') NOT NULL DEFAULT 'sales'");

    //    // Seed default users for Developer Quick Login (All Roles)
    $devUsers = [
        ['id' => 999, 'username' => 'admin', 'email' => 'admin@richland.net', 'password' => 'admin123', 'name' => 'Admin Richland', 'role' => 'admin'],
        ['id' => 1000, 'username' => 'haidang', 'email' => 'haidang@richland.net', 'password' => 'sale123', 'name' => 'Nguyễn Hải Đăng (Sale)', 'role' => 'sales'],
        ['id' => 1001, 'username' => 'director', 'email' => 'director@richland.net', 'password' => 'director123', 'name' => 'Giám đốc kinh doanh Richland', 'role' => 'director'],
        ['id' => 1002, 'username' => 'manager', 'email' => 'manager@richland.net', 'password' => 'manager123', 'name' => 'Trưởng nhóm Richland', 'role' => 'manager'],
    ];

    foreach ($devUsers as $du) {
        $pHash = password_hash($du['password'], PASSWORD_BCRYPT);
        $conn->query("
            INSERT INTO users (id, tenant_id, username, email, password_hash, full_name, role, is_active)
            VALUES ({$du['id']}, 1, '{$du['username']}', '{$du['email']}', '$pHash', '{$du['name']}', '{$du['role']}', 1)
            ON DUPLICATE KEY UPDATE password_hash = '$pHash', role = '{$du['role']}', username = '{$du['username']}', full_name = '{$du['name']}', email = '{$du['email']}'
        ");
    }
    $logMsg("Da khoi tao/cap nhat tai khoan cho tat ca cac quyen de Dev Quick Login", "success");

    // 7. night_shift_registrations table
    $conn->query("
        CREATE TABLE IF NOT EXISTS `night_shift_registrations` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `user_id` int(11) NOT NULL,
          `shift_date` date NOT NULL,
          `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
          PRIMARY KEY (`id`),
          UNIQUE KEY `user_shift_date` (`user_id`, `shift_date`),
          FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 8. consultant_leaves table for leave/vacation history
    $conn->query("
        CREATE TABLE IF NOT EXISTS `consultant_leaves` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `consultant_id` int(11) NOT NULL,
          `start_date` date NOT NULL,
          `end_date` date NOT NULL,
          `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
          PRIMARY KEY (`id`),
          UNIQUE KEY `consultant_leave_dates` (`consultant_id`, `start_date`, `end_date`),
          FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $logMsg("Đã tạo hoặc kiểm tra cấu trúc bảng consultant_leaves", "success");
    // Recreate the accounts VIEW to allow all users (including Sales/Managers) to log in
    $conn->query("
        CREATE OR REPLACE VIEW `accounts` AS 
        SELECT 
          `id`, 
          `username`, 
          `password_hash`, 
          `role`, 
          `full_name` AS `name`, 
          `created_at`, 
          `email`, 
          `zalo_chat_id`, 
          `is_confirmed`, 
          `confirm_token`, 
          `last_login_at` AS `last_login`, 
          `avatar_url` AS `avatar`,
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
    $logMsg("Đã cập nhật VIEW accounts để hỗ trợ mọi roles đăng nhập", "success");

    // Self-healing: Ensure overtime_mode exists in users table
    try {
        $conn->query("ALTER TABLE `users` ADD COLUMN `overtime_mode` TINYINT(1) DEFAULT 0");
    } catch (Throwable $e) {}

    // Recreate the consultants VIEW to support extended profile fields (dob, gender, etc.)
    $conn->query("
        CREATE OR REPLACE VIEW `consultants` AS 
        SELECT 
          `id`, 
          `full_name` AS `name`, 
          `email`, 
          `phone`,
          `status`, 
          `leave_start`, 
          `leave_end`, 
          `created_at`, 
          `zalo_chat_id`, 
          `work_start_time`, 
          `work_end_time`, 
          `work_schedule`, 
          `avatar_url` AS `avatar`, 
          `vacation_mode`, 
          `overtime_mode`,
          `team_id`,
          `dob`,
          `gender`,
          `citizen_id`,
          `address`,
          `bank_name`,
          `bank_account`
        FROM `users`
        WHERE `role` = 'sales'
    ");
    $logMsg("Đã cập nhật VIEW consultants để hỗ trợ các trường ERP mới", "success");

    // Dev quick login users seeded above
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_limit_per_day', '3')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_limit_per_hour', '3')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('databank_limit_per_month', '10')");

    // Self-healing check: ensure distribution_rounds has project_id column
    $chkRndProj = $conn->query("SHOW COLUMNS FROM `distribution_rounds` LIKE 'project_id'");
    if ($chkRndProj && $chkRndProj->num_rows === 0) {
        $conn->query("ALTER TABLE `distribution_rounds` ADD COLUMN `project_id` INT DEFAULT NULL");
        $logMsg("Đã bổ sung cột project_id vào bảng distribution_rounds", "success");
    }

    // Self-healing check: ensure quyen_truy_cap table exists
    $conn->query("
        CREATE TABLE IF NOT EXISTS `quyen_truy_cap` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `contact_id` int(11) NOT NULL,
          `user_id` int(11) NOT NULL,
          `invited_by` int(11) DEFAULT NULL,
          `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
          PRIMARY KEY (`id`),
          UNIQUE KEY `contact_user_unique` (`contact_id`,`user_id`),
          KEY `user_id_idx` (`user_id`),
          KEY `contact_id_idx` (`contact_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $logMsg("Đã tạo hoặc kiểm tra cấu trúc bảng quyen_truy_cap", "success");

    // Self-healing check: seed default pipeline stages if table is empty
    $chkStages = $conn->query("SELECT COUNT(*) FROM pipeline_stages");
    $stageCount = $chkStages ? (int)$chkStages->fetch_row()[0] : 0;
    if ($stageCount === 0) {
        $tenantsRes = $conn->query("SELECT id FROM tenants");
        $tenantIds = [];
        if ($tenantsRes) {
            while ($row = $tenantsRes->fetch_assoc()) {
                $tenantIds[] = (int)$row['id'];
            }
        }
        if (empty($tenantIds)) {
            $tenantIds[] = 1;
        }

        $defaultStages = [
            ['Chưa xác định', '#3b82f6', 0, 0, 0],
            ['Quan tâm', '#6366f1', 1, 0, 0],
            ['Đồng ý gặp', '#ec4899', 2, 0, 0],
            ['Đã gặp', '#f59e0b', 3, 0, 0],
            ['Booking', '#10b981', 4, 0, 0],
            ['Đặt cọc', '#14b8a6', 5, 0, 0],
            ['Đóng deal', '#10b981', 6, 1, 0]
        ];

        foreach ($tenantIds as $tid) {
            foreach ($defaultStages as $ds) {
                $stmtIns = $conn->prepare("INSERT INTO pipeline_stages (tenant_id, name, color, order_index, is_won, is_lost) VALUES (?, ?, ?, ?, ?, ?)");
                $stmtIns->bind_param("issiii", $tid, $ds[0], $ds[1], $ds[2], $ds[3], $ds[4]);
                $stmtIns->execute();
            }
        }
        $logMsg("Đã khởi tạo các giai đoạn pipeline mặc định cho các tenants", "success");
    }




        $safeAddIndex = function($conn, $table, $indexName, $columnsSql) use ($logMsg) {
            $check = $conn->query("SHOW INDEX FROM `$table` WHERE Key_name = '$indexName'");
            if ($check && $check->num_rows === 0) {
                $conn->query("ALTER TABLE `$table` ADD INDEX `$indexName` ($columnsSql)");
                $logMsg("Đã tạo INDEX $indexName trên bảng $table", "success");
            }
        };

        $safeAddIndex($conn, 'contacts', 'idx_contacts_phone', 'phone');
        $safeAddIndex($conn, 'contacts', 'idx_contacts_mobile', 'mobile');
        $safeAddIndex($conn, 'contacts', 'idx_contacts_email', 'email');
        $safeAddIndex($conn, 'contacts', 'idx_contacts_deleted_at', 'deleted_at');
        $safeAddIndex($conn, 'persons', 'idx_persons_is_public', 'is_public');
        $safeAddIndex($conn, 'persons', 'idx_persons_released_to_kho', 'released_to_kho_at');
        $safeAddIndex($conn, 'distribution_logs', 'idx_dist_logs_lead_id', 'lead_id');
        $safeAddIndex($conn, 'distribution_logs', 'idx_dist_logs_assigned_to', 'assigned_to');
        $safeAddIndex($conn, 'distribution_logs', 'idx_dist_logs_status', 'status');
        $safeAddIndex($conn, 'data_reports', 'idx_data_reports_lead_id', 'lead_id');
        $safeAddIndex($conn, 'data_reports', 'idx_data_reports_status', 'status');
        $safeAddIndex($conn, 'leads', 'idx_leads_email', 'email');
        $safeAddIndex($conn, 'leads', 'idx_leads_created_at', 'created_at');

        // Added high-performance indexes for scale (100k+ rows)
        $safeAddIndex($conn, 'leads', 'idx_leads_status_created_at', '`status`, `created_at`');
        $safeAddIndex($conn, 'leads', 'idx_leads_assigned_status', '`assigned_to`, `status`');
        $safeAddIndex($conn, 'leads', 'idx_leads_assigned_accepted', '`assigned_to`, `is_accepted`');
        $safeAddIndex($conn, 'lead_offers', 'idx_lead_offers_status_expires', '`status`, `expires_at`');
        $safeAddIndex($conn, 'lead_offers', 'idx_lead_offers_user_status', '`user_id`, `status`');
        $safeAddIndex($conn, 'cooperation_slips', 'idx_coop_slips_status_created', '`status`, `created_at`');
        $safeAddIndex($conn, 'deposits', 'idx_deposits_status_created', '`status`, `created_at`');
        $safeAddIndex($conn, 'zalo_queue', 'idx_zalo_queue_status_created', '`status`, `created_at`');
        $safeAddIndex($conn, 'mail_queue', 'idx_mail_queue_status_created', '`status`, `created_at`');
        $safeAddIndex($conn, 'audit_logs', 'idx_audit_logs_action_created', '`action`, `created_at`');
        $safeAddIndex($conn, 'audit_logs', 'idx_audit_logs_resource_id', '`resource`, `resource_id`');
        $safeAddIndex($conn, 'activities', 'idx_activities_composite', '`related_type`, `related_id`, `status`');
        $safeAddIndex($conn, 'contacts', 'idx_contacts_composite', '`person_id`, `owner_id`, `deleted_at`');
        $safeAddIndex($conn, 'notifications', 'idx_notifications_user_created_at', '`user_id`, `created_at`');


        // Self-healing check: ensure edit_history exists in notes
        $chkNoteEditHistory = $conn->query("SHOW COLUMNS FROM notes LIKE 'edit_history'");
        if ($chkNoteEditHistory && $chkNoteEditHistory->num_rows === 0) {
            $conn->query("ALTER TABLE notes ADD COLUMN edit_history LONGTEXT NULL DEFAULT NULL");
            $logMsg("Đã thêm cột edit_history cho notes", "success");
        }

        // Self-healing check: ensure edit_history exists in activities
        $chkActEditHistory = $conn->query("SHOW COLUMNS FROM activities LIKE 'edit_history'");
        if ($chkActEditHistory && $chkActEditHistory->num_rows === 0) {
            $conn->query("ALTER TABLE activities ADD COLUMN edit_history LONGTEXT NULL DEFAULT NULL");
            $logMsg("Đã thêm cột edit_history cho activities", "success");
        }

        // Self-healing check: ensure created_by exists in activities
        $chkActCreatedBy = $conn->query("SHOW COLUMNS FROM activities LIKE 'created_by'");
        if ($chkActCreatedBy && $chkActCreatedBy->num_rows === 0) {
            $conn->query("ALTER TABLE activities ADD COLUMN created_by INT(11) NULL DEFAULT NULL AFTER user_id");
            $conn->query("UPDATE activities SET created_by = user_id WHERE created_by IS NULL");
            $logMsg("Đã thêm cột created_by cho activities", "success");
        }

        // Self-healing check: ensure switched_from_deal_id exists in deals
        $chkSwitchedFrom = $conn->query("SHOW COLUMNS FROM deals LIKE 'switched_from_deal_id'");
        if ($chkSwitchedFrom && $chkSwitchedFrom->num_rows === 0) {
            $conn->query("ALTER TABLE deals ADD COLUMN switched_from_deal_id INT NULL DEFAULT NULL AFTER expected_close");
            $logMsg("Đã thêm cột switched_from_deal_id cho deals", "success");
        }

        // Self-healing check: ensure duplicate_flag exists in contacts
        $chkDupFlag = $conn->query("SHOW COLUMNS FROM contacts LIKE 'duplicate_flag'");
        if ($chkDupFlag && $chkDupFlag->num_rows === 0) {
            $conn->query("ALTER TABLE contacts ADD COLUMN duplicate_flag TINYINT(1) NOT NULL DEFAULT 0 AFTER person_id");
            $logMsg("Đã thêm cột duplicate_flag cho contacts", "success");
        }
        $chkDupWith = $conn->query("SHOW COLUMNS FROM contacts LIKE 'duplicate_with_id'");
        if ($chkDupWith && $chkDupWith->num_rows === 0) {
            $conn->query("ALTER TABLE contacts ADD COLUMN duplicate_with_id INT NULL DEFAULT NULL AFTER duplicate_flag");
            $logMsg("Đã thêm cột duplicate_with_id cho contacts", "success");
        }

        // Self-healing check: ensure last_assigned_at exists in leads
        $chkLastAssignedAt = $conn->query("SHOW COLUMNS FROM leads LIKE 'last_assigned_at'");
        if ($chkLastAssignedAt && $chkLastAssignedAt->num_rows === 0) {
            $conn->query("ALTER TABLE leads ADD COLUMN last_assigned_at DATETIME DEFAULT NULL AFTER assigned_to");
            $logMsg("Đã thêm cột last_assigned_at cho leads", "success");
        }

        // Self-healing check: ensure ticket_comments table exists
        $conn->query("
            CREATE TABLE IF NOT EXISTS `ticket_comments` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `ticket_id` int(11) NOT NULL,
              `user_id` int(11) NOT NULL,
              `body` text NOT NULL,
              `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
              PRIMARY KEY (`id`),
              KEY `ticket_id` (`ticket_id`),
              KEY `user_id` (`user_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $logMsg("Đã kiểm tra/khởi tạo cấu trúc bảng ticket_comments thành công", "success");

        // Self-healing check: Backfill contact's last_contact based on existing notes & activities history
        $conn->query("
            UPDATE contacts c
            INNER JOIN (
                SELECT entity_id as contact_id, MAX(created_at) as max_date
                FROM notes
                WHERE entity_type = 'contact'
                GROUP BY entity_id
            ) n ON c.id = n.contact_id
            SET c.last_contact = DATE(n.max_date)
            WHERE c.last_contact IS NULL OR c.last_contact < DATE(n.max_date)
        ");
        $conn->query("
            UPDATE contacts c
            INNER JOIN (
                SELECT related_id as contact_id, MAX(created_at) as max_date
                FROM activities
                WHERE related_type = 'contact'
                GROUP BY related_id
            ) a ON c.id = a.contact_id
            SET c.last_contact = DATE(a.max_date)
            WHERE c.last_contact IS NULL OR c.last_contact < DATE(a.max_date)
        ");
        $logMsg("Đã đồng bộ hóa last_contact cho các contacts đã có lịch sử ghi chú/nhiệm vụ", "success");

        $logMsg("Hoàn thành tự tạo các INDEX hiệu năng.", "success");

        // Initialize Zalo Group notification settings (Version 156 & 157)
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('zalo_admin_group_chat_id', '')");
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('zalo_notify_only_group', '0')");

        // Step 20: Version 158 (RESTRICT Project - Campaign to One-to-Many via project_id column)
        $logMsg("Đang chạy cập nhật phiên bản 158 (Tạo trường project_id trong marketing_campaigns và đồng bộ dữ liệu cũ)...", "info");
        // Ensure table marketing_campaigns exists
        $conn->query("
            CREATE TABLE IF NOT EXISTS `marketing_campaigns` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL DEFAULT 1,
                `name` VARCHAR(255) NOT NULL,
                `description` TEXT DEFAULT NULL,
                `status` VARCHAR(50) DEFAULT 'active',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        
        // Ensure project_id column exists
        $chkColPI = $conn->query("SHOW COLUMNS FROM marketing_campaigns LIKE 'project_id'");
        if ($chkColPI && $chkColPI->num_rows === 0) {
            $conn->query("ALTER TABLE marketing_campaigns ADD COLUMN project_id INT NULL DEFAULT NULL AFTER tenant_id");
            $logMsg("Đã thêm cột project_id vào marketing_campaigns", "success");
            // Add foreign key constraint
            try {
                $conn->query("ALTER TABLE marketing_campaigns ADD CONSTRAINT fk_mc_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL");
                $logMsg("Đã tạo liên kết khóa ngoại fk_mc_project_id", "success");
            } catch (Throwable $ex) {
                $logMsg("Không thể tạo ràng buộc khóa ngoại: " . $ex->getMessage(), "warning");
            }
        }

        // Migrate existing campaigns data from project_ids (project names comma-separated)
        $chkColOld = $conn->query("SHOW COLUMNS FROM marketing_campaigns LIKE 'project_ids'");
        if ($chkColOld && $chkColOld->num_rows > 0) {
            $resOld = $conn->query("SELECT id, project_ids FROM marketing_campaigns WHERE project_id IS NULL");
            if ($resOld) {
                while ($rowOld = $resOld->fetch_assoc()) {
                    $pNamesStr = trim($rowOld['project_ids'] ?? '');
                    if ($pNamesStr !== '') {
                        $pNames = array_filter(array_map('trim', explode(',', $pNamesStr)));
                        if (!empty($pNames)) {
                            $firstName = reset($pNames);
                            $stmtP = $conn->prepare("SELECT id FROM projects WHERE name = ? LIMIT 1");
                            if ($stmtP) {
                                $stmtP->bind_param("s", $firstName);
                                $stmtP->execute();
                                $pRow = $stmtP->get_result()->fetch_assoc();
                                $stmtP->close();
                                if ($pRow) {
                                    $pId = (int)$pRow['id'];
                                    $stmtU = $conn->prepare("UPDATE marketing_campaigns SET project_id = ? WHERE id = ?");
                                    if ($stmtU) {
                                        $stmtU->bind_param("ii", $pId, $rowOld['id']);
                                        $stmtU->execute();
                                        $stmtU->close();
                                        $logMsg("Đã đồng bộ chiến dịch ID {$rowOld['id']} liên kết với dự án '{$firstName}' (ID: {$pId})", "success");
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('db_version', '158') ON DUPLICATE KEY UPDATE setting_value = '158'");

        // Version 159 (Manager behavior mode configuration, contact collaborators sharing, and consultants view update)
        $logMsg("Đang chạy cập nhật phiên bản 159...", "info");
        
        // 1. Ensure manager_behavior_mode setting exists
        $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('manager_behavior_mode', 'combined')");

        // 2. Ensure collaborator_ids column exists in contacts table
        $chkColCollab = $conn->query("SHOW COLUMNS FROM contacts LIKE 'collaborator_ids'");
        if ($chkColCollab && $chkColCollab->num_rows === 0) {
            $conn->query("ALTER TABLE contacts ADD COLUMN collaborator_ids TEXT NULL DEFAULT NULL COMMENT 'JSON array or comma-separated list of co-caring sale IDs' AFTER owner_id");
            $logMsg("Đã thêm cột collaborator_ids vào bảng contacts", "success");
        }

        // 3. Update consultants view to dynamically include manager role when behavior mode is combined
        $conn->query("CREATE OR REPLACE VIEW `consultants` AS 
            SELECT 
              `id`, 
              `full_name` AS `name`, 
              `email`, 
              `status`, 
              `leave_start`, 
              `leave_end`, 
              `created_at`, 
              `zalo_chat_id`, 
              `work_start_time`, 
              `work_end_time`, 
              `work_schedule`, 
              `avatar_url` AS `avatar`, 
              `vacation_mode`,
              `team_id`
            FROM `users` 
            WHERE `role` = 'sales' 
               OR (`role` = 'manager' AND COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = 'manager_behavior_mode' LIMIT 1), 'combined') = 'combined')");
        $logMsg("Đã cập nhật view consultants hỗ trợ manager nhận data tự động", "success");

        $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '159') ON DUPLICATE KEY UPDATE setting_value = '159'");
        $currentVersion = 159;

    $logMsg("Tự sửa đổi cấu trúc hoàn thành thành công.", "success");

    $logMsg("Hệ thống đã cập nhật thành công lên phiên bản mới nhất: " . $currentVersion, "success");

} catch (Throwable $e) {
    $logMsg("Đã xảy ra lỗi trong quá trình migration: " . $e->getMessage(), "error");
} finally {
    // Release Advisory Lock
    $relStmt = $conn->prepare("SELECT RELEASE_LOCK('db_migration_lock')");
    if ($relStmt) {
        $relStmt->execute();
        $relStmt->close();
    }
    $logMsg("Đã giải phóng khóa Advisory Lock.", "info");
}

if (!$isCli) {
    echo "</div>"; // End of step-log
    echo "<p style='margin-top: 1.5rem;'><a href='run_migrations.php' class='btn'>← Quay lại trang chính</a></p>";
    echo "</div>"; // End of card
    echo "</body></html>";
} else {
    echo "\nHoàn tất chạy migration.\n";
}
