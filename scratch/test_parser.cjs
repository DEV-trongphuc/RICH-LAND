const fs = require('fs');
const readline = require('readline');

// Test parse a few rows from LEADS
const rl = readline.createInterface({
  input: fs.createReadStream('D:/Downloads/AppsheetRLVN.sql', { encoding: 'utf8' }),
  crlfDelay: Infinity
});

let inLeads = false;
let parsedCount = 0;
let errors = 0;

// Regular expression to split SQL values
// Format: ('id', 'create_time', 'fullname', 'email', 'phone', 'loai_lead', 'kenh', 'du_an', 'lead_phan_loai', 'team_nhap', 'mkt_chiateam', 'trang_thai', 'databank', 'notlead', 'kho_lead', 'nhap_thu_cong', 'loop', 'birthday', 'country', 'loai_hinh', 'hinh_thuc_tt', 'time_lienhe', 'app_lienhe', 'nhu_cau', 'tieu_chi', 'san_pham', 'link_fb', 'form_dangky', 'time_databank', 'donvi_chay', 'lead_tindung', 'city', 'client_context', 'ad_id', 'campaign', 'ad_name', 'inbox_url')

rl.on('line', (line) => {
  if (line.includes('INSERT INTO `LEADS`')) {
    inLeads = true;
    return;
  }
  if (inLeads) {
    const trimmed = line.trim();
    if (trimmed.startsWith('(')) {
      parsedCount++;
      if (parsedCount <= 5) {
        console.log(`Sample parsed row ${parsedCount}:`);
        console.log(trimmed.substring(0, 300) + '...');
      }
    }
    if (trimmed.endsWith(';')) {
      inLeads = false;
    }
  }
});

rl.on('close', () => {
  console.log(`Finished test scan. Total rows: ${parsedCount}`);
});
