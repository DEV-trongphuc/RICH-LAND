const { query } = require('./query.cjs');
async function f() {
  const r = await query("SELECT id, phone, status FROM leads WHERE phone LIKE '%0909020009%';");
  console.log('leads:', r.data);
  const c = await query("SELECT id, phone, pipeline_status FROM contacts WHERE phone LIKE '%0909020009%';");
  console.log('contacts:', c.data);
}
f().catch(console.error);
