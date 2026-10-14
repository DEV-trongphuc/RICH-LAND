const { query } = require('./query.cjs');

async function benchmark() {
  const leadPipelineExpr = `
    CASE 
        WHEN p.is_blocked = 1 OR l.status = 'not_lead' OR dl.status = 'not_lead' OR EXISTS (SELECT 1 FROM contacts cnl WHERE cnl.person_id = l.person_id AND cnl.pipeline_status = 'not_lead') THEN 'not_lead'
        WHEN EXISTS (SELECT 1 FROM contacts c WHERE c.person_id = l.person_id AND c.pipeline_status = 'dong_deal' AND c.deleted_at IS NULL) THEN 'dong_deal'
        WHEN EXISTS (SELECT 1 FROM contacts c WHERE c.person_id = l.person_id AND c.pipeline_status = 'dat_coc' AND c.deleted_at IS NULL) THEN 'dat_coc'
        WHEN EXISTS (SELECT 1 FROM contacts c WHERE c.person_id = l.person_id AND c.pipeline_status = 'booking' AND c.deleted_at IS NULL) THEN 'booking'
        WHEN EXISTS (SELECT 1 FROM contacts c WHERE c.person_id = l.person_id AND c.pipeline_status = 'da_gap' AND c.deleted_at IS NULL) THEN 'da_gap'
        WHEN EXISTS (SELECT 1 FROM contacts c WHERE c.person_id = l.person_id AND c.pipeline_status IN ('dong_y_gap', 'thien_chi') AND c.deleted_at IS NULL) THEN 'thien_chi'
        WHEN EXISTS (SELECT 1 FROM contacts c WHERE c.person_id = l.person_id AND c.pipeline_status = 'quan_tam' AND c.deleted_at IS NULL) THEN 'quan_tam'
        WHEN EXISTS (SELECT 1 FROM contacts c WHERE c.person_id = l.person_id AND c.pipeline_status = 'cham_soc_dai_han' AND c.deleted_at IS NULL) THEN 'cham_soc_dai_han'
        ELSE 'chua_xac_dinh'
    END
  `;

  console.log('--- 1. Testing countRes ---');
  let t0 = Date.now();
  let sql1 = `
    SELECT COUNT(*) as cnt 
    FROM distribution_logs dl 
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        WHERE 1=1
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    WHERE 1=1
  `;
  let r1 = await query(sql1);
  console.log('countRes:', r1.data?.[0]?.cnt, 'Time:', Date.now() - t0, 'ms');

  console.log('--- 2. Testing statusCounts query ---');
  t0 = Date.now();
  let sql2 = `
    SELECT dl.status, COUNT(*) as cnt 
    FROM distribution_logs dl 
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        WHERE 1=1
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    WHERE 1=1
    GROUP BY dl.status
  `;
  let r2 = await query(sql2);
  console.log('statusCounts rows:', r2.count, 'Time:', Date.now() - t0, 'ms');

  console.log('--- 3. Testing pipeCountRes (leadPipelineExpr aggregation) ---');
  t0 = Date.now();
  let sql3 = `
    SELECT (${leadPipelineExpr}) as p_status, COUNT(*) as cnt
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
    GROUP BY p_status
  `;
  let r3 = await query(sql3);
  console.log('pipeCountRes rows:', r3.count, 'Time:', Date.now() - t0, 'ms');

  console.log('--- 4. Testing main data query (LIMIT 50) ---');
  t0 = Date.now();
  let sql4 = `
    SELECT 
        dl.id, 
        dl.lead_id,
        l.name as lead_name, 
        l.phone, 
        l.email, 
        l.source, 
        dl.status, 
        COALESCE(l.created_at, dl.received_at) as created_at
    FROM distribution_logs dl
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        WHERE 1=1
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    LEFT JOIN leads l ON dl.lead_id = l.id
    WHERE 1=1
    ORDER BY COALESCE(l.created_at, dl.received_at) DESC, l.id DESC 
    LIMIT 50
  `;
  let r4 = await query(sql4);
  console.log('main query rows:', r4.count, 'Time:', Date.now() - t0, 'ms');
}

benchmark();
