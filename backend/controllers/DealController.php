<?php
// f:\CRM\backend\controllers\DealController.php

class DealController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function stages(array $auth): void {
        $tid = $auth['tenant_id'];
        
        $scope = $this->getScope($auth, 'deals', 'read');
        $roleFilter = "";
        if ($scope === 'all') {
            $roleFilter = "";
        } else if ($scope === 'team') {
            $uid = (int)$auth['user_id'];
            $roleFilter = " AND (owner_id = $uid OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = $uid
                ) OR team_id = (SELECT team_id FROM users WHERE id = $uid)
            ))";
        } else if ($scope === 'own') {
            $uid = (int)$auth['user_id'];
            $roleFilter = " AND owner_id = $uid";
        } else {
            $roleFilter = " AND 1=0";
        }
        $p = ['tid1' => $tid, 'tid2' => $tid, 'tid3' => $tid];

        $sql = "
            SELECT ps.*, 
                   (
                     (SELECT COUNT(*) FROM contacts WHERE stage_id = ps.id AND deleted_at IS NULL AND tenant_id = :tid1 $roleFilter) +
                     (SELECT COUNT(*) FROM companies WHERE stage_id = ps.id AND deleted_at IS NULL AND tenant_id = :tid2 $roleFilter)
                   ) as deals
            FROM pipeline_stages ps
            WHERE ps.tenant_id = :tid3
            ORDER BY ps.order_index
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function storeStage(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true)) respond(403, null, 'Chỉ admin mới có quyền quản lý pipeline', false);
        $b = getBody();
        if (empty($b['name'])) respond(422, null, 'Tên stage là bắt buộc', false);
        $maxIdx = $this->db->prepare("SELECT COALESCE(MAX(order_index),0)+1 FROM pipeline_stages WHERE tenant_id=?");
        $maxIdx->execute([$auth['tenant_id']]);
        $nextIdx = (int)$maxIdx->fetchColumn();
        $this->db->prepare("INSERT INTO pipeline_stages (tenant_id,name,color,order_index,is_won,is_lost) VALUES (?,?,?,?,?,?)")
            ->execute([$auth['tenant_id'], $b['name'], $b['color']??'#6366f1', $nextIdx, $b['is_won']??0, $b['is_lost']??0]);
        respond(201, ['id' => (int)$this->db->lastInsertId()], 'Stage đã tạo thành công');
    }

    public function updateStage(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true)) respond(403, null, 'Chỉ admin mới có quyền quản lý pipeline', false);
        $b = getBody();
        $fields = ['name','color','order_index','is_won','is_lost'];
        $sets=[]; $params=[];
        foreach ($fields as $f) { if (array_key_exists($f,$b)) { $sets[]="$f=?"; $params[]=$b[$f]; } }
        if (!$sets) respond(422, null, 'Không có dữ liệu', false);
        $params[]=$id; $params[]=$auth['tenant_id'];
        $this->db->prepare("UPDATE pipeline_stages SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?")->execute($params);
        respond(200, null, 'Đã cập nhật stage');
    }

    public function destroyStage(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin'], true)) respond(403, null, 'Chỉ admin mới có quyền quản lý pipeline', false);
        // Prevent deleting stages that have deals
        $cnt = $this->db->prepare("SELECT COUNT(*) FROM deals WHERE stage_id=? AND tenant_id=?");
        $cnt->execute([$id, $auth['tenant_id']]);
        if ($cnt->fetchColumn() > 0) respond(400, null, 'Không thể xóa stage đang có cơ hội bán hàng', false);
        
        $this->db->prepare("DELETE FROM pipeline_stages WHERE id=? AND tenant_id=?")->execute([$id, $auth['tenant_id']]);
        respond(200, null, 'Đã xóa stage thành công');
    }

    public function index(array $auth): void {
        $scope = $this->getScope($auth, 'deals', 'read');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền xem deal', false);
        }
        $tid    = $auth['tenant_id'];
        $page   = max(1,(int)($_GET['page']??1));
        $limit  = min(2000,max(10,(int)($_GET['limit']??50)));
        $offset = ($page-1)*$limit;
        $stage  = $_GET['stage_id'] ?? '';
        $owner  = $_GET['owner_id'] ?? '';
        $contactId = $_GET['contact_id'] ?? '';
        $companyId = $_GET['company_id'] ?? '';

        $where=['d.tenant_id=?', 'd.deleted_at IS NULL']; $params=[$tid];
        if ($scope === 'team') {
            $where[] = '(d.owner_id = ? OR d.owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ))';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $where[] = '(d.owner_id = ? OR d.contact_id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }
        if ($stage) { $where[]='d.stage_id=?'; $params[]=(int)$stage; }
        if ($owner) { $where[]='d.owner_id=?'; $params[]=(int)$owner; }
        if ($contactId) { $where[]='d.contact_id=?'; $params[]=(int)$contactId; }
        if ($companyId) { $where[]='d.company_id=?'; $params[]=(int)$companyId; }
        $w = implode(' AND ',$where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM deals d WHERE $w");
        $cnt->execute($params); $total=(int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT d.*,
                   ps.name as stage_name, ps.color as stage_color, ps.is_won, ps.is_lost,
                   CONCAT(c.first_name,' ',c.last_name) as contact_name,
                   comp.name as company_name,
                   u.full_name as owner_name, u.avatar_url as owner_avatar
            FROM deals d
            LEFT JOIN pipeline_stages ps ON d.stage_id=ps.id
            LEFT JOIN contacts c ON d.contact_id=c.id
            LEFT JOIN companies comp ON d.company_id=comp.id
            LEFT JOIN users u ON d.owner_id=u.id
            WHERE $w ORDER BY ps.order_index ASC, d.value DESC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $data = $stmt->fetchAll();
        foreach ($data as &$row) $row['tags'] = json_decode($row['tags']??'[]');
        respond(200,['items'=>$data,'total'=>$total,'page'=>$page,'limit'=>$limit]);
    }

    public function store(array $auth): void {
        $scope = $this->getScope($auth, 'deals', 'write');
        if ($scope === 'none') respond(403, null, 'Bạn không có quyền tạo deal', false);
        $b = getBody();
        if (empty($b['title'])) respond(422, null, 'Tiêu đề deal là bắt buộc', false);
        // Get first stage
        $stageId = $b['stage_id'] ?? null;
        if (!$stageId) {
            $s = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id=? ORDER BY order_index LIMIT 1");
            $s->execute([$auth['tenant_id']]); 
            $stageId = $s->fetchColumn();
            if (!$stageId) {
                // Self-healing fallback if database has no stage
                $this->db->prepare("INSERT INTO pipeline_stages (tenant_id, name, color, order_index) VALUES (?, 'Chưa xác định', '#3b82f6', 0)")
                         ->execute([$auth['tenant_id']]);
                $stageId = (int)$this->db->lastInsertId();
            }
        } else {
            // Validate stage_id belongs to this tenant
            $s = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $s->execute([(int)$stageId, $auth['tenant_id']]);
            if (!$s->fetch()) {
                respond(400, null, 'Giai đoạn pipeline không hợp lệ', false);
            }
        }
        $tid = $auth['tenant_id'];
        if (!empty($b['contact_id'])) {
            $c = $this->db->prepare("SELECT id FROM contacts WHERE id=? AND tenant_id=?");
            $c->execute([(int)$b['contact_id'], $tid]);
            if (!$c->fetch()) respond(404, null, 'Liên hệ không hợp lệ', false);
        }
        if (!empty($b['company_id'])) {
            $c = $this->db->prepare("SELECT id FROM companies WHERE id=? AND tenant_id=?");
            $c->execute([(int)$b['company_id'], $tid]);
            if (!$c->fetch()) respond(404, null, 'Công ty không hợp lệ', false);
        }

        $expected_close_date = empty($b['expected_close_date']) ? null : $b['expected_close_date'];

        $this->db->prepare("
            INSERT INTO deals (tenant_id,stage_id,contact_id,company_id,owner_id,created_by,
                title,description,priority,value,probability,expected_close_date,source,tags)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ")->execute([
            $auth['tenant_id'], $stageId, $b['contact_id']??null, $b['company_id']??null,
            $b['owner_id']??$auth['user_id'], $auth['user_id'],
            $b['title'], $b['description']??null, $b['priority']??'medium',
            $b['value']??0, $b['probability']??50,
            $expected_close_date, $b['source']??null,
            json_encode($b['tags']??[]),
        ]);
        $id = (int)$this->db->lastInsertId();
        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'deal', $b['custom_fields']);
        }
        // Record history
        $this->db->prepare("INSERT INTO deal_stage_history (deal_id,from_stage,to_stage,moved_by) VALUES (?,NULL,?,?)")
            ->execute([$id, $stageId, $auth['user_id']]);
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'deal', $id, json_encode(['title' => $b['title']]));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Tạo Deal mới', "Deal \"{$b['title']}\" được tạo thành công.", 'deal', $id);
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $sql = "
            SELECT d.*, ps.name as stage_name, ps.color as stage_color, ps.is_won, ps.is_lost,
                   CONCAT(c.first_name,' ',c.last_name) as contact_name,
                   comp.name as company_name, u.full_name as owner_name, u.avatar_url as owner_avatar
            FROM deals d
            LEFT JOIN pipeline_stages ps ON d.stage_id=ps.id
            LEFT JOIN contacts c ON d.contact_id=c.id
            LEFT JOIN companies comp ON d.company_id=comp.id
            LEFT JOIN users u ON d.owner_id=u.id
            WHERE d.id=? AND d.tenant_id=? AND d.deleted_at IS NULL";
        
        $p = [$id, $auth['tenant_id']];
        $scope = $this->getScope($auth, 'deals', 'read');
        if ($scope === 'all') {
            // No extra filters
        } else if ($scope === 'team') {
            $sql .= " AND (d.owner_id=? OR d.owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $sql .= ' AND (d.owner_id=? OR d.contact_id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else {
            $sql .= ' AND 1=0';
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row) respond(404, null, 'Không tìm thấy deal', false);
        $row['tags'] = json_decode($row['tags']??'[]');
        $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'deal');
        
        // Fetch stage history
        $stmtHistory = $this->db->prepare("
            SELECT h.*, u.full_name as moved_by_name, fs.name as from_stage_name, ts.name as to_stage_name
            FROM deal_stage_history h
            LEFT JOIN users u ON h.moved_by = u.id
            LEFT JOIN pipeline_stages fs ON h.from_stage = fs.id
            LEFT JOIN pipeline_stages ts ON h.to_stage = ts.id
            WHERE h.deal_id = ?
            ORDER BY h.moved_at ASC
        ");
        $stmtHistory->execute([$id]);
        $row['stage_history'] = $stmtHistory->fetchAll(PDO::FETCH_ASSOC);

        // Fetch internal notes (audit trails)
        $stmtNotes = $this->db->prepare("
            SELECT n.*, u.full_name as user_name
            FROM notes n
            LEFT JOIN users u ON n.user_id = u.id
            WHERE n.entity_type = 'deal' AND n.entity_id = ? AND n.type = 'internal'
            ORDER BY n.created_at DESC
        ");
        $stmtNotes->execute([$id]);
        $row['internal_notes'] = $stmtNotes->fetchAll(PDO::FETCH_ASSOC);

        respond(200, $row);
    }

    public function moveStage(array $auth, int $id): void {
        $b = getBody();
        if (empty($b['stage_id'])) respond(422, null, 'stage_id là bắt buộc', false);
        
        $this->db->beginTransaction();
        try {
            // Get old stage for history
            $permissionSql = "SELECT stage_id FROM deals WHERE id=? AND tenant_id=?";
            $cp = [$id, $auth['tenant_id']];
            if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
                $permissionSql .= ' AND (owner_id=? OR contact_id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
                ))';
                $cp[] = $auth['user_id'];
                $cp[] = $auth['user_id'];
            } else if ($auth['role'] === 'manager') {
                $permissionSql .= " AND (owner_id=? OR owner_id IN (
                    SELECT id FROM users WHERE team_id IN (
                        SELECT id FROM teams WHERE leader_id = ?
                    ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
                ))";
                $cp[] = $auth['user_id'];
                $cp[] = $auth['user_id'];
                $cp[] = $auth['user_id'];
            }
            $stmt = $this->db->prepare($permissionSql . " FOR UPDATE");
            $stmt->execute($cp);
            $old = $stmt->fetchColumn();
            if ($old === false) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

            $sStage = $this->db->prepare("SELECT is_won, is_lost FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            $stageInfo = $sStage->fetch();
            if (!$stageInfo) respond(404, null, 'Giai đoạn không hợp lệ', false);
            
            $setActualDate = ($stageInfo['is_won'] || $stageInfo['is_lost']) ? ", actual_close_date=CURDATE()" : ", actual_close_date=NULL";

            $sql = "UPDATE deals SET stage_id=? $setActualDate WHERE id=? AND tenant_id=?";
            $p = [$b['stage_id'], $id, $auth['tenant_id']];
            $update = $this->db->prepare($sql);
            $update->execute($p);

            if ($update->rowCount() > 0) {
                $this->db->prepare("INSERT INTO deal_stage_history (deal_id,from_stage,to_stage,moved_by) VALUES (?,?,?,?)")
                    ->execute([$id, $old, $b['stage_id'], $auth['user_id']]);
                
                $note = $b['note'] ?? '';
                logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'system', 'Chuyển giai đoạn Deal', "Deal đã được chuyển sang giai đoạn mới." . ($note ? " Ghi chú: " . $note : ""), 'deal', $id);
                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'MOVE_STAGE', 'deal', $id, json_encode(['from_stage' => $old, 'to_stage' => $b['stage_id'], 'note' => $note]));

                // Update contact temperature to hot if deal is won (Sôi = xuống tiền)
                if ($stageInfo['is_won']) {
                    $stmtCId = $this->db->prepare("SELECT contact_id FROM deals WHERE id = ?");
                    $stmtCId->execute([$id]);
                    $contactId = $stmtCId->fetchColumn();
                    if ($contactId) {
                        $this->db->prepare("UPDATE contacts SET status = 'customer', temperature = 'hot', suggested_temperature = 'hot' WHERE id = ? AND tenant_id = ?")
                                 ->execute([$contactId, $auth['tenant_id']]);
                    }
                }
            }
            
            $this->db->commit();
            respond(200, null, 'Đã cập nhật stage thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    public function update(array $auth, int $id): void {
        $scope = $this->getScope($auth, 'deals', 'write');
        if ($scope === 'none') respond(403, null, 'Bạn không có quyền cập nhật deal', false);
        $b = getBody();
        $fields = ['stage_id','contact_id','company_id','owner_id','title','description','priority','value',
                   'probability','expected_close_date','source','lost_reason'];
        $sets=[]; $params=[];
        foreach ($fields as $f) { 
            if (array_key_exists($f, $b)) { 
                $sets[] = "$f=?"; 
                if ($f === 'expected_close_date' && $b[$f] === '') {
                    $params[] = null;
                } else {
                    $params[] = $b[$f]; 
                }
            } 
        }
        if (isset($b['tags'])) { $sets[]='tags=?'; $params[]=json_encode($b['tags']); }
        if (!$sets && !isset($b['custom_fields'])) respond(422, null, 'Không có dữ liệu để cập nhật', false);

        $tid = $auth['tenant_id'];
        if (!empty($b['contact_id'])) {
            $c = $this->db->prepare("SELECT id FROM contacts WHERE id=? AND tenant_id=?");
            $c->execute([(int)$b['contact_id'], $tid]);
            if (!$c->fetch()) respond(404, null, 'Liên hệ không hợp lệ', false);
        }
        if (!empty($b['company_id'])) {
            $c = $this->db->prepare("SELECT id FROM companies WHERE id=? AND tenant_id=?");
            $c->execute([(int)$b['company_id'], $tid]);
            if (!$c->fetch()) respond(404, null, 'Công ty không hợp lệ', false);
        }

        if (array_key_exists('stage_id', $b)) {
            $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);
        }

        // Check permission first and get old stage
        $permissionSql = "SELECT id, stage_id FROM deals WHERE id=? AND tenant_id=?";
        $cp = [$id, $auth['tenant_id']];
        if ($scope === 'all') {
            // No extra filters
        } else if ($scope === 'team') {
            $permissionSql .= " AND (owner_id=? OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ))";
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $permissionSql .= ' AND (owner_id=? OR contact_id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
        } else {
            $permissionSql .= ' AND 1=0';
        }
        $check = $this->db->prepare($permissionSql);
        $check->execute($cp);
        $oldDeal = $check->fetch();
        if (!$oldDeal) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

        if (array_key_exists('stage_id', $b) && $b['stage_id'] != $oldDeal['stage_id']) {
            $sStageInfo = $this->db->prepare("SELECT is_won, is_lost FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $sStageInfo->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            $sI = $sStageInfo->fetch();
            if ($sI && ($sI['is_won'] || $sI['is_lost'])) {
                $sets[] = "actual_close_date=CURDATE()";
            } else {
                $sets[] = "actual_close_date=NULL";
            }
        }

        if ($sets) {
            $params[]=$id; $params[]=$auth['tenant_id'];
            $stmt = $this->db->prepare("UPDATE deals SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?");
            $stmt->execute($params);
        }
        
        if (array_key_exists('stage_id', $b) && $b['stage_id'] != $oldDeal['stage_id']) {
            $this->db->prepare("INSERT INTO deal_stage_history (deal_id,from_stage,to_stage,moved_by) VALUES (?,?,?,?)")
                     ->execute([$id, $oldDeal['stage_id'], $b['stage_id'], $auth['user_id']]);
        }
        
        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'deal', $b['custom_fields']);
        }
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'deal', $id, json_encode(['title' => $oldDeal['title']]));
        $this->show($auth, $id);
    }

    public function destroy(array $auth, int $id): void {
        $scope = $this->getScope($auth, 'deals', 'delete');
        if ($scope === 'none') respond(403, null, 'Bạn không có quyền xóa deal', false);
        
        $sql = "UPDATE deals SET deleted_at=NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if ($scope === 'team') {
            $sql .= " AND (owner_id=? OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE leader_id = ?
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $sql .= " AND owner_id=?";
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy deal hoặc không có quyền xóa', false);
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'deal', $id, json_encode(['id' => $id]));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Xóa Deal', "Một cơ hội bán hàng đã bị xóa.", 'deal', $id);
        respond(200, null, 'Đã xóa deal (vào thùng rác)');
    }

    public function bulkDelete(array $auth): void {
        if (in_array($auth['role'], ['sales', 'viewer'], true)) respond(403, null, 'Bạn không có quyền xóa deal', false);
        $b = getBody();
        $ids = $b['ids'] ?? [];
        if (empty($ids)) respond(400, null, 'ID không hợp lệ', false);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        
        $sql = "UPDATE deals SET deleted_at=NOW() WHERE tenant_id=? AND id IN ($placeholders)";
        $p = array_merge([$auth['tenant_id']], $ids);
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'BULK_DELETE', 'deal', null, json_encode(['ids' => $ids]));
        respond(200, null, "Đã xóa " . $stmt->rowCount() . " deal");
    }

    public function switchUnit(array $auth, int $id): void {
        if (in_array($auth['role'], ['viewer'])) respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $b = getBody();
        $newUnitCode = trim($b['new_unit_code'] ?? '');
        $newPrice = (float)($b['new_price'] ?? 0);
        $newProjectId = (int)($b['new_project_id'] ?? 0);
        $reason = trim($b['reason'] ?? 'Đổi căn hộ giao dịch');

        if (empty($newUnitCode) || $newPrice <= 0) {
            respond(422, null, 'Thiếu thông tin căn hộ mới hoặc giá bán mới', false);
        }

        $this->db->beginTransaction();
        try {
            // 1. Fetch old deal and check owner
            $stmt = $this->db->prepare("SELECT * FROM deals WHERE id=? AND tenant_id=? AND deleted_at IS NULL FOR UPDATE");
            $params = [$id, $auth['tenant_id']];
            $stmt->execute($params);
            $oldDeal = $stmt->fetch();
            if (!$oldDeal) respond(404, null, 'Không tìm thấy deal cũ', false);

            if ($auth['role'] === 'sales' && $oldDeal['owner_id'] != $auth['user_id']) {
                respond(403, null, 'Bạn không có quyền đổi căn cho deal của người khác', false);
            }

            // 2. Resolve lost stage for the old deal
            $stmtLost = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND is_lost = 1 LIMIT 1");
            $stmtLost->execute([$auth['tenant_id']]);
            $lostStageId = $stmtLost->fetchColumn();
            if (!$lostStageId) {
                // Self-healing fallback if no lost stage exists
                $stmtStages = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? ORDER BY order_index DESC LIMIT 1");
                $stmtStages->execute([$auth['tenant_id']]);
                $lostStageId = $stmtStages->fetchColumn() ?: $oldDeal['stage_id'];
            }

            // 3. Close the old deal
            $stmtClose = $this->db->prepare("UPDATE deals SET stage_id = ?, lost_reason = 'Unit Switch', actual_close_date = CURDATE() WHERE id = ?");
            $stmtClose->execute([$lostStageId, $id]);

            // Add history record for the old deal closing
            $this->db->prepare("INSERT INTO deal_stage_history (deal_id, from_stage, to_stage, moved_by) VALUES (?, ?, ?, ?)")
                     ->execute([$id, $oldDeal['stage_id'], $lostStageId, $auth['user_id']]);

            // 4. Create new deal
            $newTitle = "[Đổi căn] " . preg_replace('/(\[Đổi căn\]\s*)+/i', '', $oldDeal['title']);
            // Replace old unit code in title if it exists, or just use new unit code
            if (strpos($newTitle, $oldDeal['title']) !== false) {
                $newTitle = "Giao dịch căn " . $newUnitCode . " - " . ($newProjectId ? "Dự án mới" : "Dự án");
            } else {
                $newTitle = preg_replace('/căn\s+[a-zA-Z0-9_-]+/i', "căn " . $newUnitCode, $newTitle);
            }

            $stmtNewDeal = $this->db->prepare("
                INSERT INTO deals (tenant_id, stage_id, contact_id, company_id, owner_id, created_by,
                    title, description, priority, value, probability, source, tags, switched_from_deal_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtNewDeal->execute([
                $auth['tenant_id'],
                $oldDeal['stage_id'], // start at the same stage
                $oldDeal['contact_id'],
                $oldDeal['company_id'],
                $oldDeal['owner_id'],
                $auth['user_id'],
                $newTitle,
                "Đổi từ căn cũ (Deal ID: $id). Lý do: " . $reason,
                $oldDeal['priority'],
                $newPrice,
                $oldDeal['probability'],
                $oldDeal['source'],
                $oldDeal['tags'],
                $id // switched_from_deal_id
            ]);
            $newDealId = (int)$this->db->lastInsertId();

            // Insert into history for the new deal
            $this->db->prepare("INSERT INTO deal_stage_history (deal_id, from_stage, to_stage, moved_by) VALUES (?, NULL, ?, ?)")
                     ->execute([$newDealId, $oldDeal['stage_id'], $auth['user_id']]);

            // 5. Add audit trail notes to both deals
            $auditNoteOld = "Khách hàng đổi sang căn hộ mới $newUnitCode (Deal ID mới: $newDealId). Đã đóng giao dịch cũ theo chính sách đổi căn.";
            $auditNoteNew = "Yêu cầu đổi căn hộ từ deal cũ (Deal ID: $id) sang căn mới $newUnitCode. Lý do: $reason. Giữ vết kiểm toán và lịch sử phí.";

            $stmtNote = $this->db->prepare("INSERT INTO notes (tenant_id, user_id, entity_type, entity_id, body, type) VALUES (?, ?, 'deal', ?, ?, 'internal')");
            $stmtNote->execute([$auth['tenant_id'], $auth['user_id'], $id, $auditNoteOld]);
            $stmtNote->execute([$auth['tenant_id'], $auth['user_id'], $newDealId, $auditNoteNew]);

            // 6. Handle deposits change if exists
            if ($oldDeal['contact_id']) {
                $stmtDep = $this->db->prepare("SELECT id, project_id FROM deposits WHERE contact_id = ? AND status != 'cancelled' ORDER BY id DESC LIMIT 1");
                $stmtDep->execute([$oldDeal['contact_id']]);
                $oldDep = $stmtDep->fetch();
                if ($oldDep) {
                    // Mark old deposit as cancelled/switched
                    $stmtCancelDep = $this->db->prepare("UPDATE deposits SET status = 'cancelled', cancelled_reason = ? WHERE id = ?");
                    $stmtCancelDep->execute(["Đổi sang căn mới $newUnitCode (Deal ID: $newDealId)", $oldDep['id']]);

                    // Insert new deposit
                    $targetProjId = $newProjectId ?: $oldDep['project_id'];
                    $stmtNewDep = $this->db->prepare("
                        INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by)
                        VALUES (?, ?, ?, ?, ?, 'pending_admin', ?)
                    ");
                    // standard commission is 3% if not set
                    $comm = $newPrice * 0.03;
                    $stmtNewDep->execute([
                        $oldDeal['contact_id'],
                        $targetProjId,
                        $newUnitCode,
                        $newPrice,
                        $comm,
                        $auth['user_id']
                    ]);
                    $newDepId = (int)$this->db->lastInsertId();

                    // Create first milestone for the new deposit
                    $this->db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status) VALUES (?, 'Đợt 1 - Cọc giữ chỗ (Đổi căn)', ?, 'pending')")
                             ->execute([$newDepId, $newPrice]);
                }
            }

            $this->db->commit();
            logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Đổi căn hộ', "Đã đổi từ deal $id sang deal $newDealId cho căn hộ mới $newUnitCode.", 'deal', $newDealId);
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'SWITCH_UNIT', 'deal', $id, json_encode(['old_deal_id' => $id, 'new_deal_id' => $newDealId, 'new_unit_code' => $newUnitCode, 'reason' => $reason]));
            respond(200, ['new_deal_id' => $newDealId], 'Đổi căn hộ thành công, hệ thống đã đóng deal cũ và tạo deal mới lưu vết kiểm toán.');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi đổi căn: ' . $e->getMessage(), false);
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
