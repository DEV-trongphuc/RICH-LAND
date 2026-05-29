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

// Global helper: Log Zalo/Email communications to database
if (!function_exists('log_communication')) {
    function log_communication($conn, $leadId, $type, $recipient, $status, $errorMessage = null) {
        $stmt = $conn->prepare("INSERT INTO communication_logs (lead_id, type, recipient, status, error_message) VALUES (?, ?, ?, ?, ?)");
        if ($stmt) {
            $leadIdVal = !empty($leadId) ? (int)$leadId : null;
            $stmt->bind_param("issss", $leadIdVal, $type, $recipient, $status, $errorMessage);
            $stmt->execute();
            $stmt->close();
        }
    }
}

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

$db_needs_migration = false;
$checkSettings = $conn->query("SHOW TABLES LIKE 'system_settings'");
if ($checkSettings && $checkSettings->num_rows > 0) {
    $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
    if ($vStmt && $vStmt->num_rows > 0) {
        $dbVer = (int)$vStmt->fetch_assoc()['setting_value'];
        if ($dbVer < 140) {
            $db_needs_migration = true;
        }
    } else {
        $db_needs_migration = true;
    }
} else {
    $db_needs_migration = true;
}
$GLOBALS['db_needs_migration'] = $db_needs_migration;

if (!function_exists('getTicketNotifyAdmins')) {
    function getTicketNotifyAdmins($conn)
    {
        $res = $conn->query("SELECT account_id FROM ticket_notify_settings");
        $adminIds = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $adminIds[] = (int) $row['account_id'];
            }
        }

        $admins = [];
        if (!empty($adminIds)) {
            $inPlaceholders = implode(',', array_fill(0, count($adminIds), '?'));
            $types = str_repeat('i', count($adminIds));
            $adminStmt = $conn->prepare("SELECT id, name, email, zalo_chat_id FROM accounts WHERE id IN ($inPlaceholders)");
            if ($adminStmt) {
                $adminStmt->bind_param($types, ...$adminIds);
                $adminStmt->execute();
                $adminRes = $adminStmt->get_result();
                if ($adminRes) {
                    while ($r = $adminRes->fetch_assoc()) {
                        $admins[] = $r;
                    }
                }
                $adminStmt->close();
            }
        } else {
            // Fallback: role = 'admin' OR id = 1
            $adminRes = $conn->query("SELECT id, name, email, zalo_chat_id FROM accounts WHERE role = 'admin' OR id = 1");
            if ($adminRes) {
                while ($r = $adminRes->fetch_assoc()) {
                    $admins[] = $r;
                }
            }
        }
        return $admins;
    }
}
?>
