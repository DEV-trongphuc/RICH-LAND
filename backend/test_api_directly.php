<?php
header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/db_connect.php';

// Giả lập ID lead từ danh sách test
$leadId = isset($_GET['lead_id']) ? (int)$_GET['lead_id'] : 22172;

echo "=== DỮ LIỆU ĐẦU VÀO ===\n";
echo "Lead ID: $leadId\n\n";

echo "=== TRUY VẤN LEAD ===\n";
$leadStmt = $conn->prepare("SELECT l.id, l.name, l.phone, l.email, l.assigned_to, l.created_at, l.zalo_notify_status, l.email_notify_status FROM leads l WHERE l.id = ? LIMIT 1");
if (!$leadStmt) {
    die("Lỗi Prepare Lead: " . $conn->error . "\n");
}
$leadStmt->bind_param("i", $leadId);
$leadStmt->execute();
$lead = $leadStmt->get_result()->fetch_assoc();
$leadStmt->close();

if (!$lead) {
    die("Không tìm thấy lead có ID: $leadId\n");
}
print_r($lead);

echo "\n=== TRUY VẤN SALE ===\n";
$assignedTo = $lead['assigned_to'];
$saleZaloId = '';
$saleEmail = '';

if ($assignedTo) {
    $saleStmt = $conn->prepare("SELECT email, zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
    if (!$saleStmt) {
        die("Lỗi Prepare Sale: " . $conn->error . "\n");
    }
    $saleStmt->bind_param("i", $assignedTo);
    $saleStmt->execute();
    $sRow = $saleStmt->get_result()->fetch_assoc();
    if ($sRow) {
        $saleEmail = $sRow['email'] ?? '';
        $saleZaloId = $sRow['zalo_chat_id'] ?? '';
        echo "Sale Email: $saleEmail\n";
        echo "Sale Zalo Chat ID: $saleZaloId\n";
    } else {
        echo "Không tìm thấy sale có ID: $assignedTo trong bảng consultants\n";
    }
    $saleStmt->close();
} else {
    echo "Lead này chưa chia cho Sale nào.\n";
}

echo "\n=== MAPPING KẾT QUẢ API ===\n";
$zaloNotifyStatus = $lead['zalo_notify_status'] ?? 'none';
$emailNotifyStatus = $lead['email_notify_status'] ?? 'none';

$mailQueued = ($emailNotifyStatus !== 'none');
$mailFinalStatus = $mailQueued ? $emailNotifyStatus : 'missed';

$zaloQueued = ($zaloNotifyStatus !== 'none');
if (!$zaloQueued && empty($saleZaloId)) {
    $zaloFinalStatus = 'no_zalo_config';
} else if ($zaloQueued) {
    $zaloFinalStatus = $zaloNotifyStatus;
} else {
    $zaloFinalStatus = 'missed';
}

$resData = [
    'success' => true,
    'data' => [
        'lead_id' => $leadId,
        'email' => [
            'queued' => $mailQueued,
            'status' => $mailFinalStatus,
            'id' => null,
            'target' => $saleEmail
        ],
        'zalo' => [
            'queued' => $zaloQueued,
            'status' => $zaloFinalStatus,
            'id' => null,
            'target' => $saleZaloId
        ]
    ]
];

echo json_encode($resData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
?>
