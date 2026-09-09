<?php
// scratch/import_db.php
header('Content-Type: application/json; charset=utf-8');
set_time_limit(300);
ini_set('memory_limit', '256M');

$key = $_REQUEST['key'] ?? '';
if ($key !== 'richland2026') {
    http_response_code(403);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

$host = 'localhost';
$user = 'zccqvhhh_crm-rlvn';
$pass = '$1;RKuCwX)VD;k~#';
$db   = 'zccqvhhh_crm-rlvn';

$sqlFile = __DIR__ . '/full_db_dump.sql';
if (!file_exists($sqlFile)) {
    echo json_encode(["error" => "File full_db_dump.sql not found"]);
    exit;
}

$sql = file_get_contents($sqlFile);

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    echo json_encode(["error" => "Connect failed: " . $conn->connect_error]);
    exit;
}
$conn->set_charset("utf8mb4");

// Execute multi_query
$queriesExecuted = 0;
$errors = [];

if ($conn->multi_query($sql)) {
    do {
        $queriesExecuted++;
        if ($result = $conn->store_result()) {
            $result->free();
        }
        if ($conn->errno) {
            $errors[] = "Query $queriesExecuted error: " . $conn->error;
        }
    } while ($conn->more_results() && $conn->next_result());
} else {
    $errors[] = "Initial query failed: " . $conn->error;
}

// Verify counts
$resTables = $conn->query("SHOW FULL TABLES;");
$tables = [];
if ($resTables) {
    while ($r = $resTables->fetch_array()) {
        $tables[] = ['name' => $r[0], 'type' => $r[1]];
    }
}

$userCount = 0;
$uRes = $conn->query("SELECT count(*) FROM users;");
if ($uRes) $userCount = (int)$uRes->fetch_array()[0];

$settingsCount = 0;
$sRes = $conn->query("SELECT count(*) FROM system_settings;");
if ($sRes) $settingsCount = (int)$sRes->fetch_array()[0];

$projectsCount = 0;
$pRes = $conn->query("SELECT count(*) FROM projects;");
if ($pRes) $projectsCount = (int)$pRes->fetch_array()[0];

echo json_encode([
    "status" => empty($errors) ? "success" : "partial_error",
    "queries_executed" => $queriesExecuted,
    "errors" => $errors,
    "total_tables_created" => count($tables),
    "tables" => $tables,
    "users_count" => $userCount,
    "settings_count" => $settingsCount,
    "projects_count" => $projectsCount
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
