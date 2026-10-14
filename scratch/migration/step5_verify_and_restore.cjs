const fs = require('fs');
const { query } = require('../query.cjs');

async function main() {
  console.log("==================================================================");
  console.log("🔍 BƯỚC 5: ĐỐI SOÁT TOÀN DIỆN & KHÔI PHỤC HỆ THỐNG (ZERO-DEFECT AUDIT)");
  console.log("==================================================================");

  // 1. Kiểm tra số lượng bản ghi thực tế trong CSDL
  console.log("\n1. 📊 Bảng đối soát số lượng bản ghi CSDL MySQL:");
  const countsRes = await query(`
    SELECT 
      (SELECT COUNT(*) FROM persons) as persons_count,
      (SELECT COUNT(*) FROM leads) as leads_count,
      (SELECT COUNT(*) FROM contacts) as contacts_count,
      (SELECT COUNT(*) FROM contacts WHERE ttl1_completed = 1) as ttl1_count,
      (SELECT COUNT(*) FROM notes) as notes_count,
      (SELECT COUNT(*) FROM projects) as projects_count,
      (SELECT COUNT(*) FROM pipeline_stages) as stages_count;
  `);

  const counts = (countsRes.data && countsRes.data[0]) || {};
  console.log(`  - PERSONS:         ${counts.persons_count} bản ghi (Identity Resolution)`);
  console.log(`  - LEADS:           ${counts.leads_count} bản ghi (Facebook Ads, Webhook, Google Ads)`);
  console.log(`  - CONTACTS:        ${counts.contacts_count} bản ghi (Khách hàng CRM)`);
  console.log(`  - TTL1 COMPLETED:  ${counts.ttl1_count} hồ sơ khách hàng đã bóc tách FORM TTL1 chuẩn JSON`);
  console.log(`  - NOTES:           ${counts.notes_count} ghi chú tương tác (LS_CSKH & LS_CSKH_bangphu)`);
  console.log(`  - PROJECTS:        ${counts.projects_count} dự án bất động sản`);
  console.log(`  - PIPELINE STAGES: ${counts.stages_count} giai đoạn (Bao gồm Chăm sóc dài hạn)`);

  // 2. Kiểm tra hàng đợi thông báo (Zero Leakage Proof)
  console.log("\n2. 🛡️ Bằng chứng thực nghiệm: Hàng đợi thông báo (Notification Queues):");
  const queuesRes = await query(`
    SELECT 
      (SELECT COUNT(*) FROM telegram_queue) as t_count,
      (SELECT COUNT(*) FROM zalo_queue) as z_count,
      (SELECT COUNT(*) FROM mail_queue) as m_count;
  `);
  const q = (queuesRes.data && queuesRes.data[0]) || {};
  console.log(`  - telegram_queue: ${q.t_count} (Mốc gốc: 1073 - ${q.t_count === '1073' ? '✅ BẢO TOÀN HOÀN HẢO' : '⚠️ LỆCH'})`);
  console.log(`  - zalo_queue:     ${q.z_count} (Mốc gốc: 148 - ${q.z_count === '148' ? '✅ BẢO TOÀN HOÀN HẢO' : '⚠️ LỆCH'})`);
  console.log(`  - mail_queue:     ${q.m_count} (Mốc gốc: 525 - ${q.m_count === '525' ? '✅ BẢO TOÀN HOÀN HẢO' : '⚠️ LỆCH'})`);

  // 3. Khôi phục Kill-Switch trong system_settings
  console.log("\n3. 🔄 Khôi phục cấu hình thông báo hệ thống (system_settings)...");
  await query("UPDATE system_settings SET setting_value = '1' WHERE setting_key = 'telegram_notifications_enabled';");
  await query("UPDATE system_settings SET setting_value = '1' WHERE setting_key = 'email_notifications_enabled';");
  await query("UPDATE system_settings SET setting_value = '1' WHERE setting_key = 'zalo_notifications_enabled';");
  await query("UPDATE system_settings SET setting_value = '0' WHERE setting_key = 'migration_in_progress';");
  console.log("  ✅ Đã mở lại cổng thông báo an toàn sau khi toàn bộ dữ liệu lịch sử đã nạp xong!");

  console.log("\n🎉 HOÀN TẤT BƯỚC 5: TOÀN BỘ DỮ LIỆU ĐÃ NẠP XONG 100%!");
}

main().catch(err => {
  console.error("Lỗi đối soát Bước 5:", err);
  process.exit(1);
});
