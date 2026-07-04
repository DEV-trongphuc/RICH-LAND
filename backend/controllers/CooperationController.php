<?php
// backend/controllers/CooperationController.php

class CooperationController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];

        $sql = "
            SELECT cs.*, c.first_name, c.last_name, c.phone, c.expected_revenue, 
                   (SELECT COALESCE(SUM(total),0) FROM invoices WHERE contact_id = c.id AND status = 'paid' AND deleted_at IS NULL) as actual_revenue,
                   dep.unit_code, proj.name as project_name, dep.expected_commission
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            LEFT JOIN deposits dep ON cs.deposit_slip_id = dep.id
            LEFT JOIN projects proj ON dep.project_id = proj.id
            WHERE c.tenant_id = ?
        ";
        $params = [$tid];

        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            // Only show slips where the sales is a shareholder
            $sql .= " AND (JSON_CONTAINS(JSON_KEYS(cs.shares_json), JSON_QUOTE(CAST(? AS CHAR))) OR cs.created_by = ?)";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }

        $sql .= " ORDER BY cs.created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $slips = $stmt->fetchAll();

        // Add detailed shareholder info (names) for readability
        $allUids = [];
        foreach ($slips as $s) {
            $shares = json_decode($s['shares_json'] ?? '[]', true) ?: [];
            foreach (array_keys($shares) as $uid) {
                $allUids[] = (int)$uid;
            }
        }
        $allUids = array_unique($allUids);

        $userMap = [];
        if (!empty($allUids)) {
            $inClause = implode(',', array_fill(0, count($allUids), '?'));
            $stmtU = $this->db->prepare("SELECT id, full_name, email, avatar_url FROM users WHERE id IN ($inClause)");
            $stmtU->execute(array_values($allUids));
            $users = $stmtU->fetchAll();
            foreach ($users as $u) {
                $userMap[(int)$u['id']] = $u;
            }
        }

        foreach ($slips as &$s) {
            $shares = json_decode($s['shares_json'] ?? '[]', true) ?: [];
            $signatures = json_decode($s['signatures_json'] ?? '[]', true) ?: [];
            
            $shareholdersDetails = [];
            foreach ($shares as $uid => $percent) {
                $u = $userMap[(int)$uid] ?? null;
                if ($u) {
                    $shareholdersDetails[] = [
                        'user_id' => (int)$uid,
                        'name' => $u['full_name'],
                        'email' => $u['email'],
                        'avatar' => $u['avatar_url'] ?? null,
                        'percentage' => (int)$percent,
                        'signed' => isset($signatures[$uid]),
                        'signature_time' => $signatures[$uid]['time'] ?? null,
                        'signature_ip' => $signatures[$uid]['ip'] ?? null,
                        'signature_img' => $signatures[$uid]['signature_img'] ?? null
                    ];
                }
            }
            $s['shareholders'] = $shareholdersDetails;
        }

        respond(200, $slips, 'Lấy danh sách phiếu hợp tác thành công');
    }

    public function autoGenerateSlip(int $contactId, int $depositId, int $creatorId): void {
        // Find owner of contact with safety check
        $stmtC = $this->db->prepare("SELECT owner_id, tenant_id FROM contacts WHERE id = ?");
        $stmtC->execute([$contactId]);
        $contact = $stmtC->fetch();
        if (!$contact) return;
        $ownerId = (int)$contact['owner_id'];

        // Query all unique sales who had access to this contact (both active and revoked)
        $stmtAct = $this->db->prepare("
            SELECT DISTINCT user_id 
            FROM quyen_truy_cap 
            WHERE contact_id = ? AND user_id != ?
        ");
        $stmtAct->execute([$contactId, $ownerId]);
        $supporters = $stmtAct->fetchAll(PDO::FETCH_COLUMN) ?: [];

        if (empty($supporters)) {
            // Fallback to activities for backward compatibility
            $stmtFallback = $this->db->prepare("
                SELECT DISTINCT user_id 
                FROM activities 
                WHERE related_type = 'contact' AND related_id = ? AND user_id IS NOT NULL AND user_id != ?
            ");
            $stmtFallback->execute([$contactId, $ownerId]);
            $supporters = $stmtFallback->fetchAll(PDO::FETCH_COLUMN) ?: [];
        }

        // Build default shares: Owner gets 100% (Sales can update this later)
        $shares = [];
        if ($ownerId > 0) {
            $shares[$ownerId] = 100;
        } else {
            $shares[$creatorId] = 100;
        }

        // Supporters get 0% initially
        foreach ($supporters as $suppId) {
            $shares[$suppId] = 0;
        }

        $sharesJson = json_encode($shares);

        $stmtIns = $this->db->prepare("
            INSERT INTO cooperation_slips (contact_id, deposit_slip_id, version, total_percentage, shares_json, signatures_json, status, created_by)
            VALUES (?, ?, 1, 100, ?, '{}', 'pending_signatures', ?)
        ");
        $stmtIns->execute([$contactId, $depositId, $sharesJson, $creatorId]);
    }

    public function updateShares(array $auth, int $id): void {
        $b = getBody();
        $shares = $b['shares'] ?? []; // Map of user_id (string) -> percentage (int)

        if (empty($shares)) {
            respond(422, null, 'Danh sách phân chia phần trăm là bắt buộc', false);
        }

        // Verify total sum is exactly 100%
        $sum = 0;
        foreach ($shares as $uid => $percent) {
            $sum += (int)$percent;
        }

        if ($sum > 100) {
            respond(422, null, 'Tổng tỷ lệ chia sẻ hoa hồng không được vượt quá 100% (Hiện tại là ' . $sum . '%)', false);
        }

        // Verify slip exists & status is pending_signatures
        $stmtSlip = $this->db->prepare("
            SELECT cs.*, c.owner_id 
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmtSlip->execute([$id, $auth['tenant_id']]);
        $slip = $stmtSlip->fetch();

        if (!$slip) {
            respond(404, null, 'Phiếu hợp tác không tồn tại', false);
        }

        $allowedStatuses = ['pending_signatures', 'approved', 'pending_manager_approval', 'approved_pending_signatures'];
        if (!in_array($slip['status'], $allowedStatuses)) {
            respond(400, null, 'Không thể cập nhật tỷ lệ trong trạng thái hiện tại', false);
        }

        $userId = $auth['user_id'];
        $oldShares = json_decode($slip['shares_json'] ?? '[]', true) ?: [];
        $isShareholder = isset($oldShares[$userId]) || isset($shares[$userId]);
        $isCreator = $slip['created_by'] == $userId;
        $isOwner = $slip['owner_id'] == $userId;
        $isManagerOrAdmin = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager']);

        if (!$isShareholder && !$isCreator && !$isOwner && !$isManagerOrAdmin) {
            respond(403, null, 'Chỉ chủ sở hữu, thành viên tham gia hoặc quản trị viên mới được cập nhật tỷ lệ', false);
        }

        $sharesJson = json_encode($shares);
        $reason = trim($b['reason'] ?? '');

        // If updated by admin/manager, reset signatures but change status to 'approved_pending_signatures' (which bypasses manager approval).
        // Otherwise, reset signatures and request change/approval.
        $signaturesVal = '{}';
        if ($isManagerOrAdmin) {
            $newStatus = 'approved_pending_signatures';
        } else {
            $newStatus = 'pending_signatures';
            if ($slip['status'] === 'approved' || $slip['status'] === 'pending_manager_approval' || $slip['status'] === 'approved_pending_signatures') {
                $newStatus = 'pending_manager_approval';
            }
        }

        $stmt = $this->db->prepare("
            UPDATE cooperation_slips 
            SET shares_json = ?, total_percentage = ?, signatures_json = ?, version = version + 1, status = ?, dispute_details = ?
            WHERE id = ?
        ");
        $stmt->execute([$sharesJson, $sum, $signaturesVal, $newStatus, $reason ?: null, $id]);

        if ($newStatus === 'pending_manager_approval') {
            $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
            $stmtUser->execute([$auth['user_id']]);
            $userRow = $stmtUser->fetch();
            $userName = $userRow['full_name'] ?? 'Nhân viên';

            $stmtMgrs = $this->db->prepare("
                SELECT id FROM users 
                WHERE tenant_id = ? AND role IN ('admin', 'superadmin', 'super_admin', 'manager')
            ");
            $stmtMgrs->execute([$auth['tenant_id']]);
            $mgrs = $stmtMgrs->fetchAll(PDO::FETCH_COLUMN) ?: [];

            $notifTitle = "Yêu cầu thay đổi tỷ lệ hoa hồng";
            $notifBody = "Nhân viên $userName yêu cầu thay đổi tỷ lệ hoa hồng cho Phiếu hợp tác #$id. Lý do: $reason";

            $stmtNotif = $this->db->prepare("
                INSERT INTO notifications (user_id, tenant_id, title, body, type, link) 
                VALUES (?, ?, ?, ?, 'cooperation_change_request', ?)
            ");
            foreach ($mgrs as $mgrId) {
                $stmtNotif->execute([$mgrId, $auth['tenant_id'], $notifTitle, $notifBody, "/cooperation-slips"]);
            }
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_COOPERATION_SHARES', 'cooperation_slip', $id, "Cập nhật/Yêu cầu thay đổi tỷ lệ hoa hồng phiên bản " . ($slip['version'] + 1) . ". Lý do: $reason");
        respond(200, null, 'Cập nhật tỷ lệ chia sẻ thành công. Đã gửi yêu cầu phê duyệt.');
    }

    public function signSlip(array $auth, int $id): void {
        // Slip exists
        $stmtSlip = $this->db->prepare("
            SELECT cs.*, c.tenant_id 
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmtSlip->execute([$id, $auth['tenant_id']]);
        $slip = $stmtSlip->fetch();

        if (!$slip) {
            respond(404, null, 'Phiếu hợp tác không tồn tại', false);
        }

        $allowedSignStatuses = ['pending_signatures', 'approved', 'pending_manager_approval'];
        if (!in_array($slip['status'], $allowedSignStatuses)) {
            respond(400, null, 'Phiếu không trong trạng thái chờ ký', false);
        }

        $shares = json_decode($slip['shares_json'], true) ?: [];
        $userId = $auth['user_id'];

        if (!isset($shares[$userId])) {
            respond(403, null, 'Bạn không nằm trong danh sách phân chia hoa hồng của phiếu này', false);
        }

        $signatures = json_decode($slip['signatures_json'], true) ?: [];
        $body = getBody();
        
        // Add signature
        $signatures[$userId] = [
            'time' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
            'role' => $auth['role'],
            'signature_img' => $body['signature_img'] ?? null
        ];

        $signaturesJson = json_encode($signatures);
        
        // If all shareholders signed, move to pending_manager_approval or approved (if pre-approved by admin/manager)
        $status = 'pending_signatures';
        if ($slip['status'] === 'approved_pending_signatures') {
            $status = 'approved_pending_signatures';
        }
        $allSigned = true;
        foreach ($shares as $uid => $percent) {
            if (!isset($signatures[$uid])) {
                $allSigned = false;
                break;
            }
        }

        if ($allSigned) {
            if ($slip['status'] === 'approved_pending_signatures') {
                $status = 'approved';
            } else {
                $status = 'pending_manager_approval';
            }
        }

        $stmt = $this->db->prepare("UPDATE cooperation_slips SET signatures_json = ?, status = ? WHERE id = ?");
        $stmt->execute([$signaturesJson, $status, $id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'SIGN_COOPERATION_SLIP', 'cooperation_slip', $id, "Ký xác nhận phiếu hợp tác ID: $id");
        respond(200, ['status' => $status], 'Ký xác nhận phiếu hợp tác thành công');
    }

    public function approveSlip(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);

        $stmtSlip = $this->db->prepare("
            SELECT cs.*, c.tenant_id 
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmtSlip->execute([$id, $auth['tenant_id']]);
        $slip = $stmtSlip->fetch();

        if (!$slip) {
            respond(404, null, 'Phiếu hợp tác không tồn tại', false);
        }

        if ($slip['status'] !== 'pending_manager_approval') {
            respond(400, null, 'Phiếu chưa được ký đủ chữ ký của các bên để phê duyệt', false);
        }

        $stmt = $this->db->prepare("UPDATE cooperation_slips SET status = 'approved' WHERE id = ?");
        $stmt->execute([$id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'APPROVE_COOPERATION_SLIP', 'cooperation_slip', $id, "Duyệt phiếu hợp tác hoa hồng ID: $id");
        respond(200, null, 'Phê duyệt phiếu hợp tác hoa hồng thành công');
    }

    public function rejectSlip(array $auth, int $id): void {
        $b = getBody();
        $details = trim($b['reason'] ?? 'Không đồng ý ký');

        $stmtSlip = $this->db->prepare("
            SELECT cs.*, c.tenant_id 
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmtSlip->execute([$id, $auth['tenant_id']]);
        $slip = $stmtSlip->fetch();

        if (!$slip) {
            respond(404, null, 'Phiếu hợp tác không tồn tại', false);
        }

        $shares = json_decode($slip['shares_json'] ?? '[]', true) ?: [];
        $userId = $auth['user_id'];
        $isShareholder = isset($shares[$userId]);
        $isCreator = $slip['created_by'] == $userId;
        $isManagerOrAdmin = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager']);

        if (!$isShareholder && !$isCreator && !$isManagerOrAdmin) {
            respond(403, null, 'Bạn không có quyền từ chối hoặc phản hồi phiếu này', false);
        }

        // Return to pending_signatures so sales can update percentages
        $stmt = $this->db->prepare("
            UPDATE cooperation_slips 
            SET status = 'rejected', dispute_details = ?, signatures_json = '{}' 
            WHERE id = ?
        ");
        $stmt->execute([$details, $id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'REJECT_COOPERATION_SLIP', 'cooperation_slip', $id, "Từ chối phiếu hợp tác ID: $id. Lý do: $details");
        respond(200, null, 'Đã từ chối phiếu hợp tác và yêu cầu ký lại từ đầu');
    }

    public function createSlip(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $b = getBody();
        $contactId = (int)($b['contact_id'] ?? 0);
        if ($contactId <= 0) {
            respond(422, null, 'ID khách hàng là bắt buộc', false);
        }

        // Check if slip already exists
        $stmtCheck = $this->db->prepare("SELECT id FROM cooperation_slips WHERE contact_id = ? LIMIT 1");
        $stmtCheck->execute([$contactId]);
        if ($stmtCheck->fetchColumn()) {
            respond(400, null, 'Phiếu hợp tác của khách hàng này đã tồn tại', false);
        }

        // Find owner of contact
        $stmtC = $this->db->prepare("SELECT owner_id FROM contacts WHERE id = ?");
        $stmtC->execute([$contactId]);
        $ownerId = (int)$stmtC->fetchColumn();
        if ($ownerId <= 0) {
            $ownerId = $auth['user_id'];
        }

        $shares = [$ownerId => 100];
        $sharesJson = json_encode($shares);

        $stmtIns = $this->db->prepare("
            INSERT INTO cooperation_slips (contact_id, deposit_slip_id, version, total_percentage, shares_json, signatures_json, status, created_by)
            VALUES (?, NULL, 1, 100, ?, '{}', 'pending_signatures', ?)
        ");
        $stmtIns->execute([$contactId, $sharesJson, $auth['user_id']]);
        $slipId = $this->db->lastInsertId();

        respond(201, ['id' => (int)$slipId], 'Khởi tạo phiếu hợp tác thành công');
    }

    public function uploadAttachment(array $auth, int $id): void {
        $tid = $auth['tenant_id'];

        // Owner or Admin/Manager check
        $stmtOwner = $this->db->prepare("
            SELECT c.owner_id 
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmtOwner->execute([$id, $tid]);
        $ownerId = $stmtOwner->fetchColumn();

        $isAllowed = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true) || 
                     ($ownerId && (int)$ownerId === (int)$auth['user_id']);

        if (!$isAllowed) {
            respond(403, null, 'Bạn không có quyền tải lên tài liệu cho phiếu hợp tác này', false);
        }

        if (empty($_FILES['file'])) {
            respond(422, null, 'Vui lòng chọn tệp tin để tải lên', false);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(500, null, 'Lỗi trong quá trình tải tệp lên server', false);
        }

        if ($file['size'] > 10 * 1024 * 1024) {
            respond(422, null, 'Dung lượng tệp tối đa cho phép là 10MB', false);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'gif'];
        if (!in_array($ext, $allowed)) {
            respond(422, null, "Định dạng tệp .$ext không được hỗ trợ", false);
        }

        $targetDir = UPLOAD_DIR . "/cooperation/$tid";
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0755, true);
        }

        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
        $fileName = time() . '_' . $safeName . '.' . $ext;
        $targetPath = $targetDir . '/' . $fileName;
        $dbPath = "uploads/cooperation/$tid/$fileName";

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            respond(500, null, 'Không thể di chuyển tệp đã tải lên vào thư mục đích', false);
        }

        $stmtCur = $this->db->prepare("SELECT attachment_url FROM cooperation_slips WHERE id = ?");
        $stmtCur->execute([$id]);
        $curUrl = $stmtCur->fetchColumn();

        $newUrl = $curUrl ? ($curUrl . ',' . $dbPath) : $dbPath;

        $stmt = $this->db->prepare("
            UPDATE cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            SET cs.attachment_url = ?
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmt->execute([$newUrl, $id, $tid]);

        respond(200, ['file_url' => $dbPath], 'Tải lên tài liệu đính kèm thành công');
    }

    public function deleteAttachment(array $auth, int $id): void {
        $tid = $auth['tenant_id'];

        // Owner or Admin/Manager check
        $stmtOwner = $this->db->prepare("
            SELECT c.owner_id 
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmtOwner->execute([$id, $tid]);
        $ownerId = $stmtOwner->fetchColumn();

        $isAllowed = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true) || 
                     ($ownerId && (int)$ownerId === (int)$auth['user_id']);

        if (!$isAllowed) {
            respond(403, null, 'Bạn không có quyền xóa tài liệu đính kèm này', false);
        }

        $b = getBody();
        $fileUrl = trim($b['file_url'] ?? '');
        if (empty($fileUrl)) {
            respond(422, null, 'Vui lòng cung cấp URL tệp để xóa', false);
        }

        $stmtCur = $this->db->prepare("SELECT attachment_url FROM cooperation_slips WHERE id = ?");
        $stmtCur->execute([$id]);
        $curUrl = $stmtCur->fetchColumn();

        if ($curUrl) {
            $files = explode(',', $curUrl);
            $remaining = [];
            foreach ($files as $f) {
                if (trim($f) === $fileUrl) {
                    $physPath = UPLOAD_DIR . '/' . str_replace('uploads/', '', $f);
                    if (file_exists($physPath) && is_file($physPath)) {
                        @unlink($physPath);
                    }
                } else {
                    $remaining[] = $f;
                }
            }
            $newUrl = !empty($remaining) ? implode(',', $remaining) : null;

            $stmt = $this->db->prepare("
                UPDATE cooperation_slips cs
                JOIN contacts c ON cs.contact_id = c.id
                SET cs.attachment_url = ?
                WHERE cs.id = ? AND c.tenant_id = ?
            ");
            $stmt->execute([$newUrl, $id, $tid]);
        }

        respond(200, null, 'Xóa tài liệu đính kèm thành công');
    }

    public function renameAttachment(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        
        $stmtOwner = $this->db->prepare("
            SELECT cs.attachment_url, c.owner_id 
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmtOwner->execute([$id, $tid]);
        $row = $stmtOwner->fetch();
        if (!$row) {
            respond(404, null, 'Không tìm thấy phiếu hợp tác', false);
        }
        
        $isAllowed = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true) || 
                     ((int)$row['owner_id'] === (int)$auth['user_id']);
                     
        if (!$isAllowed) {
            respond(403, null, 'Bạn không có quyền đổi tên tài liệu này', false);
        }

        $b = getBody();
        $fileUrl = trim($b['file_url'] ?? '');
        $newName = trim($b['name'] ?? '');
        if (empty($fileUrl)) {
            respond(422, null, 'Vui lòng cung cấp URL tệp để đổi tên', false);
        }
        if (empty($newName)) {
            respond(422, null, 'Tên tài liệu mới không được bỏ trống', false);
        }

        $curUrl = $row['attachment_url'];
        if (empty($curUrl)) {
            respond(400, null, 'Phiếu hợp tác chưa có tài liệu để đổi tên', false);
        }

        $files = explode(',', $curUrl);
        $found = false;
        $dbPath = '';
        foreach ($files as &$f) {
            if (trim($f) === $fileUrl) {
                $oldPath = UPLOAD_DIR . '/' . str_replace('uploads/', '', $f);
                $ext = strtolower(pathinfo($oldPath, PATHINFO_EXTENSION));
                $newNameClean = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($newName, PATHINFO_FILENAME));
                $newFileName = time() . '_' . $newNameClean . '.' . $ext;
                $targetDir = dirname($oldPath);
                $newPath = $targetDir . '/' . $newFileName;
                $dbPath = "uploads/cooperation/$tid/$newFileName";

                if (file_exists($oldPath) && is_file($oldPath)) {
                    if (rename($oldPath, $newPath)) {
                        $f = $dbPath;
                        $found = true;
                    }
                } else {
                    $f = $dbPath;
                    $found = true;
                }
            }
        }

        if ($found) {
            $newUrl = implode(',', $files);
            $stmt = $this->db->prepare("UPDATE cooperation_slips SET attachment_url = ? WHERE id = ?");
            $stmt->execute([$newUrl, $id]);
            respond(200, ['file_url' => $newUrl], 'Đổi tên tài liệu thành công');
        } else {
            respond(404, null, 'Không tìm thấy tệp cần đổi tên trong danh sách', false);
        }
    }

    public function destroy(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        
        $stmt = $this->db->prepare("
            SELECT cs.id, cs.status, cs.created_by, c.owner_id 
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmt->execute([$id, $tid]);
        $row = $stmt->fetch();
        if (!$row) {
            respond(404, null, 'Không tìm thấy phiếu hợp tác', false);
        }
        
        $isAllowed = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager'], true) || 
                     ((int)$row['created_by'] === (int)$auth['user_id']);
                     
        if (!$isAllowed) {
            respond(403, null, 'Bạn không có quyền xóa phiếu hợp tác này', false);
        }
        
        $stmtDel = $this->db->prepare("DELETE FROM cooperation_slips WHERE id = ?");
        $stmtDel->execute([$id]);
        
        respond(200, null, 'Xóa phiếu hợp tác thành công');
    }
}
