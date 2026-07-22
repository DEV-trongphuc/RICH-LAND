<?php
// backend/controllers/CooperationController.php

class CooperationController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    private function notifyShareholders(int $slipId, array $shares, string $subject, string $title, string $content): void {
        require_once __DIR__ . '/../mailer.php';

        // Fetch slip and contact info to enrich notifications with customer details
        $stmtSlip = $this->db->prepare("
            SELECT cs.created_by, c.tenant_id, c.first_name, c.last_name, c.phone, c.owner_id
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ?
        ");
        $stmtSlip->execute([$slipId]);
        $slip = $stmtSlip->fetch(PDO::FETCH_ASSOC);
        if (!$slip) return;

        $tenantId = (int)$slip['tenant_id'];
        $customerName = trim($slip['first_name'] . ' ' . $slip['last_name']) ?: 'Khách hàng ẩn danh';
        $customerPhone = $slip['phone'] ?: 'Không có SĐT';

        // Enrich subject and content with customer info
        $enrichedSubject = $subject . " - Khách: " . $customerName;
        $enrichedContent = $content . "<br/><br/>" .
                           "<strong>Thông tin khách hàng:</strong><br/>" .
                           "- Họ tên: " . htmlspecialchars($customerName) . "<br/>" .
                           "- Số điện thoại: " . htmlspecialchars($customerPhone) . "<br/>";

        $uids = array_map('intval', array_keys($shares));
        if ($slip['created_by']) {
            $uids[] = (int)$slip['created_by'];
        }
        if ($slip['owner_id']) {
            $uids[] = (int)$slip['owner_id'];
        }
        $uids = array_unique($uids);
        if (empty($uids)) return;

        require_once __DIR__ . '/../NotificationService.php';

        foreach ($uids as $uid) {
            NotificationService::send($this->db, $tenantId, 'COOPERATION_PENDING_APPROVAL', [
                'user_id' => $uid,
                'slip_id' => $slip['id'] ?? 0,
                'reason' => strip_tags($content)
            ]);
        }
    }

    private function checkSlipAccess(array $auth, int $id): bool {
        if (in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true)) {
            return true;
        }

        // Fetch slip details
        $stmtSlip = $this->db->prepare("
            SELECT cs.created_by, c.owner_id, cs.shares_json, c.tenant_id
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ?
        ");
        $stmtSlip->execute([$id]);
        $slip = $stmtSlip->fetch();
        if (!$slip) return false;
        
        // Tenant check
        if ((int)$slip['tenant_id'] !== (int)$auth['tenant_id']) return false;

        $userId = (int)$auth['user_id'];
        $shares = json_decode($slip['shares_json'] ?? '[]', true) ?: [];
        $isShareholder = isset($shares[$userId]);
        $isCreator = (int)$slip['created_by'] === $userId;
        $isOwner = (int)$slip['owner_id'] === $userId;

        if ($auth['role'] === 'manager') {
            if ($isCreator || $isOwner || $isShareholder) {
                return true;
            }
            $uidsToCheck = [(int)$slip['created_by'], (int)$slip['owner_id']];
            foreach ($shares as $u => $p) {
                $uidsToCheck[] = (int)$u;
            }
            $uidsToCheck = array_unique(array_filter($uidsToCheck));
            if (!empty($uidsToCheck)) {
                $inUids = implode(',', array_fill(0, count($uidsToCheck), '?'));
                $stmtTeamCheck = $this->db->prepare("
                    SELECT 1 FROM users 
                    WHERE id IN ($inUids) AND team_id IN (SELECT id FROM teams WHERE leader_id = ?)
                ");
                $stmtTeamCheck->execute(array_merge($uidsToCheck, [$userId]));
                if ($stmtTeamCheck->fetch()) {
                    return true;
                }
            }
            return false;
        }

        return ($isCreator || $isOwner || $isShareholder);
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

        $scope = $this->getScope($auth, 'cooperation', 'read');
        if ($scope === 'all') {
            // No extra filters
        } else if ($scope === 'team') {
            $sql .= " AND (
                (cs.shares_json IS NOT NULL AND JSON_VALID(cs.shares_json) AND JSON_CONTAINS(JSON_KEYS(cs.shares_json), JSON_QUOTE(CAST(? AS CHAR))))
                OR cs.created_by = ?
                OR EXISTS (
                    SELECT 1 FROM users u2 
                    WHERE u2.team_id IN (SELECT id FROM teams WHERE leader_id = ?)
                    AND (
                        (cs.shares_json IS NOT NULL AND JSON_VALID(cs.shares_json) AND JSON_CONTAINS(JSON_KEYS(cs.shares_json), JSON_QUOTE(CAST(u2.id AS CHAR))))
                        OR cs.created_by = u2.id
                    )
                )
            )";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $sql .= " AND (
                (cs.shares_json IS NOT NULL AND JSON_VALID(cs.shares_json) AND JSON_CONTAINS(JSON_KEYS(cs.shares_json), JSON_QUOTE(CAST(? AS CHAR))))
                OR cs.created_by = ?
            )";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else {
            $sql .= ' AND 1=0';
        }

        if (isset($_GET['pending_sign']) && $_GET['pending_sign'] === '1') {
            $sql .= " AND cs.status != 'rejected' 
                      AND (cs.shares_json IS NOT NULL AND JSON_VALID(cs.shares_json) AND JSON_CONTAINS(JSON_KEYS(cs.shares_json), JSON_QUOTE(CAST(? AS CHAR))))
                      AND NOT (cs.signatures_json IS NOT NULL AND JSON_VALID(cs.signatures_json) AND JSON_CONTAINS(JSON_KEYS(cs.signatures_json), JSON_QUOTE(CAST(? AS CHAR))))";
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
            if (!empty($s['approved_by'])) {
                $allUids[] = (int)$s['approved_by'];
            }
            if (!empty($s['adjustment_request_user_id'])) {
                $allUids[] = (int)$s['adjustment_request_user_id'];
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

            $approverDetails = null;
            if (!empty($s['approved_by'])) {
                $u = $userMap[(int)$s['approved_by']] ?? null;
                if ($u) {
                    $approverDetails = [
                        'user_id' => (int)$s['approved_by'],
                        'name' => $u['full_name'],
                        'email' => $u['email'],
                        'avatar' => $u['avatar_url'] ?? null,
                        'approved_at' => $s['approved_at']
                    ];
                }
            }
            $adjustmentRequestDetails = null;
            if (!empty($s['adjustment_request_user_id'])) {
                $u = $userMap[(int)$s['adjustment_request_user_id']] ?? null;
                if ($u) {
                    $sharesList = [];
                    $reqShares = json_decode($s['adjustment_request_shares_json'] ?? '[]', true) ?: [];
                    foreach ($reqShares as $uid => $percent) {
                        $sharesList[] = [
                            'user_id' => (int)$uid,
                            'percentage' => (int)$percent
                        ];
                    }
                    $adjustmentRequestDetails = [
                        'user_id' => (int)$s['adjustment_request_user_id'],
                        'name' => $u['full_name'],
                        'email' => $u['email'],
                        'avatar' => $u['avatar_url'] ?? null,
                        'reason' => $s['adjustment_request_reason'],
                        'requested_at' => $s['adjustment_request_at'],
                        'expected_commission' => $s['adjustment_request_commission'] ? (int)$s['adjustment_request_commission'] : null,
                        'shares' => $sharesList
                    ];
                }
            }
            
            $s['shareholders'] = $shareholdersDetails;
            $s['approver'] = $approverDetails;
            $s['adjustment_request'] = $adjustmentRequestDetails;
        }

        respond(200, $slips, 'Lấy danh sách phiếu hợp tác thành công');
    }

    public function autoGenerateSlip(int $contactId, int $depositId, int $creatorId, ?array $customShares = null): void {
        // Find owner of contact with safety check
        $stmtC = $this->db->prepare("SELECT owner_id, tenant_id FROM contacts WHERE id = ?");
        $stmtC->execute([$contactId]);
        $contact = $stmtC->fetch();
        if (!$contact) return;
        $ownerId = (int)$contact['owner_id'];

        $shares = [];
        if ($customShares !== null && !empty($customShares)) {
            // Get all valid helpers from quyen_truy_cap for this contact
            $stmtQ = $this->db->prepare("SELECT DISTINCT user_id FROM quyen_truy_cap WHERE contact_id = ?");
            $stmtQ->execute([$contactId]);
            $validHelpers = $stmtQ->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $validHelpers = array_map('intval', $validHelpers);

            foreach ($customShares as $uid => $pct) {
                $uidInt = (int)$uid;
                $pctInt = (int)$pct;
                if ($uidInt === $ownerId || in_array($uidInt, $validHelpers, true)) {
                    $shares[$uidInt] = $pctInt;
                }
            }

            $totalPct = array_sum($shares);
            if (empty($shares) || $totalPct !== 100) {
                $targetOwner = $ownerId > 0 ? $ownerId : $creatorId;
                $shares = [$targetOwner => 100];
            }
        } else {
            // Default to single independent sale for contact owner or creator
            $targetOwner = $ownerId > 0 ? $ownerId : $creatorId;
            $shares = [$targetOwner => 100];
        }

        $sharesJson = json_encode($shares);

        // If it's a single shareholder (no cooperation), auto-approve it!
        $isSingleShareholder = count($shares) === 1;
        $status = $isSingleShareholder ? 'approved' : 'pending_signatures';

        $sigs = [];
        if ($isSingleShareholder) {
            $onlyKey = array_key_first($shares);
            $sigs[$onlyKey] = true;
        }
        $signaturesJson = json_encode($sigs);

        $stmtIns = $this->db->prepare("
            INSERT INTO cooperation_slips (contact_id, deposit_slip_id, version, total_percentage, shares_json, signatures_json, status, created_by)
            VALUES (?, ?, 1, 100, ?, ?, ?, ?)
        ");
        $stmtIns->execute([$contactId, $depositId, $sharesJson, $signaturesJson, $status, $creatorId]);
        $slipId = (int)$this->db->lastInsertId();

        // Sync collaborators to contacts table
        $this->syncCollaboratorsToContact((int)$contactId, $sharesJson);

        // Email all shareholders that a slip requires their signature (only if not auto-approved)
        if (!$isSingleShareholder) {
            $emailSubject = "[RICH LAND] Yêu cầu ký xác nhận Phiếu hợp tác #" . $slipId;
            $emailTitle = "KÝ XÁC NHẬN PHIẾU HỢP TÁC";
            $emailContent = "Chào các thành viên,<br/><br/>" .
                            "Một phiếu hợp tác chia sẻ hoa hồng mới (#" . $slipId . ") đã được tự động khởi tạo trên hệ thống.<br/>" .
                            "Vui lòng đăng nhập hệ thống RICH LAND CRM và truy cập mục <strong>Phiếu hợp tác</strong> để xem chi tiết và ký xác nhận.";
            $this->notifyShareholders($slipId, $shares, $emailSubject, $emailTitle, $emailContent);
        }
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
            $pVal = (int)$percent;
            if ($pVal < 0) {
                respond(422, null, 'Tỷ lệ chia sẻ hoa hồng không được âm', false);
            }
            $sum += $pVal;
        }

        if ($sum !== 100) {
            respond(422, null, 'Tổng tỷ lệ chia sẻ hoa hồng phải bằng đúng 100% (Hiện tại là ' . $sum . '%)', false);
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

        if (!$this->checkSlipAccess($auth, $id)) {
            respond(403, null, 'Bạn không có quyền cập nhật tỷ lệ cho phiếu hợp tác này', false);
        }

        $isManagerOrAdmin = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true);

        $allowedStatuses = ['pending_signatures', 'pending_manager_approval', 'approved_pending_signatures'];
        if (!$isManagerOrAdmin && !in_array($slip['status'], $allowedStatuses)) {
            respond(400, null, 'Không thể cập nhật tỷ lệ cho phiếu hợp tác đã được phê duyệt hoặc khóa', false);
        }

        // Admin updates expected_commission in deposits if present in the body
        $expectedCommission = isset($b['expected_commission']) ? (int)$b['expected_commission'] : null;
        if ($expectedCommission !== null && $slip['deposit_slip_id']) {
            $stmtDep = $this->db->prepare("UPDATE deposits SET expected_commission = ? WHERE id = ?");
            $stmtDep->execute([$expectedCommission, $slip['deposit_slip_id']]);
        }

        $sharesJson = json_encode($shares);
        $reason = trim($b['reason'] ?? '');

        // If updated by admin/manager directly, set status to approved_pending_signatures and reset signatures to '{}'
        // Otherwise, reset signatures and request change/approval.
        if ($isManagerOrAdmin) {
            $newStatus = 'approved_pending_signatures';
            $signaturesVal = '{}';
            
            // Clear any pending adjustment request because it has been addressed/applied directly.
            $stmtClearReq = $this->db->prepare("
                UPDATE cooperation_slips 
                SET adjustment_request_user_id = NULL, 
                    adjustment_request_reason = NULL, 
                    adjustment_request_at = NULL 
                WHERE id = ?
            ");
            $stmtClearReq->execute([$id]);
        } else {
            $signaturesVal = '{}';
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

        // Sync collaborators to contacts table
        $this->syncCollaboratorsToContact((int)$slip['contact_id'], $sharesJson);

        if ($isManagerOrAdmin) {
            // Notify all shareholders about direct update
            $emailSubject = "[RICH LAND] Cập nhật tỷ lệ hoa hồng Phiếu hợp tác #" . $id;
            $emailTitle = "TỶ LỆ HOA HỒNG ĐÃ ĐƯỢC CẬP NHẬT";
            $emailContent = "Chào các thành viên,<br/><br/>" .
                            "Tỷ lệ hoa hồng hoặc số tiền hoa hồng trong Phiếu hợp tác #" . $id . " đã được điều chỉnh trực tiếp bởi Quản trị viên <strong>" . htmlspecialchars($auth['full_name']) . "</strong>.<br/>" .
                            (!empty($reason) ? "<strong>Ghi chú:</strong> <em>" . htmlspecialchars($reason) . "</em>.<br/>" : "") .
                            "Vui lòng truy cập hệ thống để kiểm tra tỷ lệ phân chia mới.";
            $this->notifyShareholders($id, $shares, $emailSubject, $emailTitle, $emailContent);
        } elseif ($newStatus === 'pending_manager_approval') {
            $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
            $stmtUser->execute([$auth['user_id']]);
            $userRow = $stmtUser->fetch();
            $userName = $userRow['full_name'] ?? 'Nhân viên';

            require_once __DIR__ . '/../NotificationService.php';
            NotificationService::send($this->db, $auth['tenant_id'], 'COOPERATION_PENDING_APPROVAL', [
                'slip_id' => $id,
                'user_name' => $userName,
                'reason' => "Yêu cầu thay đổi tỷ lệ hoa hồng cho Phiếu hợp tác #$id. Lý do: $reason"
            ]);
        } else {
            // Email all shareholders about the change and sign request
            $emailSubject = "[RICH LAND] Yêu cầu ký xác nhận lại Phiếu hợp tác #" . $id;
            $emailTitle = "KÝ XÁC NHẬN LẠI PHIẾU HỢP TÁC";
            $emailContent = "Chào các thành viên,<br/><br/>" .
                            "Tỷ lệ hoa hồng trong Phiếu hợp tác #" . $id . " đã được cập nhật bởi <strong>" . htmlspecialchars($auth['full_name']) . "</strong>.<br/>" .
                            "Lý do: <em>" . htmlspecialchars($reason) . "</em>.<br/>" .
                            "Vui lòng truy cập hệ thống để ký xác nhận lại.";
            $this->notifyShareholders($id, $shares, $emailSubject, $emailTitle, $emailContent);
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_COOPERATION_SHARES', 'cooperation_slip', $id, "Cập nhật/Yêu cầu thay đổi tỷ lệ hoa hồng phiên bản " . ($slip['version'] + 1) . ". Lý do: $reason");
        respond(200, null, $isManagerOrAdmin ? 'Cập nhật thông tin phiếu hợp tác thành công' : 'Cập nhật tỷ lệ chia sẻ hoa hồng thành công. Đã gửi yêu cầu phê duyệt.');
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

        $allowedSignStatuses = ['pending_signatures', 'approved', 'pending_manager_approval', 'approved_pending_signatures'];
        if (!in_array($slip['status'], $allowedSignStatuses)) {
            respond(400, null, 'Phiếu không trong trạng thái chờ ký', false);
        }

        $shares = json_decode($slip['shares_json'], true) ?: [];
        $userId = $auth['user_id'];

        if (!isset($shares[$userId])) {
            respond(403, null, 'Bạn không nằm trong danh sách phân chia hoa hồng của phiếu này', false);
        }

        // Backend check for mandatory files before allowing signature
        $coopSettingStmt = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'coop_default_files' LIMIT 1");
        $coopDefaultFilesSetting = $coopSettingStmt ? $coopSettingStmt->fetchColumn() : null;
        if ($coopDefaultFilesSetting) {
            $requiredFiles = array_filter(array_map('trim', explode(',', $coopDefaultFilesSetting)));
            if (!empty($requiredFiles)) {
                $attachments = array_filter(array_map('trim', explode(',', $slip['attachment_url'] ?? '')));
                foreach ($requiredFiles as $requiredFile) {
                    $cleanKeyword = strtolower(explode('.', $requiredFile)[0]);
                    if (empty($cleanKeyword)) continue;
                    
                    $hasFile = false;
                    foreach ($attachments as $attachment) {
                        $filename = strtolower(basename($attachment));
                        if ($cleanKeyword === 'unc' || $cleanKeyword === 'uy nhiem chi' || $cleanKeyword === 'ủy nhiệm chi') {
                            if (strpos($filename, 'unc') !== false || strpos($filename, 'uy nhiem chi') !== false || strpos($filename, 'ủy nhiệm chi') !== false) {
                                $hasFile = true;
                                break;
                            }
                        } else {
                            if (strpos($filename, $cleanKeyword) !== false) {
                                $hasFile = true;
                                break;
                            }
                        }
                    }
                    if (!$hasFile) {
                        respond(400, null, "Vui lòng upload tài liệu $requiredFile trước khi ký xác nhận!", false);
                    }
                }
            }
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

        // Email notifications based on signature status
        if ($allSigned) {
            if ($status === 'approved') {
                $emailSubject = "[RICH LAND] Phiếu hợp tác #" . $id . " đã được phê duyệt và ký kết thành công";
                $emailTitle = "PHÊ DUYỆT PHIẾU HỢP TÁC";
                $emailContent = "Chào các thành viên,<br/><br/>" .
                                "Phiếu hợp tác chia sẻ hoa hồng #" . $id . " đã được thu thập đầy đủ chữ ký và chính thức phê duyệt thành công.<br/>" .
                                "Vui lòng truy cập hệ thống để xem chi tiết.";
                $this->notifyShareholders($id, $shares, $emailSubject, $emailTitle, $emailContent);
            } else { // pending_manager_approval
                require_once __DIR__ . '/../NotificationService.php';
                NotificationService::send($this->db, $auth['tenant_id'], 'COOPERATION_PENDING_APPROVAL', [
                    'slip_id' => $id,
                    'reason' => "Phiếu hợp tác #$id đã được ký đủ và chờ phê duyệt cuối."
                ]);
            }
        } else {
            // Find remaining signers
            $remainingShares = [];
            foreach ($shares as $uid => $percent) {
                if (!isset($signatures[$uid])) {
                    $remainingShares[$uid] = $percent;
                }
            }
            if (!empty($remainingShares)) {
                $emailSubject = "[RICH LAND] Nhắc nhở ký xác nhận Phiếu hợp tác #" . $id;
                $emailTitle = "NHẮC NHỞ KÝ XÁC NHẬN PHIẾU";
                $emailContent = "Chào bạn,<br/><br/>" .
                                "Bạn có một yêu cầu ký xác nhận cho Phiếu hợp tác chia sẻ hoa hồng #" . $id . " chưa hoàn thành.<br/>" .
                                "Vui lòng đăng nhập hệ thống RICH LAND CRM và truy cập mục <strong>Phiếu hợp tác</strong> để ký xác nhận sớm nhất.";
                $this->notifyShareholders($id, $remainingShares, $emailSubject, $emailTitle, $emailContent);
            }
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'SIGN_COOPERATION_SLIP', 'cooperation_slip', $id, "Ký xác nhận phiếu hợp tác ID: $id");
        respond(200, ['status' => $status], 'Ký xác nhận phiếu hợp tác thành công');
    }

    public function approveSlip(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);

        $stmtSlip = $this->db->prepare("
            SELECT cs.*, c.tenant_id, c.project_id
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ? AND c.tenant_id = ?
        ");
        $stmtSlip->execute([$id, $auth['tenant_id']]);
        $slip = $stmtSlip->fetch();

        if (!$slip) {
            respond(404, null, 'Phiếu hợp tác không tồn tại', false);
        }

        // Restriction: Only GĐKD Toàn sàn (director role and not in project manager_ids) or Admin can approve.
        // Deny regular team managers and GĐKD Dự án (who is the manager of the associated project).
        $isAdminOrSuper = in_array($auth['role'], ['admin', 'superadmin', 'super_admin'], true);
        if (!$isAdminOrSuper) {
            if ($auth['role'] === 'manager') {
                respond(403, null, 'Bạn không có quyền phê duyệt phiếu hợp tác (Quyền duyệt thuộc về GĐKD Toàn sàn/Admin)', false);
            }
            if ($auth['role'] === 'director' && $slip['project_id']) {
                $stmtProj = $this->db->prepare("SELECT manager_ids FROM projects WHERE id = ?");
                $stmtProj->execute([$slip['project_id']]);
                $mgrIds = $stmtProj->fetchColumn();
                if (!empty($mgrIds)) {
                    $mIds = array_filter(array_map('intval', explode(',', $mgrIds)));
                    if (in_array((int)$auth['user_id'], $mIds, true)) {
                        respond(403, null, 'GĐKD Dự án chỉ được theo dõi phiếu, không có quyền duyệt cuối', false);
                    }
                }
            }
        }

        if (!$this->checkSlipAccess($auth, $id)) {
            respond(403, null, 'Bạn không có quyền phê duyệt phiếu hợp tác này', false);
        }

        if ($slip['status'] !== 'pending_manager_approval') {
            respond(400, null, 'Phiếu chưa được ký đủ chữ ký của các bên để phê duyệt', false);
        }

        $stmt = $this->db->prepare("UPDATE cooperation_slips SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?");
        $stmt->execute([$auth['user_id'], $id]);

        // Email shareholders about approval
        $shares = json_decode($slip['shares_json'], true) ?: [];
        $emailSubject = "[RICH LAND] Phiếu hợp tác #" . $id . " đã được phê duyệt thành công";
        $emailTitle = "PHÊ DUYỆT PHIẾU HỢP TÁC";
        $emailContent = "Chào các thành viên,<br/><br/>" .
                        "Phiếu hợp tác chia sẻ hoa hồng #" . $id . " đã được phê duyệt thành công bởi quản trị viên.<br/>" .
                        "Vui lòng truy cập hệ thống để xem chi tiết.";
        $this->notifyShareholders($id, $shares, $emailSubject, $emailTitle, $emailContent);

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

        if (!$this->checkSlipAccess($auth, $id)) {
            respond(403, null, 'Bạn không có quyền từ chối hoặc phản hồi phiếu này', false);
        }

        $shares = json_decode($slip['shares_json'] ?? '[]', true) ?: [];

        // Return to pending_signatures so sales can update percentages
        $stmt = $this->db->prepare("
            UPDATE cooperation_slips 
            SET status = 'rejected', dispute_details = ?, signatures_json = '{}' 
            WHERE id = ?
        ");
        $stmt->execute([$details, $id]);

        // Email shareholders about dispute/rejection
        $emailSubject = "[RICH LAND] Từ chối / Khiếu nại Phiếu hợp tác #" . $id;
        $emailTitle = "KHIẾU NẠI PHIẾU HỢP TÁC";
        $emailContent = "Chào các thành viên,<br/><br/>" .
                        "Phiếu hợp tác chia sẻ hoa hồng #" . $id . " đã bị từ chối / gửi phản hồi khiếu nại bởi <strong>" . htmlspecialchars($auth['full_name']) . "</strong>.<br/>" .
                        "Lý do: <em>" . htmlspecialchars($details) . "</em>.<br/>" .
                        "Vui lòng truy cập hệ thống RICH LAND CRM để xem chi tiết và cập nhật lại.";
        $this->notifyShareholders($id, $shares, $emailSubject, $emailTitle, $emailContent);

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

        // Find owner of contact and check access
        $stmtC = $this->db->prepare("SELECT owner_id, tenant_id, pipeline_status FROM contacts WHERE id = ?");
        $stmtC->execute([$contactId]);
        $contactRow = $stmtC->fetch();
        if (!$contactRow) {
            respond(404, null, 'Khách hàng không tồn tại', false);
        }
        if ((int)$contactRow['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền truy cập khách hàng này', false);
        }

        // Validate cooperation eligible status
        $currentStatus = $contactRow['pipeline_status'] ?: 'chua_xac_dinh';
        $coopSettingStmt = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'coop_eligible_statuses' LIMIT 1");
        $coopSettingVal = $coopSettingStmt ? $coopSettingStmt->fetchColumn() : '';
        $coopEligibleStatuses = [];
        if (!empty($coopSettingVal)) {
            $coopEligibleStatuses = array_map('trim', explode(',', $coopSettingVal));
        }
        if (empty($coopEligibleStatuses)) {
            $coopEligibleStatuses = ['booking', 'da_gap', 'dat_coc']; // Default fallback
        }

        if (!in_array($currentStatus, $coopEligibleStatuses, true)) {
            respond(400, null, 'Không thể tạo phiếu hợp tác. Khách hàng phải ở trạng thái quy định (' . implode(', ', $coopEligibleStatuses) . ')', false);
        }
        $ownerId = (int)$contactRow['owner_id'];
        
        // Check ownership access
        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            if ($ownerId !== (int)$auth['user_id']) {
                respond(403, null, 'Bạn chỉ có quyền tạo phiếu hợp tác cho khách hàng thuộc sở hữu của mình', false);
            }
        } else if ($auth['role'] === 'manager') {
            // Check if owner belongs to manager's team
            $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
            $stmtUserTeam->execute([$ownerId]);
            $targetUserTeamId = $stmtUserTeam->fetchColumn();

            $stmtLead = $this->db->prepare("SELECT 1 FROM teams WHERE id = ? AND leader_id = ?");
            $stmtLead->execute([$targetUserTeamId, $auth['user_id']]);
            $isTeamMember = $stmtLead->fetch();

            if ($ownerId !== (int)$auth['user_id'] && !$isTeamMember) {
                respond(403, null, 'Bạn chỉ có quyền tạo phiếu hợp tác cho khách hàng thuộc quản lý của nhóm mình', false);
            }
        }

        if ($ownerId <= 0) {
            $ownerId = $auth['user_id'];
        }

        $collaborators = $b['collaborators'] ?? [];
        $shares = [];

        if (!empty($collaborators)) {
            // Validate that collaborators does not include the owner
            $collaboratorIds = array_map('intval', $collaborators);
            $collaboratorIds = array_values(array_filter($collaboratorIds, function($id) use ($ownerId) {
                return $id > 0 && $id !== $ownerId;
            }));

            if (count($collaboratorIds) > 2) {
                respond(422, null, 'Hệ thống chỉ hỗ trợ hợp tác tối đa 3 nhân sự (Chủ sở hữu + 2 người hợp tác)', false);
            }

            if (!empty($collaboratorIds)) {
                // Auto-split: Owner + N collaborators
                $totalCount = 1 + count($collaboratorIds);
                $basePercent = floor(100 / $totalCount);
                $remainder = 100 - ($basePercent * $totalCount);

                $shares[$ownerId] = (int)($basePercent + $remainder);
                foreach ($collaboratorIds as $cid) {
                    $shares[$cid] = (int)$basePercent;
                }
            } else {
                $shares[$ownerId] = 100;
            }
        } else {
            $shares[$ownerId] = 100;
        }

        $sharesJson = json_encode($shares);

        $stmtIns = $this->db->prepare("
            INSERT INTO cooperation_slips (contact_id, deposit_slip_id, version, total_percentage, shares_json, signatures_json, status, created_by)
            VALUES (?, NULL, 1, 100, ?, '{}', 'pending_signatures', ?)
        ");
        $stmtIns->execute([$contactId, $sharesJson, $auth['user_id']]);
        $slipId = $this->db->lastInsertId();

        // Sync collaborators to contacts table
        $this->syncCollaboratorsToContact((int)$contactId, $sharesJson);

        // Withdraw from databank and terminate other parallel contacts
        require_once __DIR__ . '/../config/ParallelHelper.php';
        ParallelHelper::lockPersonForWinningContact($this->db, (int)$contactId);

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

        $isAllowed = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true) || 
                     ($ownerId && (int)$ownerId === (int)$auth['user_id']);

        if (!$this->checkSlipAccess($auth, $id)) {
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
        require_once __DIR__ . '/../config/ImageHelper.php';
        $res = ImageHelper::saveUploadedFile($file['tmp_name'], $targetPath, $file['name']);
        if (!$res['success']) {
            respond(500, null, 'Không thể di chuyển tệp đã tải lên vào thư mục đích', false);
        }
        $fileName = $res['filename'];
        $dbPath = "uploads/cooperation/$tid/$fileName";

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

        $isAllowed = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true) || 
                     ($ownerId && (int)$ownerId === (int)$auth['user_id']);

        if (!$this->checkSlipAccess($auth, $id)) {
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
                    deleteServerFile($f);
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
        
        $isAllowed = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true) || 
                     ((int)$row['owner_id'] === (int)$auth['user_id']);
                     
        if (!$this->checkSlipAccess($auth, $id)) {
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
                $dbPath = dirname($f) . '/' . $newFileName;

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
        
        if (!$this->checkSlipAccess($auth, $id)) {
            respond(403, null, 'Bạn không có quyền xóa phiếu hợp tác này', false);
        }
        
        $stmtDel = $this->db->prepare("DELETE FROM cooperation_slips WHERE id = ?");
        $stmtDel->execute([$id]);
        
        respond(200, null, 'Xóa phiếu hợp tác thành công');
    }

    private function getScope(array $auth, string $module, string $action): string {
        $permissionsJson = null;
        $stmtQ = $this->db->prepare("SELECT permissions_json FROM users WHERE id = ? LIMIT 1");
        $stmtQ->execute([$auth['user_id']]);
        $resQ = $stmtQ->fetch(PDO::FETCH_ASSOC);
        if ($resQ && !empty($resQ['permissions_json'])) {
            $permissionsJson = json_decode($resQ['permissions_json'], true);
        }

        if (in_array($auth['role'], ['admin', 'superadmin', 'super_admin'], true)) {
            return 'all';
        }

        if (in_array($auth['role'], ['sale', 'sales'], true) && $module === 'deals') {
            return $action === 'delete' ? 'none' : 'own';
        }

        if ($permissionsJson && isset($permissionsJson[$module][$action])) {
            $val = $permissionsJson[$module][$action];
            if (in_array($val, ['all', 'team', 'own', 'none'], true)) {
                if ($action !== 'delete' && $val === 'none' && in_array($auth['role'], ['sale', 'sales', 'manager', 'director', 'assistant'], true)) {
                    return 'own';
                }
                return $val;
            }
        }

        // Default fallbacks
        $role = $auth['role'];
        if ($role === 'director') {
            if ($module === 'settings') {
                return 'none';
            }
            return 'all';
        }
        if ($role === 'assistant') {
            return $action === 'delete' ? 'none' : 'all';
        }
        if ($role === 'manager') {
            return $action === 'delete' ? 'none' : 'team';
        }
        if (in_array($role, ['sale', 'sales'], true)) {
            if ($module === 'projects') {
                return $action === 'read' ? 'all' : 'none';
            }
            return $action === 'delete' ? 'none' : 'own';
        }
        if ($role === 'viewer') {
            return $action === 'read' ? 'all' : 'none';
        }

        return 'none';
    }

    public function getSuggestions(array $auth): void {
        $tid = $auth['tenant_id'];
        $contactId = (int)($_GET['contact_id'] ?? 0);
        if ($contactId <= 0) {
            respond(400, null, 'ID khách hàng không hợp lệ', false);
        }

        // Get current contact person_id, phone, and owner_id
        $stmtC = $this->db->prepare("SELECT person_id, phone, owner_id FROM contacts WHERE id = ? AND tenant_id = ?");
        $stmtC->execute([$contactId, $tid]);
        $cRow = $stmtC->fetch(PDO::FETCH_ASSOC);

        if (!$cRow) {
            respond(404, null, 'Không tìm thấy khách hàng', false);
        }

        $personId = $cRow['person_id'] ? (int)$cRow['person_id'] : null;
        $phone = $cRow['phone'] ? trim($cRow['phone']) : null;
        $ownerId = (int)$cRow['owner_id'];

        if (!$personId && !$phone) {
            respond(200, [], 'Không có thông tin để gợi ý');
        }

        // Query distinct sales owners of other contacts that have same person_id or phone
        $stmt = $this->db->prepare("
            SELECT DISTINCT u.id, u.full_name, u.email, u.avatar_url
            FROM contacts c
            JOIN users u ON c.owner_id = u.id
            WHERE c.tenant_id = :tenant_id 
              AND c.id != :contact_id
              AND c.owner_id != :owner_id
              AND u.is_active = 1
              AND (
                (c.person_id = :person_id AND :person_id_val1 IS NOT NULL AND :person_id_val2 > 0)
                OR (c.phone = :phone AND :phone_val1 IS NOT NULL AND :phone_val2 != '')
              )
        ");

        $params = [
            'tenant_id' => $tid,
            'contact_id' => $contactId,
            'owner_id' => $ownerId,
            'person_id' => $personId,
            'person_id_val1' => $personId,
            'person_id_val2' => $personId,
            'phone' => $phone,
            'phone_val1' => $phone,
            'phone_val2' => $phone
        ];

        $stmt->execute($params);
        $suggestions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Normalize full_name and avatar_url
        foreach ($suggestions as &$s) {
            $s['id'] = (int)$s['id'];
            $s['full_name'] = $s['full_name'] ?: '';
            $s['avatar'] = $s['avatar_url'] ?: null;
        }

        respond(200, $suggestions, 'Lấy danh sách gợi ý hợp tác thành công');
    }

    public function syncCollaboratorsToContact(int $contactId, string $sharesJson): void {
        $shares = json_decode($sharesJson, true) ?: [];
        $stmt = $this->db->prepare("SELECT owner_id, collaborator_ids FROM contacts WHERE id = ?");
        $stmt->execute([$contactId]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) return;

        $ownerId = (int)$contact['owner_id'];
        $collaboratorIds = [];

        // All keys in shares except the owner are collaborators
        foreach (array_keys($shares) as $uid) {
            $uidInt = (int)$uid;
            if ($uidInt > 0 && $uidInt !== $ownerId) {
                $collaboratorIds[] = $uidInt;
            }
        }

        // Merge with existing non-owner collaborators to prevent losing manual co-care assignments
        $existingIds = array_filter(array_map('intval', explode(',', $contact['collaborator_ids'] ?? '')));
        $mergedIds = array_unique(array_merge($existingIds, $collaboratorIds));
        
        $collaboratorsStr = !empty($mergedIds) ? implode(',', $mergedIds) : null;
        $stmtUpd = $this->db->prepare("UPDATE contacts SET collaborator_ids = ? WHERE id = ?");
        $stmtUpd->execute([$collaboratorsStr, $contactId]);
    }

    public function createAdjustmentSlip(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);

        // 1. Fetch the approved slip to adjust
        $stmt = $this->db->prepare("SELECT * FROM cooperation_slips WHERE id = ?");
        $stmt->execute([$id]);
        $slip = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$slip) {
            respond(404, null, 'Không tìm thấy phiếu hợp tác', false);
        }

        if ($slip['status'] !== 'approved') {
            respond(400, null, 'Chỉ có thể tạo phiếu điều chỉnh từ phiếu hợp tác đã được duyệt', false);
        }

        // Check if there is already a pending adjustment slip for this contact
        $stmtPending = $this->db->prepare("SELECT id FROM cooperation_slips WHERE contact_id = ? AND status IN ('pending_signatures', 'pending_manager_approval', 'approved_pending_signatures') LIMIT 1");
        $stmtPending->execute([$slip['contact_id']]);
        if ($stmtPending->fetchColumn()) {
            respond(400, null, 'Đang có một phiếu hợp tác hoặc phiếu điều chỉnh khác chờ ký duyệt cho khách hàng này', false);
        }

        // 2. Clone the slip
        $sharesJson = $slip['shares_json'];
        
        $stmtIns = $this->db->prepare("
            INSERT INTO cooperation_slips (contact_id, deposit_slip_id, version, total_percentage, shares_json, signatures_json, status, created_by, dieu_chinh_tu_id)
            VALUES (?, ?, 1, 100, ?, '{}', 'pending_signatures', ?, ?)
        ");
        $stmtIns->execute([
            $slip['contact_id'],
            $slip['deposit_slip_id'],
            $sharesJson,
            $auth['user_id'],
            $id
        ]);
        $newSlipId = (int)$this->db->lastInsertId();

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE_ADJUSTMENT_SLIP', 'cooperation_slip', $newSlipId, "Tạo phiếu điều chỉnh ID: $newSlipId cho phiếu hợp tác ID: $id");

        // Send email notifications to all shareholders of the new slip
        $shares = json_decode($sharesJson, true) ?: [];
        $emailSubject = "[RICH LAND] Yêu cầu ký xác nhận Phiếu điều chỉnh #" . $newSlipId;
        $emailTitle = "KÝ XÁC NHẬN PHIẾU ĐIỀU CHỈNH HOA HỒNG";
        $emailContent = "Chào các thành viên,<br/><br/>" .
                        "Một phiếu điều chỉnh chia sẻ hoa hồng mới (#" . $newSlipId . ") đã được khởi tạo để thay thế cho phiếu #" . $id . ".<br/>" .
                        "Vui lòng đăng nhập hệ thống RICH LAND CRM và truy cập mục <strong>Phiếu hợp tác</strong> để ký xác nhận.";
        $this->notifyShareholders($newSlipId, $shares, $emailSubject, $emailTitle, $emailContent);

        respond(200, ['new_slip_id' => $newSlipId], 'Tạo phiếu điều chỉnh thành công');
    }

    public function requestAdjustment(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        
        $input = getBody();
        $reason = trim($input['reason'] ?? '');
        if (empty($reason)) {
            respond(422, null, 'Vui lòng cung cấp lý do yêu cầu chỉnh sửa tỷ lệ', false);
        }

        // Fetch slip and client details
        $stmt = $this->db->prepare("
            SELECT cs.*, CONCAT(c.first_name, ' ', COALESCE(c.last_name,'')) as customer_name, c.owner_id
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE cs.id = ?
        ");
        $stmt->execute([$id]);
        $slip = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$slip) {
            respond(404, null, 'Không tìm thấy phiếu hợp tác', false);
        }

        if ($slip['status'] !== 'approved') {
            respond(400, null, 'Chỉ có thể gửi yêu cầu chỉnh sửa tỷ lệ từ phiếu hợp tác đã được duyệt', false);
        }

        $shares = $input['shares'] ?? [];
        $expectedCommission = isset($input['expected_commission']) ? (int)$input['expected_commission'] : null;
        $sharesJson = !empty($shares) ? json_encode($shares) : null;

        // Update adjustment request details in the database
        $stmtUpd = $this->db->prepare("
            UPDATE cooperation_slips 
            SET adjustment_request_user_id = ?, 
                adjustment_request_reason = ?, 
                adjustment_request_at = NOW(),
                adjustment_request_shares_json = ?,
                adjustment_request_commission = ?
            WHERE id = ?
        ");
        $stmtUpd->execute([$auth['user_id'], $reason, $sharesJson, $expectedCommission, $id]);

        // Notify admins, directors, and the owner
        $stmtUsers = $this->db->prepare("
            SELECT id, email, full_name 
            FROM users 
            WHERE tenant_id = ? AND role IN ('admin', 'superadmin', 'super_admin', 'manager', 'director')
        ");
        $stmtUsers->execute([$auth['tenant_id']]);
        $usersToNotify = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);

        $creatorName = $auth['full_name'] ?? 'Nhân viên';
        $emailSubject = "[RICH LAND] Yêu cầu chỉnh sửa tỷ lệ hoa hồng - Khách: " . $slip['customer_name'];
        $emailTitle = "YÊU CẦU CHỈNH SỬA TỶ LỆ HOA HỒNG";
        $emailContent = "Chào ban quản lý,<br/><br/>" .
                        "Nhân viên <strong>" . htmlspecialchars($creatorName) . "</strong> đã gửi yêu cầu chỉnh sửa tỷ lệ chia sẻ hoa hồng cho Phiếu hợp tác #" . $id . " (Khách hàng: " . htmlspecialchars($slip['customer_name']) . ").<br/>" .
                        "<strong>Lý do yêu cầu:</strong> <em>" . htmlspecialchars($reason) . "</em>.<br/><br/>" .
                        "Vui lòng đăng nhập RICH LAND CRM để xem xét và cập nhật trực tiếp trên Phiếu cọc.";

        $stmtNotif = $this->db->prepare("
            INSERT INTO notifications (user_id, tenant_id, title, body, type, link) 
            VALUES (?, ?, ?, ?, 'cooperation_status', ?)
        ");

        $cleanBody = strip_tags(str_replace(['<br/>', '<br>', '<strong>', '</strong>', '<em>', '</em>'], [' ', ' ', '', '', '', ''], $emailContent));

        require_once __DIR__ . '/../mailer.php';
        foreach ($usersToNotify as $u) {
            // In-app
            $stmtNotif->execute([
                (int)$u['id'],
                $auth['tenant_id'],
                $emailSubject,
                $cleanBody,
                '/cooperation-slips'
            ]);
            // Email
            if (!empty($u['email'])) {
                sendEmailNotification($u['email'], $emailSubject, $emailTitle, $emailContent, '', false);
            }
        }

        // Fetch Zalo & Telegram group chat configurations from system_settings and notify
        try {
            $stmtSettings = $this->db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('zalo_bot_token', 'zalo_admin_group_chat_id', 'telegram_bot_token', 'telegram_admin_group_chat_id')");
            $stmtSettings->execute();
            $settings = $stmtSettings->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
            
            $zaloBotToken = $settings['zalo_bot_token'] ?? '';
            $zaloAdminGroup = $settings['zalo_admin_group_chat_id'] ?? '';
            $tgBotToken = $settings['telegram_bot_token'] ?? '';
            $tgAdminGroup = $settings['telegram_admin_group_chat_id'] ?? '';

            $tgText = "⚠️ <b>[ YÊU CẦU CHỈNH SỬA TỶ LỆ HOA HỒNG ]</b> ⚠️\n" .
                      "━━━━━━━━━━━━━━━━━━━━━\n" .
                      "• <b>Nhân viên yêu cầu:</b> " . htmlspecialchars($creatorName) . "\n" .
                      "• <b>Mã phiếu cọc:</b> #" . $id . "\n" .
                      "• <b>Khách hàng:</b> " . htmlspecialchars($slip['customer_name']) . "\n" .
                      "• <b>Dự án:</b> " . htmlspecialchars($slip['project_name'] ?? 'Dự án khác') . "\n" .
                      "• <b>Căn/Lô:</b> " . htmlspecialchars($slip['unit_code'] ?? '—') . "\n" .
                      "• <b>Lý do yêu cầu:</b> <i>" . htmlspecialchars($reason) . "</i>\n\n" .
                      "👉 Vui lòng đăng nhập RICH LAND CRM để xem xét và xử lý.";

            $zaloText = "⚠️ [ YÊU CẦU CHỈNH SỬA TỶ LỆ HOA HỒNG ] ⚠️\n" .
                        "━━━━━━━━━━━━━━━━━━━━━\n" .
                        "• Nhân viên yêu cầu: " . $creatorName . "\n" .
                        "• Mã phiếu cọc: #" . $id . "\n" .
                        "• Khách hàng: " . $slip['customer_name'] . "\n" .
                        "• Dự án: " . ($slip['project_name'] ?? 'Dự án khác') . "\n" .
                        "• Căn/Lô: " . ($slip['unit_code'] ?? '—') . "\n" .
                        "• Lý do yêu cầu: " . $reason . "\n\n" .
                        "👉 Vui lòng đăng nhập RICH LAND CRM để xem xét và xử lý.";

            // Send Zalo Notification
            if (!empty($zaloBotToken) && !empty($zaloAdminGroup)) {
                require_once __DIR__ . '/../zalo_bot.php';
                sendZaloMessage($zaloBotToken, $zaloAdminGroup, $zaloText);
            }

            // Send Telegram Notification
            if (!empty($tgBotToken) && !empty($tgAdminGroup)) {
                require_once __DIR__ . '/../telegram_bot.php';
                sendTelegramMessage($tgBotToken, $tgAdminGroup, $tgText);
            }
        } catch (Throwable $e) {
            error_log("Error sending Zalo/Telegram notification for coop adjustment: " . $e->getMessage());
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'REQUEST_COOP_ADJUSTMENT', 'cooperation_slip', $id, "Gửi yêu cầu chỉnh sửa tỷ lệ hoa hồng cho phiếu cọc. Lý do: $reason");

        respond(200, null, 'Gửi yêu cầu chỉnh sửa tỷ lệ hoa hồng thành công');
    }

    public function handleAdjustment(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        
        $input = getBody();
        $action = trim($input['action'] ?? ''); // 'approve' or 'reject'
        $note = trim($input['note'] ?? '');

        if (!in_array($action, ['approve', 'reject'], true)) {
            respond(400, null, 'Hành động không hợp lệ', false);
        }

        $this->db->beginTransaction();
        try {
            // Fetch slip details
            $stmt = $this->db->prepare("
                SELECT cs.*, CONCAT(c.first_name, ' ', COALESCE(c.last_name,'')) as customer_name, c.tenant_id
                FROM cooperation_slips cs
                JOIN contacts c ON cs.contact_id = c.id
                WHERE cs.id = ?
            ");
            $stmt->execute([$id]);
            $slip = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$slip) {
                respond(404, null, 'Không tìm thấy phiếu hợp tác', false);
            }

            if (empty($slip['adjustment_request_user_id'])) {
                respond(400, null, 'Không có yêu cầu chỉnh sửa nào cần xử lý cho phiếu này', false);
            }

            $requesterId = (int)$slip['adjustment_request_user_id'];

            if ($action === 'approve') {
                // 1. Check if there is already a pending adjustment slip for this contact
                $stmtPending = $this->db->prepare("SELECT id FROM cooperation_slips WHERE contact_id = ? AND status IN ('pending_signatures', 'pending_manager_approval', 'approved_pending_signatures') LIMIT 1");
                $stmtPending->execute([$slip['contact_id']]);
                if ($stmtPending->fetchColumn()) {
                    respond(400, null, 'Đang có một phiếu hợp tác hoặc phiếu điều chỉnh khác chờ ký duyệt cho khách hàng này', false);
                }

                // 2. Clone the slip (similar to createAdjustmentSlip)
                $sharesJson = $slip['shares_json'];
                
                $stmtIns = $this->db->prepare("
                    INSERT INTO cooperation_slips (contact_id, deposit_slip_id, version, total_percentage, shares_json, signatures_json, status, created_by, dieu_chinh_tu_id)
                    VALUES (?, ?, 1, 100, ?, '{}', 'pending_signatures', ?, ?)
                ");
                $stmtIns->execute([
                    $slip['contact_id'],
                    $slip['deposit_slip_id'],
                    $sharesJson,
                    $auth['user_id'],
                    $id
                ]);
                $newSlipId = (int)$this->db->lastInsertId();

                // 3. Clear/resolve the request on the old slip
                $stmtUpdate = $this->db->prepare("
                    UPDATE cooperation_slips 
                    SET adjustment_request_user_id = NULL, 
                        adjustment_request_reason = NULL, 
                        adjustment_request_at = NULL 
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$id]);

                $this->db->commit();

                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'APPROVE_COOP_ADJUSTMENT_REQUEST', 'cooperation_slip', $id, "Đã duyệt yêu cầu chỉnh sửa tỷ lệ của phiếu #$id. Tạo phiếu điều chỉnh mới #$newSlipId. Note: $note");

                // Notify all shareholders of the new slip
                $shares = json_decode($sharesJson, true) ?: [];
                $emailSubject = "[RICH LAND] Duyệt yêu cầu chỉnh sửa & Yêu cầu ký xác nhận Phiếu điều chỉnh #" . $newSlipId;
                $emailTitle = "KÝ XÁC NHẬN PHIẾU ĐIỀU CHỈNH HOA HỒNG";
                $emailContent = "Chào các thành viên,<br/><br/>" .
                                "Ban quản lý đã <strong>phê duyệt</strong> yêu cầu chỉnh sửa tỷ lệ hoa hồng cho khách hàng <strong>" . htmlspecialchars($slip['customer_name']) . "</strong>.<br/>" .
                                (!empty($note) ? "<strong>Ghi chú từ quản lý:</strong> <em>" . htmlspecialchars($note) . "</em><br/><br/>" : "") .
                                "Hệ thống đã tự động tạo Phiếu điều chỉnh mới với mã số <strong>#" . $newSlipId . "</strong>.<br/>" .
                                "Vui lòng truy cập hệ thống để ký xác nhận lại tỷ lệ phân chia mới.";
                $this->notifyShareholders($newSlipId, $shares, $emailSubject, $emailTitle, $emailContent);

                respond(200, ['new_slip_id' => $newSlipId], 'Phê duyệt yêu cầu và tạo phiếu điều chỉnh mới thành công');

            } else {
                // Reject action
                // Clear the request fields on the old slip
                $stmtUpdate = $this->db->prepare("
                    UPDATE cooperation_slips 
                    SET adjustment_request_user_id = NULL, 
                        adjustment_request_reason = NULL, 
                        adjustment_request_at = NULL 
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$id]);

                $this->db->commit();

                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'REJECT_COOP_ADJUSTMENT_REQUEST', 'cooperation_slip', $id, "Từ chối yêu cầu chỉnh sửa tỷ lệ của phiếu #$id. Note: $note");

                // Notify requester
                $stmtReq = $this->db->prepare("SELECT email, full_name FROM users WHERE id = ?");
                $stmtReq->execute([$requesterId]);
                $requester = $stmtReq->fetch(PDO::FETCH_ASSOC);

                if ($requester) {
                    $notifySubject = "[RICH LAND] Từ chối yêu cầu chỉnh sửa tỷ lệ hoa hồng - Khách: " . $slip['customer_name'];
                    $notifyTitle = "TỪ CHỐI YÊU CẦU CHỈNH SỬA TỶ LỆ";
                    $notifyContent = "Chào <strong>" . htmlspecialchars($requester['full_name']) . "</strong>,<br/><br/>" .
                                     "Yêu cầu chỉnh sửa tỷ lệ hoa hồng của bạn cho khách hàng <strong>" . htmlspecialchars($slip['customer_name']) . "</strong> (Phiếu hợp tác #" . $id . ") đã bị ban quản lý <strong>từ chối</strong>.<br/>" .
                                     (!empty($note) ? "<strong>Lý do/Ghi chú từ quản lý:</strong> <em>" . htmlspecialchars($note) . "</em><br/><br/>" : "") .
                                     "Vui lòng liên hệ ban quản lý để biết thêm chi tiết.";
                    
                    require_once __DIR__ . '/../NotificationService.php';
                    NotificationService::send($this->db, $auth['tenant_id'], 'COOPERATION_PENDING_APPROVAL', [
                        'user_id' => $requesterId,
                        'slip_id' => $id,
                        'reason' => "Yêu cầu chỉnh sửa tỷ lệ hoa hồng cho Phiếu hợp tác #$id đã bị từ chối. Ghi chú: " . ($note ?? 'Không có')
                    ]);
                }

                respond(200, null, 'Từ chối yêu cầu chỉnh sửa tỷ lệ thành công');
            }

        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi xử lý yêu cầu chỉnh sửa: ' . $e->getMessage(), false);
        }
    }
}
