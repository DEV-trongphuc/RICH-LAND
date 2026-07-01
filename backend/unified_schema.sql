-- D:\RICH_LAND_DATA_UI\backend\unified_schema.sql
-- Unified Database Schema for Richland CRM-RLVN

-- 1. Table: tenants (CRM)
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(100) NOT NULL UNIQUE,
  `plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
  `logo_url` text DEFAULT NULL,
  `primary_color` varchar(20) DEFAULT '#BD1D2D',
  `currency` char(3) DEFAULT 'VND',
  `timezone` varchar(50) DEFAULT 'Asia/Ho_Chi_Minh',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: users (Unified users, accounts, consultants)
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `username` varchar(100) DEFAULT NULL UNIQUE,
  `email` varchar(255) NOT NULL UNIQUE,
  `password_hash` varchar(255) DEFAULT NULL,
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
  `phone` varchar(20) DEFAULT NULL UNIQUE,
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
  `expires_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- ────────────────────────────────────────────────────────
-- CRM TABLES IMPORTED FROM DATABASE.SQL FOR STANDALONE SETUP
-- ────────────────────────────────────────────────────────

-- Table: activities (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `activities` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `type` enum('call','email','meeting','task','note') NOT NULL,
  `subject` varchar(255) NOT NULL,
  `body` text DEFAULT NULL,
  `status` enum('planned','done','cancelled') NOT NULL DEFAULT 'planned',
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `due_date` datetime DEFAULT NULL,
  `done_at` datetime DEFAULT NULL,
  `related_type` enum('contact','company','deal') DEFAULT NULL,
  `related_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: batches (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `batches` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `po_id` int(11) DEFAULT NULL,
  `batch_code` varchar(50) NOT NULL,
  `import_date` date NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `import_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `initial_qty` int(11) NOT NULL DEFAULT 0,
  `current_qty` int(11) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `status` enum('active','archived') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: cloud_files (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `cloud_files` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `uploaded_by` int(11) NOT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `file_size` bigint(20) UNSIGNED DEFAULT 0,
  `category` varchar(100) DEFAULT 'general',
  `visibility` enum('shared','personal') NOT NULL DEFAULT 'shared',
  `is_public` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: companies (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `companies` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `owner_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `tax_id` varchar(50) DEFAULT NULL,
  `industry` varchar(150) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `social_link` varchar(255) DEFAULT NULL,
  `stage_id` int(11) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `ward` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `expected_revenue` decimal(15,2) DEFAULT 0.00,
  `country` varchar(100) DEFAULT 'Việt Nam',
  `size` enum('1-10','11-50','51-200','201-500','500+') DEFAULT NULL,
  `status` enum('active','inactive','prospect') NOT NULL DEFAULT 'prospect',
  `legal_representative` varchar(255) DEFAULT NULL,
  `erp_code` varchar(100) DEFAULT NULL,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: contact_emails (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `contact_emails` (
  `id` int(11) NOT NULL,
  `contact_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `type` enum('work','personal','other') DEFAULT 'work',
  `is_primary` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: contact_phones (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `contact_phones` (
  `id` int(11) NOT NULL,
  `contact_id` int(11) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `type` enum('mobile','work','home','fax','other') DEFAULT 'mobile',
  `is_primary` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: custom_fields (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `custom_fields` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `field_key` varchar(100) NOT NULL,
  `label` varchar(200) NOT NULL,
  `field_type` enum('text','number','date','dropdown','multiselect','checkbox','url','email','phone') NOT NULL DEFAULT 'text',
  `options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`options`)),
  `is_required` tinyint(1) DEFAULT 0,
  `is_filterable` tinyint(1) DEFAULT 1,
  `order_index` smallint(6) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: custom_field_values (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `custom_field_values` (
  `id` int(11) NOT NULL,
  `custom_field_id` int(11) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `value_text` text DEFAULT NULL,
  `value_number` decimal(15,4) DEFAULT NULL,
  `value_date` date DEFAULT NULL,
  `value_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`value_json`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: deals (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `deals` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `stage_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `owner_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `value` decimal(15,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'VND',
  `probability` tinyint(3) UNSIGNED NOT NULL DEFAULT 50,
  `expected_close_date` date DEFAULT NULL,
  `actual_close_date` date DEFAULT NULL,
  `source` varchar(100) DEFAULT NULL,
  `lost_reason` text DEFAULT NULL,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `expected_close` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: deal_stage_history (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `deal_stage_history` (
  `id` int(11) NOT NULL,
  `deal_id` int(11) NOT NULL,
  `from_stage` int(11) DEFAULT NULL,
  `to_stage` int(11) NOT NULL,
  `moved_by` int(11) NOT NULL,
  `moved_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: duplicate_log (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `duplicate_log` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `entity_type` enum('contact','company') NOT NULL,
  `original_id` int(11) NOT NULL,
  `duplicate_id` int(11) NOT NULL,
  `match_field` varchar(50) NOT NULL,
  `resolved` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: entity_tags (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `entity_tags` (
  `tag_id` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `entity_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: expenses (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `approver_id` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `vendor_name` varchar(255) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `vat_amount` decimal(15,2) DEFAULT 0.00,
  `date` date NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `has_vat_invoice` tinyint(1) NOT NULL DEFAULT 0,
  `is_vat_inclusive` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: expense_entities (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `expense_entities` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `expense_id` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `entity_id` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: files (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `files` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `uploaded_by` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal','note') NOT NULL,
  `entity_id` int(11) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `file_size` bigint(20) UNSIGNED DEFAULT 0,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `version` smallint(6) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forms (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `forms` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `schema` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`schema`)),
  `mapping` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`mapping`)),
  `embed_token` varchar(64) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `submit_count` int(11) DEFAULT 0,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: form_submissions (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `form_submissions` (
  `id` int(11) NOT NULL,
  `form_id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `source_url` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_contact_id` int(11) DEFAULT NULL,
  `status` enum('new','processed','spam') DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: import_jobs (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `import_jobs` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `mapping` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`mapping`)),
  `status` enum('pending','processing','done','failed') DEFAULT 'pending',
  `total_rows` int(11) DEFAULT 0,
  `imported` int(11) DEFAULT 0,
  `duplicates` int(11) DEFAULT 0,
  `errors` int(11) DEFAULT 0,
  `error_log` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`error_log`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: inventory_logs (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `inventory_logs` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `action_type` enum('IMPORT','SALE','EXPORT_INTERNAL','ADJUST','RETURN') NOT NULL,
  `qty_change` int(11) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `receiver_id` int(11) DEFAULT NULL,
  `receiver_type` enum('contact','company','user') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: invoices (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `deal_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `invoice_number` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `status` enum('draft','pending','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
  `issue_date` date NOT NULL,
  `due_date` date NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `shipping_customer_pay` tinyint(1) DEFAULT 1 COMMENT '1: Khách trả, 0: Shop trả',
  `shipping_fee` decimal(15,2) DEFAULT 0.00,
  `is_inventory_deducted` tinyint(1) DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: invoice_items (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` int(11) NOT NULL,
  `invoice_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT 1.00,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: login_attempts (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` int(11) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `attempt_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_successful` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: notes (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `notes` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `entity_id` int(11) NOT NULL,
  `body` text NOT NULL,
  `type` enum('internal','public') NOT NULL DEFAULT 'internal',
  `is_pinned` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: note_mentions (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `note_mentions` (
  `id` int(11) NOT NULL,
  `note_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: notifications (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text DEFAULT NULL,
  `type` varchar(50) DEFAULT 'info',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `link` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: pipeline_stages (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `pipeline_stages` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `color` varchar(20) DEFAULT '#6366f1',
  `order_index` smallint(6) NOT NULL DEFAULT 0,
  `is_won` tinyint(1) NOT NULL DEFAULT 0,
  `is_lost` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: products (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `products` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'VND',
  `unit` varchar(50) DEFAULT 'cái',
  `stock_quantity` int(11) NOT NULL DEFAULT 0,
  `min_stock_level` int(11) NOT NULL DEFAULT 5,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `track_inventory` tinyint(1) DEFAULT 1,
  `track_cost` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: product_categories (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `product_categories` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `track_inventory` tinyint(1) DEFAULT 1,
  `has_cost` tinyint(1) DEFAULT 1,
  `track_batches` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: purchase_orders (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `supplier_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `po_number` varchar(50) NOT NULL,
  `order_date` date NOT NULL,
  `status` enum('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `payment_status` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `paid_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: purchase_order_items (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` int(11) NOT NULL,
  `po_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_cost` decimal(15,2) NOT NULL,
  `subtotal` decimal(15,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: quotes (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `quotes` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `deal_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `quote_number` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `status` enum('draft','sent','accepted','rejected','expired') NOT NULL DEFAULT 'draft',
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `valid_until` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `terms` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: quote_items (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `quote_items` (
  `id` int(11) NOT NULL,
  `quote_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT 1.00,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(5,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `sort_order` smallint(6) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: refresh_tokens (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: segments (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `segments` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `filters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`filters`)),
  `is_shared` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: suppliers (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `contact_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `tax_code` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `total_ordered` decimal(15,2) DEFAULT 0.00,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: tags (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `tags` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `color` varchar(20) DEFAULT '#6366f1',
  `entity_type` enum('contact','company','deal','all') DEFAULT 'all',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: tickets (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `assignee_id` int(11) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  `priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `due_date` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `related_contacts` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`related_contacts`)),
  `related_users` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`related_users`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: ticket_comments (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `ticket_comments` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: workflows (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `workflows` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `trigger_type` varchar(100) NOT NULL,
  `trigger_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`trigger_data`)),
  `conditions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`conditions`)),
  `actions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`actions`)),
  `is_active` tinyint(1) DEFAULT 1,
  `run_count` int(11) DEFAULT 0,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: file_categories (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `file_categories` (
  `id` varchar(50) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `label` varchar(100) NOT NULL,
  `icon_type` varchar(50) DEFAULT 'folder',
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: activity_comments (Imported from CRM database.sql)
CREATE TABLE IF NOT EXISTS `activity_comments` (
  `id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `activity_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `content` text DEFAULT NULL,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attachments`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: admin_logs (Imported from GIAO_DATA schema.sql - unified layout)
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL, -- references users.id (physical table)
  `action` varchar(100) NOT NULL,
  `details` longtext DEFAULT NULL COMMENT 'JSON details',
  `log_type` varchar(50) GENERATED ALWAYS AS (JSON_VALUE(details, '$.type')) VIRTUAL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `is_rolled_back` tinyint(1) DEFAULT 0 COMMENT 'Đánh dấu log đã được hoàn tác'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: data_reports (Imported from GIAO_DATA schema.sql - unified layout)
CREATE TABLE IF NOT EXISTS `data_reports` (
  `id` int(11) NOT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `consultant_id` int(11) DEFAULT NULL, -- references users.id (physical table)
  `round_id` int(11) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL,
  `resolved_by` varchar(100) DEFAULT NULL COMMENT 'Tên admin duyệt ticket',
  `reject_reason` varchar(255) DEFAULT NULL COMMENT 'Lý do từ chối ticket',
  `approval_reason` varchar(255) DEFAULT NULL COMMENT 'Lý do duyệt ticket'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: sync_queue (Imported from GIAO_DATA schema.sql - unified layout)
CREATE TABLE IF NOT EXISTS `sync_queue` (
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

ALTER TABLE `activities` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_activity_tenant` (`tenant_id`),
  ADD KEY `idx_activity_user` (`user_id`),
  ADD KEY `idx_activity_related` (`related_type`,`related_id`),
  ADD KEY `idx_activity_due` (`due_date`),
  ADD KEY `idx_activity_status` (`status`),
  ADD KEY `idx_act_type` (`tenant_id`,`type`),
  ADD KEY `idx_activity_created` (`tenant_id`,`created_at`),
  ADD KEY `idx_activities_tenant_user_status` (`tenant_id`,`user_id`,`status`,`due_date`);
ALTER TABLE `batches` ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `batch_code` (`batch_code`),
  ADD KEY `idx_batches_fifo` (`product_id`,`tenant_id`,`current_qty`,`import_date`);
ALTER TABLE `cloud_files` ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `uploaded_by` (`uploaded_by`),
  ADD KEY `visibility` (`visibility`),
  ADD KEY `fk_cf_editor` (`updated_by`);
ALTER TABLE `companies` ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_company_tenant` (`tenant_id`),
  ADD KEY `idx_company_owner` (`owner_id`),
  ADD KEY `idx_company_status` (`status`),
  ADD KEY `idx_company_stage` (`stage_id`);
ALTER TABLE `companies` ADD FULLTEXT KEY `idx_company_search` (`name`,`email`);
ALTER TABLE `contact_emails` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ce_contact` (`contact_id`);
ALTER TABLE `contact_phones` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cp_contact` (`contact_id`);
ALTER TABLE `custom_fields` ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_field_key` (`tenant_id`,`entity_type`,`field_key`),
  ADD KEY `idx_cf_tenant_entity` (`tenant_id`,`entity_type`);
ALTER TABLE `custom_field_values` ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_field_value` (`custom_field_id`,`entity_id`),
  ADD KEY `idx_cfv_entity` (`custom_field_id`,`entity_id`);
ALTER TABLE `deals` ADD PRIMARY KEY (`id`),
  ADD KEY `contact_id` (`contact_id`),
  ADD KEY `company_id` (`company_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_deal_tenant` (`tenant_id`),
  ADD KEY `idx_deal_stage` (`stage_id`),
  ADD KEY `idx_deal_owner` (`owner_id`),
  ADD KEY `idx_deal_close` (`expected_close_date`),
  ADD KEY `idx_deal_value` (`tenant_id`,`value`),
  ADD KEY `idx_deal_tenant_created` (`tenant_id`,`created_at`),
  ADD KEY `idx_deals_tenant_deleted` (`tenant_id`,`deleted_at`),
  ADD KEY `idx_deals_deep_filter` (`tenant_id`,`stage_id`,`deleted_at`),
  ADD KEY `idx_deals_tenant_owner_deleted` (`tenant_id`,`owner_id`,`deleted_at`,`stage_id`);
ALTER TABLE `deal_stage_history` ADD PRIMARY KEY (`id`),
  ADD KEY `moved_by` (`moved_by`),
  ADD KEY `idx_dsh_deal` (`deal_id`);
ALTER TABLE `duplicate_log` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_dup_tenant` (`tenant_id`,`resolved`);
ALTER TABLE `entity_tags` ADD PRIMARY KEY (`tag_id`,`entity_type`,`entity_id`),
  ADD KEY `idx_et_entity` (`entity_type`,`entity_id`);
ALTER TABLE `expenses` ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_exp_tenant` (`tenant_id`),
  ADD KEY `idx_exp_status` (`status`),
  ADD KEY `fk_exp_approver` (`approver_id`),
  ADD KEY `idx_exp_date` (`tenant_id`,`date`);
ALTER TABLE `expense_entities` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ee_expense` (`expense_id`),
  ADD KEY `idx_ee_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_ee_tenant` (`tenant_id`);
ALTER TABLE `files` ADD PRIMARY KEY (`id`),
  ADD KEY `uploaded_by` (`uploaded_by`),
  ADD KEY `idx_file_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_file_tenant` (`tenant_id`);
ALTER TABLE `forms` ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `embed_token` (`embed_token`),
  ADD KEY `tenant_id` (`tenant_id`);
ALTER TABLE `form_submissions` ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `idx_fs_form` (`form_id`),
  ADD KEY `idx_fs_status` (`status`);
ALTER TABLE `import_jobs` ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `user_id` (`user_id`);
ALTER TABLE `inventory_logs` ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `batch_id` (`batch_id`),
  ADD KEY `idx_inv_logs_receiver` (`receiver_type`,`receiver_id`),
  ADD KEY `idx_inventory_logs_filter` (`tenant_id`,`action_type`,`created_at`),
  ADD KEY `idx_inv_logs_reason` (`tenant_id`,`reason`(100));
ALTER TABLE `invoices` ADD PRIMARY KEY (`id`),
  ADD KEY `deal_id` (`deal_id`),
  ADD KEY `company_id` (`company_id`),
  ADD KEY `contact_id` (`contact_id`),
  ADD KEY `idx_inv_tenant` (`tenant_id`),
  ADD KEY `idx_inv_status` (`status`),
  ADD KEY `idx_invoices_deep_filter` (`tenant_id`,`status`,`paid_at`);
ALTER TABLE `invoice_items` ADD PRIMARY KEY (`id`),
  ADD KEY `invoice_id` (`invoice_id`),
  ADD KEY `product_id` (`product_id`);
ALTER TABLE `login_attempts` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ip_attempts` (`ip_address`,`attempt_time`);
ALTER TABLE `notes` ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_note_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_note_parent` (`parent_id`),
  ADD KEY `idx_note_tenant` (`tenant_id`),
  ADD KEY `idx_note_time` (`created_at`);
ALTER TABLE `note_mentions` ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_mention` (`note_id`,`user_id`),
  ADD KEY `fk_note_mentions_user` (`user_id`);
ALTER TABLE `notifications` ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `idx_notif_user` (`user_id`,`is_read`),
  ADD KEY `idx_notif_created` (`created_at`);
ALTER TABLE `pipeline_stages` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_stage_tenant` (`tenant_id`),
  ADD KEY `idx_stage_order` (`tenant_id`,`order_index`);
ALTER TABLE `products` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_product_tenant` (`tenant_id`),
  ADD KEY `idx_product_sku` (`tenant_id`,`sku`),
  ADD KEY `fk_prod_cat` (`category_id`),
  ADD KEY `fk_products_creator` (`created_by`);
ALTER TABLE `product_categories` ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_category` (`tenant_id`,`name`);
ALTER TABLE `purchase_orders` ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_po_number_tenant` (`tenant_id`,`po_number`),
  ADD KEY `idx_po_supplier` (`supplier_id`),
  ADD KEY `idx_po_created` (`created_by`);
ALTER TABLE `purchase_order_items` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_po_item_po` (`po_id`),
  ADD KEY `idx_po_item_product` (`product_id`);
ALTER TABLE `quotes` ADD PRIMARY KEY (`id`),
  ADD KEY `contact_id` (`contact_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_quote_tenant` (`tenant_id`),
  ADD KEY `idx_quote_deal` (`deal_id`),
  ADD KEY `idx_quote_status` (`status`);
ALTER TABLE `quote_items` ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `idx_qi_quote` (`quote_id`);
ALTER TABLE `refresh_tokens` ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_hash` (`token_hash`),
  ADD KEY `idx_rt_user` (`user_id`),
  ADD KEY `idx_rt_expires` (`expires_at`);
ALTER TABLE `segments` ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_seg_tenant` (`tenant_id`,`entity_type`);
ALTER TABLE `suppliers` ADD PRIMARY KEY (`id`),
  ADD KEY `idx_supplier_tenant` (`tenant_id`),
  ADD KEY `idx_supplier_created` (`created_by`);
ALTER TABLE `tags` ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_tag` (`tenant_id`,`name`,`entity_type`);
ALTER TABLE `tickets` ADD PRIMARY KEY (`id`),
  ADD KEY `contact_id` (`contact_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `assignee_id` (`assignee_id`),
  ADD KEY `idx_ticket_tenant` (`tenant_id`),
  ADD KEY `idx_ticket_status` (`status`);
ALTER TABLE `ticket_comments` ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_tc_ticket` (`ticket_id`);
ALTER TABLE `workflows` ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_wf_tenant_active` (`tenant_id`,`is_active`);
ALTER TABLE `activities` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `batches` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `cloud_files` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `companies` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `contact_emails` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `contact_phones` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `custom_fields` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `custom_field_values` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `deals` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `deal_stage_history` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `duplicate_log` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `expenses` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `expense_entities` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `files` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `forms` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `form_submissions` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `import_jobs` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `inventory_logs` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `invoices` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `invoice_items` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `login_attempts` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `notes` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `note_mentions` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `notifications` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `pipeline_stages` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `products` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `product_categories` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `purchase_orders` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `purchase_order_items` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `quotes` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `quote_items` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `refresh_tokens` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `segments` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `suppliers` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `tags` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `tickets` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `ticket_comments` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `workflows` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `activities` ADD CONSTRAINT `activities_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `activities_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `batches` ADD CONSTRAINT `fk_batch_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;
ALTER TABLE `cloud_files` ADD CONSTRAINT `fk_cf_editor` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_cf_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cf_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `companies` ADD CONSTRAINT `companies_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `companies_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `companies_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);
ALTER TABLE `contact_emails` ADD CONSTRAINT `contact_emails_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE;
ALTER TABLE `contact_phones` ADD CONSTRAINT `contact_phones_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE;
ALTER TABLE `custom_fields` ADD CONSTRAINT `custom_fields_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `custom_field_values` ADD CONSTRAINT `custom_field_values_ibfk_1` FOREIGN KEY (`custom_field_id`) REFERENCES `custom_fields` (`id`) ON DELETE CASCADE;
ALTER TABLE `deals` ADD CONSTRAINT `deals_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `deals_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `pipeline_stages` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `deals_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `deals_ibfk_4` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `deals_ibfk_5` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `deals_ibfk_6` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);
ALTER TABLE `deal_stage_history` ADD CONSTRAINT `deal_stage_history_ibfk_1` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `deal_stage_history_ibfk_2` FOREIGN KEY (`moved_by`) REFERENCES `users` (`id`);
ALTER TABLE `duplicate_log` ADD CONSTRAINT `duplicate_log_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `entity_tags` ADD CONSTRAINT `entity_tags_ibfk_1` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE;
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_exp_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `expense_entities` ADD CONSTRAINT `expense_entities_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `expense_entities_ibfk_2` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE CASCADE;
ALTER TABLE `files` ADD CONSTRAINT `files_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `files_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`);
ALTER TABLE `forms` ADD CONSTRAINT `forms_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `form_submissions` ADD CONSTRAINT `form_submissions_ibfk_1` FOREIGN KEY (`form_id`) REFERENCES `forms` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `form_submissions_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `import_jobs` ADD CONSTRAINT `import_jobs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `import_jobs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `inventory_logs` ADD CONSTRAINT `fk_log_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `invoices_ibfk_3` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `invoices_ibfk_4` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL;
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `invoice_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;
ALTER TABLE `notes` ADD CONSTRAINT `notes_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `notes_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE;
ALTER TABLE `note_mentions` ADD CONSTRAINT `fk_note_mentions_note` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_note_mentions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `pipeline_stages` ADD CONSTRAINT `pipeline_stages_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `products` ADD CONSTRAINT `fk_prod_cat` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_products_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `purchase_orders` ADD CONSTRAINT `fk_po_created` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  ADD CONSTRAINT `fk_po_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `fk_po_item_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_po_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `quotes_ibfk_2` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `quotes_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `quotes_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);
ALTER TABLE `quote_items` ADD CONSTRAINT `quote_items_ibfk_1` FOREIGN KEY (`quote_id`) REFERENCES `quotes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `quote_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `segments` ADD CONSTRAINT `segments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `segments_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `suppliers` ADD CONSTRAINT `fk_supp_created` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_supp_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `tags` ADD CONSTRAINT `tags_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tickets_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `tickets_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `tickets_ibfk_4` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `ticket_comments` ADD CONSTRAINT `ticket_comments_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ticket_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `workflows` ADD CONSTRAINT `workflows_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `workflows_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);
ALTER TABLE `file_categories` ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`);
ALTER TABLE `file_categories` ADD CONSTRAINT `file_categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;
ALTER TABLE `activity_comments` ADD PRIMARY KEY (`id`),
  ADD KEY `activity_id` (`activity_id`),
  ADD KEY `tenant_id` (`tenant_id`);
ALTER TABLE `activity_comments` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `activity_comments` ADD CONSTRAINT `activity_comments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `activity_comments_ibfk_2` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `activity_comments_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

-- Indices & Primary Keys for admin_logs, data_reports, sync_queue
ALTER TABLE `admin_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_action_created` (`action`,`created_at`),
  ADD KEY `idx_action_log_type_created` (`action`,`log_type`,`created_at`);

ALTER TABLE `data_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `consultant_id` (`consultant_id`),
  ADD KEY `idx_round_id` (`round_id`),
  ADD KEY `idx_report_lookup` (`lead_id`,`consultant_id`,`round_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_status` (`status`);

ALTER TABLE `sync_queue`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `lead_id` (`lead_id`),
  ADD KEY `connection_id` (`connection_id`),
  ADD KEY `idx_status_retry` (`status`,`next_retry_at`);

-- AUTO_INCREMENTs
ALTER TABLE `admin_logs` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `data_reports` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `sync_queue` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

-- Foreign Keys (pointing directly to physical users table to prevent view referencing error)
ALTER TABLE `admin_logs`
  ADD CONSTRAINT `admin_logs_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `data_reports`
  ADD CONSTRAINT `data_reports_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `data_reports_ibfk_2` FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `data_reports_ibfk_3` FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE;

ALTER TABLE `sync_queue`
  ADD CONSTRAINT `sync_queue_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sync_queue_ibfk_2` FOREIGN KEY (`connection_id`) REFERENCES `sheet_connections` (`id`) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────
-- INITIAL SEED DATA
-- ────────────────────────────────────────────────────────

-- 1. Default Tenant
INSERT INTO `tenants` (`id`, `name`, `slug`, `plan`, `logo_url`, `primary_color`, `currency`, `timezone`, `is_active`, `created_at`) 
VALUES (1, 'Richland', 'richland', 'enterprise', 'LOGO.webp', '#BD1D2D', 'VND', 'Asia/Ho_Chi_Minh', 1, CURRENT_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 2. Default Superadmin User (password: admin123)
INSERT INTO `users` (`id`, `tenant_id`, `email`, `password_hash`, `full_name`, `role`, `is_active`, `created_at`) 
VALUES (1, 1, 'admin@richland.vn', '$2b$10$1X4NT1kNF2s/YCJCnmpvauhI8/p292oUacNu6Y2z0wBs8T10lEdZS', 'Super Admin', 'superadmin', 1, CURRENT_TIMESTAMP())
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- 3. Default System Settings
INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES
('db_version', '146'),
('frontend_url', 'http://localhost:5173'),
('ai_screener_model', 'gemini-2.5-flash-lite'),
('report_error_reasons', '[\"Sai số điện thoại / Số ảo\", \"Trùng của tôi (Trùng Saleperson)\", \"Trùng của người khác (Saleperson khác đã chăm)\", \"Spam ảo / Junk lead\", \"Khác (Vui lòng ghi rõ ở phần ghi chú)\"]'),
('pipeline_status_hierarchy', '[\"chua_xac_dinh\", \"quan_tam\", \"dong_y_gap\", \"da_gap\", \"booking\", \"dat_coc\", \"dong_deal\"]')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- 4. Mark migrations as applied
CREATE TABLE IF NOT EXISTS `schema_migrations` (
    `migration` varchar(255) NOT NULL,
    `applied_at` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`migration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `schema_migrations` (`migration`, `applied_at`) VALUES 
('migrate_2026_05_06_v3_files.sql', CURRENT_TIMESTAMP()), 
('migrate_activity_comments.sql', CURRENT_TIMESTAMP()), 
('migrate_fractional_quantities.sql', CURRENT_TIMESTAMP())
ON DUPLICATE KEY UPDATE `migration` = VALUES(`migration`);
