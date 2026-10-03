const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const cCols = await query("SHOW COLUMNS FROM contacts LIKE '%loai%'");
  console.log('Contacts Columns:', cCols);

  const lCols = await query("SHOW COLUMNS FROM leads LIKE '%loai%'");
  console.log('Leads Columns:', lCols);
}

run();
