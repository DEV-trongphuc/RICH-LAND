<?php
require 'backend/db_connect.php';
$conn->query("CREATE TABLE IF NOT EXISTS mail_queue (
  id int(11) NOT NULL AUTO_INCREMENT,
  to_email varchar(255) NOT NULL,
  subject varchar(255) NOT NULL,
  body_html longtext NOT NULL,
  status enum('pending','sent','failed') DEFAULT 'pending',
  created_at datetime DEFAULT current_timestamp(),
  sent_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
echo "Table created.\n";
?>
