<?php
// backend/test_new_schema.php
require_once __DIR__ . '/test_bootstrap.php';

echo "🚀 BẮT ĐẦU KIỂM THỬ CẤU TRÚC TRƯỜNG DỮ LIỆU MỚI (BIO & EXTRA_FIELDS_JSON)\n";
echo "====================================================\n\n";

// 1. Kiểm tra bảng `users`
$resBioUser = $conn->query("SHOW COLUMNS FROM `users` LIKE 'bio'");
assertTest("Trường 'bio' tồn tại trong bảng 'users'", $resBioUser && $resBioUser->num_rows > 0);

$resExtraUser = $conn->query("SHOW COLUMNS FROM `users` LIKE 'extra_fields_json'");
assertTest("Trường 'extra_fields_json' tồn tại trong bảng 'users'", $resExtraUser && $resExtraUser->num_rows > 0);

// 2. Kiểm tra view `consultants`
$resBioConsultant = $conn->query("SHOW COLUMNS FROM `consultants` LIKE 'bio'");
assertTest("Trường 'bio' tồn tại trong view 'consultants'", $resBioConsultant && $resBioConsultant->num_rows > 0);

$resExtraConsultant = $conn->query("SHOW COLUMNS FROM `consultants` LIKE 'extra_fields_json'");
assertTest("Trường 'extra_fields_json' tồn tại trong view 'consultants'", $resExtraConsultant && $resExtraConsultant->num_rows > 0);

// In ra kết quả tổng kết
printTestSummary();
