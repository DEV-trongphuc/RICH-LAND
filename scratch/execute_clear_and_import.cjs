const https = require('https');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');

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

function cleanSalename(s) {
  if (!s) return '';
  return s.trim()
    .replace(/\.tamkhoa$/i, '')
    .replace(/\/nghilam$/i, '')
    .replace(/\.xoá$/i, '')
    .replace(/\/dakhoa$/i, '')
    .replace(/\.dakhoa$/i, '')
    .replace(/tamkhoa$/i, '')
    .trim();
}

async function main() {
  console.log("=== BẮT ĐẦU QUY TRÌNH DỌN DẸP DATABASE & IMPORT USERS ===");

  // 1. Kiểm tra các bảng cần bảo toàn
  const checkSettings = await queryDb("SELECT count(*) as cnt FROM system_settings");
  const checkProjects = await queryDb("SELECT count(*) as cnt FROM projects");
  const checkCampaigns = await queryDb("SELECT count(*) as cnt FROM marketing_campaigns");
  console.log(`[BẢO TOÀN] system_settings: ${checkSettings.data?.[0]?.cnt}, projects: ${checkProjects.data?.[0]?.cnt}, marketing_campaigns: ${checkCampaigns.data?.[0]?.cnt}`);

  // 2. Danh sách các bảng giao dịch cần truncate
  const tablesToTruncate = [
    'accounts', 'active_compensation_logs', 'activities', 'activity_comments', 'activity_dependencies',
    'admin_logs', 'ai_rag_search_cache', 'ai_vector_cache', 'audit_logs', 'batches',
    'blocked_leads', 'capi_logs', 'check_ins', 'cloud_files', 'comments',
    'communication_logs', 'companies', 'consultant_leaves', 'contact_emails', 'contact_phones',
    'contacts', 'cooperation_slips', 'custom_field_values', 'data_reports', 'deal_stage_history',
    'deals', 'deposit_milestones', 'deposits', 'distribution_logs', 'duplicate_log',
    'email_otps', 'entity_tags', 'expense_entities', 'expenses', 'files',
    'form_submissions', 'holiday_shift_registrations', 'import_jobs', 'inventory_logs', 'invoice_items',
    'invoices', 'lead_offers', 'leads', 'login_attempts', 'mail_queue',
    'night_shift_registrations', 'note_mentions', 'notes', 'notifications', 'persons',
    'purchase_order_items', 'purchase_orders', 'quote_items', 'quotes', 'quyen_truy_cap',
    'refresh_tokens', 'returned_databank_leads', 'round_consultants', 'segments', 'sent_notifications',
    'sheet_sync_records', 'suppliers', 'sync_queue', 'task_focus_logs', 'task_hidden_users',
    'task_muted_notifications', 'telegram_queue', 'ticket_comments', 'tickets', 'user_notification_settings',
    'weekend_shift_registrations', 'zalo_queue', 'project_roster'
  ];

  console.log(`\n--- Đang Truncate ${tablesToTruncate.length} bảng dữ liệu giao dịch... ---`);
  await queryDb("SET FOREIGN_KEY_CHECKS = 0;");
  for (const tbl of tablesToTruncate) {
    const res = await queryDb(`TRUNCATE TABLE \`${tbl}\`;`);
    if (res.error) {
      console.error(`Lỗi truncate ${tbl}:`, res.error);
    }
  }
  await queryDb("SET FOREIGN_KEY_CHECKS = 1;");
  console.log("Truncate hoàn tất!");

  // Reset vòng chia data
  await queryDb("UPDATE distribution_rounds SET last_assigned_consultant_id = NULL;");

  // 3. Xử lý người dùng
  console.log("\n--- Đang xử lý bảng users... ---");
  // Xóa user không thuộc Excel và không phải Admin MTP (1003)
  const deleteOldRes = await queryDb("DELETE FROM users WHERE id NOT IN (1003, 100072, 100073, 100074, 100075, 100076);");
  console.log(`Đã dọn các user thừa: affected rows = ${deleteOldRes.affected_rows}`);

  // Đọc file Excel
  const excelPath = "D:\\Downloads\\Untitled spreadsheet (3).xlsx";
  const wb = xlsx.readFile(excelPath);
  const excelRows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`Đọc được ${excelRows.length} dòng từ file Excel.`);

  const defaultPasswordHash = bcrypt.hashSync("RLVN@123456", 10);

  const existingEmails = new Set(['turniodev@gmail.com', 'ngochuyen@richland.city', 'baduong@richland.city', 'ngochien@richland.city', 'khacphu@richland.city', 'conghoa@richland.city']);
  const existingUsernames = new Set(['admin', 'ngochuyen', 'baduong', 'ngochien', 'khacphu', 'conghoa']);

  let insertedCount = 0;
  let skippedCount = 0;

  for (let idx = 0; idx < excelRows.length; idx++) {
    const r = excelRows[idx];
    const rawSalename = (r.Salename || '').trim();
    const cleanedSalename = cleanSalename(rawSalename);
    let email = (r.email || '').trim().toLowerCase();
    
    // Shared emails in Excel
    const isSharedEmail = ['phongkinhdoanh.as001@gmail.com', 'phongkinhdoanh.as002@gmail.com', 'hethong@richland.city'].includes(email);
    
    let finalEmail = email;
    if (!finalEmail || isSharedEmail) {
      if (cleanedSalename.includes('@')) {
        finalEmail = cleanedSalename.toLowerCase();
      } else if (cleanedSalename) {
        finalEmail = `${cleanedSalename.toLowerCase()}@richland.city`;
      }
    }

    let username = '';
    if (cleanedSalename.includes('@')) {
      username = cleanedSalename.split('@')[0].toLowerCase();
    } else {
      username = cleanedSalename.toLowerCase();
    }

    // Nếu là admin hoặc đã tồn tại trong DB -> Bỏ qua không tạo mới
    if (r.id === 'ADMIN1' || cleanedSalename === 'admin' || existingEmails.has(finalEmail) || existingUsernames.has(username)) {
      console.log(`[ĐÃ CÓ] Bỏ qua user: ${r.ho_ten} (${username} - ${finalEmail})`);
      skippedCount++;
      continue;
    }

    const fullName = (r.ho_ten || '').trim();
    const role = (r.phan_quyen === 'Admin') ? 'admin' : 'sales';
    const status = (r.trang_thai_lam_viec === 'Đã Nghỉ') ? 'inactive' : 'active';
    const isActive = (status === 'active') ? 1 : 0;
    const jobTitle = r.phong_ban || ((role === 'admin') ? 'Quản trị viên' : 'Chuyên viên tư vấn');

    // Chèn user mới
    const sql = `
      INSERT INTO users (
        tenant_id, team_id, username, email, password_hash, full_name,
        role, status, is_active, job_title, created_at, updated_at
      ) VALUES (
        1, 1, '${username.replace(/'/g, "''")}', '${finalEmail.replace(/'/g, "''")}',
        '${defaultPasswordHash}', '${fullName.replace(/'/g, "''")}',
        '${role}', '${status}', ${isActive}, '${jobTitle.replace(/'/g, "''")}',
        NOW(), NOW()
      );
    `;

    const insRes = await queryDb(sql);
    if (insRes.error) {
      console.error(`Lỗi insert user [${fullName}]:`, insRes.error);
    } else {
      insertedCount++;
      existingEmails.add(finalEmail);
      existingUsernames.add(username);
    }
  }

  console.log(`\nImport kết thúc: Đã thêm mới ${insertedCount} users, bỏ qua ${skippedCount} users đã có.`);

  // 4. Đồng bộ round_consultants cho các Sale đang hoạt động
  console.log("\n--- Đồng bộ round_consultants... ---");
  const activeSales = await queryDb("SELECT id FROM users WHERE status = 'active' AND role = 'sales'");
  const rounds = await queryDb("SELECT id FROM distribution_rounds WHERE is_active = 1");
  
  if (activeSales.data && rounds.data) {
    let rcCount = 0;
    for (const r of rounds.data) {
      for (const s of activeSales.data) {
        await queryDb(`
          INSERT INTO round_consultants (round_id, consultant_id, is_active, receive_ratio, skip_count, compensation_count, data_per_turn, current_turn_remaining)
          VALUES (${r.id}, ${s.id}, 1, 1, 0, 0, 1, 0)
          ON DUPLICATE KEY UPDATE is_active = 1;
        `);
        rcCount++;
      }
    }
    console.log(`Đã đồng bộ ${rcCount} cấu hình vòng chia cho ${activeSales.data.length} sales vào ${rounds.data.length} rounds.`);
  }

  // 5. Đối soát kết quả
  console.log("\n=== ĐỐI SOÁT CUỐI CÙNG ===");
  const totalUsers = await queryDb("SELECT count(*) as cnt FROM users");
  const totalLeads = await queryDb("SELECT count(*) as cnt FROM leads");
  const totalDeals = await queryDb("SELECT count(*) as cnt FROM deals");
  const totalActivities = await queryDb("SELECT count(*) as cnt FROM activities");
  const totalNotifs = await queryDb("SELECT count(*) as cnt FROM notifications");
  const totalSettings = await queryDb("SELECT count(*) as cnt FROM system_settings");
  const totalProjects = await queryDb("SELECT count(*) as cnt FROM projects");
  const totalCampaigns = await queryDb("SELECT count(*) as cnt FROM marketing_campaigns");

  console.log(`Users tổng cộng     : ${totalUsers.data?.[0]?.cnt}`);
  console.log(`Leads               : ${totalLeads.data?.[0]?.cnt} (yêu cầu = 0)`);
  console.log(`Deals               : ${totalDeals.data?.[0]?.cnt} (yêu cầu = 0)`);
  console.log(`Activities          : ${totalActivities.data?.[0]?.cnt} (yêu cầu = 0)`);
  console.log(`Notifications       : ${totalNotifs.data?.[0]?.cnt} (yêu cầu = 0)`);
  console.log(`system_settings     : ${totalSettings.data?.[0]?.cnt} (giữ nguyên)`);
  console.log(`projects            : ${totalProjects.data?.[0]?.cnt} (giữ nguyên)`);
  console.log(`marketing_campaigns : ${totalCampaigns.data?.[0]?.cnt} (giữ nguyên)`);
}

if (process.argv.includes('--run')) {
  main().catch(console.error);
} else {
  console.log("Dry-run mode. Chạy với tham số --run để thực thi thật.");
}
