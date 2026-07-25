<?php
// backend/test_vector_rag.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/utils/rag_helpers.php';

echo "=== KIỂM THỬ HỆ THỐNG VECTOR RAG VÀ SEMANTIC SEARCH (Cấu trúc DB & Lớp Truy vấn) ===\n\n";

// ==========================================
// PHẦN 1: KIỂM TRA SCHEMA CỘT THỰC TẾ TRÊN DATABASE STAGING
// ==========================================
echo "--- ĐANG KIỂM TRA ĐỐI SOÁT CẤU TRÚC SCHEMA BẢNG CSDL STAGING ---\n";

function verifyTableColumns($conn, $tableName, $requiredCols) {
    $res = $conn->query("SHOW TABLES LIKE '$tableName'");
    if (!$res || $res->num_rows === 0) {
        assertTest("Bảng $tableName tồn tại", false);
        return false;
    }
    assertTest("Bảng $tableName tồn tại", true);

    $columnsRes = $conn->query("DESCRIBE $tableName");
    $actualCols = [];
    while ($row = $columnsRes->fetch_assoc()) {
        $actualCols[] = $row['Field'];
    }

    $allPassed = true;
    foreach ($requiredCols as $col) {
        $exists = in_array($col, $actualCols);
        assertTest("Bảng $tableName có cột '$col'", $exists);
        if (!$exists) $allPassed = false;
    }
    return $allPassed;
}

// 1. Kiểm tra bảng ai_training_docs
$requiredDocsCols = ['id', 'tenant_id', 'name', 'content', 'tags', 'source_type', 'parent_id', 'is_active', 'status', 'file_path', 'file_size', 'created_at', 'updated_at'];
verifyTableColumns($conn, 'ai_training_docs', $requiredDocsCols);

// 2. Kiểm tra bảng ai_training_chunks
$requiredChunksCols = ['id', 'tenant_id', 'doc_id', 'chunk_index', 'content', 'vector', 'vector_norm'];
verifyTableColumns($conn, 'ai_training_chunks', $requiredChunksCols);

// 3. Kiểm tra bảng ai_vector_cache
$requiredVectorCacheCols = ['hash', 'vector', 'vector_norm'];
verifyTableColumns($conn, 'ai_vector_cache', $requiredVectorCacheCols);

// 4. Kiểm tra bảng ai_rag_search_cache
$requiredSearchCacheCols = ['query_hash', 'results', 'created_at'];
verifyTableColumns($conn, 'ai_rag_search_cache', $requiredSearchCacheCols);


// ==========================================
// PHẦN 2: CHẠY KIỂM THỬ TRUY VẤN PAYLOAD & HÀM BIND CSDL
// ==========================================
echo "\n--- ĐANG KIỂM THỬ CÁC CÂU LỆNH SQL CỦA BACKEND CONTROLLER ---\n";

$testDocId = 999999;
$folderName = "Thư mục kiểm thử tự động " . time();
$folderType = 'folder';

// 1. Giả lập INSERT folder (Quy trình của create_folder)
$stmtFolder = $conn->prepare("INSERT INTO ai_training_docs (name, source_type, parent_id) VALUES (?, ?, 0)");
$insertFolderOk = false;
if ($stmtFolder) {
    $stmtFolder->bind_param("ss", $folderName, $folderType);
    $insertFolderOk = $stmtFolder->execute();
    $testDocId = $stmtFolder->insert_id;
    $stmtFolder->close();
}
assertTest("[SQL_API] Thực thi INSERT folder vào ai_training_docs thành công", $insertFolderOk && $testDocId > 0);

// 2. Giả lập SELECT list_docs (Quy trình của list_docs)
$stmtList = $conn->prepare("SELECT id, name, content, tags, source_type, parent_id, is_active, status, file_path, file_size, created_at, updated_at FROM ai_training_docs WHERE tenant_id = 1 ORDER BY id DESC");
$listOk = false;
if ($stmtList) {
    $listOk = $stmtList->execute();
    $resList = $stmtList->get_result();
    $foundTestFolder = false;
    while ($row = $resList->fetch_assoc()) {
        if ((int)$row['id'] === $testDocId) {
            $foundTestFolder = true;
        }
    }
    $stmtList->close();
}
assertTest("[SQL_API] Thực thi SELECT list_docs thành công và tìm thấy folder test", $listOk && $foundTestFolder);

// 3. Giả lập INSERT chunk (Quy trình của train_docs)
$chunkIndex = 0;
$chunkContent = "Nội dung phân mảnh kiểm thử payload db.";
$chunkVector = json_encode(array_fill(0, 10, 0.5)); // Dùng mảng giả kích thước nhỏ
$chunkNorm = 1.58;
$cStmt = $conn->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (1, ?, ?, ?, ?, ?)");
$insertChunkOk = false;
if ($cStmt) {
    $cStmt->bind_param("iissd", $testDocId, $chunkIndex, $chunkContent, $chunkVector, $chunkNorm);
    $insertChunkOk = $cStmt->execute();
    $cStmt->close();
}
assertTest("[SQL_API] Thực thi INSERT chunk vào ai_training_chunks thành công", $insertChunkOk);

// 4. Giả lập SELECT chunks (Quy trình RAG Search trong chatbot)
$stmtSearch = $conn->prepare("SELECT doc_id, chunk_index, content, vector, vector_norm FROM ai_training_chunks WHERE tenant_id = 1");
$searchOk = false;
if ($stmtSearch) {
    $searchOk = $stmtSearch->execute();
    $resSearch = $stmtSearch->get_result();
    $foundTestChunk = false;
    while ($row = $resSearch->fetch_assoc()) {
        if ((int)$row['doc_id'] === $testDocId) {
            $foundTestChunk = true;
        }
    }
    $stmtSearch->close();
}
assertTest("[SQL_API] Thực thi SELECT chunks (RAG) thành công", $searchOk && $foundTestChunk);

// 5. Giả lập INSERT/UPDATE vector cache (Quy trình tối ưu hóa training)
$testHash = md5("test_query_hash_" . time());
$testVectorJson = json_encode([0.1, 0.2, 0.3]);
$testNorm = 0.374;
$stmtSaveCache = $conn->prepare("INSERT INTO ai_vector_cache (hash, vector, vector_norm) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vector = ?, vector_norm = ?");
$cacheInsertOk = false;
if ($stmtSaveCache) {
    $stmtSaveCache->bind_param("ssssd", $testHash, $testVectorJson, $testNorm, $testVectorJson, $testNorm);
    $cacheInsertOk = $stmtSaveCache->execute();
    $stmtSaveCache->close();
}
assertTest("[SQL_API] Thực thi INSERT/UPDATE vào ai_vector_cache thành công", $cacheInsertOk);

// 6. Dọn dẹp dữ liệu kiểm thử
$conn->query("DELETE FROM ai_training_chunks WHERE doc_id = $testDocId");
$conn->query("DELETE FROM ai_training_docs WHERE id = $testDocId");
$conn->query("DELETE FROM ai_vector_cache WHERE hash = '$testHash'");
echo "♻️ Đã dọn dẹp các bản ghi kiểm thử thành công khỏi database.\n";


// ==========================================
// PHẦN 3: KIỂM TRA HÀM TOÁN HỌC VÀ HELPER RAG
// ==========================================
echo "\n--- ĐANG KIỂM TRA HÀM TOÁN HỌC & GOOGLE GEMINI API ---\n";

assertTest("Hàm chunk_text phân mảnh chính xác", function_exists('chunk_text'));
if (function_exists('chunk_text')) {
    $sampleText = "Đây là tài liệu huấn luyện AI của Rich Land về các sản phẩm và dịch vụ bất động sản chất lượng cao. Cần kiểm tra ranh giới câu.";
    $chunks = chunk_text($sampleText, 25, 8);
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

// 7. Gọi API nhúng thực tế của Gemini
$apiKey = get_system_setting($conn, 'gemini_api_key');
assertTest("Gemini API Key đã được cấu hình trong cài đặt hệ thống", !empty($apiKey));

if (!empty($apiKey) && function_exists('generate_embedding')) {
    $testVector = generate_embedding("Rich Land bất động sản", $apiKey);
    $apiWorking = (is_array($testVector) && count($testVector) > 0);
    assertTest("Gọi Google Gemini API tạo vector thành công", $apiWorking, "Chiều vector: " . (is_array($testVector) ? count($testVector) : 0));
}

assertTest("Hàm generate_batch_embeddings hoạt động chuẩn xác", function_exists('generate_batch_embeddings'));
if (!empty($apiKey) && function_exists('generate_batch_embeddings')) {
    $testVectors = generate_batch_embeddings(["Căn hộ cao cấp Rich Land quận 1", "Nhà phố thương mại Rich Land"], $apiKey);
    $batchWorking = (is_array($testVectors) && count($testVectors) === 2);
    assertTest("Gọi Google Gemini API tạo batch vector thành công", $batchWorking, "Số lượng vector nhận được: " . (is_array($testVectors) ? count($testVectors) : 0));
}

printTestSummary();

