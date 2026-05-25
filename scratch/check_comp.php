<?php
require_once '../backend/db_connect.php';

echo "--- CHECKING FOR LÊ ĐINH Ý NHI (ID: 1003) ---\n";

// 1. Check all distribution_logs with status = 'compensation'
$res = $conn->query("SELECT * FROM distribution_logs WHERE assigned_to = 1003");
echo "Distribution logs count: " . $res->num_rows . "\n";
while ($row = $res->fetch_assoc()) {
    echo "  - ID: {$row['id']}, status: {$row['status']}, received_at: {$row['received_at']}, lead_id: {$row['lead_id']}\n";
}

// 2. Check admin_logs for BLOCK_LEAD_BLACKLIST
$res2 = $conn->query("SELECT * FROM admin_logs WHERE action = 'BLOCK_LEAD_BLACKLIST'");
echo "BLOCK_LEAD_BLACKLIST logs count: " . $res2->num_rows . "\n";
while ($row = $res2->fetch_assoc()) {
    echo "  - ID: {$row['id']}, created_at: {$row['created_at']}, details: {$row['details']}\n";
}

// 3. Check data_reports (tickets)
$res3 = $conn->query("SELECT * FROM data_reports WHERE consultant_id = 1003");
echo "Data reports (tickets) count: " . $res3->num_rows . "\n";
while ($row = $res3->fetch_assoc()) {
    echo "  - ID: {$row['id']}, status: {$row['status']}, created_at: {$row['created_at']}, resolved_at: {$row['resolved_at']}\n";
}

// 4. Check active_compensation_logs
$res4 = $conn->query("SELECT * FROM active_compensation_logs");
echo "Active compensation logs count: " . $res4->num_rows . "\n";
while ($row = $res4->fetch_assoc()) {
    echo "  - ID: {$row['id']}, consultant_id: {$row['consultant_id']}, amount: {$row['amount']}, reason: {$row['reason']}, created_at: {$row['created_at']}\n";
}
