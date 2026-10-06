<?php
// backend/config/TriggerHelper.php

class TriggerHelper {

    /**
     * Backward-compatible dispatch method (called from ContactController)
     */
    public static function dispatch(PDO $db, string $field, $oldVal, $newVal, int $contactId): void {
        self::fireEvent($db, 'contacts', 'update', $contactId, [$field => $oldVal], [$field => $newVal, 'id' => $contactId]);
    }

    /**
     * Main event dispatcher for any table and change type (Adds, Updates, Deletes)
     * 
     * @param PDO $db
     * @param string $table (contacts, leads, persons, deals, deposits)
     * @param string $changeType (insert, update, delete)
     * @param int $recordId
     * @param array|null $oldData
     * @param array|null $newData
     */
    public static function fireEvent(PDO $db, string $table, string $changeType, int $recordId, ?array $oldData = null, ?array $newData = null): void {
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

            // Ensure we have current data if not fully provided
            $dataToEvaluate = $newData ?: ($oldData ?: []);
            if (empty($dataToEvaluate) || count($dataToEvaluate) <= 2) {
                $dataToEvaluate = self::fetchRecordData($db, $table, $recordId, $dataToEvaluate);
            }

            // 2. Filter matching active triggers
            $matchedTriggers = [];
            foreach ($triggers as $t) {
                if (empty($t['is_active'])) {
                    continue;
                }

                // Check 1: Table match
                $trgTable = trim($t['source_table'] ?? 'contacts');
                if ($trgTable !== $table) {
                    continue;
                }

                // Check 2: Change Type match (insert = Adds, update = Updates, delete = Deletes)
                $trgChange = trim($t['change_type'] ?? 'update');
                if ($trgChange !== 'all' && $trgChange !== $changeType) {
                    continue;
                }

                // Check 3: Evaluate Conditions or Branches
                $branches = $t['branches'] ?? null;
                $isMatch = false;

                if (is_array($branches) && !empty($branches)) {
                    $isMatch = self::evaluateBranches($branches, $dataToEvaluate, $oldData);
                } else {
                    $conditions = $t['conditions'] ?? null;
                    if (is_array($conditions) && !empty($conditions)) {
                        $logic = strtoupper(trim($t['condition_logic'] ?? 'OR'));
                        $isMatch = self::evaluateConditions($conditions, $logic, $dataToEvaluate, $oldData);
                    } else {
                        // Legacy fallback: single trigger_field & trigger_value
                        $trgField = trim($t['trigger_field'] ?? '');
                        $trgVal = trim($t['trigger_value'] ?? '');

                        if (!empty($trgField)) {
                            $actualVal = $dataToEvaluate[$trgField] ?? null;
                            if ($trgVal === '*' && $actualVal !== null) {
                                $isMatch = true;
                            } elseif ($actualVal !== null) {
                                $isMatch = ($trgVal === (string)$actualVal);
                                if (!$isMatch && ($trgVal === 'not_lead' || $trgVal === 'notlead') && ($actualVal === 'not_lead' || $actualVal === 'notlead')) {
                                    $isMatch = true;
                                }
                            }
                        } else {
                            // No conditions specified means trigger on any event for this table
                            $isMatch = true;
                        }
                    }
                }

                if ($isMatch) {
                    $matchedTriggers[] = $t;
                }
            }

            if (empty($matchedTriggers)) {
                return;
            }

            // 3. Build comprehensive macro data dictionary
            $context = self::buildContextData($db, $table, $recordId, $dataToEvaluate, $oldData);
            $macroMap = self::buildMacroMap($context, $pixelId, $token);

            // Create JSON-safe escaped dictionary for payload replacement
            $jsonMacroMap = [];
            foreach ($macroMap as $k => $v) {
                if (in_array($k, ['{{price}}', '{{timestamp}}', '{{event_time}}', '{{contact_id}}', '{{lead_id}}', '{{id}}']) && is_numeric($v)) {
                    $jsonMacroMap[$k] = $v;
                } else {
                    $jsonMacroMap[$k] = addcslashes($v, "\"\\\r\n\t\f\b");
                }
            }

            // 4. Fire each matched trigger in shutdown (fastcgi background execution)
            $contactId = (int)($context['contact_id'] ?? 0);
            $leadId = (int)($context['lead_id'] ?? 0);

            register_shutdown_function(function() use ($db, $matchedTriggers, $macroMap, $jsonMacroMap, $contactId, $leadId) {
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
                        $renderedPayload = str_replace(array_keys($jsonMacroMap), array_values($jsonMacroMap), $payloadTemplate);

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
                        error_log("TriggerHelper fire error: " . $ex->getMessage());
                    }
                }
            });

        } catch (\Throwable $e) {
            error_log("TriggerHelper fireEvent exception: " . $e->getMessage());
        }
    }

    /**
     * Evaluates trigger branches against current record data.
     * Branches are combined with OR (any branch matches => trigger matches).
     * Conditions within a branch are combined with AND (all conditions in that branch must match).
     */
    public static function evaluateBranches(array $branches, array $recordData, ?array $oldData = null): bool {
        if (empty($branches)) {
            return true;
        }

        foreach ($branches as $branch) {
            $conditions = $branch['conditions'] ?? [];
            if (empty($conditions)) {
                return true;
            }

            $branchPass = true;
            foreach ($conditions as $c) {
                $field = trim($c['field'] ?? ($c['col'] ?? ''));
                if (empty($field)) {
                    continue;
                }

                $op = trim($c['operator'] ?? ($c['op'] ?? '='));
                $targetVal = trim((string)($c['value'] ?? ($c['val'] ?? '')));
                $actualVal = $recordData[$field] ?? null;
                $oldVal = $oldData[$field] ?? null;

                if (!self::evaluateSingleCondition($op, $actualVal, $targetVal, $oldVal)) {
                    $branchPass = false;
                    break;
                }
            }

            if ($branchPass) {
                return true;
            }
        }

        return false;
    }

    /**
     * Evaluates a set of condition rules against current record data
     */
    public static function evaluateConditions(array $conditions, string $logic, array $recordData, ?array $oldData = null): bool {
        if (empty($conditions)) {
            return true;
        }

        $results = [];
        foreach ($conditions as $c) {
            $field = trim($c['field'] ?? '');
            if (empty($field)) {
                continue;
            }

            $op = trim($c['operator'] ?? '=');
            $targetVal = trim((string)($c['value'] ?? ''));
            $actualVal = $recordData[$field] ?? null;
            $oldVal = $oldData[$field] ?? null;

            $pass = self::evaluateSingleCondition($op, $actualVal, $targetVal, $oldVal);
            $results[] = $pass;

            // Early exit optimizations
            if ($logic === 'OR' && $pass) {
                return true;
            }
            if ($logic === 'AND' && !$pass) {
                return false;
            }
        }

        if (empty($results)) {
            return true;
        }

        return $logic === 'AND' ? !in_array(false, $results, true) : in_array(true, $results, true);
    }

    /**
     * Evaluates a single condition operator
     */
    public static function evaluateSingleCondition(string $operator, $actualVal, string $targetVal, $oldVal = null): bool {
        // Wildcard match
        if ($targetVal === '*' && $actualVal !== null) {
            return true;
        }

        switch ($operator) {
            case '=':
            case '==':
                if (is_numeric($actualVal) && is_numeric($targetVal)) {
                    return (float)$actualVal == (float)$targetVal;
                }
                // Case-insensitive string match
                if (strcasecmp((string)$actualVal, $targetVal) === 0) {
                    return true;
                }
                // Not lead normalization
                if (($targetVal === 'not_lead' || $targetVal === 'notlead') && 
                    ($actualVal === 'not_lead' || $actualVal === 'notlead')) {
                    return true;
                }
                return false;

            case '!=':
            case '<>':
                if (is_numeric($actualVal) && is_numeric($targetVal)) {
                    return (float)$actualVal != (float)$targetVal;
                }
                return strcasecmp((string)$actualVal, $targetVal) !== 0;

            case '>':
                return is_numeric($actualVal) && is_numeric($targetVal) && ((float)$actualVal > (float)$targetVal);

            case '>=':
                return is_numeric($actualVal) && is_numeric($targetVal) && ((float)$actualVal >= (float)$targetVal);

            case '<':
                return is_numeric($actualVal) && is_numeric($targetVal) && ((float)$actualVal < (float)$targetVal);

            case '<=':
                return is_numeric($actualVal) && is_numeric($targetVal) && ((float)$actualVal <= (float)$targetVal);

            case 'contains':
                return stripos((string)$actualVal, $targetVal) !== false;

            case 'not_contains':
                return stripos((string)$actualVal, $targetVal) === false;

            case 'is_empty':
                return ($actualVal === null || $actualVal === '' || (is_array($actualVal) && empty($actualVal)));

            case 'is_not_empty':
                return ($actualVal !== null && $actualVal !== '' && (!is_array($actualVal) || !empty($actualVal)));

            case 'changed':
                return $oldVal !== null && ((string)$oldVal !== (string)$actualVal);

            default:
                return (string)$actualVal === $targetVal;
        }
    }

    /**
     * Fetch complete record row from database if not already provided
     */
    private static function fetchRecordData(PDO $db, string $table, int $recordId, array $fallback): array {
        $allowedTables = ['contacts', 'leads', 'persons', 'deals', 'deposits'];
        if (!in_array($table, $allowedTables)) {
            return $fallback;
        }

        try {
            $stmt = $db->prepare("SELECT * FROM `$table` WHERE id = ? LIMIT 1");
            $stmt->execute([$recordId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row ? array_merge($row, $fallback) : $fallback;
        } catch (\Throwable $e) {
            return $fallback;
        }
    }

    /**
     * Build rich context containing contact, lead, person, deal, owner information
     */
    private static function buildContextData(PDO $db, string $table, int $recordId, array $data, ?array $oldData): array {
        $context = $data;
        $context['event_table'] = $table;
        $context['record_id'] = $recordId;

        $contactId = 0;
        $leadId = 0;
        $personId = 0;

        if ($table === 'contacts') {
            $contactId = $recordId;
            $personId = (int)($data['person_id'] ?? 0);
        } elseif ($table === 'leads') {
            $leadId = $recordId;
            $personId = (int)($data['person_id'] ?? 0);
            $contactId = (int)($data['contact_id'] ?? 0);
        } elseif ($table === 'persons') {
            $personId = $recordId;
        } elseif ($table === 'deals' || $table === 'deposits') {
            $contactId = (int)($data['contact_id'] ?? 0);
            $leadId = (int)($data['lead_id'] ?? 0);
        }

        // Fetch contact details if available
        if ($contactId > 0) {
            try {
                $stmtC = $db->prepare("
                    SELECT 
                        c.*, 
                        p.full_name AS person_full_name, 
                        p.phone AS person_phone,
                        p.email AS person_email,
                        u.full_name AS owner_name,
                        u.phone AS owner_phone,
                        u.email AS owner_email
                    FROM contacts c
                    LEFT JOIN persons p ON c.person_id = p.id
                    LEFT JOIN users u ON c.owner_id = u.id
                    WHERE c.id = ?
                    LIMIT 1
                ");
                $stmtC->execute([$contactId]);
                $c = $stmtC->fetch(PDO::FETCH_ASSOC);
                if ($c) {
                    $context = array_merge($c, $context);
                    if (!$personId && !empty($c['person_id'])) $personId = (int)$c['person_id'];
                }
            } catch (\Throwable $e) {}
        }

        // Fetch lead_id if not yet found
        if ($leadId <= 0 && $personId > 0) {
            try {
                $stmtL = $db->prepare("SELECT id FROM leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
                $stmtL->execute([$personId]);
                $leadId = (int)$stmtL->fetchColumn();
            } catch (\Throwable $e) {}
        }

        $context['contact_id'] = $contactId ?: $recordId;
        $context['lead_id'] = $leadId ?: ($contactId ?: $recordId);

        // Fetch deal value if not present
        if (!isset($context['price']) && !isset($context['actual_value'])) {
            try {
                $stmtDeal = $db->prepare("
                    SELECT expected_value, actual_value 
                    FROM deals 
                    WHERE contact_id = ? 
                    ORDER BY id DESC 
                    LIMIT 1
                ");
                $stmtDeal->execute([$context['contact_id']]);
                $deal = $stmtDeal->fetch(PDO::FETCH_ASSOC);
                if ($deal) {
                    $context['deal_price'] = (float)($deal['actual_value'] ?: $deal['expected_value'] ?: 0);
                }
            } catch (\Throwable $e) {}
        }

        return $context;
    }

    /**
     * Build macro dictionary from context
     */
    private static function buildMacroMap(array $context, string $pixelId, string $token): array {
        require_once __DIR__ . '/CapiHelper.php';

        $rawPhone = $context['phone'] ?? ($context['person_phone'] ?? '');
        $phoneHash = !empty($rawPhone) ? CapiHelper::normalizeAndHash($rawPhone, false) : '';
        $firstName = $context['first_name'] ?? '';
        $lastName = $context['last_name'] ?? '';
        $fullName = trim("$lastName $firstName") ?: ($context['person_full_name'] ?? ($context['name'] ?? ($context['full_name'] ?? '')));
        $fnHash = !empty($firstName) ? CapiHelper::normalizeAndHash($firstName, true) : '';
        $email = $context['email'] ?? ($context['person_email'] ?? '');
        $timeNow = time();

        $price = (float)($context['actual_value'] ?? ($context['expected_value'] ?? ($context['deal_price'] ?? ($context['budget'] ?? 13674109347))));
        if ($price <= 0) {
            $price = 13674109347;
        }

        $status = $context['pipeline_status'] ?? ($context['status'] ?? '');

        $macroMap = [
            '{{lead_id}}' => (string)($context['lead_id'] ?? ''),
            '{{contact_id}}' => (string)($context['contact_id'] ?? ''),
            '{{id}}' => (string)($context['record_id'] ?? ($context['id'] ?? '')),
            '{{phone}}' => (string)$rawPhone,
            '{{phone_sha256}}' => (string)$phoneHash,
            '{{first_name}}' => (string)$firstName,
            '{{first_name_sha256}}' => (string)$fnHash,
            '{{last_name}}' => (string)$lastName,
            '{{full_name}}' => (string)$fullName,
            '{{email}}' => (string)$email,
            '{{price}}' => (string)$price,
            '{{pipeline_status}}' => (string)$status,
            '{{status}}' => (string)$status,
            '{{timestamp}}' => (string)$timeNow,
            '{{event_time}}' => (string)$timeNow,
            '{{owner_name}}' => (string)($context['owner_name'] ?? ''),
            '{{owner_phone}}' => (string)($context['owner_phone'] ?? ''),
            '{{owner_email}}' => (string)($context['owner_email'] ?? ''),
            '{pixel_id}' => $pixelId,
            '{meta_pixel_id}' => $pixelId,
            '{token}' => $token,
            '{access_token}' => $token,
            '{meta_access_token}' => $token
        ];

        // Dynamically add all columns from context
        foreach ($context as $colName => $colValue) {
            if (is_string($colName) && !isset($macroMap['{{' . $colName . '}}']) && is_scalar($colValue)) {
                $macroMap['{{' . $colName . '}}'] = (string)$colValue;
            }
        }

        return $macroMap;
    }
}
