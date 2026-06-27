<?php
// D:\RICH_LAND_DATA_UI\backend\config.php

require_once __DIR__ . '/env.php';

if (!defined('DB_HOST')) define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
if (!defined('DB_USER')) define('DB_USER', $_ENV['DB_USER'] ?? 'vhvxoigh_mail_auto');
if (!defined('DB_PASS')) define('DB_PASS', $_ENV['DB_PASS'] ?? 'Ideas@812');
if (!defined('DB_NAME')) define('DB_NAME', $_ENV['DB_NAME'] ?? 'vhvxoigh_db_richland');

// JWT
if (!defined('JWT_SECRET'))         define('JWT_SECRET',         $_ENV['JWT_SECRET'] ?? 'MinthCRM_S3cr3t_K3y_2025!@#$%');
if (!defined('JWT_EXPIRE_ACCESS'))  define('JWT_EXPIRE_ACCESS',  3600);
if (!defined('JWT_EXPIRE_REFRESH')) define('JWT_EXPIRE_REFRESH', 2592000);

// CORS allowed origins
if (!defined('ALLOWED_ORIGINS'))
    define('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://localhost:4173,http://open.richland.net,https://open.richland.net,https://crm-richland.vercel.app');

// Storage
if (!defined('UPLOAD_DIR')) define('UPLOAD_DIR', __DIR__ . '/uploads');

// Environment
if (!defined('APP_ENV')) define('APP_ENV', 'development');
