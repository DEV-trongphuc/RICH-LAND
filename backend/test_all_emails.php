<?php
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/db_connect.php';

if ($argc < 2) {
    echo "Usage: php test_all_emails.php <email_address>\n";
    exit(1);
}

$email = $argv[1];
$botLink = "https://zalo.me/1185588456243371597";

echo "Sending test emails to: $email\n\n";

// 1. Welcome Sale (Zalo Auth)
echo "1. Sending Welcome Sale...\n";
sendWelcomeEmailToSale(99, $email, "Sale Test", $botLink);

// 2. Welcome Admin Ticket (Zalo Auth)
echo "2. Sending Welcome Admin Ticket...\n";
sendWelcomeEmailToAdminTicket(1, $email, "Admin Test", $botLink);

// 3. Ticket Notification to Admin
echo "3. Sending Ticket Notification...\n";
sendTicketNotificationToAdmins($email, "Admin Test", "Khách Nguyễn Văn A", "0912345678", "Gọi không nghe máy, khách chặn số", "Sale Test", "Vòng A");

// 4. Quick Message to Sale
echo "4. Sending Quick Message...\n";
sendQuickMessageEmailToSale($email, "Sale Test", "Admin đã duyệt Ticket của bạn cho khách hàng Nguyễn Văn A. Bạn đã được cộng lại 1 Data vào vòng phân bổ tiếp theo.");

// 5. Quick Message to Sale (Reject)
echo "5. Sending Quick Message (Reject)...\n";
sendQuickMessageEmailToSale($email, "Sale Test", "Admin ĐÃ TỪ CHỐI Ticket của bạn cho khách hàng Nguyễn Văn A. Lý do: Số điện thoại vẫn đổ chuông bình thường.");

// 6. Admin Confirmation
echo "6. Sending Admin Confirmation...\n";
sendAdminConfirmationEmail($email, "Admin Test", "https://open.domation.net/confirm?token=123456");

// 7. Daily Report
echo "7. Sending Daily Report...\n";
$statsHtml = "
    <li>Sale Test 1: <b>15</b> data</li>
    <li>Sale Test 2: <b>12</b> data</li>
";
sendDailyReportEmailToAdmins($email, "Admin Test", 27, $statsHtml, 3);

echo "\nDone! Check your inbox.\n";
