const fs = require('fs');
const { query } = require('./query.cjs');

function splitTupleValues(tupleStr) {
  const vals = [];
  let inQuote = false;
  let quoteChar = '';
  let isEscaped = false;
  let currentVal = '';

  for (let i = 0; i < tupleStr.length; i++) {
    const ch = tupleStr[i];
    if (isEscaped) { currentVal += ch; isEscaped = false; continue; }
    if (ch === '\\') { isEscaped = true; currentVal += ch; continue; }
    if (!inQuote && (ch === "'" || ch === '"')) { inQuote = true; quoteChar = ch; continue; }
    if (inQuote && ch === quoteChar) { inQuote = false; continue; }
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

function parseSqlTuples(block) {
  const tuples = [];
  let inTuple = false;
  let inQuote = false;
  let quoteChar = '';
  let isEscaped = false;
  let currentTuple = '';

  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (isEscaped) { if (inTuple) currentTuple += ch; isEscaped = false; continue; }
    if (ch === '\\') { isEscaped = true; if (inTuple) currentTuple += ch; continue; }
    if (!inQuote && (ch === "'" || ch === '"')) { inQuote = true; quoteChar = ch; if (inTuple) currentTuple += ch; continue; }
    if (inQuote && ch === quoteChar) { inQuote = false; if (inTuple) currentTuple += ch; continue; }
    if (!inQuote && ch === '(') { inTuple = true; currentTuple = ''; continue; }
    if (!inQuote && ch === ')') { inTuple = false; tuples.push(currentTuple); currentTuple = ''; continue; }
    if (inTuple) currentTuple += ch;
  }
  return tuples;
}

async function analyzeMissingContacts() {
  const contactMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\contact_map.json', 'utf8'));
  const leadMap = JSON.parse(fs.readFileSync('D:\\RICH_LAND_DATA_UI\\scratch\\migration\\lead_map.json', 'utf8'));
  
  const res = await query("SELECT id, lead_id, person_id FROM contacts;");
  const contacts = res.data || [];
  const byLeadId = new Map();
  const byPersonId = new Map();
  contacts.forEach(c => {
    if (c.lead_id) byLeadId.set(String(c.lead_id), c.id);
    if (c.person_id) byPersonId.set(String(c.person_id), c.id);
  });

  const content = fs.readFileSync('C:\\Users\\LENOVO\\Downloads\\AppsheetRLVN.sql', 'utf8');

  function checkTable(tableName) {
    const startRegex = new RegExp(`INSERT\\s+INTO\\s+\`${tableName}\``, 'gi');
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
        if (isEscaped) { isEscaped = false; continue; }
        if (ch === '\\') { isEscaped = true; continue; }
        if (!inQuote && (ch === "'" || ch === '"')) { inQuote = true; quoteChar = ch; continue; }
        if (inQuote && ch === quoteChar) { inQuote = false; continue; }
        if (!inQuote && ch === ';') return str.slice(startIdx, i + 1);
      }
      return str.slice(startIdx);
    }

    let matched = 0;
    const missingLeads = new Set();
    const missingKhtns = new Set();

    const trueStatements = startIndices.map(idx => extractFullStatement(content, idx));
    trueStatements.forEach(stmt => {
      const tuples = parseSqlTuples(stmt);
      tuples.forEach(t => {
        const p = splitTupleValues(t);
        if (p[0] === '`id`' || p[0] === 'id') return;
        const khtnId = p[1];
        const parentId = p[6];
        const leadId = p[7];

        let contactId = null;
        if (khtnId && contactMap[khtnId]) {
          contactId = contactMap[khtnId].crm_contact_id;
        } else if (parentId && contactMap[parentId]) {
          contactId = contactMap[parentId].crm_contact_id;
        } else if (leadId && leadMap[leadId]) {
          const lInfo = leadMap[leadId];
          if (lInfo.crm_lead_id && byLeadId.has(String(lInfo.crm_lead_id))) {
            contactId = byLeadId.get(String(lInfo.crm_lead_id));
          } else if (lInfo.person_id && byPersonId.has(String(lInfo.person_id))) {
            contactId = byPersonId.get(String(lInfo.person_id));
          }
        }

        if (contactId) {
          matched++;
        } else {
          if (leadId) missingLeads.add(leadId);
          if (khtnId) missingKhtns.add(khtnId);
        }
      });
    });

    console.log(`Table ${tableName}: Total Matched = ${matched}, Missing Leads = ${missingLeads.size}, Missing KHTN IDs = ${missingKhtns.size}`);
    return { missingLeads, missingKhtns };
  }

  const m1 = checkTable('LS_CSKH');
  const m2 = checkTable('LS_CSKH_bangphu');

  const allMissingLeads = new Set([...m1.missingLeads, ...m2.missingLeads]);
  console.log(`\nTotal unique missing leads across all notes: ${allMissingLeads.size}`);
}

analyzeMissingContacts();
