const { query } = require('./query.cjs');

async function benchmark() {
  console.log('1. Benchmarking get_public_leads full query without LIMIT...');
  const t0 = Date.now();
  const res = await query(`
    SELECT p.id, p.full_name, p.phone, p.email, p.released_to_kho_at, p.deleted_from_databank, p.is_blocked,
           COALESCE(
               (SELECT project_id FROM contacts WHERE person_id = p.id AND project_id IS NOT NULL LIMIT 1),
               (SELECT project_id FROM leads WHERE (person_id = p.id OR phone = p.phone) AND project_id IS NOT NULL ORDER BY id DESC LIMIT 1)
           ) as project_id,
           COALESCE(
               (SELECT name FROM projects WHERE id = (SELECT project_id FROM contacts WHERE person_id = p.id AND project_id IS NOT NULL LIMIT 1)),
               (SELECT name FROM projects WHERE id = (SELECT project_id FROM leads WHERE (person_id = p.id OR phone = p.phone) AND project_id IS NOT NULL ORDER BY id DESC LIMIT 1))
           ) as project_name,
           COALESCE(
               (SELECT source FROM contacts WHERE person_id = p.id AND source IS NOT NULL AND source != '' AND source != 'databank' LIMIT 1),
               (SELECT source FROM leads WHERE (person_id = p.id OR phone = p.phone) AND source IS NOT NULL AND source != '' AND source != 'databank' ORDER BY id DESC LIMIT 1),
               'databank'
           ) as original_source,
           (SELECT type FROM leads WHERE (person_id = p.id OR phone = p.phone) AND type IS NOT NULL AND type != '' ORDER BY id DESC LIMIT 1) as customer_type,
           (SELECT lead_phan_loai FROM leads WHERE (person_id = p.id OR phone = p.phone) AND lead_phan_loai IS NOT NULL AND lead_phan_loai != '' ORDER BY id DESC LIMIT 1) as lead_phan_loai,
           (SELECT facebook_link FROM leads WHERE (person_id = p.id OR phone = p.phone) AND facebook_link IS NOT NULL AND facebook_link != '' ORDER BY id DESC LIMIT 1) as facebook_link,
           (SELECT link_video_ads FROM leads WHERE (person_id = p.id OR phone = p.phone) AND link_video_ads IS NOT NULL AND link_video_ads != '' ORDER BY id DESC LIMIT 1) as link_video_ads,
           (SELECT note FROM leads WHERE (person_id = p.id OR phone = p.phone) AND note IS NOT NULL AND note != '' ORDER BY id DESC LIMIT 1) as note,
           EXISTS (
               SELECT 1 FROM contacts 
               WHERE person_id = p.id 
                 AND pipeline_status = (SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1) 
                 AND deleted_at IS NULL
           ) as is_won
    FROM persons p
    WHERE p.released_to_kho_at IS NOT NULL
      AND p.deleted_from_databank = 0
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
    ORDER BY p.released_to_kho_at DESC;
  `);
  console.log(`Execution time: ${Date.now() - t0} ms`);
  console.log('Result count:', res.data?.length, 'error:', res.error);
}

benchmark();
