<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

echo "=== ROUNDS ===\n";
$res = $conn->query("SELECT id, round_name FROM distribution_rounds");
while ($row = $res->fetch_assoc()) {
    echo "ID: " . $row['id'] . " | Name: " . $row['round_name'] . "\n";
}

echo "\n=== AI SCREENER SETTINGS ===\n";
$res = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'ai_screener%'");
while ($row = $res->fetch_assoc()) {
    echo $row['setting_key'] . ": " . $row['setting_value'] . "\n";
}
