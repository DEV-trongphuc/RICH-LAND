const https = require('https');
const fs = require('fs');
const path = require('path');

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
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ error: e.message, raw: data.slice(0, 1000) });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('--- 1. Pulling Table Status ---');
  const statusRes = await queryDb('SHOW TABLE STATUS');
  if (!statusRes.data) {
    console.error('Failed to get table status:', statusRes);
    process.exit(1);
  }
  const tableStatus = statusRes.data;
  console.log(`Found ${tableStatus.length} tables/views in database.`);

  console.log('--- 2. Pulling Foreign Key Constraints from information_schema ---');
  const fkRes = await queryDb(`
    SELECT 
      CONSTRAINT_NAME, 
      TABLE_NAME, 
      COLUMN_NAME, 
      REFERENCED_TABLE_NAME, 
      REFERENCED_COLUMN_NAME 
    FROM information_schema.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'zccqvhhh_crm-rlvn' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `);
  const foreignKeys = fkRes.data || [];
  console.log(`Found ${foreignKeys.length} explicit foreign key constraints.`);

  console.log('--- 3. Pulling Columns and Indexes for each table ---');
  const fullSchema = {};
  const standardSchemaForFe = {};
  let processed = 0;

  for (const tbl of tableStatus) {
    const tableName = tbl.Name;
    const isView = tbl.Engine === null || tbl.Comment === 'VIEW';

    // Get columns
    const colsRes = await queryDb(`SHOW FULL COLUMNS FROM \`${tableName}\``);
    const cols = colsRes.data || [];

    // Get indexes
    let indexes = [];
    if (!isView) {
      const idxRes = await queryDb(`SHOW INDEX FROM \`${tableName}\``);
      indexes = idxRes.data || [];
    }

    // Get row count
    let rowCount = tbl.Rows;
    if (rowCount === null || rowCount === undefined) {
      rowCount = 0;
    }

    fullSchema[tableName] = {
      name: tableName,
      isView: isView,
      engine: tbl.Engine || 'VIEW',
      rows: rowCount,
      dataLength: tbl.Data_length || 0,
      indexLength: tbl.Index_length || 0,
      collation: tbl.Collation || '',
      comment: tbl.Comment || '',
      columns: cols.map(c => ({
        field: c.Field,
        type: c.Type,
        collation: c.Collation,
        null: c.Null,
        key: c.Key,
        default: c.Default,
        extra: c.Extra,
        privileges: c.Privileges,
        comment: c.Comment
      })),
      indexes: indexes.map(i => ({
        name: i.Key_name,
        column: i.Column_name,
        seq: i.Seq_in_index,
        nonUnique: i.Non_unique,
        indexType: i.Index_type,
        comment: i.Index_comment
      })),
      foreignKeys: foreignKeys.filter(fk => fk.TABLE_NAME === tableName).map(fk => ({
        name: fk.CONSTRAINT_NAME,
        column: fk.COLUMN_NAME,
        referencedTable: fk.REFERENCED_TABLE_NAME,
        referencedColumn: fk.REFERENCED_COLUMN_NAME
      }))
    };

    // Also build format compatible with db_schema.json (used by Settings.tsx ERD tab)
    standardSchemaForFe[tableName] = cols.map(c => ({
      field: c.Field,
      type: c.Type,
      null: c.Null,
      key: c.Key === 'PRI' ? 'PRI' : (c.Key === 'UNI' ? 'UNI' : (c.Key === 'MUL' ? 'MUL' : '')),
      default: c.Default,
      extra: c.Extra
    }));

    processed++;
    if (processed % 10 === 0 || processed === tableStatus.length) {
      console.log(`Processed ${processed}/${tableStatus.length} tables...`);
    }
  }

  // Save to JSON files
  const liveAuditPath = path.join(__dirname, '..', 'backend', 'db_schema_full_live.json');
  fs.writeFileSync(liveAuditPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTables: tableStatus.length,
    totalForeignKeys: foreignKeys.length,
    tables: fullSchema
  }, null, 2), 'utf-8');
  console.log(`Saved full schema metadata to ${liveAuditPath}`);

  // Update standard db_schema.json in backend & frontend
  const feJson = JSON.stringify({
    success: true,
    schema: standardSchemaForFe
  }, null, 2);

  const backendSchemaPath = path.join(__dirname, '..', 'backend', 'db_schema.json');
  fs.writeFileSync(backendSchemaPath, feJson, 'utf-8');
  console.log(`Updated ${backendSchemaPath}`);

  const feSchemaPath = path.join(__dirname, '..', 'src', 'assets', 'db_schema.json');
  if (fs.existsSync(path.dirname(feSchemaPath))) {
    fs.writeFileSync(feSchemaPath, feJson, 'utf-8');
    console.log(`Updated ${feSchemaPath}`);
  }

  console.log('✅ Ground truth pulling complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
