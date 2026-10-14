const { query } = require('./query.cjs');

async function testHist() {
  const t0 = Date.now();
  const res = await query(`
    SELECT 
        COALESCE(NULLIF(dl.assigned_to, 0), NULLIF(rpt.consultant_id, 0), 0) as id,
        COALESCE(NULLIF(cons.name, ''), NULLIF(u.full_name, ''), 'Tư vấn viên') as name
    FROM leads l
    LEFT JOIN persons p ON l.person_id = p.id
    LEFT JOIN distribution_logs dl ON (dl.lead_id = l.id AND dl.assigned_to > 0)
    LEFT JOIN data_reports rpt ON (rpt.lead_id = l.id AND rpt.consultant_id > 0)
    LEFT JOIN users u ON (dl.assigned_to = u.id OR rpt.consultant_id = u.id)
    LEFT JOIN consultants cons ON (cons.id = dl.assigned_to OR cons.id = rpt.consultant_id OR u.email = cons.email OR u.id = cons.id)
    LEFT JOIN teams tm ON (cons.team_id = tm.id OR u.team_id = tm.id)
    LEFT JOIN distribution_rounds dr ON (dl.round_id = dr.id OR rpt.round_id = dr.id)
    WHERE l.person_id = 9992
    ORDER BY COALESCE(dl.id, 0) DESC, COALESCE(rpt.id, 0) DESC LIMIT 1
  `);
  console.log('Hist query time for 1 person:', Date.now() - t0, 'ms');
}

testHist();
