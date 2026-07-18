import axios from 'axios';
import fs from 'fs';

const API_BASE = 'https://open.domation.net/richland';

const ROLES = {
  admin: { email: 'turniodev@gmail.com', pass: 'pass123' },
  sale: { email: 'dom.marketing.vn@gmail.com', pass: 'sale123' },
  director: { email: 'director@richland.test', pass: 'director123' },
  manager: { email: 'manager@richland.test', pass: 'manager123' },
  viewer: { email: 'viewer_audit_temp@richland.test', pass: 'viewer123' } // To be created during test
};

const tokens = {};
const testResults = [];

function logTest(module, description, success, errorMsg = '') {
  testResults.push({ module, description, success, errorMsg });
  console.log(`[${success ? 'PASS' : 'FAIL'}] ${module}: ${description} ${errorMsg ? `(${errorMsg})` : ''}`);
}

function getUrl(path) {
  const cleanPath = path.replace(/^\//, '');
  return `${API_BASE}/api.php?action=${cleanPath}`;
}

async function runAudit() {
  console.log('=== STARTING COMPREHENSIVE BACKEND AUDIT ===\n');

  // 1. Authenticate users
  for (const [role, credentials] of Object.entries(ROLES)) {
    if (role === 'viewer') continue; // Create later
    try {
      const res = await axios.post(getUrl('auth/login'), {
        email: credentials.email,
        password: credentials.pass
      });
      tokens[role] = res.data.data.token || res.data.data.accessToken;
      logTest('Authentication', `Login as ${role} successful`, true);
    } catch (e) {
      logTest('Authentication', `Login as ${role} failed`, false, e.response?.data?.message || e.message);
    }
  }

  const authHeaders = (role) => ({ headers: { Authorization: `Bearer ${tokens[role]}` } });

  // 2. Create a temporary viewer user using admin token
  try {
    const res = await axios.post(getUrl('users'), {
      email: ROLES.viewer.email,
      password: ROLES.viewer.pass,
      full_name: 'Audit Temporary Viewer',
      role: 'viewer',
      is_active: 1
    }, authHeaders('admin'));
    logTest('User Management', 'Create temporary viewer user successful', true);
    
    // Login as viewer
    const viewRes = await axios.post(getUrl('auth/login'), {
      email: ROLES.viewer.email,
      password: ROLES.viewer.pass
    });
    tokens.viewer = viewRes.data.data.token || viewRes.data.data.accessToken;
    logTest('Authentication', 'Login as viewer successful', true);
  } catch (e) {
    logTest('User Management', 'Create/Login as viewer failed', false, e.response?.data?.message || e.message);
  }

  // 3. Test B2B Companies Scopes & Permissions
  let testCompanyId = null;
  
  // Admin creates B2B Company
  try {
    const res = await axios.post(getUrl('companies'), {
      name: 'B2B Testing Corp',
      sla_level: 'platinum',
      dedicated_rep_id: 1000 // assigned to Nguyen Hai Dang (Sale)
    }, authHeaders('admin'));
    testCompanyId = res.data.data.id;
    logTest('B2B Companies', 'Admin create B2B Company with dedicated rep and Platinum SLA successful', true);
  } catch (e) {
    logTest('B2B Companies', 'Admin create B2B Company failed', false, e.response?.data?.message || e.message);
  }

  // Sale views company (Sale is dedicated rep, should have access!)
  if (testCompanyId) {
    try {
      const res = await axios.get(getUrl(`companies/${testCompanyId}`), authHeaders('sale'));
      logTest('B2B Companies', 'Sale reads company details where they are the dedicated rep (Access check) successful', true);
    } catch (e) {
      logTest('B2B Companies', 'Sale reads company details where they are dedicated rep failed', false, e.response?.data?.message || e.message);
    }

    // Sale updates company details (Sale should be allowed to update!)
    try {
      await axios.post(getUrl(`companies/${testCompanyId}`) + '&_method=PUT', {
        name: 'B2B Testing Corp Updated',
        dedicated_rep_id: 1000
      }, authHeaders('sale'));
      logTest('B2B Companies', 'Sale updates company details where they are dedicated rep successful', true);
    } catch (e) {
      logTest('B2B Companies', 'Sale updates company details where they are dedicated rep failed', false, e.response?.data?.message || e.message);
    }

    // Viewer tries to write/delete company (Viewer should be blocked!)
    try {
      await axios.post(getUrl(`companies/${testCompanyId}`) + '&_method=PUT', {
        name: 'B2B Testing Corp Hacked'
      }, authHeaders('viewer'));
      logTest('B2B Companies', 'Viewer write block test failed (unauthorized write allowed)', false);
    } catch (e) {
      logTest('B2B Companies', 'Viewer write block test successful (unauthorized write blocked)', true);
    }
  }

  // 4. Test Expenses splitting
  let testExpenseId = null;
  try {
    const res = await axios.post(getUrl('expenses'), {
      title: 'Audit Dinner Expense',
      amount: 1500000,
      category: 'Khác',
      date: new Date().toISOString().split('T')[0],
      entities: [
        { entity_type: 'company', entity_id: testCompanyId || 1, amount: 750000 },
        { entity_type: 'contact', entity_id: 1, amount: 750000 }
      ]
    }, authHeaders('admin'));
    testExpenseId = res.data.data?.id || res.data.data;
    logTest('Operational Expenses', 'Create and split expense across contact and company successful', true);
  } catch (e) {
    logTest('Operational Expenses', 'Create and split expense failed', false, e.response?.data?.message || e.message);
  }

  // 5. Test POS Invoices
  try {
    const res = await axios.post(getUrl('invoices'), {
      title: 'POS B2B Testing Sale',
      contact_id: 1,
      company_id: testCompanyId || 1,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
      subtotal: 5000000,
      discount: 0,
      tax: 0,
      total: 5000000,
      notes: 'POS invoice created during comprehensive audit'
    }, authHeaders('admin'));
    logTest('Invoices & POS', 'Create invoice for company/contact via POS endpoint successful', true);
  } catch (e) {
    logTest('Invoices & POS', 'Create invoice via POS failed', false, e.response?.data?.message || e.message);
  }

  // 6. Test Tickets, Comments & Mentions
  let testTicketId = null;
  try {
    const res = await axios.post(getUrl('tickets'), {
      title: 'Audit Helpdesk Ticket',
      description: 'Need assistance with dedicated rep scopes',
      priority: 'high',
      status: 'open'
    }, authHeaders('sale'));
    testTicketId = res.data.data?.id || res.data.data;
    logTest('Helpdesk Tickets', 'Create support ticket successful', true);
  } catch (e) {
    logTest('Helpdesk Tickets', 'Create support ticket failed', false, e.response?.data?.message || e.message);
  }

  if (testTicketId) {
    // Admin comments on ticket and mentions manager
    try {
      await axios.post(getUrl(`tickets/${testTicketId}/comments`), {
        body: 'Please review this @manager',
        user_id: 999
      }, authHeaders('admin'));
      logTest('Helpdesk Tickets', 'Add comment with user mention (@manager) successful', true);
    } catch (e) {
      logTest('Helpdesk Tickets', 'Add comment with user mention failed', false, e.response?.data?.message || e.message);
    }
  }

  // 7. Test Attendance & Lateness
  try {
    const res = await axios.post(getUrl('checkin'), {
      type: 'checkin',
      lat: 10.776,
      lng: 106.701,
      device_info: 'Audit Automation Script'
    }, authHeaders('sale'));
    logTest('Attendance & Leaves', 'Sale check-in execution successful', true);
  } catch (e) {
    logTest('Attendance & Leaves', 'Sale check-in execution failed', false, e.response?.data?.message || e.message);
  }

  // Save audit results to report
  const passCount = testResults.filter(t => t.success).length;
  const failCount = testResults.filter(t => !t.success).length;
  
  let reportMd = `# Backend Audit Report\n\n`;
  reportMd += `### Summary\n`;
  reportMd += `- **Total Tests**: ${testResults.length}\n`;
  reportMd += `- **Passed**: ${passCount}\n`;
  reportMd += `- **Failed**: ${failCount}\n\n`;
  reportMd += `### Detailed Results\n\n`;
  reportMd += `| Module | Description | Status | Error |\n`;
  reportMd += `| --- | --- | --- | --- |\n`;
  
  for (const r of testResults) {
    reportMd += `| ${r.module} | ${r.description} | ${r.success ? '✅ PASS' : '❌ FAIL'} | ${r.errorMsg || '—'} |\n`;
  }
  
  fs.writeFileSync('C:/Users/LENOVO/.gemini/antigravity-ide/brain/bf0d3b6b-469d-4188-9042-2a298202b9ec/scratch/audit_report.md', reportMd);
  console.log(`\n=== AUDIT COMPLETED. ${passCount} PASSED, ${failCount} FAILED. REPORT SAVED. ===`);
}

runAudit();
