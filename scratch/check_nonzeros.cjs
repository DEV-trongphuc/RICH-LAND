const https = require('https');

function execQuery(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: e.message, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const comp = await execQuery(`
    SELECT rc.consultant_id, c.name, rc.compensation_count, rc.skipped_credit, rc.current_turn_remaining, rc.skip_count
    FROM round_consultants rc
    JOIN consultants c ON rc.consultant_id = c.id
    WHERE rc.round_id = 2 
      AND (rc.compensation_count > 0 OR rc.skipped_credit > 0 OR rc.current_turn_remaining > 0 OR rc.skip_count > 0)
  `);
  console.log("Compensations/Credits/Skips in Round 2:", JSON.stringify(comp.data, null, 2));

  // Let's also run getNextConsultantInRound logic in a PHP script via web to see who it picks!
  const phpTest = `
    require_once __DIR__ . '/backend/webhook_logic.php';
    $res1 = getNextConsultantInRound($conn, 2, null, []);
    $res2 = getNextConsultantInRound($conn, 2, null, [$res1['id']]);
    $res3 = getNextConsultantInRound($conn, 2, null, [$res1['id'], $res2['id']]);
    echo json_encode([
      'next1' => $res1,
      'next2' => $res2,
      'next3' => $res3,
      'round' => $conn->query("SELECT last_assigned_consultant_id FROM distribution_rounds WHERE id = 2")->fetch_assoc()
    ]);
  `;
  // We can't eval PHP directly via exec_db_query, but we can inspect the exact round consultants and round-robin logic!
}

run();
