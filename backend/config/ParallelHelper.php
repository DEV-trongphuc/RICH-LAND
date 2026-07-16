<?php
// backend/config/ParallelHelper.php

class ParallelHelper {
    public static function lockPersonForWinningContact(PDO $db, int $contactId): void {
        // 1. Get contact details
        $stmt = $db->prepare("SELECT person_id, owner_id, tenant_id, first_name, last_name FROM contacts WHERE id = ?");
        $stmt->execute([$contactId]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact || !$contact['person_id']) {
            return;
        }

        $personId = (int)$contact['person_id'];
        $ownerId = (int)$contact['owner_id'];
        $tid = (int)$contact['tenant_id'];

        // 2. Lock the person (is_public = 0)
        $stmtUpPerson = $db->prepare("UPDATE persons SET is_public = 0 WHERE id = ?");
        $stmtUpPerson->execute([$personId]);

        // 3. Mark the winning contact as non-parallel
        $stmtUpWin = $db->prepare("UPDATE contacts SET parallel_assigned = 0 WHERE id = ?");
        $stmtUpWin->execute([$contactId]);

        // 4. Find other parallel contacts to terminate
        $stmtOthers = $db->prepare("SELECT id, owner_id FROM contacts WHERE person_id = ? AND id != ? AND deleted_at IS NULL");
        $stmtOthers->execute([$personId, $contactId]);
        $others = $stmtOthers->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($others)) {
            foreach ($others as $other) {
                $otherId = (int)$other['id'];
                $otherOwnerId = (int)$other['owner_id'];

                // Terminate the other contact
                $stmtDel = $db->prepare("UPDATE contacts SET deleted_at = NOW(), notes = NULL, parallel_assigned = 0 WHERE id = ?");
                $stmtDel->execute([$otherId]);

                // Clear other contact's notes and activities
                $stmtDelNotes = $db->prepare("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id = ?");
                $stmtDelNotes->execute([$otherId]);

                $stmtDelActs = $db->prepare("DELETE FROM activities WHERE related_type = 'contact' AND related_id = ?");
                $stmtDelActs->execute([$otherId]);

                // Update matching lead record and log in distribution_logs if lead exists
                $stmtCheckLead = $db->prepare("SELECT id FROM leads WHERE id = ?");
                $stmtCheckLead->execute([$otherId]);
                if ($stmtCheckLead->fetchColumn()) {
                    $stmtDelLead = $db->prepare("UPDATE leads SET assigned_to = NULL, status = 'parallel_terminated' WHERE id = ?");
                    $stmtDelLead->execute([$otherId]);

                    $stmtLog = $db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
                    $stmtLog->execute([$otherId, $otherOwnerId, null, 'parallel_terminated', 'Hệ thống tự động chấm dứt chăm sóc song song do tư vấn viên khác đã chốt cọc/hợp tác trước.']);
                }
            }
        }
    }
}
