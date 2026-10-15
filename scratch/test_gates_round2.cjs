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
  const consultants = await execQuery(`
    SELECT rc.consultant_id, c.name, c.email, u.id as user_id, u.status as user_status, u.vacation_mode as user_vacation,
           c.status as cons_status, c.vacation_mode as cons_vacation, c.work_start_time, c.work_end_time, c.work_schedule
    FROM round_consultants rc
    JOIN consultants c ON rc.consultant_id = c.id
    LEFT JOIN users u ON u.email = c.email
    WHERE rc.round_id = 2 AND rc.is_active = 1
  `);

  console.log(`Checking ${consultants.data.length} consultants in Round 2...`);

  // Check check_ins today
  const checkins = await execQuery(`
    SELECT * FROM check_ins WHERE check_in_date = CURDATE()
  `);
  console.log("Check-ins today:", JSON.stringify(checkins.data, null, 2));

  // Check settings
  const settings = await execQuery(`
    SELECT \`setting_key\`, \`setting_value\` FROM system_settings
    WHERE \`setting_key\` IN (
      'require_checkin_to_receive_leads',
      'allow_lead_distribution_on_pending_checkin',
      'require_ontime_checkin_to_receive_leads',
      'backpressure_limit'
    )
  `);
  console.log("Settings:", JSON.stringify(settings.data, null, 2));

  // Check project roster for project 2
  const roster = await execQuery(`
    SELECT pr.*, u.full_name FROM project_roster pr
    JOIN users u ON pr.user_id = u.id
    WHERE pr.project_id = 2
  `);
  console.log("Project 2 Roster:", JSON.stringify(roster.data, null, 2));

  for (const c of consultants.data) {
    console.log(`\nConsultant: ${c.name} (cons_id: ${c.consultant_id}, user_id: ${c.user_id})`);
    
    // Check in project roster
    const inRoster = roster.data ? roster.data.some(r => r.user_id == c.user_id) : false;
    console.log(`  Gate 1 (Project 2 Roster): ${inRoster ? 'PASS' : 'FAIL - NOT IN ROSTER'}`);

    // Check check-in
    const ci = checkins.data ? checkins.data.find(x => x.user_id == c.user_id) : null;
    console.log(`  Gate 2 (Check-in): ${ci ? `status=${ci.status}, late=${ci.late_minutes}` : 'NO CHECK-IN TODAY'}`);

    // Check Backpressure
    if (c.user_id) {
      const bp = await execQuery(`
        SELECT COUNT(*) as cnt 
        FROM contacts c
        WHERE c.owner_id = ${c.user_id}
          AND c.deleted_at IS NULL
          AND c.status != 'rejected'
          AND c.pipeline_status IN ('chua_xac_dinh', 'quan_tam')
          AND NOT EXISTS (
              SELECT 1 FROM notes n 
              WHERE n.entity_type = 'contact' 
                AND n.entity_id = c.id 
          )
          AND NOT EXISTS (
              SELECT 1 FROM activities a
              WHERE (a.related_type = 'contact' AND a.related_id = c.id)
                 OR a.contact_id = c.id
          )
      `);
      console.log(`  Gate 4 (Backpressure): uncontacted=${bp.data ? bp.data[0].cnt : 'err'}`);
    }
  }
}

run();
