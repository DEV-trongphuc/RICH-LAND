<?php
// backend/delete_lead_24.php
// Script to inspect and delete lead ID #24

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🗑️ DELETE LEAD ID #24 ('Khách hàng ẩn danh')\n";
echo "====================================================\n\n";

// 1. Check Lead #24
$res = $conn->query("SELECT * FROM leads WHERE id = 24");
if ($res && $row = $res->fetch_assoc()) {
    echo "Found Lead ID #24:\n";
    print_r($row);
    
    // Delete from distribution_logs
    $conn->query("DELETE FROM distribution_logs WHERE lead_id = 24");
    echo "Deleted " . $conn->affected_rows . " log records.\n";
    
    // Delete from leads
    $conn->query("DELETE FROM leads WHERE id = 24");
    echo "Deleted " . $conn->affected_rows . " lead record.\n";
    
    // Delete from contacts if matching
    if (!empty($row['phone'])) {
        $conn->query("DELETE FROM contacts WHERE phone = '" . $conn->real_escape_string($row['phone']) . "' AND (name LIKE '%Khách hàng ẩn danh%' OR name = '')");
        echo "Deleted " . $conn->affected_rows . " contact record.\n";
    }
    
    echo "\n✅ Successfully deleted Lead ID #24!\n";
} else {
    echo "Lead ID #24 not found or already deleted.\n";
}
