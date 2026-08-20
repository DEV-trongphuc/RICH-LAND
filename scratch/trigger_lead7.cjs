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
  console.log(await runQuery("UPDATE leads SET status = 'pending_claim', target_round_id = 10011, assigned_to = NULL, is_accepted = 0, next_attempt_date = NULL WHERE id = 7"));
  console.log(await runQuery("DELETE FROM lead_offers WHERE lead_id = 7"));
  console.log(await runQuery("INSERT INTO lead_offers (lead_id, user_id, round_id, expires_at, status) VALUES (7, 100072, 10011, DATE_ADD(NOW(), INTERVAL 300 SECOND), 'pending')"));
  console.log(await runQuery("SELECT * FROM lead_offers WHERE lead_id = 7"));
}

main().catch(console.error);
