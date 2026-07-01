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
            SELECT cs.*, c.first_name, c.last_name, c.phone, dep.unit_code, proj.name as project_name, dep.expected_commission
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            JOIN deposits dep ON cs.deposit_slip_id = dep.id
            JOIN projects proj ON dep.project_id = proj.id
            WHERE c.tenant_id = ?
        ";
        $params = [$tid];

        if ($auth['role'] === 'sales') {
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
        foreach ($slips as &$s) {
            $shares = json_decode($s['shares_json'] ?? '[]', true) ?: [];
            $signatures = json_decode($s['signatures_json'] ?? '[]', true) ?: [];
            
            $shareholdersDetails = [];
            foreach ($shares as $uid => $percent) {
                $stmtU = $this->db->prepare("SELECT full_name, email FROM users WHERE id = ?");
                $stmtU->execute([(int)$uid]);
                $u = $stmtU->fetch();
                if ($u) {
                    $shareholdersDetails[] = [
                        'user_id' => (int)$uid,
                        'name' => $u['full_name'],
                        'email' => $u['email'],
                        'percentage' => (int)$percent,
                        'signed' => isset($signatures[$uid]),
                        'signature_time' => $signatures[$uid]['time'] ?? null,
                        'signature_ip' => $signatures[$uid]['ip'] ?? null
                    ];
                }
            }
            $s['shareholders'] = $shareholdersDetails;
        }

        respond(200, $slips, 'Lấy danh sách phiếu hợp tác thành công');
    }

    public function autoGenerateSlip(int $contactId, int $depositId, int $creatorId): void {
        // Find owner of contact
        $stmtC = $this->db->prepare("SELECT owner_id FROM contacts WHERE id = ?");
        $stmtC->execute([$contactId]);
        $ownerId = (int)$stmtC->fetchColumn();

        // Query all unique sales who interacted with this contact
        $stmtAct = $this->db->prepare("
            SELECT DISTINCT user_id 
            FROM activities 
            WHERE contact_id = ? AND user_id IS NOT NULL AND user_id != ?
        ");
        $stmtAct->execute([$contactId, $ownerId]);
        $supporters = $stmtAct->fetchAll(PDO::FETCH_COLUMN) ?: [];

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

        if ($sum !== 100) {
            respond(422, null, 'Tổng tỷ lệ chia sẻ hoa hồng phải bằng 100% (Hiện tại là ' . $sum . '%)', false);
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

        if ($slip['status'] !== 'pending_signatures') {
            respond(400, null, 'Không thể cập nhật tỷ lệ sau khi phiếu đã được ký hoặc duyệt', false);
        }

        if ($auth['role'] === 'sales' && $slip['owner_id'] != $auth['user_id'] && $slip['created_by'] != $auth['user_id']) {
            respond(403, null, 'Chỉ chủ sở hữu khách hàng hoặc người tạo phiếu mới được cập nhật tỷ lệ', false);
        }

        $sharesJson = json_encode($shares);

        // Reset signatures upon updating shares
        $stmt = $this->db->prepare("
            UPDATE cooperation_slips 
            SET shares_json = ?, signatures_json = '{}', version = version + 1 
            WHERE id = ?
        ");
        $stmt->execute([$sharesJson, $id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_COOPERATION_SHARES', 'cooperation_slip', $id, "Cập nhật tỷ lệ chia hoa hồng phiên bản " . ($slip['version'] + 1));
        respond(200, null, 'Cập nhật tỷ lệ chia sẻ thành công. Vui lòng ký lại xác nhận.');
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

        if ($slip['status'] !== 'pending_signatures') {
            respond(400, null, 'Phiếu không trong trạng thái chờ ký', false);
        }

        $shares = json_decode($slip['shares_json'], true) ?: [];
        $userId = $auth['user_id'];

        if (!isset($shares[$userId])) {
            respond(403, null, 'Bạn không nằm trong danh sách phân chia hoa hồng của phiếu này', false);
        }

        $signatures = json_decode($slip['signatures_json'], true) ?: [];
        
        // Add signature
        $signatures[$userId] = [
            'time' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
            'role' => $auth['role']
        ];

        $signaturesJson = json_encode($signatures);
        
        // If all shareholders signed, move to pending_manager_approval
        $status = 'pending_signatures';
        $allSigned = true;
        foreach ($shares as $uid => $percent) {
            if (!isset($signatures[$uid])) {
                $allSigned = false;
                break;
            }
        }

        if ($allSigned) {
            $status = 'pending_manager_approval';
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
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);
        $b = getBody();
        $details = trim($b['reason'] ?? 'Không được duyệt');

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
}
