const fs = require('fs');
const { query } = require('./query.cjs');

async function check() {
  console.log('=== 1. CHECKING WHY OWNER_ID = 1003 (Admin MTP) ===');
  const staffMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\staff_map.json', 'utf8'));

  // Query contacts where owner_id = 1003
  const res = await query(`
    SELECT legacy_khtn_id, lead_id, first_name, last_name, phone, pipeline_status 
    FROM contacts 
    WHERE owner_id = 1003 
    LIMIT 10;
  `);
  console.log('Sample contacts with owner_id = 1003:', res.data);

  const resCount = await query(`
    SELECT 
      SUM(CASE WHEN legacy_khtn_id IS NOT NULL THEN 1 ELSE 0 END) as from_khtn,
      SUM(CASE WHEN legacy_khtn_id IS NULL AND lead_id IS NOT NULL THEN 1 ELSE 0 END) as from_lead_without_khtn,
      SUM(CASE WHEN legacy_khtn_id IS NULL AND lead_id IS NULL THEN 1 ELSE 0 END) as baseline_or_other
    FROM contacts 
    WHERE owner_id = 1003;
  `);
  console.log('Breakdown of owner_id = 1003:', resCount.data);

  console.log('\n=== 2. CHECKING QUẢN LÝ LEAD (/data) ===');
  // How does /data query data?
  // Let's check table `lead_allocations` and `leads`
  const allocRes = await query("SELECT COUNT(*) as count FROM lead_allocations;");
  console.log('Total lead_allocations in DB:', allocRes.data);

  const leadsRes = await query("SELECT COUNT(*) as count FROM leads;");
  console.log('Total leads in DB:', leadsRes.data);

  console.log('\n=== 3. CHECKING KHO DATABANK (/databank) ===');
  // How does /databank query data?
  const dbPersons = await query("SELECT COUNT(*) as count FROM persons WHERE is_public = 1;");
  console.log('Persons with is_public = 1:', dbPersons.data);

  const dbContacts = await query("SELECT COUNT(*) as count FROM contacts WHERE pipeline_status = 'databank' OR source = 'databank';");
  console.log('Contacts with databank status/source:', dbContacts.data);
}

check();
