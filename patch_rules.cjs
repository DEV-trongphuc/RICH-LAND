const fs = require('fs');
const file = 'e:/GIAO_DATA_GOOGLESHEETS/src/pages/RuleSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Replace states
code = code.replace(
  /const \[col, setCol\] = useState\('source'\);\s*const \[op, setOp\] = useState\('contains'\);\s*const \[val, setVal\] = useState\(''\);/,
  `const [conditions, setConditions] = useState<any[]>([{ col: 'source', op: 'contains', val: '' }]);
  const [logicalOperator, setLogicalOperator] = useState('AND');`
);

// 2. Replace openAddModal
code = code.replace(
  /setCol\('Nguồn'\);\s*setOp\('contains'\);\s*setVal\(''\);/,
  `setConditions([{ col: 'source', op: 'contains', val: '' }]);
    setLogicalOperator('AND');`
);

// 3. Replace openEditModal
code = code.replace(
  /setCol\(rule\.condition_column\);\s*setOp\(rule\.condition_operator\);\s*setVal\(rule\.condition_value\);/,
  `if (rule.conditions_json) {
      try {
        setConditions(typeof rule.conditions_json === 'string' ? JSON.parse(rule.conditions_json) : rule.conditions_json);
      } catch(e) {
        setConditions([{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }]);
      }
    } else {
      setConditions([{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }]);
    }
    setLogicalOperator(rule.logical_operator || 'AND');`
);

// 4. Replace handleSaveRule
code = code.replace(
  /const isNoValueOp = op === 'is_empty' \|\| op === 'is_not_empty';\s*if \(\(\!val && \!isNoValueOp\) \|\| \!targetRound\) return toast\.error\('Vui lòng nhập đủ thông tin'\);\s*const payload = {[\s\S]*?target_round_id: targetRound\s*};/,
  `for (const c of conditions) {
      const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
      if (!c.col || !c.op || (!c.val && !isNoValueOp)) return toast.error('Vui lòng nhập đủ thông tin các điều kiện');
    }
    if (!targetRound) return toast.error('Vui lòng chọn vòng phân bổ');
    
    const payload = {
      id: editingRule?.id,
      connection_id: connectionId === 'all' ? null : connectionId,
      condition_column: conditions[0]?.col || '',
      condition_operator: conditions[0]?.op || '',
      condition_value: conditions[0]?.val || '',
      conditions_json: conditions,
      logical_operator: logicalOperator,
      target_round_id: targetRound
    };`
);

fs.writeFileSync(file, code);
