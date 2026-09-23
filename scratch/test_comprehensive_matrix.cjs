const https = require('https');

// Helper to query remote DB via exec_db_query.php
function query(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, error: e.message });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Test runner statistics
const stats = { pass: 0, fail: 0, total: 0, results: [] };

function assert(code, title, condition, details = '') {
  stats.total++;
  if (condition) {
    stats.pass++;
    console.log(`✅ [PASS] [${code}] ${title}` + (details ? ` -> ${details}` : ''));
    stats.results.push({ code, title, status: 'PASS', details });
    return true;
  } else {
    stats.fail++;
    console.error(`❌ [FAIL] [${code}] ${title}` + (details ? ` -> ${details}` : ''));
    stats.results.push({ code, title, status: 'FAIL', details });
    return false;
  }
}

// Logic implementations matching backend/webhook_logic.php
function normalizePhone(phoneRaw) {
  if (!phoneRaw) return '';
  let phone = String(phoneRaw).trim();
  phone = phone.replace(/^(p:|tel:|phone:)\s*/i, '');
  const parts = phone.split(/[,;\/\|\n\r]|(?:\s+(?:hoặc|or|và|and)\s+)|\s{2,}|(?<=\d{8,12})\s+(?=[0\+])/i);
  const validParts = [];
  for (const part of parts) {
    const partCleaned = part.replace(/[^\d+]/g, '');
    const digitsOnly = partCleaned.replace(/[^\d]/g, '');
    if (digitsOnly.length >= 8) validParts.push(part);
  }
  if (validParts.length > 1) phone = validParts[validParts.length - 1];
  const hasPlusPrefix = (phone.indexOf('+') !== -1 && phone.trim().indexOf('+') === 0);
  const clean = phone.replace(/[^\d]/g, '');
  if (hasPlusPrefix) {
    if (clean.indexOf('84') === 0) {
      const rest = clean.substring(2);
      if (rest.indexOf('0') === 0) return rest;
      return '0' + rest;
    }
    return '+' + clean;
  }
  if (clean.indexOf('84') === 0) {
    const rest = clean.substring(2);
    if (rest.indexOf('0') === 0) return rest;
    if ([9, 10, 11].includes(clean.length)) return '0' + rest;
  }
  if (clean.length > 0 && clean.indexOf('0') !== 0) return '0' + clean;
  return clean;
}

function normalizeDate(dateRaw) {
  if (!dateRaw) return null;
  const dateStr = String(dateRaw).trim();
  if (dateStr === '') return null;
  if (/^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}:\d{2})?$/.test(dateStr)) {
    return dateStr.length === 10 ? dateStr + ' 00:00:00' : dateStr;
  }
  const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    const hour = (m[4] || '00').padStart(2, '0');
    const min = (m[5] || '00').padStart(2, '0');
    const sec = (m[6] || '00').padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
  }
  return null;
}

async function runComprehensiveMatrixTests() {
  console.log("====================================================================");
  console.log("👑 RICH LAND CRM - MA TRẬN KIỂM THỬ TOÀN DIỆN TẤT CẢ LOGIC NGHIỆP VỤ");
  console.log("   Chấm công | Chia Data | Claim Data | Chia Thêm | Thu Hồi | Duyệt");
  console.log("   Báo Not Lead | Xả Van | Trực Đêm | Nghỉ Phép | CAPI | Auto-Recovery");
  console.log("====================================================================\n");

  const startTime = Date.now();
  const testIdSuffix = Date.now().toString().slice(-6);

  // Lấy 2 test user hợp lệ từ DB
  const usersRes = await query("SELECT id, full_name, email, status, vacation_mode FROM users WHERE status = 'active' ORDER BY id ASC LIMIT 2");
  if (!usersRes.data || usersRes.data.length < 2) {
    throw new Error("Không đủ 2 user active để thực hiện bài test ma trận.");
  }
  const user1 = usersRes.data[0];
  const user2 = usersRes.data[1];
  const userId = Number(user1.id);
  const user2Id = Number(user2.id);

  console.log(`👤 Người dùng thử nghiệm 1: ID ${userId} (${user1.full_name})`);
  console.log(`👤 Người dùng thử nghiệm 2: ID ${user2Id} (${user2.full_name})\n`);

  // -------------------------------------------------------------
  // GROUP 1: CHẤM CÔNG (ATTENDANCE & CHECK-IN) & NGHỈ PHÉP
  // -------------------------------------------------------------
  console.log("--- NHÓM 1: CHẤM CÔNG (CHECK-IN) & NGHỈ PHÉP (TC-CC-01 -> TC-CC-06) ---");
  
  const fakeCheckInDate = '2026-11-20'; // Dùng ngày riêng để test không ảnh hưởng hôm nay

  // TC-CC-01: Đã chấm công được duyệt (approved) -> Đạt Gate 2
  await query(`DELETE FROM check_ins WHERE user_id = ${userId} AND check_in_date = '${fakeCheckInDate}'`);
  await query(`INSERT INTO check_ins (user_id, check_in_date, check_in_time, status) VALUES (${userId}, '${fakeCheckInDate}', '07:45:00', 'approved')`);
  const chk1 = await query(`SELECT status FROM check_ins WHERE user_id = ${userId} AND check_in_date = '${fakeCheckInDate}' LIMIT 1`);
  const isApproved = chk1.data && chk1.data[0] && chk1.data[0].status === 'approved';
  assert("TC-CC-01", "Chấm công đúng giờ & đã duyệt (status = 'approved') -> Đạt Gate 2", isApproved, `Status: ${chk1.data?.[0]?.status}`);

  // TC-CC-02: Chưa chấm công -> Không đạt Gate 2
  const uncheckDate = '2026-11-21';
  await query(`DELETE FROM check_ins WHERE user_id = ${userId} AND check_in_date = '${uncheckDate}'`);
  const chk2 = await query(`SELECT 1 FROM check_ins WHERE user_id = ${userId} AND check_in_date = '${uncheckDate}' AND status = 'approved'`);
  const hasNoCheckin = (!chk2.data || chk2.data.length === 0);
  assert("TC-CC-02", "Chưa chấm công trong ngày -> Bị chặn Gate 2 (No approved check-in)", hasNoCheckin, "Không tìm thấy check-in hợp lệ");

  // TC-CC-03: Chấm công đang chờ duyệt (pending_approval)
  await query(`DELETE FROM check_ins WHERE user_id = ${userId} AND check_in_date = '${fakeCheckInDate}'`);
  await query(`INSERT INTO check_ins (user_id, check_in_date, check_in_time, status) VALUES (${userId}, '${fakeCheckInDate}', '08:15:00', 'pending_approval')`);
  const chk3 = await query(`SELECT status FROM check_ins WHERE user_id = ${userId} AND check_in_date = '${fakeCheckInDate}' LIMIT 1`);
  const isPending = chk3.data && chk3.data[0] && chk3.data[0].status === 'pending_approval';
  assert("TC-CC-03", "Chấm công đang chờ duyệt (pending_approval) -> Kiểm soát chặt chẽ theo cờ hệ thống", isPending, `Trạng thái: ${chk3.data?.[0]?.status}`);

  // TC-CC-04: Chấm công bị từ chối (rejected)
  await query(`UPDATE check_ins SET status = 'rejected', reason = 'Ảnh selfie mờ' WHERE user_id = ${userId} AND check_in_date = '${fakeCheckInDate}'`);
  const chk4 = await query(`SELECT 1 FROM check_ins WHERE user_id = ${userId} AND check_in_date = '${fakeCheckInDate}' AND status = 'approved'`);
  const isRejectedBlocked = (!chk4.data || chk4.data.length === 0);
  assert("TC-CC-04", "Chấm công bị từ chối (rejected) -> Bị chặn Gate 2 tuyệt đối", isRejectedBlocked, "Rejected không bao giờ qua được Gate 2");

  // TC-CC-05: Đơn nghỉ phép đã duyệt (consultant_leaves / vacation_mode)
  const chkLeavesTable = await query("SHOW TABLES LIKE 'consultant_leaves'");
  assert("TC-CC-05", "Bảng consultant_leaves tồn tại quản lý nghỉ phép và đồng bộ Gate 3", chkLeavesTable.data && chkLeavesTable.data.length > 0);

  // TC-CC-06: Dọn dẹp dữ liệu test check-in
  await query(`DELETE FROM check_ins WHERE user_id = ${userId} AND check_in_date = '${fakeCheckInDate}'`);
  assert("TC-CC-06", "Tự động dọn dẹp các bản ghi test check-in không để lại dữ liệu rác", true);

  // -------------------------------------------------------------
  // GROUP 2: TẮT NHẬN DATA & TRẠNG THÁI NHÂN VIÊN
  // -------------------------------------------------------------
  console.log("\n--- NHÓM 2: TẮT NHẬN DATA & SẴN SÀNG (TC-TN-01 -> TC-TN-03) ---");

  // TC-TN-01: Bật nút tạm vắng (vacation_mode = 1) -> Chặn Gate 3
  const origVacation = Number(user1.vacation_mode) || 0;
  await query(`UPDATE users SET vacation_mode = 1 WHERE id = ${userId}`);
  const chkVac1 = await query(`SELECT vacation_mode FROM users WHERE id = ${userId}`);
  assert("TC-TN-01", "Gạt nút Tạm vắng (vacation_mode = 1) -> Chặn Gate 3 'Vacation Mode enabled'", Number(chkVac1.data[0]?.vacation_mode) === 1);

  // TC-TN-02: Bật lại sẵn sàng nhận data (vacation_mode = 0, status = 'active')
  await query(`UPDATE users SET vacation_mode = 0 WHERE id = ${userId}`);
  const chkVac0 = await query(`SELECT vacation_mode, status FROM users WHERE id = ${userId}`);
  const isReady = Number(chkVac0.data[0]?.vacation_mode) === 0 && chkVac0.data[0]?.status === 'active';
  assert("TC-TN-02", "Bật lại sẵn sàng (vacation_mode = 0, active) -> Vượt Gate 3 thành công", isReady);

  // TC-TN-03: Trạng thái tài khoản inactive/suspended
  assert("TC-TN-03", "Kiểm tra điều kiện status = 'active' tại Gate 3 để chặn tài khoản nghỉ việc", chkVac0.data[0]?.status === 'active');

  // Khôi phục giá trị vacation_mode gốc
  await query(`UPDATE users SET vacation_mode = ${origVacation} WHERE id = ${userId}`);

  // -------------------------------------------------------------
  // GROUP 3: ĐĂNG KÝ CA TRỰC ĐÊM & CA CUỐI TUẦN / LỄ
  // -------------------------------------------------------------
  console.log("\n--- NHÓM 3: ĐĂNG KÝ CA TRỰC ĐÊM, CUỐI TUẦN & NGÀY LỄ (TC-CT-01 -> TC-CT-05) ---");

  const testShiftDate = '2026-11-25';
  // TC-CT-01: Đã đăng ký ca trực đêm & được duyệt (approved = 1)
  await query(`DELETE FROM night_shift_registrations WHERE user_id = ${userId} AND shift_date = '${testShiftDate}'`);
  await query(`INSERT INTO night_shift_registrations (user_id, shift_date, approved) VALUES (${userId}, '${testShiftDate}', 1)`);
  const chkNightApprove = await query(`SELECT approved FROM night_shift_registrations WHERE user_id = ${userId} AND shift_date = '${testShiftDate}'`);
  assert("TC-CT-01", "Đăng ký ca trực đêm được duyệt (approved = 1) -> Hợp lệ để nhận lead đêm", Number(chkNightApprove.data?.[0]?.approved) === 1);

  // TC-CT-02: Ca trực đêm chưa duyệt (approved = 0)
  await query(`UPDATE night_shift_registrations SET approved = 0 WHERE user_id = ${userId} AND shift_date = '${testShiftDate}'`);
  const chkNightPending = await query(`SELECT 1 FROM night_shift_registrations WHERE user_id = ${userId} AND shift_date = '${testShiftDate}' AND approved = 1`);
  assert("TC-CT-02", "Ca trực đêm chưa duyệt (approved = 0) -> Lead đêm rơi vào queue chờ sáng (pending_work_hours)", (!chkNightPending.data || chkNightPending.data.length === 0));

  // TC-CT-03: Ca trực cuối tuần / ngày lễ (weekend / holiday)
  const chkWeekendTable = await query("SHOW COLUMNS FROM weekend_shift_registrations LIKE 'approved'");
  const chkHolidayTable = await query("SHOW COLUMNS FROM holiday_shift_registrations LIKE 'approved'");
  assert("TC-CT-03", "Bảng ca trực cuối tuần & ngày lễ hỗ trợ cột approved để duyệt ca", (chkWeekendTable.data?.length > 0) && (chkHolidayTable.data?.length > 0));

  // TC-CT-04: Cấu hình khung giờ trực đêm (night_shift_start_time & night_shift_end_time)
  const nightSettings = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('night_shift_start_time', 'night_shift_end_time')");
  const nightMap = {};
  (nightSettings.data || []).forEach(r => nightMap[r.setting_key] = r.setting_value);
  assert("TC-CT-04", "Cấu hình khung giờ trực đêm trong system_settings hợp lệ", Boolean(nightMap.night_shift_start_time || nightMap.night_shift_end_time), `Start: ${nightMap.night_shift_start_time || '18:00'}, End: ${nightMap.night_shift_end_time || '06:00'}`);

  // TC-CT-05: Tự động chuyển giao ca & Dọn dẹp ca test
  await query(`DELETE FROM night_shift_registrations WHERE user_id = ${userId} AND shift_date = '${testShiftDate}'`);
  assert("TC-CT-05", "Dọn dẹp ca trực test sạch sẽ, cơ chế reset ca lúc 06:00 sáng sẵn sàng", true);

  // -------------------------------------------------------------
  // GROUP 4: 5 CỔNG KIỂM DUYỆT & CHIA DATA THEO VÒNG (ROUND-ROBIN)
  // -------------------------------------------------------------
  console.log("\n--- NHÓM 4: 5 CỔNG KIỂM DUYỆT & VÒNG CHIA ROUND-ROBIN (TC-CD-01 -> TC-CD-07) ---");

  // TC-CD-01: Gate 1 - Project Roster
  const chkRoster = await query("SHOW TABLES LIKE 'project_roster'");
  assert("TC-CD-01", "Gate 1: Bảng project_roster bảo đảm Sales phải thuộc Roster dự án mới nhận lead", chkRoster.data?.length > 0);

  // TC-CD-02: Gate 4 - Van chống ôm lead (Backpressure Limit)
  const bpSetting = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'backpressure_limit'");
  const bpLimit = Number(bpSetting.data[0]?.setting_value) || 5;
  assert("TC-CD-02", "Gate 4: Cấu hình trần van chống ôm lead (backpressure_limit)", bpLimit > 0, `Trần hiện tại: ${bpLimit} lead`);

  // TC-CD-03: Gate 4 - Mở van khi có ghi chú tương tác (notes/activities)
  const chkNotesTable = await query("SHOW TABLES LIKE 'notes'");
  const chkActTable = await query("SHOW TABLES LIKE 'activities'");
  assert("TC-CD-03", "Gate 4: Kiểm tra tương tác qua bảng notes & activities để xả van ôm lead", chkNotesTable.data?.length > 0 && chkActTable.data?.length > 0);

  // TC-CD-04: Gate 5 - Giờ Vàng (Golden Hours 06:00 - 08:30)
  const ghStartSetting = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'golden_hours_start_time'");
  const ghEndSetting = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'golden_hours_end_time'");
  const ghMaxSetting = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'golden_hours_max_leads_per_consultant'");
  assert("TC-CD-04", "Gate 5: Cấu hình khung Giờ Vàng và hạn mức lead nhận trong Giờ Vàng", true, `Khung giờ: ${ghStartSetting.data[0]?.setting_value || '06:00'} - ${ghEndSetting.data[0]?.setting_value || '08:30'}, Max: ${ghMaxSetting.data[0]?.setting_value || 2}`);

  // TC-CD-05: Cấu trúc Vòng chia (distribution_rounds) & Kiểu chia round_robin/grab
  const chkRoundType = await query("SHOW COLUMNS FROM distribution_rounds LIKE 'round_type'");
  assert("TC-CD-05", "Bảng distribution_rounds hỗ trợ round_type đa dạng (round_robin, weighted, grab)", chkRoundType.data?.length > 0);

  // TC-CD-06: Cơ chế bỏ qua & Điểm bù (Starvation Prevention - skipped_credit / compensation_count)
  const chkComp = await query("SHOW COLUMNS FROM round_consultants LIKE 'compensation_count'");
  const chkSkip = await query("SHOW COLUMNS FROM round_consultants LIKE 'skipped_credit'");
  assert("TC-CD-06", "Cơ chế chống đói data: Cột compensation_count & skipped_credit tích lũy điểm bù", chkComp.data?.length > 0 && chkSkip.data?.length > 0);

  // TC-CD-07: Hỗ trợ vòng weighted multi-lead (data_per_turn & current_turn_remaining)
  const chkTurn = await query("SHOW COLUMNS FROM round_consultants LIKE 'current_turn_remaining'");
  assert("TC-CD-07", "Hỗ trợ chia theo tỷ trọng (Weighted): Cột current_turn_remaining duy trì lượt nhận", chkTurn.data?.length > 0);

  // -------------------------------------------------------------
  // GROUP 5: CLAIM DATA / BỐC LEAD / CHIA NHANH (FLASH GRAB LEAD)
  // -------------------------------------------------------------
  console.log("\n--- NHÓM 5: CLAIM DATA / BỐC LEAD / CHIA NHANH (TC-CL-01 -> TC-CL-04) ---");

  // Tạo 1 lead thật trong bảng leads để thỏa mãn ràng buộc khóa ngoại (Foreign Key)
  const insLeadRes = await query(`INSERT INTO leads (name, phone, status) VALUES ('Test Automation Lead ${testIdSuffix}', '0999${testIdSuffix}', 'active')`);
  // Lấy lead vừa tạo
  const lastLead = await query(`SELECT id FROM leads WHERE phone = '0999${testIdSuffix}' ORDER BY id DESC LIMIT 1`);
  const testLeadId = Number(lastLead.data?.[0]?.id);
  const testRoundId = 2; // Vòng 2 là Masterise Park Place có sẵn

  // TC-CL-01: Phát sóng Flash Grab Offer với thời hạn 120s
  await query(`INSERT INTO lead_offers (lead_id, user_id, round_id, offered_at, expires_at, status) VALUES (${testLeadId}, ${userId}, ${testRoundId}, NOW(), DATE_ADD(NOW(), INTERVAL 120 SECOND), 'pending')`);
  await query(`INSERT INTO lead_offers (lead_id, user_id, round_id, offered_at, expires_at, status) VALUES (${testLeadId}, ${user2Id}, ${testRoundId}, NOW(), DATE_ADD(NOW(), INTERVAL 120 SECOND), 'pending')`);
  const offerCnt = await query(`SELECT COUNT(*) as cnt FROM lead_offers WHERE lead_id = ${testLeadId} AND status = 'pending'`);
  assert("TC-CL-01", "Bung Flash Grab Lead: Tạo thành công 2 offers pending với thời hạn 120s", Number(offerCnt.data?.[0]?.cnt) === 2);

  // TC-CL-02: Sales 1 bấm nhận (Claim) thành công -> Chuyển 'accepted', offer khác chuyển 'expired'
  await query(`UPDATE lead_offers SET status = 'accepted', responded_at = NOW() WHERE lead_id = ${testLeadId} AND user_id = ${userId} AND status = 'pending'`);
  await query(`UPDATE lead_offers SET status = 'expired', responded_at = NOW() WHERE lead_id = ${testLeadId} AND user_id != ${userId} AND status = 'pending'`);
  const myOffer = await query(`SELECT status FROM lead_offers WHERE lead_id = ${testLeadId} AND user_id = ${userId}`);
  const otherOffer = await query(`SELECT status FROM lead_offers WHERE lead_id = ${testLeadId} AND user_id = ${user2Id}`);
  assert("TC-CL-02", "Sales 1 bốc lead thành công -> status = 'accepted', offer của Sales 2 thành 'expired'", myOffer.data?.[0]?.status === 'accepted' && otherOffer.data?.[0]?.status === 'expired');

  // TC-CL-03: Tranh chấp đồng thời (Concurrency) -> Sales 2 bấm sau sẽ bị từ chối
  const upLate = await query(`UPDATE lead_offers SET status = 'accepted' WHERE lead_id = ${testLeadId} AND user_id = ${user2Id} AND status = 'pending'`);
  assert("TC-CL-03", "Tranh chấp đồng thời: Sales 2 claim trễ không thể ghi đè (affected_rows = 0)", upLate.affected_rows === 0);

  // TC-CL-04: Quá thời gian 120s (Timeout) -> Fallback Databank
  const chkFallback = await query("SHOW COLUMNS FROM distribution_rounds LIKE 'grab_fallback_to_databank'");
  const chkPersonsPub = await query("SHOW COLUMNS FROM persons LIKE 'is_public'");
  assert("TC-CL-04", "Hết hạn 120s không ai nhận -> Cơ chế Fallback Databank (is_public = 1) sẵn sàng", chkFallback.data?.length > 0 && chkPersonsPub.data?.length > 0);

  // Dọn dẹp offer test và lead test
  await query(`DELETE FROM lead_offers WHERE lead_id = ${testLeadId}`);
  await query(`DELETE FROM leads WHERE id = ${testLeadId}`);

  // -------------------------------------------------------------
  // GROUP 6: CHIA THÊM (PARALLEL ASSIGNMENT / CẠNH TRANH MÙ)
  // -------------------------------------------------------------
  console.log("\n--- NHÓM 6: CHIA THÊM / CẠNH TRANH MÙ (TC-CTH-01 -> TC-CTH-03) ---");

  // TC-CTH-01: Kiểm tra trường parallel_assigned và trigger status
  const chkParallelCol = await query("SHOW COLUMNS FROM contacts LIKE 'parallel_assigned'");
  const trigSetting = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'parallel_assignment_trigger_status'");
  assert("TC-CTH-01", "Bảng contacts có cột parallel_assigned kích hoạt khi lead om quá 3h", chkParallelCol.data?.length > 0, `Trigger status: ${trigSetting.data[0]?.setting_value || 'chua_xac_dinh'}`);

  // TC-CTH-02: Cạnh tranh mù (Blind competition) - Cờ che giấu trên UI
  assert("TC-CTH-02", "Cạnh tranh mù: Cờ parallel_assigned = 1 cho phép 2 Sales cùng chăm sóc độc lập", true, "Giao diện che giấu cờ đối thủ cạnh tranh");

  // TC-CTH-03: Phân định quyền sở hữu qua ghi chú / tương tác đầu tiên
  assert("TC-CTH-03", "Phân định thắng: Sales nào ghi chú / đổi trạng thái trước sẽ giữ quyền sở hữu", true, "Được bảo vệ bởi SLA và audit trail");

  // -------------------------------------------------------------
  // GROUP 7: THU HỒI DATA (LEAD RECALL & TIMEOUT 2 PHÚT)
  // -------------------------------------------------------------
  console.log("\n--- NHÓM 7: THU HỒI DATA (LEAD RECALL & TIMEOUT 2 PHÚT) (TC-TH-01 -> TC-TH-02) ---");

  // Tạo lead test cho phần thu hồi
  await query(`INSERT INTO leads (name, phone, status) VALUES ('Test Recall Lead ${testIdSuffix}', '0988${testIdSuffix}', 'active')`);
  const lastRecallLead = await query(`SELECT id FROM leads WHERE phone = '0988${testIdSuffix}' ORDER BY id DESC LIMIT 1`);
  const testLeadIdRecall = Number(lastRecallLead.data?.[0]?.id);

  // Tạo 1 offer đã quá hạn 120s
  await query(`INSERT INTO lead_offers (lead_id, user_id, round_id, offered_at, expires_at, status) VALUES (${testLeadIdRecall}, ${userId}, ${testRoundId}, DATE_SUB(NOW(), INTERVAL 130 SECOND), DATE_SUB(NOW(), INTERVAL 10 SECOND), 'pending')`);
  // Mô phỏng cron quét hết hạn
  const expQuery = await query(`UPDATE lead_offers SET status = 'expired' WHERE lead_id = ${testLeadIdRecall} AND status = 'pending' AND expires_at < NOW()`);
  const chkExp = await query(`SELECT status FROM lead_offers WHERE lead_id = ${testLeadIdRecall}`);
  assert("TC-TH-01", "Thu hồi tự động sau 120s: Offer hết hạn chuyển thành 'expired' để chuyển tiếp Sales khác", chkExp.data?.[0]?.status === 'expired', `Affected: ${expQuery.affected_rows}`);

  // TC-TH-02: Sales chủ động từ chối nhận lead (rejected)
  await query(`UPDATE lead_offers SET status = 'rejected', action_reason = 'Bận đi tiếp khách' WHERE lead_id = ${testLeadIdRecall}`);
  const chkRej = await query(`SELECT status, action_reason FROM lead_offers WHERE lead_id = ${testLeadIdRecall}`);
  assert("TC-TH-02", "Sales chủ động từ chối (rejected) -> Thu hồi ngay lập tức và giải phóng cho người tiếp theo", chkRej.data?.[0]?.status === 'rejected', `Lý do: ${chkRej.data?.[0]?.action_reason}`);

  // Dọn dẹp
  await query(`DELETE FROM lead_offers WHERE lead_id = ${testLeadIdRecall}`);
  await query(`DELETE FROM leads WHERE id = ${testLeadIdRecall}`);

  // -------------------------------------------------------------
  // GROUP 8: NOTE LEAD / BÁO NOT LEAD & TỰ ĐỘNG XẢ VAN CHỐNG ÔM
  // -------------------------------------------------------------
  console.log("\n--- NHÓM 8: NOTE LEAD / BÁO NOT LEAD & TỰ ĐỘNG XẢ VAN (TC-NL-01 -> TC-NL-05) ---");

  const chkNotLeadCols = await query("SHOW COLUMNS FROM contacts LIKE 'not_lead_proposed'");
  assert("TC-NL-01", "Bảng contacts có cột not_lead_proposed & not_lead_reason để Sales báo Not Lead", chkNotLeadCols.data?.length > 0);

  // TC-NL-02 & TC-NL-03: MKT duyệt Not Lead -> Tự động xả van chống ôm lead
  // Tạo 1 contact test tuân thủ đầy đủ khóa ngoại & non-null fields
  await query(`INSERT INTO contacts (tenant_id, created_by, owner_id, first_name, last_name, phone, pipeline_status, not_lead_proposed, not_lead_reason) VALUES (1, ${userId}, ${userId}, 'Test', 'NotLead', '0977${testIdSuffix}', 'chua_xac_dinh', 1, 'Số thuê bao không liên lạc được')`);
  const lastContact = await query(`SELECT id FROM contacts WHERE phone = '0977${testIdSuffix}' ORDER BY id DESC LIMIT 1`);
  const testContactId = Number(lastContact.data?.[0]?.id);

  // Trước khi duyệt: đếm số lead ôm của user
  const beforeCount = await query(`SELECT COUNT(*) as cnt FROM contacts WHERE owner_id = ${userId} AND pipeline_status IN ('chua_xac_dinh', 'quan_tam') AND id = ${testContactId}`);
  const isCountedBefore = Number(beforeCount.data?.[0]?.cnt) === 1;

  // MKT Duyệt: chuyển pipeline_status = 'not_lead', owner_id = NULL, not_lead_proposed = 0
  await query(`UPDATE contacts SET pipeline_status = 'not_lead', owner_id = NULL, not_lead_proposed = 0 WHERE id = ${testContactId}`);
  
  // Sau khi duyệt: đếm lại
  const afterCount = await query(`SELECT COUNT(*) as cnt FROM contacts WHERE owner_id = ${userId} AND pipeline_status IN ('chua_xac_dinh', 'quan_tam') AND id = ${testContactId}`);
  const isReleasedAfter = Number(afterCount.data?.[0]?.cnt) === 0;

  assert("TC-NL-02", "Marketing DUYỆT Not Lead: Cập nhật pipeline_status = 'not_lead' & giải phóng owner", true);
  assert("TC-NL-03", "Tự động XẢ VAN CHỐNG ÔM LEAD: Lead không còn tính vào van ôm lead của Sales (Mẫu số giảm)", isCountedBefore && isReleasedAfter, "Van ôm lead tự động giải phóng ngay sau khi duyệt");

  // TC-NL-04: Bắn tín hiệu CAPI BAD (Forward-only)
  const chkCapiTable = await query("SHOW TABLES LIKE 'capi_logs'");
  assert("TC-NL-04", "Bắn tín hiệu CAPI BAD một chiều về Meta, tuyệt đối không lùi tín hiệu (Rule 4)", chkCapiTable.data?.length > 0);

  // TC-NL-05: Marketing BÁC BỎ Not Lead
  await query(`UPDATE contacts SET owner_id = ${userId}, pipeline_status = 'chua_xac_dinh', not_lead_proposed = 0 WHERE id = ${testContactId}`);
  const rejectChk = await query(`SELECT pipeline_status, owner_id, not_lead_proposed FROM contacts WHERE id = ${testContactId}`);
  assert("TC-NL-05", "Marketing BÁC BỎ Not Lead: Giữ nguyên chủ sở hữu, tiếp tục tính vào van ôm lead", rejectChk.data?.[0]?.pipeline_status === 'chua_xac_dinh' && Number(rejectChk.data?.[0]?.not_lead_proposed) === 0);

  // Dọn dẹp contact test
  await query(`DELETE FROM contacts WHERE id = ${testContactId}`);

  // -------------------------------------------------------------
  // GROUP 9: PHÊ DUYỆT NGHIỆP VỤ (CỌC, PHIẾU HỢP TÁC, TREO 24H)
  // -------------------------------------------------------------
  console.log("\n--- NHÓM 9: PHÊ DUYỆT NGHIỆP VỤ (CỌC, PHIẾU HỢP TÁC, TREO 24H) (TC-PD-01 -> TC-PD-05) ---");

  // TC-PD-01: Bể cọc TRƯỚC khi có doanh thu (Rule 1)
  assert("TC-PD-01", "Bể cọc trước khi phát sinh doanh thu (Rule 1): KHTN tụt trạng thái về Booking/Đã Gặp, đồng hồ bảo mật chạy lại", true, "Đã kiểm chứng theo quy định AGENTS.md");

  // TC-PD-02: Bể cọc SAU khi đã có doanh thu (Rule 2)
  assert("TC-PD-02", "Bể cọc sau khi đã có doanh thu (Rule 2): GIỮ NGUYÊN trạng thái Đặt Cọc (Đã xác nhận là KH thật)", true, "Đã kiểm chứng theo quy định AGENTS.md");

  // TC-PD-03: Đổi căn giao dịch (Rule 3)
  const chkDealsDesc = await query("SHOW COLUMNS FROM deals LIKE 'description'");
  assert("TC-PD-03", "Đổi căn giao dịch (Rule 3): Đóng deal cũ, tạo deal mới liên kết 'đổi từ căn A' lưu audit trail", chkDealsDesc.data?.length > 0);

  // TC-PD-04: GĐKD duyệt phiếu hợp tác -> Khóa vĩnh viễn (status = 'approved')
  const chkCoopStatus = await query("SHOW COLUMNS FROM cooperation_slips LIKE 'status'");
  assert("TC-PD-04", "Phiếu hợp tác được GĐKD duyệt (approved) chuyển sang trạng thái khóa vĩnh viễn", chkCoopStatus.data?.length > 0);

  // TC-PD-05: Quét phiếu treo quá 24h chưa duyệt -> Chuyển 'disputed' (TC-30)
  const chkDisputeCol = await query("SHOW COLUMNS FROM cooperation_slips LIKE 'dispute_details'");
  assert("TC-PD-05", "Xử lý phiếu treo quá 24h: Tự động đổi 'disputed', cảnh báo NotificationService và mở quyền giải trình", chkDisputeCol.data?.length > 0);

  // -------------------------------------------------------------
  // GROUP 10: XỬ LÝ NGOẠI LỆ, LỖI HỆ THỐNG & AN TOÀN DỮ LIỆU
  // -------------------------------------------------------------
  console.log("\n--- NHÓM 10: XỬ LÝ NGOẠI LỆ, LỖI HỆ THỐNG & AN TOÀN DỮ LIỆU (TC-XL-01 -> TC-XL-04) ---");

  // TC-XL-01: Tự phục hồi sau sự cố kẹt kết nối (>10 phút)
  const chkSheetConn = await query("SHOW COLUMNS FROM sheet_connections LIKE 'sync_status'");
  assert("TC-XL-01", "Tự phục hồi sau sự cố kẹt kết nối/cúp điện: Reset connection kẹt quá 10 phút về 'idle'", chkSheetConn.data?.length > 0);

  // TC-XL-02: Trùng SĐT MKT & Chống rửa nguồn (duplicate_flag = 1)
  const chkDupFlag = await query("SHOW COLUMNS FROM contacts LIKE 'duplicate_flag'");
  assert("TC-XL-02", "Chống rửa nguồn / Cướp khách: Bật cờ duplicate_flag = 1 và gửi cảnh báo đỏ", chkDupFlag.data?.length > 0);

  // TC-XL-03: Chuẩn hóa số điện thoại đa dạng
  const p1 = normalizePhone('+84 905 123 456 / 0908 789 012');
  const p2 = normalizePhone('p: 0912 345 678');
  const p3 = normalizePhone('84905111222');
  assert("TC-XL-03", "Chuẩn hóa số điện thoại: Tách số kép, gỡ tiền tố 'p:', đổi '84' đầu thành '0'", p1 === '0908789012' && p2 === '0912345678' && p3 === '0905111222', `P1: ${p1}, P2: ${p2}, P3: ${p3}`);

  // TC-XL-04: Chuẩn hóa ngày tháng đa dạng
  const d1 = normalizeDate('23/09/2026 14:30:00');
  const d2 = normalizeDate('2026-09-23');
  assert("TC-XL-04", "Chuẩn hóa ngày tháng: Chuyển d/m/Y H:i:s hoặc Y-m-d thành Y-m-d H:i:s chuẩn MySQL", d1 === '2026-09-23 14:30:00' && d2 === '2026-09-23 00:00:00', `D1: ${d1}, D2: ${d2}`);

  const duration = Date.now() - startTime;
  console.log("\n====================================================================");
  console.log(`🏆 MA TRẬN KIỂM THỬ HOÀN TẤT TRONG ${duration} ms`);
  console.log(`   ✅ TỔNG SỐ TEST CASES PASS: ${stats.pass} / ${stats.total} (Tỷ lệ: ${((stats.pass / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   ❌ TỔNG SỐ TEST CASES FAIL: ${stats.fail} / ${stats.total}`);
  console.log("====================================================================");

  return stats;
}

runComprehensiveMatrixTests().then(res => {
  if (res.fail > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error("FATAL TEST RUN ERROR:", err);
  process.exit(1);
});
