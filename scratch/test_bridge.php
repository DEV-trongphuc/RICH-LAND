<?php
header('Content-Type: application/json; charset=utf-8');

$host = 'localhost';
$user = 'zccqvhhh_crm-rlvn';
$pass = '$1;RKuCwX)VD;k~#';
$db   = 'zccqvhhh_crm-rlvn';

$result = [
    'php_version' => PHP_VERSION,
    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? '',
    'db_connection' => 'testing...'
];

try {
    $conn = new mysqli($host, $user, $pass, $db);
    if ($conn->connect_error) {
        $result['db_connection'] = 'FAILED: ' . $conn->connect_error;
    } else {
        $result['db_connection'] = 'SUCCESS';
        $vRes = $conn->query("SELECT VERSION() as v;");
        $result['mysql_version'] = $vRes ? $vRes->fetch_assoc()['v'] : 'unknown';
        $res = $conn->query("SHOW TABLES;");
        $tables = [];
        if ($res) {
            while ($row = $res->fetch_array()) {
                $tables[] = $row[0];
            }
        }
        $result['existing_tables'] = $tables;
        $result['existing_tables_count'] = count($tables);
    }
} catch (Throwable $e) {
    $result['db_connection'] = 'EXCEPTION: ' . $e->getMessage();
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
