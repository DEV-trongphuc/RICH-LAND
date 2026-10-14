const fs = require('fs');
const { query } = require('./query.cjs');

async function testAutoContacts() {
  const leadMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\lead_map.json', 'utf8'));

  // Test sample missing lead from earlier: '2001957487247286'
  const sampleLead = '2001957487247286';
  const lInfo = leadMap[sampleLead];
  console.log('Sample lead from leadMap:', lInfo);

  if (lInfo && lInfo.crm_lead_id) {
    const res = await query(`SELECT id, person_id, name, phone, email, project_id, source, created_at FROM leads WHERE id = ${lInfo.crm_lead_id};`);
    console.log('Lead record from DB:', res.data);
  }
}

testAutoContacts();
