const axios = require('axios');
async function test() {
  try {
    const sql = `SELECT 
        c.person_id, 
        c.id as contact_id, 
        c.lead_id,
        c.owner_id as id, 
        cons.name, 
        cons.avatar, 
        cons.phone as consultant_phone,
        tm.name as team_name,
        dr.round_name,
        c.pipeline_status, 
        c.status as contact_status, 
        c.lead_phan_loai, 
        c.source, 
        c.created_at as claimed_at,
        c.updated_at
       FROM contacts c
       LEFT JOIN users u ON c.owner_id = u.id
       LEFT JOIN consultants cons ON (u.email = cons.email OR u.id = cons.id)
       LEFT JOIN teams tm ON (cons.team_id = tm.id OR u.team_id = tm.id)
       LEFT JOIN leads ld ON c.lead_id = ld.id
       LEFT JOIN distribution_rounds dr ON ld.target_round_id = dr.id
       WHERE c.person_id IN (1, 2, 3, 4, 5) AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC LIMIT 5`;
    const res = await axios.post('https://crm.richland.city/backend/exec_db_query.php', new URLSearchParams({
      key: 'richland2026',
      sql: sql
    }));
    console.log('tQuery result status:', res.data.status, 'Rows:', res.data.count);
  } catch (e) {
    console.error(e.message);
  }
}
test();
