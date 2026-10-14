const fs = require('fs');

// Read a chunk of AppsheetRLVN.sql where KHTN251006184154 is
// In test_hex.cjs we saw contact 10830 had legacy_khtn_id?
const { query } = require('./query.cjs');
async function test() {
  const res = await query("SELECT id, legacy_khtn_id, notes FROM contacts WHERE id = 10830;");
  console.log('Contact 10830:', res.data[0]);
  if (res.data[0]?.legacy_khtn_id) {
    const khtnId = res.data[0].legacy_khtn_id;
    const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');
    const idx = sqlDump.indexOf(khtnId);
    console.log('Index of', khtnId, ':', idx);
    if (idx !== -1) {
      console.log('Dump snippet (1500 chars):', JSON.stringify(sqlDump.slice(idx, idx + 1500)));
    }
  }
}
test();
