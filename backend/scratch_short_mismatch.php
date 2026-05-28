<?php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=== SCREENER MISMATCH - SPECIFIC LEADS ===\n\n";

$start = date('Y-m-01 00:00:00');
$end = date('Y-m-t 23:59:59');

$sql = "SELECT id, name, status, ai_screener_status, created_at FROM leads WHERE created_at >= '$start' AND created_at <= '$end' ORDER BY id ASC";
$res = $conn->query($sql);

$failed_not_in_tabs = [];
$in_tabs_not_failed = [];

while ($row = $res->fetch_assoc()) {
    $id = $row['id'];
    $name = $row['name'];
    $status = $row['status'];
    $ai_status = $row['ai_screener_status'];
    
    // Tab categorization logic
    $is_ai_pending = ($status === 'pending_approval' && ( ($ai_status === 'pending' || ($ai_status === 'error' && $row['ai_attempts'] < 3)) && strtotime($row['created_at']) > (time() - 300) ));
    
    $in_understandard_tabs = false;
    if ($status === 'pending_approval' && !$is_ai_pending) {
        $in_understandard_tabs = true; // Hàng chờ duyệt
    } else if (in_array($status, ['rejected', 'blacklisted'])) {
        $in_understandard_tabs = true; // Dưới chuẩn tab
    }
    
    $is_failed_screener = ($ai_status === 'failed');
    
    if ($is_failed_screener && !$in_understandard_tabs) {
        $failed_not_in_tabs[] = $row;
    }
    if (!$is_failed_screener && $in_understandard_tabs) {
        $in_tabs_not_failed[] = $row;
    }
}

echo "1. Bị AI đánh giá 'failed' (Dưới chuẩn) nhưng nằm ở tab khác (như Giao lead/Active/Trùng):\n";
if (count($failed_not_in_tabs) > 0) {
    foreach ($failed_not_in_tabs as $r) {
        echo "   - ID: #{$r['id']} | Tên: {$r['name']} | Trạng thái hiện tại: {$r['status']} | Trạng thái AI: {$r['ai_screener_status']} | Ngày tạo: {$r['created_at']}\n";
    }
} else {
    echo "   (Không có)\n";
}

echo "\n2. Nằm ở tab 'Hàng chờ duyệt' hoặc 'Dưới chuẩn' nhưng AI không đánh giá là 'failed':\n";
if (count($in_tabs_not_failed) > 0) {
    foreach ($in_tabs_not_failed as $r) {
        echo "   - ID: #{$r['id']} | Tên: {$r['name']} | Trạng thái hiện tại: {$r['status']} | Trạng thái AI: {$r['ai_screener_status']} | Ngày tạo: {$r['created_at']}\n";
    }
} else {
    echo "   (Không có)\n";
}
?>
