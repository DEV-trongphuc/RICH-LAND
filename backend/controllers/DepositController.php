<?php
// backend/controllers/DepositController.php

class DepositController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];

        $sql = "
            SELECT d.*, c.first_name, c.last_name, c.phone, c.avatar_url, p.name as project_name, u.full_name as creator_name,
                   c.owner_id as contact_owner_id
            FROM deposits d
            JOIN contacts c ON d.contact_id = c.id
            JOIN projects p ON d.project_id = p.id
            JOIN users u ON d.created_by = u.id
            WHERE c.tenant_id = ?
        ";
        $params = [$tid];

        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $sql .= " AND (d.created_by = ? OR c.owner_id = ? OR d.contact_id IN (SELECT contact_id FROM quyen_truy_cap WHERE user_id = ?))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($auth['role'] === 'manager') {
            $sql .= " AND (d.created_by = ? OR c.owner_id = ? OR d.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)) OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }

        if (isset($_GET['contact_id'])) {
            $sql .= " AND d.contact_id = ?";
            $params[] = (int)$_GET['contact_id'];
        }

        $sql .= " ORDER BY d.created_at DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $deposits = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Attach milestones using Eager Loading (prevent N+1 queries)
        if (!empty($deposits)) {
            $depositIds = array_column($deposits, 'id');
            $inClause = implode(',', array_fill(0, count($depositIds), '?'));
            $stmtM = $this->db->prepare("SELECT * FROM deposit_milestones WHERE deposit_id IN ($inClause) ORDER BY id ASC");
            $stmtM->execute($depositIds);
            $allMilestones = $stmtM->fetchAll(PDO::FETCH_ASSOC);
            
            // Map milestones to deposits
            $milestonesMap = [];
            foreach ($allMilestones as $m) {
                $milestonesMap[$m['deposit_id']][] = $m;
            }

            // Fetch cooperation slips for these contacts to resolve shareholders
            $contactIds = array_column($deposits, 'contact_id');
            $inContacts = implode(',', array_fill(0, count($contactIds), '?'));
            $stmtCslips = $this->db->prepare("SELECT * FROM cooperation_slips WHERE contact_id IN ($inContacts)");
            $stmtCslips->execute($contactIds);
            $cSlips = $stmtCslips->fetchAll(PDO::FETCH_ASSOC);

            // Load users map for details
            $allUids = [];
            foreach ($cSlips as $cs) {
                $shares = json_decode($cs['shares_json'] ?? '[]', true) ?: [];
                foreach (array_keys($shares) as $uid) {
                    $allUids[] = (int)$uid;
                }
            }
            $userMap = [];
            $uniqueUids = array_values(array_unique(array_filter($allUids)));
            if (!empty($uniqueUids)) {
                $inUsers = implode(',', array_fill(0, count($uniqueUids), '?'));
                $stmtU = $this->db->prepare("SELECT id, full_name, email, avatar_url FROM users WHERE id IN ($inUsers)");
                $stmtU->execute($uniqueUids);
                $users = $stmtU->fetchAll(PDO::FETCH_ASSOC);
                foreach ($users as $u) {
                    $userMap[(int)$u['id']] = $u;
                }
            }

            $slipsMap = [];
            foreach ($cSlips as $cs) {
                $shares = json_decode($cs['shares_json'] ?? '[]', true) ?: [];
                $shareholdersDetails = [];
                foreach ($shares as $uid => $percent) {
                    $u = $userMap[(int)$uid] ?? null;
                    if ($u) {
                        $shareholdersDetails[] = [
                            'user_id' => (int)$uid,
                            'name' => $u['full_name'],
                            'email' => $u['email'],
                            'avatar' => $u['avatar_url'] ?? null,
                            'percentage' => (int)$percent
                        ];
                    }
                }
                $slipsMap[(int)$cs['contact_id']] = $shareholdersDetails;
            }

            foreach ($deposits as &$d) {
                $d['milestones'] = $milestonesMap[$d['id']] ?? [];
                $d['shareholders'] = $slipsMap[(int)$d['contact_id']] ?? [];
            }
        }

        respond(200, $deposits, 'Lấy danh sách phiếu cọc thành công');
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $b = getBody();
        $contactId = (int)($b['contact_id'] ?? 0);
        $projectId = (int)($b['project_id'] ?? 0);
        $unitCode  = trim($b['unit_code'] ?? '');
        $price     = (float)($b['price'] ?? 0);
        $expectedCommission = (float)($b['expected_commission'] ?? 0);
        $milestones = $b['milestones'] ?? []; // Array of { name, amount }

        if (!$contactId || !$projectId || !$unitCode || $price <= 0) {
            respond(422, null, 'Thiếu thông tin bắt buộc để tạo phiếu cọc (khách hàng, dự án, căn hộ, giá bán)', false);
        }

        $this->db->beginTransaction();
        try {
            // Check contact existence and ownership
            $stmtC = $this->db->prepare("SELECT id, owner_id, pipeline_status, first_name, last_name FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
            $stmtC->execute([$contactId, $auth['tenant_id']]);
            $contact = $stmtC->fetch();
            if (!$contact) {
                respond(404, null, 'Khách hàng không tồn tại', false);
            }

            if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
                if ($contact['owner_id'] != $auth['user_id']) {
                    respond(403, null, 'Bạn không thể tạo cọc cho khách hàng của người khác', false);
                }
            } else if ($auth['role'] === 'manager') {
                $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
                $stmtUserTeam->execute([$contact['owner_id']]);
                $targetUserTeamId = $stmtUserTeam->fetchColumn();

                $stmtLead = $this->db->prepare("SELECT 1 FROM teams WHERE id = ? AND leader_id = ?");
                $stmtLead->execute([$targetUserTeamId, $auth['user_id']]);
                $isTeamMember = $stmtLead->fetch();

                if ($contact['owner_id'] != $auth['user_id'] && !$isTeamMember) {
                    respond(403, null, 'Bạn không thể tạo cọc cho khách hàng thuộc quản lý của nhóm khác', false);
                }
            }

            // Insert deposit record
            $stmt = $this->db->prepare("
                INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by)
                VALUES (?, ?, ?, ?, ?, 'pending_admin', ?)
            ");
            $stmt->execute([$contactId, $projectId, $unitCode, $price, $expectedCommission, $auth['user_id']]);
            $depositId = $this->db->lastInsertId();

            // Insert milestones (default to Đợt 1 if empty)
            if (empty($milestones)) {
                $milestones = [['name' => 'Đợt cọc lần 1', 'amount' => $price]];
            }

            $stmtM = $this->db->prepare("
                INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status)
                VALUES (?, ?, ?, 'pending')
            ");
            foreach ($milestones as $m) {
                $stmtM->execute([$depositId, trim($m['name']), (float)$m['amount']]);
            }

            // Update contact pipeline stage to 'dat_coc' (Placed Deposit) and set temperature to 'hot' (Sôi = xuống tiền)
            // Also sync the contact's expected_revenue with the actual deposit price
            $stmtUpC = $this->db->prepare("UPDATE contacts SET pipeline_status = 'dat_coc', status = 'customer', temperature = 'hot', suggested_temperature = 'hot', expected_revenue = ? WHERE id = ? AND tenant_id = ?");
            $stmtUpC->execute([$price, $contactId, $auth['tenant_id']]);

            // Withdraw from databank and terminate other parallel contacts
            require_once __DIR__ . '/../config/ParallelHelper.php';
            ParallelHelper::lockPersonForWinningContact($this->db, (int)$contactId);

            // Retrieve all caregivers from quyen_truy_cap to check for co-op sales
            $stmtQ = $this->db->prepare("SELECT DISTINCT user_id FROM quyen_truy_cap WHERE contact_id = ?");
            $stmtQ->execute([$contactId]);
            $validHelpers = $stmtQ->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $validHelpers = array_map('intval', $validHelpers);

            // Also check contact's collaborator_ids column
            $collabStr = trim($contact['collaborator_ids'] ?? '');
            if (!empty($collabStr)) {
                $cIds = array_map('intval', array_filter(explode(',', $collabStr)));
                $validHelpers = array_values(array_unique(array_merge($validHelpers, $cIds)));
            }

            $ownerUid = (int)($contact['owner_id'] ?: $auth['user_id']);
            $coopSales = array_values(array_filter($validHelpers, function($uid) use ($ownerUid) {
                return $uid > 0 && $uid !== $ownerUid;
            }));

            // Build initial shares distribution
            if (!empty($coopSales)) {
                $totalCount = 1 + count($coopSales);
                $basePercent = floor(100 / $totalCount);
                $remainder = 100 - ($basePercent * $totalCount);

                $customShares = [$ownerUid => (int)($basePercent + $remainder)];
                foreach ($coopSales as $cid) {
                    $customShares[$cid] = (int)$basePercent;
                }
            } else {
                $customShares = [$ownerUid => 100];
            }

            // Check if there is an unlinked cooperation slip for this contact
            $stmtCheckCoop = $this->db->prepare("SELECT id FROM cooperation_slips WHERE contact_id = ? AND deposit_slip_id IS NULL ORDER BY created_at DESC LIMIT 1");
            $stmtCheckCoop->execute([$contactId]);
            $existingCoop = $stmtCheckCoop->fetch();

            require_once __DIR__ . '/CooperationController.php';
            $coopCtrl = new CooperationController($this->db);

            if ($existingCoop) {
                // Link pre-existing cooperation slip and update its shares to current collaborators
                $sharesJson = json_encode($customShares);
                $stmtLink = $this->db->prepare("UPDATE cooperation_slips SET deposit_slip_id = ?, shares_json = ? WHERE id = ?");
                $stmtLink->execute([$depositId, $sharesJson, (int)$existingCoop['id']]);

                $isSingleShareholder = count($customShares) === 1;
                $status = $isSingleShareholder ? 'approved' : 'pending_signatures';
                $sigs = [];
                if ($isSingleShareholder) {
                    $sigs[$ownerUid] = true;
                }
                $signaturesJson = json_encode($sigs);

                $stmtUpdateStatus = $this->db->prepare("UPDATE cooperation_slips SET status = ?, signatures_json = ? WHERE id = ?");
                $stmtUpdateStatus->execute([$status, $signaturesJson, (int)$existingCoop['id']]);

                $coopCtrl->syncCollaboratorsToContact((int)$contactId, $sharesJson);
            } else {
                // Auto-generate new cooperation slip ONLY if multi-sale co-care exists (!empty($coopSales))
                // If solo sale (làm 1 mình), no cooperation slip is required or created.
                if (!empty($coopSales)) {
                    $coopCtrl->autoGenerateSlip($contactId, $depositId, $auth['user_id'], $customShares);
                }
            }

            // Fetch the created milestones to return their IDs to the frontend
            $stmtGetM = $this->db->prepare("SELECT id, milestone_name, expected_amount, status FROM deposit_milestones WHERE deposit_id = ? ORDER BY id ASC");
            $stmtGetM->execute([$depositId]);
            $createdMilestones = $stmtGetM->fetchAll(PDO::FETCH_ASSOC);

            $this->db->commit();
            
            // Trigger Meta CAPI Purchase event (Pending state)
            require_once __DIR__ . '/../config/CapiHelper.php';
            CapiHelper::sendEvent($this->db, $contactId, 'Purchase', $price);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE_DEPOSIT', 'deposit', $depositId, "Tạo cọc căn $unitCode cho khách hàng " . $contact['first_name'] . " " . $contact['last_name']);
            respond(200, [
                'id' => $depositId,
                'milestones' => $createdMilestones
            ], 'Tạo phiếu cọc và khởi tạo lịch thanh toán thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi lưu phiếu cọc: ' . $e->getMessage(), false);
        }
    }

    public function uploadUnc(array $auth, int $id, int $milestoneId): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        if (empty($_FILES['file'])) {
            respond(400, null, 'Không tìm thấy file ủy nhiệm chi (UNC) tải lên', false);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(400, null, 'Lỗi tải file: ' . $file['error'], false);
        }

        // Check ownership of deposit
        $stmtDep = $this->db->prepare("
            SELECT d.id, c.tenant_id, c.owner_id 
            FROM deposits d 
            JOIN contacts c ON d.contact_id = c.id 
            WHERE d.id = ? AND c.tenant_id = ?
        ");
        $stmtDep->execute([$id, $auth['tenant_id']]);
        $dep = $stmtDep->fetch();
        if (!$dep) respond(404, null, 'Phiếu cọc không tồn tại', false);

        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            if ($dep['owner_id'] != $auth['user_id']) {
                respond(403, null, 'Bạn không có quyền cập nhật phiếu cọc của người khác', false);
            }
        } else if ($auth['role'] === 'manager') {
            $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
            $stmtUserTeam->execute([$dep['owner_id']]);
            $targetUserTeamId = $stmtUserTeam->fetchColumn();

            $stmtLead = $this->db->prepare("SELECT 1 FROM teams WHERE id = ? AND leader_id = ?");
            $stmtLead->execute([$targetUserTeamId, $auth['user_id']]);
            $isTeamMember = $stmtLead->fetch();

            if ($dep['owner_id'] != $auth['user_id'] && !$isTeamMember) {
                respond(403, null, 'Bạn không có quyền cập nhật phiếu cọc thuộc quản lý của nhóm khác', false);
            }
        }

        $fileName = basename($file['name']);
        $uploadDir = UPLOAD_DIR . '/deposits/' . $id;
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $safeName = $milestoneId . '_' . time() . '_' . preg_replace('/[^a-zA-Z0-9_.-]/', '_', $fileName);
        $destPath = $uploadDir . '/' . $safeName;

        require_once __DIR__ . '/../config/ImageHelper.php';
        $res = ImageHelper::saveUploadedFile($file['tmp_name'], $destPath, $file['name']);

        if ($res['success']) {
            $savedName = $res['filename'];
            $relPath = 'deposits/' . $id . '/' . $savedName;

            $stmt = $this->db->prepare("
                UPDATE deposit_milestones 
                SET unc_file_path = ?, status = 'paid' 
                WHERE id = ? AND deposit_id = ?
            ");
            $stmt->execute([$relPath, $milestoneId, $id]);

            // Automatically save UNC deposit proof file into Customer Documents ("Hồ sơ & Tài liệu") under folder "Đặt cọc"
            try {
                $fileSize = file_exists($destPath) ? filesize($destPath) : ($file['size'] ?? 0);
                $fileExt = strtolower(pathinfo($savedName, PATHINFO_EXTENSION));
                $mimeType = mime_content_type($destPath) ?: ($file['type'] ?? ('image/' . $fileExt));

                // Check if UNC file already recorded in cloud_files for this contact to prevent duplicates
                $stmtCheckCF = $this->db->prepare("SELECT id FROM cloud_files WHERE contact_id = ? AND file_path = ? LIMIT 1");
                $stmtCheckCF->execute([$dep['contact_id'], $relPath]);
                if (!$stmtCheckCF->fetch()) {
                    $stmtInsCloud = $this->db->prepare("
                        INSERT INTO cloud_files (tenant_id, contact_id, name, original_name, file_path, file_size, file_type, category, visibility, uploaded_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'Đặt cọc', 'shared', ?, NOW())
                    ");
                    $stmtInsCloud->execute([
                        $auth['tenant_id'] ?? 1,
                        $dep['contact_id'],
                        'UNC_DatCoc_' . $milestoneId . '_' . $fileName,
                        $fileName,
                        $relPath,
                        $fileSize,
                        $mimeType,
                        $auth['user_id'] ?? 1
                    ]);
                }
            } catch (\Throwable $cfEx) {
                error_log("Error auto-saving UNC deposit file to cloud_files: " . $cfEx->getMessage());
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPLOAD_DEPOSIT_UNC', 'deposit_milestone', $milestoneId, "Tải lên UNC cho đợt thanh toán ID: $milestoneId");
            respond(200, [
                'unc_file_path' => $relPath
            ], 'Đã tải lên ủy nhiệm chi thành công, vui lòng chờ Admin duyệt');
        } else {
            respond(500, null, 'Không thể lưu file trên máy chủ', false);
        }
    }

    public function approveMilestone(array $auth, int $id, int $milestoneId): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'assistant', 'director']);
        
        $this->db->beginTransaction();
        try {
            // Update milestone status
            $stmt = $this->db->prepare("
                UPDATE deposit_milestones 
                SET status = 'approved', approval_date = NOW(), approved_by = ? 
                WHERE id = ? AND deposit_id = ?
            ");
            $stmt->execute([$auth['user_id'], $milestoneId, $id]);

            // Fetch deposit details to link the invoice and notify owner
            $stmtDep = $this->db->prepare("
                SELECT d.*, c.company_id, c.first_name, c.last_name, p.name as project_name,
                       u.email as owner_email, u.full_name as owner_name, u.zalo_chat_id as owner_zalo_chat_id,
                       c.owner_id as contact_owner_id, c.created_by as contact_created_by
                FROM deposits d
                JOIN contacts c ON d.contact_id = c.id
                LEFT JOIN projects p ON d.project_id = p.id
                LEFT JOIN users u ON c.owner_id = u.id
                WHERE d.id = ?
            ");
            $stmtDep->execute([$id]);
            $depositData = $stmtDep->fetch();

            $stmtMile = $this->db->prepare("SELECT milestone_name, expected_amount FROM deposit_milestones WHERE id = ?");
            $stmtMile->execute([$milestoneId]);
            $mileData = $stmtMile->fetch();

            if ($depositData && $mileData) {
                $invoiceNum = 'INV-' . strtoupper(uniqid());
                $title = "Hóa đơn đợt thanh toán: " . $mileData['milestone_name'] . " - Dự án " . ($depositData['project_name'] ?? 'BĐS');
                $total = (float)$mileData['expected_amount'];
                
                $stmtInv = $this->db->prepare("
                    INSERT INTO invoices (tenant_id, contact_id, company_id, created_by, invoice_number, title, status, issue_date, due_date, paid_at, subtotal, total, notes)
                    VALUES (?, ?, ?, ?, ?, ?, 'paid', CURDATE(), CURDATE(), NOW(), ?, ?, ?)
                ");
                $stmtInv->execute([
                    $auth['tenant_id'],
                    $depositData['contact_id'],
                    $depositData['company_id'],
                    $auth['user_id'],
                    $invoiceNum,
                    $title,
                    $total,
                    $total,
                    "Tự động tạo từ đợt UNC đặt cọc được duyệt. Mã phiếu cọc: #" . $id
                ]);
            }

            // Check if all milestones are approved. If so, approve the deposit slip as well
            $stmtCheck = $this->db->prepare("SELECT COUNT(*) FROM deposit_milestones WHERE deposit_id = ? AND status != 'approved'");
            $stmtCheck->execute([$id]);
            $remaining = (int)$stmtCheck->fetchColumn();

            if ($remaining === 0) {
                $stmtAppDep = $this->db->prepare("UPDATE deposits SET status = 'approved' WHERE id = ?");
                $stmtAppDep->execute([$id]);
            }

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'APPROVE_DEPOSIT_MILESTONE', 'deposit_milestone', $milestoneId, "Duyệt đóng tiền đợt ID: $milestoneId");

            // Notify all related users (owner, creator, co-op sales)
            if ($depositData && $mileData) {
                $uIdsToNotify = [];
                if (!empty($depositData['contact_owner_id'])) $uIdsToNotify[(int)$depositData['contact_owner_id']] = true;
                if (!empty($depositData['contact_created_by'])) $uIdsToNotify[(int)$depositData['contact_created_by']] = true;
                if (!empty($depositData['created_by'])) $uIdsToNotify[(int)$depositData['created_by']] = true;

                $stmtCoop = $this->db->prepare("
                    SELECT shares_json 
                    FROM cooperation_slips 
                    WHERE deposit_slip_id = ? OR (deposit_slip_id IS NULL AND contact_id = ?) 
                    LIMIT 1
                ");
                $stmtCoop->execute([$id, $depositData['contact_id']]);
                $coopRow = $stmtCoop->fetch();
                if ($coopRow && !empty($coopRow['shares_json'])) {
                    $shares = json_decode($coopRow['shares_json'], true);
                    if (is_array($shares)) {
                        foreach ($shares as $uId => $pct) {
                            $uIdsToNotify[(int)$uId] = true;
                        }
                    }
                }

                $uIdsToNotify = array_keys($uIdsToNotify);
                if (!empty($uIdsToNotify)) {
                    $inUsers = implode(',', array_fill(0, count($uIdsToNotify), '?'));
                    $stmtUsers = $this->db->prepare("SELECT id, full_name, email FROM users WHERE id IN ($inUsers)");
                    $stmtUsers->execute($uIdsToNotify);
                    $usersList = $stmtUsers->fetchAll();

                    require_once __DIR__ . '/../NotificationService.php';

                    foreach ($usersList as $u) {
                        NotificationService::send($this->db, $auth['tenant_id'], 'MY_DEPOSIT_UPDATE', [
                            'user_id' => (int)$u['id'],
                            'deposit_id' => $id,
                            'customer_name' => trim($depositData['first_name'] . ' ' . ($depositData['last_name'] ?? '')),
                            'status_text' => 'được duyệt đợt thanh toán ' . ($mileData['milestone_name'] ?? ''),
                            'reason' => 'Đợt thanh toán ' . number_format($total, 0, ',', '.') . ' VND đã được phê duyệt thành công'
                        ]);
                    }
                }
            }

            // Zalo message if bot token and chat ID are configured
            if ($depositData && !empty($depositData['owner_zalo_chat_id'])) {
                try {
                    $stmtToken = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                    $botToken = $stmtToken ? $stmtToken->fetchColumn() : '';
                    if (!empty($botToken)) {
                        require_once __DIR__ . '/../zalo_bot.php';
                        $zaloMsg = "✅ [ DUYỆT ĐỢT THANH TOÁN CỌC ]\n\n"
                            . "Chào " . $depositData['owner_name'] . ", đợt thanh toán " . $mileData['milestone_name'] . " của khách hàng " . $depositData['first_name'] . " " . ($depositData['last_name'] ?? '') . " đã được phê duyệt thành công.\n"
                            . "• Số tiền: " . number_format($total, 0, ',', '.') . " VND\n"
                            . "• Trạng thái phiếu cọc: " . ($remaining === 0 ? "Đã duyệt hoàn tất (Approved)" : "Đang chờ thanh toán tiếp (Pending)") . "\n\n"
                            . "Hệ thống đã tự động xuất hóa đơn tương ứng.";
                        sendZaloMessage($botToken, $depositData['owner_zalo_chat_id'], $zaloMsg, false);
                    }
                } catch (Exception $zaloEx) {
                    error_log("Error sending deposit milestone approval Zalo: " . $zaloEx->getMessage());
                }
            }

            respond(200, null, 'Phê duyệt đợt thanh toán cọc thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi duyệt đợt tiền: ' . $e->getMessage(), false);
        }
    }

    public function rejectMilestone(array $auth, int $id, int $milestoneId): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'assistant', 'director']);
        
        $b = getBody();
        $reason = trim($b['reason'] ?? 'Không rõ lý do');

        $stmt = $this->db->prepare("
            UPDATE deposit_milestones 
            SET status = 'failed', unc_file_path = NULL 
            WHERE id = ? AND deposit_id = ?
        ");
        $stmt->execute([$milestoneId, $id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'REJECT_DEPOSIT_MILESTONE', 'deposit_milestone', $milestoneId, "Từ chối đóng tiền đợt ID: $milestoneId. Lý do: $reason");

        // Notify all related users
        $stmtDep = $this->db->prepare("
            SELECT d.*, c.first_name, c.last_name, c.created_by as contact_created_by, c.owner_id as contact_owner_id,
                   u.email as owner_email, u.full_name as owner_name, u.zalo_chat_id as owner_zalo_chat_id
            FROM deposits d
            JOIN contacts c ON d.contact_id = c.id
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE d.id = ?
        ");
        $stmtDep->execute([$id]);
        $depositData = $stmtDep->fetch();

        $stmtMile = $this->db->prepare("SELECT milestone_name, expected_amount FROM deposit_milestones WHERE id = ?");
        $stmtMile->execute([$milestoneId]);
        $mileData = $stmtMile->fetch();

        if ($depositData && $mileData) {
            $uIdsToNotify = [];
            if (!empty($depositData['contact_owner_id'])) $uIdsToNotify[(int)$depositData['contact_owner_id']] = true;
            if (!empty($depositData['contact_created_by'])) $uIdsToNotify[(int)$depositData['contact_created_by']] = true;
            if (!empty($depositData['created_by'])) $uIdsToNotify[(int)$depositData['created_by']] = true;

            $stmtCoop = $this->db->prepare("
                SELECT shares_json 
                FROM cooperation_slips 
                WHERE deposit_slip_id = ? OR (deposit_slip_id IS NULL AND contact_id = ?) 
                LIMIT 1
            ");
            $stmtCoop->execute([$id, $depositData['contact_id']]);
            $coopRow = $stmtCoop->fetch();
            if ($coopRow && !empty($coopRow['shares_json'])) {
                $shares = json_decode($coopRow['shares_json'], true);
                if (is_array($shares)) {
                    foreach ($shares as $uId => $pct) {
                        $uIdsToNotify[(int)$uId] = true;
                    }
                }
            }

            $uIdsToNotify = array_keys($uIdsToNotify);
            if (!empty($uIdsToNotify)) {
                $inUsers = implode(',', array_fill(0, count($uIdsToNotify), '?'));
                $stmtUsers = $this->db->prepare("SELECT id, full_name, email FROM users WHERE id IN ($inUsers)");
                $stmtUsers->execute($uIdsToNotify);
                $usersList = $stmtUsers->fetchAll();

                    require_once __DIR__ . '/../NotificationService.php';

                    foreach ($usersList as $u) {
                        NotificationService::send($this->db, $auth['tenant_id'], 'MY_DEPOSIT_UPDATE', [
                            'user_id' => (int)$u['id'],
                            'deposit_id' => $id,
                            'customer_name' => trim($depositData['first_name'] . ' ' . ($depositData['last_name'] ?? '')),
                            'status_text' => 'bị từ chối đợt thanh toán ' . ($mileData['milestone_name'] ?? ''),
                            'reason' => $reason
                        ]);
                    }
            }

            // Zalo message to owner
            if (!empty($depositData['owner_zalo_chat_id'])) {
                try {
                    $stmtToken = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'zalo_bot_token' LIMIT 1");
                    $botToken = $stmtToken ? $stmtToken->fetchColumn() : '';
                    if (!empty($botToken)) {
                        require_once __DIR__ . '/../zalo_bot.php';
                        $zaloMsg = "❌ [ TỪ CHỐI ĐỢT THANH TOÁN CỌC ]\n\n"
                            . "Chào " . $depositData['owner_name'] . ", đợt thanh toán " . $mileData['milestone_name'] . " của khách hàng " . $depositData['first_name'] . " " . ($depositData['last_name'] ?? '') . " đã bị từ chối.\n"
                            . "• Lý do: " . $reason . "\n"
                            . "• Yêu cầu: Vui lòng kiểm tra và tải lại ảnh UNC chính xác trên RICH LAND CRM.";
                        sendZaloMessage($botToken, $depositData['owner_zalo_chat_id'], $zaloMsg, false);
                    }
                } catch (Exception $zaloEx) {
                    error_log("Error sending Zalo message: " . $zaloEx->getMessage());
                }
            }
        }

        respond(200, null, 'Đã từ chối và yêu cầu tải lại UNC');
    }

    public function cancelDeposit(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director']);
        $b = getBody();
        $reason = trim($b['reason'] ?? 'Khách hủy mua');

        $this->db->beginTransaction();
        try {
            // Fetch deposit info and check access
            $stmtDep = $this->db->prepare("
                SELECT d.contact_id, d.status, c.owner_id, c.tenant_id 
                FROM deposits d 
                JOIN contacts c ON d.contact_id = c.id
                WHERE d.id = ? AND c.tenant_id = ?
            ");
            $stmtDep->execute([$id, $auth['tenant_id']]);
            $dep = $stmtDep->fetch();
            if (!$dep) respond(404, null, 'Phiếu cọc không tồn tại hoặc bạn không có quyền', false);

            if ($auth['role'] === 'manager') {
                $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
                $stmtUserTeam->execute([$dep['owner_id']]);
                $targetUserTeamId = $stmtUserTeam->fetchColumn();

                $stmtLead = $this->db->prepare("SELECT 1 FROM teams WHERE id = ? AND leader_id = ?");
                $stmtLead->execute([$targetUserTeamId, $auth['user_id']]);
                $isTeamMember = $stmtLead->fetch();

                if ($dep['owner_id'] != $auth['user_id'] && !$isTeamMember) {
                    respond(403, null, 'Bạn không thể hủy cọc cho khách hàng thuộc quản lý của nhóm khác', false);
                }
            }

            $contactId = $dep['contact_id'];

            // Check if any milestone has been approved (paid & verified)
            $stmtM = $this->db->prepare("SELECT COUNT(*) FROM deposit_milestones WHERE deposit_id = ? AND status = 'approved'");
            $stmtM->execute([$id]);
            $approvedCount = (int)$stmtM->fetchColumn();

            if ($approvedCount === 0) {
                // REDUCE KHTN TEMPERATURE BY 1 LEVEL (Decay rule)
                $stmtC = $this->db->prepare("SELECT temperature, pipeline_status FROM contacts WHERE id = ?");
                $stmtC->execute([$contactId]);
                $contact = $stmtC->fetch();

                $currTemp = $contact['temperature'];
                $tempDecayMap = [
                    'hot' => 'warm',
                    'warm' => 'neutral',
                    'neutral' => 'cool',
                    'cool' => 'cold',
                    'cold' => 'cold'
                ];
                $nextTemp = $tempDecayMap[$currTemp] ?? 'neutral';

                // Dynamically resolve target demoted statuses from system settings
                $demotedBookingStatus = $this->getSetting('deposit_cancel_demoted_booking_status', 'booking');
                $demotedStatus = $this->getSetting('deposit_cancel_demoted_status', 'da_gap');

                // Resolve stage_ids for dynamic targets
                $stmtStages = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? ORDER BY order_index");
                $stmtStages->execute([$auth['tenant_id']]);
                $stages = $stmtStages->fetchAll(PDO::FETCH_COLUMN);

                $stmtBooking = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND system_slug = ? LIMIT 1");
                $stmtBooking->execute([$auth['tenant_id'], $demotedBookingStatus]);
                $bookingStageId = (int)$stmtBooking->fetchColumn();

                $stmtDaGap = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND system_slug = ? LIMIT 1");
                $stmtDaGap->execute([$auth['tenant_id'], $demotedStatus]);
                $daGapStageId = (int)$stmtDaGap->fetchColumn();

                // Check if the contact ever had an active booking/target status in their audit logs
                $stmtHasBooking = $this->db->prepare("
                    SELECT 1 FROM audit_logs 
                    WHERE tenant_id = ? 
                      AND resource = 'contact' 
                      AND resource_id = ? 
                      AND action = 'MOVE_STAGE'
                      AND (new_data LIKE ? OR new_data LIKE ?)
                    LIMIT 1
                ");
                $likeBooking1 = '%"pipeline_status":"' . $demotedBookingStatus . '"%';
                $likeBooking2 = '%"to_stage":"' . $demotedBookingStatus . '"%';
                $stmtHasBooking->execute([$auth['tenant_id'], $contactId, $likeBooking1, $likeBooking2]);
                $hadBooking = (bool)$stmtHasBooking->fetchColumn();

                $targetStatus = $demotedStatus;
                $targetStageId = $daGapStageId ?: ($stages[3] ?? ($stages[0] ?? 0));
                
                // Get security timer durations dynamically
                $timerKey = 'security_timer_' . $demotedStatus;
                $duration = $this->getSetting($timerKey, '+5 days');
                $expiresAt = date('Y-m-d H:i:s', strtotime($duration));

                if ($hadBooking && $bookingStageId > 0) {
                    $targetStatus = $demotedBookingStatus;
                    $targetStageId = $bookingStageId;
                    
                    $timerBookingKey = 'security_timer_' . $demotedBookingStatus;
                    $bookingDuration = $this->getSetting($timerBookingKey, '+3 months');
                    $expiresAt = date('Y-m-d H:i:s', strtotime($bookingDuration));
                }

                // Revert status dynamically and save security_expires_at datetime
                $stmtRev = $this->db->prepare("UPDATE contacts SET pipeline_status = ?, stage_id = ?, temperature = ?, status = 'lead', security_expires_at = ? WHERE id = ?");
                $stmtRev->execute([$targetStatus, $targetStageId, $nextTemp, $expiresAt, $contactId]);
            } else {
                // If paid, keep in Dat Coc but mark deposit cancelled (Bể cọc, tiền thu hoặc chuyển đợt)
                // In this case, contact remains in Customer status
            }

            // Update deposit status
            $stmtCancel = $this->db->prepare("UPDATE deposits SET status = 'cancelled', cancelled_reason = ? WHERE id = ?");
            $stmtCancel->execute([$reason, $id]);

            // Email owner about cancellation
            $stmtOwner = $this->db->prepare("
                SELECT u.email, u.full_name, CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) as contact_name 
                FROM contacts c
                JOIN users u ON c.owner_id = u.id
                WHERE c.id = ?
            ");
            $stmtOwner->execute([$contactId]);
            $ownerRow = $stmtOwner->fetch();
            
            require_once __DIR__ . '/../mailer.php';
            if ($ownerRow && !empty($ownerRow['email'])) {
                $emailSubject = "[RICH LAND] Báo cáo hủy cọc / Bể cọc khách hàng: " . $ownerRow['contact_name'];
                $emailTitle = "BÁO CÁO HỦY CỌC / BỂ CỌC";
                $emailContent = "Chào <strong>" . htmlspecialchars($ownerRow['full_name']) . "</strong>,<br/><br/>" .
                                "Phiếu đặt cọc của khách hàng <strong>" . htmlspecialchars($ownerRow['contact_name']) . "</strong> (Phiếu cọc #" . $id . ") đã bị hủy.<br/>" .
                                "Lý do: <em>" . htmlspecialchars($reason) . "</em>.<br/>" .
                                "Trạng thái khách hàng đã được " . ($approvedCount === 0 ? "hạ về <strong>Đặt chỗ (Booking)</strong>" : "giữ nguyên <strong>Đặt cọc (Customer)</strong> do đã phát sinh doanh thu thực tế") . ".<br/>" .
                                "Vui lòng kiểm tra trên RICH LAND CRM.";
                sendEmailNotification($ownerRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
            }

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CANCEL_DEPOSIT', 'deposit', $id, "Hủy cọc/Bể cọc. Lý do: $reason");
            respond(200, null, 'Báo cáo hủy cọc và cập nhật trạng thái khách hàng thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi báo hủy cọc: ' . $e->getMessage(), false);
        }
    }

    public function updateMilestones(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $input = getBody();
        $milestones = $input['milestones'] ?? [];

        // 1. Verify deposit ownership/permissions
        $stmtDep = $this->db->prepare("
            SELECT d.id, d.created_by, c.owner_id, d.contact_id 
            FROM deposits d
            JOIN contacts c ON d.contact_id = c.id
            WHERE d.id = ? AND c.tenant_id = ?
        ");
        $stmtDep->execute([$id, $tid]);
        $dep = $stmtDep->fetch();
        if (!$dep) respond(404, null, 'Phiếu cọc không tồn tại', false);

        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $stmtCoop = $this->db->prepare("
                SELECT COUNT(*) 
                FROM quyen_truy_cap 
                WHERE contact_id = ? AND user_id = ?
            ");
            $stmtCoop->execute([$dep['contact_id'], $auth['user_id']]);
            $isCollaborator = ((int)$stmtCoop->fetchColumn()) > 0;

            if ($dep['created_by'] != $auth['user_id'] && $dep['owner_id'] != $auth['user_id'] && !$isCollaborator) {
                respond(403, null, 'Bạn không có quyền sửa đổi lịch trình thanh toán của phiếu cọc này', false);
            }
        }

        $this->db->beginTransaction();
        try {
            $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant'], true);
            if ($isAdmin) {
                if (isset($input['expected_commission'])) {
                    $expComm = (float)$input['expected_commission'];
                    $stmtComm = $this->db->prepare("UPDATE deposits SET expected_commission = ? WHERE id = ?");
                    $stmtComm->execute([$expComm, $id]);
                }
                
                if (isset($input['shares'])) {
                    $newSharesInput = $input['shares'];
                    $sharesMap = [];
                    $totalPercent = 0;
                    foreach ($newSharesInput as $sInput) {
                        $uId = (int)$sInput['user_id'];
                        $pct = (int)$sInput['percentage'];
                        if ($uId > 0 && $pct > 0) {
                            $sharesMap[$uId] = $pct;
                            $totalPercent += $pct;
                        }
                    }
                    
                    if ($totalPercent === 100 && !empty($sharesMap)) {
                        $newSharesJson = json_encode($sharesMap);
                        
                        $stmtCs = $this->db->prepare("SELECT id, shares_json, contact_id FROM cooperation_slips WHERE deposit_slip_id = ? OR (deposit_slip_id IS NULL AND contact_id = ?) LIMIT 1");
                        $stmtCs->execute([$id, $dep['contact_id']]);
                        $coopRow = $stmtCs->fetch();
                        
                        if ($coopRow) {
                            $coopId = (int)$coopRow['id'];
                            
                            $stmtUpdCs = $this->db->prepare("UPDATE cooperation_slips SET shares_json = ?, deposit_slip_id = ? WHERE id = ?");
                            $stmtUpdCs->execute([$newSharesJson, $id, $coopId]);
                            
                            logActivity($this->db, $tid, $auth['user_id'], 'ADMIN_UPDATE_COOP_SHARES', 'cooperation_slip', $coopId, "Admin đã cập nhật lại tỷ lệ hoa hồng cho phiếu cọc #$id");

                            $stmtCust = $this->db->prepare("SELECT CONCAT(first_name, ' ', COALESCE(last_name,'')) FROM contacts WHERE id = ?");
                            $stmtCust->execute([$dep['contact_id']]);
                            $custName = $stmtCust->fetchColumn() ?: "Khách hàng";

                            $notifySubject = "[RICH LAND] Admin cập nhật tỷ lệ phân chia hoa hồng";
                            $notifyTitle = "CẬP NHẬT TỶ LỆ PHÂN CHIA HOA HỒNG";
                            
                            $notifyContent = "Chào bạn,<br/><br/>" .
                                             "Admin đã cập nhật tỷ lệ phân chia hoa hồng cho giao dịch đặt cọc của khách hàng <strong>" . htmlspecialchars($custName) . "</strong>.<br/>" .
                                             "Hoa hồng giao dịch dự kiến: <strong>" . number_format(isset($expComm) ? $expComm : ($dep['expected_commission'] ?? 0)) . " VND</strong>.<br/><br/>" .
                                             "<strong>Tỷ lệ phân chia mới:</strong><br/>";
                                             
                            $uIdsToNotify = array_keys($sharesMap);
                            if (!empty($uIdsToNotify)) {
                                $inUsers = implode(',', array_fill(0, count($uIdsToNotify), '?'));
                                $stmtUsers = $this->db->prepare("SELECT id, full_name, email FROM users WHERE id IN ($inUsers)");
                                $stmtUsers->execute($uIdsToNotify);
                                $usersList = $stmtUsers->fetchAll();
                                
                                foreach ($usersList as $u) {
                                    $uPercent = $sharesMap[$u['id']] ?? 0;
                                    $uAmt = ((isset($expComm) ? $expComm : ($dep['expected_commission'] ?? 0)) * $uPercent) / 100;
                                    $notifyContent .= "- " . htmlspecialchars($u['full_name']) . ": <strong>" . $uPercent . "%</strong> (~ " . number_format($uAmt) . " VND)<br/>";
                                }
                                
                                require_once __DIR__ . '/../NotificationService.php';
                                foreach ($usersList as $u) {
                                    NotificationService::send($this->db, $tid, 'MY_DEPOSIT_UPDATE', [
                                        'user_id' => (int)$u['id'],
                                        'deposit_id' => $id,
                                        'customer_name' => trim($dep['first_name'] . ' ' . ($dep['last_name'] ?? '')),
                                        'status_text' => 'duyệt phiếu hợp tác chia sẻ hoa hồng',
                                        'reason' => 'Phiếu hợp tác đã được phê duyệt thành công'
                                    ]);
                                }
                            }
                        }
                    }
                }
            }

            // Get current milestones in database
            $stmtM = $this->db->prepare("SELECT id, status FROM deposit_milestones WHERE deposit_id = ?");
            $stmtM->execute([$id]);
            $currentDbMilestones = $stmtM->fetchAll(PDO::FETCH_ASSOC);
            $currentDbIds = array_column($currentDbMilestones, 'id');

            $payloadIds = [];
            foreach ($milestones as $m) {
                if (isset($m['id']) && !empty($m['id'])) {
                    $payloadIds[] = (int)$m['id'];
                }
            }

            // Delete milestones not in payload (only if they are not approved or paid)
            $toDeleteIds = array_diff($currentDbIds, $payloadIds);
            foreach ($toDeleteIds as $delId) {
                $dbMilestone = null;
                foreach ($currentDbMilestones as $cdm) {
                    if ((int)$cdm['id'] === $delId) {
                        $dbMilestone = $cdm;
                        break;
                    }
                }
                if ($dbMilestone && ($dbMilestone['status'] === 'approved' || $dbMilestone['status'] === 'paid')) {
                    throw new Exception("Không thể xóa đợt thanh toán đã đóng tiền hoặc đã được duyệt.");
                }
                $stmtDel = $this->db->prepare("DELETE FROM deposit_milestones WHERE id = ?");
                $stmtDel->execute([$delId]);
            }

            // Update or Insert milestones
            foreach ($milestones as $m) {
                $mName = trim($m['milestone_name'] ?? '');
                $mAmount = (float)($m['expected_amount'] ?? 0);
                if (empty($mName)) continue;

                if (isset($m['id']) && !empty($m['id'])) {
                    $mId = (int)$m['id'];
                    // Update existing
                    $dbMilestone = null;
                    foreach ($currentDbMilestones as $cdm) {
                        if ((int)$cdm['id'] === $mId) {
                            $dbMilestone = $cdm;
                            break;
                        }
                    }
                    if ($dbMilestone && ($dbMilestone['status'] === 'approved' || $dbMilestone['status'] === 'paid')) {
                        // Allow updating name, but prevent changing amount
                        $stmtUpd = $this->db->prepare("UPDATE deposit_milestones SET milestone_name = ? WHERE id = ?");
                        $stmtUpd->execute([$mName, $mId]);
                    } else {
                        $stmtUpd = $this->db->prepare("UPDATE deposit_milestones SET milestone_name = ?, expected_amount = ? WHERE id = ?");
                        $stmtUpd->execute([$mName, $mAmount, $mId]);
                    }
                } else {
                    // Insert new
                    $stmtIns = $this->db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status) VALUES (?, ?, ?, 'pending')");
                    $stmtIns->execute([$id, $mName, $mAmount]);
                }
            }

            $this->db->commit();
            respond(200, null, 'Cập nhật lịch trình thanh toán thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    private function getSetting(string $key, string $default): string {
        $stmt = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? $val : $default;
    }
}
