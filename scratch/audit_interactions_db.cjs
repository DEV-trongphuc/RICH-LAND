const { query } = require('./query.cjs');

async function main() {
  console.log("=== KIỂM TOÁN TƯƠNG TÁC GẦN NHẤT & LỊCH SỬ TƯƠNG TÁC TRONG CSDL ===");

  // 1. Kiểm tra bảng notes
  const notesStats = await query(`
    SELECT 
      count(*) as total_notes,
      count(DISTINCT entity_id) as contacts_with_notes,
      min(created_at) as earliest_note,
      max(created_at) as latest_note
    FROM notes 
    WHERE entity_type = 'contact'
  `);
  console.log("\n1. Bảng NOTES:", notesStats.data);

  // 2. Kiểm tra bảng activities
  const actStats = await query(`
    SELECT 
      count(*) as total_activities,
      count(DISTINCT related_id) as contacts_with_activities,
      min(created_at) as earliest_activity,
      max(created_at) as latest_activity
    FROM activities
    WHERE related_type = 'contact' AND deleted_at IS NULL
  `);
  console.log("\n2. Bảng ACTIVITIES:", actStats.data);

  // 3. Kiểm tra contacts.last_contact và contacts.updated_at
  const contactStats = await query(`
    SELECT 
      count(*) as total_contacts,
      count(last_contact) as with_last_contact,
      sum(CASE WHEN updated_at >= NOW() - INTERVAL 1 HOUR THEN 1 ELSE 0 END) as updated_last_1h,
      sum(CASE WHEN updated_at >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) as updated_last_1d,
      min(last_contact) as min_last_contact,
      max(last_contact) as max_last_contact,
      min(updated_at) as min_updated_at,
      max(updated_at) as max_updated_at
    FROM contacts
  `);
  console.log("\n3. Bảng CONTACTS (last_contact vs updated_at):", contactStats.data);

  // 4. Mẫu 5 contacts có notes gần đây nhất
  const sampleLatestNotes = await query(`
    SELECT 
      c.id, c.first_name, c.last_name, c.phone, c.last_contact, c.updated_at, c.created_at,
      max_note.latest_note_time, max_note.latest_note_body
    FROM contacts c
    JOIN (
      SELECT n1.entity_id, n1.created_at as latest_note_time, n1.body as latest_note_body
      FROM notes n1
      INNER JOIN (
        SELECT entity_id, MAX(id) as max_id
        FROM notes
        WHERE entity_type = 'contact'
        GROUP BY entity_id
      ) n2 ON n1.id = n2.max_id
    ) max_note ON c.id = max_note.entity_id
    ORDER BY max_note.latest_note_time DESC
    LIMIT 5;
  `);
  console.log("\n4. Top 5 contacts có notes gần đây nhất từ AppSheet/CRM:", JSON.stringify(sampleLatestNotes.data, null, 2));

  // 5. Kiểm tra leads.last_interaction_date
  const leadStats = await query(`
    SELECT 
      count(*) as total_leads,
      count(last_interaction_date) as with_last_interaction,
      sum(CASE WHEN last_interaction_date >= NOW() - INTERVAL 1 HOUR THEN 1 ELSE 0 END) as interaction_last_1h,
      min(last_interaction_date) as min_interaction,
      max(last_interaction_date) as max_interaction
    FROM leads
  `);
  console.log("\n5. Bảng LEADS (last_interaction_date):", leadStats.data);
}

main().catch(console.error);
