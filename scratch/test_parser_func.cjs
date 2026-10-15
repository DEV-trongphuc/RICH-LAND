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
  if (v === 'NULL') return null;
  if (v === "b'0'") return 0;
  if (v === "b'1'") return 1;
  return v;
}

// Test with row
const test = "('1000362898985753', '2026-03-24 10:50:33', 'Trân Lê Ngọc', '', '+84938722750', 'lead_form', 'FbAds', 'DA510070846282828', 'R3_Fb', NULL, 'TM509031107393939', '4', NULL, NULL, 'DA510070846282828', b'0', NULL, NULL, NULL, '3pn_98-110m2', NULL, NULL, 'Zalo', NULL, NULL, NULL, '', 'Masteri Park Place | CT4 - Đăng Ký Nhận Tư Vấn Báo', '2026-03-28 15:07:12', 'Rich Land VN', NULL, NULL, NULL, '120243144613350651', 'CAMP603091659353535', 'CT40125-MOFU-VID-01-MIENG NGON', '')";

const parsed = parseSqlValues(test);
console.log('Values count:', parsed.length);
console.log('Values:', parsed);
