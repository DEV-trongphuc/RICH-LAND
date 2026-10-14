const https = require('https');
const querystring = require('querystring');

function query(sql) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      key: 'richland2026',
      sql: sql
    });

    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, error: e.message });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = { query };

if (require.main === module) {
  const sql = process.argv.slice(2).join(' ') || 'SELECT 1;';
  query(sql).then(res => console.log(JSON.stringify(res, null, 2))).catch(err => console.error(err));
}
