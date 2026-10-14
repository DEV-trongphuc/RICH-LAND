const https = require('https');

async function run() {
  for (let i = 1; i <= 3; i++) {
    const t0 = Date.now();
    await new Promise((resolve) => {
      const req = https.request('https://crm.richland.city/backend/api.php?action=get_logs&page=1&pageSize=50&date=all', {
        headers: { 'Authorization': 'Bearer demo_token_12345' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`Run ${i}: Status ${res.statusCode}, Time: ${Date.now() - t0} ms, Size: ${data.length}`);
          resolve();
        });
      });
      req.end();
    });
  }
}

run();
