<?php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=utf-8");

echo "=== SEARCH LEADS WITH 'Nhap du lieu cu' IN NOTE ===\n";
$res = $conn->query("SELECT id, phone, email, name, source, type, note, created_at, connection_id FROM leads WHERE note LIKE '%Nhap du lieu%' LIMIT 10");
if ($res && $res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE) . "\n\n";
    }
} else {
    echo "No leads found.\n";
}

echo "\n=== SEARCH SHEET CONNECTIONS ===\n";
$resSC = $conn->query("SELECT id, sheet_name, spreadsheet_id, connection_type, is_silent, sync_mode FROM sheet_connections");
if ($resSC && $resSC->num_rows > 0) {
    while ($row = $resSC->fetch_assoc()) {
        echo json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
    }
}
?>
