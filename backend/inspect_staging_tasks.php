<?php
require_once __DIR__ . '/db_connect.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== STAGING TASKS DIAGNOSTIC ===\n";
echo "Team ID: 2\n";

// 1. Fetch team members of team 2
$stmt = $conn->prepare("SELECT id, full_name, role, team_id FROM users WHERE team_id = 2");
$stmt->execute();
$result = $stmt->get_result();
$members = $result->fetch_all(MYSQLI_ASSOC);
$stmt->close();

echo "Team Members:\n";
foreach ($members as $m) {
    echo "  - ID: " . $m['id'] . ", Name: " . $m['full_name'] . ", Role: " . $m['role'] . "\n";
}

// 2. Fetch tasks where user_id is in team 2 members OR related to team 2
$sql = "
    SELECT a.id, a.type, a.subject, a.status, a.priority, a.due_date, a.user_id, a.related_type, a.related_id, u.full_name as user_name
    FROM activities a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE (a.user_id IN (SELECT id FROM users WHERE team_id = 2) OR (a.related_type = 'team' AND a.related_id = 2))
    ORDER BY a.id DESC
";
$stmt = $conn->prepare($sql);
$stmt->execute();
$result = $stmt->get_result();
$tasks = $result->fetch_all(MYSQLI_ASSOC);
$stmt->close();

echo "\nTasks matching team filter:\n";
if (empty($tasks)) {
    echo "NO TASKS FOUND FOR TEAM 2\n";
} else {
    foreach ($tasks as $t) {
        echo "  - ID: " . $t['id'] . "\n";
        echo "    Subject: " . $t['subject'] . "\n";
        echo "    Type: " . $t['type'] . "\n";
        echo "    Status: " . $t['status'] . "\n";
        echo "    Priority: " . $t['priority'] . "\n";
        echo "    Due Date: " . $t['due_date'] . "\n";
        echo "    User ID: " . $t['user_id'] . " (Name: " . ($t['user_name'] ?? 'N/A') . ")\n";
        echo "    Related: " . $t['related_type'] . " (ID: " . $t['related_id'] . ")\n";
        echo "----------------------------------------\n";
    }
}
