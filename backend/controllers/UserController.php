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
            $stmt=$this->db->prepare("SELECT id,email,full_name,role,job_title,avatar_url,signature_url,phone,is_active,last_login_at,created_at,dob,gender,citizen_id,address,bank_name,bank_account,team_id,permissions_json FROM users WHERE $whereClause ORDER BY full_name");
            $stmt->execute($params);
            respond(200,$stmt->fetchAll());
        } catch (Throwable $e) {
            try {
                $stmt=$this->db->prepare("SELECT id,email,full_name,role,avatar_url,phone,is_active,last_login_at,created_at,team_id FROM users WHERE $whereClause ORDER BY full_name");
                $stmt->execute($params);
                respond(200,$stmt->fetchAll());
            } catch (Throwable $e2) {
                $stmt=$this->db->prepare("SELECT id,email,full_name,role,phone,is_active,created_at,team_id FROM users WHERE $whereClause ORDER BY full_name");
                $stmt->execute($params);
                respond(200,$stmt->fetchAll());
            }
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
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'manager', 'sales', 'sale', 'assistant', 'viewer'], true)) {
            respond(403, null, 'Quyền truy cập không đủ', false);
        }
        try {
            $stmt=$this->db->prepare("SELECT id,email,full_name,role,job_title,avatar_url,signature_url,phone,is_active,last_login_at,created_at,dob,gender,citizen_id,address,bank_name,bank_account,two_factor_enabled,two_factor_type,permissions_json FROM users WHERE id=? AND tenant_id=?");
            $stmt->execute([$id,$auth['tenant_id']]); $row=$stmt->fetch();
        } catch (PDOException $e) {
            $stmt=$this->db->prepare("SELECT id,email,full_name,role,avatar_url,signature_url,phone,is_active,last_login_at,created_at FROM users WHERE id=? AND tenant_id=?");
            $stmt->execute([$id,$auth['tenant_id']]); $row=$stmt->fetch();
        }
        if(!$row) respond(404,null,'Không tìm thấy người dùng',false);
        respond(200,$row);
    }
    public function update(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director'], true) && (int)$auth['user_id'] !== (int)$id) respond(403, null, 'Không có quyền cập nhật thông tin người khác', false);
        
        $b = getBody();
        $fields = ['email', 'full_name', 'phone', 'avatar_url', 'signature_url', 'is_active', 'dob', 'gender', 'citizen_id', 'address', 'bank_name', 'bank_account', 'permissions_json', 'job_title', 'team_id', 'zalo_chat_id', 'telegram_chat_id'];
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

        // Fetch current user row to check for old avatar and signature
        $oldUserStmt = $this->db->prepare("SELECT avatar_url, signature_url FROM users WHERE id = ? AND tenant_id = ?");
        $oldUserStmt->execute([$id, $auth['tenant_id']]);
        $oldUser = $oldUserStmt->fetch(PDO::FETCH_ASSOC);

        // Delete old physical signature if new signature URL or base64 is provided
        if (!empty($b['signature_url']) && $oldUser && !empty($oldUser['signature_url']) && $oldUser['signature_url'] !== $b['signature_url']) {
            deleteServerFile($oldUser['signature_url']);
        }

        // Save base64 signature as image file if provided
        if (!empty($b['signature_url']) && strpos($b['signature_url'], 'data:image/') === 0) {
            if (preg_match('/^data:image\/(\w+);base64,/', $b['signature_url'])) {
                $base64Data = substr($b['signature_url'], strpos($b['signature_url'], ',') + 1);
                $decoded = base64_decode($base64Data);
                if ($decoded !== false) {
                    $sigDir = __DIR__ . '/../uploads/signatures/';
                    if (!file_exists($sigDir)) {
                        @mkdir($sigDir, 0755, true);
                    }
                    $sigFileName = 'sig_' . (int)$id . '_' . time() . '_' . substr(md5(uniqid()), 0, 6) . '.png';
                    $sigPath = $sigDir . $sigFileName;
                    if (@file_put_contents($sigPath, $decoded)) {
                        $b['signature_url'] = 'uploads/signatures/' . $sigFileName;
                    }
                }
            }
        }

        // Delete old physical avatar file if new avatar_url is provided and differs
        if (array_key_exists('avatar_url', $b) && $oldUser && !empty($oldUser['avatar_url']) && $oldUser['avatar_url'] !== $b['avatar_url']) {
            deleteServerFile($oldUser['avatar_url']);
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
            // Delete user's physical avatar and signature files
            $oldStmt = $this->db->prepare("SELECT avatar_url, signature_url FROM users WHERE id = ? AND tenant_id = ?");
            $oldStmt->execute([$id, $auth['tenant_id']]);
            $oldUser = $oldStmt->fetch(PDO::FETCH_ASSOC);
            if ($oldUser) {
                if (!empty($oldUser['avatar_url'])) deleteServerFile($oldUser['avatar_url']);
                if (!empty($oldUser['signature_url'])) deleteServerFile($oldUser['signature_url']);
            }

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

    public function setup2FA(array $auth): void {
        require_once __DIR__ . '/../utils/TOTP.php';

        $stmt = $this->db->prepare("SELECT email FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$auth['user_id']]);
        $user = $stmt->fetch();
        if (!$user) respond(404, null, 'Người dùng không tồn tại', false);

        $secret = TOTP::generateSecret();
        $otpauthUrl = TOTP::getOtpAuthUrl($user['email'], $secret, 'RichLand');

        // Generate 5 backup codes
        $backupCodes = [];
        for ($i = 0; $i < 5; $i++) {
            $backupCodes[] = str_pad((string)random_int(10000000, 99999999), 8, '0', STR_PAD_LEFT);
        }

        respond(200, [
            'secret' => $secret,
            'otpauth_url' => $otpauthUrl,
            'backup_codes' => $backupCodes
        ]);
    }

    public function enable2FA(array $auth): void {
        $body = getBody();
        $type = trim($body['type'] ?? 'email');
        $code = trim($body['code'] ?? '');
        $secret = trim($body['secret'] ?? '');
        $backupCodes = $body['backup_codes'] ?? [];

        if (!in_array($type, ['email', 'totp'], true)) {
            respond(422, null, 'Phương thức 2FA không hợp lệ', false);
        }

        if ($type === 'totp') {
            if (!$code || !$secret) {
                respond(422, null, 'Vui lòng quét mã QR và nhập mã xác thực từ app', false);
            }
            require_once __DIR__ . '/../utils/TOTP.php';
            if (!TOTP::verifyCode($secret, $code)) {
                respond(400, null, 'Mã xác thực từ ứng dụng không đúng. Vui lòng thử lại.', false);
            }
        }

        $backupCodesJson = is_array($backupCodes) ? json_encode($backupCodes) : null;

        $this->db->prepare("
            UPDATE users 
            SET two_factor_enabled = 1, two_factor_type = ?, two_factor_secret = ?, two_factor_backup_codes = ? 
            WHERE id = ? AND tenant_id = ?
        ")->execute([$type, $secret ?: null, $backupCodesJson, $auth['user_id'], $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'user_2fa', $auth['user_id'], "Kích hoạt 2FA loại $type");

        respond(200, [
            'two_factor_enabled' => 1,
            'two_factor_type' => $type
        ], 'Đã bật xác thực 2 yếu tố (2FA) thành công');
    }

    public function disable2FA(array $auth): void {
        $body = getBody();
        $password = trim($body['password'] ?? '');

        if (!$password) {
            respond(422, null, 'Vui lòng nhập mật khẩu hiện tại để tắt 2FA', false);
        }

        $stmt = $this->db->prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$auth['user_id']]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(400, null, 'Mật khẩu hiện tại không chính xác', false);
        }

        $this->db->prepare("
            UPDATE users 
            SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_backup_codes = NULL 
            WHERE id = ? AND tenant_id = ?
        ")->execute([$auth['user_id'], $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'user_2fa', $auth['user_id'], "Tắt 2FA");

        respond(200, [
            'two_factor_enabled' => 0
        ], 'Đã tắt xác thực 2 yếu tố (2FA)');
    }
}
