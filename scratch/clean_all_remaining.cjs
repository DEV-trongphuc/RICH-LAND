const https = require('https');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const options = {
      hostname: 'crm.richland.city',
      path: '/richland/exec_db_query.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data.substring(0, 300), error: e.message });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log("1. Tạm tắt auto-sync của sheet_connections để tránh cron tự kéo data mới vào khi đang dọn...");
  await queryDb("UPDATE sheet_connections SET is_active = 0 WHERE is_active = 1");

  console.log("2. Xóa theo đúng thứ tự con trước cha sau...");
  const orderedTables = [
    'activity_comments',
    'activity_dependencies',
    'activities',
    'communication_logs',
    'note_mentions',
    'notes',
    'ticket_comments',
    'tickets',
    'deposit_milestones',
    'deposits',
    'cooperation_slips',
    'invoice_items',
    'invoices',
    'quote_items',
    'quotes',
    'purchase_order_items',
    'purchase_orders',
    'suppliers',
    'deal_stage_history',
    'deals',
    'companies',
    'expense_entities',
    'expenses',
    'distribution_logs',
    'lead_offers',
    'active_compensation_logs',
    'returned_databank_leads',
    'blocked_leads',
    'duplicate_log',
    'form_submissions',
    'sheet_sync_records',
    'contact_emails',
    'contact_phones',
    'contacts',
    'leads',
    'persons',
    'check_ins',
    'custom_field_values',
    'cloud_files',
    'inventory_logs',
    'batches',
    'data_reports',
    'login_attempts',
    'refresh_tokens',
    'ai_rag_search_cache',
    'ai_vector_cache',
    'telegram_queue',
    'mail_queue',
    'zalo_queue',
    'notifications',
    'sent_notifications',
    'task_focus_logs',
    'task_hidden_users',
    'task_muted_notifications',
    'audit_logs',
    'admin_logs',
    'quyen_truy_cap',
    'night_shift_registrations',
    'weekend_shift_registrations',
    'holiday_shift_registrations',
    'consultant_leaves'
  ];

  for (const tbl of orderedTables) {
    const res = await queryDb(`DELETE FROM \`${tbl}\`;`);
    if (res.error) {
      console.error(`Lỗi xóa bảng ${tbl}:`, res.error);
    } else if (res.affected_rows > 0) {
      console.log(`Đã xóa ${res.affected_rows} dòng từ bảng ${tbl}`);
    }
  }

  // Reset auto_increment
  for (const tbl of orderedTables) {
    await queryDb(`ALTER TABLE \`${tbl}\` AUTO_INCREMENT = 1;`);
  }

  console.log("Hoàn thành dọn dẹp!");
}

run().catch(console.error);
