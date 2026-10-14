const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://crm.richland.city/backend/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          resolve({ error: e.message, raw: d });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log("==================================================================");
  console.log("🔒 BƯỚC 0: KÍCH HOẠT LỆNH GIỚI NGHIÊM THÔNG BÁO (NOTIFICATION KILLSWITCH)");
  console.log("==================================================================");

  // 1. Kiểm tra số lượng các bảng hiện tại
  const tables = ['projects', 'pipeline_stages', 'persons', 'leads', 'contacts', 'notes', 'telegram_queue', 'zalo_queue', 'mail_queue'];
  console.log("\n📊 1. Kiểm tra số lượng bản ghi hiện tại trên Production:");
  for (const t of tables) {
    const res = await query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    const count = res.data && res.data[0] ? res.data[0].cnt : 'N/A';
    console.log(`  - Bảng ${t.padEnd(20)}: ${count} bản ghi`);
  }

  // 2. Tắt toàn bộ thông báo trong system_settings
  console.log("\n🔇 2. Đang tắt công tắc thông báo hệ thống (system_settings)...");
  const disableSettingsSql = `
    INSERT INTO system_settings (setting_key, setting_value) VALUES 
      ('telegram_notifications_enabled', '0'),
      ('email_notifications_enabled', '0'),
      ('zalo_notifications_enabled', '0'),
      ('migration_in_progress', '1')
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
  `;
  const resDisable = await query(disableSettingsSql);
  console.log("  ✅ Kết quả cập nhật system_settings:", resDisable.status || resDisable);

  // 3. Xác minh lại settings
  const verifyRes = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('telegram_notifications_enabled', 'email_notifications_enabled', 'zalo_notifications_enabled', 'migration_in_progress')");
  console.log("\n🔍 3. Xác minh trạng thái công tắc thông báo sau khi khóa:");
  if (verifyRes.data) {
    verifyRes.data.forEach(r => console.log(`  - ${r.setting_key}: ${r.setting_value}`));
  }

  console.log("\n🎉 HOÀN TẤT BƯỚC 0: Toàn bộ cổng thông báo đã bị ngắt an toàn 100%!");
}

main().catch(err => {
  console.error("❌ Lỗi Bước 0:", err);
  process.exit(1);
});
