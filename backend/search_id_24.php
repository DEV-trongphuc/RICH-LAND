<?php
// backend/search_id_24.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 SEARCHING FOR RECORD WITH ID 24 OR NAME 'Khách hàng ẩn danh'\n";
echo "====================================================\n\n";

// Search in leads
$r1 = $conn->query("SELECT * FROM leads WHERE id = 24 OR name LIKE '%Khách hàng ẩn danh%' OR name LIKE '%Ẩn danh%'");
echo "1. LEADS TABLE:\n";
while ($row = $r1->fetch_assoc()) {
    echo "Lead ID: {$row['id']} | Phone: {$row['phone']} | Name: {$row['name']} | Status: {$row['status']}\n";
}

// Search in distribution_logs
$r2 = $conn->query("SELECT * FROM distribution_logs WHERE id = 24 OR lead_id = 24");
echo "\n2. DISTRIBUTION LOGS TABLE:\n";
while ($row = $r2->fetch_assoc()) {
    echo "Log ID: {$row['id']} | Lead ID: {$row['lead_id']} | AssignedTo: {$row['assigned_to']} | Status: {$row['status']} | Message: {$row['message']}\n";
}

// Search in contacts
$r3 = $conn->query("SELECT * FROM contacts WHERE id = 24 OR person_id = 24 OR name LIKE '%Khách hàng ẩn danh%'");
echo "\n3. CONTACTS TABLE:\n";
while ($row = $r3->fetch_assoc()) {
    echo "Contact ID: {$row['id']} | Person ID: {$row['person_id']} | Phone: {$row['phone']} | Name: {$row['name']}\n";
}
