<?php
// f:\CRM\backend\controllers\TicketController.php

class TicketController {
    private PDO $db;
    public function __construct(PDO $db) { 
        $this->db = $db; 
        try {
            $this->db->exec("ALTER TABLE ticket_comments ADD COLUMN parent_id INT(11) NULL DEFAULT NULL");
        } catch (Exception $e) {}
    }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';
        $contactId = $_GET['contact_id'] ?? '';
        $unresolved = isset($_GET['unresolved']) && $_GET['unresolved'] == 1;
        
        $where = ['t.tenant_id=?'];
        $params = [$tid];
        
        if ($contactId) {
            $where[] = "JSON_CONTAINS(t.related_contacts, ?)";
            $params[] = json_encode((int)$contactId);
        }
        
        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $where[] = '(t.created_by = ? OR t.assignee_id = ? OR EXISTS (
                SELECT 1 FROM contacts c 
                WHERE c.tenant_id = t.tenant_id 
                  AND JSON_CONTAINS(t.related_contacts, CAST(c.id AS CHAR)) 
                  AND (c.owner_id = ? OR FIND_IN_SET(?, c.collaborator_ids))
            ))';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($auth['role'] === 'manager') {
            $where[] = '(t.created_by = ? OR t.assignee_id = ? OR t.created_by IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ) OR t.assignee_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ) OR EXISTS (
                SELECT 1 FROM contacts c 
                WHERE c.tenant_id = t.tenant_id 
                  AND JSON_CONTAINS(t.related_contacts, CAST(c.id AS CHAR)) 
                  AND (
                      c.owner_id = ? 
                      OR FIND_IN_SET(?, c.collaborator_ids)
                      OR c.owner_id IN (
                          SELECT id FROM users WHERE team_id IN (
                              SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                          ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
                      )
                  )
            ))';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            // Added params for manager related contacts check:
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }

        if ($unresolved) {
            $where[] = "t.status IN ('open', 'in_progress', 'waiting')";
        } elseif ($status && $status !== 'all') {
            $where[] = 't.status=?';
            $params[] = $status;
        }

        if ($search) {
            $where[] = '(t.subject LIKE ? OR t.customer_name LIKE ? OR t.description LIKE ?)';
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM tickets t WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT t.*, u.full_name as assignee_name, u.avatar_url as assignee_avatar
            FROM tickets t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE $w 
            ORDER BY t.created_at DESC 
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $tickets = $stmt->fetchAll();
        foreach ($tickets as &$t) {
            $t['related_contacts'] = json_decode($t['related_contacts'] ?? '[]');
            $t['related_users'] = json_decode($t['related_users'] ?? '[]');
        }
        
        respond(200, [
            'items' => $tickets,
            'total' => $total,
            'page' => $page,
            'limit' => $limit
        ]);
    }

    public function show(array $auth, int $id): void {
        if (!$this->checkTicketAccess($auth, $id)) {
            respond(403, null, 'Bạn không có quyền truy cập ticket này', false);
        }
        $stmt = $this->db->prepare("
            SELECT t.*, u.full_name as assignee_name, u.avatar_url as assignee_avatar
            FROM tickets t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.id=? AND t.tenant_id=?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $ticket = $stmt->fetch();
        if (!$ticket) respond(404, null, 'Không tìm thấy ticket', false);
        $ticket['related_contacts'] = json_decode($ticket['related_contacts'] ?? '[]');
        $ticket['related_users'] = json_decode($ticket['related_users'] ?? '[]');
        respond(200, $ticket);
    }

    private function checkTicketAccess(array $auth, int $ticketId): bool {
        if (in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director'], true)) return true;
        
        $sql = "SELECT id FROM tickets WHERE id=? AND tenant_id=? AND (created_by = ? OR assignee_id = ? OR EXISTS (
            SELECT 1 FROM contacts c 
            WHERE c.tenant_id = tickets.tenant_id 
              AND JSON_CONTAINS(tickets.related_contacts, CAST(c.id AS CHAR)) 
              AND (c.owner_id = ? OR FIND_IN_SET(?, c.collaborator_ids))
        )";
        $params = [$ticketId, $auth['tenant_id'], $auth['user_id'], $auth['user_id'], $auth['user_id'], $auth['user_id']];
        
        if ($auth['role'] === 'manager') {
            $sql .= " OR created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))) OR team_id = (SELECT team_id FROM users WHERE id = ?))
                      OR assignee_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))) OR team_id = (SELECT team_id FROM users WHERE id = ?))
                      OR EXISTS (
                          SELECT 1 FROM contacts c 
                          WHERE c.tenant_id = tickets.tenant_id 
                            AND JSON_CONTAINS(tickets.related_contacts, CAST(c.id AS CHAR)) 
                            AND c.owner_id IN (
                                SELECT id FROM users WHERE team_id IN (
                                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
                            )
                      )";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }
        $sql .= ")";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return (bool)$stmt->fetchColumn();
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền tạo ticket', false);
        $data = getBody();
        if (empty($data['subject']) || empty($data['customer_name'])) {
            respond(400, null, 'Thiếu tiêu đề hoặc tên khách hàng', false);
        }

        $assigneeId = $data['assignee_id'] ?? $auth['user_id'];
        
        // Verify assignee_id belongs to tenant
        $checkUser = $this->db->prepare("SELECT id FROM users WHERE id=? AND tenant_id=?");
        $checkUser->execute([$assigneeId, $auth['tenant_id']]);
        if (!$checkUser->fetch()) $assigneeId = $auth['user_id']; // Fallback to self
        
        // Verify related_contacts
        $validContacts = [];
        if (!empty($data['related_contacts']) && is_array($data['related_contacts'])) {
            $inClause = implode(',', array_fill(0, count($data['related_contacts']), '?'));
            $sC = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND id IN ($inClause)");
            $sC->execute(array_merge([$auth['tenant_id']], $data['related_contacts']));
            $validContacts = $sC->fetchAll(PDO::FETCH_COLUMN);
        }

        // Báo lỗi data business rule check
        if ($data['subject'] === 'Báo lỗi data' && !empty($validContacts)) {
            $contactId = (int)$validContacts[0];
            $stmtC = $this->db->prepare("SELECT source FROM contacts WHERE id = ? AND tenant_id = ?");
            $stmtC->execute([$contactId, $auth['tenant_id']]);
            $contactRow = $stmtC->fetch(PDO::FETCH_ASSOC);
            if ($contactRow) {
                $src = $contactRow['source'];
                // Self-entered sources
                if (in_array($src, ['ca_nhan', 'cold_call', 'gioi_thieu'], true)) {
                    respond(400, null, 'Chỉ duy nhất data được chia mới được báo bù. Khách tự khai thác / tự nhập không được báo bù.', false);
                }
                
                // Retrieve correct lead_id associated with this contact's person_id
                $stmtLead = $this->db->prepare("SELECT id FROM leads WHERE person_id = (SELECT person_id FROM contacts WHERE id = ? LIMIT 1) ORDER BY id DESC LIMIT 1");
                $stmtLead->execute([$contactId]);
                $leadId = $stmtLead->fetchColumn();
                
                if (!$leadId) {
                    respond(400, null, 'Chỉ duy nhất data được chia mới được báo bù. Khách tự nhập không được báo bù.', false);
                }

                // Databank claimed: check latest distribution log
                $stmtLogs = $this->db->prepare("SELECT status FROM distribution_logs WHERE lead_id = ? ORDER BY id DESC LIMIT 1");
                $stmtLogs->execute([$leadId]);
                $lastLogStatus = $stmtLogs->fetchColumn();
                
                if (!$lastLogStatus || !in_array($lastLogStatus, ['assigned', 'compensation', 'rule_6_month', 'fallback', 'pending_work_hours', 'success', 'reminder'], true)) {
                    respond(400, null, 'Chỉ duy nhất data được chia từ chiến dịch marketing mới được báo bù. Data từ Databank không được báo bù.', false);
                }
            }
        }

        // Verify related_users
        $validUsers = [];
        if (!empty($data['related_users']) && is_array($data['related_users'])) {
            $inClause = implode(',', array_fill(0, count($data['related_users']), '?'));
            $sU = $this->db->prepare("SELECT id FROM users WHERE tenant_id=? AND id IN ($inClause)");
            $sU->execute(array_merge([$auth['tenant_id']], $data['related_users']));
            $validUsers = $sU->fetchAll(PDO::FETCH_COLUMN);
        }

        $stmt = $this->db->prepare("
            INSERT INTO tickets (tenant_id, created_by, assignee_id, subject, customer_name, description, status, priority, due_date, related_contacts, related_users)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $due_date = empty($data['due_date']) ? date('Y-m-d H:i:s', strtotime('+1 day')) : $data['due_date'];
        $stmt->execute([
            $auth['tenant_id'],
            $auth['user_id'],
            $assigneeId,
            $data['subject'],
            $data['customer_name'],
            $data['description'] ?? null,
            $data['status'] ?? 'open',
            $data['priority'] ?? 'medium',
            $due_date,
            !empty($validContacts) ? json_encode($validContacts) : null,
            !empty($validUsers) ? json_encode($validUsers) : null
        ]);
        $id = $this->db->lastInsertId();

        // Send notifications to all admins & directors using NotificationService
        require_once __DIR__ . '/../NotificationService.php';
        NotificationService::send($this->db, $auth['tenant_id'], 'TICKET_NEW', [
            'ticket_id' => $id,
            'user_name' => $auth['full_name'],
            'subject' => $data['subject'],
            'priority' => $data['priority'] ?? 'medium',
            'reason' => $data['description'] ?? 'Không có'
        ]);

        // Email notifications for Assignee & Related Users
        require_once __DIR__ . '/../mailer.php';
        $stmtUser = $this->db->prepare("SELECT email, full_name FROM users WHERE id=?");
        $stmtUser->execute([$assigneeId]);
        $assigneeRow = $stmtUser->fetch();
        if ($assigneeRow && !empty($assigneeRow['email'])) {
            $emailSubject = "[RICH LAND] Bạn được phân công hỗ trợ Ticket #" . $id;
            $emailTitle = "PHÂN CÔNG HỖ TRỢ TICKET";
            $emailContent = "Chào <strong>" . htmlspecialchars($assigneeRow['full_name']) . "</strong>,<br/><br/>" .
                            "Bạn đã được phân công xử lý Ticket mới: <strong>" . htmlspecialchars($data['subject']) . "</strong>.<br/>" .
                            "Mô tả: <em>" . htmlspecialchars($data['description'] ?? 'Không có') . "</em>.<br/>" .
                            "Vui lòng truy cập hệ thống RICH LAND CRM mục <strong>Hỗ trợ / Khiếu nại</strong> để xử lý.";
            sendEmailNotification($assigneeRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
        }

        if (!empty($validUsers)) {
            $inClause = implode(',', array_fill(0, count($validUsers), '?'));
            $stmtRelated = $this->db->prepare("SELECT email, full_name FROM users WHERE id IN ($inClause)");
            $stmtRelated->execute($validUsers);
            $relatedRows = $stmtRelated->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($relatedRows as $rel) {
                if (!empty($rel['email'])) {
                    $emailSubject = "[RICH LAND] Bạn được thêm là người liên quan Ticket #" . $id;
                    $emailTitle = "NGƯỜI LIÊN QUAN TICKET";
                    $emailContent = "Chào <strong>" . htmlspecialchars($rel['full_name']) . "</strong>,<br/><br/>" .
                                    "Bạn đã được thêm vào làm người liên quan của Ticket: <strong>" . htmlspecialchars($data['subject']) . "</strong>.<br/>" .
                                    "Người phân công: <strong>" . htmlspecialchars($auth['full_name']) . "</strong>.<br/>" .
                                    "Vui lòng truy cập hệ thống RICH LAND CRM để biết thêm chi tiết.";
                    sendEmailNotification($rel['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                }
            }
        }

        // Log interaction for related contacts
        if (!empty($validContacts)) {
            foreach ($validContacts as $cId) {
                logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'task', "Tạo Ticket mới: {$data['subject']}", "Ticket #$id đã được khởi tạo cho khách hàng.", 'contact', (int)$cId);
            }
        }

        $this->show($auth, (int)$id);
    }

    public function update(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật ticket', false);
        $data = getBody();
        $fields = ['subject', 'customer_name', 'description', 'status', 'priority', 'due_date', 'assignee_id'];
        $sets = []; 
        $params = [];
        
        foreach ($fields as $f) { 
            if (array_key_exists($f, $data)) { 
                $val = $data[$f];
                
                // Verify assignee_id
                if ($f === 'assignee_id') {
                    $checkUser = $this->db->prepare("SELECT id FROM users WHERE id=? AND tenant_id=?");
                    $checkUser->execute([$val, $auth['tenant_id']]);
                    if (!$checkUser->fetch()) continue; // Skip invalid assignee
                }

                $sets[] = "$f=?"; 
                if ($f === 'due_date' && $val === '') {
                    $params[] = null;
                } else {
                    $params[] = $val; 
                }
            } 
        }
        
        if (isset($data['related_contacts'])) { 
            $validContacts = [];
            if (!empty($data['related_contacts']) && is_array($data['related_contacts'])) {
                $inClause = implode(',', array_fill(0, count($data['related_contacts']), '?'));
                $sC = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND id IN ($inClause)");
                $sC->execute(array_merge([$auth['tenant_id']], $data['related_contacts']));
                $validContacts = $sC->fetchAll(PDO::FETCH_COLUMN);
            }
            $sets[] = 'related_contacts=?'; 
            $params[] = !empty($validContacts) ? json_encode($validContacts) : null; 
        }
        
        if (isset($data['related_users'])) { 
            $validUsers = [];
            if (!empty($data['related_users']) && is_array($data['related_users'])) {
                $inClause = implode(',', array_fill(0, count($data['related_users']), '?'));
                $sU = $this->db->prepare("SELECT id FROM users WHERE tenant_id=? AND id IN ($inClause)");
                $sU->execute(array_merge([$auth['tenant_id']], $data['related_users']));
                $validUsers = $sU->fetchAll(PDO::FETCH_COLUMN);
            }
            $sets[] = 'related_users=?'; 
            $params[] = !empty($validUsers) ? json_encode($validUsers) : null; 
        }
        
        if (isset($data['status']) && $data['status'] === 'resolved') {
            $sets[] = "resolved_at=NOW()";
        }

        if (!$sets) respond(422, null, 'Không có dữ liệu cập nhật', false);
        
        $params[] = $id; 
        $params[] = $auth['tenant_id'];

        // Get old ticket state for notifications comparison
        $stmtOld = $this->db->prepare("SELECT assignee_id, related_users, subject, status, created_by FROM tickets WHERE id=? AND tenant_id=?");
        $stmtOld->execute([$id, $auth['tenant_id']]);
        $oldTicket = $stmtOld->fetch(PDO::FETCH_ASSOC);
        
        $sql = "UPDATE tickets SET " . implode(',', $sets) . " WHERE id=? AND tenant_id=?";
        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $sql .= " AND (created_by = ? OR assignee_id = ?)";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($auth['role'] === 'manager') {
            $sql .= " AND (created_by = ? OR assignee_id = ? OR created_by IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ) OR assignee_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        // Send update email notifications
        if ($oldTicket) {
            require_once __DIR__ . '/../mailer.php';
            
            // 1. Check if Assignee changed
            if (isset($data['assignee_id']) && (int)$data['assignee_id'] !== (int)$oldTicket['assignee_id']) {
                $newAssigneeId = (int)$data['assignee_id'];
                $stmtUser = $this->db->prepare("SELECT email, full_name FROM users WHERE id=?");
                $stmtUser->execute([$newAssigneeId]);
                $assigneeRow = $stmtUser->fetch();
                if ($assigneeRow && !empty($assigneeRow['email'])) {
                    $emailSubject = "[RICH LAND] Bạn được phân công hỗ trợ Ticket #" . $id;
                    $emailTitle = "PHÂN CÔNG HỖ TRỢ TICKET";
                    $emailContent = "Chào <strong>" . htmlspecialchars($assigneeRow['full_name']) . "</strong>,<br/><br/>" .
                                    "Bạn đã được phân công xử lý Ticket: <strong>" . htmlspecialchars($oldTicket['subject']) . "</strong>.<br/>" .
                                    "Người phân công: <strong>" . htmlspecialchars($auth['full_name']) . "</strong>.<br/>" .
                                    "Vui lòng truy cập hệ thống để xử lý.";
                    sendEmailNotification($assigneeRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                }
            }

            // 2. Check if new related users added
            if (isset($data['related_users'])) {
                $oldRel = json_decode($oldTicket['related_users'] ?? '[]', true) ?: [];
                $newRel = $validUsers ?? [];
                $addedRel = array_diff($newRel, $oldRel);
                if (!empty($addedRel)) {
                    $inClause = implode(',', array_fill(0, count($addedRel), '?'));
                    $stmtRelated = $this->db->prepare("SELECT email, full_name FROM users WHERE id IN ($inClause)");
                    $stmtRelated->execute($addedRel);
                    $relatedRows = $stmtRelated->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    foreach ($relatedRows as $rel) {
                        if (!empty($rel['email'])) {
                            $emailSubject = "[RICH LAND] Bạn được thêm là người liên quan Ticket #" . $id;
                            $emailTitle = "NGƯỜI LIÊN QUAN TICKET";
                            $emailContent = "Chào <strong>" . htmlspecialchars($rel['full_name']) . "</strong>,<br/><br/>" .
                                            "Bạn đã được thêm vào làm người liên quan của Ticket: <strong>" . htmlspecialchars($oldTicket['subject']) . "</strong>.<br/>" .
                                            "Người cập nhật: <strong>" . htmlspecialchars($auth['full_name']) . "</strong>.<br/>" .
                                            "Vui lòng truy cập hệ thống để biết thêm chi tiết.";
                            sendEmailNotification($rel['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                        }
                    }
                }
            }

            // 3. Check if Status changed
            if (isset($data['status']) && $data['status'] !== $oldTicket['status']) {
                $newStatusVal = $data['status'];
                $notifUids = array_unique([(int)$oldTicket['created_by'], (int)$oldTicket['assignee_id']]);
                foreach ($notifUids as $nUid) {
                    $stmtUser = $this->db->prepare("SELECT email, full_name FROM users WHERE id=?");
                    $stmtUser->execute([$nUid]);
                    $notifRow = $stmtUser->fetch();
                    if ($notifRow && !empty($notifRow['email'])) {
                        $emailSubject = "[RICH LAND] Cập nhật trạng thái Ticket #" . $id;
                        $emailTitle = "CẬP NHẬT TRẠNG THÁI TICKET";
                        $emailContent = "Chào <strong>" . htmlspecialchars($notifRow['full_name']) . "</strong>,<br/><br/>" .
                                        "Ticket <strong>" . htmlspecialchars($oldTicket['subject']) . "</strong> đã được cập nhật trạng thái mới.<br/>" .
                                        "Trạng thái mới: <strong style='color: #ea580c;'>" . htmlspecialchars($newStatusVal) . "</strong>.<br/>" .
                                        "Người cập nhật: <strong>" . htmlspecialchars($auth['full_name']) . "</strong>.<br/>" .
                                        "Vui lòng truy cập hệ thống để xem chi tiết.";
                        sendEmailNotification($notifRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                    }
                }
            }
        }

        // Log if resolved
        if (isset($data['status']) && $data['status'] === 'resolved') {
            $tick = $this->db->prepare("SELECT subject, related_contacts FROM tickets WHERE id=? AND tenant_id=?");
            $tick->execute([$id, $auth['tenant_id']]);
            $tData = $tick->fetch();
            if ($tData && !empty($tData['related_contacts'])) {
                $cIds = json_decode($tData['related_contacts'], true);
                if (is_array($cIds)) {
                    foreach ($cIds as $cId) {
                        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'task', "Hoàn thành Ticket #$id", "Vấn đề \"{$tData['subject']}\" đã được xử lý xong.", 'contact', (int)$cId);
                    }
                }
            }
        }
        
        $this->show($auth, $id);
    }

    public function destroy(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'manager'], true)) respond(403, null, 'Bạn không có quyền xóa ticket', false);
        
        $sql = "DELETE FROM tickets WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'manager') {
            $sql .= " AND (created_by = ? OR assignee_id = ? OR created_by IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ) OR assignee_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy ticket hoặc bạn không có quyền', false);
        respond(200, null, 'Đã xóa ticket thành công');
    }

    public function getComments(array $auth, int $ticketId): void {
        if (!$this->checkTicketAccess($auth, $ticketId)) {
            respond(403, null, 'Bạn không có quyền truy cập ghi chú của ticket này', false);
        }
        $stmt = $this->db->prepare("
            SELECT tc.*, u.full_name as user_name, u.avatar_url
            FROM ticket_comments tc
            LEFT JOIN users u ON tc.user_id = u.id
            WHERE tc.ticket_id = ?
            ORDER BY tc.created_at DESC
        ");
        $stmt->execute([$ticketId]);
        respond(200, $stmt->fetchAll());
    }

    public function addComment(array $auth, int $ticketId): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền phản hồi ticket', false);
        if (!$this->checkTicketAccess($auth, $ticketId)) {
            respond(403, null, 'Bạn không có quyền phản hồi ticket này', false);
        }
        $data = getBody();
        if (empty($data['body'])) respond(400, null, 'Nội dung ghi chú không được để trống', false);

        $parentId = !empty($data['parent_id']) ? (int)$data['parent_id'] : null;

        $stmt = $this->db->prepare("INSERT INTO ticket_comments (ticket_id, user_id, body, parent_id) VALUES (?, ?, ?, ?)");
        $stmt->execute([$ticketId, $auth['user_id'], $data['body'], $parentId]);
        $newId = $this->db->lastInsertId();

        if ($parentId > 0) {
            $stmtParent = $this->db->prepare("SELECT user_id FROM ticket_comments WHERE id = ?");
            $stmtParent->execute([$parentId]);
            $parentOwnerId = (int)$stmtParent->fetchColumn();

            if ($parentOwnerId > 0 && $parentOwnerId !== (int)$auth['user_id']) {
                $title = "Bạn có phản hồi mới trong ticket";
                $body = ($auth['full_name'] ?? 'Đồng nghiệp') . " đã trả lời bình luận của bạn trong ticket #" . $ticketId;
                $type = "info";
                $link = "/tickets?id=" . $ticketId . "&highlight_comment_id=" . $newId;

                $insertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $insertNotif->execute([$parentOwnerId, $auth['tenant_id'], $title, $body, $type, $link]);
            }
        }

        // Parse mentions in comment body
        $bodyText = $data['body'];
        $mentions = [];
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()]+)/u', $bodyText, $matches);
        if (!empty($matches[1])) {
            foreach ($matches[1] as $nameWithUnderscores) {
                $fullName = str_replace('_', ' ', $nameWithUnderscores);
                $stmtUser = $this->db->prepare("SELECT id, email, full_name FROM users WHERE tenant_id=? AND full_name=?");
                $stmtUser->execute([$auth['tenant_id'], $fullName]);
                $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                if ($userRow) {
                    $uid = (int)$userRow['id'];
                    if ($uid !== (int)$auth['user_id']) {
                        $mentions[$uid] = $userRow;
                    }
                }
            }
        }

        // Send mention notifications (with email)
        if (!empty($mentions)) {
            require_once __DIR__ . '/../mailer.php';
            $preview = mb_strimwidth($bodyText, 0, 50, "...");
            $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'ticket_comment_mention', ?)");
            foreach ($mentions as $mUid => $userRow) {
                $stmtNotif->execute([
                    $mUid,
                    $auth['tenant_id'],
                    "Bạn được nhắc tên trong ticket hỗ trợ #" . $ticketId,
                    $auth['full_name'] . " đã nhắc tên bạn trong ghi chú ticket hỗ trợ #" . $ticketId . ": \"" . $preview . "\"",
                    "/tickets?id=" . $ticketId . "&highlight_comment_id=" . $newId
                ]);

                if (!empty($userRow['email'])) {
                    $emailSubject = "[RICH LAND] Bạn được nhắc tên trong ghi chú ticket #" . $ticketId;
                    $emailTitle = "NHẮC TÊN TRÊN HỆ THỐNG";
                    $emailContent = "Chào <strong>" . htmlspecialchars($userRow['full_name']) . "</strong>,<br/><br/>" .
                                    "Bạn đã được nhắc tên bởi <strong>" . htmlspecialchars($auth['full_name']) . "</strong> trong một ghi chú của ticket hỗ trợ <strong>#" . $ticketId . "</strong>.<br/>" .
                                    "Nội dung:<br/>" .
                                    "<blockquote style='border-left: 4px solid #eab308; padding-left: 12px; margin: 12px 0; color: #475569;'>" . nl2br(htmlspecialchars($bodyText)) . "</blockquote>" .
                                    "Vui lòng truy cập hệ thống để biết thêm chi tiết.";
                    sendEmailNotification($userRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                }
            }
        }
        
        $this->getComments($auth, $ticketId);
    }
}
