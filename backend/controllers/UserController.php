<?php
class UserController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'super_admin'], true)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $stmt=$this->db->prepare("SELECT id,email,full_name,role,avatar_url,phone,is_active,last_login_at,created_at FROM users WHERE tenant_id=? ORDER BY full_name");
        $stmt->execute([$auth['tenant_id']]);
        respond(200,$stmt->fetchAll());
    }
    public function store(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'super_admin'], true)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b=getBody();
        if(empty($b['email'])||empty($b['password'])||empty($b['full_name'])) respond(422,null,'Email, mật khẩu và tên là bắt buộc',false);
        // Check duplicate
        $chk=$this->db->prepare("SELECT id FROM users WHERE email=? AND tenant_id=?");
        $chk->execute([$b['email'],$auth['tenant_id']]);
        if($chk->fetch()) respond(409,null,'Email đã tồn tại trong hệ thống',false);
        $hash=password_hash($b['password'],PASSWORD_BCRYPT,['cost'=>12]);
        $this->db->prepare("INSERT INTO users (tenant_id,email,password_hash,full_name,role,phone) VALUES (?,?,?,?,?,?)")
            ->execute([$auth['tenant_id'],$b['email'],$hash,$b['full_name'],$b['role']??'sales',$b['phone']??null]);
        $newId = (int)$this->db->lastInsertId();
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'user', $newId, json_encode(['email' => $b['email'], 'role' => $b['role']??'sales']));
        
        $this->show($auth, $newId);
    }
    public function show(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin'], true) && $auth['user_id'] !== $id) respond(403, null, 'Không có quyền xem thông tin người khác', false);
        $stmt=$this->db->prepare("SELECT id,email,full_name,role,avatar_url,phone,is_active,last_login_at,created_at FROM users WHERE id=? AND tenant_id=?");
        $stmt->execute([$id,$auth['tenant_id']]); $row=$stmt->fetch();
        if(!$row) respond(404,null,'Không tìm thấy người dùng',false);
        respond(200,$row);
    }
    public function update(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin'], true) && $auth['user_id'] !== $id) respond(403, null, 'Không có quyền cập nhật thông tin người khác', false);
        $b=getBody(); $fields=['full_name','phone']; // Fields anyone can update on themselves
        if (in_array($auth['role'], ['admin', 'super_admin'], true)) {
            $fields[] = 'role';
            $fields[] = 'is_active';
        }

        // Admin lockout prevention
        if ($auth['user_id'] === $id) {
            if (isset($b['role']) && !in_array($b['role'], ['admin', 'super_admin'], true)) {
                respond(403, null, 'Bạn không thể tự tước quyền quản trị của chính mình', false);
            }
            if (isset($b['is_active']) && !$b['is_active']) {
                respond(403, null, 'Bạn không thể tự khóa tài khoản của chính mình', false);
            }
        }

        $sets=[];$params=[];
        foreach($fields as $f){if(array_key_exists($f,$b)){$sets[]="$f=?";$params[]=$b[$f];}}
        if(!empty($b['password'])){$sets[]='password_hash=?';$params[]=password_hash($b['password'],PASSWORD_BCRYPT,['cost'=>12]);}
        if(!$sets) respond(422,null,'Không có dữ liệu',false);
        $params[]=$id;$params[]=$auth['tenant_id'];
        $this->db->prepare("UPDATE users SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?")->execute($params);
        
        // Log changes (Masking password)
        $logData = $b;
        if (isset($logData['password'])) unset($logData['password']);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'user', $id, json_encode($logData));
        
        $this->show($auth,$id);
    }
    public function destroy(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin'], true)) respond(403, null, 'Quyền admin là bắt buộc', false);
        if($id===$auth['user_id']) respond(403,null,'Không thể xóa tài khoản của chính mình',false);
        try {
            $this->db->prepare("DELETE FROM users WHERE id=? AND tenant_id=?")->execute([$id,$auth['tenant_id']]);
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'user', $id);
            respond(200,null,'Đã xóa người dùng');
        } catch (PDOException $e) {
            if ($e->getCode() == '23000') {
                respond(400, null, 'Không thể xóa người dùng này vì họ đang quản lý dữ liệu (liên hệ, hóa đơn, deal). Vui lòng chuyển trạng thái thành "Ngừng hoạt động" thay vì xóa.', false);
            }
            respond(500, null, 'Lỗi cơ sở dữ liệu: ' . $e->getMessage(), false);
        }
    }
}
