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
    $hasPlusPrefix = (strpos($phone, '+') !== false);
    $clean = preg_replace('/[^\d]/', '', $phone);

    // If original had a + at start, restore it (foreign number)
    if ($hasPlusPrefix && strpos(ltrim($phone), '+') === 0) {
        // Check if it's +84 (Vietnamese)
        if (strpos($clean, '84') === 0 && strlen($clean) >= 11) {
            return '0' . substr($clean, 2); // +84xxx → 0xxx
        }
        return '+' . $clean; // Keep as foreign number
    }

    // No plus sign — pure digits
    // Handle 84xxxxxxxxx (11 digits, Vietnamese without +)
    if (strpos($clean, '84') === 0 && strlen($clean) === 11) {
        return '0' . substr($clean, 2);
    }

    return $clean;
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

function evaluateSingleCondition($data, $source, $type, $col, $op, $val) {
    $dataVal = '';
    if ($col === 'source') $dataVal = $source;
    elseif ($col === 'type') $dataVal = $type;
    else $dataVal = $data[$col] ?? '';
    
    $dataVal = strtolower($dataVal);
    $val = strtolower($val);
    $op = strtolower($op);
    
    switch ($op) {
        case 'contains':
            return strpos($dataVal, $val) !== false;
        case 'not_contains':
            return strpos($dataVal, $val) === false;
        case 'equals':
            return $dataVal === $val;
        case 'not_equals':
            return $dataVal !== $val;
        case 'starts_with':
            return strpos($dataVal, $val) === 0;
        case 'ends_with':
            return substr($dataVal, -strlen($val)) === $val;
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

function evaluateRules($conn, $data, $source, $type) {
    $result = $conn->query("SELECT target_round_id, condition_column, condition_operator, condition_value, conditions_json, logical_operator FROM routing_rules ORDER BY priority ASC");
    
    while ($row = $result->fetch_assoc()) {
        $logicalOperator = strtoupper($row['logical_operator'] ?? 'AND');
        $isMatch = false;

        if (!empty($row['conditions_json'])) {
            $parsed = json_decode($row['conditions_json'], true);
            if (is_array($parsed) && count($parsed) > 0) {
                // Ensure array of arrays (backward compatibility for flat arrays)
                $branches = isset($parsed[0]['col']) ? [$parsed] : $parsed;
                
                $isMatch = false;
                foreach ($branches as $branch) {
                    if (!is_array($branch) || count($branch) === 0) continue;
                    
                    $branchMatch = true; // AND logic within branch
                    foreach ($branch as $cond) {
                        if (!isset($cond['col'])) continue;
                        if (!evaluateSingleCondition($data, $source, $type, $cond['col'], $cond['op'], $cond['val'])) {
                            $branchMatch = false;
                            break; // One condition failed, entire branch fails
                        }
                    }
                    
                    if ($branchMatch) {
                        $isMatch = true; // OR logic between branches
                        break; // One branch passed, rule passes
                    }
                }
            }
        } else {
            // Legacy format fallback
            $isMatch = evaluateSingleCondition($data, $source, $type, $row['condition_column'], $row['condition_operator'], $row['condition_value']);
        }
        
        if ($isMatch) {
            return $row['target_round_id'];
        }
    }
    
    return null;
}

function getNextConsultantInRound($conn, $roundId) {
    // Start transaction to prevent race conditions
    $conn->begin_transaction();

    // 1. Get round info with FOR UPDATE lock
    $stmt = $conn->prepare("SELECT last_assigned_consultant_id FROM distribution_rounds WHERE id = ? AND is_active = 1 FOR UPDATE");
    $stmt->bind_param("i", $roundId);
    $stmt->execute();
    $res = $stmt->get_result();
    
    if ($res->num_rows === 0) {
        $conn->rollback();
        return null; // Round not found or inactive
    }
    
    $roundInfo = $res->fetch_assoc();
    $lastAssignedId = $roundInfo['last_assigned_consultant_id'];
    
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
        // Self-healing fallback: Find ANY active consultant in the entire system
        $fbStmt = $conn->prepare("SELECT id FROM consultants WHERE status = 'active' ORDER BY id ASC LIMIT 1");
        if ($fbStmt) {
            $fbStmt->execute();
            $fbRes = $fbStmt->get_result();
            if ($fbRes->num_rows > 0) {
                $fallbackId = $fbRes->fetch_assoc()['id'];
                $conn->commit();
                return $fallbackId;
            }
        }
        $conn->rollback();
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
        $updStmt = $conn->prepare("UPDATE distribution_rounds SET last_assigned_consultant_id = ? WHERE id = ?");
        $updStmt->bind_param("ii", $nextId, $roundId);
        $updStmt->execute();
        $conn->commit();
        return $nextId;
    }

    // === PRIORITY 2: MID-TURN — Đang trong lượt nhận nhiều data, tiếp tục giao cho họ ===
    if ($midTurnConsultant) {
        $nextId = $midTurnConsultant['id'];
        // Decrement remaining counter
        $midStmt = $conn->prepare("UPDATE round_consultants SET current_turn_remaining = current_turn_remaining - 1 WHERE round_id = ? AND consultant_id = ?");
        $midStmt->bind_param("ii", $roundId, $nextId);
        $midStmt->execute();
        // Note: do NOT update last_assigned here — keeps position for proper round-robin next turn
        $conn->commit();
        return $nextId;
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
    }
    
    // Update last_assigned for round-robin tracking
    $updStmt = $conn->prepare("UPDATE distribution_rounds SET last_assigned_consultant_id = ? WHERE id = ?");
    $updStmt->bind_param("ii", $nextId, $roundId);
    $updStmt->execute();
    
    // Commit transaction
    $conn->commit();
    
    return $nextId;
}

function insertLead($conn, $data, $assignedConsultantId, $phone, $email, $name, $source, $type, $note) {
    $phone = normalizePhone($phone);
    $stmt = $conn->prepare("INSERT INTO leads (phone, email, name, source, type, note, last_interaction_date, assigned_to) 
                            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
                            ON DUPLICATE KEY UPDATE 
                                last_interaction_date = NOW(),
                                assigned_to = VALUES(assigned_to)");
    $stmt->bind_param("ssssssi", $phone, $email, $name, $source, $type, $note, $assignedConsultantId);
    $stmt->execute();
    $id = $stmt->insert_id;
    if (!$id) {
        // Nếu bị duplicate key và được update, insert_id có thể bằng 0. Ta lấy ID từ DB.
        $sStmt = $conn->prepare("SELECT id FROM leads WHERE phone = ? OR email = ? LIMIT 1");
        $sStmt->bind_param("ss", $phone, $email);
        $sStmt->execute();
        $id = $sStmt->get_result()->fetch_assoc()['id'] ?? 0;
    }
    return $id;
}

function updateLead($conn, $phone, $email, $assignedConsultantId, $source, $type, $note) {
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
    
    $whereClause = implode(" OR ", $where);
    // Find ID first
    $sStmt = $conn->prepare("SELECT id FROM leads WHERE $whereClause LIMIT 1");
    if (!empty($phone) && !empty($email)) {
        $sStmt->bind_param("ss", $phone, $email);
    } elseif (!empty($phone)) {
        $sStmt->bind_param("s", $phone);
    } else {
        $sStmt->bind_param("s", $email);
    }
    $sStmt->execute();
    $res = $sStmt->get_result();
    if ($res->num_rows > 0) {
        $id = $res->fetch_assoc()['id'];
        // NEW-02 fix: Only update assigned_to if we actually have a consultant
        if ($assignedConsultantId) {
            $uStmt = $conn->prepare("UPDATE leads SET source = ?, type = ?, note = ?, last_interaction_date = NOW(), assigned_to = ? WHERE id = ?");
            $uStmt->bind_param("sssii", $source, $type, $note, $assignedConsultantId, $id);
        } else {
            // Don't overwrite assigned_to when lead is pending/unassigned
            $uStmt = $conn->prepare("UPDATE leads SET source = ?, type = ?, note = ?, last_interaction_date = NOW() WHERE id = ?");
            $uStmt->bind_param("sssi", $source, $type, $note, $id);
        }
        $uStmt->execute();
        return $id;
    }
    return null;
}

function logDistribution($conn, $leadId, $assignedTo, $roundId, $status, $message) {
    $stmt = $conn->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("iiiss", $leadId, $assignedTo, $roundId, $status, $message);
    $stmt->execute();
}

