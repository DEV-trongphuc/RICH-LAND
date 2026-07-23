<?php
// backend/scratch_update_gps.php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

try {
    $db = Database::getInstance();
    $stmt = $db->prepare("
        UPDATE check_ins 
        SET latitude = '10.825011', 
            longitude = '106.632234', 
            location_address = 'Hẻm 10/23 Cống Lở, Phường Tân Sơn, Thuận An, Thành phố Hồ Chí Minh, 71509, Việt Nam' 
        WHERE check_in_date = '2026-07-23'
    ");
    $stmt->execute();
    echo "SUCCESS: Updated check-ins for 2026-07-23 with GPS coordinates.\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
