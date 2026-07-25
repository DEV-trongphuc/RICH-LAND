<?php
// backend/controllers/ai_chat_handler.php
// RICH LAND DATA CRM - AI Chatbot controller handler

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $message = trim($input['message'] ?? '');
    $history = $input['history'] ?? [];

    if (empty($message)) {
        echo json_encode(['success' => false, 'message' => 'Tin nhắn không được để trống']);
        exit;
    }

    $apiKey = get_system_setting($conn, 'gemini_api_key');
    if (empty($apiKey)) {
        echo json_encode([
            'success' => true,
            'data' => [
                'reply' => "⚠️ **Vui lòng cấu hình Gemini API Key trước khi sử dụng Chatbot!**"
            ]
        ]);
        exit;
    }

    // Default parameters for Gemini
    $model = "gemini-2.5-flash";

    // SQL execution helper closure inside this handler scope
    $executeSafeSql = function($conn, $sql) {
        $sql = trim($sql);
        if (empty($sql)) {
            return ['error' => 'Query is empty'];
        }

        // Enforce safety: Allow ONLY SELECT queries
        $firstWord = strtoupper(explode(' ', $sql)[0]);
        if ($firstWord !== 'SELECT' && $firstWord !== 'SHOW' && $firstWord !== 'DESCRIBE') {
            return ['error' => 'Security policy restriction: Only read-only SELECT queries are allowed.'];
        }

        // Prevent destructive SQL commands
        $blacklist = ['insert', 'update', 'delete', 'drop', 'truncate', 'alter', 'create', 'replace', 'grant', 'revoke'];
        foreach ($blacklist as $word) {
            if (stripos($sql, $word) !== false) {
                // If it is in quotes or comments, it might trigger false positive, but safety first
                return ['error' => 'Security policy restriction: Forbidden keyword detected - ' . $word];
            }
        }

        // Limit results to 200 max to prevent PHP memory exhaustion
        if (stripos($sql, 'LIMIT') === false) {
            $sql = rtrim($sql, ';') . ' LIMIT 200';
        }

        $res = $conn->query($sql);
        if (!$res) {
            return ['error' => 'SQL Error: ' . $conn->error];
        }

        if (is_bool($res)) {
            return ['success' => $res];
        }

        $rows = [];
        while ($row = $res->fetch_assoc()) {
            // Remove sensitive fields
            unset($row['password']);
            unset($row['password_hash']);
            unset($row['confirm_token']);
            unset($row['token']);
            $rows[] = $row;
        }

        return [
            'success' => true,
            'rows' => $rows,
            'count' => count($rows)
        ];
    };

    // Enhanced system instruction detailing database schemas
    $systemInstruction = "Bạn là Trợ lý AI Rich Land, một chatbot hỗ trợ đắc lực tích hợp sẵn trong hệ thống quản trị phân chia lead dữ liệu Rich Land.\n" .
        "Hãy trả lời người dùng một cách thân thiện, chuyên nghiệp, bằng tiếng Việt. Sử dụng markdown (in đậm, danh sách, bảng biểu) để câu trả lời rõ ràng.\n\n" .
        "QUY TẮC PHẢN HỒI (BẮT BUỘC): BẠN KHÔNG ĐƯỢC CHÀO HỎI LAN MAN HOẶC HỎI LẠI NGƯỜI DÙNG TRƯỚC KHI TRUY VẤN. BẤT KỲ CÂU HỎI NÀO CÓ THỂ CẦN TRA CỨU DỮ LIỆU, BẠN PHẢI GỌI CÔNG CỤ `execute_readonly_query` NGAY LẬP TỨC TRONG LƯỢT ĐẦU TIÊN ĐỂ TRA CỨU. NẾU BẠN KHÔNG GỌI CÔNG CỤ MÀ TRẢ LỜI NGAY HOẶC HỎI LẠI, ĐÓ LÀ LỖI VẬN HÀNH NGHIÊM TRỌNG.\n\n" .
        "QUY TẮC HIỂU NGÔN NGỮ VIẾT TẮT TIẾNG VIỆT:\n" .
        "- Người dùng thường dùng viết tắt: 'v' hoặc 'vậy' (KHÔNG phải là tên người 'V'), 'ko' hoặc 'k' (không), 'tvv' hoặc 'sale' (tư vấn viên), 'nv' (nhân viên), 'đc' (được), 'tks' (cảm ơn), 'ns' (nhận số/chia số).\n" .
        "- Nếu người dùng hỏi 'tại sao Uyên nhiều data hơn v', chữ 'v' ở đây nghĩa là 'vậy' chứ không phải là một người tên V. Hãy tự hiểu là so sánh Uyên với những tư vấn viên khác hoặc so với mặt bằng chung của cả đội nhận data.\n\n" .
        "BẠN CÓ QUYỀN TRUY VẤN DỮ LIỆU THỜI GIAN THỰC qua công cụ `execute_readonly_query`. Hãy sử dụng công cụ này khi người dùng hỏi các câu hỏi cần thông tin từ cơ sở dữ liệu (ví dụ: thống kê hôm nay, số liệu của sale, trạng thái ticket đền bù, lịch sử đồng bộ Google Sheets, hoặc lịch sử hoạt động hệ thống).\n\n" .
        "SƠ ĐỒ CƠ SỞ DỮ LIỆU HỆ THỐNG:\n" .
        "1. accounts: Thông tin tài khoản quản trị (id, username, role ['admin', 'assistant', 'viewer'], name, email, zalo_chat_id, is_confirmed, last_login, avatar) - Password hash và token are omitted/redacted.\n" .
        "2. consultants: Thông tin tư vấn viên / sales nhận số (id, name, email, status ['active', 'inactive', 'leave'], leave_start, leave_end, zalo_chat_id, vacation_mode, created_at)\n" .
        "3. distribution_rounds: Các vòng xoay chia số (id, round_name, description, cc_emails, last_assigned_consultant_id, is_active)\n" .
        "4. round_consultants: Danh sách sale nằm trong vòng xoay (round_id, consultant_id, is_active, receive_ratio, skip_count, compensation_count, data_per_turn, current_turn_remaining)\n" .
        "5. leads: Dữ liệu khách hàng được tiếp nhận (id, phone, email, name, source, type, note, last_interaction_date, assigned_to (FK consultants.id), connection_id (FK sheet_connections.id), created_at)\n" .
        "6. distribution_logs: Nhật ký kết quả định tuyến/chia lead cho sale (id, lead_id, assigned_to (FK consultants.id), round_id, status (ví dụ: 'assigned' (đã chia), 'compensation' (chia đền bù), 'rule_6_month', 'duplicate', 'pending_work_hours', 'blacklisted', 'error', 'no_consultant'), message, received_at)\n" .
        "7. data_reports: Danh sách ticket báo lỗi đền bù của sale (id, lead_id, consultant_id, round_id, reason, status ['pending', 'approved', 'rejected'], created_at, resolved_at, reject_reason, approval_reason)\n" .
        "8. routing_rules: Các quy tắc phân phối định tuyến (id, connection_id, target_round_id, condition_column, condition_operator, condition_value, priority, conditions_json, logical_operator)\n" .
        "9. sheet_connections: Kết nối các nguồn Google Sheets (id, sheet_name, spreadsheet_id, connection_type, is_active, sync_interval, last_sync_at, sync_status, email_template, require_both_contact, sync_mode, is_initialized, is_silent, created_at)\n" .
        "10. admin_logs: Nhật ký hoạt động quản trị của các tài khoản admin (id, account_id, action, details (JSON), ip_address, created_at)\n" .
        "QUY TẮC CẤM HỎI NGƯỢC LẠI NGƯỜI DÙNG (CỰC KỲ QUAN TRỌNG):\n" .
        "- TUYỆT ĐỐI NGHIÊM CẤM hỏi lại người dùng để làm rõ khoảng thời gian, yêu cầu chọn mốc thời gian ('hôm nay', 'tuần này', 'tháng này') hay yêu cầu ID/thông tin thêm. Bạn phải CHỦ ĐỘNG suy đoán và chạy truy vấn SQL ngay lập tức.\n" .
        "- Khi người dùng hỏi bất kỳ câu hỏi nào liên quan đến số liệu hoặc so sánh data (ví dụ: 'Tại sao Phúc ít số', 'Sao Uyên nhiều data', 'data của Đan hôm nay thế nào'), bạn PHẢI tự động truy vấn dữ liệu hôm nay (`received_at >= CURDATE()`) làm mặc định. Nếu không có dữ liệu hôm nay, hãy tự động truy vấn 7 ngày gần nhất, hoặc toàn bộ lịch sử, và trả lời ngay kết quả phân tích mà không được xin phép hay hỏi ý kiến người dùng.\n\n" .
        "QUY TẮC TRA CỨU TƯ VẤN VIÊN (SALE / TVV):\n" .
        "- Hãy CHỦ ĐỘNG dùng SQL tìm kiếm tư vấn viên trong bảng `consultants` bằng tên riêng (ví dụ: `name LIKE '%Phúc%'` hoặc `name LIKE '%Uyên%'`). Sau khi tìm được ID tư vấn viên, tiếp tục dùng ID đó để truy vấn.\n\n" .
        "QUY TẮC PHÂN TÍCH KHI HỎI VỀ SỐ LƯỢNG DATA CỦA TƯ VẤN VIÊN (Ví dụ: \"Tại sao Phúc chỉ có 15 data?\"):\n" .
        "- Khi người dùng thắc mắc về số lượng hoặc lý do phân phối của một tư vấn viên, bạn PHẢI gọi công cụ `execute_readonly_query` ngay lập tức để kiểm tra 3 điểm sau:\n" .
        "  1. Trạng thái trong bảng `consultants`: Xem cột `status` (có phải 'leave' hoặc 'inactive' không) và cột `vacation_mode` (có phải 1 không).\n" .
        "  2. Cấu hình trong các vòng xoay ở bảng `round_consultants`: Kiểm tra xem có bị tắt hoạt động (`is_active = 0`) không, và tỷ lệ nhận số `receive_ratio` là bao nhiêu so với các sale khác trong cùng vòng xoay đó.\n" .
        "  3. Nhật ký phân phối trong `distribution_logs`: Đếm số lượng data thực tế đã phân phối thành công (`status IN ('assigned', 'compensation')`) và số lượt bị bỏ qua hoặc gặp lỗi của tư vấn viên này.\n" .
        "- Tổng hợp câu trả lời cụ thể, đi thẳng vào vấn đề dựa trên kết quả SQL thu được (ví dụ: giải thích cụ thể rằng tỉ lệ nhận của Phúc là 1 còn Uyên là 2, hoặc Phúc đang bật tạm ngưng nhận số). Trả lời ngắn gọn, súc tích, tránh lan man hay liệt kê lý do lý thuyết nếu chưa đối chiếu dữ liệu thực tế.\n\n" .
        "QUY TẮC KHÔNG ĐƯỢC ĐẾM HOẶC THỐNG KÊ DATA SILENT (ĐỒNG BỘ ẨN):\n" .
        "- TUYỆT ĐỐI KHÔNG ĐƯỢC đếm, hiển thị hoặc thống kê các data có trạng thái 'silent' (đồng bộ ẩn/chỉ check trùng) trong bất kỳ số liệu hay báo cáo nào của tư vấn viên. Trạng thái 'silent' KHÔNG phải là data thực tế được chia.\n" .
        "- Khi tính lượng data nhận được của một tư vấn viên, bạn KHÔNG ĐƯỢC đếm trực tiếp từ bảng `leads` (vì bảng `leads` chứa cả các data đồng bộ ẩn từ Google Sheets có `is_silent = 1` của sheet_connections). Bạn BẮT BUỘC phải đếm từ bảng `distribution_logs` với điều kiện `status IN ('assigned', 'compensation')`. Tuyệt đối không tính các log có trạng thái `status = 'silent'` hoặc các lead thuộc kết nối có `is_silent = 1`.\n\n" .
        "LƯU Ý KHI VIẾT TRUY VẤN SQL:\n" .
        "- Luôn viết truy vấn SELECT hợp lệ cho MariaDB.\n" .
        "- Chỉ đếm các dòng trong bảng `distribution_logs` có trạng thái thành công (`status IN ('assigned', 'compensation')`) để tính lượng data thực tế được nhận.\n" .
        "- Sử dụng các phép JOIN để kết nối các bảng lấy tên của Sale thay vì chỉ hiển thị ID.\n" .
        "- Tránh trả về dữ liệu quá dài. Hãy sử dụng COUNT, SUM, GROUP BY, ORDER BY, LIMIT để thu gọn dữ liệu trước khi trả về.\n" .
        "- Luôn xử lý khoảng thời gian dựa trên các hàm ngày tháng của SQL (ví dụ: `received_at >= CURDATE()` hoặc `received_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`).\n" .
        "- Giải thích câu trả lời của bạn một cách rõ ràng dựa trên kết quả thu thập được.";

    $systemInstruction .= "\n\nQUY TẮC PHẢN HỒI QUAN TRỌNG: TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP SỬ DỤNG BẤT KỲ EMOJI (BIỂU TƯỢNG CẢM XÚC) NÀO TRONG PHẢN HỒI CỦA BẠN. Chỉ sử dụng chữ viết tiếng Việt chuẩn và định dạng markdown thông thường để trả lời.";

    // Retrieve RAG settings and context
    $ragSettings = [];
    $rStmt = $conn->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'rag_settings' LIMIT 1");
    if ($rStmt) {
        $rStmt->execute();
        $rRes = $rStmt->get_result()->fetch_assoc();
        $rStmt->close();
        if ($rRes && !empty($rRes['setting_value'])) {
            $ragSettings = json_decode($rRes['setting_value'], true);
        }
    }
    $ragEnabled = isset($ragSettings['is_enabled']) ? (int)$ragSettings['is_enabled'] : 1;

    $ragContext = '';
    if ($ragEnabled === 1) {
        $normalizedMsg = mb_strtolower(trim($message));
        $cacheKey = md5('tenant_1|' . $normalizedMsg);
        
        $cacheHit = false;
        $stmt = $conn->prepare("SELECT results FROM ai_rag_search_cache WHERE query_hash = ? AND created_at > (NOW() - INTERVAL 7 DAY) LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("s", $cacheKey);
            $stmt->execute();
            $res = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($res && !empty($res['results'])) {
                $ragContext = $res['results'];
                $cacheHit = true;
            }
        }

        if (!$cacheHit) {
            // 1. Generate vector embedding for the user's message using the new gemini-embedding-001
            $queryVector = generate_embedding($message, $apiKey);

            if (!empty($queryVector)) {
                // 2. Build FTS terms and relaxed query for Boolean search
                $cleanQuery = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $message);
                $queryWords = array_slice(array_filter(explode(' ', mb_strtolower($cleanQuery)), function ($w) {
                    return mb_strlen($w) >= 2;
                }), 0, 10);
                $relaxedQuery = "";
                foreach ($queryWords as $w) {
                    $relaxedQuery .= "$w* ";
                }
                $relaxedQuery = trim($relaxedQuery);

                // 3. Query candidate pool from database using FTS (Natural Language + Boolean)
                // Limit candidate size to prevent OOM
                $cStmt = $conn->prepare("
                    (SELECT c.id, c.content, c.vector, c.vector_norm, d.name AS doc_name, d.tags, d.source_type, COALESCE(d.updated_at, d.created_at) as doc_updated_at,
                        MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE) as fts_score
                    FROM ai_training_chunks c
                    JOIN ai_training_docs d ON c.doc_id = d.id
                    WHERE d.tenant_id = 1 AND d.is_active = 1 AND d.status = 'trained'
                    ORDER BY fts_score DESC
                    LIMIT 150)
                    UNION
                    (SELECT c.id, c.content, c.vector, c.vector_norm, d.name AS doc_name, d.tags, d.source_type, COALESCE(d.updated_at, d.created_at) as doc_updated_at,
                        MATCH(c.content) AGAINST(? IN BOOLEAN MODE) as fts_score
                    FROM ai_training_chunks c
                    JOIN ai_training_docs d ON c.doc_id = d.id
                    WHERE d.tenant_id = 1 AND d.is_active = 1 AND d.status = 'trained'
                    ORDER BY fts_score DESC
                    LIMIT 100)
                ");

                if ($cStmt) {
                    $cStmt->bind_param("ss", $cleanQuery, $relaxedQuery);
                    $cStmt->execute();
                    $cRes = $cStmt->get_result();
                    
                    $similarityThreshold = isset($ragSettings['similarity_threshold']) ? (float)$ragSettings['similarity_threshold'] : 0.45;
                    $topK = isset($ragSettings['top_k']) ? (int)$ragSettings['top_k'] : 8;

                    $rawResults = [];
                    $maxFtsScore = 1.0;
                    while ($cRow = $cRes->fetch_assoc()) {
                        $cRow['fts_score'] = (float)($cRow['fts_score'] ?? 0);
                        if ($cRow['fts_score'] > $maxFtsScore) {
                            $maxFtsScore = $cRow['fts_score'];
                        }
                        $rawResults[] = $cRow;
                    }
                    $cStmt->close();

                    // Compute cosine similarity for the candidate pool only
                    $vectorScores = [];
                    $normQ = 0.0;
                    foreach ($queryVector as $val) {
                        $normQ += $val * $val;
                    }
                    $normQ = sqrt($normQ);

                    foreach ($rawResults as $row) {
                        $id = $row['id'];
                        $chunkVector = json_decode($row['vector'], true);
                        $normB = (float)($row['vector_norm'] ?? 0.0);
                        
                        if (is_array($chunkVector)) {
                            // Self-healing fallback: Calculate normB dynamically for old chunks and update DB
                            if ($normB <= 0.0) {
                                foreach ($chunkVector as $v) {
                                    $normB += $v * $v;
                                }
                                $normB = sqrt($normB);
                                
                                if ($normB > 0.0) {
                                    $upStmt = $conn->prepare("UPDATE ai_training_chunks SET vector_norm = ? WHERE id = ?");
                                    if ($upStmt) {
                                        $upStmt->bind_param("di", $normB, $id);
                                        $upStmt->execute();
                                        $upStmt->close();
                                    }
                                }
                            }

                            if ($normB > 0.0 && $normQ > 0.0) {
                                $dotProduct = 0.0;
                                $dim = count($queryVector);
                                for ($i = 0; $i < $dim; $i++) {
                                    $dotProduct += $queryVector[$i] * $chunkVector[$i];
                                }
                                $sim = $dotProduct / ($normQ * $normB);
                                $vectorScores[$id] = $sim;
                            } else {
                                $vectorScores[$id] = 0.0;
                            }
                        } else {
                            $vectorScores[$id] = 0.0;
                        }
                    }

                    // Rank candidates by Vector and FTS separately to get Ranks for RRF
                    $rankedByVector = $rawResults;
                    uasort($rankedByVector, function ($a, $b) use ($vectorScores) {
                        $scoreA = $vectorScores[$a['id']] ?? 0;
                        $scoreB = $vectorScores[$b['id']] ?? 0;
                        return $scoreB <=> $scoreA;
                    });

                    $rankedByKeyword = $rawResults;
                    uasort($rankedByKeyword, function ($a, $b) {
                        return $b['fts_score'] <=> $a['fts_score'];
                    });

                    $vectorRanks = [];
                    $rankIdx = 1;
                    foreach ($rankedByVector as $r) {
                        $vectorRanks[$r['id']] = $rankIdx++;
                    }

                    $keywordRanks = [];
                    $rankIdx = 1;
                    foreach ($rankedByKeyword as $r) {
                        $keywordRanks[$r['id']] = $rankIdx++;
                    }

                    // Reciprocal Rank Fusion (RRF) reranking
                    $k = 60; // Standard RRF constant
                    $candidates = [];
                    $messageLower = mb_strtolower($message);

                    foreach ($rawResults as $row) {
                        $id = $row['id'];
                        $rankV = $vectorRanks[$id] ?? 999;
                        $rankK = $keywordRanks[$id] ?? 999;

                        $rrfScore = (1 / ($k + $rankV)) + (1 / ($k + $rankK));

                        // Consolidate final score: normalize RRF score (from 0.03 range) to 0-100 range
                        $finalScore = $rrfScore * 1800; // standard RRF scale factor

                        // Recency Boost
                        $recencyBoost = 1.0;
                        if (!empty($row['doc_updated_at'])) {
                            $updatedTs = strtotime($row['doc_updated_at']);
                            if ($updatedTs > 0) {
                                $daysSinceUpdate = max(0, (time() - $updatedTs) / 86400);
                                if ($daysSinceUpdate <= 7) {
                                    $recencyBoost = 1.30;
                                } elseif ($daysSinceUpdate <= 30) {
                                    $recencyBoost = 1.15;
                                } elseif ($daysSinceUpdate <= 90) {
                                    $recencyBoost = 1.05;
                                }
                            }
                        }
                        $finalScore *= $recencyBoost;

                        // Match boosts
                        $multiplier = 1.0;
                        $contentLower = mb_strtolower($row['content']);
                        
                        // Exact Phrase
                        if (mb_strlen($message) > 10 && mb_strpos($contentLower, $messageLower) !== false) {
                            $multiplier *= 1.5;
                        }
                        // Doc Name match
                        if (stripos($row['doc_name'], $message) !== false) {
                            $multiplier *= 1.25;
                        }
                        // Tag Match
                        if (!empty($row['tags']) && stripos($row['tags'], $message) !== false) {
                            $multiplier *= 1.35;
                        }
                        
                        $finalScore *= $multiplier;

                        // Only filter if the vector score is above similarity threshold or RRF ranking is extremely high
                        $vectorScore = $vectorScores[$id] ?? 0.0;
                        if ($vectorScore >= $similarityThreshold || $finalScore > 50) {
                            $candidates[] = [
                                'content' => $row['content'],
                                'doc_name' => $row['doc_name'],
                                'tags' => $row['tags'],
                                'source_type' => $row['source_type'],
                                'score' => $finalScore,
                                'vector_score' => $vectorScore
                            ];
                        }
                    }

                    // Sort candidates by final consolidated score
                    usort($candidates, function($a, $b) {
                        return $b['score'] <=> $a['score'];
                    });

                    // Select top K candidates and format the text
                    $selectedCandidates = array_slice($candidates, 0, $topK);
                    if (!empty($selectedCandidates)) {
                        $docsText = [];
                        foreach ($selectedCandidates as $idx => $cand) {
                            $docTypeLabel = ($cand['source_type'] === 'web') ? 'Website' : (($cand['source_type'] === 'file') ? 'Tệp đính kèm' : 'Văn bản hướng dẫn');
                            $pctScore = round($cand['vector_score'] * 100, 1);
                            $docText = "=== [ĐOẠN TRÍ THỨC KHỚP THỨ " . ($idx + 1) . " - ĐỘ TƯƠNG ĐỒNG VECTOR: " . $pctScore . "%] ===\n" .
                                       "Nguồn tài liệu: " . $cand['doc_name'] . " (" . $docTypeLabel . ")\n" .
                                       "Thẻ phân loại: " . $cand['tags'] . "\n" .
                                       "Nội dung:\n" . $cand['content'] . "\n" .
                                       "============================================";
                            $docsText[] = $docText;
                        }
                        $ragContext = implode("\n\n", $docsText);
                    }
                }
            }

            // Save to cache
            if (!empty($ragContext)) {
                $stmt = $conn->prepare("INSERT INTO ai_rag_search_cache (query_hash, results) VALUES (?, ?) ON DUPLICATE KEY UPDATE results = ?");
                if ($stmt) {
                    $stmt->bind_param("sss", $cacheKey, $ragContext, $ragContext);
                    $stmt->execute();
                    $stmt->close();
                }
            }
        }
    }

    if (!empty($ragContext)) {
        $systemInstruction .= "\n\n=== NGỮ CẢNH TRI THỨC ĐỐI CHIẾU THỰC TẾ (RAG) ===\n" .
            "Dưới đây là các phần thông tin tri thức phù hợp nhất được truy vấn từ cơ sở dữ liệu dựa trên độ tương đồng ngữ nghĩa. " .
            "Hãy ưu tiên sử dụng các thông tin này để đối chiếu và trả lời thắc mắc của người dùng:\n" .
            $ragContext;
    }

    $projectContext = trim($input['project_context'] ?? '');
    if (!empty($projectContext)) {
        $systemInstruction .= "\n\n=== NGỮ CẢNH DỰ ÁN / CHIẾN DỊCH KHÁCH HÀNG ĐANG HỎI ===\n" .
            "Dưới đây là toàn bộ thông tin mô tả chi tiết và các liên kết tài liệu liên quan. " .
            "Hãy ưu tiên sử dụng thông tin và liên kết này để trả lời người dùng một cách chính xác nhất. " .
            "Tuyệt đối không tự ý bịa đặt liên kết/link tài liệu không có trong phần này. " .
            "Nếu người dùng hỏi về tài liệu, dự án, hoặc drive link, hãy trích xuất chính xác URL tương ứng bên dưới:\n" .
            $projectContext;
    }

    // Format history for Gemini API
    $contents = [];
    foreach ($history as $h) {
        $contents[] = [
            'role' => $h['role'] === 'user' ? 'user' : 'model',
            'parts' => [['text' => $h['text']]]
        ];
    }
    $contents[] = [
        'role' => 'user',
        'parts' => [['text' => $message]]
    ];

    // Define tools schema
    $tools = [
        [
            'functionDeclarations' => [
                [
                    'name' => 'execute_readonly_query',
                    'description' => 'Thực thi một câu lệnh SQL SELECT an sau trên hệ thống cơ sở dữ liệu để tra cứu thông tin thực tế về leads, tư vấn viên (consultants), cấu hình chia số (rounds), vé lỗi (tickets), nhật ký định tuyến (distribution_logs), hoặc nhật ký quản trị (admin_logs).',
                    'parameters' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'query' => [
                                'type' => 'STRING',
                                'description' => 'Câu lệnh SQL SELECT cần thực thi.'
                            ]
                        ],
                        'required' => ['query']
                    ]
                ]
            ]
        ]
    ];

    $maxTurns = 3;
    $currentTurn = 0;
    $replyText = '';

    while ($currentTurn < $maxTurns) {
        $payload = [
            'contents' => $contents,
            'systemInstruction' => [
                'parts' => [['text' => $systemInstruction]]
            ],
            'tools' => $tools,
            'generationConfig' => [
                'maxOutputTokens' => 8192,
                'temperature' => 0.15
            ]
        ];

        $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $model . ":generateContent?key=" . $apiKey;

        $httpOpts = [
            'http' => [
                'header' => "Content-Type: application/json\r\n",
                'method' => 'POST',
                'content' => json_encode($payload),
                'timeout' => 20,
                'ignore_errors' => true
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true
            ]
        ];
        $contextStream = stream_context_create($httpOpts);
        $response = @file_get_contents($url, false, $contextStream);

        $httpCode = 500;
        if (isset($http_response_header) && is_array($http_response_header) && count($http_response_header) > 0) {
            if (preg_match('/HTTP\/\d\.\d\s+(\d+)/i', $http_response_header[0], $matches)) {
                $httpCode = (int) $matches[1];
            }
        }

        if ($response === false || $httpCode !== 200) {
            $errMessage = "Lỗi kết nối Gemini API (HTTP " . $httpCode . ")";
            if ($response !== false) {
                $errJson = json_decode($response, true);
                if (isset($errJson['error']['message'])) {
                    $errMessage = "Lỗi Gemini: " . $errJson['error']['message'];
                }
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'reply' => "⚠️ **Hệ thống gặp lỗi khi liên kết với Gemini API!**\n\nChi tiết: `" . $errMessage . "`"
                ]
            ]);
            exit;
        }

        $resJson = json_decode($response, true);
        $candidate = $resJson['candidates'][0] ?? null;
        if (!$candidate) {
            $replyText = "Không nhận được phản hồi từ AI.";
            break;
        }

        $parts = $candidate['content']['parts'] ?? [];
        $hasFunctionCall = false;
        $functionCallObj = null;

        foreach ($parts as $part) {
            if (isset($part['functionCall'])) {
                $hasFunctionCall = true;
                $functionCallObj = $part['functionCall'];
                break;
            }
        }

        // Append model's response to contents
        $contents[] = $candidate['content'];

        if ($hasFunctionCall && $functionCallObj) {
            $funcName = $functionCallObj['name'];
            $funcArgs = $functionCallObj['args'] ?? [];

            if ($funcName === 'execute_readonly_query') {
                $sqlQuery = $funcArgs['query'] ?? '';
                $queryResult = $executeSafeSql($conn, $sqlQuery);

                $functionResponsePart = [
                    'functionResponse' => [
                        'name' => $funcName,
                        'response' => [
                            'result' => $queryResult
                        ]
                    ]
                ];

                if (isset($functionCallObj['id'])) {
                    $functionResponsePart['functionResponse']['id'] = $functionCallObj['id'];
                }

                $contents[] = [
                    'role' => 'function',
                    'parts' => [$functionResponsePart]
                ];
            } else {
                $contents[] = [
                    'role' => 'function',
                    'parts' => [
                        [
                            'functionResponse' => [
                                'name' => $funcName,
                                'response' => ['error' => 'Hàm không tồn tại']
                            ]
                        ]
                    ]
                ];
            }

            $currentTurn++;
        } else {
            $replyText = $candidate['content']['parts'][0]['text'] ?? '';
            break;
        }
    }

    if (empty($replyText)) {
        $replyText = "Tôi không nhận được câu trả lời từ AI hoặc quá trình xử lý quá hạn. Vui lòng thử lại.";
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'reply' => $replyText
        ]
    ]);
} catch (Throwable $e) {
    echo json_encode([
        'success' => true,
        'data' => [
            'reply' => "⚠️ **Hệ thống gặp sự cố khi xử lý dữ liệu AI!**\n\nChi tiết lỗi: `" . $e->getMessage() . "`\n\nVui lòng báo lại quản trị viên hệ thống để kiểm tra."
        ]
    ]);
}
