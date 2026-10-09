const https = require('https');

function queryDb(sql) {
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
  const res = await queryDb("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%night%' OR setting_key LIKE '%shift%' OR setting_key LIKE '%lead%' OR setting_key LIKE '%time%' ORDER BY setting_key");
  console.log(JSON.stringify(res, null, 2));
}

run();
