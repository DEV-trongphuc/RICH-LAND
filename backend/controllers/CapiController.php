<?php
// backend/controllers/CapiController.php

class CapiController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getSettings(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);

        $stmt = $this->db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token', 'capi_event_triggers', 'pipeline_status_hierarchy', 'pipeline_status_labels')");
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
                'not_lead' => 'Không phải lead'
            ];
        }

        $triggers = [];
        if (!empty($settings['capi_event_triggers'])) {
            $triggers = json_decode($settings['capi_event_triggers'], true) ?: [];
        }
        if (empty($triggers)) {
            $triggers = [
                'dong_y_gap' => 'Schedule',
                'da_gap' => 'Schedule',
                'not_lead' => 'Skip',
                'dat_coc' => 'Purchase'
            ];
        }

        respond(200, [
            'meta_pixel_id' => $settings['meta_pixel_id'] ?? '',
            'meta_access_token' => $settings['meta_access_token'] ?? '',
            'capi_event_triggers' => $triggers,
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

        // Save settings dynamically to system_settings table
        $stmt = $this->db->prepare("
            INSERT INTO system_settings (setting_key, setting_value) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        $stmt->execute(['meta_pixel_id', $pixelId]);
        $stmt->execute(['meta_access_token', $token]);
        $stmt->execute(['capi_event_triggers', $triggersJson]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_CAPI_SETTINGS', 'system', null, "Cập nhật cấu hình Meta CAPI (Pixel: $pixelId)");
        respond(200, null, 'Cấu hình Meta CAPI thành công');
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
