const { query } = require('./query.cjs');

async function check() {
  const r = await query("SELECT id, reason FROM distribution_logs WHERE reason IS NOT NULL;");
  let lit = 0;
  for (const x of (r.data || [])) {
    if (x.reason && x.reason.includes(String.raw`\n`)) lit++;
  }
  console.log(`distribution_logs.reason with literal \\n: ${lit} / ${r.data?.length}`);
}

check();
