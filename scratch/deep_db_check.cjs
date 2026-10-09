const https = require('https');
const fs = require('fs');

function queryDb(sql) {
  return new Promise((resolve, reject) => {
    const postData = 'key=richland2026&sql=' + encodeURIComponent(sql);
    const req = https.request('https://crm.richland.city/backend/exec_db_query.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: e.message, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function deepCheck() {
  console.log('=== 1. Checking other databases or schemas ===');
  const dbs = await queryDb('SHOW DATABASES');
  console.log('Databases available:', dbs.data ? dbs.data.map(d => Object.values(d)[0]) : dbs);

  console.log('=== 2. Checking Triggers ===');
  const triggers = await queryDb("SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'zccqvhhh_crm-rlvn'");
  console.log('Triggers count:', triggers.count);
  if (triggers.data && triggers.data.length > 0) {
    console.log('Triggers details:', JSON.stringify(triggers.data, null, 2));
  }

  console.log('=== 3. Checking Stored Procedures and Functions (Routines) ===');
  const routines = await queryDb("SELECT ROUTINE_NAME, ROUTINE_TYPE, DTD_IDENTIFIER FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'zccqvhhh_crm-rlvn'");
  console.log('Routines count:', routines.count);
  if (routines.data && routines.data.length > 0) {
    console.log('Routines:', routines.data);
  }

  console.log('=== 4. Checking Scheduled Events ===');
  const events = await queryDb("SELECT EVENT_NAME, STATUS, INTERVAL_VALUE, INTERVAL_FIELD FROM information_schema.EVENTS WHERE EVENT_SCHEMA = 'zccqvhhh_crm-rlvn'");
  console.log('Events count:', events.count);
  if (events.data && events.data.length > 0) {
    console.log('Events:', events.data);
  }

  console.log('=== 5. Checking Views SQL Definition ===');
  const vAcc = await queryDb("SHOW CREATE TABLE accounts");
  console.log('accounts definition:', vAcc.data ? vAcc.data[0]['Create View'] : null);
  const vCons = await queryDb("SHOW CREATE TABLE consultants");
  console.log('consultants definition:', vCons.data ? vCons.data[0]['Create View'] : null);

  console.log('=== 6. Exact SELECT COUNT(*) for all 100 tables ===');
  const rawSchema = JSON.parse(fs.readFileSync('backend/db_schema_full_live.json', 'utf8'));
  const allTableNames = Object.keys(rawSchema.tables);
  const exactCounts = {};
  
  // Batch queries in chunks of 10 with UNION or individual queries
  for (const tbl of allTableNames) {
    try {
      const cRes = await queryDb(`SELECT COUNT(*) AS cnt FROM \`${tbl}\``);
      exactCounts[tbl] = cRes.data ? Number(cRes.data[0].cnt) : 0;
    } catch (e) {
      exactCounts[tbl] = -1;
    }
  }

  // Compare with InnoDB estimates
  const differences = [];
  for (const tbl of allTableNames) {
    const estimated = Number(rawSchema.tables[tbl].rows);
    const exact = exactCounts[tbl];
    if (estimated !== exact) {
      differences.push({ table: tbl, innoDbEstimate: estimated, exactCount: exact });
    }
  }
  console.log(`Tables where exact COUNT(*) differs from InnoDB estimate: ${differences.length}`);
  console.table(differences.slice(0, 30));

  console.log('=== 7. Identifying Implicit / Logical Foreign Keys ===');
  // Check columns ending in _id or starting with id_ that don't have an explicit FK
  const explicitFks = new Set();
  for (const t of allTableNames) {
    for (const fk of rawSchema.tables[t].foreignKeys) {
      explicitFks.add(`${t}.${fk.column}`);
    }
  }

  const implicitRelations = [];
  const knownTables = new Set(allTableNames);

  for (const t of allTableNames) {
    const cols = rawSchema.tables[t].columns;
    for (const c of cols) {
      const field = c.field;
      if (field === 'id') continue;
      if (explicitFks.has(`${t}.${field}`)) continue;

      // Check common patterns
      let targetTable = null;
      let targetCol = 'id';

      if (field.endsWith('_id')) {
        const base = field.replace(/_id$/, '');
        // pluralize
        if (knownTables.has(base + 's')) targetTable = base + 's';
        else if (knownTables.has(base + 'es')) targetTable = base + 'es';
        else if (knownTables.has(base)) targetTable = base;
        else if (base === 'owner' || base === 'creator' || base === 'assigned' || base === 'assigned_to' || base === 'created_by' || base === 'updated_by' || base === 'consultant' || base === 'admin' || base === 'leader' || base === 'user') targetTable = 'users';
        else if (base === 'lead' && knownTables.has('leads')) targetTable = 'leads';
        else if (base === 'contact' && knownTables.has('contacts')) targetTable = 'contacts';
        else if (base === 'person' && knownTables.has('persons')) targetTable = 'persons';
        else if (base === 'project' && knownTables.has('projects')) targetTable = 'projects';
        else if (base === 'stage' && knownTables.has('pipeline_stages')) targetTable = 'pipeline_stages';
        else if (base === 'round' && knownTables.has('distribution_rounds')) targetTable = 'distribution_rounds';
        else if (base === 'team' && knownTables.has('teams')) targetTable = 'teams';
        else if (base === 'tenant' && knownTables.has('tenants')) targetTable = 'tenants';
      }

      if (targetTable && knownTables.has(targetTable)) {
        implicitRelations.push({
          fromTable: t,
          fromColumn: field,
          targetTable: targetTable,
          targetColumn: targetCol
        });
      }
    }
  }

  console.log(`Found ${implicitRelations.length} IMPLICIT / LOGICAL foreign keys in addition to the 146 explicit FKs!`);
  console.log('Sample implicit relations:');
  console.table(implicitRelations.slice(0, 25));

  fs.writeFileSync('scratch/deep_audit_results.json', JSON.stringify({
    exactCounts,
    differences,
    triggers: triggers.data || [],
    routines: routines.data || [],
    events: events.data || [],
    views: {
      accounts: vAcc.data ? vAcc.data[0]['Create View'] : null,
      consultants: vCons.data ? vCons.data[0]['Create View'] : null
    },
    implicitRelations
  }, null, 2));

  console.log('Saved deep audit results to scratch/deep_audit_results.json');
}

deepCheck().catch(console.error);
