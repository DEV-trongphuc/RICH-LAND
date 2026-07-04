<?php
class TeamController
{
    private PDO $db;
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function index(array $auth): void
    {
        // Only managers, admins, superadmins, and sales can access team list
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'sale', 'sales'], true)) {
            respond(403, null, 'Quyền truy cập bị từ chối', false);
        }

        $stmt = $this->db->prepare("
            SELECT t.*, u.full_name as leader_name, 
                   (SELECT COUNT(*) FROM users WHERE team_id = t.id AND role = 'sales') as member_count 
            FROM teams t 
            LEFT JOIN users u ON t.leader_id = u.id 
            ORDER BY t.name ASC
        ");
        $stmt->execute();
        respond(200, $stmt->fetchAll());
    }

    public function store(array $auth): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        $b = getBody();
        if (empty($b['name'])) {
            respond(422, null, 'Tên nhóm là bắt buộc', false);
        }

        $name = trim($b['name']);
        $branch = !empty($b['branch']) ? trim($b['branch']) : null;
        $leaderId = !empty($b['leader_id']) ? (int)$b['leader_id'] : null;

        // Check if team name already exists
        $chk = $this->db->prepare("SELECT id FROM teams WHERE name = ?");
        $chk->execute([$name]);
        if ($chk->fetch()) {
            respond(409, null, 'Tên nhóm đã tồn tại', false);
        }

        $stmt = $this->db->prepare("INSERT INTO teams (name, branch, leader_id) VALUES (?, ?, ?)");
        $stmt->execute([$name, $branch, $leaderId]);
        $newId = (int)$this->db->lastInsertId();

        // Log activity
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'team', $newId, json_encode(['name' => $name, 'branch' => $branch, 'leader_id' => $leaderId]));

        $this->show($auth, $newId);
    }

    public function show(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        $stmt = $this->db->prepare("
            SELECT t.*, u.full_name as leader_name 
            FROM teams t 
            LEFT JOIN users u ON t.leader_id = u.id 
            WHERE t.id = ?
        ");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            respond(404, null, 'Không tìm thấy nhóm', false);
        }

        // Fetch members
        $mStmt = $this->db->prepare("SELECT id, name, email, status, avatar FROM consultants WHERE team_id = ?");
        $mStmt->execute([$id]);
        $row['members'] = $mStmt->fetchAll();

        respond(200, $row);
    }

    public function update(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        $b = getBody();
        $sets = [];
        $params = [];

        if (isset($b['name'])) {
            $name = trim($b['name']);
            if (empty($name)) {
                respond(422, null, 'Tên nhóm không được để trống', false);
            }
            // Check duplicate name excluding self
            $chk = $this->db->prepare("SELECT id FROM teams WHERE name = ? AND id != ?");
            $chk->execute([$name, $id]);
            if ($chk->fetch()) {
                respond(409, null, 'Tên nhóm đã tồn tại', false);
            }
            $sets[] = "name = ?";
            $params[] = $name;
        }

        if (array_key_exists('branch', $b)) {
            $sets[] = "branch = ?";
            $params[] = !empty($b['branch']) ? trim($b['branch']) : null;
        }

        if (array_key_exists('leader_id', $b)) {
            $sets[] = "leader_id = ?";
            $params[] = !empty($b['leader_id']) ? (int)$b['leader_id'] : null;
        }

        if (empty($sets)) {
            respond(422, null, 'Không có dữ liệu cập nhật', false);
        }

        $params[] = $id;
        $stmt = $this->db->prepare("UPDATE teams SET " . implode(', ', $sets) . " WHERE id = ?");
        $stmt->execute($params);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'team', $id, json_encode($b));

        $this->show($auth, $id);
    }

    public function destroy(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        try {
            $this->db->beginTransaction();

            // Set team_id to NULL for all consultants in this team
            $upStmt = $this->db->prepare("UPDATE consultants SET team_id = NULL WHERE team_id = ?");
            $upStmt->execute([$id]);

            // Delete team
            $delStmt = $this->db->prepare("DELETE FROM teams WHERE id = ?");
            $delStmt->execute([$id]);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'team', $id);

            $this->db->commit();
            respond(200, null, 'Đã xóa nhóm và giải phóng các thành viên thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi cơ sở dữ liệu: ' . $e->getMessage(), false);
        }
    }
}
