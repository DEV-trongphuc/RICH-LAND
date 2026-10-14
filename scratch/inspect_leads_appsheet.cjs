const fs = require('fs');
const readline = require('readline');

async function inspectLEADS() {
  console.log('--- Phân tích bảng LEADS trong AppsheetRLVN.sql ---');
  const fileStream = fs.createReadStream('D:\\Downloads\\AppsheetRLVN.sql');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let inLEADS = false;
  let leadsCount = 0;
  const sampleLeads = [];
  const channels = {};
  const campaigns = {};

  for await (const line of rl) {
    if (line.includes('INSERT INTO `LEADS`') || line.includes('INSERT INTO LEADS')) {
      inLEADS = true;
      continue;
    }
    if (inLEADS) {
      if (line.includes('INSERT INTO') || line.includes('CREATE TABLE')) {
        inLEADS = false;
        continue;
      }
      if (line.trim().startsWith('(')) {
        leadsCount++;
        // Columns of LEADS: id, lead_id, team_id, ngay_tao, full_name, phone, kenh, campaign, du_an, trang_thai, ...
        // Let's see some sample lines
        if (sampleLeads.length < 5) {
          sampleLeads.push(line.slice(0, 200));
        }
      }
    }
  }

  console.log(`Tổng số LEADS trong AppSheet: ${leadsCount}`);
  console.log('Sample LEADS lines:\n', sampleLeads);
}

inspectLEADS().catch(console.error);
