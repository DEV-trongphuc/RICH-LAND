const { query } = require('./query.cjs');

async function benchmarkOptimization() {
  console.log('--- Benchmarking current approach (5 separate queries each doing GROUP BY) ---');
  let t0 = Date.now();
  await query(`SELECT COUNT(*) FROM distribution_logs dl INNER JOIN (SELECT lead_id, MAX(id) as max_id FROM distribution_logs WHERE 1=1 GROUP BY lead_id) dl_max ON dl.id = dl_max.max_id WHERE 1=1`);
  await query(`SELECT dl.status, COUNT(*) FROM distribution_logs dl INNER JOIN (SELECT lead_id, MAX(id) as max_id FROM distribution_logs WHERE 1=1 GROUP BY lead_id) dl_max ON dl.id = dl_max.max_id WHERE 1=1 GROUP BY dl.status`);
  await query(`SELECT dl.id FROM distribution_logs dl INNER JOIN (SELECT lead_id, MAX(id) as max_id FROM distribution_logs WHERE 1=1 GROUP BY lead_id) dl_max ON dl.id = dl_max.max_id WHERE 1=1 ORDER BY dl.id DESC LIMIT 50`);
  console.log('Current separate queries time:', Date.now() - t0, 'ms');

  console.log('--- Benchmarking with TEMPORARY TABLE ---');
  t0 = Date.now();
  await query(`CREATE TEMPORARY TABLE IF NOT EXISTS tmp_latest_dl AS SELECT lead_id, MAX(id) as max_id FROM distribution_logs GROUP BY lead_id;`);
  await query(`SELECT COUNT(*) FROM tmp_latest_dl;`);
  await query(`SELECT dl.status, COUNT(*) FROM distribution_logs dl JOIN tmp_latest_dl t ON dl.id = t.max_id GROUP BY dl.status;`);
  await query(`SELECT dl.id FROM distribution_logs dl JOIN tmp_latest_dl t ON dl.id = t.max_id ORDER BY dl.id DESC LIMIT 50;`);
  await query(`DROP TEMPORARY TABLE IF EXISTS tmp_latest_dl;`);
  console.log('Temporary table approach time:', Date.now() - t0, 'ms');
}

benchmarkOptimization();
