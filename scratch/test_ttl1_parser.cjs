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
  const hienTrang = getMatch([/hiện trạng\s*:\s*([\s\S]*?)(?=(?:b\.|nhu cầu|mục đích|rào cản|giải pháp|$))/i]);
  const nhuCau = getMatch([/nhu cầu(?:\s*mua)?\s*:\s*([\s\S]*?)(?=(?:rào cản|tài chính|giải pháp|$))/i, /mục đích\s*:\s*([^\n\r]+)/i]);
  const raoCan = getMatch([/rào cản\s*:\s*([\s\S]*?)(?=(?:giải pháp|tài chính|c\.|3\.|$))/i]);
  const giaiPhap = getMatch([/giải pháp\s*:\s*([\s\S]*?)(?=$)/i]);
  const nganSach = getMatch([/tài chính\s*:\s*([^\n\r]+)/i, /ngân sách\s*:\s*([^\n\r]+)/i]);

  return {
    group1: false,
    group2: false,
    group3: false,
    group4: false,
    group5: false,
    o_dau: oDau,
    lam_gi: lamGi,
    gia_dinh: giaDinh,
    hien_trang: hienTrang,
    nhu_cau: nhuCau,
    rao_can: raoCan,
    thong_tin_bo_sung: text.length > 500 ? text.slice(0, 500) + '...' : text,
    giai_phap: giaiPhap,
    ngan_sach: nganSach
  };
}

// Test sample
const sample = `FORM phản hồi khách hàng lần 1:

1. NGHIÊN CỨU KHÁCH HÀNG: 
- Ở đâu: Toronto - Mỹ
- Độ tuổi: trên 60

2. TIẾP CẬN KHÁCH HÀNG - KHAI THÁC NHU CẦU:

a. HIỆN TRẠNG: chị ko rành khu đó lắm, nói Thảo Điền, Cầu SG hay L81 thì chị biết. 2 năm rồi chị chưa về VN. Chị mới xem tt trên fb của bên em thôi.


b. NHU CẦU MUA:
- Mục đích: trước mắt mua đầu tư cho thuê, sau có thể chị về ở.
- Tài chính: trên dưới 10 tỷ
- Rào cản: ko còn quốc tịch VN, chị đang tham khảo nhiều dự án, trong đó có La Tiên, Hồ Tràm cũng đã được các bạn sale tư vấn. Các dự án đó 50 năm cũng là rào cản khi chị tìm hiểu.

c. GIẢI PHÁP: 
- Đề xuất chị nhờ người nhà đứng tên bà đi xem dự án dùm.
- Gia đình chị hiện đang ở Q4, ông bà mất hết rồi, hiện chị còn 1 ông anh...`;

console.log(JSON.stringify(parseTtl1(sample), null, 2));
