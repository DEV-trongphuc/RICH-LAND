<?php
// ── Database credentials ───────────────────────
require_once __DIR__ . '/../env.php';
if (!defined('DB_HOST')) define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
if (!defined('DB_USER')) define('DB_USER', $_ENV['DB_USER'] ?? 'zccqvhhh_crm-rlvn');
if (!defined('DB_PASS')) define('DB_PASS', $_ENV['DB_PASS'] ?? '$1;RKuCwX)VD;k~#');
if (!defined('DB_NAME')) define('DB_NAME', $_ENV['DB_NAME'] ?? 'zccqvhhh_crm-rlvn');
if (!defined('DB_CHARSET')) define('DB_CHARSET', 'utf8mb4');

// ── JWT secret (change in production!) ─────────
if (!defined('JWT_SECRET')) define('JWT_SECRET', $_ENV['JWT_SECRET'] ?? 'RichLandCRM_S3cr3t_K3y_2026!@#$%');
if (!defined('JWT_EXPIRE_ACCESS')) define('JWT_EXPIRE_ACCESS',  60 * 60);         // 1 hour
if (!defined('JWT_EXPIRE_REFRESH')) define('JWT_EXPIRE_REFRESH', 60 * 60 * 24 * 30); // 30 days

// ── CORS ───────────────────────────────────────
if (!defined('ALLOWED_ORIGINS')) define('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000,https://crm.richland.city,https://richland.city,https://crm-richland.vercel.app,https://rich-land.vercel.app');

// ── Upload paths ───────────────────────────────
if (!defined('UPLOAD_DIR')) define('UPLOAD_DIR', __DIR__ . '/../uploads/');
if (!defined('UPLOAD_URL')) define('UPLOAD_URL', '/crm/uploads/');
