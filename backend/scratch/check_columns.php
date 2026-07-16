<?php
require_once __DIR__ . '/db_connect.php';

$res = $conn->query("SHOW COLUMNS FROM contacts");
echo "=== Active Columns of 'contacts' Table ===\n";
while ($row = $res->fetch_assoc()) {
    echo "  Field: {$row['Field']} | Type: {$row['Type']} | Null: {$row['Null']} | Key: {$row['Key']}\n";
}
