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
            SELECT d.*, c.first_name, c.last_name, c.phone, p.name as project_name, u.full_name as creator_name
            FROM deposits d
            JOIN contacts c ON d.contact_id = c.id
            JOIN projects p ON d.project_id = p.id
            JOIN users u ON d.created_by = u.id
            WHERE c.tenant_id = ?
        ";
        $params = [$tid];

        if ($auth['role'] === 'sales') {
            $sql .= " AND (d.created_by = ? OR c.owner_id = ?)";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }

        $sql .= " ORDER BY d.created_at DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $deposits = $stmt->fetchAll();

        // Attach milestones using Eager Loading (prevent N+1 queries)
        if (!empty($deposits)) {
            $depositIds = array_column($deposits, 'id');
            $inClause = implode(',', array_fill(0, count($depositIds), '?'));
            $stmtM = $this->db->prepare("SELECT * FROM deposit_milestones WHERE deposit_id IN ($inClause) ORDER BY id ASC");
            $stmtM->execute($depositIds);
            $allMilestones = $stmtM->fetchAll();
            
            // Map milestones to deposits
            $milestonesMap = [];
            foreach ($allMilestones as $m) {
                $milestonesMap[$m['deposit_id']][] = $m;
            }
            foreach ($deposits as &$d) {
                $d['milestones'] = $milestonesMap[$d['id']] ?? [];
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

            if ($auth['role'] === 'sales' && $contact['owner_id'] != $auth['user_id']) {
                respond(403, null, 'Bạn không thể tạo cọc cho khách hàng của người khác', false);
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

            // Update contact pipeline stage to 'dat_coc' (Placed Deposit)
            $stmtUpC = $this->db->prepare("UPDATE contacts SET pipeline_status = 'dat_coc', status = 'customer' WHERE id = ? AND tenant_id = ?");
            $stmtUpC->execute([$contactId, $auth['tenant_id']]);

            // Side effect: Automatically generate cooperation slip for commissions
            require_once __DIR__ . '/CooperationController.php';
            $coopCtrl = new CooperationController($this->db);
            $coopCtrl->autoGenerateSlip($contactId, $depositId, $auth['user_id']);

            $this->db->commit();
            
            // Trigger Meta CAPI Purchase event (Pending state)
            require_once __DIR__ . '/../config/CapiHelper.php';
            CapiHelper::sendEvent($this->db, $contactId, 'Purchase', $price);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE_DEPOSIT', 'deposit', $depositId, "Tạo cọc căn $unitCode cho khách hàng " . $contact['first_name'] . " " . $contact['last_name']);
            respond(200, ['id' => $depositId], 'Tạo phiếu cọc và khởi tạo lịch thanh toán thành công');
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

        if ($auth['role'] === 'sales' && $dep['owner_id'] != $auth['user_id']) {
            respond(403, null, 'Bạn không có quyền cập nhật phiếu cọc của người khác', false);
        }

        $fileName = basename($file['name']);
        $uploadDir = UPLOAD_DIR . '/deposits/' . $id;
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $safeName = $milestoneId . '_' . time() . '_' . preg_replace('/[^a-zA-Z0-9_.-]/', '_', $fileName);
        $destPath = $uploadDir . '/' . $safeName;

        if (move_uploaded_file($file['tmp_name'], $destPath)) {
            $stmt = $this->db->prepare("
                UPDATE deposit_milestones 
                SET unc_file_path = ?, status = 'paid' 
                WHERE id = ? AND deposit_id = ?
            ");
            $stmt->execute(['deposits/' . $id . '/' . $safeName, $milestoneId, $id]);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPLOAD_DEPOSIT_UNC', 'deposit_milestone', $milestoneId, "Tải lên UNC cho đợt thanh toán ID: $milestoneId");
            respond(200, null, 'Đã tải lên ủy nhiệm chi thành công, vui lòng chờ Admin duyệt');
        } else {
            respond(500, null, 'Không thể lưu file trên máy chủ', false);
        }
    }

    public function approveMilestone(array $auth, int $id, int $milestoneId): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'assistant']);
        
        $this->db->beginTransaction();
        try {
            // Update milestone status
            $stmt = $this->db->prepare("
                UPDATE deposit_milestones 
                SET status = 'approved', approval_date = NOW(), approved_by = ? 
                WHERE id = ? AND deposit_id = ?
            ");
            $stmt->execute([$auth['user_id'], $milestoneId, $id]);

            // Fetch deposit details to link the invoice
            $stmtDep = $this->db->prepare("
                SELECT d.*, c.company_id, c.first_name, c.last_name, p.name as project_name 
                FROM deposits d
                JOIN contacts c ON d.contact_id = c.id
                LEFT JOIN projects p ON d.project_id = p.id
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
            respond(200, null, 'Phê duyệt đợt thanh toán cọc thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi duyệt đợt tiền: ' . $e->getMessage(), false);
        }
    }

    public function rejectMilestone(array $auth, int $id, int $milestoneId): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'assistant']);
        
        $b = getBody();
        $reason = trim($b['reason'] ?? 'Không rõ lý do');

        $stmt = $this->db->prepare("
            UPDATE deposit_milestones 
            SET status = 'failed', unc_file_path = NULL 
            WHERE id = ? AND deposit_id = ?
        ");
        $stmt->execute([$milestoneId, $id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'REJECT_DEPOSIT_MILESTONE', 'deposit_milestone', $milestoneId, "Từ chối đóng tiền đợt ID: $milestoneId. Lý do: $reason");
        respond(200, null, 'Đã từ chối và yêu cầu tải lại UNC');
    }

    public function cancelDeposit(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager']);
        $b = getBody();
        $reason = trim($b['reason'] ?? 'Khách hủy mua');

        $this->db->beginTransaction();
        try {
            // Fetch deposit info
            $stmtDep = $this->db->prepare("SELECT contact_id, status FROM deposits WHERE id = ?");
            $stmtDep->execute([$id]);
            $dep = $stmtDep->fetch();
            if (!$dep) respond(404, null, 'Phiếu cọc không tồn tại', false);

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

                // Resolve stage_id for 'booking'
                $stmtStages = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? ORDER BY order_index");
                $stmtStages->execute([$auth['tenant_id']]);
                $stages = $stmtStages->fetchAll(PDO::FETCH_COLUMN);

                $stmtH = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'pipeline_status_hierarchy'");
                $stmtH->execute();
                $hierarchyJson = $stmtH->fetchColumn();
                $hierarchy = $hierarchyJson ? json_decode($hierarchyJson, true) : [];
                if (empty($hierarchy)) {
                    $hierarchy = ['chua_xac_dinh', 'quan_tam', 'dong_y_gap', 'da_gap', 'booking', 'dat_coc', 'dong_deal'];
                }

                $bookingStageId = 0;
                foreach ($hierarchy as $idx => $s) {
                    if ($s === 'booking') {
                        $bookingStageId = isset($stages[$idx]) ? (int)$stages[$idx] : 0;
                        break;
                    }
                }

                // Revert status to Booking or Da Gap
                $stmtRev = $this->db->prepare("UPDATE contacts SET pipeline_status = 'booking', stage_id = ?, temperature = ?, status = 'lead', security_expires_at = DATE_ADD(NOW(), INTERVAL 3 MONTH) WHERE id = ?");
                $stmtRev->execute([$bookingStageId, $nextTemp, $contactId]);
            } else {
                // If paid, keep in Dat Coc but mark deposit cancelled (Bể cọc, tiền thu hoặc chuyển đợt)
                // In this case, contact remains in Customer status
            }

            // Update deposit status
            $stmtCancel = $this->db->prepare("UPDATE deposits SET status = 'cancelled', cancelled_reason = ? WHERE id = ?");
            $stmtCancel->execute([$reason, $id]);

            // Email owner about cancellation
            $stmtOwner = $this->db->prepare("
                SELECT u.email, u.full_name, c.name as contact_name 
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
}
