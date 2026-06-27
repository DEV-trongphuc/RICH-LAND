<?php

class ImportController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    /** GET /import/template?type=contact — Download dynamic CSV template */
    public function template(array $auth): void {
        $type = $_GET['type'] ?? 'contact';
        if (!in_array($type, ['contact', 'company', 'deal', 'product', 'inventory'])) {
            respond(400, null, 'Loại dữ liệu không hợp lệ', false);
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="template_' . $type . '.csv"');
        echo "\xEF\xBB\xBF"; // UTF-8 BOM
        
        $headers = [];
        $sample = [];

        if ($type === 'contact') {
            $headers = ['first_name', 'last_name', 'email', 'phone', 'job_title', 'source', 'status', 'company_name'];
            $sample  = ['Nguyễn', 'Văn A', 'example@email.com', '0901234567', 'Giám đốc', 'website', 'lead', 'Công ty ABC'];
        } elseif ($type === 'company') {
            $headers = ['name', 'industry', 'city', 'phone', 'email', 'website', 'status', 'tax_id'];
            $sample  = ['Công ty ABC', 'Công nghệ', 'TP.HCM', '02812345678', 'info@abc.vn', 'abc.vn', 'active', '0101234567'];
        } elseif ($type === 'deal') {
            $headers = ['title', 'value', 'currency', 'expected_close_date', 'probability', 'contact_email', 'company_name', 'stage_name'];
            $sample  = ['Hợp đồng phần mềm', '50000000', 'VND', date('Y-m-d', strtotime('+30 days')), '50', 'a@example.com', 'Công ty ABC', 'Mới'];
        } elseif ($type === 'product') {
            $headers = ['name', 'sku', 'category', 'unit', 'price', 'description'];
            $sample  = ['Sản phẩm A', 'SKU-001', 'Phần mềm', 'Gói', '1500000', 'Mô tả sản phẩm'];
        } elseif ($type === 'inventory') {
            $headers = ['product_name', 'batch_code', 'import_date', 'expiry_date', 'import_price', 'initial_qty'];
            $sample  = ['Sản phẩm A', 'LOT-001', date('Y-m-d'), date('Y-m-d', strtotime('+1 year')), '1000000', '100'];
        }

        // Add Custom Fields to template
        $stmtFields = $this->db->prepare("SELECT field_key, label FROM custom_fields WHERE tenant_id = ? AND entity_type = ? ORDER BY order_index ASC");
        $stmtFields->execute([$auth['tenant_id'], $type]);
        $customFields = $stmtFields->fetchAll(PDO::FETCH_ASSOC);

        foreach ($customFields as $cf) {
            $headers[] = $cf['field_key'];
            $sample[]  = 'Dữ liệu tùy chỉnh';
        }

        echo implode(',', $headers) . "\n";
        echo implode(',', array_map(fn($v) => '"' . str_replace('"', '""', $v) . '"', $sample)) . "\n";
        exit;
    }

    /** POST /import/process — Upload & process CSV */
    public function process(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) {
            respond(403, null, 'Bạn không có quyền nhập dữ liệu', false);
        }

        $type = $_POST['type'] ?? 'contact';
        if (empty($_FILES['file'])) respond(422, null, 'Vui lòng upload file CSV', false);
        
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) respond(422, null, 'Upload thất bại', false);
        
        $handle = fopen($file['tmp_name'], 'r');
        $bom = fread($handle, 3);
        if ($bom !== "\xEF\xBB\xBF") rewind($handle);

        $headers = fgetcsv($handle);
        if (!$headers) respond(422, null, 'File không có dữ liệu', false);
        $headers = array_map('trim', $headers);

        // Fetch Custom Fields for mapping
        $stmtFields = $this->db->prepare("SELECT id, field_key, field_type FROM custom_fields WHERE tenant_id = ? AND entity_type = ?");
        $stmtFields->execute([$auth['tenant_id'], $type]);
        $customFieldDefs = $stmtFields->fetchAll(PDO::FETCH_ASSOC);
        $cfMap = [];
        foreach ($customFieldDefs as $cf) {
            $idx = array_search($cf['field_key'], $headers);
            if ($idx !== false) $cfMap[$idx] = $cf;
        }

        $imported = 0; $errors = 0; $errorLog = [];
        $this->db->beginTransaction();

        try {
            while (($row = fgetcsv($handle)) !== false) {
                if (empty(array_filter($row))) continue;
                
                $rowMap = [];
                foreach ($headers as $i => $h) {
                    $rowMap[$h] = isset($row[$i]) ? trim($row[$i]) : null;
                }

                $entityId = null;
                if ($type === 'contact') {
                    $entityId = $this->importContact($auth, $rowMap);
                } elseif ($type === 'company') {
                    $entityId = $this->importCompany($auth, $rowMap);
                } elseif ($type === 'deal') {
                    $entityId = $this->importDeal($auth, $rowMap);
                } elseif ($type === 'product') {
                    $entityId = $this->importProduct($auth, $rowMap);
                } elseif ($type === 'inventory') {
                    $entityId = $this->importInventory($auth, $rowMap);
                }

                if ($entityId) {
                    // Process Custom Fields
                    foreach ($cfMap as $idx => $cf) {
                        $val = isset($row[$idx]) ? trim($row[$idx]) : '';
                        if ($val !== '') {
                            $this->saveCustomFieldValue($entityId, $cf, $val);
                        }
                    }
                    $imported++;
                } else {
                    $errors++;
                }
            }
            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi hệ thống trong quá trình import: ' . $e->getMessage(), false);
        }

        fclose($handle);
        respond(200, [
            'imported' => $imported,
            'errors'   => $errors,
            'error_log' => $errorLog
        ], "Import hoàn tất: {$imported} thành công, {$errors} lỗi");
    }

    private function importContact(array $auth, array $data): ?int {
        if (empty($data['first_name'])) return null;

        // Check company
        $companyId = null;
        if (!empty($data['company_name'])) {
            $stmt = $this->db->prepare("SELECT id FROM companies WHERE name = ? AND tenant_id = ?");
            $stmt->execute([$data['company_name'], $auth['tenant_id']]);
            $companyId = $stmt->fetchColumn() ?: null;
        }

        $stmt = $this->db->prepare("INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, job_title, source, status, company_id, owner_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $auth['tenant_id'], $data['first_name'], $data['last_name'] ?? '',
            $data['email'] ?? null, $data['phone'] ?? null, $data['job_title'] ?? null,
            $data['source'] ?? 'other', $data['status'] ?? 'lead',
            $companyId, $auth['user_id'], $auth['user_id']
        ]);
        return (int)$this->db->lastInsertId();
    }

    private function importCompany(array $auth, array $data): ?int {
        if (empty($data['name'])) return null;
        $stmt = $this->db->prepare("INSERT INTO companies (tenant_id, name, industry, city, phone, email, website, status, tax_id, owner_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $auth['tenant_id'], $data['name'], $data['industry'] ?? null,
            $data['city'] ?? null, $data['phone'] ?? null, $data['email'] ?? null,
            $data['website'] ?? null, $data['status'] ?? 'active', $data['tax_id'] ?? null,
            $auth['user_id'], $auth['user_id']
        ]);
        return (int)$this->db->lastInsertId();
    }

    private function importDeal(array $auth, array $data): ?int {
        if (empty($data['title'])) return null;
        
        // Find contact or company
        $contactId = null;
        if (!empty($data['contact_email'])) {
            $stmt = $this->db->prepare("SELECT id FROM contacts WHERE email = ? AND tenant_id = ?");
            $stmt->execute([$data['contact_email'], $auth['tenant_id']]);
            $contactId = $stmt->fetchColumn() ?: null;
        }

        $companyId = null;
        if (!empty($data['company_name'])) {
            $stmt = $this->db->prepare("SELECT id FROM companies WHERE name = ? AND tenant_id = ?");
            $stmt->execute([$data['company_name'], $auth['tenant_id']]);
            $companyId = $stmt->fetchColumn() ?: null;
        }

        // Find stage
        $stageId = null;
        if (!empty($data['stage_name'])) {
            $stmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE name = ? AND tenant_id = ?");
            $stmt->execute([$data['stage_name'], $auth['tenant_id']]);
            $stageId = $stmt->fetchColumn() ?: null;
        }

        $stmt = $this->db->prepare("INSERT INTO deals (tenant_id, title, value, currency, expected_close_date, probability, contact_id, company_id, stage_id, owner_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $auth['tenant_id'], $data['title'], $data['value'] ?? 0,
            $data['currency'] ?? 'VND', $data['expected_close_date'] ?? null,
            $data['probability'] ?? 0, $contactId, $companyId, $stageId,
            $auth['user_id'], $auth['user_id']
        ]);
        return (int)$this->db->lastInsertId();
    }

    private function importProduct(array $auth, array $data): ?int {
        if (empty($data['name'])) return null;
        $stmt = $this->db->prepare("INSERT INTO products (tenant_id, name, sku, category, unit, price, description, created_by) VALUES (?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $auth['tenant_id'], $data['name'], $data['sku'] ?? null,
            $data['category'] ?? null, $data['unit'] ?? 'Cái',
            $data['price'] ?? 0, $data['description'] ?? null,
            $auth['user_id']
        ]);
        return (int)$this->db->lastInsertId();
    }

    private function importInventory(array $auth, array $data): ?int {
        if (empty($data['product_name']) && empty($data['sku'])) return null;
        
        // Find product
        $stmt = $this->db->prepare("SELECT id FROM products WHERE (name = ? OR sku = ?) AND tenant_id = ?");
        $stmt->execute([$data['product_name'] ?? '', $data['sku'] ?? '', $auth['tenant_id']]);
        $productId = $stmt->fetchColumn();
        
        if (!$productId) return null;

        $initialQty = (int)($data['initial_qty'] ?? 0);
        $importPrice = (float)($data['import_price'] ?? 0);

        // 1. Insert into batches
        $stmt = $this->db->prepare("INSERT INTO batches (tenant_id, product_id, batch_code, import_date, expiry_date, import_price, initial_qty, current_qty) VALUES (?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $auth['tenant_id'], $productId, $data['batch_code'] ?? 'IMPORT-'.date('Ymd'),
            $data['import_date'] ?? date('Y-m-d'), $data['expiry_date'] ?? null,
            $importPrice, $initialQty, $initialQty
        ]);
        $batchId = (int)$this->db->lastInsertId();

        if ($batchId && $initialQty > 0) {
            // 2. Update overall product stock
            $updateStock = $this->db->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND tenant_id = ?");
            $updateStock->execute([$initialQty, $productId, $auth['tenant_id']]);

            // 3. Create inventory log
            $insertLog = $this->db->prepare("
                INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by)
                VALUES (?, ?, 'IMPORT', ?, ?, ?)
            ");
            $insertLog->execute([
                $auth['tenant_id'], $batchId, $initialQty, 'Import từ CSV', $auth['user_id']
            ]);
        }

        return $batchId;
    }

    private function saveCustomFieldValue(int $entityId, array $cf, string $value): void {
        $col = 'value_text';
        $saveVal = $value;

        if ($cf['field_type'] === 'number') {
            $col = 'value_number';
            $saveVal = (float)$value;
        } elseif ($cf['field_type'] === 'date') {
            $col = 'value_date';
        } elseif ($cf['field_type'] === 'multiselect' || $cf['field_type'] === 'checkbox') {
            $col = 'value_json';
            $saveVal = json_encode(array_map('trim', explode(',', $value)));
        }

        $stmt = $this->db->prepare("INSERT INTO custom_field_values (custom_field_id, entity_id, $col) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE $col = VALUES($col)");
        $stmt->execute([$cf['id'], $entityId, $saveVal]);
    }
}

