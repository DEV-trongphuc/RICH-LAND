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
function normalizePhone($phoneRaw) {
    if (empty($phoneRaw)) return '';
    $phone = trim((string)$phoneRaw);

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
function normalizeDate($dateRaw) {
    if (empty($dateRaw)) return null;
    $dateStr = trim((string)$dateRaw);
    if ($dateStr === '') return null;

    // 1. If it's already Y-m-d H:i:s
    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $dateStr)) {
        return $dateStr;
    }

    // 2. Try parsing DMY format: dd-mm-yyyy hh:ii:ss or dd/mm/yyyy hh:ii:ss
    if (preg_match('/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/', $dateStr, $matches)) {
        $day = (int)$matches[1];
        $month = (int)$matches[2];
        $year = (int)$matches[3];
        $hour = isset($matches[4]) ? (int)$matches[4] : 0;
        $minute = isset($matches[5]) ? (int)$matches[5] : 0;
        $second = isset($matches[6]) ? (int)$matches[6] : 0;
        
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
        $days = (float)$dateStr;
        // Excel base date is 1900-01-01
        $timestamp = ($days - 25569) * 86400;
        if ($timestamp > 0) {
            return date('Y-m-d H:i:s', $timestamp);
        }
    }

    return null;
}

function checkGlobalExclusion($conn, $data, $phone, $email, $notifyAdmins = false, $name = '', $source = '', $type = '', $note = '') {
    static $exclusions = null;
    static $blacklistContacts = null;
    static $blacklistKeys = null;
    if ($exclusions === null) {
        $exclusions = ['keys' => '', 'contacts' => ''];
        $res = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('global_exclusion_keys', 'global_exclusion_contacts')");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                if ($row['setting_key'] === 'global_exclusion_keys') $exclusions['keys'] = $row['setting_value'];
                if ($row['setting_key'] === 'global_exclusion_contacts') $exclusions['contacts'] = $row['setting_value'];
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
            if (empty($contact)) continue;
            
            if (strpos($contact, '@') !== false) {
                // Email check: exact match OR domain match if contact starts with @ (e.g. @test.com)
                if (!empty($e) && ($e === $contact || (strpos($contact, '@') === 0 && strpos($e, $contact) !== false))) {
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
        array_walk_recursive($scanData, function($v) use (&$values) {
            if (!is_null($v) && !is_bool($v)) {
                $values[] = $v;
            }
        });
        
        $payloadStr = mb_strtolower(implode(' | ', $values), 'UTF-8');
        
        foreach ($blacklistKeys as $key) {
            if (empty($key)) continue;
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
                
                // 2. Query all admins
                $adminRes = $conn->query("SELECT name, email, zalo_chat_id FROM accounts WHERE role = 'admin'");
                if ($adminRes) {
                    $admins = [];
                    while ($row = $adminRes->fetch_assoc()) {
                        $admins[] = $row;
                    }
                    
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
                                    sendZaloMessage($botToken, $admin['zalo_chat_id'], $zaloMsg);
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

function findConsultantByEmailOrName($conn, $value) {
    $value = trim($value);
    if (empty($value)) return null;
    $lowerVal = mb_strtolower($value, 'UTF-8');
    
    // Sử dụng bộ nhớ đệm static cache tránh truy vấn DB lặp lại nhiều lần
    static $consultantNameIdCache = [];
    if (array_key_exists($lowerVal, $consultantNameIdCache)) {
        return $consultantNameIdCache[$lowerVal];
    }
    
    // 1. Try finding by email
    if (filter_var($value, FILTER_VALIDATE_EMAIL)) {
        $stmt = $conn->prepare("SELECT id FROM consultants WHERE LOWER(email) = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("s", $lowerVal);
            $stmt->execute();
            $res = $stmt->get_result();
            $row = $res->fetch_assoc();
            $stmt->close();
            if ($row) {
                $consultantNameIdCache[$lowerVal] = (int)$row['id'];
                return $consultantNameIdCache[$lowerVal];
            }
        }
    }
    // 2. Try finding by name (case-insensitive or exact name match)
    $stmt = $conn->prepare("SELECT id FROM consultants WHERE LOWER(name) = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("s", $lowerVal);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        $stmt->close();
        if ($row) {
            $consultantNameIdCache[$lowerVal] = (int)$row['id'];
            return $consultantNameIdCache[$lowerVal];
        }
    }
    $consultantNameIdCache[$lowerVal] = null;
    return null;
}

function checkCRMInteraction($conn, $phone, $email, $ignoreReassignIfOwnerInactive = false) {
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
        $phoneParts = preg_split('/[,;\/]|(?:\s+hoặc\s+)|(?:\s+or\s+)|(?:\s+và\s+)|(?:\s+and\s+)|\s+/i', (string)$phone);
        foreach ($phoneParts as $part) {
            $part = trim($part);
            if (empty($part)) continue;
            $norm = normalizePhone($part);
            if (!empty($norm) && !in_array($norm, $phones)) {
                $phones[] = $norm;
            }
        }
    }
    
    // Split and clean multiple email addresses if present
    $emails = [];
    if (!empty($email)) {
        $emailParts = preg_split('/[,;\/\s]+/i', (string)$email);
        foreach ($emailParts as $part) {
            $part = trim(strtolower($part));
            if (empty($part)) continue;
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
    $stmt = $conn->prepare("SELECT l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end 
                            FROM leads l 
                            LEFT JOIN consultants c ON l.assigned_to = c.id 
                            WHERE $whereClause 
                            ORDER BY l.last_interaction_date DESC LIMIT 1");
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $res = $stmt->get_result();
    $stmt->close();
    
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
        if ($consultantStatus === 'leave') {
            $isActuallyOnLeave = true;
        } else if ($consultantStatus === 'active' && !empty($leaveStart)) {
            if ($today >= $leaveStart && (empty($leaveEnd) || $today <= $leaveEnd)) {
                $isActuallyOnLeave = true;
            }
        }
        
        $effectiveStatus = $isActuallyOnLeave ? 'leave' : $consultantStatus;
        
        if ($reassignIfOwnerInactive === '1' && !$ignoreReassignIfOwnerInactive) {
            $isDuplicate = ($effectiveStatus === 'active');
            $assignedTo = $isDuplicate ? $row['assigned_to'] : null;
        } else {
            // OFF or ignored: Always count as duplicate, keep the original owner
            $isDuplicate = true;
            $assignedTo = $row['assigned_to'];
        }
        
        return [
            'isDuplicate' => $isDuplicate,
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
        'monthsSinceLastInteraction' => 0,
        'assignedTo' => null,
        'assignedName' => 'Không rõ',
        'lastInteractionDate' => null,
        'originalAssignedTo' => null,
        'consultantStatus' => null
    ];
}

function evaluateSingleCondition($data, $source, $type, $col, $op, $val, $connId = null) {
    $dataVal = '';
    if ($col === 'source') $dataVal = $source;
    elseif ($col === 'type') $dataVal = $type;
    elseif ($col === 'connection_id') $dataVal = (string)$connId;
    else $dataVal = $data[$col] ?? '';
    
    $dataVal = mb_strtolower($dataVal, 'UTF-8');
    $val = mb_strtolower($val, 'UTF-8');
    $op = strtolower($op);
    
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
            if ($valLen === 0) return true;
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

function evaluateRules($conn, $data, $source, $type, $connId = null, $connectionType = 'sheets') {
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
            $ruleConnIds = array_map('trim', explode(',', (string)$row['connection_id']));
            $isMatched = false;
            
            foreach ($ruleConnIds as $ruleConnIdStr) {
                $ruleConnId = (int)$ruleConnIdStr;
                if ($ruleConnId === -1 && $connectionType === 'sheets') { $isMatched = true; break; }
                if ($ruleConnId === -2 && $connectionType === 'landing_page') { $isMatched = true; break; }
                if ($ruleConnId === -3 && $connectionType === 'manual') { $isMatched = true; break; }
                if ($ruleConnId > 0 && $ruleConnId == $connId) { $isMatched = true; break; }
            }
            
            if (!$isMatched) continue;
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
                    if (!is_array($conds) || count($conds) === 0) continue;
                    
                    $branchMatch = true; // AND logic within branch
                    foreach ($conds as $cond) {
                        if (!isset($cond['col'])) continue;
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
            if (isset($matchedBranch['inject']) && !empty($matchedBranch['inject']['enabled']) && !empty($matchedBranch['inject']['fields'])) {
                foreach ($matchedBranch['inject']['fields'] as $f) {
                    if (!empty($f['col'])) {
                        $inject[$f['col']] = $f['val'];
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

function getNextConsultantInRound($conn, $roundId) {
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
    
    // 2. Get active consultants with ALL rules (include data_per_turn, current_turn_remaining), excluding those on active leave
    $cStmt = $conn->prepare("
        SELECT c.id, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
               rc.data_per_turn, rc.current_turn_remaining
        FROM round_consultants rc 
        JOIN consultants c ON rc.consultant_id = c.id 
        WHERE rc.round_id = ? 
          AND rc.is_active = 1 
          AND c.status = 'active' 
          AND c.vacation_mode = 0 
          AND (c.leave_start IS NULL OR CURDATE() < c.leave_start OR (c.leave_end IS NOT NULL AND c.leave_end < CURDATE()))
        ORDER BY c.id ASC
    ");
    $cStmt->bind_param("i", $roundId);
    $cStmt->execute();
    $cRes = $cStmt->get_result();
    
    if ($cRes->num_rows === 0) {
        error_log("DOMATION ERROR: Round ID $roundId has no active consultants!");
        $cStmt->close();
        return null;
    }
    
    $consultants = [];
    $compensatedConsultant = null;
    $midTurnConsultant = null;  // Consultant who is mid-turn (current_turn_remaining > 0)
    
    while ($row = $cRes->fetch_assoc()) {
        $consultants[] = $row;
        // Priority 1: Compensation (error data replacement)
        if (empty($compensatedConsultant) && intval($row['compensation_count']) > 0) {
            $compensatedConsultant = $row;
        }
        // Priority 2: Mid-turn (has remaining data_per_turn slots)
        if (empty($midTurnConsultant) && intval($row['current_turn_remaining']) > 0) {
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
        if (isset($cStmt)) $cStmt->close();
        // Note: Do NOT update last_assigned_consultant_id here. 
        // Compensation is an out-of-band assignment and shouldn't disrupt the normal round-robin order.
        return ['id' => $nextId, 'is_compensation' => true];
    }

    // === PRIORITY 2: MID-TURN — Đang trong lượt nhận nhiều data, tiếp tục giao cho họ ===
    if ($midTurnConsultant) {
        $nextId = $midTurnConsultant['id'];
        // Decrement remaining counter
        $midStmt = $conn->prepare("UPDATE round_consultants SET current_turn_remaining = current_turn_remaining - 1 WHERE round_id = ? AND consultant_id = ?");
        $midStmt->bind_param("ii", $roundId, $nextId);
        $midStmt->execute();
        $midStmt->close();
        if (isset($cStmt)) $cStmt->close();
        // Note: do NOT update last_assigned here — keeps position for proper round-robin next turn
        return ['id' => $nextId, 'is_compensation' => false];
    }
    
    // === PRIORITY 3: ROUND-ROBIN — Find next consultant by receive_ratio ===
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
    
    $skipResetStmt = $conn->prepare("UPDATE round_consultants SET skip_count = 0 WHERE round_id = ? AND consultant_id = ?");
    $skipIncrStmt  = $conn->prepare("UPDATE round_consultants SET skip_count = skip_count + 1 WHERE round_id = ? AND consultant_id = ?");
    do {
        $candidate = $consultants[$nextIdx];
        $ratio     = max(1, (int)($candidate['receive_ratio'] ?? 1));
        $skipCount = (int)($candidate['skip_count'] ?? 0);
        
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
    } while ($nextIdx != $startIdx);
    
    // Fallback: everyone is skipped simultaneously → pick start
    if (!$chosenConsultant) {
        $chosenConsultant = $consultants[$startIdx];
        $skipResetStmt->bind_param("ii", $roundId, $chosenConsultant['id']);
        $skipResetStmt->execute();
    }
    
    $nextId    = $chosenConsultant['id'];
    $dataPerTurn = max(1, (int)($chosenConsultant['data_per_turn'] ?? 1));
    
    // If data_per_turn > 1, set current_turn_remaining = dataPerTurn - 1
    // (minus 1 because this call already counts as the first assignment)
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
    
    if (isset($skipResetStmt)) $skipResetStmt->close();
    if (isset($skipIncrStmt)) $skipIncrStmt->close();
    if (isset($cStmt)) $cStmt->close();
    
    return ['id' => $nextId, 'is_compensation' => false];
}

function insertLead($conn, $data, $assignedConsultantId, $phone, $email, $name, $source, $type, $note, $connectionId = null, $customDate = null) {
    $phone = normalizePhone($phone);
    if ($phone === '') $phone = null;
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

function updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note, $connectionId = null, $customDate = null, $name = null, $onlyUpdateDate = false) {
    $phone = normalizePhone($phone);
    if (empty($phone) && empty($email)) return null;
    
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
        if ($res->num_rows > 0) $id = $res->fetch_assoc()['id'];
        $sStmt->close();
    }
    if (!$id && !empty($email)) {
        $sStmt = $conn->prepare("SELECT id FROM leads WHERE email = ? LIMIT 1");
        $sStmt->bind_param("s", $email);
        $sStmt->execute();
        $res = $sStmt->get_result();
        if ($res->num_rows > 0) $id = $res->fetch_assoc()['id'];
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

function logDistribution($conn, $leadId, $assignedTo, $roundId, $status, $message, $triggerSync = true) {
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
function simulateNextConsultantInRound($conn, $roundId) {
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
    
    // 2. Get active consultants with ALL rules, excluding those on active leave
    $cStmt = $conn->prepare("
        SELECT c.id, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
               rc.data_per_turn, rc.current_turn_remaining, c.name, c.zalo_chat_id, c.email, c.avatar
        FROM round_consultants rc 
        JOIN consultants c ON rc.consultant_id = c.id 
        WHERE rc.round_id = ? 
          AND rc.is_active = 1 
          AND c.status = 'active' 
          AND c.vacation_mode = 0 
          AND (c.leave_start IS NULL OR CURDATE() < c.leave_start OR (c.leave_end IS NOT NULL AND c.leave_end < CURDATE()))
        ORDER BY c.id ASC
    ");
    $cStmt->bind_param("i", $roundId);
    $cStmt->execute();
    $cRes = $cStmt->get_result();
    
    if ($cRes->num_rows === 0) {
        $cStmt->close();
        return null;
    }
    
    $consultants = [];
    $compensatedConsultant = null;
    $midTurnConsultant = null;
    
    while ($row = $cRes->fetch_assoc()) {
        $consultants[] = $row;
        // Priority 1: Compensation
        if (empty($compensatedConsultant) && intval($row['compensation_count']) > 0) {
            $compensatedConsultant = $row;
        }
        // Priority 2: Mid-turn
        if (empty($midTurnConsultant) && intval($row['current_turn_remaining']) > 0) {
            $midTurnConsultant = $row;
        }
    }
    $cStmt->close();
    
    // === PRIORITY 1: COMPENSATION ===
    if ($compensatedConsultant) {
        return $compensatedConsultant;
    }

    // === PRIORITY 2: MID-TURN ===
    if ($midTurnConsultant) {
        return $midTurnConsultant;
    }
    
    // === PRIORITY 3: ROUND-ROBIN ===
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
        $ratio     = max(1, (int)($candidate['receive_ratio'] ?? 1));
        $skipCount = (int)($candidate['skip_count'] ?? 0);
        
        if ($ratio == 1 || $skipCount >= $ratio - 1) {
            $chosenConsultant = $candidate;
            break;
        } else {
            // locally increment skip_count
            $simulatedConsultants[$nextIdx]['skip_count'] = $skipCount + 1;
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
function isConsultantInWorkHours($timeStr, $start, $end, $workScheduleJson = null) {
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
                $active = isset($dayConfig['active']) ? (bool)$dayConfig['active'] : false;
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
function getLeadHistoryTimeline($conn, $leadId, $excludeLatestIfReminder = false) {
    $timeline = [];
    if (empty($leadId)) return $timeline;

    $limit = $excludeLatestIfReminder ? 6 : 5;
    $stmt = $conn->prepare("
        SELECT dl.received_at, dl.status, dl.message, c.name as consultant_name, c.avatar as consultant_avatar, dr.round_name 
        FROM distribution_logs dl 
        LEFT JOIN consultants c ON dl.assigned_to = c.id 
        LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id 
        WHERE dl.lead_id = ? 
        ORDER BY dl.received_at DESC 
        LIMIT ?
    ");
    if ($stmt) {
        $stmt->bind_param("ii", $leadId, $limit);
        $stmt->execute();
        $res = $stmt->get_result();
        
        $statusTranslations = [
            'assigned' => 'Đã bàn giao',
            'reminder' => 'Nhắc trùng',
            'compensation' => 'Bù lượt',
            'silent' => 'Đồng bộ ẩn',
            'pending_work_hours' => 'Chờ khung giờ',
            'pending' => 'Chờ xử lý',
            'unassigned' => 'Chưa phân bổ'
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
                'round_name' => $row['round_name']
            ];
        }
        $stmt->close();
    }
    return $timeline;
}

/**
 * Gửi thông báo đồng bộ 2 chiều (write-back) ngược về Google Sheets thông qua Web App Apps Script
 */
function triggerTwoWaySync($conn, $leadId) {
    if (empty($leadId)) return false;

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
    if (!$stmt) return false;
    $stmt->bind_param("i", $leadId);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $stmt->close();
        return false;
    }
    $lead = $res->fetch_assoc();
    $stmt->close();

    $syncSuccess = false;

    // A. Đồng bộ riêng cho Connection liên kết (nếu có cấu hình và đang hoạt động)
    if (!empty($lead['connection_id']) && 
        !empty($lead['two_way_sync']) && 
        !empty($lead['google_script_url']) && 
        !empty($lead['conn_is_active'])) {
        
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
                    
                    curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
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

    if ($masterEnabled && !empty($masterUrl)) {
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
        
        curl_exec($chM);
        $httpCodeMaster = curl_getinfo($chM, CURLINFO_HTTP_CODE);
        curl_close($chM);

        if ($httpCodeMaster === 200) {
            $syncSuccess = true;
        }
    }

    return $syncSuccess;
}



