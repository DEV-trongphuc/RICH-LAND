<?php
// f:\CRM\backend\controllers\ContactController.php

class ContactController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $search  = $_GET['search'] ?? '';
        $status  = $_GET['status'] ?? '';
        $source  = $_GET['source'] ?? '';
        $owner   = $_GET['owner_id'] ?? '';
        $stage   = $_GET['stage_id'] ?? '';
        $companyId = $_GET['company_id'] ?? '';
        $segment = $_GET['segment'] ?? 'all';
        $sortBy  = $_GET['sort'] ?? 'created_at';
        $order   = $_GET['order'] ?? 'DESC';

        $where  = ['c.tenant_id = ?', 'c.deleted_at IS NULL'];
        $params = [$tid];

        // Validating sort fields
        $allowedSort = ['created_at', 'updated_at', 'first_name', 'lead_score', 'last_contact'];
        if (!in_array($sortBy, $allowedSort)) $sortBy = 'created_at';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'])) $order = 'DESC';

        // Role-based visibility: Sale can only see their own contacts
        if ($auth['role'] === 'sales') {
            $where[] = 'c.owner_id = ?';
            $params[] = $auth['user_id'];
        }

        if ($search) {
            $where[]  = '(MATCH(c.first_name, c.last_name, c.email) AGAINST(? IN BOOLEAN MODE) OR c.phone LIKE ? OR c.mobile LIKE ? OR c.email LIKE ?)';
            $params[] = "$search*";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        if ($status) { $where[] = 'c.status = ?'; $params[] = $status; }
        if ($source) { $where[] = 'c.source = ?'; $params[] = $source; }
        if ($owner)  { $where[] = 'c.owner_id = ?'; $params[] = (int)$owner; }
        if ($stage)  { $where[] = 'c.stage_id = ?'; $params[] = (int)$stage; }
        if ($companyId) { $where[] = 'c.company_id = ?'; $params[] = (int)$companyId; }

        switch ($segment) {
            case 'hot':        $where[] = 'c.lead_score >= 80'; break;
            case 'customer':   $where[] = "c.status = 'customer'"; break;
            case 'has_deal':   $where[] = "EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = c.id AND d.deleted_at IS NULL)"; break;
            case 'no_contact': $where[] = "c.last_contact < DATE_SUB(NOW(), INTERVAL 30 DAY)"; break;
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
                   ps.name as stage_name, ps.color as stage_color
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
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
        if ($phone) {
            $check = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND deleted_at IS NULL LIMIT 1");
            $check->execute([$auth['tenant_id'], $phone, $phone]);
            if ($check->fetch()) {
                respond(422, null, "Số điện thoại '$phone' đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.", false);
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

        $birthday = empty($b['birthday']) ? null : $b['birthday'];
        $last_contact = empty($b['last_contact']) ? null : $b['last_contact'];

        $stmt = $this->db->prepare("
            INSERT INTO contacts (tenant_id,company_id,owner_id,created_by,first_name,last_name,
                email,phone,mobile,job_title,department,source,status,tags,notes,stage_id,
                birthday,address,city,ward,expected_revenue,win_probability,last_contact,lead_score)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $auth['tenant_id'],
            $company_id, $b['owner_id'] ?? $auth['user_id'],
            $auth['user_id'], $b['first_name'], $b['last_name'] ?? '',
            $email, $b['phone'] ?? null, $b['mobile'] ?? null,
            $b['job_title'] ?? null, $b['department'] ?? null,
            $b['source'] ?? 'other', $b['status'] ?? 'lead',
            $tags, $b['notes'] ?? null, $stageId,
            $birthday, $b['address'] ?? null, $b['city'] ?? null, $b['ward'] ?? null,
            $b['expected_revenue'] ?? 0, $b['win_probability'] ?? 50,
            $last_contact, $b['lead_score'] ?? 0
        ]);
        $id = (int)$this->db->lastInsertId();
        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'contact', $b['custom_fields']);
        }
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Tạo Khách hàng mới', "Khách hàng \"{$b['first_name']} " . ($b['last_name'] ?? '') . "\" đã được thêm vào hệ thống.", 'contact', $id);
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $sql = "SELECT c.*, 
                    CASE 
                        WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                        ELSE comp.name 
                    END as company_name, 
                    u.full_name as owner_name, ps.name as stage_name, ps.color as stage_color,
                    (SELECT COALESCE(SUM(total),0) FROM invoices WHERE contact_id=c.id AND status='paid') as total_spent,
                    (SELECT COUNT(*) FROM invoices WHERE contact_id=c.id AND status='paid') as order_count,
                    (SELECT MAX(paid_at) FROM invoices WHERE contact_id=c.id AND status='paid') as last_order_at
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
            WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') {
            $sql .= " AND c.owner_id=?";
            $p[] = $auth['user_id'];
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
        $stmtCurr = $this->db->prepare("SELECT pipeline_status, ttl1_completed FROM contacts WHERE id = ? AND tenant_id = ?");
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

        $newStatus = $b['pipeline_status'] ?? null;
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

        $fields = [
            'company_id','owner_id','first_name','last_name','email','phone',
            'mobile','job_title','department','source','status','notes',
            'birthday','address','city','ward',
            'expected_revenue','win_probability','last_contact','stage_id',
            'pipeline_status', 'ttl1_completed', 'ttl1_data'
        ];
        $sets = []; $params = [];
        
        // Handle company_id specially to allow clearing and name resolution
        if (array_key_exists('company_name', $b)) {
            $name = trim($b['company_name']);
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
                } else if ($f === 'ttl1_data' && is_array($b[$f])) {
                    $params[] = json_encode($b[$f]);
                } else {
                    $params[] = $b[$f];
                }
            }
        }
        if (isset($b['tags'])) { $sets[] = 'tags=?'; $params[] = json_encode($b['tags']); }
        // Duplicate Phone Check (excluding self)
        $phone = $b['phone'] ?? $b['mobile'] ?? null;
        if ($phone) {
            $check = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND id!=? AND deleted_at IS NULL LIMIT 1");
            $check->execute([$auth['tenant_id'], $phone, $phone, $id]);
            if ($check->fetch()) {
                respond(422, null, "Số điện thoại '$phone' đã tồn tại ở một khách hàng khác.", false);
            }
        }
        // Duplicate Email Check (excluding self)
        $email = $b['email'] ?? null;
        if ($email) {
            $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND id!=? AND deleted_at IS NULL LIMIT 1");
            $checkEmail->execute([$auth['tenant_id'], $email, $id]);
            if ($checkEmail->fetch()) {
                respond(422, null, "Email '$email' đã tồn tại ở một khách hàng khác.", false);
            }
        }

        if (!$sets && !isset($b['custom_fields'])) respond(422, null, 'Không có dữ liệu để cập nhật', false);

        if (array_key_exists('stage_id', $b)) {
            $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);
        }

        // Check permission first
        $check = $this->db->prepare("SELECT id FROM contacts WHERE id=? AND tenant_id=? " . ($auth['role'] === 'sales' ? " AND owner_id=?" : ""));
        $cp = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') $cp[] = $auth['user_id'];
        $check->execute($cp);
        if (!$check->fetch()) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

        if ($sets) {
            $params[] = $id; $params[] = $auth['tenant_id'];
            $sql = "UPDATE contacts SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);

            // AUTO TRIGGER META CAPI EVENTS ON STATE TRANSITION
            if ($newStatus && $newStatus !== $currStatus) {
                require_once __DIR__ . '/../config/CapiHelper.php';
                if ($newStatus === 'dong_y_gap' || $newStatus === 'da_gap') {
                    CapiHelper::sendEvent($this->db, $id, 'Schedule');
                } elseif ($newStatus === 'not_lead') {
                    CapiHelper::sendEvent($this->db, $id, 'BAD');
                } elseif ($newStatus === 'dat_coc') {
                    CapiHelper::sendEvent($this->db, $id, 'Purchase');
                }
            }
        }
        
        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'contact', $b['custom_fields']);
        }
        
        $this->show($auth, $id);
    }

    public function moveStage(array $auth, int $id): void {
        $b = getBody();
        if (empty($b['stage_id'])) respond(422, null, 'stage_id là bắt buộc', false);
        
        $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
        $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
        if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);

        $sql = "UPDATE contacts SET stage_id=? WHERE id=? AND tenant_id=?";
        $p = [$b['stage_id'], $id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') {
            $sql .= " AND owner_id=?";
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(403, null, 'Bạn không có quyền di chuyển liên hệ này', false);
        
        $note = $b['note'] ?? "Khách hàng đã được chuyển trạng thái.";
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Cập nhật Pipeline', $note, 'contact', $id);
        respond(200, null, 'Đã cập nhật stage thành công');
    }

    public function destroy(array $auth, int $id): void {
        if (in_array($auth['role'], ['sales', 'viewer'], true)) respond(403, null, 'Bạn không có quyền xóa liên hệ', false);
        $sql = "UPDATE contacts SET deleted_at=NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy liên hệ', false);
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Xóa Liên hệ', "Một liên hệ đã bị đưa vào thùng rác.", 'contact', $id);
        respond(200, null, 'Đã xóa liên hệ (vào thùng rác)');
    }

    public function bulkDelete(array $auth): void {
        if (in_array($auth['role'], ['sales', 'viewer'], true)) respond(403, null, 'Bạn không có quyền xóa liên hệ', false);
        $b = getBody();
        $ids = $b['ids'] ?? [];
        if (empty($ids)) respond(400, null, 'Danh sách ID không hợp lệ', false);
        
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "UPDATE contacts SET deleted_at=NOW() WHERE tenant_id=? AND id IN ($placeholders)";
        $params = array_merge([$auth['tenant_id']], $ids);
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        respond(200, null, "Đã xóa " . $stmt->rowCount() . " liên hệ");
    }
}
