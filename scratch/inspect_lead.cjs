const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, error: e.message });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== LEAD RECORD ===');
  const leads = await query("SELECT * FROM leads WHERE id = 1 OR phone = '0900000001' OR name LIKE '%Trương%'");
  console.log(JSON.stringify(leads, null, 2));

  console.log('=== PERSONS / CONTACTS ===');
  const persons = await query("SELECT * FROM persons WHERE phone = '0900000001' OR full_name LIKE '%Trương%'");
  console.log(JSON.stringify(persons, null, 2));

  const contacts = await query("SELECT * FROM contacts WHERE phone = '0900000001' OR name LIKE '%Trương%'");
  console.log(JSON.stringify(contacts, null, 2));

  console.log('=== CUSTOM FIELDS & VALUES ===');
  const cf = await query("SELECT * FROM custom_fields");
  console.log(JSON.stringify(cf, null, 2));

  const cfv = await query("SELECT * FROM custom_field_values");
  console.log(JSON.stringify(cfv, null, 2));

  console.log('=== FIELD MAPPINGS ===');
  const fm = await query("SELECT * FROM field_mappings");
  console.log(JSON.stringify(fm, null, 2));

  console.log('=== SHEET CONNECTIONS & SYNC RECORDS ===');
  const sc = await query("SELECT * FROM sheet_connections");
  console.log(JSON.stringify(sc, null, 2));

  const ssr = await query("SELECT * FROM sheet_sync_records ORDER BY id DESC LIMIT 5");
  console.log(JSON.stringify(ssr, null, 2));
}

main().catch(console.error);
