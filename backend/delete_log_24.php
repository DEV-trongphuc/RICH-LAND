<?php
// backend/delete_log_24.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🗑️ DELETING INVALID DISTRIBUTION LOG ID #24\n";
echo "====================================================\n\n";

$conn->query("DELETE FROM distribution_logs WHERE id = 24 OR (lead_id IS NULL AND status = 'assigned')");
$affected = $conn->affected_rows;

echo "✅ Successfully deleted $affected invalid distribution_log record(s)!\n";
