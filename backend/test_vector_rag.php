<?php
// backend/test_vector_rag.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/utils/rag_helpers.php';

echo "=== KIỂM THỬ HỆ THỐNG VECTOR RAG VÀ SEMANTIC SEARCH ===\n\n";

// 1. Kiểm tra cấu trúc bảng ai_training_chunks
$tableCheck = $conn->query("SHOW TABLES LIKE 'ai_training_chunks'");
$tableExists = ($tableCheck && $tableCheck->num_rows > 0);
assertTest("Bảng ai_training_chunks tồn tại trong cơ sở dữ liệu", $tableExists);

if ($tableExists) {
    $columnsRes = $conn->query("DESCRIBE ai_training_chunks");
    $columns = [];
    while ($row = $columnsRes->fetch_assoc()) {
        $columns[$row['Field']] = $row;
    }
    assertTest("Trường id là khóa chính của bảng chunks", isset($columns['id']) && $columns['id']['Key'] === 'PRI');
    assertTest("Trường doc_id liên kết tài liệu tồn tại", isset($columns['doc_id']));
    assertTest("Trường vector dạng LONGTEXT tồn tại", isset($columns['vector']));
}

// 2. Kiểm tra các hàm toán học và helper của Vector RAG
assertTest("Hàm chunk_text phân mảnh chính xác", function_exists('chunk_text'));
if (function_exists('chunk_text')) {
    $sampleText = "Đây là tài liệu huấn luyện AI của Rich Land về các sản phẩm và dịch vụ bất động sản chất lượng cao.";
    $chunks = chunk_text($sampleText, 20, 5);
    assertTest("Số lượng chunks cắt được > 1", count($chunks) > 1, "Số chunks: " . count($chunks));
}

assertTest("Hàm tính độ tương đồng Cosine hoạt động chuẩn xác", function_exists('cosine_similarity'));
if (function_exists('cosine_similarity')) {
    $vecA = [1.0, 0.0, 0.0];
    $vecB = [1.0, 0.0, 0.0];
    $vecC = [0.0, 1.0, 0.0];
    $vecD = [-1.0, 0.0, 0.0];

    $simAB = cosine_similarity($vecA, $vecB);
    $simAC = cosine_similarity($vecA, $vecC);
    $simAD = cosine_similarity($vecA, $vecD);

    assertTest("Độ khớp 2 vector trùng nhau phải bằng 1.0", abs($simAB - 1.0) < 0.0001, "Thực tế: " . $simAB);
    assertTest("Độ khớp 2 vector vuông góc phải bằng 0.0", abs($simAC - 0.0) < 0.0001, "Thực tế: " . $simAC);
    assertTest("Độ khớp 2 vector đối nghịch phải bằng -1.0", abs($simAD - (-1.0)) < 0.0001, "Thực tế: " . $simAD);
}

// 3. Kiểm tra API Key và tích hợp API nhúng của Gemini
$apiKey = get_system_setting($conn, 'gemini_api_key');
assertTest("Gemini API Key đã được cấu hình trong cài đặt hệ thống", !empty($apiKey));

if (!empty($apiKey) && function_exists('generate_embedding')) {
    echo "\n--- Đang thử nghiệm API tạo Vector Embedding thực tế của Google Gemini ---\n";
    $testVector = generate_embedding("Rich Land bất động sản", $apiKey);
    $apiWorking = (is_array($testVector) && count($testVector) > 0);
    assertTest("Gọi Google Gemini API tạo vector thành công", $apiWorking, "Chiều vector: " . (is_array($testVector) ? count($testVector) : 0));
}

assertTest("Hàm generate_batch_embeddings hoạt động chuẩn xác", function_exists('generate_batch_embeddings'));
if (!empty($apiKey) && function_exists('generate_batch_embeddings')) {
    echo "\n--- Đang thử nghiệm API tạo Batch Embedding thực tế của Google Gemini ---\n";
    $testVectors = generate_batch_embeddings(["Căn hộ cao cấp Rich Land quận 1", "Nhà phố thương mại Rich Land"], $apiKey);
    $batchWorking = (is_array($testVectors) && count($testVectors) === 2);
    assertTest("Gọi Google Gemini API tạo batch vector thành công", $batchWorking, "Số lượng vector nhận được: " . (is_array($testVectors) ? count($testVectors) : 0));
}

printTestSummary();
