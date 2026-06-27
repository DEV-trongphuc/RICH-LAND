<?php

class CustomFieldController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $entity_type = $_GET['entity_type'] ?? null;
        
        $sql = "SELECT * FROM custom_fields WHERE tenant_id = ?";
        $params = [$auth['tenant_id']];
        
        if ($entity_type) {
            $sql .= " AND entity_type = ?";
            $params[] = $entity_type;
        }
        
        $sql .= " ORDER BY order_index ASC, id ASC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $fields = $stmt->fetchAll();
        
        foreach ($fields as &$f) {
            if (!empty($f['options'])) {
                $f['options'] = json_decode($f['options'], true);
            } else {
                $f['options'] = [];
            }
            $f['is_required'] = (bool)$f['is_required'];
            $f['is_filterable'] = (bool)$f['is_filterable'];
        }
        
        respond(200, $fields);
    }

    public function store(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) {
            respond(403, null, 'Bạn không có quyền quản lý trường tùy chỉnh', false);
        }
        
        $b = getBody();
        if (empty($b['entity_type']) || empty($b['label']) || empty($b['field_type'])) {
            respond(422, null, 'Vui lòng điền đầy đủ module, tên trường và loại dữ liệu', false);
        }
        
        $field_key = $b['field_key'] ?? $this->generateKey($b['label']);
        
        $check = $this->db->prepare("SELECT id FROM custom_fields WHERE tenant_id = ? AND entity_type = ? AND field_key = ?");
        $check->execute([$auth['tenant_id'], $b['entity_type'], $field_key]);
        if ($check->fetchColumn()) {
            $field_key .= '_' . time();
        }
        
        $options = null;
        if (in_array($b['field_type'], ['dropdown', 'multiselect']) && isset($b['options'])) {
            $options = json_encode(is_array($b['options']) ? $b['options'] : explode(',', $b['options']));
        }

        $stmt = $this->db->prepare("
            INSERT INTO custom_fields (tenant_id, entity_type, field_key, label, field_type, options, is_required, is_filterable, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $auth['tenant_id'],
            $b['entity_type'],
            $field_key,
            $b['label'],
            $b['field_type'],
            $options,
            $b['is_required'] ?? 0,
            $b['is_filterable'] ?? 1,
            $b['order_index'] ?? 0
        ]);
        
        respond(200, ['id' => $this->db->lastInsertId()], 'Đã thêm trường tùy chỉnh thành công');
    }

    public function update(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) {
            respond(403, null, 'Bạn không có quyền quản lý trường tùy chỉnh', false);
        }
        
        $b = getBody();
        $fields = ['label', 'field_type', 'is_required', 'is_filterable', 'order_index', 'options'];
        $sets = []; $params = [];
        
        foreach ($fields as $f) {
            if (array_key_exists($f, $b)) {
                $sets[] = "$f=?";
                if ($f === 'options') {
                    $params[] = is_array($b[$f]) ? json_encode($b[$f]) : $b[$f];
                } else {
                    $params[] = $b[$f];
                }
            }
        }
        
        if (empty($sets)) respond(422, null, 'Không có dữ liệu để cập nhật', false);
        
        $params[] = $id;
        $params[] = $auth['tenant_id'];
        
        $sql = "UPDATE custom_fields SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        if ($stmt->rowCount() === 0) {
            respond(404, null, 'Không tìm thấy trường tùy chỉnh hoặc không có thay đổi', false);
        }
        
        respond(200, null, 'Cập nhật trường tùy chỉnh thành công');
    }

    public function destroy(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) {
            respond(403, null, 'Bạn không có quyền quản lý trường tùy chỉnh', false);
        }
        
        $stmt = $this->db->prepare("DELETE FROM custom_fields WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $auth['tenant_id']]);
        
        if ($stmt->rowCount() === 0) {
            respond(404, null, 'Không tìm thấy trường tùy chỉnh', false);
        }
        
        respond(200, null, 'Đã xóa trường tùy chỉnh');
    }
    
    private function generateKey(string $label): string {
        $str = strtolower(trim($label));
        $str = preg_replace('/(à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ)/', 'a', $str);
        $str = preg_replace('/(è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ)/', 'e', $str);
        $str = preg_replace('/(ì|í|ị|ỉ|ĩ)/', 'i', $str);
        $str = preg_replace('/(ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ)/', 'o', $str);
        $str = preg_replace('/(ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ)/', 'u', $str);
        $str = preg_replace('/(ỳ|ý|ỵ|ỷ|ỹ)/', 'y', $str);
        $str = preg_replace('/(đ)/', 'd', $str);
        $str = preg_replace('/[^a-z0-9]/', '_', $str);
        $str = preg_replace('/_+/', '_', $str);
        return trim($str, '_');
    }
}
