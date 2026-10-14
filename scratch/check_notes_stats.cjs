const { query } = require('./query.cjs');

async function checkNotesTable() {
  const notesSample = await query(`
    SELECT id, entity_type, entity_id, user_id, LEFT(body, 120) as body_preview, channel, note_type, created_at, legacy_cskh_id
    FROM notes
    ORDER BY id DESC
    LIMIT 5;
  `);
  console.log('Sample notes trong CRM:', notesSample.data);

  const notesStats = await query(`
    SELECT 
      COUNT(*) as total_notes,
      COUNT(DISTINCT entity_id) as distinct_entities,
      SUM(CASE WHEN entity_type = 'contact' THEN 1 ELSE 0 END) as contact_notes,
      SUM(CASE WHEN entity_type = 'lead' THEN 1 ELSE 0 END) as lead_notes,
      SUM(CASE WHEN legacy_cskh_id IS NOT NULL AND legacy_cskh_id != '' THEN 1 ELSE 0 END) as imported_cskh_notes,
      SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) as matched_contacts,
      SUM(CASE WHEN c.id IS NULL AND n.entity_type = 'contact' THEN 1 ELSE 0 END) as orphan_contact_notes
    FROM notes n
    LEFT JOIN contacts c ON n.entity_id = c.id AND n.entity_type = 'contact';
  `);
  console.log('\nThống kê bảng notes:', notesStats.data[0]);

  // Check how many unique legacy_cskh_id are in notes
  const cskhInNotes = await query(`
    SELECT COUNT(DISTINCT legacy_cskh_id) as distinct_legacy_cskh
    FROM notes
    WHERE legacy_cskh_id IS NOT NULL AND legacy_cskh_id != '';
  `);
  console.log('Distinct legacy_cskh_id in notes:', cskhInNotes.data[0]);
}

checkNotesTable().catch(console.error);
