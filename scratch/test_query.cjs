const https = require('https');

const sql = `SELECT 
    c.person_id, 
    c.id as contact_id, 
    c.lead_id,
    COALESCE(NULLIF(c.owner_id, 0), NULLIF(c.not_lead_proposed_by, 0), 0) as id, 
    COALESCE(NULLIF(cons.name, ''), NULLIF(u.full_name, ''), NULLIF(consNL.name, ''), NULLIF(uNL.full_name, ''), 'Tư vấn viên') as name, 
    COALESCE(cons.avatar, u.avatar_url, consNL.avatar, uNL.avatar_url) as avatar, 
    COALESCE(cons.phone, u.phone, consNL.phone, uNL.phone) as consultant_phone,
    c.pipeline_status,
    c.lead_phan_loai,
    c.created_at
   FROM contacts c
   LEFT JOIN users u ON (c.owner_id = u.id AND c.owner_id > 0)
   LEFT JOIN consultants cons ON (cons.id = c.owner_id OR (c.owner_id > 0 AND (u.email = cons.email OR u.id = cons.id)))
   LEFT JOIN users uNL ON (c.not_lead_proposed_by = uNL.id AND c.not_lead_proposed_by > 0)
   LEFT JOIN consultants consNL ON (consNL.id = c.not_lead_proposed_by OR (c.not_lead_proposed_by > 0 AND (uNL.email = consNL.email OR uNL.id = consNL.id)))
   WHERE c.person_id = 120 AND (c.deleted_at IS NULL OR c.pipeline_status = 'not_lead')`;

const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  },
  rejectUnauthorized: false
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Fixed query result:', data));
});
req.write(postData);
req.end();
