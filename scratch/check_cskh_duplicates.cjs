const fs = require('fs');
const readline = require('readline');

async function checkCSKHDuplicates() {
  const fileStream = fs.createReadStream('D:\\Downloads\\AppsheetRLVN.sql');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let inCSKH = false;
  const cskhIds = new Set();
  let duplicateCount = 0;
  let totalCSKH = 0;

  for await (const line of rl) {
    if (line.includes('INSERT INTO `LS_CSKH`') || line.includes('INSERT INTO LS_CSKH') || line.includes('INSERT INTO `LS_CSKH_bangphu`') || line.includes('INSERT INTO LS_CSKH_bangphu')) {
      inCSKH = true;
      continue;
    }
    if (line.includes('INSERT INTO') || line.includes('CREATE TABLE')) {
      inCSKH = false;
    }
    if (inCSKH && line.trim().startsWith('(')) {
      totalCSKH++;
      const m = line.match(/^\s*\('([^']+)'/);
      if (m) {
        const id = m[1];
        if (cskhIds.has(id)) {
          duplicateCount++;
        } else {
          cskhIds.add(id);
        }
      }
    }
  }

  console.log(`Tổng số dòng CSKH trong cả 2 bảng AppSheet: ${totalCSKH}`);
  console.log(`Số unique CSKH IDs: ${cskhIds.size}`);
  console.log(`Số bản ghi trùng lặp ID giữa 2 bảng: ${duplicateCount}`);
}

checkCSKHDuplicates().catch(console.error);
