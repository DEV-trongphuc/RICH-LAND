<?php
// backend/config/TriggerHelper.php

class TriggerHelper {

    public static function dispatch(PDO $db, string $field, $oldVal, $newVal, int $contactId): void {
        try {
            // 1. Load outbound triggers and credentials from system_settings
            $stmtSet = $db->query("
                SELECT setting_key, setting_value 
                FROM system_settings 
                WHERE setting_key IN ('outbound_webhook_triggers', 'meta_pixel_id', 'meta_access_token')
            ");
            $settings = [];
            if ($stmtSet) {
                while ($row = $stmtSet->fetch()) {
                    $settings[$row['setting_key']] = $row['setting_value'];
                }
            }

            if (empty($settings['outbound_webhook_triggers'])) {
                return;
            }

            $triggers = json_decode($settings['outbound_webhook_triggers'], true);
            if (!is_array($triggers) || empty($triggers)) {
                return;
            }

            $pixelId = trim($settings['meta_pixel_id'] ?? '');
            $token = trim($settings['meta_access_token'] ?? '');

            // 2. Filter matching active triggers
            $matchedTriggers = [];
            foreach ($triggers as $t) {
                if (empty($t['is_active'])) {
                    continue;
                }
                $trgField = trim($t['trigger_field'] ?? '');
                $trgVal = trim($t['trigger_value'] ?? '');

                if ($trgField === $field) {
                    if ($trgVal === '*' || $trgVal === (string)$newVal) {
                        $matchedTriggers[] = $t;
                    }
                }
            }

            if (empty($matchedTriggers)) {
                return;
            }

            // 3. Fetch contact details
            $stmtC = $db->prepare("
                SELECT c.*, p.full_name AS person_full_name, p.phone AS person_phone 
                FROM contacts c
                LEFT JOIN persons p ON c.person_id = p.id
                WHERE c.id = ?
                LIMIT 1
            ");
            $stmtC->execute([$contactId]);
            $c = $stmtC->fetch();
            if (!$c) {
                return;
            }

            // Find lead_id if exists
            $stmtL = $db->prepare("SELECT id FROM leads WHERE person_id = ? LIMIT 1");
            $stmtL->execute([$c['person_id'] ?? 0]);
            $leadId = $stmtL->fetchColumn() ?: $contactId;

            // Fetch deal price if any
            $stmtDeal = $db->prepare("
                SELECT expected_value, actual_value 
                FROM deals 
                WHERE contact_id = ? 
                ORDER BY id DESC 
                LIMIT 1
            ");
            $stmtDeal->execute([$contactId]);
            $deal = $stmtDeal->fetch();
            $dealPrice = 0;
            if ($deal) {
                $dealPrice = (float)($deal['actual_value'] ?: $deal['expected_value'] ?: 0);
            }
            if ($dealPrice <= 0) {
                $dealPrice = 13674109347; // Default real estate transaction value benchmark
            }

            require_once __DIR__ . '/CapiHelper.php';

            $rawPhone = $c['phone'] ?: ($c['person_phone'] ?? '');
            $phoneHash = !empty($rawPhone) ? CapiHelper::normalizeAndHash($rawPhone, false) : '';
            $firstName = $c['first_name'] ?? '';
            $lastName = $c['last_name'] ?? '';
            $fullName = trim("$lastName $firstName") ?: ($c['person_full_name'] ?? '');
            $fnHash = !empty($firstName) ? CapiHelper::normalizeAndHash($firstName, true) : '';
            $email = $c['email'] ?? '';
            $timeNow = time();

            // Replacement dictionary
            $macroMap = [
                '{{lead_id}}' => (string)$leadId,
                '{{contact_id}}' => (string)$contactId,
                '{{phone}}' => (string)$rawPhone,
                '{{phone_sha256}}' => (string)$phoneHash,
                '{{first_name}}' => (string)$firstName,
                '{{first_name_sha256}}' => (string)$fnHash,
                '{{last_name}}' => (string)$lastName,
                '{{full_name}}' => (string)$fullName,
                '{{email}}' => (string)$email,
                '{{price}}' => (string)$dealPrice,
                '{{pipeline_status}}' => (string)$newVal,
                '{{status}}' => (string)$newVal,
                '{{old_value}}' => (string)$oldVal,
                '{{new_value}}' => (string)$newVal,
                '{{field}}' => (string)$field,
                '{{timestamp}}' => (string)$timeNow,
                '{{event_time}}' => (string)$timeNow,
                '{pixel_id}' => $pixelId,
                '{meta_pixel_id}' => $pixelId,
                '{token}' => $token,
                '{access_token}' => $token,
                '{meta_access_token}' => $token
            ];

            // 4. Fire each matched trigger in shutdown
            register_shutdown_function(function() use ($db, $matchedTriggers, $macroMap, $contactId, $leadId) {
                if (function_exists('fastcgi_finish_request')) {
                    @fastcgi_finish_request();
                }

                foreach ($matchedTriggers as $trg) {
                    try {
                        $url = str_replace(array_keys($macroMap), array_values($macroMap), trim($trg['target_url'] ?? ''));
                        if (empty($url)) {
                            continue;
                        }

                        $method = strtoupper(trim($trg['http_method'] ?? 'POST'));
                        if (!in_array($method, ['POST', 'PUT', 'GET', 'PATCH'])) {
                            $method = 'POST';
                        }

                        // Payload
                        $payloadTemplate = $trg['payload_template'] ?? '{}';
                        $renderedPayload = str_replace(array_keys($macroMap), array_values($macroMap), $payloadTemplate);

                        // Headers
                        $httpHeaders = ['Content-Type: application/json'];
                        if (!empty($trg['headers'])) {
                            $rawHeaders = $trg['headers'];
                            if (is_string($rawHeaders)) {
                                $parsed = json_decode($rawHeaders, true);
                                if (is_array($parsed)) {
                                    foreach ($parsed as $hKey => $hVal) {
                                        $hValReplaced = str_replace(array_keys($macroMap), array_values($macroMap), $hVal);
                                        $httpHeaders[] = "$hKey: $hValReplaced";
                                    }
                                } else {
                                    $lines = explode("\n", $rawHeaders);
                                    foreach ($lines as $ln) {
                                        $ln = trim($ln);
                                        if (!empty($ln) && strpos($ln, ':') !== false) {
                                            $httpHeaders[] = str_replace(array_keys($macroMap), array_values($macroMap), $ln);
                                        }
                                    }
                                }
                            }
                        }

                        $ch = curl_init();
                        curl_setopt($ch, CURLOPT_URL, $url);
                        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
                        if ($method !== 'GET') {
                            curl_setopt($ch, CURLOPT_POSTFIELDS, $renderedPayload);
                        }
                        curl_setopt($ch, CURLOPT_HTTPHEADER, $httpHeaders);
                        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
                        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

                        $response = curl_exec($ch);
                        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                        curl_close($ch);

                        // Log to capi_logs
                        $stmtLog = $db->prepare("
                            INSERT INTO capi_logs (lead_id, contact_id, event_name, payload_hash, sent_payload, response_status, response_body)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        ");
                        $triggerName = 'TRIGGER: ' . ($trg['name'] ?? 'Webhook');
                        $stmtLog->execute([
                            $leadId,
                            $contactId,
                            mb_substr($triggerName, 0, 100),
                            hash('sha256', $renderedPayload),
                            $renderedPayload,
                            $httpCode ?: 0,
                            $response
                        ]);
                    } catch (\Throwable $ex) {
                        error_log("TriggerHelper dispatch error: " . $ex->getMessage());
                    }
                }
            });

        } catch (\Throwable $e) {
            error_log("TriggerHelper exception: " . $e->getMessage());
        }
    }
}
