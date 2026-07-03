<?php
// f:\CRM\backend\controllers\FinanceController.php

class FinanceController
{
    private PDO $db;
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    private function syncContactStats(int $tid, ?int $contactId): void
    {
        if (!$contactId)
            return;
        
        $sInv = $this->db->prepare("SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count, MAX(paid_at) as last_at FROM invoices WHERE contact_id = ? AND status = 'paid' AND deleted_at IS NULL");
        $sInv->execute([$contactId]);
        $inv = $sInv->fetch();

        $sExp = $this->db->prepare("SELECT COALESCE(SUM(ee.amount),0) as total, COUNT(*) as count, MAX(e.approved_at) as last_at FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = ? AND e.status = 'approved' AND e.deleted_at IS NULL");
        $sExp->execute([$contactId]);
        $exp = $sExp->fetch();

        $totalSpent = (float)$inv['total'] + (float)$exp['total'];
        $orderCount = (int)$inv['count'] + (int)$exp['count'];
        
        $lastOrderAt = null;
        if ($inv['last_at'] || $exp['last_at']) {
            $lastOrderAt = ($inv['last_at'] && (!$exp['last_at'] || $inv['last_at'] > $exp['last_at'])) ? $inv['last_at'] : $exp['last_at'];
        }

        $stmt = $this->db->prepare("
            UPDATE contacts 
            SET 
                total_spent = ?,
                order_count = ?,
                last_order_at = ?,
                status = CASE WHEN ? > 0 THEN 'customer' ELSE status END
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$totalSpent, $orderCount, $lastOrderAt, $orderCount, $contactId, $tid]);
    }

    private function syncInvoiceContact(int $tid, int $invId): void
    {
        $stmt = $this->db->prepare("SELECT contact_id FROM invoices WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$invId, $tid]);
        $cid = $stmt->fetchColumn();
        if ($cid)
            $this->syncContactStats($tid, (int) $cid);
    }

    private function syncExpenseContacts(int $tid, int $expId): void
    {
        $stmt = $this->db->prepare("SELECT entity_id FROM expense_entities WHERE expense_id = ? AND entity_type = 'contact'");
        $stmt->execute([$expId]);
        $contactIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        foreach ($contactIds as $cid) {
            $this->syncContactStats($tid, (int)$cid);
        }
    }

    // ─────────────────────── INVOICES ───────────────────────────

    public function listInvoices(array $auth): void
    {
        $tid = $auth['tenant_id'];
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $limit = min(100, max(10, (int) ($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';
        $contactId = $_GET['contact_id'] ?? '';
        $where = ['i.tenant_id=?', 'i.deleted_at IS NULL'];
        $params = [$tid];
        if ($contactId) {
            $where[] = 'i.contact_id = ?';
            $params[] = (int)$contactId;
        }
        if ($auth['role'] === 'sales') {
            $where[] = 'i.created_by = ?';
            $params[] = $auth['user_id'];
        }
        if ($status) {
            $where[] = 'i.status=?';
            $params[] = $status;
        }
        if ($search) {
            $where[] = '(i.invoice_number LIKE ? OR ct.first_name LIKE ? OR ct.last_name LIKE ?)';
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM invoices i LEFT JOIN contacts ct ON i.contact_id = ct.id WHERE $w");
        $cnt->execute($params);
        $total = (int) $cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT i.*, c.name as company_name,
                   CASE WHEN ct.deleted_at IS NULL THEN CONCAT(ct.first_name,' ',ct.last_name) 
                        ELSE CONCAT(ct.first_name,' ',ct.last_name, ' (Đã xóa)') END as contact_name,
                   u.full_name as creator_name
            FROM invoices i
            LEFT JOIN companies c  ON i.company_id  = c.id
            LEFT JOIN contacts ct  ON i.contact_id  = ct.id
            LEFT JOIN users u      ON i.created_by  = u.id
            WHERE $w ORDER BY i.issue_date DESC LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        // Summary totals respecting filters
        $sSummary = $this->db->prepare("SELECT COALESCE(SUM(i.total),0) as total_rev, COALESCE(SUM(CASE WHEN i.status='paid' THEN i.total END),0) as paid_amt, COALESCE(SUM(CASE WHEN i.status='pending' THEN i.total END),0) as pending_amt, COALESCE(SUM(CASE WHEN i.status='overdue' THEN i.total END),0) as overdue_amt FROM invoices i LEFT JOIN contacts ct ON i.contact_id = ct.id WHERE $w");
        $sSummary->execute($params);
        $currentSummary = $sSummary->fetch();

        $prevTotalRev = 0.0;
        $prevPaidAmt = 0.0;
        $prevPendingAmt = 0.0;
        $prevOverdueAmt = 0.0;

        if ($from && $to) {
            $fromTs = strtotime($from);
            $toTs = strtotime($to);
            $diffSeconds = $toTs - $fromTs;
            $diffDays = round($diffSeconds / (24 * 3600)) + 1;

            $prevFrom = date('Y-m-d', strtotime("-$diffDays days", $fromTs));
            $prevTo = date('Y-m-d', strtotime("-1 day", $fromTs));

            $prevWhere = ['i.tenant_id=?', 'i.deleted_at IS NULL'];
            $prevParams = [$tid];
            if ($contactId) {
                $prevWhere[] = 'i.contact_id = ?';
                $prevParams[] = (int)$contactId;
            }
            if ($auth['role'] === 'sales') {
                $prevWhere[] = 'i.created_by = ?';
                $prevParams[] = $auth['user_id'];
            }
            if ($status) {
                $prevWhere[] = 'i.status=?';
                $prevParams[] = $status;
            }
            $prevWhere[] = 'i.issue_date >= ?';
            $prevParams[] = $prevFrom;
            $prevWhere[] = 'i.issue_date <= ?';
            $prevParams[] = $prevTo;

            $pw = implode(' AND ', $prevWhere);
            $sPrev = $this->db->prepare("SELECT COALESCE(SUM(i.total),0) as total_rev, COALESCE(SUM(CASE WHEN i.status='paid' THEN i.total END),0) as paid_amt, COALESCE(SUM(CASE WHEN i.status='pending' THEN i.total END),0) as pending_amt, COALESCE(SUM(CASE WHEN i.status='overdue' THEN i.total END),0) as overdue_amt FROM invoices i LEFT JOIN contacts ct ON i.contact_id = ct.id WHERE $pw");
            $sPrev->execute($prevParams);
            $prevSummary = $sPrev->fetch();
            if ($prevSummary) {
                $prevTotalRev = (float)$prevSummary['total_rev'];
                $prevPaidAmt = (float)$prevSummary['paid_amt'];
                $prevPendingAmt = (float)$prevSummary['pending_amt'];
                $prevOverdueAmt = (float)$prevSummary['overdue_amt'];
            }
        }

        $summary = [
            'total_rev' => (float)$currentSummary['total_rev'],
            'paid_amt' => (float)$currentSummary['paid_amt'],
            'pending_amt' => (float)$currentSummary['pending_amt'],
            'overdue_amt' => (float)$currentSummary['overdue_amt'],
            'prev_total_rev' => $prevTotalRev,
            'prev_paid_amt' => $prevPaidAmt,
            'prev_pending_amt' => $prevPendingAmt,
            'prev_overdue_amt' => $prevOverdueAmt
        ];

        respond(200, ['items' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'limit' => $limit, 'summary' => $summary]);
    }

    public function showInvoice(array $auth, int $id): void
    {
        $sql = "
            SELECT i.*, CONCAT(ct.first_name,' ',ct.last_name) as contact_name, c.name as company_name
            FROM invoices i
            LEFT JOIN contacts ct ON i.contact_id = ct.id
            LEFT JOIN companies c ON i.company_id = c.id
            WHERE i.id=? AND i.tenant_id=? AND i.deleted_at IS NULL
        ";
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') {
            $sql .= " AND i.created_by=?";
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row)
            respond(404, null, 'Không tìm thấy hóa đơn', false);

        // Load items
        $sItems = $this->db->prepare("SELECT ii.*, p.name as product_name FROM invoice_items ii LEFT JOIN products p ON ii.product_id=p.id WHERE ii.invoice_id=?");
        $sItems->execute([$id]);
        $row['items'] = $sItems->fetchAll();
        respond(200, $row);
    }

    public function createInvoice(array $auth): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) respond(403, null, 'Bạn không có quyền tạo hóa đơn', false);
        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $data = getBody();

        if (empty($data['title']))
            respond(400, null, 'Tiêu đề hóa đơn là bắt buộc', false);
        if (($data['total'] ?? 0) < 0) respond(422, null, 'Tổng tiền hóa đơn không được âm', false);

        // Auto-generate invoice number (Race condition safe)
        if (empty($data['invoice_number'])) {
            $data['invoice_number'] = 'INV-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        }

        $this->db->beginTransaction();
        try {
            // Verify entities belong to tenant
            if (!empty($data['contact_id'])) {
                $c = $this->db->prepare("SELECT id FROM contacts WHERE id=? AND tenant_id=?");
                $c->execute([(int) $data['contact_id'], $tid]);
                if (!$c->fetch())
                    $data['contact_id'] = null;
            }
            if (!empty($data['company_id'])) {
                $c = $this->db->prepare("SELECT id FROM companies WHERE id=? AND tenant_id=?");
                $c->execute([(int) $data['company_id'], $tid]);
                if (!$c->fetch())
                    $data['company_id'] = null;
            }

            $isPaid = ($data['status'] ?? 'pending') === 'paid';
            $stmt = $this->db->prepare("
                INSERT INTO invoices (tenant_id,deal_id,company_id,contact_id,created_by,invoice_number,title,status,issue_date,due_date,subtotal,discount,tax,total,notes,shipping_customer_pay,shipping_fee,is_inventory_deducted,paid_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ");
            $stmt->execute([
                $tid,
                $data['deal_id'] ?? null,
                $data['company_id'] ?? null,
                $data['contact_id'] ?? null,
                $uid,
                $data['invoice_number'],
                $data['title'],
                $data['status'] ?? 'pending',
                empty($data['issue_date']) ? date('Y-m-d') : $data['issue_date'],
                empty($data['due_date']) ? date('Y-m-d', strtotime('+30 days')) : $data['due_date'],
                $data['subtotal'] ?? 0,
                $data['discount'] ?? 0,
                $data['tax'] ?? 0,
                $data['total'] ?? 0,
                $data['notes'] ?? null,
                $data['shipping_customer_pay'] ?? 1,
                $data['shipping_fee'] ?? 0,
                $isPaid ? 1 : 0,
                $isPaid ? date('Y-m-d H:i:s') : null
            ]);
            $invId = $this->db->lastInsertId();

            if (!empty($data['items']) && is_array($data['items'])) {
                $sItem = $this->db->prepare("INSERT INTO invoice_items (invoice_id,product_id,name,quantity,unit_price,subtotal) VALUES (?,?,?,?,?,?)");
                foreach ($data['items'] as $item) {
                    $qty = (float) ($item['quantity'] ?? 1);
                    $price = (float) ($item['unit_price'] ?? 0);
                    if ($qty <= 0 || $price < 0) {
                        throw new Exception('Số lượng sản phẩm phải lớn hơn 0 và đơn giá không được âm');
                    }

                    $trackInventory = 0;
                    if (!empty($item['product_id'])) {
                        $pCheck = $this->db->prepare("SELECT track_inventory FROM products WHERE id=? AND tenant_id=?");
                        $pCheck->execute([(int) $item['product_id'], $tid]);
                        $prod = $pCheck->fetch();
                        if (!$prod) {
                            throw new Exception("Sản phẩm ID {$item['product_id']} không hợp lệ hoặc không thuộc cửa hàng của bạn");
                        }
                        $trackInventory = (int)$prod['track_inventory'];
                    }

                    $sItem->execute([$invId, $item['product_id'] ?? null, $item['name'], $qty, $price, $item['subtotal'] ?? 0]);

                    if ($isPaid && !empty($item['product_id']) && $trackInventory) {
                        deductStockFIFO($this->db, $tid, $uid, (int) $item['product_id'], (float) $item['quantity'], $data['invoice_number']);
                    }
                }
            }
            $this->db->commit();
            $this->syncInvoiceContact($tid, $invId);

            if (!empty($data['contact_id'])) {
                logInteraction($this->db, $tid, $uid, 'email', "Phát hành Hóa đơn #{$data['invoice_number']}", "Hóa đơn \"{$data['title']}\" trị giá " . number_format($data['total'] ?? 0, 0, ',', '.') . "đ đã được khởi tạo.", 'invoice', $invId);
            }

            logActivity($this->db, $tid, $uid, 'CREATE', 'invoice', (int) $invId, json_encode(['invoice_number' => $data['invoice_number'], 'total' => $data['total']]));

            $this->showInvoice($auth, $invId);
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    public function updateInvoice(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) respond(403, null, 'Bạn không có quyền cập nhật hóa đơn', false);
        $data = getBody();
        $fields = ['title', 'status', 'issue_date', 'due_date', 'subtotal', 'discount', 'tax', 'total', 'notes', 'contact_id', 'company_id', 'deal_id', 'shipping_customer_pay', 'shipping_fee'];
        $sets = [];
        $params = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f=?";
                if (in_array($f, ['issue_date', 'due_date']) && $data[$f] === '') {
                    $params[] = null;
                } else {
                    $params[] = $data[$f];
                }
            }
        }
        if (!$sets) respond(422, null, 'Không có dữ liệu', false);

        // Verify entities belong to tenant
        $tid = $auth['tenant_id'];
        if (isset($data['contact_id']) && $data['contact_id']) {
            $c = $this->db->prepare("SELECT id FROM contacts WHERE id=? AND tenant_id=?");
            $c->execute([(int)$data['contact_id'], $tid]);
            if (!$c->fetch()) respond(404, null, 'Liên hệ không hợp lệ', false);
        }
        if (isset($data['company_id']) && $data['company_id']) {
            $c = $this->db->prepare("SELECT id FROM companies WHERE id=? AND tenant_id=?");
            $c->execute([(int)$data['company_id'], $tid]);
            if (!$c->fetch()) respond(404, null, 'Công ty không hợp lệ', false);
        }
        if (isset($data['deal_id']) && $data['deal_id']) {
            $c = $this->db->prepare("SELECT id FROM deals WHERE id=? AND tenant_id=?");
            $c->execute([(int)$data['deal_id'], $tid]);
            if (!$c->fetch()) respond(404, null, 'Deal không hợp lệ', false);
        }
        $this->db->beginTransaction();
        try {
            // Check permission and current status with FOR UPDATE to prevent race condition
            $check = $this->db->prepare("SELECT id, status, is_inventory_deducted, invoice_number FROM invoices WHERE id=? AND tenant_id=? " . ($auth['role'] === 'sales' ? " AND created_by=?" : "") . " FOR UPDATE");
            $cp = [$id, $auth['tenant_id']];
            if ($auth['role'] === 'sales')
                $cp[] = $auth['user_id'];
            $check->execute($cp);
            $current = $check->fetch();
            if (!$current)
                respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

            if (isset($data['status']) && $data['status'] === 'paid' && $current['status'] !== 'paid') {
                $data['paid_at'] = date('Y-m-d H:i:s');
                $sets[] = "paid_at=?";
                $params[] = $data['paid_at'];
            }

            $params[] = $id;
            $params[] = $auth['tenant_id'];
            $stmt = $this->db->prepare("UPDATE invoices SET " . implode(',', $sets) . " WHERE id=? AND tenant_id=?");
            $stmt->execute($params);

            // Handle stock deduction if status changed to paid and not already deducted
            if (isset($data['status']) && $data['status'] === 'paid' && !$current['is_inventory_deducted']) {
                $this->triggerStockDeduction($auth, $id, $current['invoice_number']);
                $this->db->prepare("UPDATE invoices SET is_inventory_deducted=1 WHERE id=?")->execute([$id]);
            }
            // Handle stock return if status changed AWAY from paid (e.g. cancelled) and it was already deducted
            else if (isset($data['status']) && $data['status'] !== 'paid' && $current['is_inventory_deducted']) {
                returnStock($this->db, $auth['tenant_id'], $auth['user_id'], $current['invoice_number']);
                $this->db->prepare("UPDATE invoices SET is_inventory_deducted=0 WHERE id=?")->execute([$id]);
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'invoice', $id, json_encode($data));
            $this->db->commit();
            $this->syncInvoiceContact($auth['tenant_id'], $id);
            $this->showInvoice($auth, $id);
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    private function triggerStockDeduction(array $auth, int $invId, string $invNum): void
    {
        $items = $this->db->prepare("
            SELECT ii.product_id, ii.quantity, p.track_inventory 
            FROM invoice_items ii 
            JOIN products p ON ii.product_id = p.id 
            WHERE ii.invoice_id = ?
        ");
        $items->execute([$invId]);
        while ($item = $items->fetch()) {
            if ($item['track_inventory'] && !empty($item['product_id'])) {
                deductStockFIFO($this->db, $auth['tenant_id'], $auth['user_id'], (int) $item['product_id'], (float) $item['quantity'], $invNum);
            }
        }
    }

    public function deleteInvoice(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) respond(403, null, 'Bạn không có quyền xóa hóa đơn', false);
        try {
            $this->db->beginTransaction();

            $sql = "UPDATE invoices SET deleted_at = NOW() WHERE id=? AND tenant_id=?";
            $p = [$id, $auth['tenant_id']];
            if ($auth['role'] === 'sales') {
                $sql .= " AND created_by=?";
                $p[] = $auth['user_id'];
            }
            $stmt = $this->db->prepare($sql);

            // Get details before deletion for side effects (use FOR UPDATE to lock row)
            $cCheck = $this->db->prepare("SELECT contact_id, is_inventory_deducted, invoice_number FROM invoices WHERE id=? AND tenant_id=? FOR UPDATE");
        $cCheck->execute([$id, $auth['tenant_id']]);
        $inv = $cCheck->fetch();
        $oldContactId = $inv['contact_id'] ?? null;

        $stmt->execute($p);
        if (!$stmt->rowCount())
            respond(404, null, 'Không tìm thấy hóa đơn hoặc không có quyền', false);

        // REVERSE SIDE EFFECTS
        // 1. Return stock if it was deducted
        if ($inv && $inv['is_inventory_deducted']) {
            returnStock($this->db, $auth['tenant_id'], $auth['user_id'], $inv['invoice_number']);
        }

        // 2. Sync contact stats
        if ($oldContactId)
            $this->syncContactStats($auth['tenant_id'], (int) $oldContactId);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'invoice', $id);
        $this->db->commit();
        respond(200, null, 'Đã xóa hóa đơn');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi hệ thống: ' . $e->getMessage(), false);
        }
    }

    public function markPaid(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true)) respond(403, null, 'Bạn không có quyền xác nhận thanh toán', false);
        try {
            $this->db->beginTransaction();

            // Check if already deducted or already paid
            $check = $this->db->prepare("SELECT id, status, is_inventory_deducted, invoice_number FROM invoices WHERE id=? AND tenant_id=? " . ($auth['role'] === 'sales' ? " AND created_by=?" : "") . " FOR UPDATE");
            $cp = [$id, $auth['tenant_id']];
            if ($auth['role'] === 'sales')
                $cp[] = $auth['user_id'];
            $check->execute($cp);
            $inv = $check->fetch();

            if (!$inv)
                respond(404, null, 'Không tìm thấy hoặc không có quyền', false);
            if ($inv['status'] === 'paid')
                respond(400, null, 'Hóa đơn đã được thanh toán', false);

            $sql = "UPDATE invoices SET status='paid', paid_at=NOW(), is_inventory_deducted=1 WHERE id=? AND tenant_id=?";
            $p = [$id, $auth['tenant_id']];
            if ($auth['role'] === 'sales') {
                $sql .= " AND created_by=?";
                $p[] = $auth['user_id'];
            }
            $stmt = $this->db->prepare($sql);
            $stmt->execute($p);

            if (!$inv['is_inventory_deducted']) {
                $this->triggerStockDeduction($auth, $id, $inv['invoice_number']);
            }

            // Update contact's last_contact
            $invData = $this->db->prepare("SELECT contact_id FROM invoices WHERE id=?");
            $invData->execute([$id]);
            $cId = $invData->fetchColumn();
            if ($cId) {
                $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = ? AND tenant_id = ?")
                    ->execute([(int) $cId, $auth['tenant_id']]);
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'PAYMENT', 'invoice', $id, json_encode(['amount' => $inv['total'] ?? 0]));
            $this->db->commit();
            $this->syncInvoiceContact($auth['tenant_id'], $id);
            respond(200, null, 'Hóa đơn đã được thanh toán và tồn kho đã được cập nhật');
        } catch (Exception $e) {
            if ($this->db->inTransaction())
                $this->db->rollBack();
            respond(500, null, 'Lỗi hệ thống: ' . $e->getMessage(), false);
        }
    }

    // ─────────────────────── EXPENSES ───────────────────────────

    public function listExpenses(array $auth): void
    {
        $tid = $auth['tenant_id'];
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $limit = min(100, max(10, (int) ($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $status = $_GET['status'] ?? '';
        $category = $_GET['category'] ?? '';
        $from = $_GET['from'] ?? '';
        $to = $_GET['to'] ?? '';
        $where = ['e.tenant_id=?', 'e.deleted_at IS NULL'];
        $params = [$tid];
        if ($auth['role'] === 'sales') {
            $where[] = 'e.created_by = ?';
            $params[] = $auth['user_id'];
        }
        if ($status) {
            $where[] = 'e.status=?';
            $params[] = $status;
        }
        if ($category) {
            $where[] = 'e.category=?';
            $params[] = $category;
        }
        if ($from) {
            $where[] = 'e.date >= ?';
            $params[] = $from;
        }
        if ($to) {
            $where[] = 'e.date <= ?';
            $params[] = $to;
        }
        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM expenses e WHERE $w");
        $cnt->execute($params);
        $total = (int) $cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT e.*, u.full_name as creator_name, u.avatar_url as creator_avatar, 
                   u2.full_name as approver_name, u2.avatar_url as approver_avatar
            FROM expenses e 
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN users u2 ON e.approver_id = u2.id
            WHERE $w ORDER BY e.date DESC LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        // Fetch entities for all these rows
        if (!empty($rows)) {
            $ids = array_column($rows, 'id');
            $in = str_repeat('?,', count($ids) - 1) . '?';
            $sEE = $this->db->prepare("SELECT ee.*, c.first_name, c.last_name, c.avatar_url FROM expense_entities ee LEFT JOIN contacts c ON ee.entity_type='contact' AND ee.entity_id=c.id WHERE ee.expense_id IN ($in)");
            $sEE->execute($ids);
            $allEntities = $sEE->fetchAll();

            $entitiesByExp = [];
            foreach ($allEntities as $ee) {
                $ee['name'] = trim(($ee['first_name'] ?? '') . ' ' . ($ee['last_name'] ?? ''));
                $entitiesByExp[$ee['expense_id']][] = $ee;
            }

            foreach ($rows as &$r) {
                $r['entities'] = $entitiesByExp[$r['id']] ?? [];
            }
        }

        // Summary totals respecting filters
        $sTotal = $this->db->prepare("SELECT COALESCE(SUM(e.amount),0) as total, COALESCE(SUM(CASE WHEN e.status='approved' THEN e.amount END),0) as approved, COALESCE(SUM(CASE WHEN e.status='pending' THEN e.amount END),0) as pending, COUNT(*) as total_count, COALESCE(SUM(CASE WHEN e.status='approved' THEN 1 ELSE 0 END),0) as approved_count, COALESCE(SUM(CASE WHEN e.status='pending' THEN 1 ELSE 0 END),0) as pending_count FROM expenses e WHERE $w");
        $sTotal->execute($params);
        $currentSummary = $sTotal->fetch();

        $sMax = $this->db->prepare("SELECT amount, title FROM expenses e WHERE $w ORDER BY e.amount DESC LIMIT 1");
        $sMax->execute($params);
        $maxItem = $sMax->fetch() ?: null;

        $prevTotal = 0.0;
        $prevApproved = 0.0;
        $prevPending = 0.0;

        if ($from && $to) {
            $fromTs = strtotime($from);
            $toTs = strtotime($to);
            $diffSeconds = $toTs - $fromTs;
            $diffDays = round($diffSeconds / (24 * 3600)) + 1;

            $prevFrom = date('Y-m-d', strtotime("-$diffDays days", $fromTs));
            $prevTo = date('Y-m-d', strtotime("-1 day", $fromTs));

            $prevWhere = ['e.tenant_id=?', 'e.deleted_at IS NULL'];
            $prevParams = [$tid];
            if ($auth['role'] === 'sales') {
                $prevWhere[] = 'e.created_by = ?';
                $prevParams[] = $auth['user_id'];
            }
            if ($status) {
                $prevWhere[] = 'e.status=?';
                $prevParams[] = $status;
            }
            if ($category) {
                $prevWhere[] = 'e.category=?';
                $prevParams[] = $category;
            }
            $prevWhere[] = 'e.date >= ?';
            $prevParams[] = $prevFrom;
            $prevWhere[] = 'e.date <= ?';
            $prevParams[] = $prevTo;

            $pw = implode(' AND ', $prevWhere);
            $sPrev = $this->db->prepare("SELECT COALESCE(SUM(e.amount),0) as total, COALESCE(SUM(CASE WHEN e.status='approved' THEN e.amount END),0) as approved, COALESCE(SUM(CASE WHEN e.status='pending' THEN e.amount END),0) as pending FROM expenses e WHERE $pw");
            $sPrev->execute($prevParams);
            $prevSummary = $sPrev->fetch();
            if ($prevSummary) {
                $prevTotal = (float)$prevSummary['total'];
                $prevApproved = (float)$prevSummary['approved'];
                $prevPending = (float)$prevSummary['pending'];
            }
        }

        $summary = [
            'total' => (float)$currentSummary['total'],
            'approved' => (float)$currentSummary['approved'],
            'pending' => (float)$currentSummary['pending'],
            'total_count' => (int)$currentSummary['total_count'],
            'approved_count' => (int)$currentSummary['approved_count'],
            'pending_count' => (int)$currentSummary['pending_count'],
            'max_amount' => $maxItem ? (float)$maxItem['amount'] : 0.0,
            'max_title' => $maxItem ? $maxItem['title'] : '',
            'prev_total' => $prevTotal,
            'prev_approved' => $prevApproved,
            'prev_pending' => $prevPending
        ];

        respond(200, ['items' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit, 'summary' => $summary]);
    }

    public function showExpense(array $auth, int $id): void
    {
        $sql = "SELECT e.*, u.full_name as creator_name, u.avatar_url as creator_avatar, u2.full_name as approver_name, u2.avatar_url as approver_avatar FROM expenses e LEFT JOIN users u ON e.created_by=u.id LEFT JOIN users u2 ON e.approver_id=u2.id WHERE e.id=? AND e.tenant_id=? AND e.deleted_at IS NULL";
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') {
            $sql .= " AND e.created_by=?";
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row)
            respond(404, null, 'Không tìm thấy chi phí', false);

        // Fetch linked entities with names
        $sEE = $this->db->prepare("SELECT ee.*, c.first_name, c.last_name, c.avatar_url FROM expense_entities ee LEFT JOIN contacts c ON ee.entity_type='contact' AND ee.entity_id=c.id WHERE ee.expense_id=?");
        $sEE->execute([$id]);
        $entities = $sEE->fetchAll();
        foreach ($entities as &$ee) {
            $ee['name'] = trim(($ee['first_name'] ?? '') . ' ' . ($ee['last_name'] ?? ''));
        }
        $row['entities'] = $entities;

        respond(200, $row);
    }

    public function createExpense(array $auth): void
    {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền tạo chi phí', false);
        $data = getBody();
        if (empty($data['title']) || empty($data['amount']))
            respond(400, null, 'Thiếu tiêu đề hoặc số tiền', false);

        $totalAmount = (float) $data['amount'];
        if ($totalAmount < 0) respond(422, null, 'Số tiền chi phí không được âm', false);
        $entities = $data['entities'] ?? [];

        // Validate split amounts
        if (!empty($entities)) {
            $splitSum = array_reduce($entities, fn($s, $e) => $s + (float) ($e['amount'] ?? 0), 0);
            if ($splitSum > $totalAmount) {
                respond(422, null, 'Tổng số tiền phân bổ không được lớn hơn tổng số tiền chi phí', false);
            }
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                INSERT INTO expenses (tenant_id,created_by,title,category,amount,vat_amount,date,status,notes,
                    vendor_name,has_vat_invoice,is_vat_inclusive,image_url)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            ");
            $stmt->execute([
                $auth['tenant_id'],
                $auth['user_id'],
                $data['title'],
                $data['category'] ?? 'Khác',
                $totalAmount,
                $data['vat_amount'] ?? 0,
                $data['date'] ?? date('Y-m-d'),
                $data['status'] ?? 'pending',
                $data['notes'] ?? null,
                $data['vendor_name'] ?? null,
                $data['has_vat_invoice'] ?? 0,
                $data['is_vat_inclusive'] ?? 0,
                $data['image_url'] ?? null
            ]);
            $expId = (int) $this->db->lastInsertId();

            if (!empty($entities)) {
                $sEE = $this->db->prepare("INSERT INTO expense_entities (tenant_id, expense_id, entity_type, entity_id, amount) VALUES (?,?,?,?,?)");
                foreach ($entities as $ee) {
                    // Verify entity exists in this tenant
                    $table = $ee['entity_type'] === 'contact' ? 'contacts' : ($ee['entity_type'] === 'company' ? 'companies' : 'deals');
                    $check = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=?");
                    $check->execute([(int) $ee['entity_id'], $auth['tenant_id']]);
                    if (!$check->fetch())
                        continue; // Skip unauthorized/missing entities

                    $sEE->execute([$auth['tenant_id'], $expId, $ee['entity_type'], (int) $ee['entity_id'], (float) ($ee['amount'] ?? 0)]);
                }
            }

            $this->db->commit();

            // Log interaction for entities
            if (!empty($entities)) {
                foreach ($entities as $ee) {
                    if ($ee['entity_type'] === 'contact') {
                        $body = "Khoản chi phí trị giá " . number_format($ee['amount'] ?? 0, 0, ',', '.') . "đ đã được liên kết với khách hàng.";
                        if (!empty($data['image_url'])) {
                            $body .= "\nTài liệu/Link đính kèm: " . $data['image_url'];
                        }
                        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', "Ghi nhận Chi phí: {$data['title']}", $body, 'contact', (int) $ee['entity_id']);
                    }
                }
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'expense', $expId, json_encode(['title' => $data['title'], 'amount' => $totalAmount]));

            $this->showExpense($auth, $expId);
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    public function updateExpense(array $auth, int $id): void
    {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật chi phí', false);
        $data = getBody();
        $fields = [
            'title',
            'category',
            'amount',
            'vat_amount',
            'date',
            'status',
            'notes',
            'vendor_name',
            'has_vat_invoice',
            'is_vat_inclusive',
            'image_url'
        ];
        $sets = [];
        $params = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f=?";
                $params[] = $data[$f];
            }
        }

        $this->db->beginTransaction();
        try {
            // Check permission and get current amount if not provided
            $check = $this->db->prepare("SELECT id, amount FROM expenses WHERE id=? AND tenant_id=? " . ($auth['role'] === 'sales' ? " AND created_by=?" : ""));
            $cp = [$id, $auth['tenant_id']];
            if ($auth['role'] === 'sales')
                $cp[] = $auth['user_id'];
            $check->execute($cp);
            $row = $check->fetch();
            if (!$row)
                respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

            $currentTotal = (float) ($data['amount'] ?? $row['amount']);
            if ($currentTotal < 0) respond(422, null, 'Số tiền chi phí không được âm', false);

            if ($sets) {
                $params[] = $id;
                $params[] = $auth['tenant_id'];
                $stmt = $this->db->prepare("UPDATE expenses SET " . implode(',', $sets) . " WHERE id=? AND tenant_id=?");
                $stmt->execute($params);
            }

            if (isset($data['entities']) && is_array($data['entities'])) {
                $entities = $data['entities'];
                $splitSum = array_reduce($entities, fn($s, $e) => $s + (float) ($e['amount'] ?? 0), 0);
                if ($splitSum > $currentTotal) {
                    throw new Exception('Tổng số tiền phân bổ không được lớn hơn tổng số tiền chi phí');
                }

                $this->db->prepare("DELETE FROM expense_entities WHERE expense_id=?")->execute([$id]);
                $sEE = $this->db->prepare("INSERT INTO expense_entities (tenant_id, expense_id, entity_type, entity_id, amount) VALUES (?,?,?,?,?)");
                foreach ($entities as $ee) {
                    // Verify entity exists in this tenant
                    $table = $ee['entity_type'] === 'contact' ? 'contacts' : ($ee['entity_type'] === 'company' ? 'companies' : 'deals');
                    $eCheck = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=?");
                    $eCheck->execute([(int) $ee['entity_id'], $auth['tenant_id']]);
                    if (!$eCheck->fetch())
                        continue;

                    $sEE->execute([$auth['tenant_id'], $id, $ee['entity_type'], (int) $ee['entity_id'], (float) ($ee['amount'] ?? 0)]);
                }
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'expense', $id, json_encode($data));
            $this->db->commit();
            $this->showExpense($auth, $id);
        } catch (Exception $e) {
            if ($this->db->inTransaction())
                $this->db->rollBack();
            respond(422, null, $e->getMessage(), false);
        }
    }

    public function listEntityExpenses(array $auth, string $type, int $id): void
    {
        $where = "ee.entity_type=? AND ee.entity_id=? AND e.tenant_id=?";
        $p = [$type, $id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') {
            $where .= " AND e.created_by=?";
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare("
            SELECT e.*, ee.amount as split_amount, u.full_name as creator_name
            FROM expenses e
            JOIN expense_entities ee ON e.id = ee.expense_id
            LEFT JOIN users u ON e.created_by = u.id
            WHERE $where
            ORDER BY e.date DESC
        ");
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function deleteExpense(array $auth, int $id): void
    {
        if ($auth['role'] !== 'super_admin' && in_array($auth['role'], ['sales', 'viewer'], true)) respond(403, null, 'Bạn không có quyền xóa chi phí', false);
        $sql = "UPDATE expenses SET deleted_at = NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] !== 'super_admin' && $auth['role'] === 'sales') {
            $sql .= " AND created_by = ?";
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount())
            respond(404, null, 'Không tìm thấy chi phí hoặc không có quyền', false);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'expense', $id);
        respond(200, null, 'Đã xóa chi phí');
    }

    public function approveExpense(array $auth, int $id): void
    {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền duyệt chi phí', false);
        requireRole($auth, ['admin', 'manager', 'super_admin']);
        $data = getBody();
        $status = $data['status'] ?? 'approved';
        if ($status === 'approved') {
            $this->db->prepare("UPDATE expenses SET status=?, approver_id=?, approved_at=NOW() WHERE id=? AND tenant_id=?")
                ->execute([$status, $auth['user_id'], $id, $auth['tenant_id']]);
        } else {
            $this->db->prepare("UPDATE expenses SET status=?, approver_id=NULL, approved_at=NULL WHERE id=? AND tenant_id=?")
                ->execute([$status, $id, $auth['tenant_id']]);
        }
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'APPROVE', 'expense', $id, json_encode(['status' => $status]));
        respond(200, null, 'Đã cập nhật trạng thái');
    }

    public function summary(array $auth): void
    {
        requireRole($auth, ['admin', 'manager', 'super_admin']);
        $tid = $auth['tenant_id'];
        $sInv = $this->db->prepare("
            SELECT COALESCE(SUM(total),0) as total_revenue,
                   COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END),0) as total_paid,
                   COUNT(CASE WHEN status='pending' THEN 1 END) as pending_count
            FROM invoices WHERE tenant_id=?
        ");
        $sInv->execute([$tid]);
        $inv = $sInv->fetch();

        $sExp = $this->db->prepare("
            SELECT COALESCE(SUM(amount),0) as total_expenses,
                   COALESCE(SUM(CASE WHEN status='approved' THEN amount ELSE 0 END),0) as approved_expenses
            FROM expenses WHERE tenant_id=?
        ");
        $sExp->execute([$tid]);
        $exp = $sExp->fetch();

        respond(200, array_merge($inv, $exp));
    }
}
