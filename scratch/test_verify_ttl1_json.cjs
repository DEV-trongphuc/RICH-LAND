const { query } = require('./query.cjs');

async function verify() {
  const res = await query("SELECT id, ttl1_data FROM contacts WHERE ttl1_data IS NOT NULL;");
  for (const r of (res.data || [])) {
    try {
      JSON.parse(r.ttl1_data);
    } catch (e) {
      console.log(`Fixing ID ${r.id}:`, e.message);
      // Replace unescaped control chars (LF, CR, TAB) inside string literals
      // In JS, we can parse it by replacing raw newline with \n
      const sanitized = r.ttl1_data.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '');
      try {
        const obj = JSON.parse(sanitized);
        const fixedStr = JSON.stringify(obj);
        await query(`UPDATE contacts SET ttl1_data = '${fixedStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' WHERE id = ${r.id};`);
        console.log(`Successfully fixed ID ${r.id}`);
      } catch (err) {
        console.log(`Could not fix ID ${r.id}:`, err.message);
      }
    }
  }
}

verify();
