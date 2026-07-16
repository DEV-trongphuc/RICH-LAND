<?php
// backend/scratch/query_contacts.php
define('BYPASS_CRON_LOCK', true);
define('DIAG_TOKEN', 'RichLand_Diag_Secure_Token_2026_9e88d6c701fbc6b7');

if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/config/Database.php';
} else {
    require_once __DIR__ . '/../config.php';
    require_once __DIR__ . '/../config/Database.php';
}

try {
    $conn = Database::getInstance();
    $stmt = $conn->query("SELECT id, first_name, last_name, owner_id, phone, status, deleted_at FROM contacts WHERE id IN (3558, 3559, 3532, 3506, 3480, 3454, 3380)");
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo $e->getMessage();
}
