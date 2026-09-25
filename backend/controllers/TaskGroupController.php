<?php
/**
 * TaskGroupController - Quản lý Nhóm công việc cá nhân trên Bàn làm việc (/workspace)
 * RICH LAND CRM & Workspace
 */

class TaskGroupController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function index(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        // Allow viewing other user's groups if specified by admin/manager
        $targetUserId = isset($_GET['user_id']) && (int)$_GET['user_id'] > 0 
            ? (int)$_GET['user_id'] 
            : $uid;

        // 1. Fetch user task groups with task statistics
        $stmt = $this->db->prepare("
            SELECT tg.id, tg.tenant_id, tg.user_id, tg.name, tg.color, tg.icon, tg.order_index, tg.is_pinned, tg.created_at,
                   COUNT(a.id) as total_tasks,
                   COALESCE(SUM(CASE WHEN a.status IN ('done', 'completed') THEN 1 ELSE 0 END), 0) as completed_tasks
            FROM task_groups tg
            LEFT JOIN activities a ON a.task_group_id = tg.id 
                                  AND a.deleted_at IS NULL 
                                  AND a.type IN ('task', 'meeting')
            WHERE tg.tenant_id = ? AND tg.user_id = ?
            GROUP BY tg.id
            ORDER BY tg.is_pinned DESC, tg.order_index ASC, tg.id ASC
        ");
        $stmt->execute([$tid, $targetUserId]);
        $groups = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $items = array_map(function($g) {
            $total = (int)($g['total_tasks'] ?? 0);
            $completed = (int)($g['completed_tasks'] ?? 0);
            $pending = max(0, $total - $completed);
            $progress = $total > 0 ? round(($completed / $total) * 100) : 0;
            return [
                'id' => (int)$g['id'],
                'user_id' => (int)$g['user_id'],
                'name' => $g['name'],
                'color' => $g['color'] ?: '#BD1D2D',
                'icon' => $g['icon'] ?: 'Folder',
                'order_index' => (int)($g['order_index'] ?? 0),
                'is_pinned' => (int)($g['is_pinned'] ?? 0),
                'total_tasks' => $total,
                'completed_tasks' => $completed,
                'pending_tasks' => $pending,
                'progress_percent' => $progress,
                'created_at' => $g['created_at']
            ];
        }, $groups);

        // 2. Compute stats for Unassigned tasks (Chưa phân nhóm)
        $stmtUnassigned = $this->db->prepare("
            SELECT 
                COUNT(a.id) as total_tasks,
                COALESCE(SUM(CASE WHEN a.status IN ('done', 'completed') THEN 1 ELSE 0 END), 0) as completed_tasks
            FROM activities a
            WHERE a.tenant_id = ? 
              AND a.deleted_at IS NULL 
              AND a.type IN ('task', 'meeting')
              AND a.task_group_id IS NULL
              AND (a.user_id = ? OR a.created_by = ? OR FIND_IN_SET(?, a.participant_ids))
        ");
        $stmtUnassigned->execute([$tid, $targetUserId, $targetUserId, (string)$targetUserId]);
        $unassignedRow = $stmtUnassigned->fetch(PDO::FETCH_ASSOC) ?: [];
        $unassignedTotal = (int)($unassignedRow['total_tasks'] ?? 0);
        $unassignedDone = (int)($unassignedRow['completed_tasks'] ?? 0);

        // 3. Compute stats for All tasks (Tất cả công việc)
        $stmtAll = $this->db->prepare("
            SELECT 
                COUNT(a.id) as total_tasks,
                COALESCE(SUM(CASE WHEN a.status IN ('done', 'completed') THEN 1 ELSE 0 END), 0) as completed_tasks
            FROM activities a
            WHERE a.tenant_id = ? 
              AND a.deleted_at IS NULL 
              AND a.type IN ('task', 'meeting')
              AND (a.user_id = ? OR a.created_by = ? OR FIND_IN_SET(?, a.participant_ids))
        ");
        $stmtAll->execute([$tid, $targetUserId, $targetUserId, (string)$targetUserId]);
        $allRow = $stmtAll->fetch(PDO::FETCH_ASSOC) ?: [];
        $allTotal = (int)($allRow['total_tasks'] ?? 0);
        $allDone = (int)($allRow['completed_tasks'] ?? 0);

        respond(200, [
            'items' => $items,
            'groups' => $items,
            'data' => $items,
            'summary' => [
                'all' => [
                    'total_tasks' => $allTotal,
                    'completed_tasks' => $allDone,
                    'pending_tasks' => max(0, $allTotal - $allDone),
                    'progress_percent' => $allTotal > 0 ? round(($allDone / $allTotal) * 100) : 0
                ],
                'unassigned' => [
                    'total_tasks' => $unassignedTotal,
                    'completed_tasks' => $unassignedDone,
                    'pending_tasks' => max(0, $unassignedTotal - $unassignedDone),
                    'progress_percent' => $unassignedTotal > 0 ? round(($unassignedDone / $unassignedTotal) * 100) : 0
                ]
            ]
        ], 'Lấy danh sách nhóm công việc thành công');
    }

    public function store(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim($body['name'] ?? '');
        $color = trim($body['color'] ?? '#BD1D2D');
        $icon = trim($body['icon'] ?? 'Folder');
        $orderIndex = (int)($body['order_index'] ?? 0);
        $isPinned = !empty($body['is_pinned']) ? 1 : 0;

        if ($name === '') {
            respond(400, null, 'Tên nhóm công việc không được để trống', false);
            return;
        }

        $stmt = $this->db->prepare("
            INSERT INTO task_groups (tenant_id, user_id, name, color, icon, order_index, is_pinned, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([$tid, $uid, $name, $color, $icon, $orderIndex, $isPinned]);
        $newId = (int)$this->db->lastInsertId();

        respond(201, [
            'id' => $newId,
            'user_id' => $uid,
            'name' => $name,
            'color' => $color,
            'icon' => $icon,
            'order_index' => $orderIndex,
            'is_pinned' => $isPinned,
            'total_tasks' => 0,
            'completed_tasks' => 0,
            'pending_tasks' => 0,
            'progress_percent' => 0
        ], 'Tạo nhóm công việc mới thành công');
    }

    public function update(array $auth, int $id): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        $check = $this->db->prepare("SELECT id, user_id FROM task_groups WHERE id = ? AND tenant_id = ?");
        $check->execute([$id, $tid]);
        $grp = $check->fetch(PDO::FETCH_ASSOC);
        if (!$grp) {
            respond(404, null, 'Nhóm công việc không tồn tại', false);
            return;
        }
        $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin'], true);
        if ((int)$grp['user_id'] !== $uid && !$isAdmin) {
            respond(403, null, 'Bạn không có quyền chỉnh sửa nhóm công việc này', false);
            return;
        }

        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim($body['name'] ?? '');
        $color = trim($body['color'] ?? '');
        $icon = trim($body['icon'] ?? '');
        $orderIndex = isset($body['order_index']) ? (int)$body['order_index'] : null;

        $updates = [];
        $params = [];

        if ($name !== '') {
            $updates[] = 'name = ?';
            $params[] = $name;
        }
        if ($color !== '') {
            $updates[] = 'color = ?';
            $params[] = $color;
        }
        if ($icon !== '') {
            $updates[] = 'icon = ?';
            $params[] = $icon;
        }
        if ($orderIndex !== null) {
            $updates[] = 'order_index = ?';
            $params[] = $orderIndex;
        }
        if (isset($body['is_pinned'])) {
            $updates[] = 'is_pinned = ?';
            $params[] = !empty($body['is_pinned']) ? 1 : 0;
        }

        if (empty($updates)) {
            respond(400, null, 'Không có thông tin nào cần cập nhật', false);
            return;
        }

        $updates[] = 'updated_at = NOW()';
        $params[] = $id;
        $params[] = $tid;

        $sql = "UPDATE task_groups SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        respond(200, ['id' => $id], 'Cập nhật nhóm công việc thành công');
    }

    public function destroy(array $auth, int $id): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        $check = $this->db->prepare("SELECT id, user_id FROM task_groups WHERE id = ? AND tenant_id = ?");
        $check->execute([$id, $tid]);
        $grp = $check->fetch(PDO::FETCH_ASSOC);
        if (!$grp) {
            respond(404, null, 'Nhóm công việc không tồn tại', false);
            return;
        }
        $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin'], true);
        if ((int)$grp['user_id'] !== $uid && !$isAdmin) {
            respond(403, null, 'Bạn không có quyền xóa nhóm công việc này', false);
            return;
        }

        // Dissociate tasks in this group -> set to NULL (Chưa phân nhóm)
        $stmtClear = $this->db->prepare("UPDATE activities SET task_group_id = NULL WHERE task_group_id = ? AND tenant_id = ?");
        $stmtClear->execute([$id, $tid]);

        // Delete group
        $stmtDel = $this->db->prepare("DELETE FROM task_groups WHERE id = ? AND tenant_id = ?");
        $stmtDel->execute([$id, $tid]);

        respond(200, ['id' => $id], 'Đã xóa nhóm công việc và đưa các task về trạng thái Chưa phân nhóm');
    }

    public function moveTask(array $auth, int $taskId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $groupId = isset($body['task_group_id']) && $body['task_group_id'] !== '' && $body['task_group_id'] !== null
            ? (int)$body['task_group_id']
            : null;

        // If target group specified, verify group exists
        if ($groupId !== null && $groupId > 0) {
            $chk = $this->db->prepare("SELECT id, name, color, icon FROM task_groups WHERE id = ? AND tenant_id = ?");
            $chk->execute([$groupId, $tid]);
            $grp = $chk->fetch(PDO::FETCH_ASSOC);
            if (!$grp) {
                respond(404, null, 'Nhóm công việc đích không tồn tại', false);
                return;
            }
        } else {
            $groupId = null;
        }

        $stmt = $this->db->prepare("UPDATE activities SET task_group_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$groupId, $taskId, $tid]);

        respond(200, [
            'task_id' => $taskId,
            'task_group_id' => $groupId
        ], 'Chuyển nhóm công việc thành công');
    }

    public function bulkMove(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $taskIds = array_filter(array_map('intval', $body['task_ids'] ?? []));
        $groupId = isset($body['task_group_id']) && $body['task_group_id'] !== '' && $body['task_group_id'] !== null
            ? (int)$body['task_group_id']
            : null;

        if (empty($taskIds)) {
            respond(400, null, 'Vui lòng chọn ít nhất một công việc để chuyển nhóm', false);
            return;
        }

        if ($groupId !== null && $groupId > 0) {
            $chk = $this->db->prepare("SELECT id FROM task_groups WHERE id = ? AND tenant_id = ?");
            $chk->execute([$groupId, $tid]);
            if (!$chk->fetchColumn()) {
                respond(404, null, 'Nhóm công việc đích không tồn tại', false);
                return;
            }
        } else {
            $groupId = null;
        }

        $inClause = implode(',', array_fill(0, count($taskIds), '?'));
        $params = array_merge([$groupId], $taskIds, [$tid]);

        $sql = "UPDATE activities SET task_group_id = ?, updated_at = NOW() WHERE id IN ($inClause) AND tenant_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        respond(200, [
            'moved_count' => count($taskIds),
            'task_group_id' => $groupId
        ], 'Đã chuyển thành công ' . count($taskIds) . ' công việc vào nhóm');
    }

    public function togglePin(array $auth, int $id): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        $check = $this->db->prepare("SELECT id, user_id, is_pinned FROM task_groups WHERE id = ? AND tenant_id = ?");
        $check->execute([$id, $tid]);
        $grp = $check->fetch(PDO::FETCH_ASSOC);
        if (!$grp) {
            respond(404, null, 'Nhóm công việc không tồn tại', false);
            return;
        }
        $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin'], true);
        if ((int)$grp['user_id'] !== $uid && !$isAdmin) {
            respond(403, null, 'Bạn không có quyền thao tác trên nhóm này', false);
            return;
        }

        $nextPinned = ((int)$grp['is_pinned'] === 1) ? 0 : 1;
        $stmt = $this->db->prepare("UPDATE task_groups SET is_pinned = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$nextPinned, $id, $tid]);

        respond(200, [
            'id' => $id,
            'is_pinned' => $nextPinned
        ], $nextPinned === 1 ? 'Đã ghim nhóm công việc lên đầu' : 'Đã bỏ ghim nhóm công việc');
    }

    public function reorder(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $orderIds = $body['order_ids'] ?? [];
        if (!is_array($orderIds) || empty($orderIds)) {
            respond(400, null, 'Danh sách thứ tự nhóm không hợp lệ', false);
            return;
        }

        $stmt = $this->db->prepare("UPDATE task_groups SET order_index = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ? AND user_id = ?");
        foreach ($orderIds as $index => $gid) {
            $stmt->execute([(int)$index, (int)$gid, $tid, $uid]);
        }

        respond(200, ['order_ids' => $orderIds], 'Đã cập nhật thứ tự nhóm công việc thành công');
    }
}
