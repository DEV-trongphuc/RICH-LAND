<?php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=utf-8");

echo "=== RECENT ADMIN LOGS ===\n";
$res = $conn->query("SELECT * FROM admin_logs ORDER BY id DESC LIMIT 15");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    }
}

echo "\n=== RECENT DISTRIBUTION LOGS ===\n";
$res = $conn->query("SELECT * FROM distribution_logs ORDER BY id DESC LIMIT 15");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    }
}

echo "\n=== ROUTING RULES ===\n";
$res = $conn->query("SELECT * FROM routing_rules ORDER BY priority ASC");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    }
}

echo "\n=== SHEET INTEGRATION CONNECTIONS ===\n";
$res = $conn->query("SELECT * FROM sheet_connections");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    }
}
