<?php
// f:\CRM\backend\controllers\POSController.php

class POSController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }


    public function createOrder(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện giao dịch POS', false);
        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $data = getBody();

        if (empty($data['cart'])) {
            respond(400, null, "Giỏ hàng không được để trống", false);
        }

        $customerId = !empty($data['customer_id']) ? (int)$data['customer_id'] : null;
        
        // Server-side validation of total_amount
        $calculatedTotal = 0;
        foreach ($data['cart'] as $item) {
            $qty = (float)$item['quantity'];
            $price = (float)$item['price'];
            if ($qty <= 0 || $price < 0) {
                respond(422, null, "Số lượng phải lớn hơn 0 và giá không được âm", false);
            }
            $calculatedTotal += $price * $qty;
        }
        $shipping = (float)($data['shipping_fee'] ?? 0);
        if ($shipping < 0) respond(422, null, "Phí giao hàng không được âm", false);
        $totalWithShipping = $calculatedTotal + $shipping;

        if (abs($totalWithShipping - (float)$data['total_amount']) > 1) {
             respond(422, null, "Tổng tiền không khớp với dữ liệu giỏ hàng. Vui lòng kiểm tra lại.", false);
        }

        if ($customerId) {
            // Verify customer belongs to tenant and is accessible by the user's role
            $sqlCust = "SELECT id FROM contacts WHERE id=? AND tenant_id=?";
            $pCust = [$customerId, $tid];
            if (in_array($auth['role'], ['sales', 'sale'], true)) {
                $sqlCust .= " AND owner_id=?";
                $pCust[] = $uid;
            } else if ($auth['role'] === 'manager') {
                $sqlCust .= " AND (owner_id = ? OR owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))";
                $pCust[] = $uid;
                $pCust[] = $uid;
            }
            $checkCust = $this->db->prepare($sqlCust);
            $checkCust->execute($pCust);
            if (!$checkCust->fetch()) {
                respond(403, null, "Khách hàng không hợp lệ hoặc bạn không có quyền thao tác trên khách hàng này", false);
            }
        }

        // Validate product ownership for all items in the cart
        foreach ($data['cart'] as $item) {
            if (!empty($item['id'])) {
                $pCheck = $this->db->prepare("SELECT id FROM products WHERE id=? AND tenant_id=?");
                $pCheck->execute([(int)$item['id'], $tid]);
                if (!$pCheck->fetch()) {
                    respond(403, null, "Sản phẩm ID {$item['id']} không hợp lệ hoặc không thuộc cửa hàng này", false);
                }
            }
        }

        $this->db->beginTransaction();
        try {
            $title = "Đơn hàng POS - " . date('d/m/Y H:i');
            
            // 1. Create an Invoice (Status: paid)
            $today = date('Ymd');
            $invNum = 'POS-' . $today . '-' . strtoupper(bin2hex(random_bytes(3)));
            $sInv = $this->db->prepare("
                INSERT INTO invoices (tenant_id, contact_id, created_by, invoice_number, title, status, issue_date, due_date, paid_at, total, shipping_fee, shipping_customer_pay, is_inventory_deducted)
                VALUES (?, ?, ?, ?, ?, 'paid', CURDATE(), CURDATE(), NOW(), ?, ?, ?, 1)
            ");
            $sInv->execute([
                $tid, 
                $customerId, 
                $uid, 
                $invNum, 
                $title, 
                $data['total_amount'],
                $data['shipping_fee'] ?? 0,
                $data['shipping_customer_pay'] ?? 0
            ]);
            $invId = $this->db->lastInsertId();


            // 2. Add Invoice Items and Deduct Stock
            $sItem = $this->db->prepare("INSERT INTO invoice_items (invoice_id, product_id, name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)");
            foreach ($data['cart'] as $item) {
                $sItem->execute([
                    $invId,
                    $item['id'] ?? null,
                    $item['name'],
                    $item['quantity'],
                    $item['price'],
                    $item['price'] * $item['quantity']
                ]);
                
                // Deduct stock if product_id is present
                if (!empty($item['id'])) {
                    $pCheck = $this->db->prepare("SELECT track_inventory FROM products WHERE id=? AND tenant_id=?");
                    $pCheck->execute([(int) $item['id'], $tid]);
                    if ($pCheck->fetchColumn()) {
                        deductStockFIFO($this->db, $tid, $uid, (int)$item['id'], (float)$item['quantity'], $invNum);
                    }
                }
            }

            // 3. Update Customer Stats & Timeline
            if ($customerId) {
                $sCust = $this->db->prepare("
                    UPDATE contacts 
                    SET total_spent = total_spent + ?, 
                        order_count = order_count + 1, 
                        last_order_at = NOW(),
                        last_contact = CURRENT_DATE,
                        status = 'customer'
                    WHERE id = ? AND tenant_id = ?
                ");
                $sCust->execute([$data['total_amount'], $customerId, $tid]);

                logInteraction(
                    $this->db, $tid, $uid, 'task', 
                    "Đơn hàng POS #$invNum", 
                    "Đơn hàng trị giá " . number_format($data['total_amount'], 0, ',', '.') . " đ đã hoàn tất.",
                    'contact', $customerId
                );
            }

            // 4. Activity log (Internal Audit)
            logActivity($this->db, $tid, $uid, 'Tạo đơn hàng POS', 'invoice', (int)$invId, $invNum);

            $this->db->commit();
            respond(201, ["invoice_id" => $invId, "message" => "Đơn hàng hoàn tất thành công"]);
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }
}
