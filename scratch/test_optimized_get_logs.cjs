const { query } = require('./query.cjs');

async function testCleanedTakers() {
  const sqlIds = `
    SELECT dl.id, p.id as person_id, dl.assigned_to, c.name as assigned_to_name, c.avatar as assigned_to_avatar, dr.round_name
    FROM distribution_logs dl
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    LEFT JOIN leads l ON dl.lead_id = l.id
    LEFT JOIN persons p ON l.person_id = p.id
    LEFT JOIN consultants c ON dl.assigned_to = c.id
    LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
    ORDER BY COALESCE(l.created_at, dl.received_at) DESC, l.id DESC 
    LIMIT 50
  `;
  let t0 = Date.now();
  const resIds = await query(sqlIds);
  console.log('1. Main query time:', Date.now() - t0, 'ms');

  const personIds = Array.from(new Set(resIds.data.map(r => r.person_id).filter(id => id > 0)));
  const inClause = personIds.join(',');

  t0 = Date.now();
  const cleanTQuery = `
    SELECT 
        c.person_id, 
        c.id as contact_id, 
        c.lead_id,
        COALESCE(NULLIF(c.owner_id, 0), NULLIF(c.not_lead_proposed_by, 0), 0) as id, 
        COALESCE(NULLIF(cons.name, ''), NULLIF(u.full_name, ''), NULLIF(consNL.name, ''), NULLIF(uNL.full_name, ''), 'Tư vấn viên') as name, 
        COALESCE(cons.avatar, u.avatar_url, consNL.avatar, uNL.avatar_url) as avatar, 
        COALESCE(cons.phone, u.phone, consNL.phone, uNL.phone) as consultant_phone,
        COALESCE(tm.name, tmNL.name) as team_name, 
        COALESCE(dr.round_name, '') as round_name,
        c.pipeline_status, 
        c.status as contact_status, 
        c.lead_phan_loai, 
        c.source, 
        c.created_at as claimed_at,
        c.updated_at
    FROM contacts c
    LEFT JOIN users u ON (c.owner_id = u.id AND c.owner_id > 0)
    LEFT JOIN consultants cons ON (cons.id = c.owner_id OR (c.owner_id > 0 AND (u.email = cons.email OR u.id = cons.id)))
    LEFT JOIN teams tm ON (cons.team_id = tm.id OR u.team_id = tm.id)
    LEFT JOIN users uNL ON (c.not_lead_proposed_by = uNL.id AND c.not_lead_proposed_by > 0)
    LEFT JOIN consultants consNL ON (consNL.id = c.not_lead_proposed_by OR (c.not_lead_proposed_by > 0 AND (uNL.email = consNL.email OR uNL.id = consNL.id)))
    LEFT JOIN teams tmNL ON (consNL.team_id = tmNL.id OR uNL.team_id = tmNL.id)
    LEFT JOIN leads ld ON c.lead_id = ld.id
    LEFT JOIN distribution_rounds dr ON ld.target_round_id = dr.id
    WHERE c.person_id IN (${inClause}) AND (c.deleted_at IS NULL OR c.pipeline_status = 'not_lead')
    ORDER BY c.created_at DESC
  `;
  const tRes = await query(cleanTQuery);
  console.log('2. Clean $tQuery time:', Date.now() - t0, 'ms', 'Rows:', tRes.count);
}

testCleanedTakers();
