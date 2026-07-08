<?php
class ActivityController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    private function hasAccess(array $auth, array $activity): bool {
        if (in_array($auth['role'], ['super_admin', 'admin', 'superadmin', 'director'], true)) {
            return true;
        }
        
        // 1. Check Creator/Assignee
        if ((int)$activity['user_id'] === (int)$auth['user_id']) {
            return true;
        }
        
        // 2. Check Approver
        if (isset($activity['approver_id']) && (int)$activity['approver_id'] === (int)$auth['user_id']) {
            return true;
        }
        
        // 3. Check Participant
        if (isset($activity['participant_ids'])) {
            $pIds = array_filter(array_map('intval', explode(',', $activity['participant_ids'])));
            if (in_array((int)$auth['user_id'], $pIds, true)) {
                return true;
            }
        }
        
        // 4. Check related entity ownership (Contact, Company, Deal)
        if (!empty($activity['related_type']) && !empty($activity['related_id'])) {
            $table = $activity['related_type'] === 'contact' ? 'contacts' : ($activity['related_type'] === 'company' ? 'companies' : 'deals');
            
            if (in_array($auth['role'], ['sales', 'sale'], true)) {
                $checkOwner = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=? AND owner_id=?");
                $checkOwner->execute([(int)$activity['related_id'], $auth['tenant_id'], $auth['user_id']]);
                if ($checkOwner->fetch()) {
                    return true;
                }
            } elseif ($auth['role'] === 'manager') {
                $checkOwner = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=? AND (owner_id=? OR owner_id IN (
                    SELECT id FROM users WHERE team_id IN (
                        SELECT id FROM teams WHERE leader_id = ?
                    )
                ))");
                $checkOwner->execute([(int)$activity['related_id'], $auth['tenant_id'], $auth['user_id'], $auth['user_id']]);
                if ($checkOwner->fetch()) {
                    return true;
                }
            }
        }
        
        // 5. Team-based tags check
        if (!empty($activity['tags']) && strpos($activity['tags'], 'internal_') === 0) {
            if (in_array($auth['role'], ['sales', 'sale'], true)) {
                $stmtTeamCheck = $this->db->prepare("
                    SELECT 1 FROM users u 
                    WHERE u.id = ? 
                      AND (u.team_id = (SELECT team_id FROM users WHERE id = ?) 
                           OR ? LIKE '%\"scope\":\"global\"%')
                ");
                $stmtTeamCheck->execute([$activity['user_id'], $auth['user_id'], $activity['body']]);
                if ($stmtTeamCheck->fetch()) {
                    return true;
                }
            } elseif ($auth['role'] === 'manager') {
                $stmtTeamCheck = $this->db->prepare("
                    SELECT 1 FROM users u 
                    WHERE u.id = ? 
                      AND (u.team_id IN (SELECT id FROM teams WHERE leader_id = ?) 
                           OR ? LIKE '%\"scope\":\"global\"%')
                ");
                $stmtTeamCheck->execute([$activity['user_id'], $auth['user_id'], $activity['body']]);
                if ($stmtTeamCheck->fetch()) {
                    return true;
                }
            }
        }
        
        // 6. Check if target user belongs to manager's team
        if ($auth['role'] === 'manager') {
            $stmtMgrTeam = $this->db->prepare("
                SELECT 1 FROM users WHERE id = ? AND team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                )
            ");
            $stmtMgrTeam->execute([$activity['user_id'], $auth['user_id']]);
            if ($stmtMgrTeam->fetch()) {
                return true;
            }
        }

        return false;
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];
        $page = max(1,(int)($_GET['page']??1));
        $limit = min(100,max(10,(int)($_GET['limit']??20)));
        $offset = ($page-1)*$limit;
        $type = $_GET['type']??''; $status = $_GET['status']??''; $uid = $_GET['user_id']??'';
        $teamId = $_GET['team_id']??'';
        $relType = $_GET['related_type']??''; $relId = $_GET['related_id']??'';
        $search = $_GET['search'] ?? '';
        $start = $_GET['start_date'] ?? '';
        $end   = $_GET['end_date'] ?? '';
        
        $sortBy = $_GET['sort']  ?? 'due_date';
        $order  = $_GET['order'] ?? 'ASC';

        // Validating sort fields to prevent SQL Injection
        $allowedSort = ['due_date', 'created_at', 'updated_at', 'status', 'priority', 'type'];
        if (!in_array($sortBy, $allowedSort)) $sortBy = 'due_date';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'])) $order = 'ASC';

        $where=['a.tenant_id=?', 'a.deleted_at IS NULL']; $params=[$tid];

        if ($search) {
            $where[] = '(a.subject LIKE ? OR a.description LIKE ?)';
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($start) { $where[] = 'a.due_date >= ?'; $params[] = $start; }
        if ($end)   { $where[] = 'a.due_date <= ?'; $params[] = $end; }

        // Validating sort fields
        $allowedSort = ['created_at', 'due_date', 'priority', 'status'];
        if (!in_array($sortBy, $allowedSort)) $sortBy = 'due_date';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'])) $order = 'ASC';

        if (in_array($auth['role'], ['sales', 'sale'], true) && !$relType && !$relId) {
            $where[] = '(
                a.user_id = ? 
                OR a.approver_id = ?
                OR FIND_IN_SET(?, a.participant_ids)
                OR (a.related_type = \'contact\' AND EXISTS (SELECT 1 FROM contacts ct WHERE ct.id = a.related_id AND ct.owner_id = ?)) 
                OR (a.related_type = \'deal\' AND EXISTS (SELECT 1 FROM deals d LEFT JOIN contacts ct ON d.contact_id = ct.id WHERE d.id = a.related_id AND (d.owner_id = ? OR ct.owner_id = ?)))
                OR (a.tags LIKE \'internal_%\' AND (a.user_id IN (SELECT id FROM users WHERE team_id = (SELECT team_id FROM users WHERE id = ?)) OR a.body LIKE \'%"scope":"global"%\'))
            )';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($auth['role'] === 'manager' && !$relType && !$relId) {
            $where[] = '(
                a.user_id = ? 
                OR a.approver_id = ?
                OR FIND_IN_SET(?, a.participant_ids)
                OR a.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?))
                OR (a.related_type = \'contact\' AND EXISTS (
                    SELECT 1 FROM contacts ct WHERE ct.id = a.related_id AND (ct.owner_id = ? OR ct.owner_id IN (
                        SELECT id FROM users WHERE team_id IN (
                            SELECT id FROM teams WHERE leader_id = ?
                        )
                    ))
                )) 
                OR (a.related_type = \'deal\' AND EXISTS (
                    SELECT 1 FROM deals d LEFT JOIN contacts ct ON d.contact_id = ct.id WHERE d.id = a.related_id AND (
                        d.owner_id = ? OR ct.owner_id = ? OR d.owner_id IN (
                            SELECT id FROM users WHERE team_id IN (
                                SELECT id FROM teams WHERE leader_id = ?
                            )
                        ) OR ct.owner_id IN (
                            SELECT id FROM users WHERE team_id IN (
                                SELECT id FROM teams WHERE leader_id = ?
                            )
                        )
                    )
                ))
                OR (a.tags LIKE \'internal_%\' AND (a.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)) OR a.body LIKE \'%"scope":"global"%\'))
            )';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }
        if ($type)     { $where[]='a.type=?';    $params[]=$type; }
        if ($status)   { $where[]='a.status=?';  $params[]=$status; }
        if ($uid)      { $where[]='a.user_id=?'; $params[]=(int)$uid; }
        if ($teamId)   { $where[]='a.user_id IN (SELECT id FROM users WHERE team_id = ?)'; $params[]=(int)$teamId; }
        if ($relType)  { $where[]='a.related_type=?'; $params[]=$relType; }
        if ($relId)    { $where[]='a.related_id=?';   $params[]=(int)$relId; }
        $priority = $_GET['priority'] ?? '';
        if ($priority) { $where[]='a.priority=?'; $params[]=$priority; }
        $w=implode(' AND ',$where);

        $cnt=$this->db->prepare("SELECT COUNT(*) FROM activities a WHERE $w");
        $cnt->execute($params); $total=(int)$cnt->fetchColumn();

        $stmt=$this->db->prepare("
            SELECT a.*, u.full_name as user_name, u.avatar_url,
                   COALESCE(CONCAT(ct.first_name,' ',ct.last_name), CONCAT(deal_ct.first_name,' ',deal_ct.last_name)) as contact_name,
                   COALESCE(ct.id, deal_ct.id) as contact_id,
                   COALESCE(ct.avatar_url, deal_ct.avatar_url) as contact_avatar,
                   d.title as deal_name,
                   c.name as company_name,
                   p.name as project_name,
                   camp.name as campaign_name,
                   t.name as team_name,
                   (SELECT COUNT(*) FROM activity_comments ac WHERE ac.activity_id = a.id) as comment_count,
                   (SELECT e.image_url FROM expenses e WHERE e.tenant_id = a.tenant_id AND e.title = REPLACE(a.subject, 'Ghi nhận Chi phí: ', '') AND e.image_url IS NOT NULL AND e.image_url != '' ORDER BY e.id DESC LIMIT 1) as expense_image_url
            FROM activities a 
            LEFT JOIN users u ON a.user_id=u.id
            LEFT JOIN contacts ct ON a.related_type='contact' AND a.related_id=ct.id AND ct.deleted_at IS NULL
            LEFT JOIN deals d ON a.related_type='deal' AND a.related_id=d.id AND d.deleted_at IS NULL
            LEFT JOIN contacts deal_ct ON a.related_type='deal' AND d.contact_id=deal_ct.id AND deal_ct.deleted_at IS NULL
            LEFT JOIN companies c ON a.related_type='company' AND a.related_id=c.id AND c.deleted_at IS NULL
            LEFT JOIN projects p ON a.related_type='project' AND a.related_id=p.id
            LEFT JOIN marketing_campaigns camp ON a.related_type='campaign' AND a.related_id=camp.id
            LEFT JOIN teams t ON a.related_type='team' AND a.related_id=t.id
            WHERE $w ORDER BY a.$sortBy $order
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        respond(200,['items'=>$stmt->fetchAll(),'total'=>$total,'page'=>$page,'limit'=>$limit]);
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thêm mới', false);
        $b=getBody();
        if (empty($b['subject'])||empty($b['type'])) respond(422,null,'Tiêu đề và loại là bắt buộc',false);
        
        // Verify related entity if provided
        $allowedRelTypes = ['contact', 'company', 'deal', 'project', 'campaign', 'team'];
        if (!empty($b['related_type']) && !empty($b['related_id'])) {
            if (in_array($b['related_type'], $allowedRelTypes)) {
                $table = $b['related_type'] === 'contact' ? 'contacts' : (
                    $b['related_type'] === 'company' ? 'companies' : (
                        $b['related_type'] === 'deal' ? 'deals' : (
                            $b['related_type'] === 'project' ? 'projects' : (
                                $b['related_type'] === 'campaign' ? 'marketing_campaigns' : 'teams'
                            )
                        )
                    )
                );
                $check = $this->db->prepare("SELECT id FROM $table WHERE id=?");
                // Note: teams doesn't have tenant_id in some schemas, but projects/campaigns do. So we do simple select.
                $check->execute([(int)$b['related_id']]);
                if (!$check->fetch()) {
                    $b['related_type'] = null; $b['related_id'] = null; // Reset if unauthorized
                }
            } else {
                $b['related_type'] = null; $b['related_id'] = null; // Reset if type not allowed
            }
        }

        $targetUserId = $b['user_id'] ?? $auth['user_id'];
        if ($auth['role'] === 'sales' && (int)$targetUserId !== (int)$auth['user_id']) {
            $targetUserId = $auth['user_id']; // Force self for sales role
        }
        
        $due_date = empty($b['due_date']) ? null : $b['due_date'];
        $status = $b['status'] ?? 'planned';
        $done_at = null;
        if ($status === 'done') {
            $done_at = empty($b['done_at']) ? date('Y-m-d H:i:s') : $b['done_at'];
        }

        $this->db->prepare("
            INSERT INTO activities (tenant_id,user_id,type,subject,body,status,priority,due_date,done_at,related_type,related_id,tags,participant_ids,progress,require_approval,approver_id,approval_status,link)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ")->execute([
            $auth['tenant_id'], $targetUserId, $b['type'],
            $b['subject'], $b['body']??null, $status, $b['priority']??'medium',
            $due_date, $done_at, $b['related_type']??null, $b['related_id']??null,
            $b['tags']??null, $b['participant_ids']??null,
            (int)($b['progress']??0), (int)($b['require_approval']??0),
            empty($b['approver_id']) ? null : (int)$b['approver_id'],
            $b['approval_status']??null,
            $b['link']??null
        ]);
        $actId = (int)$this->db->lastInsertId();

        // Update contact's last_contact whenever an activity is created
        if (!empty($b['related_id'])) {
            if (($b['related_type'] ?? '') === 'contact') {
                $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = ? AND tenant_id = ?")
                     ->execute([(int)$b['related_id'], $auth['tenant_id']]);
            } else if (($b['related_type'] ?? '') === 'deal') {
                $sDeal = $this->db->prepare("SELECT contact_id FROM deals WHERE id = ? AND tenant_id = ?");
                $sDeal->execute([(int)$b['related_id'], $auth['tenant_id']]);
                $cid = $sDeal->fetchColumn();
                if ($cid) {
                    $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = ? AND tenant_id = ?")
                         ->execute([(int)$cid, $auth['tenant_id']]);
                }
            }
        }

        // Maintain quyen_truy_cap audit log for Cooperation Slips
        if (!empty($b['related_type']) && $b['related_type'] === 'contact' && !empty($b['related_id'])) {
            $stmtOwner = $this->db->prepare("SELECT owner_id FROM contacts WHERE id = ?");
            $stmtOwner->execute([(int)$b['related_id']]);
            $ownerId = $stmtOwner->fetchColumn();
            if ($ownerId && $ownerId != $auth['user_id']) {
                $stmtCheck = $this->db->prepare("SELECT id FROM quyen_truy_cap WHERE contact_id = ? AND user_id = ?");
                $stmtCheck->execute([(int)$b['related_id'], $auth['user_id']]);
                if (!$stmtCheck->fetch()) {
                    $stmtInsQ = $this->db->prepare("INSERT INTO quyen_truy_cap (contact_id, user_id, invited_by) VALUES (?, ?, ?)");
                    $stmtInsQ->execute([(int)$b['related_id'], $auth['user_id'], $ownerId]);
                }
            }
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'activity', $actId, json_encode(['subject' => $b['subject'], 'type' => $b['type']]));

        // Task notifications on creation
        if ((int)$targetUserId !== (int)$auth['user_id']) {
            $this->notifyUser(
                (int)$targetUserId,
                'Bạn có nhiệm vụ mới được giao',
                'Bạn được giao nhiệm vụ mới: "' . $b['subject'] . '" bởi ' . $auth['full_name'] . '.',
                'task_assignment',
                "/activities/{$actId}"
            );
        }
        if ((int)($b['require_approval']??0) === 1 && (int)($b['progress']??0) === 100 && !empty($b['approver_id'])) {
            $this->notifyUser(
                (int)$b['approver_id'],
                'Yêu cầu phê duyệt hoàn thành công việc',
                $auth['full_name'] . ' đã hoàn thành công việc "' . $b['subject'] . '" và đang chờ bạn phê duyệt.',
                'approval_request',
                "/activities/{$actId}"
            );
        }
        if (!empty($b['participant_ids'])) {
            $pIds = array_filter(array_map('intval', explode(',', $b['participant_ids'])));
            foreach ($pIds as $pId) {
                if ($pId === (int)$auth['user_id']) continue;
                $this->notifyUser(
                    $pId,
                    'Bạn được thêm vào danh sách người liên quan',
                    $auth['full_name'] . ' đã thêm bạn làm người liên quan trong công việc "' . $b['subject'] . '".',
                    'task_participant',
                    "/activities/{$actId}"
                );
            }
        }

        if (!empty($b['auto_trigger'])) {
            $this->triggerAutomationWorkflow($auth, $b);
        }

        $this->show($auth,$actId);
    }

    public function show(array $auth,int $id): void {
        $stmt=$this->db->prepare("
            SELECT a.*, u.full_name as user_name,
                   COALESCE(CONCAT(ct.first_name,' ',ct.last_name), CONCAT(deal_ct.first_name,' ',deal_ct.last_name)) as contact_name,
                   COALESCE(ct.id, deal_ct.id) as contact_id,
                   COALESCE(ct.avatar_url, deal_ct.avatar_url) as contact_avatar,
                   d.title as deal_name,
                   c.name as company_name
            FROM activities a 
            LEFT JOIN users u ON a.user_id=u.id
            LEFT JOIN contacts ct ON a.related_type='contact' AND a.related_id=ct.id AND ct.deleted_at IS NULL
            LEFT JOIN deals d ON a.related_type='deal' AND a.related_id=d.id AND d.deleted_at IS NULL
            LEFT JOIN contacts deal_ct ON a.related_type='deal' AND d.contact_id=deal_ct.id AND deal_ct.deleted_at IS NULL
            LEFT JOIN companies c ON a.related_type='company' AND a.related_id=c.id AND c.deleted_at IS NULL
            WHERE a.id=? AND a.tenant_id=? AND a.deleted_at IS NULL
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $row=$stmt->fetch(); if(!$row) respond(404,null,'Không tìm thấy',false);

        // Access check for sales/manager role
        if (!$this->hasAccess($auth, $row)) {
            respond(403, null, 'Bạn không có quyền truy cập hoạt động này', false);
        }

        respond(200,$row);
    }

    public function update(array $auth,int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật', false);
        $b=getBody();

        // Load activity first to verify permission and current state
        $check = $this->db->prepare("SELECT * FROM activities WHERE id=? AND tenant_id=? AND deleted_at IS NULL");
        $check->execute([$id, $auth['tenant_id']]);
        $activity = $check->fetch();
        if (!$activity) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

        // Permissions check
        if (!$this->hasAccess($auth, $activity)) {
            respond(403, null, 'Bạn không có quyền cập nhật hoạt động này', false);
        }

        // Block non-approvers and non-admins from approving or rejecting tasks
        if (isset($b['approval_status']) && $b['approval_status'] !== $activity['approval_status']) {
            $isApprover = $activity['approver_id'] && (int)$auth['user_id'] === (int)$activity['approver_id'];
            $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director', 'manager'], true);
            $isClearingOrSubmitting = in_array($b['approval_status'], ['pending', null, ''], true) || ($b['approval_status'] === 'rejected' && $isAdmin); // Allow rejection for admin
            
            if (!$isApprover && !$isAdmin && !$isClearingOrSubmitting) {
                respond(403, null, 'Bạn không có quyền phê duyệt hoặc từ chối công việc này', false);
            }
        }

        // Validate approver_id: Sale can only select admin, super_admin, superadmin, director OR their own team manager
        $approver_id = isset($b['approver_id']) ? (empty($b['approver_id']) ? null : (int)$b['approver_id']) : (empty($activity['approver_id']) ? null : (int)$activity['approver_id']);
        if ($approver_id && isset($b['approver_id']) && (int)$b['approver_id'] !== (int)$activity['approver_id'] && (in_array($auth['role'], ['sales', 'sale'], true))) {
            $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
            $stmtUserTeam->execute([$auth['user_id']]);
            $saleTeamId = $stmtUserTeam->fetchColumn();

            $stmtAppr = $this->db->prepare("SELECT role, team_id FROM users WHERE id = ? AND tenant_id = ?");
            $stmtAppr->execute([$approver_id, $auth['tenant_id']]);
            $apprRow = $stmtAppr->fetch(PDO::FETCH_ASSOC);

            if (!$apprRow) {
                respond(422, null, 'Người phê duyệt không hợp lệ', false);
            }

            $apprRole = strtolower($apprRow['role'] ?? '');
            $isAllowedRole = in_array($apprRole, ['admin', 'superadmin', 'super_admin', 'director'], true);
            $isOwnManager = ($apprRole === 'manager' && $apprRow['team_id'] && (int)$apprRow['team_id'] === (int)$saleTeamId);

            if (!$isAllowedRole && !$isOwnManager) {
                respond(403, null, 'Người phê duyệt phải là Admin hoặc Quản lý của bạn', false);
            }
        }

        // Auto set done_at if status changes to done, or clear it if changed to something else
        if (isset($b['status'])) {
            if ($b['status'] === 'done' && empty($b['done_at'])) {
                $b['done_at'] = date('Y-m-d H:i:s');
            } elseif ($b['status'] !== 'done') {
                $b['done_at'] = null;
            }
        }

        // Apply progress/approval completion rule:
        $currentProgress = isset($b['progress']) ? (int)$b['progress'] : (int)$activity['progress'];
        $currentReqApproval = isset($b['require_approval']) ? (int)$b['require_approval'] : (int)$activity['require_approval'];
        $currentStatus = isset($b['status']) ? $b['status'] : $activity['status'];
        $nextApprovalStatus = isset($b['approval_status']) ? $b['approval_status'] : ($activity['approval_status'] ?? '');

        // If status explicitly updated to done but progress < 100, auto-set progress to 100
        if (isset($b['status']) && $b['status'] === 'done' && $currentProgress < 100) {
            $b['progress'] = 100;
            $currentProgress = 100;
        }

        if ($currentProgress === 100) {
            if ($currentReqApproval === 1) {
                // If approval is required, task is ONLY done if approved
                if ($nextApprovalStatus !== 'approved') {
                    $b['status'] = 'planned'; // Force status to not be done
                    if ($nextApprovalStatus !== 'pending' && $nextApprovalStatus !== 'rejected') {
                        $b['approval_status'] = 'pending';
                    }
                } else {
                    $b['status'] = 'done';
                }
            } else {
                // No approval required, automatically complete
                $b['status'] = 'done';
                $b['approval_status'] = null;
            }
        } else {
            // Progress < 100
            if ($nextApprovalStatus !== 'rejected') {
                $b['approval_status'] = null;
            }
            if ($currentStatus === 'done') {
                $b['status'] = 'planned';
            }
        }

        // Auto set done_at based on final resolved status
        if (isset($b['status'])) {
            if ($b['status'] === 'done' && empty($b['done_at'])) {
                $b['done_at'] = date('Y-m-d H:i:s');
            } elseif ($b['status'] !== 'done') {
                $b['done_at'] = null;
            }
        }

        // Verify related entity if changed
        $allowedRelTypes = ['contact', 'company', 'deal', 'project', 'campaign', 'team'];
        if (!empty($b['related_type']) && !empty($b['related_id'])) {
            if (in_array($b['related_type'], $allowedRelTypes)) {
                $table = $b['related_type'] === 'contact' ? 'contacts' : (
                    $b['related_type'] === 'company' ? 'companies' : (
                        $b['related_type'] === 'deal' ? 'deals' : (
                            $b['related_type'] === 'project' ? 'projects' : (
                                $b['related_type'] === 'campaign' ? 'marketing_campaigns' : 'teams'
                            )
                        )
                    )
                );
                $checkRel = $this->db->prepare("SELECT id FROM $table WHERE id=?");
                $checkRel->execute([(int)$b['related_id']]);
                if (!$checkRel->fetch()) {
                    $b['related_type'] = null; $b['related_id'] = null;
                }
            } else {
                $b['related_type'] = null; $b['related_id'] = null;
            }
        }

        $fields=['user_id','type','subject','body','status','priority','due_date','done_at','related_type','related_id','tags','participant_ids','progress','require_approval','approver_id','approval_status','link'];
        $sets=[];$params=[];
        foreach($fields as $f){
            if(array_key_exists($f,$b)){
                $sets[]="$f=?";
                if (in_array($f, ['due_date', 'done_at']) && $b[$f] === '') {
                    $params[] = null;
                } else {
                    $params[]=$b[$f];
                }
            }
        }
        if(!$sets) respond(422,null,'Không có dữ liệu',false);

        // Calculate edit history (cap at 3)
        $history = json_decode($activity['edit_history'] ?? '[]', true);
        if (!is_array($history)) {
            $history = [];
        }

        $editRecord = [
            'edited_by' => $auth['user_id'],
            'edited_by_name' => $auth['username'] ?? ($auth['full_name'] ?? 'User'),
            'edited_at' => date('Y-m-d H:i:s'),
            'old_subject' => $activity['subject'],
            'old_body' => $activity['body']
        ];
        array_unshift($history, $editRecord);
        $history = array_slice($history, 0, 3);

        $sets[] = "edit_history=?";
        $params[] = json_encode($history);

        $params[]=$id;$params[]=$auth['tenant_id'];
        $stmt = $this->db->prepare("UPDATE activities SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?");
        $stmt->execute($params);

        // Update contact's last_contact whenever an activity is updated
        $checkRel = $this->db->prepare("SELECT related_type, related_id FROM activities WHERE id=?");
        $checkRel->execute([$id]);
        $rel = $checkRel->fetch();
        if ($rel && !empty($rel['related_id'])) {
            if ($rel['related_type'] === 'contact') {
                $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = ? AND tenant_id = ?")
                     ->execute([(int)$rel['related_id'], $auth['tenant_id']]);
            } else if ($rel['related_type'] === 'deal') {
                $sDeal = $this->db->prepare("SELECT contact_id FROM deals WHERE id = ? AND tenant_id = ?");
                $sDeal->execute([(int)$rel['related_id'], $auth['tenant_id']]);
                $cid = $sDeal->fetchColumn();
                if ($cid) {
                    $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = ? AND tenant_id = ?")
                         ->execute([(int)$cid, $auth['tenant_id']]);
                }
            }
        }

        // Send notifications for updates
        if (isset($b['user_id']) && (int)$b['user_id'] !== (int)$activity['user_id'] && (int)$b['user_id'] !== (int)$auth['user_id']) {
            $this->notifyUser(
                (int)$b['user_id'],
                'Bạn có nhiệm vụ mới được giao',
                'Nhiệm vụ "' . $activity['subject'] . '" đã được chuyển giao cho bạn bởi ' . $auth['full_name'] . '.',
                'task_assignment',
                "/activities/{$id}"
            );
        }

        $currentProgress = isset($b['progress']) ? (int)$b['progress'] : (int)$activity['progress'];
        $currentReqApproval = isset($b['require_approval']) ? (int)$b['require_approval'] : (int)$activity['require_approval'];
        $currentApprover = isset($b['approver_id']) ? (int)$b['approver_id'] : (int)$activity['approver_id'];

        if ($currentProgress === 100 && $currentReqApproval === 1 && $currentApprover) {
            if ((int)$activity['progress'] < 100 || (isset($b['approver_id']) && (int)$b['approver_id'] !== (int)$activity['approver_id']) || (isset($b['approval_status']) && $b['approval_status'] === 'pending' && $activity['approval_status'] !== 'pending')) {
                $this->notifyUser(
                    $currentApprover,
                    'Yêu cầu phê duyệt hoàn thành công việc',
                    $auth['full_name'] . ' đã hoàn thành công việc "' . $activity['subject'] . '" và đang chờ bạn phê duyệt.',
                    'approval_request',
                    "/activities/{$id}"
                );
            }
        }

        if (isset($b['approval_status']) && $b['approval_status'] !== $activity['approval_status']) {
            $assignee = isset($b['user_id']) ? (int)$b['user_id'] : (int)$activity['user_id'];
            if ($b['approval_status'] === 'approved') {
                $this->notifyUser(
                    $assignee,
                    'Nhiệm vụ được phê duyệt hoàn thành',
                    'Công việc "' . $activity['subject'] . '" của bạn đã được phê duyệt hoàn thành bởi ' . $auth['full_name'] . '.',
                    'approval_status',
                    "/activities/{$id}"
                );
            } elseif ($b['approval_status'] === 'rejected') {
                $this->notifyUser(
                    $assignee,
                    'Yêu cầu hoàn thành nhiệm vụ bị từ chối',
                    'Yêu cầu hoàn thành công việc "' . $activity['subject'] . '" của bạn đã bị từ chối bởi ' . $auth['full_name'] . '.',
                    'approval_status',
                    "/activities/{$id}"
                );
            }
        }

        if (isset($b['participant_ids']) && $b['participant_ids'] !== $activity['participant_ids']) {
            $oldP = array_filter(array_map('intval', explode(',', $activity['participant_ids'] ?? '')));
            $newP = array_filter(array_map('intval', explode(',', $b['participant_ids'] ?? '')));
            $addedP = array_diff($newP, $oldP);
            foreach ($addedP as $pId) {
                if ($pId === (int)$auth['user_id']) continue;
                $this->notifyUser(
                    $pId,
                    'Bạn được thêm vào danh sách người liên quan',
                    $auth['full_name'] . ' đã thêm bạn làm người liên quan trong công việc "' . $activity['subject'] . '".',
                    'task_participant',
                    "/activities/{$id}"
                );
            }
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'activity', $id, json_encode($b));

        $this->show($auth,$id);
    }

    public function getComments(array $auth, int $id): void {
        // Verify activity belongs to tenant and user has permission
        $check = $this->db->prepare("SELECT * FROM activities WHERE id=? AND tenant_id=? AND deleted_at IS NULL");
        $check->execute([$id, $auth['tenant_id']]);
        $activity = $check->fetch();
        if (!$activity) respond(404, null, 'Không tìm thấy hoạt động hoặc không có quyền truy cập', false);

        if (!$this->hasAccess($auth, $activity)) {
            respond(403, null, 'Bạn không có quyền truy cập hoạt động này', false);
        }

        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM activity_comments c 
            LEFT JOIN users u ON c.user_id = u.id 
            WHERE c.activity_id = ? AND c.tenant_id = ? 
            ORDER BY c.created_at ASC
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        
        $comments = array_map(function($row) {
            $row['attachments'] = $row['attachments'] ? json_decode($row['attachments'], true) : [];
            return $row;
        }, $stmt->fetchAll(PDO::FETCH_ASSOC));

        respond(200, $comments);
    }

    public function addComment(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền bình luận', false);
        // Verify activity belongs to tenant and user has permission
        $check = $this->db->prepare("SELECT * FROM activities WHERE id=? AND tenant_id=? AND deleted_at IS NULL");
        $check->execute([$id, $auth['tenant_id']]);
        $activity = $check->fetch();
        if (!$activity) respond(404, null, 'Không tìm thấy hoạt động hoặc không có quyền truy cập', false);

        if (!$this->hasAccess($auth, $activity)) {
            respond(403, null, 'Bạn không có quyền bình luận cho hoạt động này', false);
        }

        $b = getBody();
        if (empty($b['content']) && empty($b['attachments'])) {
            respond(422, null, 'Nội dung hoặc đính kèm không được để trống', false);
        }

        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments']) : null;

        $stmt = $this->db->prepare("
            INSERT INTO activity_comments (tenant_id, activity_id, user_id, content, attachments)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $auth['tenant_id'],
            $id,
            $auth['user_id'],
            $b['content'] ?? null,
            $attachments
        ]);

        $commentId = $this->db->lastInsertId();

        // Parse mentions in comment content
        $content = $b['content'] ?? '';
        $mentions = [];
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()]+)/u', $content, $matches);
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

        if (!empty($mentions)) {
            require_once __DIR__ . '/../mailer.php';
            $notif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?,?,?,?,?,?)");
            foreach ($mentions as $uid => $userRow) {
                $notif->execute([
                    $uid, $auth['tenant_id'],
                    'Bạn được nhắc tên trong bình luận',
                    $auth['full_name'] . ' đã nhắc tên bạn trong một bình luận hoạt động.',
                    'mention',
                    "/activities/{$id}"
                ]);

                if (!empty($userRow['email'])) {
                    $emailSubject = "[RICH LAND] Bạn được nhắc tên trong bình luận của " . $auth['full_name'];
                    $emailTitle = "NHẮC TÊN TRÊN HỆ THỐNG";
                    $emailContent = "Chào <strong>" . htmlspecialchars($userRow['full_name']) . "</strong>,<br/><br/>" .
                                    "Bạn đã được nhắc tên bởi <strong>" . htmlspecialchars($auth['full_name']) . "</strong> trong một bình luận của hoạt động.<br/>" .
                                    "Nội dung:<br/>" .
                                    "<blockquote style='border-left: 4px solid #eab308; padding-left: 12px; margin: 12px 0; color: #475569;'>" . nl2br(htmlspecialchars($content)) . "</blockquote>" .
                                    "Vui lòng truy cập hệ thống để biết thêm chi tiết.";
                    sendEmailNotification($userRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                }
            }
        }

        // Also notify the contact owner if they are not the one commenting or already mentioned
        if ($activity['related_type'] === 'contact' && $activity['related_id']) {
            $stmtOwner = $this->db->prepare("
                SELECT c.owner_id, u.email, u.full_name 
                FROM contacts c 
                JOIN users u ON c.owner_id = u.id 
                WHERE c.id = ? AND c.tenant_id = ?
            ");
            $stmtOwner->execute([(int)$activity['related_id'], $auth['tenant_id']]);
            $ownerRow = $stmtOwner->fetch(PDO::FETCH_ASSOC);
            if ($ownerRow) {
                $ownerUid = (int)$ownerRow['owner_id'];
                if ($ownerUid !== (int)$auth['user_id'] && !isset($mentions[$ownerUid])) {
                    // Send notification in database
                    $notif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?,?,?,?,?,?)");
                    $notif->execute([
                        $ownerUid, $auth['tenant_id'],
                        'Bình luận mới trên khách hàng của bạn',
                        $auth['full_name'] . ' đã bình luận trong một hoạt động thuộc khách hàng của bạn.',
                        'comment',
                        "/activities/{$id}"
                    ]);

                    if (!empty($ownerRow['email'])) {
                        require_once __DIR__ . '/../mailer.php';
                        $emailSubject = "[RICH LAND] Bình luận mới trên khách hàng của bạn bởi " . $auth['full_name'];
                        $emailTitle = "BÌNH LUẬN MỚI TRÊN KHÁCH HÀNG";
                        $emailContent = "Chào <strong>" . htmlspecialchars($ownerRow['full_name']) . "</strong>,<br/><br/>" .
                                        "Có bình luận mới từ <strong>" . htmlspecialchars($auth['full_name']) . "</strong> trên hoạt động thuộc khách hàng của bạn.<br/>" .
                                        "Nội dung bình luận:<br/>" .
                                        "<blockquote style='border-left: 4px solid #BD1D2D; padding-left: 12px; margin: 12px 0; color: #475569;'>" . nl2br(htmlspecialchars($content)) . "</blockquote>" .
                                        "Vui lòng truy cập hệ thống để biết thêm chi tiết.";
                        sendEmailNotification($ownerRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                    }
                }
            }
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'ADD_COMMENT', 'activity', $id);

        respond(200, ['id' => $commentId], 'Đã thêm bình luận');
    }

    public function destroy(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xóa hoạt động', false);
        $sql = "UPDATE activities SET deleted_at = NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $sql .= " AND user_id=?";
            $p[] = $auth['user_id'];
        } else if ($auth['role'] === 'manager') {
            $sql .= " AND (user_id = ? OR user_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                )
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        }
        $stmt=$this->db->prepare($sql);
        $stmt->execute($p);
        if(!$stmt->rowCount()) respond(404,null,'Không tìm thấy hoặc không có quyền',false);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'activity', $id);
        respond(200,null,'Đã xóa hoạt động');
    }

    public function deleteComment(array $auth, int $commentId): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xóa bình luận', false);

        // Fetch comment to check ownership and tenant isolation
        $stmt = $this->db->prepare("SELECT * FROM activity_comments WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$commentId, $auth['tenant_id']]);
        $comment = $stmt->fetch();

        if (!$comment) {
            respond(404, null, 'Không tìm thấy bình luận', false);
        }

        // Access check: Admin/Manager can delete any comment. Sales can only delete their own.
        if (in_array($auth['role'], ['sales', 'sale'], true) && (int)$comment['user_id'] !== (int)$auth['user_id']) {
            respond(403, null, 'Bạn không có quyền xóa bình luận của người khác', false);
        }

        // Delete physical attachments from disk if they exist
        if (!empty($comment['attachments'])) {
            $files = json_decode($comment['attachments'], true);
            if (is_array($files)) {
                $uploadDirBase = defined('UPLOAD_DIR') ? UPLOAD_DIR : (__DIR__ . '/../uploads');
                foreach ($files as $fileUrl) {
                    $filename = basename($fileUrl);
                    $filePath = $uploadDirBase . "/tenant_" . $auth['tenant_id'] . "/" . $filename;
                    if (file_exists($filePath) && is_file($filePath)) {
                        @unlink($filePath);
                    }
                }
            }
        }

        // Delete DB record
        $deleteStmt = $this->db->prepare("DELETE FROM activity_comments WHERE id = ? AND tenant_id = ?");
        $deleteStmt->execute([$commentId, $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_COMMENT', 'activity_comment', $commentId);
        respond(200, null, 'Đã xóa bình luận thành công');
    }



    private function triggerAutomationWorkflow(array $auth, array $b): void {
        $relType = $b['related_type'] ?? '';
        $relId = (int)($b['related_id'] ?? 0);
        if (!$relType || !$relId) return;

        $contactId = null;
        if ($relType === 'contact') {
            $contactId = $relId;
        } elseif ($relType === 'deal') {
            $stmt = $this->db->prepare("SELECT contact_id FROM deals WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$relId, $auth['tenant_id']]);
            $contactId = $stmt->fetchColumn() ?: null;
        }

        if ($contactId) {
            $stmtC = $this->db->prepare("SELECT email, first_name, last_name, lead_score, stage_id FROM contacts WHERE id = ? AND tenant_id = ?");
            $stmtC->execute([$contactId, $auth['tenant_id']]);
            $contact = $stmtC->fetch(PDO::FETCH_ASSOC);

            if ($contact) {
                if (!empty($contact['email'])) {
                    try {
                        require_once __DIR__ . '/../mailer.php';
                        $emailSubj = "[AUTOMATION] Cập nhật hoạt động: " . $b['subject'];
                        $emailBody = "<h3>Chào " . htmlspecialchars($contact['first_name'] . ' ' . ($contact['last_name'] ?? '')) . ",</h3>"
                                   . "<p>Hệ thống ghi nhận hoạt động mới: <strong>" . htmlspecialchars($b['subject']) . "</strong></p>"
                                   . "<p>Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.</p>";
                        sendEmailNotification($contact['email'], $emailSubj, 'Hệ thống tự động', $emailBody);
                    } catch (Throwable $e) {
                        error_log("Automation Email Error: " . $e->getMessage());
                    }
                }

                $newScore = (int)$contact['lead_score'] + 15;
                $this->db->prepare("UPDATE contacts SET lead_score = ? WHERE id = ?")
                     ->execute([$newScore, $contactId]);

                if ((int)$contact['stage_id'] === 1 || empty($contact['stage_id'])) {
                    $this->db->prepare("UPDATE contacts SET stage_id = 2, pipeline_status = 'quan_tam' WHERE id = ?")
                         ->execute([$contactId]);
                    
                    logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Cập nhật Pipeline', 'Tự động chuyển giai đoạn qua Automation Workflow', 'contact', $contactId);
                    logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'MOVE_STAGE', 'contact', $contactId, json_encode(['stage_id' => 2, 'pipeline_status' => 'quan_tam', 'note' => 'Automation Workflow']));
                }
            }
        }
    }

    private function notifyUser(int $userId, string $title, string $body, string $type, string $link): void {
        try {
            $stmtUser = $this->db->prepare("SELECT email, full_name FROM users WHERE id=?");
            $stmtUser->execute([$userId]);
            $u = $stmtUser->fetch(PDO::FETCH_ASSOC);
            if (!$u) return;

            // Fetch tenant_id
            $stmtTenant = $this->db->prepare("SELECT tenant_id FROM users WHERE id=?");
            $stmtTenant->execute([$userId]);
            $tenantId = $stmtTenant->fetchColumn() ?: 1;

            // Insert DB notification
            $notif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?,?,?,?,?,?)");
            $notif->execute([
                $userId,
                $tenantId,
                $title,
                $body,
                $type,
                $link
            ]);

            // Send Email
            if (!empty($u['email'])) {
                require_once __DIR__ . '/../mailer.php';
                $emailSubject = "[RICH LAND] " . $title;
                $emailTitle = mb_strtoupper($type, 'UTF-8');
                $emailContent = "Chào <strong>" . htmlspecialchars($u['full_name']) . "</strong>,<br/><br/>" .
                                htmlspecialchars($body) . "<br/><br/>" .
                                "Vui lòng truy cập hệ thống theo đường dẫn để xử lý công việc: <a href='" . htmlspecialchars($link) . "'>Xem chi tiết</a>";
                sendEmailNotification($u['email'], $emailSubject, $emailTitle, $emailContent, '', false);
            }
        } catch (Throwable $e) {
            error_log("Notification System Error: " . $e->getMessage());
        }
    }
}
