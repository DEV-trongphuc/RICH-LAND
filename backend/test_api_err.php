<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'env.php';
require_once 'config.php';
require_once 'db_connect.php';
require_once 'permission_matrix_helper.php';

echo "Database and config loaded successfully.\n";

$testUser = ['user_id' => 999, 'id' => 999, 'role' => 'admin'];
try {
    list($module, $actionType) = getActionModuleAndType('get_accounts');
    echo "Module: $module, Type: $actionType\n";
    $scope = getModulePermissionScope($testUser, $module, $actionType);
    echo "Scope: $scope\n";
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . " in " . $e->getFile() . " line " . $e->getLine() . "\n";
}
