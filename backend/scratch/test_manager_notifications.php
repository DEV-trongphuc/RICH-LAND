<?php
// backend/scratch/test_manager_notifications.php
require_once __DIR__ . '/../config.php';

// We need to use PDO because CheckInController uses PDO
// In backend/config.php, $conn is mysqli. Let's create a PDO connection.
try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage() . "\n");
}

echo "=== STARTING TEST: MANAGER NOTIFICATIONS ===\n";

$db->beginTransaction();
try {
    // 1. Get dynamic valid tenant_id
    $tenantId = (int)$db->query("SELECT id FROM tenants LIMIT 1")->fetchColumn();
    if (!$tenantId) {
        throw new Exception("No valid tenant found in the database. Please insert a tenant first.");
    }
    
    // Get max IDs to avoid unique key conflicts
    $maxUserId = (int)$db->query("SELECT MAX(id) FROM users")->fetchColumn() ?: 0;
    $maxTeamId = (int)$db->query("SELECT MAX(id) FROM teams")->fetchColumn() ?: 0;
    
    // Non-conflicting IDs
    $managerA = $maxUserId + 1;
    $managerB = $maxUserId + 2;
    $managerC = $maxUserId + 3;
    $saleA = $maxUserId + 4;
    $adminA = $maxUserId + 5;
    
    $teamAlpha = $maxTeamId + 1;
    $teamBeta = $maxTeamId + 2;
    
    // 2. Create users (with team_id = NULL initially to avoid FK constraint issues)
    // Manager A: Leader of Team Alpha
    $db->prepare("INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, team_id, is_active, status) VALUES ($managerA, ?, 'manager.a@test.com', 'hash', 'Manager A', 'manager', NULL, 1, 'active')")
       ->execute([$tenantId]);
    // Manager B: Leader of Team Beta
    $db->prepare("INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, team_id, is_active, status) VALUES ($managerB, ?, 'manager.b@test.com', 'hash', 'Manager B', 'manager', NULL, 1, 'active')")
       ->execute([$tenantId]);
    // Manager C: Manager belonging to Team Alpha (but not the leader)
    $db->prepare("INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, team_id, is_active, status) VALUES ($managerC, ?, 'manager.c@test.com', 'hash', 'Manager C', 'manager', NULL, 1, 'active')")
       ->execute([$tenantId]);
    // Sale A: Belongs to Team Alpha
    $db->prepare("INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, team_id, is_active, status) VALUES ($saleA, ?, 'sale.a@test.com', 'hash', 'Sale A', 'sale', NULL, 1, 'active')")
       ->execute([$tenantId]);
    // Admin A: Tenant Admin
    $db->prepare("INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, team_id, is_active, status) VALUES ($adminA, ?, 'admin.a@test.com', 'hash', 'Admin A', 'admin', NULL, 1, 'active')")
       ->execute([$tenantId]);

    // 3. Create teams
    $db->exec("INSERT INTO teams (id, name, tenant_id, leader_id) VALUES ($teamAlpha, 'Team Alpha', $tenantId, $managerA)");
    $db->exec("INSERT INTO teams (id, name, tenant_id, leader_id) VALUES ($teamBeta, 'Team Beta', $tenantId, $managerB)");

    // 4. Link users to teams
    $db->exec("UPDATE users SET team_id = $teamAlpha WHERE id IN ($managerA, $managerC, $saleA)");
    $db->exec("UPDATE users SET team_id = $teamBeta WHERE id = $managerB");

    echo "Mock users and teams created successfully with Tenant ID $tenantId.\n";

    // 4. Simulate a late check-in for Sale A
    $auth = [
        'user_id' => $saleA,
        'tenant_id' => $tenantId,
        'role' => 'sale',
        'full_name' => 'Sale A'
    ];
    $currentTime = '09:00:00';
    $reason = 'test late checkin';
    $newId = 12345; // dummy checkin ID

    // Find all managers/admins/superadmins that should be notified
    $stmtAdmins = $db->prepare("
        SELECT id, full_name, role FROM users 
        WHERE tenant_id = ? 
          AND (
            role IN ('admin', 'superadmin', 'super_admin', 'director', 'assistant')
            OR (
              role = 'manager' 
              AND (
                id IN (SELECT leader_id FROM teams WHERE id = ?)
                OR team_id = ?
              )
            )
          )
    ");
    $stmtAdmins->execute([$tenantId, $teamAlpha, $teamAlpha]);
    $adminsToNotify = $stmtAdmins->fetchAll();

    echo "Users notified:\n";
    $notifiedIds = [];
    foreach ($adminsToNotify as $adm) {
        echo " - ID: {$adm['id']} | Name: {$adm['full_name']} | Role: {$adm['role']}\n";
        $notifiedIds[] = (int)$adm['id'];
    }

    // 5. Assertions
    $errors = [];
    // Manager A must be notified
    if (!in_array($managerA, $notifiedIds, true)) {
        $errors[] = "Error: Manager A (Leader of Team Alpha) was NOT notified!";
    } else {
        echo "OK: Manager A (Leader of Team Alpha) was correctly notified.\n";
    }

    // Manager C must be notified (belongs to Team Alpha as manager)
    if (!in_array($managerC, $notifiedIds, true)) {
        $errors[] = "Error: Manager C (Manager in Team Alpha) was NOT notified!";
    } else {
        echo "OK: Manager C (Manager in Team Alpha) was correctly notified.\n";
    }

    // Admin A must be notified
    if (!in_array($adminA, $notifiedIds, true)) {
        $errors[] = "Error: Admin A (Admin) was NOT notified!";
    } else {
        echo "OK: Admin A (Admin) was correctly notified.\n";
    }

    // Manager B must NOT be notified (Leader of Team Beta)
    if (in_array($managerB, $notifiedIds, true)) {
        $errors[] = "Error: Manager B (Leader of Team Beta) was notified, but they don't manage Team Alpha!";
    } else {
        echo "OK: Manager B (Leader of Team Beta) was NOT notified.\n";
    }

    // 6. Test RLS for Manager C (does they see Sale A's checkin?)
    $stmtCheckInList = $db->prepare("
        SELECT COUNT(*) 
        FROM users u 
        WHERE u.tenant_id = ? 
          AND u.id = ? -- Sale A
          AND (
            u.id = ? 
            OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ?) 
            OR (u.team_id IS NOT NULL AND u.team_id = (SELECT team_id FROM users WHERE id = ?))
          )
    ");
    
    // Check for Manager C
    $stmtCheckInList->execute([$tenantId, $saleA, $managerC, $managerC, $managerC]);
    $countC = $stmtCheckInList->fetchColumn();
    if ($countC == 0) {
        $errors[] = "Error: Manager C cannot see checkins of Team Alpha members!";
    } else {
        echo "OK: Manager C has RLS access to see Team Alpha members' checkins.\n";
    }

    // Check for Manager B - should not see Sale A's checkin
    $stmtCheckInList->execute([$tenantId, $saleA, $managerB, $managerB, $managerB]);
    $countB = $stmtCheckInList->fetchColumn();
    if ($countB > 0) {
        $errors[] = "Error: Manager B has access to see Team Alpha members' checkins, but they shouldn't!";
    } else {
        echo "OK: Manager B correctly blocked from seeing Team Alpha members' checkins.\n";
    }

    if (empty($errors)) {
        echo "=== TEST RESULT: ALL TESTS PASSED! ===\n";
    } else {
        echo "=== TEST RESULT: FAILED ===\n";
        foreach ($errors as $err) {
            echo " - $err\n";
        }
    }

} catch (Exception $e) {
    echo "Exception occurred: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
} finally {
    // Rollback so we don't pollute the database!
    $db->rollBack();
    echo "Database changes rolled back cleanly.\n";
}
