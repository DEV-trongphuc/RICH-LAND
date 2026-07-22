<?php
// backend/master_all_backend_test_runner.php
// MASTER TEST RUNNER - GOM TOAN BO ALL BACKEND TEST SUITES VA CONTROLLERS

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "👑 MASTER BACKEND INTEGRATION TEST RUNNER\n";
echo "   Kiem thu gop toan bo tat ca 72+ file Backend\n";
echo "====================================================\n\n";

$masterStart = microtime(true);

// 1. Audit Controllers Syntax & Class Loading
echo "--- 1. AUDIT CONTROLLERS LOAD & SYNTAX ---\n";
$controllersDir = __DIR__ . '/controllers';
if (is_dir($controllersDir)) {
    $cFiles = glob($controllersDir . '/*.php');
    foreach ($cFiles as $cFile) {
        $cName = basename($cFile);
        try {
            require_once $cFile;
            assertTest("Controller File Load: {$cName}", true);
        } catch (\Throwable $e) {
            assertTest("Controller File Load: {$cName}", false, "Error: " . $e->getMessage());
        }
    }
}

echo "\n--- 2. CHAY TEST SUITE: FULL SYSTEM HEALTH ---\n";
require_once __DIR__ . '/test_full_system.php';

echo "\n--- 3. CHAY TEST SUITE: SCHEMA & PAYLOAD AUDIT ---\n";
require_once __DIR__ . '/full_schema_payload_audit.php';

echo "\n--- 4. CHAY TEST SUITE: FULL MATRIX LOGIC & SHIFTS ---\n";
require_once __DIR__ . '/test_full_matrix_audit.php';

echo "\n--- 5. CHAY TEST SUITE: RBAC PERMISSION MATRIX ---\n";
require_once __DIR__ . '/test_permission_matrix.php';

echo "\n--- 6. CHAY TEST SUITE: EXTENDED BUSINESS RULES 1-4 ---\n";
require_once __DIR__ . '/test_extended_business_rules.php';

echo "\n--- 7. CHAY TEST SUITE: SQLSTATE & 500 STRESS TEST ---\n";
require_once __DIR__ . '/test_sqlstate_stress.php';

$masterEnd = microtime(true);
$duration = round(($masterEnd - $masterStart) * 1000, 2);

echo "\n====================================================\n";
echo "🏆 MASTER TEST RUNNER HOAN THANH TRONG {$duration} ms\n";
printTestSummary();
