<?php
// ── Database credentials ───────────────────────
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_USER')) define('DB_USER', 'vhvxoigh_mail_auto');
if (!defined('DB_PASS')) define('DB_PASS', 'Ideas@812');
if (!defined('DB_NAME')) define('DB_NAME', 'vhvxoigh_db_richland');
if (!defined('DB_CHARSET')) define('DB_CHARSET', 'utf8mb4');

// ── JWT secret (change in production!) ─────────
if (!defined('JWT_SECRET')) define('JWT_SECRET', 'Rich LandCRM_S3cr3t_K3y_2025!@#$%');
if (!defined('JWT_EXPIRE_ACCESS')) define('JWT_EXPIRE_ACCESS',  60 * 60);         // 1 hour
if (!defined('JWT_EXPIRE_REFRESH')) define('JWT_EXPIRE_REFRESH', 60 * 60 * 24 * 30); // 30 days

// ── CORS ───────────────────────────────────────
if (!defined('ALLOWED_ORIGINS')) define('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000,http://open.richland.test,https://open.richland.test');

// ── Upload paths ───────────────────────────────
if (!defined('UPLOAD_DIR')) define('UPLOAD_DIR', __DIR__ . '/../uploads/');
if (!defined('UPLOAD_URL')) define('UPLOAD_URL', '/crm/uploads/');
