<?php

class ExportController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function export(array $auth): void {
        if (!in_array($auth['role'], ['super_admin', 'admin', 'manager', 'sales', 'sale'])) {
            respond(403, null, 'Bạn không có quyền xuất dữ liệu', false);
        }
        
        $type = $_GET['type'] ?? 'contact';
        
        // Allowed types
        if (!in_array($type, ['contact', 'company', 'deal', 'product', 'inventory'])) {
            respond(400, null, 'Loại dữ liệu xuất không hợp lệ', false);
        }

        // Prepare response headers for CSV download
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="export_' . $type . '_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // Open output stream
        $output = fopen('php://output', 'w');
        
        // UTF-8 BOM for Excel compatibility
        fputs($output, "\xEF\xBB\xBF");

        // 1. Fetch Custom Fields definition for this type
        $stmtFields = $this->db->prepare("SELECT id, field_key, label, field_type FROM custom_fields WHERE tenant_id = ? AND entity_type = ? ORDER BY order_index ASC");
        $stmtFields->execute([$auth['tenant_id'], $type]);
        $customFields = $stmtFields->fetchAll(PDO::FETCH_ASSOC);

        // Prepare Base Columns
        $baseColumns = [];
        $sql = "";
        $params = [$auth['tenant_id']];
        $saleFilter = (in_array($auth['role'], ['sales', 'sale'], true)) ? " AND t.owner_id = ?" : "";
        if ($saleFilter && !in_array($type, ['product', 'inventory'])) $params[] = $auth['user_id'];

        if ($type === 'contact') {
            $baseColumns = ['id' => 'ID', 'first_name' => 'Tên', 'last_name' => 'Họ', 'email' => 'Email', 'phone' => 'Số điện thoại', 'mobile' => 'Di động', 'job_title' => 'Chức danh', 'department' => 'Phòng ban', 'source' => 'Nguồn', 'status' => 'Trạng thái', 'company_name' => 'Công ty', 'owner_name' => 'Người phụ trách', 'created_at' => 'Ngày tạo'];
            
            $sql = "SELECT t.*, co.name as company_name, u.full_name as owner_name 
                    FROM contacts t 
                    LEFT JOIN companies co ON t.company_id = co.id 
                    LEFT JOIN users u ON t.owner_id = u.id 
                    WHERE t.tenant_id = ? AND t.deleted_at IS NULL $saleFilter ORDER BY t.created_at DESC";
        } elseif ($type === 'company') {
            $baseColumns = ['id' => 'ID', 'name' => 'Tên công ty', 'tax_id' => 'Mã số thuế', 'industry' => 'Ngành nghề', 'email' => 'Email', 'phone' => 'Số điện thoại', 'website' => 'Website', 'address' => 'Địa chỉ', 'city' => 'Tỉnh/Thành phố', 'size' => 'Quy mô', 'status' => 'Trạng thái', 'owner_name' => 'Người phụ trách', 'created_at' => 'Ngày tạo'];
            
            $sql = "SELECT t.*, u.full_name as owner_name 
                    FROM companies t 
                    LEFT JOIN users u ON t.owner_id = u.id 
                    WHERE t.tenant_id = ? AND t.deleted_at IS NULL $saleFilter ORDER BY t.created_at DESC";
        } elseif ($type === 'deal') {
            $baseColumns = ['id' => 'ID', 'title' => 'Tên Deal', 'value' => 'Giá trị', 'currency' => 'Tiền tệ', 'probability' => 'Xác suất (%)', 'expected_close_date' => 'Ngày dự kiến đóng', 'priority' => 'Độ ưu tiên', 'contact_name' => 'Người liên hệ', 'company_name' => 'Công ty', 'stage_name' => 'Giai đoạn', 'owner_name' => 'Người phụ trách', 'created_at' => 'Ngày tạo'];
            
            $sql = "SELECT t.*, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, u.full_name as owner_name, ps.name as stage_name
                    FROM deals t 
                    LEFT JOIN contacts c ON t.contact_id = c.id
                    LEFT JOIN companies co ON t.company_id = co.id 
                    LEFT JOIN users u ON t.owner_id = u.id 
                    LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
                    WHERE t.tenant_id = ? AND t.deleted_at IS NULL $saleFilter ORDER BY t.created_at DESC";
        } elseif ($type === 'product') {
            $baseColumns = ['id' => 'ID', 'name' => 'Tên sản phẩm', 'sku' => 'SKU', 'category' => 'Danh mục', 'unit' => 'Đơn vị', 'price' => 'Giá bán', 'cost' => 'Giá vốn', 'description' => 'Mô tả', 'created_at' => 'Ngày tạo'];
            $sql = "SELECT t.* FROM products t WHERE t.tenant_id = ? AND t.deleted_at IS NULL ORDER BY t.name ASC";
        } elseif ($type === 'inventory') {
            $baseColumns = ['id' => 'ID', 'product_name' => 'Sản phẩm', 'sku' => 'SKU', 'batch_code' => 'Mã lô', 'import_date' => 'Ngày nhập', 'expiry_date' => 'Hạn sử dụng', 'import_price' => 'Giá nhập', 'initial_qty' => 'Số lượng ban đầu', 'current_qty' => 'Tồn kho hiện tại', 'status' => 'Trạng thái'];
            $sql = "SELECT b.*, p.name as product_name, p.sku 
                    FROM batches b 
                    JOIN products p ON b.product_id = p.id 
                    WHERE b.tenant_id = ? AND b.status = 'active' ORDER BY b.import_date DESC";
        }


        // Generate Header Row
        $headerRow = array_values($baseColumns);
        foreach ($customFields as $cf) {
            $headerRow[] = $cf['label'];
        }
        fputcsv($output, $headerRow);

        // Fetch Main Data in batches to prevent memory exhaustion
        $batchSize = 1000;
        $offset = 0;
        $totalExported = 0;

        while (true) {
            $batchSql = $sql . " LIMIT $batchSize OFFSET $offset";
            $stmt = $this->db->prepare($batchSql);
            $stmt->execute($params);
            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($records)) {
                break;
            }

            // Fetch Custom Field Values for this batch of records efficiently
            $entityIds = array_column($records, 'id');
            $groupedCfValues = [];
            
            if (!empty($entityIds)) {
                $placeholders = implode(',', array_fill(0, count($entityIds), '?'));
                
                $cfvSql = "SELECT cf.field_key, cfv.entity_id, cfv.value_text, cfv.value_number, cfv.value_date, cfv.value_json, cf.field_type
                           FROM custom_field_values cfv
                           JOIN custom_fields cf ON cfv.custom_field_id = cf.id
                           WHERE cf.tenant_id = ? AND cf.entity_type = ? AND cfv.entity_id IN ($placeholders)";
                
                $cfvParams = array_merge([$auth['tenant_id'], $type], $entityIds);
                $stmtCfv = $this->db->prepare($cfvSql);
                $stmtCfv->execute($cfvParams);
                $cfValues = $stmtCfv->fetchAll(PDO::FETCH_ASSOC);
                
                // Group CF values by entity_id
                foreach ($cfValues as $val) {
                    $eId = $val['entity_id'];
                    $key = $val['field_key'];
                    if (!isset($groupedCfValues[$eId])) {
                        $groupedCfValues[$eId] = [];
                    }
                    
                    // Format value based on type
                    $displayValue = '';
                    if ($val['field_type'] === 'number' && $val['value_number'] !== null) {
                        $displayValue = $val['value_number'] + 0; // removes trailing zeros
                    } elseif ($val['field_type'] === 'date' && $val['value_date'] !== null) {
                        $displayValue = $val['value_date'];
                    } elseif ($val['field_type'] === 'multiselect' || $val['field_type'] === 'checkbox') {
                        $arr = json_decode($val['value_json'] ?? '[]', true);
                        if (is_array($arr)) {
                            // Check if it's boolean true for single checkbox
                            if ($val['field_type'] === 'checkbox' && (is_bool($arr) || is_bool(json_decode($val['value_text']??'false')))) {
                                $displayValue = (json_decode($val['value_text']??'false') || $arr === true) ? 'Có' : 'Không';
                            } else {
                                $displayValue = implode(', ', $arr);
                            }
                        } else {
                            $displayValue = $val['value_text'] ?? '';
                        }
                    } else {
                        $displayValue = $val['value_text'] ?? '';
                    }
                    
                    $groupedCfValues[$eId][$key] = $displayValue;
                }
            }

            // Write Rows to Output Stream
            foreach ($records as $record) {
                $row = [];
                // Map base columns
                foreach (array_keys($baseColumns) as $colKey) {
                    $row[] = $record[$colKey] ?? '';
                }
                
                // Map custom fields
                $eId = $record['id'];
                foreach ($customFields as $cf) {
                    $key = $cf['field_key'];
                    $row[] = $groupedCfValues[$eId][$key] ?? '';
                }
                
                fputcsv($output, $row);
            }

            $totalExported += count($records);
            $offset += $batchSize;

            // Clear batch memory
            unset($records, $entityIds, $groupedCfValues, $cfValues);
        }

        fclose($output);
        
        // Log action
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], "Export Data ($type)", $type, null, "Exported " . $totalExported . " records");
        
        exit;
    }
}
