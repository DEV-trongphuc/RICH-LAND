<?php
// backend/check_phone_dup.php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

// Disable error reporting output in prod, but display here for debugging if needed
ini_set('display_errors', 1);
error_reporting(E_ALL);

header("Content-Type: text/html; charset=utf-8");

$phoneInput = isset($_GET['phone']) ? trim($_GET['phone']) : '0945473306';
$normalizedPhone = normalizePhone($phoneInput);

// Fetch duplicate check setting
$dupCheckMonths = (int)get_system_setting($conn, 'duplicate_check_months');
if ($dupCheckMonths <= 0) {
    $dupCheckMonths = 6; // Default to 6 months
}

$crmCheckResult = checkCRMInteraction($conn, $normalizedPhone, '');

// Fetch all matching leads in DB
$leads = [];
$p1 = $normalizedPhone;
// Support searching by both format (with 0 and 84 prefix just in case)
$p2 = '84' . ltrim($normalizedPhone, '0');
$stmt = $conn->prepare("
    SELECT l.*, dr.round_name, c.name as consultant_name, c.avatar as consultant_avatar
    FROM leads l
    LEFT JOIN distribution_rounds dr ON l.target_round_id = dr.id
    LEFT JOIN consultants c ON l.assigned_to = c.id
    WHERE l.phone = ? OR l.phone = ? OR l.phone LIKE ?
    ORDER BY l.last_interaction_date DESC, l.created_at DESC
");
$likePhone = '%' . $normalizedPhone . '%';
$stmt->bind_param("sss", $p1, $p2, $likePhone);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $leads[] = $row;
}
$stmt->close();
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiểm tra trùng số điện thoại</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --color-bg: #f8fafc;
            --color-surface: #ffffff;
            --color-primary: #4f46e5;
            --color-primary-light: #e0e7ff;
            --color-text: #0f172a;
            --color-text-muted: #64748b;
            --color-border: #e2e8f0;
            --color-success: #10b981;
            --color-success-light: #d1fae5;
            --color-danger: #ef4444;
            --color-danger-light: #fee2e2;
            --color-warning: #f59e0b;
            --color-warning-light: #fef3c7;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--color-bg);
            color: var(--color-text);
            margin: 0;
            padding: 2rem 1rem;
            display: flex;
            justify-content: center;
        }

        .container {
            width: 100%;
            max-width: 900px;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .card {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 16px;
            padding: 2rem;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.02);
        }

        .header-title {
            margin: 0 0 0.5rem 0;
            font-size: 1.5rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .phone-highlight {
            color: var(--color-primary);
            background: var(--color-primary-light);
            padding: 2px 10px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 1.25rem;
        }

        .system-config {
            font-size: 0.875rem;
            color: var(--color-text-muted);
            margin-bottom: 1.5rem;
            background: #f1f5f9;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            display: inline-block;
        }

        /* Conclusion Banner Styles */
        .banner {
            padding: 1.25rem 1.5rem;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            border: 1px solid transparent;
        }

        .banner.danger {
            background-color: #fef2f2;
            border-color: #fca5a5;
            color: #991b1b;
        }

        .banner.success {
            background-color: #f0fdf4;
            border-color: #86efac;
            color: #166534;
        }

        .banner.warning {
            background-color: #fffbeb;
            border-color: #fcd34d;
            color: #92400e;
        }

        .banner-title {
            font-size: 1.1rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .banner-desc {
            font-size: 0.9rem;
            line-height: 1.5;
            opacity: 0.9;
        }

        /* Table Styles */
        .table-wrapper {
            overflow-x: auto;
            border: 1px solid var(--color-border);
            border-radius: 12px;
            margin-top: 1rem;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 0.875rem;
        }

        th {
            background: #f8fafc;
            padding: 1rem;
            font-weight: 700;
            color: var(--color-text-muted);
            border-bottom: 1px solid var(--color-border);
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.5px;
        }

        td {
            padding: 1rem;
            border-bottom: 1px solid var(--color-border);
            vertical-align: middle;
        }

        tr:last-child td {
            border-bottom: none;
        }

        /* Badges */
        .badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
        }

        .badge.success { background: var(--color-success-light); color: var(--color-success); }
        .badge.danger { background: var(--color-danger-light); color: var(--color-danger); }
        .badge.warning { background: var(--color-warning-light); color: var(--color-warning); }
        .badge.muted { background: #e2e8f0; color: #475569; }

        .avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--color-primary-light);
            color: var(--color-primary);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            font-weight: 700;
            vertical-align: middle;
        }

        .search-form {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }

        .search-input {
            padding: 0.625rem 1rem;
            border: 1px solid var(--color-border);
            border-radius: 8px;
            font-size: 0.9rem;
            width: 250px;
            font-family: inherit;
        }

        .search-btn {
            background: var(--color-primary);
            color: white;
            border: none;
            padding: 0.625rem 1.25rem;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        .search-btn:hover {
            opacity: 0.9;
        }

        .detail-item {
            font-size: 0.8125rem;
            color: var(--color-text-muted);
            margin-top: 2px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1 class="header-title">
                Kiểm tra trùng Lead: <span class="phone-highlight"><?php echo htmlspecialchars($phoneInput); ?></span>
            </h1>
            
            <form class="search-form" method="GET" action="">
                <input type="text" name="phone" class="search-input" value="<?php echo htmlspecialchars($phoneInput); ?>" placeholder="Nhập số điện thoại cần kiểm tra...">
                <button type="submit" class="search-btn">Kiểm tra</button>
            </form>

            <div class="system-config">
                Cấu hình hệ thống check trùng (<code>duplicate_check_months</code>): <strong><?php echo $dupCheckMonths; ?> tháng</strong>
                <?php if ($normalizedPhone !== $phoneInput): ?>
                    | SĐT chuẩn hóa: <strong><?php echo htmlspecialchars($normalizedPhone); ?></strong>
                <?php endif; ?>
            </div>

            <?php if (empty($leads)): ?>
                <div class="banner success">
                    <div class="banner-title">
                        ✅ Không tìm thấy dữ liệu trùng
                    </div>
                    <div class="banner-desc">
                        Không tìm thấy bất kỳ Lead nào có số điện thoại này trong cơ sở dữ liệu. Số điện thoại hoàn toàn mới và có thể tiếp nhận phân bổ bình thường.
                    </div>
                </div>
            <?php else: ?>
                <!-- Conclusion Banner based on rules -->
                <?php
                $latestLead = $leads[0];
                $lastInteractionDate = $latestLead['last_interaction_date'] ?: $latestLead['created_at'];
                
                $lastInt = new DateTime($lastInteractionDate);
                $now = new DateTime();
                $diff = $now->diff($lastInt);
                $monthsSinceLast = ($diff->format('%y') * 12) + $diff->format('%m');
                $daysSinceLast = $diff->days;

                $isDuplicateUnderNMonths = ($monthsSinceLast < $dupCheckMonths);
                ?>

                <?php if ($isDuplicateUnderNMonths): ?>
                    <div class="banner danger">
                        <div class="banner-title">
                            ⚠️ Phát hiện trùng lặp dưới <?php echo $dupCheckMonths; ?> tháng
                        </div>
                        <div class="banner-desc">
                            Số điện thoại này đã có lịch sử trong hệ thống. Lần tương tác gần nhất là cách đây 
                            <strong><?php echo $monthsSinceLast; ?> tháng (<?php echo $daysSinceLast; ?> ngày)</strong> vào lúc 
                            <code><?php echo $lastInteractionDate; ?></code>.<br>
                            Vì khoảng cách thời gian nhỏ hơn quy định <strong><?php echo $dupCheckMonths; ?> tháng</strong>, lead này 
                            <strong>BỊ COI LÀ TRÙNG LẶP</strong>. Theo logic hệ thống, lead mới đổ về sẽ được phân phối dạng <em>duplicate/reminder</em> về cho Sale cũ chăm sóc (<strong><?php echo htmlspecialchars($latestLead['consultant_name'] ?: 'Không rõ'); ?></strong>).
                        </div>
                    </div>
                <?php else: ?>
                    <div class="banner success">
                        <div class="banner-title">
                            ✅ Đạt tiêu chuẩn phân bổ mới (Trùng > <?php echo $dupCheckMonths; ?> tháng)
                        </div>
                        <div class="banner-desc">
                            Số điện thoại này đã từng có trong hệ thống, nhưng lần tương tác cuối cùng là cách đây 
                            <strong><?php echo $monthsSinceLast; ?> tháng (<?php echo $daysSinceLast; ?> ngày)</strong> vào lúc 
                            <code><?php echo $lastInteractionDate; ?></code>.<br>
                            Khoảng cách này đã vượt quá thời hạn quy định <strong><?php echo $dupCheckMonths; ?> tháng</strong>. 
                            Lead mới đổ về sẽ được coi là **Hợp lệ (Không trùng)** và được hệ thống phân bổ mới xoay vòng bình thường cho các Sale tiếp theo.
                        </div>
                    </div>
                <?php endif; ?>

                <h3>Chi tiết lịch sử lưu vết (Tổng số: <?php echo count($leads); ?> bản ghi)</h3>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ID & Tên</th>
                                <th>Nguồn & Vòng</th>
                                <th>Trạng thái Lead</th>
                                <th>Người phụ trách</th>
                                <th>Thời gian</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($leads as $l): ?>
                                <?php
                                $leadIntDate = $l['last_interaction_date'] ?: $l['created_at'];
                                $leadInt = new DateTime($leadIntDate);
                                $itemDiff = $now->diff($leadInt);
                                $itemMonths = ($itemDiff->format('%y') * 12) + $itemDiff->format('%m');
                                ?>
                                <tr>
                                    <td>
                                        <div style="font-weight: 700;">#<?php echo $l['id']; ?> - <?php echo htmlspecialchars($l['name']); ?></div>
                                        <div class="detail-item" style="font-family: monospace;"><?php echo htmlspecialchars($l['phone']); ?></div>
                                        <div class="detail-item"><?php echo htmlspecialchars($l['email']); ?></div>
                                    </td>
                                    <td>
                                        <div><?php echo htmlspecialchars($l['source']); ?></div>
                                        <div class="detail-item">Vòng: <?php echo htmlspecialchars($l['round_name'] ?: '-'); ?></div>
                                    </td>
                                    <td>
                                        <?php
                                        $statusClass = 'muted';
                                        $statusText = $l['status'];
                                        if ($l['status'] === 'active') { $statusClass = 'success'; $statusText = 'Hoạt động'; }
                                        elseif ($l['status'] === 'pending_approval') { $statusClass = 'warning'; $statusText = 'Tạm giữ duyệt'; }
                                        elseif ($l['status'] === 'rejected') { $statusClass = 'danger'; $statusText = 'Dưới chuẩn'; }
                                        elseif ($l['status'] === 'blacklisted') { $statusClass = 'danger'; $statusText = 'Blacklist'; }
                                        ?>
                                        <span class="badge <?php echo $statusClass; ?>"><?php echo $statusText; ?></span>
                                        <?php if (!empty($l['ai_screener_status'])): ?>
                                            <div class="detail-item">AI: <strong><?php echo $l['ai_screener_status']; ?></strong></div>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <?php if (!empty($l['consultant_name'])): ?>
                                            <div class="avatar"><?php echo mb_substr($l['consultant_name'], 0, 1); ?></div>
                                            <span style="font-weight: 500;"><?php echo htmlspecialchars($l['consultant_name']); ?></span>
                                        <?php else: ?>
                                            <span style="color: var(--color-text-muted);">-</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <div>Nhận: <?php echo $l['created_at']; ?></div>
                                        <div class="detail-item">Tương tác cuối: <?php echo $l['last_interaction_date'] ?: '-'; ?></div>
                                        <div style="font-size: 0.75rem; color: var(--color-primary); font-weight: 700; margin-top: 4px;">
                                            Cách đây: <?php echo $itemMonths; ?> tháng
                                        </div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
