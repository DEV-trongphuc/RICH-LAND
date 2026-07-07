<?php
// backend/controllers/CheckInController.php

class CheckInController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function index(array $auth): void {
        // Option to check only today's check-in for the logged-in user (useful for dashboard/buttons)
        if (isset($_GET['today_only']) && $_GET['today_only'] == '1') {
            $stmt = $this->db->prepare("
                SELECT c.*, u.work_start_time, u.full_name as user_name
                FROM check_ins c
                JOIN users u ON c.user_id = u.id
                WHERE c.user_id = ? AND c.check_in_date = ?
            ");
            $stmt->execute([$auth['user_id'], date('Y-m-d')]);
            $row = $stmt->fetch();
            respond(200, $row ?: null, 'Lấy thông tin check-in hôm nay thành công');
        }

        $isManager = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director'], true);
        
        $sql = "SELECT c.*, u.full_name as user_name, u.email as user_email, u.avatar_url as user_avatar, u.work_start_time
                FROM check_ins c
                JOIN users u ON c.user_id = u.id
                WHERE u.tenant_id = ?";
        
        $params = [$auth['tenant_id']];

        // RLS: Sales can only see their own check-ins. Managers see their team's.
        if ($auth['role'] === 'manager') {
            $sql .= " AND (u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ?))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            if (isset($_GET['user_id']) && !empty($_GET['user_id'])) {
                $sql .= " AND c.user_id = ?";
                $params[] = (int)$_GET['user_id'];
            }
        } else if (!$isManager) {
            $sql .= " AND c.user_id = ?";
            $params[] = $auth['user_id'];
        } else {
            // Admin/Assistant/Superadmin filtering
            if (isset($_GET['user_id']) && !empty($_GET['user_id'])) {
                $sql .= " AND c.user_id = ?";
                $params[] = (int)$_GET['user_id'];
            }
        }

        if (isset($_GET['month']) && !empty($_GET['month'])) {
            $sql .= " AND YEAR(c.check_in_date) = ? AND MONTH(c.check_in_date) = ?";
            $params[] = (int)($_GET['year'] ?? date('Y'));
            $params[] = (int)$_GET['month'];
        } elseif (isset($_GET['from']) && !empty($_GET['from']) && isset($_GET['to']) && !empty($_GET['to'])) {
            $sql .= " AND c.check_in_date BETWEEN ? AND ?";
            $params[] = $_GET['from'];
            $params[] = $_GET['to'];
        } elseif (isset($_GET['date']) && !empty($_GET['date']) && $_GET['date'] !== 'all') {
            $sql .= " AND c.check_in_date = ?";
            $params[] = $_GET['date'];
        }

        if (isset($_GET['status']) && !empty($_GET['status']) && $_GET['status'] !== 'all') {
            $sql .= " AND c.status = ?";
            $params[] = $_GET['status'];
        }

        $sql .= " ORDER BY c.check_in_date DESC, c.check_in_time DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll() ?: [];

        respond(200, $rows, 'Lấy danh sách check-in thành công');
    }

    public function store(array $auth): void {
        $b = getBody();
        $selfieUrl = trim($b['selfie_url'] ?? '');
        $reason = trim($b['reason'] ?? '');
        $today = trim($b['check_in_date'] ?? date('Y-m-d'));
        $currentTime = trim($b['check_in_time'] ?? date('H:i:s'));
        
        $isSupplementary = ($today !== date('Y-m-d'));

        if (empty($selfieUrl) && !$isSupplementary) {
            respond(422, null, 'Ảnh selfie check-in là bắt buộc', false);
        }

        if ($isSupplementary && empty($reason)) {
            respond(422, null, 'Vui lòng cung cấp lý do/ghi chú cập nhật bổ sung chấm công', false);
        }

        // Check if already checked in on that date
        $stmt = $this->db->prepare("SELECT id FROM check_ins WHERE user_id = ? AND check_in_date = ?");
        $stmt->execute([$auth['user_id'], $today]);
        if ($stmt->fetch()) {
            respond(409, null, 'Bạn đã thực hiện check-in hoặc gửi yêu cầu cho ngày này rồi', false);
        }

        // Fetch user work_start_time
        $stmtUser = $this->db->prepare("SELECT work_start_time FROM users WHERE id = ?");
        $stmtUser->execute([$auth['user_id']]);
        $workStartTime = $stmtUser->fetchColumn() ?: '08:00';

        $status = 'approved';
        $isLate = false;
        if ($isSupplementary) {
            $status = 'pending_approval';
        } else {
            // Check if late (compare HH:ii format)
            $currentHM = substr($currentTime, 0, 5);
            $workStartHM = substr($workStartTime, 0, 5);
            $isLate = ($currentHM > $workStartHM);
            if ($isLate) {
                if (empty($reason)) {
                    respond(422, null, 'Bạn đi làm trễ giờ làm việc (' . $workStartHM . '). Vui lòng gửi lý do để quản lý phê duyệt.', false);
                }
                $status = 'pending_approval';
            }
        }

        // Insert check-in log
        $insert = $this->db->prepare("
            INSERT INTO check_ins (user_id, check_in_date, check_in_time, selfie_url, status, reason)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $insert->execute([$auth['user_id'], $today, $currentTime, $selfieUrl ?: null, $status, $reason ?: null]);
        
        $newId = (int)$this->db->lastInsertId();

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CHECK_IN', 'check_in', $newId, json_encode([
            'date' => $today,
            'time' => $currentTime,
            'is_late' => $isLate,
            'status' => $status
        ]));

        // Send notifications to Admins & Managers if late
        if ($isLate) {
            // Get user's name
            $stmtUserDetails = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
            $stmtUserDetails->execute([$auth['user_id']]);
            $userName = $stmtUserDetails->fetchColumn() ?: 'Nhân viên';

            // Find all managers/admins/superadmins
            $stmtAdmins = $this->db->prepare("
                SELECT id FROM users 
                WHERE tenant_id = ? AND role IN ('admin', 'superadmin', 'super_admin', 'manager', 'assistant', 'director')
            ");
            $stmtAdmins->execute([$auth['tenant_id']]);
            $admins = $stmtAdmins->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($admins)) {
                $title = "Yêu cầu duyệt đi trễ";
                $body = "Nhân viên " . $userName . " đã check-in trễ lúc " . substr($currentTime, 0, 5) . " và gửi lý do: \"" . $reason . "\"";
                $type = "attendance";
                $link = "/attendance";

                $insertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                foreach ($admins as $adminId) {
                    $insertNotif->execute([$adminId, $auth['tenant_id'], $title, $body, $type, $link]);
                }
            }
        }

        respond(200, [
            'id' => $newId,
            'check_in_date' => $today,
            'check_in_time' => $currentTime,
            'status' => $status,
            'is_late' => $isLate
        ], 'Check-in thành công' . ($isLate ? ' (Đang chờ quản lý duyệt vì đi trễ)' : ''));
    }

    public function update(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director']);
        $b = getBody();
        $status = trim($b['status'] ?? '');
        $reason = trim($b['reason'] ?? ''); // Optionally update reason or note

        if (!in_array($status, ['approved', 'rejected', 'pending_approval'], true)) {
            respond(422, null, 'Trạng thái phê duyệt không hợp lệ', false);
        }

        // Fetch check-in record to make sure it belongs to the same tenant
        $stmtCheck = $this->db->prepare("
            SELECT c.*, u.tenant_id, u.full_name
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        ");
        $stmtCheck->execute([$id]);
        $row = $stmtCheck->fetch();

        if (!$row) {
            respond(404, null, 'Không tìm thấy bản ghi check-in', false);
        }

        if ((int)$row['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền thao tác trên dữ liệu này', false);
        }

        if ($auth['role'] === 'manager') {
            $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
            $stmtUserTeam->execute([$row['user_id']]);
            $targetUserTeamId = $stmtUserTeam->fetchColumn();

            $stmtLead = $this->db->prepare("SELECT 1 FROM teams WHERE id = ? AND leader_id = ?");
            $stmtLead->execute([$targetUserTeamId, $auth['user_id']]);
            $isTeamMember = $stmtLead->fetch();

            if ((int)$row['user_id'] !== (int)$auth['user_id'] && !$isTeamMember) {
                respond(403, null, 'Bạn chỉ có quyền phê duyệt chấm công cho nhân viên thuộc nhóm của mình', false);
            }
        }

        // Update
        $upd = $this->db->prepare("UPDATE check_ins SET status = ?, reason = CASE WHEN ? != '' THEN ? ELSE reason END WHERE id = ?");
        $upd->execute([$status, $reason, $reason, $id]);

        // Send notification back to the Sale user
        $title = $status === 'approved' ? "Chấm công đi trễ đã được duyệt" : ($status === 'rejected' ? "Yêu cầu nhận lead bị từ chối" : "Yêu cầu nhận lead đang chờ duyệt");
        $statusText = $status === 'approved' ? "chấp thuận" : ($status === 'rejected' ? "từ chối" : "cập nhật thành chờ duyệt");
        $body = "Yêu cầu nhận lead ngày " . $row['check_in_date'] . " của bạn đã được " . $statusText . " bởi quản trị viên.";
        if ($status === 'rejected' && !empty($reason)) {
            $body .= " Ghi chú: \"" . $reason . "\"";
        }
        $type = "attendance";
        $link = "/sale-portal";

        $insertNotif = $this->db->prepare("
            INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $insertNotif->execute([$row['user_id'], $auth['tenant_id'], $title, $body, $type, $link]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_CHECK_IN', 'check_in', $id, json_encode([
            'old_status' => $row['status'],
            'new_status' => $status,
            'sale_name' => $row['full_name']
        ]));

        respond(200, null, 'Cập nhật trạng thái check-in thành công');
    }

    public function destroy(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);

        // Fetch check-in record
        $stmtCheck = $this->db->prepare("
            SELECT c.*, u.tenant_id, u.full_name
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        ");
        $stmtCheck->execute([$id]);
        $row = $stmtCheck->fetch();

        if (!$row) {
            respond(404, null, 'Không tìm thấy bản ghi check-in', false);
        }

        if ((int)$row['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền thao tác trên dữ liệu này', false);
        }

        // Delete
        $this->db->prepare("DELETE FROM check_ins WHERE id = ?")->execute([$id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_CHECK_IN', 'check_in', $id, json_encode([
            'sale_name' => $row['full_name'],
            'check_in_date' => $row['check_in_date']
        ]));

        respond(200, null, 'Đã xóa bản ghi check-in thành công');
    }
}
