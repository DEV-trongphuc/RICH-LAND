const fs = require('fs');
const file = 'e:/GIAO_DATA_GOOGLESHEETS/src/pages/RuleSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Put back the Điều kiện kết hợp AND/OR block
const andOrRegex = /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '0\.75rem' \}\}>\s*<label className="form-label">Điều kiện kích hoạt<\/label>/;
const andOrReplacement = `
          {conditions.length > 1 && (
            <div style={{ background: 'var(--color-bg)', padding: '0.75rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Điều kiện kết hợp:</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="radio" checked={logicalOperator === 'AND'} onChange={() => setLogicalOperator('AND')} /> AND (Tất cả đều đúng)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="radio" checked={logicalOperator === 'OR'} onChange={() => setLogicalOperator('OR')} /> OR (Một trong các điều kiện đúng)
                </label>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label className="form-label">Điều kiện kích hoạt</label>`;
code = code.replace(andOrRegex, andOrReplacement);


// 2. Add the vertical line and use {logicalOperator} for the badge
const condRegex = /\{conditions\.map\(\(c, i\) => \{[\s\S]*?return \([\s\S]*?<div key=\{i\} style=\{\{ display: 'flex', gap: '0\.75rem', alignItems: 'center', background: 'transparent', padding: '0', position: 'relative' \}\}>[\s\S]*?\{i === 0 \? \([\s\S]*?<div style=\{\{ background: '#f3e8ff'[\s\S]*?IF<\/div>[\s\S]*?\) : \([\s\S]*?<div style=\{\{ background: '#f1f5f9'[\s\S]*?AND<\/div>[\s\S]*?\)\}[\s\S]*?<div style=\{\{ flex: 1 \}\}>/;

const condReplacement = `{conditions.map((c, i) => {
              const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
              const isLast = i === conditions.length - 1;
              return (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'transparent', padding: '0', position: 'relative' }}>
                  <div style={{ position: 'relative', width: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {i === 0 ? (
                      <div style={{ background: '#f3e8ff', color: '#7c3aed', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, position: 'relative', zIndex: 2 }}>IF</div>
                    ) : (
                      <div style={{ background: '#f1f5f9', color: '#64748b', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0, position: 'relative', zIndex: 2 }}>{logicalOperator || 'AND'}</div>
                    )}
                    {!isLast && (
                      <div style={{ position: 'absolute', top: 32, bottom: -20, left: 15, width: 2, background: '#e2e8f0', zIndex: 1 }} />
                    )}
                  </div>

                  <div style={{ flex: 1 }}>`;

code = code.replace(condRegex, condReplacement);

// 3. Make the + Thêm điều kiện button have the proper left margin to align with the vertical line
const btnRegex = /<div style=\{\{ paddingLeft: 44, marginTop: '0\.25rem' \}\}>/;
const btnReplacement = `<div style={{ paddingLeft: 44, marginTop: '0.75rem', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -12, left: 15, width: 2, height: 24, background: '#e2e8f0', zIndex: 1 }} />`;
code = code.replace(btnRegex, btnReplacement);


fs.writeFileSync(file, code);
