const https = require('https');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data.substring(0, 300), error: e.message });
        }
      });
    }).on('error', reject);
  });
}

const sql = process.argv.slice(2).join(' ');
if (!sql) {
  console.log("Please provide SQL query");
  process.exit(1);
}

queryDb(sql).then(res => {
  console.log(JSON.stringify(res, null, 2));
}).catch(console.error);
