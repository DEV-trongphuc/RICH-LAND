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
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'sale', 'sales'], true)) {
            respond(403, null, 'Quyền truy cập bị từ chối', false);
        }

        $role = $auth['role'];
        $uid = (int)$auth['user_id'];
        $where = "";
        $params = [];

        if ($role === 'manager') {
            $where = " WHERE (FIND_IN_SET(?, CONCAT(t.leader_id, CHAR(44), COALESCE(t.co_leader_ids, t.leader_id))) OR t.id = (SELECT team_id FROM users WHERE id = ?))";
            $params[] = $uid;
            $params[] = $uid;
        } else if (in_array($role, ['sale', 'sales'], true)) {
            $uStmt = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
            $uStmt->execute([$uid]);
            $uRow = $uStmt->fetch();
            $teamId = $uRow ? $uRow['team_id'] : null;

            if ($teamId) {
                $where = " WHERE t.id = ?";
                $params[] = $teamId;
            } else {
                $where = " WHERE 1=0";
            }
        }

        $stmt = $this->db->prepare("
            SELECT t.*, u.full_name as leader_name, 
                   (SELECT COUNT(*) FROM users WHERE team_id = t.id AND role = 'sales') as member_count 
            FROM teams t 
            LEFT JOIN users u ON t.leader_id = u.id 
            $where
            ORDER BY t.name ASC
        ");
        $stmt->execute($params);
        respond(200, $stmt->fetchAll());
    }

    public function store(array $auth): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        $b = getBody();
        if (empty($b['name'])) {
            respond(422, null, 'Tên nhóm là bắt buộc', false);
        }

        $name = trim($b['name']);
        $branch = !empty($b['branch']) ? trim($b['branch']) : null;
        if (empty($b['leader_id'])) {
            respond(422, null, 'Trưởng nhóm là bắt buộc', false);
        }
        $leaderId = (int)$b['leader_id'];
        $description = !empty($b['description']) ? trim($b['description']) : null;
        $kpiTarget = isset($b['kpi_target']) ? (float)$b['kpi_target'] : null;
        $maxMembers = isset($b['max_members']) ? (int)$b['max_members'] : null;
        $focusProject = !empty($b['focus_project']) ? trim($b['focus_project']) : null;

        // Check if team name already exists
        $chk = $this->db->prepare("SELECT id FROM teams WHERE name = ?");
        $chk->execute([$name]);
        if ($chk->fetch()) {
            respond(409, null, 'Tên nhóm đã tồn tại', false);
        }

        $coLeaderIds = isset($b['co_leader_ids']) ? (is_array($b['co_leader_ids']) ? implode(',', array_filter(array_map('intval', $b['co_leader_ids']))) : trim($b['co_leader_ids'])) : null;

        $stmt = $this->db->prepare("INSERT INTO teams (name, branch, leader_id, description, kpi_target, max_members, focus_project, co_leader_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $branch, $leaderId, $description, $kpiTarget, $maxMembers, $focusProject, $coLeaderIds]);
        $newId = (int)$this->db->lastInsertId();

        // Sync members
        if (isset($b['member_ids']) && is_array($b['member_ids'])) {
            $clearStmt = $this->db->prepare("UPDATE users SET team_id = NULL WHERE team_id = ?");
            $clearStmt->execute([$newId]);

            if (!empty($b['member_ids'])) {
                $inQuery = implode(',', array_fill(0, count($b['member_ids']), '?'));
                $assignStmt = $this->db->prepare("UPDATE users SET team_id = ? WHERE id IN ($inQuery)");
                $assignStmt->execute(array_merge([$newId], array_map('intval', $b['member_ids'])));
            }

            // Sync to consultants
            $syncStmt = $this->db->prepare("UPDATE consultants c JOIN users u ON c.email = u.email SET c.team_id = u.team_id");
            $syncStmt->execute();

            // Send notifications to newly added members
            if (!empty($b['member_ids'])) {
                $editorName = $auth['full_name'] ?? 'Quản trị viên';
                foreach ($b['member_ids'] as $addedUid) {
                    $stmtNotif = $this->db->prepare("
                        INSERT INTO notifications (user_id, tenant_id, title, body, type, link) 
                        VALUES (?, ?, ?, ?, 'team_assignment', ?)
                    ");
                    $title = "Bạn đã được thêm vào nhóm mới";
                    $body = "Bạn đã được thêm vào nhóm \"$name\" bởi $editorName.";
                    $link = "/consultants?tab=teams";
                    $stmtNotif->execute([(int)$addedUid, $auth['tenant_id'], $title, $body, $link]);
                }
            }
        }

        // Log activity
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'team', $newId, json_encode(['name' => $name, 'branch' => $branch, 'leader_id' => $leaderId, 'co_leader_ids' => $coLeaderIds, 'description' => $description, 'kpi_target' => $kpiTarget, 'max_members' => $maxMembers, 'focus_project' => $focusProject, 'member_ids' => $b['member_ids'] ?? []]));

        $this->show($auth, $newId);
    }

    public function show(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'sale', 'sales'], true)) {
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
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
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
            if (empty($b['leader_id'])) {
                respond(422, null, 'Trưởng nhóm không được để trống', false);
            }
            $sets[] = "leader_id = ?";
            $params[] = (int)$b['leader_id'];
        }

        if (array_key_exists('co_leader_ids', $b)) {
            $sets[] = "co_leader_ids = ?";
            $params[] = isset($b['co_leader_ids']) ? (is_array($b['co_leader_ids']) ? implode(',', array_filter(array_map('intval', $b['co_leader_ids']))) : trim($b['co_leader_ids'])) : null;
        }

        if (array_key_exists('description', $b)) {
            $sets[] = "description = ?";
            $params[] = !empty($b['description']) ? trim($b['description']) : null;
        }

        if (array_key_exists('kpi_target', $b)) {
            $sets[] = "kpi_target = ?";
            $params[] = isset($b['kpi_target']) && $b['kpi_target'] !== '' ? (float)$b['kpi_target'] : null;
        }

        if (array_key_exists('max_members', $b)) {
            $sets[] = "max_members = ?";
            $params[] = isset($b['max_members']) && $b['max_members'] !== '' ? (int)$b['max_members'] : null;
        }

        if (array_key_exists('focus_project', $b)) {
            $sets[] = "focus_project = ?";
            $params[] = !empty($b['focus_project']) ? trim($b['focus_project']) : null;
        }

        if (empty($sets)) {
            // Even if no team table sets, we can still process member_ids if present.
            if (!isset($b['member_ids'])) {
                respond(422, null, 'Không có dữ liệu cập nhật', false);
            }
        }

        if (!empty($sets)) {
            $params[] = $id;
            $stmt = $this->db->prepare("UPDATE teams SET " . implode(', ', $sets) . " WHERE id = ?");
            $stmt->execute($params);
        }

        // Sync members
        if (isset($b['member_ids']) && is_array($b['member_ids'])) {
            // Fetch old member ids to find newly added members
            $oldMemberStmt = $this->db->prepare("SELECT id FROM users WHERE team_id = ?");
            $oldMemberStmt->execute([$id]);
            $oldMemberIds = $oldMemberStmt->fetchAll(PDO::FETCH_COLUMN);
            $newMemberIds = array_map('intval', $b['member_ids']);
            $addedMemberIds = array_diff($newMemberIds, $oldMemberIds);

            $clearStmt = $this->db->prepare("UPDATE users SET team_id = NULL WHERE team_id = ?");
            $clearStmt->execute([$id]);

            if (!empty($b['member_ids'])) {
                $inQuery = implode(',', array_fill(0, count($b['member_ids']), '?'));
                $assignStmt = $this->db->prepare("UPDATE users SET team_id = ? WHERE id IN ($inQuery)");
                $assignStmt->execute(array_merge([$id], array_map('intval', $b['member_ids'])));
            }

            // Sync to consultants
            $syncStmt = $this->db->prepare("UPDATE consultants c JOIN users u ON c.email = u.email SET c.team_id = u.team_id");
            $syncStmt->execute();

            // Send notifications to newly added members
            if (!empty($addedMemberIds)) {
                $editorName = $auth['full_name'] ?? 'Quản trị viên';
                $teamNameStmt = $this->db->prepare("SELECT name FROM teams WHERE id = ?");
                $teamNameStmt->execute([$id]);
                $teamName = $teamNameStmt->fetchColumn() ?: 'Nhóm mới';

                foreach ($addedMemberIds as $addedUid) {
                    $stmtNotif = $this->db->prepare("
                        INSERT INTO notifications (user_id, tenant_id, title, body, type, link) 
                        VALUES (?, ?, ?, ?, 'team_assignment', ?)
                    ");
                    $title = "Bạn đã được thêm vào nhóm mới";
                    $body = "Bạn đã được thêm vào nhóm \"$teamName\" bởi $editorName.";
                    $link = "/consultants?tab=teams";
                    $stmtNotif->execute([$addedUid, $auth['tenant_id'], $title, $body, $link]);
                }
            }
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'team', $id, json_encode($b));

        $this->show($auth, $id);
    }

    public function destroy(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        try {
            $this->db->beginTransaction();

            // Set team_id to NULL for all consultants in this team
            $upStmt = $this->db->prepare("UPDATE consultants SET team_id = NULL WHERE team_id = ?");
            $upStmt->execute([$id]);

            // Set team_id to NULL for all users in this team
            $upStmtUser = $this->db->prepare("UPDATE users SET team_id = NULL WHERE team_id = ?");
            $upStmtUser->execute([$id]);

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

    public function leave(array $auth): void
    {
        $uid = (int)$auth['user_id'];
        
        $uStmt = $this->db->prepare("SELECT team_id, email FROM users WHERE id = ?");
        $uStmt->execute([$uid]);
        $userRow = $uStmt->fetch();
        
        if (!$userRow || !$userRow['team_id']) {
            respond(400, null, 'Bạn hiện không tham gia nhóm nào', false);
        }
        
        $teamId = (int)$userRow['team_id'];
        $email = $userRow['email'];

        $tStmt = $this->db->prepare("SELECT name, leader_id FROM teams WHERE id = ?");
        $tStmt->execute([$teamId]);
        $teamRow = $tStmt->fetch();
        $teamName = $teamRow ? $teamRow['name'] : 'Nhóm';
        $leaderId = $teamRow ? (int)$teamRow['leader_id'] : 0;
        
        try {
            $this->db->beginTransaction();
            
            // Set team_id to NULL for the user
            $upUser = $this->db->prepare("UPDATE users SET team_id = NULL WHERE id = ?");
            $upUser->execute([$uid]);
            
            // Set team_id to NULL for the corresponding consultant (if any)
            if ($email) {
                $upConsultant = $this->db->prepare("UPDATE consultants SET team_id = NULL WHERE email = ?");
                $upConsultant->execute([$email]);
            }
            
            // Send notification to the leader (Manager)
            if ($leaderId > 0) {
                $stmtNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link) 
                    VALUES (?, ?, ?, ?, 'team_leave', ?)
                ");
                $title = "Thành viên rời nhóm";
                $saleName = $auth['full_name'] ?? 'Tư vấn viên';
                $body = "Tư vấn viên $saleName đã chủ động rời khỏi nhóm \"$teamName\".";
                $link = "/consultants?tab=teams";
                $stmtNotif->execute([$leaderId, $auth['tenant_id'], $title, $body, $link]);
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'LEAVE', 'team', $teamId);
            
            $this->db->commit();
            respond(200, null, 'Bạn đã rời khỏi nhóm thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi hệ thống khi rời nhóm: ' . $e->getMessage(), false);
        }
    }

    private function requireTeamAccess(array $auth, int $teamId): void {
        $role = $auth['role'];
        if (in_array($role, ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
            return;
        }
        $stmt = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
        $stmt->execute([$auth['user_id']]);
        $teamIdUser = (int)$stmt->fetchColumn();
        if ($teamIdUser !== $teamId) {
            respond(403, null, 'Bạn không thuộc nhóm này để thực hiện thao tác', false);
        }
    }

    public function getComments(array $auth, int $teamId): void {
        $this->requireTeamAccess($auth, $teamId);
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'team' AND c.entity_id = ? AND c.tenant_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$teamId, $auth['tenant_id']]);
        respond(200, $stmt->fetchAll(), 'Lấy danh sách bình luận thành công');
    }

    public function addComment(array $auth, int $teamId): void {
        $this->requireTeamAccess($auth, $teamId);
        $b = getBody();
        $body = trim($b['body'] ?? '');
        if (!$body) {
            respond(422, null, 'Nội dung bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("
            INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, parent_id) 
            VALUES (?, 'team', ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $teamId, $auth['user_id'], $body, $parentId]);
        $newId = $this->db->lastInsertId();

        if ($parentId > 0) {
            $stmtParent = $this->db->prepare("SELECT user_id FROM comments WHERE id = ?");
            $stmtParent->execute([$parentId]);
            $parentOwnerId = (int)$stmtParent->fetchColumn();

            if ($parentOwnerId > 0 && $parentOwnerId !== (int)$auth['user_id']) {
                $title = "Bạn có phản hồi mới trong thảo luận nhóm";
                $bodyText = ($auth['full_name'] ?? 'Đồng nghiệp') . " đã trả lời bình luận của bạn trong thảo luận nhóm";
                $type = "info";
                $link = "/consultants?tab=teams&highlight_comment_id=" . $newId;

                $insertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $insertNotif->execute([$parentOwnerId, $auth['tenant_id'], $title, $bodyText, $type, $link]);
            }
        }

        // Parse mentions
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()]+)/u', $body, $matches);
        if (!empty($matches[1])) {
            foreach ($matches[1] as $nameWithUnderscores) {
                $fullName = str_replace('_', ' ', $nameWithUnderscores);
                $stmtUser = $this->db->prepare("SELECT id, email, full_name FROM users WHERE tenant_id=? AND full_name=?");
                $stmtUser->execute([$auth['tenant_id'], $fullName]);
                $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                if ($userRow) {
                    $mentionedUserId = (int)$userRow['id'];
                    if ($mentionedUserId !== (int)$auth['user_id']) {
                        $title = "Bạn được nhắc tên trong thảo luận nhóm";
                        $bodyText = ($auth['full_name'] ?? 'Đồng nghiệp') . " đã nhắc đến bạn trong thảo luận nhóm";
                        $type = "mention";
                        $link = "/consultants?tab=teams&highlight_comment_id=" . $newId;

                        $insertNotif = $this->db->prepare("
                            INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                            VALUES (?, ?, ?, ?, ?, ?)
                        ");
                        $insertNotif->execute([$mentionedUserId, $auth['tenant_id'], $title, $bodyText, $type, $link]);
                    }
                }
            }
        }

        respond(200, ['id' => $newId], 'Đăng bình luận thành công');
    }
}
