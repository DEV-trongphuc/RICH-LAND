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
  console.log("=== 1. FIND RECENT LEADS (LAST 2 HOURS) ===");
  const leads = await execQuery(`
    SELECT l.id, l.name, l.phone, l.email, l.status, l.assigned_to, l.is_accepted, 
           l.target_round_id, l.last_interaction_date, l.created_at, l.source,
           c.name as assigned_name
    FROM leads l
    LEFT JOIN consultants c ON l.assigned_to = c.id
    WHERE l.last_interaction_date >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
       OR l.id IN (
         SELECT lead_id FROM distribution_logs WHERE received_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
       )
    ORDER BY l.last_interaction_date DESC
    LIMIT 5
  `);
  console.log("Leads:", JSON.stringify(leads, null, 2));

  if (leads.data && leads.data.length > 0) {
    const leadId = leads.data[0].id;
    console.log(`\n=== 2. DISTRIBUTION LOGS FOR LEAD ${leadId} ===`);
    const logs = await execQuery(`
      SELECT dl.id, dl.lead_id, dl.assigned_to, c.name as sale_name, dl.round_id, dl.status, dl.message, dl.received_at
      FROM distribution_logs dl
      LEFT JOIN consultants c ON dl.assigned_to = c.id
      WHERE dl.lead_id = ${leadId}
      ORDER BY dl.id DESC
      LIMIT 20
    `);
    console.log("Logs:", JSON.stringify(logs, null, 2));

    console.log(`\n=== 3. CONTACTS RECORD FOR LEAD ${leadId} OR PHONE ${leads.data[0].phone} ===`);
    const contacts = await execQuery(`
      SELECT c.id, c.lead_id, c.person_id, c.owner_id, c.pipeline_status, c.created_at, c.updated_at,
             u.full_name as owner_user_name, cons.name as owner_cons_name
      FROM contacts c
      LEFT JOIN users u ON c.owner_id = u.id
      LEFT JOIN consultants cons ON c.owner_id = cons.id
      WHERE c.lead_id = ${leadId} OR c.person_id IN (
        SELECT id FROM persons WHERE phone = '${leads.data[0].phone}'
      )
    `);
    console.log("Contacts:", JSON.stringify(contacts, null, 2));

    console.log(`\n=== 4. ROUND CONFIG FOR ROUND ${leads.data[0].target_round_id} ===`);
    const roundId = leads.data[0].target_round_id;
    const round = await execQuery(`
      SELECT * FROM distribution_rounds WHERE id = ${roundId}
    `);
    console.log("Round config:", JSON.stringify(round, null, 2));

    console.log(`\n=== 5. ROUND CONSULTANTS FOR ROUND ${roundId} ===`);
    const roundCons = await execQuery(`
      SELECT rc.*, c.name, c.email, c.phone, c.status, c.vacation_mode, c.work_start_time, c.work_end_time, c.work_schedule
      FROM round_consultants rc
      JOIN consultants c ON rc.consultant_id = c.id
      WHERE rc.round_id = ${roundId}
      ORDER BY rc.turn_order ASC
    `);
    console.log("Round Consultants:", JSON.stringify(roundCons, null, 2));
  }

  console.log("\n=== 6. CHECK SALES USERS / CONSULTANTS (Bá Dương, Khắc Phú, Trí Nguyễn) ===");
  const salesUsers = await execQuery(`
    SELECT u.id as user_id, u.full_name, u.email, u.role, u.consultant_id,
           c.id as cons_id, c.name as cons_name, c.status as cons_status, c.vacation_mode
    FROM users u
    LEFT JOIN consultants c ON (u.consultant_id = c.id OR u.email = c.email OR u.full_name = c.name)
    WHERE u.full_name LIKE '%Dương%' OR u.full_name LIKE '%Phú%' OR u.full_name LIKE '%Trí%'
       OR c.name LIKE '%Dương%' OR c.name LIKE '%Phú%' OR c.name LIKE '%Trí%'
  `);
  console.log("Sales users & consultants:", JSON.stringify(salesUsers, null, 2));
}

run().catch(console.error);
