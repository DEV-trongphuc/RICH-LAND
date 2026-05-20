<?php
// verify_sheet.php
// Diagnostic tool to inspect Google Sheets rows and explain why they sync or fail to sync.

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

// Check if a connection ID is requested
$selected_conn_id = isset($_GET['connection_id']) ? (int)$_GET['connection_id'] : null;

// Handle Reset Hash Action
if (isset($_GET['action']) && $_GET['action'] === 'reset_hash' && isset($_GET['row_hash'])) {
    $reset_conn_id = isset($_GET['connection_id']) ? (int)$_GET['connection_id'] : 0;
    $row_hash = trim($_GET['row_hash']);
    if ($reset_conn_id > 0 && !empty($row_hash)) {
        $stmt = $conn->prepare("DELETE FROM sheet_sync_records WHERE connection_id = ? AND row_hash = ?");
        $stmt->bind_param("is", $reset_conn_id, $row_hash);
        $stmt->execute();
        header("Location: verify_sheet.php?connection_id=" . $reset_conn_id . "&reset_success=1");
        exit;
    }
}

// Get all active connections
$connections = [];
$res = $conn->query("SELECT id, sheet_name, spreadsheet_id, connection_type, require_both_contact, is_silent, sync_mode FROM sheet_connections WHERE is_active = 1");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $connections[] = $row;
    }
}

if ($selected_conn_id === null && !empty($connections)) {
    $selected_conn_id = $connections[0]['id'];
}

$connItem = null;
foreach ($connections as $c) {
    if ($c['id'] === $selected_conn_id) {
        $connItem = $c;
        break;
    }
}

// Fetch diagnostic logs if we have a connection
$diagnosticRows = [];
$errorMsg = null;
$headers = [];

if ($connItem) {
    try {
        // Fetch field mappings
        $mapStmt = $conn->prepare("SELECT sheet_column, system_field, custom_label FROM field_mappings WHERE connection_id = ?");
        $mapStmt->bind_param("i", $connItem['id']);
        $mapStmt->execute();
        $mappingsResult = $mapStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        
        $mappings = [];
        foreach ($mappingsResult as $mRow) {
            $sysField = $mRow['system_field'];
            if (!isset($mappings[$sysField])) {
                $mappings[$sysField] = [];
            }
            $mappings[$sysField][] = [
                'sheet_column' => $mRow['sheet_column'],
                'custom_label' => $mRow['custom_label']
            ];
        }

        // Helper function for extraction
        $extractMappedValuesLocal = function($mappingsArray, $systemField, $data) {
            if (!isset($mappingsArray[$systemField])) return '';
            $values = [];
            foreach ($mappingsArray[$systemField] as $mapItem) {
                $colName = $mapItem['sheet_column'];
                $customLabel = $mapItem['custom_label'];
                if (isset($data[$colName]) && $data[$colName] !== '') {
                    $label = !empty($customLabel) ? $customLabel : $colName;
                    $values[] = $label . ': ' . $data[$colName];
                }
            }
            if (count($values) === 1 && in_array($systemField, ['phone', 'email', 'name'])) {
                $colName = $mappingsArray[$systemField][0]['sheet_column'];
                return $data[$colName] ?? '';
            }
            return implode("\n", $values);
        };

        $getLeadDetailLocal = function($conn, $phone, $email) {
            if (empty($phone) && empty($email)) return null;
            $where = [];
            $params = [];
            $types = '';
            if (!empty($phone)) {
                $where[] = "phone = ?";
                $params[] = $phone;
                $types .= 's';
            }
            if (!empty($email)) {
                $where[] = "email = ?";
                $params[] = $email;
                $types .= 's';
            }
            $whereClause = implode(" OR ", $where);
            $stmt = $conn->prepare("SELECT l.id, c.name as consultant_name FROM leads l LEFT JOIN consultants c ON l.assigned_to = c.id WHERE $whereClause ORDER BY l.last_interaction_date DESC LIMIT 1");
            if (!empty($params)) {
                $stmt->bind_param($types, ...$params);
            }
            $stmt->execute();
            $res = $stmt->get_result();
            $stmt->close();
            if ($res && $res->num_rows > 0) {
                return $res->fetch_assoc();
            }
            return null;
        };


        // Fetch CSV from Google Sheets
        $csvUrl = "https://docs.google.com/spreadsheets/d/" . trim($connItem['spreadsheet_id']) . "/gviz/tq?tqx=out:csv";
        if (!empty($connItem['sheet_name'])) {
            $csvUrl .= "&sheet=" . urlencode($connItem['sheet_name']);
        }
        
        $ch = curl_init($csvUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        $csvData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($csvData)) {
            throw new Exception("Không thể tải file CSV từ Google Sheet. Mã phản hồi HTTP: $httpCode. Vui lòng kiểm tra quyền chia sẻ link (Bất kỳ ai có liên kết đều có thể xem).");
        }

        // Parse CSV data
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $csvData);
        rewind($stream);

        // Fetch all existing hashes to prevent N+1 Queries
        $hashMap = [];
        $existingHashesStmt = $conn->prepare("SELECT row_hash, synced_at FROM sheet_sync_records WHERE connection_id = ?");
        $existingHashesStmt->bind_param("i", $connItem['id']);
        $existingHashesStmt->execute();
        $existingHashesRes = $existingHashesStmt->get_result();
        while ($hRow = $existingHashesRes->fetch_assoc()) {
            $hashMap[$hRow['row_hash']] = $hRow['synced_at'];
        }

        $rowCount = 0;
        while (($row = fgetcsv($stream)) !== FALSE) {
            $row = array_map(function($val) { return trim($val ?? '', "\" "); }, $row);
            if ($rowCount === 0) {
                $headers = $row;
                $rowCount++;
                continue;
            }
            $rowCount++;

            if (empty(array_filter($row))) {
                $diagnosticRows[] = [
                    'row_num' => $rowCount,
                    'raw' => $row,
                    'status' => 'SKIP',
                    'message' => 'Dòng trống rỗng',
                    'class' => 'table-secondary',
                    'extracted' => []
                ];
                continue;
            }

            $rowData = [];
            foreach ($headers as $colIdx => $colName) {
                $rowData[$colName] = $row[$colIdx] ?? '';
            }

            $rowHash = md5(json_encode($rowData));
            
            $phone = normalizePhone($extractMappedValuesLocal($mappings, 'phone', $rowData));
            $email = $extractMappedValuesLocal($mappings, 'email', $rowData);
            $name = $extractMappedValuesLocal($mappings, 'name', $rowData);
            
            $extracted = [
                'name' => $name,
                'phone' => $phone,
                'email' => $email,
                'hash' => $rowHash
            ];

            // 1. Check if hash exists
            if (isset($hashMap[$rowHash])) {
                // Check if this lead actually exists in CRM
                $crmCheck = checkCRMInteraction($conn, $phone, $email);
                
                $leadId = '';
                $assignedName = '';
                if ($crmCheck['isDuplicate']) {
                    $lDetail = $getLeadDetailLocal($conn, $phone, $email);
                    if ($lDetail) {
                        $leadId = $lDetail['id'];
                        $assignedName = $lDetail['consultant_name'] ?? 'Không rõ';
                    }
                }
                
                $existMsg = $crmCheck['isDuplicate'] ? "Khách hàng đang có trong CRM (ID Lead: " . $leadId . ", Sale: " . $assignedName . ")" : "Đã đồng bộ nhưng Lead không còn trong bảng leads (có thể đã bị xóa)";
                
                $diagnosticRows[] = [
                    'row_num' => $rowCount,
                    'raw' => $rowData,
                    'status' => 'ALREADY_SYNCED',
                    'message' => 'Đã quét qua trước đó (Lần cuối: ' . $hashMap[$rowHash] . '). ' . $existMsg,
                    'class' => 'table-success',
                    'extracted' => $extracted,
                    'is_duplicate' => $crmCheck['isDuplicate']
                ];
                continue;
            }

            // 2. Check contact info missing
            $contactMissing = false;
            $missingReason = '';
            if (!empty($connItem['require_both_contact'])) {
                if (empty($phone) || empty($email)) {
                    $contactMissing = true;
                    $missingReason = 'Yêu cầu cả SĐT và Email nhưng bị thiếu (SĐT: ' . ($phone ?: 'Rỗng') . ', Email: ' . ($email ?: 'Rỗng') . ')';
                }
            } else {
                if (empty($phone) && empty($email)) {
                    $contactMissing = true;
                    $missingReason = 'Yêu cầu ít nhất SĐT hoặc Email nhưng cả hai đều rỗng';
                }
            }

            if ($contactMissing) {
                $diagnosticRows[] = [
                    'row_num' => $rowCount,
                    'raw' => $rowData,
                    'status' => 'INVALID_CONTACT',
                    'message' => $missingReason,
                    'class' => 'table-danger',
                    'extracted' => $extracted
                ];
                continue;
            }

            // 3. Check Global Exclusion (Blacklist)
            if (checkGlobalExclusion($conn, $rowData, $phone, $email)) {
                $diagnosticRows[] = [
                    'row_num' => $rowCount,
                    'raw' => $rowData,
                    'status' => 'BLACKLISTED',
                    'message' => 'Bị loại trừ bởi cấu hình Blacklist toàn cục (SĐT/Email hoặc Từ khóa trong dòng)',
                    'class' => 'table-warning',
                    'extracted' => $extracted
                ];
                continue;
            }

            // 4. Ready to sync / CRM duplication check
            $crmCheck = checkCRMInteraction($conn, $phone, $email);
            
            $fbSettings = get_system_setting($conn);
            $dupCheckMonths = (int)($fbSettings['duplicate_check_months'] ?? 6);
            if ($dupCheckMonths <= 0) {
                $dupCheckMonths = 6;
            }

            if ($crmCheck['isDuplicate']) {
                $leadId = '';
                $assignedName = '';
                $lDetail = $getLeadDetailLocal($conn, $phone, $email);
                if ($lDetail) {
                    $leadId = $lDetail['id'];
                    $assignedName = $lDetail['consultant_name'] ?? 'Không rõ';
                }

                if ($crmCheck['monthsSinceLastInteraction'] < $dupCheckMonths) {
                    $msg = "Khách hàng TRÙNG trong CRM (Tương tác cuối cách đây " . number_format($crmCheck['monthsSinceLastInteraction'], 1) . " tháng < hạn định " . $dupCheckMonths . " tháng). Sẽ gửi nhắc nhở cho Sale: " . $assignedName;
                    $cls = 'table-info';
                } else {
                    $msg = "Khách hàng TRÙNG trong CRM nhưng đã quá hạn định check trùng (" . number_format($crmCheck['monthsSinceLastInteraction'], 1) . " tháng >= " . $dupCheckMonths . " tháng). Sẽ chia mới cho Sale tiếp theo.";
                    $cls = 'table-primary';
                }
            } else {
                $msg = "Dòng dữ liệu MỚI HOÀN TOÀN. Sẽ tiến hành đồng bộ và định tuyến chia số.";
                $cls = 'table-primary';
            }

            $diagnosticRows[] = [
                'row_num' => $rowCount,
                'raw' => $rowData,
                'status' => 'PENDING_SYNC',
                'message' => $msg,
                'class' => $cls,
                'extracted' => $extracted
            ];
        }

    } catch (Exception $e) {
        $errorMsg = $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Google Sheets Sync Diagnostic Tool</title>
    <!-- Google Fonts Inter & Outfit -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #0f172a;
            color: #e2e8f0;
            padding-top: 30px;
            padding-bottom: 50px;
        }
        h1, h2, h3 {
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
        }
        .card {
            background-color: #1e293b;
            border: 1px solid #334155;
            color: #f1f5f9;
        }
        .form-select {
            background-color: #0f172a;
            border-color: #475569;
            color: #f8fafc;
        }
        .form-select:focus {
            background-color: #0f172a;
            color: #f8fafc;
            border-color: #10b981;
            box-shadow: 0 0 0 0.25rem rgba(16, 185, 129, 0.25);
        }
        .btn-success {
            background-color: #10b981;
            border-color: #10b981;
        }
        .btn-success:hover {
            background-color: #059669;
            border-color: #059669;
        }
        .table {
            color: #f1f5f9;
        }
        .table-success {
            --bs-table-bg: rgba(16, 185, 129, 0.15);
            --bs-table-color: #34d399;
            border-color: rgba(16, 185, 129, 0.25);
        }
        .table-danger {
            --bs-table-bg: rgba(239, 68, 68, 0.15);
            --bs-table-color: #f87171;
            border-color: rgba(239, 68, 68, 0.25);
        }
        .table-warning {
            --bs-table-bg: rgba(245, 158, 11, 0.15);
            --bs-table-color: #fbbf24;
            border-color: rgba(245, 158, 11, 0.25);
        }
        .table-info {
            --bs-table-bg: rgba(59, 130, 246, 0.15);
            --bs-table-color: #60a5fa;
            border-color: rgba(59, 130, 246, 0.25);
        }
        .table-primary {
            --bs-table-bg: rgba(139, 92, 246, 0.15);
            --bs-table-color: #a78bfa;
            border-color: rgba(139, 92, 246, 0.25);
        }
        .badge {
            font-size: 0.8rem;
            padding: 0.35em 0.65em;
        }
        .badge-success { background-color: #10b981; color: #fff; }
        .badge-danger { background-color: #ef4444; color: #fff; }
        .badge-warning { background-color: #f59e0b; color: #fff; }
        .badge-info { background-color: #3b82f6; color: #fff; }
        .badge-primary { background-color: #8b5cf6; color: #fff; }
        .badge-secondary { background-color: #64748b; color: #fff; }
    </style>
</head>
<body>
<div class="container">
    <?php if (isset($_GET['reset_success'])): ?>
        <div class="alert alert-success mt-3 alert-dismissible fade show" role="alert">
            <strong>Thành công!</strong> Đã xóa lịch sử quét dòng này. Dòng dữ liệu này sẽ được đồng bộ lại ở lần chạy cronjob/quét tiếp theo.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    <?php endif; ?>

    <div class="row mb-4">
        <div class="col-12 text-center">
            <h1 class="text-success mb-2">🔍 GOOGLE SHEETS SYNC DIAGNOSTIC TOOL</h1>
            <p class="text-secondary">Công cụ chuẩn đoán và kiểm tra trạng thái quét từng dòng từ Google Sheets</p>
        </div>
    </div>

    <!-- Cấu hình Sheet cần kiểm tra -->
    <div class="card mb-4">
        <div class="card-body">
            <form method="GET" class="row align-items-end g-3">
                <div class="col-md-8">
                    <label for="connection_id" class="form-label fw-bold">Chọn Google Sheet kết nối cần chuẩn đoán:</label>
                    <select name="connection_id" id="connection_id" class="form-select">
                        <?php if (empty($connections)): ?>
                            <option value="">-- Không có kết nối hoạt động nào --</option>
                        <?php else: ?>
                            <?php foreach ($connections as $c): ?>
                                <option value="<?= $c['id'] ?>" <?= $selected_conn_id === $c['id'] ? 'selected' : '' ?>>
                                    [ID: <?= $c['id'] ?>] <?= htmlspecialchars($c['sheet_name']) ?> (<?= $c['is_silent'] ? 'Silent Sync' : 'Regular Sync' ?>)
                                </option>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </select>
                </div>
                <div class="col-md-4">
                    <button type="submit" class="btn btn-success w-100 fw-bold py-2">🔍 Bắt đầu chuẩn đoán</button>
                </div>
            </form>
        </div>
    </div>

    <?php if ($errorMsg): ?>
        <div class="alert alert-danger" role="alert">
            <h4 class="alert-heading">Lỗi kết nối hoặc đọc Google Sheet!</h4>
            <p><?= htmlspecialchars($errorMsg) ?></p>
        </div>
    <?php endif; ?>

    <?php if ($connItem && !$errorMsg): ?>
        <div class="card mb-4">
            <div class="card-header bg-dark fw-bold">
                CẤU HÌNH KẾT NỐI HIỆN TẠI
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-3"><strong>Tên Sheet:</strong> <?= htmlspecialchars($connItem['sheet_name']) ?></div>
                    <div class="col-md-4"><strong>Spreadsheet ID:</strong> <code><?= htmlspecialchars($connItem['spreadsheet_id']) ?></code></div>
                    <div class="col-md-2"><strong>Loại:</strong> <?= $connItem['is_silent'] ? '<span class="badge badge-warning">Silent Sync (Chỉ check trùng)</span>' : '<span class="badge badge-success">Regular Sync</span>' ?></div>
                    <div class="col-md-3"><strong>Chế độ SĐT/Email:</strong> <?= $connItem['require_both_contact'] ? 'Yêu cầu cả SĐT và Email' : 'Chỉ cần SĐT hoặc Email' ?></div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header bg-dark d-flex justify-content-between align-items-center">
                <span class="fw-bold">DANH SÁCH DÒNG DỮ LIỆU TỪ GOOGLE SHEET VÀ TRẠNG THÁI</span>
                <span class="badge badge-secondary">Tổng số dòng: <?= count($diagnosticRows) ?></span>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered align-middle mb-0">
                    <thead>
                        <tr class="table-dark text-center">
                            <th style="width: 70px;">Dòng</th>
                            <th style="width: 150px;">Tên khách hàng</th>
                            <th style="width: 130px;">Số điện thoại</th>
                            <th style="width: 180px;">Email</th>
                            <th style="width: 140px;">Trạng thái chuẩn đoán</th>
                            <th>Chi tiết kết quả check / Lý do</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($diagnosticRows)): ?>
                            <tr>
                                <td colspan="6" class="text-center text-secondary py-4">Không tìm thấy dữ liệu dòng nào.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($diagnosticRows as $row): ?>
                                <tr class="<?= $row['class'] ?>">
                                    <td class="text-center fw-bold"><?= $row['row_num'] ?></td>
                                    <td><?= htmlspecialchars($row['extracted']['name'] ?? '') ?></td>
                                    <td class="text-center"><code><?= htmlspecialchars($row['extracted']['phone'] ?? '') ?></code></td>
                                    <td><?= htmlspecialchars($row['extracted']['email'] ?? '') ?></td>
                                    <td class="text-center">
                                        <?php if ($row['status'] === 'ALREADY_SYNCED'): ?>
                                            <span class="badge badge-success">Đã đồng bộ</span>
                                        <?php elseif ($row['status'] === 'INVALID_CONTACT'): ?>
                                            <span class="badge badge-danger">Thiếu liên hệ</span>
                                        <?php elseif ($row['status'] === 'BLACKLISTED'): ?>
                                            <span class="badge badge-warning">Blacklist</span>
                                        <?php elseif ($row['status'] === 'SKIP'): ?>
                                            <span class="badge badge-secondary">Bỏ qua</span>
                                        <?php else: ?>
                                            <span class="badge badge-primary">Chờ đồng bộ</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <?= htmlspecialchars($row['message']) ?>
                                        <?php if ($row['status'] === 'ALREADY_SYNCED' && empty($row['is_duplicate'])): ?>
                                            <div class="mt-2">
                                                <a href="?action=reset_hash&connection_id=<?= $connItem['id'] ?>&row_hash=<?= $row['extracted']['hash'] ?>" class="btn btn-sm btn-outline-danger fw-bold" onclick="return confirm('Bạn có chắc chắn muốn xóa lịch sử quét dòng này để đồng bộ lại không?')">🔄 Reset để đồng bộ lại</a>
                                            </div>
                                        <?php endif; ?>
                                        <?php if (isset($row['extracted']['hash'])): ?>
                                            <div class="text-secondary mt-1" style="font-size: 0.75rem;">Mã MD5 Row Hash: <code><?= $row['extracted']['hash'] ?></code></div>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    <?php endif; ?>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
