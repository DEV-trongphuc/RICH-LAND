const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    const url = 'https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const inClause = "422";
  const tQuery = `SELECT 
      c.person_id, 
      c.id as contact_id, 
      c.lead_id,
      c.owner_id,
      c.not_lead_proposed_by,
      COALESCE(NULLIF(c.owner_id, 0), NULLIF(c.not_lead_proposed_by, 0), (
          SELECT dl2.assigned_to 
          FROM distribution_logs dl2 
          WHERE (dl2.lead_id = c.lead_id OR (c.person_id > 0 AND dl2.lead_id IN (SELECT ld2.id FROM leads ld2 WHERE ld2.person_id = c.person_id))) AND dl2.assigned_to > 0
          ORDER BY dl2.id DESC LIMIT 1
      ), (
          SELECT r2.consultant_id 
          FROM data_reports r2 
          WHERE (r2.lead_id = c.lead_id OR (c.person_id > 0 AND r2.lead_id IN (SELECT ld3.id FROM leads ld3 WHERE ld3.person_id = c.person_id))) AND r2.consultant_id > 0
          ORDER BY r2.id DESC LIMIT 1
      ), 0) as id, 
      COALESCE(NULLIF(cons.name, ''), NULLIF(u.full_name, ''), NULLIF(consNL.name, ''), NULLIF(uNL.full_name, ''), (
          SELECT COALESCE(NULLIF(cons3.name, ''), NULLIF(u3.full_name, ''))
          FROM distribution_logs dl3
          LEFT JOIN users u3 ON dl3.assigned_to = u3.id
          LEFT JOIN consultants cons3 ON (cons3.id = dl3.assigned_to OR u3.email = cons3.email OR u3.id = cons3.id)
          WHERE (dl3.lead_id = c.lead_id OR (c.person_id > 0 AND dl3.lead_id IN (SELECT ld_sub.id FROM leads ld_sub WHERE ld_sub.person_id = c.person_id))) AND dl3.assigned_to > 0
          ORDER BY dl3.id DESC LIMIT 1
      ), (
          SELECT COALESCE(NULLIF(cons4.name, ''), NULLIF(u4.full_name, ''))
          FROM data_reports r4
          LEFT JOIN consultants cons4 ON cons4.id = r4.consultant_id
          LEFT JOIN users u4 ON (u4.id = r4.consultant_id OR (cons4.email IS NOT NULL AND cons4.email = u4.email))
          WHERE (r4.lead_id = c.lead_id OR (c.person_id > 0 AND r4.lead_id IN (SELECT ld_sub2.id FROM leads ld_sub2 WHERE ld_sub2.person_id = c.person_id))) AND r4.consultant_id > 0
          ORDER BY r4.id DESC LIMIT 1
      ), (
          SELECT COALESCE(NULLIF(cons5.name, ''), NULLIF(u5.full_name, ''))
          FROM leads ld5
          LEFT JOIN consultants cons5 ON cons5.id = ld5.assigned_to
          LEFT JOIN users u5 ON (u5.id = ld5.assigned_to OR (cons5.email IS NOT NULL AND cons5.email = u5.email))
          WHERE (ld5.id = c.lead_id OR (c.person_id > 0 AND ld5.person_id = c.person_id)) AND ld5.assigned_to > 0
          ORDER BY ld5.id DESC LIMIT 1
      ), 'Tư vấn viên') as name, 
      COALESCE(cons.avatar, u.avatar_url, consNL.avatar, uNL.avatar_url, (
          SELECT COALESCE(cons3.avatar, u3.avatar_url)
          FROM distribution_logs dl3
          LEFT JOIN users u3 ON dl3.assigned_to = u3.id
          LEFT JOIN consultants cons3 ON (cons3.id = dl3.assigned_to OR u3.email = cons3.email OR u3.id = cons3.id)
          WHERE (dl3.lead_id = c.lead_id OR (c.person_id > 0 AND dl3.lead_id IN (SELECT ld_sub.id FROM leads ld_sub WHERE ld_sub.person_id = c.person_id))) AND dl3.assigned_to > 0
          ORDER BY dl3.id DESC LIMIT 1
      )) as avatar
      FROM contacts c
      LEFT JOIN users u ON (c.owner_id = u.id AND c.owner_id > 0)
      LEFT JOIN consultants cons ON (cons.id = c.owner_id OR (c.owner_id > 0 AND (u.email = cons.email OR u.id = cons.id)))
      LEFT JOIN users uNL ON (c.not_lead_proposed_by = uNL.id AND c.not_lead_proposed_by > 0)
      LEFT JOIN consultants consNL ON (consNL.id = c.not_lead_proposed_by OR (c.not_lead_proposed_by > 0 AND (uNL.email = consNL.email OR uNL.id = consNL.id)))
      WHERE c.person_id IN (${inClause}) AND (c.deleted_at IS NULL OR c.pipeline_status = 'not_lead')
      ORDER BY c.created_at DESC`;

  console.log(await query(tQuery));
}

run();
