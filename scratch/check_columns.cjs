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
  console.log('Adding columns to leads...');
  const resL = await query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS loai_hinh VARCHAR(100) NULL AFTER property_type, ADD COLUMN IF NOT EXISTS app_lienhe VARCHAR(100) NULL AFTER zalo_phone");
  console.log('Res Leads:', resL);

  console.log('Adding columns to contacts...');
  const resC = await query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS loai_hinh VARCHAR(100) NULL AFTER property_type, ADD COLUMN IF NOT EXISTS app_lienhe VARCHAR(100) NULL AFTER zalo_phone");
  console.log('Res Contacts:', resC);

  const lCols = await query("SHOW COLUMNS FROM leads WHERE Field IN ('loai_hinh', 'app_lienhe')");
  console.log('Verified Leads Columns:', lCols);

  const cCols = await query("SHOW COLUMNS FROM contacts WHERE Field IN ('loai_hinh', 'app_lienhe')");
  console.log('Verified Contacts Columns:', cCols);
}

run();
