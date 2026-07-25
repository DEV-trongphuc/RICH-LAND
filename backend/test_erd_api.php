<?php
// backend/test_erd_api.php
// Integration test for Database ERD Schema querying logic

require_once __DIR__ . '/test_bootstrap.php';

echo "🚀 BẮT ĐẦU KIỂM THỬ: HỆ THỐNG TRUY VẤN SƠ ĐỒ DATABASE ERD\n\n";

// Test Case 1: Check database connectivity and schema helper action
assertTest(
    "Kiểm tra kết nối CSDL và biến kết nối mysqli \$conn",
    isset($conn) && $conn instanceof mysqli && $conn->ping(),
    "Kết nối MySQLi đang hoạt động"
);

// Test Case 2: Query database tables
$tablesQuery = $conn->query("SHOW TABLES");
$tables = [];
if ($tablesQuery) {
    while ($row = $tablesQuery->fetch_array()) {
        $tables[] = $row[0];
    }
}

assertTest(
    "Kiểm tra danh sách bảng CSDL không rỗng",
    count($tables) > 0,
    "Tìm thấy " . count($tables) . " bảng trong CSDL"
);

// Test Case 3: Verify existence of core tables
$coreTables = ['users', 'tenants', 'contacts', 'deals', 'projects'];
foreach ($coreTables as $core) {
    assertTest(
        "Kiểm tra sự tồn tại của bảng cốt lõi '{$core}'",
        in_array($core, $tables),
        in_array($core, $tables) ? "Tìm thấy bảng '{$core}'" : "Không tìm thấy bảng '{$core}'"
    );
}

// Test Case 4: Simulate get_db_schema action
$schema = [];
foreach ($tables as $table) {
    $fieldsQuery = $conn->query("SHOW COLUMNS FROM `{$table}`");
    if ($fieldsQuery) {
        $schema[$table] = [];
        while ($col = $fieldsQuery->fetch_assoc()) {
            $schema[$table][] = [
                'field'   => $col['Field'],
                'type'    => $col['Type'],
                'null'    => $col['Null'],
                'key'     => $col['Key'],
                'default' => $col['Default'],
                'extra'   => $col['Extra']
            ];
        }
    }
}

assertTest(
    "Kiểm tra cấu trúc sơ đồ Schema tạo ra",
    count($schema) === count($tables),
    "Đã lấy thông tin cột thành công cho " . count($schema) . " bảng"
);

// Test Case 5: Verify foreign key columns inside common tables
if (isset($schema['contacts'])) {
    $contactFields = array_column($schema['contacts'], 'field');
    assertTest(
        "Bảng 'contacts' có cột liên kết 'tenant_id'",
        in_array('tenant_id', $contactFields),
        "Tìm thấy tenant_id trong contacts"
    );
}

if (isset($schema['deals'])) {
    $dealFields = array_column($schema['deals'], 'field');
    assertTest(
        "Bảng 'deals' có cột liên kết 'contact_id'",
        in_array('contact_id', $dealFields),
        "Tìm thấy contact_id trong deals"
    );
}

printTestSummary();
