<?php
// check_db.php
// Diagnostic script to read the state of connections, leads, and logs

require_once __DIR__ . '/db_connect.php';

header('Content-Type: text/plain; charset=UTF-8');

echo "=== CONNECTIONS ===\n";
$res = $conn->query("SELECT id, sheet_name, spreadsheet_id, connection_type, is_active, require_both_contact, is_silent FROM sheet_connections");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}

echo "\n=== MAPPINGS ===\n";
$res = $conn->query("SELECT * FROM field_mappings");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}

echo "\n=== SYNCED RECORDS COUNT ===\n";
$res = $conn->query("SELECT connection_id, COUNT(*) as cnt FROM sheet_sync_records GROUP BY connection_id");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}

echo "\n=== LATEST LEADS ===\n";
$res = $conn->query("SELECT id, phone, email, name, connection_id, assigned_to, created_at FROM leads ORDER BY id DESC LIMIT 10");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}

echo "\n=== LATEST DISTRIBUTION LOGS ===\n";
$res = $conn->query("SELECT * FROM distribution_logs ORDER BY id DESC LIMIT 10");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
?>
