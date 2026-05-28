<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

echo "===================================================\n";
echo "       HỆ THỐNG KIỂM TRA THỜI GIAN (TIME DIAGNOSTIC) \n";
echo "===================================================\n\n";

// 1. Kiểm tra múi giờ PHP và MySQL
echo "--- 1. THỜI GIAN HỆ THỐNG ---\n";
echo "PHP Local Time: " . date('Y-m-d H:i:s') . " (Timezone: " . date_default_timezone_get() . ")\n";

$resTz = $conn->query("SELECT NOW() as db_now, @@global.time_zone as global_tz, @@session.time_zone as session_tz, UTC_TIMESTAMP() as utc_now");
if ($resTz) {
    $row = $resTz->fetch_assoc();
    echo "MySQL NOW():    " . $row['db_now'] . "\n";
    echo "MySQL UTC NOW():" . $row['utc_now'] . "\n";
    echo "MySQL Global TZ:" . $row['global_tz'] . "\n";
    echo "MySQL Session TZ:" . $row['session_tz'] . "\n";
} else {
    echo "MySQL Time check failed: " . $conn->error . "\n";
}
echo "\n";

// 2. Chi tiết 1 Lead cụ thể nếu truyền ?lead_id=
$leadId = isset($_GET['lead_id']) ? (int)$_GET['lead_id'] : 0;

try {
    if ($leadId > 0) {
        echo "--- 2. KIỂM TRA CHI TIẾT LEAD #$leadId ---\n";
        
        $stmt = $conn->prepare("SELECT id, name, created_at, zalo_notify_status, email_notify_status, zalo_notify_sent_at, email_notify_sent_at FROM leads WHERE id = ? LIMIT 1");
        if (!$stmt) {
            throw new Exception("Prepare statement failed: " . $conn->error);
        }
        
        $stmt->bind_param("i", $leadId);
        $stmt->execute();
        $lead = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($lead) {
            echo "Tên Lead:       " . $lead['name'] . "\n";
            echo "Thời gian nhận: " . $lead['created_at'] . " (created_at)\n";
            echo "Zalo Status:    " . $lead['zalo_notify_status'] . " | Sent At: " . ($lead['zalo_notify_sent_at'] ?: 'N/A') . "\n";
            echo "Email Status:   " . $lead['email_notify_status'] . " | Sent At: " . ($lead['email_notify_sent_at'] ?: 'N/A') . "\n";

            // Query trong zalo_queue
            echo "\n* Lịch sử trong zalo_queue:\n";
            $zStmt = $conn->prepare("SELECT id, status, created_at, sent_at, attempts, last_error FROM zalo_queue WHERE lead_id = ? ORDER BY id DESC");
            if ($zStmt) {
                $zStmt->bind_param("i", $leadId);
                $zStmt->execute();
                $zRes = $zStmt->get_result();
                if ($zRes && $zRes->num_rows > 0) {
                    while ($zRow = $zRes->fetch_assoc()) {
                        echo "  - Q_ID #{$zRow['id']} | Status: {$zRow['status']} | Created: {$zRow['created_at']} | Sent At: " . ($zRow['sent_at'] ?: 'N/A') . " | Attempts: {$zRow['attempts']}\n";
                    }
                } else {
                    echo "  - Không tìm thấy bản ghi trong zalo_queue liên kết với lead_id này.\n";
                }
                $zStmt->close();
            }

            // Query trong mail_queue
            echo "\n* Lịch sử trong mail_queue:\n";
            $mStmt = $conn->prepare("SELECT id, status, created_at, sent_at, attempts, last_error FROM mail_queue WHERE lead_id = ? ORDER BY id DESC");
            if ($mStmt) {
                $mStmt->bind_param("i", $leadId);
                $mStmt->execute();
                $mRes = $mStmt->get_result();
                if ($mRes && $mRes->num_rows > 0) {
                    while ($mRow = $mRes->fetch_assoc()) {
                        echo "  - Q_ID #{$mRow['id']} | Status: {$mRow['status']} | Created: {$mRow['created_at']} | Sent At: " . ($mRow['sent_at'] ?: 'N/A') . " | Attempts: {$mRow['attempts']}\n";
                    }
                } else {
                    echo "  - Không tìm thấy bản ghi trong mail_queue liên kết với lead_id này.\n";
                }
                $mStmt->close();
            }
        } else {
            echo "Không tìm thấy Lead ID #$leadId trong hệ thống.\n";
        }
    } else {
        // 3. Hiển thị 10 lead mới nhất để kiểm tra tổng quan
        echo "--- 2. DANH SÁCH 10 LEAD MỚI NHẤT ---\n";
        echo "Chú ý: Để xem chi tiết hàng đợi của 1 lead, hãy truyền thêm ?lead_id=ID_CỦA_LEAD vào URL\n\n";
        
        $resLeads = $conn->query("SELECT id, name, created_at, zalo_notify_status, email_notify_status, zalo_notify_sent_at, email_notify_sent_at FROM leads ORDER BY id DESC LIMIT 10");
        if ($resLeads) {
            while ($row = $resLeads->fetch_assoc()) {
                echo "Lead ID: #{$row['id']} | Tên: {$row['name']}\n";
                echo "  - Nhận lúc:  " . $row['created_at'] . "\n";
                echo "  - Gửi Zalo:  " . ($row['zalo_notify_sent_at'] ?: 'N/A') . " (" . $row['zalo_notify_status'] . ")\n";
                echo "  - Gửi Email: " . ($row['email_notify_sent_at'] ?: 'N/A') . " (" . $row['email_notify_status'] . ")\n";
                echo "---------------------------------------------------\n";
            }
        } else {
            echo "Không thể lấy danh sách Leads: " . $conn->error . "\n";
        }
    }
} catch (Throwable $e) {
    echo "\n[ERROR] Có lỗi xảy ra khi chạy truy vấn: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . " trên dòng " . $e->getLine() . "\n";
}

$conn->close();
?>
