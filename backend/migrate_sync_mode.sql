-- Migration for Sync New Data Only Feature
-- Lệnh SQL này dùng để thêm cấu hình Tùy chọn Quét Data vào bảng sheet_connections.
-- Chạy lệnh này trực tiếp trong phpMyAdmin hoặc Database Client của bạn.

ALTER TABLE `sheet_connections` 
ADD COLUMN `sync_mode` ENUM('all', 'new_only') DEFAULT 'all' AFTER `require_both_contact`;

ALTER TABLE `sheet_connections` 
ADD COLUMN `is_initialized` TINYINT(1) DEFAULT 0 AFTER `sync_mode`;
