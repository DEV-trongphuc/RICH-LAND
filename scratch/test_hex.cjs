const { query } = require('./query.cjs');

async function testHex() {
  const res1 = await query(`
    SELECT c.id, c.notes, c.lead_id, l.note as lead_note, l.raw_payload
    FROM contacts c
    LEFT JOIN leads l ON c.lead_id = l.id
    WHERE c.id = 10830;
  `);
  const cRes = await query("SELECT id, notes, ttl1_data FROM contacts WHERE id = 10830;");
  console.log('Contact 10830 notes JSON:', JSON.stringify(cRes.data[0]?.notes));
  console.log('Contact 10830 ttl1 JSON:', JSON.stringify(cRes.data[0]?.ttl1_data?.slice(0, 250)));
  return;
  console.log('Contacts ttl1 counts:', res.data);
  const allContacts = await query("SELECT id, notes, ttl1_data FROM contacts WHERE notes IS NOT NULL OR ttl1_data IS NOT NULL;");
  let countLiteralInNotes = 0;
  let countLiteralInTtl1 = 0;
  const sampleNotes = [];
  const sampleTtl1 = [];

  for (const c of (allContacts.data || [])) {
    if (c.notes && c.notes.includes(String.raw`\n`)) {
      countLiteralInNotes++;
      if (sampleNotes.length < 3) sampleNotes.push({ id: c.id, notes: c.notes.slice(0, 100) });
    }
    if (c.ttl1_data && c.ttl1_data.includes(String.raw`\n`)) {
      countLiteralInTtl1++;
      if (sampleTtl1.length < 3) sampleTtl1.push({ id: c.id, snippet: c.ttl1_data.slice(0, 120) });
    }
  }

  console.log(`Contacts with literal \\\\n in notes: ${countLiteralInNotes} / ${allContacts.data?.length}`);
  console.log(`Contacts with literal \\\\n or \\\n in ttl1_data: ${countLiteralInTtl1} / ${allContacts.data?.length}`);
  console.log('Sample notes:', sampleNotes);
  console.log('Sample ttl1:', sampleTtl1);
}

testHex();
