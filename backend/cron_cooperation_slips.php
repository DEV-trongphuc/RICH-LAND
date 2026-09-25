<?php
// backend/cron_cooperation_slips.php
// TC-30: Quét phiếu hợp tác quá 24h chưa hoàn tất ký xác nhận
// Tự động chuyển trạng thái sang PHIEU_TREO (disputed) và gửi cảnh báo Quản lý / GĐKD

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/NotificationService.php';
require_once __DIR__ . '/mailer.php';

function runCooperationSlipsCron($conn = null, $pdo = null): int {
    // Prevent concurrent execution
    $lockFile = sys_get_temp_dir() . '/cron_coop_' . md5(__DIR__) . '.lock';
    $lockFp = @fopen($lockFile, 'w');
    if ($lockFp && !flock($lockFp, LOCK_EX | LOCK_NB)) {
        echo "[" . date('Y-m-d H:i:s') . "] [COOPERATION_CRON] Another instance of cron_cooperation_slips.php is already running. Exiting.\n";
        fclose($lockFp);
        return 0;
    }

    if (!$pdo) {
        if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
            $pdo = $GLOBALS['pdo'];
        } else {
            global $servername, $username, $password, $dbname;
            $dbHost = defined('DB_HOST') ? DB_HOST : ($servername ?? 'localhost');
            $dbUser = defined('DB_USER') ? DB_USER : ($username ?? '');
            $dbPass = defined('DB_PASS') ? DB_PASS : ($password ?? '');
            $dbName = defined('DB_NAME') ? DB_NAME : ($dbname ?? '');
            try {
                $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]);
            } catch (\Throwable $e) {
                echo "[" . date('Y-m-d H:i:s') . "] [COOPERATION_CRON] PDO Connection error: " . $e->getMessage() . "\n";
                return 0;
            }
        }
    }

    echo "[" . date('Y-m-d H:i:s') . "] [COOPERATION_CRON] Bắt đầu quét phiếu hợp tác chờ ký quá 24h...\n";

    // Truy vấn các phiếu đang ở trạng thái pending_signatures hoặc approved_pending_signatures
    // có thời điểm tạo hoặc cập nhật gần nhất vượt quá 24 giờ
    $sql = "
        SELECT cs.id, cs.contact_id, cs.deposit_slip_id, cs.version, cs.shares_json, cs.signatures_json, 
               cs.created_by, cs.created_at, cs.updated_at,
               c.tenant_id, c.first_name, c.last_name, c.phone, c.owner_id
        FROM cooperation_slips cs
        JOIN contacts c ON cs.contact_id = c.id
        WHERE cs.status IN ('pending_signatures', 'approved_pending_signatures')
          AND GREATEST(cs.created_at, cs.updated_at) <= (NOW() - INTERVAL 24 HOUR)
    ";

    try {
        $stmt = $pdo->query($sql);
        $staleSlips = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (\Throwable $e) {
        echo "[" . date('Y-m-d H:i:s') . "] [COOPERATION_CRON] Query error: " . $e->getMessage() . "\n";
        return 0;
    }

    $countProcessed = 0;
    $nowStr = date('Y-m-d H:i:s');

    foreach ($staleSlips as $slip) {
        $slipId = (int)$slip['id'];
        $tenantId = (int)$slip['tenant_id'];
        $customerName = trim(($slip['first_name'] ?? '') . ' ' . ($slip['last_name'] ?? '')) ?: 'Khách hàng #' . $slip['contact_id'];
        $shares = json_decode($slip['shares_json'] ?? '[]', true) ?: [];
        $signatures = json_decode($slip['signatures_json'] ?? '[]', true) ?: [];

        // Kiểm tra ai chưa ký
        $missingUids = [];
        foreach ($shares as $uid => $pct) {
            $uid = (int)$uid;
            if (!isset($signatures[$uid]) || empty($signatures[$uid]['time'] ?? null)) {
                $missingUids[] = $uid;
            }
        }

        // Nếu tất cả đã ký nhưng vì lý do nào đó chưa đổi status, tiến tới pending_manager_approval
        if (empty($missingUids)) {
            $upd = $pdo->prepare("UPDATE cooperation_slips SET status = 'pending_manager_approval', updated_at = NOW() WHERE id = ?");
            $upd->execute([$slipId]);
            NotificationService::send($pdo, $tenantId, 'COOPERATION_PENDING_APPROVAL', [
                'slip_id' => $slipId,
                'customer_name' => $customerName
            ]);
            echo "  -> Slip #$slipId: Tất cả thành viên đã ký đầy đủ, tự động chuyển chờ sếp duyệt.\n";
            $countProcessed++;
            continue;
        }

        // Lấy tên các thành viên chưa ký
        $inUids = implode(',', array_map('intval', $missingUids));
        $missingNames = [];
        try {
            $uStmt = $pdo->query("SELECT id, full_name, email FROM users WHERE id IN ($inUids)");
            while ($u = $uStmt->fetch(PDO::FETCH_ASSOC)) {
                $missingNames[] = $u['full_name'] ?: $u['email'];
            }
        } catch (\Throwable $ex) {
            $missingNames = array_map(fn($id) => "User #$id", $missingUids);
        }
        $missingNamesStr = !empty($missingNames) ? implode(', ', $missingNames) : implode(', ', $missingUids);

        // Chuyển sang PHIEU_TREO (status = disputed)
        $disputeDetails = "Phiếu tự động chuyển trạng thái TREO do quá 24h chưa hoàn tất chữ ký từ: {$missingNamesStr}. Chuyển Quản lý / Giám đốc Kinh doanh phân xử.";
        
        $upd = $pdo->prepare("
            UPDATE cooperation_slips 
            SET status = 'disputed', dispute_details = ?, updated_at = NOW() 
            WHERE id = ?
        ");
        $upd->execute([$disputeDetails, $slipId]);

        // 1. Gửi thông báo hệ thống (NotificationService) cho Quản lý & Ban Giám đốc
        try {
            NotificationService::send($pdo, $tenantId, 'COOPERATION_SLIP_STALE', [
                'slip_id' => $slipId,
                'contact_id' => (int)$slip['contact_id'],
                'customer_name' => $customerName,
                'missing_signers' => $missingNamesStr,
                'hours' => 24
            ]);
        } catch (\Throwable $notifEx) {
            echo "  [WARN] Gửi NotificationService thất bại cho slip #$slipId: " . $notifEx->getMessage() . "\n";
        }

        // 2. Gửi email cảnh báo cho người tạo phiếu và toàn bộ cổ đông trong phiếu
        $allShareholderUids = array_unique(array_merge(
            array_map('intval', array_keys($shares)),
            [(int)$slip['created_by'], (int)$slip['owner_id']]
        ));
        $allShareholderUids = array_filter($allShareholderUids);

        if (!empty($allShareholderUids) && function_exists('sendEmailNotification')) {
            $inAllUids = implode(',', $allShareholderUids);
            try {
                $eStmt = $pdo->query("SELECT email FROM users WHERE id IN ($inAllUids) AND email IS NOT NULL AND email != ''");
                $emailSubject = "[RICH LAND] Cảnh báo Phiếu hợp tác #$slipId bị treo quá 24h";
                $emailTitle = "CẢNH BÁO PHIẾU HỢP TÁC BỊ TREO QUÁ 24H";
                $emailContent = "Chào các thành viên,<br/><br/>"
                    . "Phiếu hợp tác chia sẻ hoa hồng <strong>#$slipId</strong> (Khách hàng: " . htmlspecialchars($customerName) . ") "
                    . "đã quá hạn 24 giờ mà chưa được tất cả thành viên ký xác nhận.<br/>"
                    . "- <strong>Chưa ký:</strong> " . htmlspecialchars($missingNamesStr) . "<br/>"
                    . "- <strong>Trạng thái mới:</strong> <span style='color: #ef4444; font-weight: bold;'>BỊ TREO (DISPUTED)</span>.<br/><br/>"
                    . "Hệ thống đã gửi cảnh báo đến Quản lý / Giám đốc Kinh doanh để vào cuộc phân xử. "
                    . "Vui lòng kiểm tra lại trên hệ thống CRM.";

                while ($eRow = $eStmt->fetch(PDO::FETCH_ASSOC)) {
                    if (!empty($eRow['email'])) {
                        sendEmailNotification($eRow['email'], $emailSubject, $emailTitle, $emailContent);
                    }
                }
            } catch (\Throwable $mailEx) {
                // Email error non-blocking
            }
        }

        // 3. Ghi audit log
        try {
            $logStmt = $pdo->prepare("
                INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, description, created_at)
                VALUES (?, ?, 'COOPERATION_SLIP_AUTO_DISPUTED', 'cooperation_slip', ?, ?, ?)
            ");
            $logStmt->execute([
                $tenantId, 
                $slip['created_by'] ?: 1, 
                $slipId, 
                "Tự động chuyển trạng thái PHIEU_TREO do quá 24h chưa ký từ: $missingNamesStr",
                $nowStr
            ]);
        } catch (\Throwable $logEx) {
            // Audit log non-blocking
        }

        echo "  ✅ Slip #$slipId ($customerName): Đã chuyển sang PHIEU_TREO (Chưa ký: $missingNamesStr) và phát cảnh báo Quản lý.\n";
        $countProcessed++;
    }

    echo "[" . date('Y-m-d H:i:s') . "] [COOPERATION_CRON] Hoàn tất. Đã xử lý: $countProcessed phiếu treo.\n";
    if (isset($lockFp) && is_resource($lockFp)) {
        flock($lockFp, LOCK_UN);
        fclose($lockFp);
    }
    return $countProcessed;
}

// Chạy trực tiếp nếu gọi từ CLI
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['PHP_SELF'] ?? '')) {
    runCooperationSlipsCron();
}
