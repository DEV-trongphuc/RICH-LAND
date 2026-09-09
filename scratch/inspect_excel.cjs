const xlsx = require('xlsx');
const wb = xlsx.readFile('D:/Downloads/Untitled spreadsheet (3).xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
data.slice(0, 25).forEach((r, idx) => {
  console.log(JSON.stringify({
    row: idx + 1,
    id: r.id,
    ho_ten: r.ho_ten,
    Salename: r.Salename,
    email: r.email,
    phan_quyen: r.phan_quyen,
    trang_thai: r.trang_thai_lam_viec,
    phong_ban: r.phong_ban,
    password: r.password
  }));
});
