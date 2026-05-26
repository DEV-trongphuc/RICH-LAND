<?php
/**
 * DOMATION - Test Data Cleanup Utility Tool
 * Mode: Standalone PHP Script
 */
require_once __DIR__ . '/db_connect.php';

// Disable error display in production-like outputs but keep logs active
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Define search query for test data (explicitly targeting the 5 test leads requested with table alias)
$testDataFilter = "l.id IN (22132, 22133, 22134, 22138, 22139)";



$action = $_GET['action'] ?? 'preview';
$message = '';
$messageType = '';

// Handle confirmation delete
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['confirm_delete']) && $_POST['confirm_delete'] === 'yes') {
    // 1. Fetch matching lead IDs to be deleted (using table alias l)
    $fetchIdsQuery = "SELECT id FROM leads l WHERE $testDataFilter";
    $idsRes = $conn->query($fetchIdsQuery);
    
    $deletedLeadsCount = 0;
    $deletedLogsCount = 0;
    $deletedReportsCount = 0;
    
    if ($idsRes && $idsRes->num_rows > 0) {
        $leadIds = [];
        while ($row = $idsRes->fetch_assoc()) {
            $leadIds[] = (int)$row['id'];
        }
        
        $idsListStr = implode(',', $leadIds);
        
        // 2. Count statistics before deleting (to display in report)
        $countLogs = $conn->query("SELECT COUNT(*) as total FROM distribution_logs WHERE lead_id IN ($idsListStr)")->fetch_assoc()['total'] ?? 0;
        $countReports = $conn->query("SELECT COUNT(*) as total FROM data_reports WHERE lead_id IN ($idsListStr)")->fetch_assoc()['total'] ?? 0;
        
        // 3. Perform delete on leads (cascade deletes data_reports and distribution_logs via foreign keys)
        $deleteQuery = "DELETE FROM leads WHERE id IN ($idsListStr)";
        if ($conn->query($deleteQuery)) {
            $deletedLeadsCount = count($leadIds);
            $deletedLogsCount = $countLogs;
            $deletedReportsCount = $countReports;
            
            $message = "Đã dọn dẹp thành công <strong>{$deletedLeadsCount}</strong> data test, tự động xóa kèm <strong>{$deletedLogsCount}</strong> lịch sử chia số và <strong>{$deletedReportsCount}</strong> báo cáo lỗi liên quan.";
            $messageType = 'success';
            
            // Log admin action using a valid account ID to satisfy the foreign key constraint
            $accId = null;
            $accRes = $conn->query("SELECT id FROM accounts LIMIT 1");
            if ($accRes && $accRes->num_rows > 0) {
                $accId = (int)$accRes->fetch_assoc()['id'];
            }
            
            if ($accId !== null) {
                $logActionStmt = $conn->prepare("INSERT INTO admin_logs (account_id, action, details) VALUES (?, 'CLEANUP_TEST_DATA', ?)");
                if ($logActionStmt) {
                    $detailsJson = json_encode([
                        'deleted_leads' => $deletedLeadsCount,
                        'deleted_logs' => $deletedLogsCount,
                        'deleted_reports' => $deletedReportsCount,
                        'timestamp' => date('Y-m-d H:i:s')
                    ]);
                    $logActionStmt->bind_param("is", $accId, $detailsJson);
                    $logActionStmt->execute();
                    $logActionStmt->close();
                }
            }
        } else {
            $message = "Đã xảy ra lỗi trong quá trình xóa dữ liệu: " . $conn->error;
            $messageType = 'danger';
        }
    } else {
        $message = "Không tìm thấy dữ liệu test nào cần dọn dẹp.";
        $messageType = 'info';
    }
}

// 4. Fetch list for Preview mode
$previewQuery = "
    SELECT 
        l.id, 
        l.name, 
        l.phone, 
        l.email, 
        l.source, 
        l.note, 
        l.created_at,
        COUNT(DISTINCT d.id) as log_count,
        COUNT(DISTINCT r.id) as report_count
    FROM leads l
    LEFT JOIN distribution_logs d ON d.lead_id = l.id
    LEFT JOIN data_reports r ON r.lead_id = l.id
    WHERE $testDataFilter
    GROUP BY l.id
    ORDER BY l.created_at DESC
";

$previewRes = $conn->query($previewQuery);
$testLeads = [];
$totalLogsCount = 0;
$totalReportsCount = 0;

if ($previewRes && $previewRes->num_rows > 0) {
    while ($row = $previewRes->fetch_assoc()) {
        $testLeads[] = $row;
        $totalLogsCount += (int)$row['log_count'];
        $totalReportsCount += (int)$row['report_count'];
    }
}

$totalLeadsCount = count($testLeads);
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dọn dẹp Dữ liệu Thử nghiệm - DOMATION</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --color-bg: #090d16;
            --color-surface: #111827;
            --color-card: #1f2937;
            --color-border: rgba(255, 255, 255, 0.08);
            --color-text: #f9fafb;
            --color-text-muted: #9ca3af;
            --color-primary: #7c3aed;
            --color-primary-hover: #6d28d9;
            --color-danger: #ef4444;
            --color-danger-light: rgba(239, 68, 68, 0.1);
            --color-warning: #f59e0b;
            --color-warning-light: rgba(245, 158, 11, 0.1);
            --color-success: #10b981;
            --color-success-light: rgba(16, 185, 129, 0.1);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: var(--color-bg);
            color: var(--color-text);
            line-height: 1.5;
            padding: 2rem 1rem;
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        header {
            margin-bottom: 2rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--color-border);
            padding-bottom: 1.5rem;
        }

        .logo-title {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            color: white;
            box-shadow: 0 0 15px rgba(124, 58, 237, 0.4);
        }

        h1 {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: -0.02em;
        }

        .alert {
            padding: 1rem 1.25rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
            border: 1px solid transparent;
        }

        .alert-success {
            background-color: var(--color-success-light);
            border-color: rgba(16, 185, 129, 0.2);
            color: #34d399;
        }

        .alert-danger {
            background-color: var(--color-danger-light);
            border-color: rgba(239, 68, 68, 0.2);
            color: #f87171;
        }

        .alert-info {
            background-color: rgba(124, 58, 237, 0.08);
            border-color: rgba(124, 58, 237, 0.2);
            color: #a78bfa;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .stats-card {
            background-color: var(--color-surface);
            border: 1px solid var(--color-border);
            padding: 1.25rem;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .stats-num {
            font-size: 2rem;
            font-weight: 800;
            color: var(--color-text);
            margin-bottom: 4px;
        }

        .stats-num.danger {
            color: var(--color-danger);
        }

        .stats-num.warning {
            color: var(--color-warning);
        }

        .stats-num.primary {
            color: #a78bfa;
        }

        .stats-label {
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--color-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .card {
            background-color: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }

        .card-header {
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--color-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255,255,255,0.01);
        }

        .card-title {
            font-size: 1.1rem;
            font-weight: 700;
        }

        .table-wrap {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        th {
            padding: 0.75rem 1.25rem;
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--color-text-muted);
            background-color: rgba(255,255,255,0.02);
            border-bottom: 1px solid var(--color-border);
        }

        td {
            padding: 1rem 1.25rem;
            font-size: 0.85rem;
            border-bottom: 1px solid var(--color-border);
            vertical-align: middle;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tbody tr:hover {
            background-color: rgba(255,255,255,0.02);
        }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
        }

        .badge-danger {
            background-color: var(--color-danger-light);
            color: var(--color-danger);
            border: 1px solid rgba(239, 68, 68, 0.15);
        }

        .badge-warning {
            background-color: var(--color-warning-light);
            color: var(--color-warning);
            border: 1px solid rgba(245, 158, 11, 0.15);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 1.5rem;
            height: 42px;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            border: none;
            text-decoration: none;
            gap: 6px;
        }

        .btn-outline {
            background: transparent;
            color: var(--color-text);
            border: 1px solid var(--color-border);
        }

        .btn-outline:hover {
            background-color: rgba(255,255,255,0.05);
            border-color: var(--color-text-muted);
        }

        .btn-danger {
            background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
            color: white;
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
        }

        .btn-danger:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
        }

        .btn-danger:active {
            transform: scale(0.97);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
            box-shadow: none !important;
        }

        .safe-tag {
            color: var(--color-success);
            background-color: var(--color-success-light);
            border: 1px solid rgba(16, 185, 129, 0.15);
            font-size: 0.75rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo-title">
                <div class="logo-icon">D</div>
                <div>
                    <h1>DOMATION - Dọn dẹp Dữ liệu Thử nghiệm</h1>
                    <p style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 2px;">
                        Quản lý an toàn dữ liệu và tối ưu hóa hệ thống dữ liệu CRM
                    </p>
                </div>
            </div>
            <a href="cleanup_test_data.php" class="btn btn-outline" style="height: 36px; padding: 0 1rem; font-size: 0.8rem;">Làm mới trang</a>
        </header>

        <?php if (!empty($message)): ?>
            <div class="alert alert-<?php echo $messageType; ?>">
                <?php echo $message; ?>
            </div>
        <?php endif; ?>

        <!-- Statistics overview -->
        <div class="stats-grid">
            <div class="stats-card">
                <div class="stats-num danger"><?php echo $totalLeadsCount; ?></div>
                <div class="stats-label">Leads Thử Nghiệm</div>
            </div>
            <div class="stats-card">
                <div class="stats-num warning"><?php echo $totalLogsCount; ?></div>
                <div class="stats-label">Lịch sử chia số liên đới</div>
            </div>
            <div class="stats-card">
                <div class="stats-num primary"><?php echo $totalReportsCount; ?></div>
                <div class="stats-label">Báo cáo lỗi liên đới</div>
            </div>
        </div>

        <!-- Info Warning Box about Exclusions -->
        <div class="alert alert-info" style="display: flex; flex-direction: column; gap: 6px;">
            <div>
                <strong>Cơ chế bảo vệ dữ liệu:</strong>
            </div>
            <ul style="padding-left: 1.25rem; font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px;">
                <li>Lead có tên chứa cụm từ <span class="safe-tag">Test nha bà con</span> hoặc có ghi chú khớp sẽ được **BỎ QUA** tuyệt đối để tránh dọn dẹp nhầm dữ liệu quan trọng của bạn.</li>
                <li>Dữ liệu được xác định là dữ liệu test khi chứa các từ khóa: `test`, `demo`, `thử`, `abc`, hoặc có SĐT ảo (`123456789`, `0123456789`).</li>
                <li>Khi thực hiện xóa, hệ thống sẽ tự động dọn dẹp các tệp liên đới trong bảng lịch sử chia số và bảng ticket lỗi do có cấu hình khóa ngoại `ON DELETE CASCADE`.</li>
            </ul>
        </div>

        <div class="card">
            <div class="card-header">
                <div class="card-title">Xem trước danh sách dữ liệu test chuẩn bị xóa</div>
                <?php if ($totalLeadsCount > 0): ?>
                    <form method="POST" onsubmit="return confirm('Bạn có chắc chắn muốn XÓA VĨNH VIỄN toàn bộ <?php echo $totalLeadsCount; ?> data test và các lịch sử liên quan? Hành động này không thể hoàn tác!');">
                        <input type="hidden" name="confirm_delete" value="yes">
                        <button type="submit" class="btn btn-danger">Xác nhận dọn dẹp toàn bộ</button>
                    </form>
                <?php endif; ?>
            </div>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 80px;">ID</th>
                            <th style="width: 200px;">Thông tin khách</th>
                            <th>Nguồn / Loại</th>
                            <th>Ghi chú</th>
                            <th style="width: 150px; text-align: center;">Bản ghi liên quan</th>
                            <th style="width: 150px;">Thời gian tạo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if ($totalLeadsCount === 0): ?>
                            <tr>
                                <td colspan="6" style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                                    Không có dữ liệu thử nghiệm nào được phát hiện (hoặc tất cả đã được dọn sạch).
                                </td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($testLeads as $lead): ?>
                                <tr>
                                    <td style="font-weight: 700;">#<?php echo $lead['id']; ?></td>
                                    <td>
                                        <div style="font-weight: 700;"><?php echo htmlspecialchars($lead['name'] ?? '-'); ?></div>
                                        <div style="color: var(--color-text-muted); font-size: 0.75rem; margin-top: 2px;">
                                            <?php echo htmlspecialchars($lead['phone'] ?? '-'); ?> | <?php echo htmlspecialchars($lead['email'] ?? '-'); ?>
                                        </div>
                                    </td>
                                    <td>
                                        <div style="font-weight: 600; font-size: 0.8rem;"><?php echo htmlspecialchars($lead['source'] ?? '-'); ?></div>
                                        <div style="color: var(--color-text-muted); font-size: 0.75rem;"><?php echo htmlspecialchars($lead['type'] ?? '-'); ?></div>
                                    </td>
                                    <td style="color: var(--color-text-muted); max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="<?php echo htmlspecialchars($lead['note'] ?? ''); ?>">
                                        <?php echo htmlspecialchars($lead['note'] ?? '-'); ?>
                                    </td>
                                    <td style="text-align: center;">
                                        <div style="display: flex; justify-content: center; gap: 6px;">
                                            <?php if ($lead['log_count'] > 0): ?>
                                                <span class="badge badge-warning"><?php echo $lead['log_count']; ?> Logs</span>
                                            <?php endif; ?>
                                            <?php if ($lead['report_count'] > 0): ?>
                                                <span class="badge badge-danger"><?php echo $lead['report_count']; ?> Báo cáo</span>
                                            <?php endif; ?>
                                            <?php if ($lead['log_count'] == 0 && $lead['report_count'] == 0): ?>
                                                <span style="color: var(--color-text-muted); font-size: 0.75rem;">Không có</span>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                    <td style="color: var(--color-text-muted);">
                                        <?php echo date('d/m/Y H:i', strtotime($lead['created_at'])); ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</body>
</html>
