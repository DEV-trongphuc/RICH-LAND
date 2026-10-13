const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- USER / CONSULTANT 100124 ---');
  console.log(await query("SELECT id, username, full_name, email, phone, avatar FROM users WHERE id = 100124"));
  console.log(await query("SELECT id, name, email, phone, avatar FROM consultants WHERE id = 100124"));

  console.log('--- CONTACTS ---');
  console.log(await query("SELECT id, first_name, last_name, phone, person_id, owner_id, not_lead_proposed, not_lead_proposed_by, pipeline_status FROM contacts WHERE id = 613 OR phone LIKE '%867238917%'"));

  console.log('--- DISTRIBUTION LOGS FOR LEAD 99 ---');
  console.log(await query("SELECT * FROM distribution_logs WHERE lead_id = 99 ORDER BY id DESC"));
}

run();
