<?php
// f:\CRM\backend\config\Database.php

class Database {
    private static ?PDO $instance = null;

    private function __construct() {}

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            $dsn  = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
            $opts = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            $maxRetries = 15;
            for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
                try {
                    self::$instance = new PDO($dsn, DB_USER, DB_PASS, $opts);
                    @self::$instance->exec("SET SESSION wait_timeout = 10");
                    @self::$instance->exec("SET SESSION interactive_timeout = 10");
                    break;
                } catch (\PDOException $e) {
                    $msg = $e->getMessage();
                    if ($attempt < $maxRetries && ($e->getCode() == 1203 || strpos($msg, 'max_user_connections') !== false || strpos($msg, '1203') !== false)) {
                        usleep(100000 + mt_rand(50000, 200000));
                        continue;
                    }
                    throw $e;
                }
            }
        }
        return self::$instance;
    }

    public static function close(): void {
        self::$instance = null;
        if (isset($GLOBALS['db'])) {
            $GLOBALS['db'] = null;
        }
    }
}

register_shutdown_function(function() {
    Database::close();
});

