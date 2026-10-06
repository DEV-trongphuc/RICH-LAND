<?php
// backend/controllers/CapiController.php

class CapiController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getSettings(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);

        $stmt = $this->db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token', 'capi_event_triggers', 'pipeline_status_hierarchy', 'pipeline_status_labels', 'capi_custom_event_names', 'outbound_webhook_triggers')");
        $settings = [];
        if ($stmt) {
            while ($row = $stmt->fetch()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }

        // Parse status lists and triggers
        $hierarchy = [];
        if (!empty($settings['pipeline_status_hierarchy'])) {
            $hierarchy = json_decode($settings['pipeline_status_hierarchy'], true) ?: [];
        }
        if (empty($hierarchy)) {
            $hierarchy = ['chua_xac_dinh', 'quan_tam', 'dong_y_gap', 'da_gap', 'booking', 'dat_coc', 'dong_deal', 'not_lead'];
        }
        if (!in_array('not_lead', $hierarchy) && !in_array('notlead', $hierarchy)) {
            $hierarchy[] = 'not_lead';
        }

        $labels = [];
        if (!empty($settings['pipeline_status_labels'])) {
            $labels = json_decode($settings['pipeline_status_labels'], true) ?: [];
        }
        if (empty($labels)) {
            $labels = [
                'chua_xac_dinh' => 'Chưa xác định',
                'quan_tam' => 'Quan tâm',
                'dong_y_gap' => 'Đồng ý gặp',
                'da_gap' => 'Đã gặp',
                'booking' => 'Booking',
                'dat_coc' => 'Đặt cọc',
                'dong_deal' => 'Đóng deal',
                'not_lead' => 'Not Lead'
            ];
        }
        if (!isset($labels['not_lead'])) {
            $labels['not_lead'] = 'Not Lead';
        }
        if (!isset($labels['notlead'])) {
            $labels['notlead'] = 'Not Lead';
        }

        $triggers = [];
        if (!empty($settings['capi_event_triggers'])) {
            $triggers = json_decode($settings['capi_event_triggers'], true) ?: [];
        }
        if (empty($triggers)) {
            $triggers = [
                'chua_xac_dinh' => 'CompleteRegistration',
                'quan_tam' => 'Contact',
                'dong_y_gap' => 'Schedule',
                'da_gap' => 'MeetingCompleted',
                'booking' => 'Purchase',
                'dat_coc' => 'Purchase',
                'not_lead' => 'Disqualified'
            ];
        }

        // Custom Event Names
        $customEventNames = [];
        if (!empty($settings['capi_custom_event_names'])) {
            $customEventNames = json_decode($settings['capi_custom_event_names'], true) ?: [];
        }
        if (empty($customEventNames)) {
            $customEventNames = [
                ['name' => 'Skip', 'label' => 'Không gửi (Skip)', 'description' => 'Bỏ qua không bắn sự kiện'],
                ['name' => 'Disqualified', 'label' => 'Disqualified (Not Lead)', 'description' => 'Khách không đạt tiêu chuẩn / Hủy'],
                ['name' => 'CompleteRegistration', 'label' => 'CompleteRegistration (Nhận lead)', 'description' => 'Hoàn tất tiếp nhận thông tin'],
                ['name' => 'Contact', 'label' => 'Contact (Quan tâm)', 'description' => 'Khách quan tâm hoặc đã liên hệ'],
                ['name' => 'Schedule', 'label' => 'Schedule (Thiện chí / Đặt hẹn)', 'description' => 'Khách thiện chí, lên lịch hẹn'],
                ['name' => 'MeetingCompleted', 'label' => 'MeetingCompleted (Đã gặp)', 'description' => 'Đã gặp trực tiếp thành công'],
                ['name' => 'Purchase', 'label' => 'Purchase (Booking & Đặt cọc)', 'description' => 'Giao dịch đặt cọc / Chốt deal (kèm số tiền)'],
                ['name' => 'Lead', 'label' => 'Lead (Khách tiềm năng)', 'description' => 'Sự kiện Lead tiêu chuẩn'],
                ['name' => 'SubmitApplication', 'label' => 'SubmitApplication', 'description' => 'Khách gửi đơn đăng ký'],
                ['name' => 'ViewContent', 'label' => 'ViewContent (Xem hàng)', 'description' => 'Khách xem bảng hàng / căn hộ']
            ];
        }

        // Outbound Webhook Triggers
        $outboundTriggers = [];
        if (!empty($settings['outbound_webhook_triggers'])) {
            $outboundTriggers = json_decode($settings['outbound_webhook_triggers'], true) ?: [];
        }

        respond(200, [
            'meta_pixel_id' => $settings['meta_pixel_id'] ?? '',
            'meta_access_token' => $settings['meta_access_token'] ?? '',
            'capi_event_triggers' => $triggers,
            'capi_custom_event_names' => $customEventNames,
            'outbound_webhook_triggers' => $outboundTriggers,
            'pipeline_statuses' => $hierarchy,
            'pipeline_status_labels' => $labels
        ], 'Lấy cấu hình Meta CAPI thành công');
    }

    public function saveSettings(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);
        $b = getBody();
        $pixelId = trim($b['meta_pixel_id'] ?? '');
        $token = trim($b['meta_access_token'] ?? '');
        
        $triggersRaw = $b['capi_event_triggers'] ?? [];
        $triggersJson = json_encode($triggersRaw, JSON_UNESCAPED_UNICODE);

        $customEventsRaw = $b['capi_custom_event_names'] ?? [];
        $customEventsJson = json_encode($customEventsRaw, JSON_UNESCAPED_UNICODE);

        $outboundTriggersRaw = $b['outbound_webhook_triggers'] ?? [];
        $outboundTriggersJson = json_encode($outboundTriggersRaw, JSON_UNESCAPED_UNICODE);

        // Save settings dynamically to system_settings table
        $stmt = $this->db->prepare("
            INSERT INTO system_settings (setting_key, setting_value) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        $stmt->execute(['meta_pixel_id', $pixelId]);
        $stmt->execute(['meta_access_token', $token]);
        $stmt->execute(['capi_event_triggers', $triggersJson]);
        $stmt->execute(['capi_custom_event_names', $customEventsJson]);
        $stmt->execute(['outbound_webhook_triggers', $outboundTriggersJson]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_CAPI_SETTINGS', 'system', null, "Cập nhật cấu hình Meta CAPI & Outbound Triggers");
        respond(200, null, 'Cấu hình Meta CAPI & Outbound Triggers thành công');
    }

    public function testTrigger(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);
        $b = getBody();

        $targetUrl = trim($b['target_url'] ?? '');
        if (empty($targetUrl)) {
            respond(400, null, 'Vui lòng nhập API URL đích');
        }

        $method = strtoupper(trim($b['http_method'] ?? 'POST'));
        $headersRaw = $b['headers'] ?? '';
        $payloadTemplate = $b['payload_template'] ?? '{}';

        // Load credentials for token replacement
        $stmt = $this->db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token')");
        $settings = [];
        if ($stmt) {
            while ($row = $stmt->fetch()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }
        $pixelId = trim($settings['meta_pixel_id'] ?? '');
        $token = trim($settings['meta_access_token'] ?? '');

        // Mock test data
        $sampleLeadId = "2313130106160708";
        $samplePhone = "0901234567";
        $samplePhoneHash = hash('sha256', '84901234567');
        $sampleFirstName = "Phúc";
        $sampleLastName = "Đỗ";
        $sampleFullName = "Đỗ Trọng Phúc";
        $sampleFnHash = hash('sha256', 'phuc');
        $samplePrice = 13674109347;
        $sampleStatus = "da_gap";
        $timeNow = time();

        $macroMap = [
            '{{lead_id}}' => $sampleLeadId,
            '{{contact_id}}' => '999',
            '{{phone}}' => $samplePhone,
            '{{phone_sha256}}' => $samplePhoneHash,
            '{{first_name}}' => $sampleFirstName,
            '{{first_name_sha256}}' => $sampleFnHash,
            '{{last_name}}' => $sampleLastName,
            '{{full_name}}' => $sampleFullName,
            '{{email}}' => 'demo@richland.city',
            '{{price}}' => (string)$samplePrice,
            '{{pipeline_status}}' => $sampleStatus,
            '{{status}}' => $sampleStatus,
            '{{field}}' => 'pipeline_status',
            '{{old_value}}' => 'dong_y_gap',
            '{{new_value}}' => 'da_gap',
            '{{timestamp}}' => (string)$timeNow,
            '{{event_time}}' => (string)$timeNow,
            '{{owner_name}}' => 'Vũ Văn Thành',
            '{{owner_phone}}' => '0912345678',
            '{{owner_email}}' => 'thanh.vu@richland.city',
            '{pixel_id}' => $pixelId,
            '{meta_pixel_id}' => $pixelId,
            '{token}' => $token,
            '{access_token}' => $token,
            '{meta_access_token}' => $token
        ];

        // Sample data for all common database columns in contacts/persons
        $sampleDbFields = [
            'address' => '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1',
            'city' => 'Hồ Chí Minh',
            'ward' => 'Bến Nghé',
            'district' => 'Quận 1',
            'source' => 'facebook_ads',
            'notes' => 'Khách quan tâm căn 2PN view sông',
            'gender' => 'Nam',
            'budget' => '3500000000',
            'budget_range' => '3 - 5 tỷ',
            'customer_type' => 'Khách mua ở',
            'industry' => 'Tài chính',
            'company' => 'Rich Land Corp',
            'tax_code' => '0312345678',
            'citizen_id' => '079090123456',
            'dob' => '1990-05-15',
            'bedroom_count' => '2PN',
            'preferred_location' => 'Trung tâm thành phố',
            'utm_source' => 'facebook',
            'utm_medium' => 'cpc',
            'utm_campaign' => 'du_an_hai_phong_2026',
            'utm_content' => 'ad_group_01',
            'utm_term' => 'can_ho_cao_cap',
            'platform' => 'fb',
            'form_name' => 'Form Đăng Ký Dự Án',
            'ad_name' => 'Ad 01 - Ưu đãi đợt 1',
            'zalo_phone' => $samplePhone,
            'not_lead_reason' => 'Không đúng nhu cầu',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        foreach ($sampleDbFields as $colKey => $colVal) {
            if (!isset($macroMap['{{' . $colKey . '}}'])) {
                $macroMap['{{' . $colKey . '}}'] = (string)$colVal;
            }
        }

        // Render URL with raw values or URL encoding
        $renderedUrl = str_replace(array_keys($macroMap), array_values($macroMap), $targetUrl);
        // Fallback for any other {{col_name}} in URL
        $renderedUrl = preg_replace_callback('/\{\{([a-zA-Z0-9_\-]+)\}\}/', function($m) {
            return 'sample_' . $m[1];
        }, $renderedUrl);

        // Render Payload with JSON-safe escaping
        $renderedPayload = preg_replace_callback('/\{\{([a-zA-Z0-9_\-]+)\}\}/', function($m) use ($macroMap) {
            $tag = '{{' . $m[1] . '}}';
            if (isset($macroMap[$tag])) {
                $val = $macroMap[$tag];
                if (in_array($tag, ['{{price}}', '{{timestamp}}', '{{event_time}}', '{{contact_id}}', '{{lead_id}}']) && is_numeric($val)) {
                    return $val;
                }
                return addcslashes($val, "\"\\\r\n\t\f\b");
            }
            return 'sample_' . $m[1];
        }, $payloadTemplate);
        $renderedPayload = str_replace(
            ['{pixel_id}', '{meta_pixel_id}', '{token}', '{access_token}', '{meta_access_token}'],
            [$pixelId, $pixelId, $token, $token, $token],
            $renderedPayload
        );

        $httpHeaders = ['Content-Type: application/json'];
        if (!empty($headersRaw)) {
            if (is_string($headersRaw)) {
                $parsed = json_decode($headersRaw, true);
                if (is_array($parsed)) {
                    foreach ($parsed as $hKey => $hVal) {
                        $hValReplaced = str_replace(array_keys($macroMap), array_values($macroMap), $hVal);
                        $httpHeaders[] = "$hKey: $hValReplaced";
                    }
                } else {
                    $lines = explode("\n", $headersRaw);
                    foreach ($lines as $ln) {
                        $ln = trim($ln);
                        if (!empty($ln) && strpos($ln, ':') !== false) {
                            $httpHeaders[] = str_replace(array_keys($macroMap), array_values($macroMap), $ln);
                        }
                    }
                }
            }
        }

        $startTime = microtime(true);
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $renderedUrl);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($method !== 'GET') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $renderedPayload);
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $httpHeaders);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        $durationMs = round((microtime(true) - $startTime) * 1000);

        // Audit log in capi_logs
        try {
            $stmtLog = $this->db->prepare("
                INSERT INTO capi_logs (lead_id, contact_id, event_name, payload_hash, sent_payload, response_status, response_body)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtLog->execute([
                $sampleLeadId,
                999,
                'TEST_TRIGGER',
                hash('sha256', $renderedPayload),
                $renderedPayload,
                $httpCode ?: 0,
                $response ?: ($curlError ? "cURL Error: $curlError" : 'No response')
            ]);
        } catch (\Throwable $e) {}

        respond(200, [
            'http_code' => $httpCode,
            'response' => $response,
            'curl_error' => $curlError,
            'rendered_url' => $renderedUrl,
            'rendered_payload' => $renderedPayload,
            'duration_ms' => $durationMs
        ], 'Đã thực thi bắn thử nghiệm');
    }

    public function getLogs(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);

        $stmt = $this->db->query("
            SELECT cl.*, c.first_name, c.last_name, c.phone 
            FROM capi_logs cl
            LEFT JOIN contacts c ON cl.contact_id = c.id
            ORDER BY cl.sent_at DESC 
            LIMIT 100
        ");
        $logs = $stmt->fetchAll() ?: [];
        respond(200, $logs, 'Lấy lịch sử CAPI logs thành công');
    }
}
