const fs = require('fs');
const file = 'e:/GIAO_DATA_GOOGLESHEETS/src/pages/RuleSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /<div>\s*<label className="form-label">Kiểm tra trường<\/label>[\s\S]*?(?=<div>\s*<label className="form-label">Hành động: Phân bổ vào<\/label>)/;

const replacement = `
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {conditions.map((c, i) => {
              const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
              return (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: 8, position: 'relative' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Kiểm tra trường</label>
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
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Điều kiện</label>
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
                  {!isNoValueOp && (
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Giá trị so sánh</label>
                      {c.op.startsWith('date_') ? (
                        <input 
                          type="date"
                          className="form-input" 
                          value={c.val} 
                          onChange={e => {
                            const newC = [...conditions];
                            newC[i].val = e.target.value;
                            setConditions(newC);
                          }} 
                        />
                      ) : (
                        <input 
                          className="form-input" 
                          placeholder="VD: form, DBA,..." 
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
                      style={{ color: 'var(--color-danger)', padding: '8px', marginTop: '22px' }}
                      onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))}
                      title="Xóa điều kiện này"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
            <button 
              className="btn outline" 
              style={{ alignSelf: 'flex-start', fontSize: '0.875rem' }}
              onClick={() => setConditions([...conditions, { col: 'source', op: 'contains', val: '' }])}
            >
              <Plus size={16} /> Thêm điều kiện
            </button>
          </div>
          `;

code = code.replace(regex, replacement);
fs.writeFileSync(file, code);
