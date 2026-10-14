const { query } = require('./query.cjs');
async function f() {
  const lc = await query("SHOW COLUMNS FROM leads LIKE '%phan_loai%';");
  console.log('leads phan_loai cols:', lc.data);
  const cc = await query("SHOW COLUMNS FROM contacts LIKE '%phan_loai%';");
  console.log('contacts phan_loai cols:', cc.data);
  const lc2 = await query("SHOW COLUMNS FROM leads LIKE '%source%';");
  console.log('leads source cols:', lc2.data);
  const cc2 = await query("SHOW COLUMNS FROM contacts LIKE '%source%';");
  console.log('contacts source cols:', cc2.data);
  
  // Also check all columns in contacts
  const allCc = await query("SHOW COLUMNS FROM contacts;");
  console.log('all contacts cols:', allCc.data.map(c => c.Field));
  
  // Also check all columns in leads
  const allLc = await query("SHOW COLUMNS FROM leads;");
  console.log('all leads cols:', allLc.data.map(c => c.Field));
}
f().catch(console.error);
