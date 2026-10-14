const { query } = require('./query.cjs');
async function f() {
  const r = await query("SELECT id, name, phone, status FROM leads WHERE id LIKE '%260504072858%' OR raw_payload LIKE '%KHTN260504072858%';");
  console.log('Found in leads?:', r.data);
}
f().catch(console.error);
