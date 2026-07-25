<?php
// backend/controllers/ai_training_handler.php
// RICH LAND DATA CRM - AI Training and Settings controller handler

if (!in_array($decodedUser['role'] ?? '', ['admin', 'super_admin'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Bạn không có quyền thực hiện thao tác này']);
    exit;
}

try {
    $createdBy = $decodedUser['name'] ?? 'Admin';
    $actionType = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false) {
            $actionType = $_POST['action'] ?? '';
        } else {
            $input = json_decode(file_get_contents('php://input'), true);
            $actionType = $input['action'] ?? '';
        }
    } else {
        $actionType = $_GET['action_type'] ?? '';
    }

    if ($actionType === 'get_settings') {
        $stmt = $conn->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'rag_settings' LIMIT 1");
        $stmt->execute();
        $res = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $settings = [];
        if ($res && !empty($res['setting_value'])) {
            $settings = json_decode($res['setting_value'], true);
        }

        // Fill defaults
        $settings['is_enabled'] = isset($settings['is_enabled']) ? (int)$settings['is_enabled'] : 1;
        $settings['bot_name'] = $settings['bot_name'] ?? 'AI Rich Land';
        $settings['welcome_msg'] = $settings['welcome_msg'] ?? 'Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?';
        $settings['persona_prompt'] = $settings['persona_prompt'] ?? 'Bạn là trợ lý ảo chuyên nghiệp.';
        $settings['similarity_threshold'] = isset($settings['similarity_threshold']) ? (float)$settings['similarity_threshold'] : 0.45;
        $settings['top_k'] = isset($settings['top_k']) ? (int)$settings['top_k'] : 8;
        $settings['chunk_size'] = isset($settings['chunk_size']) ? (int)$settings['chunk_size'] : 700;
        $settings['chunk_overlap'] = isset($settings['chunk_overlap']) ? (int)$settings['chunk_overlap'] : 150;
        $settings['temperature'] = isset($settings['temperature']) ? (float)$settings['temperature'] : 0.2;
        $settings['max_output_tokens'] = isset($settings['max_output_tokens']) ? (int)$settings['max_output_tokens'] : 1024;
        $settings['history_limit'] = isset($settings['history_limit']) ? (int)$settings['history_limit'] : 10;
        $settings['brand_color'] = $settings['brand_color'] ?? '#BD1D2D';

        echo json_encode(['success' => true, 'data' => $settings]);
    }
    elseif ($actionType === 'update_settings') {
        $settings = [
            'is_enabled' => (int)($input['is_enabled'] ?? 1),
            'bot_name' => trim($input['bot_name'] ?? 'AI Rich Land'),
            'welcome_msg' => trim($input['welcome_msg'] ?? 'Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?'),
            'persona_prompt' => trim($input['persona_prompt'] ?? 'Bạn là trợ lý ảo chuyên nghiệp.'),
            'similarity_threshold' => (float)($input['similarity_threshold'] ?? 0.45),
            'top_k' => (int)($input['top_k'] ?? 8),
            'chunk_size' => (int)($input['chunk_size'] ?? 700),
            'chunk_overlap' => (int)($input['chunk_overlap'] ?? 150),
            'temperature' => (float)($input['temperature'] ?? 0.2),
            'max_output_tokens' => (int)($input['max_output_tokens'] ?? 1024),
            'history_limit' => (int)($input['history_limit'] ?? 10),
            'brand_color' => trim($input['brand_color'] ?? '#BD1D2D')
        ];

        $valJson = json_encode($settings, JSON_UNESCAPED_UNICODE);
        $stmt = $conn->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('rag_settings', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
        $stmt->bind_param("ss", $valJson, $valJson);
        $stmt->execute();
        $stmt->close();

        echo json_encode(['success' => true, 'message' => 'Cập nhật cấu hình RAG thành công']);
    }
    elseif ($actionType === 'list_docs') {
        $stmt = $conn->prepare("SELECT id, name, content, tags, source_type, parent_id, is_active, status, file_path, file_size, created_at, updated_at, created_by, version FROM ai_training_docs WHERE tenant_id = 1 ORDER BY id DESC");
        $stmt->execute();
        $res = $stmt->get_result();
        $docs = [];
        while ($row = $res->fetch_assoc()) {
            $row['batch_id'] = $row['parent_id'];
            $docs[] = $row;
        }
        $stmt->close();
        echo json_encode(['success' => true, 'data' => $docs]);
    }
    elseif ($actionType === 'create_folder') {
        $name = trim($input['name'] ?? '');
        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Tên thư mục không được để trống']);
            exit;
        }
        $source_type = 'folder';
        $stmt = $conn->prepare("INSERT INTO ai_training_docs (name, source_type, parent_id, created_by, version) VALUES (?, ?, 0, ?, 1)");
        $stmt->bind_param("sss", $name, $source_type, $createdBy);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã tạo thư mục thành công']);
    }
    elseif ($actionType === 'add_manual') {
        $name = trim($input['name'] ?? '');
        $content = $input['content'] ?? '';
        $tags = trim($input['tags'] ?? '');
        $parentId = (int)($input['batch_id'] ?? 0);
        
        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Tiêu đề không được để trống']);
            exit;
        }
        
        $source_type = (strpos($content, 'URL_TO_CRAWL:') === 0) ? 'web' : 'manual';
        
        $stmt = $conn->prepare("INSERT INTO ai_training_docs (name, content, tags, source_type, parent_id, created_by, version) VALUES (?, ?, ?, ?, ?, ?, 1)");
        $stmt->bind_param("ssssis", $name, $content, $tags, $source_type, $parentId, $createdBy);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã thêm tài liệu thành công']);
    }
    elseif ($actionType === 'update_doc') {
        $id = (int)($input['id'] ?? 0);
        
        if ($id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID không hợp lệ']);
            exit;
        }

        if (isset($input['is_active'])) {
            $isActive = (int)$input['is_active'];
            $stmt = $conn->prepare("UPDATE ai_training_docs SET is_active = ? WHERE id = ?");
            $stmt->bind_param("ii", $isActive, $id);
            $stmt->execute();
            $stmt->close();
            echo json_encode(['success' => true, 'message' => 'Đã cập nhật trạng thái tài liệu']);
        } else {
            $name = trim($input['name'] ?? '');
            $content = $input['content'] ?? '';
            $tags = trim($input['tags'] ?? '');
            $parentId = (int)($input['parent_id'] ?? 0);

            if (empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Tiêu đề không được để trống']);
                exit;
            }

            $stmt = $conn->prepare("UPDATE ai_training_docs SET name = ?, content = ?, tags = ?, parent_id = ?, status = 'pending', version = version + 1 WHERE id = ?");
            $stmt->bind_param("sssii", $name, $content, $tags, $parentId, $id);
            $stmt->execute();
            $stmt->close();
            echo json_encode(['success' => true, 'message' => 'Đã cập nhật tài liệu thành công']);
        }
    }
    elseif ($actionType === 'delete_doc') {
        $id = (int)($input['doc_id'] ?? 0);
        if ($id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID không hợp lệ']);
            exit;
        }
        
        $stmt = $conn->prepare("UPDATE ai_training_docs SET parent_id = 0 WHERE parent_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM ai_training_docs WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã xóa tài liệu thành công']);
    }
    elseif ($actionType === 'delete_batch') {
        $id = (int)($input['batch_id'] ?? 0);
        if ($id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID thư mục không hợp lệ']);
            exit;
        }
        
        // Delete children
        $stmt = $conn->prepare("DELETE FROM ai_training_docs WHERE parent_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();

        // Delete the folder itself
        $stmt = $conn->prepare("DELETE FROM ai_training_docs WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã xóa thư mục và tất cả tài liệu con thành công']);
    }
    elseif ($actionType === 'toggle_batch') {
        $id = (int)($input['batch_id'] ?? 0);
        $isActive = (int)($input['is_active'] ?? 1);
        if ($id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID thư mục không hợp lệ']);
            exit;
        }

        // Toggle children
        $stmt = $conn->prepare("UPDATE ai_training_docs SET is_active = ? WHERE parent_id = ?");
        $stmt->bind_param("ii", $isActive, $id);
        $stmt->execute();
        $stmt->close();

        // Toggle folder itself
        $stmt = $conn->prepare("UPDATE ai_training_docs SET is_active = ? WHERE id = ?");
        $stmt->bind_param("ii", $isActive, $id);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã cập nhật trạng thái thư mục']);
    }
    elseif ($actionType === 'train_docs') {
        $docIds = $input['doc_ids'] ?? [];
        if (empty($docIds) || !is_array($docIds)) {
            echo json_encode(['success' => false, 'message' => 'Không có tài liệu nào để huấn luyện']);
            exit;
        }

        $apiKey = get_system_setting($conn, 'gemini_api_key');
        if (empty($apiKey)) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng cấu hình Gemini API Key trước khi huấn luyện']);
            exit;
        }

        // Load RAG settings for chunk_size and chunk_overlap
        $chunkSize = 700;
        $chunkOverlap = 150;
        $rStmt = $conn->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'rag_settings' LIMIT 1");
        if ($rStmt) {
            $rStmt->execute();
            $rRes = $rStmt->get_result()->fetch_assoc();
            $rStmt->close();
            if ($rRes && !empty($rRes['setting_value'])) {
                $ragSettings = json_decode($rRes['setting_value'], true);
                $chunkSize = isset($ragSettings['chunk_size']) ? (int)$ragSettings['chunk_size'] : 700;
                $chunkOverlap = isset($ragSettings['chunk_overlap']) ? (int)$ragSettings['chunk_overlap'] : 150;
            }
        }

        $successCount = 0;
        $errorMsg = '';

        foreach ($docIds as $idVal) {
            $id = (int)$idVal;
            if ($id <= 0) continue;

            // Query the document details
            $stmt = $conn->prepare("SELECT name, content, source_type, file_path FROM ai_training_docs WHERE id = ? AND tenant_id = 1");
            if (!$stmt) continue;
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $doc = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$doc) continue;

            $rawText = '';
            $sourceType = $doc['source_type'];

            // 1. Text extraction based on document type
            if ($sourceType === 'file') {
                $filePath = $doc['file_path'];
                $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
                if ($ext === 'txt') {
                    // Local TXT file
                    $fullPath = $_SERVER['DOCUMENT_ROOT'] . $filePath;
                    if (!file_exists($fullPath)) {
                        $fullPath = __DIR__ . '/../..' . $filePath;
                        if (!file_exists($fullPath)) {
                            $fullPath = __DIR__ . '/../' . $filePath;
                        }
                    }
                    if (file_exists($fullPath)) {
                        $rawText = file_get_contents($fullPath);
                    }
                } elseif ($ext === 'pdf') {
                    // PDF file - extract via Gemini multimodal OCR
                    $rawText = extract_pdf_text_via_gemini($filePath, $apiKey);
                    if (strpos($rawText, 'Lỗi:') === 0 || empty($rawText)) {
                        $errorMsg = "Không thể đọc văn bản từ PDF. Vui lòng kiểm tra API Key.";
                        $conn->query("UPDATE ai_training_docs SET status = 'error' WHERE id = $id");
                        continue;
                    }
                } else {
                    $rawText = $doc['content']; // Fallback
                }
            } elseif ($sourceType === 'web') {
                // Crawl web URL if content starts with URL_TO_CRAWL:
                $contentField = $doc['content'];
                if (strpos($contentField, 'URL_TO_CRAWL: ') === 0) {
                    $urlToFetch = trim(substr($contentField, 14));
                    $rawText = fetch_web_content($urlToFetch);
                    if (empty($rawText)) {
                        $errorMsg = "Không thể lấy nội dung từ đường dẫn website: " . $urlToFetch;
                        $conn->query("UPDATE ai_training_docs SET status = 'error' WHERE id = $id");
                        continue;
                    }
                } else {
                    $rawText = $contentField;
                }
            } else {
                // Manual text document
                $rawText = $doc['content'];
            }

            if (empty($rawText)) {
                $errorMsg = "Nội dung tài liệu trống";
                $conn->query("UPDATE ai_training_docs SET status = 'error' WHERE id = $id");
                continue;
            }

            // Save the extracted text back into `content` in the database to display in preview mode
            $upStmt = $conn->prepare("UPDATE ai_training_docs SET content = ? WHERE id = ?");
            if ($upStmt) {
                $upStmt->bind_param("si", $rawText, $id);
                $upStmt->execute();
                $upStmt->close();
            }

            // Delete existing chunks for this doc first to prevent duplication
            $conn->query("DELETE FROM ai_training_chunks WHERE doc_id = $id");

            // 2. Chunk text
            $chunks = chunk_text($rawText, $chunkSize, $chunkOverlap);

            // 3. Generate embeddings in batches of 100 and save chunks
            $hasError = false;
            $chunkBatches = array_chunk($chunks, 100);
            
            foreach ($chunkBatches as $batchIdx => $batchChunks) {
                $batchChunks = array_values(array_filter(array_map('trim', $batchChunks)));
                if (empty($batchChunks)) continue;

                $vectors = generate_batch_embeddings($batchChunks, $apiKey);

                if (empty($vectors) || count($vectors) !== count($batchChunks)) {
                    $hasError = true;
                    break;
                }

                foreach ($batchChunks as $idx => $chunk) {
                    $vector = $vectors[$idx];
                    if ($vector === null) {
                        $hasError = true;
                        break;
                    }
                    $vectorJson = json_encode($vector);
                    $chunkIndex = ($batchIdx * 100) + $idx;

                    // Calculate vector norm
                    $vectorNorm = 0.0;
                    if (is_array($vector)) {
                        foreach ($vector as $v) {
                            $vectorNorm += $v * $v;
                        }
                        $vectorNorm = sqrt($vectorNorm);
                    }

                    $cStmt = $conn->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (1, ?, ?, ?, ?, ?)");
                    if ($cStmt) {
                        $cStmt->bind_param("iissd", $id, $chunkIndex, $chunk, $vectorJson, $vectorNorm);
                        $cStmt->execute();
                        $cStmt->close();
                    }
                }
                if ($hasError) break;
            }

            if ($hasError) {
                $errorMsg = "Lỗi khi gọi API tạo Vector Embedding của Google Gemini.";
                $conn->query("UPDATE ai_training_docs SET status = 'error' WHERE id = $id");
            } else {
                $conn->query("UPDATE ai_training_docs SET status = 'trained' WHERE id = $id");
                $successCount++;
            }
        }

        if ($successCount > 0) {
            echo json_encode(['success' => true, 'message' => "Đã hoàn tất huấn luyện thành công $successCount tài liệu!"]);
        } else {
            echo json_encode(['success' => false, 'message' => !empty($errorMsg) ? $errorMsg : 'Huấn luyện thất bại']);
        }
    }
    elseif ($actionType === 'upload_training_file') {
        if (!isset($_FILES['file'])) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy file tải lên']);
            exit;
        }
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(['success' => false, 'message' => 'Lỗi tải file: ' . $file['error']]);
            exit;
        }

        $uploadDir = __DIR__ . '/../uploads/tenant_1/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $cleanName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $file['name']);
        $filename = time() . '_' . uniqid() . '_' . $cleanName;
        $targetPath = $uploadDir . $filename;

        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            $relativeUrl = '/backend/uploads/tenant_1/' . $filename;
            
            $content = '';
            if (strtolower($ext) === 'txt') {
                $content = file_get_contents($targetPath);
            } else {
                $content = "Tài liệu đính kèm: " . $file['name'];
            }

            $parentId = (int)($_POST['folder_id'] ?? 0);
            $name = $file['name'];
            $source_type = 'file';
            $file_size = $file['size'];

            $stmt = $conn->prepare("INSERT INTO ai_training_docs (name, content, source_type, parent_id, file_path, file_size, created_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
            $stmt->bind_param("sssisds", $name, $content, $source_type, $parentId, $relativeUrl, $file_size, $createdBy);
            $stmt->execute();
            $stmt->close();

            echo json_encode(['success' => true, 'message' => 'Đã tải lên tài liệu thành công']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Không thể lưu file trên máy chủ']);
        }
    }
    else {
        echo json_encode(['success' => false, 'message' => 'Thao tác không được hỗ trợ']);
    }
} catch (Exception $ex) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $ex->getMessage()]);
}
