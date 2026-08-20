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
  console.log(await runQuery("SELECT c.id, c.name, c.avatar, u.id as user_id, u.avatar_url FROM consultants c LEFT JOIN users u ON c.email = u.email WHERE c.id = 100072"));
}

main().catch(console.error);
