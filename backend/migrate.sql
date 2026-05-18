-- 1. Thêm cột require_both_contact vào bảng sheet_connections
ALTER TABLE sheet_connections 
ADD COLUMN require_both_contact BOOLEAN DEFAULT FALSE COMMENT 'Yêu cầu có cả SĐT và Email';

-- 2. Cập nhật lại các điều kiện cũ trong Rule Engine (routing_rules)
-- Do bản cũ lưu tiếng Việt (Nguồn, Loại Data, Ghi Chú) nên cần chuyển về biến tiếng Anh của hệ thống
UPDATE routing_rules SET condition_column = 'source' WHERE condition_column = 'Nguồn';
UPDATE routing_rules SET condition_column = 'type' WHERE condition_column = 'Loại Data';
UPDATE routing_rules SET condition_column = 'note' WHERE condition_column = 'Ghi Chú';

-- 3. Tạo bảng lưu vết dòng đã đồng bộ trên Google Sheets (Tránh đồng bộ lặp dòng cũ)
CREATE TABLE IF NOT EXISTS sheet_sync_records (
    connection_id INT,
    row_hash VARCHAR(64),
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (connection_id, row_hash),
    FOREIGN KEY (connection_id) REFERENCES sheet_connections(id) ON DELETE CASCADE
);
