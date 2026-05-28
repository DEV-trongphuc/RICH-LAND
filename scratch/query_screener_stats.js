const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'vhvxoigh_mail_auto',
    password: 'Ideas@812',
    database: 'vhvxoigh_sale_data'
  });

  console.log("=== DB CONNECTED ===");
  
  // Set timezone to +07:00 like PHP does
  await connection.query("SET time_zone = '+07:00'");
  
  const start = '2026-05-01 00:00:00';
  const end = '2026-06-01 00:00:00';

  console.log(`\n--- AI PRE-SCREENER STATUS COUNTS (leads created between ${start} and ${end}) ---`);
  const [screenerStats] = await connection.query(`
    SELECT ai_screener_status, COUNT(*) as cnt 
    FROM leads 
    WHERE created_at >= ? AND created_at < ?
    GROUP BY ai_screener_status
  `, [start, end]);
  console.table(screenerStats);

  console.log("\n--- ALL LEADS WITH ai_screener_status = 'failed' ---");
  const [failedLeads] = await connection.query(`
    SELECT id, name, status, ai_screener_status, created_at 
    FROM leads 
    WHERE created_at >= ? AND created_at < ? AND ai_screener_status = 'failed'
    ORDER BY id ASC
  `, [start, end]);
  console.table(failedLeads);

  console.log("\n--- LEADS IN 'HÀNG CHỜ DUYỆT' (QUEUE) TAB ---");
  const [queueLeads] = await connection.query(`
    SELECT id, name, status, ai_screener_status, created_at 
    FROM leads 
    WHERE created_at >= ? AND created_at < ? 
      AND status = 'pending_approval' 
      AND NOT ( (ai_screener_status = 'pending' OR (ai_screener_status = 'error' AND ai_attempts < 3)) AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) )
    ORDER BY id ASC
  `, [start, end]);
  console.table(queueLeads);

  console.log("\n--- LEADS IN 'DƯỚI CHUẨN' (SUBSTANDARD) TAB ---");
  const [substandardLeads] = await connection.query(`
    SELECT id, name, status, ai_screener_status, created_at 
    FROM leads 
    WHERE created_at >= ? AND created_at < ? 
      AND status IN ('rejected', 'blacklisted')
    ORDER BY id ASC
  `, [start, end]);
  console.table(substandardLeads);

  console.log("\n--- LEADS IN 'GIAO LEAD' (ASSIGNED) TAB (where failed/error AI) ---");
  const [assignedLeads] = await connection.query(`
    SELECT id, name, status, ai_screener_status, created_at, note
    FROM leads 
    WHERE created_at >= ? AND created_at < ? 
      AND status = 'active' 
      AND (ai_screener_status IN ('failed', 'error') OR note LIKE '%[Duyệt %')
    ORDER BY id ASC
  `, [start, end]);
  console.table(assignedLeads.map(l => ({ id: l.id, name: l.name, status: l.status, ai_screener_status: l.ai_screener_status, created_at: l.created_at, note_snippet: l.note ? l.note.substring(0, 50) : '' })));

  await connection.end();
}

main().catch(console.error);
