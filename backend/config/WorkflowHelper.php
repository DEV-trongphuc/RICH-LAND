<?php
class WorkflowHelper {
    public static function triggerTasks(PDO $db, int $tenantId, int $contactId, int $stageId, int $userId): void {
        // Fetch contact owner to resolve team membership
        $stmtOwner = $db->prepare("SELECT owner_id FROM contacts WHERE id = ?");
        $stmtOwner->execute([$contactId]);
        $ownerId = $stmtOwner->fetchColumn();
        
        $teamId = null;
        if ($ownerId) {
            $stmtTeam = $db->prepare("SELECT team_id FROM users WHERE id = ?");
            $stmtTeam->execute([$ownerId]);
            $teamId = $stmtTeam->fetchColumn();
        }

        // Fetch active templates matching the target stage and the team
        $sql = "SELECT * FROM workflow_task_templates 
                WHERE tenant_id = ? AND stage_id = ? AND is_active = 1 
                AND (team_id IS NULL OR team_id = ?)";
        $stmtTemplates = $db->prepare($sql);
        $stmtTemplates->execute([$tenantId, $stageId, $teamId]);
        $templates = $stmtTemplates->fetchAll(PDO::FETCH_ASSOC);

        if (empty($templates)) {
            return;
        }

        // Create tasks in activities table
        foreach ($templates as $tpl) {
            $dueDays = (int)$tpl['due_days_offset'];
            $dueDate = date('Y-m-d', strtotime("+$dueDays days"));

            $sqlInsert = "INSERT INTO activities (
                tenant_id, user_id, created_by, type, subject, body, status, priority, due_date, 
                related_type, related_id, require_approval, progress
            ) VALUES (?, ?, ?, 'task', ?, ?, 'planned', ?, ?, 'contact', ?, ?, 0)";
            
            $stmtInsert = $db->prepare($sqlInsert);
            $stmtInsert->execute([
                $tenantId,
                $ownerId ?: $userId, // assign to contact owner, default to trigger user
                $userId,
                $tpl['title'],
                $tpl['description'],
                $tpl['priority'],
                $dueDate,
                $contactId,
                $tpl['require_approval']
            ]);
        }
    }
}
