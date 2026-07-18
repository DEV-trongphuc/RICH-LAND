<?php
class WorkflowTaskTemplateController
{
    private PDO $db;
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function index(array $auth): void
    {
        // Only managers, admins, and superadmins can configure templates
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
            respond(403, null, 'Quyền truy cập bị từ chối', false);
        }

        $sql = "
            SELECT tpl.*, 
                   ps.name as stage_name, 
                   teams.name as team_name
            FROM workflow_task_templates tpl
            LEFT JOIN pipeline_stages ps ON tpl.stage_id = ps.id
            LEFT JOIN teams ON tpl.team_id = teams.id
            WHERE tpl.tenant_id = ?
        ";
        $p = [$auth['tenant_id']];

        if ($auth['role'] === 'manager') {
            $stmtTeam = $this->db->prepare("SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, ",", IFNULL(co_leader_ids, ""))) LIMIT 1");
            $stmtTeam->execute([$auth['user_id']]);
            $managerTeamId = $stmtTeam->fetchColumn() ?: null;

            if ($managerTeamId) {
                $sql .= " AND (tpl.team_id IS NULL OR tpl.team_id = ?)";
                $p[] = (int)$managerTeamId;
            } else {
                $sql .= " AND tpl.team_id IS NULL";
            }
        }

        $sql .= " ORDER BY tpl.stage_id ASC, tpl.id ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function store(array $auth): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        $b = getBody();
        if (empty($b['title']) || empty($b['stage_id'])) {
            respond(422, null, 'Tiêu đề công việc và giai đoạn là bắt buộc', false);
        }

        $stageId = (int)$b['stage_id'];
        $teamId = !empty($b['team_id']) ? (int)$b['team_id'] : null;

        if ($auth['role'] === 'manager') {
            $stmtTeam = $this->db->prepare("SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, ",", IFNULL(co_leader_ids, ""))) LIMIT 1");
            $stmtTeam->execute([$auth['user_id']]);
            $managerTeamId = $stmtTeam->fetchColumn() ?: null;

            if ($teamId !== null && (int)$teamId !== (int)$managerTeamId) {
                respond(403, null, 'Bạn không thể tạo mẫu công việc cho nhóm khác', false);
            }
        }

        $title = trim($b['title']);
        $description = !empty($b['description']) ? trim($b['description']) : null;
        $priority = !empty($b['priority']) ? $b['priority'] : 'medium';
        $dueDaysOffset = isset($b['due_days_offset']) ? (int)$b['due_days_offset'] : 1;
        $requireApproval = !empty($b['require_approval']) ? (int)$b['require_approval'] : 0;
        $isActive = isset($b['is_active']) ? (int)$b['is_active'] : 1;

        // Verify stage exists
        $chkStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
        $chkStage->execute([$stageId, $auth['tenant_id']]);
        if (!$chkStage->fetch()) {
            respond(422, null, 'Giai đoạn không hợp lệ', false);
        }

        $stmt = $this->db->prepare("
            INSERT INTO workflow_task_templates (
                tenant_id, stage_id, team_id, title, description, priority, 
                due_days_offset, require_approval, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $auth['tenant_id'],
            $stageId,
            $teamId,
            $title,
            $description,
            $priority,
            $dueDaysOffset,
            $requireApproval,
            $isActive
        ]);

        $newId = (int)$this->db->lastInsertId();
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'workflow_task_template', $newId);
        respond(200, ['id' => $newId], 'Đã tạo mẫu công việc thành công');
    }

    public function update(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        // Verify template belongs to tenant
        $chk = $this->db->prepare("SELECT id FROM workflow_task_templates WHERE id=? AND tenant_id=?");
        $chk->execute([$id, $auth['tenant_id']]);
        if (!$chk->fetch()) {
            respond(404, null, 'Không tìm thấy mẫu công việc', false);
        }

        $b = getBody();
        if (empty($b['title']) || empty($b['stage_id'])) {
            respond(422, null, 'Tiêu đề công việc và giai đoạn là bắt buộc', false);
        }

        $stageId = (int)$b['stage_id'];
        $teamId = !empty($b['team_id']) ? (int)$b['team_id'] : null;

        if ($auth['role'] === 'manager') {
            $stmtTeam = $this->db->prepare("SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, ",", IFNULL(co_leader_ids, ""))) LIMIT 1");
            $stmtTeam->execute([$auth['user_id']]);
            $managerTeamId = $stmtTeam->fetchColumn() ?: null;

            $stmtCheckTpl = $this->db->prepare("SELECT team_id FROM workflow_task_templates WHERE id=? AND tenant_id=?");
            $stmtCheckTpl->execute([$id, $auth['tenant_id']]);
            $tplTeamId = $stmtCheckTpl->fetchColumn();

            if ($tplTeamId !== null && (int)$tplTeamId !== (int)$managerTeamId) {
                respond(403, null, 'Bạn không có quyền chỉnh sửa mẫu công việc của nhóm khác', false);
            }

            if ($teamId !== null && (int)$teamId !== (int)$managerTeamId) {
                respond(403, null, 'Bạn không thể gán mẫu công việc sang nhóm khác', false);
            }
        }

        $title = trim($b['title']);
        $description = !empty($b['description']) ? trim($b['description']) : null;
        $priority = !empty($b['priority']) ? $b['priority'] : 'medium';
        $dueDaysOffset = isset($b['due_days_offset']) ? (int)$b['due_days_offset'] : 1;
        $requireApproval = !empty($b['require_approval']) ? (int)$b['require_approval'] : 0;
        $isActive = isset($b['is_active']) ? (int)$b['is_active'] : 1;

        // Verify stage exists
        $chkStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
        $chkStage->execute([$stageId, $auth['tenant_id']]);
        if (!$chkStage->fetch()) {
            respond(422, null, 'Giai đoạn không hợp lệ', false);
        }

        $stmt = $this->db->prepare("
            UPDATE workflow_task_templates 
            SET stage_id = ?, 
                team_id = ?, 
                title = ?, 
                description = ?, 
                priority = ?, 
                due_days_offset = ?, 
                require_approval = ?, 
                is_active = ?
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([
            $stageId,
            $teamId,
            $title,
            $description,
            $priority,
            $dueDaysOffset,
            $requireApproval,
            $isActive,
            $id,
            $auth['tenant_id']
        ]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'workflow_task_template', $id);
        respond(200, null, 'Đã cập nhật mẫu công việc thành công');
    }

    public function destroy(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        if ($auth['role'] === 'manager') {
            $stmtTeam = $this->db->prepare("SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, ",", IFNULL(co_leader_ids, ""))) LIMIT 1");
            $stmtTeam->execute([$auth['user_id']]);
            $managerTeamId = $stmtTeam->fetchColumn() ?: null;

            $stmtCheckTpl = $this->db->prepare("SELECT team_id FROM workflow_task_templates WHERE id=? AND tenant_id=?");
            $stmtCheckTpl->execute([$id, $auth['tenant_id']]);
            $tplTeamId = $stmtCheckTpl->fetchColumn();

            if ($tplTeamId !== null && (int)$tplTeamId !== (int)$managerTeamId) {
                respond(403, null, 'Bạn không có quyền xóa mẫu công việc của nhóm khác', false);
            }
        }

        $stmt = $this->db->prepare("DELETE FROM workflow_task_templates WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $auth['tenant_id']]);

        if ($stmt->rowCount() > 0) {
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'workflow_task_template', $id);
            respond(200, null, 'Đã xóa mẫu công việc thành công');
        } else {
            respond(404, null, 'Không tìm thấy mẫu công việc', false);
        }
    }
}
