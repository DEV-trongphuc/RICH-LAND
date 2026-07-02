<?php
// debug_contacts_curl.php
define('IN_API', true);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';
require_once __DIR__ . '/config/JWT.php';

$db = Database::getInstance();

// 1. Get user record for Nguyễn Hải Đăng
$stmt = $db->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
$stmt->execute(['haidang@richland.net']);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    die("User haidang@richland.net not found!\n");
}

// 2. Generate the same JWT token payload as api.php?action=login
$payload = [
    'id' => $user['id'],
    'user_id' => $user['id'],
    'tenant_id' => $user['tenant_id'],
    'email' => $user['email'],
    'role' => $user['role'] === 'sales' ? 'sale' : $user['role'],
    'full_name' => $user['full_name'],
    'consultant_id' => $user['id'],
    'exp' => time() + 86400 * 7
];
$token = JWT::encode($payload);

echo "Token generated: $token\n\n";

// 3. Make HTTP request to api.php?action=contacts
$remote_url = 'http://open.domation.net/richland/api.php?action=contacts&page=1&limit=50&segment=all';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $remote_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $token"
]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "Remote Response Code: $code\n";
echo "Remote Response Body:\n$res\n\n";

// 4. Also test api.php?action=users
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'http://open.domation.net/richland/api.php?action=users');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $token"
]);
$res_users = curl_exec($ch);
$code_users = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "Remote Users Response Code: $code_users\n";
echo "Remote Users Response Body:\n$res_users\n\n";
