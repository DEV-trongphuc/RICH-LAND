<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/../db_connect.php';

echo "=== distribution_logs ROWS ===\n";
$res = $conn->query("SELECT id, lead_id, status, received_at, assigned_to, message FROM distribution_logs");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "ERROR: " . $conn->error . "\n";
}

echo "\n=== leads ROWS ===\n";
$res2 = $conn->query("SELECT id, name, source, created_at FROM leads");
if ($res2) {
    while ($row = $res2->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "ERROR: " . $conn->error . "\n";
}
?>
