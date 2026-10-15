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
  // Let's check distribution_rounds id=2
  const round2 = await execQuery(`SELECT * FROM distribution_rounds WHERE id = 2`);
  console.log("Round 2:", JSON.stringify(round2.data, null, 2));

  // Let's check all distribution logs for round 2 today
  const logsToday = await execQuery(`
    SELECT dl.id, dl.lead_id, dl.assigned_to, c.name, dl.status, dl.message, dl.received_at
    FROM distribution_logs dl
    LEFT JOIN consultants c ON dl.assigned_to = c.id
    WHERE dl.round_id = 2 AND dl.received_at >= CURDATE()
    ORDER BY dl.id DESC
    LIMIT 30
  `);
  console.log("Round 2 Logs Today:", JSON.stringify(logsToday.data, null, 2));

  // Let's check the gates for all consultants in round 2:
  // What are the gates?
  // 1. Project gate (project_id)
  // 2. Capacity gate / lead limits
  // 3. Attendance gate (checkin today)
  // 4. Working hours gate
  // 5. Cooldown gate
  const attendance = await execQuery(`
    SELECT a.*, u.full_name, u.email
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE a.date = CURDATE()
  `);
  console.log("Attendance Today:", JSON.stringify(attendance.data, null, 2));
}

run();
