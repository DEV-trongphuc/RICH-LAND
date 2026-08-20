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
  const round = await query("SELECT id, round_name, last_assigned_consultant_id, is_active FROM distribution_rounds WHERE id = 2");
  console.log('Round 2:', round);
  const rc = await query("SELECT rc.*, c.name FROM round_consultants rc JOIN consultants c ON rc.consultant_id = c.id WHERE rc.round_id = 2");
  console.log('Consultants in Round 2:', rc);
  const dl = await query("SELECT id, lead_id, assigned_to, status, received_at FROM distribution_logs ORDER BY id DESC LIMIT 5");
  console.log('Recent distribution logs:', dl);
}

main().catch(console.error);
