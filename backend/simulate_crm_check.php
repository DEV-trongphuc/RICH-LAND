<?php
// backend/simulate_crm_check.php
// Chạy file này để xem hàm checkCRMInteraction trả về giá trị gì cho SĐT 0907474739 và Email hoangsyhoa1963@gmail.com

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

header("Content-Type: text/plain; charset=UTF-8");

$phone = '0907474739';
$email = 'hoangsyhoa1963@gmail.com';

echo "=== GỌI HÀM checkCRMInteraction ===\n";
$res = checkCRMInteraction($conn, $phone, $email);
print_r($res);

echo "\n=== CHẠY CHI TIẾT TỪNG BƯỚC TRUY VẤN CỦA HÀM ===\n";

$phones = [$phone];
$emails = [$email];

$where = [];
$params = [];
$types = '';

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
$query = "SELECT l.id, l.assigned_to, l.last_interaction_date, c.name as consultant_name, c.status as consultant_status, c.leave_start, c.leave_end 
          FROM leads l 
          LEFT JOIN consultants c ON l.assigned_to = c.id 
          WHERE $whereClause 
          ORDER BY l.last_interaction_date DESC LIMIT 1";

echo "Query: $query\n\n";

$stmt = $conn->prepare($query);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$dbRes = $stmt->get_result();
if ($row = $dbRes->fetch_assoc()) {
    print_r($row);
    
    $lastInteraction = new DateTime($row['last_interaction_date']);
    $now = new DateTime();
    $diff = $now->diff($lastInteraction);
    $months = ($diff->format('%y') * 12) + $diff->format('%m');
    echo "Months since last interaction: $months\n";
    
    $reassignIfOwnerInactive = get_system_setting($conn, 'reassign_if_owner_inactive');
    if ($reassignIfOwnerInactive === '') {
        $reassignIfOwnerInactive = '1';
    }
    echo "reassign_if_owner_inactive: $reassignIfOwnerInactive\n";
    
    $consultantStatus = $row['consultant_status'];
    $leaveStart = $row['leave_start'] ?? null;
    $leaveEnd = $row['leave_end'] ?? null;
    $today = date('Y-m-d');
    
    $isActuallyOnLeave = false;
    if ($consultantStatus === 'leave') {
        $isActuallyOnLeave = true;
    } else if ($consultantStatus === 'active' && !empty($leaveStart) && !empty($leaveEnd)) {
        if ($today >= $leaveStart && $today <= $leaveEnd) {
            $isActuallyOnLeave = true;
        }
    }
    echo "Is actually on leave: " . ($isActuallyOnLeave ? "Yes" : "No") . "\n";
    
    $effectiveStatus = $isActuallyOnLeave ? 'leave' : $consultantStatus;
    echo "Effective status: $effectiveStatus\n";
    
    $isInactive = ($consultantStatus === 'inactive');

    if ($reassignIfOwnerInactive === '1') {
        $isDuplicate = !$isInactive;
        $assignedTo = $isDuplicate ? $row['assigned_to'] : null;
    } else {
        $isDuplicate = true;
        $assignedTo = $row['assigned_to'];
    }
    echo "isDuplicate: " . ($isDuplicate ? "True" : "False") . "\n";
    echo "assignedTo: " . ($assignedTo !== null ? $assignedTo : "NULL") . "\n";
} else {
    echo "Không tìm thấy dòng nào trùng khớp trong DB!\n";
}
$stmt->close();
