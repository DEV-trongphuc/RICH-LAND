<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'env.php';
require_once 'config.php';
require_once 'db_connect.php';
require_once 'permission_matrix_helper.php';

$decodedUser = [
    'user_id' => 999,
    'id' => 999,
    'role' => 'admin',
    'email' => 'admin@richland.test'
];

echo "Simulating token verification...\n";

if (isset($decodedUser['role']) && $decodedUser['role'] === 'sales') {
    $decodedUser['role'] = 'sale';
}

if (!isset($decodedUser['user_id']) && isset($decodedUser['id'])) {
    $decodedUser['user_id'] = $decodedUser['id'];
}

$decodedUser['permissions'] = null;
$lookupUserId = $decodedUser['user_id'] ?? $decodedUser['id'] ?? 0;
if ($lookupUserId > 0) {
    echo "Prepare SQL...\n";
    $pStmt = $conn->prepare("SELECT permissions_json FROM users WHERE id = ? LIMIT 1");
    if ($pStmt === false) {
        echo "Prepare failed: " . $conn->error . "\n";
    } else {
        echo "Prepare successful. Binding param...\n";
        $pStmt->bind_param("i", $lookupUserId);
        echo "Executing...\n";
        $pStmt->execute();
        echo "Getting result...\n";
        $result = $pStmt->get_result();
        if ($result === false) {
            echo "get_result failed: " . $conn->error . "\n";
        } else {
            $pRes = $result->fetch_assoc();
            echo "Result fetched.\n";
            $pStmt->close();
            if ($pRes && !empty($pRes['permissions_json'])) {
                $decodedUser['permissions'] = json_decode($pRes['permissions_json'], true);
            }
            print_r($decodedUser);
        }
    }
}
