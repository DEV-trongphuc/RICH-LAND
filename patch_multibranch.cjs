const fs = require('fs');
const file = 'e:/GIAO_DATA_GOOGLESHEETS/src/pages/RuleSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Rename the outside button to Thêm Điều Kiện Mới
code = code.replace(
  /<Filter size=\{18\} \/> Thêm Nhánh Mới/,
  '<Filter size={18} /> Thêm Quy tắc mới'
);

// 2. State management
// Change setConditions to setBranches and logicalOperator
const stateRegex = /const \[conditions, setConditions\] = useState<any\[\]>\(\[\{ col: 'source', op: 'contains', val: '' \}\]\);\s*const \[logicalOperator, setLogicalOperator\] = useState\('AND'\);/;
const stateReplacement = `const [branches, setBranches] = useState<any[][]>([ [{ col: 'source', op: 'contains', val: '' }] ]);`;
code = code.replace(stateRegex, stateReplacement);

// Update openAddModal to use setBranches
code = code.replace(
  /setConditions\(\[\{ col: 'source', op: 'contains', val: '' \}\]\);\s*setLogicalOperator\('AND'\);/,
  `setBranches([ [{ col: 'source', op: 'contains', val: '' }] ]);`
);

// Update openEditModal to parse branches
const editRegex = /if \(rule\.conditions_json\) \{\s*try \{\s*setConditions\(typeof rule\.conditions_json === 'string' \? JSON\.parse\(rule\.conditions_json\) : rule\.conditions_json\);\s*\} catch \(e\) \{\s*setConditions\(\[\{ col: rule\.condition_column, op: rule\.condition_operator, val: rule\.condition_value \}\]\);\s*\}\s*\} else \{\s*setConditions\(\[\{ col: rule\.condition_column, op: rule\.condition_operator, val: rule\.condition_value \}\]\);\s*\}/;
const editReplacement = `if (rule.conditions_json) {
      try {
        const parsed = typeof rule.conditions_json === 'string' ? JSON.parse(rule.conditions_json) : rule.conditions_json;
        // Handle legacy flat array vs new array of arrays
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!Array.isArray(parsed[0])) {
            setBranches([parsed]);
          } else {
            setBranches(parsed);
          }
        } else {
          setBranches([ [{ col: 'source', op: 'contains', val: '' }] ]);
        }
      } catch (e) {
        setBranches([ [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }] ]);
      }
    } else {
      setBranches([ [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }] ]);
    }`;
code = code.replace(editRegex, editReplacement);

// Update validation logic
const validRegex = /for \(let c of conditions\) \{\s*const isNoValueOp = c\.op === 'is_empty' \|\| c\.op === 'is_not_empty';\s*if \(!c\.col \|\| !c\.op \|\| \(!c\.val && !isNoValueOp\)\) return toast\.error\('Vui lòng nhập đủ thông tin các điều kiện'\);\s*\}/;
const validReplacement = `for (let branch of branches) {
      if (branch.length === 0) return toast.error('Có nhánh đang trống điều kiện');
      for (let c of branch) {
        const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
        if (!c.col || !c.op || (!c.val && !isNoValueOp)) return toast.error('Vui lòng nhập đủ thông tin các điều kiện');
      }
    }`;
code = code.replace(validRegex, validReplacement);

// Update payload
code = code.replace(
  /conditions_json: JSON\.stringify\(conditions\),\s*logical_operator: logicalOperator,/,
  `conditions_json: JSON.stringify(branches),
      logical_operator: 'OR', // Hardcoded as the outer structure is now OR`
);

// 3. Modal UI Render
// Remove the old AND/OR selector and the conditions mapping, replace with branches mapping
const uiRegex = /\{conditions\.length > 1 && \([\s\S]*?\}\)\]\)\}\s*style=\{\{ background: '#f3e8ff'[\s\S]*?Thêm điều kiện\s*<\/button>\s*<\/div>\s*<\/div>/;

const uiReplacement = `{branches.map((branch, bIndex) => (
            <div key={bIndex} style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: '#8b5cf6', borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#4c1d95', textTransform: 'uppercase', margin: 0 }}>Nhánh {bIndex + 1}</h4>
                {branches.length > 1 && (
                  <button className="btn ghost" style={{ color: 'var(--color-danger)', padding: 4 }} onClick={() => setBranches(branches.filter((_, idx) => idx !== bIndex))}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {branch.map((c, i) => {
                  const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
                  const isLast = i === branch.length - 1;
                  return (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'transparent', padding: '0', position: 'relative' }}>
                      <div style={{ position: 'relative', width: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {i === 0 ? (
                          <div style={{ background: '#f3e8ff', color: '#7c3aed', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, position: 'relative', zIndex: 2 }}>IF</div>
                        ) : (
                          <div style={{ background: '#f1f5f9', color: '#64748b', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0, position: 'relative', zIndex: 2 }}>AND</div>
                        )}
                        {!isLast && (
                          <div style={{ position: 'absolute', top: 32, bottom: -20, left: 15, width: 2, background: '#e2e8f0', zIndex: 1 }} />
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ background: '#f8fafc', borderRadius: 20, border: '1px solid #e2e8f0' }}>
                          <CustomSelect
                            options={getFieldOptions()}
                            value={c.col}
                            onChange={val => {
                              const newB = [...branches];
                              newB[bIndex][i].col = String(val);
                              setBranches(newB);
                            }}
                            placeholder="Chọn trường..."
                          />
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ background: '#f8fafc', borderRadius: 20, border: '1px solid #e2e8f0' }}>
                          <CustomSelect
                            options={opOptions}
                            value={c.op}
                            onChange={val => {
                              const newB = [...branches];
                              newB[bIndex][i].op = String(val);
                              setBranches(newB);
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
                                const newB = [...branches];
                                newB[bIndex][i].val = e.target.value;
                                setBranches(newB);
                              }}
                            />
                          ) : (
                            <input
                              style={{ width: '100%', padding: '8px 16px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none' }}
                              placeholder="Nhập giá trị..."
                              value={c.val}
                              onChange={e => {
                                const newB = [...branches];
                                newB[bIndex][i].val = e.target.value;
                                setBranches(newB);
                              }}
                            />
                          )}
                        </div>
                      )}
                      {branch.length > 1 && (
                        <button
                          className="btn ghost"
                          style={{ color: 'var(--color-danger)', padding: '8px', flexShrink: 0 }}
                          onClick={() => {
                             const newB = [...branches];
                             newB[bIndex] = branch.filter((_, idx) => idx !== i);
                             setBranches(newB);
                          }}
                          title="Xóa điều kiện này"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
                <div style={{ paddingLeft: 44, marginTop: '0.75rem', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -12, left: 15, width: 2, height: 24, background: '#e2e8f0', zIndex: 1 }} />
                  <button
                    onClick={() => {
                       const newB = [...branches];
                       newB[bIndex].push({ col: 'source', op: 'contains', val: '' });
                       setBranches(newB);
                    }}
                    style={{ background: '#f3e8ff', color: '#7c3aed', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} /> Thêm điều kiện
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          <div style={{ padding: '0', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            <button 
              onClick={() => setBranches([...branches, [{ col: 'source', op: 'contains', val: '' }]])}
              style={{ width: '100%', padding: '0.875rem', background: 'transparent', border: '2px dashed #e2e8f0', borderRadius: 'var(--radius-lg)', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <Plus size={18} /> Thêm Nhánh Mới
            </button>
          </div>`;

code = code.replace(uiRegex, uiReplacement);

fs.writeFileSync(file, code);
