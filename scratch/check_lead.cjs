const https = require('https');

const sql = `SELECT id, name, phone, lead_phan_loai, loai_lead, donvi_chay, facebook_link, form_name, ad_id, ad_name, campaign_id, platform, loai_hinh, hinh_thuc_tt, time_lienhe, app_lienhe, nhu_cau, tieu_chi, san_pham, city, inbox_url, client_context, mkt_chiateam, kho_lead, lead_tindung, time_databank, appsheet_id FROM leads WHERE phone LIKE '%948740779%' LIMIT 1`;

const postData = `key=richland2026&sql=${encodeURIComponent(sql)}`;

const req = https.request({
  hostname: 'crm.richland.city',
  port: 443,
  path: '/backend/exec_db_query.php',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      console.log(JSON.stringify(JSON.parse(body), null, 2));
    } catch(e) {
      console.log(body);
    }
  });
});

req.write(postData);
req.end();
