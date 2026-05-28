<?php
// backend/quick_check_zalo.php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

$phones = ['0949769124', '0983493483', '0966367405', '0934650886', '0961211956', '0914721998', '0968166162'];

echo "=== KIỂM TRA SỐ ĐIỆN THOẠI TRONG ZALO_QUEUE ===\n";
foreach ($phones as $phone) {
    $like = '%' . $phone . '%';
    $stmt = $conn->prepare("SELECT id, chat_id, status, created_at, sent_at FROM zalo_queue WHERE body_text LIKE ?");
    $stmt->bind_param("s", $like);
    $stmt->execute();
    $res = $stmt->get_result();
    
    if ($res && $res->num_rows > 0) {
        echo "SĐT: $phone -> TÌM THẤY trong zalo_queue:\n";
        while ($row = $res->fetch_assoc()) {
            echo "  - Queue ID: #{$row['id']} | ChatID: {$row['chat_id']} | Status: {$row['status']} | Created: {$row['created_at']} | Sent: {$row['sent_at']}\n";
        }
    } else {
        echo "SĐT: $phone -> ❌ KHÔNG TÌM THẤY trong zalo_queue\n";
    }
    $stmt->close();
}

$conn->close();
?>
