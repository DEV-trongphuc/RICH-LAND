<?php
// f:\CRM\backend\controllers\TicketController.php

class TicketController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';
        $contactId = $_GET['contact_id'] ?? '';
        
        $where = ['t.tenant_id=?'];
        $params = [$tid];
        
        if ($contactId) {
            $where[] = "JSON_CONTAINS(t.related_contacts, ?)";
            $params[] = json_encode((int)$contactId);
        }
        
        if ($auth['role'] === 'sales') {
            $where[] = '(t.created_by = ? OR t.assignee_id = ?)';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }

        if ($status && $status !== 'all') {
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
            SELECT t.*, u.full_name as assignee_name
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
        $sql = "SELECT t.*, u.full_name as assignee_name
            FROM tickets t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.id=? AND t.tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') {
            $sql .= " AND (t.created_by = ? OR t.assignee_id = ?)";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $ticket = $stmt->fetch();
        if (!$ticket) respond(404, null, 'Không tìm thấy ticket', false);
        $ticket['related_contacts'] = json_decode($ticket['related_contacts'] ?? '[]');
        $ticket['related_users'] = json_decode($ticket['related_users'] ?? '[]');
        respond(200, $ticket);
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
        
        $sql = "UPDATE tickets SET " . implode(',', $sets) . " WHERE id=? AND tenant_id=?";
        if ($auth['role'] === 'sales') {
            $sql .= " AND (created_by = ? OR assignee_id = ?)";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

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
        if (!in_array($auth['role'], ['admin', 'manager', 'super_admin'], true)) respond(403, null, 'Bạn không có quyền xóa ticket', false);
        $stmt = $this->db->prepare("DELETE FROM tickets WHERE id=? AND tenant_id=?");
        $stmt->execute([$id, $auth['tenant_id']]);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy ticket', false);
        respond(200, null, 'Đã xóa ticket thành công');
    }

    public function getComments(array $auth, int $ticketId): void {
        $stmt = $this->db->prepare("
            SELECT tc.*, u.full_name as user_name, u.avatar_url
            FROM ticket_comments tc
            LEFT JOIN users u ON tc.user_id = u.id
            JOIN tickets t ON tc.ticket_id = t.id
            WHERE tc.ticket_id = ? AND t.tenant_id = ?
            ORDER BY tc.created_at ASC
        ");
        $stmt->execute([$ticketId, $auth['tenant_id']]);
        respond(200, $stmt->fetchAll());
    }

    public function addComment(array $auth, int $ticketId): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền phản hồi ticket', false);
        $data = getBody();
        if (empty($data['body'])) respond(400, null, 'Nội dung ghi chú không được để trống', false);

        $check = $this->db->prepare("SELECT id FROM tickets WHERE id=? AND tenant_id=?");
        $check->execute([$ticketId, $auth['tenant_id']]);
        if (!$check->fetch()) respond(404, null, 'Không tìm thấy ticket', false);

        $stmt = $this->db->prepare("INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES (?, ?, ?)");
        $stmt->execute([$ticketId, $auth['user_id'], $data['body']]);
        
        $this->getComments($auth, $ticketId);
    }
}
