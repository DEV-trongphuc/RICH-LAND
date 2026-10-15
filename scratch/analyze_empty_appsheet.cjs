const fs = require('fs');
const readline = require('readline');

async function main() {
  console.log('Phân tích các bản ghi trong scratch/appsheet_extracted.json...');
  const data = JSON.parse(fs.readFileSync('scratch/appsheet_extracted.json', 'utf8'));
  console.log(`Tổng số bản ghi: ${data.length}`);

  // Tìm các bản ghi có phone rỗng hoặc thông tin rỗng
  const emptyPhone = data.filter(d => !d.phone || d.phone.trim() === '');
  console.log(`Số bản ghi không có phone trong AppSheet: ${emptyPhone.length}`);

  // Tìm các bản ghi có ngày liên quan đến 02/10 hoặc tháng 10
  const octLeads = data.filter(d => {
    const raw = JSON.stringify(d);
    return raw.includes('/10/202') || raw.includes('-10-') || raw.includes('02/10') || raw.includes('2/10');
  });
  console.log(`Số bản ghi có mốc thời gian tháng 10: ${octLeads.length}`);

  // Kiểm tra các bản ghi tháng 10 xem có bản ghi nào bị rỗng không
  const octEmpty = octLeads.filter(d => !d.phone || d.phone.trim() === '' || !d.name || d.name.trim() === '');
  console.log(`Số bản ghi tháng 10 bị rỗng phone hoặc name: ${octEmpty.length}`);
  if (octEmpty.length > 0) {
    console.log('Mẫu bản ghi tháng 10 bị rỗng:', JSON.stringify(octEmpty.slice(0, 5), null, 2));
  }

  // Xem tất cả các bản ghi có ngày 2/10 hoặc 02/10
  const oct2Leads = data.filter(d => {
    const raw = JSON.stringify(d);
    return raw.includes('02/10/202') || raw.includes('2/10/202') || raw.includes('-10-02') || raw.includes('-10-2');
  });
  console.log(`\nSố bản ghi liên quan ngày 2/10: ${oct2Leads.length}`);
  console.log('Danh sách các bản ghi ngày 2/10 trong AppSheet:');
  oct2Leads.forEach((l, i) => {
    console.log(`[${i+1}] ID: ${l.id}, Phone: ${l.phone}, Name: ${l.name}, DuAn: ${l.du_an}, PhanLoai: ${l.lead_phan_loai}, LoaiLead: ${l.loai_lead}`);
  });
}

main().catch(console.error);
