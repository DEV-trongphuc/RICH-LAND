<?php
require_once 'env.php';
require_once 'db_connect.php';

$queries = [
    "ALTER TABLE leads ADD INDEX idx_phone (phone);",
    "ALTER TABLE leads ADD INDEX idx_email (email);",
    "ALTER TABLE distribution_logs ADD INDEX idx_received_at (received_at);",
    "ALTER TABLE distribution_logs ADD INDEX idx_status (status);",
    "ALTER TABLE distribution_logs ADD INDEX idx_round_id (round_id);",
    "ALTER TABLE distribution_logs ADD INDEX idx_assigned_to (assigned_to);"
];

foreach ($queries as $q) {
    if ($conn->query($q)) {
        echo "Success: $q\n";
    } else {
        echo "Failed (or already exists): $q - Error: " . $conn->error . "\n";
    }
}
?>
