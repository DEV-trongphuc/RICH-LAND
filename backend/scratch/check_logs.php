<?php
require_once __DIR__ . '/../config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Query distribution logs for date 2026-07-17
    $date = '2026-07-17';
    echo "=== DISTRIBUTION LOGS FOR $date ===\n";
    $stmt = $db->prepare("
        SELECT assigned_to, u.full_name, dl.status, COUNT(*) as cnt
        FROM distribution_logs dl
        LEFT JOIN users u ON dl.assigned_to = u.id
        WHERE DATE(dl.received_at) = ?
        GROUP BY assigned_to, dl.status
    ");
    $stmt->execute([$date]);
    while ($row = $stmt->fetch()) {
        echo "  User: {$row['full_name']} (ID: {$row['assigned_to']}) | Status: {$row['status']} | Count: {$row['cnt']}\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
