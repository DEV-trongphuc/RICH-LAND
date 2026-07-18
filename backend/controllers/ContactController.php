<?php
// f:\CRM\backend\controllers\ContactController.php

class ContactController {
    private PDO $db;
    public function __construct(PDO $db) { 
        $this->db = $db; 
        try {
            $this->db->exec("ALTER TABLE contacts ADD COLUMN not_lead_proposed TINYINT(1) DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE contacts ADD COLUMN not_lead_proposed_by INT(11) NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE contacts ADD COLUMN not_lead_proposed_at TIMESTAMP NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE contacts ADD COLUMN campaign_id INT(11) NULL");
        } catch (Exception $e) {}
    }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(2000, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $search  = $_GET['search'] ?? '';
        $status  = $_GET['status'] ?? '';
        $segment = $_GET['segment'] ?? 'all';
        if ($status === 'not_contacted') {
            $segment = 'not_contacted';
            $status = '';
        }
        $source  = $_GET['source'] ?? '';
        $owner   = $_GET['owner_id'] ?? '';
        $stage   = $_GET['stage_id'] ?? '';
        $companyId = $_GET['company_id'] ?? '';
        $projectId = $_GET['project_id'] ?? '';
        $campaignId = $_GET['campaign_id'] ?? '';
        $tag     = $_GET['tag'] ?? '';
        $from    = $_GET['from'] ?? '';
        $to      = $_GET['to'] ?? '';
        $dateField = $_GET['date_field'] ?? 'created_at';
        $sortBy  = $_GET['sort'] ?? 'created_at';
        $order   = $_GET['order'] ?? 'DESC';

        $where  = ['c.tenant_id = ?', 'c.deleted_at IS NULL'];
        $params = [$tid];

        // Validating sort fields
        $allowedSort = ['created_at', 'updated_at', 'first_name', 'lead_score', 'last_contact'];
        if (!in_array($sortBy, $allowedSort)) $sortBy = 'created_at';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'])) $order = 'DESC';

        // GĐKD Dự án scoping vs general manager/sale scoping
        $isProjManager = false;
        $projIds = [];
        if ($auth['role'] === 'manager') {
            $stmtP = $this->db->prepare("SELECT id, manager_ids FROM projects");
            $stmtP->execute();
            $projs = $stmtP->fetchAll(PDO::FETCH_ASSOC);
            foreach ($projs as $pRow) {
                if (!empty($pRow['manager_ids'])) {
                    $mIds = array_filter(array_map('intval', explode(',', $pRow['manager_ids'])));
                    if (in_array((int)$auth['user_id'], $mIds, true)) {
                        $projIds[] = (int)$pRow['id'];
                        $isProjManager = true;
                    }
                }
            }
        }

        if ($isProjManager) {
            if (!empty($projIds)) {
                $where[] = 'c.project_id IN (' . implode(',', $projIds) . ')';
            } else {
                $where[] = '1=0';
            }
        } else {
            $scope = $this->getScope($auth, 'leads', 'read');
            if ($scope === 'all') {
                // No filters
            } else if ($scope === 'team') {
                $where[] = '(c.owner_id = ? OR c.owner_id IN (
                    SELECT id FROM users WHERE team_id IN (
                        SELECT id FROM teams WHERE leader_id = ?
                    ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
                ) OR FIND_IN_SET(?, c.collaborator_ids) OR c.id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
                ))';
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
            } else if ($scope === 'own') {
                $where[] = '(c.owner_id = ? OR FIND_IN_SET(?, c.collaborator_ids) OR c.id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
                ))';
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
            } else {
                $where[] = '1=0';
            }
        }

        if ($search) {
            if (is_numeric($search)) {
                $where[]  = '(CONCAT(c.first_name, \' \', c.last_name) LIKE ? OR c.phone LIKE ? OR c.mobile LIKE ? OR c.email LIKE ? OR c.id = ? OR c.person_id = ?)';
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = (int)$search;
                $params[] = (int)$search;
            } else {
                $where[]  = '(CONCAT(c.first_name, \' \', c.last_name) LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.mobile LIKE ? OR c.email LIKE ?)';
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
        }
        if ($status) { $where[] = 'c.status = ?'; $params[] = $status; }
        if ($source) { $where[] = 'c.source = ?'; $params[] = $source; }
        if ($owner)  { $where[] = 'c.owner_id = ?'; $params[] = (int)$owner; }
        if ($stage)  { $where[] = 'c.stage_id = ?'; $params[] = (int)$stage; }
        if ($companyId) { $where[] = 'c.company_id = ?'; $params[] = (int)$companyId; }
        if ($projectId !== '') { $where[] = 'c.project_id = ?'; $params[] = (int)$projectId; }
        if ($campaignId !== '') { $where[] = 'c.campaign_id = ?'; $params[] = (int)$campaignId; }
        if ($tag !== '') { $where[] = 'c.tags LIKE ?'; $params[] = '%"' . $tag . '"%'; }
        
        if ($from !== '') {
            $whereField = in_array($dateField, ['created_at', 'updated_at', 'last_contact']) ? $dateField : 'created_at';
            $where[] = "c.{$whereField} >= ?";
            $params[] = $from . ' 00:00:00';
        }
        if ($to !== '') {
            $whereField = in_array($dateField, ['created_at', 'updated_at', 'last_contact']) ? $dateField : 'created_at';
            $where[] = "c.{$whereField} <= ?";
            $params[] = $to . ' 23:59:59';
        }

        switch ($segment) {
            case 'hot':        $where[] = 'c.lead_score >= 80'; break;
            case 'customer':   $where[] = "c.status = 'customer'"; break;
            case 'has_deal':   $where[] = "EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = c.id AND d.deleted_at IS NULL)"; break;
            case 'no_contact': $where[] = "c.last_contact < DATE_SUB(NOW(), INTERVAL 30 DAY)"; break;
            case 'not_contacted': $where[] = "NOT EXISTS (SELECT 1 FROM activities WHERE related_type = 'contact' AND related_id = c.id) AND NOT EXISTS (SELECT 1 FROM notes WHERE entity_type = 'contact' AND entity_id = c.id)"; break;
            case 'new_week':   $where[] = "c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"; break;
        }

        $whereStr = implode(' AND ', $where);

        $count = $this->db->prepare("SELECT COUNT(*) FROM contacts c WHERE $whereStr");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT c.*, 
                   CASE 
                       WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                       ELSE comp.name 
                   END as company_name,
                   u.full_name as owner_name,
                   u.avatar_url as owner_avatar,
                   ps.name as stage_name, ps.color as stage_color,
                   dl.received_at as distributed_at,
                   dl.status as dl_status,
                   dl.round_id as dl_round_id,
                   r.round_name,
                   dl.id as log_id,
                   l.id as lead_id,
                   dr.status as report_status,
                   dr.id as report_id,
                   dr.reason as report_reason
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
            LEFT JOIN leads l ON l.id = (
                SELECT MAX(id) FROM leads WHERE person_id = c.person_id
            )
            LEFT JOIN distribution_logs dl ON dl.id = (
                SELECT MAX(id) FROM distribution_logs 
                WHERE lead_id = l.id AND assigned_to = c.owner_id
            )
            LEFT JOIN distribution_rounds r ON dl.round_id = r.id
            LEFT JOIN data_reports dr ON dr.id = (
                SELECT MAX(id) FROM data_reports 
                WHERE lead_id = l.id AND consultant_id = c.owner_id
            )
            WHERE $whereStr
            ORDER BY c.$sortBy $order
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $data = $stmt->fetchAll();
        // Parse JSON tags
        foreach ($data as &$row) $row['tags'] = json_decode($row['tags'] ?? '[]');

        respond(200, [
            'items' => $data, 'total' => $total,
            'page' => $page, 'limit' => $limit,
            'total_pages' => ceil($total / $limit)
        ]);
    }

    private function resolveCompanyId(array $auth, array $b): ?int {
        $name = isset($b['company_name']) ? trim($b['company_name']) : '';
        if ($name !== '') {
            $stmt = $this->db->prepare("SELECT id FROM companies WHERE tenant_id=? AND name=?");
            $stmt->execute([$auth['tenant_id'], $name]);
            $id = $stmt->fetchColumn();
            if ($id) return (int)$id;
            
            $stmt = $this->db->prepare("INSERT INTO companies (tenant_id, name, owner_id, created_by) VALUES (?, ?, ?, ?)");
            $stmt->execute([$auth['tenant_id'], $name, $auth['user_id'], $auth['user_id']]);
            return (int)$this->db->lastInsertId();
        }
        if (!empty($b['company_id'])) return (int)$b['company_id'];
        return null;
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thêm mới', false);
        $b = getBody();
        $required = ['first_name'];
        foreach ($required as $f) {
            if (empty($b[$f])) respond(422, null, "Trường '$f' là bắt buộc", false);
        }
        
        $company_id = $this->resolveCompanyId($auth, $b);
        $tags = json_encode($b['tags'] ?? []);
        
        // Duplicate Phone Check
        $phone = $b['phone'] ?? $b['mobile'] ?? null;
        $duplicateFlag = 0;
        $duplicateWithId = null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phone = normalizePhone($phone);
            
            $check = $this->db->prepare("SELECT id, source, created_at, pipeline_status FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND deleted_at IS NULL LIMIT 1");
            $check->execute([$auth['tenant_id'], $phone, $phone]);
            $existing = $check->fetch();
            if ($existing) {
                $newSource = $b['source'] ?? 'other';
                $isPersonal = in_array($newSource, ['ca_nhan', 'gioi_thieu'], true);
                
                $washingDays = 30; // default 30 days
                $existingCreatedTime = strtotime($existing['created_at']);
                $isActiveAndRecent = ($existing['pipeline_status'] !== 'rejected' && (time() - $existingCreatedTime) <= ($washingDays * 24 * 3600));

                if ($isPersonal && $isActiveAndRecent) {
                    $duplicateFlag = 1;
                    $duplicateWithId = (int)$existing['id'];
                } else {
                    respond(422, null, "Số điện thoại '$phone' đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.", false);
                }
            }
        }
        
        // Duplicate Email Check
        $email = $b['email'] ?? null;
        if ($email) {
            $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND deleted_at IS NULL LIMIT 1");
            $checkEmail->execute([$auth['tenant_id'], $email]);
            if ($checkEmail->fetch()) {
                respond(422, null, "Email '$email' đã tồn tại trong hệ thống.", false);
            }
        }

        $stageId = $b['stage_id'] ?? null;
        if (!$stageId) {
            $s = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id=? ORDER BY order_index LIMIT 1");
            $s->execute([$auth['tenant_id']]); $stageId = $s->fetchColumn();
        }

        // Resolve person_id (Master Identity Link)
        $personId = null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phoneClean = normalizePhone($phone);
            if ($phoneClean) {
                $fullName = trim($b['first_name'] . ' ' . ($b['last_name'] ?? ''));
                $stmtPerson = $this->db->prepare("
                    INSERT INTO persons (phone, email, full_name, is_public) 
                    VALUES (?, ?, ?, 0) 
                    ON DUPLICATE KEY UPDATE 
                        email = IF(email IS NULL OR email = '', VALUES(email), email),
                        full_name = IF(full_name IS NULL OR full_name = '', VALUES(full_name), full_name)
                ");
                $stmtPerson->execute([$phoneClean, $email, $fullName]);

                $stmtGetP = $this->db->prepare("SELECT id FROM persons WHERE phone = ? LIMIT 1");
                $stmtGetP->execute([$phoneClean]);
                $personId = $stmtGetP->fetchColumn();
            }
        }

        $birthday = empty($b['birthday']) ? null : $b['birthday'];
        $last_contact = empty($b['last_contact']) ? null : $b['last_contact'];

        $stmt = $this->db->prepare("
            INSERT INTO contacts (tenant_id,company_id,owner_id,created_by,first_name,last_name,
                email,phone,mobile,job_title,department,source,status,tags,notes,stage_id,
                birthday,address,city,ward,expected_revenue,win_probability,last_contact,lead_score,person_id,collaborator_ids)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $auth['tenant_id'],
            $company_id, (in_array($auth['role'], ['sale', 'sales'], true)) ? $auth['user_id'] : (!empty($b['owner_id']) ? (int)$b['owner_id'] : $auth['user_id']),
            $auth['user_id'], $b['first_name'], $b['last_name'] ?? '',
            $email, $phone, $phone,
            $b['job_title'] ?? null, $b['department'] ?? null,
            $b['source'] ?? 'other', $b['status'] ?? 'lead',
            $tags, $b['notes'] ?? null, $stageId,
            $birthday, $b['address'] ?? null, $b['city'] ?? null, $b['ward'] ?? null,
            $b['expected_revenue'] ?? 0, $b['win_probability'] ?? 50,
            $last_contact, $b['lead_score'] ?? 0,
            $personId,
            $b['collaborator_ids'] ?? null
        ]);
        $id = (int)$this->db->lastInsertId();
        if ($duplicateFlag) {
            $upd = $this->db->prepare("UPDATE contacts SET duplicate_flag = 1, duplicate_with_id = ? WHERE id = ?");
            $upd->execute([$duplicateWithId, $id]);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DUPLICATE_FLAG', 'contact', $id, json_encode(['duplicate_with' => $duplicateWithId, 'phone' => $phone]));

            // Send notification to managers & admins
            $stmtAdmins = $this->db->prepare("
                SELECT id FROM users 
                WHERE tenant_id = ? AND role IN ('admin', 'superadmin', 'super_admin', 'manager', 'director')
            ");
            $stmtAdmins->execute([$auth['tenant_id']]);
            $admins = $stmtAdmins->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($admins)) {
                $title = "Cảnh báo trùng số (Nghi ngờ rửa nguồn)";
                $body = "Sale " . ($auth['full_name'] ?? 'Nhân viên') . " đã nhập tay khách hàng trùng SĐT với lead MKT đang hoạt động (Contact ID: " . $duplicateWithId . ")";
                $type = "warning";
                $link = "/contacts?id=" . $id;

                $insertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                foreach ($admins as $adminId) {
                    if ((int)$adminId !== (int)$auth['user_id']) {
                        $insertNotif->execute([$adminId, $auth['tenant_id'], $title, $body, $type, $link]);
                    }
                }
            }
        }

        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'contact', $b['custom_fields']);
        }
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'contact', $id, json_encode(['first_name' => $b['first_name'], 'last_name' => $b['last_name'] ?? '']));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Tạo Khách hàng mới', "Khách hàng \"{$b['first_name']} " . ($b['last_name'] ?? '') . "\" đã được thêm vào hệ thống.", 'contact', $id);
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $sql = "SELECT c.*, 
                    CASE 
                        WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                        ELSE comp.name 
                    END as company_name, 
                    u.full_name as owner_name, u.avatar_url as owner_avatar, ps.name as stage_name, ps.color as stage_color,
                    (SELECT COALESCE(SUM(total),0) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as actual_revenue,
                    (SELECT COUNT(*) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as paid_invoice_count,
                    (SELECT COALESCE(SUM(ee.amount),0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as total_spent,
                    (SELECT COUNT(*) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as expense_count,
                    (
                        SELECT MAX(dt) FROM (
                            SELECT contact_id as cid, paid_at as dt FROM invoices WHERE status='paid' AND deleted_at IS NULL
                            UNION ALL
                            SELECT ee.entity_id as cid, e.approved_at as dt FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND e.status = 'approved' AND e.deleted_at IS NULL
                        ) as t WHERE t.cid = c.id
                    ) as last_order_at,
                    l.id as lead_id,
                    dl.round_id as dl_round_id,
                    dl.status as dl_status
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
            LEFT JOIN leads l ON l.id = (
                SELECT MAX(id) FROM leads WHERE person_id = c.person_id
            )
            LEFT JOIN distribution_logs dl ON dl.id = (
                SELECT MAX(id) FROM distribution_logs 
                WHERE lead_id = l.id AND assigned_to = c.owner_id
            )
            WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        
        $p = [$id, $auth['tenant_id']];
        $scope = $this->getScope($auth, 'leads', 'read');
        if ($scope === 'all') {
            // No filters
        } else if ($scope === 'team') {
            $sql .= " AND (c.owner_id=? OR c.owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                )
            ) OR FIND_IN_SET(?, c.collaborator_ids) OR c.id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE \"{}\" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $sql .= ' AND (c.owner_id=? OR FIND_IN_SET(?, c.collaborator_ids) OR c.id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else {
            $sql .= ' AND 1=0';
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row) respond(404, null, 'Không tìm thấy liên hệ', false);
        $row['tags'] = json_decode($row['tags'] ?? '[]');
        $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'contact');
        respond(200, $row);
    }

    public function update(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật', false);
        $b = getBody();
        // 1. Pre-fetch current contact state for lifecycle validation
        $stmtCurr = $this->db->prepare("SELECT pipeline_status, ttl1_completed, owner_id, first_name, last_name, person_id, email, phone, mobile, collaborator_ids FROM contacts WHERE id = ? AND tenant_id = ?");
        $stmtCurr->execute([$id, $auth['tenant_id']]);
        $currentContact = $stmtCurr->fetch();
        if (!$currentContact) respond(404, null, 'Không tìm thấy liên hệ', false);

        $currStatus = $currentContact['pipeline_status'] ?? 'chua_xac_dinh';
        $currTtl1 = (int)($currentContact['ttl1_completed'] ?? 0);

        // Fetch pipeline status hierarchy dynamically from system_settings
        $stmtHierarchy = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'pipeline_status_hierarchy'");
        $stmtHierarchy->execute();
        $hierarchySetting = $stmtHierarchy->fetchColumn();

        $hierarchyList = [];
        if ($hierarchySetting) {
            $hierarchyList = json_decode($hierarchySetting, true) ?: [];
        }

        if (empty($hierarchyList)) {
            $hierarchyList = ['chua_xac_dinh', 'quan_tam', 'dong_y_gap', 'da_gap', 'booking', 'dat_coc', 'dong_deal'];
        }

        $statusHierarchy = [];
        foreach ($hierarchyList as $idxVal => $statusName) {
            $statusHierarchy[trim($statusName)] = $idxVal;
        }

        // Synchronize stage_id and pipeline_status if only one is updated
        $reqStageId = array_key_exists('stage_id', $b) ? (int)$b['stage_id'] : null;
        $reqStatus = array_key_exists('pipeline_status', $b) ? $b['pipeline_status'] : null;

        if ($reqStageId !== null && $reqStatus === null) {
            $computedStatus = $this->getSlugFromStageId($reqStageId, $auth['tenant_id']);
            $b['pipeline_status'] = $computedStatus;
        } else if ($reqStatus !== null && $reqStageId === null) {
            $computedStageId = $this->getStageIdFromSlug($reqStatus, $auth['tenant_id']);
            if ($computedStageId > 0) {
                $b['stage_id'] = $computedStageId;
            }
        }

        $newStatus = $b['pipeline_status'] ?? null;

        if ($newStatus === 'not_lead') {
            if (in_array($auth['role'], ['sale', 'sales', 'manager', 'director'], true)) {
                $stmtProp = $this->db->prepare("
                    UPDATE contacts 
                    SET not_lead_proposed = 1, 
                        not_lead_proposed_by = ?, 
                        not_lead_proposed_at = NOW() 
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtProp->execute([$auth['user_id'], $id, $auth['tenant_id']]);
                
                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'PROPOSE_NOT_LEAD', 'contact', $id, "Đề xuất loại khỏi phễu (Not Lead) cho khách hàng ID: $id");
                respond(200, null, 'Đề xuất loại khỏi phễu (Not Lead) đã được gửi đến Marketing để phê duyệt.');
            }
        }

        if ($newStatus && $newStatus !== $currStatus) {
            // Exceptions: not_lead can be set from any state
            if ($newStatus !== 'not_lead') {
                $currIdx = $statusHierarchy[$currStatus] ?? 0;
                $newIdx = $statusHierarchy[$newStatus] ?? 0;

                // Enforce forward-only and no skipping stages
                if ($newIdx < $currIdx) {
                    respond(400, null, "Không được phép chuyển lùi trạng thái từ '$currStatus' về '$newStatus'", false);
                }
                if ($newIdx > $currIdx + 1) {
                    respond(400, null, "Không được phép nhảy cóc trạng thái từ '$currStatus' sang '$newStatus' (Phải đi tuần tự)", false);
                }

                // Check TTL1 completion before moving to dong_y_gap
                if ($newStatus === 'dong_y_gap') {
                    $reqTtl1 = isset($b['ttl1_completed']) ? (int)$b['ttl1_completed'] : $currTtl1;
                    if ($reqTtl1 !== 1) {
                        respond(400, null, 'Trước khi sang giai đoạn Đồng ý gặp, bạn bắt buộc phải điền đầy đủ thông tin Form TTL1', false);
                    }
                }
            }
        }

        // Check interaction gate before closing as 'dong_deal' or 'churned'
        if ($newStatus === 'dong_deal' || (isset($b['status']) && $b['status'] === 'churned')) {
            $stmtCheckAct = $this->db->prepare("SELECT COUNT(*) FROM activities WHERE related_type = 'contact' AND related_id = ?");
            $stmtCheckAct->execute([$id]);
            $actCount = (int)$stmtCheckAct->fetchColumn();
            if ($actCount === 0) {
                respond(400, null, 'Chặn đóng deal: Khách hàng chưa từng có tương tác nào! Vui lòng tạo ghi chú cuộc gọi, email hoặc hoạt động trước.', false);
            }
        }

        // Resolve project_id from campaign_id if project_id is empty/0 but campaign_id is set
        $reqProjectId = array_key_exists('project_id', $b) ? (int)$b['project_id'] : null;
        $reqCampaignId = array_key_exists('campaign_id', $b) ? (int)$b['campaign_id'] : null;
        if ($reqCampaignId > 0 && (!$reqProjectId || $reqProjectId === 0)) {
            $stmtCampProj = $this->db->prepare("SELECT project_id FROM marketing_campaigns WHERE id = ?");
            $stmtCampProj->execute([$reqCampaignId]);
            $campProjId = $stmtCampProj->fetchColumn();
            if ($campProjId) {
                $b['project_id'] = (int)$campProjId;
            }
        }

        $fields = [
            'company_id','project_id','owner_id','first_name','last_name','email','phone',
            'mobile','job_title','department','source','status','notes',
            'birthday','address','city','ward',
            'expected_revenue','win_probability','last_contact','stage_id',
            'pipeline_status', 'ttl1_completed', 'ttl1_data',
            'gender', 'zalo_link', 'fb_link', 'customer_type', 'industry', 'budget_range',
            'temperature', 'suggested_temperature', 'campaign_id', 'collaborator_ids'
        ];
        $sets = []; $params = [];
        
        if ($newStatus === 'not_lead') {
            $sets[] = "not_lead_proposed = 0";
            $sets[] = "not_lead_proposed_by = NULL";
            $sets[] = "not_lead_proposed_at = NULL";
        }
        
        // Handle company_id specially to allow clearing and name resolution
        if (array_key_exists('company_name', $b)) {
            $name = trim((string)($b['company_name'] ?? ''));
            if ($name === '') {
                $sets[] = "company_id=NULL";
            } else {
                $cid = $this->resolveCompanyId($auth, $b);
                if ($cid) {
                    $sets[] = "company_id=?";
                    $params[] = $cid;
                }
            }
        } elseif (array_key_exists('company_id', $b)) {
            $sets[] = "company_id=?";
            $params[] = $b['company_id'] ? (int)$b['company_id'] : null;
        }

        foreach ($fields as $f) {
            if ($f === 'company_id') continue;
            if (array_key_exists($f, $b)) { 
                $sets[] = "$f=?"; 
                // Fix date string strict mode crash
                if (in_array($f, ['birthday', 'last_contact']) && $b[$f] === '') {
                    $params[] = null;
                } else if (in_array($f, ['stage_id', 'project_id', 'campaign_id']) && (empty($b[$f]) || $b[$f] === 0 || $b[$f] === '0' || $b[$f] === 'null')) {
                    $params[] = null;
                } else if ($f === 'ttl1_data' && is_array($b[$f])) {
                    $params[] = json_encode($b[$f]);
                } else {
                    $params[] = $b[$f];
                }
            }
        }
        if (isset($b['tags'])) { $sets[] = 'tags=?'; $params[] = json_encode($b['tags']); }
        // Duplicate Phone Check (excluding self and other parallel contacts for the same physical Person)
        $phone = $b['phone'] ?? $b['mobile'] ?? null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phone = normalizePhone($phone);
            $currPhone = normalizePhone($currentContact['phone'] ?? $currentContact['mobile'] ?? '');
            if ($phone !== $currPhone) {
                $personId = $currentContact['person_id'] ?? null;
                if ($personId) {
                    $check = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND id!=? AND (person_id IS NULL OR person_id != ?) AND deleted_at IS NULL LIMIT 1");
                    $check->execute([$auth['tenant_id'], $phone, $phone, $id, $personId]);
                } else {
                    $check = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND id!=? AND deleted_at IS NULL LIMIT 1");
                    $check->execute([$auth['tenant_id'], $phone, $phone, $id]);
                }
                if ($check->fetch()) {
                    respond(422, null, "Số điện thoại '$phone' đã tồn tại ở một khách hàng khác.", false);
                }
            }
        }
        // Duplicate Email Check (excluding self and other parallel contacts for the same physical Person)
        $email = $b['email'] ?? null;
        if ($email) {
            $email = trim(strtolower($email));
            $currEmail = trim(strtolower($currentContact['email'] ?? ''));
            if ($email !== $currEmail) {
                $personId = $currentContact['person_id'] ?? null;
                if ($personId) {
                    $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND id!=? AND (person_id IS NULL OR person_id != ?) AND deleted_at IS NULL LIMIT 1");
                    $checkEmail->execute([$auth['tenant_id'], $email, $id, $personId]);
                } else {
                    $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND id!=? AND deleted_at IS NULL LIMIT 1");
                    $checkEmail->execute([$auth['tenant_id'], $email, $id]);
                }
                if ($checkEmail->fetch()) {
                    respond(422, null, "Email '$email' đã tồn tại ở một khách hàng khác.", false);
                }
            }
        }

        if (!$sets && !isset($b['custom_fields'])) respond(422, null, 'Không có dữ liệu để cập nhật', false);

        if (array_key_exists('stage_id', $b) && !empty($b['stage_id']) && (int)$b['stage_id'] > 0) {
            $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);
        }

        // Check permission first
        $permissionSql = "SELECT id FROM contacts WHERE id=? AND tenant_id=?";
        $cp = [$id, $auth['tenant_id']];
        $scope = $this->getScope($auth, 'leads', 'write');
        if ($scope === 'all') {
            // No extra filters
        } else if ($scope === 'team') {
            $permissionSql .= " AND (owner_id=? OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                )
            ) OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE \"{}\" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $permissionSql .= ' AND (owner_id=? OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
        } else {
            $permissionSql .= ' AND 1=0';
        }
        $check = $this->db->prepare($permissionSql);
        $check->execute($cp);
        if (!$check->fetch()) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

        if ($sets) {
            $params[] = $id; $params[] = $auth['tenant_id'];
            $sql = "UPDATE contacts SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);

            // SEND SYSTEM NOTIFICATION TO NEWLY ADDED CO-CARE SALES
            if (array_key_exists('collaborator_ids', $b)) {
                $oldCollabs = array_filter(array_map('trim', explode(',', $currentContact['collaborator_ids'] ?? '')));
                $newCollabs = array_filter(array_map('trim', explode(',', $b['collaborator_ids'] ?? '')));
                $addedCollabs = array_diff($newCollabs, $oldCollabs);

                if (!empty($addedCollabs)) {
                    $fullName = trim($currentContact['first_name'] . ' ' . ($currentContact['last_name'] ?? ''));
                    $title = "Bạn được thêm làm nhân sự chăm sóc phụ (Co-care)";
                    $body = "Bạn đã được sale " . ($auth['full_name'] ?? 'đồng nghiệp') . " thêm làm nhân sự chăm sóc phụ cho khách hàng: " . $fullName;
                    $type = "info";
                    $link = "/contacts?id=" . $id;

                    $insertNotif = $this->db->prepare("
                        INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ");
                    foreach ($addedCollabs as $collabUserId) {
                        $collabUserId = (int)$collabUserId;
                        if ($collabUserId > 0 && $collabUserId !== (int)$auth['user_id']) {
                            $insertNotif->execute([$collabUserId, $auth['tenant_id'], $title, $body, $type, $link]);
                        }
                    }
                }
            }

            // AUTO TRIGGER META CAPI EVENTS ON STATE TRANSITION AND UPDATE SECURITY TIMERS / DATABANK STATUS
            if ($newStatus && $newStatus !== $currStatus) {
                require_once __DIR__ . '/../config/CapiHelper.php';
                
                // Load CAPI triggers mapping from settings dynamically
                $capiTriggersRaw = $this->getSetting('capi_event_triggers', '');
                $capiMap = [];
                if (!empty($capiTriggersRaw)) {
                    $capiMap = json_decode($capiTriggersRaw, true) ?: [];
                }
                
                // Fallback mapping if not configured in settings
                if (empty($capiMap)) {
                    $capiMap = [
                        'dong_y_gap' => 'Schedule',
                        'da_gap' => 'Schedule',
                        'not_lead' => 'BAD',
                        'dat_coc' => 'Purchase'
                    ];
                }
                
                if (isset($capiMap[$newStatus]) && $capiMap[$newStatus] !== 'Skip' && $capiMap[$newStatus] !== 'None' && $capiMap[$newStatus] !== 'BAD') {
                    CapiHelper::sendEvent($this->db, $id, $capiMap[$newStatus]);
                }

                // Update security_expires_at
                $securityExpires = $this->getSecurityExpiration($newStatus);
                $stmtTimer = $this->db->prepare("UPDATE contacts SET security_expires_at = ? WHERE id = ?");
                $stmtTimer->execute([$securityExpires, $id]);

                // Auto spawn workflow tasks if stage changes
                $targetStageId = isset($b['stage_id']) ? (int)$b['stage_id'] : null;
                if ($targetStageId === null) {
                    $stmtGetStage = $this->db->prepare("SELECT stage_id FROM contacts WHERE id = ?");
                    $stmtGetStage->execute([$id]);
                    $targetStageId = (int)$stmtGetStage->fetchColumn();
                }
                if ($targetStageId > 0) {
                    require_once __DIR__ . '/../config/WorkflowHelper.php';
                    WorkflowHelper::triggerTasks($this->db, $auth['tenant_id'], $id, $targetStageId, $auth['user_id']);
                }

                // Withdraw from databank and terminate other parallel contacts if dat_coc
                if ($newStatus === 'dat_coc') {
                    require_once __DIR__ . '/../config/ParallelHelper.php';
                    ParallelHelper::lockPersonForWinningContact($this->db, (int)$id);
                }
            }
        }
        
        $newTtl1 = isset($b['ttl1_completed']) ? (int)$b['ttl1_completed'] : null;
        if ($newTtl1 !== null && $newTtl1 !== $currTtl1) {
            $ttl1Msg = $newTtl1 === 1 ? "Khách hàng đã được xác minh đạt đủ điều kiện gặp (TTL1)." : "Khách hàng bị hủy xác minh điều kiện gặp (TTL1).";
            logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Xác minh TTL1', $ttl1Msg, 'contact', $id);
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_TTL1', 'contact', $id, json_encode(['ttl1_completed' => $newTtl1]));
        }

        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'contact', $b['custom_fields']);
        }

        // Notify the owner if modified by another user
        if ($currentContact && !empty($currentContact['owner_id']) && (int)$currentContact['owner_id'] !== (int)$auth['user_id']) {
            $ownerId = (int)$currentContact['owner_id'];
            $stmtOwner = $this->db->prepare("SELECT email, full_name FROM users WHERE id = ? AND tenant_id = ?");
            $stmtOwner->execute([$ownerId, $auth['tenant_id']]);
            $ownerRow = $stmtOwner->fetch(PDO::FETCH_ASSOC);
            if ($ownerRow) {
                $notif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?,?,?,?,?,?)");
                $notif->execute([
                    $ownerId, $auth['tenant_id'],
                    'Khách hàng của bạn được cập nhật',
                    $auth['full_name'] . ' đã cập nhật thông tin khách hàng "' . $currentContact['first_name'] . ' ' . $currentContact['last_name'] . '".',
                    'update',
                    "/contacts/{$id}"
                ]);

                if (!empty($ownerRow['email'])) {
                    require_once __DIR__ . '/../mailer.php';
                    $emailSubject = "[RICH LAND] Cập nhật thông tin khách hàng bởi " . $auth['full_name'];
                    $emailTitle = "THÔNG TIN KHÁCH HÀNG THAY ĐỔI";
                    $emailContent = "Chào <strong>" . htmlspecialchars($ownerRow['full_name']) . "</strong>,<br/><br/>" .
                                    "Nhân viên <strong>" . htmlspecialchars($auth['full_name']) . "</strong> đã cập nhật thông tin khách hàng của bạn:<br/>" .
                                    "Khách hàng: <strong>" . htmlspecialchars($currentContact['first_name'] . ' ' . $currentContact['last_name']) . "</strong><br/>" .
                                    "Vui lòng truy cập hệ thống CRM để kiểm tra chi tiết.";
                    sendEmailNotification($ownerRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                }
            }
        }
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'contact', $id, json_encode(['first_name' => $currentContact['first_name'], 'last_name' => $currentContact['last_name'] ?? '']));
        $sql = "SELECT c.*, 
                    CASE 
                        WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                        ELSE comp.name 
                    END as company_name, 
                    u.full_name as owner_name, u.avatar_url as owner_avatar, ps.name as stage_name, ps.color as stage_color,
                    (SELECT COALESCE(SUM(total),0) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as actual_revenue,
                    (SELECT COUNT(*) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as paid_invoice_count,
                    (SELECT COALESCE(SUM(ee.amount),0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as total_spent,
                    (SELECT COUNT(*) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as expense_count,
                    (
                        SELECT MAX(dt) FROM (
                            SELECT contact_id as cid, paid_at as dt FROM invoices WHERE status='paid' AND deleted_at IS NULL
                            UNION ALL
                            SELECT ee.entity_id as cid, e.approved_at as dt FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND e.status = 'approved' AND e.deleted_at IS NULL
                        ) as t WHERE t.cid = c.id
                    ) as last_order_at
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
            WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch();
        if ($row) {
            $row['tags'] = json_decode($row['tags'] ?? '[]');
            $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'contact');
            respond(200, $row);
        } else {
            respond(404, null, 'Không tìm thấy liên hệ', false);
        }
    }

    public function moveStage(array $auth, int $id): void {
        $b = getBody();
        if (empty($b['stage_id'])) respond(422, null, 'stage_id là bắt buộc', false);
        
        $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
        $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
        if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);

        $stageId = (int)$b['stage_id'];
        $newStatus = $this->getSlugFromStageId($stageId, $auth['tenant_id']);

        // Check current status for CAPI/Timer trigger
        $stmtC = $this->db->prepare("SELECT pipeline_status, owner_id, first_name, last_name FROM contacts WHERE id = ? AND tenant_id = ?");
        $stmtC->execute([$id, $auth['tenant_id']]);
        $currentContact = $stmtC->fetch();
        $currStatus = $currentContact['pipeline_status'] ?? 'chua_xac_dinh';

        $sql = "UPDATE contacts SET stage_id=?, pipeline_status=? WHERE id=? AND tenant_id=?";
        $p = [$stageId, $newStatus, $id, $auth['tenant_id']];
        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $sql .= ' AND (owner_id=? OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(403, null, 'Bạn không có quyền di chuyển liên hệ này', false);

        // Notify the owner if modified by another user
        if ($currentContact && !empty($currentContact['owner_id']) && (int)$currentContact['owner_id'] !== (int)$auth['user_id']) {
            $ownerId = (int)$currentContact['owner_id'];
            $stmtOwner = $this->db->prepare("SELECT email, full_name FROM users WHERE id = ? AND tenant_id = ?");
            $stmtOwner->execute([$ownerId, $auth['tenant_id']]);
            $ownerRow = $stmtOwner->fetch(PDO::FETCH_ASSOC);
            if ($ownerRow) {
                $notif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?,?,?,?,?,?)");
                $notif->execute([
                    $ownerId, $auth['tenant_id'],
                    'Giai đoạn khách hàng thay đổi',
                    $auth['full_name'] . ' đã di chuyển khách hàng "' . $currentContact['first_name'] . ' ' . $currentContact['last_name'] . '" sang giai đoạn mới.',
                    'update',
                    "/contacts/{$id}"
                ]);

                if (!empty($ownerRow['email'])) {
                    require_once __DIR__ . '/../mailer.php';
                    $emailSubject = "[RICH LAND] Di chuyển giai đoạn khách hàng bởi " . $auth['full_name'];
                    $emailTitle = "GIAI ĐOẠN KHÁCH HÀNG THAY ĐỔI";
                    $emailContent = "Chào <strong>" . htmlspecialchars($ownerRow['full_name']) . "</strong>,<br/><br/>" .
                                    "Nhân viên <strong>" . htmlspecialchars($auth['full_name']) . "</strong> đã di chuyển giai đoạn khách hàng của bạn:<br/>" .
                                    "Khách hàng: <strong>" . htmlspecialchars($currentContact['first_name'] . ' ' . $currentContact['last_name']) . "</strong><br/>" .
                                    "Vui lòng truy cập hệ thống CRM để kiểm tra chi tiết.";
                    sendEmailNotification($ownerRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                }
            }
        }

        // Trigger CAPI / Security timer updates on status change
        if ($newStatus !== $currStatus) {
            require_once __DIR__ . '/../config/CapiHelper.php';
            
            // Load CAPI triggers mapping from settings dynamically
            $capiTriggersRaw = $this->getSetting('capi_event_triggers', '');
            $capiMap = [];
            if (!empty($capiTriggersRaw)) {
                $capiMap = json_decode($capiTriggersRaw, true) ?: [];
            }
            
            // Fallback mapping if not configured in settings
            if (empty($capiMap)) {
                $capiMap = [
                    'dong_y_gap' => 'Schedule',
                    'da_gap' => 'Schedule',
                    'not_lead' => 'BAD',
                    'dat_coc' => 'Purchase'
                ];
            }
            
            if (isset($capiMap[$newStatus]) && $capiMap[$newStatus] !== 'Skip' && $capiMap[$newStatus] !== 'None' && $capiMap[$newStatus] !== 'BAD') {
                CapiHelper::sendEvent($this->db, $id, $capiMap[$newStatus]);
            }

            // Update security timer
            $securityExpires = $this->getSecurityExpiration($newStatus);
            $stmtTimer = $this->db->prepare("UPDATE contacts SET security_expires_at = ? WHERE id = ?");
            $stmtTimer->execute([$securityExpires, $id]);

            // Auto spawn workflow tasks
            require_once __DIR__ . '/../config/WorkflowHelper.php';
            WorkflowHelper::triggerTasks($this->db, $auth['tenant_id'], $id, $stageId, $auth['user_id']);

            // Withdraw from databank and terminate other parallel contacts if dat_coc
            if ($newStatus === 'dat_coc') {
                require_once __DIR__ . '/../config/ParallelHelper.php';
                ParallelHelper::lockPersonForWinningContact($this->db, (int)$id);
            }
        }

        $note = $b['note'] ?? "Khách hàng đã được chuyển trạng thái.";
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Cập nhật Pipeline', $note, 'contact', $id);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'MOVE_STAGE', 'contact', $id, json_encode(['stage_id' => $stageId, 'pipeline_status' => $newStatus, 'note' => $note]));
        respond(200, null, 'Đã cập nhật stage thành công');
    }



    public function destroy(array $auth, int $id): void {
        $scope = $this->getScope($auth, 'leads', 'delete');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền xóa liên hệ', false);
        }
        
        $sql = "UPDATE contacts SET deleted_at=NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if ($scope === 'team') {
            $sql .= " AND (owner_id=? OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                )
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $sql .= " AND owner_id=?";
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy liên hệ hoặc không có quyền xóa', false);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'contact', $id, json_encode(['id' => $id]));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Xóa Liên hệ', "Một liên hệ đã bị đưa vào thùng rác.", 'contact', $id);
        respond(200, null, 'Đã xóa liên hệ (vào thùng rác)');
    }

    public function bulkDelete(array $auth): void {
        $scope = $this->getScope($auth, 'leads', 'delete');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền xóa liên hệ', false);
        }
        $b = getBody();
        $ids = $b['ids'] ?? [];
        if (empty($ids)) respond(400, null, 'Danh sách ID không hợp lệ', false);
        
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $where = "tenant_id=? AND id IN ($placeholders)";
        $params = array_merge([$auth['tenant_id']], $ids);
        
        if ($scope === 'team') {
            $where .= " AND (owner_id=? OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                )
            ))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $where .= " AND owner_id=?";
            $params[] = $auth['user_id'];
        }
        
        $sql = "UPDATE contacts SET deleted_at=NOW() WHERE $where";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'BULK_DELETE', 'contact', null, json_encode(['ids' => $ids]));
        respond(200, null, "Đã xóa " . $stmt->rowCount() . " liên hệ");
    }

    private function getSetting(string $key, string $default): string {
        $stmt = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? $val : $default;
    }

    private function getSecurityExpiration(string $status): ?string {
        switch ($status) {
            case 'chua_xac_dinh':
                $duration = $this->getSetting('security_timer_chua_xac_dinh', '+3 hours');
                return date('Y-m-d H:i:s', strtotime($duration));
            case 'quan_tam':
                $duration = $this->getSetting('security_timer_quan_tam', '+1 day');
                return date('Y-m-d H:i:s', strtotime($duration));
            case 'thien_chi':
                $duration = $this->getSetting('security_timer_thien_chi', '+3 days');
                return date('Y-m-d H:i:s', strtotime($duration));
            case 'dong_y_gap':
                $duration = $this->getSetting('security_timer_dong_y_gap', '+4 days');
                return date('Y-m-d H:i:s', strtotime($duration));
            case 'da_gap':
                $duration = $this->getSetting('security_timer_da_gap', '+5 days');
                return date('Y-m-d H:i:s', strtotime($duration));
            case 'booking':
                $duration = $this->getSetting('security_timer_booking', '+3 months');
                return date('Y-m-d H:i:s', strtotime($duration));
            default:
                return null;
        }
    }

    private function getSlugFromStageId(int $stageId, int $tenantId): string {
        $stmt = $this->db->prepare("SELECT system_slug FROM pipeline_stages WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$stageId, $tenantId]);
        $slug = $stmt->fetchColumn();
        return $slug ?: 'chua_xac_dinh';
    }

    private function getStageIdFromSlug(string $slug, int $tenantId): int {
        $stmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE system_slug = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$slug, $tenantId]);
        return (int)($stmt->fetchColumn() ?: 0);
    }

    public function releaseDatabank(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $tid = $auth['tenant_id'];

        // 1. Fetch contact
        $stmt = $this->db->prepare("SELECT id, person_id, owner_id, first_name, last_name FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$id, $tid]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) respond(404, null, 'Không tìm thấy liên hệ', false);

        $personId = $contact['person_id'];

        // Prevent releasing active/deposit clients or coop-eligible clients to Databank
        $stmtStatus = $this->db->prepare("SELECT pipeline_status FROM contacts WHERE id = ?");
        $stmtStatus->execute([$id]);
        $currStatus = $stmtStatus->fetchColumn();

        $coopSettingStmt = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'coop_eligible_statuses' LIMIT 1");
        $coopSettingVal = $coopSettingStmt ? $coopSettingStmt->fetchColumn() : '';
        if (!empty($coopSettingVal)) {
            $coopStatuses = array_map('trim', explode(',', $coopSettingVal));
        } else {
            $coopStatuses = ['dat_coc', 'da_coc', 'dong_deal', 'thanh_cong'];
        }

        if (in_array($currStatus, $coopStatuses, true)) {
            respond(400, null, 'Không thể giải phóng khách hàng đang ở trạng thái quy định (' . implode(', ', $coopStatuses) . ')!', false);
        }

        // Prevent releasing clients with active cooperation slips to Databank
        $stmtCoop = $this->db->prepare("
            SELECT id FROM cooperation_slips 
            WHERE contact_id IN (SELECT id FROM contacts WHERE person_id = ? AND deleted_at IS NULL) 
              AND status != 'rejected' LIMIT 1
        ");
        $stmtCoop->execute([$personId]);
        if ($stmtCoop->fetch()) {
            respond(400, null, 'Không thể giải phóng khách hàng đang có phiếu hợp tác hoa hồng!', false);
        }

        // Get current consultant ID
        $stmtC = $this->db->prepare("SELECT id FROM consultants WHERE email = ? LIMIT 1");
        $stmtC->execute([$auth['email'] ?? '']);
        $consultantId = $stmtC->fetchColumn();

        // Get latest lead ID for this person
        $stmtLead = $this->db->prepare("SELECT id FROM leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
        $stmtLead->execute([$personId]);
        $leadId = $stmtLead->fetchColumn();

        // 2. Count active contacts for this Person
        $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE person_id = ? AND tenant_id = ? AND owner_id IS NOT NULL AND deleted_at IS NULL");
        $stmtCount->execute([$personId, $tid]);
        $activeCount = (int)$stmtCount->fetchColumn();

        if ($activeCount <= 1) {
            // Only this sale owns this Person. Release to Databank!
            $defaultStageId = $this->getStageIdFromSlug('chua_xac_dinh', $tid);
            
            $stmtRelease = $this->db->prepare("
                UPDATE contacts 
                SET owner_id = NULL, 
                    pipeline_status = 'chua_xac_dinh', 
                    stage_id = ?, 
                    status = 'lead',
                    security_expires_at = NULL,
                    parallel_assigned = 0,
                    deleted_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ");
            $stmtRelease->execute([$defaultStageId, $id, $tid]);

            // Also update persons to be public
            $stmtPerson = $this->db->prepare("UPDATE persons SET is_public = 1, released_to_kho_at = NOW() WHERE id = ?");
            $stmtPerson->execute([$personId]);

            // Also update leads to set assigned_to = NULL
            if ($personId) {
                $stmtLeadUpdate = $this->db->prepare("UPDATE leads SET assigned_to = NULL, last_assigned_at = NULL WHERE person_id = ?");
                $stmtLeadUpdate->execute([$personId]);

                // Xóa toàn bộ thông tin công việc (activities) và ghi chú (notes) khi trả về Databank
                $stmtDelNotes = $this->db->prepare("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id IN (SELECT id FROM contacts WHERE person_id = ?)");
                $stmtDelNotes->execute([$personId]);

                $stmtDelActs = $this->db->prepare("DELETE FROM activities WHERE related_type = 'contact' AND related_id IN (SELECT id FROM contacts WHERE person_id = ?)");
                $stmtDelActs->execute([$personId]);

                $stmtClearNotes = $this->db->prepare("UPDATE contacts SET notes = NULL WHERE person_id = ?");
                $stmtClearNotes->execute([$personId]);

                // Log distribution log for releasing to databank
                $stmtLog = $this->db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
                $stmtLog->execute([$leadId, null, null, 'released_to_kho', 'Tư vấn viên chủ động trả về Databank chung (do chỉ có 1 Sale chăm sóc)']);
            }

            // Log activity & interaction
            logActivity($this->db, $tid, $auth['user_id'], 'RELEASE_TO_DATABANK', 'contact', $id, "Trả khách hàng về Databank chung (do chỉ có 1 Sale chăm sóc)");
            logInteraction($this->db, $tid, $auth['user_id'], 'system', 'Đã trả khách hàng về Databank chung', null, 'contact', $id);

            respond(200, ['action' => 'released'], 'Đã trả khách hàng về Databank chung thành công!');
        } else {
            // 2 or more sales own this Person in parallel.
            // Just soft-delete this sale's contact row and clear notes!
            $stmtDelete = $this->db->prepare("UPDATE contacts SET deleted_at = NOW(), notes = NULL WHERE id = ? AND tenant_id = ?");
            $stmtDelete->execute([$id, $tid]);

            // Xóa thông tin công việc (activities) và ghi chú (notes) liên quan đến contact bị xóa này
            $stmtDelNotes = $this->db->prepare("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id = ?");
            $stmtDelNotes->execute([$id]);

            $stmtDelActs = $this->db->prepare("DELETE FROM activities WHERE related_type = 'contact' AND related_id = ?");
            $stmtDelActs->execute([$id]);

            // Log distribution log for removing parallel contact
            if ($leadId && $consultantId) {
                $stmtLog = $this->db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
                $stmtLog->execute([$leadId, $consultantId, null, 'released_to_kho', 'Tư vấn viên xóa khỏi danh sách cá nhân (trả về Databank song song)']);
            }

            // Log activity & interaction
            logActivity($this->db, $tid, $auth['user_id'], 'REMOVE_PARALLEL_CONTACT', 'contact', $id, "Xóa liên hệ khỏi danh sách cá nhân (do trả về Databank song song)");
            
            respond(200, ['action' => 'deleted'], 'Đã xóa khách hàng khỏi danh sách chăm sóc của bạn thành công!');
        }
    }

    private function getScope(array $auth, string $module, string $action): string {
        $permissionsJson = null;
        $stmtQ = $this->db->prepare("SELECT permissions_json FROM users WHERE id = ? LIMIT 1");
        $stmtQ->execute([$auth['user_id']]);
        $resQ = $stmtQ->fetch(PDO::FETCH_ASSOC);
        if ($resQ && !empty($resQ['permissions_json'])) {
            $permissionsJson = json_decode($resQ['permissions_json'], true);
        }

        if (in_array($auth['role'], ['admin', 'superadmin', 'super_admin'], true)) {
            return 'all';
        }

        if ($permissionsJson && isset($permissionsJson[$module][$action])) {
            $val = $permissionsJson[$module][$action];
            if (in_array($val, ['all', 'team', 'own', 'none'], true)) {
                if ($action !== 'delete' && $val === 'none' && in_array($auth['role'], ['sale', 'sales', 'manager', 'director', 'assistant'], true)) {
                    return 'own';
                }
                return $val;
            }
        }

        // Default fallbacks
        $role = $auth['role'];
        if ($role === 'director' || $role === 'assistant') {
            return $action === 'delete' ? 'none' : 'all';
        }
        if ($role === 'manager') {
            return $action === 'delete' ? 'none' : 'team';
        }
        if (in_array($role, ['sale', 'sales'], true)) {
            if ($module === 'projects') {
                return $action === 'read' ? 'all' : 'none';
            }
            return $action === 'delete' ? 'none' : 'own';
        }
        if ($role === 'viewer') {
            return $action === 'read' ? 'all' : 'none';
        }

        return 'none';
    }
}




