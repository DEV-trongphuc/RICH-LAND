<?php
// backend/test_ai_training_structure.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== KIỂM THỬ CẤU TRÚC BẢNG VÀ TRƯỜNG AI TRAINING ===\n\n";

// Kiểm tra bảng ai_training_docs có tồn tại không
$tableCheck = $conn->query("SHOW TABLES LIKE 'ai_training_docs'");
assertTest("Bảng ai_training_docs tồn tại", $tableCheck && $tableCheck->num_rows > 0);

if ($tableCheck && $tableCheck->num_rows > 0) {
    // Lấy thông tin các cột của ai_training_docs
    $columnsRes = $conn->query("DESCRIBE ai_training_docs");
    $columns = [];
    while ($row = $columnsRes->fetch_assoc()) {
        $columns[$row['Field']] = $row;
    }

    assertTest("Cột id tồn tại và là khóa chính", isset($columns['id']) && $columns['id']['Key'] === 'PRI');
    assertTest("Cột tenant_id tồn tại", isset($columns['tenant_id']));
    assertTest("Cột name tồn tại", isset($columns['name']));
    assertTest("Cột content tồn tại", isset($columns['content']));
    assertTest("Cột tags tồn tại", isset($columns['tags']));
    assertTest("Cột source_type tồn tại", isset($columns['source_type']) && strpos($columns['source_type']['Type'], 'manual') !== false);
    assertTest("Cột parent_id tồn tại", isset($columns['parent_id']));
    assertTest("Cột is_active tồn tại", isset($columns['is_active']));
    assertTest("Cột file_path tồn tại", isset($columns['file_path']));
    assertTest("Cột file_size tồn tại", isset($columns['file_size']));
    assertTest("Cột created_at tồn tại", isset($columns['created_at']));
    assertTest("Cột updated_at tồn tại", isset($columns['updated_at']));
}

// Kiểm tra cấu hình trong bảng system_settings
$settingsCheck = $conn->query("SELECT * FROM system_settings WHERE setting_key = 'rag_settings' LIMIT 1");
assertTest("Khóa cấu hình RAG (rag_settings) sẵn sàng trong system_settings", $settingsCheck !== false);

printTestSummary();
