const https = require('https');
const querystring = require('querystring');

function runSql(sql) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({ key: 'richland2026', sql });
    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const pl = await runSql("SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO FROM information_schema.processlist WHERE USER = 'zccqvhhh_crm-rlvn' ORDER BY TIME DESC");
  console.log('Total count:', pl.data ? pl.data.length : pl);
  if (pl.data) {
    console.log(JSON.stringify(pl.data.slice(0, 10), null, 2));
  }
}
main();
