<?php
// backend/audit_today_leads.php
require_once __DIR__ . '/db_connect.php';
header("Content-Type: text/plain; charset=utf-8");

echo "===================================================================\n";
echo "=== HỆ THỐNG AUDIT PHÂN BỔ & THÔNG BÁO LEAD TRONG NGÀY HÔM NAY ===\n";
echo "=== Ngày kiểm tra: " . date('d/m/Y') . " (Khu vực: Asia/Ho_Chi_Minh) ===\n";
echo "===================================================================\n\n";

// 1. Query all leads created today
$today = date('Y-m-d');
$leadsStmt = $conn->prepare("
    SELECT l.id, l.name, l.phone, l.email, l.source, l.type, l.created_at, l.assigned_to, l.connection_id, l.status as lead_status, l.ai_screener_status,
           sc.sheet_name, sc.is_silent
    FROM leads l
    LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
    WHERE DATE(l.created_at) = ?
    ORDER BY l.id ASC
");
$leadsStmt->bind_param("s", $today);
$leadsStmt->execute();
$leadsRes = $leadsStmt->get_result();

$totalLeads = 0;
$totalAssigned = 0;
$totalPendingApproval = 0;
$totalPendingWorkHours = 0;
$totalOther = 0;
$missedNotifications = [];
$auditDetails = [];

if ($leadsRes && $leadsRes->num_rows > 0) {
    while ($lead = $leadsRes->fetch_assoc()) {
        $totalLeads++;
        $leadId = $lead['id'];
        $leadName = $lead['name'];
        $leadPhone = $lead['phone'];
        $leadEmail = $lead['email'];
        $assignedTo = $lead['assigned_to'];
        $isSilent = (int)($lead['is_silent'] ?? 0);
        $leadStatus = $lead['lead_status'];
        
        // Fetch latest distribution log for this lead
        $logStmt = $conn->prepare("SELECT id, status, message, assigned_to, received_at FROM distribution_logs WHERE lead_id = ? ORDER BY id DESC LIMIT 1");
        $logStmt->bind_param("i", $leadId);
        $logStmt->execute();
        $logRes = $logStmt->get_result();
        $log = $logRes->fetch_assoc();
        $logStmt->close();
        
        $logStatus = $log['status'] ?? 'N/A';
        $logMessage = $log['message'] ?? 'N/A';
        $logTime = $log['received_at'] ?? 'N/A';

        // Check if assigned to consultant
        $saleName = 'Chưa phân bổ';
        $saleEmail = '';
        $saleZaloId = '';
        if ($assignedTo) {
            $saleStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ?");
            $saleStmt->bind_param("i", $assignedTo);
            $saleStmt->execute();
            $saleRes = $saleStmt->get_result();
            if ($saleRes && $sRow = $saleRes->fetch_assoc()) {
                $saleName = $sRow['name'];
                $saleEmail = $sRow['email'];
                $saleZaloId = $sRow['zalo_chat_id'];
            }
            $saleStmt->close();
        }

        // Determine category
        if ($logStatus === 'assigned' || $logStatus === 'compensation' || $logStatus === 'fallback') {
            $totalAssigned++;
            
            // Check if notifications were queued
            $mailQueued = false;
            $mailStatus = 'N/A';
            $mailId = null;
            if ($saleEmail) {
                $mailLike = '%' . $leadName . '%';
                $mStmt = $conn->prepare("SELECT id, status FROM mail_queue WHERE to_email = ? AND (subject LIKE ? OR body_html LIKE ?) LIMIT 1");
                $mStmt->bind_param("sss", $saleEmail, $mailLike, $mailLike);
                $mStmt->execute();
                $mRes = $mStmt->get_result();
                if ($mRes && $mRes->num_rows > 0) {
                    $mRow = $mRes->fetch_assoc();
                    $mailQueued = true;
                    $mailStatus = $mRow['status'];
                    $mailId = $mRow['id'];
                }
                $mStmt->close();
            }

            $zaloQueued = false;
            $zaloStatus = 'N/A';
            $zaloId = null;
            $zaloLike = '%' . $leadName . '%';
            if ($saleZaloId) {
                $zStmt = $conn->prepare("SELECT id, status FROM zalo_queue WHERE chat_id = ? AND body_text LIKE ? LIMIT 1");
                $zStmt->bind_param("ss", $saleZaloId, $zaloLike);
            } else {
                $zStmt = $conn->prepare("SELECT id, status FROM zalo_queue WHERE body_text LIKE ? LIMIT 1");
                $zStmt->bind_param("s", $zaloLike);
            }
            $zStmt->execute();
            $zRes = $zStmt->get_result();
            if ($zRes && $zRes->num_rows > 0) {
                $zRow = $zRes->fetch_assoc();
                $zaloQueued = true;
                $zaloStatus = $zRow['status'];
                $zaloId = $zRow['id'];
            }
            $zStmt->close();

            // Check if notification missed
            $isMissedMail = !$mailQueued;
            $isMissedZalo = !$zaloQueued && !empty($saleZaloId); // Only missed Zalo if Sale actually configured Zalo Chat ID
            
            if ($isMissedMail || $isMissedZalo) {
                $missedNotifications[] = [
                    'id' => $leadId,
                    'name' => $leadName,
                    'phone' => $leadPhone,
                    'log_id' => $log['id'] ?? 'N/A',
                    'log_message' => $logMessage,
                    'log_time' => $logTime,
                    'assigned_to_name' => $saleName,
                    'assigned_to_email' => $saleEmail,
                    'zalo_configured' => $saleZaloId ? "'$saleZaloId'" : "NULL",
                    'mail_status' => $mailQueued ? "Queued (ID #$mailId, Status: $mailStatus)" : "❌ THIẾU (SÓT)",
                    'zalo_status' => $zaloQueued ? "Queued (ID #$zaloId, Status: $zaloStatus)" : (!empty($saleZaloId) ? "❌ THIẾU (SÓT)" : "Bỏ qua (Sale chưa cấu hình Zalo ID)")
                ];
            }
            
            $auditDetails[] = sprintf(
                "Lead #%d | %-20s | Sale: %-20s | Log: %-12s | Mail: %-10s | Zalo: %-10s",
                $leadId,
                $leadName,
                $saleName,
                $logStatus,
                $mailQueued ? "OK ({$mailStatus})" : "THIẾU ❌",
                $zaloQueued ? "OK ({$zaloStatus})" : (empty($saleZaloId) ? "NoZalo" : "THIẾU ❌")
            );

        } else if ($leadStatus === 'pending_approval') {
            $totalPendingApproval++;
            $auditDetails[] = sprintf(
                "Lead #%d | %-20s | Trạng thái: CHỜ PHÊ DUYỆT (AI Pre-screener: %s)",
                $leadId,
                $leadName,
                $lead['ai_screener_status']
            );
        } else if ($logStatus === 'pending_work_hours' || $leadStatus === 'pending_work_hours') {
            $totalPendingWorkHours++;
            $auditDetails[] = sprintf(
                "Lead #%d | %-20s | Trạng thái: TRÌ HOÃN (Ngoài giờ làm việc, Sale: %s)",
                $leadId,
                $leadName,
                $saleName
            );
        } else {
            $totalOther++;
            $auditDetails[] = sprintf(
                "Lead #%d | %-20s | Trạng thái: %s | Log: %s | Msg: %s",
                $leadId,
                $leadName,
                $leadStatus,
                $logStatus,
                $logMessage
            );
        }
    }
}
$leadsStmt->close();

echo "=== TỔNG HỢP SỐ LIỆU ===\n";
echo "  - Tổng số Lead hôm nay: $totalLeads\n";
echo "  - Đã phân bổ thành công: $totalAssigned\n";
echo "  - Chờ AI / Phê duyệt (Gatekeeper): $totalPendingApproval\n";
echo "  - Trì hoãn ngoài giờ làm việc: $totalPendingWorkHours\n";
echo "  - Trạng thái khác (Silent / Trùng / Lỗi): $totalOther\n\n";

echo "===================================================================\n";
echo "=== DANH SÁCH LEAD BỊ SÓT THÔNG BÁO (CẦN XỬ LÝ) ===\n";
echo "===================================================================\n";
if (empty($missedNotifications)) {
    echo "  🎉 Tuyệt vời! Không phát hiện Lead nào bị sót thông báo Email hay Zalo hôm nay.\n";
} else {
    echo "  Phát hiện " . count($missedNotifications) . " Lead bị sót thông báo:\n\n";
    foreach ($missedNotifications as $m) {
        echo "  * Lead ID: #{$m['id']} | Tên: {$m['name']} | SĐT: {$m['phone']} (Log ID: #{$m['log_id']})\n";
        echo "    - Thời gian log: {$m['log_time']}\n";
        echo "    - Nội dung log: '{$m['log_message']}'\n";
        echo "    - Sale nhận: {$m['assigned_to_name']} ({$m['assigned_to_email']})\n";
        echo "    - Zalo chat ID: {$m['zalo_configured']}\n";
        echo "    - Trạng thái Email: {$m['mail_status']}\n";
        echo "    - Trạng thái Zalo: {$m['zalo_status']}\n";
        echo "    ----------------------------------------\n";
    }
}

echo "\n===================================================================\n";
echo "=== CHI TIẾT ĐỊNH TUYẾN TOÀN BỘ LEAD HÔM NAY ===\n";
echo "===================================================================\n";
if (empty($auditDetails)) {
    echo "  Không có dữ liệu Lead nào được nhận trong ngày hôm nay.\n";
} else {
    foreach ($auditDetails as $detail) {
        echo "  " . $detail . "\n";
    }
}

// Query admin logs for today's updates
echo "\n===================================================================\n";
echo "=== NHẬT KÝ ADMIN LIÊN QUAN ĐẾN ZALO HÔM NAY ===\n";
echo "===================================================================\n";
$logsRes = $conn->query("
    SELECT id, action, details, created_at 
    FROM admin_logs 
    WHERE DATE(created_at) = '$today' AND (action LIKE '%ZALO%' OR action LIKE '%SETTING%' OR action LIKE '%CONSULTANT%')
    ORDER BY id ASC
");
if ($logsRes && $logsRes->num_rows > 0) {
    while ($row = $logsRes->fetch_assoc()) {
        echo "  * [{$row['created_at']}] Action: {$row['action']} | Details: {$row['details']}\n";
    }
} else {
    echo "  * Không ghi nhận thao tác cập nhật cấu hình Zalo nào hôm nay trong hệ thống.\n";
}

$conn->close();
?>
