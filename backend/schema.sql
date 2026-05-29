-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Máy chủ: localhost:3306
-- Thời gian đã tạo: Th5 29, 2026 lúc 01:32 PM
-- Phiên bản máy phục vụ: 10.6.18-MariaDB-cll-lve-log
-- Phiên bản PHP: 8.4.21

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `vhvxoigh_sale_data`
--

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `accounts`
--

CREATE TABLE `accounts` (
  `id` int(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','assistant','viewer') DEFAULT 'viewer',
  `name` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `email` varchar(255) DEFAULT NULL COMMENT 'Email đăng nhập (bắt buộc với admin thường, tùy chọn với Super Admin)',
  `zalo_chat_id` varchar(255) DEFAULT NULL COMMENT 'Zalo Bot Chat ID',
  `is_confirmed` tinyint(1) DEFAULT 0 COMMENT 'Xác nhận Email',
  `confirm_token` varchar(64) DEFAULT NULL COMMENT 'Token xác nhận Email',
  `last_login` datetime DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL COMMENT 'Đường dẫn ảnh đại diện của Admin/Assistant'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `active_compensation_logs`
--

CREATE TABLE `active_compensation_logs` (
  `id` int(11) NOT NULL,
  `round_id` int(11) NOT NULL,
  `consultant_id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `amount` int(11) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `admin_logs`
--

CREATE TABLE `admin_logs` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `details` longtext DEFAULT NULL COMMENT 'JSON details',
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `is_rolled_back` tinyint(1) DEFAULT 0 COMMENT 'Đánh dấu log đã được hoàn tác'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `consultants`
--

CREATE TABLE `consultants` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `status` enum('active','inactive','leave') DEFAULT 'active',
  `leave_start` date DEFAULT NULL,
  `leave_end` date DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `zalo_chat_id` varchar(255) DEFAULT NULL COMMENT 'Zalo Bot Chat ID',
  `work_start_time` varchar(5) DEFAULT '00:00' COMMENT 'Giờ làm việc bắt đầu (HH:MM)',
  `work_end_time` varchar(5) DEFAULT '23:59' COMMENT 'Giờ làm việc kết thúc (HH:MM)',
  `work_schedule` longtext DEFAULT NULL COMMENT 'Cấu hình lịch làm việc chi tiết dạng JSON',
  `avatar` varchar(255) DEFAULT NULL COMMENT 'Đường dẫn ảnh đại diện của Sale',
  `vacation_mode` tinyint(1) DEFAULT 0 COMMENT 'Chế độ nghỉ phép nhanh'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `data_reports`
--

CREATE TABLE `data_reports` (
  `id` int(11) NOT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `consultant_id` int(11) DEFAULT NULL,
  `round_id` int(11) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL,
  `resolved_by` varchar(100) DEFAULT NULL COMMENT 'Tên admin duyệt ticket',
  `reject_reason` varchar(255) DEFAULT NULL COMMENT 'Lý do từ chối ticket',
  `approval_reason` varchar(255) DEFAULT NULL COMMENT 'Lý do duyệt ticket'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `distribution_logs`
--

CREATE TABLE `distribution_logs` (
  `id` int(11) NOT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `round_id` int(11) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `message` mediumtext DEFAULT NULL,
  `received_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `distribution_rounds`
--

CREATE TABLE `distribution_rounds` (
  `id` int(11) NOT NULL,
  `round_name` varchar(255) NOT NULL,
  `description` mediumtext DEFAULT NULL,
  `cc_emails` mediumtext DEFAULT NULL COMMENT 'Danh sách email CC, phân tách bằng dấu phẩy',
  `last_assigned_consultant_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `field_mappings`
--

CREATE TABLE `field_mappings` (
  `id` int(11) NOT NULL,
  `connection_id` int(11) NOT NULL COMMENT 'Sheet Connection mà mapping này thuộc về',
  `sheet_column` varchar(255) NOT NULL COMMENT 'Tên cột trên Google Sheets',
  `system_field` varchar(100) NOT NULL COMMENT 'Trường tương ứng trong hệ thống (phone, email, source, type, note, name)',
  `created_at` datetime DEFAULT current_timestamp(),
  `custom_label` varchar(255) DEFAULT NULL COMMENT 'Tên hiển thị tùy chỉnh trong Email'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `leads`
--

CREATE TABLE `leads` (
  `id` int(11) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `note` mediumtext DEFAULT NULL,
  `last_interaction_date` datetime DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `connection_id` int(11) DEFAULT NULL,
  `is_accepted` tinyint(1) DEFAULT 0 COMMENT 'Sale đã bấm tiếp nhận',
  `accepted_at` datetime DEFAULT NULL COMMENT 'Thời gian Sale bấm tiếp nhận',
  `status` varchar(50) DEFAULT 'active' COMMENT 'Trạng thái lead (active, pending_approval, rejected, blacklisted)',
  `target_round_id` int(11) DEFAULT NULL COMMENT 'Vòng xoay phân bổ dự kiến',
  `ai_screener_status` varchar(50) DEFAULT 'not_screened' COMMENT 'Đánh giá AI (passed, failed, skipped, error)',
  `ai_evaluation` text DEFAULT NULL COMMENT 'Chi tiết đánh giá của AI',
  `ai_attempts` int(11) DEFAULT 0 COMMENT 'Số lần thử gọi AI',
  `zalo_notify_status` varchar(50) DEFAULT 'none' COMMENT 'Trạng thái gửi thông báo Zalo',
  `email_notify_status` varchar(50) DEFAULT 'none' COMMENT 'Trạng thái gửi thông báo Email',
  `zalo_notify_sent_at` datetime DEFAULT NULL COMMENT 'Thời gian gửi thông báo Zalo thành công',
  `email_notify_sent_at` datetime DEFAULT NULL COMMENT 'Thời gian gửi thông báo Email thành công'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `mail_queue`
--

CREATE TABLE `mail_queue` (
  `id` int(11) NOT NULL,
  `to_email` varchar(255) NOT NULL,
  `cc_email` varchar(255) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `body_html` longtext NOT NULL,
  `status` enum('pending','sent','failed') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `sent_at` datetime DEFAULT NULL,
  `attempts` int(11) DEFAULT 0,
  `last_error` text DEFAULT NULL,
  `lead_id` int(11) DEFAULT NULL COMMENT 'ID của Lead liên kết'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `round_consultants`
--

CREATE TABLE `round_consultants` (
  `round_id` int(11) NOT NULL,
  `consultant_id` int(11) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `receive_ratio` int(11) DEFAULT 1,
  `skip_count` int(11) DEFAULT 0,
  `compensation_count` int(11) DEFAULT 0 COMMENT 'Số data cần đền bù',
  `data_per_turn` int(11) DEFAULT 1 COMMENT 'Số Data nhận mỗi lần đến lượt',
  `current_turn_remaining` int(11) DEFAULT 0 COMMENT 'Data còn lại trong lượt hiện tại',
  `skipped_credit` int(11) DEFAULT 0 COMMENT 'Lượt bù tích lũy do ngoài giờ/nghỉ phép'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `routing_rules`
--

CREATE TABLE `routing_rules` (
  `id` int(11) NOT NULL,
  `connection_id` varchar(255) DEFAULT NULL,
  `target_round_id` int(11) DEFAULT NULL,
  `condition_column` varchar(100) NOT NULL,
  `condition_operator` varchar(50) DEFAULT 'contains',
  `condition_value` varchar(255) NOT NULL,
  `priority` int(11) DEFAULT 0,
  `conditions_json` longtext DEFAULT NULL COMMENT 'Mảng điều kiện JSON',
  `logical_operator` varchar(10) DEFAULT 'AND' COMMENT 'Toán tử logic giữa các điều kiện'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `sheet_connections`
--

CREATE TABLE `sheet_connections` (
  `id` int(11) NOT NULL,
  `sheet_name` varchar(255) NOT NULL COMMENT 'Tên Sheet hoặc mô tả',
  `spreadsheet_id` varchar(255) DEFAULT NULL COMMENT 'Google Spreadsheet ID (optional)',
  `connection_type` varchar(20) DEFAULT 'sheets',
  `webhook_token` varchar(64) NOT NULL COMMENT 'Token bảo mật riêng cho từng sheet',
  `is_active` tinyint(1) DEFAULT 1,
  `sync_interval` int(11) DEFAULT 5 COMMENT 'Thời gian đồng bộ (phút)',
  `last_sync_at` datetime DEFAULT NULL,
  `sync_status` varchar(50) DEFAULT 'idle',
  `email_template` mediumtext DEFAULT NULL COMMENT 'Mẫu nội dung email gửi Sale',
  `created_at` datetime DEFAULT current_timestamp(),
  `require_both_contact` tinyint(1) DEFAULT 0 COMMENT 'Yêu cầu có cả SĐT và Email',
  `sync_mode` enum('all','new_only') DEFAULT 'all',
  `is_initialized` tinyint(1) DEFAULT 0,
  `is_silent` tinyint(1) DEFAULT 0 COMMENT 'Không chia số, chỉ đồng bộ check trùng',
  `sync_saleperson` tinyint(1) DEFAULT 0 COMMENT 'Đồng bộ salesperson bằng email',
  `last_error` varchar(255) DEFAULT NULL COMMENT 'Chi tiết lỗi đồng bộ gần nhất',
  `two_way_sync` tinyint(1) DEFAULT 0 COMMENT 'Đồng bộ 2 chiều ngược về Sheet',
  `google_script_url` varchar(512) DEFAULT NULL COMMENT 'URL Web App Google Apps Script',
  `lead_recall_minutes` int(11) DEFAULT 0 COMMENT 'Thời gian tự động thu hồi lead không tiếp nhận (phút, 0=tắt)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `sheet_sync_records`
--

CREATE TABLE `sheet_sync_records` (
  `connection_id` int(11) NOT NULL,
  `row_hash` varchar(64) NOT NULL,
  `synced_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `sync_queue`
--

CREATE TABLE `sync_queue` (
  `id` int(11) NOT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `connection_id` int(11) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `attempts` int(11) DEFAULT 0,
  `next_retry_at` datetime DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `system_settings`
--

CREATE TABLE `system_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` mediumtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `ticket_notify_settings`
--

CREATE TABLE `ticket_notify_settings` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `zalo_queue`
--

CREATE TABLE `zalo_queue` (
  `id` int(11) NOT NULL,
  `bot_token` varchar(255) NOT NULL,
  `chat_id` varchar(255) NOT NULL,
  `body_text` text NOT NULL,
  `status` enum('pending','sent','failed') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `sent_at` datetime DEFAULT NULL,
  `attempts` int(11) DEFAULT 0,
  `last_error` text DEFAULT NULL,
  `lead_id` int(11) DEFAULT NULL COMMENT 'ID của Lead liên kết'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Chỉ mục cho các bảng đã đổ
--

--
-- Chỉ mục cho bảng `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Chỉ mục cho bảng `active_compensation_logs`
--
ALTER TABLE `active_compensation_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `round_id` (`round_id`),
  ADD KEY `consultant_id` (`consultant_id`),
  ADD KEY `admin_id` (`admin_id`);

--
-- Chỉ mục cho bảng `admin_logs`
--
ALTER TABLE `admin_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_action_created` (`action`,`created_at`);

--
-- Chỉ mục cho bảng `consultants`
--
ALTER TABLE `consultants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Chỉ mục cho bảng `data_reports`
--
ALTER TABLE `data_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `consultant_id` (`consultant_id`),
  ADD KEY `idx_round_id` (`round_id`),
  ADD KEY `idx_report_lookup` (`lead_id`,`consultant_id`,`round_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_status` (`status`);

--
-- Chỉ mục cho bảng `distribution_logs`
--
ALTER TABLE `distribution_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_received_at` (`received_at`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_round_id` (`round_id`),
  ADD KEY `idx_assigned_to` (`assigned_to`),
  ADD KEY `idx_lead_id` (`lead_id`),
  ADD KEY `idx_duplicate_check` (`lead_id`,`assigned_to`,`round_id`),
  ADD KEY `idx_stats_group` (`received_at`,`status`),
  ADD KEY `idx_dashboard_opt` (`received_at`,`status`,`assigned_to`,`round_id`),
  ADD KEY `idx_assigned_date_status` (`assigned_to`,`received_at`,`status`);

--
-- Chỉ mục cho bảng `distribution_rounds`
--
ALTER TABLE `distribution_rounds`
  ADD PRIMARY KEY (`id`),
  ADD KEY `last_assigned_consultant_id` (`last_assigned_consultant_id`);

--
-- Chỉ mục cho bảng `field_mappings`
--
ALTER TABLE `field_mappings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `connection_id` (`connection_id`);

--
-- Chỉ mục cho bảng `leads`
--
ALTER TABLE `leads`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`),
  ADD KEY `assigned_to` (`assigned_to`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_connection_id` (`connection_id`),
  ADD KEY `idx_last_interaction_date` (`last_interaction_date`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_target_round_id` (`target_round_id`),
  ADD KEY `idx_leads_status` (`status`);

--
-- Chỉ mục cho bảng `mail_queue`
--
ALTER TABLE `mail_queue`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_lead_id` (`lead_id`);

--
-- Chỉ mục cho bảng `round_consultants`
--
ALTER TABLE `round_consultants`
  ADD PRIMARY KEY (`round_id`,`consultant_id`),
  ADD KEY `consultant_id` (`consultant_id`);

--
-- Chỉ mục cho bảng `routing_rules`
--
ALTER TABLE `routing_rules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `connection_id` (`connection_id`),
  ADD KEY `target_round_id` (`target_round_id`);

--
-- Chỉ mục cho bảng `sheet_connections`
--
ALTER TABLE `sheet_connections`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `webhook_token` (`webhook_token`);

--
-- Chỉ mục cho bảng `sheet_sync_records`
--
ALTER TABLE `sheet_sync_records`
  ADD PRIMARY KEY (`connection_id`,`row_hash`);

--
-- Chỉ mục cho bảng `sync_queue`
--
ALTER TABLE `sync_queue`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `lead_id` (`lead_id`),
  ADD KEY `connection_id` (`connection_id`),
  ADD KEY `idx_status_retry` (`status`,`next_retry_at`);

--
-- Chỉ mục cho bảng `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- Chỉ mục cho bảng `ticket_notify_settings`
--
ALTER TABLE `ticket_notify_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_account_unique` (`account_id`);

--
-- Chỉ mục cho bảng `zalo_queue`
--
ALTER TABLE `zalo_queue`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_lead_id` (`lead_id`);

--
-- AUTO_INCREMENT cho các bảng đã đổ
--

--
-- AUTO_INCREMENT cho bảng `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `active_compensation_logs`
--
ALTER TABLE `active_compensation_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `admin_logs`
--
ALTER TABLE `admin_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `consultants`
--
ALTER TABLE `consultants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `data_reports`
--
ALTER TABLE `data_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `distribution_logs`
--
ALTER TABLE `distribution_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `distribution_rounds`
--
ALTER TABLE `distribution_rounds`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `field_mappings`
--
ALTER TABLE `field_mappings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `leads`
--
ALTER TABLE `leads`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `mail_queue`
--
ALTER TABLE `mail_queue`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `routing_rules`
--
ALTER TABLE `routing_rules`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `sheet_connections`
--
ALTER TABLE `sheet_connections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `sync_queue`
--
ALTER TABLE `sync_queue`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `ticket_notify_settings`
--
ALTER TABLE `ticket_notify_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `zalo_queue`
--
ALTER TABLE `zalo_queue`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Ràng buộc đối với các bảng kết xuất
--

--
-- Ràng buộc cho bảng `active_compensation_logs`
--
ALTER TABLE `active_compensation_logs`
  ADD CONSTRAINT `active_compensation_logs_ibfk_1` FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `active_compensation_logs_ibfk_2` FOREIGN KEY (`consultant_id`) REFERENCES `consultants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `active_compensation_logs_ibfk_3` FOREIGN KEY (`admin_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `admin_logs`
--
ALTER TABLE `admin_logs`
  ADD CONSTRAINT `admin_logs_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `data_reports`
--
ALTER TABLE `data_reports`
  ADD CONSTRAINT `data_reports_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `data_reports_ibfk_2` FOREIGN KEY (`consultant_id`) REFERENCES `consultants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `data_reports_ibfk_3` FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `distribution_logs`
--
ALTER TABLE `distribution_logs`
  ADD CONSTRAINT `distribution_logs_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `distribution_logs_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `consultants` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `distribution_logs_ibfk_3` FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE SET NULL;

--
-- Ràng buộc cho bảng `distribution_rounds`
--
ALTER TABLE `distribution_rounds`
  ADD CONSTRAINT `distribution_rounds_ibfk_1` FOREIGN KEY (`last_assigned_consultant_id`) REFERENCES `consultants` (`id`) ON DELETE SET NULL;

--
-- Ràng buộc cho bảng `field_mappings`
--
ALTER TABLE `field_mappings`
  ADD CONSTRAINT `field_mappings_ibfk_1` FOREIGN KEY (`connection_id`) REFERENCES `sheet_connections` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `leads`
--
ALTER TABLE `leads`
  ADD CONSTRAINT `leads_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `consultants` (`id`) ON DELETE SET NULL;

--
-- Ràng buộc cho bảng `round_consultants`
--
ALTER TABLE `round_consultants`
  ADD CONSTRAINT `round_consultants_ibfk_1` FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `round_consultants_ibfk_2` FOREIGN KEY (`consultant_id`) REFERENCES `consultants` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `routing_rules`
--
ALTER TABLE `routing_rules`
  ADD CONSTRAINT `routing_rules_ibfk_2` FOREIGN KEY (`target_round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `sheet_sync_records`
--
ALTER TABLE `sheet_sync_records`
  ADD CONSTRAINT `sheet_sync_records_ibfk_1` FOREIGN KEY (`connection_id`) REFERENCES `sheet_connections` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `sync_queue`
--
ALTER TABLE `sync_queue`
  ADD CONSTRAINT `sync_queue_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sync_queue_ibfk_2` FOREIGN KEY (`connection_id`) REFERENCES `sheet_connections` (`id`) ON DELETE SET NULL;

--
-- Ràng buộc cho bảng `ticket_notify_settings`
--
ALTER TABLE `ticket_notify_settings`
  ADD CONSTRAINT `ticket_notify_settings_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
