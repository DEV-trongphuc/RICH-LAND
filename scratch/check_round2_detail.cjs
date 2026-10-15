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
  const round2 = await execQuery(`
    SELECT rc.round_id, rc.consultant_id, c.name, rc.is_active, rc.receive_ratio, 
           rc.skip_count, rc.compensation_count, rc.data_per_turn, 
           rc.current_turn_remaining, rc.skipped_credit, c.status, c.vacation_mode,
           c.work_start_time, c.work_end_time, c.work_schedule
    FROM round_consultants rc
    JOIN consultants c ON rc.consultant_id = c.id
    WHERE rc.round_id = 2
    ORDER BY rc.consultant_id ASC
  `);
  console.log("Round 2 Consultants Detail:", JSON.stringify(round2, null, 2));

  const leadRow = await execQuery(`
    SELECT * FROM leads WHERE id = 10413
  `);
  console.log("Lead 10413 Detail:", JSON.stringify(leadRow, null, 2));

  const sysSettings = await execQuery(`
    SELECT \`key\`, \`value\` FROM system_settings
    WHERE \`key\` IN ('starvation_prevention_enabled', 'starvation_max_leads_per_hour', 'golden_hours_start_time', 'golden_hours_end_time', 'lead_max_recall_attempts', 'lead_recall_cooldown_minutes')
  `);
  console.log("System Settings:", JSON.stringify(sysSettings, null, 2));
}

run();
