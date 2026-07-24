<?php
class NotificationController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $stmt = $this->db->prepare("SELECT * FROM notifications WHERE user_id=? AND tenant_id=? ORDER BY created_at DESC LIMIT 100");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $unread = $this->db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id=? AND tenant_id=? AND is_read=0");
        $unread->execute([$auth['user_id'], $auth['tenant_id']]);
        
        $avatars = [];
        try {
            // Lấy avatar từ bảng users (chứa đầy đủ full_name và avatar_url của tất cả nhân sự)
            $avatarsStmt = $this->db->query("
                SELECT full_name AS name, avatar_url AS avatar FROM users
            ");
            if ($avatarsStmt) {
                foreach ($avatarsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    if (!empty($row['name'])) {
                        $avatars[$row['name']] = $row['avatar'] ?? '';
                    }
                }
            }
        } catch (\Throwable $e) {}

        // Duyệt qua từng thông báo để lấy trực tiếp actor name & avatar
        foreach ($items as &$item) {
            $isWarning = ($item['type'] === 'warning') || (isset($item['title']) && (mb_strpos(mb_strtolower($item['title']), 'trùng số') !== false || mb_strpos(mb_strtolower($item['title']), 'rửa nguồn') !== false || mb_strpos(mb_strtolower($item['title']), 'cảnh báo') !== false));
            
            $actorName = null;
            if (!$isWarning && !empty($item['body'])) {
                $cleanBody = preg_replace('/^Nhân viên\s+/u', '', $item['body']);
                if (preg_match('/^(.+?)(?:\s*\([^)]*\))?\s+(?:đã|vừa|gửi|báo|có|check-in)\s+/u', $cleanBody, $matches)) {
                    $possibleName = trim($matches[1]);
                    if (isset($avatars[$possibleName])) {
                        $actorName = $possibleName;
                    }
                }
            }
            
            if ($actorName) {
                $item['actor_name'] = $actorName;
                $item['actor_avatar'] = !empty($avatars[$actorName]) ? $avatars[$actorName] : null;
            } else {
                $item['actor_name'] = null;
                $item['actor_avatar'] = '/LOGO.jpg';
            }
        }
        unset($item);
        
        respond(200, [
            'items' => $items,
            'unread_count' => (int)$unread->fetchColumn()
        ]);
    }

    public function update(array $auth, int $id): void {
        $b = getBody();
        $isRead = isset($b['is_read']) ? (int)$b['is_read'] : 1;
        
        $stmt = $this->db->prepare("UPDATE notifications SET is_read=? WHERE id=? AND user_id=? AND tenant_id=?");
        $stmt->execute([$isRead, $id, $auth['user_id'], $auth['tenant_id']]);
        
        respond(200, null, 'Cập nhật trạng thái thông báo thành công');
    }

    public function markAllRead(array $auth): void {
        $stmt = $this->db->prepare("UPDATE notifications SET is_read=1 WHERE user_id=? AND tenant_id=?");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        
        respond(200, null, 'Đã đánh dấu tất cả thông báo là đã đọc');
    }

    public function destroy(array $auth, int $id): void {
        $stmt = $this->db->prepare("DELETE FROM notifications WHERE id=? AND user_id=? AND tenant_id=?");
        $stmt->execute([$id, $auth['user_id'], $auth['tenant_id']]);
        
        respond(200, null, 'Đã xóa thông báo thành công');
    }

    public function clearAll(array $auth): void {
        $stmt = $this->db->prepare("DELETE FROM notifications WHERE user_id=? AND tenant_id=?");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        
        respond(200, null, 'Đã xóa tất cả thông báo');
    }

    public function getSettings(array $auth): void {
        // Ensure matrix_config column exists in user_notification_settings table
        try {
            $this->db->exec("ALTER TABLE user_notification_settings ADD COLUMN matrix_config LONGTEXT NULL");
        } catch (\Throwable $e) {}

        // Fetch user account linking information safely
        $userInfo = ['email' => '', 'zalo_chat_id' => '', 'telegram_chat_id' => ''];
        
        try {
            $stmtUser = $this->db->prepare("SELECT email, zalo_chat_id, telegram_chat_id FROM users WHERE id = ? LIMIT 1");
            $stmtUser->execute([$auth['user_id']]);
            $resU = $stmtUser->fetch(PDO::FETCH_ASSOC);
            if ($resU) {
                $userInfo = array_merge($userInfo, array_filter($resU, function($v) { return !is_null($v); }));
            }
        } catch (\Throwable $e) {}

        // Fallback for Zalo Chat ID from consultants or accounts
        if (empty(trim((string)($userInfo['zalo_chat_id'] ?? '')))) {
            try {
                $stmtC = $this->db->prepare("SELECT zalo_chat_id FROM consultants WHERE id = ? LIMIT 1");
                $stmtC->execute([$auth['user_id']]);
                $cZalo = $stmtC->fetchColumn();
                if (!empty($cZalo)) {
                    $userInfo['zalo_chat_id'] = (string)$cZalo;
                }
            } catch (\Throwable $e) {}
        }
        if (empty(trim((string)($userInfo['zalo_chat_id'] ?? '')))) {
            try {
                $stmtA = $this->db->prepare("SELECT zalo_chat_id FROM accounts WHERE id = ? LIMIT 1");
                $stmtA->execute([$auth['user_id']]);
                $aZalo = $stmtA->fetchColumn();
                if (!empty($aZalo)) {
                    $userInfo['zalo_chat_id'] = (string)$aZalo;
                }
            } catch (\Throwable $e) {}
        }

        // Fallback for Telegram Chat ID from consultants or accounts
        if (empty(trim((string)($userInfo['telegram_chat_id'] ?? '')))) {
            try {
                $stmtC = $this->db->prepare("SELECT telegram_chat_id FROM consultants WHERE id = ? LIMIT 1");
                $stmtC->execute([$auth['user_id']]);
                $cTg = $stmtC->fetchColumn();
                if (!empty($cTg)) {
                    $userInfo['telegram_chat_id'] = (string)$cTg;
                }
            } catch (\Throwable $e) {}
        }

        $stmt = $this->db->prepare("SELECT * FROM user_notification_settings WHERE user_id = ? AND tenant_id = ?");
        $stmt->execute([$auth['user_id'], $auth['tenant_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $defaultPrefs = [
            'email_warning' => 1,
            'email_mention' => 1,
            'email_approval_request' => 1,
            'email_project_document' => 0,
            'email_project_comment' => 0,
            'email_project_roster' => 0,
            'email_info' => 0
        ];
        $settings = array_merge($defaultPrefs, $row ?: []);

        $zaloBotLink = '';
        $tgBotUsername = '';
        try {
            $stmtSys = $this->db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('zalo_bot_link', 'telegram_bot_username')");
            if ($stmtSys) {
                $rows = $stmtSys->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $r) {
                    if ($r['setting_key'] === 'zalo_bot_link') {
                        $zaloBotLink = trim((string)$r['setting_value']);
                    }
                    if ($r['setting_key'] === 'telegram_bot_username') {
                        $tgBotUsername = trim((string)$r['setting_value']);
                    }
                }
            }
        } catch (\Throwable $sysEx) {}

        $matrixConfig = null;
        if (!empty($row['matrix_config'])) {
            $matrixConfig = json_decode($row['matrix_config'], true);
        }

        respond(200, [
            'settings' => $settings,
            'matrix_config' => $matrixConfig,
            'user_info' => [
                'user_id' => (int)$auth['user_id'],
                'email' => $userInfo['email'] ?? '',
                'zalo_chat_id' => $userInfo['zalo_chat_id'] ?? '',
                'telegram_chat_id' => $userInfo['telegram_chat_id'] ?? '',
                'has_zalo' => !empty(trim((string)($userInfo['zalo_chat_id'] ?? ''))),
                'has_telegram' => !empty(trim((string)($userInfo['telegram_chat_id'] ?? ''))),
                'has_email' => !empty(trim((string)($userInfo['email'] ?? ''))),
                'zalo_bot_link' => $zaloBotLink,
                'telegram_bot_username' => $tgBotUsername
            ]
        ]);
    }

    public function updateSettings(array $auth): void {
        $b = getBody();

        // Ensure matrix_config column exists in user_notification_settings table
        try {
            $this->db->exec("ALTER TABLE user_notification_settings ADD COLUMN matrix_config LONGTEXT NULL");
        } catch (\Throwable $e) {}

        // Fetch existing settings row
        $stmtEx = $this->db->prepare("SELECT * FROM user_notification_settings WHERE user_id = ? AND tenant_id = ? LIMIT 1");
        $stmtEx->execute([$auth['user_id'], $auth['tenant_id']]);
        $existingRow = $stmtEx->fetch(PDO::FETCH_ASSOC) ?: [];
        $existingMatrix = !empty($existingRow['matrix_config']) ? json_decode($existingRow['matrix_config'], true) : [];

        if (isset($b['matrix_config']) && is_array($b['matrix_config'])) {
            $m = $b['matrix_config'];
            $matrixConfigStr = json_encode($m, JSON_UNESCAPED_UNICODE);

            // Synchronize outer email preferences from matrix
            $email_warning = (!empty($m['SECURITY_DEADLINE_WARNING']['master']) && !empty($m['SECURITY_DEADLINE_WARNING']['email'])) ? 1 : 0;
            $email_mention = (!empty($m['MENTION_TAGGED']['master']) && !empty($m['MENTION_TAGGED']['email'])) ? 1 : 0;
            $email_approval_request = (!empty($m['DEPOSIT_NEW']['master']) && !empty($m['DEPOSIT_NEW']['email'])) ? 1 : 0;
            $email_project_document = (!empty($m['PROJECT_ROSTER_UPDATE']['master']) && !empty($m['PROJECT_ROSTER_UPDATE']['email'])) ? 1 : 0;
            $email_project_comment = (!empty($m['CUSTOMER_UPDATE']['master']) && !empty($m['CUSTOMER_UPDATE']['email'])) ? 1 : 0;
            $email_project_roster = (!empty($m['PROJECT_ROSTER_UPDATE']['master']) && !empty($m['PROJECT_ROSTER_UPDATE']['email'])) ? 1 : 0;
            $email_info = (!empty($m['MONTHLY_ATTENDANCE_REPORT']['master']) && !empty($m['MONTHLY_ATTENDANCE_REPORT']['email'])) ? 1 : 0;

            $stmt = $this->db->prepare("
                INSERT INTO user_notification_settings 
                (user_id, tenant_id, matrix_config, email_warning, email_mention, email_approval_request, email_project_document, email_project_comment, email_project_roster, email_info)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    matrix_config = VALUES(matrix_config),
                    email_warning = VALUES(email_warning),
                    email_mention = VALUES(email_mention),
                    email_approval_request = VALUES(email_approval_request),
                    email_project_document = VALUES(email_project_document),
                    email_project_comment = VALUES(email_project_comment),
                    email_project_roster = VALUES(email_project_roster),
                    email_info = VALUES(email_info)
            ");
            $stmt->execute([
                $auth['user_id'], $auth['tenant_id'], $matrixConfigStr,
                $email_warning, $email_mention, $email_approval_request,
                $email_project_document, $email_project_comment, $email_project_roster, $email_info
            ]);
            respond(200, null, 'Cập nhật ma trận cấu hình thông báo thành công');
            return;
        }

        $email_warning = isset($b['email_warning']) ? (int)$b['email_warning'] : ($existingRow['email_warning'] ?? 1);
        $email_mention = isset($b['email_mention']) ? (int)$b['email_mention'] : ($existingRow['email_mention'] ?? 1);
        $email_approval_request = isset($b['email_approval_request']) ? (int)$b['email_approval_request'] : ($existingRow['email_approval_request'] ?? 1);
        $email_project_document = isset($b['email_project_document']) ? (int)$b['email_project_document'] : ($existingRow['email_project_document'] ?? 0);
        $email_project_comment = isset($b['email_project_comment']) ? (int)$b['email_project_comment'] : ($existingRow['email_project_comment'] ?? 0);
        $email_project_roster = isset($b['email_project_roster']) ? (int)$b['email_project_roster'] : ($existingRow['email_project_roster'] ?? 0);
        $email_info = isset($b['email_info']) ? (int)$b['email_info'] : ($existingRow['email_info'] ?? 0);

        // Update matrix config json to stay in sync with outer toggles
        $m = is_array($existingMatrix) ? $existingMatrix : [];
        
        $m['SECURITY_DEADLINE_WARNING'] = array_merge($m['SECURITY_DEADLINE_WARNING'] ?? ['zalo' => true, 'telegram' => true], ['master' => (bool)$email_warning, 'email' => (bool)$email_warning]);
        $m['MENTION_TAGGED'] = array_merge($m['MENTION_TAGGED'] ?? ['zalo' => true, 'telegram' => true], ['master' => (bool)$email_mention, 'email' => (bool)$email_mention]);
        $m['DEPOSIT_NEW'] = array_merge($m['DEPOSIT_NEW'] ?? ['zalo' => true, 'telegram' => true], ['master' => (bool)$email_approval_request, 'email' => (bool)$email_approval_request]);
        $m['PROJECT_ROSTER_UPDATE'] = array_merge($m['PROJECT_ROSTER_UPDATE'] ?? ['zalo' => false, 'telegram' => false], ['master' => (bool)$email_project_document, 'email' => (bool)$email_project_document]);
        $m['CUSTOMER_UPDATE'] = array_merge($m['CUSTOMER_UPDATE'] ?? ['zalo' => false, 'telegram' => false], ['master' => (bool)$email_project_comment, 'email' => (bool)$email_project_comment]);
        $m['MONTHLY_ATTENDANCE_REPORT'] = array_merge($m['MONTHLY_ATTENDANCE_REPORT'] ?? ['zalo' => false, 'telegram' => false], ['master' => (bool)$email_info, 'email' => (bool)$email_info]);

        $matrixConfigStr = json_encode($m, JSON_UNESCAPED_UNICODE);

        $stmt = $this->db->prepare("INSERT INTO user_notification_settings 
            (user_id, tenant_id, email_warning, email_mention, email_approval_request, email_project_document, email_project_comment, email_project_roster, email_info, matrix_config)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                email_warning = VALUES(email_warning),
                email_mention = VALUES(email_mention),
                email_approval_request = VALUES(email_approval_request),
                email_project_document = VALUES(email_project_document),
                email_project_comment = VALUES(email_project_comment),
                email_project_roster = VALUES(email_project_roster),
                email_info = VALUES(email_info),
                matrix_config = VALUES(matrix_config)");
        
        $stmt->execute([
            $auth['user_id'],
            $auth['tenant_id'],
            $email_warning,
            $email_mention,
            $email_approval_request,
            $email_project_document,
            $email_project_comment,
            $email_project_roster,
            $email_info,
            $matrixConfigStr
        ]);

        respond(200, null, 'Cập nhật cấu hình thông báo thành công');
    }
}
