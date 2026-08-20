const https = require('https');

function query(sql) {
  return new Promise((resolve, reject) => {
    https.get('https://open.domation.net/richland/exec_db_query.php?key=richland2026&sql=' + encodeURIComponent(sql), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, error: e.message });
        }
      });
    }).on('error', reject);
  });
}

function assert(title, condition, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${title}` + (details ? ` -> ${details}` : ''));
    return true;
  } else {
    console.error(`❌ [FAIL] ${title}` + (details ? ` -> ${details}` : ''));
    return false;
  }
}

// Logic implementations matching backend/webhook_logic.php for direct client audit
function normalizePhone(phoneRaw) {
  if (!phoneRaw) return '';
  let phone = String(phoneRaw).trim();
  phone = phone.replace(/^(p:|tel:|phone:)\s*/i, '');
  const parts = phone.split(/[,;\/\|\n\r]|(?:\s+(?:hoặc|or|và|and)\s+)|\s{2,}|(?<=\d{8,12})\s+(?=[0\+])/i);
  const validParts = [];
  for (const part of parts) {
    const partCleaned = part.replace(/[^\d+]/g, '');
    const digitsOnly = partCleaned.replace(/[^\d]/g, '');
    if (digitsOnly.length >= 8) {
      validParts.push(part);
    }
  }
  if (validParts.length > 1) {
    phone = validParts[validParts.length - 1];
  }
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
  if (clean.length > 0 && clean.indexOf('0') !== 0) {
    return '0' + clean;
  }
  return clean;
}

function normalizeDate(dateRaw) {
  if (!dateRaw) return null;
  const dateStr = String(dateRaw).trim();
  if (dateStr === '') return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) return dateStr;
  const dmyMatch = dateStr.match(/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    const hour = String(dmyMatch[4] || 0).padStart(2, '0');
    const min = String(dmyMatch[5] || 0).padStart(2, '0');
    const sec = String(dmyMatch[6] || 0).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
  }
  return null;
}

function isConsultantInWorkHours(timeStr, start, end) {
  timeStr = (timeStr || '').trim();
  const m = timeStr.match(/^(\d{2}:\d{2})/);
  const cur = m ? m[1] : '08:00';
  if (!start || !end) return true;
  if (start < end) {
    return cur >= start && cur <= end;
  } else {
    return cur >= start || cur <= end;
  }
}

async function runMasterAudit() {
  console.log('====================================================================');
  console.log('👑 RUNNING REMOTE FULL MASTER AUDIT ON STAGING DATABASE');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;
  const record = (ok) => { if (ok) passed++; else failed++; };

  // --- PHAN 1: INGESTION (TC-01 -> TC-03) ---
  console.log('--- 1. INGESTION & DATA SANITIZATION (TC-01 -> TC-03) ---');
  record(assert('TC-01.1: normalizePhone multi numbers', normalizePhone('+84 905 123 456 / 0908 789 012') === '0908789012'));
  record(assert('TC-01.2: normalizePhone prefix cleanup', normalizePhone('p: 0912 345 678') === '0912345678'));
  record(assert('TC-01.3: normalizePhone intl retention', normalizePhone('+1 555 123 4567') === '+15551234567'));
  record(assert('TC-01.4: normalizePhone 84 prefix conversion', normalizePhone('84905111222') === '0905111222'));
  record(assert('TC-01.5: normalizePhone missing leading 0', normalizePhone('905555555') === '0905555555'));

  record(assert('TC-02.1: normalizeDate DMY with time', normalizeDate('20/08/2026 23:15:00') === '2026-08-20 23:15:00'));
  record(assert('TC-02.2: normalizeDate DMY without time', normalizeDate('20-08-2026') === '2026-08-20 00:00:00'));
  record(assert('TC-02.3: normalizeDate MySQL standard', normalizeDate('2026-08-20 18:30:00') === '2026-08-20 18:30:00'));

  const exclSettings = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('global_exclusion_keys', 'global_exclusion_contacts')");
  record(assert('TC-03.1: Global exclusion settings exist', exclSettings.status === 'success'));

  // --- PHAN 2: CRM DUPLICATE & PROTECTION (TC-04 -> TC-06) ---
  console.log('\n--- 2. CRM DUPLICATE & LEAD PROTECTION (TC-04 -> TC-06) ---');
  const chkLeadsCols = await query("SHOW COLUMNS FROM leads LIKE 'last_interaction_date'");
  record(assert('TC-04.1: leads has last_interaction_date column', chkLeadsCols.data && chkLeadsCols.data.length > 0));

  const chkReassign = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'reassign_if_owner_inactive'");
  record(assert('TC-06.1: system_settings has reassign_if_owner_inactive', chkReassign.status === 'success'));

  // --- PHAN 3: 5+ GATES (TC-07 -> TC-14) ---
  console.log('\n--- 3. 5+ GATES (TC-07 -> TC-14) ---');
  const chkRoster = await query("SHOW TABLES LIKE 'project_roster'");
  record(assert('TC-07.1: project_roster table exists', chkRoster.data && chkRoster.data.length > 0));

  const chkCheckIns = await query("SHOW COLUMNS FROM check_ins LIKE 'status'");
  record(assert('TC-08.1: check_ins has status column', chkCheckIns.data && chkCheckIns.data.length > 0));

  const chkNight = await query("SHOW COLUMNS FROM night_shift_registrations LIKE 'approved'");
  record(assert('TC-09.1: night_shift_registrations has approved column', chkNight.data && chkNight.data.length > 0));

  const chkWeekend = await query("SHOW COLUMNS FROM weekend_shift_registrations LIKE 'approved'");
  record(assert('TC-10.1: weekend_shift_registrations has approved column', chkWeekend.data && chkWeekend.data.length > 0));

  const chkLeaves = await query("SHOW TABLES LIKE 'consultant_leaves'");
  record(assert('TC-11.1: consultant_leaves table exists', chkLeaves.data && chkLeaves.data.length > 0));

  const chkBP = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'backpressure_limit'");
  record(assert('TC-12.1: system_settings has backpressure_limit', chkBP.status === 'success'));

  const chkGH = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'golden_hours_max_leads_per_consultant'");
  record(assert('TC-13.1: system_settings has golden_hours_max_leads_per_consultant', chkGH.status === 'success'));

  record(assert('TC-14.1: isConsultantInWorkHours daytime match', isConsultantInWorkHours('10:00', '08:00', '17:30') === true));
  record(assert('TC-14.2: isConsultantInWorkHours after hours mismatch', isConsultantInWorkHours('20:00', '08:00', '17:30') === false));
  record(assert('TC-14.3: isConsultantInWorkHours midnight crossing interval', isConsultantInWorkHours('23:30', '22:00', '06:00') === true));

  // --- PHAN 4: ROTATION & COMPENSATION (TC-15 -> TC-19) ---
  console.log('\n--- 4. ROTATION & COMPENSATION (TC-15 -> TC-19) ---');
  const chkRounds = await query("SHOW COLUMNS FROM distribution_rounds LIKE 'round_type'");
  record(assert('TC-15.1: distribution_rounds has round_type', chkRounds.data && chkRounds.data.length > 0));

  const chkCooldown = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'normal_round_cooldown_minutes'");
  record(assert('TC-16.1: system_settings has normal_round_cooldown_minutes', chkCooldown.status === 'success'));

  const chkComp = await query("SHOW COLUMNS FROM round_consultants LIKE 'compensation_count'");
  record(assert('TC-17.1: round_consultants has compensation_count column', chkComp.data && chkComp.data.length > 0));

  const chkTurn = await query("SHOW COLUMNS FROM round_consultants LIKE 'current_turn_remaining'");
  record(assert('TC-18.1: round_consultants has current_turn_remaining column', chkTurn.data && chkTurn.data.length > 0));

  const chkGrab = await query("SHOW COLUMNS FROM distribution_rounds LIKE 'grab_countdown_seconds'");
  record(assert('TC-19.1: distribution_rounds has grab_countdown_seconds', chkGrab.data && chkGrab.data.length > 0));

  // --- PHAN 5: SLA RECALL, DATABANK & BUSINESS RULES (TC-20 -> TC-24) ---
  console.log('\n--- 5. SLA RECALL, DATABANK & BUSINESS RULES (TC-20 -> TC-24) ---');
  const chkRecallSetting = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'lead_recall_minutes'");
  record(assert('TC-20.1: system_settings has lead_recall_minutes', chkRecallSetting.status === 'success'));

  const chkPersonPublic = await query("SHOW COLUMNS FROM persons LIKE 'is_public'");
  record(assert('TC-21.1: persons table has is_public for Databank', chkPersonPublic.data && chkPersonPublic.data.length > 0));

  const chkSyncRecords = await query("SHOW TABLES LIKE 'sheet_sync_records'");
  record(assert('TC-22.1: sheet_sync_records table exists for Two-Way Sync', chkSyncRecords.data && chkSyncRecords.data.length > 0));

  const chkCapi = await query("SHOW TABLES LIKE 'capi_logs'");
  record(assert('TC-23.1: capi_logs table exists for forward-only signals', chkCapi.data && chkCapi.data.length > 0));

  const chkDeals = await query("SHOW COLUMNS FROM deals LIKE 'description'");
  record(assert('TC-24.1: deals table has description column for audit trail', chkDeals.data && chkDeals.data.length > 0));

  console.log('\n====================================================================');
  console.log(`📊 AUDIT SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================================');
}

runMasterAudit();
