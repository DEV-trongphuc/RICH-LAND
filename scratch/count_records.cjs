const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('D:/Downloads/AppsheetRLVN.sql', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

let leadsInserts = 0;
let khtnInserts = 0;
let totalLeadsRows = 0;
let inLeads = false;

rl.on('line', (line) => {
  if (line.includes('INSERT INTO `LEADS`')) {
    leadsInserts++;
    inLeads = true;
    return;
  }
  if (inLeads) {
    if (line.trim().startsWith('(')) {
      totalLeadsRows++;
    }
    if (line.trim().endsWith(';')) {
      inLeads = false;
    }
  }
  if (line.includes('INSERT INTO `KHTN`')) {
    khtnInserts++;
  }
});

rl.on('close', () => {
  console.log('LEADS insert statements:', leadsInserts);
  console.log('LEADS total rows counted:', totalLeadsRows);
  console.log('KHTN insert statements:', khtnInserts);
});
