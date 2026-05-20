<?php
// test_landing_page_api.php - Standalone utility to test API Landing Page webhook
require_once 'db_connect.php';

// --- JWT Authentication Check ---
$token = $_GET['token'] ?? '';
$isAuthorized = false;
if (!empty($token)) {
    $parts = explode('.', $token);
    if (count($parts) === 3) {
        list($header, $payload, $signature) = $parts;
        $secret = $_ENV['JWT_SECRET'] ?? 'DOMATION_SECRET_KEY_2026';
        $validSignature = hash_hmac('sha256', $header . "." . $payload, $secret, true);
        $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($validSignature));
        if (hash_equals($base64UrlSignature, $signature)) {
            $decoded = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $payload)), true);
            if (isset($decoded['exp']) && $decoded['exp'] >= time() && ($decoded['role'] ?? '') === 'admin') {
                $isAuthorized = true;
            }
        }
    }
}

if (!$isAuthorized) {
    http_response_code(401);
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chưa xác thực</title></head><body style="background:#0f172a;color:#ef4444;font-family:sans-serif;padding:50px;text-align:center;">';
    echo '<h2>Truy cập bị từ chối 🚫</h2>';
    echo '<p style="color:#94a3b8;">Yêu cầu quyền Administrator. Vui lòng đăng nhập vào hệ thống CRM hoặc truyền tham số ?token=... hợp lệ.</p>';
    echo '<script>
        const localTkn = localStorage.getItem("token") || localStorage.getItem("jwt_token") || sessionStorage.getItem("token");
        if (localTkn) {
            const url = new URL(window.location.href);
            url.searchParams.set("token", localTkn);
            window.location.href = url.toString();
        }
    </script>';
    echo '</body></html>';
    exit();
}

// Action: Create a mock landing page connection if requested
if (isset($_GET['action']) && $_GET['action'] === 'setup_connection') {
    header('Content-Type: application/json');
    $token = 'test_landing_page_token';
    
    // Check if exists
    $stmt = $conn->prepare("SELECT id FROM sheet_connections WHERE webhook_token = ?");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $res = $stmt->get_result();
    
    if ($res->num_rows > 0) {
        $row = $res->fetch_assoc();
        echo json_encode(['success' => true, 'message' => 'Kết nối kiểm thử đã tồn tại.', 'token' => $token, 'id' => $row['id']]);
    } else {
        $name = 'Landing Page Test Connection';
        $type = 'landing_page';
        $is_active = 1;
        $require_both = 0;
        
        $insert = $conn->prepare("INSERT INTO sheet_connections (sheet_name, connection_type, webhook_token, is_active, require_both_contact) VALUES (?, ?, ?, ?, ?)");
        $insert->bind_param("sssii", $name, $type, $token, $is_active, $require_both);
        
        if ($insert->execute()) {
            echo json_encode(['success' => true, 'message' => 'Đã tự động tạo kết nối Landing Page kiểm thử thành công.', 'token' => $token, 'id' => $insert->insert_id]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Lỗi tạo kết nối: ' . $conn->error]);
        }
    }
    exit();
}

// Action: Check distribution status of the last lead
if (isset($_GET['action']) && $_GET['action'] === 'check_status') {
    header('Content-Type: application/json');
    $phone = $_GET['phone'] ?? '';
    $email = $_GET['email'] ?? '';
    
    if (empty($phone) && empty($email)) {
        echo json_encode(['success' => false, 'message' => 'Thiếu thông tin tra cứu.']);
        exit();
    }
    
    // Find Lead
    $lead = null;
    if (!empty($phone)) {
        $stmt = $conn->prepare("SELECT * FROM leads WHERE phone = ? ORDER BY id DESC LIMIT 1");
        $stmt->bind_param("s", $phone);
    } else {
        $stmt = $conn->prepare("SELECT * FROM leads WHERE email = ? ORDER BY id DESC LIMIT 1");
        $stmt->bind_param("s", $email);
    }
    $stmt->execute();
    $leadRes = $stmt->get_result();
    if ($leadRes->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy Lead trong database.']);
        exit();
    }
    $lead = $leadRes->fetch_assoc();
    
    // Find Distribution Log
    $logStmt = $conn->prepare("SELECT dl.*, c.name as consultant_name 
                               FROM distribution_logs dl 
                               LEFT JOIN consultants c ON dl.assigned_to = c.id
                               WHERE dl.lead_id = ? 
                               ORDER BY dl.id DESC LIMIT 1");
    $logStmt->bind_param("i", $lead['id']);
    $logStmt->execute();
    $logRes = $logStmt->get_result();
    $log = $logRes->fetch_assoc() ?: null;
    
    echo json_encode([
        'success' => true,
        'lead' => $lead,
        'distribution' => $log
    ]);
    exit();
}

// Get all active landing_page connections to display in UI
$connections = [];
$res = $conn->query("SELECT id, sheet_name, webhook_token FROM sheet_connections WHERE connection_type = 'landing_page' AND is_active = 1");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $connections[] = $row;
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Công cụ Kiểm thử API Landing Page Webhook</title>
    <style>
        :root {
            --color-bg: #0f172a;
            --color-surface: #1e293b;
            --color-primary: #7c3aed;
            --color-primary-hover: #6d28d9;
            --color-success: #10b981;
            --color-text: #f8fafc;
            --color-text-muted: #94a3b8;
            --color-border: #334155;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--color-bg);
            color: var(--color-text);
            margin: 0;
            padding: 2rem;
            display: flex;
            justify-content: center;
        }

        .container {
            width: 100%;
            max-width: 900px;
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 16px;
            padding: 2rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }

        h1 {
            font-size: 1.75rem;
            margin-top: 0;
            margin-bottom: 0.5rem;
            color: var(--color-text);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .subtitle {
            color: var(--color-text-muted);
            font-size: 0.9375rem;
            margin-bottom: 2rem;
        }

        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
        }

        .form-group {
            margin-bottom: 1.25rem;
        }

        label {
            display: block;
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: var(--color-text);
        }

        input, select, textarea {
            width: 100%;
            padding: 0.75rem;
            background: var(--color-bg);
            border: 1px solid var(--color-border);
            border-radius: 8px;
            color: var(--color-text);
            font-size: 0.9375rem;
            box-sizing: border-box;
            transition: all 0.2s;
        }

        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: var(--color-primary);
            box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
        }

        .btn {
            background: var(--color-primary);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            font-size: 0.9375rem;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn:hover {
            background: var(--color-primary-hover);
        }

        .btn.secondary {
            background: transparent;
            border: 1px solid var(--color-border);
            color: var(--color-text);
        }

        .btn.secondary:hover {
            background: rgba(255, 255, 255, 0.05);
        }

        .panel {
            background: var(--color-bg);
            border: 1px solid var(--color-border);
            border-radius: 8px;
            padding: 1rem;
            font-family: monospace;
            font-size: 0.875rem;
            overflow-x: auto;
            white-space: pre-wrap;
            min-height: 100px;
        }

        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            background: var(--color-border);
            color: var(--color-text-muted);
        }

        .status-badge.success {
            background: rgba(16, 185, 129, 0.15);
            color: var(--color-success);
        }

        .flex-row {
            display: flex;
            gap: 0.75rem;
            align-items: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Trình Kiểm Thử API Landing Page Webhook</h1>
        <div class="subtitle">Tạo lead thử nghiệm giả lập từ trang Landing Page gửi về hệ thống qua Webhook để kiểm tra định tuyến.</div>
        
        <div class="grid">
            <!-- Left: Form -->
            <div>
                <div class="form-group">
                    <label>Kết nối Landing Page (Webhook Token):</label>
                    <div class="flex-row">
                        <select id="tokenSelect">
                            <?php if (empty($connections)): ?>
                                <option value="">-- Chưa có kết nối Landing Page nào --</option>
                            <?php else: ?>
                                <?php foreach($connections as $c): ?>
                                    <option value="<?php echo htmlspecialchars($c['webhook_token']); ?>">
                                        <?php echo htmlspecialchars($c['sheet_name']); ?> (<?php echo htmlspecialchars($c['webhook_token']); ?>)
                                    </option>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </select>
                        <button type="button" class="btn secondary" style="white-space: nowrap;" onclick="setupTestConnection()">Tự tạo kết nối test</button>
                    </div>
                </div>

                <hr style="border: 0; border-top: 1px solid var(--color-border); margin: 1.5rem 0;">

                <form id="leadForm">
                    <div class="form-group">
                        <label>Họ và tên (name):</label>
                        <input type="text" id="name" value="Nguyễn Văn Test" required>
                    </div>
                    <div class="form-group">
                        <label>Số điện thoại (phone):</label>
                        <input type="text" id="phone" value="0987654321" required>
                    </div>
                    <div class="form-group">
                        <label>Email (email):</label>
                        <input type="email" id="email" value="vantest@gmail.com">
                    </div>
                    <div class="form-group">
                        <label>Nguồn dữ liệu (source):</label>
                        <input type="text" id="source" value="Landing Page Mụn">
                    </div>
                    <div class="form-group">
                        <label>Phân loại (type):</label>
                        <input type="text" id="type" value="Đăng ký tư vấn">
                    </div>
                    <div class="form-group">
                        <label>Ghi chú (note):</label>
                        <textarea id="note" rows="3">Khách hàng cần tư vấn liệu trình điều trị mụn cám.</textarea>
                    </div>

                    <!-- Custom Fields JSON -->
                    <div class="form-group">
                        <label>Các trường bổ sung (JSON - Tự động đưa vào ghi chú):</label>
                        <textarea id="extraFields" rows="3" placeholder='{"tuoi": 25, "dia_chi": "Hà Nội"}'></textarea>
                    </div>

                    <button type="submit" class="btn" style="width: 100%;">
                        Gửi dữ liệu qua Webhook
                    </button>
                </form>
            </div>

            <!-- Right: Results -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div>
                    <h3 style="margin-top: 0; font-size: 1rem;">1. Raw Response từ Webhook</h3>
                    <div id="webhookResult" class="panel">Chưa gửi yêu cầu.</div>
                </div>

                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <h3 style="margin: 0; font-size: 1rem;">2. Trạng thái phân bổ thực tế trong DB</h3>
                        <button type="button" class="btn secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="checkDbStatus()">Tra cứu ngay</button>
                    </div>
                    <div id="dbResult" class="panel">Chưa tra cứu database.</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token') || '';

        async function setupTestConnection() {
            try {
                const res = await fetch(`test_landing_page_api.php?action=setup_connection&token=${encodeURIComponent(token)}`);
                const data = await res.json();
                alert(data.message);
                if (data.success) {
                    location.reload();
                }
            } catch (err) {
                alert('Có lỗi xảy ra: ' + err.message);
            }
        }

        document.getElementById('leadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = document.getElementById('tokenSelect').value;
            if (!token) {
                alert('Vui lòng tạo hoặc chọn một Webhook Token hợp lệ!');
                return;
            }

            const payload = {
                name: document.getElementById('name').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                source: document.getElementById('source').value,
                type: document.getElementById('type').value,
                note: document.getElementById('note').value
            };

            const extraText = document.getElementById('extraFields').value.trim();
            if (extraText) {
                try {
                    const parsed = JSON.parse(extraText);
                    Object.assign(payload, parsed);
                } catch(e) {
                    alert('Định dạng JSON các trường bổ sung bị sai!');
                    return;
                }
            }

            const webhookResultDiv = document.getElementById('webhookResult');
            webhookResultDiv.textContent = 'Đang gửi payload...';

            try {
                const res = await fetch(`webhook.php?token=${token}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                const text = await res.text();
                try {
                    const json = JSON.parse(text);
                    webhookResultDiv.innerHTML = `<span class="status-badge success">HTTP ${res.status}</span>\n` + JSON.stringify(json, null, 2);
                    
                    // Auto query DB status after 1.5 seconds to allow background tasks to complete
                    setTimeout(checkDbStatus, 1500);
                } catch {
                    webhookResultDiv.textContent = `Lỗi phản hồi không phải JSON:\n${text}`;
                }
            } catch(err) {
                webhookResultDiv.textContent = `Lỗi mạng: ${err.message}`;
            }
        });

        async function checkDbStatus() {
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('email').value;
            const dbResultDiv = document.getElementById('dbResult');
            
            dbResultDiv.textContent = 'Đang tra cứu database...';
            
            try {
                const res = await fetch(`test_landing_page_api.php?action=check_status&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);
                const json = await res.json();
                
                if (json.success) {
                    let html = `<strong>Lead ID:</strong> ${json.lead.id}\n`;
                    html += `<strong>Họ tên:</strong> ${json.lead.name}\n`;
                    html += `<strong>SĐT:</strong> ${json.lead.phone}\n`;
                    html += `<strong>Email:</strong> ${json.lead.email}\n`;
                    html += `<strong>Ghi chú tích hợp:</strong>\n${json.lead.note}\n\n`;
                    
                    if (json.distribution) {
                        html += `--- PHÂN BỔ THỰC TẾ ---\n`;
                        html += `<strong>Trạng thái:</strong> ${json.distribution.status}\n`;
                        html += `<strong>Nhân sự:</strong> ${json.distribution.consultant_name || 'NULL (Giao thẳng Admin/Chờ)'}\n`;
                        html += `<strong>Chi tiết:</strong> ${json.distribution.message}\n`;
                        html += `<strong>Thời gian:</strong> ${json.distribution.received_at}`;
                    } else {
                        html += `Chưa tìm thấy bản ghi phân phối (distribution log) nào cho Lead này.`;
                    }
                    dbResultDiv.innerHTML = html;
                } else {
                    dbResultDiv.textContent = json.message;
                }
            } catch (err) {
                dbResultDiv.textContent = `Lỗi kết nối: ${err.message}`;
            }
        }
    </script>
</body>
</html>
