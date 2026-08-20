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
  console.log('=== DISTRIBUTION LOGS (RECENT 10) ===');
  const dl = await query('SELECT * FROM distribution_logs ORDER BY id DESC LIMIT 10');
  console.log(JSON.stringify(dl, null, 2));

  console.log('=== LEADS (RECENT 5) ===');
  const l = await query('SELECT id, name, phone, assigned_to, target_round_id, status, is_accepted, accepted_at, created_at FROM leads ORDER BY id DESC LIMIT 5');
  console.log(JSON.stringify(l, null, 2));

  console.log('=== ROUND NHANH CONFIG ===');
  const r = await query("SELECT * FROM distribution_rounds WHERE round_type = 'grab' OR round_name LIKE '%nhanh%'");
  console.log(JSON.stringify(r, null, 2));

  console.log('=== ROUND CONSULTANTS FOR GRAB ROUND ===');
  const rc = await query("SELECT * FROM round_consultants");
  console.log(JSON.stringify(rc, null, 2));
}

main().catch(console.error);
