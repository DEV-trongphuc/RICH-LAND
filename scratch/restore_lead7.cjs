const https = require('https');

async function runQuery(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function main() {
  console.log(await runQuery("UPDATE leads SET assigned_to = 100072, is_accepted = 1, accepted_at = '2026-08-20 21:14:49', status = 'active', target_round_id = 10011 WHERE id = 7"));
  console.log(await runQuery("DELETE FROM distribution_logs WHERE id IN (36, 37, 38)"));
  console.log(await runQuery("SELECT id, lead_id, assigned_to, status, message, received_at FROM distribution_logs WHERE lead_id = 7 ORDER BY id DESC"));
}

main().catch(console.error);
