const https = require('https');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: e.message, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function verify() {
  const settings = await queryDb("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('night_shift_start_time', 'night_shift_end_time', 'allow_late_night_shift_registration', 'late_night_shift_registration_minutes', 'advance_night_shift_registration_minutes', 'night_duty_notification_enabled', 'night_shift_reg_reminder_enabled')");
  console.log('Database settings:', JSON.stringify(settings, null, 2));

  // Simulate calculating the reminder notification message
  const map = {};
  const list = Array.isArray(settings) ? settings : (settings.data || []);
  list.forEach(s => map[s.setting_key] = s.setting_value);

  const nightShiftStart = map['night_shift_start_time'] || '19:00';
  const nightShiftEnd = map['night_shift_end_time'] || '07:00';
  const allowLate = parseInt(map['allow_late_night_shift_registration'] || '0', 10);
  const lateMinutes = parseInt(map['late_night_shift_registration_minutes'] || '0', 10);
  const advanceMinutes = parseInt(map['advance_night_shift_registration_minutes'] || '0', 10);

  const [h, m] = nightShiftStart.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);

  if (allowLate === 1 && lateMinutes > 0) {
    d.setMinutes(d.getMinutes() + lateMinutes);
  } else if (advanceMinutes > 0) {
    d.setMinutes(d.getMinutes() - advanceMinutes);
  }

  const deadlineStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const deadlineNote = `hạn chót đăng ký: ${deadlineStr}` + (allowLate === 1 && lateMinutes > 0 ? ` (cho phép trễ ${lateMinutes}p)` : (advanceMinutes > 0 ? ` (yêu cầu trước ${advanceMinutes}p)` : ''));

  console.log('\n--- SIMULATED DYNAMIC NOTIFICATION MESSAGES ---');
  console.log('Shift Window:', `${nightShiftStart} - ${nightShiftEnd}`);
  console.log('Registration Deadline:', deadlineStr);
  console.log('In-App & Zalo Msg:', `Mời đăng ký ca trực đêm: Ca trực đêm từ ${nightShiftStart} đến ${nightShiftEnd} đã mở đăng ký (${deadlineNote}). Vui lòng đăng ký sớm để tham gia phân bổ lead ca đêm!`);
  console.log('Telegram Msg:', `🌙 [ ĐĂNG KÝ TRỰC ĐÊM ]\nTư vấn viên Nguyễn Văn A vừa ĐĂNG KÝ trực ca đêm:\n  • Ngày trực: 09/10/2026 (${nightShiftStart} - ${nightShiftEnd})`);
}

verify();
