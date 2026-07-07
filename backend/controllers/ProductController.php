<?php
class ProductController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $search = $_GET['search'] ?? '';

        $where = ['p.tenant_id = ?', 'p.deleted_at IS NULL'];
        $params = [$tid];

        if ($search) {
            $where[] = '(p.name LIKE ? OR p.sku LIKE ? OR pc.name LIKE ?)';
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $cid = $_GET['category_id'] ?? '';
        if ($cid) {
            $where[] = 'p.category_id = ?';
            $params[] = $cid;
        }

        $whereStr = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM products p LEFT JOIN product_categories pc ON p.category_id = pc.id WHERE $whereStr");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt=$this->db->prepare("
            SELECT p.*, pc.name as category_name 
            FROM products p 
            LEFT JOIN product_categories pc ON p.category_id = pc.id 
            WHERE $whereStr 
            ORDER BY p.name ASC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        respond(200, ['items' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'limit' => $limit]);
    }
    public function store(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) respond(403, null, 'Bạn không có quyền thêm sản phẩm', false);
        $b=getBody();
        if(empty($b['name'])) respond(422,null,'Tên sản phẩm là bắt buộc',false);
        if (($b['price'] ?? 0) < 0 || ($b['cost'] ?? 0) < 0) respond(422, null, 'Giá bán và Giá vốn không được âm', false);
        
        $catId = !empty($b['category_id']) ? (int)(is_string($b['category_id']) && str_starts_with($b['category_id'], 'c') ? substr($b['category_id'], 1) : $b['category_id']) : null;
        if ($catId) {
            $checkCat = $this->db->prepare("SELECT id FROM product_categories WHERE id=? AND tenant_id=?");
            $checkCat->execute([$catId, $auth['tenant_id']]);
            if (!$checkCat->fetch()) respond(404, null, 'Danh mục không hợp lệ', false);
        }
        // Check duplicate SKU
        if (!empty($b['sku'])) {
            $checkSku = $this->db->prepare("SELECT id FROM products WHERE tenant_id=? AND sku=? AND deleted_at IS NULL LIMIT 1");
            $checkSku->execute([$auth['tenant_id'], $b['sku']]);
            if ($checkSku->fetch()) {
                respond(409, null, "Mã sản phẩm (SKU) '{$b['sku']}' đã tồn tại trong hệ thống.", false);
            }
        }

        $sql = "INSERT INTO products (tenant_id, created_by, category_id, name, sku, category, description, price, cost, unit, track_inventory, track_cost, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $params = [
            $auth['tenant_id'],
            $auth['user_id'],
            $catId,
            $b['name'],
            $b['sku'] ?? null,
            $b['category'] ?? null,
            $b['description'] ?? null,
            (float)($b['price'] ?? 0),
            (float)($b['cost'] ?? 0),
            $b['unit'] ?? 'cái',
            isset($b['track_inventory']) ? ($b['track_inventory'] ? 1 : 0) : 1,
            isset($b['track_cost']) ? ($b['track_cost'] ? 1 : 0) : 1,
            isset($b['is_active']) ? ($b['is_active'] ? 1 : 0) : 1
        ];

        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $id = (int)$this->db->lastInsertId();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'Tạo sản phẩm mới', 'product', $id, $b['name']);
            $this->show($auth, $id);
        } catch (PDOException $e) {
            respond(500, null, 'Lỗi cơ sở dữ liệu: ' . $e->getMessage(), false);
        }
    }
    public function show(array $auth,int $id): void {
        $stmt=$this->db->prepare("SELECT * FROM products WHERE id=? AND tenant_id=? AND deleted_at IS NULL");
        $stmt->execute([$id,$auth['tenant_id']]);
        $row=$stmt->fetch(); if(!$row) respond(404,null,'Không tìm thấy',false);
        respond(200,$row);
    }
    public function update(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) respond(403, null, 'Bạn không có quyền cập nhật sản phẩm', false);
        $b=getBody();
        if (($b['price'] ?? 0) < 0 || ($b['cost'] ?? 0) < 0) respond(422, null, 'Giá bán và Giá vốn không được âm', false);

        $catId = null;
        if (array_key_exists('category_id', $b)) {
            $catId = !empty($b['category_id']) ? (int)(is_string($b['category_id']) && str_starts_with($b['category_id'], 'c') ? substr($b['category_id'], 1) : $b['category_id']) : null;
            if ($catId) {
                $checkCat = $this->db->prepare("SELECT id FROM product_categories WHERE id=? AND tenant_id=?");
                $checkCat->execute([$catId, $auth['tenant_id']]);
                if (!$checkCat->fetch()) respond(404, null, 'Danh mục không hợp lệ', false);
            }
        }

        $fields = ['name','sku','category','category_id','description','price','cost','unit','track_inventory','track_cost','is_active','min_stock_level'];
        $sets=[];$params=[];
        foreach($fields as $f){
            if(array_key_exists($f,$b)){
                $sets[]="$f=?";
                if ($f === 'category_id') {
                    $val = $catId;
                } else {
                    $val = $b[$f];
                    if(($f === 'stock_quantity' || $f === 'is_active') && $val === '') $val = null;
                    if($f === 'track_inventory' || $f === 'track_cost' || $f === 'is_active') $val = $val ? 1 : 0;
                }
                $params[]=$val;
            }
        }

        if(!$sets) respond(422,null,'Không có dữ liệu',false);
        
        // Check duplicate SKU
        if (!empty($b['sku'])) {
            $checkSku = $this->db->prepare("SELECT id FROM products WHERE tenant_id=? AND sku=? AND id!=? AND deleted_at IS NULL LIMIT 1");
            $checkSku->execute([$auth['tenant_id'], $b['sku'], $id]);
            if ($checkSku->fetch()) {
                respond(409, null, "Mã sản phẩm (SKU) '{$b['sku']}' đã tồn tại trong hệ thống.", false);
            }
        }

        $params[]=$id;$params[]=$auth['tenant_id'];

        try {
            $this->db->prepare("UPDATE products SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?")->execute($params);
            $this->show($auth,$id);
        } catch (PDOException $e) {
            respond(500, null, 'Lỗi cập nhật sản phẩm: ' . $e->getMessage(), false);
        }
    }
    public function destroy(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) respond(403, null, 'Bạn không có quyền xóa sản phẩm', false);
        $this->db->prepare("UPDATE products SET deleted_at=NOW() WHERE id=? AND tenant_id=?")->execute([$id,$auth['tenant_id']]);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'Xóa sản phẩm', 'product', $id);
        respond(200,null,'Đã xóa sản phẩm (vào thùng rác)');
    }

    public function bulkDelete(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) respond(403, null, 'Bạn không có quyền xóa sản phẩm', false);
        $b = getBody();
        $ids = $b['ids'] ?? [];
        if (empty($ids)) respond(400, null, 'ID không hợp lệ', false);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $this->db->prepare("UPDATE products SET deleted_at=NOW() WHERE tenant_id=? AND id IN ($placeholders)")
            ->execute(array_merge([$auth['tenant_id']], $ids));
        respond(200, null, "Đã xóa " . count($ids) . " sản phẩm");
    }
}
