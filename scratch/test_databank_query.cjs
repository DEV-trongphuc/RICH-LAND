const { query } = require('./query.cjs');

async function testDatabank() {
  const sql = `
    SELECT p.id, p.full_name, p.phone, p.email, p.released_to_kho_at, p.deleted_from_databank, p.is_blocked
    FROM persons p
    WHERE p.released_to_kho_at IS NOT NULL
      AND p.deleted_from_databank = 0
      AND p.is_blocked = 0 
      AND NOT EXISTS (
          SELECT 1 FROM persons p2 
          WHERE p2.is_blocked = 1 
            AND (p2.phone = p.phone OR (p2.email = p.email AND p.email IS NOT NULL AND p.email != ''))
      )
      AND NOT EXISTS (
          SELECT 1 FROM blocked_leads bl 
          WHERE bl.phone = p.phone OR (bl.email = p.email AND p.email IS NOT NULL AND p.email != '')
      )
      AND NOT EXISTS (
          SELECT 1 FROM data_reports dr 
          WHERE dr.lead_id IN (SELECT id FROM leads WHERE person_id = p.id) 
            AND dr.status IN ('approved', 'approved_no_comp')
      )
    ORDER BY p.released_to_kho_at DESC
    LIMIT 10;
  `;

  const res = await query(sql);
  console.log('Admin Databank Query count:', res.data?.length);
  if (res.data?.length) {
    console.log('First 2 rows:', res.data.slice(0, 2));
  } else {
    console.log('Error or empty:', res);
  }

  const countSql = `
    SELECT COUNT(*) as cnt
    FROM persons p
    WHERE p.released_to_kho_at IS NOT NULL
      AND p.deleted_from_databank = 0
      AND p.is_blocked = 0;
  `;
  const countRes = await query(countSql);
  console.log('Total available persons in DB:', countRes.data);
}

testDatabank();
