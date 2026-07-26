<?php
// backend/test_counts.php
require_once __DIR__ . '/test_bootstrap.php';

// Mock decodedUser for test session
$decodedUser = [
    'user_id' => 1003, // admin id from HAR
    'id' => 1003,
    'role' => 'admin',
    'tenant_id' => 1,
    'email' => 'turniodev@gmail.com'
];

// Replicate api.php logic for action=get_all_pending_counts
try {
    echo "=== RUNNING GET_ALL_PENDING_COUNTS TEST ===\n";
    
    $role = $decodedUser['role'] ?? '';
    $tenantId = (int)($decodedUser['tenant_id'] ?? 1);
    $userId = (int)($decodedUser['user_id'] ?? $decodedUser['id'] ?? 0);

    $ticketsCount = 0;
    $heldCount = 0;
    $checkinsCount = 0;
    $coopsCount = 0;
    $supportCount = 0;
    $expensesCount = 0;
    $salesPendingSignCount = 0;

    $isAdminOrManager = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'manager'], true);

    if ($isAdminOrManager) {
        // 1. Tickets (Reports) count
        $isManager = ($role === 'manager');
        $managedConsultantIds = [];
        if ($isManager) {
            $stmtM = $conn->prepare("SELECT id FROM consultants WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)");
            $stmtM->bind_param("i", $userId);
            $stmtM->execute();
            $resM = $stmtM->get_result();
            while ($rowM = $resM->fetch_assoc()) {
                $managedConsultantIds[] = (int)$rowM['id'];
            }
            $stmtM->close();
        }

        if (!$isManager || !empty($managedConsultantIds)) {
            $sqlRep = "SELECT COUNT(*) FROM data_reports r WHERE r.status = 'pending'";
            if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($managedConsultantIds), '?'));
                $sqlRep .= " AND r.consultant_id IN ($placeholders)";
            }
            $stmtRep = $conn->prepare($sqlRep);
            if ($isManager) {
                $stmtRep->bind_param(str_repeat("i", count($managedConsultantIds)), ...$managedConsultantIds);
            }
            $stmtRep->execute();
            $ticketsCount = (int)($stmtRep->get_result()->fetch_row()[0] ?? 0);
            $stmtRep->close();
        }

        // 2. Held Leads count
        $isDirector = ($role === 'director');
        $isProjManager = false;
        $projIds = [];
        if ($isManager) {
            $pRes = $conn->query("SELECT id, manager_ids FROM projects");
            if ($pRes) {
                while ($pRow = $pRes->fetch_assoc()) {
                    if (!empty($pRow['manager_ids'])) {
                        $mIds = array_filter(array_map('intval', explode(',', $pRow['manager_ids'])));
                        if (in_array($userId, $mIds, true)) {
                            $projIds[] = (int)$pRow['id'];
                            $isProjManager = true;
                        }
                    }
                }
            }
        }

        $campIds = [];
        if ($isProjManager && !empty($projIds)) {
            $projIdsStr = implode(',', $projIds);
            $cRes = $conn->query("SELECT id FROM marketing_campaigns WHERE project_id IN ($projIdsStr)");
            if ($cRes) {
                while ($cRow = $cRes->fetch_assoc()) {
                    $campIds[] = (int)$cRow['id'];
                }
            }
        }

        $sqlHeld = "
            SELECT COUNT(*) 
            FROM leads l
            WHERE l.status = 'pending_approval' 
              AND NOT ( (l.ai_screener_status = 'pending' OR (l.ai_screener_status = 'error' AND l.ai_attempts < 3)) AND l.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) )
        ";
        if ($isProjManager) {
            if (!empty($campIds)) {
                $sqlHeld .= " AND l.campaign_id IN (" . implode(',', $campIds) . ")";
            } else {
                $sqlHeld .= " AND 1=0";
            }
        }
        $stmtHeld = $conn->prepare($sqlHeld);
        $stmtHeld->execute();
        $heldCount = (int)($stmtHeld->get_result()->fetch_row()[0] ?? 0);
        $stmtHeld->close();

        // 3. Check-ins count
        $sqlCheck = "
            SELECT COUNT(*) 
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE u.tenant_id = ? AND c.status = 'pending_approval'
        ";
        if ($role === 'manager') {
            $sqlCheck .= " AND (u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))) OR (u.team_id IS NOT NULL AND u.team_id = (SELECT team_id FROM users WHERE id = ?)))";
        }
        $stmtCheck = $conn->prepare($sqlCheck);
        if ($role === 'manager') {
            $stmtCheck->bind_param("iiii", $tenantId, $userId, $userId, $userId);
        } else {
            $stmtCheck->bind_param("i", $tenantId);
        }
        $stmtCheck->execute();
        $checkinsCount = (int)($stmtCheck->get_result()->fetch_row()[0] ?? 0);
        $stmtCheck->close();

        // 4. Cooperation slips count
        $sqlCoop = "
            SELECT cs.status, cs.adjustment_request_user_id, cs.shares_json, cs.created_by
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            WHERE c.tenant_id = ?
        ";
        if (!function_exists('getModulePermissionScope')) {
            function getModulePermissionScope($conn, $user, $mod, $act) {
                return 'all';
            }
        }
        $scope = getModulePermissionScope($conn, $decodedUser, 'cooperation', 'read');
        if ($scope === 'team') {
            $sqlCoop .= " AND (
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
        } else if ($scope === 'own') {
            $sqlCoop .= " AND (
                (cs.shares_json IS NOT NULL AND JSON_VALID(cs.shares_json) AND JSON_CONTAINS(JSON_KEYS(cs.shares_json), JSON_QUOTE(CAST(? AS CHAR))))
                OR cs.created_by = ?
            )";
        } else if ($scope !== 'all') {
            $sqlCoop .= ' AND 1=0';
        }

        $stmtCoop = $conn->prepare($sqlCoop);
        if ($scope === 'team') {
            $stmtCoop->bind_param("iiii", $tenantId, $userId, $userId, $userId);
        } else if ($scope === 'own') {
            $stmtCoop->bind_param("iii", $tenantId, $userId, $userId);
        } else {
            $stmtCoop->bind_param("i", $tenantId);
        }
        $stmtCoop->execute();
        $resCoop = $stmtCoop->get_result();
        while ($rowCoop = $resCoop->fetch_assoc()) {
            $csStatus = $rowCoop['status'] ?? '';
            $csAdjUid = isset($rowCoop['adjustment_request_user_id']) ? (int)$rowCoop['adjustment_request_user_id'] : 0;
            if ($csStatus === 'pending_manager_approval' || ($csStatus === 'approved' && $csAdjUid > 0)) {
                $coopsCount++;
            }
        }
        $stmtCoop->close();

        // 5. Support tickets count
        $isSupportRole = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        if ($isSupportRole) {
            $stmtC = $conn->prepare("SELECT COUNT(*) FROM tickets WHERE tenant_id = ? AND status = 'open'");
            $stmtC->bind_param("i", $tenantId);
            $stmtC->execute();
            $supportCount = (int)($stmtC->get_result()->fetch_row()[0] ?? 0);
            $stmtC->close();
        }

        // 6. Expenses count
        $sqlExp = "SELECT COUNT(*) FROM expenses e WHERE e.tenant_id = ? AND e.status = 'pending' AND e.deleted_at IS NULL";
        if ($role === 'manager') {
            $userIds = [$userId];
            $stmtTeam = $conn->prepare("SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)");
            $stmtTeam->bind_param("i", $userId);
            $stmtTeam->execute();
            $resTeam = $stmtTeam->get_result();
            while ($rowTeam = $resTeam->fetch_assoc()) {
                $userIds[] = (int)$rowTeam['id'];
            }
            $stmtTeam->close();

            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sqlExp .= " AND e.created_by IN ($placeholders)";
            
            $stmtExp = $conn->prepare($sqlExp);
            $stmtExp->bind_param(str_repeat("i", 1 + count($userIds)), $tenantId, ...$userIds);
        } else {
            $stmtExp = $conn->prepare($sqlExp);
            $stmtExp->bind_param("i", $tenantId);
        }
        $stmtExp->execute();
        $expensesCount = (int)($stmtExp->get_result()->fetch_row()[0] ?? 0);
        $stmtExp->close();
    }

    // 7. For Sales Pending signatures:
    $salesCoopStmt = $conn->prepare("
        SELECT cs.shares_json, cs.signatures_json 
        FROM cooperation_slips cs
        JOIN contacts c ON cs.contact_id = c.id
        WHERE c.tenant_id = ? 
          AND cs.status IN ('pending_signatures', 'approved_pending_signatures')
    ");
    $salesCoopStmt->bind_param("i", $tenantId);
    $salesCoopStmt->execute();
    $salesCoopRes = $salesCoopStmt->get_result();
    while ($salesCoopRow = $salesCoopRes->fetch_assoc()) {
        $shares = json_decode($salesCoopRow['shares_json'] ?? '[]', true) ?: [];
        $sigs = json_decode($salesCoopRow['signatures_json'] ?? '[]', true) ?: [];
        if (isset($shares[$userId]) && !isset($sigs[$userId])) {
            $salesPendingSignCount++;
        }
    }
    $salesCoopStmt->close();

    $result = [
        'ticketsCount' => $ticketsCount,
        'heldCount' => $heldCount,
        'checkinsCount' => $checkinsCount,
        'coopsCount' => $coopsCount,
        'supportCount' => $supportCount,
        'expensesCount' => $expensesCount,
        'salesPendingSignCount' => $salesPendingSignCount
    ];
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    echo "=== TEST PASSED SUCCESSFULLY ===\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
