const { query } = require('./query.cjs');
async function f() {
  const cPhanLoai = await query(`
    SELECT lead_phan_loai, COUNT(*) as count 
    FROM contacts 
    WHERE deleted_at IS NULL 
    GROUP BY lead_phan_loai 
    ORDER BY count DESC;
  `);
  console.log('contacts.lead_phan_loai breakdown:', cPhanLoai.data);

  const lPhanLoai = await query(`
    SELECT lead_phan_loai, COUNT(*) as count 
    FROM leads 
    GROUP BY lead_phan_loai 
    ORDER BY count DESC;
  `);
  console.log('leads.lead_phan_loai breakdown:', lPhanLoai.data);

  const legacyKHTN = await query(`
    SELECT COUNT(*) as count_with_legacy_khtn_id
    FROM contacts
    WHERE legacy_khtn_id IS NOT NULL AND legacy_khtn_id != '';
  `);
  console.log('contacts with legacy_khtn_id:', legacyKHTN.data);
}
f().catch(console.error);
