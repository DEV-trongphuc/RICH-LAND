const fs = require('fs');
const readline = require('readline');
const { query } = require('./query.cjs');

async function auditAll() {
  console.log('=== BẮT ĐẦU KIỂM TOÁN ĐỐI SOÁT APPSHEET vs CRM DATABASE ===\n');

  // 1. Phân tích số lượng trong AppSheet SQL
  console.log('--- 1. Đếm số dòng dữ liệu trong AppsheetRLVN.sql ---');
  const fileStream = fs.createReadStream('D:\\Downloads\\AppsheetRLVN.sql');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let currentTable = '';
  const counts = {};
  const r3Values = {};
  const ttl1Sample = [];
  let khtnWithChanDung = 0;
  let khtnTotal = 0;

  for await (const line of rl) {
    if (line.includes('INSERT INTO')) {
      const m = line.match(/INSERT INTO [`"]?([a-zA-Z0-9_]+)[`"]?/);
      if (m) currentTable = m[1];
    }
    if (line.trim().startsWith('(')) {
      counts[currentTable] = (counts[currentTable] || 0) + 1;
      
      if (currentTable === 'KHTN') {
        khtnTotal++;
        // parse phan_loai_lead and chan_dung if possible
        // Regex simple check
        if (/TTL1|Báo cáo TTL1|Nghiên cứu khách hàng/i.test(line)) {
          khtnWithChanDung++;
        }
      }
    }
  }

  console.log('Số bản ghi theo bảng trong AppsheetRLVN.sql:');
  for (const [tbl, count] of Object.entries(counts)) {
    console.log(`  - ${tbl}: ${count.toLocaleString()} dòng`);
  }
  console.log(`  * KHTN có chứa nội dung TTL1 / Nghiên cứu khách hàng: ~${khtnWithChanDung.toLocaleString()} / ${khtnTotal.toLocaleString()} dòng\n`);

  // 2. Kiểm tra hiện trạng trong CRM Database MySQL
  console.log('--- 2. Kiểm tra hiện trạng trong MySQL CSDL crm-rlvn ---');
  const dbCounts = await query(`
    SELECT 
      (SELECT COUNT(*) FROM contacts WHERE deleted_at IS NULL) as contacts_count,
      (SELECT COUNT(*) FROM leads) as leads_count,
      (SELECT COUNT(*) FROM notes) as notes_count,
      (SELECT COUNT(*) FROM users) as users_count,
      (SELECT COUNT(*) FROM consultants) as consultants_count,
      (SELECT COUNT(*) FROM distribution_logs) as logs_count,
      (SELECT COUNT(*) FROM projects) as projects_count;
  `);
  console.log('Số lượng trong CSDL CRM MySQL:', dbCounts.data[0]);

  // 3. Kiểm tra các cột trong contacts và leads liên quan đến chan_dung, ttl1, phan_loai, R3
  console.log('\n--- 3. Kiểm tra các trường liên quan đến R3 và TTL1 trong CSDL CRM ---');
  const contactCols = await query(`SHOW COLUMNS FROM contacts;`);
  const leadCols = await query(`SHOW COLUMNS FROM leads;`);
  
  const relevantCols = contactCols.data.filter(c => /note|persona|demand|source|rank|ttl|r3|chan_dung|custom/i.test(c.Field)).map(c => c.Field);
  console.log('Các cột tiềm năng trong contacts:', relevantCols);

  const relevantLeadCols = leadCols.data.filter(c => /note|persona|demand|source|rank|ttl|r3|chan_dung|custom/i.test(c.Field)).map(c => c.Field);
  console.log('Các cột tiềm năng trong leads:', relevantLeadCols);

  // 4. Kiểm tra phân loại R3 trong contacts và leads
  const contactSources = await query(`
    SELECT source, COUNT(*) as count 
    FROM contacts 
    WHERE deleted_at IS NULL 
    GROUP BY source 
    ORDER BY count DESC 
    LIMIT 15;
  `);
  console.log('\nPhân loại nguồn/source hiện tại trong contacts:', contactSources.data);

  const leadSources = await query(`
    SELECT source, COUNT(*) as count 
    FROM leads 
    GROUP BY source 
    ORDER BY count DESC 
    LIMIT 15;
  `);
  console.log('\nPhân loại nguồn/source hiện tại trong leads:', leadSources.data);

  // 5. Kiểm tra trường TTL1 hoặc chan_dung trong contacts
  const samplePersona = await query(`
    SELECT id, first_name, last_name, phone, source, lead_notes, notes 
    FROM contacts 
    WHERE lead_notes LIKE '%TTL1%' OR notes LIKE '%TTL1%' 
    LIMIT 3;
  `);
  console.log('\nSample contacts có chứa TTL1 trong lead_notes hoặc notes:', samplePersona.data);
}

auditAll().catch(console.error);
