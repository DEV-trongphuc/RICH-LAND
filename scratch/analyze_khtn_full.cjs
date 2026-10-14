const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

const startRegex = /INSERT\s+INTO\s+`KHTN`/gi;
let match;
const startIndices = [];
while ((match = startRegex.exec(content)) !== null) {
  startIndices.push(match.index);
}

function extractFullStatement(str, startIdx) {
  let inQuote = false;
  let quoteChar = '';
  let isEscaped = false;

  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (ch === '\\') {
      isEscaped = true;
      continue;
    }
    if (!inQuote && (ch === "'" || ch === '"')) {
      inQuote = true;
      quoteChar = ch;
      continue;
    }
    if (inQuote && ch === quoteChar) {
      inQuote = false;
      continue;
    }
    if (!inQuote && ch === ';') {
      return str.slice(startIdx, i + 1);
    }
  }
  return str.slice(startIdx);
}

function parseSqlTuples(block) {
  const tuples = [];
  let inTuple = false;
  let inQuote = false;
  let quoteChar = '';
  let isEscaped = false;
  let currentTuple = '';

  for (let i = 0; i < block.length; i++) {
    const ch = block[i];

    if (isEscaped) {
      if (inTuple) currentTuple += ch;
      isEscaped = false;
      continue;
    }

    if (ch === '\\') {
      isEscaped = true;
      if (inTuple) currentTuple += ch;
      continue;
    }

    if (!inQuote && (ch === "'" || ch === '"')) {
      inQuote = true;
      quoteChar = ch;
      if (inTuple) currentTuple += ch;
      continue;
    }

    if (inQuote && ch === quoteChar) {
      inQuote = false;
      if (inTuple) currentTuple += ch;
      continue;
    }

    if (!inQuote && ch === '(') {
      inTuple = true;
      currentTuple = '';
      continue;
    }

    if (!inQuote && ch === ')') {
      inTuple = false;
      tuples.push(currentTuple);
      currentTuple = '';
      continue;
    }

    if (inTuple) {
      currentTuple += ch;
    }
  }
  return tuples;
}

function splitTupleValues(tupleStr) {
  const vals = [];
  let inQuote = false;
  let quoteChar = '';
  let isEscaped = false;
  let currentVal = '';

  for (let i = 0; i < tupleStr.length; i++) {
    const ch = tupleStr[i];

    if (isEscaped) {
      currentVal += ch;
      isEscaped = false;
      continue;
    }

    if (ch === '\\') {
      isEscaped = true;
      currentVal += ch;
      continue;
    }

    if (!inQuote && (ch === "'" || ch === '"')) {
      inQuote = true;
      quoteChar = ch;
      continue;
    }

    if (inQuote && ch === quoteChar) {
      inQuote = false;
      continue;
    }

    if (!inQuote && ch === ',') {
      vals.push(currentVal.trim() === 'NULL' ? null : currentVal.trim().replace(/^'|'$/g, ''));
      currentVal = '';
      continue;
    }

    currentVal += ch;
  }
  vals.push(currentVal.trim() === 'NULL' ? null : currentVal.trim().replace(/^'|'$/g, ''));
  return vals;
}

const trueStatements = startIndices.map(idx => extractFullStatement(content, idx));
const uniqueIds = new Set();
let deletedCount = 0;
let huyCount = 0;
const statusDistribution = {};
const allKhtn = [];

trueStatements.forEach(stmt => {
  const tuples = parseSqlTuples(stmt);
  tuples.forEach(t => {
    const p = splitTupleValues(t);
    // KHTN columns:
    // 0: id, 1: lead_id, 2: team_id, 3: ngay_tao, 4: full_name, 5: phone, 6: chan_dung,
    // 7: phan_loai_lead, 8: du_an, 9: trang_thai, 10: duan_chamsoc, 11: phone_more,
    // 12: name_real, 13: csdh_time, 14: quantam_time, 15: dongygap_time, 16: dagap_time,
    // 17: booking_time, 18: datcoc_time, 19: image_dongygap, 20: image_dagap, 21: image_UNC,
    // 22: isPersonal?, 23: nguoi_nhan, 24: loai_lead, 25: deleted, 26: huy_cham_soc,
    // 27: thoi_gian_nhan, 28: ghim_trongdiem, 29: thongtin_kh_origin, 30: link_fb,
    // 31: nguon_gioithieu, 32: id_bangoc, 33: thuhoi, 34: campaign, 35: old_campaign,
    // 36: duyetgiaodich, 37: sl_booking, 38: cooperator
    const id = p[0];
    const isDeleted = p[25] === '1' || p[25] === "b'1'";
    const isHuy = p[26] === '1' || p[26] === "b'1'";
    const status = p[9];

    if (uniqueIds.has(id)) {
      // duplicate id in dump?
    } else {
      uniqueIds.add(id);
    }

    if (isDeleted) deletedCount++;
    if (isHuy) huyCount++;

    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
    allKhtn.push({ id, status, isDeleted, isHuy, phone: p[5], du_an: p[8], nguoi_nhan: p[23] });
  });
});

console.log(`Total extracted rows: ${allKhtn.length}`);
console.log(`Unique KHTN IDs: ${uniqueIds.size}`);
console.log(`Deleted rows (deleted=1): ${deletedCount}`);
console.log(`Huy cham soc (huy_cham_soc=1): ${huyCount}`);
console.log('Status distribution:', JSON.stringify(statusDistribution, null, 2));
