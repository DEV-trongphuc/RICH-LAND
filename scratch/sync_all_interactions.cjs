const { query } = require('./query.cjs');

async function main() {
  console.log("==================================================================");
  console.log("🔄 ĐỒNG BỘ CHÍNH XÁC LAST_CONTACT & LAST_INTERACTION_DATE");
  console.log("==================================================================");

  // 1. Thống kê trước khi cập nhật
  const beforeC = await query(`
    SELECT 
      count(*) as total_contacts,
      count(last_contact) as with_last_contact,
      min(last_contact) as min_last_contact,
      max(last_contact) as max_last_contact
    FROM contacts;
  `);
  console.log("\n1. Contacts trước đồng bộ:", beforeC.data[0]);

  const beforeL = await query(`
    SELECT 
      count(*) as total_leads,
      count(last_interaction_date) as with_last_interaction,
      min(last_interaction_date) as min_interaction,
      max(last_interaction_date) as max_interaction
    FROM leads;
  `);
  console.log("2. Leads trước đồng bộ:", beforeL.data[0]);

  // 2. Cập nhật contacts.last_contact từ bảng notes (bảo tồn c.updated_at)
  console.log("\n3. Đang cập nhật contacts.last_contact từ bảng NOTES (37.728 bản ghi CSKH)...");
  const updateNotesSql = `
    UPDATE contacts c
    JOIN (
      SELECT entity_id, MAX(created_at) as max_note_date
      FROM notes
      WHERE entity_type = 'contact'
      GROUP BY entity_id
    ) n ON c.id = n.entity_id
    SET 
      c.last_contact = DATE(n.max_note_date),
      c.updated_at = c.updated_at
    WHERE c.last_contact IS NULL OR c.last_contact < DATE(n.max_note_date);
  `;
  const resNotes = await query(updateNotesSql);
  console.log("  ✅ Kết quả cập nhật contacts từ notes:", resNotes);

  // 3. Cập nhật contacts.last_contact từ bảng activities (nếu có ngày mới hơn)
  console.log("\n4. Đang cập nhật contacts.last_contact từ bảng ACTIVITIES...");
  const updateActSql = `
    UPDATE contacts c
    JOIN (
      SELECT related_id, MAX(created_at) as max_act_date
      FROM activities
      WHERE related_type = 'contact' AND deleted_at IS NULL
      GROUP BY related_id
    ) a ON c.id = a.related_id
    SET 
      c.last_contact = DATE(a.max_act_date),
      c.updated_at = c.updated_at
    WHERE c.last_contact IS NULL OR c.last_contact < DATE(a.max_act_date);
  `;
  const resAct = await query(updateActSql);
  console.log("  ✅ Kết quả cập nhật contacts từ activities:", resAct);

  // 4. Cập nhật leads.last_interaction_date từ contacts / notes
  console.log("\n5. Đang cập nhật leads.last_interaction_date...");
  const updateLeadsSql = `
    UPDATE leads l
    JOIN contacts c ON (c.lead_id = l.id OR (l.person_id > 0 AND c.person_id = l.person_id))
    JOIN (
      SELECT entity_id, MAX(created_at) as max_note_date
      FROM notes
      WHERE entity_type = 'contact'
      GROUP BY entity_id
    ) n ON c.id = n.entity_id
    SET l.last_interaction_date = n.max_note_date
    WHERE l.last_interaction_date IS NULL OR l.last_interaction_date < n.max_note_date;
  `;
  const resLeads = await query(updateLeadsSql);
  console.log("  ✅ Kết quả cập nhật leads.last_interaction_date:", resLeads);

  // 5. Thống kê sau khi cập nhật
  const afterC = await query(`
    SELECT 
      count(*) as total_contacts,
      count(last_contact) as with_last_contact,
      min(last_contact) as min_last_contact,
      max(last_contact) as max_last_contact
    FROM contacts;
  `);
  console.log("\n6. Contacts SAU ĐỒNG BỘ:", afterC.data[0]);

  const afterL = await query(`
    SELECT 
      count(*) as total_leads,
      count(last_interaction_date) as with_last_interaction,
      min(last_interaction_date) as min_interaction,
      max(last_interaction_date) as max_interaction
    FROM leads;
  `);
  console.log("7. Leads SAU ĐỒNG BỘ:", afterL.data[0]);

  // 6. Kiểm tra lại mẫu 5 contacts
  const sampleAfter = await query(`
    SELECT c.id, c.first_name, c.last_name, c.last_contact, c.updated_at
    FROM contacts c
    WHERE c.id IN (4741, 4742, 4743, 4744, 4745);
  `);
  console.log("\n8. Mẫu 5 contacts sau khi cập nhật:", sampleAfter.data);
}

main().catch(console.error);
