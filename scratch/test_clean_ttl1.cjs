const fs = require('fs');

function parseTtl1(text) {
  if (!text) return null;
  const isForm = /FORM phản hồi/i.test(text) || /NGHIÊN CỨU KHÁCH HÀNG/i.test(text);
  if (!isForm) return null;

  const getMatch = (patterns) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  };

  const oDau = getMatch([/ở đâu\s*:\s*([^\n\r]+)/i, /nơi ở\s*:\s*([^\n\r]+)/i]);
  const lamGi = getMatch([/làm gì\s*:\s*([^\n\r]+)/i, /nghề nghiệp\s*:\s*([^\n\r]+)/i, /công việc\s*:\s*([^\n\r]+)/i]);
  const giaDinh = getMatch([/gia đình\s*:\s*([^\n\r]+)/i, /độ tuổi\s*:\s*([^\n\r]+)/i, /tình trạng hôn nhân\s*:\s*([^\n\r]+)/i]);
  const hienTrang = getMatch([/a\.\s*hiện trạng\s*:\s*([\s\S]*?)(?=(?:b\.|nhu cầu|mục đích|rào cản|giải pháp|$))/i, /hiện trạng\s*:\s*([\s\S]*?)(?=(?:b\.|nhu cầu|mục đích|rào cản|giải pháp|$))/i]);
  const nhuCau = getMatch([/b\.\s*nhu cầu(?:\s*mua)?\s*:\s*([\s\S]*?)(?=(?:c\.|rào cản|tài chính|giải pháp|$))/i, /nhu cầu(?:\s*mua)?\s*:\s*([\s\S]*?)(?=(?:c\.|rào cản|tài chính|giải pháp|$))/i, /mục đích\s*:\s*([^\n\r]+)/i]);
  const raoCan = getMatch([/c\.\s*rào cản\s*:\s*([\s\S]*?)(?=(?:d\.|giải pháp|tài chính|3\.|$))/i, /rào cản\s*:\s*([\s\S]*?)(?=(?:d\.|giải pháp|tài chính|3\.|$))/i]);
  const giaiPhap = getMatch([/giải pháp\s*:\s*([\s\S]*?)(?=$)/i]);
  const nganSach = getMatch([/tài chính\s*:\s*([^\n\r]+)/i, /ngân sách\s*:\s*([^\n\r]+)/i]);

  const cleanField = (s) => {
    if (!s) return '';
    return s.replace(/^[\s\r\n\-•:]+/, '').trim();
  };

  return {
    group1: false,
    group2: false,
    group3: false,
    group4: false,
    group5: false,
    o_dau: cleanField(oDau),
    lam_gi: cleanField(lamGi),
    gia_dinh: cleanField(giaDinh),
    hien_trang: cleanField(hienTrang),
    nhu_cau: cleanField(nhuCau),
    rao_can: cleanField(raoCan),
    thong_tin_bo_sung: text.length > 500 ? text.slice(0, 500) + '...' : text,
    giai_phap: cleanField(giaiPhap),
    ngan_sach: cleanField(nganSach)
  };
}

// Test on KHTN260919131514
const sqlDump = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');
const idx = sqlDump.indexOf('KHTN260919131514');
const blockStart = sqlDump.lastIndexOf('INSERT INTO `KHTN`', idx);
const blockEnd = sqlDump.indexOf(';\n', blockStart);
const block = sqlDump.slice(blockStart, blockEnd + 2);

// Use block parser
const row = require('./test_parse_khtn_row.cjs');
// Let's test with cleaned raw text
const rawChanDung = "Phản hồi khách hàng lần 1:\\n\\n1. Nghiên cứu khách hàng:\\n- Ở đâu: Lakeview 12 năm \\n- Làm gì: ở nhà nội trợ \\n- Gia đình: có 2-3 đứa con \\n\\n2. TIẾP CẬN KHÁCH HÀNG - KHAI THÁC NHU CẦU:\\na. Hiện trạng:\\n-  Đã biết Global cũng gần nhà\\n- Mấy nay sale chào chị Palm nhiều \\n- Mong muốn tham khảo trước xem như nào thấy hợp lý tính việc mua tích sản để đó sau này cho con\\n\\nb. NHU CẦU MUA:\\n- 2PN\\n\\nc. Rào Cản:\\n- Chị chê nhạc nước ơ Global xấu được cái tiện ích sau này\\n- Hỏi Palm khá nhiều tư vấn sự khác biệt theo chuẩn hạng sang chị nói 12 tỷ chị ra mua ngoài Ok hơn \\n- Giá Global chị nhớ 5-6 tỷ có tư vấn lại đó giá 1PN chứ 2PN\\nỞ Q2 làm gì giá đó tư Vấn mức giá từ 8 tỷ (để chị xem sao ) \\n\\n3. THÔNG TIN BỔ SUNG ( nếu có):\\n- \\n\\n4. GIẢI PHÁP tiếp theo:\\n- Đức đang kết nối Zalo chào thông tin dự án Palm và cả Global \\n- Anh Tuấn canh tiếp cận tương tác chính Global \\n- Hiển chào dự án mới sắp ra mắt liền kể Global giá chỉ hơn 80tr/m2 \\n- Chị Trang canh để chào mới thẳng vào Palm";

const unescaped = rawChanDung.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '');
const parsed = parseTtl1(unescaped);
console.log('Parsed TTL1 with unescaped text:');
console.log(JSON.stringify(parsed, null, 2));
