<?php
// backend/migrate_ai_tokens.php
// Script to migrate historical AI Gemini token usage from JSONL dataset file.

require_once __DIR__ . '/db_connect.php';

// Safe check: Limit access to admin or assistant sessions (or check authorization)
// Since this is run directly, we'll allow CLI execution, or check local/server environment
$isCli = (php_sapi_name() === 'cli');
$apply = (isset($_GET['run']) && $_GET['run'] === '1') || ($isCli && in_array('--apply', $argv));

$datasetPath = __DIR__ . '/ai_datasets__KoZariKNOmfz7IP84PN-Aw_2026-05-29T15_05_31.127Z.jsonl';

header("Content-Type: text/html; charset=utf-8");

echo "<html><head><title>AI Token Migration Utility</title>";
echo "<style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto; color: #334155; }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
    .badge-info { background: #e0f2fe; color: #0369a1; }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-warning { background: #fef9c3; color: #a16207; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.875rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; }
    .btn { display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; }
    .btn:hover { background: #4338ca; }
    .btn-warn { background: #dc2626; }
    .btn-warn:hover { background: #b91c1c; }
</style></head><body>";

echo "<h1>📥 Công cụ Đồng bộ Token AI lịch sử</h1>";

if (!file_exists($datasetPath)) {
    echo "<div class='card' style='border-color: #fca5a5; background: #fef2f2; color: #991b1b;'>";
    echo "<strong>❌ Lỗi:</strong> Không tìm thấy tệp dữ liệu JSONL tại đường dẫn:<br><code>" . htmlspecialchars($datasetPath) . "</code>";
    echo "</div>";
    echo "</body></html>";
    exit();
}

$handle = fopen($datasetPath, 'r');
if (!$handle) {
    echo "❌ Lỗi: Không thể đọc tệp dữ liệu.";
    echo "</body></html>";
    exit();
}

// Retrieve total leads in DB with AI evaluation and no tokens before we do any updates
$zeroTokenLeadsMap = [];
$fallbackRes = $conn->query("SELECT id FROM leads WHERE ai_screener_status IN ('passed', 'failed') AND ai_total_tokens = 0");
if ($fallbackRes) {
    while ($row = $fallbackRes->fetch_assoc()) {
        $zeroTokenLeadsMap[(int)$row['id']] = true;
    }
}
$fallbackCount = count($zeroTokenLeadsMap);
$matchedZeroTokenCount = 0;

$totalLines = 0;
$systemPromptsCount = 0;
$matchedCount = 0;
$skippedCount = 0;
$updatedCount = 0;
$estimatedTotalTokens = 0;

$matchedLeads = [];

while (($line = fgets($handle)) !== false) {
    $totalLines++;
    $item = json_decode($line, true);
    if (!$item) continue;

    // 1. Filter: Check if prompt contains our AI Pre-screener signature
    $promptText = $item['request']['contents'][0]['parts'][0]['text'] ?? '';
    if (strpos($promptText, 'Bạn là Trợ lý AI có nhiệm vụ đánh giá dữ liệu khách hàng') === false) {
        $skippedCount++;
        continue; // Skip other prompts (Tarot, chatbot, etc.)
    }

    $systemPromptsCount++;

    // 2. Extract AI response text
    $responseText = $item['response'][0]['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (empty($responseText)) continue;

    // Clean markdown block
    $cleanResponse = trim($responseText);
    if (preg_match('/^```json\s*([\s\S]*?)\s*```$/i', $cleanResponse, $m)) {
        $cleanResponse = trim($m[1]);
    }

    $resData = json_decode($cleanResponse, true);
    if (!$resData) {
        if (preg_match('/\{[\s\S]*\}/', $cleanResponse, $matches)) {
            $resData = json_decode($matches[0], true);
        }
    }

    if (!is_array($resData)) continue;

    // Find status and reason
    $aiStatus = '';
    $aiReason = '';
    foreach ($resData as $k => $v) {
        $kLower = strtolower($k);
        if ($kLower === 'status') $aiStatus = trim($v);
        else if ($kLower === 'reason' || $kLower === 'lý do' || $kLower === 'ly do') $aiReason = trim($v);
    }

    if (empty($aiReason)) continue;

    // Calculate/Estimate tokens
    // Note: The prompt text stored in the dataset file is truncated, but the actual prompt sent to Gemini 
    // always includes the full system prompt & rules template (~1000 characters / 380 tokens).
    $promptTokens = 380;
    $completionTokens = max(35, round(strlen($responseText) / 2.5));
    $totalTokens = $promptTokens + $completionTokens;
    $estimatedTotalTokens += $totalTokens;

    // Match lead in DB
    $stmtFind = $conn->prepare("SELECT id, name, phone, created_at, ai_screener_status, ai_total_tokens FROM leads WHERE ai_evaluation = ? LIMIT 1");
    if ($stmtFind) {
        $stmtFind->bind_param("s", $aiReason);
        $stmtFind->execute();
        $resFind = $stmtFind->get_result();
        if ($resFind && $rowLead = $resFind->fetch_assoc()) {
            $matchedCount++;
            $leadId = (int)$rowLead['id'];
            if (isset($zeroTokenLeadsMap[$leadId])) {
                $matchedZeroTokenCount++;
            }
            
            $matchedLeads[] = [
                'id' => $leadId,
                'name' => $rowLead['name'],
                'phone' => $rowLead['phone'],
                'created_at' => $rowLead['created_at'],
                'status' => $rowLead['ai_screener_status'],
                'current_tokens' => (int)$rowLead['ai_total_tokens'],
                'new_tokens' => $totalTokens,
                'prompt_tokens' => $promptTokens,
                'completion_tokens' => $completionTokens,
                'reason' => $aiReason
            ];

            if ($apply) {
                $stmtUpd = $conn->prepare("UPDATE leads SET ai_prompt_tokens = ?, ai_completion_tokens = ?, ai_total_tokens = ? WHERE id = ?");
                if ($stmtUpd) {
                    $stmtUpd->bind_param("iiii", $promptTokens, $completionTokens, $totalTokens, $leadId);
                    $stmtUpd->execute();
                    $stmtUpd->close();
                    $updatedCount++;
                }
            }
        }
        $stmtFind->close();
    }
}
fclose($handle);

echo "<div class='card'>";
echo "<h3>📊 Báo cáo Phân tích Tệp Dữ liệu</h3>";
echo "<ul>";
echo "<li><strong>Tổng số dòng trong file JSONL:</strong> " . $totalLines . " dòng</li>";
echo "<li><strong>Số lượng yêu cầu của Domation AI Screener (đạt chuẩn):</strong> " . $systemPromptsCount . "</li>";
echo "<li><strong>Số lượng yêu cầu bị bỏ qua (Tarot/Khác):</strong> " . $skippedCount . "</li>";
echo "<li><strong>Số lượng Lead trùng khớp trong Database:</strong> " . $matchedCount . "</li>";
echo "<li><strong>Ước lượng tổng số Token sẽ đồng bộ:</strong> " . number_format($estimatedTotalTokens) . " tokens</li>";
echo "</ul>";
echo "</div>";

if ($apply) {
    echo "<div class='card' style='background: #dcfce7; border-color: #bbf7d0; color: #15803d;'>";
    echo "<h3>✅ Kết quả Chạy Thực tế (Live Run)</h3>";
    echo "<p>Đã thực hiện cập nhật thành công <strong>" . $updatedCount . "</strong> dòng dữ liệu Lead trong cơ sở dữ liệu!</p>";
    echo "</div>";
} else {
    echo "<div class='card' style='background: #fef9c3; border-color: #fef08a; color: #a16207;'>";
    echo "<h3>⚠️ Chế độ Kiểm tra (Dry Run)</h3>";
    echo "<p>Bạn đang ở chế độ xem trước. Chưa có bất kỳ thay đổi nào được ghi nhận vào cơ sở dữ liệu.</p>";
    echo "<p style='margin-top: 1rem;'>Nếu các số liệu trên chính xác, hãy nhấn nút dưới đây để chạy cập nhật thực tế:</p>";
    $urlParam = $isCli ? "Chạy bằng CLI: php backend/migrate_ai_tokens.php --apply" : "<a href='?run=1' class='btn btn-warn'>Xác nhận và Áp dụng Migrate 🚀</a>";
    echo "<div style='margin-top: 1rem;'>" . $urlParam . "</div>";
    echo "</div>";
}

// Fallback estimation preview (using pre-update counts)
$actualFallbackCount = max(0, $fallbackCount - $matchedZeroTokenCount);

echo "<div class='card'>";
echo "<h3>💡 Thông tin bổ sung</h3>";
echo "<p>Tổng số Lead đã được AI đánh giá trong DB: <strong>" . $fallbackCount . "</strong></p>";
echo "<ul>";
echo "<li>Số lead khớp trong file JSONL (sẽ lấy token chi tiết): <strong>" . $matchedCount . "</strong></li>";
echo "<li>Số lead không có trong file JSONL (sẽ lấy token mặc định): <strong>" . $actualFallbackCount . "</strong></li>";
echo "</ul>";

if ($actualFallbackCount > 0) {
    echo "<p>Nếu muốn, bạn có thể chạy bổ sung cơ chế gán token ước lượng mặc định (380 prompt / 40 completion) cho " . $actualFallbackCount . " lead này.</p>";
    if ($apply) {
        $conn->query("UPDATE leads SET ai_prompt_tokens = 380, ai_completion_tokens = 40, ai_total_tokens = 420 WHERE ai_screener_status IN ('passed', 'failed') AND ai_total_tokens = 0");
        echo "<p style='color: #15803d;'>➡️ Đã cập nhật ước lượng mặc định cho " . $actualFallbackCount . " lead còn lại!</p>";
    }
}
echo "</div>";

if (!empty($matchedLeads)) {
    echo "<h3>📋 Chi tiết danh sách Lead trùng khớp (" . count($matchedLeads) . ")</h3>";
    echo "<table>";
    echo "<thead><tr><th>ID</th><th>Họ tên</th><th>Số ĐT</th><th>Ngày tạo</th><th>Trạng thái AI</th><th>Số Token ước tính</th></tr></thead>";
    echo "<tbody>";
    foreach ($matchedLeads as $lead) {
        echo "<tr>";
        echo "<td>" . $lead['id'] . "</td>";
        echo "<td>" . htmlspecialchars($lead['name'] ?? 'N/A') . "</td>";
        echo "<td>" . htmlspecialchars($lead['phone'] ?? 'N/A') . "</td>";
        echo "<td>" . $lead['created_at'] . "</td>";
        echo "<td><span class='badge " . ($lead['status'] === 'passed' ? 'badge-success' : 'badge-warning') . "'>" . strtoupper($lead['status']) . "</span></td>";
        echo "<td>" . number_format($lead['new_tokens']) . " (" . $lead['prompt_tokens'] . " In / " . $lead['completion_tokens'] . " Out)</td>";
        echo "</tr>";
    }
    echo "</tbody></table>";
}

echo "</body></html>";
