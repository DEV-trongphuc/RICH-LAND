<?php
// webhook_logic.php
// Common routing and distribution logic for leads

require_once __DIR__ . '/db_connect.php';

/**
 * Normalize phone number to standard format.
 * - Vietnamese numbers: 0xxxxxxxxx (10 digits)
 * - Foreign numbers: +{countryCode}{number} (keep leading +)
 * - Removes all formatting chars (spaces, dashes, p:, tel:, etc.)
 * BUG-13 fix: Single canonical implementation (was duplicated with wrong logic in webhook_logic.php)
 */
function normalizePhone($phoneRaw)
{
    if (empty($phoneRaw))
        return '';
    $phone = trim((string) $phoneRaw);

    // Remove common prefixes like "p:", "tel:", "phone:", etc.
    $phone = preg_replace('/^(p:|tel:|phone:)\s*/i', '', $phone);

    // Extract the last phone number if multiple are provided (separated by commas, dots, slashes, spaces, or words like "hoặc", "or")
    $parts = preg_split('/[,;\/]|(?:\.\s*)|(?:\s+hoặc\s+)|(?:\s+or\s+)|(?:\s+và\s+)|(?:\s+and\s+)|\s+/i', $phone);
    $validParts = [];
    foreach ($parts as $part) {
        $partCleaned = preg_replace('/[^\d+]/', '', trim($part));
        $digitsOnly = preg_replace('/[^\d]/', '', $partCleaned);
        if (strlen($digitsOnly) >= 8) {
            $validParts[] = $partCleaned;
        }
    }
    if (count($validParts) > 1) {
        $phone = end($validParts);
    }

    // Keep only digits and leading +
    $hasPlusPrefix = (strpos($phone, '+') !== false && strpos(ltrim($phone), '+') === 0);
    $clean = preg_replace('/[^\d]/', '', $phone);

    if ($hasPlusPrefix) {
        // If it starts with +84, it's Vietnamese, convert to leading 0
        if (strpos($clean, '84') === 0) {
            $rest = substr($clean, 2);
            if (strpos($rest, '0') === 0) {
                return $rest;
            }
            return '0' . $rest;
        }
        return '+' . $clean; // Keep other country codes as foreign numbers
    }

    // Handle Vietnamese numbers starting with 84 (without leading +)
    if (strpos($clean, '84') === 0) {
        $rest = substr($clean, 2);
        if (strpos($rest, '0') === 0) {
            $clean = $rest;
        } elseif (strlen($clean) === 10 || strlen($clean) === 11 || strlen($clean) === 9) {
            $clean = '0' . $rest;
        }
    }

    // If it does not start with 0, prepend 0 (Vietnamese numbers missing leading 0, e.g. 90555555 -> 090555555)
    if (!empty($clean) && strpos($clean, '0') !== 0) {
        return '0' . $clean;
    }

    return $clean;
}

/**
 * Normalize date to standard MySQL Y-m-d H:i:s format.
 * Supports various common Excel/text formats (e.g. 20-05-2026 16:35:50, 2026-05-20, etc.)
 */
function normalizeDate($dateRaw)
{
    if (empty($dateRaw))
        return null;
    $dateStr = trim((string) $dateRaw);
    if ($dateStr === '')
        return null;

    // 1. If it's already Y-m-d H:i:s
    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $dateStr)) {
        return $dateStr;
    }

    // 2. Try parsing DMY format: dd-mm-yyyy hh:ii:ss or dd/mm/yyyy hh:ii:ss
    if (preg_match('/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/', $dateStr, $matches)) {
        $day = (int) $matches[1];
        $month = (int) $matches[2];
        $year = (int) $matches[3];
        $hour = isset($matches[4]) ? (int) $matches[4] : 0;
        $minute = isset($matches[5]) ? (int) $matches[5] : 0;
        $second = isset($matches[6]) ? (int) $matches[6] : 0;

        if (checkdate($month, $day, $year)) {
            return sprintf('%04d-%02d-%02d %02d:%02d:%02d', $year, $month, $day, $hour, $minute, $second);
        }
    }

    // 3. Try standard PHP strtotime
    $timestamp = strtotime(str_replace('/', '-', $dateStr));
    if ($timestamp !== false && $timestamp > 0) {
        return date('Y-m-d H:i:s', $timestamp);
    }

    // 4. Try parsing Excel numeric timestamp
    if (is_numeric($dateStr)) {
        $days = (float) $dateStr;
        // Excel base date is 1900-01-01
        $timestamp = ($days - 25569) * 86400;
        if ($timestamp > 0) {
            return date('Y-m-d H:i:s', $timestamp);
        }
    }

    return null;
}

function checkGlobalExclusion($conn, $data, $phone, $email, $notifyAdmins = false, $name = '', $source = '', $type = '', $note = '')
{
    static $exclusions = null;
    static $blacklistContacts = null;
    static $blacklistKeys = null;
    if ($exclusions === null) {
        $exclusions = ['keys' => '', 'contacts' => ''];
        $res = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('global_exclusion_keys', 'global_exclusion_contacts')");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                if ($row['setting_key'] === 'global_exclusion_keys')
                    $exclusions['keys'] = $row['setting_value'];
                if ($row['setting_key'] === 'global_exclusion_contacts')
                    $exclusions['contacts'] = $row['setting_value'];
            }
        }
        $blacklistContacts = !empty($exclusions['contacts']) ? array_map('trim', explode(',', strtolower($exclusions['contacts']))) : [];
        $blacklistKeys = !empty($exclusions['keys']) ? array_map('trim', explode(',', mb_strtolower($exclusions['keys'], 'UTF-8'))) : [];
    }

    $matched = false;
    $reason = '';

    // 1. Check contacts (email / phone)
    if (!empty($blacklistContacts)) {
        $p = strtolower(normalizePhone($phone));
        $e = strtolower(trim($email));
        foreach ($blacklistContacts as $contact) {
            if (empty($contact))
                continue;

            if (strpos($contact, '@') !== false) {
                // Email check: exact match OR domain match if contact starts with @ (e.g. @test.com)
                if (!empty($e) && ($e === $contact || (strpos($contact, '@') === 0 && substr($e, -strlen($contact)) === $contact))) {
                    $matched = true;
                    $reason = "Trùng Email/Tên miền trong danh sách đen: " . $contact;
                    break;
                }
            } else {
                // Phone check: normalize both to ignore spacing/prefix mismatches
                $normalizedContact = strtolower(normalizePhone($contact));
                if (!empty($normalizedContact) && !empty($p) && $p === $normalizedContact) {
                    $matched = true;
                    $reason = "Trùng Số điện thoại trong danh sách đen: " . $contact;
                    break;
                }
            }
        }
    }

    // 2. Check keys in payload (Scan ONLY values, not JSON keys/headers)
    if (!$matched && !empty($blacklistKeys)) {
        $scanData = $data;
        unset($scanData['_meta']); // Do not scan internal metadata

        // Flatten array to extract only values (ignore column headers / JSON keys)
        $values = [];
        array_walk_recursive($scanData, function ($v) use (&$values) {
            if (!is_null($v) && !is_bool($v)) {
                $values[] = $v;
            }
        });

        $payloadStr = mb_strtolower(implode(' | ', $values), 'UTF-8');

        foreach ($blacklistKeys as $key) {
            if (empty($key))
                continue;
            if (mb_strpos($payloadStr, $key, 0, 'UTF-8') !== false) {
                $matched = true;
                $reason = "Trùng từ khóa loại trừ: \"" . $key . "\"";
                break;
            }
        }
    }

    if ($matched) {
        if ($notifyAdmins) {
            try {
                // 1. Get bot token
                $stmtToken = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                $botToken = $stmtToken->fetch_assoc()['setting_value'] ?? '';

                // 2. Query ticket notify admins
                $admins = getTicketNotifyAdmins($conn);
                if (!empty($admins)) {
                        $maskedPhone = '';
                        if (!empty($phone)) {
                            $trimmed = trim($phone);
                            if (strlen($trimmed) <= 6) {
                                $maskedPhone = substr($trimmed, 0, 2) . str_repeat('*', strlen($trimmed) - 2);
                            } else {
                                $maskedPhone = substr($trimmed, 0, 3) . '****' . substr($trimmed, -3);
                            }
                        }

                        $zaloMsg = "⚠️ [ CẢNH BÁO DATA TRÙNG/SPAM CHẶN BLACKLIST ]\n\n"
                            . "Hệ thống vừa nhận được data mới khớp với danh sách đen/từ khóa loại trừ và đã tự động bỏ qua.\n\n"
                            . "- Tên khách hàng: " . ($name ?: 'Không rõ') . "\n"
                            . "- SĐT: " . ($maskedPhone ?: '-') . "\n"
                            . "- Email: " . ($email ?: '-') . "\n"
                            . "- Nguồn: " . ($source ?: '-') . "\n"
                            . "- Loại: " . ($type ?: '-') . "\n"
                            . "- Ghi chú: " . ($note ?: '-') . "\n"
                            . "- Lý do lọc: " . $reason;

                        // Send Zalo
                        if (!empty($botToken)) {
                            require_once __DIR__ . '/zalo_bot.php';
                            foreach ($admins as $admin) {
                                if (!empty($admin['zalo_chat_id'])) {
                                    sendZaloMessage($botToken, $admin['zalo_chat_id'], $zaloMsg, false);
                                }
                            }
                        }

                        // Send Email
                        require_once __DIR__ . '/mailer.php';
                        $emailSubj = "[Cảnh báo] Data mới bị loại trừ (Blacklist) - " . ($name ?: 'Không rõ');
                        $emailBody = "<h3>Cảnh báo Data mới khớp danh sách đen / từ khóa loại trừ</h3>
                                      <p>Hệ thống đã tự động bỏ qua (không lưu CRM, không phân bổ) data sau:</p>
                                      <ul>
                                          <li><strong>Họ tên:</strong> " . ($name ?: 'Không rõ') . "</li>
                                          <li><strong>Số điện thoại:</strong> " . ($phone ?: '-') . "</li>
                                          <li><strong>Email:</strong> " . ($email ?: '-') . "</li>
                                          <li><strong>Nguồn:</strong> " . ($source ?: '-') . "</li>
                                          <li><strong>Loại:</strong> " . ($type ?: '-') . "</li>
                                          <li><strong>Ghi chú:</strong> " . ($note ?: '-') . "</li>
                                          <li><strong>Lý do lọc:</strong> " . $reason . "</li>
                                      </ul>";

                        foreach ($admins as $admin) {
                            if (!empty($admin['email'])) {
                                sendEmailNotification($admin['email'], $emailSubj, 'Cảnh báo Data Blacklist', $emailBody, '');
                            }
                        }
                    }
            } catch (Exception $ex) {
                error_log("Error notifying admins of blacklist match: " . $ex->getMessage());
            }

            // Ghi log hành động hệ thống tự động chặn data (blacklist) để báo cáo ngày thống kê được
            try {
                $detailsJson = json_encode([
                    'type' => 'auto',
                    'phone' => $phone,
                    'email' => $email,
                    'name' => $name,
                    'source' => $source,
                    'reason' => $reason
                ], JSON_UNESCAPED_UNICODE);
                $logStmt = $conn->prepare("INSERT INTO admin_logs (account_id, action, details, ip_address) VALUES (0, 'BLOCK_LEAD_BLACKLIST', ?, ?)");
                if ($logStmt) {
                    $ip = $_SERVER['REMOTE_ADDR'] ?? 'System';
                    $logStmt->bind_param("ss", $detailsJson, $ip);
                    $logStmt->execute();
                    $logStmt->close();
                    if (function_exists('pruneAdminLogs')) {
                        pruneAdminLogs($conn);
                    }
                }
            } catch (Exception $logEx) {
                error_log("Error logging automated blacklist action: " . $logEx->getMessage());
            }
        }
        return true;
    }

    return false;
}

function findConsultantByEmailOrName($conn, $value)
{
    $value = trim($value);
    if (empty($value))
        return null;
    $lowerVal = mb_strtolower($value, 'UTF-8');

    // Sử dụng bộ nhớ đệm static cache tránh truy vấn DB lặp lại nhiều lần
    static $consultantNameIdCache = [];
    if (array_key_exists($lowerVal, $consultantNameIdCache)) {
        return $consultantNameIdCache[$lowerVal];
    }

    // 1. Try finding by email
    if (filter_var($value, FILTER_VALIDATE_EMAIL)) {
        $stmt = $conn->prepare("SELECT id FROM consultants WHERE email = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("s", $value);
            $stmt->execute();
            $res = $stmt->get_result();
            $row = $res->fetch_assoc();
            $stmt->close();
            if ($row) {
                $consultantNameIdCache[$lowerVal] = (int) $row['id'];
                return $consultantNameIdCache[$lowerVal];
            }
        }
    }
    // 2. Try finding by name (case-insensitive or exact name match)
    $stmt = $conn->prepare("SELECT id FROM consultants WHERE name = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("s", $value);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        $stmt->close();
        if ($row) {
            $consultantNameIdCache[$lowerVal] = (int) $row['id'];
            return $consultantNameIdCache[$lowerVal];
        }
    }
    $consultantNameIdCache[$lowerVal] = null;
    return null;
}

function checkCRMInteraction($conn, $phone, $email, $ignoreReassignIfOwnerInactive = false, $excludeLeadId = null)
{
    if (empty($phone) && empty($email)) {
        return [
            'isDuplicate' => false,
            'monthsSinceLastInteraction' => 0,
            'assignedTo' => null,
            'originalAssignedTo' => null,
            'consultantStatus' => null
        ];
    }

    $where = [];
    $params = [];
    $types = '';

    // Split and normalize multiple phone numbers if present
    $phones = [];
    if (!empty($phone)) {
        $phoneParts = preg_split('/[,;\/]|(?:\s+hoặc\s+)|(?:\s+or\s+)|(?:\s+và\s+)|(?:\s+and\s+)|\s+/i', (string) $phone);
        foreach ($phoneParts as $part) {
            $part = trim($part);
            if (empty($part))
                continue;
            $norm = normalizePhone($part);
            if (!empty($norm) && !in_array($norm, $phones)) {
                $phones[] = $norm;
            }
        }
    }

    // Split and clean multiple email addresses if present
    $emails = [];
    if (!empty($email)) {
        $emailParts = preg_split('/[,;\/\s]+/i', (string) $email);
        foreach ($emailParts as $part) {
            $part = trim(strtolower($part));
            if (empty($part))
                continue;
            if (strpos($part, '@') !== false && !in_array($part, $emails)) {
                $emails[] = $part;
            }
        }
    }

    if (empty($phones) && empty($emails)) {
        return [
            'isDuplicate' => false,
            'monthsSinceLastInteraction' => 0,
            'assignedTo' => null,
            'originalAssignedTo' => null,
            'consultantStatus' => null
        ];
    }

    static $lastConn = null;
    static $stmtPhone = null;
    static $stmtEmail = null;
    static $stmtBoth = null;
    static $stmtPhoneEx = null;
    static $stmtEmailEx = null;
    static $stmtBothEx = null;
    if ($lastConn !== $conn) {
        $stmtPhone = null;
        $stmtEmail = null;
        $stmtBoth = null;
        $stmtPhoneEx = null;
        $stmtEmailEx = null;
        $stmtBothEx = null;
        $lastConn = $conn;
    }

    $isDynamic = true;
    $excludeLeadId = ($excludeLeadId && $excludeLeadId > 0) ? (int)$excludeLeadId : null;

    if (count($phones) === 1 && count($emails) === 0) {
        if ($excludeLeadId) {
            if ($stmtPhoneEx === null) {
                $stmtPhoneEx = $conn->prepare("SELECT l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end, c.vacation_mode 
                                             FROM leads l 
                                             LEFT JOIN consultants c ON l.assigned_to = c.id 
                                             WHERE l.phone = ? AND l.id != ?
                                             ORDER BY l.last_interaction_date DESC LIMIT 1");
            }
            $stmt = $stmtPhoneEx;
            $types = 'si';
            $params = [$phones[0], $excludeLeadId];
        } else {
            if ($stmtPhone === null) {
                $stmtPhone = $conn->prepare("SELECT l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end, c.vacation_mode 
                                             FROM leads l 
                                             LEFT JOIN consultants c ON l.assigned_to = c.id 
                                             WHERE l.phone = ? 
                                             ORDER BY l.last_interaction_date DESC LIMIT 1");
            }
            $stmt = $stmtPhone;
            $types = 's';
            $params = [$phones[0]];
        }
        $isDynamic = false;
    } else if (count($phones) === 0 && count($emails) === 1) {
        if ($excludeLeadId) {
            if ($stmtEmailEx === null) {
                $stmtEmailEx = $conn->prepare("SELECT l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end, c.vacation_mode 
                                             FROM leads l 
                                             LEFT JOIN consultants c ON l.assigned_to = c.id 
                                             WHERE l.email = ? AND l.id != ?
                                             ORDER BY l.last_interaction_date DESC LIMIT 1");
            }
            $stmt = $stmtEmailEx;
            $types = 'si';
            $params = [$emails[0], $excludeLeadId];
        } else {
            if ($stmtEmail === null) {
                $stmtEmail = $conn->prepare("SELECT l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end, c.vacation_mode 
                                             FROM leads l 
                                             LEFT JOIN consultants c ON l.assigned_to = c.id 
                                             WHERE l.email = ? 
                                             ORDER BY l.last_interaction_date DESC LIMIT 1");
            }
            $stmt = $stmtEmail;
            $types = 's';
            $params = [$emails[0]];
        }
        $isDynamic = false;
    } else if (count($phones) === 1 && count($emails) === 1) {
        if ($excludeLeadId) {
            if ($stmtBothEx === null) {
                $stmtBothEx = $conn->prepare("SELECT l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end, c.vacation_mode 
                                             FROM leads l 
                                             LEFT JOIN consultants c ON l.assigned_to = c.id 
                                             WHERE (l.phone = ? OR l.email = ?) AND l.id != ?
                                             ORDER BY l.last_interaction_date DESC LIMIT 1");
            }
            $stmt = $stmtBothEx;
            $types = 'ssi';
            $params = [$phones[0], $emails[0], $excludeLeadId];
        } else {
            if ($stmtBoth === null) {
                $stmtBoth = $conn->prepare("SELECT l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end, c.vacation_mode 
                                             FROM leads l 
                                             LEFT JOIN consultants c ON l.assigned_to = c.id 
                                             WHERE l.phone = ? OR l.email = ? 
                                             ORDER BY l.last_interaction_date DESC LIMIT 1");
            }
            $stmt = $stmtBoth;
            $types = 'ss';
            $params = [$phones[0], $emails[0]];
        }
        $isDynamic = false;
    } else {
        foreach ($phones as $p) {
            $where[] = "l.phone = ?";
            $params[] = $p;
            $types .= 's';
        }
        foreach ($emails as $e) {
            $where[] = "l.email = ?";
            $params[] = $e;
            $types .= 's';
        }
        $whereClause = implode(" OR ", $where);
        if ($excludeLeadId) {
            $stmt = $conn->prepare("SELECT l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end, c.vacation_mode 
                                    FROM leads l 
                                    LEFT JOIN consultants c ON l.assigned_to = c.id 
                                    WHERE ($whereClause) AND l.id != ?
                                    ORDER BY l.last_interaction_date DESC LIMIT 1");
            $params[] = $excludeLeadId;
            $types .= 'i';
        } else {
            $stmt = $conn->prepare("SELECT l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end, c.vacation_mode 
                                    FROM leads l 
                                    LEFT JOIN consultants c ON l.assigned_to = c.id 
                                    WHERE $whereClause 
                                    ORDER BY l.last_interaction_date DESC LIMIT 1");
        }
        $isDynamic = true;
    }

    if ($stmt) {
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($isDynamic) {
            $stmt->close();
        }
    } else {
        $res = false;
    }

    if ($res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $lastInteraction = new DateTime($row['last_interaction_date']);
        $now = new DateTime();
        $diff = $now->diff($lastInteraction);
        $months = ($diff->format('%y') * 12) + $diff->format('%m');

        $reassignIfOwnerInactive = get_system_setting($conn, 'reassign_if_owner_inactive');
        if ($reassignIfOwnerInactive === '') {
            $reassignIfOwnerInactive = '1'; // Default to ON (mặc định bật)
        }

        $consultantStatus = $row['consultant_status'];
        $leaveStart = $row['leave_start'] ?? null;
        $leaveEnd = $row['leave_end'] ?? null;
        $today = date('Y-m-d');

        $isActuallyOnLeave = false;
        if ($consultantStatus === 'leave' || (isset($row['vacation_mode']) && $row['vacation_mode'] == 1)) {
            $isActuallyOnLeave = true;
        } else if ($consultantStatus === 'active' && !empty($leaveStart)) {
            if ($today >= $leaveStart && (empty($leaveEnd) || $today <= $leaveEnd)) {
                $isActuallyOnLeave = true;
            }
        }

        $effectiveStatus = $isActuallyOnLeave ? 'leave' : $consultantStatus;

        // Đánh giá xem có phải ngừng hoạt động hẳn hay không (chỉ status = 'inactive' mới tính là ngừng hoạt động)
        // Nếu nghỉ phép (status = 'leave' hoặc có lịch nghỉ, vacation_mode), vẫn được coi là hoạt động/giữ khách cũ.
        $isInactive = ($consultantStatus === 'inactive');

        if ($reassignIfOwnerInactive === '1' && !$ignoreReassignIfOwnerInactive) {
            // Chỉ chuyển giao cho Sale khác nếu Sale cũ đã NGỪNG HOẠT ĐỘNG (status = inactive)
            // Nếu chỉ nghỉ phép (status = leave, vacation_mode = 1, hoặc lịch nghỉ), vẫn giữ lại khách cũ (isDuplicate = true)
            $isDuplicate = !$isInactive;
            $assignedTo = $isDuplicate ? $row['assigned_to'] : null;
        } else {
            // OFF hoặc bỏ qua: Luôn coi là trùng và giữ nguyên Sale cũ
            $isDuplicate = true;
            $assignedTo = $row['assigned_to'];
        }

        return [
            'isDuplicate' => $isDuplicate,
            'leadExists' => true,
            'monthsSinceLastInteraction' => $months,
            'assignedTo' => $assignedTo,
            'assignedName' => $row['consultant_name'] ?? 'Không rõ',
            'lastInteractionDate' => $row['last_interaction_date'],
            'originalAssignedTo' => $row['assigned_to'],
            'consultantStatus' => $effectiveStatus
        ];
    }

    return [
        'isDuplicate' => false,
        'leadExists' => false,
        'monthsSinceLastInteraction' => 0,
        'assignedTo' => null,
        'assignedName' => 'Không rõ',
        'lastInteractionDate' => null,
        'originalAssignedTo' => null,
        'consultantStatus' => null
    ];
}

function stripAccents($str)
{
    $str = preg_replace('/(à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ)/u', 'a', $str);
    $str = preg_replace('/(è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ)/u', 'e', $str);
    $str = preg_replace('/(ì|í|ị|ỉ|ĩ)/u', 'i', $str);
    $str = preg_replace('/(ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ)/u', 'o', $str);
    $str = preg_replace('/(ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ)/u', 'u', $str);
    $str = preg_replace('/(ỳ|ý|ỵ|ỷ|ỹ)/u', 'y', $str);
    $str = preg_replace('/(đ)/u', 'd', $str);
    return $str;
}

function normalizeTextForComparison($str)
{
    $str = mb_strtolower($str, 'UTF-8');
    $str = stripAccents($str);
    // Thay thế các ký tự phân tách phổ biến (: ; - ,) bằng khoảng trắng
    $str = str_replace([':', ';', '-', ',', '–'], ' ', $str);
    // Rút gọn nhiều khoảng trắng liên tiếp thành 1 khoảng trắng duy nhất
    $str = preg_replace('/\s+/', ' ', $str);
    return trim($str);
}

function evaluateSingleCondition($data, $source, $type, $col, $op, $val, $connId = null)
{
    $dataVal = '';
    if ($col === 'source')
        $dataVal = $source;
    elseif ($col === 'type')
        $dataVal = $type;
    elseif ($col === 'connection_id')
        $dataVal = (string) $connId;
    else
        $dataVal = $data[$col] ?? '';

    $op = strtolower($op);

    // Đối với các phép so sánh ngày, không dùng chuẩn hóa chuỗi text thường
    if (in_array($op, ['date_before', 'date_after', 'date_equals'])) {
        $dataVal = mb_strtolower($dataVal, 'UTF-8');
        $val = mb_strtolower($val, 'UTF-8');
    } else {
        $dataVal = normalizeTextForComparison($dataVal);
        $val = normalizeTextForComparison($val);
    }

    switch ($op) {
        case 'contains':
            return mb_strpos($dataVal, $val) !== false;
        case 'not_contains':
            return mb_strpos($dataVal, $val) === false;
        case 'equals':
            return $dataVal === $val;
        case 'not_equals':
            return $dataVal !== $val;
        case 'starts_with':
            return mb_strpos($dataVal, $val) === 0;
        case 'ends_with':
            $valLen = mb_strlen($val, 'UTF-8');
            if ($valLen === 0)
                return true;
            return mb_substr($dataVal, -$valLen, null, 'UTF-8') === $val;
        case 'is_empty':
            return trim($dataVal) === '';
        case 'is_not_empty':
            return trim($dataVal) !== '';
        case 'date_before':
            return strtotime($dataVal) && strtotime($val) && strtotime($dataVal) < strtotime($val);
        case 'date_after':
            return strtotime($dataVal) && strtotime($val) && strtotime($dataVal) > strtotime($val);
        case 'date_equals':
            return strtotime($dataVal) && strtotime($val) && date('Y-m-d', strtotime($dataVal)) === date('Y-m-d', strtotime($val));
    }
    return false;
}

function evaluateRules($conn, $data, $source, $type, $connId = null, $connectionType = 'sheets')
{
    static $rulesCache = null;
    if ($rulesCache === null) {
        $rulesCache = [];
        $result = $conn->query("SELECT target_round_id, condition_column, condition_operator, condition_value, conditions_json, logical_operator, connection_id FROM routing_rules ORDER BY priority ASC");
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $rulesCache[] = $row;
            }
        }
    }

    foreach ($rulesCache as $row) {
        // Skip rule if it is bound to a specific connection_id and it doesn't match the incoming connection
        if (!empty($row['connection_id'])) {
            $ruleConnIds = array_map('trim', explode(',', (string) $row['connection_id']));
            $isMatched = false;

            foreach ($ruleConnIds as $ruleConnIdStr) {
                $ruleConnId = (int) $ruleConnIdStr;
                if ($ruleConnId === -1 && $connectionType === 'sheets') {
                    $isMatched = true;
                    break;
                }
                if ($ruleConnId === -2 && $connectionType === 'landing_page') {
                    $isMatched = true;
                    break;
                }
                if ($ruleConnId === -3 && $connectionType === 'manual') {
                    $isMatched = true;
                    break;
                }
                if ($ruleConnId > 0 && $ruleConnId == $connId) {
                    $isMatched = true;
                    break;
                }
            }

            if (!$isMatched)
                continue;
        }

        $logicalOperator = strtoupper($row['logical_operator'] ?? 'AND');
        $isMatch = false;

        if (!empty($row['conditions_json'])) {
            $parsed = json_decode($row['conditions_json'], true);
            if (is_array($parsed) && count($parsed) > 0) {
                // Ensure array of objects (backward compatibility for flat arrays or array of arrays)
                $branches = [];
                if (isset($parsed[0]['col'])) {
                    // Legacy: Flat array (single branch)
                    $branches = [['conditions' => $parsed]];
                } else if (isset($parsed[0][0]['col'])) {
                    // Legacy: Array of arrays (multiple branches without inject)
                    foreach ($parsed as $b) {
                        $branches[] = ['conditions' => $b];
                    }
                } else if (isset($parsed[0]['conditions'])) {
                    // New format: Array of branch objects
                    $branches = $parsed;
                }

                $isMatch = false;
                $matchedBranch = null;

                foreach ($branches as $branchObj) {
                    $conds = $branchObj['conditions'] ?? [];
                    if (!is_array($conds) || count($conds) === 0)
                        continue;

                    $branchMatch = true; // AND logic within branch
                    foreach ($conds as $cond) {
                        if (!isset($cond['col']))
                            continue;
                        if (!evaluateSingleCondition($data, $source, $type, $cond['col'], $cond['op'], $cond['val'], $connId)) {
                            $branchMatch = false;
                            break; // One condition failed, entire branch fails
                        }
                    }

                    if ($branchMatch) {
                        $isMatch = true; // OR logic between branches
                        $matchedBranch = $branchObj;
                        break; // One branch passed, rule passes
                    }
                }
            }
        } else {
            // Legacy format fallback
            $isMatch = evaluateSingleCondition($data, $source, $type, $row['condition_column'], $row['condition_operator'], $row['condition_value'], $connId);
        }

        if ($isMatch) {
            $inject = [];
            if ($matchedBranch && !empty($matchedBranch['inject'])) {
                $injectObj = $matchedBranch['inject'];
                if (isset($injectObj['enabled']) && $injectObj['enabled'] && !empty($injectObj['fields']) && is_array($injectObj['fields'])) {
                    foreach ($injectObj['fields'] as $f) {
                        if (!empty($f['col'])) {
                            $inject[$f['col']] = $f['val'];
                        }
                    }
                } else if (is_array($injectObj)) {
                    // Fallback for flat array legacy structure
                    foreach ($injectObj as $f) {
                        if (is_array($f) && !empty($f['col'])) {
                            $inject[$f['col']] = $f['val'];
                        }
                    }
                }
            }
            return [
                'target_round_id' => $row['target_round_id'],
                'inject' => $inject
            ];
        }
    }

    return null;
}

function getNextConsultantInRound($conn, $roundId)
{
    // 1. Get round info with FOR UPDATE lock
    $stmt = $conn->prepare("SELECT last_assigned_consultant_id FROM distribution_rounds WHERE id = ? AND is_active = 1 FOR UPDATE");
    $stmt->bind_param("i", $roundId);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        $stmt->close();
        return null; // Round not found or inactive
    }

    $roundInfo = $res->fetch_assoc();
    $lastAssignedId = $roundInfo['last_assigned_consultant_id'];
    $stmt->close();

    // Get absolute last assigned consultant for this round from distribution_logs to prevent back-to-back leads
    $absoluteLastAssignedId = null;
    $logStmt = $conn->prepare("SELECT assigned_to FROM distribution_logs WHERE round_id = ? ORDER BY id DESC LIMIT 1");
    if ($logStmt) {
        $logStmt->bind_param("i", $roundId);
        $logStmt->execute();
        $logRes = $logStmt->get_result();
        if ($logRow = $logRes->fetch_assoc()) {
            $absoluteLastAssignedId = $logRow['assigned_to'] !== null ? (int)$logRow['assigned_to'] : null;
        }
        $logStmt->close();
    }

    // Load starvation prevention settings
    $starvationEnabled = (int) get_system_setting($conn, 'starvation_prevention_enabled');
    $starvationMaxPerHour = (int) get_system_setting($conn, 'starvation_max_leads_per_hour');
    if ($starvationMaxPerHour <= 0) {
        $starvationMaxPerHour = 5;
    }

    // 2. Get active consultants with ALL rules
    if ($starvationEnabled === 1) {
        // Query ALL active consultants (include vacation_mode / leave so we can process and skip them)
        $cStmt = $conn->prepare("
            SELECT c.id, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
                   rc.data_per_turn, rc.current_turn_remaining, rc.skipped_credit,
                   c.vacation_mode, c.leave_start, c.leave_end, c.work_start_time, c.work_end_time, c.work_schedule
            FROM round_consultants rc 
            JOIN consultants c ON rc.consultant_id = c.id 
            WHERE rc.round_id = ? 
              AND rc.is_active = 1 
              AND c.status = 'active'
            ORDER BY c.id ASC
        ");
    } else {
        // Original query: exclude vacation mode and leave
        $cStmt = $conn->prepare("
            SELECT c.id, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
                   rc.data_per_turn, rc.current_turn_remaining, 0 as skipped_credit,
                   c.vacation_mode, c.leave_start, c.leave_end, c.work_start_time, c.work_end_time, c.work_schedule
            FROM round_consultants rc 
            JOIN consultants c ON rc.consultant_id = c.id 
            WHERE rc.round_id = ? 
              AND rc.is_active = 1 
              AND c.status = 'active' 
              AND c.vacation_mode = 0 
              AND (c.leave_start IS NULL OR CURDATE() < c.leave_start OR (c.leave_end IS NOT NULL AND c.leave_end < CURDATE()))
            ORDER BY c.id ASC
        ");
    }

    $cStmt->bind_param("i", $roundId);
    $cStmt->execute();
    $cRes = $cStmt->get_result();

    if ($cRes->num_rows === 0) {
        error_log("DOMATION ERROR: Round ID $roundId has no active consultants!");
        $cStmt->close();
        return null;
    }

    $consultants = [];
    while ($row = $cRes->fetch_assoc()) {
        $consultants[] = $row;
    }

    $starvationCounts = [];
    if ($starvationEnabled === 1 && !empty($consultants)) {
        $consultantIds = array_map(function ($c) {
            return (int) $c['id'];
        }, $consultants);
        $placeholders = implode(',', array_fill(0, count($consultantIds), '?'));

        $logStmt = $conn->prepare("
            SELECT assigned_to, COUNT(*) as cnt 
            FROM distribution_logs 
            WHERE assigned_to IN ($placeholders)
              AND status = 'compensation' 
              AND message LIKE '%(Starvation Prevention)%' 
              AND received_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            GROUP BY assigned_to
        ");
        if ($logStmt) {
            $types = str_repeat('i', count($consultantIds));
            $logStmt->bind_param($types, ...$consultantIds);
            $logStmt->execute();
            $logRes = $logStmt->get_result();
            while ($logRow = $logRes->fetch_assoc()) {
                $starvationCounts[(int) $logRow['assigned_to']] = (int) $logRow['cnt'];
            }
            $logStmt->close();
        }
    }

    $compensatedConsultant = null;
    $starvationConsultant = null;
    $midTurnConsultant = null;  // Consultant who is mid-turn (current_turn_remaining > 0)

    $today = date('Y-m-d');
    $currentTime = date('H:i');

    // Calculate active count of available consultants
    $activeCount = 0;
    foreach ($consultants as $c) {
        $isOnVacation = ($c['vacation_mode'] == 1 || (!empty($c['leave_start']) && !empty($c['leave_end']) && $today >= $c['leave_start'] && $today <= $c['leave_end']));
        if (!$isOnVacation) {
            $activeCount++;
        }
    }

    foreach ($consultants as $row) {
        // Check if consultant is available (only vacation/leave counts as unavailable for skipping)
        $isOnVacation = ($row['vacation_mode'] == 1 || (!empty($row['leave_start']) && !empty($row['leave_end']) && $today >= $row['leave_start'] && $today <= $row['leave_end']));
        $isInWorkHours = isConsultantInWorkHours($currentTime, $row['work_start_time'], $row['work_end_time'], $row['work_schedule']);
        $isAvailable = !$isOnVacation;

        // Priority 1: Compensation (error data replacement) - only if available (not on vacation)
        // BUGFIX/ENHANCEMENT: Tránh dồn dập đền bù liên tục cho cùng 1 sale. 
        // Nếu Sale này vừa nhận lead trước đó (absoluteLastAssignedId từ logs), ta sẽ bỏ qua lượt đền bù này nếu trong vòng còn có TVV khác đang hoạt động.
        $isLastAssigned = ($absoluteLastAssignedId !== null && (int)$row['id'] === (int)$absoluteLastAssignedId);
        $shouldSkipConsecutiveComp = ($isLastAssigned && $activeCount > 1);

        if (empty($compensatedConsultant) && $isAvailable && !$shouldSkipConsecutiveComp && intval($row['compensation_count']) > 0) {
            $compensatedConsultant = $row;
        }

        // Priority 2: Starvation Prevention (skipped_credit) - only if available (not on vacation), enabled, within hourly limit, and currently on shift
        // TỐI ƯU CÔNG BẰNG: Chọn người có skipped_credit cao nhất (ưu tiên ID thấp nếu hòa)
        if ($starvationEnabled === 1 && $isAvailable && $isInWorkHours && intval($row['skipped_credit']) > 0) {
            if (empty($starvationConsultant) || intval($row['skipped_credit']) > intval($starvationConsultant['skipped_credit'])) {
                $hourlyCount = $starvationCounts[(int) $row['id']] ?? 0;
                if ($hourlyCount < $starvationMaxPerHour) {
                    $starvationConsultant = $row;
                }
            }
        }

        // Priority 3: Mid-turn - only if available
        if (empty($compensatedConsultant) && empty($starvationConsultant) && empty($midTurnConsultant) && $isAvailable && intval($row['current_turn_remaining']) > 0) {
            $midTurnConsultant = $row;
        }
    }

    // === PRIORITY 1: COMPENSATION — Ai cần được đền bù thì được giao ngay ===
    if ($compensatedConsultant) {
        $nextId = $compensatedConsultant['id'];
        $compStmt = $conn->prepare("UPDATE round_consultants SET compensation_count = compensation_count - 1, skip_count = 0 WHERE round_id = ? AND consultant_id = ?");
        $compStmt->bind_param("ii", $roundId, $nextId);
        $compStmt->execute();
        $compStmt->close();
        if (isset($cStmt))
            $cStmt->close();
        return ['id' => $nextId, 'is_compensation' => true];
    }

    // === PRIORITY 2: STARVATION PREVENTION — Bù lượt thiếu do nghỉ phép/ngoài giờ ===
    if ($starvationConsultant) {
        $nextId = $starvationConsultant['id'];
        $starvStmt = $conn->prepare("UPDATE round_consultants SET skipped_credit = skipped_credit - 1, skip_count = 0 WHERE round_id = ? AND consultant_id = ?");
        $starvStmt->bind_param("ii", $roundId, $nextId);
        $starvStmt->execute();
        $starvStmt->close();
        if (isset($cStmt))
            $cStmt->close();
        return ['id' => $nextId, 'is_compensation' => true, 'is_starvation' => true];
    }

    // === PRIORITY 3: MID-TURN — Đang trong lượt nhận nhiều data, tiếp tục giao cho họ ===
    if ($midTurnConsultant) {
        $nextId = $midTurnConsultant['id'];
        // Decrement remaining counter
        $midStmt = $conn->prepare("UPDATE round_consultants SET current_turn_remaining = current_turn_remaining - 1 WHERE round_id = ? AND consultant_id = ?");
        $midStmt->bind_param("ii", $roundId, $nextId);
        $midStmt->execute();
        $midStmt->close();
        if (isset($cStmt))
            $cStmt->close();
        return ['id' => $nextId, 'is_compensation' => false];
    }

    // === PRIORITY 4: ROUND-ROBIN — Find next consultant by receive_ratio ===
    $nextIdx = 0;
    if ($lastAssignedId) {
        foreach ($consultants as $i => $c) {
            if ($c['id'] == $lastAssignedId) {
                $nextIdx = ($i + 1) % count($consultants);
                break;
            }
        }
    }

    $startIdx = $nextIdx;
    $chosenConsultant = null;
    $skippedConsultants = [];

    $skipResetStmt = $conn->prepare("UPDATE round_consultants SET skip_count = 0 WHERE round_id = ? AND consultant_id = ?");
    $skipIncrStmt = $conn->prepare("UPDATE round_consultants SET skip_count = skip_count + 1 WHERE round_id = ? AND consultant_id = ?");

    do {
        $candidate = $consultants[$nextIdx];

        // Check availability (only vacation/leave counts as unavailable for skipping)
        $isOnVacation = ($candidate['vacation_mode'] == 1 || (!empty($candidate['leave_start']) && !empty($candidate['leave_end']) && $today >= $candidate['leave_start'] && $today <= $candidate['leave_end']));
        $isAvailable = !$isOnVacation;

        if ($isAvailable) {
            $ratio = max(1, (int) ($candidate['receive_ratio'] ?? 1));
            $skipCount = (int) ($candidate['skip_count'] ?? 0);

            if ($ratio == 1 || $skipCount >= $ratio - 1) {
                $chosenConsultant = $candidate;
                $skipResetStmt->bind_param("ii", $roundId, $candidate['id']);
                $skipResetStmt->execute();
                break;
            } else {
                $skipIncrStmt->bind_param("ii", $roundId, $candidate['id']);
                $skipIncrStmt->execute();
                $nextIdx = ($nextIdx + 1) % count($consultants);
            }
        } else {
            // Unavailable or skipped due to consecutive rule
            if ($starvationEnabled === 1 && !$isAvailable) {
                $skippedConsultants[] = (int) $candidate['id'];
            }
            $nextIdx = ($nextIdx + 1) % count($consultants);
        }
    } while ($nextIdx != $startIdx);

    // Fallback: everyone is skipped or offline simultaneously
    if (!$chosenConsultant) {
        $chosenConsultant = $consultants[$startIdx];
        $skipResetStmt->bind_param("ii", $roundId, $chosenConsultant['id']);
        $skipResetStmt->execute();
        $skippedConsultants = []; // Reset skipped list
    }

    $nextId = $chosenConsultant['id'];
    $dataPerTurn = max(1, (int) ($chosenConsultant['data_per_turn'] ?? 1));

    // If data_per_turn > 1, set current_turn_remaining = dataPerTurn - 1
    if ($dataPerTurn > 1) {
        $setTurnStmt = $conn->prepare("UPDATE round_consultants SET current_turn_remaining = ? WHERE round_id = ? AND consultant_id = ?");
        $remaining = $dataPerTurn - 1;
        $setTurnStmt->bind_param("iii", $remaining, $roundId, $nextId);
        $setTurnStmt->execute();
        $setTurnStmt->close();
    }

    // Update last_assigned for round-robin tracking
    $updStmt = $conn->prepare("UPDATE distribution_rounds SET last_assigned_consultant_id = ? WHERE id = ?");
    $updStmt->bind_param("ii", $nextId, $roundId);
    $updStmt->execute();
    $updStmt->close();

    // Increment skipped_credit for bypassed/skipped consultants
    if (!empty($skippedConsultants) && $starvationEnabled === 1) {
        $placeholders = implode(',', array_fill(0, count($skippedConsultants), '?'));
        $stmtSkip = $conn->prepare("UPDATE round_consultants SET skipped_credit = skipped_credit + 1 WHERE round_id = ? AND consultant_id IN ($placeholders)");
        if ($stmtSkip) {
            $bindParams = array_merge([$roundId], $skippedConsultants);
            $types = 'i' . str_repeat('i', count($skippedConsultants));
            $stmtSkip->bind_param($types, ...$bindParams);
            $stmtSkip->execute();
            $stmtSkip->close();
        }
    }

    if (isset($skipResetStmt))
        $skipResetStmt->close();
    if (isset($skipIncrStmt))
        $skipIncrStmt->close();
    if (isset($cStmt))
        $cStmt->close();

    return ['id' => $nextId, 'is_compensation' => false];
}

function insertLead($conn, $data, $assignedConsultantId, $phone, $email, $name, $source, $type, $note, $connectionId = null, $customDate = null)
{
    $phone = normalizePhone($phone);
    if ($phone === '')
        $phone = null;
    $email = trim($email) === '' ? null : trim($email);

    $dateVal = $customDate ? $customDate : date('Y-m-d H:i:s');

    $stmt = $conn->prepare("INSERT INTO leads (phone, email, name, source, type, note, last_interaction_date, assigned_to, connection_id) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE 
                                name = IF(VALUES(name) IS NOT NULL AND VALUES(name) != '' AND (name = '' OR name IS NULL), VALUES(name), name),
                                email = IF(VALUES(email) IS NOT NULL AND VALUES(email) != '' AND (email = '' OR email IS NULL), VALUES(email), email),
                                source = VALUES(source),
                                type = VALUES(type),
                                note = IF(TRIM(VALUES(note)) = '', note, IF(IFNULL(note, '') = '', VALUES(note), CONCAT(note, '\n', VALUES(note)))),
                                last_interaction_date = VALUES(last_interaction_date),
                                assigned_to = IF(assigned_to IS NULL OR assigned_to = 0, VALUES(assigned_to), assigned_to),
                                connection_id = IF(VALUES(connection_id) IS NOT NULL, VALUES(connection_id), connection_id)");
    $stmt->bind_param("sssssssii", $phone, $email, $name, $source, $type, $note, $dateVal, $assignedConsultantId, $connectionId);
    $stmt->execute();
    $id = $stmt->insert_id;
    $stmt->close();
    if (!$id) {
        // Nếu bị duplicate key và được update, insert_id có thể bằng 0. Ta lấy ID từ DB.
        $id = 0;
        if (!empty($phone)) {
            $sStmt = $conn->prepare("SELECT id FROM leads WHERE phone = ? LIMIT 1");
            $sStmt->bind_param("s", $phone);
            $sStmt->execute();
            $id = $sStmt->get_result()->fetch_assoc()['id'] ?? 0;
            $sStmt->close();
        }
        if (!$id && !empty($email)) {
            $sStmt = $conn->prepare("SELECT id FROM leads WHERE email = ? LIMIT 1");
            $sStmt->bind_param("s", $email);
            $sStmt->execute();
            $id = $sStmt->get_result()->fetch_assoc()['id'] ?? 0;
            $sStmt->close();
        }
    }
    return $id;
}

function updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note, $connectionId = null, $customDate = null, $name = null, $onlyUpdateDate = false)
{
    $phone = normalizePhone($phone);
    if (empty($phone) && empty($email))
        return null;

    $where = [];
    $params = [];
    $types = '';

    if (!empty($phone)) {
        $where[] = "phone = ?";
        $params[] = $phone;
        $types .= 's';
    }
    if (!empty($email)) {
        $where[] = "email = ?";
        $params[] = $email;
        $types .= 's';
    }

    $id = null;
    if (!empty($phone)) {
        $sStmt = $conn->prepare("SELECT id FROM leads WHERE phone = ? LIMIT 1");
        $sStmt->bind_param("s", $phone);
        $sStmt->execute();
        $res = $sStmt->get_result();
        if ($res->num_rows > 0)
            $id = $res->fetch_assoc()['id'];
        $sStmt->close();
    }
    if (!$id && !empty($email)) {
        $sStmt = $conn->prepare("SELECT id FROM leads WHERE email = ? LIMIT 1");
        $sStmt->bind_param("s", $email);
        $sStmt->execute();
        $res = $sStmt->get_result();
        if ($res->num_rows > 0)
            $id = $res->fetch_assoc()['id'];
        $sStmt->close();
    }

    if ($id) {
        $dateVal = $customDate ? $customDate : date('Y-m-d H:i:s');
        if ($onlyUpdateDate) {
            $uStmt = $conn->prepare("UPDATE leads SET last_interaction_date = ? WHERE id = ?");
            $uStmt->bind_param("si", $dateVal, $id);
        } else if ($assignedConsultantId) {
            $uStmt = $conn->prepare("UPDATE leads SET 
                name = IF(? != '' AND (name = '' OR name IS NULL), ?, name),
                email = IF(? != '' AND (email = '' OR email IS NULL), ?, email),
                phone = IF(? != '' AND (phone = '' OR phone IS NULL), ?, phone),
                source = ?, 
                type = ?, 
                note = IF(TRIM(?) = '', note, CONCAT(IFNULL(note, ''), IF(IFNULL(note, '') = '', '', '\n'), ?)), 
                last_interaction_date = ?, 
                assigned_to = ?, 
                connection_id = IF(? IS NOT NULL, ?, connection_id) 
                WHERE id = ?");
            $uStmt->bind_param("sssssssssssiiii", $name, $name, $email, $email, $phone, $phone, $source, $type, $note, $note, $dateVal, $assignedConsultantId, $connectionId, $connectionId, $id);
        } else {
            // Don't overwrite assigned_to when lead is pending/unassigned
            $uStmt = $conn->prepare("UPDATE leads SET 
                name = IF(? != '' AND (name = '' OR name IS NULL), ?, name),
                email = IF(? != '' AND (email = '' OR email IS NULL), ?, email),
                phone = IF(? != '' AND (phone = '' OR phone IS NULL), ?, phone),
                source = ?, 
                type = ?, 
                note = IF(TRIM(?) = '', note, CONCAT(IFNULL(note, ''), IF(IFNULL(note, '') = '', '', '\n'), ?)), 
                last_interaction_date = ?, 
                connection_id = IF(? IS NOT NULL, ?, connection_id) 
                WHERE id = ?");
            $uStmt->bind_param("sssssssssssiii", $name, $name, $email, $email, $phone, $phone, $source, $type, $note, $note, $dateVal, $connectionId, $connectionId, $id);
        }
        $uStmt->execute();
        $uStmt->close();
        return $id;
    }
    return null;
}

function logDistribution($conn, $leadId, $assignedTo, $roundId, $status, $message, $triggerSync = true)
{
    $stmt = $conn->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("iiiss", $leadId, $assignedTo, $roundId, $status, $message);
    $stmt->execute();
    $stmt->close();

    if (function_exists('pruneAdminLogs')) {
        pruneAdminLogs($conn);
    }

    // Live Two-Way Sync to Google Sheets
    if ($triggerSync && function_exists('triggerTwoWaySync')) {
        triggerTwoWaySync($conn, $leadId);
    }
}

/**
 * Simulate getNextConsultantInRound WITHOUT updating the database.
 * Used for previewing who will receive the lead.
 */
function simulateNextConsultantInRound($conn, $roundId)
{
    // 1. Get round info without FOR UPDATE
    $stmt = $conn->prepare("SELECT last_assigned_consultant_id FROM distribution_rounds WHERE id = ? AND is_active = 1");
    $stmt->bind_param("i", $roundId);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        $stmt->close();
        return null; // Round not found or inactive
    }

    $roundInfo = $res->fetch_assoc();
    $lastAssignedId = $roundInfo['last_assigned_consultant_id'];
    $stmt->close();

    // Get absolute last assigned consultant for this round from distribution_logs to prevent back-to-back leads
    $absoluteLastAssignedId = null;
    $logStmt = $conn->prepare("SELECT assigned_to FROM distribution_logs WHERE round_id = ? ORDER BY id DESC LIMIT 1");
    if ($logStmt) {
        $logStmt->bind_param("i", $roundId);
        $logStmt->execute();
        $logRes = $logStmt->get_result();
        if ($logRow = $logRes->fetch_assoc()) {
            $absoluteLastAssignedId = $logRow['assigned_to'] !== null ? (int)$logRow['assigned_to'] : null;
        }
        $logStmt->close();
    }

    $starvationEnabled = (int) get_system_setting($conn, 'starvation_prevention_enabled');
    $starvationMaxPerHour = (int) get_system_setting($conn, 'starvation_max_leads_per_hour');
    if ($starvationMaxPerHour <= 0) {
        $starvationMaxPerHour = 5;
    }

    // 2. Get active consultants
    if ($starvationEnabled === 1) {
        $cStmt = $conn->prepare("
            SELECT c.id, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
                   rc.data_per_turn, rc.current_turn_remaining, rc.skipped_credit, c.name, c.zalo_chat_id, c.email, c.avatar,
                   c.vacation_mode, c.leave_start, c.leave_end, c.work_start_time, c.work_end_time, c.work_schedule
            FROM round_consultants rc 
            JOIN consultants c ON rc.consultant_id = c.id 
            WHERE rc.round_id = ? 
              AND rc.is_active = 1 
              AND c.status = 'active'
            ORDER BY c.id ASC
        ");
    } else {
        $cStmt = $conn->prepare("
            SELECT c.id, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
                   rc.data_per_turn, rc.current_turn_remaining, 0 as skipped_credit, c.name, c.zalo_chat_id, c.email, c.avatar,
                   c.vacation_mode, c.leave_start, c.leave_end, c.work_start_time, c.work_end_time, c.work_schedule
            FROM round_consultants rc 
            JOIN consultants c ON rc.consultant_id = c.id 
            WHERE rc.round_id = ? 
              AND rc.is_active = 1 
              AND c.status = 'active' 
              AND c.vacation_mode = 0 
              AND (c.leave_start IS NULL OR CURDATE() < c.leave_start OR (c.leave_end IS NOT NULL AND c.leave_end < CURDATE()))
            ORDER BY c.id ASC
        ");
    }
    $cStmt->bind_param("i", $roundId);
    $cStmt->execute();
    $cRes = $cStmt->get_result();

    if ($cRes->num_rows === 0) {
        $cStmt->close();
        return null;
    }

    $consultants = [];
    while ($row = $cRes->fetch_assoc()) {
        $consultants[] = $row;
    }

    $starvationCounts = [];
    if ($starvationEnabled === 1 && !empty($consultants)) {
        $consultantIds = array_map(function ($c) {
            return (int) $c['id'];
        }, $consultants);
        $placeholders = implode(',', array_fill(0, count($consultantIds), '?'));

        $logStmt = $conn->prepare("
            SELECT assigned_to, COUNT(*) as cnt 
            FROM distribution_logs 
            WHERE assigned_to IN ($placeholders)
              AND status = 'compensation' 
              AND message LIKE '%(Starvation Prevention)%' 
              AND received_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            GROUP BY assigned_to
        ");
        if ($logStmt) {
            $types = str_repeat('i', count($consultantIds));
            $logStmt->bind_param($types, ...$consultantIds);
            $logStmt->execute();
            $logRes = $logStmt->get_result();
            while ($logRow = $logRes->fetch_assoc()) {
                $starvationCounts[(int) $logRow['assigned_to']] = (int) $logRow['cnt'];
            }
            $logStmt->close();
        }
    }

    $compensatedConsultant = null;
    $starvationConsultant = null;
    $midTurnConsultant = null;

    $today = date('Y-m-d');
    $currentTime = date('H:i');

    // Calculate active count of available consultants
    $activeCount = 0;
    foreach ($consultants as $c) {
        $isOnVacation = ($c['vacation_mode'] == 1 || (!empty($c['leave_start']) && !empty($c['leave_end']) && $today >= $c['leave_start'] && $today <= $c['leave_end']));
        if (!$isOnVacation) {
            $activeCount++;
        }
    }

    foreach ($consultants as $row) {
        $isOnVacation = ($row['vacation_mode'] == 1 || (!empty($row['leave_start']) && !empty($row['leave_end']) && $today >= $row['leave_start'] && $today <= $row['leave_end']));
        $isInWorkHours = isConsultantInWorkHours($currentTime, $row['work_start_time'], $row['work_end_time'], $row['work_schedule']);
        $isAvailable = !$isOnVacation;

        // Priority 1: Compensation
        // BUGFIX/ENHANCEMENT: Tránh dồn dập đền bù liên tục cho cùng 1 sale.
        $isLastAssigned = ($absoluteLastAssignedId !== null && (int)$row['id'] === (int)$absoluteLastAssignedId);
        $shouldSkipConsecutiveComp = ($isLastAssigned && $activeCount > 1);

        if (empty($compensatedConsultant) && $isAvailable && !$shouldSkipConsecutiveComp && intval($row['compensation_count']) > 0) {
            $compensatedConsultant = $row;
        }

        // Priority 2: Starvation (only if on shift)
        // TỐI ƯU CÔNG BẰNG: Chọn người có skipped_credit cao nhất (ưu tiên ID thấp nếu hòa)
        if ($starvationEnabled === 1 && $isAvailable && $isInWorkHours && intval($row['skipped_credit']) > 0) {
            if (empty($starvationConsultant) || intval($row['skipped_credit']) > intval($starvationConsultant['skipped_credit'])) {
                $hourlyCount = $starvationCounts[(int) $row['id']] ?? 0;
                if ($hourlyCount < $starvationMaxPerHour) {
                    $starvationConsultant = $row;
                }
            }
        }

        // Priority 3: Mid-turn
        if (empty($compensatedConsultant) && empty($starvationConsultant) && empty($midTurnConsultant) && $isAvailable && intval($row['current_turn_remaining']) > 0) {
            $midTurnConsultant = $row;
        }
    }
    $cStmt->close();

    // === PRIORITY 1: COMPENSATION ===
    if ($compensatedConsultant) {
        return $compensatedConsultant;
    }

    // === PRIORITY 2: STARVATION ===
    if ($starvationConsultant) {
        return $starvationConsultant;
    }

    // === PRIORITY 3: MID-TURN ===
    if ($midTurnConsultant) {
        return $midTurnConsultant;
    }

    // === PRIORITY 4: ROUND-ROBIN ===
    $nextIdx = 0;
    if ($lastAssignedId) {
        foreach ($consultants as $i => $c) {
            if ($c['id'] == $lastAssignedId) {
                $nextIdx = ($i + 1) % count($consultants);
                break;
            }
        }
    }

    $startIdx = $nextIdx;
    $chosenConsultant = null;

    // Simulate skip tracking
    $simulatedConsultants = $consultants;

    do {
        $candidate = $simulatedConsultants[$nextIdx];

        $isOnVacation = ($candidate['vacation_mode'] == 1 || (!empty($candidate['leave_start']) && !empty($candidate['leave_end']) && $today >= $candidate['leave_start'] && $today <= $candidate['leave_end']));
        $isAvailable = !$isOnVacation;

        if ($isAvailable) {
            $ratio = max(1, (int) ($candidate['receive_ratio'] ?? 1));
            $skipCount = (int) ($candidate['skip_count'] ?? 0);

            if ($ratio == 1 || $skipCount >= $ratio - 1) {
                $chosenConsultant = $candidate;
                break;
            } else {
                // locally increment skip_count
                $simulatedConsultants[$nextIdx]['skip_count'] = $skipCount + 1;
                $nextIdx = ($nextIdx + 1) % count($simulatedConsultants);
            }
        } else {
            $nextIdx = ($nextIdx + 1) % count($simulatedConsultants);
        }
    } while ($nextIdx != $startIdx);

    // Fallback
    if (!$chosenConsultant) {
        $chosenConsultant = $consultants[$startIdx];
    }

    return $chosenConsultant;
}

/**
 * Check if a given time (HH:MM) is within the consultant's working hours.
 * Supports intervals spanning midnight (e.g. 22:00 to 06:00).
 * Highly resilient: supports HH:MM, HH:MM:SS, and leading/trailing spaces.
 */
function isConsultantInWorkHours($timeStr, $start, $end, $workScheduleJson = null)
{
    $timeStr = trim($timeStr ?? '');
    if (preg_match('/^(\d{2}:\d{2})/', $timeStr, $m)) {
        $timeStr = $m[1];
    } else {
        $timeStr = date('H:i');
    }

    if (!empty($workScheduleJson)) {
        $schedule = json_decode($workScheduleJson, true);
        if (is_array($schedule)) {
            // Get current day of week: 1 (Monday) to 7 (Sunday)
            $dayOfWeek = date('N');
            if (isset($schedule[$dayOfWeek])) {
                $dayConfig = $schedule[$dayOfWeek];
                $active = isset($dayConfig['active']) ? (bool) $dayConfig['active'] : false;
                if (!$active) {
                    return false; // Closed today
                }
                $start = $dayConfig['start'] ?? '00:00';
                $end = $dayConfig['end'] ?? '23:59';
            }
        }
    }

    $start = trim($start ?? '00:00');
    $end = trim($end ?? '23:59');

    if (preg_match('/^(\d{2}:\d{2})/', $start, $m)) {
        $start = $m[1];
    } else {
        $start = '00:00';
    }

    if (preg_match('/^(\d{2}:\d{2})/', $end, $m)) {
        $end = $m[1];
    } else {
        $end = '23:59';
    }

    if ($start === '00:00' && $end === '23:59') {
        return true;
    }
    if ($start === $end) {
        return true;
    }

    if ($start < $end) {
        return ($timeStr >= $start && $timeStr <= $end);
    } else {
        // Crosses midnight
        return ($timeStr >= $start || $timeStr <= $end);
    }
}

/**
 * Lấy lịch sử phân bổ gần nhất của Lead để hiển thị khi nhắc trùng
 */
function getLeadHistoryTimeline($conn, $leadId, $excludeLatestIfReminder = false)
{
    $timeline = [];
    if (empty($leadId))
        return $timeline;

    $limit = $excludeLatestIfReminder ? 6 : 5;
    $stmt = $conn->prepare("
        SELECT received_at, status, message, consultant_name, consultant_avatar, round_name, is_ticket, ticket_status, ticket_reason, ticket_reject_reason
        FROM (
            SELECT dl.received_at, dl.status, dl.message, c.name as consultant_name, c.avatar as consultant_avatar, dr.round_name,
                   0 as is_ticket, '' as ticket_status, '' as ticket_reason, '' as ticket_reject_reason
            FROM distribution_logs dl 
            LEFT JOIN consultants c ON dl.assigned_to = c.id 
            LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id 
            WHERE dl.lead_id = ?

            UNION ALL

            SELECT rep.created_at as received_at, 'ticket' as status, '' as message, c.name as consultant_name, c.avatar as consultant_avatar, dr.round_name,
                   1 as is_ticket, rep.status as ticket_status, rep.reason as ticket_reason, rep.reject_reason as ticket_reject_reason
            FROM data_reports rep
            LEFT JOIN consultants c ON rep.consultant_id = c.id
            LEFT JOIN distribution_rounds dr ON rep.round_id = dr.id
            WHERE rep.lead_id = ?
        ) AS combined
        ORDER BY received_at DESC 
        LIMIT ?
    ");
    if ($stmt) {
        $stmt->bind_param("iii", $leadId, $leadId, $limit);
        $stmt->execute();
        $res = $stmt->get_result();

        $statusTranslations = [
            'assigned' => 'Đã bàn giao',
            'reminder' => 'Nhắc trùng',
            'compensation' => 'Bù lượt',
            'silent' => 'Đồng bộ ẩn',
            'pending_work_hours' => 'Chờ khung giờ',
            'pending' => 'Chờ xử lý',
            'unassigned' => 'Chưa phân bổ',
            'ticket' => 'Báo cáo lỗi'
        ];

        $isFirst = true;
        $count = 0;
        while ($row = $res->fetch_assoc()) {
            $statusRaw = $row['status'] ?? '';

            if ($excludeLatestIfReminder && $isFirst && ($statusRaw === 'reminder' || $statusRaw === 'silent')) {
                $isFirst = false;
                continue;
            }
            $isFirst = false;

            if ($count >= 5) {
                break;
            }
            $count++;

            $statusText = $statusTranslations[$statusRaw] ?? $statusRaw;

            $msg = $row['message'] ?? '';

            // Translate common messages to Vietnamese
            $translations = [
                'Assigned via round-robin.' => 'Được phân bổ tự động qua vòng xoay.',
                'Assigned via compensation.' => 'Được phân bổ đền bù lượt lỗi.',
                'Assigned via round-robin via cron_sync.' => 'Được phân bổ tự động qua vòng xoay (đồng bộ hệ thống).',
                'Assigned via compensation via cron_sync.' => 'Được phân bổ đền bù lượt lỗi (đồng bộ hệ thống).',
                'Assigned via round-robin. (Delayed: outside working hours)' => 'Được phân bổ tự động qua vòng xoay. (Trì hoãn: ngoài khung giờ làm việc)',
                'Assigned via compensation. (Delayed: outside working hours)' => 'Được phân bổ đền bù lượt lỗi. (Trì hoãn: ngoài khung giờ làm việc)',
                'Assigned via round-robin via cron_sync. (Delayed: outside working hours)' => 'Được phân bổ tự động qua vòng xoay (đồng bộ hệ thống). (Trì hoãn: ngoài khung giờ làm việc)',
                'Assigned via compensation via cron_sync. (Delayed: outside working hours)' => 'Được phân bổ đền bù lượt lỗi (đồng bộ hệ thống). (Trì hoãn: ngoài khung giờ làm việc)',
                'No matching rule found via cron_sync.' => 'Không tìm thấy quy tắc chia số phù hợp (đồng bộ hệ thống).',
                'No active consultants in this round via cron_sync.' => 'Không có tư vấn viên nào đang hoạt động trong vòng này (đồng bộ hệ thống).',
                'Chi dong bo check trung, khong dinh tuyen (Trung so).' => 'Chỉ đồng bộ check trùng, không định tuyến (Trùng số).',
                'Chi dong bo check trung, khong dinh tuyen (Moi).' => 'Chỉ đồng bộ check trùng, không định tuyến (Mới).',
                'Trung so tu file Excel nhap vao.' => 'Trùng số từ file Excel nhập vào.',
                'Khong co Sale nhan tu file Excel.' => 'Không có Sale nhận từ file Excel.',
            ];

            foreach ($translations as $eng => $vi) {
                if (trim($msg) === $eng) {
                    $msg = $vi;
                    break;
                }
            }

            // Catch dynamic messages
            if (preg_match('/Khách cũ đăng ký lại < (\d+) tháng via cron_sync\./i', $msg, $matches)) {
                $msg = 'Khách cũ đăng ký lại < ' . $matches[1] . ' tháng (đồng bộ hệ thống).';
            } elseif (preg_match('/No matching rule\. Routed directly to fallback Admin:\s*(.*)/i', $msg, $matches)) {
                $msg = 'Không khớp quy tắc chia số. Chuyển hướng trực tiếp đến Admin dự phòng: ' . $matches[1];
            } elseif (preg_match('/No matching rule\. Routed directly to fallback Admin via cron_sync:\s*(.*)/i', $msg, $matches)) {
                $msg = 'Không khớp quy tắc chia số. Chuyển hướng trực tiếp đến Admin dự phòng (đồng bộ hệ thống): ' . $matches[1];
            } elseif (preg_match('/\(Delayed: outside working hours (.*)\)/i', $msg, $matches)) {
                $msg = preg_replace('/\(Delayed: outside working hours (.*)\)/i', '(Trì hoãn: ngoài khung giờ làm việc $1)', $msg);
            }

            $timeline[] = [
                'received_at' => $row['received_at'],
                'status' => $statusText,
                'message' => $msg,
                'consultant_name' => $row['consultant_name'],
                'consultant_avatar' => $row['consultant_avatar'],
                'round_name' => $row['round_name'],
                'is_ticket' => (int) ($row['is_ticket'] ?? 0),
                'ticket_status' => $row['ticket_status'] ?? '',
                'ticket_reason' => $row['ticket_reason'] ?? '',
                'ticket_reject_reason' => $row['ticket_reject_reason'] ?? ''
            ];
        }
        $stmt->close();
    }
    return $timeline;
}

/**
 * Gửi thông báo đồng bộ 2 chiều (write-back) ngược về Google Sheets thông qua Web App Apps Script
 */
function executeTwoWaySyncActual($conn, $leadId, &$errorMsg = null)
{
    if (empty($leadId))
        return false;

    // 1. Lấy thông tin chi tiết của Lead, Connection liên kết, và Vòng chia số
    $stmt = $conn->prepare("
        SELECT l.phone, l.email, l.name, l.note, l.type, l.assigned_to, l.connection_id, l.source,
               sc.two_way_sync, sc.google_script_url, sc.sheet_name, sc.is_active as conn_is_active,
               c.name as consultant_name,
               (
                   SELECT dr.round_name 
                   FROM distribution_logs dl
                   JOIN distribution_rounds dr ON dl.round_id = dr.id
                   WHERE dl.lead_id = l.id
                   ORDER BY dl.id DESC LIMIT 1
               ) as round_name
        FROM leads l
        LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
        LEFT JOIN consultants c ON l.assigned_to = c.id
        WHERE l.id = ? LIMIT 1
    ");
    if (!$stmt) {
        $errorMsg = "Prepare statement failed";
        return false;
    }
    $stmt->bind_param("i", $leadId);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $stmt->close();
        $errorMsg = "Lead not found";
        return false;
    }
    $lead = $res->fetch_assoc();
    $stmt->close();

    $syncSuccess = false;
    $connectionSynced = false;
    $connectionSuccess = true;

    // A. Đồng bộ riêng cho Connection liên kết (nếu có cấu hình và đang hoạt động)
    if (
        !empty($lead['connection_id']) &&
        !empty($lead['two_way_sync']) &&
        !empty($lead['google_script_url']) &&
        !empty($lead['conn_is_active'])
    ) {

        $connectionSynced = true;
        // 2. Lấy danh sách mapping của Connection này
        $mapStmt = $conn->prepare("SELECT sheet_column, system_field FROM field_mappings WHERE connection_id = ?");
        if ($mapStmt) {
            $mapStmt->bind_param("i", $lead['connection_id']);
            $mapStmt->execute();
            $mapRes = $mapStmt->get_result();

            $mappings = [];
            while ($mRow = $mapRes->fetch_assoc()) {
                $mappings[$mRow['system_field']][] = $mRow['sheet_column'];
            }
            $mapStmt->close();

            // Tìm tên các cột tương ứng trên Sheet đại diện cho SĐT và Email làm khóa tìm kiếm
            $searchColPhone = !empty($mappings['phone']) ? $mappings['phone'][0] : '';
            $searchColEmail = !empty($mappings['email']) ? $mappings['email'][0] : '';

            if (!empty($searchColPhone) || !empty($searchColEmail)) {
                // 3. Khởi tạo mảng các trường cần cập nhật
                $updates = [];

                // Ghi chú (note)
                if (!empty($mappings['note'])) {
                    foreach ($mappings['note'] as $col) {
                        $updates[$col] = $lead['note'];
                    }
                }

                // Trạng thái / Phân loại (type)
                if (!empty($mappings['type'])) {
                    foreach ($mappings['type'] as $col) {
                        $updates[$col] = $lead['type'];
                    }
                }

                // Tên Sale phụ trách (assigned_to hoặc saleperson)
                $consultantName = $lead['consultant_name'] ?? '';
                if (!empty($mappings['saleperson'])) {
                    foreach ($mappings['saleperson'] as $col) {
                        $updates[$col] = $consultantName;
                    }
                }
                if (!empty($mappings['assigned_to'])) {
                    foreach ($mappings['assigned_to'] as $col) {
                        $updates[$col] = $consultantName;
                    }
                }

                // Nguồn (source)
                if (!empty($mappings['source'])) {
                    foreach ($mappings['source'] as $col) {
                        $updates[$col] = $lead['source'];
                    }
                }

                // Họ tên (name)
                if (!empty($mappings['name'])) {
                    foreach ($mappings['name'] as $col) {
                        $updates[$col] = $lead['name'];
                    }
                }

                // Số điện thoại (phone)
                if (!empty($mappings['phone'])) {
                    foreach ($mappings['phone'] as $col) {
                        $updates[$col] = $lead['phone'];
                    }
                }

                // Email
                if (!empty($mappings['email'])) {
                    foreach ($mappings['email'] as $col) {
                        $updates[$col] = $lead['email'];
                    }
                }

                if (!empty($updates)) {
                    // 4. Tạo payload gửi qua Google Apps Script Web App
                    $payload = [
                        'sheet_name' => $lead['sheet_name'],
                        'search_col_phone' => $searchColPhone,
                        'search_val_phone' => $lead['phone'] ?? '',
                        'search_col_email' => $searchColEmail,
                        'search_val_email' => $lead['email'] ?? '',
                        'updates' => $updates
                    ];

                    $jsonData = json_encode($payload, JSON_UNESCAPED_UNICODE);

                    // Thực hiện gọi CURL
                    $ch = curl_init($lead['google_script_url']);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_POST, true);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
                    curl_setopt($ch, CURLOPT_HTTPHEADER, [
                        'Content-Type: application/json',
                        'Content-Length: ' . strlen($jsonData)
                    ]);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 3); // Timeout 3s tối đa
                    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 DOMATION CRM Client");
                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

                    $response = curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    if ($response === false) {
                        $connectionSuccess = false;
                        $errorMsg = "Connection cURL error: " . curl_error($ch);
                    } elseif ($httpCode !== 200) {
                        $connectionSuccess = false;
                        $errorMsg = "Connection HTTP status code $httpCode. Response: " . substr($response, 0, 150);
                    } else {
                        // Success! Parse the response and save row hash to prevent re-processing
                        $respData = json_decode($response, true);
                        if ($respData && ($respData['status'] ?? '') === 'success' && !empty($respData['row_values']) && !empty($respData['headers'])) {
                            $rowValues = $respData['row_values'];
                            $respHeaders = $respData['headers'];

                            $rowData = [];
                            foreach ($respHeaders as $idx => $headerName) {
                                $headerName = trim((string) $headerName);
                                if ($headerName === '')
                                    continue;
                                $rowData[$headerName] = isset($rowValues[$idx]) ? trim((string) $rowValues[$idx]) : '';
                            }

                            $newRowHash = md5(json_encode($rowData));

                            // Save the new hash to sheet_sync_records
                            $hashStmt = $conn->prepare("INSERT INTO sheet_sync_records (connection_id, row_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE row_hash = VALUES(row_hash)");
                            if ($hashStmt) {
                                $hashStmt->bind_param("is", $lead['connection_id'], $newRowHash);
                                $hashStmt->execute();
                                $hashStmt->close();
                            }
                        }
                    }
                    curl_close($ch);

                    if ($httpCode === 200) {
                        $syncSuccess = true;
                    }
                }
            }
        }
    }

    // B. Đồng bộ 2 chiều Tổng (Master Sync)
    $masterEnabled = (int) get_system_setting($conn, 'master_two_way_sync');
    $masterUrl = get_system_setting($conn, 'master_google_script_url');
    $masterSheetName = get_system_setting($conn, 'master_sheet_name');

    $masterSuccess = true;
    $masterSynced = false;

    if ($masterEnabled && !empty($masterUrl)) {
        $masterSynced = true;
        // Tạo payload Master
        $masterPayload = [
            'sheet_name' => $masterSheetName,
            'search_col_phone' => 'Số điện thoại',
            'search_val_phone' => $lead['phone'] ?? '',
            'search_col_email' => 'Email',
            'search_val_email' => $lead['email'] ?? '',
            'allow_insert' => true,
            'updates' => [
                'Thời gian' => date('Y-m-d H:i:s'),
                'Nguồn' => $lead['source'] ?? 'Hệ thống',
                'Vòng' => $lead['round_name'] ?? 'Không rõ vòng',
                'Sale phụ trách' => $lead['consultant_name'] ?? 'Chưa bàn giao',
                'Họ tên' => $lead['name'] ?? '',
                'Số điện thoại' => $lead['phone'] ?? '',
                'Email' => $lead['email'] ?? '',
                'Ghi chú' => $lead['note'] ?? '',
                'Trạng thái' => $lead['type'] ?? 'Chờ tiếp nhận'
            ]
        ];

        $jsonDataMaster = json_encode($masterPayload, JSON_UNESCAPED_UNICODE);

        $chM = curl_init($masterUrl);
        curl_setopt($chM, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($chM, CURLOPT_POST, true);
        curl_setopt($chM, CURLOPT_POSTFIELDS, $jsonDataMaster);
        curl_setopt($chM, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($jsonDataMaster)
        ]);
        curl_setopt($chM, CURLOPT_TIMEOUT, 3); // Timeout 3s tối đa
        curl_setopt($chM, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($chM, CURLOPT_USERAGENT, "Mozilla/5.0 DOMATION CRM Client");
        curl_setopt($chM, CURLOPT_SSL_VERIFYPEER, true);

        $responseM = curl_exec($chM);
        $httpCodeMaster = curl_getinfo($chM, CURLINFO_HTTP_CODE);
        if ($responseM === false) {
            $masterSuccess = false;
            $errorMsg = ($errorMsg ? $errorMsg . " | " : "") . "Master cURL error: " . curl_error($chM);
        } elseif ($httpCodeMaster !== 200) {
            $masterSuccess = false;
            $errorMsg = ($errorMsg ? $errorMsg . " | " : "") . "Master HTTP status code $httpCodeMaster. Response: " . substr($responseM, 0, 150);
        }
        curl_close($chM);

        if ($httpCodeMaster === 200) {
            $syncSuccess = true;
        }
    }

    // Trả về true nếu tất cả các luồng đồng bộ được cấu hình đều thành công
    $finalSuccess = true;
    if ($connectionSynced && !$connectionSuccess) {
        $finalSuccess = false;
    }
    if ($masterSynced && !$masterSuccess) {
        $finalSuccess = false;
    }
    if (!$connectionSynced && !$masterSynced) {
        $finalSuccess = true;
    }

    return $finalSuccess;
}

/**
 * Đẩy yêu cầu đồng bộ 2 chiều vào database queue (Outbox Pattern)
 */
function triggerTwoWaySync($conn, $leadId)
{
    if (empty($leadId))
        return false;

    // Check if sync is configured & active for this lead/connection or master sync to avoid useless queue growth
    $stmt = $conn->prepare("
        SELECT l.connection_id,
               sc.two_way_sync, sc.google_script_url, sc.is_active as conn_is_active
        FROM leads l
        LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
        WHERE l.id = ? LIMIT 1
    ");
    if (!$stmt)
        return false;
    $stmt->bind_param("i", $leadId);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $stmt->close();
        return false;
    }
    $lead = $res->fetch_assoc();
    $stmt->close();

    $needsSync = false;
    if (
        !empty($lead['connection_id']) &&
        !empty($lead['two_way_sync']) &&
        !empty($lead['google_script_url']) &&
        !empty($lead['conn_is_active'])
    ) {
        $needsSync = true;
    }

    $masterEnabled = (int) get_system_setting($conn, 'master_two_way_sync');
    $masterUrl = get_system_setting($conn, 'master_google_script_url');
    if ($masterEnabled && !empty($masterUrl)) {
        $needsSync = true;
    }

    if (!$needsSync) {
        return false;
    }

    // Thêm hoặc cập nhật yêu cầu đồng bộ vào hàng đợi sync_queue
    $queueStmt = $conn->prepare("
        INSERT INTO sync_queue (lead_id, connection_id, status, attempts, next_retry_at)
        VALUES (?, ?, 'pending', 0, NOW())
        ON DUPLICATE KEY UPDATE 
            status = 'pending',
            attempts = 0,
            next_retry_at = NOW()
    ");
    if ($queueStmt) {
        $connId = !empty($lead['connection_id']) ? (int) $lead['connection_id'] : null;
        $queueStmt->bind_param("ii", $leadId, $connId);
        $queueStmt->execute();
        $queueStmt->close();
        return true;
    }
    return false;
}

if (!function_exists('cleanLeadNoteForAI')) {
    function cleanLeadNoteForAI($note) {
        if (empty($note)) {
            return '';
        }

        // List of noisy and technical fields to discard
        $blacklist = [
            'ip', 'ipaddress', 'ip_address', 'useragent', 'user_agent', 'browser', 'device', 'platform', 'os', 
            'fbclid', 'gclid', 'dclid', 'msclkid', 'clickid', 'click_id', 'affiliateid', 'affiliate_id', 'affid',
            'utmsource', 'utmmedium', 'utmcampaign', 'utmcontent', 'utmterm', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 
            'createdat', 'created_at', 'updatedat', 'updated_at', 'id', 'connectionid', 'connection_id', 'leadid', 'lead_id', 'spreadsheetid', 'spreadsheet_id',
            'token', 'webhooktoken', 'webhook_token', 'sec', 'key', 'apikey', 'api_key', 'apikeysecret', 'api_key_secret', 'secret',
            'phone', 'sdt', 'sodienthoai', 'email', 'mail', 'name', 'hoten', 'ten', 'tenkhachhang'
        ];

        $lines = explode("\n", $note);
        $cleanedLines = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            if (strpos($line, ':') !== false) {
                list($key, $val) = explode(':', $line, 2);
                
                // Normalize key (strip spaces, strip accents, lowercase)
                $keyClean = str_replace(' ', '', strtolower(trim($key)));
                $keyClean = preg_replace('/[àáạảãâầấậẩẫăằắặẳẵ]/u', 'a', $keyClean);
                $keyClean = preg_replace('/[èéẹẻẽêềếệểễ]/u', 'e', $keyClean);
                $keyClean = preg_replace('/[ìíịỉĩ]/u', 'i', $keyClean);
                $keyClean = preg_replace('/[òóọỏõôồốộổỗơờớợởỡ]/u', 'o', $keyClean);
                $keyClean = preg_replace('/[ùúụủũưừứựửữ]/u', 'u', $keyClean);
                $keyClean = preg_replace('/[ỳýỵỷỹ]/u', 'y', $keyClean);
                $keyClean = preg_replace('/[đ]/u', 'd', $keyClean);
                
                // Skip if key is on the blacklist
                if (in_array($keyClean, $blacklist)) {
                    continue;
                }

                $valClean = trim($val);
                if ($valClean === '') {
                    continue;
                }

                // Mask any accidental sensitive data in the value
                $valClean = preg_replace('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', '[ĐÃ ẨN EMAIL]', $valClean);
                $valClean = preg_replace('/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/', '[ĐÃ ẨN SĐT]', $valClean);

                $cleanedLines[] = trim($key) . ': ' . $valClean;
            } else {
                // Free text - mask email & phone
                $lineCleaned = preg_replace('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', '[ĐÃ ẨN EMAIL]', $line);
                $lineCleaned = preg_replace('/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/', '[ĐÃ ẨN SĐT]', $lineCleaned);
                $cleanedLines[] = $lineCleaned;
            }
        }

        return implode("\n", $cleanedLines);
    }
}

function runAIScreener($conn, $leadData, $customRules = null)
{
    // 1. Check if AI screener is enabled
    $enabled = (int) get_system_setting($conn, 'ai_screener_enabled');
    if ($enabled !== 1) {
        return ['status' => 'skipped', 'reason' => 'AI Screener is disabled.'];
    }

    $apiKey = get_system_setting($conn, 'gemini_api_key');
    $model = get_system_setting($conn, 'gemini_model') ?: 'gemini-2.5-flash-lite';

    if (empty($apiKey)) {
        return ['status' => 'error', 'reason' => 'Gemini API Key is not configured.'];
    }

    $aiRules = $customRules !== null ? $customRules : get_system_setting($conn, 'ai_screener_rules');

    // Clean and sanitize note data to send only relevant fields to the AI model
    $cleanedNote = cleanLeadNoteForAI($leadData['note'] ?? '');

    // 2. Format details and prompt
    $prompt = "Bạn là Trợ lý AI có nhiệm vụ đánh giá dữ liệu khách hàng (lead) dựa trên các thông tin quy tắc.\n\n"
        . "THÔNG TIN KHÁCH HÀNG:\n"
        . "Nguồn: " . ($leadData['source'] ?? '') . "\n"
        . "Loại data: " . ($leadData['type'] ?? '') . "\n"
        . "Ghi chú:\n" . $cleanedNote . "\n\n"
        . "QUY TẮC ĐÁNH GIÁ DUY NHẤT PASSED HOẶC FAILED BÁM SÁT THEO:\n" . $aiRules . "\n\n"
        . "Nếu dữ liệu nghi ngờ spam, rác, phá hoặc không có thông tin đủ đánh giá hoặc không rõ ràng thì cứ trả về failed.\n\n"
        . "Trả về định dạng JSON duy nhất gồm 2 trường:\n"
        . "- status: \"passed\" nếu đạt tiêu chuẩn, hoặc \"failed\" nếu không đạt tiêu chuẩn.\n"
        . "- reason: giải thích ngắn gọn lý do passed/failed - TUYỆT ĐỐI KHÔNG LẬP LẠI THÔ QUY TẮC";

    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
        ],
        'generationConfig' => [
            'responseMimeType' => 'application/json'
        ]
    ];

    $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $model . ":generateContent?key=" . $apiKey;

    // 3. Make cURL POST request (SSL_VERIFYPEER enabled for production security)
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) {
        $errDetail = !empty($curlErr) ? $curlErr : "HTTP " . $httpCode;
        if ($response !== false) {
            $resJson = json_decode($response, true);
            if (isset($resJson['error']['message'])) {
                $errDetail .= " (" . $resJson['error']['message'] . ")";
            }
        }
        return ['status' => 'error', 'reason' => "Lỗi kết nối Gemini API: " . $errDetail];
    }

    $resJson = json_decode($response, true);
    if (isset($resJson['error']['message'])) {
        return ['status' => 'error', 'reason' => "Lỗi Gemini API: " . $resJson['error']['message']];
    }

    $promptTokens = 0;
    $completionTokens = 0;
    $totalTokens = 0;

    if (isset($resJson['usageMetadata'])) {
        $promptTokens = (int)($resJson['usageMetadata']['promptTokenCount'] ?? 0);
        $completionTokens = (int)($resJson['usageMetadata']['candidatesTokenCount'] ?? 0);
        $totalTokens = (int)($resJson['usageMetadata']['totalTokenCount'] ?? 0);
    } elseif (isset($resJson['usage'])) {
        $promptTokens = (int)($resJson['usage']['prompt_tokens'] ?? 0);
        $completionTokens = (int)($resJson['usage']['completion_tokens'] ?? 0);
        $totalTokens = (int)($resJson['usage']['total_tokens'] ?? 0);
    }

    $rawText = $resJson['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (empty($rawText)) {
        return ['status' => 'error', 'reason' => 'Gemini API returned an empty response.'];
    }

    // Clean markdown code blocks if any
    $cleanText = trim($rawText);
    if (preg_match('/^```json\s*([\s\S]*?)\s*```$/i', $cleanText, $m)) {
        $cleanText = trim($m[1]);
    } else if (preg_match('/^```\s*([\s\S]*?)\s*```$/', $cleanText, $m)) {
        $cleanText = trim($m[1]);
    }

    // Robust parsing: extract JSON using braces in case of conversational prefixes/suffixes
    $data = json_decode($cleanText, true);
    if (!$data && preg_match('/\{[\s\S]*\}/', $cleanText, $matches)) {
        $data = json_decode($matches[0], true);
    }

    if (!is_array($data)) {
        return ['status' => 'error', 'reason' => 'Không thể phân tích kết quả JSON trả về từ Gemini: ' . substr($rawText, 0, 100)];
    }

    // Robust key mapping
    $statusKey = '';
    $reasonKey = '';

    // 1. Scan for values that are 'passed' or 'failed' to identify status key
    foreach ($data as $key => $val) {
        if (is_string($val)) {
            $vLower = strtolower(trim($val));
            if ($vLower === 'passed' || $vLower === 'failed') {
                $statusKey = $key;
                break;
            }
        }
    }

    // 2. If status key not found by value, check common names
    if (empty($statusKey)) {
        foreach ($data as $key => $val) {
            $lowerKey = strtolower($key);
            if ($lowerKey === 'status' || $lowerKey === 'result' || $lowerKey === 'evaluation') {
                $statusKey = $key;
                break;
            }
        }
    }

    // 3. Scan for reason key among common names
    foreach ($data as $key => $val) {
        if ($key === $statusKey) {
            
            continue;
        }
        $lowerKey = strtolower($key);
        if ($lowerKey === 'reason' || $lowerKey === 'explanation' || $lowerKey === 'detail' || $lowerKey === 'details' || $lowerKey === 'note') {
            $reasonKey = $key;
            break;
        }
    }

    // 4. Fallbacks if still empty
    if (empty($statusKey)) {
        $statusKey = isset($data['status']) ? 'status' : (isset($data['Status']) ? 'Status' : '');
    }
    if (empty($reasonKey)) {
        $reasonKey = isset($data['reason']) ? 'reason' : (isset($data['Reason']) ? 'Reason' : '');
    }

    // 5. If reasonKey is still empty, pick the first key that is not statusKey
    if (empty($reasonKey) && !empty($statusKey)) {
        foreach ($data as $key => $val) {
            if ($key !== $statusKey) {
                $reasonKey = $key;
                break;
            }
        }
    }

    if (empty($statusKey) || !isset($data[$statusKey])) {
        return ['status' => 'error', 'reason' => 'Không tìm thấy trường trạng thái đánh giá trong phản hồi JSON của Gemini: ' . substr($rawText, 0, 100)];
    }

    $status = strtolower(trim($data[$statusKey]));
    if ($status !== 'passed' && $status !== 'failed') {
        $status = 'failed'; // Safe fallback for screening: if output is invalid, treat as failed (held)
    }

    $reason = !empty($reasonKey) && isset($data[$reasonKey]) ? trim($data[$reasonKey]) : 'AI không cung cấp lý do chi tiết.';

    return [
        'status' => $status,
        'reason' => $reason,
        'prompt_tokens' => $promptTokens,
        'completion_tokens' => $completionTokens,
        'total_tokens' => $totalTokens
    ];
}

function runManualScreener($conn, $leadData, $customRulesJson = null, $customAction = null)
{
    // 1. Check if AI/Manual pre-screener is enabled
    $enabled = (int) get_system_setting($conn, 'ai_screener_enabled');
    if ($enabled !== 1) {
        return ['status' => 'skipped', 'reason' => 'Screener is disabled.'];
    }

    $manualRulesJson = $customRulesJson !== null ? $customRulesJson : get_system_setting($conn, 'ai_screener_manual_rules');
    $manualAction = $customAction !== null ? $customAction : (get_system_setting($conn, 'ai_screener_manual_action') ?: 'hold');

    $branches = json_decode($manualRulesJson, true);
    if (!is_array($branches) || empty($branches)) {
        return ['status' => 'passed', 'reason' => 'Không cấu hình bộ lọc thủ công (mặc định Đạt chuẩn).', 'is_match' => false];
    }

    $source = $leadData['source'] ?? '';
    $type = $leadData['type'] ?? '';
    $connId = isset($leadData['connection_id']) ? $leadData['connection_id'] : null;

    $isMatch = false;
    $matchedDetails = [];

    foreach ($branches as $branch) {
        $branchMatch = true;
        $conds = $branch['conditions'] ?? [];
        if (empty($conds)) {
            continue;
        }

        $branchDetails = [];
        foreach ($conds as $cond) {
            $col = $cond['col'] ?? '';
            $op = $cond['op'] ?? '';
            $val = $cond['val'] ?? '';

            if (!evaluateSingleCondition($leadData, $source, $type, $col, $op, $val, $connId)) {
                $branchMatch = false;
                break;
            }
            // Translate column name
            $colNameVi = '';
            if ($col === 'note') {
                if ($op === 'contains' || $op === 'not_contains') {
                    $colNameVi = ''; // Omit column name for cleaner "có chứa '...'"
                } else {
                    $colNameVi = 'ghi chú';
                }
            } elseif ($col === 'source') {
                $colNameVi = 'nguồn';
            } elseif ($col === 'type') {
                $colNameVi = 'loại';
            } elseif ($col === 'connection_id') {
                $colNameVi = 'kết nối';
            } else {
                $colNameVi = $col; // Fallback to raw column name for custom columns
            }

            // Translate operator
            $opVi = str_replace('_', ' ', $op);
            switch ($op) {
                case 'contains':
                    $opVi = 'có chứa';
                    break;
                case 'not_contains':
                    $opVi = 'không chứa';
                    break;
                case 'equals':
                    $opVi = 'là';
                    break;
                case 'not_equals':
                    $opVi = 'khác';
                    break;
                case 'starts_with':
                    $opVi = 'bắt đầu bằng';
                    break;
                case 'ends_with':
                    $opVi = 'kết thúc bằng';
                    break;
                case 'is_empty':
                    $opVi = 'để trống';
                    break;
                case 'is_not_empty':
                    $opVi = 'không để trống';
                    break;
                case 'date_before':
                    $opVi = 'trước ngày';
                    break;
                case 'date_after':
                    $opVi = 'sau ngày';
                    break;
                case 'date_equals':
                    $opVi = 'bằng ngày';
                    break;
            }

            $prefix = $colNameVi !== '' ? "$colNameVi " : "";
            if ($op === 'is_empty' || $op === 'is_not_empty') {
                $branchDetails[] = "$prefix$opVi";
            } else {
                $branchDetails[] = "$prefix$opVi $val";
            }
        }

        if ($branchMatch) {
            $isMatch = true;
            $matchedDetails = $branchDetails;
            break;
        }
    }

    if ($isMatch) {
        $detailStr = implode(' và ', $matchedDetails);
        if ($manualAction === 'hold') {
            return [
                'status' => 'failed',
                'reason' => 'Không đạt vì ' . $detailStr,
                'is_match' => true
            ];
        } else {
            return [
                'status' => 'passed',
                'reason' => 'Đạt vì ' . $detailStr,
                'is_match' => true
            ];
        }
    } else {
        if ($manualAction === 'hold') {
            return [
                'status' => 'passed',
                'reason' => 'Không khớp bất kỳ điều kiện bộ lọc thủ công nào (Mặc định Đạt chuẩn).',
                'is_match' => false
            ];
        } else {
            return [
                'status' => 'failed',
                'reason' => 'Không khớp điều kiện bộ lọc thủ công để được phân bổ (Mặc định Tạm giữ).',
                'is_match' => false
            ];
        }
    }
}

function evaluateScreener($conn, $targetRoundId, $leadData)
{
    // 1. Check if overall AI screener is enabled
    $enabled = (int) get_system_setting($conn, 'ai_screener_enabled');
    if ($enabled !== 1) {
        return null; // skipped
    }

    // 2. Fetch the multi-configs settings key
    $configsJson = get_system_setting($conn, 'ai_screener_configs');
    $configs = json_decode($configsJson, true);

    if (is_array($configs) && !empty($configs)) {
        // Find matching configuration for this round
        foreach ($configs as $config) {
            $rounds = $config['rounds'] ?? [];
            $normalizedRounds = array_map('intval', $rounds);
            if (in_array((int) $targetRoundId, $normalizedRounds)) {
                $mode = $config['mode'] ?? 'ai';
                $aiRules = $config['ai_rules'] ?? '';
                $manualAction = $config['manual_action'] ?? 'hold';
                $manualRules = $config['manual_rules'] ?? [];
                $manualRulesJson = json_encode($manualRules);

                $result = null;
                if ($mode === 'manual') {
                    // Chế độ: Chỉ lọc thủ công (Manual Only)
                    $result = runManualScreener($conn, $leadData, $manualRulesJson, $manualAction);
                } else if ($mode === 'hybrid') {
                    // Chế độ: Kết hợp (Hybrid) - ƯU TIÊN 1: Chạy bộ lọc thủ công trước
                    $manualResult = runManualScreener($conn, $leadData, $manualRulesJson, $manualAction);
                    if ($manualResult && isset($manualResult['is_match']) && $manualResult['is_match']) {
                        // Khớp điều kiện bộ lọc thủ công -> Sử dụng luôn kết quả thủ công và BỎ QUA gọi AI
                        $result = $manualResult;
                    } else {
                        // ƯU TIÊN 2: Không khớp bộ lọc thủ công -> Đưa vào hàng đợi để gọi AI bất đồng bộ
                        $result = ['status' => 'pending', 'reason' => 'Queued for AI screening'];
                    }
                } else if ($mode === 'ai') {
                    // Chế độ: Chỉ lọc AI (AI Only) -> Đưa vào hàng đợi để gọi AI bất đồng bộ
                    $result = ['status' => 'pending', 'reason' => 'Queued for AI screening'];
                }

                if ($result) {
                    $result['below_standard_fallback_enabled'] = !empty($config['below_standard_fallback_enabled']) ? 1 : 0;
                    $result['below_standard_fallback_round_id'] = !empty($config['below_standard_fallback_round_id']) ? (int) $config['below_standard_fallback_round_id'] : 0;
                    $result['below_standard_auto_approve'] = !empty($config['below_standard_auto_approve']) ? 1 : 0;
                    return $result;
                }
                break;
            }
        }
    }

    // 3. Fallback compatibility (old settings format)
    $oldRoundsJson = get_system_setting($conn, 'ai_screener_rounds');
    $oldRounds = [];
    if (!empty($oldRoundsJson)) {
        $trimmed = trim($oldRoundsJson);
        if (strpos($trimmed, '[') === 0) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                $oldRounds = $decoded;
            }
        } else {
            $oldRounds = explode(',', $trimmed);
        }
    }
    if (is_array($oldRounds) && !empty($oldRounds)) {
        $normalizedOldRounds = array_map('intval', $oldRounds);
        if (in_array((int) $targetRoundId, $normalizedOldRounds)) {
            $mode = get_system_setting($conn, 'ai_screener_mode') ?: 'ai';
            $result = null;
            if ($mode === 'manual') {
                // Chế độ: Chỉ lọc thủ công (Manual Only)
                $result = runManualScreener($conn, $leadData);
            } else if ($mode === 'hybrid') {
                // Chế độ: Kết hợp (Hybrid) - ƯU TIÊN 1: Chạy bộ lọc thủ công trước
                $manualResult = runManualScreener($conn, $leadData);
                if ($manualResult && isset($manualResult['is_match']) && $manualResult['is_match']) {
                    // Khớp điều kiện bộ lọc thủ công -> Sử dụng luôn kết quả thủ công và BỎ QUA gọi AI
                    $result = $manualResult;
                } else {
                    // ƯU TIÊN 2: Không khớp bộ lọc thủ công -> Đưa vào hàng đợi để gọi AI bất đồng bộ
                    $result = ['status' => 'pending', 'reason' => 'Queued for AI screening'];
                }
            } else if ($mode === 'ai') {
                // Chế độ: Chỉ lọc AI (AI Only) -> Đưa vào hàng đợi để gọi AI bất đồng bộ
                $result = ['status' => 'pending', 'reason' => 'Queued for AI screening'];
            }

            if ($result) {
                $result['below_standard_fallback_enabled'] = (int) get_system_setting($conn, 'ai_screener_below_standard_fallback_enabled');
                $result['below_standard_fallback_round_id'] = (int) get_system_setting($conn, 'ai_screener_below_standard_fallback_round_id');
                $result['below_standard_auto_approve'] = (int) get_system_setting($conn, 'ai_screener_below_standard_auto_approve');
                return $result;
            }
        }
    }

    return null; // Skip evaluation
}

function sendHeldLeadNotifications($conn, $leadId, $name, $phone, $aiReason, $roundName, $email = '', $source = '', $type = '', $note = '')
{
    // 1. Fetch system setting config for daily report admins and query full account objects
    $adminsJson = get_system_setting($conn, 'daily_report_admins');
    $adminIds = json_decode($adminsJson, true);
    $admins = [];

    if (is_array($adminIds) && !empty($adminIds)) {
        $adminIds = array_map('intval', $adminIds);
        $inPlaceholders = implode(',', array_fill(0, count($adminIds), '?'));
        $types = str_repeat('i', count($adminIds));
        $adminStmt = $conn->prepare("SELECT id, email, name, zalo_chat_id FROM accounts WHERE id IN ($inPlaceholders)");
        if ($adminStmt) {
            $adminStmt->bind_param($types, ...$adminIds);
            $adminStmt->execute();
            $adminRes = $adminStmt->get_result();
            if ($adminRes) {
                while ($row = $adminRes->fetch_assoc()) {
                    $admins[] = $row;
                }
            }
            $adminStmt->close();
        }
    } else {
        // Fallback: query ticket notify admins
        $admins = getTicketNotifyAdmins($conn);
    }

    if (empty($admins)) {
        return false;
    }

    $botToken = get_system_setting($conn, 'zalo_bot_token');
    $secret = get_system_setting($conn, 'zalo_webhook_secret') ?: 'ZaloHeldLeadSaltSecret_2026';

    // 2. Build backend API URL dynamically
    $frontendUrl = get_system_setting($conn, 'frontend_url');
    if (empty($frontendUrl)) {
        $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $frontendUrl = $proto . '://' . $host;
    }
    $frontendUrl = rtrim($frontendUrl, '/');

    // Default API URL
    $apiUrl = $frontendUrl . '/api.php';

    // Check if running on localhost dev (to resolve Vite dev server mapping to PHP port)
    if (strpos($frontendUrl, 'localhost:5173') !== false || strpos($frontendUrl, 'localhost:5174') !== false || strpos($frontendUrl, 'localhost:3000') !== false) {
        $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $self = $_SERVER['PHP_SELF'] ?? '';
        if (!empty($self) && strpos($host, 'localhost:5173') === false && strpos($host, 'localhost:5174') === false) {
            $dir = str_replace('\\', '/', dirname($self));
            $dir = rtrim($dir, '/');
            $apiUrl = $proto . '://' . $host . $dir . '/api.php';
        } else {
            $apiUrl = 'http://localhost/backend/api.php';
        }
    } else {
        // Production or direct HTTP request
        $self = $_SERVER['PHP_SELF'] ?? '';
        if (!empty($self)) {
            $dir = str_replace('\\', '/', dirname($self));
            $dir = rtrim($dir, '/');
            $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? '';
            if (!empty($host)) {
                $apiUrl = $proto . '://' . $host . $dir . '/api.php';
            }
        } else {
            // CLI/Cron production fallback
            $currentDir = str_replace('\\', '/', __DIR__);
            if (strpos($currentDir, '/backend') !== false && strpos($frontendUrl, '/backend') === false && strpos($frontendUrl, 'sale_data') === false) {
                $apiUrl = $frontendUrl . '/backend/api.php';
            }
        }
    }

    foreach ($admins as $admin) {
        // Send email
        if (!empty($admin['email'])) {
            try {
                require_once __DIR__ . '/mailer.php';
                sendHeldLeadEmailToAdmin(
                    $admin['email'],
                    $admin['name'],
                    $name,
                    $phone,
                    $aiReason,
                    $roundName,
                    $email,
                    $source,
                    $type,
                    $note
                );
            } catch (Exception $e) {
                error_log("Error sending held lead email to admin " . $admin['name'] . ": " . $e->getMessage());
            }
        }

        // Send Zalo Notification
        if (!empty($botToken) && !empty($admin['zalo_chat_id'])) {
            $zaloMsg = "🔔 [ CẢNH BÁO DATA DƯỚI CHUẨN ] 🔔\n"
                . "━━━━━━━━\n"
                . "Hệ thống vừa tạm giữ 1 data do trợ lý AI đánh giá KHÔNG ĐẠT chuẩn:\n\n"
                . "👤 THÔNG TIN KHÁCH HÀNG:\n"
                . "  • Tên KH: " . (!empty($name) ? $name : "Ẩn danh") . "\n"
                . "  • Số ĐT: " . (!empty($phone) ? $phone : "Không có") . "\n"
                . "  • Email: " . (!empty($email) ? $email : "Không có") . "\n"
                . "  • Loại data: " . (!empty($type) ? $type : "Không có") . "\n"
                . "  • Nguồn: " . (!empty($source) ? $source : "Không có") . "\n"
                . "  • Vòng phân bổ dự kiến: " . (!empty($roundName) ? $roundName : "Không rõ") . "\n"
                . "  • Ghi chú: " . (!empty($note) ? $note : "Không có") . "\n\n"
                . "━━━━━━━━\n"
                . "🤖 ĐÁNH GIÁ AI:\n"
                . "  " . $aiReason . "\n";
            try {
                require_once __DIR__ . '/zalo_bot.php';
                sendZaloMessage($botToken, $admin['zalo_chat_id'], $zaloMsg, false);
            } catch (Exception $e) {
                error_log("Error sending Zalo alert to admin " . $admin['name'] . ": " . $e->getMessage());
            }
        }
    }

    return true;
}

function getScreenerConfigForRound($conn, $roundId)
{
    $configsJson = get_system_setting($conn, 'ai_screener_configs');
    $configs = json_decode($configsJson, true);
    if (is_array($configs) && !empty($configs)) {
        foreach ($configs as $config) {
            $rounds = $config['rounds'] ?? [];
            $normalizedRounds = array_map('intval', $rounds);
            if (in_array((int) $roundId, $normalizedRounds)) {
                return $config;
            }
        }
    }
    return null;
}

function sendNewLeadApiNotificationToAdmins($conn, $connData, $leadId, $customerData, $distData)
{
    // 1. Fetch target admins
    $adminsJson = get_system_setting($conn, 'daily_report_admins');
    $adminIds = json_decode($adminsJson, true);
    $admins = [];

    if (is_array($adminIds) && !empty($adminIds)) {
        $adminIds = array_map('intval', $adminIds);
        $inPlaceholders = implode(',', array_fill(0, count($adminIds), '?'));
        $types = str_repeat('i', count($adminIds));
        $adminStmt = $conn->prepare("SELECT id, email, name, zalo_chat_id FROM accounts WHERE id IN ($inPlaceholders)");
        if ($adminStmt) {
            $adminStmt->bind_param($types, ...$adminIds);
            $adminStmt->execute();
            $adminRes = $adminStmt->get_result();
            if ($adminRes) {
                while ($row = $adminRes->fetch_assoc()) {
                    $admins[] = $row;
                }
            }
            $adminStmt->close();
        }
    } else {
        $admins = getTicketNotifyAdmins($conn);
    }

    if (empty($admins)) {
        return false;
    }

    $botToken = get_system_setting($conn, 'zalo_bot_token');

    // 2. Resolve Sale Name and Round Name
    $saleName = 'Không có';
    if (!empty($distData['assigned_to_id'])) {
        $stmt = $conn->prepare("SELECT name FROM consultants WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $distData['assigned_to_id']);
            $stmt->execute();
            $res = $stmt->get_result()->fetch_assoc();
            if ($res) {
                $saleName = $res['name'];
            }
            $stmt->close();
        }
    } else if (!empty($distData['assigned_to_name'])) {
        $saleName = $distData['assigned_to_name'];
    }

    $roundName = 'Không có';
    if (!empty($distData['round_id'])) {
        $stmt = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $distData['round_id']);
            $stmt->execute();
            $res = $stmt->get_result()->fetch_assoc();
            if ($res) {
                $roundName = $res['round_name'];
            }
            $stmt->close();
        }
    } else if (!empty($distData['round_name'])) {
        $roundName = $distData['round_name'];
    }

    // 3. Map status to Vietnamese
    $statusText = 'Không rõ';
    switch ($distData['status']) {
        case 'assigned':
            $statusText = 'Chia mới thành công (Round-robin)';
            break;
        case 'compensation':
            $statusText = 'Chia đền bù';
            break;
        case 'pending_work_hours':
            $statusText = 'Tạm giữ (Ngoài giờ làm việc)';
            break;
        case 'silent':
            $statusText = 'Chỉ đồng bộ check trùng (Không chia số)';
            break;
        case 'duplicate':
            $statusText = 'Trùng số - Nhắc lại cho Sale cũ';
            break;
        case 'pending_approval':
            $statusText = 'Tạm giữ chờ AI duyệt';
            break;
        case 'unassigned':
            $statusText = 'Chưa phân bổ (Không khớp quy tắc)';
            break;
        case 'pending':
            $statusText = 'Chờ phân bổ (Vòng không có sale hoạt động)';
            break;
        case 'fallback':
            $statusText = 'Chuyển hướng Admin dự phòng';
            break;
    }

    // 4. Construct messages
    $zaloMsg = "📥 [ BÁO CÁO LEAD MỚI TỪ API ] 📥\n"
        . "━━━━━━━━\n"
        . "• Nguồn API: " . ($connData['sheet_name'] ?? 'Không rõ') . "\n"
        . "• Token: " . ($connData['webhook_token'] ?? '-') . "\n\n"
        . "👤 THÔNG TIN KHÁCH HÀNG:\n"
        . "  - Họ tên: " . (!empty($customerData['name']) ? $customerData['name'] : 'Ẩn danh') . "\n"
        . "  - Số ĐT: " . (!empty($customerData['phone']) ? $customerData['phone'] : 'Không có') . "\n"
        . "  - Email: " . (!empty($customerData['email']) ? $customerData['email'] : 'Không có') . "\n"
        . "  - Phân loại: " . (!empty($customerData['type']) ? $customerData['type'] : 'Không có') . "\n"
        . "  - Nguồn ghi nhận: " . (!empty($customerData['source']) ? $customerData['source'] : 'Không có') . "\n"
        . "  - Ghi chú: " . (!empty($customerData['note']) ? $customerData['note'] : 'Không có') . "\n\n"
        . "⚙️ THÔNG TIN PHÂN BỔ:\n"
        . "  - Trạng thái: " . $statusText . "\n"
        . "  - Vòng phân bổ: " . $roundName . "\n"
        . "  - Sale phụ trách: " . $saleName . "\n"
        . "  - Chi tiết: " . ($distData['message'] ?? 'Không có');

    $emailSubj = "[Domation API] Báo cáo Lead mới từ API - " . (!empty($customerData['name']) ? $customerData['name'] : 'Ẩn danh');
    $emailBody = "<h3>Báo cáo Lead mới nhận từ API</h3>"
        . "<p><strong>Nguồn API:</strong> " . htmlspecialchars($connData['sheet_name'] ?? 'Không rõ') . " (Token: <code>" . htmlspecialchars($connData['webhook_token'] ?? '') . "</code>)</p>"
        . "<h4>Thông tin khách hàng:</h4>"
        . "<ul>"
        . "    <li><strong>Họ tên:</strong> " . htmlspecialchars(!empty($customerData['name']) ? $customerData['name'] : 'Ẩn danh') . "</li>"
        . "    <li><strong>Số điện thoại:</strong> " . htmlspecialchars(!empty($customerData['phone']) ? $customerData['phone'] : '-') . "</li>"
        . "    <li><strong>Email:</strong> " . htmlspecialchars(!empty($customerData['email']) ? $customerData['email'] : '-') . "</li>"
        . "    <li><strong>Phân loại (Type):</strong> " . htmlspecialchars(!empty($customerData['type']) ? $customerData['type'] : '-') . "</li>"
        . "    <li><strong>Nguồn ghi nhận (Source):</strong> " . htmlspecialchars(!empty($customerData['source']) ? $customerData['source'] : '-') . "</li>"
        . "    <li><strong>Ghi chú:</strong> " . nl2br(htmlspecialchars(!empty($customerData['note']) ? $customerData['note'] : '-')) . "</li>"
        . "</ul>"
        . "<h4>Thông tin phân bổ:</h4>"
        . "<ul>"
        . "    <li><strong>Trạng thái phân bổ:</strong> " . htmlspecialchars($statusText) . "</li>"
        . "    <li><strong>Vòng phân bổ:</strong> " . htmlspecialchars($roundName) . "</li>"
        . "    <li><strong>Sale phụ trách:</strong> " . htmlspecialchars($saleName) . "</li>"
        . "    <li><strong>Chi tiết:</strong> " . htmlspecialchars($distData['message'] ?? '-') . "</li>"
        . "</ul>";

    // 5. Send notifications
    foreach ($admins as $admin) {
        // Send Zalo
        if (!empty($botToken) && !empty($admin['zalo_chat_id'])) {
            try {
                require_once __DIR__ . '/zalo_bot.php';
                sendZaloMessage($botToken, $admin['zalo_chat_id'], $zaloMsg, false);
            } catch (Exception $e) {
                error_log("Error sending new lead API Zalo to admin " . $admin['name'] . ": " . $e->getMessage());
            }
        }
        // Send Email
        if (!empty($admin['email'])) {
            try {
                require_once __DIR__ . '/mailer.php';
                sendEmailNotification($admin['email'], $emailSubj, 'Báo cáo Lead API', $emailBody, '');
            } catch (Exception $e) {
                error_log("Error sending new lead API email to admin " . $admin['name'] . ": " . $e->getMessage());
            }
        }
    }

    return true;
}


