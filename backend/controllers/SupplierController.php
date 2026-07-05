<?php
class SupplierController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $search = $_GET['search'] ?? '';

        $where = ['tenant_id = ?', 'deleted_at IS NULL'];
        $params = [$tid];

        if ($search) {
            $where[] = '(name LIKE ? OR contact_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM suppliers WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("SELECT * FROM suppliers WHERE $w ORDER BY name ASC LIMIT $limit OFFSET $offset");
        $stmt->execute($params);
        
        respond(200, [
            'items' => $stmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit
        ]);
    }

    public function store(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền quản lý nhà cung cấp', false);
        $b = getBody();
        if (empty($b['name'])) respond(422, null, 'Tên nhà cung cấp là bắt buộc', false);

        // Check duplicate name
        $checkName = $this->db->prepare("SELECT id FROM suppliers WHERE tenant_id=? AND name=? AND deleted_at IS NULL LIMIT 1");
        $checkName->execute([$auth['tenant_id'], $b['name']]);
        if ($checkName->fetch()) {
            respond(409, null, "Nhà cung cấp '{$b['name']}' đã tồn tại trong hệ thống.", false);
        }

        // Check duplicate email
        if (!empty($b['email'])) {
            $checkEmail = $this->db->prepare("SELECT id FROM suppliers WHERE tenant_id=? AND email=? AND deleted_at IS NULL LIMIT 1");
            $checkEmail->execute([$auth['tenant_id'], $b['email']]);
            if ($checkEmail->fetch()) {
                respond(409, null, "Email '{$b['email']}' đã tồn tại trong hệ thống.", false);
            }
        }

        $stmt = $this->db->prepare("
            INSERT INTO suppliers (
                tenant_id, created_by, name, contact_name, email, phone, address, tax_code, notes,
                contact_position, website, scale_capital, typical_projects, focused_type, prestige_tier, cooperation_status, bank_account
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $auth['tenant_id'], $auth['user_id'], $b['name'],
            $b['contact_name'] ?? null, $b['email'] ?? null, $b['phone'] ?? null,
            $b['address'] ?? null, $b['tax_code'] ?? null, $b['notes'] ?? null,
            $b['contact_position'] ?? null, $b['website'] ?? null, $b['scale_capital'] ?? null,
            $b['typical_projects'] ?? null, $b['focused_type'] ?? null, $b['prestige_tier'] ?? null,
            $b['cooperation_status'] ?? 'active', $b['bank_account'] ?? null
        ]);
        $id = (int)$this->db->lastInsertId();
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'Thêm nhà cung cấp mới', 'supplier', $id, $b['name']);
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $stmt = $this->db->prepare("SELECT * FROM suppliers WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$id, $auth['tenant_id']]);
        $s = $stmt->fetch();
        if (!$s) respond(404, null, 'Không tìm thấy nhà cung cấp', false);
        respond(200, $s);
    }

    public function update(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền quản lý nhà cung cấp', false);
        $b = getBody();
        $fields = ['name', 'contact_name', 'email', 'phone', 'address', 'tax_code', 'notes', 'contact_position', 'website', 'scale_capital', 'typical_projects', 'focused_type', 'prestige_tier', 'cooperation_status', 'bank_account'];
        $sets = []; $params = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $b)) {
                $sets[] = "$f = ?";
                $params[] = $b[$f];
            }
        }
        if (!$sets) respond(422, null, 'Không có dữ liệu cập nhật', false);

        // Check duplicate name
        if (!empty($b['name'])) {
            $checkName = $this->db->prepare("SELECT id FROM suppliers WHERE tenant_id=? AND name=? AND id!=? AND deleted_at IS NULL LIMIT 1");
            $checkName->execute([$auth['tenant_id'], $b['name'], $id]);
            if ($checkName->fetch()) {
                respond(409, null, "Nhà cung cấp '{$b['name']}' đã tồn tại trong hệ thống.", false);
            }
        }

        // Check duplicate email
        if (!empty($b['email'])) {
            $checkEmail = $this->db->prepare("SELECT id FROM suppliers WHERE tenant_id=? AND email=? AND id!=? AND deleted_at IS NULL LIMIT 1");
            $checkEmail->execute([$auth['tenant_id'], $b['email'], $id]);
            if ($checkEmail->fetch()) {
                respond(409, null, "Email '{$b['email']}' đã tồn tại trong hệ thống.", false);
            }
        }

        $params[] = $id; $params[] = $auth['tenant_id'];
        $stmt = $this->db->prepare("UPDATE suppliers SET " . implode(',', $sets) . " WHERE id = ? AND tenant_id = ?");
        $stmt->execute($params);
        $this->show($auth, $id);
    }

    public function destroy(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền quản lý nhà cung cấp', false);
        $stmt = $this->db->prepare("UPDATE suppliers SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $auth['tenant_id']]);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'Xóa nhà cung cấp', 'supplier', $id);
        respond(200, null, 'Đã xóa nhà cung cấp');
    }
}
