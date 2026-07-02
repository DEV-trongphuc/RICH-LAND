<?php
require_once '/home/vhvxoigh/open.domation.net/richland/db_connect.php';

// Simulate ContactController query for sales agent (user_id = 1000)
$tenant_id = 1;
$user_id = 1000;
$role = 'sales';

$sql = "SELECT c.*, 
               u.full_name as owner_name
        FROM contacts c
        LEFT JOIN users u ON c.owner_id = u.id
        WHERE c.tenant_id = ? AND c.deleted_at IS NULL";

$params = [$tenant_id];
if ($role === 'sales') {
    $sql .= " AND c.owner_id=?";
    $params[] = $user_id;
}

$stmt = $conn->prepare($sql);
if ($role === 'sales') {
    $stmt->bind_param("ii", $tenant_id, $user_id);
} else {
    $stmt->bind_param("i", $tenant_id);
}
$stmt->execute();
print_r($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
