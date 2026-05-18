<?php
require_once __DIR__ . '/env.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');

$servername = $_ENV['DB_HOST'] ?? "localhost";
$username = $_ENV['DB_USER'] ?? "vhvxoigh_mail_auto";
$password = $_ENV['DB_PASS'] ?? "Ideas@812";
$dbname = $_ENV['DB_NAME'] ?? "vhvxoigh_sale_data";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
}

$conn->set_charset("utf8mb4");

