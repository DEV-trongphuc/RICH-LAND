<?php
// backend/controllers/CapiController.php

class CapiController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getSettings(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);

        $stmt = $this->db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token')");
        $settings = [];
        if ($stmt) {
            while ($row = $stmt->fetch()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }

        respond(200, [
            'meta_pixel_id' => $settings['meta_pixel_id'] ?? '',
            'meta_access_token' => $settings['meta_access_token'] ?? ''
        ], 'Lấy cấu hình Meta CAPI thành công');
    }

    public function saveSettings(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);
        $b = getBody();
        $pixelId = trim($b['meta_pixel_id'] ?? '');
        $token = trim($b['meta_access_token'] ?? '');

        // Save settings dynamically to system_settings table
        $stmt = $this->db->prepare("
            INSERT INTO system_settings (setting_key, setting_value) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        $stmt->execute(['meta_pixel_id', $pixelId]);
        $stmt->execute(['meta_access_token', $token]);

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
