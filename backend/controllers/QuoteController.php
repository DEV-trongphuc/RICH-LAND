<?php
class QuoteController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';
        $contactId = $_GET['contact_id'] ?? '';
        $from   = $_GET['from'] ?? '';
        $to     = $_GET['to'] ?? '';
        
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);
        
        $scope = $this->getScope($auth, 'quotes', 'read');
        if ($scope === 'none') respond(403, null, 'Bạn không có quyền xem báo giá', false);

        // Load team members if team scope
        $userIds = [$uid];
        if ($scope === 'team') {
            $stmtTeam = $this->db->prepare("SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?)");
            $stmtTeam->execute([$uid, $uid]);
            $teamMemberIds = $stmtTeam->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $userIds = array_merge($userIds, array_map('intval', $teamMemberIds));
        }

        $where  = ['q.tenant_id = ?'];
        $params = [$tid];

        if ($contactId) {
            $where[] = 'q.contact_id = ?';
            $params[] = (int)$contactId;
        }

        if ($scope === 'own') {
            if ($contactId) {
                $stmtContact = $this->db->prepare("SELECT owner_id FROM contacts WHERE id = ? AND tenant_id = ?");
                $stmtContact->execute([(int)$contactId, $tid]);
                $ownerId = $stmtContact->fetchColumn();
                if ($ownerId && (int)$ownerId !== $uid) {
                    respond(403, null, 'Bạn không có quyền xem báo giá của liên hệ này', false);
                }
            } else {
                $where[] = 'q.created_by = ?';
                $params[] = $uid;
            }
        } else if ($scope === 'team') {
            if ($contactId) {
                $stmtContact = $this->db->prepare("SELECT owner_id FROM contacts WHERE id = ? AND tenant_id = ?");
                $stmtContact->execute([(int)$contactId, $tid]);
                $ownerId = $stmtContact->fetchColumn();
                if ($ownerId && !in_array((int)$ownerId, $userIds, true)) {
                    respond(403, null, 'Bạn không có quyền xem báo giá của liên hệ này', false);
                }
            } else {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $where[] = "q.created_by IN ($placeholders)";
                $params = array_merge($params, $userIds);
            }
        }

        if ($status) { $where[] = 'q.status = ?'; $params[] = $status; }
        if ($from)   { $where[] = 'q.created_at >= ?'; $params[] = $from . " 00:00:00"; }
        if ($to)     { $where[] = 'q.created_at <= ?'; $params[] = $to . " 23:59:59"; }
        if ($search) {
            $where[] = '(q.quote_number LIKE ? OR q.title LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)';
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $w = implode(' AND ', $where);

        // Total count
        $cnt = $this->db->prepare("SELECT COUNT(*) FROM quotes q LEFT JOIN contacts c ON q.contact_id = c.id WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        // Summary totals
        $sumStmt = $this->db->prepare("
            SELECT 
                COALESCE(SUM(q.total), 0) as total_val,
                COALESCE(SUM(CASE WHEN q.status = 'accepted' THEN q.total END), 0) as accepted_val,
                COUNT(CASE WHEN q.status = 'sent' THEN 1 END) as sent_count,
                COUNT(CASE WHEN q.status = 'accepted' THEN 1 END) as accepted_count,
                COUNT(*) as total_count
            FROM quotes q 
            LEFT JOIN contacts c ON q.contact_id = c.id
            WHERE $w
        ");
        $sumStmt->execute($params);
        $summary = $sumStmt->fetch();

        // List items
        $sql = "SELECT q.*, u.full_name as created_by_name, CONCAT(c.first_name,' ',c.last_name) as contact_name 
                FROM quotes q 
                LEFT JOIN users u ON q.created_by = u.id 
                LEFT JOIN contacts c ON q.contact_id = c.id 
                WHERE $w 
                ORDER BY q.created_at DESC 
                LIMIT $limit OFFSET $offset";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        respond(200, [
            'items' => $stmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'summary' => $summary
        ]);
    }
    public function store(array $auth): void {
        $scope = $this->getScope($auth, 'quotes', 'write');
        if ($scope === 'none') respond(403, null, 'Bạn không có quyền tạo báo giá', false);
        
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);

        $b=getBody(); if(empty($b['title'])) respond(422,null,'Tiêu đề là bắt buộc',false);
        if (($b['total'] ?? 0) < 0) respond(422, null, 'Tổng tiền báo giá không được âm', false);
        
        // Verify contact belongs to tenant and is accessible
        if (!empty($b['contact_id'])) {
            $leadsReadScope = $this->getScope($auth, 'leads', 'read');
            $sqlContact = "SELECT id FROM contacts WHERE id=? AND tenant_id=?";
            $pContact = [(int)$b['contact_id'], $tid];
            if ($leadsReadScope === 'own') {
                $sqlContact .= " AND owner_id=?";
                $pContact[] = $uid;
            } else if ($leadsReadScope === 'team') {
                $sqlContact .= " AND (owner_id = ? OR owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?)))";
                $pContact[] = $uid;
                $pContact[] = $uid;
                $pContact[] = $uid;
            } else if ($leadsReadScope === 'none') {
                $sqlContact .= " AND 1=0";
            }
            $c = $this->db->prepare($sqlContact);
            $c->execute($pContact);
            if (!$c->fetch()) $b['contact_id'] = null;
        }

        // Verify deal belongs to tenant and is accessible
        if (!empty($b['deal_id'])) {
            $sqlDeal = "SELECT id FROM deals WHERE id=? AND tenant_id=?";
            $pDeal = [(int)$b['deal_id'], $tid];
            if ($isSale) {
                $sqlDeal .= " AND owner_id=?";
                $pDeal[] = $uid;
            } else if ($isManager) {
                $sqlDeal .= " AND (owner_id = ? OR owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?)))";
                $pDeal[] = $uid;
                $pDeal[] = $uid;
                $pDeal[] = $uid;
            }
            $d = $this->db->prepare($sqlDeal);
            $d->execute($pDeal);
            if (!$d->fetch()) $b['deal_id'] = null;
        }

        // Generate robust quote number
        $qNum = 'QT-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(2)));
        $validUntil = empty($b['valid_until']) ? null : $b['valid_until'];
        $this->db->prepare("INSERT INTO quotes (tenant_id,deal_id,contact_id,created_by,quote_number,title,status,subtotal,discount,tax,total,valid_until,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([$tid,$b['deal_id']??null,$b['contact_id']??null,$uid,$qNum,$b['title'],$b['status']??'draft',$b['subtotal']??0,$b['discount']??0,$b['tax']??0,$b['total']??0,$validUntil,$b['notes']??null]);
        $qid=(int)$this->db->lastInsertId();
        if(!empty($b['items'])) {
            $ins=$this->db->prepare("INSERT INTO quote_items (quote_id,product_id,name,description,quantity,unit_price,discount,subtotal,sort_order) VALUES (?,?,?,?,?,?,?,?,?)");
            foreach($b['items'] as $i=>$item) {
                $qty = (float)($item['quantity'] ?? 1.0);
                $price = (float)($item['unit_price'] ?? 0);
                if ($qty <= 0 || $price < 0) {
                    throw new Exception('Số lượng sản phẩm phải lớn hơn 0 và đơn giá không được âm');
                }

                if (!empty($item['product_id'])) {
                    $prodCheck = $this->db->prepare("SELECT id FROM products WHERE id=? AND tenant_id=?");
                    $prodCheck->execute([(int)$item['product_id'], $tid]);
                    if (!$prodCheck->fetch()) {
                        throw new Exception("Sản phẩm ID {$item['product_id']} không hợp lệ hoặc không thuộc cửa hàng của bạn");
                    }
                }

                $ins->execute([$qid,$item['product_id']??null,$item['name'],$item['description']??null,$qty,$price,$item['discount']??0,$item['subtotal']??0,$i]);
            }
        }

        // Log interaction if sent
        if (($b['status'] ?? 'draft') === 'sent' && !empty($b['contact_id'])) {
            logInteraction($this->db, $tid, $uid, 'email', "Gửi Báo giá #$qNum", "Báo giá \"{$b['title']}\" đã được gửi cho khách hàng.", 'quote', $qid);
        }

        $this->show($auth,$qid);
    }
    public function show(array $auth,int $id): void {
        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);
        
        $isSale = $role === 'sales' || $role === 'sale';
        $isManager = $role === 'manager';

        $sql = "SELECT q.*,u.full_name as created_by_name FROM quotes q LEFT JOIN users u ON q.created_by=u.id WHERE q.id=? AND q.tenant_id=?";
        $p = [$id, $tid];
        if ($isSale) {
            $sql .= " AND q.created_by=?";
            $p[] = $uid;
        } else if ($isManager) {
            $sql .= " AND (q.created_by = ? OR q.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?)))";
            $p[] = $uid;
            $p[] = $uid;
            $p[] = $uid;
        }
        $stmt=$this->db->prepare($sql);
        $stmt->execute($p); $q=$stmt->fetch();
        if(!$q) respond(404,null,'Không tìm thấy báo giá hoặc không có quyền',false);
        $items=$this->db->prepare("SELECT qi.*,p.name as product_name FROM quote_items qi LEFT JOIN products p ON qi.product_id=p.id WHERE qi.quote_id=? ORDER BY sort_order");
        $items->execute([$id]);
        $q['items']=$items->fetchAll();
        respond(200,$q);
    }
    public function update(array $auth,int $id): void {
        $scope = $this->getScope($auth, 'quotes', 'write');
        if ($scope === 'none') respond(403, null, 'Bạn không có quyền cập nhật báo giá', false);
        
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);

        $b=getBody(); $fields=['title','status','subtotal','discount','tax','total','valid_until','notes','terms'];
        $sets=[];$params=[];
        foreach($fields as $f){
            if(array_key_exists($f,$b)){
                $sets[]="$f=?";
                if ($f === 'valid_until' && $b[$f] === '') {
                    $params[] = null;
                } else {
                    $params[] = $b[$f];
                }
            }
        }
        if($sets){
            if (isset($b['contact_id']) && $b['contact_id']) {
                $leadsReadScope = $this->getScope($auth, 'leads', 'read');
                $sqlContact = "SELECT id FROM contacts WHERE id=? AND tenant_id=?";
                $pContact = [(int)$b['contact_id'], $tid];
                if ($leadsReadScope === 'own') {
                    $sqlContact .= " AND owner_id=?";
                    $pContact[] = $uid;
                } else if ($leadsReadScope === 'team') {
                    $sqlContact .= " AND (owner_id = ? OR owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?)))";
                    $pContact[] = $uid;
                    $pContact[] = $uid;
                    $pContact[] = $uid;
                } else if ($leadsReadScope === 'none') {
                    $sqlContact .= " AND 1=0";
                }
                $c = $this->db->prepare($sqlContact);
                $c->execute($pContact);
                if (!$c->fetch()) respond(403, null, 'Không có quyền thao tác trên liên hệ này', false);
            }
            if (isset($b['deal_id']) && $b['deal_id']) {
                $dealsReadScope = $this->getScope($auth, 'deals', 'read');
                $sqlDeal = "SELECT id FROM deals WHERE id=? AND tenant_id=?";
                $pDeal = [(int)$b['deal_id'], $tid];
                if ($dealsReadScope === 'own') {
                    $sqlDeal .= " AND owner_id=?";
                    $pDeal[] = $uid;
                } else if ($dealsReadScope === 'team') {
                    $sqlDeal .= " AND (owner_id = ? OR owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?)))";
                    $pDeal[] = $uid;
                    $pDeal[] = $uid;
                    $pDeal[] = $uid;
                } else if ($dealsReadScope === 'none') {
                    $sqlDeal .= " AND 1=0";
                }
                $c = $this->db->prepare($sqlDeal);
                $c->execute($pDeal);
                if (!$c->fetch()) respond(403, null, 'Không có quyền thao tác trên deal này', false);
            }
            
            // Get old status to check for transition
            $old = $this->db->prepare("SELECT status, contact_id, quote_number, title FROM quotes WHERE id=? AND tenant_id=?");
            $old->execute([$id, $tid]);
            $oldData = $old->fetch();

            $sql = "UPDATE quotes SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?";
            $params[]=$id;$params[]=$tid;
            if ($scope === 'own') {
                $sql .= " AND created_by=?";
                $params[] = $uid;
            } else if ($scope === 'team') {
                $sql .= " AND (created_by = ? OR created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?)))";
                $params[] = $uid;
                $params[] = $uid;
                $params[] = $uid;
            }
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

            // Log interaction if status changed to 'sent'
            if ($oldData && $oldData['status'] !== 'sent' && ($b['status'] ?? '') === 'sent' && ($b['contact_id'] ?? $oldData['contact_id'])) {
                $cid = $b['contact_id'] ?? $oldData['contact_id'];
                $qNum = $oldData['quote_number'];
                $title = $b['title'] ?? $oldData['title'];
                logInteraction($this->db, $tid, $uid, 'email', "Gửi Báo giá #$qNum", "Báo giá \"$title\" đã được gửi cho khách hàng.", 'quote', $id);
            }
        }
        respond(200,null,'Đã cập nhật báo giá');
    }
    public function convert(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        
        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);
        
        $isSale = $role === 'sales' || $role === 'sale';
        $isManager = $role === 'manager';
        
        $this->db->beginTransaction();
        try {
            // 1. Get quote and items with permission check
            $sql = "SELECT * FROM quotes WHERE id=? AND tenant_id=?";
            $p = [$id, $tid];
            if ($isSale) {
                $sql .= " AND created_by=?";
                $p[] = $uid;
            } else if ($isManager) {
                $sql .= " AND (created_by = ? OR created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?)))";
                $p[] = $uid;
                $p[] = $uid;
                $p[] = $uid;
            }
            $stmt = $this->db->prepare($sql . " FOR UPDATE");
            $stmt->execute($p);
            $q = $stmt->fetch();
            if (!$q) throw new Exception('Không tìm thấy báo giá hoặc bạn không có quyền');
            if ($q['status'] === 'invoiced') throw new Exception('Báo giá này đã được chuyển thành hóa đơn trước đó');

            $itemsStmt = $this->db->prepare("SELECT * FROM quote_items WHERE quote_id=?");
            $itemsStmt->execute([$id]);
            $items = $itemsStmt->fetchAll();

            // 2. Create Invoice
            $invNum = 'INV-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
            $insInv = $this->db->prepare("
                INSERT INTO invoices (tenant_id, contact_id, created_by, invoice_number, title, status, issue_date, due_date, subtotal, discount, tax, total, notes)
                VALUES (?, ?, ?, ?, ?, 'pending', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), ?, ?, ?, ?, ?)
            ");
            $insInv->execute([
                $tid, $q['contact_id'], $uid, $invNum, "Hóa đơn từ báo giá: " . $q['title'],
                $q['subtotal'], $q['discount'], $q['tax'], $q['total'], $q['notes']
            ]);
            $invId = $this->db->lastInsertId();

            // 3. Create Invoice Items
            $insItem = $this->db->prepare("INSERT INTO invoice_items (invoice_id, product_id, name, quantity, unit_price, discount, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)");
            foreach ($items as $item) {
                $insItem->execute([
                    $invId, $item['product_id'], $item['name'], $item['quantity'], $item['unit_price'], $item['discount'], $item['subtotal']
                ]);
            }

            // 4. Update Quote Status
            $this->db->prepare("UPDATE quotes SET status='invoiced' WHERE id=?")->execute([$id]);

            // 5. Log Activity
            logInteraction($this->db, $tid, $uid, 'task', "Chuyển Báo giá thành Hóa đơn", "Báo giá #{$q['quote_number']} đã được chuyển thành hóa đơn #$invNum", 'quote', $id);

            $this->db->commit();
            respond(200, ['invoice_id' => $invId], 'Đã chuyển báo giá thành hóa đơn thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    public function destroy(array $auth,int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        
        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);
        
        $scope = $this->getScope($auth, 'quotes', 'delete');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền xóa báo giá', false);
        }

        $sql = "DELETE FROM quotes WHERE id=? AND tenant_id=?";
        $p = [$id, $tid];
        if ($scope === 'team') {
            $sql .= " AND (created_by = ? OR created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?)))";
            $p[] = $uid;
            $p[] = $uid;
            $p[] = $uid;
        } else if ($scope === 'own') {
            $sql .= " AND created_by=?";
            $p[] = $uid;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);
        respond(200,null,'Đã xóa báo giá');
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

        if (in_array($auth['role'], ['sale', 'sales'], true) && $module === 'deals') {
            return $action === 'delete' ? 'none' : 'own';
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
        if ($role === 'director') {
            if ($module === 'settings') {
                return 'none';
            }
            return 'all';
        }
        if ($role === 'assistant') {
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
