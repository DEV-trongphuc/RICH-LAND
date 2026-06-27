<?php
class InventoryController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    /**
     * Get all active batches with product info
     */
    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $search = $_GET['search'] ?? '';
        $stockStatus = $_GET['stock_status'] ?? '';

        $where = ["b.tenant_id = ?", "b.status = 'active'"];
        $params = [$tid];

        if ($search) {
            $where[] = "(p.name LIKE ? OR p.sku LIKE ? OR b.batch_code LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($stockStatus === 'in_stock') {
            $where[] = "b.current_qty > 0";
        } elseif ($stockStatus === 'out_of_stock') {
            $where[] = "b.current_qty <= 0";
        } elseif ($stockStatus === 'low_stock') {
            $where[] = "b.current_qty > 0 AND b.current_qty <= 5";
        }

        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM batches b JOIN products p ON b.product_id = p.id WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT b.*, p.name as product_name, p.sku, p.category, p.unit, s.name as supplier_name
            FROM batches b
            JOIN products p ON b.product_id = p.id
            LEFT JOIN suppliers s ON b.supplier_id = s.id
            WHERE $w
            ORDER BY b.import_date DESC, b.created_at DESC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        
        respond(200, [
            'items' => $stmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit
        ]);
    }

    /**
     * Handle internal stock out (Damage, Gift, Loss)
     */
    public function internalExport(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền thực hiện xuất kho nội bộ', false);
        $b = getBody();
        if (empty($b['batch_id']) || empty($b['qty']) || empty($b['reason'])) {
            respond(422, null, 'Thiếu thông tin xuất kho nội bộ', false);
        }
        if ((float)$b['qty'] <= 0) {
            respond(422, null, 'Số lượng xuất kho phải lớn hơn 0', false);
        }

        $this->db->beginTransaction();
        try {
            // 1. Get batch info and lock for update
            $stmt = $this->db->prepare("SELECT current_qty, import_price, product_id FROM batches WHERE id = ? AND tenant_id = ? FOR UPDATE");
            $stmt->execute([$b['batch_id'], $auth['tenant_id']]);
            $batch = $stmt->fetch();

            if (!$batch) throw new Exception('Không tìm thấy lô hàng');
            if ($batch['current_qty'] < $b['qty']) throw new Exception('Số lượng tồn kho trong lô không đủ');

            // 2. Update batch quantity
            $newQty = (float)$batch['current_qty'] - (float)$b['qty'];
            $this->db->prepare("UPDATE batches SET current_qty = ? WHERE id = ?")
                 ->execute([$newQty, $b['batch_id']]);

            // 3. Create inventory log
            $logStmt = $this->db->prepare("
                INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by, receiver_id, receiver_type)
                VALUES (?, ?, 'EXPORT_INTERNAL', ?, ?, ?, ?, ?)
            ");
            $receiverId = !empty($b['receiver_id']) ? (int)$b['receiver_id'] : null;
            $receiverType = $receiverId ? 'contact' : null; // Default to contact for now as per UI
            
            $logStmt->execute([
                $auth['tenant_id'], $b['batch_id'], -$b['qty'], $b['reason'], $auth['user_id'], $receiverId, $receiverType
            ]);

            // 4. Update overall product stock
            $this->db->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND tenant_id = ?")
                 ->execute([$b['qty'], $batch['product_id'], $auth['tenant_id']]);

            // 5. If gift/loss with receiver, create Expense record automatically
            if ($receiverId && $b['reason'] === 'Hàng tặng/Quà tặng') {
                $expenseAmount = $b['qty'] * $batch['import_price'];
                $productNameStmt = $this->db->prepare("SELECT name FROM products WHERE id = ? AND tenant_id = ?");
                $productNameStmt->execute([$batch['product_id'], $auth['tenant_id']]);
                $pName = $productNameStmt->fetchColumn();

                $expStmt = $this->db->prepare("
                    INSERT INTO expenses (tenant_id, created_by, title, category, amount, vat_amount, date, status, notes, has_vat_invoice, is_vat_inclusive)
                    VALUES (?, ?, ?, 'Quà tặng khách hàng', ?, 0, CURRENT_DATE, 'approved', ?, 0, 1)
                ");
                $expTitle = "Tặng phẩm: $pName (x" . $b['qty'] . ")";
                $expNotes = "Xuất từ lô #" . $b['batch_id'] . ". Lý do: " . $b['reason'];
                $expStmt->execute([
                    $auth['tenant_id'], $auth['user_id'], $expTitle, $expenseAmount, $expNotes
                ]);
                $expenseId = (int)$this->db->lastInsertId();

                // Link expense to the receiver entity
                $this->db->prepare("
                    INSERT INTO expense_entities (tenant_id, expense_id, entity_type, entity_id, amount)
                    VALUES (?, ?, ?, ?, ?)
                ")->execute([
                    $auth['tenant_id'], $expenseId, $receiverType, $receiverId, $expenseAmount
                ]);

                // Log interaction in contact timeline
                logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', "Nhận quà tặng: $pName", "Quà tặng từ kho (Lô #{$b['batch_id']}). Số lượng: {$b['qty']} {$batch['unit']}. Lý do: {$b['reason']}", 'contact', $receiverId);
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'EXPORT_INTERNAL', 'inventory', $b['batch_id'], json_encode(['qty' => $b['qty'], 'reason' => $b['reason']]));
            $this->db->commit();
            respond(200, null, 'Xuất kho nội bộ thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    /**
     * Get logs for a specific batch
     */
    public function getLogs(array $auth, int $batchId): void {
        $stmt = $this->db->prepare("
            SELECT l.*, u.full_name as creator_name
            FROM inventory_logs l
            LEFT JOIN users u ON l.created_by = u.id
            WHERE l.batch_id = ? AND l.tenant_id = ?
            ORDER BY l.created_at DESC
        ");
        $stmt->execute([$batchId, $auth['tenant_id']]);
        respond(200, $stmt->fetchAll());
    }

    /**
     * Manual adjustment
     */
    public function adjust(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền điều chỉnh kho', false);
        $b = getBody();
        if (empty($b['batch_id']) || !isset($b['new_qty'])) respond(400, null, 'Thiếu thông tin điều chỉnh', false);
        if ((float)$b['new_qty'] < 0) respond(422, null, 'Số lượng tồn kho không được nhỏ hơn 0', false);

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("SELECT current_qty FROM batches WHERE id = ? AND tenant_id = ? FOR UPDATE");
            $stmt->execute([$b['batch_id'], $auth['tenant_id']]);
            $batch = $stmt->fetch();
            if (!$batch) throw new Exception('Không tìm thấy lô hàng');

            $qtyChange = (float)$b['new_qty'] - (float)$batch['current_qty'];
            $this->db->prepare("UPDATE batches SET current_qty = ? WHERE id = ?")
                 ->execute([(float)$b['new_qty'], $b['batch_id']]);

            $logStmt = $this->db->prepare("
                INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by)
                VALUES (?, ?, 'ADJUST', ?, ?, ?)
            ");
            $logStmt->execute([
                $auth['tenant_id'], $b['batch_id'], $qtyChange, $b['reason'] ?? 'Điều chỉnh thủ công', $auth['user_id']
            ]);

            // Update overall product stock
            $this->db->prepare("UPDATE products p JOIN batches b ON p.id = b.product_id SET p.stock_quantity = p.stock_quantity + ? WHERE b.id = ?")
                 ->execute([$qtyChange, $b['batch_id']]);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'ADJUST', 'inventory', $b['batch_id'], json_encode(['new_qty' => $b['new_qty'], 'reason' => $b['reason'] ?? '']));
            $this->db->commit();
            respond(200, null, 'Điều chỉnh kho thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }
    /**
     * Get global inventory logs for the tenant
     */
    public function globalLogs(array $auth): void {
        $tid = $auth['tenant_id'];
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
        
        $stmt = $this->db->prepare("
            SELECT l.*, b.batch_code, p.name as product_name, u.full_name as creator_name
            FROM inventory_logs l
            JOIN batches b ON l.batch_id = b.id
            JOIN products p ON b.product_id = p.id
            LEFT JOIN users u ON l.created_by = u.id
            WHERE l.tenant_id = ?
            ORDER BY l.created_at DESC
            LIMIT $limit
        ");
        $stmt->execute([$tid]);
        respond(200, $stmt->fetchAll());
    }

    /**
     * Archive a batch (when it's empty and no longer needed in active list)
     */
    public function archive(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin'], true)) respond(403, null, 'Chỉ admin mới có quyền lưu trữ lô hàng', false);
        
        $stmt = $this->db->prepare("SELECT current_qty FROM batches WHERE id=? AND tenant_id=?");
        $stmt->execute([$id, $auth['tenant_id']]);
        $qty = $stmt->fetchColumn();
        
        if ($qty === false) respond(404, null, 'Không tìm thấy lô hàng', false);
        if ((float)$qty > 0) respond(400, null, 'Không thể lưu trữ lô hàng còn tồn kho. Vui lòng điều chỉnh kho về 0 trước.', false);

        $this->db->prepare("UPDATE batches SET status='archived' WHERE id=? AND tenant_id=?")->execute([$id, $auth['tenant_id']]);
        respond(200, null, 'Đã lưu trữ lô hàng');
    }
}
