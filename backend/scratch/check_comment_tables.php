<?php
require_once __DIR__ . '/../db_connect.php';

try {
    $stmt = $conn->query("SELECT id, subject, user_id, created_by, related_type, related_id, tags, body, participant_ids FROM activities WHERE subject LIKE '%HG-18%' LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        foreach ($row as $k => $v) {
            echo "$k: $v\n";
        }
    } else {
        echo "No activity found with HG-18\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
