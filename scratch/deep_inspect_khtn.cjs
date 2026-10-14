const fs = require('fs');
const readline = require('readline');
const { query } = require('./query.cjs');

async function inspectKHTN() {
  console.log('--- 1. Phân tích trường phan_loai_lead & chan_dung trong KHTN ---');
  const fileStream = fs.createReadStream('D:\\Downloads\\AppsheetRLVN.sql');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let inKHTN = false;
  const phanLoaiCounts = {};
  const loaiLeadCounts = {};
  const trangThaiCounts = {};
  const nguoiNhanCounts = {};
  let totalKHTN = 0;
  let hasChanDung = 0;
  let hasTTL1 = 0;
  const sampleTTL1 = [];

  for await (const line of rl) {
    if (line.includes('INSERT INTO `KHTN`') || line.includes('INSERT INTO KHTN')) {
      inKHTN = true;
      continue;
    }
    if (inKHTN) {
      if (line.includes('INSERT INTO') || line.includes('CREATE TABLE')) {
        inKHTN = false;
        continue;
      }
      if (line.trim().startsWith('(')) {
        totalKHTN++;
        // parse row values
        // KHTN columns: id, lead_id, team_id, ngay_tao, full_name, phone, chan_dung, phan_loai_lead, du_an, trang_thai, duan_chamsoc, phone_more, name_real, csdh_time, quantam_time, dongygap_time, dagap_time, booking_time, datcoc_time, image_dongygap, image_dagap, image_UNC, nguoi_nhan, loai_lead, deleted, huy_cham_soc, thoi_gian_nhan, ghim_trongdiem, thongtin_kh_origin, link_fb, nguon_gioithieu, id_bangoc, thuhoi, campaign, old_campaign, duyetgiaodich, sl_booking, cooperator
        
        // Let's do regex match for the columns
        // Match: ('id', 'lead_id', 'team_id', 'ngay_tao', 'full_name', 'phone', 'chan_dung', 'phan_loai_lead', 'du_an', 'trang_thai', ...
        const m = line.match(/^\s*\('([^']*)',\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([\s\S]*?)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL),\s*(?:'([^']*)'|NULL)/);
        
        if (m) {
          const [_, id, lead_id, team_id, ngay_tao, full_name, phone, chan_dung, phan_loai_lead, du_an, trang_thai] = m;
          
          if (phan_loai_lead) {
            phanLoaiCounts[phan_loai_lead] = (phanLoaiCounts[phan_loai_lead] || 0) + 1;
          } else {
            phanLoaiCounts['NULL/Empty'] = (phanLoaiCounts['NULL/Empty'] || 0) + 1;
          }

          if (trang_thai) {
            trangThaiCounts[trang_thai] = (trangThaiCounts[trang_thai] || 0) + 1;
          }

          if (chan_dung && chan_dung.trim().length > 0) {
            hasChanDung++;
            if (/ttl1|nghiên cứu|tiếp cận|khai thác/i.test(chan_dung)) {
              hasTTL1++;
              if (sampleTTL1.length < 3) {
                sampleTTL1.push({ id, full_name, phone, phan_loai_lead, chan_dung: chan_dung.slice(0, 150) });
              }
            }
          }
        }
      }
    }
  }

  console.log(`Tổng số bản ghi KHTN: ${totalKHTN}`);
  console.log(`Số KHTN có chan_dung: ${hasChanDung}`);
  console.log(`Số KHTN có chan_dung chứa TTL1/Nghiên cứu: ${hasTTL1}`);
  console.log('\nThống kê phan_loai_lead trong KHTN (AppSheet):', phanLoaiCounts);
  console.log('\nThống kê trang_thai trong KHTN (AppSheet):', trangThaiCounts);
  console.log('\nSample KHTN có TTL1:', sampleTTL1);

  // Check TTL1 fields in contacts table in MySQL
  console.log('\n--- 2. Kiểm tra contacts.ttl1_completed và ttl1_data trong MySQL ---');
  const ttl1Stats = await query(`
    SELECT 
      COUNT(*) as total_contacts,
      SUM(CASE WHEN ttl1_completed = 1 THEN 1 ELSE 0 END) as ttl1_completed_count,
      SUM(CASE WHEN ttl1_data IS NOT NULL AND ttl1_data != '' THEN 1 ELSE 0 END) as ttl1_data_count,
      SUM(CASE WHEN notes IS NOT NULL AND notes != '' THEN 1 ELSE 0 END) as notes_field_count
    FROM contacts
    WHERE deleted_at IS NULL;
  `);
  console.log('Thống kê TTL1 trên CRM MySQL hiện tại:', ttl1Stats.data[0]);

  // Check sample contacts with ttl1_completed = 1 or ttl1_data
  const sampleDbTTL1 = await query(`
    SELECT id, first_name, last_name, phone, source, ttl1_completed, ttl1_data, LEFT(notes, 100) as note_preview
    FROM contacts
    WHERE ttl1_completed = 1 OR (ttl1_data IS NOT NULL AND ttl1_data != '')
    LIMIT 3;
  `);
  console.log('\nSample contacts có ttl1 trong CRM:', sampleDbTTL1.data);
}

inspectKHTN().catch(console.error);
