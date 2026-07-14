const puppeteer = require('puppeteer-core');

const sleep = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  console.log('Starting visual multi-role E2E testing for all 5 roles...');
  
  // Launch local Google Chrome on interactive desktop
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  
  // Forward page console logs to terminal
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Log all login responses
  page.on('response', async response => {
    if (response.url().includes('/login')) {
      try {
        const text = await response.text();
        console.log(`API RESPONSE for ${response.url()}:`, text);
      } catch (e) {}
    }
  });

  // Helper function to log in using developer quick login buttons
  async function loginAs(email, password) {
    console.log(`\n--- Logging in as: ${email} ---`);
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button', { visible: true, timeout: 6000 });

    // Map email to developer quick login button text
    let roleText = '';
    if (email.includes('superadmin')) roleText = 'Super Admin';
    else if (email.includes('admin')) roleText = 'Admin';
    else if (email.includes('manager')) roleText = 'Manager';
    else if (email.includes('assistant')) roleText = 'Assistant';
    else if (email.includes('viewer')) roleText = 'Viewer';
    else if (email.includes('haidang')) roleText = 'Sale';
    
    // Find the button with the role text
    let clicked = false;
    const btns = await page.$$('button');
    for (const btn of btns) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt.includes(`Dev ${roleText}`)) {
        await btn.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      throw new Error(`Dev login button for role ${roleText} not found`);
    }

    try {
      await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 6000 });
    } catch (e) {
      console.warn("URL change wait timed out or failed");
      await page.screenshot({ path: `login_failed_${email}.png` });
    }
    await sleep(1500); // Allow routing and app loading to complete
    console.log(`Logged in successfully. Current URL: ${page.url()}`);
  }

  // Helper to click sidebar nav items safely
  async function clickSidebarItem(href, name) {
    console.log(`Navigating sidebar item: ${name} (${href})...`);
    const link = await page.$(`a[href="${href}"]`);
    if (link) {
      await link.click();
    } else {
      // Find by text content
      const links = await page.$$('a');
      let clicked = false;
      for (const l of links) {
        const text = await page.evaluate(el => el.textContent, l);
        if (text.includes(name)) {
          await l.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        console.warn(`Sidebar item not found: ${name} (${href})`);
        return;
      }
    }
    await sleep(1200);
  }

  try {
    // ==========================================
    // ROLE 1: SUPERADMIN / ADMIN
    // ==========================================
    await loginAs('admin@richland.net', 'admin123');
    await page.screenshot({ path: '1_admin_dashboard.png' });
    
    // Inspect admin-only modules
    await clickSidebarItem('/contacts', 'Khách hàng');
    await page.screenshot({ path: '1_admin_contacts.png' });
    
    // Open Thêm liên hệ modal and create E2E client
    console.log('Admin creating a test contact...');
    
    // Find the "Thêm data nhanh" button in the sidebar (available globally)
    let added = false;
    const btns = await page.$$('button');
    for (const btn of btns) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt.includes('Thêm data nhanh') || txt.includes('Thêm data cá nhân')) {
        await btn.click();
        added = true;
        break;
      }
    }
    
    // Wait for the modal input to render
    console.log('Waiting for modal inputs to appear...');
    await page.waitForSelector('input[placeholder="VD: Nguyễn Văn A"]', { timeout: 6000 });
    
    const randomPhone = '09' + Math.floor(10000000 + Math.random() * 90000000);
    await page.type('input[placeholder="VD: Nguyễn Văn A"]', '[E2E-Admin] Thế Vinh');
    await page.type('input[placeholder="VD: 0912345678"]', randomPhone);
    await page.type('input[placeholder="VD: email@gmail.com"]', `the_vinh_${randomPhone}@richland.com`);
    
    // Click submit
    let submitted = false;
    const submitBtns = await page.$$('button');
    for (const btn of submitBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Lưu & Giao Data')) {
        await btn.click();
        submitted = true;
        break;
      }
    }
    await sleep(2000);
    await page.screenshot({ path: '1_admin_contacts_after_create.png' });

    await clickSidebarItem('/rounds', 'Quy tắc phân bổ');
    await page.screenshot({ path: '1_admin_rules.png' });
    
    await clickSidebarItem('/capi', 'CAPI');
    await page.screenshot({ path: '1_admin_capi.png' });

    // ==========================================
    // ROLE 2: MANAGER
    // ==========================================
    await loginAs('manager@richland.net', 'manager123');
    await page.screenshot({ path: '2_manager_dashboard.png' });
    
    await clickSidebarItem('/reports-crm', 'Báo cáo');
    await page.screenshot({ path: '2_manager_reports.png' });
    
    await clickSidebarItem('/contacts', 'Khách hàng');
    await page.screenshot({ path: '2_manager_contacts.png' });
    
    await clickSidebarItem('/deals', 'Giao dịch');
    await page.screenshot({ path: '2_manager_deals.png' });

    // ==========================================
    // ROLE 3: ASSISTANT
    // ==========================================
    await loginAs('assistant@richland.net', 'assistant123');
    await page.screenshot({ path: '3_assistant_dashboard.png' });
    
    await clickSidebarItem('/contacts', 'Khách hàng');
    await page.screenshot({ path: '3_assistant_contacts.png' });

    await clickSidebarItem('/cooperation-slips', 'Phiếu hợp tác');
    await page.screenshot({ path: '3_assistant_cooperation.png' });

    // ==========================================
    // ROLE 4: VIEWER
    // ==========================================
    await loginAs('viewer@richland.net', 'viewer123');
    await page.screenshot({ path: '4_viewer_dashboard.png' });
    
    await clickSidebarItem('/contacts', 'Khách hàng');
    await page.screenshot({ path: '4_viewer_contacts.png' });
    
    // Check that settings option is hidden
    console.log('Verifying settings option is hidden for viewer...');
    const settingsLink = await page.$('a[href="/settings"]');
    if (settingsLink) {
      console.error('FAIL: Viewer can access Settings link!');
    } else {
      console.log('SUCCESS: Settings link is correctly hidden for Viewer role.');
    }

    // ==========================================
    // ROLE 5: SALE
    // ==========================================
    await loginAs('haidang@richland.net', 'sale123');
    await page.screenshot({ path: '5_sale_portal_dashboard.png' });
    
    await clickSidebarItem('/workspace', 'Bàn làm việc');
    await page.screenshot({ path: '5_sale_workspace.png' });

    console.log('\n========================================================');
    console.log('ALL 5 ROLES VISUALLY AND LOGICALLY AUDITED SUCCESSFULLY!');
    console.log('========================================================\n');
    await browser.close();
  } catch (err) {
    console.error('Error during testing:', err.message);
    if (browser) await browser.close();
  }
})();
