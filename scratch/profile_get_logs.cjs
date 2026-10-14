const https = require('https');

function fetchTime(url) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const req = https.request(url, {
      headers: { 'Authorization': 'Bearer demo_token_12345' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ time: Date.now() - t0, status: res.statusCode, size: data.length });
      });
    });
    req.end();
  });
}

async function run() {
  console.log('Testing get_logs with date=all:');
  const r1 = await fetchTime('https://crm.richland.city/backend/api.php?action=get_logs&page=1&pageSize=50&date=all&_t=' + Date.now());
  console.log('get_logs date=all:', r1);

  console.log('Testing get_logs with date=Tháng này:');
  const r2 = await fetchTime('https://crm.richland.city/backend/api.php?action=get_logs&page=1&pageSize=50&date=' + encodeURIComponent('Tháng này') + '&_t=' + Date.now());
  console.log('get_logs Tháng này:', r2);
}

run();
