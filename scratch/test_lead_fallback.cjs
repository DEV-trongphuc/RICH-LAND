const fs = require('fs');
const { query } = require('./query.cjs');

async function testLeadFallback() {
  const leadMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\lead_map.json', 'utf8'));

  // Get contact mapping by lead_id and person_id from live CRM
  const res = await query("SELECT id, lead_id, person_id FROM contacts;");
  const contacts = res.data || [];
  const byLeadId = new Map();
  const byPersonId = new Map();

  contacts.forEach(c => {
    if (c.lead_id) byLeadId.set(String(c.lead_id), c.id);
    if (c.person_id) byPersonId.set(String(c.person_id), c.id);
  });

  console.log(`Contacts with lead_id: ${byLeadId.size}, with person_id: ${byPersonId.size}`);

  // Test sample unmatched: leadId '968891225410361'
  const sampleLead = '968891225410361';
  if (leadMap[sampleLead]) {
    const lInfo = leadMap[sampleLead];
    console.log(`Sample lead info:`, lInfo);
    console.log(`Matched contact via crm_lead_id: ${byLeadId.get(String(lInfo.crm_lead_id))}`);
    console.log(`Matched contact via person_id: ${byPersonId.get(String(lInfo.person_id))}`);
  } else {
    console.log('Sample lead not found in leadMap');
  }

  // Also test other sample: '2001957487247286'
  const s2 = '2001957487247286';
  if (leadMap[s2]) {
    const lInfo = leadMap[s2];
    console.log(`Sample 2 info:`, lInfo);
    console.log(`Matched contact via crm_lead_id: ${byLeadId.get(String(lInfo.crm_lead_id))}`);
    console.log(`Matched contact via person_id: ${byPersonId.get(String(lInfo.person_id))}`);
  }
}

testLeadFallback();
