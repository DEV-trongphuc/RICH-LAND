const fs = require('fs');
const readline = require('readline');

function parseSqlValues(line) {
  let str = line.trim();
  if (str.startsWith('(')) str = str.slice(1);
  if (str.endsWith('),') || str.endsWith(');')) str = str.slice(0, -2);
  else if (str.endsWith(')')) str = str.slice(0, -1);

  const values = [];
  let current = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === "'") {
      inString = !inString;
      continue;
    }
    if (char === ',' && !inString) {
      values.push(cleanVal(current.trim()));
      current = '';
      continue;
    }
    current += char;
  }
  values.push(cleanVal(current.trim()));
  return values;
}

function cleanVal(v) {
  if (v === 'NULL' || v === null || v === undefined) return null;
  if (v === "b'0'" || v === "b0") return 0;
  if (v === "b'1'" || v === "b1") return 1;
  return v;
}

function normalizePhone(p) {
  if (!p) return '';
  let clean = p.replace(/\D/g, '');
  if (clean.startsWith('84') && clean.length >= 11) {
    clean = clean.substring(2);
  }
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  return clean;
}

async function extract() {
  console.log('Extracting AppSheet data...');
  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Downloads/AppsheetRLVN.sql', { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  const leads = [];
  const khtnMap = new Map(); // key = lead_id or phone

  let currentTable = null;

  rl.on('line', (line) => {
    if (line.includes('INSERT INTO `LEADS`')) {
      currentTable = 'LEADS';
      return;
    }
    if (line.includes('INSERT INTO `KHTN`')) {
      currentTable = 'KHTN';
      return;
    }

    const trimmed = line.trim();
    if (!trimmed.startsWith('(')) {
      if (trimmed.endsWith(';')) currentTable = null;
      return;
    }

    if (currentTable === 'LEADS') {
      const row = parseSqlValues(trimmed);
      if (row.length >= 37) {
        leads.push({
          id: row[0],
          create_time: row[1],
          fullname: row[2],
          email: row[3],
          phone: row[4],
          loai_lead: row[5],
          kenh: row[6],
          du_an: row[7],
          lead_phan_loai: row[8],
          team_nhap: row[9],
          mkt_chiateam: row[10],
          trang_thai: row[11],
          kho_lead: row[14],
          birthday: row[17],
          country: row[18],
          loai_hinh: row[19],
          hinh_thuc_tt: row[20],
          time_lienhe: row[21],
          app_lienhe: row[22],
          nhu_cau: row[23],
          tieu_chi: row[24],
          san_pham: row[25],
          link_fb: row[26],
          form_dangky: row[27],
          time_databank: row[28],
          donvi_chay: row[29],
          lead_tindung: row[30],
          city: row[31],
          client_context: row[32],
          ad_id: row[33],
          campaign: row[34],
          ad_name: row[35],
          inbox_url: row[36]
        });
      }
    } else if (currentTable === 'KHTN') {
      const row = parseSqlValues(trimmed);
      // KHTN columns: id, lead_id, team_id, ngay_tao, full_name, phone, chan_dung, phan_loai_lead, du_an, trang_thai, duan_chamsoc, phone_more, name_real, csdh_time, quantam_time, dongygap_time, dagap_time, booking_time, datcoc_time, image_dongygap, image_dagap, image_UNC, isPersonal, nguoi_nhan, loai_lead, deleted, huy_cham_soc, thoi_gian_nhan, ghim_trongdiem, thongtin_kh_origin, link_fb, nguon_gioithieu, id_bangoc, thuhoi, campaign, old_campaign, duyetgiaodich, sl_booking, cooperator
      if (row.length >= 35) {
        const leadId = row[1];
        const phone = row[5];
        const data = {
          khtn_id: row[0],
          lead_id: leadId,
          chan_dung: row[6],
          phan_loai_lead: row[7],
          csdh_time: row[13],
          quantam_time: row[14],
          dongygap_time: row[15],
          dagap_time: row[16],
          booking_time: row[17],
          datcoc_time: row[18],
          image_dongygap: row[19],
          image_dagap: row[20],
          image_UNC: row[21],
          huy_cham_soc: row[26],
          thongtin_kh_origin: row[29],
          link_fb: row[30],
          campaign: row[34],
          sl_booking: row[37] ? parseInt(row[37]) : null
        };
        if (leadId) khtnMap.set(leadId, data);
        const normP = normalizePhone(phone);
        if (normP) khtnMap.set(normP, data);
      }
    }

    if (trimmed.endsWith(';')) currentTable = null;
  });

  rl.on('close', () => {
    console.log('Finished extraction:');
    console.log('- Total LEADS parsed:', leads.length);
    console.log('- Total KHTN parsed:', khtnMap.size);

    // Merge KHTN tracking data into leads where available
    let mergedKhtn = 0;
    for (const lead of leads) {
      const k = khtnMap.get(lead.id) || khtnMap.get(normalizePhone(lead.phone));
      if (k) {
        mergedKhtn++;
        lead.khtn_id = k.khtn_id;
        lead.chan_dung = k.chan_dung;
        lead.csdh_time = k.csdh_time;
        lead.quantam_time = k.quantam_time;
        lead.dongygap_time = k.dongygap_time;
        lead.dagap_time = k.dagap_time;
        lead.booking_time = k.booking_time;
        lead.datcoc_time = k.datcoc_time;
        lead.image_dongygap = k.image_dongygap;
        lead.image_dagap = k.image_dagap;
        lead.image_UNC = k.image_UNC;
        lead.sl_booking = k.sl_booking;
        lead.thongtin_kh_origin = k.thongtin_kh_origin;
        if (!lead.link_fb && k.link_fb) lead.link_fb = k.link_fb;
        if (!lead.campaign && k.campaign) lead.campaign = k.campaign;
      }
    }
    console.log('- Leads matched with KHTN tracking:', mergedKhtn);

    // Save JSON payload to file
    fs.writeFileSync('scratch/appsheet_extracted.json', JSON.stringify(leads), 'utf8');
    const stats = fs.statSync('scratch/appsheet_extracted.json');
    console.log('- Saved scratch/appsheet_extracted.json size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');

    // Test a specific lead: 948740779 (Phan Lưu)
    const testLead = leads.find(l => normalizePhone(l.phone) === '948740779');
    console.log('\n--- SAMPLE PHAN LƯU (+84948740779) ---');
    console.log(JSON.stringify(testLead, null, 2));
  });
}

extract().catch(console.error);
