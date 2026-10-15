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
  const consultants = (await execQuery(`
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
  `)).data;

  const checkins = (await execQuery(`SELECT user_id, status, late_minutes FROM check_ins WHERE check_in_date = CURDATE()`)).data;
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

  function isEligible(c) {
    const ci = checkins.find(x => x.user_id == c.id);
    if (!ci) return false;
    if (ci.status !== 'approved' && ci.status !== 'pending_approval') return false;
    if (Number(ci.late_minutes) > 0) return false;
    const bp = backpressure.find(x => x.owner_id == c.id);
    const bpCnt = bp ? Number(bp.cnt) : 0;
    if (bpCnt >= 5) return false;
    return true;
  }

  function simulateGetNext(lastAssignedId, excludeIds) {
    const totalCount = consultants.length;
    let lastIdx = -1;
    if (lastAssignedId) {
      for (let i = 0; i < totalCount; i++) {
        if (Number(consultants[i].id) === Number(lastAssignedId)) {
          lastIdx = i;
          break;
        }
      }
    }

    let startIdx = 0;
    if (lastIdx !== -1) {
      startIdx = (lastIdx + 1) % totalCount;
    } else if (lastAssignedId) {
      for (let i = 0; i < totalCount; i++) {
        if (Number(consultants[i].id) > Number(lastAssignedId)) {
          startIdx = i;
          break;
        }
      }
    }

    let nextIdx = startIdx;
    let chosen = null;
    do {
      const cand = consultants[nextIdx];
      const candId = Number(cand.id);
      if (!excludeIds.includes(candId)) {
        if (isEligible(cand)) {
          chosen = cand;
          break;
        }
      }
      nextIdx = (nextIdx + 1) % totalCount;
    } while (nextIdx !== startIdx);

    return chosen;
  }

  console.log("=== SIMULATING STEP BY STEP RECALL AND REASSIGN ===");
  // Step 1: Initial recall from Trí Nguyễn (100098)
  console.log("1. Last assigned: 100098 (Trí Nguyễn), Exclude: [100098]");
  let c1 = simulateGetNext(100098, [100098]);
  console.log(`   -> Next chosen: ${c1.name} (ID: ${c1.id})`);

  // Step 2: Recalled from c1
  console.log(`2. Recalled from ${c1.name} (${c1.id}), Exclude: [${c1.id}]`);
  let c2 = simulateGetNext(c1.id, [Number(c1.id)]);
  console.log(`   -> Next chosen: ${c2.name} (ID: ${c2.id})`);

  // Step 3: Recalled from c2
  console.log(`3. Recalled from ${c2.name} (${c2.id}), Exclude: [${c2.id}]`);
  let c3 = simulateGetNext(c2.id, [Number(c2.id)]);
  console.log(`   -> Next chosen: ${c3.name} (ID: ${c3.id})`);

  // Step 4: Recalled from c3
  console.log(`4. Recalled from ${c3.name} (${c3.id}), Exclude: [${c3.id}]`);
  let c4 = simulateGetNext(c3.id, [Number(c3.id)]);
  console.log(`   -> Next chosen: ${c4.name} (ID: ${c4.id})`);

  // Step 5: Recalled from c4
  console.log(`5. Recalled from ${c4.name} (${c4.id}), Exclude: [${c4.id}]`);
  let c5 = simulateGetNext(c4.id, [Number(c4.id)]);
  console.log(`   -> Next chosen: ${c5.name} (ID: ${c5.id})`);
}

run();
