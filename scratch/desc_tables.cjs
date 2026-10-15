const https = require('https');

function queryProd(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const descContacts = await queryProd("DESCRIBE contacts");
  console.log('CONTACTS COLUMNS:');
  console.log(descContacts.data.map(c => `${c.Field} (${c.Type})`).join('\n'));

  const descLeads = await queryProd("DESCRIBE leads");
  console.log('\nLEADS COLUMNS:');
  console.log(descLeads.data.map(c => `${c.Field} (${c.Type})`).join('\n'));
}

main().catch(console.error);
