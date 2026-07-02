<?php
require_once __DIR__ . '/db.php';
$res = $conn->query("SELECT l.id, l.name, l.person_id, p.is_public FROM leads l LEFT JOIN persons p ON l.person_id = p.id WHERE l.name LIKE '%Phúc%' LIMIT 5");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
