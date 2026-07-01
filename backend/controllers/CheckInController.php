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

        $isManager = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'assistant', 'manager'], true);
        
        $sql = "SELECT c.*, u.full_name as user_name, u.email as user_email, u.avatar_url as user_avatar, u.work_start_time
                FROM check_ins c
                JOIN users u ON c.user_id = u.id
                WHERE u.tenant_id = ?";
        
        $params = [$auth['tenant_id']];

        // RLS: Sales can only see their own check-ins
        if (!$isManager) {
            $sql .= " AND c.user_id = ?";
            $params[] = $auth['user_id'];
        } else {
            // Admin/Manager filtering
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

        if (empty($selfieUrl)) {
            respond(422, null, 'Ảnh selfie check-in là bắt buộc', false);
        }

        $today = date('Y-m-d');
        $currentTime = date('H:i:s');

        // Check if already checked in today
        $stmt = $this->db->prepare("SELECT id FROM check_ins WHERE user_id = ? AND check_in_date = ?");
        $stmt->execute([$auth['user_id'], $today]);
        if ($stmt->fetch()) {
            respond(409, null, 'Bạn đã thực hiện check-in hôm nay rồi', false);
        }

        // Fetch user work_start_time
        $stmtUser = $this->db->prepare("SELECT work_start_time FROM users WHERE id = ?");
        $stmtUser->execute([$auth['user_id']]);
        $workStartTime = $stmtUser->fetchColumn() ?: '08:00';

        // Check if late (compare HH:ii format)
        $currentHM = date('H:i');
        $workStartHM = substr($workStartTime, 0, 5);
        $isLate = ($currentHM > $workStartHM);

        $status = 'approved';
        if ($isLate) {
            if (empty($reason)) {
                respond(422, null, 'Bạn đi làm trễ giờ làm việc (' . $workStartHM . '). Vui lòng gửi lý do "Xin nhận lead hôm nay" để quản lý phê duyệt.', false);
            }
            $status = 'pending_approval';
        }

        // Insert check-in log
        $insert = $this->db->prepare("
            INSERT INTO check_ins (user_id, check_in_date, check_in_time, selfie_url, status, reason)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $insert->execute([$auth['user_id'], $today, $currentTime, $selfieUrl, $status, $reason ?: null]);
        
        $newId = (int)$this->db->lastInsertId();

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CHECK_IN', 'check_in', $newId, json_encode([
            'date' => $today,
            'time' => $currentTime,
            'is_late' => $isLate,
            'status' => $status
        ]));

        respond(200, [
            'id' => $newId,
            'check_in_date' => $today,
            'check_in_time' => $currentTime,
            'status' => $status,
            'is_late' => $isLate
        ], 'Check-in thành công' . ($isLate ? ' (Đang chờ quản lý duyệt vì đi trễ)' : ''));
    }

    public function update(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'assistant', 'manager']);
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

        // Update
        $upd = $this->db->prepare("UPDATE check_ins SET status = ?, reason = CASE WHEN ? != '' THEN ? ELSE reason END WHERE id = ?");
        $upd->execute([$status, $reason, $reason, $id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_CHECK_IN', 'check_in', $id, json_encode([
            'old_status' => $row['status'],
            'new_status' => $status,
            'sale_name' => $row['full_name']
        ]));

        respond(200, null, 'Cập nhật trạng thái check-in thành công');
    }

    public function destroy(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin']);

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
