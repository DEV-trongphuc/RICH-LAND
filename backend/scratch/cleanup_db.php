<?php
// backend/scratch/cleanup_db.php
require_once __DIR__ . '/../db_connect.php';

try {
    echo "=== REMOVING NON-DEMO USERS ===\n";
    $conn->query("SET FOREIGN_KEY_CHECKS = 0;");
    $conn->query("DELETE FROM users WHERE id IN (998, 1003, 1004)");
    $conn->query("SET FOREIGN_KEY_CHECKS = 1;");
    echo "Deleted superadmin, assistant, and viewer accounts.\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
