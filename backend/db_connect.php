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

if (!function_exists('isRestDayForUser')) {
    function isRestDayForUser($conn, $userId, $date) {
        $dayOfWeek = (int)date('N', strtotime($date));
        if ($dayOfWeek == 7) {
            return true; // Sunday is always rest day
        }
        if ($dayOfWeek == 6) { // Saturday
            // 1. Check user's individual schedule if use_custom_work_hours is enabled
            $stmtSched = $conn->prepare("SELECT use_custom_work_hours, work_schedule FROM users WHERE id = ?");
            if ($stmtSched) {
                $stmtSched->bind_param("i", $userId);
                $stmtSched->execute();
                $sRow = $stmtSched->get_result()->fetch_assoc();
                $stmtSched->close();
                if ($sRow && (int)($sRow['use_custom_work_hours'] ?? 0) === 1 && !empty($sRow['work_schedule'])) {
                    $sched = json_decode($sRow['work_schedule'], true);
                    if (isset($sched[6]) && isset($sched[6]['active'])) {
                        return !(bool)$sched[6]['active'];
                    }
                }
            }
            
            // 2. Fallback to global work schedule
            $resSched = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_schedule' LIMIT 1");
            if ($resSched && $gRow = $resSched->fetch_assoc()) {
                $schedule = json_decode($gRow['setting_value'], true);
                if (isset($schedule["6"]) && isset($schedule["6"]["active"])) {
                    return !(bool)$schedule["6"]["active"];
                }
            }
            
            return true; // default Saturday is off if not specified
        }
        return false;
    }
}

if (!function_exists('get_lead_recall_minutes')) {
    function get_lead_recall_minutes($conn, $lastInteractionDate, $connectionRecallMins = 0) {
        $connectionRecallMins = (int)$connectionRecallMins;
        if ($connectionRecallMins > 0) {
            // If the connection has a custom recall minutes, we still apply Golden Hours shortening to it!
            $leadRecallMins = $connectionRecallMins;
        } else {
            $timeoutNormal = (int) get_system_setting($conn, 'lead_response_timeout_minutes') ?: 2;
            $timeoutOvertime = (int) get_system_setting($conn, 'lead_response_timeout_overtime_minutes') ?: $timeoutNormal;

            $nightShiftStart = get_system_setting($conn, 'night_shift_start_time') ?: '18:00';
            $nightShiftEnd = get_system_setting($conn, 'night_shift_end_time') ?: '06:00';

            $lastTime = date('H:i', strtotime($lastInteractionDate));
            $isOvertime = false;
            if ($nightShiftStart < $nightShiftEnd) {
                $isOvertime = ($lastTime >= $nightShiftStart && $lastTime <= $nightShiftEnd);
            } else {
                $isOvertime = ($lastTime >= $nightShiftStart || $lastTime <= $nightShiftEnd);
            }

            $leadRecallMins = $isOvertime ? $timeoutOvertime : $timeoutNormal;
        }

        // Apply golden hours shortening if current time is golden hours
        $goldenHoursStart = get_system_setting($conn, 'golden_hours_start_time') ?: '06:00';
        $goldenHoursEnd = get_system_setting($conn, 'golden_hours_end_time') ?: '08:30';
        
        $currentTime = date('H:i');
        $isGoldenHour = false;
        if ($goldenHoursStart < $goldenHoursEnd) {
            $isGoldenHour = ($currentTime >= $goldenHoursStart && $currentTime <= $goldenHoursEnd);
        } else {
            $isGoldenHour = ($currentTime >= $goldenHoursStart || $currentTime <= $goldenHoursEnd);
        }

        if ($isGoldenHour) {
            $leadRecallMins = max(1, (int)ceil($leadRecallMins / 2));
        }

        return $leadRecallMins;
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

        // Tạm thời tắt tự động dọn dẹp theo yêu cầu của Admin để giữ lại toàn bộ dữ liệu lịch sử
        /*
        $conn->query("DELETE FROM admin_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
        $conn->query("DELETE FROM communication_logs WHERE sent_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
        */
    }
}

$db_needs_migration = false;
try {
    $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
    if ($vStmt && $vStmt->num_rows > 0) {
        $dbVer = (int)$vStmt->fetch_assoc()['setting_value'];
        if ($dbVer < 146) {
            $db_needs_migration = true;
        }
    } else {
        $db_needs_migration = true;
    }
} catch (Throwable $e) {
    $db_needs_migration = true;
}
$GLOBALS['db_needs_migration'] = $db_needs_migration;

if (!function_exists('getTicketNotifyAdmins')) {
    function getTicketNotifyAdmins($conn)
    {
        $adminGroupChatId = get_system_setting($conn, 'zalo_admin_group_chat_id');
        $onlyGroup = get_system_setting($conn, 'zalo_notify_only_group');
        if ($onlyGroup === '1' && !empty($adminGroupChatId)) {
            return [
                [
                    'id' => 0,
                    'name' => 'Zalo Admin Group',
                    'email' => '',
                    'zalo_chat_id' => $adminGroupChatId
                ]
            ];
        }

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
            $adminRes = $conn->query("SELECT id, name, email, zalo_chat_id FROM accounts WHERE role = 'admin' OR role = 'superadmin' OR id = 1");
            if ($adminRes) {
                while ($r = $adminRes->fetch_assoc()) {
                    $admins[] = $r;
                }
            }
        }

        // Tích hợp Zalo Admin Group Chat ID nếu cấu hình
        $adminGroupChatId = get_system_setting($conn, 'zalo_admin_group_chat_id');
        if (!empty($adminGroupChatId)) {
            $admins[] = [
                'id' => 0,
                'name' => 'Zalo Admin Group',
                'email' => '',
                'zalo_chat_id' => $adminGroupChatId
            ];
        }

        return $admins;
    }
}
?>
