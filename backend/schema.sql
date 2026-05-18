-- MySQL Database Schema for DataFlow App



-- Bảng Tư vấn viên
CREATE TABLE IF NOT EXISTS consultants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    status ENUM('active', 'inactive', 'leave') DEFAULT 'active',
    leave_start DATE NULL,
    leave_end DATE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Định nghĩa Vòng Data (Rounds)
CREATE TABLE IF NOT EXISTS distribution_rounds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    round_name VARCHAR(255) NOT NULL,
    description TEXT,
    cc_emails TEXT NULL COMMENT 'Danh sách email CC, phân tách bằng dấu phẩy',
    last_assigned_consultant_id INT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (last_assigned_consultant_id) REFERENCES consultants(id) ON DELETE SET NULL
);

-- Bảng TVV thuộc Vòng nào (N-N)
CREATE TABLE IF NOT EXISTS round_consultants (
    round_id INT,
    consultant_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (round_id, consultant_id),
    FOREIGN KEY (round_id) REFERENCES distribution_rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (consultant_id) REFERENCES consultants(id) ON DELETE CASCADE
);



-- Bảng Khách hàng (Leads)
CREATE TABLE IF NOT EXISTS leads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255),
    name VARCHAR(255),
    source VARCHAR(255) NULL,
    type VARCHAR(100) NULL,
    note TEXT NULL,
    last_interaction_date DATETIME,
    assigned_to INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES consultants(id) ON DELETE SET NULL,
    INDEX idx_phone (phone),
    INDEX idx_email (email)
);

-- Bảng Log Phân bổ
CREATE TABLE IF NOT EXISTS distribution_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lead_id INT,
    assigned_to INT NULL,
    round_id INT NULL,
    status VARCHAR(50),
    message TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES consultants(id) ON DELETE SET NULL,
    FOREIGN KEY (round_id) REFERENCES distribution_rounds(id) ON DELETE SET NULL,
    INDEX idx_received_at (received_at),
    INDEX idx_status (status),
    INDEX idx_round_id (round_id),
    INDEX idx_assigned_to (assigned_to)
);

-- Bảng kết nối Google Sheets (mỗi sheet là 1 kết nối riêng)
CREATE TABLE IF NOT EXISTS sheet_connections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sheet_name VARCHAR(255) NOT NULL COMMENT 'Tên Sheet hoặc mô tả',
    spreadsheet_id VARCHAR(255) COMMENT 'Google Spreadsheet ID (optional)',
    webhook_token VARCHAR(64) UNIQUE NOT NULL COMMENT 'Token bảo mật riêng cho từng sheet',
    is_active BOOLEAN DEFAULT TRUE,
    sync_interval INT DEFAULT 5 COMMENT 'Thời gian đồng bộ (phút)',
    last_sync_at DATETIME NULL,
    sync_status VARCHAR(50) DEFAULT 'idle',
    require_both_contact BOOLEAN DEFAULT FALSE COMMENT 'Yêu cầu có cả SĐT và Email',
    email_template TEXT NULL COMMENT 'Mẫu nội dung email gửi Sale',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Rules (Rule Engine)
CREATE TABLE IF NOT EXISTS routing_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    connection_id INT NULL COMMENT 'Nếu NULL thì áp dụng cho tất cả các Sheet',
    target_round_id INT,
    condition_column VARCHAR(100) NOT NULL,
    condition_operator VARCHAR(50) DEFAULT 'contains',
    condition_value VARCHAR(255) NOT NULL,
    priority INT DEFAULT 0,
    FOREIGN KEY (connection_id) REFERENCES sheet_connections(id) ON DELETE CASCADE,
    FOREIGN KEY (target_round_id) REFERENCES distribution_rounds(id) ON DELETE CASCADE
);
-- Bảng Mapping Cột theo từng Sheet Connection
CREATE TABLE IF NOT EXISTS field_mappings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    connection_id INT NOT NULL COMMENT 'Sheet Connection mà mapping này thuộc về',
    sheet_column VARCHAR(255) NOT NULL COMMENT 'Tên cột trên Google Sheets',
    system_field VARCHAR(100) NOT NULL COMMENT 'Trường tương ứng trong hệ thống (phone, email, source, type, note, name)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connection_id) REFERENCES sheet_connections(id) ON DELETE CASCADE
);

-- Bảng Cài đặt Hệ thống (Settings)
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT
);

-- Bảng Tài khoản Quản trị (Authentication)
CREATE TABLE IF NOT EXISTS accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'assistant', 'viewer') DEFAULT 'viewer',
    name VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng ghi nhận các dòng dữ liệu Google Sheets đã đồng bộ (để tránh đồng bộ lại dòng cũ)
CREATE TABLE IF NOT EXISTS sheet_sync_records (
    connection_id INT,
    row_hash VARCHAR(64),
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (connection_id, row_hash),
    FOREIGN KEY (connection_id) REFERENCES sheet_connections(id) ON DELETE CASCADE
);

-- Tạo sẵn tài khoản Admin mặc định (mật khẩu: 123456)
-- Hash của 123456 bằng password_hash('123456', PASSWORD_DEFAULT)
INSERT IGNORE INTO accounts (username, password_hash, role, name) 
VALUES ('admin', '$2y$10$Y1/J.4rGvO1C9XfRkXZ8xOQsI5nJ1yXf5M0t0h0LqGqXQh7Vf4L8C', 'admin', 'Super Admin');
