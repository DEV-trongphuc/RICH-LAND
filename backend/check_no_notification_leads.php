<?php
// backend/check_no_notification_leads.php
require_once __DIR__ . '/db_connect.php';

// Set header to render HTML nicely
header("Content-Type: text/html; charset=utf-8");

$today = date('Y-m-d');
if (isset($_GET['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date'])) {
    $today = $_GET['date'];
}

// Đọc trước nội dung file log Zalo gửi trực tiếp để kiểm tra cơ chế gửi đồng bộ
$zaloLogContent = '';
$zaloLogFile = __DIR__ . '/zalo_send_log.txt';
if (file_exists($zaloLogFile)) {
    $zaloLogContent = file_get_contents($zaloLogFile);
}

// Query all leads created on the selected day
$leadsStmt = $conn->prepare("
    SELECT l.id, l.name, l.phone, l.email, l.source, l.type, l.created_at, l.assigned_to, l.connection_id, l.status as lead_status, l.ai_screener_status,
           sc.sheet_name
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

$bothMissed = [];
$mailMissedOnly = [];
$zaloMissedOnly = [];
$allSentOk = [];
$skippedNoZaloConfig = [];

if ($leadsRes && $leadsRes->num_rows > 0) {
    while ($lead = $leadsRes->fetch_assoc()) {
        $totalLeads++;
        $leadId = $lead['id'];
        $leadName = $lead['name'];
        $leadPhone = $lead['phone'];
        $leadEmail = $lead['email'];
        $assignedTo = $lead['assigned_to'];
        $leadStatus = $lead['lead_status'];
        
        // Fetch latest distribution log for this lead to make sure it was assigned
        $logStmt = $conn->prepare("SELECT id, status, message, assigned_to, received_at FROM distribution_logs WHERE lead_id = ? ORDER BY id DESC LIMIT 1");
        $logStmt->bind_param("i", $leadId);
        $logStmt->execute();
        $log = $logStmt->get_result()->fetch_assoc();
        $logStmt->close();
        
        $logStatus = $log['status'] ?? 'N/A';
        $logMessage = $log['message'] ?? 'N/A';
        $logTime = $log['received_at'] ?? 'N/A';

        // We only audit leads that are actually routed to sales (status: assigned, compensation, fallback)
        if ($logStatus === 'assigned' || $logStatus === 'compensation' || $logStatus === 'fallback') {
            $totalAssigned++;
            
            // Get consultant details
            $saleName = 'Chưa rõ';
            $saleEmail = '';
            $saleZaloId = '';
            if ($assignedTo) {
                $saleStmt = $conn->prepare("SELECT name, email, zalo_chat_id FROM consultants WHERE id = ?");
                $saleStmt->bind_param("i", $assignedTo);
                $saleStmt->execute();
                $sRow = $saleStmt->get_result()->fetch_assoc();
                if ($sRow) {
                    $saleName = $sRow['name'];
                    $saleEmail = $sRow['email'];
                    $saleZaloId = $sRow['zalo_chat_id'];
                }
                $saleStmt->close();
            }

            // Check Mail Queue (Sử dụng cả tên và SĐT để tránh bỏ sót)
            $mailQueued = false;
            $mailStatus = 'N/A';
            $mailId = null;
            if (!empty($saleEmail)) {
                $mailLikeName = '%' . $leadName . '%';
                $mailLikePhone = '%' . $leadPhone . '%';
                $mStmt = $conn->prepare("SELECT id, status FROM mail_queue WHERE to_email = ? AND (subject LIKE ? OR body_html LIKE ? OR body_html LIKE ?) LIMIT 1");
                $mStmt->bind_param("ssss", $saleEmail, $mailLikeName, $mailLikeName, $mailLikePhone);
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

            // Check Zalo Queue (Sử dụng cả tên và số điện thoại để tránh lỗi Unicode dấu tiếng Việt)
            $zaloQueued = false;
            $zaloStatus = 'N/A';
            $zaloId = null;
            $zaloLikeName = '%' . $leadName . '%';
            $zaloLikePhone = '%' . $leadPhone . '%';
            
            if (!empty($saleZaloId)) {
                $zStmt = $conn->prepare("SELECT id, status FROM zalo_queue WHERE chat_id = ? AND (body_text LIKE ? OR body_text LIKE ?) LIMIT 1");
                $zStmt->bind_param("sss", $saleZaloId, $zaloLikeName, $zaloLikePhone);
            } else {
                $zStmt = $conn->prepare("SELECT id, status FROM zalo_queue WHERE (body_text LIKE ? OR body_text LIKE ?) LIMIT 1");
                $zStmt->bind_param("ss", $zaloLikeName, $zaloLikePhone);
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

            // LÂM SÀNG: Nếu không tìm thấy trong zalo_queue DB, quét thêm file log zalo_send_log.txt (cơ chế gửi cURL trực tiếp)
            if (!$zaloQueued && !empty($zaloLogContent)) {
                $logLines = explode("\n", $zaloLogContent);
                foreach ($logLines as $line) {
                    if (strpos($line, '[' . $today) !== false) {
                        // Tìm theo SĐT hoặc Tên lead trong dòng log của ngày hôm nay
                        if (strpos($line, $leadPhone) !== false || (!empty($leadName) && strpos($line, $leadName) !== false)) {
                            // Kiểm tra xem phản hồi Zalo có thành công (HTTP 200 hoặc "ok":true)
                            if (strpos($line, 'HTTP: 200') !== false || strpos($line, '"ok":true') !== false) {
                                $zaloQueued = true;
                                $zaloStatus = 'sent (Direct cURL)';
                                $zaloId = 'Log';
                                break;
                            }
                        }
                    }
                }
            }

            $isMissedMail = !$mailQueued;
            $isMissedZalo = !$zaloQueued && !empty($saleZaloId);
            
            $leadInfo = [
                'id' => $leadId,
                'name' => $leadName,
                'phone' => $leadPhone,
                'email' => $leadEmail,
                'source' => $lead['sheet_name'] ?: ($lead['source'] ?: 'N/A'),
                'log_time' => $logTime,
                'log_message' => $logMessage,
                'log_status' => $logStatus,
                'sale_name' => $saleName,
                'sale_email' => $saleEmail,
                'sale_zalo_id' => $saleZaloId,
                'mail_queued' => $mailQueued,
                'mail_id' => $mailId,
                'mail_status' => $mailStatus,
                'zalo_queued' => $zaloQueued,
                'zalo_id' => $zaloId,
                'zalo_status' => $zaloStatus
            ];

            if (empty($saleZaloId)) {
                $skippedNoZaloConfig[] = $leadInfo;
            } elseif ($isMissedMail && $isMissedZalo) {
                $bothMissed[] = $leadInfo;
            } elseif ($isMissedMail) {
                $mailMissedOnly[] = $leadInfo;
            } elseif ($isMissedZalo) {
                $zaloMissedOnly[] = $leadInfo;
            } else {
                $allSentOk[] = $leadInfo;
            }
        }
    }
}
$leadsStmt->close();
$conn->close();
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiểm tra Sót Thông Báo Lead - Ngày <?php echo date('d/m/Y', strtotime($today)); ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent-red: #f43f5e;
            --accent-orange: #f59e0b;
            --accent-green: #10b981;
            --accent-blue: #3b82f6;
            --accent-purple: #8b5cf6;
            --border-color: #334155;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-main);
            line-height: 1.6;
            padding: 2rem 1rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        header {
            text-align: center;
            margin-bottom: 2.5rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color);
        }
        h1 {
            font-size: 2rem;
            font-weight: 700;
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }
        .subtitle { color: var(--text-muted); font-size: 1rem; }
        .date-picker {
            margin-top: 1rem;
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            align-items: center;
        }
        .date-picker input {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
        }
        .date-picker button {
            background: var(--accent-blue);
            color: #fff;
            border: none;
            padding: 0.4rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
        }
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }
        .card {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
        }
        .card.both-missed::before { background-color: var(--accent-red); }
        .card.mail-missed::before { background-color: var(--accent-orange); }
        .card.zalo-missed::before { background-color: var(--accent-purple); }
        .card.all-ok::before { background-color: var(--accent-green); }
        .card-val { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.2rem; }
        .card.both-missed .card-val { color: var(--accent-red); }
        .card.mail-missed .card-val { color: var(--accent-orange); }
        .card.zalo-missed .card-val { color: var(--accent-purple); }
        .card.all-ok .card-val { color: var(--accent-green); }
        .card-label { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; }
        .section-title {
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 1.2rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .section-title .badge {
            font-size: 0.8rem;
            padding: 0.2rem 0.6rem;
            border-radius: 12px;
        }
        .badge.red { background-color: rgba(244, 63, 94, 0.2); color: var(--accent-red); }
        .badge.orange { background-color: rgba(245, 158, 11, 0.2); color: var(--accent-orange); }
        .badge.purple { background-color: rgba(139, 92, 246, 0.2); color: var(--accent-purple); }
        .badge.green { background-color: rgba(16, 185, 129, 0.2); color: var(--accent-green); }
        .table-container {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow-x: auto;
            margin-bottom: 3rem;
        }
        table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        th {
            background-color: rgba(255, 255, 255, 0.02);
            color: var(--text-muted);
            font-weight: 600;
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
        }
        td { padding: 1rem; border-bottom: 1px solid var(--border-color); }
        .lead-name { font-weight: 600; color: #fff; }
        .lead-meta { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }
        .status-pill {
            display: inline-block;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
        }
        .status-pill.queued { background-color: rgba(59, 130, 246, 0.2); color: var(--accent-blue); }
        .status-pill.sent { background-color: rgba(16, 185, 129, 0.2); color: var(--accent-green); }
        .status-pill.failed { background-color: rgba(244, 63, 94, 0.2); color: var(--accent-red); }
        .status-pill.missed { background-color: rgba(244, 63, 94, 0.3); color: var(--accent-red); border: 1px dashed var(--accent-red); }
        .log-msg {
            font-family: monospace; font-size: 0.8rem; background-color: rgba(0,0,0,0.2);
            padding: 0.4rem; border-radius: 4px; max-width: 250px; word-break: break-all; white-space: pre-wrap;
        }
        .empty-state { padding: 2rem; text-align: center; color: var(--text-muted); font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>HỆ THỐNG KIỂM TRA SÓT THÔNG BÁO LEAD</h1>
            <div class="subtitle">Đồng bộ Đa kênh & Định tuyến phân bổ</div>
            <div class="date-picker">
                <form method="GET" action="">
                    <label for="date-select">Chọn ngày: </label>
                    <input type="date" id="date-select" name="date" value="<?php echo $today; ?>">
                    <button type="submit">Kiểm tra</button>
                </form>
            </div>
        </header>

        <div class="summary-cards">
            <div class="card both-missed">
                <div class="card-val"><?php echo count($bothMissed); ?></div>
                <div class="card-label">Sót Cả Hai (Email & Zalo)</div>
            </div>
            <div class="card mail-missed">
                <div class="card-val"><?php echo count($mailMissedOnly); ?></div>
                <div class="card-label">Chỉ Sót Email</div>
            </div>
            <div class="card zalo-missed">
                <div class="card-val"><?php echo count($zaloMissedOnly); ?></div>
                <div class="card-label">Chỉ Sót Zalo</div>
            </div>
            <div class="card all-ok">
                <div class="card-val"><?php echo count($allSentOk); ?></div>
                <div class="card-label">Gửi Đủ & Thành Công</div>
            </div>
        </div>

        <!-- 1. BOTH MISSED -->
        <div class="section-title">
            <span>🔴 SÓT CẢ EMAIL LẪN ZALO</span>
            <span class="badge red"><?php echo count($bothMissed); ?></span>
        </div>
        <div class="table-container">
            <?php if (empty($bothMissed)): ?>
                <div class="empty-state">🎉 Tuyệt vời! Không có lead nào bị sót cả hai kênh.</div>
            <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Lead ID & Tên</th>
                            <th>Nguồn & Thời gian</th>
                            <th>Sale Nhận</th>
                            <th>Log Phân Bổ</th>
                            <th>Trạng thái Email</th>
                            <th>Trạng thái Zalo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($bothMissed as $l): ?>
                            <tr>
                                <td>
                                    <div class="lead-name">#<?php echo $l['id']; ?> - <?php echo htmlspecialchars($l['name']); ?></div>
                                    <div class="lead-meta">SĐT: <?php echo htmlspecialchars($l['phone']); ?></div>
                                </td>
                                <td>
                                    <div><?php echo htmlspecialchars($l['source']); ?></div>
                                    <div class="lead-meta"><?php echo $l['log_time']; ?></div>
                                </td>
                                <td>
                                    <div><strong><?php echo htmlspecialchars($l['sale_name']); ?></strong></div>
                                    <div class="lead-meta"><?php echo htmlspecialchars($l['sale_email']); ?></div>
                                </td>
                                <td>
                                    <div class="status-pill queued" style="margin-bottom: 0.3rem;"><?php echo $l['log_status']; ?></div>
                                    <div class="log-msg"><?php echo htmlspecialchars($l['log_message']); ?></div>
                                </td>
                                <td><span class="status-pill missed">SÓT ❌</span></td>
                                <td><span class="status-pill missed">SÓT ❌</span></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>

        <!-- 2. MAIL MISSED ONLY -->
        <div class="section-title">
            <span>🟠 CHỈ SÓT EMAIL (ZALO ĐÃ GỬI)</span>
            <span class="badge orange"><?php echo count($mailMissedOnly); ?></span>
        </div>
        <div class="table-container">
            <?php if (empty($mailMissedOnly)): ?>
                <div class="empty-state">🎉 Không có lead nào bị sót email.</div>
            <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Lead ID & Tên</th>
                            <th>Nguồn & Thời gian</th>
                            <th>Sale Nhận</th>
                            <th>Log Phân Bổ</th>
                            <th>Trạng thái Email</th>
                            <th>Trạng thái Zalo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($mailMissedOnly as $l): ?>
                            <tr>
                                <td>
                                    <div class="lead-name">#<?php echo $l['id']; ?> - <?php echo htmlspecialchars($l['name']); ?></div>
                                    <div class="lead-meta">SĐT: <?php echo htmlspecialchars($l['phone']); ?></div>
                                </td>
                                <td>
                                    <div><?php echo htmlspecialchars($l['source']); ?></div>
                                    <div class="lead-meta"><?php echo $l['log_time']; ?></div>
                                </td>
                                <td>
                                    <div><strong><?php echo htmlspecialchars($l['sale_name']); ?></strong></div>
                                    <div class="lead-meta"><?php echo htmlspecialchars($l['sale_email']); ?></div>
                                </td>
                                <td>
                                    <div class="status-pill queued" style="margin-bottom: 0.3rem;"><?php echo $l['log_status']; ?></div>
                                    <div class="log-msg"><?php echo htmlspecialchars($l['log_message']); ?></div>
                                </td>
                                <td><span class="status-pill missed">SÓT ❌</span></td>
                                <td>
                                    <span class="status-pill sent">OK (<?php echo $l['zalo_status']; ?>)</span>
                                    <div class="lead-meta">Queue ID: #<?php echo $l['zalo_id']; ?></div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>

        <!-- 3. ZALO MISSED ONLY -->
        <div class="section-title">
            <span>🟣 CHỈ SÓT ZALO (EMAIL ĐÃ GỬI)</span>
            <span class="badge purple"><?php echo count($zaloMissedOnly); ?></span>
        </div>
        <div class="table-container">
            <?php if (empty($zaloMissedOnly)): ?>
                <div class="empty-state">🎉 Không có lead nào bị sót zalo.</div>
            <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Lead ID & Tên</th>
                            <th>Nguồn & Thời gian</th>
                            <th>Sale Nhận</th>
                            <th>Log Phân Bổ</th>
                            <th>Trạng thái Email</th>
                            <th>Trạng thái Zalo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($zaloMissedOnly as $l): ?>
                            <tr>
                                <td>
                                    <div class="lead-name">#<?php echo $l['id']; ?> - <?php echo htmlspecialchars($l['name']); ?></div>
                                    <div class="lead-meta">SĐT: <?php echo htmlspecialchars($l['phone']); ?></div>
                                </td>
                                <td>
                                    <div><?php echo htmlspecialchars($l['source']); ?></div>
                                    <div class="lead-meta"><?php echo $l['log_time']; ?></div>
                                </td>
                                <td>
                                    <div><strong><?php echo htmlspecialchars($l['sale_name']); ?></strong></div>
                                    <div class="lead-meta"><?php echo htmlspecialchars($l['sale_email']); ?> | Zalo: <?php echo htmlspecialchars($l['sale_zalo_id']); ?></div>
                                </td>
                                <td>
                                    <div class="status-pill queued" style="margin-bottom: 0.3rem;"><?php echo $l['log_status']; ?></div>
                                    <div class="log-msg"><?php echo htmlspecialchars($l['log_message']); ?></div>
                                </td>
                                <td>
                                    <span class="status-pill sent">OK (<?php echo $l['mail_status']; ?>)</span>
                                    <div class="lead-meta">Queue ID: #<?php echo $l['mail_id']; ?></div>
                                </td>
                                <td><span class="status-pill missed">SÓT ❌</span></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>

        <!-- 4. ALL SENT OK -->
        <div class="section-title">
            <span>🟢 GỬI THÀNH CÔNG ĐẦY ĐỦ (EMAIL & ZALO)</span>
            <span class="badge green"><?php echo count($allSentOk); ?></span>
        </div>
        <div class="table-container">
            <?php if (empty($allSentOk)): ?>
                <div class="empty-state">Không có lead nào gửi đầy đủ hôm nay hoặc tất cả đều lỗi.</div>
            <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Lead ID & Tên</th>
                            <th>Nguồn & Thời gian</th>
                            <th>Sale Nhận</th>
                            <th>Trạng thái Email</th>
                            <th>Trạng thái Zalo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($allSentOk as $l): ?>
                            <tr>
                                <td>
                                    <div class="lead-name">#<?php echo $l['id']; ?> - <?php echo htmlspecialchars($l['name']); ?></div>
                                    <div class="lead-meta">SĐT: <?php echo htmlspecialchars($l['phone']); ?></div>
                                </td>
                                <td>
                                    <div><?php echo htmlspecialchars($l['source']); ?></div>
                                    <div class="lead-meta"><?php echo $l['log_time']; ?></div>
                                </td>
                                <td>
                                    <div><strong><?php echo htmlspecialchars($l['sale_name']); ?></strong></div>
                                    <div class="lead-meta"><?php echo htmlspecialchars($l['sale_email']); ?></div>
                                </td>
                                <td>
                                    <span class="status-pill sent">OK (<?php echo $l['mail_status']; ?>)</span>
                                    <div class="lead-meta">Queue ID: #<?php echo $l['mail_id']; ?></div>
                                </td>
                                <td>
                                    <span class="status-pill sent">OK (<?php echo $l['zalo_status']; ?>)</span>
                                    <div class="lead-meta">Queue ID: #<?php echo $l['zalo_id']; ?></div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
