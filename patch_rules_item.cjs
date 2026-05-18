const fs = require('fs');
const file = 'e:/GIAO_DATA_GOOGLESHEETS/src/pages/RuleSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /<p style=\{\{ fontSize: '0.75rem', fontWeight: 600, color: 'var\(--color-text-muted\)', textTransform: 'uppercase', marginBottom: 8 \}\}>Điều kiện kích hoạt<\/p>[\s\S]*?(?=<\/div>\s*<div style=\{\{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var\(--color-border\)' \}\}>)/;

const replacement = `
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Điều kiện kích hoạt</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(() => {
                let conditions = [];
                if (rule.conditions_json) {
                  try {
                    conditions = typeof rule.conditions_json === 'string' ? JSON.parse(rule.conditions_json) : rule.conditions_json;
                  } catch(e) {
                    conditions = [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }];
                  }
                } else {
                  conditions = [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }];
                }

                return conditions.map((c: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {i > 0 && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--color-text-muted)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                        {rule.logical_operator || 'AND'}
                      </span>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        background: 'rgba(124, 58, 237, 0.08)', border: '1px solid var(--color-primary-light)', padding: '4px 10px', borderRadius: 8, fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6
                      }}>
                        <Server size={12} /> {c.col}
                      </span>
                      <span style={{ color: 'var(--color-text-light)', fontSize: '0.8125rem', fontStyle: 'italic' }}>
                        {OP_LABELS[c.op] || c.op}
                      </span>
                      {c.op !== 'is_empty' && c.op !== 'is_not_empty' && (
                        <span style={{
                          background: 'var(--color-warning-light)', border: '1px dashed #f59e0b', padding: '4px 10px', borderRadius: 8, fontWeight: 700, color: '#b45309', fontSize: '0.8125rem'
                        }}>
                          "{c.val}"
                        </span>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          `;

code = code.replace(regex, replacement);
fs.writeFileSync(file, code);
