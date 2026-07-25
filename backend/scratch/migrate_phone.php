<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../test_bootstrap.php';

echo "=== DATABASE MIGRATION: ADDING phone TO consultants ===\n\n";

$res = $conn->query("SHOW COLUMNS FROM consultants LIKE 'phone'");
if ($res && $res->num_rows > 0) {
    echo "Column 'phone' already exists in 'consultants'.\n";
} else {
    $alter = $conn->query("ALTER TABLE consultants ADD COLUMN phone VARCHAR(50) NULL AFTER email");
    if ($alter) {
        echo "✅ Successfully added column 'phone' to 'consultants'!\n";
    } else {
        echo "❌ Failed to add column: " . $conn->error . "\n";
    }
}
