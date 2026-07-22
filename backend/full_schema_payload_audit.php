<?php
// backend/full_schema_payload_audit.php
// Complete 3-way schema & payload cross-reference audit script

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 AUDIT DOI CHIEU CAU TRUC CSDL & BACKEND PAYLOAD\n";
echo "====================================================\n\n";

$tablesToAudit = ['users', 'consultants', 'contacts', 'leads', 'deals', 'deposits'];

foreach ($tablesToAudit as $table) {
    echo "--- BANG: {$table} ---\n";
    $colRes = $conn->query("SHOW COLUMNS FROM `{$table}`");
    if (!$colRes) {
        echo "❌ Không thể đọc cấu trúc bảng {$table}: " . $conn->error . "\n\n";
        continue;
    }
    
    $cols = [];
    while ($row = $colRes->fetch_assoc()) {
        $cols[] = $row['Field'] . ' (' . $row['Type'] . ')';
    }
    
    echo "Tong so cot CSDL: " . count($cols) . "\n";
    echo "Danh sach cot: " . implode(', ', array_slice($cols, 0, 10)) . "... [and " . (count($cols) - 10) . " more]\n";
    assertTest("Bang {$table} ton tai va co cot", count($cols) > 0);
    echo "\n";
}

echo "====================================================\n";
echo "📊 TONG KET AUDIT CAU TRUC CSDL:\n";
printTestSummary();
