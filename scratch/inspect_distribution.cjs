const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, error: e.message });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== DISTRIBUTION ROUNDS ===');
  const rounds = await query("SELECT * FROM distribution_rounds");
  console.log(JSON.stringify(rounds, null, 2));

  console.log('=== ROUND CONSULTANTS ===');
  const rc = await query("SELECT * FROM round_consultants");
  console.log(JSON.stringify(rc, null, 2));

  console.log('=== CONSULTANTS ===');
  const consultants = await query("SELECT id, name, email, phone, is_active, work_start_time, work_end_time, work_schedule FROM consultants");
  console.log(JSON.stringify(consultants, null, 2));

  console.log('=== USERS ===');
  const users = await query("SELECT id, name, email, role, status FROM users");
  console.log(JSON.stringify(users, null, 2));

  console.log('=== RULES ===');
  const rules = await query("SELECT * FROM distribution_rules");
  console.log(JSON.stringify(rules, null, 2));

  console.log('=== DISTRIBUTION LOGS FOR LEAD 1 ===');
  const logs = await query("SELECT * FROM distribution_logs ORDER BY id DESC LIMIT 5");
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error);
