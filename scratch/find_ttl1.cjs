const fs = require('fs');
const readline = require('readline');

async function findTTL1() {
  const fileStream = fs.createReadStream('D:\\Downloads\\AppsheetRLVN.sql');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNum = 0;
  let matches = [];
  let currentTable = '';

  for await (const line of rl) {
    lineNum++;
    if (line.includes('INSERT INTO')) {
      const m = line.match(/INSERT INTO [`"]?([a-zA-Z0-9_]+)[`"]?/);
      if (m) currentTable = m[1];
    }
    if (/ttl1/i.test(line)) {
      matches.push({
        line: lineNum,
        table: currentTable,
        sample: line.length > 300 ? line.slice(0, 300) + '...' : line
      });
      if (matches.length >= 20) break;
    }
  }

  console.log(`Found ${matches.length} matches for ttl1. Showing first few:`);
  matches.forEach(m => {
    console.log(`Line ${m.line} (Table ${m.table}):`);
    console.log(`  ${m.sample}\n`);
  });
}

findTTL1();
