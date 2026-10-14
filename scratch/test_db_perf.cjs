const { query } = require('./query.cjs');

async function test() {
  const blockCond = `
    AND p.is_blocked = 0 
    AND NOT EXISTS (
        SELECT 1 FROM persons p2 
        WHERE p2.is_blocked = 1 
          AND (p2.phone = p.phone OR (p2.email = p.email AND p.email IS NOT NULL AND p.email != ''))
    )
    AND NOT EXISTS (
        SELECT 1 FROM blocked_leads bl 
        WHERE bl.phone = p.phone OR (bl.email = p.email AND p.email IS NOT NULL AND p.email != '')
    )
    AND NOT EXISTS (
        SELECT 1 FROM data_reports dr 
        WHERE dr.lead_id IN (SELECT id FROM leads WHERE person_id = p.id) 
          AND dr.status IN ('approved', 'approved_no_comp')
    )
  `;

  console.log('--- Testing Databank query WITH blockCond (ALL rows) ---');
  let t0 = Date.now();
  let sql = `
    SELECT p.id, p.full_name, p.phone, p.email, p.released_to_kho_at, p.deleted_from_databank, p.is_blocked,
           COALESCE(
               (SELECT project_id FROM contacts WHERE person_id = p.id AND project_id IS NOT NULL LIMIT 1),
               (SELECT project_id FROM leads WHERE person_id = p.id AND project_id IS NOT NULL ORDER BY id DESC LIMIT 1)
           ) as project_id,
           (SELECT type FROM leads WHERE person_id = p.id AND type IS NOT NULL AND type != '' ORDER BY id DESC LIMIT 1) as customer_type,
           (SELECT lead_phan_loai FROM leads WHERE person_id = p.id AND lead_phan_loai IS NOT NULL AND lead_phan_loai != '' ORDER BY id DESC LIMIT 1) as lead_phan_loai,
           (SELECT facebook_link FROM leads WHERE person_id = p.id AND facebook_link IS NOT NULL AND facebook_link != '' ORDER BY id DESC LIMIT 1) as facebook_link,
           (SELECT link_video_ads FROM leads WHERE person_id = p.id AND link_video_ads IS NOT NULL AND link_video_ads != '' ORDER BY id DESC LIMIT 1) as link_video_ads,
           (SELECT note FROM leads WHERE person_id = p.id AND note IS NOT NULL AND note != '' ORDER BY id DESC LIMIT 1) as note
    FROM persons p
    WHERE p.released_to_kho_at IS NOT NULL
      ${blockCond}
    ORDER BY p.released_to_kho_at DESC
  `;
  let res = await query(sql);
  console.log('Result count:', res.count, 'Time:', Date.now() - t0, 'ms');
}

test();
