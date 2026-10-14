const { query } = require('./query.cjs');

async function checkIndexes() {
  const tables = ['distribution_logs', 'leads', 'contacts', 'persons', 'data_reports'];
  for (const t of tables) {
    console.log(`=== Indexes on ${t} ===`);
    const res = await query(`SHOW INDEX FROM ${t}`);
    if (res.data) {
      console.log(res.data.map(i => `${i.Key_name} (${i.Column_name})`).join(', '));
    }
  }
}

checkIndexes();
