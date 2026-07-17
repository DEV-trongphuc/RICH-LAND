<?php
// NoteController — Threaded notes with @mentions on contacts, companies, deals
class NoteController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    private function checkEntityAccess(array $auth, string $type, int $id): bool {
        $table = $type === 'contact' ? 'contacts' : ($type === 'company' ? 'companies' : ($type === 'deal' ? 'deals' : null));
        if (!$table) return true; // Generic types or non-existing tables

        $sql = "SELECT id FROM $table WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if ($type === 'contact') {
            if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
                $sql .= ' AND (owner_id=? OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
                ))';
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
            } else if ($auth['role'] === 'manager') {
                $sql .= " AND (owner_id=? OR owner_id IN (
                    SELECT id FROM users WHERE team_id IN (
                        SELECT id FROM teams WHERE leader_id = ?
                    )
                ) OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE \"{}\" END), JSON_QUOTE(CAST(? AS CHAR)))
                ))";
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
            }
        } else if ($type === 'deal') {
            if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
                $sql .= ' AND (owner_id=? OR contact_id IN (
                    SELECT id FROM contacts WHERE FIND_IN_SET(?, collaborator_ids)
                ) OR contact_id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
                ))';
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
            } else if ($auth['role'] === 'manager') {
                $sql .= " AND (owner_id=? OR owner_id IN (
                    SELECT id FROM users WHERE team_id IN (
                        SELECT id FROM teams WHERE leader_id = ?
                    )
                ) OR contact_id IN (
                    SELECT id FROM contacts WHERE FIND_IN_SET(?, collaborator_ids)
                ) OR contact_id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE \"{}\" END), JSON_QUOTE(CAST(? AS CHAR)))
                ))";
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
            }
        } else if ($type === 'company') {
            if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
                $sql .= " AND owner_id=?";
                $p[] = $auth['user_id'];
            }
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        return (bool)$stmt->fetch();
    }

    public function index(array $auth, string $type, int $entityId): void {
        if (!$this->checkEntityAccess($auth, $type, $entityId)) {
            respond(403, null, 'Bạn không có quyền xem ghi chú này', false);
        }

        $salesFilter = "";
        $mainParams = [$auth['tenant_id'], $type, $entityId];
        if ($auth['role'] === 'sales') {
            $salesFilter = " AND (n.user_id = ? OR u.role != 'sales' OR u.role IS NULL)";
            $mainParams[] = $auth['user_id'];
        }

        $stmt = $this->db->prepare("
            SELECT n.*, u.full_name as author_name, u.full_name as user_name, u.avatar_url as author_avatar,
                   p.full_name as parent_author
            FROM notes n
            LEFT JOIN users u ON n.user_id = u.id
            LEFT JOIN notes np ON n.parent_id = np.id
            LEFT JOIN users p ON np.user_id = p.id
            WHERE n.tenant_id=? AND n.entity_type=? AND n.entity_id=? AND n.parent_id IS NULL $salesFilter
            ORDER BY n.is_pinned DESC, n.created_at DESC
        ");
        $stmt->execute($mainParams);
        $notes = $stmt->fetchAll();

        // Fetch replies for all these notes in a single query
        if (!empty($notes)) {
            $noteIds = array_column($notes, 'id');
            $in = str_repeat('?,', count($noteIds) - 1) . '?';
            
            $replySalesFilter = "";
            $replyParams = array_merge([$auth['tenant_id']], $noteIds);
            if ($auth['role'] === 'sales') {
                $replySalesFilter = " AND (n.user_id = ? OR u.role != 'sales' OR u.role IS NULL)";
                $replyParams[] = $auth['user_id'];
            }

            $repliesStmt = $this->db->prepare("
                SELECT n.*, u.full_name as author_name, u.full_name as user_name, u.avatar_url as author_avatar
                FROM notes n LEFT JOIN users u ON n.user_id=u.id
                WHERE n.tenant_id=? AND n.parent_id IN ($in) $replySalesFilter ORDER BY n.created_at ASC
            ");
            $repliesStmt->execute($replyParams);
            $allReplies = $repliesStmt->fetchAll();

            $repliesByParent = [];
            foreach ($allReplies as $reply) {
                $repliesByParent[$reply['parent_id']][] = $reply;
            }

            foreach ($notes as &$note) {
                $note['replies'] = $repliesByParent[$note['id']] ?? [];
            }
        }
        respond(200, $notes);
    }

    public function store(array $auth, string $type, int $entityId): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền tạo ghi chú', false);
        if (!$this->checkEntityAccess($auth, $type, $entityId)) {
            respond(403, null, 'Bạn không có quyền thêm ghi chú cho mục này', false);
        }

        $b = getBody();
        if (empty($b['body'])) respond(422, null, 'Nội dung ghi chú là bắt buộc', false);

        // Defensive/Self-healing intercept: If body starts with [Chuyển trạng thái Pipeline], save it to activities instead!
        if (str_starts_with(trim($b['body']), '[Chuyển trạng thái Pipeline]')) {
            $bodyText = trim($b['body']);
            $subject = "Chuyển trạng thái Pipeline";
            $content = $bodyText;

            if (preg_match('/\[Chuyển trạng thái Pipeline\]\s*→\s*([^:]+):\s*(.*)/u', $bodyText, $matches)) {
                $subject = "Chuyển trạng thái Pipeline → " . trim($matches[1]);
                $content = trim($matches[2]);
            } else if (preg_match('/\[Chuyển trạng thái Pipeline\]\s*→\s*(.*)/u', $bodyText, $matches)) {
                $subject = "Chuyển trạng thái Pipeline → " . trim($matches[1]);
                $content = "";
            }

            $stmtAct = $this->db->prepare("
                INSERT INTO activities (tenant_id, user_id, created_by, type, subject, body, status, priority, due_date, done_at, related_type, related_id, contact_id)
                VALUES (?, ?, ?, 'note', ?, ?, 'done', 'medium', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), ?, ?, ?)
            ");
            $stmtAct->execute([
                $auth['tenant_id'],
                $auth['user_id'],
                $auth['user_id'],
                $subject,
                $content ? $content : null,
                $type,
                $entityId,
                $type === 'contact' ? $entityId : null
            ]);

            // Update contact last_contact
            if ($type === 'contact') {
                $stmtStatus = $this->db->prepare("SELECT pipeline_status FROM contacts WHERE id = ?");
                $stmtStatus->execute([$entityId]);
                $currStatus = $stmtStatus->fetchColumn() ?: 'chua_xac_dinh';
                $securityExpires = $this->getSecurityExpiration($currStatus);
                $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE, security_expires_at = ? WHERE id = ?")
                     ->execute([$securityExpires, $entityId]);
            }

            respond(201, ['id' => (int)$this->db->lastInsertId(), 'message' => 'Transition logged as activity instead of internal note']);
        }
        
        $this->db->prepare("
            INSERT INTO notes (
                tenant_id, user_id, entity_type, entity_id, body, type, parent_id, is_pinned, attachment_url,
                channel, note_type, duration_minutes, client_feedback, stuck_tag, suggested_temperature, sale_temperature, documents_sent, is_heritage
            )
            VALUES (?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?)
        ")->execute([
            $auth['tenant_id'], $auth['user_id'], $type, $entityId,
            $b['body'], $b['type'] ?? 'internal',
            $b['parent_id'] ?? null, $b['is_pinned'] ?? 0,
            $b['attachment_url'] ?? null,
            $b['channel'] ?? null,
            $b['note_type'] ?? 'regular',
            (int)($b['duration_minutes'] ?? 0),
            $b['client_feedback'] ?? null,
            $b['stuck_tag'] ?? null,
            $b['suggested_temperature'] ?? null,
            $b['sale_temperature'] ?? null,
            $b['documents_sent'] ?? null,
            (int)($b['is_heritage'] ?? 0)
        ]);
        $id = (int)$this->db->lastInsertId();

        // Maintain quyen_truy_cap audit log for Cooperation Slips
        if ($type === 'contact') {
            // Get current pipeline status to resolve setting-based security timer duration dynamically
            $stmtStatus = $this->db->prepare("SELECT pipeline_status FROM contacts WHERE id = ?");
            $stmtStatus->execute([$entityId]);
            $currStatus = $stmtStatus->fetchColumn() ?: 'chua_xac_dinh';
            $securityExpires = $this->getSecurityExpiration($currStatus);

            $updateSql = "UPDATE contacts SET last_contact = CURRENT_DATE, security_expires_at = ?";
            $updateParams = [$securityExpires];
            if (!empty($b['sale_temperature'])) {
                $updateSql .= ", temperature = ?";
                $updateParams[] = $b['sale_temperature'];
            }
            if (!empty($b['suggested_temperature'])) {
                $updateSql .= ", suggested_temperature = ?";
                $updateParams[] = $b['suggested_temperature'];
            }
            $updateSql .= " WHERE id = ? AND tenant_id = ?";
            $updateParams[] = $entityId;
            $updateParams[] = $auth['tenant_id'];

            $this->db->prepare($updateSql)->execute($updateParams);

            $stmtOwner = $this->db->prepare("SELECT owner_id FROM contacts WHERE id = ?");
            $stmtOwner->execute([$entityId]);
            $ownerId = $stmtOwner->fetchColumn();
            if ($ownerId && $ownerId != $auth['user_id']) {
                $stmtCheck = $this->db->prepare("SELECT id FROM quyen_truy_cap WHERE contact_id = ? AND user_id = ?");
                $stmtCheck->execute([$entityId, $auth['user_id']]);
                if (!$stmtCheck->fetch()) {
                    $stmtInsQ = $this->db->prepare("INSERT INTO quyen_truy_cap (contact_id, user_id, invited_by) VALUES (?, ?, ?)");
                    $stmtInsQ->execute([$entityId, $auth['user_id'], $ownerId]);
                }
            }
        }

        // 1. Extract mentions from body text (@Full_Name_With_Underscores)
        $mentions = $b['mentions'] ?? [];
        if (empty($mentions)) {
            preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()]+)/u', $b['body'], $matches);
            if (!empty($matches[1])) {
                foreach ($matches[1] as $nameWithUnderscores) {
                    $fullName = str_replace('_', ' ', $nameWithUnderscores);
                    $stmt = $this->db->prepare("SELECT id FROM users WHERE tenant_id=? AND full_name=?");
                    $stmt->execute([$auth['tenant_id'], $fullName]);
                    $uid = $stmt->fetchColumn();
                    if ($uid) $mentions[] = (int)$uid;
                }
            }
        }
        $mentions = array_unique($mentions);
        // Exclude self-mention
        $mentions = array_filter($mentions, function($uid) use ($auth) {
            return (int)$uid !== (int)$auth['user_id'];
        });

        // 2. Process mentions
        if (!empty($mentions)) {
            require_once __DIR__ . '/../mailer.php';
            $ins = $this->db->prepare("INSERT IGNORE INTO note_mentions (note_id, user_id) VALUES (?,?)");
            $notif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?,?,?,?,?,?)");
            $stmtUser = $this->db->prepare("SELECT email, full_name FROM users WHERE id = ?");
            
            foreach ($mentions as $uid) {
                $uid = (int)$uid;
                $ins->execute([$id, $uid]);
                
                $notif->execute([
                    $uid, $auth['tenant_id'], 
                    'Bạn được nhắc tên', 
                    $auth['full_name'] . ' đã nhắc tên bạn trong một ghi chú.',
                    'mention', 
                    "/notes/{$id}"
                ]);

                // Send email notification
                $stmtUser->execute([$uid]);
                $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                if ($userRow && !empty($userRow['email'])) {
                    $emailSubject = "[RICH LAND] Bạn được nhắc tên trong ghi chú của " . $auth['full_name'];
                    $emailTitle = "NHẮC TÊN TRÊN HỆ THỐNG";
                    $emailContent = "Chào <strong>" . htmlspecialchars($userRow['full_name']) . "</strong>,<br/><br/>" .
                                    "Bạn đã được nhắc tên bởi <strong>" . htmlspecialchars($auth['full_name']) . "</strong> trong một ghi chú.<br/>" .
                                    "Nội dung:<br/>" .
                                    "<blockquote style='border-left: 4px solid #eab308; padding-left: 12px; margin: 12px 0; color: #475569;'>" . nl2br(htmlspecialchars($b['body'])) . "</blockquote>" .
                                    "Vui lòng truy cập hệ thống để biết thêm chi tiết.";
                    sendEmailNotification($userRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
                }
            }
        }
        respond(201, ['id' => $id], 'Đã thêm ghi chú');
    }

    public function update(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật ghi chú', false);
        $b = getBody();
        if (empty($b['body'])) respond(422, null, 'Nội dung là bắt buộc', false);

        $stmt = $this->db->prepare("SELECT * FROM notes WHERE id = ? AND tenant_id = ? FOR UPDATE");
        $stmt->execute([$id, $auth['tenant_id']]);
        $oldNote = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$oldNote) respond(404, null, 'Không tìm thấy ghi chú', false);

        if (!in_array($auth['role'], ['admin', 'manager', 'superadmin', 'super_admin', 'director'], true) && (int)$oldNote['user_id'] !== (int)$auth['user_id']) {
            respond(403, null, 'Bạn không có quyền cập nhật ghi chú này', false);
        }

        $history = json_decode($oldNote['edit_history'] ?? '[]', true);
        if (!is_array($history)) {
            $history = [];
        }

        $editRecord = [
            'edited_by' => $auth['user_id'],
            'edited_by_name' => $auth['username'] ?? ($auth['full_name'] ?? 'User'),
            'edited_at' => date('Y-m-d H:i:s'),
            'old_body' => $oldNote['body']
        ];
        array_unshift($history, $editRecord);
        $history = array_slice($history, 0, 3);

        $this->db->prepare("UPDATE notes SET body=?, is_pinned=?, edit_history=?, updated_at=NOW() WHERE id=? AND tenant_id=?")
            ->execute([$b['body'], $b['is_pinned'] ?? 0, json_encode($history), $id, $auth['tenant_id']]);

        if ($oldNote && $oldNote['entity_type'] === 'contact') {
            $cid = (int)$oldNote['entity_id'];
            $stmtStatus = $this->db->prepare("SELECT pipeline_status FROM contacts WHERE id = ?");
            $stmtStatus->execute([$cid]);
            $currStatus = $stmtStatus->fetchColumn() ?: 'chua_xac_dinh';
            $securityExpires = $this->getSecurityExpiration($currStatus);

            $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE, security_expires_at = ? WHERE id = ? AND tenant_id = ?")
                 ->execute([$securityExpires, $cid, $auth['tenant_id']]);
        }

        respond(200, null, 'Đã cập nhật ghi chú');
    }

    public function destroy(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xóa ghi chú', false);
        // 1. Verify existence and permission
        $check = $this->db->prepare("SELECT entity_type, entity_id FROM notes WHERE id=? AND tenant_id=?" . (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true) ? " AND user_id=?" : ""));
        $cp = [$id, $auth['tenant_id']];
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) $cp[] = $auth['user_id'];
        $check->execute($cp);
        $noteRow = $check->fetch(PDO::FETCH_ASSOC);
        if (!$noteRow) respond(404, null, 'Không tìm thấy ghi chú hoặc không có quyền', false);

        $this->db->beginTransaction();
        try {
            // 2. Delete the note
            $this->db->prepare("DELETE FROM notes WHERE id=?")->execute([$id]);
            
            // 3. Delete associated notifications
            $this->db->prepare("DELETE FROM notifications WHERE tenant_id=? AND link LIKE ?")
                 ->execute([$auth['tenant_id'], "%/notes/$id%"]);

            // Recalculate contact's last_contact
            if ($noteRow && $noteRow['entity_type'] === 'contact') {
                $cid = (int)$noteRow['entity_id'];
                $stmtMax = $this->db->prepare("
                    SELECT MAX(max_date) FROM (
                        SELECT DATE(created_at) as max_date FROM notes WHERE entity_type = 'contact' AND entity_id = ?
                        UNION
                        SELECT DATE(created_at) as max_date FROM activities WHERE related_type = 'contact' AND related_id = ? AND deleted_at IS NULL
                    ) t
                ");
                $stmtMax->execute([$cid, $cid]);
                $maxDate = $stmtMax->fetchColumn();

                $stmtStatus = $this->db->prepare("SELECT pipeline_status FROM contacts WHERE id = ?");
                $stmtStatus->execute([$cid]);
                $currStatus = $stmtStatus->fetchColumn() ?: 'chua_xac_dinh';
                $securityExpires = $maxDate ? $this->getSecurityExpiration($currStatus, $maxDate) : null;

                $stmtUpdate = $this->db->prepare("UPDATE contacts SET last_contact = ?, security_expires_at = ? WHERE id = ? AND tenant_id = ?");
                $stmtUpdate->execute([$maxDate ?: null, $securityExpires, $cid, $auth['tenant_id']]);
            }

            $this->db->commit();
            respond(200, null, 'Đã xóa ghi chú và các thông báo liên quan');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    public function show(array $auth, int $id): void {
        $stmt = $this->db->prepare("SELECT * FROM notes WHERE id=? AND tenant_id=? LIMIT 1");
        $stmt->execute([$id, $auth['tenant_id']]);
        $note = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$note) respond(404, null, 'Ghi chú không tồn tại', false);
        respond(200, $note, 'Lấy chi tiết ghi chú thành công');
    }

    private function getSecurityExpiration(string $status, ?string $baseDate = null): ?string {
        $key = 'security_timer_' . $status;
        $fallback = [
            'chua_xac_dinh' => '+3 hours',
            'quan_tam' => '+1 day',
            'thien_chi' => '+3 days',
            'dong_y_gap' => '+4 days',
            'da_gap' => '+5 days',
            'booking' => '+3 months',
        ];
        if (!isset($fallback[$status])) {
            return null;
        }
        $stmt = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        $duration = ($val !== false && $val !== null && $val !== '') ? $val : $fallback[$status];
        
        $baseTimestamp = $baseDate ? strtotime($baseDate) : time();
        return date('Y-m-d H:i:s', strtotime($duration, $baseTimestamp));
    }
}
