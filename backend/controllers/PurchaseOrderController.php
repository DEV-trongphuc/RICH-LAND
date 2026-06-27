<?php
class PurchaseOrderController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("
            SELECT po.*, s.name as supplier_name, u.full_name as creator_name
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users u ON po.created_by = u.id
            WHERE po.tenant_id = ?
            ORDER BY po.created_at DESC
        ");
        $stmt->execute([$tid]);
        respond(200, $stmt->fetchAll());
    }

    public function store(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền tạo đơn nhập hàng', false);
        $b = getBody();
        if (empty($b['supplier_id']) || empty($b['items'])) respond(422, null, 'Thiếu thông tin nhà cung cấp hoặc danh sách sản phẩm', false);
        if (($b['total'] ?? 0) < 0) respond(422, null, 'Tổng tiền đơn hàng không được âm', false);

        $checkSup = $this->db->prepare("SELECT id FROM suppliers WHERE id=? AND tenant_id=?");
        $checkSup->execute([(int)$b['supplier_id'], $auth['tenant_id']]);
        if (!$checkSup->fetch()) respond(404, null, 'Nhà cung cấp không hợp lệ', false);

        $this->db->beginTransaction();
        try {
            $po_number = 'PO-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));
            
            $stmt = $this->db->prepare("
                INSERT INTO purchase_orders (tenant_id, supplier_id, created_by, po_number, order_date, status, subtotal, tax, total, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $auth['tenant_id'], $b['supplier_id'], $auth['user_id'], $po_number,
                empty($b['order_date']) ? date('Y-m-d') : $b['order_date'], 'ordered',
                $b['subtotal'] ?? 0, $b['tax'] ?? 0, $b['total'] ?? 0, $b['notes'] ?? null
            ]);
            $poId = (int)$this->db->lastInsertId();

            $itemStmt = $this->db->prepare("
                INSERT INTO purchase_order_items (po_id, product_id, name, quantity, unit_cost, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            foreach ($b['items'] as $item) {
                $qty = (float)($item['quantity'] ?? 1.0);
                $unit_cost = (float)($item['unit_cost'] ?? 0);
                if ($qty <= 0 || $unit_cost < 0) {
                    throw new Exception('Số lượng sản phẩm phải lớn hơn 0 và đơn giá không được âm');
                }

                if (!empty($item['product_id'])) {
                    $prodCheck = $this->db->prepare("SELECT id FROM products WHERE id=? AND tenant_id=?");
                    $prodCheck->execute([(int)$item['product_id'], $auth['tenant_id']]);
                    if (!$prodCheck->fetch()) {
                        throw new Exception("Sản phẩm ID {$item['product_id']} không hợp lệ hoặc không thuộc cửa hàng của bạn");
                    }
                }

                $itemStmt->execute([
                    $poId, $item['product_id'] ?? null, $item['name'],
                    $qty, $unit_cost, $item['subtotal']
                ]);
            }

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'Tạo đơn nhập hàng', 'purchase_order', $poId, $po_number);
            $this->show($auth, $poId);
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi khi tạo đơn nhập hàng: ' . $e->getMessage(), false);
        }
    }

    public function show(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT po.*, s.name as supplier_name, u.full_name as creator_name
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users u ON po.created_by = u.id
            WHERE po.id = ? AND po.tenant_id = ?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $po = $stmt->fetch();
        if (!$po) respond(404, null, 'Không tìm thấy đơn hàng', false);

        $itemStmt = $this->db->prepare("SELECT * FROM purchase_order_items WHERE po_id = ?");
        $itemStmt->execute([$id]);
        $po['items'] = $itemStmt->fetchAll();

        respond(200, $po);
    }

    public function receive(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền nhập kho', false);
        $this->db->beginTransaction();
        try {
            // 1. Get PO and items
            $stmt = $this->db->prepare("SELECT status FROM purchase_orders WHERE id = ? AND tenant_id = ? FOR UPDATE");
            $stmt->execute([$id, $auth['tenant_id']]);
            $po = $stmt->fetch();
            if (!$po) respond(404, null, 'Không tìm thấy đơn hàng', false);
            if ($po['status'] === 'received') respond(422, null, 'Đơn hàng này đã được nhập kho rồi', false);

            // 2. Update status
            $this->db->prepare("UPDATE purchase_orders SET status = 'received' WHERE id = ? AND tenant_id = ?")->execute([$id, $auth['tenant_id']]);

            // 3. Process items: Update stock, create batches and logs
            $itemStmt = $this->db->prepare("SELECT product_id, name, quantity, unit_cost FROM purchase_order_items WHERE po_id = ?");
            $itemStmt->execute([$id]);
            $items = $itemStmt->fetchAll();

            $updateStock = $this->db->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND tenant_id = ?");
            $insertBatch = $this->db->prepare("
                INSERT INTO batches (tenant_id, product_id, supplier_id, po_id, batch_code, import_date, import_price, initial_qty, current_qty)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $insertLog = $this->db->prepare("
                INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by)
                VALUES (?, ?, 'IMPORT', ?, ?, ?)
            ");

            // Get PO details for batch info
            $poInfoStmt = $this->db->prepare("SELECT po_number, supplier_id, total, order_date FROM purchase_orders WHERE id = ? AND tenant_id = ?");
            $poInfoStmt->execute([$id, $auth['tenant_id']]);
            $poInfo = $poInfoStmt->fetch();

            foreach ($items as $item) {
                if ($item['product_id']) {
                    // Update overall product stock
                    $updateStock->execute([$item['quantity'], $item['product_id'], $auth['tenant_id']]);
                    
                    // Create Batch
                    $batchCode = $poInfo['po_number'] . '-' . strtoupper(substr(md5($item['name'] . uniqid()), 0, 4));
                    $insertBatch->execute([
                        $auth['tenant_id'], $item['product_id'], $poInfo['supplier_id'], $id,
                        $batchCode, $poInfo['order_date'], $item['unit_cost'], 
                        $item['quantity'], $item['quantity']
                    ]);
                    $batchId = (int)$this->db->lastInsertId();

                    // Create Log
                    $insertLog->execute([
                        $auth['tenant_id'], $batchId, $item['quantity'], "Nhập hàng từ đơn {$poInfo['po_number']}", $auth['user_id']
                    ]);
                }
            }

            // 4. Update supplier totals (accounts payable)
            $this->db->prepare("UPDATE suppliers SET total_ordered = total_ordered + ? WHERE id = ? AND tenant_id = ?")
                 ->execute([$poInfo['total'], $poInfo['supplier_id'], $auth['tenant_id']]);

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'Nhập kho từ PO', 'purchase_order', $id, $poInfo['po_number']);
            respond(200, null, 'Đã nhập kho thành công, đã tạo lô hàng và cập nhật số lượng tồn kho');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi khi nhập kho: ' . $e->getMessage(), false);
        }
    }

    public function update(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền cập nhật đơn nhập hàng', false);
        // Simple update for fields like notes or status (not receive)
        $b = getBody();
        $fields = ['status', 'payment_status', 'paid_amount', 'notes'];
        $sets = []; $params = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $b)) {
                $sets[] = "$f = ?";
                $params[] = $b[$f];
            }
        }
        if (!$sets) respond(422, null, 'Không có dữ liệu cập nhật', false);

        $params[] = $id; $params[] = $auth['tenant_id'];
        $stmt = $this->db->prepare("UPDATE purchase_orders SET " . implode(',', $sets) . " WHERE id = ? AND tenant_id = ?");
        $stmt->execute($params);
        $this->show($auth, $id);
    }

    public function destroy(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền xóa đơn nhập hàng', false);
        $stmt = $this->db->prepare("DELETE FROM purchase_orders WHERE id = ? AND tenant_id = ? AND status = 'draft'");
        $stmt->execute([$id, $auth['tenant_id']]);
        if (!$stmt->rowCount()) respond(403, null, 'Chỉ có thể xóa đơn hàng nháp', false);
        respond(200, null, 'Đã xóa đơn hàng');
    }
}
