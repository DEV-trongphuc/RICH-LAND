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

    // Keep only digits and leading +
    $hasPlusPrefix = (strpos($phone, '+') !== false && strpos(ltrim($phone), '+') === 0);
    $clean = preg_replace('/[^\d]/', '', $phone);

    if ($hasPlusPrefix) {
        // If it starts with +84, it's Vietnamese, convert to leading 0
        if (strpos($clean, '84') === 0) {
            return '0' . substr($clean, 2);
        }
        return '+' . $clean; // Keep other country codes as foreign numbers
    }

    // Handle Vietnamese numbers starting with 84 (without leading +)
    if (strpos($clean, '84') === 0 && (strlen($clean) === 10 || strlen($clean) === 11 || strlen($clean) === 9)) {
        $clean = '0' . substr($clean, 2);
    }

    // If it does not start with 0, prepend 0 (Vietnamese numbers missing leading 0, e.g. 90555555 -> 090555555)
    if (!empty($clean) && strpos($clean, '0') !== 0) {
        return '0' . $clean;
    }

    return $clean;
}

function checkGlobalExclusion($conn, $data, $phone, $email) {
    static $exclusions = null;
    if ($exclusions === null) {
        $exclusions = ['keys' => '', 'contacts' => ''];
        $res = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('global_exclusion_keys', 'global_exclusion_contacts')");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                if ($row['setting_key'] === 'global_exclusion_keys') $exclusions['keys'] = $row['setting_value'];
                if ($row['setting_key'] === 'global_exclusion_contacts') $exclusions['contacts'] = $row['setting_value'];
            }
        }
    }

    // 1. Check contacts (email / phone)
    if (!empty($exclusions['contacts'])) {
        $blacklistContacts = array_map('trim', explode(',', strtolower($exclusions['contacts'])));
        $p = strtolower(normalizePhone($phone));
        $e = strtolower(trim($email));
        foreach ($blacklistContacts as $contact) {
            if (empty($contact)) continue;
            
            if (strpos($contact, '@') !== false) {
                // Email check: exact match OR domain match if contact starts with @ (e.g. @test.com)
                if (!empty($e) && ($e === $contact || (strpos($contact, '@') === 0 && strpos($e, $contact) !== false))) {
                    return true;
                }
            } else {
                // Phone check: normalize both to ignore spacing/prefix mismatches
                $normalizedContact = strtolower(normalizePhone($contact));
                if (!empty($normalizedContact) && !empty($p) && strpos($p, $normalizedContact) !== false) {
                    return true;
                }
            }
        }
    }

    // 2. Check keys in payload (Scan ONLY values, not JSON keys/headers)
    if (!empty($exclusions['keys'])) {
        $blacklistKeys = array_map('trim', explode(',', mb_strtolower($exclusions['keys'], 'UTF-8')));
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
                return true; // Match found in payload values
            }
        }
    }

    return false;
}

function findConsultantByEmailOrName($conn, $value) {
    $value = trim($value);
    if (empty($value)) return null;
    $lowerVal = mb_strtolower($value, 'UTF-8');
    // 1. Try finding by email
    if (filter_var($value, FILTER_VALIDATE_EMAIL)) {
        $stmt = $conn->prepare("SELECT id FROM consultants WHERE LOWER(email) = ? LIMIT 1");
        $stmt->bind_param("s", $lowerVal);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        $stmt->close();
        if ($row) {
            return $row['id'];
        }
    }
    // 2. Try finding by name (case-insensitive or exact name match)
    $stmt = $conn->prepare("SELECT id FROM consultants WHERE LOWER(name) = ? LIMIT 1");
    $stmt->bind_param("s", $lowerVal);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $stmt->close();
    if ($row) {
        return $row['id'];
    }
    return null;
}

function checkCRMInteraction($conn, $phone, $email) {
    if (empty($phone) && empty($email)) {
        return ['isDuplicate' => false, 'monthsSinceLastInteraction' => 0, 'assignedTo' => null];
    }
    
    $where = [];
    $params = [];
    $types = '';
    
    $phone = normalizePhone($phone);
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
    
    $whereClause = implode(" OR ", $where);
    $stmt = $conn->prepare("SELECT assigned_to, last_interaction_date FROM leads WHERE $whereClause ORDER BY last_interaction_date DESC LIMIT 1");
    
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
        
        return [
            'isDuplicate' => true,
            'monthsSinceLastInteraction' => $months,
            'assignedTo' => $row['assigned_to']
        ];
    }
    
    return [
        'isDuplicate' => false,
        'monthsSinceLastInteraction' => 0,
        'assignedTo' => null
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
        return null; // Round not found or inactive
    }
    
    $roundInfo = $res->fetch_assoc();
    $lastAssignedId = $roundInfo['last_assigned_consultant_id'];
    $stmt->close();
    
    // 2. Get active consultants with ALL rules (include data_per_turn, current_turn_remaining)
    $cStmt = $conn->prepare("
        SELECT c.id, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
               rc.data_per_turn, rc.current_turn_remaining
        FROM round_consultants rc 
        JOIN consultants c ON rc.consultant_id = c.id 
        WHERE rc.round_id = ? AND rc.is_active = 1 AND c.status = 'active' 
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

function insertLead($conn, $data, $assignedConsultantId, $phone, $email, $name, $source, $type, $note, $connectionId = null) {
    $phone = normalizePhone($phone);
    if ($phone === '') $phone = null;
    $email = trim($email) === '' ? null : trim($email);
    
    $stmt = $conn->prepare("INSERT INTO leads (phone, email, name, source, type, note, last_interaction_date, assigned_to, connection_id) 
                            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)
                            ON DUPLICATE KEY UPDATE 
                                name = IF(VALUES(name) != '' AND name = '', VALUES(name), name),
                                email = IF(VALUES(email) != '' AND email = '', VALUES(email), email),
                                source = VALUES(source),
                                type = VALUES(type),
                                note = IF(TRIM(VALUES(note)) = '', note, IF(IFNULL(note, '') = '', VALUES(note), CONCAT(note, '\n', VALUES(note)))),
                                last_interaction_date = NOW(),
                                assigned_to = VALUES(assigned_to),
                                connection_id = IF(VALUES(connection_id) IS NOT NULL, VALUES(connection_id), connection_id)");
    $stmt->bind_param("ssssssii", $phone, $email, $name, $source, $type, $note, $assignedConsultantId, $connectionId);
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

function updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note, $connectionId = null) {
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
        // NEW-02 fix: Only update assigned_to if we actually have a consultant
        if ($assignedConsultantId) {
            $uStmt = $conn->prepare("UPDATE leads SET source = ?, type = ?, note = IF(TRIM(?) = '', note, CONCAT(IFNULL(note, ''), IF(IFNULL(note, '') = '', '', '\n'), ?)), last_interaction_date = NOW(), assigned_to = ?, connection_id = IF(? IS NOT NULL, ?, connection_id) WHERE id = ?");
            $uStmt->bind_param("ssssiiii", $source, $type, $note, $note, $assignedConsultantId, $connectionId, $connectionId, $id);
        } else {
            // Don't overwrite assigned_to when lead is pending/unassigned
            $uStmt = $conn->prepare("UPDATE leads SET source = ?, type = ?, note = IF(TRIM(?) = '', note, CONCAT(IFNULL(note, ''), IF(IFNULL(note, '') = '', '', '\n'), ?)), last_interaction_date = NOW(), connection_id = IF(? IS NOT NULL, ?, connection_id) WHERE id = ?");
            $uStmt->bind_param("ssssiii", $source, $type, $note, $note, $connectionId, $connectionId, $id);
        }
        $uStmt->execute();
        $uStmt->close();
        return $id;
    }
    return null;
}

function logDistribution($conn, $leadId, $assignedTo, $roundId, $status, $message) {
    $stmt = $conn->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("iiiss", $leadId, $assignedTo, $roundId, $status, $message);
    $stmt->execute();
    $stmt->close();
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
    
    // 2. Get active consultants with ALL rules
    $cStmt = $conn->prepare("
        SELECT c.id, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
               rc.data_per_turn, rc.current_turn_remaining, c.name, c.zalo_chat_id, c.email
        FROM round_consultants rc 
        JOIN consultants c ON rc.consultant_id = c.id 
        WHERE rc.round_id = ? AND rc.is_active = 1 AND c.status = 'active' 
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

