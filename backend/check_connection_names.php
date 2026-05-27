<?php
require_once __DIR__ . '/db_connect.php';

echo "<pre>";
$sql = "SELECT l.id, l.name, l.phone, l.source, l.connection_id, sc.sheet_name, dl.round_id, dr.round_name
        FROM leads l
        JOIN distribution_logs dl ON l.id = dl.lead_id
        LEFT JOIN sheet_connections sc ON l.connection_id = sc.id
        LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
        WHERE dl.round_id = 1 AND l.source IN ('Messenger', 'Hotline') AND dl.status != 'silent'";

$res = $conn->query($sql);
if ($res && $res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "No matching leads found.\n";
}
echo "</pre>";
