const fs = require('fs');
const file = 'e:/GIAO_DATA_GOOGLESHEETS/src/pages/RuleSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /const SortableRuleItem = \(\{ rule, idx, onEdit, onDelete \}: \{ rule: any, idx: number, onEdit: \(r: any\) => void, onDelete: \(id: number\) => void \}\) => \{[\s\S]*?\};/;

const replacement = `const SortableRuleItem = ({ rule, idx, onEdit, onDelete }: { rule: any, idx: number, onEdit: (r: any) => void, onDelete: (id: number) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

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

  return (
    <div ref={setNodeRef} style={style} className={\`group hover-lift \${isDragging ? 'is-dragging' : ''}\`}>
      <div style={{
        display: 'flex', flexDirection: 'column', margin: '1rem', border: '1px solid var(--color-border)',
        borderLeft: '4px solid #8b5cf6',
        borderRadius: 'var(--radius-lg)', background: 'white', boxShadow: isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        transition: 'all 0.2s', padding: '1.25rem', position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button {...attributes} {...listeners} style={{ cursor: 'grab', padding: '4px', color: 'var(--color-text-muted)' }}>
              <GripVertical size={18} />
            </button>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#4c1d95', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
              Nhánh {idx + 1}
            </h3>
            {rule.connection_id && rule.sheet_name && (
              <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', background: 'var(--color-bg)', borderRadius: 20, color: 'var(--color-text-muted)' }}>
                Nguồn: {rule.sheet_name}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => onEdit(rule)} className="btn ghost" style={{ padding: 6, color: 'var(--color-primary)' }}><Edit2 size={16} /></button>
            <button onClick={() => onDelete(rule.id)} className="btn ghost" style={{ padding: 6, color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
          </div>
        </div>

        {/* Conditions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {conditions.map((c: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {i === 0 ? (
                <div style={{ background: '#f3e8ff', color: '#7c3aed', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>IF</div>
              ) : (
                <div style={{ background: '#f1f5f9', color: '#64748b', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>{rule.logical_operator || 'AND'}</div>
              )}
              
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, padding: '6px 16px', fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, minWidth: 150, textAlign: 'center' }}>
                {c.col}
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, padding: '6px 16px', fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, minWidth: 150, textAlign: 'center' }}>
                {OP_LABELS[c.op] || c.op}
              </div>
              {c.op !== 'is_empty' && c.op !== 'is_not_empty' && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 20, padding: '6px 16px', fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, flex: 1, minWidth: 200 }}>
                  {c.val}
                </div>
              )}
            </div>
          ))}
          <div style={{ paddingLeft: 44, marginTop: '0.5rem' }}>
             <button onClick={() => onEdit(rule)} style={{ background: '#f3e8ff', color: '#7c3aed', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
               <Plus size={14} /> Thêm điều kiện
             </button>
          </div>
        </div>

        {/* Target Action */}
        <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Hành động:</span>
          <div style={{
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(124, 58, 237, 0.1))',
            border: '1px solid var(--color-primary-light)', color: 'var(--color-primary)', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: '0.875rem',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <MapPin size={16} /> Phân bổ vào {rule.round_name || \`Vòng \${rule.target_round_id}\`}
          </div>
        </div>
      </div>
    </div>
  );
};`;

code = code.replace(regex, replacement);
fs.writeFileSync(file, code);
