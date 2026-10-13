const params = new URLSearchParams();
params.append('key', 'richland2026');
params.append('sql', `
    SELECT 
        COALESCE(NULLIF(dl.assigned_to, 0), NULLIF(rpt.consultant_id, 0), 0) as id,
        COALESCE(NULLIF(cons.name, ''), NULLIF(u.full_name, ''), 'Tư vấn viên') as name,
        COALESCE(cons.avatar, u.avatar_url) as avatar,
        COALESCE(cons.phone, u.phone) as consultant_phone,
        tm.name as team_name,
        COALESCE(dr.round_name, (SELECT dr2.round_name FROM distribution_rounds dr2 WHERE dr2.id = rpt.round_id LIMIT 1)) as round_name,
        'not_lead' as pipeline_status,
        'not_lead' as contact_status,
        l.lead_phan_loai,
        l.source,
        COALESCE(dl.received_at, rpt.created_at, l.created_at) as claimed_at,
        COALESCE(dl.received_at, rpt.created_at, l.created_at) as updated_at
    FROM leads l
    LEFT JOIN distribution_logs dl ON (dl.lead_id = l.id AND dl.assigned_to > 0)
    LEFT JOIN data_reports rpt ON (rpt.lead_id = l.id AND rpt.consultant_id > 0)
    LEFT JOIN users u ON (dl.assigned_to = u.id OR rpt.consultant_id = u.id)
    LEFT JOIN consultants cons ON (cons.id = dl.assigned_to OR cons.id = rpt.consultant_id OR u.email = cons.email OR u.id = cons.id)
    LEFT JOIN teams tm ON (cons.team_id = tm.id OR u.team_id = tm.id)
    LEFT JOIN distribution_rounds dr ON (dl.round_id = dr.id OR rpt.round_id = dr.id)
    LIMIT 5
`);

fetch('https://crm.richland.city/backend/exec_db_query.php', {
  method: 'POST',
  body: params
}).then(r => r.json()).then(d => {
  if (d.error) {
    console.error('SQL Error:', d.error);
  } else {
    console.log('HistQuery SUCCESS! Rows returned:', d.data ? d.data.length : 0);
  }
}).catch(console.error);
