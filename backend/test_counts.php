<?php
require_once __DIR__ . '/db_connect.php';

header('Content-Type: application/json; charset=utf-8');

$res = [];

// 1. Find consultant
$stmt = $conn->prepare("SELECT id, name, email, status FROM consultants WHERE name LIKE ?");
$search = "%Nguyễn Hải Đăng%";
$stmt->bind_param("s", $search);
$stmt->execute();
$consultant = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$consultant) {
    echo json_encode(["error" => "Consultant 'Nguyễn Hải Đăng' not found"]);
    exit;
}

$res['consultant'] = $consultant;
$consId = (int)$consultant['id'];
$email = $consultant['email'];

// 2. Find user by email
$stmt = $conn->prepare("SELECT id, username, email, role FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user) {
    echo json_encode(["error" => "User account for email '$email' not found", "consultant" => $consultant]);
    exit;
}

$res['user'] = $user;
$userId = (int)$user['id'];

// 3. Count total contacts for the user
$stmt = $conn->prepare("SELECT COUNT(*) as count FROM contacts WHERE owner_id = ? AND deleted_at IS NULL");
$stmt->bind_param("i", $userId);
$stmt->execute();
$res['contacts_count'] = (int)($stmt->get_result()->fetch_assoc()['count'] ?? 0);
$stmt->close();

// 4. Count contacts by source
$stmt = $conn->prepare("SELECT source, COUNT(*) as count FROM contacts WHERE owner_id = ? AND deleted_at IS NULL GROUP BY source");
$stmt->bind_param("i", $userId);
$stmt->execute();
$res['contacts_by_source'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// 5. Count distribution logs assigned to the consultant
$stmt = $conn->prepare("SELECT status, COUNT(*) as count FROM distribution_logs WHERE assigned_to = ? GROUP BY status");
$stmt->bind_param("i", $consId);
$stmt->execute();
$res['distribution_logs_by_status'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// 6. Databank claim count
$stmt = $conn->prepare("
    SELECT COUNT(DISTINCT c.id) as count
    FROM contacts c
    WHERE c.owner_id = ? AND c.deleted_at IS NULL
      AND (c.source = 'databank' OR EXISTS (
          SELECT 1 FROM leads l2
          JOIN distribution_logs dl2 ON dl2.lead_id = l2.id
          WHERE l2.person_id = c.person_id AND dl2.assigned_to = ? AND dl2.status = 'databank_claim'
      ))
");
$stmt->bind_param("ii", $userId, $consId);
$stmt->execute();
$res['databank_claimed_count'] = (int)($stmt->get_result()->fetch_assoc()['count'] ?? 0);
$stmt->close();

// 7. Distributed count
$stmt = $conn->prepare("
    SELECT COUNT(DISTINCT c.id) as count
    FROM contacts c
    WHERE c.owner_id = ? AND c.deleted_at IS NULL
      AND (c.source != 'databank' AND EXISTS (
          SELECT 1 FROM leads l2
          JOIN distribution_logs dl2 ON dl2.lead_id = l2.id
          WHERE l2.person_id = c.person_id AND dl2.assigned_to = ? AND dl2.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours', 'fallback', 'success')
      ))
");
$stmt->bind_param("ii", $userId, $consId);
$stmt->execute();
$res['distributed_count'] = (int)($stmt->get_result()->fetch_assoc()['count'] ?? 0);
$stmt->close();

echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
