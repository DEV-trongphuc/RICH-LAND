const { query } = require('./query.cjs');

async function main() {
  console.log("=== THỬ NGHIỆM ĐỒNG BỘ LAST_CONTACT TỪ BẢNG NOTES & ACTIVITIES ===");

  // 1. Kiểm tra số lượng contacts có notes mà last_contact đang NULL
  const countNeedSync = await query(`
    SELECT count(DISTINCT c.id) as cnt
    FROM contacts c
    JOIN notes n ON n.entity_type = 'contact' AND n.entity_id = c.id
    WHERE c.last_contact IS NULL;
  `);
  console.log("Số contacts có notes nhưng last_contact đang NULL:", countNeedSync.data[0].cnt);

  // 2. Mẫu 5 contacts trước khi sync
  const sampleBefore = await query(`
    SELECT c.id, c.first_name, c.last_name, c.last_contact, c.updated_at, MAX(n.created_at) as max_note_date
    FROM contacts c
    JOIN notes n ON n.entity_type = 'contact' AND n.entity_id = c.id
    WHERE c.last_contact IS NULL
    GROUP BY c.id
    LIMIT 5;
  `);
  console.log("Mẫu 5 contacts trước sync:", sampleBefore.data);
}

main().catch(console.error);
