import { useEffect, useState } from 'react';
import { Plus, Trash2, ShieldCheck, ArrowRight, Activity, Filter, Server, MapPin, GripVertical, Edit2 } from 'lucide-react';
import { 
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { 
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';

import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { fetchAPI } from '../utils/api';

const OP_LABELS: Record<string, string> = {
  contains: 'Có chứa từ khóa',
  equals: 'Trùng khớp chính xác với',
  starts_with: 'Bắt đầu bằng',
  ends_with: 'Kết thúc bằng',
};

// Sortable Item Component
const SortableRuleItem = ({ rule, idx, onEdit, onDelete }: { rule: any, idx: number, onEdit: (r: any) => void, onDelete: (id: number) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`group hover-lift ${isDragging ? 'is-dragging' : ''}`}>
      <div style={{
        display: 'flex', alignItems: 'stretch', margin: '0.5rem', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', boxShadow: isDragging ? 'var(--shadow-lg)' : 'var(--shadow-xs)',
        transition: 'box-shadow 0.2s', overflow: 'hidden'
      }}>
        {/* Drag Handle & Priority */}
        <div style={{
          background: 'var(--color-bg)', borderRight: '1px solid var(--color-border-light)',
          padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minWidth: '60px'
        }}>
          <button {...attributes} {...listeners} style={{ cursor: 'grab', padding: '4px', color: 'var(--color-text-muted)' }}>
            <GripVertical size={20} />
          </button>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: 'white', border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary)',
            marginTop: 8, boxShadow: 'var(--shadow-sm)'
          }}>
            {idx + 1}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ flex: 1 }}>
            {rule.connection_id && rule.sheet_name && (
              <span style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', background: 'var(--color-bg)', borderRadius: 4, marginBottom: 8, color: 'var(--color-text-muted)' }}>
                Nguồn: {rule.sheet_name}
              </span>
            )}
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Điều kiện kích hoạt</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Nếu trường</span>
              <span style={{
                background: 'rgba(124, 58, 237, 0.08)', border: '1px solid var(--color-primary-light)', padding: '6px 12px', borderRadius: 8, fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6
              }}>
                <Server size={14} /> {rule.condition_column}
              </span>
              <span style={{ color: 'var(--color-text-light)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                {OP_LABELS[rule.condition_operator] || rule.condition_operator}
              </span>
              <span style={{
                background: 'var(--color-warning-light)', border: '1px dashed #f59e0b', padding: '6px 12px', borderRadius: 8, fontWeight: 700, color: '#b45309', fontSize: '0.875rem'
              }}>
                "{rule.condition_value}"
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-border)' }}>
            <ArrowRight size={24} strokeWidth={1.5} />
          </div>
          
          <div style={{ flex: '0 0 250px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Hành động xử lý</p>
            <div style={{
              background: '#0f172a', color: 'white', padding: '10px 16px', borderRadius: 10, fontWeight: 600, fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-md)'
            }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: 6, borderRadius: '50%' }}>
                <MapPin size={16} color="#10b981" />
              </div>
              <span style={{ flex: 1 }}>{rule.round_name || `Vòng ID: ${rule.target_round_id}`}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderLeft: '1px dashed var(--color-border-light)' }}>
          <button
            onClick={() => onEdit(rule)}
            className="btn ghost"
            style={{ width: 40, height: 40, padding: 0, borderRadius: 10, color: 'var(--color-primary)' }}
            title="Sửa quy tắc"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="btn ghost"
            style={{ width: 40, height: 40, padding: 0, borderRadius: 10, color: 'var(--color-danger)' }}
            title="Xóa quy tắc này"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const RuleSettings = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form states
  const [col, setCol] = useState('source');
  const [op, setOp] = useState('contains');
  const [val, setVal] = useState('');
  const [targetRound, setTargetRound] = useState<number | ''>('');
  const [connectionId, setConnectionId] = useState<number | 'all'>('all');
  const [connections, setConnections] = useState<any[]>([]);

  const fetchConnections = async () => {
    try {
      const [connRes, mapRes] = await Promise.all([
        fetchAPI('get_connections'),
        fetchAPI('get_mappings')
      ]);
      if (connRes.success && mapRes.success) {
        const conns = connRes.data.map((c: any) => ({
          ...c,
          mappings: mapRes.data.filter((m: any) => m.connection_id === c.id)
        }));
        setConnections(conns);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchRules = async () => {
    try {
      const json = await fetchAPI('get_rules');
      if (json.success) setRules(json.data);
    } catch (e: any) {
      console.error("Failed to fetch rules", e);
    }
    setLoading(false);
  };

  const fetchRounds = async () => {
    try {
      const json = await fetchAPI('get_rounds');
      if (json.success) setRounds(json.data);
    } catch (e: any) {
      console.error("Failed to fetch rounds", e);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchRounds();
    fetchConnections();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = rules.findIndex((r) => r.id === active.id);
      const newIndex = rules.findIndex((r) => r.id === over?.id);
      const newRules = arrayMove(rules, oldIndex, newIndex);
      setRules(newRules);

      // Save order
      try {
        await fetchAPI('reorder_rules', {
          method: 'POST',
          body: JSON.stringify({ order: newRules.map(r => r.id) })
        });
      } catch (e: any) {
        console.error("Failed to save order", e);
      }
    }
  };

  const openAddModal = () => {
    setEditingRule(null);
    setConnectionId('all');
    setCol('Nguồn');
    setOp('contains');
    setVal('');
    setTargetRound(rounds[0]?.id || '');
    setIsModalOpen(true);
  };

  const openEditModal = (rule: any) => {
    setEditingRule(rule);
    setConnectionId(rule.connection_id || 'all');
    setCol(rule.condition_column);
    setOp(rule.condition_operator);
    setVal(rule.condition_value);
    setTargetRound(rule.target_round_id);
    setIsModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!val || !targetRound) return toast.error('Vui lòng nhập đủ thông tin');
    
    const payload = {
      id: editingRule?.id,
      connection_id: connectionId === 'all' ? null : connectionId,
      condition_column: col,
      condition_operator: op,
      condition_value: val,
      target_round_id: targetRound
    };

    const action = editingRule ? 'edit_rule' : 'add_rule';
    try {
      const json = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        toast.success(editingRule ? 'Cập nhật thành công!' : 'Thêm rule thành công!');
        setIsModalOpen(false);
        fetchRules();
      } else {
        toast.error(json.message || "Lỗi lưu Rule");
      }
    } catch (e: any) { toast.error("Lỗi lưu Rule: " + e.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const json = await fetchAPI(`delete_rule&id=${deleteId}`);
      if (json.success) {
        toast.success('Xóa thành công!');
        fetchRules();
      } else {
        toast.error(json.message || "Lỗi xóa Rule");
      }
    } catch (e: any) { toast.error("Lỗi kết nối: " + e.message); }
    setIsConfirmOpen(false);
  };

  const getFieldOptions = () => {
    const baseFields = [
      { value: 'source', label: 'Nguồn Data (Hệ thống)' },
      { value: 'type', label: 'Loại Data (Hệ thống)' },
      { value: 'note', label: 'Ghi Chú (Hệ thống)' }
    ];
    if (connectionId !== 'all') {
      const conn = connections.find(c => c.id === connectionId);
      if (conn && conn.mappings) {
        const customFields = conn.mappings.map((m: any) => ({
          value: m.sheet_column,
          label: `Cột: ${m.sheet_column}`
        }));
        return [...baseFields, ...customFields];
      }
    }
    return baseFields;
  };
  
  const opOptions = [
    { value: 'contains', label: 'Có chứa từ khóa' },
    { value: 'equals', label: 'Trùng khớp chính xác với' },
    { value: 'starts_with', label: 'Bắt đầu bằng' },
    { value: 'ends_with', label: 'Kết thúc bằng' }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Filter size={24} color="var(--color-primary)" /> Quy tắc Định tuyến (Routing Rules)
          </h1>
          <p className="page-subtitle">Hệ thống Rule Engine tự động phân tích Data Inbound và điều phối cho Tư vấn viên.</p>
        </div>
        <button className="btn primary" onClick={openAddModal}>
          <Plus size={18} /> Thêm Quy tắc mới
        </button>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(124, 58, 237, 0.1) 100%)',
        border: '1px solid var(--color-primary-light)', borderLeft: '4px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem'
      }}>
        <div style={{ background: 'white', padding: 8, borderRadius: '50%', boxShadow: 'var(--shadow-sm)', color: 'var(--color-primary)' }}>
          <ShieldCheck size={20} />
        </div>
        <div>
          <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: 4 }}>Nguyên tắc hoạt động</h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
            Các quy tắc được kiểm tra ưu tiên <strong>từ trên xuống dưới</strong> (Top-Down). Kéo thả biểu tượng <strong>⋮⋮</strong> để thay đổi độ ưu tiên.
          </p>
        </div>
      </div>

      <div className="card" style={{ overflow: 'visible', paddingBottom: '2rem' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Activity size={32} className="spin" style={{ margin: '0 auto', marginBottom: 16 }} />
            Đang tải dữ liệu Rule Engine...
          </div>
        ) : rules.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: 'var(--shadow-sm)' }}>
              <Filter size={32} color="var(--color-text-muted)" />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Chưa có Quy tắc Định tuyến nào</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>Thêm quy tắc đầu tiên để hệ thống tự động phân loại và chuyển tiếp dữ liệu đến đúng vòng phân bổ.</p>
            <button className="btn primary" onClick={openAddModal}><Plus size={18}/> Thêm Quy tắc</button>
          </div>
        ) : (
          <div style={{ padding: '0.5rem' }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rules.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {rules.map((rule, idx) => (
                  <SortableRuleItem 
                    key={rule.id} rule={rule} idx={idx} 
                    onEdit={openEditModal} 
                    onDelete={(id) => { setDeleteId(id); setIsConfirmOpen(true); }} 
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* Custom Modal for Add/Edit */}
      <CustomModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingRule ? "Chỉnh sửa Quy tắc" : "Thêm Quy tắc mới"}
        width="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem 0' }}>
          <div>
            <label className="form-label">Áp dụng cho Sheet</label>
            <CustomSelect
              options={[
                { value: 'all', label: 'Tất cả các Sheet kết nối' },
                ...connections.map(c => ({ value: c.id, label: c.sheet_name }))
              ]}
              value={connectionId}
              onChange={(v) => setConnectionId(v === 'all' ? 'all' : Number(v))}
            />
          </div>
          <div>
            <label className="form-label">Kiểm tra trường</label>
            <CustomSelect 
              options={getFieldOptions()}
              value={col}
              onChange={val => setCol(String(val))}
              placeholder="Chọn trường..."
            />
          </div>
          <div>
            <label className="form-label">Điều kiện</label>
            <CustomSelect 
              options={opOptions}
              value={op}
              onChange={val => setOp(String(val))}
            />
          </div>
          <div>
            <label className="form-label">Giá trị so sánh</label>
            <input 
              className="form-input" 
              placeholder="VD: form, DBA,..." 
              value={val} 
              onChange={e => setVal(e.target.value)} 
            />
          </div>
          <div>
            <label className="form-label">Hành động: Phân bổ vào</label>
            <CustomSelect 
              options={rounds.map(r => ({ value: r.id.toString(), label: r.name || r.round_name }))}
              value={targetRound.toString()}
              onChange={(v) => setTargetRound(Number(v))}
              placeholder="Chọn vòng phân bổ..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn outline" onClick={() => setIsModalOpen(false)}>Hủy</button>
            <button className="btn primary" onClick={handleSaveRule}>Lưu Quy tắc</button>
          </div>
        </div>
      </CustomModal>

      {/* Global Confirm Modal for Deletion */}
      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Xóa Quy Tắc Định Tuyến"
        message="Bạn có chắc chắn muốn xóa Quy tắc này? Các luồng phân bổ Data có thể bị ảnh hưởng ngay lập tức."
      />
    </div>
  );
};
