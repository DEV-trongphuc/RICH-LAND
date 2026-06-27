-- D:\RICH_LAND_DATA_UI\backend\unified_schema.sql
-- Unified Database Schema for Richland CRM-RLVN

-- 1. Table: tenants (CRM)
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(100) NOT NULL UNIQUE,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: users (Unified users, accounts, consultants)
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `username` varchar(100) DEFAULT NULL UNIQUE,
  `email` varchar(255) NOT NULL UNIQUE,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(200) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `role` enum('super_admin','admin','manager','assistant','sales','viewer','superadmin') NOT NULL DEFAULT 'sales',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  -- Consultant (Sales) specific columns for routing & scheduling
  `status` enum('active','inactive','leave') DEFAULT 'active',
  `vacation_mode` tinyint(1) DEFAULT 0,
  `leave_start` date DEFAULT NULL,
  `leave_end` date DEFAULT NULL,
  `work_start_time` varchar(5) DEFAULT '08:00',
  `work_end_time` varchar(5) DEFAULT '17:30',
  `work_schedule` longtext DEFAULT NULL, -- JSON config
  `zalo_chat_id` varchar(255) DEFAULT NULL,
  `is_confirmed` tinyint(1) DEFAULT 0,
  `confirm_token` varchar(64) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `team_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2.05 Table: teams (CRM & Routing)
CREATE TABLE IF NOT EXISTS `teams` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `name` varchar(255) NOT NULL,
  `leader_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`leader_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `users` ADD CONSTRAINT `fk_user_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL;

-- 2.1 View: consultants (Backward compatibility for DATA app)
CREATE OR REPLACE VIEW `consultants` AS 
SELECT 
  `id`, 
  `full_name` AS `name`, 
  `email`, 
  `status`, 
  `leave_start`, 
  `leave_end`, 
  `created_at`, 
  `zalo_chat_id`, 
  `work_start_time`, 
  `work_end_time`, 
  `work_schedule`, 
  `avatar_url` AS `avatar`, 
  `vacation_mode`,
  `team_id`
FROM `users` 
WHERE `role` = 'sales';

-- 2.2 View: accounts (Backward compatibility for DATA app)
CREATE OR REPLACE VIEW `accounts` AS 
SELECT 
  `id`, 
  `username`, 
  `password_hash`, 
  `role`, 
  `full_name` AS `name`, 
  `created_at`, 
  `email`, 
  `zalo_chat_id`, 
  `is_confirmed`, 
  `confirm_token`, 
  `last_login_at` AS `last_login`, 
  `avatar_url` AS `avatar` 
FROM `users` 
WHERE `role` IN ('super_admin', 'admin', 'assistant', 'viewer', 'superadmin');

-- 3. Table: projects (Rễ liên kết - Module 6)
CREATE TABLE IF NOT EXISTS `projects` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `name` varchar(255) NOT NULL,
  `code` varchar(100) NOT NULL UNIQUE,
  `description` text DEFAULT NULL,
  `status` enum('active','completed','draft') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: project_roster (Module 6 - Sales allowed to sell project)
CREATE TABLE IF NOT EXISTS `project_roster` (
  `project_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`project_id`, `user_id`),
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table: project_documents (Module 6 - Project documentation, restricted access)
CREATE TABLE IF NOT EXISTS `project_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `project_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint(20) DEFAULT 0,
  `mime_type` varchar(100) DEFAULT NULL,
  `uploaded_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Table: persons (Intake - Chống trùng lặp theo SĐT - Module 1)
CREATE TABLE IF NOT EXISTS `persons` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `phone` varchar(20) NOT NULL UNIQUE,
  `email` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Table: contacts (CRM / KHTN - Module 3)
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `person_id` int(11) DEFAULT NULL, -- FK to Persons (Chống trùng lặp)
  `project_id` int(11) DEFAULT NULL, -- FK to Projects
  `company_id` int(11) DEFAULT NULL,
  `owner_id` int(11) DEFAULT NULL,   -- FK to Users (Sales Owner)
  `created_by` int(11) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL DEFAULT '',
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `avatar_url` text DEFAULT NULL,
  `mobile` varchar(50) DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `job_title` varchar(150) DEFAULT NULL,
  `department` varchar(150) DEFAULT NULL,
  `source` varchar(100) DEFAULT 'other',
  `status` enum('lead','qualified','customer','churned') NOT NULL DEFAULT 'lead',
  `pipeline_status` enum('chua_xac_dinh','quan_tam','dong_y_gap','da_gap','booking','dat_coc','not_lead','dong_deal') NOT NULL DEFAULT 'chua_xac_dinh',
  `temperature` enum('hot','warm','neutral','cool','cold') NOT NULL DEFAULT 'neutral',
  `suggested_temperature` enum('hot','warm','neutral','cool','cold') NOT NULL DEFAULT 'neutral',
  `temperature_updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `tags` longtext DEFAULT NULL, -- JSON
  `notes` text DEFAULT NULL,
  `total_spent` decimal(15,2) NOT NULL DEFAULT 0.00,
  `order_count` int(11) NOT NULL DEFAULT 0,
  `last_order_at` datetime DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `ward` varchar(100) DEFAULT NULL,
  `expected_revenue` decimal(15,2) DEFAULT 0.00,
  `win_probability` tinyint(3) DEFAULT 50,
  `last_contact` date DEFAULT NULL,
  `lead_score` tinyint(3) DEFAULT 0,
  `stage_id` int(11) DEFAULT NULL,
  -- TTL1 data
  `ttl1_completed` tinyint(1) DEFAULT 0,
  `ttl1_data` longtext DEFAULT NULL, -- JSON containing the 5 groups of TTL1
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Table: leads (Module 1 - Raw incoming lead inputs)
CREATE TABLE IF NOT EXISTS `leads` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `person_id` int(11) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `note` mediumtext DEFAULT NULL,
  `campaign_id` varchar(255) DEFAULT NULL,
  `campaign_name` varchar(255) DEFAULT NULL,
  `ad_id` varchar(255) DEFAULT NULL,
  `raw_payload` longtext DEFAULT NULL, -- JSON payload from Meta/Google
  `assigned_to` int(11) DEFAULT NULL, -- FK to users
  `target_round_id` int(11) DEFAULT NULL,
  `is_accepted` tinyint(1) DEFAULT 0,
  `accepted_at` datetime DEFAULT NULL,
  `status` varchar(50) DEFAULT 'active',
  `ai_screener_status` varchar(50) DEFAULT 'not_screened',
  `ai_evaluation` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Table: lead_offers (Module 2 - 2 Minute Timeout Lead Offer Queue)
CREATE TABLE IF NOT EXISTS `lead_offers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL, -- FK to users
  `round_id` int(11) NOT NULL,
  `offered_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NOT NULL DEFAULT '1970-01-01 00:00:01',
  `status` enum('pending','accepted','expired','rejected') NOT NULL DEFAULT 'pending',
  `action_reason` varchar(255) DEFAULT NULL,
  `responded_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Table: distribution_rounds (DATA App)
CREATE TABLE IF NOT EXISTS `distribution_rounds` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `round_name` varchar(255) NOT NULL,
  `description` mediumtext DEFAULT NULL,
  `cc_emails` mediumtext DEFAULT NULL,
  `last_assigned_consultant_id` int(11) DEFAULT NULL, -- FK to users
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`last_assigned_consultant_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Table: round_consultants (DATA App)
CREATE TABLE IF NOT EXISTS `round_consultants` (
  `round_id` int(11) NOT NULL,
  `consultant_id` int(11) NOT NULL, -- references users.id
  `is_active` tinyint(1) DEFAULT 1,
  `receive_ratio` int(11) DEFAULT 1,
  `skip_count` int(11) DEFAULT 0,
  `compensation_count` int(11) DEFAULT 0,
  `data_per_turn` int(11) DEFAULT 1,
  `current_turn_remaining` int(11) DEFAULT 0,
  `skipped_credit` int(11) DEFAULT 0,
  PRIMARY KEY (`round_id`, `consultant_id`),
  FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Table: distribution_logs (DATA App)
CREATE TABLE IF NOT EXISTS `distribution_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL, -- FK to users
  `round_id` int(11) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `message` mediumtext DEFAULT NULL,
  `received_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Table: active_compensation_logs (DATA App)
CREATE TABLE IF NOT EXISTS `active_compensation_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `round_id` int(11) NOT NULL,
  `consultant_id` int(11) NOT NULL, -- references users.id
  `admin_id` int(11) NOT NULL, -- references users.id
  `amount` int(11) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Table: routing_rules (DATA App)
CREATE TABLE IF NOT EXISTS `routing_rules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `connection_id` varchar(255) DEFAULT NULL,
  `target_round_id` int(11) DEFAULT NULL,
  `condition_column` varchar(100) NOT NULL,
  `condition_operator` varchar(50) DEFAULT 'contains',
  `condition_value` varchar(255) NOT NULL,
  `priority` int(11) DEFAULT 0,
  `conditions_json` longtext DEFAULT NULL,
  `logical_operator` varchar(10) DEFAULT 'AND',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`target_round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Table: sheet_connections (DATA App)
CREATE TABLE IF NOT EXISTS `sheet_connections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sheet_name` varchar(255) NOT NULL,
  `spreadsheet_id` varchar(255) DEFAULT NULL,
  `connection_type` varchar(20) DEFAULT 'sheets',
  `webhook_token` varchar(64) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `sync_interval` int(11) DEFAULT 5,
  `last_sync_at` datetime DEFAULT NULL,
  `sync_status` varchar(50) DEFAULT 'idle',
  `email_template` mediumtext DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `require_both_contact` tinyint(1) DEFAULT 0,
  `sync_mode` enum('all','new_only') DEFAULT 'all',
  `is_initialized` tinyint(1) DEFAULT 0,
  `is_silent` tinyint(1) DEFAULT 0,
  `sync_saleperson` tinyint(1) DEFAULT 0,
  `last_error` varchar(255) DEFAULT NULL,
  `two_way_sync` tinyint(1) DEFAULT 0,
  `google_script_url` varchar(512) DEFAULT NULL,
  `lead_recall_minutes` int(11) DEFAULT 0,
  `sync_error_count` int(11) DEFAULT 0,
  `notify_admin` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Table: field_mappings (DATA App)
CREATE TABLE IF NOT EXISTS `field_mappings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `connection_id` int(11) NOT NULL,
  `sheet_column` varchar(255) NOT NULL,
  `system_field` varchar(100) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `custom_label` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`connection_id`) REFERENCES `sheet_connections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Table: sheet_sync_records (DATA App)
CREATE TABLE IF NOT EXISTS `sheet_sync_records` (
  `connection_id` int(11) NOT NULL,
  `row_hash` varchar(64) NOT NULL,
  `synced_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`connection_id`, `row_hash`),
  FOREIGN KEY (`connection_id`) REFERENCES `sheet_connections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Table: system_settings (DATA App)
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` mediumtext DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Table: ticket_notify_settings (DATA App)
CREATE TABLE IF NOT EXISTS `ticket_notify_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL, -- references users.id
  PRIMARY KEY (`id`),
  FOREIGN KEY (`account_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. Table: cooperation_slips (Module 4 - Phiếu hợp tác chia hoa hồng)
CREATE TABLE IF NOT EXISTS `cooperation_slips` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contact_id` int(11) NOT NULL, -- ref to contacts (KHTN)
  `deposit_slip_id` int(11) DEFAULT NULL, -- ref to deposit slip
  `version` int(11) NOT NULL DEFAULT 1,
  `total_percentage` int(11) NOT NULL DEFAULT 100,
  `shares_json` longtext NOT NULL, -- JSON of user_id -> percentage mapping
  `signatures_json` longtext DEFAULT NULL, -- JSON of user_id -> signature timestamp, ip, role mapping
  `status` enum('pending_signatures','pending_manager_approval','approved','rejected','disputed') NOT NULL DEFAULT 'pending_signatures',
  `dispute_details` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Table: deposits (Module 8 - Phiếu cọc và giỏ hàng)
CREATE TABLE IF NOT EXISTS `deposits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contact_id` int(11) NOT NULL, -- ref to contacts (KHTN)
  `project_id` int(11) NOT NULL,
  `unit_code` varchar(100) NOT NULL, -- Căn hộ
  `price` decimal(15,2) NOT NULL,
  `expected_commission` decimal(15,2) NOT NULL DEFAULT 0.00,
  `status` enum('pending_admin','approved','cancelled') NOT NULL DEFAULT 'pending_admin',
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. Table: deposit_milestones (Module 8 - Đợt UNC thanh toán phí)
CREATE TABLE IF NOT EXISTS `deposit_milestones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `deposit_id` int(11) NOT NULL,
  `milestone_name` varchar(255) NOT NULL, -- Đợt 1, đợt 2...
  `expected_amount` decimal(15,2) NOT NULL,
  `unc_file_path` varchar(500) DEFAULT NULL, -- Ủy nhiệm chi
  `status` enum('pending','paid','approved','failed') NOT NULL DEFAULT 'pending',
  `approval_date` timestamp NULL DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`deposit_id`) REFERENCES `deposits` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. Table: capi_logs (Module 9 - Meta CAPI Logs)
CREATE TABLE IF NOT EXISTS `capi_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `event_name` enum('CompleteRegistration','Schedule','Purchase','BAD') NOT NULL,
  `payload_hash` varchar(64) NOT NULL,
  `sent_payload` text NOT NULL,
  `response_status` int(11) NOT NULL,
  `response_body` text DEFAULT NULL,
  `sent_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. Table: audit_logs (CRM/RLS Audit Log)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT 1,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `resource` varchar(100) NOT NULL,
  `resource_id` int(11) DEFAULT NULL,
  `old_data` longtext DEFAULT NULL,
  `new_data` longtext DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. Table: communication_logs (DATA App)
CREATE TABLE IF NOT EXISTS `communication_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) DEFAULT NULL,
  `type` enum('zalo','email') NOT NULL,
  `recipient` varchar(255) NOT NULL,
  `status` enum('sent','failed') NOT NULL,
  `error_message` text DEFAULT NULL,
  `sent_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. Table: mail_queue (DATA App)
CREATE TABLE IF NOT EXISTS `mail_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `to_email` varchar(255) NOT NULL,
  `cc_email` varchar(255) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `body_html` longtext NOT NULL,
  `status` enum('pending','processing','sent','failed') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `sent_at` datetime DEFAULT NULL,
  `attempts` int(11) DEFAULT 0,
  `last_error` text DEFAULT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. Table: zalo_queue (DATA App)
CREATE TABLE IF NOT EXISTS `zalo_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bot_token` varchar(255) NOT NULL,
  `chat_id` varchar(255) NOT NULL,
  `body_text` text NOT NULL,
  `status` enum('pending','processing','sent','failed') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `sent_at` datetime DEFAULT NULL,
  `attempts` int(11) DEFAULT 0,
  `last_error` text DEFAULT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
