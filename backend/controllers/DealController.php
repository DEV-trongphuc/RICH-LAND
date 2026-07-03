<?php
// f:\CRM\backend\controllers\DealController.php

class DealController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function stages(array $auth): void {
        $tid = $auth['tenant_id'];
        $sql = "
            SELECT ps.*, 
                   (
                     (SELECT COUNT(*) FROM contacts c WHERE c.stage_id = ps.id AND c.deleted_at IS NULL AND c.tenant_id = :tid1 ".(($auth['role'] === 'sales') ? " AND c.owner_id = :uid1" : "").") +
                     (SELECT COUNT(*) FROM companies comp WHERE comp.stage_id = ps.id AND comp.deleted_at IS NULL AND comp.tenant_id = :tid2 ".(($auth['role'] === 'sales') ? " AND comp.owner_id = :uid2" : "").")
                   ) as deals
            FROM pipeline_stages ps
            WHERE ps.tenant_id = :tid3
            ORDER BY ps.order_index
        ";
        $p = ['tid1' => $tid, 'tid2' => $tid, 'tid3' => $tid];
        if ($auth['role'] === 'sales') {
            $p['uid1'] = $auth['user_id'];
            $p['uid2'] = $auth['user_id'];
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function storeStage(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'super_admin'], true)) respond(403, null, 'Chỉ admin mới có quyền quản lý pipeline', false);
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
        if (!in_array($auth['role'], ['admin', 'super_admin'], true)) respond(403, null, 'Chỉ admin mới có quyền quản lý pipeline', false);
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
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xem deal', false);
        $tid    = $auth['tenant_id'];
        $page   = max(1,(int)($_GET['page']??1));
        $limit  = min(2000,max(10,(int)($_GET['limit']??50)));
        $offset = ($page-1)*$limit;
        $stage  = $_GET['stage_id'] ?? '';
        $owner  = $_GET['owner_id'] ?? '';
        $contactId = $_GET['contact_id'] ?? '';
        $companyId = $_GET['company_id'] ?? '';

        $where=['d.tenant_id=?', 'd.deleted_at IS NULL']; $params=[$tid];
        if (in_array($auth['role'], ['sales', 'sale'], true) && !$contactId && !$companyId) {
            $where[] = 'd.owner_id = ?';
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
        if (in_array($auth['role'], ['viewer'])) respond(403, null, 'Bạn không có quyền tạo deal', false);
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
        
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Tạo Deal mới', "Deal \"{$b['title']}\" được tạo thành công.", 'deal', $id);
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $sql = "
            SELECT d.*, ps.name as stage_name, ps.color as stage_color, ps.is_won, ps.is_lost,
                   CONCAT(c.first_name,' ',c.last_name) as contact_name,
                   comp.name as company_name, u.full_name as owner_name
            FROM deals d
            LEFT JOIN pipeline_stages ps ON d.stage_id=ps.id
            LEFT JOIN contacts c ON d.contact_id=c.id
            LEFT JOIN companies comp ON d.company_id=comp.id
            LEFT JOIN users u ON d.owner_id=u.id
            WHERE d.id=? AND d.tenant_id=? AND d.deleted_at IS NULL";
        
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') {
            $sql .= " AND d.owner_id=?";
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row) respond(404, null, 'Không tìm thấy deal', false);
        $row['tags'] = json_decode($row['tags']??'[]');
        $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'deal');
        respond(200, $row);
    }

    public function moveStage(array $auth, int $id): void {
        $b = getBody();
        if (empty($b['stage_id'])) respond(422, null, 'stage_id là bắt buộc', false);
        
        $this->db->beginTransaction();
        try {
            // Get old stage for history
            $stmt = $this->db->prepare("SELECT stage_id FROM deals WHERE id=? AND tenant_id=? " . ($auth['role'] === 'sales' ? " AND owner_id=?" : "") . " FOR UPDATE");
            $cp = [$id, $auth['tenant_id']];
            if ($auth['role'] === 'sales') $cp[] = $auth['user_id'];
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
            if ($auth['role'] === 'sales') {
                $sql .= " AND owner_id=?";
                $p[] = $auth['user_id'];
            }
            $update = $this->db->prepare($sql);
            $update->execute($p);

            if ($update->rowCount() > 0) {
                $this->db->prepare("INSERT INTO deal_stage_history (deal_id,from_stage,to_stage,moved_by) VALUES (?,?,?,?)")
                    ->execute([$id, $old, $b['stage_id'], $auth['user_id']]);
                
                $note = $b['note'] ?? '';
                logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Chuyển giai đoạn Deal', "Deal đã được chuyển sang giai đoạn mới." . ($note ? " Ghi chú: " . $note : ""), 'deal', $id);
                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'MOVE_STAGE', 'deal', $id, json_encode(['from_stage' => $old, 'to_stage' => $b['stage_id'], 'note' => $note]));
            }
            
            $this->db->commit();
            respond(200, null, 'Đã cập nhật stage thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    public function update(array $auth, int $id): void {
        if (in_array($auth['role'], ['viewer'])) respond(403, null, 'Bạn không có quyền cập nhật deal', false);
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
        $check = $this->db->prepare("SELECT id, stage_id FROM deals WHERE id=? AND tenant_id=? " . ($auth['role'] === 'sales' ? " AND owner_id=?" : ""));
        $cp = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') $cp[] = $auth['user_id'];
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
        
        $this->show($auth, $id);
    }

    public function destroy(array $auth, int $id): void {
        if (in_array($auth['role'], ['sales', 'viewer'], true)) respond(403, null, 'Bạn không có quyền xóa deal', false);
        $sql = "UPDATE deals SET deleted_at=NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy deal', false);
        
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
        respond(200, null, "Đã xóa " . $stmt->rowCount() . " deal");
    }
}
