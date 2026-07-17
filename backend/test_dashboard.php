<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

// Simulate the manager user 1007
$decodedUser = [
    'id' => 1007,
    'user_id' => 1007,
    'email' => 'manager@richland.net',
    'role' => 'manager'
];

$userId = (int)($decodedUser['user_id'] ?? $decodedUser['id'] ?? 0);
$userRole = $decodedUser['role'] ?? '';
$isManager = ($userRole === 'manager');

echo "UserID: $userId, Role: $userRole\n";

try {
    $mgrTeamRes = $conn->query("SELECT id FROM teams WHERE leader_id = " . (int)$decodedUser['user_id']);
    if (!$mgrTeamRes) {
        throw new Exception($conn->error);
    }
    $mgrTeamIds = [];
    while ($tr = $mgrTeamRes->fetch_assoc()) {
        $mgrTeamIds[] = (int)$tr['id'];
    }
    echo "Team IDs: " . implode(',', $mgrTeamIds) . "\n";

    $managerUserIds = [];
    if (!empty($mgrTeamIds)) {
        $mgrUserRes = $conn->query("SELECT id FROM users WHERE team_id IN (" . implode(',', $mgrTeamIds) . ")");
        if (!$mgrUserRes) {
            throw new Exception($conn->error);
        }
        while ($ur = $mgrUserRes->fetch_assoc()) {
            $managerUserIds[] = (int)$ur['id'];
        }
    }
    $managerUserIds[] = (int)$decodedUser['user_id'];
    $idsList = implode(',', $managerUserIds);
    echo "IDs List: $idsList\n";

    $consultantFilter = " AND (email IN (SELECT email FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = " . (int)$decodedUser['user_id'] . ")) OR email = '" . $conn->real_escape_string($decodedUser['email']) . "')";
    
    $sql = "SELECT id FROM consultants WHERE status = 'active' $consultantFilter";
    echo "Consultants SQL: $sql\n";
    $res = $conn->query($sql);
    if (!$res) {
        throw new Exception($conn->error);
    }
    echo "Consultants query succeeded. Count: " . $res->num_rows . "\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
