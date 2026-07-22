<?php
// backend/config/CapiHelper.php

class CapiHelper {
    
    public static function getPdo(): PDO {
        $host = getenv('DB_HOST') ?: 'localhost';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASS') ?: '';
        $name = getenv('DB_NAME') ?: 'vhvxoigh_db_richland';
        $port = getenv('DB_PORT') ?: '3306';
        $charset = 'utf8mb4';
        
        $dsn = "mysql:host=$host;dbname=$name;charset=$charset;port=$port";
        return new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }
    
    public static function removeAccents(string $str): string {
        $unicode = [
            'a' => 'á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ|å|ä|æ',
            'd' => 'đ',
            'e' => 'é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ',
            'i' => 'í|ì|ỉ|ĩ|ị',
            'o' => 'ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ|ö|ø',
            'u' => 'ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự|ü',
            'y' => 'ý|ỳ|ỷ|ỹ|ỵ',
            'A' => 'Á|À|Ả|Ã|Ạ|Ă|Ắ|Ằ|Ẳ|Ẵ|Ặ|Â|Ấ|Ầ|Ẩ|Ẫ|Ậ|Å|Ä|Æ',
            'D' => 'Đ',
            'E' => 'É|È|Ẻ|Ẽ|Ẹ|Ê|Ế|Ề|Ể|Ễ|Ệ',
            'I' => 'Í|Ì|Ỉ|Ĩ|Ị',
            'O' => 'Ó|Ò|Ỏ|Õ|Ọ|Ô|Ố|Ồ|Ổ|Ỗ|Ộ|Ơ|Ớ|Ờ|Ở|Ỡ|Ợ|Ö|Ø',
            'U' => 'Ú|Ù|Ủ|Ũ|Ụ|Ư|Ứ|Ừ|Ử|Ữ|Ự|Ü',
            'Y' => 'Ý|Ỳ|Ỷ|Ỹ|Ỵ'
        ];
        foreach ($unicode as $nonUnicode => $uni) {
            $str = preg_replace("/($uni)/i", $nonUnicode, $str);
        }
        return $str;
    }
    
    public static function normalizeAndHash($val, bool $isEmailOrName = false): string {
        $clean = trim((string)$val);
        $clean = strtolower($clean);
        if ($isEmailOrName) {
            $clean = self::removeAccents($clean);
            return hash('sha256', $clean);
        } else {
            // Phone normalization for Meta CAPI
            $clean = preg_replace('/[^\d+]/', '', $clean);
            if (strpos($clean, '+') === 0) {
                $clean = substr($clean, 1);
            }
            if (strpos($clean, '84') === 0 && strlen($clean) >= 10) {
                // Already starts with 84
            } else {
                if (strpos($clean, '0') === 0) {
                    $clean = substr($clean, 1);
                }
                if (strlen($clean) === 9) {
                    $clean = '84' . $clean;
                }
            }
            return hash('sha256', $clean);
        }
    }

    public static function sendEvent(?PDO $db, ?int $contactId, string $eventName, float $value = 0.0, string $currency = 'VND'): bool {
        try {
            if ($db === null) {
                $db = self::getPdo();
            }
            // Get credentials from system_settings
            $stmtSet = $db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token')");
            $settings = [];
            if ($stmtSet) {
                while ($row = $stmtSet->fetch()) {
                    $settings[$row['setting_key']] = $row['setting_value'];
                }
            }

            $pixelId = trim($settings['meta_pixel_id'] ?? '');
            $token = trim($settings['meta_access_token'] ?? '');

            if (empty($pixelId) || empty($token)) {
                // If not configured, write error log and skip silently to prevent crashing
                error_log("Meta CAPI Error: meta_pixel_id or meta_access_token is not configured.");
                return false;
            }

            // Fetch contact details for custom data matching
            $phone = ''; $email = ''; $firstName = ''; $lastName = ''; $leadId = null;
            if ($contactId) {
                $stmtC = $db->prepare("SELECT phone, email, first_name, last_name, id FROM contacts WHERE id = ?");
                $stmtC->execute([$contactId]);
                $c = $stmtC->fetch();
                if ($c) {
                    $phone = $c['phone'] ?? '';
                    $email = $c['email'] ?? '';
                    $firstName = $c['first_name'] ?? '';
                    $lastName = $c['last_name'] ?? '';
                }

                // Try to find the associated raw lead_id
                $stmtL = $db->prepare("SELECT id FROM leads WHERE person_id = (SELECT person_id FROM contacts WHERE id = ? LIMIT 1) LIMIT 1");
                $stmtL->execute([$contactId]);
                $leadId = $stmtL->fetchColumn() ?: null;
            }

            // Guardrail: Forward-only check (Never send duplicate events or status drop events)
            if ($contactId) {
                // If Purchase has already been sent for this contact, skip everything!
                $stmtPurchase = $db->prepare("SELECT COUNT(*) FROM capi_logs WHERE contact_id = ? AND event_name = 'Purchase'");
                $stmtPurchase->execute([$contactId]);
                if ((int)$stmtPurchase->fetchColumn() > 0) {
                    return true;
                }

                $stmtChk = $db->prepare("SELECT COUNT(*) FROM capi_logs WHERE contact_id = ? AND event_name = ?");
                $stmtChk->execute([$contactId, $eventName]);
                if ((int)$stmtChk->fetchColumn() > 0) {
                    // Already sent this event type for this contact! Skip it.
                    return true;
                }
            }




            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
            $host = $_SERVER['HTTP_HOST'] ?? 'open.domation.net';
            $requestUri = $_SERVER['REQUEST_URI'] ?? '/richland';
            $basePath = preg_replace('#/(api.php|index.php|backend).*$#i', '', $requestUri);
            $eventSourceUrl = $protocol . "://" . $host . rtrim($basePath, '/');

            $payload = [
                'data' => [
                    [
                        'event_name' => $eventName,
                        'event_time' => time(),
                        'event_source_url' => $eventSourceUrl,
                        'action_source' => 'system',
                        'user_data' => [
                            'ph' => !empty($phone) ? [self::normalizeAndHash($phone, false)] : [],
                            'em' => !empty($email) ? [self::normalizeAndHash($email, true)] : [],
                            'fn' => !empty($firstName) ? [self::normalizeAndHash($firstName, true)] : [],
                            'ln' => !empty($lastName) ? [self::normalizeAndHash($lastName, true)] : [],
                            'client_ip_address' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                            'client_user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0'
                        ],
                        'custom_data' => [
                            'value' => $value,
                            'currency' => $currency
                        ],
                        'event_id' => 'capi_' . ($contactId ?: 'raw') . '_' . time() . '_' . rand(1000, 9999)
                    ]
                ]
            ];

            $payloadJson = json_encode($payload);
            $payloadHash = hash('sha256', $payloadJson);

            // Execute Meta Graph API cURL request
            $url = "https://graph.facebook.com/v19.0/$pixelId/events?access_token=$token";
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadJson);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 1);
            curl_setopt($ch, CURLOPT_TIMEOUT, 2);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            // Insert into capi_logs for audit auditing
            $stmtLog = $db->prepare("
                INSERT INTO capi_logs (lead_id, contact_id, event_name, payload_hash, sent_payload, response_status, response_body)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtLog->execute([
                $leadId,
                $contactId,
                $eventName,
                $payloadHash,
                $payloadJson,
                $httpCode,
                $response
            ]);

            if ($httpCode !== 200) {
                error_log("Meta CAPI failure: HTTP $httpCode - Response: $response");
                return false;
            }

            return true;
        } catch (Exception $e) {
            error_log("Meta CAPI Exception: " . $e->getMessage());
            return false;
        }
    }
}
