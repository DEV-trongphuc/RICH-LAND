<?php
// backend/controllers/CampaignController.php

class CampaignController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS marketing_campaigns (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    name VARCHAR(255) NOT NULL,
                    description TEXT DEFAULT NULL,
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN start_date DATE DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN end_date DATE DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN project_ids TEXT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN project_id INT NULL DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN user_ids TEXT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN manager_ids TEXT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN document_ids TEXT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN folder_path VARCHAR(500) DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN created_by INT DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->db->exec("ALTER TABLE marketing_campaigns ADD COLUMN reference_url VARCHAR(500) DEFAULT NULL");
            } catch (Exception $e) {}

            // Delete mock campaigns if they exist to keep only production/user data
            $this->db->exec("
                DELETE FROM marketing_campaigns 
                WHERE name IN (
                    'Chiến dịch Mở bán Q1 2026', 
                    'Facebook Lead Ads - HCMC', 
                    'Google Search - Căn hộ cao cấp', 
                    'TikTok Ads - Biệt thự nghỉ dưỡng', 
                    'Chiến dịch Email & Inbound M2'
                ) OR description = 'Chiến dịch marketing chạy quảng cáo thu lead phân phối về cho các dự án bất động sản.';
            ");
        } catch (Exception $e) {}
    }

    public function index(array $auth): void {
        $tenantId = $auth['tenant_id'] ?? 1;
        $where = "WHERE tenant_id = ?";
        $params = [$tenantId];

        $bypassRoster = (int)($_GET['bypass_roster'] ?? 0);
        $isRosterRestricted = in_array($auth['role'], ['sale', 'sales', 'manager'], true);
        if ($isRosterRestricted && !$bypassRoster) {
            $where .= " AND (
                FIND_IN_SET(?, user_ids) 
                OR FIND_IN_SET(?, manager_ids) 
                OR created_by = ?
                -- Case 0: User is the project manager or creator of the parent project (Always see)
                OR EXISTS (
                    SELECT 1 FROM projects p 
                    WHERE p.id = marketing_campaigns.project_id 
                      AND (FIND_IN_SET(?, p.manager_ids) OR p.created_by = ?)
                )
                -- Case 1: Public project campaign
                OR EXISTS (
                    SELECT 1 FROM projects p 
                    WHERE p.id = marketing_campaigns.project_id 
                      AND p.campaign_sharing_mode = 'public'
                )
                -- Case 2: Project members visibility mode
                OR (
                    EXISTS (
                        SELECT 1 FROM projects p 
                        WHERE p.id = marketing_campaigns.project_id 
                          AND p.campaign_sharing_mode = 'project_members'
                    )
                    AND EXISTS (
                        SELECT 1 FROM project_roster pr 
                        WHERE pr.project_id = marketing_campaigns.project_id 
                          AND pr.user_id = ?
                    )
                )
            )";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }

        $projectId = isset($_GET['project_id']) && $_GET['project_id'] !== '' ? (int)$_GET['project_id'] : 0;
        if ($projectId > 0) {
            $where .= " AND project_id = ?";
            $params[] = $projectId;
        }

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 0;
        $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 0;

        if ($page > 0 && $limit > 0) {
            // Count total
            $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM marketing_campaigns $where");
            $stmtCount->execute($params);
            $total = (int)$stmtCount->fetchColumn();

            $offset = ($page - 1) * $limit;
            $stmt = $this->db->prepare("SELECT *, (SELECT name FROM projects WHERE id = project_id) as project_name, (SELECT code FROM projects WHERE id = project_id) as project_code FROM marketing_campaigns $where ORDER BY created_at DESC LIMIT $offset, $limit");
            $stmt->execute($params);
            $campaigns = $stmt->fetchAll();

            respond(200, [
                'data' => $campaigns,
                'total' => $total,
                'page' => $page,
                'limit' => $limit
            ], 'Lấy danh sách chiến dịch thành công');
        } else {
            $stmt = $this->db->prepare("SELECT *, (SELECT name FROM projects WHERE id = project_id) as project_name, (SELECT code FROM projects WHERE id = project_id) as project_code FROM marketing_campaigns $where ORDER BY created_at DESC");
            $stmt->execute($params);
            respond(200, $stmt->fetchAll(), 'Lấy danh sách chiến dịch thành công');
        }
    }

    public function show(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT mc.*, 
                   (SELECT name FROM projects WHERE id = mc.project_id) as project_name, 
                   (SELECT code FROM projects WHERE id = mc.project_id) as project_code 
            FROM marketing_campaigns mc 
            WHERE mc.id = ?
        ");
        $stmt->execute([$id]);
        $campaign = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$campaign) {
            respond(404, null, 'Chiến dịch không tồn tại', false);
        }

        // Fetch roster members if user_ids exist
        $roster = [];
        if (!empty($campaign['user_ids'])) {
            $uIds = array_filter(array_map('intval', explode(',', $campaign['user_ids'])));
            if (!empty($uIds)) {
                $in = implode(',', $uIds);
                try {
                    $uStmt = $this->db->query("SELECT id, name as full_name, email, role, avatar_url FROM users WHERE id IN ($in)");
                    $roster = $uStmt->fetchAll(PDO::FETCH_ASSOC);
                } catch (Exception $e) {}
            }
        }
        $campaign['roster'] = $roster;

        respond(200, $campaign, 'Lấy chi tiết chiến dịch thành công');
    }

    public function store(array $auth): void {
        $b = getBody();
        $name = trim($b['name'] ?? '');
        $description = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');
        $start_date = !empty($b['start_date']) ? $b['start_date'] : null;
        $end_date = !empty($b['end_date']) ? $b['end_date'] : null;
        $project_id = isset($b['project_id']) && $b['project_id'] !== '' ? (int)$b['project_id'] : null;
        $project_ids = trim($b['project_ids'] ?? '');
        $user_ids = trim($b['user_ids'] ?? '');
        $manager_ids = trim($b['manager_ids'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $folder_path = trim($b['folder_path'] ?? '');
        $reference_url = trim($b['reference_url'] ?? '');

        $tenantId = $auth['tenant_id'] ?? 1;
        $userId = $auth['user_id'] ?? $auth['id'] ?? 1;

        // Check if the user is a manager/creator of the target project to allow campaign creation
        $isProjectManager = false;
        if ($project_id) {
            $stmtProj = $this->db->prepare("SELECT created_by, manager_ids FROM projects WHERE id = ?");
            $stmtProj->execute([$project_id]);
            $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
            if ($proj) {
                $pCreatorId = $proj['created_by'];
                $pMgrs = array_filter(array_map('intval', explode(',', $proj['manager_ids'] ?? '')));
                $isProjectManager = ($pCreatorId !== null && (int)$pCreatorId === (int)$userId) || in_array((int)$userId, $pMgrs, true);
            }
        }

        if (!$isProjectManager) {
            requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        }

        if ($project_id === null && !empty($project_ids)) {
            $pNames = array_filter(array_map('trim', explode(',', $project_ids)));
            if (!empty($pNames)) {
                $firstName = reset($pNames);
                if (is_numeric($firstName)) {
                    $project_id = (int)$firstName;
                } else {
                    $stmtP = $this->db->prepare("SELECT id FROM projects WHERE name = ? LIMIT 1");
                    $stmtP->execute([$firstName]);
                    $pId = $stmtP->fetchColumn();
                    if ($pId !== false) {
                        $project_id = (int)$pId;
                    }
                }
            }
        }

        $stmt = $this->db->prepare("
            INSERT INTO marketing_campaigns (tenant_id, name, description, status, start_date, end_date, project_id, project_ids, user_ids, manager_ids, document_ids, folder_path, reference_url, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$tenantId, $name, $description, $status, $start_date, $end_date, $project_id, $project_ids, $user_ids, $manager_ids, $document_ids, $folder_path, $reference_url, $userId]);
        $newId = (int)$this->db->lastInsertId();

        $this->propagateCampaignRoster($project_id ?: $project_ids, $user_ids);

        logActivity($this->db, $tenantId, $userId, 'CREATE_CAMPAIGN', 'marketing_campaigns', $newId, "Tạo chiến dịch: $name");
        respond(200, ['id' => $newId], 'Tạo chiến dịch thành công');
    }

    public function update(array $auth, int $id): void {
        $isAuthorized = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true);
        if (!$isAuthorized) {
            $stmtLeader = $this->db->prepare("SELECT 1 FROM teams WHERE leader_id = ? LIMIT 1");
            $stmtLeader->execute([(int)$auth['user_id']]);
            if ($stmtLeader->fetch()) {
                $isAuthorized = true;
            }
        }
        if (!$isAuthorized) {
            respond(403, null, 'Quyền truy cập bị từ chối', false);
        }

        $tenantId = $auth['tenant_id'] ?? 1;
        $userId = $auth['user_id'] ?? $auth['id'] ?? 1;
        
        $stmtCheck = $this->db->prepare("SELECT created_by, manager_ids, user_ids, project_id FROM marketing_campaigns WHERE id = ? AND tenant_id = ?");
        $stmtCheck->execute([$id, $tenantId]);
        $camp = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$camp) {
            respond(404, null, 'Chiến dịch không tồn tại', false);
        }
        $isAdminOrDirector = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true);
        if (!$isAdminOrDirector) {
            $creatorId = $camp['created_by'];
            $mgrs = array_filter(array_map('intval', explode(',', $camp['manager_ids'] ?? '')));
            $users = array_filter(array_map('intval', explode(',', $camp['user_ids'] ?? '')));
            $isCreator = ($creatorId !== null && (int)$creatorId === (int)$userId);
            $isRoster = in_array((int)$userId, $mgrs, true) || in_array((int)$userId, $users, true);

            // Check project manager/creator bypass
            if (!$isCreator && !$isRoster) {
                if ($camp['project_id']) {
                    $stmtProj = $this->db->prepare("SELECT created_by, manager_ids FROM projects WHERE id = ?");
                    $stmtProj->execute([$camp['project_id']]);
                    $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
                    if ($proj) {
                        $pCreatorId = $proj['created_by'];
                        $pMgrs = array_filter(array_map('intval', explode(',', $proj['manager_ids'] ?? '')));
                        $isProjectMgr = ($pCreatorId !== null && (int)$pCreatorId === (int)$userId) || in_array((int)$userId, $pMgrs, true);
                        if ($isProjectMgr) {
                            $isRoster = true; // Bypass restriction
                        }
                    }
                }
            }

            if (!$isCreator && !$isRoster) {
                if ($camp['project_id']) {
                    // Only check project roster if sharing mode is not independent
                    $stmtMode = $this->db->prepare("SELECT campaign_sharing_mode FROM projects WHERE id = ?");
                    $stmtMode->execute([$camp['project_id']]);
                    $sharingMode = $stmtMode->fetchColumn();
                    if (!$sharingMode) {
                        $sharingMode = 'independent';
                    }

                    if ($sharingMode !== 'independent') {
                        $stmtRoster = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ? LIMIT 1");
                        $stmtRoster->execute([(int)$camp['project_id'], (int)$userId]);
                        if ($stmtRoster->fetch()) {
                            $isRoster = true;
                        }
                    }
                }
            }

            if (!$isCreator && !$isRoster) {
                respond(403, null, 'Bạn không có quyền chỉnh sửa chiến dịch này', false);
            }
        }
        $b = getBody();
        $name = trim($b['name'] ?? '');
        $description = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');
        $start_date = !empty($b['start_date']) ? $b['start_date'] : null;
        $end_date = !empty($b['end_date']) ? $b['end_date'] : null;
        $project_id = isset($b['project_id']) && $b['project_id'] !== '' ? (int)$b['project_id'] : null;
        $project_ids = trim($b['project_ids'] ?? '');
        $user_ids = trim($b['user_ids'] ?? '');
        $manager_ids = trim($b['manager_ids'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $folder_path = trim($b['folder_path'] ?? '');
        $reference_url = trim($b['reference_url'] ?? '');

        if (empty($name)) {
            respond(422, null, 'Tên chiến dịch không được để trống', false);
        }

        $tenantId = $auth['tenant_id'] ?? 1;
        $userId = $auth['user_id'] ?? $auth['id'] ?? 1;

        if ($project_id === null && !empty($project_ids)) {
            $pNames = array_filter(array_map('trim', explode(',', $project_ids)));
            if (!empty($pNames)) {
                $firstName = reset($pNames);
                if (is_numeric($firstName)) {
                    $project_id = (int)$firstName;
                } else {
                    $stmtP = $this->db->prepare("SELECT id FROM projects WHERE name = ? LIMIT 1");
                    $stmtP->execute([$firstName]);
                    $pId = $stmtP->fetchColumn();
                    if ($pId !== false) {
                        $project_id = (int)$pId;
                    }
                }
            }
        }

        $stmt = $this->db->prepare("
            UPDATE marketing_campaigns 
            SET name = ?, description = ?, status = ?, start_date = ?, end_date = ?, project_id = ?, project_ids = ?, user_ids = ?, manager_ids = ?, document_ids = ?, folder_path = ?, reference_url = ? 
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$name, $description, $status, $start_date, $end_date, $project_id, $project_ids, $user_ids, $manager_ids, $document_ids, $folder_path, $reference_url, $id, $tenantId]);

        $this->propagateCampaignRoster($project_id ?: $project_ids, $user_ids);

        logActivity($this->db, $tenantId, $userId, 'UPDATE_CAMPAIGN', 'marketing_campaigns', $id, "Cập nhật chiến dịch: $name");
        respond(200, null, 'Cập nhật chiến dịch thành công');
    }

    private function propagateCampaignRoster($projectIdOrStr, string $userIdsStr): void {
        if (empty($projectIdOrStr) || empty($userIdsStr)) return;
        $uids = array_filter(array_map('intval', explode(',', $userIdsStr)));
        if (empty($uids)) return;

        $pids = [];
        if (is_numeric($projectIdOrStr)) {
            $pids[] = (int)$projectIdOrStr;
        } else {
            $pNames = array_filter(array_map('trim', explode(',', $projectIdOrStr)));
            if (!empty($pNames)) {
                $inClause = implode(',', array_fill(0, count($pNames), '?'));
                $stmtProj = $this->db->prepare("SELECT id FROM projects WHERE name IN ($inClause)");
                $stmtProj->execute($pNames);
                $pids = $stmtProj->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }
        }

        foreach ($pids as $pid) {
            foreach ($uids as $uid) {
                $stmtCheck = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ?");
                $stmtCheck->execute([$pid, $uid]);
                if (!$stmtCheck->fetch()) {
                    $stmtAdd = $this->db->prepare("INSERT INTO project_roster (project_id, user_id) VALUES (?, ?)");
                    $stmtAdd->execute([$pid, $uid]);
                }
            }
        }
    }

    public function destroy(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        
        $tenantId = $auth['tenant_id'] ?? 1;
        $userId = $auth['user_id'] ?? $auth['id'] ?? 1;

        $stmtCheck = $this->db->prepare("SELECT name, created_by, manager_ids, user_ids FROM marketing_campaigns WHERE id = ? AND tenant_id = ?");
        $stmtCheck->execute([$id, $tenantId]);
        $camp = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$camp) {
            respond(404, null, 'Chiến dịch không tồn tại', false);
        }
        $name = $camp['name'];
        $isAdminOrDirector = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true);
        if (!$isAdminOrDirector) {
            $creatorId = $camp['created_by'];
            $mgrs = array_filter(array_map('intval', explode(',', $camp['manager_ids'] ?? '')));
            $users = array_filter(array_map('intval', explode(',', $camp['user_ids'] ?? '')));
            $isCreator = ($creatorId !== null && (int)$creatorId === (int)$userId);
            $isRoster = in_array((int)$userId, $mgrs, true) || in_array((int)$userId, $users, true);
            // Check project manager/creator bypass
            if (!$isCreator && !$isRoster) {
                // Fetch the campaign to get the project_id
                $stmtProjCheck = $this->db->prepare("SELECT project_id FROM marketing_campaigns WHERE id = ?");
                $stmtProjCheck->execute([$id]);
                $projId = $stmtProjCheck->fetchColumn();
                if ($projId) {
                    $stmtProj = $this->db->prepare("SELECT created_by, manager_ids FROM projects WHERE id = ?");
                    $stmtProj->execute([$projId]);
                    $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
                    if ($proj) {
                        $pCreatorId = $proj['created_by'];
                        $pMgrs = array_filter(array_map('intval', explode(',', $proj['manager_ids'] ?? '')));
                        $isProjectMgr = ($pCreatorId !== null && (int)$pCreatorId === (int)$userId) || in_array((int)$userId, $pMgrs, true);
                        if ($isProjectMgr) {
                            $isRoster = true; // Bypass restriction!
                        }
                    }
                }
            }

            if (!$isCreator && !$isRoster) {
                respond(403, null, 'Bạn không có quyền xóa chiến dịch này', false);
            }
        }

        $stmt = $this->db->prepare("DELETE FROM marketing_campaigns WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);

        logActivity($this->db, $tenantId, $userId, 'DELETE_CAMPAIGN', 'marketing_campaigns', $id, "Xóa chiến dịch: $name");
        respond(200, null, 'Xóa chiến dịch thành công');
    }

    private function requireCampaignAccess(array $auth, int $campaignId): void {
        $stmtCamp = $this->db->prepare("SELECT tenant_id FROM marketing_campaigns WHERE id = ?");
        $stmtCamp->execute([$campaignId]);
        $campTenantId = $stmtCamp->fetchColumn();
        if ($campTenantId === false) {
            respond(404, null, 'Chiến dịch không tồn tại', false);
        }
        if ((int)$campTenantId !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền truy cập chiến dịch này', false);
        }
    }

    public function getComments(array $auth, int $campaignId): void {
        $this->requireCampaignAccess($auth, $campaignId);
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'campaign' AND c.entity_id = ? AND c.tenant_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$campaignId, $auth['tenant_id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $comments = array_map(function($row) {
            if (!empty($row['attachments'])) {
                $decoded = json_decode($row['attachments'], true);
                $row['attachments'] = is_array($decoded) ? $decoded : [];
            } else {
                $row['attachments'] = [];
            }
            return $row;
        }, $rows);
        respond(200, $comments, 'Lấy danh sách bình luận thành công');
    }

    public function addComment(array $auth, int $campaignId): void {
        $this->requireCampaignAccess($auth, $campaignId);
        $b = getBody();
        $body = trim($b['body'] ?? '');
        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments'], JSON_UNESCAPED_UNICODE) : null;
        if (!$body && !$attachments) {
            respond(422, null, 'Nội dung hoặc tệp đính kèm bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("
            INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, attachments, parent_id) 
            VALUES (?, 'campaign', ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $campaignId, $auth['user_id'], $body, $attachments, $parentId]);
        $newId = $this->db->lastInsertId();

        if ($parentId > 0) {
            $stmtParent = $this->db->prepare("SELECT user_id FROM comments WHERE id = ?");
            $stmtParent->execute([$parentId]);
            $parentOwnerId = (int)$stmtParent->fetchColumn();

            if ($parentOwnerId > 0 && $parentOwnerId !== (int)$auth['user_id']) {
                $title = "Bạn có phản hồi mới trong thảo luận chiến dịch";
                $bodyText = ($auth['full_name'] ?? 'Đồng nghiệp') . " đã trả lời bình luận của bạn trong chiến dịch";
                $type = "info";
                $link = "/marketing?id=" . $campaignId . "&highlight_comment_id=" . $newId;

                $insertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $insertNotif->execute([$parentOwnerId, $auth['tenant_id'], $title, $bodyText, $type, $link]);
            }
        }

        // Parse mentions in comment body
        $mentions = [];
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()]+)/u', $body, $matches);
        if (!empty($matches[1])) {
            foreach ($matches[1] as $nameWithUnderscores) {
                $fullName = str_replace('_', ' ', $nameWithUnderscores);
                $stmtUser = $this->db->prepare("SELECT id, email, full_name FROM users WHERE tenant_id=? AND full_name=?");
                $stmtUser->execute([$auth['tenant_id'], $fullName]);
                $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                if ($userRow) {
                    $uid = (int)$userRow['id'];
                    if ($uid !== (int)$auth['user_id']) {
                        $mentions[$uid] = $userRow;
                    }
                }
            }
        }

        // Get campaign name
        $stmtCamp = $this->db->prepare("SELECT name FROM marketing_campaigns WHERE id = ?");
        $stmtCamp->execute([$campaignId]);
        $campaignName = $stmtCamp->fetchColumn() ?: "Chiến dịch";

        if (!empty($mentions)) {
            require_once __DIR__ . '/../mailer.php';
            $notif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?,?,?,?,?,?)");
            $preview = mb_strimwidth($body, 0, 50, "...");
            foreach ($mentions as $uid => $userRow) {
                $notif->execute([
                    $uid, $auth['tenant_id'],
                    "Bạn được nhắc tên trong chiến dịch " . $campaignName,
                    $auth['full_name'] . ' đã nhắc tên bạn trong bình luận chiến dịch ' . $campaignName . ': "' . $preview . '"',
                    'campaign_comment_mention',
                    "/projects?sub=campaigns&id=" . $campaignId . "&highlight_comment_id=" . $newId
                ]);

                if (!empty($userRow['email'])) {
                    $emailSubject = "[RICH LAND] Bạn được nhắc tên trong bình luận chiến dịch " . $campaignName;
                    $emailTitle = "NHẮC TÊN TRÊN HỆ THỐNG";
                    $emailContent = "Chào <strong>" . htmlspecialchars($userRow['full_name']) . "</strong>,<br/><br/>" .
                                    "Bạn đã được nhắc tên bởi <strong>" . htmlspecialchars($auth['full_name']) . "</strong> trong một bình luận của chiến dịch <strong>" . htmlspecialchars($campaignName) . "</strong>.<br/>" .
                                    "Nội dung:<br/>" .
                                    "<blockquote style='border-left: 4px solid #eab308; padding-left: 12px; margin: 12px 0; color: #475569;'>" . nl2br(htmlspecialchars($body)) . "</blockquote>" .
                                    "Vui lòng truy cập hệ thống để biết thêm chi tiết.";
                    sendEmailNotification($userRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                }
            }
        }

        respond(200, ['id' => $newId], 'Thêm bình luận thành công');
    }

    public function getStats(array $auth, int $campaignId): void {
        $this->requireCampaignAccess($auth, $campaignId);
        
        // Fetch campaign details to get name
        $stmtC = $this->db->prepare("SELECT name FROM marketing_campaigns WHERE id = ?");
        $stmtC->execute([$campaignId]);
        $campName = $stmtC->fetchColumn();
        if (!$campName) {
            respond(404, null, 'Chiến dịch không tồn tại', false);
        }
        
        $campaignIdStr = (string)$campaignId;
        
        // Count total leads in leads table + manually linked contacts
        $stmtLeads = $this->db->prepare("
            SELECT (
                SELECT COUNT(*) 
                FROM leads 
                WHERE (campaign_id = ? OR campaign_name = ?)
            ) + (
                SELECT COUNT(*) 
                FROM contacts 
                WHERE campaign_id = ? 
                  AND (person_id IS NULL OR person_id NOT IN (
                      SELECT person_id FROM leads WHERE (campaign_id = ? OR campaign_name = ?) AND person_id IS NOT NULL
                  ))
            )
        ");
        $stmtLeads->execute([$campaignIdStr, $campName, $campaignId, $campaignIdStr, $campName]);
        $totalLeads = (int)$stmtLeads->fetchColumn();
        
        // Converted leads (leads that have a contact record)
        $stmtConverted = $this->db->prepare("
            SELECT COUNT(DISTINCT c.id) 
            FROM contacts c
            LEFT JOIN leads l ON c.person_id = l.person_id
            WHERE (l.campaign_id = ? OR l.campaign_name = ? OR c.campaign_id = ?)
              AND c.deleted_at IS NULL
        ");
        $stmtConverted->execute([$campaignIdStr, $campName, $campaignId]);
        $convertedLeads = (int)$stmtConverted->fetchColumn();
        
        // Conversion rate
        $conversionRate = $totalLeads > 0 ? round(($convertedLeads / $totalLeads) * 100, 1) : 0.0;
        
        // Won deals from this campaign
        $resWon = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
        $wonStatus = $resWon ? $resWon->fetchColumn() : 'dong_deal';
        if (!$wonStatus) {
            $wonStatus = 'dong_deal';
        }

        $stmtWon = $this->db->prepare("
            SELECT COUNT(DISTINCT c.id) 
            FROM contacts c
            LEFT JOIN leads l ON c.person_id = l.person_id
            WHERE (l.campaign_id = ? OR l.campaign_name = ? OR c.campaign_id = ?)
              AND c.pipeline_status = ?
              AND c.deleted_at IS NULL
        ");
        $stmtWon->execute([$campaignIdStr, $campName, $campaignId, $wonStatus]);
        $wonDeals = (int)$stmtWon->fetchColumn();
        
        // Actual revenue from paid invoices of contacts from this campaign
        $stmtRev = $this->db->prepare("
            SELECT COALESCE(SUM(inv.total), 0)
            FROM invoices inv
            JOIN contacts c ON inv.contact_id = c.id
            LEFT JOIN leads l ON c.person_id = l.person_id
            WHERE (l.campaign_id = ? OR l.campaign_name = ? OR c.campaign_id = ?)
              AND inv.status = 'paid'
              AND inv.deleted_at IS NULL
              AND c.deleted_at IS NULL
        ");
        $stmtRev->execute([$campaignIdStr, $campName, $campaignId]);
        $actualRevenue = (float)$stmtRev->fetchColumn();
        
        // Audit changelog trail: last 100 actions
        $stmtLogs = $this->db->prepare("
            SELECT a.id, a.action, a.new_data, a.created_at, u.full_name as user_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.resource = 'marketing_campaigns' AND a.resource_id = ? AND a.tenant_id = ?
            ORDER BY a.created_at DESC
            LIMIT 100
        ");
        $stmtLogs->execute([$campaignId, $auth['tenant_id']]);
        $logs = $stmtLogs->fetchAll(PDO::FETCH_ASSOC) ?: [];
        
        respond(200, [
            'total_leads' => $totalLeads,
            'converted_leads' => $convertedLeads,
            'conversion_rate' => $conversionRate,
            'won_deals' => $wonDeals,
            'actual_revenue' => $actualRevenue,
            'logs' => $logs
        ], 'Lấy thống kê chiến dịch thành công');
    }

    public function deleteComment(array $auth, int $commentId): void {
        $stmt = $this->db->prepare("SELECT * FROM comments WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$commentId, $auth['tenant_id']]);
        $comment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$comment) {
            respond(404, null, 'Bình luận không tồn tại', false);
        }

        $userRole = strtolower($auth['role'] ?? '');
        $isAdmin = in_array($userRole, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isOwner = (int)$comment['user_id'] === (int)$auth['user_id'];

        if (!$isAdmin && !$isOwner) {
            respond(403, null, 'Bạn không có quyền xóa bình luận này', false);
        }

        // Fetch all comments to be deleted (target comment + child replies) to clean up files
        $fetchStmt = $this->db->prepare("SELECT attachments, body FROM comments WHERE (id = ? OR parent_id = ?) AND tenant_id = ?");
        $fetchStmt->execute([$commentId, $commentId, $auth['tenant_id']]);
        $commentsToDelete = $fetchStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($commentsToDelete as $c) {
            if (!empty($c['attachments'])) deleteAttachmentFiles($c['attachments']);
            if (!empty($c['body'])) deleteAttachmentFiles($c['body']);
        }

        $delStmt = $this->db->prepare("DELETE FROM comments WHERE (id = ? OR parent_id = ?) AND tenant_id = ?");
        $delStmt->execute([$commentId, $commentId, $auth['tenant_id']]);

        respond(200, null, 'Xóa bình luận thành công');
    }
}
