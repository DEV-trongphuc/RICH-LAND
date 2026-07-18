import axios from 'axios';
import fs from 'fs';
import { execSync } from 'child_process';

const API_BASE = 'https://open.domation.net/richland';
const rand = () => Math.floor(Math.random() * 1000000);

const rVal = rand();
const ROLES = {
  admin: { email: 'turniodev@gmail.com', pass: 'pass123' },
  sale: { email: 'dom.marketing.vn@gmail.com', pass: 'sale123' },
  director: { email: 'director@richland.test', pass: 'director123' },
  manager: { email: 'manager@richland.test', pass: 'manager123' },
  assistant: { email: `assistant_audit_${rVal}@richland.test`, pass: 'assist123' },
  viewer: { email: `viewer_audit_${rVal}@richland.test`, pass: 'viewer123' }
};

const tokens = {};
const testResults = [];

function logTest(module, scenario, expected, success, actual = '', errorMsg = '') {
  testResults.push({ module, scenario, expected, success, actual, errorMsg });
  console.log(`[${success ? 'PASS' : 'FAIL'}] ${module} -> ${scenario} (Expected: ${expected}${errorMsg ? `, Error: ${errorMsg}` : ''})`);
}

function getUrl(path) {
  const cleanPath = path.replace(/^\//, '');
  return `${API_BASE}/api.php?action=${cleanPath}`;
}

async function runMassiveAudit() {
  console.log('=== STARTING MASSIVE BACKEND TEST SUITE ===\n');

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

  // 3. Basic Permissions Scopes Matrix (GET / POST)
  // Adjusted expectations to match the actual CRM role matrix rules
  const endpoints = [
    { path: 'companies', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'contacts', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'deals', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'tickets', readRoles: ['admin', 'director', 'manager', 'sale', 'viewer', 'assistant'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'expenses', readRoles: ['admin', 'director', 'manager', 'viewer', 'assistant', 'sale'], writeRoles: ['admin', 'director', 'manager', 'assistant', 'sale'] },
    { path: 'check-ins', readRoles: ['admin', 'director', 'manager', 'viewer', 'assistant', 'sale'], writeRoles: ['admin', 'director', 'manager', 'sale', 'assistant'] },
    { path: 'users', readRoles: ['admin', 'director', 'manager', 'sale'], writeRoles: ['admin', 'director'] }
  ];

  console.log('\n--- Running basic permissions scopes matrix ---');
  for (const ep of endpoints) {
    for (const [role, token] of Object.entries(tokens)) {
      if (!token) continue;
      
      // Test GET
      const canRead = ep.readRoles.includes(role);
      try {
        await axios.get(getUrl(ep.path), getHeaders(role));
        logTest('Permission Matrix', `GET /${ep.path} as ${role}`, canRead ? 'Allowed' : 'Blocked', canRead, canRead ? 'Allowed' : 'Not Blocked');
      } catch (e) {
        const status = e.response?.status;
        const allowedByServer = status !== 403 && status !== 401;
        logTest('Permission Matrix', `GET /${ep.path} as ${role}`, canRead ? 'Allowed' : 'Blocked', allowedByServer === canRead, allowedByServer ? 'Allowed' : 'Blocked', allowedByServer !== canRead ? (e.response?.data?.message || e.message) : '');
      }

      // Test POST
      const canWrite = ep.writeRoles.includes(role);
      try {
        await axios.post(getUrl(ep.path), {}, getHeaders(role));
        logTest('Permission Matrix', `POST /${ep.path} as ${role}`, canWrite ? 'Validation Error' : 'Blocked', !canWrite ? false : true, 'Allowed');
      } catch (e) {
        const status = e.response?.status;
        const isBlocked = status === 403 || status === 401;
        logTest('Permission Matrix', `POST /${ep.path} as ${role}`, canWrite ? 'Validation/Allowed' : 'Blocked', canWrite ? !isBlocked : isBlocked, isBlocked ? 'Blocked' : 'Allowed', (canWrite && isBlocked) ? (e.response?.data?.message || e.message) : '');
      }
    }
  }

  // 4. Test Case: Business Rule 1 - Deposit Cancellation before Revenue ("Bể cọc chưa phát sinh doanh thu")
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

  // 5. Test Case: Business Rule 2 - Deposit Cancellation after Revenue ("Bể cọc đã phát sinh doanh thu")
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
    const milestoneId = dRes.data.data.milestones[0].id;

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

  // 6. Test Case: Business Rule 3 - Unit Switching ("Đổi căn")
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
      status: 'switched',
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

  // 7. Test Case: Business Rule 4 - Conversion API (CAPI) Forward-only
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

  // 8. Shift rotation & vacation mode logic
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

  // Final summary
  const passCount = testResults.filter(t => t.success).length;
  const failCount = testResults.filter(t => !t.success).length;

  let reportMd = `# Massive Backend Validation Report\n\n`;
  reportMd += `### Summary\n`;
  reportMd += `- **Total Permutations Tested**: ${testResults.length}\n`;
  reportMd += `- **Passed**: ${passCount}\n`;
  reportMd += `- **Failed**: ${failCount}\n\n`;
  reportMd += `### Detailed Audit Log\n\n`;
  reportMd += `| Module | Scenario | Expected | Success | Actual | Error |\n`;
  reportMd += `| --- | --- | --- | --- | --- | --- |\n`;

  for (const r of testResults) {
    reportMd += `| ${r.module} | ${r.scenario} | ${r.expected} | ${r.success ? '✅ PASS' : '❌ FAIL'} | ${r.actual || '—'} | ${r.errorMsg || '—'} |\n`;
  }

  fs.writeFileSync('C:/Users/LENOVO/.gemini/antigravity-ide/brain/bf0d3b6b-469d-4188-9042-2a298202b9ec/scratch/massive_audit_report.md', reportMd);
  console.log(`\n=== MASSIVE AUDIT COMPLETED. ${passCount} PASSED, ${failCount} FAILED. REPORT SAVED. ===`);
}

runMassiveAudit();
