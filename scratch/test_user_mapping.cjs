const xlsx = require('xlsx');
const wb = xlsx.readFile('D:/Downloads/Untitled spreadsheet (3).xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

function cleanSalename(s) {
  if (!s) return '';
  return s.trim()
    .replace(/\.tamkhoa$/i, '')
    .replace(/\/nghilam$/i, '')
    .replace(/\.xoá$/i, '')
    .replace(/\/dakhoa$/i, '')
    .replace(/\.dakhoa$/i, '')
    .replace(/tamkhoa$/i, '')
    .trim();
}

const parsedUsers = [];
const seenEmails = new Set();
const seenUsernames = new Set();

data.forEach((r, idx) => {
  const rowNum = idx + 1;
  const rawSalename = (r.Salename || '').trim();
  const cleanedSalename = cleanSalename(rawSalename);
  let email = (r.email || '').trim().toLowerCase();
  
  // Shared emails in Excel
  const isSharedEmail = ['phongkinhdoanh.as001@gmail.com', 'phongkinhdoanh.as002@gmail.com', 'hethong@richland.city'].includes(email);
  
  let finalEmail = email;
  if (!finalEmail || isSharedEmail) {
    if (cleanedSalename.includes('@')) {
      finalEmail = cleanedSalename.toLowerCase();
    } else if (cleanedSalename) {
      finalEmail = `${cleanedSalename.toLowerCase()}@richland.city`;
    }
  }

  // Determine username
  let username = '';
  if (cleanedSalename.includes('@')) {
    username = cleanedSalename.split('@')[0].toLowerCase();
  } else {
    username = cleanedSalename.toLowerCase();
  }

  // If Admin MTP (row 1 is admin)
  if (cleanedSalename === 'admin' || r.id === 'ADMIN1') {
    // Row 1 is the generic admin in excel
  }

  parsedUsers.push({
    row: rowNum,
    excel_id: r.id,
    full_name: r.ho_ten,
    rawSalename,
    cleanedSalename,
    username,
    email: finalEmail,
    role: r.phan_quyen === 'Admin' ? 'admin' : 'sales',
    status: r.trang_thai_lam_viec === 'Đã Nghỉ' ? 'inactive' : 'active',
    phong_ban: r.phong_ban || 'Phòng Kinh Doanh',
    password: r.password || 'RLVN@123456'
  });
});

console.log('Total parsed:', parsedUsers.length);
parsedUsers.forEach(u => {
  const dupEmail = seenEmails.has(u.email);
  const dupUser = seenUsernames.has(u.username);
  if (dupEmail || dupUser) {
    console.log(`COLLISION at row ${u.row}: email=${u.email} (dup=${dupEmail}), user=${u.username} (dup=${dupUser})`);
  }
  seenEmails.add(u.email);
  seenUsernames.add(u.username);
});

console.log('Unique Emails:', seenEmails.size);
console.log('Unique Usernames:', seenUsernames.size);

const existingDbUsers = [
  { id: 1003, username: 'admin', email: 'turniodev@gmail.com', full_name: 'Admin MTP' },
  { id: 100072, username: 'ngochuyen', email: 'ngochuyen@richland.city', full_name: 'Ngọc Huyền' },
  { id: 100073, username: 'baduong', email: 'baduong@richland.city', full_name: 'Bá Dương' },
  { id: 100074, username: 'ngochien', email: 'ngochien@richland.city', full_name: 'Ngọc Hiển' },
  { id: 100075, username: 'khacphu@richland.city', email: 'khacphu@richland.city', full_name: 'Khắc Phú' },
  { id: 100076, username: 'conghoa@richland.city', email: 'conghoa@richland.city', full_name: 'Công Hoà' },
  { id: 100077, username: null, email: 'dom.marketing.vn@gmail.com', full_name: 'haidang' }
];

existingDbUsers.forEach(dbU => {
  const match = parsedUsers.find(u => 
    u.email.toLowerCase() === dbU.email.toLowerCase() ||
    (dbU.username && u.username.toLowerCase() === dbU.username.toLowerCase()) ||
    u.full_name.toLowerCase() === dbU.full_name.toLowerCase()
  );
  console.log(`DB User [${dbU.id}] ${dbU.full_name} (${dbU.email}) -> Match Excel: ${match ? match.full_name + ' (' + match.email + ' / ' + match.username + ')' : 'NO MATCH'}`);
});
