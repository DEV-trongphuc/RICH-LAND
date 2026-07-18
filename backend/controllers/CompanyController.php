<?php
// f:\CRM\backend\controllers\CompanyController.php

class CompanyController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1,(int)($_GET['page'] ?? 1));
        $limit  = min(2000, max(10,(int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $search = $_GET['search'] ?? '';
        $status = $_GET['status'] ?? '';
        $stage  = $_GET['stage_id'] ?? '';

        $sortBy = $_GET['sort'] ?? 'created_at';
        $order  = $_GET['order'] ?? 'DESC';

        $where = ['c.tenant_id=?','c.deleted_at IS NULL']; $params = [$tid];

        // Validating sort fields
        $allowedSort = ['created_at', 'updated_at', 'name', 'industry', 'city'];
        if (!in_array($sortBy, $allowedSort)) $sortBy = 'created_at';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'])) $order = 'DESC';

        if (in_array($auth['role'], ['sale', 'sales'], true)) {
            $where[] = '(c.owner_id = ? OR c.dedicated_rep_id = ? OR EXISTS (SELECT 1 FROM contacts ct2 WHERE ct2.company_id=c.id AND ct2.owner_id=? AND ct2.deleted_at IS NULL))';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }
        if ($search) { $where[] = 'MATCH(c.name,c.email) AGAINST(? IN BOOLEAN MODE)'; $params[] = "$search*"; }
        if ($status) { $where[] = 'c.status=?'; $params[] = $status; }
        if ($stage)  { $where[] = 'c.stage_id=?'; $params[] = (int)$stage; }
        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM companies c WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as owner_name, ps.name as stage_name, ps.color as stage_color,
                   rep.full_name as rep_name, rep.avatar_url as rep_avatar,
                   COUNT(DISTINCT ct.id) as contact_count
            FROM companies c 
            LEFT JOIN users u ON c.owner_id=u.id
            LEFT JOIN users rep ON c.dedicated_rep_id=rep.id
            LEFT JOIN pipeline_stages ps ON c.stage_id=ps.id
            LEFT JOIN contacts ct ON ct.company_id=c.id AND ct.deleted_at IS NULL
            WHERE $w 
            GROUP BY c.id, u.id, rep.id, ps.id
            ORDER BY c.$sortBy $order 
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $data = $stmt->fetchAll();
        foreach ($data as &$row) $row['tags'] = json_decode($row['tags'] ?? '[]');
        respond(200, ['items'=>$data,'total'=>$total,'page'=>$page,'limit'=>$limit,'total_pages'=>ceil($total/$limit)]);
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') {
            respond(403, null, 'Bạn không có quyền thêm công ty mới', false);
        }
        $b = getBody();
        if (empty($b['name'])) respond(422, null, 'Tên công ty là bắt buộc', false);
        // Verify stage belongs to tenant
        $stageId = $b['stage_id'] ?? null;
        if ($stageId) {
            $checkStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $checkStage->execute([$stageId, $auth['tenant_id']]);
            if (!$checkStage->fetch()) $stageId = null;
        }
        if (!$stageId) {
            $s = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id=? ORDER BY order_index LIMIT 1");
            $s->execute([$auth['tenant_id']]); $stageId = $s->fetchColumn();
        }

        // Check duplicate name
        $checkName = $this->db->prepare("SELECT id FROM companies WHERE tenant_id=? AND name=? AND deleted_at IS NULL LIMIT 1");
        $checkName->execute([$auth['tenant_id'], $b['name']]);
        if ($checkName->fetch()) {
            respond(409, null, "Tên công ty '{$b['name']}' đã tồn tại trong hệ thống.", false);
        }

        // Check duplicate tax_id
        if (!empty($b['tax_id'])) {
            $checkTax = $this->db->prepare("SELECT id FROM companies WHERE tenant_id=? AND tax_id=? AND deleted_at IS NULL LIMIT 1");
            $checkTax->execute([$auth['tenant_id'], $b['tax_id']]);
            if ($checkTax->fetch()) {
                respond(409, null, "Mã số thuế '{$b['tax_id']}' đã tồn tại trong hệ thống.", false);
            }
        }

        $stmt = $this->db->prepare("
            INSERT INTO companies (tenant_id,owner_id,created_by,name,tax_id,industry,website,social_link,phone,email,address,ward,city,country,size,status,tags,notes,stage_id,expected_revenue,legal_representative,erp_code,sla_level,wholesale_price,vat_exempt,dedicated_rep_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $auth['tenant_id'], $b['owner_id'] ?? $auth['user_id'], $auth['user_id'],
            $b['name'], $b['tax_id']??null, $b['industry']??null, $b['website']??null, $b['social_link']??null,
            $b['phone']??null, $b['email']??null, $b['address']??null, $b['ward']??null, $b['city']??null,
            $b['country']??'Việt Nam', $b['size']??null, $b['status']??'prospect',
            json_encode($b['tags']??[]), $b['notes']??null, $stageId,
            $b['expected_revenue']??0, $b['legal_representative']??null, $b['erp_code']??null,
            $b['sla_level']??'standard',
            (isset($b['wholesale_price']) && $b['wholesale_price']) ? 1 : 0,
            (isset($b['vat_exempt']) && $b['vat_exempt']) ? 1 : 0,
            (isset($b['dedicated_rep_id']) && $b['dedicated_rep_id'] !== '' && $b['dedicated_rep_id'] !== null) ? (int)$b['dedicated_rep_id'] : null
        ]);
        $id = (int)$this->db->lastInsertId();
        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'company', $b['custom_fields']);
        }
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'company', $id, json_encode(['name' => $b['name']]));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Thêm Công ty mới', "Công ty \"{$b['name']}\" đã được tạo.", 'company', $id);
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $sql = "
            SELECT c.*, u.full_name as owner_name, ps.name as stage_name, ps.color as stage_color,
                   COUNT(DISTINCT ct.id) as contact_count
            FROM companies c 
            LEFT JOIN users u ON c.owner_id=u.id
            LEFT JOIN pipeline_stages ps ON c.stage_id=ps.id
            LEFT JOIN contacts ct ON ct.company_id=c.id AND ct.deleted_at IS NULL
            WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        
        $p = [$id, $auth['tenant_id']];
        $isSale = in_array($auth['role'], ['sale', 'sales'], true);
        if ($isSale) {
            // Can see company if owner OR manages a contact in that company OR is dedicated rep
            $sql .= " AND (c.owner_id=? OR c.dedicated_rep_id=? OR EXISTS (SELECT 1 FROM contacts ct2 WHERE ct2.company_id=c.id AND ct2.owner_id=? AND ct2.deleted_at IS NULL))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row) respond(404, null, 'Không tìm thấy công ty', false);
        $row['tags'] = json_decode($row['tags'] ?? '[]');
        $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'company');
        respond(200, $row);
    }

    public function update(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') {
            respond(403, null, 'Bạn không có quyền cập nhật thông tin công ty', false);
        }
        $b = getBody();
        if (array_key_exists('wholesale_price', $b)) $b['wholesale_price'] = $b['wholesale_price'] ? 1 : 0;
        if (array_key_exists('vat_exempt', $b)) $b['vat_exempt'] = $b['vat_exempt'] ? 1 : 0;
        if (array_key_exists('dedicated_rep_id', $b)) {
            $b['dedicated_rep_id'] = ($b['dedicated_rep_id'] !== '' && $b['dedicated_rep_id'] !== null) ? (int)$b['dedicated_rep_id'] : null;
        }

        $fields = ['owner_id','name','tax_id','industry','website','social_link','phone','email','address','ward','city','country','size','status','notes','stage_id','expected_revenue','legal_representative','erp_code','sla_level','wholesale_price','vat_exempt','dedicated_rep_id'];
        $sets=[]; $params=[];
        foreach ($fields as $f) { if (array_key_exists($f,$b)) { $sets[]="$f=?"; $params[]=$b[$f]; } }
        if (isset($b['tags'])) { $sets[]='tags=?'; $params[]=json_encode($b['tags']); }
        if (!$sets && !isset($b['custom_fields'])) respond(422, null, 'Không có dữ liệu để cập nhật', false);

        if (array_key_exists('stage_id', $b) && !empty($b['stage_id'])) {
            $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);
        }

        // Check permission first
        $isSale = in_array($auth['role'], ['sale', 'sales'], true);
        $sqlCheck = "SELECT c.id, c.name FROM companies c WHERE c.id=? AND c.tenant_id=? ";
        $cp = [$id, $auth['tenant_id']];
        if ($isSale) {
            $sqlCheck .= " AND (c.owner_id=? OR c.dedicated_rep_id=? OR EXISTS (SELECT 1 FROM contacts ct2 WHERE ct2.company_id=c.id AND ct2.owner_id=? AND ct2.deleted_at IS NULL))";
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
        }
        $check = $this->db->prepare($sqlCheck);
        $check->execute($cp);
        $oldCompany = $check->fetch();
        if (!$oldCompany) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

        // Check duplicate name
        if (!empty($b['name'])) {
            $checkName = $this->db->prepare("SELECT id FROM companies WHERE tenant_id=? AND name=? AND id!=? AND deleted_at IS NULL LIMIT 1");
            $checkName->execute([$auth['tenant_id'], $b['name'], $id]);
            if ($checkName->fetch()) {
                respond(409, null, "Tên công ty '{$b['name']}' đã tồn tại trong hệ thống.", false);
            }
        }

        // Check duplicate tax_id
        if (!empty($b['tax_id'])) {
            $checkTax = $this->db->prepare("SELECT id FROM companies WHERE tenant_id=? AND tax_id=? AND id!=? AND deleted_at IS NULL LIMIT 1");
            $checkTax->execute([$auth['tenant_id'], $b['tax_id'], $id]);
            if ($checkTax->fetch()) {
                respond(409, null, "Mã số thuế '{$b['tax_id']}' đã tồn tại trong hệ thống.", false);
            }
        }

        if ($sets) {
            $params[]=$id; $params[]=$auth['tenant_id'];
            $stmt = $this->db->prepare("UPDATE companies SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?");
            $stmt->execute($params);
        }
        
        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'company', $b['custom_fields']);
        }
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'company', $id, json_encode(['name' => $oldCompany['name']]));
        $this->show($auth, $id);
    }

    public function moveStage(array $auth, int $id): void {
        $b = getBody();
        if (empty($b['stage_id'])) respond(422, null, 'stage_id là bắt buộc', false);
        
        $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
        $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
        if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);

        $sql = "UPDATE companies SET stage_id=? WHERE id=? AND tenant_id=?";
        $p = [$b['stage_id'], $id, $auth['tenant_id']];
        if (in_array($auth['role'], ['sale', 'sales'], true)) {
            $sql .= " AND (owner_id=? OR dedicated_rep_id=? OR EXISTS (SELECT 1 FROM contacts ct2 WHERE ct2.company_id=companies.id AND ct2.owner_id=? AND ct2.deleted_at IS NULL))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(403, null, 'Không có quyền di chuyển', false);
        
        $note = $b['note'] ?? "Công ty đã được chuyển trạng thái.";
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Cập nhật Pipeline', $note, 'company', $id);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'MOVE_STAGE', 'company', $id, json_encode(['stage_id' => $b['stage_id'], 'note' => $note]));
        respond(200, null, 'Đã cập nhật stage thành công');
    }

    public function destroy(array $auth, int $id): void {
        if (in_array($auth['role'], ['sales', 'viewer'], true)) respond(403, null, 'Bạn không có quyền xóa công ty', false);
        $sql = "UPDATE companies SET deleted_at=NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy công ty', false);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'company', $id, json_encode(['id' => $id]));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Xóa Công ty', "Một công ty đã bị đưa vào thùng rác.", 'company', $id);
        respond(200, null, 'Đã xóa công ty (vào thùng rác)');
    }

    public function bulkDelete(array $auth): void {
        if (in_array($auth['role'], ['sales', 'viewer'], true)) respond(403, null, 'Bạn không có quyền xóa công ty', false);
        $b = getBody();
        $ids = $b['ids'] ?? [];
        if (empty($ids)) respond(400, null, 'ID không hợp lệ', false);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        
        $sql = "UPDATE companies SET deleted_at=NOW() WHERE tenant_id=? AND id IN ($placeholders)";
        $p = array_merge([$auth['tenant_id']], $ids);
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'BULK_DELETE', 'company', null, json_encode(['ids' => $ids]));
        respond(200, null, "Đã xóa " . $stmt->rowCount() . " công ty");
    }
}
