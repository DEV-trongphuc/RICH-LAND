const { query } = require('./query.cjs');

async function testFullGetLogs() {
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

  console.log('1. countRes:');
  let t = Date.now();
  await query(`
    SELECT COUNT(*) as cnt 
    FROM distribution_logs dl 
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        WHERE 1=1
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    WHERE 1=1
  `);
  console.log('   Time:', Date.now() - t, 'ms');

  console.log('2. statusCounts:');
  t = Date.now();
  await query(`
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
  `);
  console.log('   Time:', Date.now() - t, 'ms');

  console.log('3. overallCountRes:');
  t = Date.now();
  await query(`
    SELECT COUNT(DISTINCT dl.lead_id) as cnt 
    FROM distribution_logs dl 
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        WHERE 1=1
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    WHERE 1=1
  `);
  console.log('   Time:', Date.now() - t, 'ms');

  console.log('4. pipeCountRes:');
  t = Date.now();
  await query(`
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
  `);
  console.log('   Time:', Date.now() - t, 'ms');

  console.log('5. main query:');
  t = Date.now();
  const mainRes = await query(`
    SELECT 
        dl.id, 
        dl.lead_id,
        l.name as lead_name, 
        l.phone, 
        l.phone2,
        l.email, 
        l.source, 
        l.type,
        l.note,
        l.gender,
        l.dob,
        l.citizen_id,
        l.district,
        l.company,
        l.tax_code,
        l.budget,
        l.demand_type,
        l.property_type,
        l.bedroom_count,
        l.preferred_location,
        l.utm_campaign,
        l.utm_medium,
        l.utm_content,
        l.utm_term,
        l.platform,
        l.form_name,
        l.campaign_name,
        l.zalo_phone,
        l.facebook_link,
        l.ai_screener_status,
        l.ai_evaluation,
        l.is_accepted,
        l.accepted_at,
        l.lead_phan_loai,
        l.loai_lead,
        l.donvi_chay,
        l.ad_name,
        l.link_video_ads,
        COALESCE(proj.name, l.preferred_location) as project_name,
        dl.status, 
        c.name as assigned_to_name, 
        c.avatar as assigned_to_avatar, 
        dr.round_name, 
        dl.round_id,
        l.target_round_id,
        COALESCE(l.created_at, dl.received_at) as created_at,
        dl.received_at as received_at,
        r.status as report_status,
        r.resolved_by,
        r.resolved_at,
        p.is_public as is_public,
        p.id as person_id,
        p.is_blocked as is_blocked,
        (SELECT MAX(received_at) FROM distribution_logs WHERE lead_id = dl.lead_id AND id < dl.id) as last_activity_at
    FROM distribution_logs dl
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        WHERE 1=1
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    LEFT JOIN leads l ON dl.lead_id = l.id
    LEFT JOIN projects proj ON l.project_id = proj.id
    LEFT JOIN persons p ON l.person_id = p.id
    LEFT JOIN consultants c ON dl.assigned_to = c.id
    LEFT JOIN distribution_rounds dr ON dl.round_id = dr.id
    LEFT JOIN (
        SELECT r1.* FROM data_reports r1
        INNER JOIN (
            SELECT lead_id, consultant_id, round_id, MAX(id) as max_r_id
            FROM data_reports
            GROUP BY lead_id, consultant_id, round_id
        ) r2 ON r1.id = r2.max_r_id
    ) r ON r.lead_id = dl.lead_id AND r.consultant_id = dl.assigned_to AND r.round_id = dl.round_id
    WHERE 1=1
    ORDER BY COALESCE(l.created_at, dl.received_at) DESC, l.id DESC 
    LIMIT 50
  `);
  console.log('   Time:', Date.now() - t, 'ms');

  console.log('6. distinct donvi_chay:');
  t = Date.now();
  await query("SELECT DISTINCT donvi_chay FROM leads WHERE donvi_chay IS NOT NULL AND TRIM(donvi_chay) != '' ORDER BY donvi_chay ASC LIMIT 50");
  console.log('   Time:', Date.now() - t, 'ms');

  console.log('7. distinct lead_phan_loai:');
  t = Date.now();
  await query("SELECT DISTINCT lead_phan_loai FROM leads WHERE lead_phan_loai IS NOT NULL AND TRIM(lead_phan_loai) != '' ORDER BY lead_phan_loai ASC LIMIT 50");
  console.log('   Time:', Date.now() - t, 'ms');
}

testFullGetLogs();
