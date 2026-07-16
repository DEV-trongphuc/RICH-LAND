<?php
define('DIAG_TOKEN', '1');
require_once __DIR__ . '/env.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';
require __DIR__ . '/audit_test_runner.php';
unlink(__FILE__);
