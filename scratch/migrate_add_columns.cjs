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

async function addColumnIfNotExists(table, column, def) {
  try {
    const sql = `ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS \`${column}\` ${def}`;
    const res = await queryProd(sql);
    console.log(`Add ${table}.${column}:`, res.status || res);
  } catch (e) {
    console.error(`Error adding ${table}.${column}:`, e);
  }
}

async function main() {
  console.log('--- ADDING COLUMNS TO LEADS TABLE ---');
  const leadsColumns = [
    ['appsheet_id', 'VARCHAR(50) DEFAULT NULL'],
    ['hinh_thuc_tt', 'VARCHAR(100) DEFAULT NULL'],
    ['time_lienhe', 'VARCHAR(100) DEFAULT NULL'],
    ['nhu_cau', 'VARCHAR(150) DEFAULT NULL'],
    ['tieu_chi', 'VARCHAR(150) DEFAULT NULL'],
    ['san_pham', 'VARCHAR(150) DEFAULT NULL'],
    ['tinh_trang', 'VARCHAR(150) DEFAULT NULL'],
    ['inbox_url', 'TEXT DEFAULT NULL'],
    ['client_context', 'TEXT DEFAULT NULL'],
    ['mkt_chiateam', 'VARCHAR(50) DEFAULT NULL'],
    ['kho_lead', 'VARCHAR(150) DEFAULT NULL'],
    ['kenh', 'VARCHAR(50) DEFAULT NULL'],
    ['lead_tindung', 'VARCHAR(50) DEFAULT NULL'],
    ['time_databank', 'DATETIME DEFAULT NULL'],
    ['country', 'VARCHAR(50) DEFAULT NULL'],
    ['city', 'VARCHAR(100) DEFAULT NULL'],
    ['birthday', 'DATE DEFAULT NULL']
  ];

  for (const [col, def] of leadsColumns) {
    await addColumnIfNotExists('leads', col, def);
  }

  // Add index on appsheet_id
  try {
    const resIdx = await queryProd("ALTER TABLE `leads` ADD INDEX IF NOT EXISTS `idx_leads_appsheet_id` (`appsheet_id`)");
    console.log('Index idx_leads_appsheet_id:', resIdx.status || resIdx);
  } catch (e) {}

  console.log('\n--- ADDING COLUMNS TO CONTACTS TABLE ---');
  const contactsColumns = [
    ['hinh_thuc_tt', 'VARCHAR(100) DEFAULT NULL'],
    ['time_lienhe', 'VARCHAR(100) DEFAULT NULL'],
    ['nhu_cau', 'VARCHAR(150) DEFAULT NULL'],
    ['tieu_chi', 'VARCHAR(150) DEFAULT NULL'],
    ['san_pham', 'VARCHAR(150) DEFAULT NULL'],
    ['tinh_trang', 'VARCHAR(150) DEFAULT NULL'],
    ['inbox_url', 'TEXT DEFAULT NULL'],
    ['client_context', 'TEXT DEFAULT NULL'],
    ['ad_id', 'VARCHAR(100) DEFAULT NULL'],
    ['appsheet_id', 'VARCHAR(50) DEFAULT NULL'],
    ['csdh_time', 'DATETIME DEFAULT NULL'],
    ['quantam_time', 'DATETIME DEFAULT NULL'],
    ['dongygap_time', 'DATETIME DEFAULT NULL'],
    ['dagap_time', 'DATETIME DEFAULT NULL'],
    ['booking_time', 'DATETIME DEFAULT NULL'],
    ['datcoc_time', 'DATETIME DEFAULT NULL'],
    ['sl_booking', 'INT(11) DEFAULT NULL'],
    ['chan_dung', 'TEXT DEFAULT NULL'],
    ['image_dongygap', 'VARCHAR(255) DEFAULT NULL'],
    ['image_dagap', 'VARCHAR(255) DEFAULT NULL'],
    ['image_UNC', 'VARCHAR(255) DEFAULT NULL'],
    ['thongtin_kh_origin', 'TEXT DEFAULT NULL']
  ];

  for (const [col, def] of contactsColumns) {
    await addColumnIfNotExists('contacts', col, def);
  }

  console.log('\n--- VERIFYING LEADS DESCRIBE ---');
  const dLeads = await queryProd("DESCRIBE leads");
  console.log('Total columns in leads:', dLeads.data?.length);

  console.log('\n--- VERIFYING CONTACTS DESCRIBE ---');
  const dContacts = await queryProd("DESCRIBE contacts");
  console.log('Total columns in contacts:', dContacts.data?.length);
}

main().catch(console.error);
