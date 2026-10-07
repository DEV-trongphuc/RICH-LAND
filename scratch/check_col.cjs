const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('https://crm.richland.city/backend/exec_db_query.php', new URLSearchParams({
      key: 'richland2026',
      sql: "SHOW COLUMNS FROM contacts WHERE Field IN ('lead_phan_loai', 'loai_lead', 'platform', 'source')"
    }));
    console.log('Result:', res.data.data);
  } catch (e) {
    console.error(e.message);
  }
}
test();
