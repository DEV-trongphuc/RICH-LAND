<?php
require_once __DIR__ . '/../backend/db_connect.php';

$sql = "SELECT dl.round_id, dr.round_name, COALESCE(NULLIF(TRIM(l.source), ''), 'Không xác định') as source_name, COUNT(*) as cnt
        FROM distribution_logs dl
        JOIN leads l ON dl.lead_id = l.id
        LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
        WHERE dl.status != 'silent'
        GROUP BY dl.round_id, dr.round_name, source_name
        ORDER BY dl.round_id, cnt DESC";

$res = $conn->query($sql);
if ($res) {
    echo "ROUND_ID | ROUND_NAME | SOURCE_NAME | COUNT\n";
    echo "--------------------------------------------------\n";
    while ($row = $res->fetch_assoc()) {
        printf("%8d | %-20s | %-20s | %d\n", $row['round_id'], $row['round_name'] ?? 'NULL', $row['source_name'], $row['cnt']);
    }
} else {
    echo "Error querying: " . $conn->error . "\n";
}
