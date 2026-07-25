<?php
// backend/test_payload_validation.php
require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== STARTING PAYLOAD VALIDATION TEST ===\n\n";

$testStats = ['pass' => 0, 'fail' => 0];

// 1. Currency Formatting Sanitization
echo "--- TEST 1: Currency Formatting Sanitization ---\n";
$dirtyPrice = "1,250,000,000.50";
$cleanPrice = (float)preg_replace('/[^0-9.]/', '', $dirtyPrice);
assertTest("Currency string '1,250,000,000.50' sanitized to float 1250000000.5", $cleanPrice === 1250000000.5);

$dirtyPrice2 = " 3.500.000.000 ";
$cleanPrice2 = (float)preg_replace('/[^0-9.]/', '', str_replace('.', '', $dirtyPrice2));
assertTest("Vietnamese format string '3.500.000.000' sanitized to float 3500000000.0", $cleanPrice2 === 3500000000.0);

// 2. Datetime Parsing Mismatches
echo "\n--- TEST 2: Datetime Parsing Mismatches ---\n";
$isoDate = "2026-07-25T02:14:19.271Z";
$parsedDate = date('Y-m-d H:i:s', strtotime($isoDate));
assertTest("ISO date parsed to MySQL DATETIME format", $parsedDate === '2026-07-25 02:14:19');

$invalidDate = "invalid-date-string";
$parsedInvalid = strtotime($invalidDate);
assertTest("Invalid date string fails safely without crashing", $parsedInvalid === false);

// 3. JSON Validity Verification
echo "\n--- TEST 3: JSON Validity Verification ---\n";
$malformedJson = '{"erp_task": { "description": "missing closing bracket"';
$decoded = json_decode($malformedJson, true);
assertTest("Malformed JSON correctly fails json_decode check", $decoded === null);

$validJson = '{"erp_task": {"description": "valid structure"}}';
$decodedValid = json_decode($validJson, true);
assertTest("Valid JSON correctly parses and is valid", is_array($decodedValid) && isset($decodedValid['erp_task']['description']));

printTestSummary();
