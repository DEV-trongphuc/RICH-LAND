<?php
require_once __DIR__ . '/../backend/db_connect.php';

// Search database tables for matching strings
$searchTerms = ['Huỳnh Trọng Phúc', 'Trưởng phòng phê duyệt', 'Nguyễn Thu Thảo', 'đề nghị thanh toán'];

$result = $conn->query("SHOW TABLES");
$tables = [];
while ($row = $result->fetch_row()) {
    $tables[] = $row[0];
}

foreach ($tables as $table) {
    // get columns
    $colsResult = $conn->query("SHOW COLUMNS FROM `$table`");
    $textCols = [];
    while ($col = $colsResult->fetch_assoc()) {
        $type = strtolower($col['Type']);
        if (strpos($type, 'char') !== false || strpos($type, 'text') !== false || strpos($type, 'enum') !== false) {
            $textCols[] = $col['Field'];
        }
    }
    
    if (empty($textCols)) continue;
    
    foreach ($searchTerms as $term) {
        $likes = [];
        foreach ($textCols as $col) {
            $likes[] = "`$col` LIKE '%" . $conn->real_escape_string($term) . "%'";
        }
        $sql = "SELECT * FROM `$table` WHERE " . implode(" OR ", $likes) . " LIMIT 5";
        $searchRes = $conn->query($sql);
        if ($searchRes && $searchRes->num_rows > 0) {
            echo "Match found in table `$table` for term '$term':\n";
            while ($row = $searchRes->fetch_assoc()) {
                print_r($row);
            }
            echo "-------------------------------------\n";
        }
    }
}
?>
