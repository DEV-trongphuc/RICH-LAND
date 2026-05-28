<?php
// backend/resend_missed_zalo.php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/zalo_bot.php';
header("Content-Type: text/plain; charset=utf-8");

echo "=========================================================\n";
echo "=== TIẾN TRÌNH GỬI BÙ THÔNG BÁO ZALO BỊ SÓT TRONG NGÀY ===\n";
echo "=========================================================\n\n";

$missedLeadIds = [22157, 22158, 22159, 22160, 22162, 22165, 22166];
$successCount = 0;

foreach ($missedLeadIds as $leadId) {
    echo "Đang xử lý Lead ID #$leadId...\n";

    // 1. Get lead details
    $lStmt = $conn->prepare("SELECT name, phone, email, source, type, note, connection_id, assigned_to FROM leads WHERE id = ?");
    $lStmt->bind_param("i", $leadId);
    $lStmt->execute();
    $leadData = $lStmt->get_result()->fetch_assoc();
    $lStmt->close();

    if (!$leadData) {
        echo "  -> ❌ Không tìm thấy Lead ID #$leadId trong DB.\n\n";
        continue;
    }

    $assignedConsultantId = $leadData['assigned_to'];
    if (!$assignedConsultantId) {
        echo "  -> ❌ Lead chưa được phân bổ cho ai.\n\n";
        continue;
    }

    // 2. Fetch Consultant contact details
    $cStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ?");
    $cStmt->bind_param("i", $assignedConsultantId);
    $cStmt->execute();
    $c = $cStmt->get_result()->fetch_assoc();
    $cStmt->close();

    if (!$c) {
        echo "  -> ❌ Không tìm thấy thông tin tư vấn viên ID #$assignedConsultantId.\n\n";
        continue;
    }

    if (empty($c['zalo_chat_id'])) {
        echo "  -> ⚠️ Tư vấn viên '{$c['name']}' chưa liên kết Zalo (bỏ qua).\n\n";
        continue;
    }

    // 3. Fetch round name if any
    $roundName = '';
    $logStmt = $conn->prepare("SELECT round_id FROM distribution_logs WHERE lead_id = ? ORDER BY id DESC LIMIT 1");
    $logStmt->bind_param("i", $leadId);
    $logStmt->execute();
    $logData = $logStmt->get_result()->fetch_assoc();
    $logStmt->close();
    
    $targetRoundId = $logData['round_id'] ?? 0;
    if ($targetRoundId) {
        $rStmt = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
        $rStmt->bind_param("i", $targetRoundId);
        $rStmt->execute();
        $roundName = $rStmt->get_result()->fetch_assoc()['round_name'] ?? '';
        $rStmt->close();
    }

    // 4. Call Zalo notification queue function (sync = false)
    try {
        $zaloResult = sendLeadAssignedZaloMessageToSale(
            $assignedConsultantId, 
            $c['name'], 
            $leadData['name'], 
            $leadData['phone'], 
            $leadData['note'], 
            $leadData['source'], 
            $roundName, 
            $leadId, 
            $targetRoundId, 
            $leadData['email'], 
            $leadData['type'],
            false // sync = false (queue it)
        );

        if ($zaloResult) {
            echo "  -> ✅ Đã chèn thành công tin nhắn Zalo gửi cho {$c['name']} (Zalo ID: '{$c['zalo_chat_id']}') vào hàng đợi!\n\n";
            $successCount++;
        } else {
            echo "  -> ❌ Hàm sendLeadAssignedZaloMessageToSale trả về thất bại.\n\n";
        }
    } catch (Throwable $e) {
        echo "  -> ❌ Lỗi ngoại lệ: " . $e->getMessage() . "\n\n";
    }
}

echo "=== HOÀN THÀNH ===\n";
echo "Đã chèn bù thành công $successCount/$successCount tin nhắn Zalo vào hàng đợi.\n";

$conn->close();
?>
