<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

// Find the Form round ID
$roundName = 'Form';
$roundId = 0;
$rRes = $conn->query("SELECT id FROM distribution_rounds WHERE round_name = '$roundName' LIMIT 1");
if ($rRes && $row = $rRes->fetch_assoc()) {
    $roundId = (int)$row['id'];
}

if (!$roundId) {
    die("Error: Round '$roundName' not found in database.\n");
}

echo "=== DEBUG SIMULATION FOR ROUND: $roundName (ID: $roundId) ===\n\n";

// Default date condition (This Month)
$dateCondition = "received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
$roundCondition = " AND round_id = $roundId";

// 1. Fetch active consultants in this round
$sql = "SELECT c.id, c.name, COALESCE(rc.receive_ratio, 1) as receive_ratio, 
               COALESCE(rc.compensation_count, 0) as pending_compensation,
               COALESCE(rc.skip_count, 0) as skip_count,
               COALESCE(rc.current_turn_remaining, 0) as current_turn_remaining
        FROM consultants c
        JOIN round_consultants rc ON c.id = rc.consultant_id
        WHERE rc.round_id = $roundId AND c.status = 'active'
        ORDER BY c.id ASC";

$res = $conn->query($sql);
$consultants = [];
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $consultants[(int)$row['id']] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'receive_ratio' => (int)$row['receive_ratio'],
            'pending_compensation' => (int)$row['pending_compensation'],
            'skip_count' => (int)$row['skip_count'],
            'current_turn_remaining' => (int)$row['current_turn_remaining'],
            'assigned_count' => 0,
            'simulated_assigned' => 0,
            'simulated_compensation' => (int)$row['pending_compensation'],
            'simulated_skip_count' => (int)$row['skip_count'],
            'simulated_current_turn_remaining' => (int)$row['current_turn_remaining'],
        ];
    }
}

if (empty($consultants)) {
    die("Error: No active consultants found in round '$roundName'.\n");
}

// 2. Fetch current lead counts in timeframe (This Month)
$leadCountsSql = "SELECT assigned_to, status, COUNT(*) as cnt 
                  FROM distribution_logs 
                  WHERE $dateCondition $roundCondition 
                    AND status IN ('assigned', 'compensation', 'error', 'rule_6_month', 'pending_work_hours') 
                  GROUP BY assigned_to, status";

$countsRes = $conn->query($leadCountsSql);
$consultantStatusCounts = [];
if ($countsRes) {
    while ($row = $countsRes->fetch_assoc()) {
        $cId = (int)$row['assigned_to'];
        $status = $row['status'];
        $cnt = (int)$row['cnt'];
        if (!isset($consultantStatusCounts[$cId])) {
            $consultantStatusCounts[$cId] = [
                'assigned' => 0,
                'compensation' => 0,
                'rule_6_month' => 0,
                'pending_work_hours' => 0,
                'error' => 0
            ];
        }
        if (array_key_exists($status, $consultantStatusCounts[$cId])) {
            $consultantStatusCounts[$cId][$status] = $cnt;
        }
    }
}

foreach ($consultants as $cId => &$c) {
    if (isset($consultantStatusCounts[$cId])) {
        $sc = $consultantStatusCounts[$cId];
        $c['assigned_count'] = $sc['assigned'] + $sc['compensation'] + $sc['rule_6_month'] + $sc['pending_work_hours'] + max(0, $sc['error'] - $sc['compensation']);
        $c['simulated_assigned'] = $c['assigned_count'];
    }
}
unset($c);

// 3. Fetch last assigned consultant ID
$lastAssignedId = 0;
$rRes = $conn->query("SELECT last_assigned_consultant_id FROM distribution_rounds WHERE id = $roundId");
if ($rRes && $rRow = $rRes->fetch_assoc()) {
    $lastAssignedId = (int)$rRow['last_assigned_consultant_id'];
}

echo "--- Current Database State ---\n";
echo "Last Assigned Consultant ID: $lastAssignedId\n";
foreach ($consultants as $c) {
    echo "- {$c['name']} (ID: {$c['id']}):\n";
    echo "  * Assigned Count (This Month): {$c['assigned_count']}\n";
    echo "  * Pending Compensation (Debt): {$c['pending_compensation']}\n";
    echo "  * Current Skip Count: {$c['skip_count']}\n";
    echo "  * Current Turn Remaining: {$c['current_turn_remaining']}\n";
    echo "  * Receive Ratio: {$c['receive_ratio']}\n";
}
echo "\n";

// Helper function to calculate fairness index (1 - Normalized Gini)
function calculateFairnessIndex($activeList) {
    $N = count($activeList);
    if ($N === 0) return 100.0;
    
    $normalizedCounts = [];
    foreach ($activeList as $c) {
        $ratio = max(1, $c['receive_ratio']);
        $normalizedCounts[] = $c['simulated_assigned'] * $ratio;
    }
    
    $sumNorm = array_sum($normalizedCounts);
    if ($sumNorm === 0) return 100.0;
    
    $doubleSumDiffNorm = 0;
    for ($i = 0; $i < $N; $i++) {
        for ($j = 0; $j < $N; $j++) {
            $doubleSumDiffNorm += abs($normalizedCounts[$i] - $normalizedCounts[$j]);
        }
    }
    
    $giniNormalized = $doubleSumDiffNorm / (2 * $N * $sumNorm);
    return round((1 - $giniNormalized) * 100, 1);
}

// 4. Run simulation
$predictiveTurns = max(30, count($consultants) * 10);
$maxFairness = -1.0;
$turnsNeeded = 0;
$currentLastAssignedId = $lastAssignedId;

// Convert map to sequential array indexed by ID ASC to match exact DB sorting
$activeList = array_values($consultants);
usort($activeList, function($a, $b) {
    return $a['id'] - $b['id'];
});

$N = count($activeList);

echo "--- Starting Step-by-Step Simulation (Up to $predictiveTurns Turns) ---\n";

for ($turn = 1; $turn <= $predictiveTurns; $turn++) {
    $chosenIdx = -1;
    $reason = '';
    
    // Priority 1: Compensation
    foreach ($activeList as $idx => $c) {
        if ($c['simulated_compensation'] > 0) {
            $chosenIdx = $idx;
            $reason = 'Compensation (Data bù còn nợ)';
            break;
        }
    }
    
    if ($chosenIdx !== -1) {
        $activeList[$chosenIdx]['simulated_compensation']--;
        $activeList[$chosenIdx]['simulated_assigned']++;
    } else {
        // Priority 2: Mid-turn (current_turn_remaining > 0)
        foreach ($activeList as $idx => $c) {
            if ($c['simulated_current_turn_remaining'] > 0) {
                $chosenIdx = $idx;
                $reason = 'Mid-turn (Đang trong lượt nhận)';
                break;
            }
        }
        
        if ($chosenIdx !== -1) {
            $activeList[$chosenIdx]['simulated_current_turn_remaining']--;
            $activeList[$chosenIdx]['simulated_assigned']++;
        } else {
            // Priority 3: Round Robin sequence
            $nextIdx = 0;
            if ($currentLastAssignedId > 0) {
                foreach ($activeList as $idx => $c) {
                    if ($c['id'] == $currentLastAssignedId) {
                        $nextIdx = ($idx + 1) % $N;
                        break;
                    }
                }
            }
            
            $startIdx = $nextIdx;
            $chosenIdx = -1;
            $steps = [];
            
            do {
                $candidate = &$activeList[$nextIdx];
                $ratio = max(1, $candidate['receive_ratio']);
                $skipCount = $candidate['simulated_skip_count'];
                
                $steps[] = "Check {$candidate['name']} (Skip: $skipCount, Ratio: $ratio)";
                
                if ($ratio === 1 || $skipCount >= $ratio - 1) {
                    $chosenIdx = $nextIdx;
                    $candidate['simulated_skip_count'] = 0;
                    break;
                } else {
                    $candidate['simulated_skip_count']++;
                    $nextIdx = ($nextIdx + 1) % $N;
                }
            } while ($nextIdx != $startIdx);
            
            if ($chosenIdx === -1) {
                $chosenIdx = $startIdx;
                $activeList[$chosenIdx]['simulated_skip_count'] = 0;
            }
            
            $activeList[$chosenIdx]['simulated_assigned']++;
            $currentLastAssignedId = $activeList[$chosenIdx]['id'];
            $reason = 'Round-Robin (' . implode(' -> ', $steps) . ')';
        }
    }
    
    // Calculate current fairness
    $currentFairness = calculateFairnessIndex($activeList);
    
    echo "Turn $turn:\n";
    echo "  * Assigned to: {$activeList[$chosenIdx]['name']} (ID: {$activeList[$chosenIdx]['id']})\n";
    echo "  * Reason: $reason\n";
    echo "  * Current counts: ";
    $countsStr = [];
    foreach ($activeList as $c) {
        $countsStr[] = "{$c['name']}: {$c['simulated_assigned']}";
    }
    echo implode(', ', $countsStr) . "\n";
    echo "  * Fairness Index: $currentFairness%\n\n";
    
    if ($currentFairness > $maxFairness) {
        $maxFairness = $currentFairness;
        $turnsNeeded = $turn;
    }
}

echo "=== SIMULATION SUMMARY ===\n";
echo "Highest Fairness Index: $maxFairness%\n";
echo "Turns needed to reach peak: $turnsNeeded turn(s)\n";
