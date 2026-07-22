<?php
require_once __DIR__ . '/db_connect.php';

echo "=== USER SEARCH (Đình Thanh) ===\n";
$stmt = $pdo->query("SELECT id, full_name, email, role FROM users WHERE full_name LIKE '%Thanh%' OR full_name LIKE '%Đình%'");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
print_r($users);

echo "\n=== CONTACT SEARCH (Nga Lê) ===\n";
$stmt = $pdo->query("SELECT id, first_name, last_name, owner_id, collaborator_ids FROM contacts WHERE last_name LIKE '%Lê%' OR first_name LIKE '%Nga%'");
$contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);
print_r($contacts);

if (!empty($contacts)) {
    $cid = $contacts[0]['id'];
    echo "\n=== CLOUD FILES FOR CONTACT $cid ===\n";
    $stmt = $pdo->query("SELECT * FROM cloud_files WHERE contact_id = $cid");
    $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($files);
}

echo "\n=== ALL CLOUD FILES (RECENT 10) ===\n";
$stmt = $pdo->query("SELECT * FROM cloud_files ORDER BY id DESC LIMIT 10");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
