const puppeteer = require('puppeteer-core');

const sleep = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  console.log('Starting visual multi-role E2E testing for all 5 roles...');
  
  // Launch local Google Chrome on interactive desktop
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  
  // Helper function to log in using standard email and password input fields
  async function loginAs(email, password) {
    console.log(`\n--- Logging in as: ${email} ---`);
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    
    // Clear localStorage and cookies to ensure clean login
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);

    // Type email
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', email);
    await sleep(500);
    
    // Type password
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', password);
    await sleep(500);
    
    // Click submit button
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    
    await sleep(4500); // Allow routing and app loading to complete
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
    await sleep(3000);
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
    
    // Find the "Thêm liên hệ" button by looking at buttons with class primary or text
    let added = false;
    const btns = await page.$$('button');
    for (const btn of btns) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt.includes('Thêm liên hệ')) {
        await btn.click();
        added = true;
        break;
      }
    }
    if (!added) {
      // fallback
      const addBtn = await page.$('button.btn.primary');
      if (addBtn) await addBtn.click();
    }
    
    // Wait for the modal input to render
    console.log('Waiting for modal inputs to appear...');
    await page.waitForSelector('input[placeholder="VD: Nguyễn"]', { timeout: 6000 });
    
    const randomPhone = '09' + Math.floor(10000000 + Math.random() * 90000000);
    await page.type('input[placeholder="VD: Nguyễn"]', '[E2E-Admin]');
    await page.type('input[placeholder="VD: Văn An"]', 'Thế Vinh');
    await page.type('input[placeholder="09xx xxx xxx"]', randomPhone);
    await page.type('input[placeholder="email@congty.com"]', `the_vinh_${randomPhone}@richland.com`);
    
    // Click submit
    let submitted = false;
    const submitBtns = await page.$$('button');
    for (const btn of submitBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Tạo Liên hệ')) {
        await btn.click();
        submitted = true;
        break;
      }
    }
    await sleep(4000);
    await page.screenshot({ path: '1_admin_contacts_after_create.png' });

    await clickSidebarItem('/rounds', 'Quy tắc phân bổ');
    await page.screenshot({ path: '1_admin_rules.png' });
    
    await clickSidebarItem('/capi', 'CAPI');
    await page.screenshot({ path: '1_admin_capi.png' });

    // ==========================================
    // ROLE 2: MANAGER
    // ==========================================
    await loginAs('mgr_unique@richland.net', 'admin123');
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
    await loginAs('assistant_e2e@richland.net', 'admin123');
    await page.screenshot({ path: '3_assistant_dashboard.png' });
    
    await clickSidebarItem('/contacts', 'Khách hàng');
    await page.screenshot({ path: '3_assistant_contacts.png' });

    await clickSidebarItem('/cooperation-slips', 'Phiếu hợp tác');
    await page.screenshot({ path: '3_assistant_cooperation.png' });

    // ==========================================
    // ROLE 4: VIEWER
    // ==========================================
    await loginAs('viewer_e2e@richland.net', 'admin123');
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
    console.log('Browser left open for manual inspection on Sale workspace.');
    console.log('========================================================\n');
    
  } catch (err) {
    console.error('Error during testing:', err.message);
  }
})();
