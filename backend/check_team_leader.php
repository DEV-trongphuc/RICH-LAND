<?php
require_once __DIR__ . '/db_connect.php';

echo "=== USER LIST ===\n";
$stmt = $db->query("SELECT id, username, full_name, role, team_id FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($users as $u) {
    echo "ID: {$u['id']} | Username: {$u['username']} | Name: {$u['full_name']} | Role: {$u['role']} | Team ID: {$u['team_id']}\n";
}

echo "\n=== TEAM LIST ===\n";
$stmtT = $db->query("SELECT id, name, leader_id, co_leader_ids FROM teams");
$teams = $stmtT->fetchAll(PDO::FETCH_ASSOC);
foreach ($teams as $t) {
    echo "ID: {$t['id']} | Name: {$t['name']} | Leader ID: {$t['leader_id']} | Co-Leaders: {$t['co_leader_ids']}\n";
}

echo "\n=== PROJECT ROSTER ===\n";
$stmtR = $db->query("SELECT project_id, user_id, role FROM project_roster");
$roster = $stmtR->fetchAll(PDO::FETCH_ASSOC);
foreach ($roster as $r) {
    echo "Proj ID: {$r['project_id']} | User ID: {$r['user_id']} | Role: {$r['role']}\n";
}
