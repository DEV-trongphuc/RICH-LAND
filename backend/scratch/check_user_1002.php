<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../mailer.php';

try {
    $targetId = 1002;
    $newEmail = 'turniodev@gmail.com';

    // 1. Fetch current info from accounts
    $stmtSelect = $conn->prepare("SELECT id, email, name FROM accounts WHERE id = ? OR email = 'manager@richland.net'");
    $stmtSelect->bind_param("i", $targetId);
    $stmtSelect->execute();
    $resSelect = $stmtSelect->get_result();

    if ($resSelect && $resSelect->num_rows > 0) {
        $acc = $resSelect->fetch_assoc();
        $realId = $acc['id'];
        $realName = $acc['name'];
        echo "Found Account: ID: $realId, Current Email: " . $acc['email'] . ", Name: $realName\n";

        // 2. Generate token and confirm link
        $token = bin2hex(random_bytes(32));
        $confirmLink = 'https://open.domation.net/richland/confirm.php?token=' . $token;

        // 3. Update accounts table
        $stmtUpdateAcc = $conn->prepare("UPDATE accounts SET email = ?, is_confirmed = 0, confirm_token = ? WHERE id = ?");
        $stmtUpdateAcc->bind_param("ssi", $newEmail, $token, $realId);
        $stmtUpdateAcc->execute();

        // 4. Update users table (if exists)
        $stmtUpdateUser = $conn->prepare("UPDATE users SET email = ? WHERE id = ? OR email = 'manager@richland.net'");
        $stmtUpdateUser->bind_param("si", $newEmail, $realId);
        $stmtUpdateUser->execute();

        // 5. Trigger confirmation email
        sendAdminConfirmationEmail($newEmail, $realName, $confirmLink);

        echo "SUCCESS:\n";
        echo "Email changed to: $newEmail\n";
        echo "Confirmation link: $confirmLink\n";
    } else {
        echo "ERROR: Account with ID $targetId or email 'manager@richland.net' not found.\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
