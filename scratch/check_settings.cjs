const https = require('https');

const querystring = require('querystring');
const postData = querystring.stringify({
  key: 'richland2026',
  sql: "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'security_timer_%' OR setting_key LIKE '%parallel%' OR setting_key LIKE '%databank%' OR setting_key = 'deal_won_status' ORDER BY setting_key ASC"
});

const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Raw body:', body);
    }
  });
});

req.on('error', e => console.error(e));
req.write(postData);
req.end();
