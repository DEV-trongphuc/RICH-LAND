<?php
// webhook_logic.php
// Common routing and distribution logic for leads

require_once __DIR__ . '/db_connect.php';

function checkCRMInteraction($conn, $phone, $email) {
    if (empty($phone) && empty($email)) {
        return ['isDuplicate' => false, 'monthsSinceLastInteraction' => 0, 'assignedTo' => null];
    }
    
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

function evaluateRules($conn, $data, $source, $type) {
    $result = $conn->query("SELECT target_round_id, condition_column, condition_operator, condition_value FROM routing_rules ORDER BY priority ASC");
    
    while ($row = $result->fetch_assoc()) {
        $col = $row['condition_column'];
        $op = strtolower($row['condition_operator']);
        $val = strtolower($row['condition_value']);
        
        $dataVal = '';
        if ($col === 'source') $dataVal = $source;
        elseif ($col === 'type') $dataVal = $type;
        else $dataVal = $data[$col] ?? '';
        
        $dataVal = strtolower($dataVal);
        
        switch ($op) {
            case 'contains':
                if (strpos($dataVal, $val) !== false) return $row['target_round_id'];
                break;
            case 'equals':
                if ($dataVal === $val) return $row['target_round_id'];
                break;
            case 'starts_with':
                if (strpos($dataVal, $val) === 0) return $row['target_round_id'];
                break;
            case 'ends_with':
                if (substr($dataVal, -strlen($val)) === $val) return $row['target_round_id'];
                break;
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
    
    // 2. Get active consultants in this round
    $cStmt = $conn->prepare("SELECT c.id FROM round_consultants rc JOIN consultants c ON rc.consultant_id = c.id WHERE rc.round_id = ? AND rc.is_active = 1 AND c.status = 'active' ORDER BY c.id ASC");
    $cStmt->bind_param("i", $roundId);
    $cStmt->execute();
    $cRes = $cStmt->get_result();
    
    if ($cRes->num_rows === 0) {
        // Log error when round has no active consultants
        error_log("DOMATION ERROR: Round ID $roundId has no active consultants! Attempting self-healing fallback...");
        if (php_sapi_name() === 'cli') {
            echo "[ERROR] Round ID $roundId has no active consultants! Attempting self-healing fallback...\n";
        }
        
        // Self-healing fallback: Find ANY active consultant in the entire system
        $fbStmt = $conn->prepare("SELECT id FROM consultants WHERE status = 'active' ORDER BY id ASC LIMIT 1");
        if ($fbStmt) {
            $fbStmt->execute();
            $fbRes = $fbStmt->get_result();
            if ($fbRes->num_rows > 0) {
                $fallbackId = $fbRes->fetch_assoc()['id'];
                error_log("DOMATION SELF-HEAL: Automatically assigned lead to fallback active consultant ID: $fallbackId");
                if (php_sapi_name() === 'cli') {
                    echo "[SELF-HEAL] Automatically assigned lead to fallback active consultant ID: $fallbackId\n";
                }
                $conn->commit();
                return $fallbackId;
            }
        }
        
        $conn->rollback();
        return null; // Absolute failure: no consultants in system
    }
    
    $consultants = [];
    while ($row = $cRes->fetch_assoc()) {
        $consultants[] = $row['id'];
    }
    
    // 3. Find next consultant
    $nextId = $consultants[0]; // default to first
    if ($lastAssignedId) {
        $idx = array_search($lastAssignedId, $consultants);
        if ($idx !== false && isset($consultants[$idx + 1])) {
            $nextId = $consultants[$idx + 1];
        }
    }
    
    // 4. Update last assigned
    $updStmt = $conn->prepare("UPDATE distribution_rounds SET last_assigned_consultant_id = ? WHERE id = ?");
    $updStmt->bind_param("ii", $nextId, $roundId);
    $updStmt->execute();
    
    // Commit transaction
    $conn->commit();
    
    return $nextId;
}

function insertLead($conn, $data, $assignedConsultantId, $phone, $email, $name, $source, $type, $note) {
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
    
    $types .= 'i';
    $params[] = $assignedConsultantId;
    
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
        $uStmt = $conn->prepare("UPDATE leads SET source = ?, type = ?, note = ?, last_interaction_date = NOW(), assigned_to = ? WHERE id = ?");
        $uStmt->bind_param("sssii", $source, $type, $note, $assignedConsultantId, $id);
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

