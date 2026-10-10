const https = require('https');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      key: 'richland2026',
      sql: sql
    }).toString();

    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const sql = process.argv[2] || 'SELECT id, round_name, is_active, round_type, active_hours_enabled, active_hours_start, active_hours_end FROM distribution_rounds';
  const result = await queryDb(sql);
  console.log(JSON.stringify(result, null, 2));
}

run();
