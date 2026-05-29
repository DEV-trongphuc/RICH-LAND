<?php
// e:/GIAO_DATA_GOOGLESHEETS/backend/audit_bba_distribution.php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/html; charset=UTF-8");

// 1. Fetch all active rounds for selection
$roundsList = [];
$roundsRes = $conn->query("SELECT id, round_name, is_active FROM distribution_rounds ORDER BY round_name ASC");
if ($roundsRes) {
    while ($rRow = $roundsRes->fetch_assoc()) {
        $roundsList[] = $rRow;
    }
}

// 2. Determine target round ID
$targetRoundId = isset($_GET['round_id']) ? (int) $_GET['round_id'] : 0;
if ($targetRoundId <= 0) {
    // Auto-detect first round containing "BBA"
    foreach ($roundsList as $r) {
        if (stripos($r['round_name'], 'BBA') !== false) {
            $targetRoundId = $r['id'];
            break;
        }
    }
    // Fallback to first round in the list if no BBA round found
    if ($targetRoundId <= 0 && !empty($roundsList)) {
        $targetRoundId = $roundsList[0]['id'];
    }
}

$targetRoundName = 'Không xác định';
foreach ($roundsList as $r) {
    if ($r['id'] === $targetRoundId) {
        $targetRoundName = $r['round_name'];
        break;
    }
}

// 3. Date range for statistics (This Month)
$startDate = date('Y-m-01 00:00:00');
$endDate = date('Y-m-t 23:59:59');
$dateLabel = "Tháng này (" . date('d/m/Y', strtotime($startDate)) . " - " . date('d/m/Y', strtotime($endDate)) . ")";

// 4. Fetch consultants in the target round
$consultants = [];
if ($targetRoundId > 0) {
    $sql = "SELECT c.id, c.name, c.avatar, c.status as c_status, c.work_start_time, c.work_end_time, c.work_schedule, c.leave_start, c.leave_end, c.vacation_mode,
                   rc.receive_ratio, rc.compensation_count, rc.skip_count, rc.data_per_turn, rc.current_turn_remaining, rc.is_active as rc_active
            FROM round_consultants rc
            JOIN consultants c ON rc.consultant_id = c.id
            WHERE rc.round_id = $targetRoundId
            ORDER BY c.name ASC";
    $res = $conn->query($sql);
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $consultants[$row['id']] = $row;
        }
    }
}

// 5. Gather log counts and details for the consultants
$auditData = [];
foreach ($consultants as $cId => $c) {
    // Count status types in distribution_logs for this month (adjust pending compensation to be counted as compensation)
    $logCountsSql = "SELECT 
                        CASE 
                          WHEN status = 'pending_work_hours' AND (message LIKE '%đền bù%' OR message LIKE '%compensation%' OR message LIKE '%Bù lượt%') THEN 'compensation'
                          ELSE status 
                        END as adjusted_status, 
                        COUNT(*) as cnt 
                      FROM distribution_logs 
                      WHERE assigned_to = $cId 
                        AND round_id = $targetRoundId
                        AND received_at BETWEEN '$startDate' AND '$endDate'
                        AND status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours')
                      GROUP BY adjusted_status";
    $logCountsRes = $conn->query($logCountsSql);
    $counts = [
        'assigned' => 0,
        'compensation' => 0,
        'rule_6_month' => 0,
        'pending_work_hours' => 0,
        'error' => 0,
        'reminder' => 0,
        'reallocated' => 0
    ];
    if ($logCountsRes) {
        while ($lRow = $logCountsRes->fetch_assoc()) {
            if (isset($counts[$lRow['adjusted_status']])) {
                $counts[$lRow['adjusted_status']] = (int) $lRow['cnt'];
            }
        }
    }

    // Query approved tickets from data_reports resolved in this month
    $ticketCount = 0;
    $ticketSql = "SELECT COUNT(*) as cnt FROM data_reports 
                  WHERE consultant_id = $cId 
                    AND round_id = $targetRoundId 
                    AND status = 'approved'
                    AND resolved_at BETWEEN '$startDate' AND '$endDate'";
    $ticketRes = $conn->query($ticketSql);
    if ($ticketRes && $tRow = $ticketRes->fetch_assoc()) {
        $ticketCount = (int) $tRow['cnt'];
    }

    // Calculate Fair Share Audit received lead count
    // assigned_count = assigned + compensation + rule_6_month + pending_work_hours + max(0, error - compensation)
    $assigned_count = $counts['assigned'] + $counts['compensation'] + $counts['rule_6_month'] + $counts['pending_work_hours'] + max(0, $counts['error'] - $counts['compensation']);

    // Active leads in sale portal count (assigned, rule_6_month, pending_work_hours, compensation)
    $active_portal_count = $counts['assigned'] + $counts['compensation'] + $counts['rule_6_month'] + $counts['pending_work_hours'];

    // Cross-check compensation: expected compensation = error - compensation
    $expected_compensation = max(0, $counts['error'] - $counts['compensation']);

    $auditData[$cId] = [
        'info' => $c,
        'counts' => $counts,
        'ticket_count' => $ticketCount,
        'assigned_count' => $assigned_count,
        'active_portal_count' => $active_portal_count,
        'expected_compensation' => $expected_compensation
    ];
}

// 6. Fetch detailed logs for Nguyễn Phương Uyên (ID 1004)
$uyenId = 1004;
$uyenLogs = [];
$uyenDetailRes = $conn->query("
    SELECT dl.id, dl.lead_id, dl.status, dl.message, dl.received_at,
           l.name as lead_name, l.phone as lead_phone, l.status as lead_status
    FROM distribution_logs dl
    LEFT JOIN leads l ON dl.lead_id = l.id
    WHERE dl.assigned_to = $uyenId 
      AND dl.round_id = $targetRoundId
      AND dl.received_at BETWEEN '$startDate' AND '$endDate'
    ORDER BY dl.received_at DESC
");
if ($uyenDetailRes) {
    while ($row = $uyenDetailRes->fetch_assoc()) {
        $uyenLogs[] = $row;
    }
}

// 7. Fetch pending work hours leads across BBA Round
$pendingLeads = [];
$pendingRes = $conn->query("
    SELECT dl.id, dl.lead_id, dl.assigned_to, dl.received_at, dl.message,
           l.name as lead_name, l.phone as lead_phone,
           c.name as consultant_name, c.work_start_time, c.work_end_time, c.work_schedule
    FROM distribution_logs dl
    JOIN leads l ON dl.lead_id = l.id
    JOIN consultants c ON dl.assigned_to = c.id
    WHERE dl.round_id = $targetRoundId 
      AND dl.status = 'pending_work_hours'
    ORDER BY dl.received_at ASC
");
if ($pendingRes) {
    while ($row = $pendingRes->fetch_assoc()) {
        $pendingLeads[] = $row;
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Báo cáo Đối soát Phân phối & Đền bù Vòng <?php echo htmlspecialchars($targetRoundName); ?></title>
    <style>
        :root {
            --color-bg: #0f172a;
            --color-surface: #1e293b;
            --color-border: #334155;
            --color-primary: #6366f1;
            --color-primary-light: rgba(99, 102, 241, 0.15);
            --color-success: #10b981;
            --color-success-light: rgba(16, 185, 129, 0.1);
            --color-warning: #f59e0b;
            --color-warning-light: rgba(245, 158, 11, 0.1);
            --color-danger: #ef4444;
            --color-danger-light: rgba(239, 68, 68, 0.1);
            --color-text: #f8fafc;
            --color-text-muted: #94a3b8;
            --font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        body {
            background-color: var(--color-bg);
            color: var(--color-text);
            font-family: var(--font-family);
            margin: 0;
            padding: 24px;
            line-height: 1.5;
        }

        .container {
            max-width: 1200px;
            margin: 0;
        }

        header {
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }

        h1 {
            font-size: 1.75rem;
            font-weight: 800;
            margin: 0;
            color: var(--color-text);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        h2 {
            font-size: 1.25rem;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 12px;
            color: var(--color-text);
            border-bottom: 1px dashed var(--color-border);
            padding-bottom: 8px;
        }

        .subtitle {
            color: var(--color-text-muted);
            margin: 4px 0 0 0;
            font-size: 0.9rem;
        }

        .filter-box {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            padding: 8px 16px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        select {
            background: var(--color-bg);
            color: var(--color-text);
            border: 1px solid var(--color-border);
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: 600;
            outline: none;
            cursor: pointer;
        }

        .grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
            margin-bottom: 24px;
        }

        @media (min-width: 992px) {
            .grid-split {
                grid-template-columns: 2fr 1fr;
            }
        }

        .card {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .info-strip {
            background: var(--color-primary-light);
            border: 1px solid rgba(99, 102, 241, 0.3);
            border-left: 4px solid var(--color-primary);
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 0.875rem;
            color: var(--color-text);
            margin-bottom: 20px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
            text-align: left;
        }

        th {
            background: rgba(0, 0, 0, 0.15);
            padding: 12px 16px;
            font-weight: 700;
            color: var(--color-text-muted);
            border-bottom: 2px solid var(--color-border);
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
        }

        td {
            padding: 14px 16px;
            border-bottom: 1px solid var(--color-border);
            vertical-align: middle;
        }

        tr:hover {
            background: rgba(255, 255, 255, 0.02);
        }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 8px;
            border-radius: 20px;
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
        }

        .badge-success { background: var(--color-success-light); color: var(--color-success); border: 1px solid rgba(16, 185, 129, 0.2); }
        .badge-warning { background: var(--color-warning-light); color: var(--color-warning); border: 1px solid rgba(245, 158, 11, 0.2); }
        .badge-danger { background: var(--color-danger-light); color: var(--color-danger); border: 1px solid rgba(239, 68, 68, 0.2); }
        .badge-primary { background: var(--color-primary-light); color: var(--color-primary); border: 1px solid rgba(99, 102, 241, 0.2); }
        .badge-gray { background: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); }

        .sale-profile {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--color-border);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            color: #fff;
            text-transform: uppercase;
            font-size: 0.8rem;
            border: 2px solid var(--color-border);
        }

        .formula-box {
            background: rgba(0, 0, 0, 0.2);
            padding: 16px;
            border-radius: 8px;
            border: 1px solid var(--color-border);
            font-family: monospace;
            font-size: 0.9rem;
            color: var(--color-text);
            margin: 12px 0;
            line-height: 1.6;
        }

        .explanation {
            font-size: 0.85rem;
            color: var(--color-text-muted);
            margin-top: 12px;
        }

        .explanation ul {
            margin: 4px 0;
            padding-left: 20px;
        }

        .alert-card {
            background: rgba(239, 68, 68, 0.05);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-left: 4px solid var(--color-danger);
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .alert-title {
            font-weight: 700;
            color: #f87171;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <div>
            <h1>📊 Đối Soát Phân Phối & Đền Bù</h1>
            <p class="subtitle">Đo lường chi tiết Vòng xoay: <strong><?php echo htmlspecialchars($targetRoundName); ?></strong> | Thời gian: <?php echo $dateLabel; ?></p>
        </div>
        <div class="filter-box">
            <label for="round_select" style="font-size: 0.85rem; font-weight: 700; color: var(--color-text-muted);">Vòng xoay:</label>
            <select id="round_select" onchange="location.href='?round_id=' + this.value">
                <?php foreach ($roundsList as $r): ?>
                    <option value="<?php echo $r['id']; ?>" <?php echo $r['id'] === $targetRoundId ? 'selected' : ''; ?>>
                        <?php echo htmlspecialchars($r['round_name']); ?> <?php echo !$r['is_active'] ? '(Lưu trữ)' : ''; ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
    </header>

    <?php if (empty($consultants)): ?>
        <div class="card" style="text-align: center; padding: 48px;">
            <p style="color: var(--color-text-muted); margin: 0;">Không tìm thấy tư vấn viên hoạt động trong Vòng xoay này.</p>
        </div>
    <?php else: ?>
        <div class="grid">
            <!-- 1. Round Consultants Overview -->
            <div class="card">
                <h2>Cấu hình & Số liệu đối soát các Sale</h2>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Tư vấn viên</th>
                                <th style="text-align: center;">Ratio</th>
                                <th style="text-align: center;">Portal Active</th>
                                <th style="text-align: center;">Chờ Giờ Làm</th>
                                <th style="text-align: center;">Ticket Lỗi</th>
                                <th style="text-align: center;">Đã Bù</th>
                                <th style="text-align: center;">Nợ Bù Vòng</th>
                                <th style="text-align: center; background: rgba(99, 102, 241, 0.1);">Lead Nhận (Đối soát)</th>
                                <th style="text-align: right;">Trực ca</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($auditData as $cId => $data): 
                                $info = $data['info'];
                                $counts = $data['counts'];
                                $initials = implode('', array_map(function($n) { return mb_substr($n, 0, 1); }, explode(' ', $info['name'])));
                            ?>
                                <tr>
                                    <td>
                                        <div class="sale-profile">
                                            <div class="avatar" style="background: <?php echo $cId === $uyenId ? 'var(--color-primary)' : '#475569'; ?>">
                                                <?php echo htmlspecialchars(mb_substr($initials, 0, 2)); ?>
                                            </div>
                                            <div>
                                                <strong style="<?php echo $cId === $uyenId ? 'color: var(--color-primary); font-size: 0.95rem;' : ''; ?>">
                                                    <?php echo htmlspecialchars($info['name']); ?>
                                                </strong>
                                                <span style="display: block; font-size: 0.72rem; color: var(--color-text-muted);">ID: <?php echo $cId; ?></span>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="text-align: center; font-weight: 700; color: var(--color-primary);">x<?php echo $info['receive_ratio']; ?></td>
                                    <td style="text-align: center; font-weight: 700;"><?php echo $data['active_portal_count']; ?></td>
                                    <td style="text-align: center; color: var(--color-warning); font-weight: 700;">
                                        <?php echo $counts['pending_work_hours'] > 0 ? $counts['pending_work_hours'] : '-'; ?>
                                    </td>
                                    <td style="text-align: center; color: var(--color-danger); font-weight: 700;">
                                        <?php echo $counts['error'] > 0 ? $counts['error'] : '-'; ?>
                                    </td>
                                    <td style="text-align: center; color: var(--color-success); font-weight: 700;">
                                        <?php echo $counts['compensation'] > 0 ? $counts['compensation'] : '-'; ?>
                                    </td>
                                    <td style="text-align: center;">
                                        <?php if ($info['compensation_count'] > 0): ?>
                                            <span class="badge badge-primary"><?php echo $info['compensation_count']; ?> số</span>
                                        <?php else: ?>
                                            <span style="color: var(--color-text-muted); opacity: 0.4;">-</span>
                                        <?php endif; ?>
                                    </td>
                                    <td style="text-align: center; font-weight: 800; font-size: 1.05rem; background: rgba(99, 102, 241, 0.05); color: #fff;">
                                        <?php echo $data['assigned_count']; ?>
                                    </td>
                                    <td style="text-align: right;">
                                        <?php if ($info['c_status'] === 'active' && !$info['vacation_mode']): ?>
                                            <span class="badge badge-success">Đang trực</span>
                                        <?php elseif ($info['vacation_mode']): ?>
                                            <span class="badge badge-warning">Nghỉ phép nhanh</span>
                                        <?php else: ?>
                                            <span class="badge badge-danger">Vắng ca</span>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <div class="explanation">
                    <strong>💡 Công thức tính Lead Nhận (Đối soát):</strong>
                    <div class="formula-box">
                        Lead Nhận = Active Portal + max(0, Ticket Lỗi - Đã Bù)
                    </div>
                    <ul>
                        <li><strong>Portal Active</strong>: Các lead hiển thị trong portal của Sale (bao gồm lead được chia trực tiếp, lead bù, và lead chờ giờ làm).</li>
                        <li><strong>Ticket Lỗi</strong>: Lead bị lỗi đã được admin duyệt. Lead này bị ẩn khỏi Portal Sale, nên được bù lại ở phần <code>max(0, Ticket Lỗi - Đã Bù)</code> để giữ nguyên lượt chia tương đương.</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="grid grid-split">
            <!-- 2. Detailed Audit for Nguyễn Phương Uyên (ID 1004) -->
            <div class="card">
                <h2>Chi tiết phân phối & Lịch sử nhận lead của Nguyễn Phương Uyên (ID 1004)</h2>
                
                <?php if (isset($auditData[$uyenId])): 
                    $uData = $auditData[$uyenId];
                    $uCounts = $uData['counts'];
                ?>
                    <div class="info-strip">
                        <strong>Công thức tính của Nguyễn Phương Uyên:</strong><br>
                        Lead Nhận = (<?php echo $uCounts['assigned']; ?> Assigned + <?php echo $uCounts['compensation']; ?> Compensation + <?php echo $uCounts['rule_6_month']; ?> Rule 6M + <?php echo $uCounts['pending_work_hours']; ?> Chờ giờ làm) + max(0, <?php echo $uCounts['error']; ?> Lỗi - <?php echo $uCounts['compensation']; ?> Bù)<br>
                        = <?php echo $uData['active_portal_count']; ?> (Portal Active) + <?php echo $uData['expected_compensation']; ?> (Ticket lỗi chưa bù) = <strong><?php echo $uData['assigned_count']; ?> lead</strong>.
                    </div>
                <?php endif; ?>

                <?php if (empty($uyenLogs)): ?>
                    <p style="color: var(--color-text-muted); text-align: center; padding: 24px;">Không tìm thấy log phân phối nào của Uyên trong tháng này.</p>
                <?php else: ?>
                    <div style="overflow-x: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Thời gian nhận</th>
                                    <th>Khách hàng</th>
                                    <th>Thông tin log</th>
                                    <th style="text-align: center;">Trạng thái log</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($uyenLogs as $log): ?>
                                    <tr>
                                        <td style="white-space: nowrap; font-size: 0.8rem;"><?php echo date('H:i:s d/m/Y', strtotime($log['received_at'])); ?></td>
                                        <td>
                                            <strong><?php echo htmlspecialchars($log['lead_name'] ?: 'Khách hàng ẩn danh'); ?></strong>
                                            <span style="display: block; font-size: 0.72rem; color: var(--color-text-muted);"><?php echo htmlspecialchars($log['lead_phone'] ?: ''); ?></span>
                                        </td>
                                        <td style="font-size: 0.8rem; color: var(--color-text-light); max-width: 350px; line-height: 1.4;">
                                            <?php echo nl2br(htmlspecialchars($log['message'])); ?>
                                        </td>
                                        <td style="text-align: center;">
                                            <?php 
                                            $st = $log['status'];
                                            if ($st === 'assigned') echo '<span class="badge badge-gray">Đã chia</span>';
                                            elseif ($st === 'pending_work_hours') echo '<span class="badge badge-warning">Chờ giờ làm</span>';
                                            elseif ($st === 'error') echo '<span class="badge badge-danger">Ticket Lỗi</span>';
                                            elseif ($st === 'compensation') echo '<span class="badge badge-success">Đã Bù</span>';
                                            else echo '<span class="badge badge-gray">' . htmlspecialchars($st) . '</span>';
                                            ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endif; ?>
            </div>

            <!-- 3. Leads Pending Work Hours (Chờ Giờ Làm) -->
            <div class="card">
                <h2>Leads Chờ Giờ Làm (BBA)</h2>
                <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: -8px; margin-bottom: 16px;">
                    Các lead nhận ngoài giờ làm việc của Sale sẽ được tạm giữ và tự động giải phóng khi Sale đến giờ làm việc.
                </p>

                <?php if (empty($pendingLeads)): ?>
                    <p style="color: var(--color-text-muted); text-align: center; padding: 24px;">Hiện không có lead nào đang ở trạng thái Chờ Giờ Làm.</p>
                <?php else: ?>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <?php foreach ($pendingLeads as $pLead): 
                            $start = $pLead['work_start_time'] ?? '00:00';
                            $end = $pLead['work_end_time'] ?? '23:59';
                            $receivedTime = date('H:i d/m', strtotime($pLead['received_at']));
                        ?>
                            <div style="background: rgba(0, 0, 0, 0.15); border: 1px solid var(--color-border); padding: 12px 14px; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-warning);">Chờ giải phóng</span>
                                    <span style="font-size: 0.72rem; color: var(--color-text-muted);"><?php echo $receivedTime; ?></span>
                                </div>
                                <div style="font-size: 0.85rem;">
                                    Khách hàng: <strong><?php echo htmlspecialchars($pLead['lead_name'] ?: 'Ẩn danh'); ?></strong><br>
                                    Tư vấn viên nhận: <strong><?php echo htmlspecialchars($pLead['consultant_name']); ?></strong><br>
                                    Khung giờ trực: <span style="font-weight: 600; color: var(--color-primary);"><?php echo $start; ?> - <?php echo $end; ?></span>
                                </div>
                                <div style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 8px; border-top: 1px dashed var(--color-border); padding-top: 6px;">
                                    Dự kiến tự động kích hoạt lúc <strong><?php echo $start; ?></strong> của ca làm việc tiếp theo.
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    <?php endif; ?>
</div>

</body>
</html>
