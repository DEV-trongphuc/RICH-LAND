const params = new URLSearchParams();
params.append('key', 'richland2026');
params.append('sql', `
    SELECT 
        dl.id, 
        dl.lead_id,
        l.name as lead_name, 
        COALESCE(proj.name, l.preferred_location) as project_name,
        p.id as person_id
    FROM distribution_logs dl
    INNER JOIN (
        SELECT lead_id, MAX(id) as max_id 
        FROM distribution_logs 
        GROUP BY lead_id
    ) dl_max ON dl.id = dl_max.max_id
    LEFT JOIN leads l ON dl.lead_id = l.id
    LEFT JOIN projects proj ON l.project_id = proj.id
    LEFT JOIN persons p ON l.person_id = p.id
    LIMIT 5
`);

fetch('https://crm.richland.city/backend/exec_db_query.php', {
  method: 'POST',
  body: params
}).then(r => r.json()).then(d => {
  if (d.error) {
    console.error('SQL Error:', d.error);
  } else {
    console.log('Query SUCCESS! Rows returned:', d.data ? d.data.length : 0);
  }
}).catch(console.error);
