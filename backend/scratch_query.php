<?php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=utf-8");

echo "=== SEARCH LEADS BY PHONE/EMAIL ===\n";
$searches = [
    '0329399688', 'nhinty212@gmail.com',
    '0936579952', 'Quangnguyen9952@gmail.com'
];

foreach ($searches as $s) {
    echo "Searching for '$s':\n";
    $stmt = $conn->prepare("SELECT * FROM leads WHERE phone = ? OR email = ?");
    $stmt->bind_param("ss", $s, $s);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res && $res->num_rows > 0) {
        while ($row = $res->fetch_assoc()) {
            echo "LEAD FOUND: " . json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
            // Check logs for this lead
            $leadId = $row['id'];
            $logRes = $conn->query("SELECT * FROM distribution_logs WHERE lead_id = $leadId");
            if ($logRes && $logRes->num_rows > 0) {
                while ($lRow = $logRes->fetch_assoc()) {
                    echo "  LOG: " . json_encode($lRow, JSON_UNESCAPED_UNICODE) . "\n";
                }
            } else {
                echo "  NO LOGS FOUND\n";
            }
        }
    } else {
        echo "  NOT FOUND IN LEADS TABLE\n";
    }
}

echo "\n=== CHECKS IN SYSTEM_SETTINGS ===\n";
$resSet = $conn->query("SELECT * FROM system_settings");
while ($row = $resSet->fetch_assoc()) {
    echo json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
}
?>
