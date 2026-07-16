<?php
include __DIR__ . '/db_connect.php';

$res = $conn->query("SELECT * FROM activities WHERE id = 19751");
$row = $res->fetch_assoc();
if ($row) {
    echo "ID: " . $row['id'] . "\n";
    echo "contact_id: " . ($row['contact_id'] ?? 'NULL') . "\n";
    echo "related_type: " . ($row['related_type'] ?? 'NULL') . "\n";
    echo "related_id: " . ($row['related_id'] ?? 'NULL') . "\n";
    echo "subject: " . $row['subject'] . "\n";
} else {
    echo "Activity not found\n";
}
