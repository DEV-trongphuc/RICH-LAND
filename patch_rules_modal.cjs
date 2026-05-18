const fs = require('fs');
const file = 'e:/GIAO_DATA_GOOGLESHEETS/src/pages/RuleSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '1rem' \}\}>[\s\S]*?(?=<\/div>\s*<div>\s*<label className="form-label">Hành động: Phân bổ vào<\/label>)/;

const replacement = `
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label className="form-label">Điều kiện kích hoạt</label>
            {conditions.map((c, i) => {
              const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
              return (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'transparent', padding: '0', position: 'relative' }}>
                  {i === 0 ? (
                    <div style={{ background: '#f3e8ff', color: '#7c3aed', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>IF</div>
                  ) : (
                    <div style={{ background: '#f1f5f9', color: '#64748b', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>{logicalOperator || 'AND'}</div>
                  )}

                  <div style={{ flex: 1 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <CustomSelect 
                        options={getFieldOptions()}
                        value={c.col}
                        onChange={val => {
                          const newC = [...conditions];
                          newC[i].col = String(val);
                          setConditions(newC);
                        }}
                        placeholder="Chọn trường..."
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <CustomSelect 
                        options={opOptions}
                        value={c.op}
                        onChange={val => {
                          const newC = [...conditions];
                          newC[i].op = String(val);
                          setConditions(newC);
                        }}
                      />
                    </div>
                  </div>
                  {!isNoValueOp && (
                    <div style={{ flex: 1 }}>
                      {c.op.startsWith('date_') ? (
                        <input 
                          type="date"
                          style={{ width: '100%', padding: '8px 16px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none' }}
                          value={c.val} 
                          onChange={e => {
                            const newC = [...conditions];
                            newC[i].val = e.target.value;
                            setConditions(newC);
                          }} 
                        />
                      ) : (
                        <input 
                          style={{ width: '100%', padding: '8px 16px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none' }}
                          placeholder="Nhập giá trị..." 
                          value={c.val} 
                          onChange={e => {
                            const newC = [...conditions];
                            newC[i].val = e.target.value;
                            setConditions(newC);
                          }} 
                        />
                      )}
                    </div>
                  )}
                  {conditions.length > 1 && (
                    <button 
                      className="btn ghost" 
                      style={{ color: 'var(--color-danger)', padding: '8px', flexShrink: 0 }}
                      onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))}
                      title="Xóa điều kiện này"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
            <div style={{ paddingLeft: 44, marginTop: '0.25rem' }}>
              <button 
                onClick={() => setConditions([...conditions, { col: 'source', op: 'contains', val: '' }])}
                style={{ background: '#f3e8ff', color: '#7c3aed', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} /> Thêm điều kiện
              </button>
            </div>
          </div>
          `;

code = code.replace(regex, replacement);
fs.writeFileSync(file, code);
