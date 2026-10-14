const { query } = require('./query.cjs');

async function checkEmptyTakers() {
  const sqlIds = `
    SELECT dl.id, p.id as person_id
    FROM distribution_logs dl
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        WHERE 1=1
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    LEFT JOIN leads l ON dl.lead_id = l.id
    LEFT JOIN persons p ON l.person_id = p.id
    WHERE 1=1
    ORDER BY COALESCE(l.created_at, dl.received_at) DESC, l.id DESC 
    LIMIT 50
  `;
  const resIds = await query(sqlIds);
  const personIds = resIds.data.map(r => r.person_id).filter(id => id > 0);
  const inClause = personIds.join(',');

  const tQuery = `
    SELECT c.person_id
    FROM contacts c
    WHERE c.person_id IN (${inClause}) AND (c.deleted_at IS NULL OR c.pipeline_status = 'not_lead')
  `;
  const tRes = await query(tQuery);
  const foundPids = new Set(tRes.data.map(r => r.person_id));

  const missing = personIds.filter(pid => !foundPids.has(pid));
  console.log('Total personIds in page 1:', personIds.length);
  console.log('Missing contacts (triggers histQuery in loop):', missing.length);
}

checkEmptyTakers();
