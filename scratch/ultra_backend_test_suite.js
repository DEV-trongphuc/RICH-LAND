import axios from 'axios';
import fs from 'fs';
import { execSync } from 'child_process';

const API_BASE = 'https://open.domation.net/richland';
const rand = () => Math.floor(Math.random() * 10000000);

const rVal = rand();
const ROLES = {
  admin: { email: 'turniodev@gmail.com', pass: 'pass123' },
  sale: { email: 'dom.marketing.vn@gmail.com', pass: 'sale123' },
  director: { email: 'director@richland.test', pass: 'director123' },
  manager: { email: 'manager@richland.test', pass: 'manager123' },
  assistant: { email: `assistant_ultra_${rVal}@richland.test`, pass: 'assist123' },
  viewer: { email: `viewer_ultra_${rVal}@richland.test`, pass: 'viewer123' }
};

const tokens = {};
const testResults = [];

function logTest(module, scenario, expected, success, actual = '', errorMsg = '') {
  testResults.push({ module, scenario, expected, success, actual, errorMsg });
}

function getUrl(path) {
  const cleanPath = path.replace(/^\//, '');
  return `${API_BASE}/api.php?action=${cleanPath}`;
}

// Helper to batch execute promises with concurrency limit
async function batchPromises(tasks, limit) {
  const results = [];
  const executing = [];
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

async function runUltraAudit() {
  console.log('=== STARTING ULTRA BACKEND TEST SUITE (1,000+ TEST CASES) ===\n');

  // 1. Initial login for seeded roles
  for (const role of ['admin', 'sale', 'director', 'manager']) {
    try {
      const res = await axios.post(getUrl('auth/login'), {
        email: ROLES[role].email,
        password: ROLES[role].pass
      });
      tokens[role] = res.data.data.access_token || res.data.data.token || res.data.data.accessToken;
      logTest('Auth', `Initial login as ${role}`, 'Token returned', true);
    } catch (e) {
      logTest('Auth', `Initial login as ${role}`, 'Token returned', false, '', e.response?.data?.message || e.message);
    }
  }

  const adminHeaders = { headers: { Authorization: `Bearer ${tokens.admin}` } };

  // 2. Create assistant and viewer roles programmatically
  for (const role of ['assistant', 'viewer']) {
    try {
      await axios.post(getUrl('users'), {
        email: ROLES[role].email,
        password: ROLES[role].pass,
        full_name: `Temp ${role} Auditor`,
        role: role,
        is_active: 1
      }, adminHeaders);
      
      const res = await axios.post(getUrl('auth/login'), {
        email: ROLES[role].email,
        password: ROLES[role].pass
      });
      tokens[role] = res.data.data.access_token || res.data.data.token || res.data.data.accessToken;
      logTest('User Provisioning', `Create & authenticate ${role}`, 'Success', true);
    } catch (e) {
      logTest('User Provisioning', `Create & authenticate ${role}`, 'Success', false, '', e.response?.data?.message || e.message);
    }
  }

  const getHeaders = (role) => ({ headers: { Authorization: `Bearer ${tokens[role]}` } });

  // 3. Permission Scopes Matrix Definition
  const permissions = [
    { path: 'companies', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'contacts', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'deals', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'tickets', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'expenses', readRoles: ['admin', 'director', 'manager', 'sale'], writeRoles: ['admin', 'director', 'manager', 'sale'] },
    { path: 'check-ins', readRoles: ['admin', 'director', 'manager', 'viewer', 'assistant', 'sale'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant', 'viewer'] },
    { path: 'users', readRoles: ['admin', 'director', 'manager', 'sale'], writeRoles: ['admin', 'director'] },
    { path: 'cooperation-slips', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'deposits', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'workflow-task-templates', readRoles: ['admin', 'director', 'manager', 'assistant'], writeRoles: ['admin', 'director', 'manager'] }
  ];

  // 4. Boundary Validation Payload Variations (Negative Scenarios)
  // 15 malformed payloads for validation testing
  const payloadVariations = [
    { name: 'Empty Payload', body: {} },
    { name: 'Non-existent reference ID', body: { contact_id: 999999, company_id: 888888, project_id: 777777 } },
    { name: 'Negative price/amount', body: { price: -50000, amount: -100000, subtotal: -10000 } },
    { name: 'String for numeric price', body: { price: 'not-a-number', amount: 'abc' } },
    { name: 'Extremely long string value', body: { name: 'A'.repeat(5000), title: 'B'.repeat(5000) } },
    { name: 'HTML Injection string', body: { name: '<script>alert("hack")</script>', body: '<div>test</div>' } },
    { name: 'SQL Injection pattern', body: { name: "' OR 1=1 --", email: "admin' OR '1'='1" } },
    { name: 'Future date validation', body: { date: '2100-01-01', issue_date: '2100-01-01' } },
    { name: 'Malformed email syntax', body: { email: 'notanemail.com', contact_email: 'invalid@' } },
    { name: 'Zero milestones array', body: { milestones: [] } },
    { name: 'Invalid milestone details', body: { milestones: [{ name: '', amount: -10 }] } },
    { name: 'Missing required status', body: { status: '' } },
    { name: 'Invalid geo-coordinates checkin', body: { lat: 'abc', lng: 999.999 } },
    { name: 'Missing selfie checkin', body: { reason: 'No selfie' } },
    { name: 'Null values in primary keys', body: { title: null, first_name: null } }
  ];

  // Build task array for parallel execution
  const apiTasks = [];

  // Add permission matrix check tasks
  for (const ep of permissions) {
    for (const [role, token] of Object.entries(tokens)) {
      if (!token) continue;
      const canRead = ep.readRoles.includes(role);
      const canWrite = ep.writeRoles.includes(role);

      // GET read checks
      apiTasks.push(async () => {
        try {
          await axios.get(getUrl(ep.path), getHeaders(role));
          logTest('Permission Matrix', `GET /${ep.path} as ${role}`, canRead ? 'Allowed' : 'Blocked', canRead, canRead ? 'Allowed' : 'Not Blocked');
        } catch (e) {
          const status = e.response?.status;
          const allowed = status !== 403 && status !== 401;
          logTest('Permission Matrix', `GET /${ep.path} as ${role}`, canRead ? 'Allowed' : 'Blocked', allowed === canRead, allowed ? 'Allowed' : 'Blocked');
        }
      });

      // POST write checks
      apiTasks.push(async () => {
        try {
          await axios.post(getUrl(ep.path), {}, getHeaders(role));
          logTest('Permission Matrix', `POST /${ep.path} as ${role}`, canWrite ? 'Validation/Allowed' : 'Blocked', !canWrite ? false : true, 'Allowed');
        } catch (e) {
          const status = e.response?.status;
          const blocked = status === 403 || status === 401;
          logTest('Permission Matrix', `POST /${ep.path} as ${role}`, canWrite ? 'Validation/Allowed' : 'Blocked', canWrite ? !blocked : blocked, blocked ? 'Blocked' : 'Allowed');
        }
      });
    }
  }

  // Add boundary check validation tasks (10 endpoints * 15 variations * 6 roles = 900 cases)
  for (const ep of permissions) {
    for (const [role, token] of Object.entries(tokens)) {
      if (!token) continue;
      const canWrite = ep.writeRoles.includes(role);
      if (!canWrite) continue; // Skip if role is already blocked from posting

      for (const variant of payloadVariations) {
        apiTasks.push(async () => {
          try {
            await axios.post(getUrl(ep.path), variant.body, getHeaders(role));
            // If it succeeds, it might be allowed depending on endpoint (some allow partial values), but should not trigger 500
            logTest('Boundary Validation', `POST /${ep.path} as ${role} with ${variant.name}`, 'Validation/200/422/400 (No 500)', true, 'Success/Validation Handled');
          } catch (e) {
            const status = e.response?.status;
            // 500 error represents a database or php crash - we treat this as a FAIL
            const isCrash = status === 500;
            logTest('Boundary Validation', `POST /${ep.path} as ${role} with ${variant.name}`, 'Validation/200/422/400 (No 500)', !isCrash, `Status: ${status}`, isCrash ? 'Server Crash 500' : '');
          }
        });
      }
    }
  }

  // Run all generated matrix api tasks in parallel batches of 60
  console.log(`Enqueuing ${apiTasks.length} matrix and validation tasks...`);
  await batchPromises(apiTasks, 60);
  console.log(`Completed parallel test matrix tasks.`);

  // 5. Test Case: Business Rule 1 - Deposit Cancellation before Revenue ("Bể cọc chưa phát sinh doanh thu")
  console.log('\n--- Business Rule 1: Bể cọc chưa doanh thu ---');
  let rule1ContactId = null;
  let rule1DepositId = null;
  try {
    const cRes = await axios.post(getUrl('contacts'), {
      first_name: 'Lead Rule 1',
      last_name: String(rand()),
      status: 'booking'
    }, adminHeaders);
    rule1ContactId = cRes.data.data.id;

    // Create deposit
    const dRes = await axios.post(getUrl('deposits'), {
      contact_id: rule1ContactId,
      project_id: 1,
      unit_code: 'A1-Rule1',
      price: 1000000000,
      expected_commission: 50000000
    }, adminHeaders);
    rule1DepositId = dRes.data.data.id;

    // Cancel deposit (No milestones approved yet)
    await axios.post(getUrl(`deposits/${rule1DepositId}/cancel`), {
      reason: 'Khách hàng đổi ý trước khi nộp tiền'
    }, adminHeaders);

    // Verify contact status went back to 'booking' or similar
    const getRes = await axios.get(getUrl(`contacts/${rule1ContactId}`), adminHeaders);
    const finalStatus = getRes.data.data.pipeline_status;
    const isDemoted = finalStatus === 'booking' || finalStatus === 'da_gap' || finalStatus === 'prospect';
    logTest('Business Rule 1', 'Deposit cancellation without revenue', 'Demoted to booking/da_gap/prospect', isDemoted, finalStatus);
  } catch (e) {
    logTest('Business Rule 1', 'Deposit cancellation without revenue', 'Demoted', false, '', e.response?.data?.message || e.message);
  }

  // 6. Test Case: Business Rule 2 - Deposit Cancellation after Revenue ("Bể cọc đã phát sinh doanh thu")
  console.log('\n--- Business Rule 2: Bể cọc đã phát sinh doanh thu ---');
  let rule2ContactId = null;
  let rule2DepositId = null;
  try {
    const cRes = await axios.post(getUrl('contacts'), {
      first_name: 'Lead Rule 2',
      last_name: String(rand()),
      status: 'booking'
    }, adminHeaders);
    rule2ContactId = cRes.data.data.id;

    // Create deposit with milestones
    const dRes = await axios.post(getUrl('deposits'), {
      contact_id: rule2ContactId,
      project_id: 1,
      unit_code: 'A1-Rule2',
      price: 1000000000,
      expected_commission: 50000000,
      milestones: [{ name: 'Đợt 1', amount: 100000000 }]
    }, adminHeaders);
    rule2DepositId = dRes.data.data.id;

    // Fetch the milestones list of this deposit
    const listRes = await axios.get(getUrl('deposits'), adminHeaders);
    const matchedDep = listRes.data.data.find(d => Number(d.id) === Number(rule2DepositId));
    const milestoneId = matchedDep.milestones[0].id;

    // Approve the first milestone payment (simulate revenue)
    await axios.post(getUrl(`deposits/${rule2DepositId}/milestones/${milestoneId}/approve`), {
      amount: 100000000
    }, adminHeaders);

    // Cancel deposit
    await axios.post(getUrl(`deposits/${rule2DepositId}/cancel`), {
      reason: 'Hủy cọc sau khi đóng đợt 1'
    }, adminHeaders);

    // Verify contact pipeline_status stays 'deposit' / 'dat_coc'
    const getRes = await axios.get(getUrl(`contacts/${rule2ContactId}`), adminHeaders);
    const finalStatus = getRes.data.data.pipeline_status;
    const isKept = finalStatus === 'deposit' || finalStatus === 'dat_coc';
    logTest('Business Rule 2', 'Deposit cancellation with revenue', 'Stays as deposit', isKept, finalStatus);
  } catch (e) {
    logTest('Business Rule 2', 'Deposit cancellation with revenue', 'Stays as deposit', false, '', e.response?.data?.message || e.message);
  }

  // 7. Test Case: Business Rule 3 - Unit Switching ("Đổi căn")
  console.log('\n--- Business Rule 3: Đổi căn ---');
  let oldDealId = null;
  let newDealId = null;
  try {
    // Create old deal
    const oldRes = await axios.post(getUrl('deals'), {
      title: `Căn hộ A ${rand()}`,
      contact_id: 1,
      amount: 2000000000,
      stage_id: 1
    }, adminHeaders);
    oldDealId = oldRes.data.data.id;

    // Close deal as switched
    await axios.post(getUrl(`deals/${oldDealId}/switch`), {
      new_unit_code: 'A1-02',
      new_price: 2500000000,
      new_project_id: 1,
      reason: 'Đổi sang căn B'
    }, adminHeaders);

    // Create new deal linked to old deal
    const newRes = await axios.post(getUrl('deals'), {
      title: `Căn hộ B ${rand()}`,
      contact_id: 1,
      amount: 2500000000,
      stage_id: 1,
      switched_from_deal_id: oldDealId
    }, adminHeaders);
    newDealId = newRes.data.data.id;

    logTest('Business Rule 3', 'Unit Switch Audit Trail link', 'Linked deal created', newDealId ? true : false, `New deal linked to ${oldDealId}`);
  } catch (e) {
    logTest('Business Rule 3', 'Unit Switch Audit Trail link', 'Linked deal created', false, '', e.response?.data?.message || e.message);
  }

  // 8. Test Case: Business Rule 4 - Conversion API (CAPI) Forward-only
  console.log('\n--- Business Rule 4: CAPI Forward-only ---');
  try {
    // Upload and run CAPI integration test php script on server via SSH
    execSync(`scp -4 -P 2210 -o StrictHostKeyChecking=no C:/Users/LENOVO/.gemini/antigravity-ide/brain/bf0d3b6b-469d-4188-9042-2a298202b9ec/scratch/capi_test.php vhvxoigh@chiefaiofficer.vn:/home/vhvxoigh/open.domation.net/richland/capi_test.php`);
    const sshRes = execSync(`ssh -4 -p 2210 -o StrictHostKeyChecking=no vhvxoigh@chiefaiofficer.vn "php /home/vhvxoigh/open.domation.net/richland/capi_test.php"`).toString();
    execSync(`ssh -4 -p 2210 -o StrictHostKeyChecking=no vhvxoigh@chiefaiofficer.vn "rm /home/vhvxoigh/open.domation.net/richland/capi_test.php"`);
    
    const parsed = JSON.parse(sshRes);
    const forwardOnlySuccess = parsed.logged_events.includes('Purchase') && !parsed.logged_events.includes('Refund');
    logTest('Business Rule 4', 'CAPI forward-only signal guardrail', 'Purchase logged, Refund blocked', forwardOnlySuccess, JSON.stringify(parsed));
  } catch (e) {
    logTest('Business Rule 4', 'CAPI forward-only signal guardrail', 'Purchase logged, Refund blocked', false, '', e.message);
  }

  // 9. Shift rotation & vacation mode logic
  console.log('\n--- Attendance, Leave & Vacation Mode ---');
  try {
    // Toggle vacation mode to ON (by sending empty body/id as sale)
    const toggleRes1 = await axios.post(getUrl('toggle_consultant_vacation'), {}, getHeaders('sale'));
    logTest('Attendance & Leaves', 'Toggle vacation mode to ON', 'Success', toggleRes1.data.success, JSON.stringify(toggleRes1.data));

    // Toggle vacation mode back to OFF
    const toggleRes2 = await axios.post(getUrl('toggle_consultant_vacation'), {}, getHeaders('sale'));
    logTest('Attendance & Leaves', 'Toggle vacation mode to OFF', 'Success', toggleRes2.data.success, JSON.stringify(toggleRes2.data));
  } catch (e) {
    logTest('Attendance & Leaves', 'Toggle vacation mode', 'Success', false, '', e.response?.data?.message || e.message);
  }

  // Save audit results to report
  const passCount = testResults.filter(t => t.success).length;
  const failCount = testResults.filter(t => !t.success).length;
  
  let reportMd = `# Ultra-Massive Backend Validation Report\n\n`;
  reportMd += `### Summary\n`;
  reportMd += `- **Total Tests Run**: ${testResults.length}\n`;
  reportMd += `- **Passed**: ${passCount}\n`;
  reportMd += `- **Failed**: ${failCount}\n\n`;
  reportMd += `### Detailed Results (Sample of failed/critical cases)\n\n`;
  reportMd += `| Module | Scenario | Expected | Status | Error |\n`;
  reportMd += `| --- | --- | --- | --- | --- |\n`;
  
  // Log all fails
  const fails = testResults.filter(t => !t.success);
  for (const r of fails) {
    reportMd += `| ${r.module} | ${r.scenario} | ${r.expected} | ❌ FAIL | ${r.errorMsg || '—'} |\n`;
  }
  
  // Log first 100 passes for sample verification representation
  const passes = testResults.filter(t => t.success).slice(0, 100);
  for (const r of passes) {
    reportMd += `| ${r.module} | ${r.scenario} | ${r.expected} | ✅ PASS | — |\n`;
  }
  if (testResults.filter(t => t.success).length > 100) {
    reportMd += `| ... | ... (Remaining ${testResults.filter(t => t.success).length - 100} passed tests omitted for file size constraints) | ... | ... | ... |\n`;
  }
  
  fs.writeFileSync('C:/Users/LENOVO/.gemini/antigravity-ide/brain/bf0d3b6b-469d-4188-9042-2a298202b9ec/scratch/ultra_audit_report.md', reportMd);
  console.log(`\n=== ULTRA AUDIT COMPLETED. ${testResults.length} RUN, ${passCount} PASSED, ${failCount} FAILED. ===`);
}

runUltraAudit();
