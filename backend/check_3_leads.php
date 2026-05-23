<?php
// backend/check_3_leads.php
require_once __DIR__ . '/db_connect.php';

header("Content-Type: text/plain; charset=utf-8");

$phones = ['0938297768', '0938187025', '0907635229'];

echo "=== CHECKING 3 LEADS IN DATABASE ===\n\n";

foreach ($phones as $phone) {
    echo "Searching for phone: '$phone'\n";
    // Search exact and partial
    $stmt = $conn->prepare("SELECT id, phone, name, source, assigned_to, created_at, note FROM leads WHERE phone LIKE ?");
    $likePhone = "%" . substr($phone, -9); // search by last 9 digits to be safe
    $stmt->bind_param("s", $likePhone);
    $stmt->execute();
    $res = $stmt->get_result();
    
    if ($res && $res->num_rows > 0) {
        while ($row = $res->fetch_assoc()) {
            echo "  FOUND LEAD: " . json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
            $leadId = $row['id'];
            
            // Check logs
            $logRes = $conn->query("SELECT * FROM distribution_logs WHERE lead_id = $leadId");
            if ($logRes && $logRes->num_rows > 0) {
                while ($lRow = $logRes->fetch_assoc()) {
                    echo "    LOG: " . json_encode($lRow, JSON_UNESCAPED_UNICODE) . "\n";
                }
            } else {
                echo "    NO LOGS IN distribution_logs\n";
            }
        }
    } else {
        echo "  NOT FOUND IN leads TABLE\n";
    }
    echo "\n";
    $stmt->close();
}

$conn->close();
?>
