<?php
class UserController {
    private PDO $db;
    public function __construct(PDO $db) { 
        $this->db = $db; 
        try {
            $this->db->exec("ALTER TABLE users ADD COLUMN dob DATE NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE users ADD COLUMN citizen_id VARCHAR(50) NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE users ADD COLUMN address TEXT NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE users ADD COLUMN bank_name VARCHAR(100) NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE users ADD COLUMN bank_account VARCHAR(100) NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE users ADD COLUMN permissions_json LONGTEXT NULL");
        } catch (Exception $e) {}
    }

    public function index(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'manager', 'sales', 'sale'], true)) respond(403, null, 'Quyền admin là bắt buộc', false);
        
        $where = ["tenant_id = ?"];
        $params = [$auth['tenant_id']];
        
        $all = isset($_GET['all']) && (string)$_GET['all'] === '1';
        if (!$all) {
            if ($auth['role'] === 'manager') {
                $where[] = "(id = ? OR team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR team_id = (SELECT team_id FROM users WHERE id = ?))";
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
            } else if (in_array($auth['role'], ['sales', 'sale'], true)) {
                $tStmt = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
                $tStmt->execute([$auth['user_id']]);
                $teamRow = $tStmt->fetch();
                $teamId = $teamRow ? $teamRow['team_id'] : null;
                if ($teamId) {
                    $where[] = "(role IN ('admin', 'super_admin', 'superadmin', 'director', 'manager') OR team_id = ?)";
                    $params[] = $teamId;
                } else {
                    $where[] = "(role IN ('admin', 'super_admin', 'superadmin', 'director', 'manager') OR id = ?)";
                    $params[] = $auth['user_id'];
                }
            }
        }

        $whereClause = implode(" AND ", $where);
        
        try {
            $stmt=$this->db->prepare("SELECT id,email,full_name,role,job_title,avatar_url,phone,is_active,last_login_at,created_at,dob,gender,citizen_id,address,bank_name,bank_account,team_id,permissions_json FROM users WHERE $whereClause ORDER BY full_name");
            $stmt->execute($params);
            respond(200,$stmt->fetchAll());
        } catch (PDOException $e) {
            $stmt=$this->db->prepare("SELECT id,email,full_name,role,avatar_url,phone,is_active,last_login_at,created_at,team_id FROM users WHERE $whereClause ORDER BY full_name");
            $stmt->execute($params);
            respond(200,$stmt->fetchAll());
        }
    }

    public function store(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director'], true)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b=getBody();
        if(empty($b['email'])||empty($b['password'])||empty($b['full_name'])) respond(422,null,'Email, mật khẩu và tên là bắt buộc',false);
        // Check duplicate
        $chk=$this->db->prepare("SELECT id FROM users WHERE email=? AND tenant_id=?");
        $chk->execute([$b['email'],$auth['tenant_id']]);
        if($chk->fetch()) respond(409,null,'Email đã tồn tại trong hệ thống',false);
        $hash=password_hash($b['password'],PASSWORD_BCRYPT,['cost'=>12]);
        $this->db->prepare("INSERT INTO users (tenant_id,email,password_hash,full_name,role,phone,dob,gender,citizen_id,address,bank_name,bank_account) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([
                $auth['tenant_id'],
                $b['email'],
                $hash,
                $b['full_name'],
                $b['role']??'sales',
                $b['phone']??null,
                $b['dob']??null,
                $b['gender']??null,
                $b['citizen_id']??null,
                $b['address']??null,
                $b['bank_name']??null,
                $b['bank_account']??null
            ]);
        $newId = (int)$this->db->lastInsertId();
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'user', $newId, json_encode(['email' => $b['email'], 'role' => $b['role']??'sales']));
        
        $this->show($auth, $newId);
    }
    public function show(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director'], true) && $auth['user_id'] !== $id) respond(403, null, 'Không có quyền xem thông tin người khác', false);
        try {
            $stmt=$this->db->prepare("SELECT id,email,full_name,role,avatar_url,phone,is_active,last_login_at,created_at,dob,gender,citizen_id,address,bank_name,bank_account,permissions_json FROM users WHERE id=? AND tenant_id=?");
            $stmt->execute([$id,$auth['tenant_id']]); $row=$stmt->fetch();
        } catch (PDOException $e) {
            $stmt=$this->db->prepare("SELECT id,email,full_name,role,avatar_url,phone,is_active,last_login_at,created_at FROM users WHERE id=? AND tenant_id=?");
            $stmt->execute([$id,$auth['tenant_id']]); $row=$stmt->fetch();
        }
        if(!$row) respond(404,null,'Không tìm thấy người dùng',false);
        respond(200,$row);
    }
    public function update(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director'], true) && $auth['user_id'] !== $id) respond(403, null, 'Không có quyền cập nhật thông tin người khác', false);
        
        $b = getBody();
        $fields = ['email', 'full_name', 'phone', 'avatar_url', 'is_active', 'dob', 'gender', 'citizen_id', 'address', 'bank_name', 'bank_account', 'permissions_json'];
        if (in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director'], true)) {
            $fields[] = 'role';
            $fields[] = 'is_active';
        }

        // Admin lockout prevention
        if ($auth['user_id'] === $id) {
            if (isset($b['role']) && !in_array($b['role'], ['admin', 'super_admin', 'superadmin', 'director'], true)) {
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
    public function destroy(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director'], true)) respond(403, null, 'Quyền admin là bắt buộc', false);
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
