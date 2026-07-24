<?php
// backend/controllers/CompanyController.php

class CompanyController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    private function getScope(array $auth, string $action): string {
        $permissionsJson = null;
        $stmtQ = $this->db->prepare("SELECT permissions_json FROM users WHERE id = ? LIMIT 1");
        $stmtQ->execute([$auth['user_id']]);
        $resQ = $stmtQ->fetch(PDO::FETCH_ASSOC);
        if ($resQ && !empty($resQ['permissions_json'])) {
            $permissionsJson = json_decode($resQ['permissions_json'], true);
        }

        if (in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin'], true)) {
            return 'all';
        }

        if ($permissionsJson && isset($permissionsJson['companies'][$action])) {
            $val = $permissionsJson['companies'][$action];
            if (in_array($val, ['all', 'team', 'own', 'none'], true)) {
                return $val;
            }
        }

        // Fallbacks
        $role = strtolower($auth['role'] ?? '');
        if ($role === 'director' || $role === 'assistant') {
            return $action === 'delete' ? 'none' : 'all';
        }
        if ($role === 'sale' || $role === 'sales') {
            return $action === 'read' ? 'all' : 'none'; // Sales can view all partners/agents, but cannot write/delete
        }
        if ($role === 'viewer') {
            return $action === 'read' ? 'all' : 'none';
        }
        return 'none';
    }

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

        if ($search) { $where[] = 'MATCH(c.name,c.email) AGAINST(? IN BOOLEAN MODE)'; $params[] = "$search*"; }
        if ($status) { $where[] = 'c.status=?'; $params[] = $status; }
        if ($stage)  { $where[] = 'c.stage_id=?'; $params[] = (int)$stage; }

        // Enforce Read Scope
        $scope = $this->getScope($auth, 'read');
        if ($scope === 'none') {
            respond(200, ['items' => [], 'total' => 0, 'page' => $page, 'limit' => $limit, 'total_pages' => 0]);
        }
        if ($scope === 'own') {
            $where[] = '(c.owner_id = ? OR c.created_by = ? OR c.dedicated_rep_id = ?)';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($scope === 'team') {
            $teamId = $auth['team_id'] ?? null;
            if ($teamId) {
                $where[] = 'c.owner_id IN (SELECT id FROM users WHERE team_id = ?)';
                $params[] = $teamId;
            } else {
                $where[] = 'c.owner_id = ?';
                $params[] = $auth['user_id'];
            }
        }

        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM companies c WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT c.*, parent.name as parent_name, u.full_name as owner_name, ps.name as stage_name, ps.color as stage_color,
                   rep.full_name as rep_name, rep.avatar_url as rep_avatar,
                   COUNT(DISTINCT ct.id) as contact_count
            FROM companies c 
            LEFT JOIN companies parent ON c.parent_id=parent.id
            LEFT JOIN users u ON c.owner_id=u.id
            LEFT JOIN users rep ON c.dedicated_rep_id=rep.id
            LEFT JOIN pipeline_stages ps ON c.stage_id=ps.id
            LEFT JOIN contacts ct ON ct.company_id=c.id AND ct.deleted_at IS NULL
            WHERE $w 
            GROUP BY c.id, parent.id, u.id, rep.id, ps.id
            ORDER BY c.$sortBy $order 
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $data = $stmt->fetchAll();
        
        $isSale = in_array(strtolower($auth['role'] ?? ''), ['sale', 'sales'], true);
        foreach ($data as &$row) {
            $row['tags'] = json_decode($row['tags'] ?? '[]');
            if ($isSale) {
                // Hide sensitive financial data for Sales
                $row['commission_rate'] = 0.00;
                $row['expected_revenue'] = 0.00;
            }
        }
        respond(200, ['items'=>$data,'total'=>$total,'page'=>$page,'limit'=>$limit,'total_pages'=>ceil($total/$limit)]);
    }

    public function store(array $auth): void {
        $scope = $this->getScope($auth, 'write');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền thêm đối tác mới', false);
        }

        $b = getBody();
        if (empty($b['name'])) respond(422, null, 'Tên đại lý/đối tác là bắt buộc', false);
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
            respond(409, null, "Tên đại lý/đối tác '{$b['name']}' đã tồn tại trong hệ thống.", false);
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
            INSERT INTO companies (
                tenant_id,owner_id,created_by,name,tax_id,industry,website,social_link,phone,email,address,ward,city,country,size,status,tags,notes,stage_id,expected_revenue,legal_representative,erp_code,sla_level,wholesale_price,vat_exempt,dedicated_rep_id,logo_url,
                tier,parent_id,commission_rate,focus_markets,agent_count
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $ownerId = (isset($b['owner_id']) && $b['owner_id'] !== '' && $b['owner_id'] !== null) ? (int)$b['owner_id'] : (int)$auth['user_id'];
        $expectedRevenue = (isset($b['expected_revenue']) && $b['expected_revenue'] !== '' && $b['expected_revenue'] !== null) ? (float)$b['expected_revenue'] : 0.00;

        $stmt->execute([
            $auth['tenant_id'], $ownerId, $auth['user_id'],
            $b['name'], $b['tax_id']??null, $b['industry']??null, $b['website']??null, $b['social_link']??null,
            $b['phone']??null, $b['email']??null, $b['address']??null, $b['ward']??null, $b['city']??null,
            $b['country']??'Việt Nam', $b['size']??null, $b['status']??'prospect',
            json_encode($b['tags']??[]), $b['notes']??null, $stageId,
            $expectedRevenue, $b['legal_representative']??null, $b['erp_code']??null,
            $b['sla_level']??'standard',
            (isset($b['wholesale_price']) && $b['wholesale_price']) ? 1 : 0,
            (isset($b['vat_exempt']) && $b['vat_exempt']) ? 1 : 0,
            (isset($b['dedicated_rep_id']) && $b['dedicated_rep_id'] !== '' && $b['dedicated_rep_id'] !== null) ? (int)$b['dedicated_rep_id'] : null,
            $b['logo_url']??null,
            $b['tier']??'f1',
            (isset($b['parent_id']) && $b['parent_id'] !== '' && $b['parent_id'] !== null) ? (int)$b['parent_id'] : null,
            (isset($b['commission_rate']) && $b['commission_rate'] !== '' && $b['commission_rate'] !== null) ? (float)$b['commission_rate'] : 0.00,
            $b['focus_markets']??null,
            (isset($b['agent_count']) && $b['agent_count'] !== '' && $b['agent_count'] !== null) ? (int)$b['agent_count'] : 0
        ]);
        $id = (int)$this->db->lastInsertId();
        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'company', $b['custom_fields']);
        }
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'company', $id, json_encode(['name' => $b['name']]));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Thêm Đối tác mới', "Đại lý/Đối tác \"{$b['name']}\" đã được tạo.", 'company', $id);
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $scope = $this->getScope($auth, 'read');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền xem thông tin đối tác này', false);
        }

        $sql = "
            SELECT c.*, parent.name as parent_name, u.full_name as owner_name, ps.name as stage_name, ps.color as stage_color,
                   rep.full_name as rep_name, rep.avatar_url as rep_avatar,
                   COUNT(DISTINCT ct.id) as contact_count
            FROM companies c 
            LEFT JOIN companies parent ON c.parent_id=parent.id
            LEFT JOIN users u ON c.owner_id=u.id
            LEFT JOIN users rep ON c.dedicated_rep_id=rep.id
            LEFT JOIN pipeline_stages ps ON c.stage_id=ps.id
            LEFT JOIN contacts ct ON ct.company_id=c.id AND ct.deleted_at IS NULL
            WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        
        $p = [$id, $auth['tenant_id']];
        if ($scope === 'own') {
            $sql .= " AND (c.owner_id = ? OR c.created_by = ? OR c.dedicated_rep_id = ?)";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else if ($scope === 'team') {
            $teamId = $auth['team_id'] ?? null;
            if ($teamId) {
                $sql .= " AND c.owner_id IN (SELECT id FROM users WHERE team_id = ?)";
                $p[] = $teamId;
            } else {
                $sql .= " AND c.owner_id = ?";
                $p[] = $auth['user_id'];
            }
        }
        $sql .= " GROUP BY c.id, parent.id, u.id, rep.id, ps.id";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row) respond(404, null, 'Không tìm thấy đối tác', false);
        $row['tags'] = json_decode($row['tags'] ?? '[]');
        $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'company');
        
        $isSale = in_array(strtolower($auth['role'] ?? ''), ['sale', 'sales'], true);
        if ($isSale) {
            // Hide sensitive financial data for Sales
            $row['commission_rate'] = 0.00;
            $row['expected_revenue'] = 0.00;
        }
        respond(200, $row);
    }

    public function update(array $auth, int $id): void {
        $scope = $this->getScope($auth, 'write');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền cập nhật thông tin đối tác', false);
        }

        // Check ownership/team permission first
        $sqlCheck = "SELECT c.id, c.name, c.owner_id, c.created_by, c.dedicated_rep_id FROM companies c WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        $cp = [$id, $auth['tenant_id']];
        $check = $this->db->prepare($sqlCheck);
        $check->execute($cp);
        $oldCompany = $check->fetch();
        if (!$oldCompany) respond(404, null, 'Không tìm thấy đại lý/đối tác', false);

        if ($scope === 'own') {
            if ($oldCompany['owner_id'] != $auth['user_id'] && $oldCompany['created_by'] != $auth['user_id'] && $oldCompany['dedicated_rep_id'] != $auth['user_id']) {
                respond(403, null, 'Bạn không có quyền cập nhật đối tác này', false);
            }
        } else if ($scope === 'team') {
            $teamId = $auth['team_id'] ?? null;
            if ($teamId) {
                $checkTeam = $this->db->prepare("SELECT id FROM users WHERE id=? AND team_id=?");
                $checkTeam->execute([$oldCompany['owner_id'], $teamId]);
                if (!$checkTeam->fetch()) {
                    respond(403, null, 'Bạn không có quyền cập nhật đối tác này (không thuộc nhóm)', false);
                }
            } else {
                if ($oldCompany['owner_id'] != $auth['user_id']) {
                    respond(403, null, 'Bạn không có quyền cập nhật đối tác này', false);
                }
            }
        }

        $b = getBody();
        if (array_key_exists('wholesale_price', $b)) $b['wholesale_price'] = $b['wholesale_price'] ? 1 : 0;
        if (array_key_exists('vat_exempt', $b)) $b['vat_exempt'] = $b['vat_exempt'] ? 1 : 0;
        if (array_key_exists('dedicated_rep_id', $b)) {
            $b['dedicated_rep_id'] = ($b['dedicated_rep_id'] !== '' && $b['dedicated_rep_id'] !== null) ? (int)$b['dedicated_rep_id'] : null;
        }
        if (array_key_exists('owner_id', $b)) {
            $b['owner_id'] = ($b['owner_id'] !== '' && $b['owner_id'] !== null) ? (int)$b['owner_id'] : null;
        }
        if (array_key_exists('stage_id', $b)) {
            $b['stage_id'] = ($b['stage_id'] !== '' && $b['stage_id'] !== null) ? (int)$b['stage_id'] : null;
        }
        if (array_key_exists('expected_revenue', $b)) {
            $b['expected_revenue'] = ($b['expected_revenue'] !== '' && $b['expected_revenue'] !== null) ? (float)$b['expected_revenue'] : 0.00;
        }
        if (array_key_exists('parent_id', $b)) {
            $b['parent_id'] = ($b['parent_id'] !== '' && $b['parent_id'] !== null) ? (int)$b['parent_id'] : null;
        }
        if (array_key_exists('commission_rate', $b)) {
            $b['commission_rate'] = ($b['commission_rate'] !== '' && $b['commission_rate'] !== null) ? (float)$b['commission_rate'] : 0.00;
        }
        if (array_key_exists('agent_count', $b)) {
            $b['agent_count'] = ($b['agent_count'] !== '' && $b['agent_count'] !== null) ? (int)$b['agent_count'] : 0;
        }

        $fields = ['owner_id','name','tax_id','industry','website','social_link','phone','email','address','ward','city','country','size','status','notes','stage_id','expected_revenue','legal_representative','erp_code','sla_level','wholesale_price','vat_exempt','dedicated_rep_id','logo_url','tier','parent_id','commission_rate','focus_markets','agent_count'];
        $sets=[]; $params=[];
        foreach ($fields as $f) { if (array_key_exists($f,$b)) { $sets[]="$f=?"; $params[]=$b[$f]; } }
        if (isset($b['tags'])) { $sets[]='tags=?'; $params[]=json_encode($b['tags']); }
        if (!$sets && !isset($b['custom_fields'])) respond(422, null, 'Không có dữ liệu để cập nhật', false);

        if (array_key_exists('stage_id', $b) && !empty($b['stage_id'])) {
            $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);
        }

        // Check duplicate name
        if (!empty($b['name'])) {
            $checkName = $this->db->prepare("SELECT id FROM companies WHERE tenant_id=? AND name=? AND id!=? AND deleted_at IS NULL LIMIT 1");
            $checkName->execute([$auth['tenant_id'], $b['name'], $id]);
            if ($checkName->fetch()) {
                respond(409, null, "Tên đối tác '{$b['name']}' đã tồn tại trong hệ thống.", false);
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

        try {
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
        } catch (Exception $e) {
            respond(500, null, "Exception: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine(), false);
        }
    }

    public function moveStage(array $auth, int $id): void {
        $scope = $this->getScope($auth, 'write');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền chuyển giai đoạn đối tác', false);
        }

        $b = getBody();
        if (empty($b['stage_id'])) respond(422, null, 'stage_id là bắt buộc', false);
        
        $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
        $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
        if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);

        $sql = "UPDATE companies SET stage_id=? WHERE id=? AND tenant_id=?";
        $p = [$b['stage_id'], $id, $auth['tenant_id']];
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(403, null, 'Không có quyền di chuyển', false);
        
        $note = $b['note'] ?? "Trạng thái đại lý/đối tác đã được chuyển.";
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Cập nhật Pipeline', $note, 'company', $id);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'MOVE_STAGE', 'company', $id, json_encode(['stage_id' => $b['stage_id'], 'note' => $note]));
        respond(200, null, 'Đã cập nhật stage thành công');
    }

    public function destroy(array $auth, int $id): void {
        $scope = $this->getScope($auth, 'delete');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền xóa đại lý/đối tác', false);
        }

        $check = $this->db->prepare("SELECT owner_id, created_by, dedicated_rep_id FROM companies WHERE id=? AND tenant_id=? AND deleted_at IS NULL");
        $check->execute([$id, $auth['tenant_id']]);
        $oldCompany = $check->fetch();
        if (!$oldCompany) respond(404, null, 'Không tìm thấy đối tác', false);

        if ($scope === 'own') {
            if ($oldCompany['owner_id'] != $auth['user_id'] && $oldCompany['created_by'] != $auth['user_id'] && $oldCompany['dedicated_rep_id'] != $auth['user_id']) {
                respond(403, null, 'Bạn không có quyền xóa đối tác này', false);
            }
        } else if ($scope === 'team') {
            $teamId = $auth['team_id'] ?? null;
            if ($teamId) {
                $checkTeam = $this->db->prepare("SELECT id FROM users WHERE id=? AND team_id=?");
                $checkTeam->execute([$oldCompany['owner_id'], $teamId]);
                if (!$checkTeam->fetch()) {
                    respond(403, null, 'Bạn không có quyền xóa đối tác này (không thuộc nhóm)', false);
                }
            } else {
                if ($oldCompany['owner_id'] != $auth['user_id']) {
                    respond(403, null, 'Bạn không có quyền xóa đối tác này', false);
                }
            }
        }

        $sql = "UPDATE companies SET deleted_at=NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy đối tác', false);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'company', $id, json_encode(['id' => $id]));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Xóa Đối tác', "Đại lý/Đối tác đã bị xóa.", 'company', $id);
        respond(200, null, 'Đã xóa đối tác thành công');
    }

    public function bulkDelete(array $auth): void {
        $scope = $this->getScope($auth, 'delete');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền xóa đại lý/đối tác', false);
        }

        $b = getBody();
        $ids = $b['ids'] ?? [];
        if (empty($ids)) respond(400, null, 'ID không hợp lệ', false);

        if ($scope === 'own' || $scope === 'team') {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $sqlCheck = "SELECT id, owner_id, created_by, dedicated_rep_id FROM companies WHERE tenant_id=? AND id IN ($placeholders) AND deleted_at IS NULL";
            $stmtCheck = $this->db->prepare($sqlCheck);
            $stmtCheck->execute(array_merge([$auth['tenant_id']], $ids));
            $found = $stmtCheck->fetchAll();
            
            if (count($found) !== count($ids)) respond(403, null, 'Một số đối tác không tồn tại hoặc đã bị xóa', false);
            
            foreach ($found as $oldCompany) {
                if ($scope === 'own') {
                    if ($oldCompany['owner_id'] != $auth['user_id'] && $oldCompany['created_by'] != $auth['user_id'] && $oldCompany['dedicated_rep_id'] != $auth['user_id']) {
                        respond(403, null, 'Bạn không có quyền xóa một số đối tác được chọn', false);
                    }
                } else if ($scope === 'team') {
                    $teamId = $auth['team_id'] ?? null;
                    if ($teamId) {
                        $checkTeam = $this->db->prepare("SELECT id FROM users WHERE id=? AND team_id=?");
                        $checkTeam->execute([$oldCompany['owner_id'], $teamId]);
                        if (!$checkTeam->fetch()) {
                            respond(403, null, 'Một số đối tác được chọn không thuộc nhóm của bạn', false);
                        }
                    } else {
                        if ($oldCompany['owner_id'] != $auth['user_id']) {
                            respond(403, null, 'Bạn không có quyền xóa một số đối tác được chọn', false);
                        }
                    }
                }
            }
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "UPDATE companies SET deleted_at=NOW() WHERE tenant_id=? AND id IN ($placeholders)";
        $p = array_merge([$auth['tenant_id']], $ids);
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'BULK_DELETE', 'company', null, json_encode(['ids' => $ids]));
        respond(200, null, "Đã xóa " . $stmt->rowCount() . " đại lý/đối tác");
    }
}
