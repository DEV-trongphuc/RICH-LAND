const https = require('https');

function execQuery(sql) {
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

async function run() {
  // Get consultants exactly as cStmt in getNextConsultantInRound
  const res = await execQuery(`
    SELECT c.id, c.name, rc.receive_ratio, rc.skip_count, rc.compensation_count, 
           rc.data_per_turn, rc.current_turn_remaining, 0 as skipped_credit,
           c.vacation_mode, c.leave_start, c.leave_end, c.work_start_time, c.work_end_time, c.work_schedule
    FROM round_consultants rc 
    JOIN consultants c ON rc.consultant_id = c.id 
    WHERE rc.round_id = 2 
      AND rc.is_active = 1 
      AND c.status = 'active' 
      AND c.vacation_mode = 0 
      AND (c.leave_start IS NULL OR CURDATE() < c.leave_start OR (c.leave_end IS NOT NULL AND c.leave_end < CURDATE()))
    ORDER BY c.id ASC
  `);

  const consultants = res.data;
  console.log(`Total consultants in round 2 matching cStmt: ${consultants.length}`);

  // Also check who passes checkConsultantGates(conn, c.id, null)
  // Let's inspect who passes each gate:
  // Gate 1: lead is null -> PASS
  // Gate 2: Check-in today
  const checkins = (await execQuery(`SELECT user_id, status, late_minutes FROM check_ins WHERE check_in_date = CURDATE()`)).data;
  
  // Gate 4: Backpressure
  const backpressure = (await execQuery(`
    SELECT c.owner_id, COUNT(*) as cnt 
    FROM contacts c
    WHERE c.deleted_at IS NULL
      AND c.status != 'rejected'
      AND c.pipeline_status IN ('chua_xac_dinh', 'quan_tam')
      AND NOT EXISTS (
          SELECT 1 FROM notes n 
          WHERE n.entity_type = 'contact' 
            AND n.entity_id = c.id 
      )
      AND NOT EXISTS (
          SELECT 1 FROM activities a
          WHERE (a.related_type = 'contact' AND a.related_id = c.id)
             OR a.contact_id = c.id
      )
    GROUP BY c.owner_id
  `)).data;

  // Working hours:
  const currentTime = "09:15"; // during the ping-pong

  console.log("\n--- SIMULATING ELIGIBILITY AT 09:15 FOR ALL CONSULTANTS ---");
  const eligible = [];
  for (let i = 0; i < consultants.length; i++) {
    const c = consultants[i];
    const ci = checkins.find(x => x.user_id == c.id);
    const bpRow = backpressure.find(x => x.owner_id == c.id);
    const bpCnt = bpRow ? Number(bpRow.cnt) : 0;
    
    let failReason = null;
    // Check-in gate
    if (!ci) {
      failReason = "No check-in";
    } else if (ci.status !== 'approved' && ci.status !== 'pending_approval') {
      failReason = `Check-in ${ci.status}`;
    } else if (Number(ci.late_minutes) > 0) {
      failReason = `Late ${ci.late_minutes}m`;
    }
    
    // Backpressure gate (limit = 5)
    if (!failReason && bpCnt >= 5) {
      failReason = `Backpressure ${bpCnt} >= 5`;
    }

    const isEligible = !failReason;
    if (isEligible) {
      eligible.push(c);
    }
    console.log(`[${i}] ID: ${c.id} | Name: ${c.name.padEnd(20)} | ${isEligible ? 'ELIGIBLE' : 'FAIL: ' + failReason}`);
  }

  console.log(`\nTOTAL ELIGIBLE CONSULTANTS: ${eligible.length}`);
  eligible.forEach(e => console.log(`  -> ID: ${e.id} | ${e.name}`));
}

run();
