import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ShieldCheck, ArrowRight, Filter, Server, MapPin, GripVertical, Edit2, Link2, FileSpreadsheet } from 'lucide-react';
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
import { CardSkeleton } from '../components/ui/Skeleton';

const OP_LABELS: Record<string, string> = {
  contains: 'Có chứa từ khóa',
  not_contains: 'Không chứa từ khóa',
  equals: 'Trùng khớp chính xác với',
  not_equals: 'Không trùng khớp chính xác',
  starts_with: 'Bắt đầu bằng',
  ends_with: 'Kết thúc bằng',
  is_empty: 'Trống (Không có dữ liệu)',
  is_not_empty: 'Không trống (Có dữ liệu)',
  date_before: 'Ngày trước (Nhỏ hơn ngày)',
  date_after: 'Ngày sau (Lớn hơn ngày)',
  date_equals: 'Chính xác ngày'
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '4px 8px', background: 'var(--color-bg)', borderRadius: 4, marginBottom: 8, color: 'var(--color-text-muted)' }}>
                <FileSpreadsheet size={14} color="#10b981" /> Nguồn: {rule.sheet_name}
              </span>
            )}
            
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Điều kiện kích hoạt</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(() => {
                let parsed = [];
                if (rule.conditions_json) {
                  try {
                    parsed = typeof rule.conditions_json === 'string' ? JSON.parse(rule.conditions_json) : rule.conditions_json;
                  } catch(e) {
                    parsed = [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }];
                  }
                } else {
                  parsed = [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }];
                }
                
                // Convert to array of arrays if legacy format
                const branches = (Array.isArray(parsed) && parsed.length > 0 && !Array.isArray(parsed[0])) ? [parsed] : parsed;

                return branches.map((branch: any[], bIndex: number) => (
                  <div key={bIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {bIndex > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--color-border-light)' }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--color-warning)', color: 'white', padding: '2px 8px', borderRadius: 10 }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--color-border-light)' }} />
                      </div>
                    )}
                    <div style={{ background: 'var(--color-bg)', padding: '0.5rem', borderRadius: 8 }}>
                      {branch.map((c: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: i > 0 ? '0.5rem' : 0 }}>
                          {i > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--color-text-muted)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                              AND
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
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-border)' }}>
            <ArrowRight size={24} strokeWidth={1.5} />
          </div>
          
          <div style={{ flex: '0 0 250px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Hành động xử lý</p>
            <div style={{
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(124, 58, 237, 0.15))',
              border: '1px solid var(--color-primary)', 
              color: 'var(--color-primary)', 
              padding: '8px 16px', 
              borderRadius: 50, 
              fontWeight: 600, 
              fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', gap: 10, 
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.15)'
            }}>
              <div style={{ background: 'var(--color-primary)', padding: 6, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={16} />
              </div>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rule.round_name || `Vòng ID: ${rule.target_round_id}`}</span>
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

  const navigate = useNavigate();
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isNoSheetModalOpen, setIsNoSheetModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [branches, setBranches] = useState<any[]>([ { conditions: [{ col: 'source', op: 'contains', val: '' }], inject: { enabled: false, fields: [] } } ]);
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
      setRules(newRules); // Optimistic update

      // Save order to backend
      try {
        await fetchAPI('reorder_rules', {
          method: 'POST',
          body: JSON.stringify({ order: newRules.map(r => r.id) })
        });
        // Silent success — order is already reflected on screen
      } catch (e: any) {
        // Revert on failure
        toast.error('Lỗi lưu thứ tự: ' + e.message);
        fetchRules(); // Re-fetch to restore correct order
      }
    }
  };

  const openAddModal = () => {
    if (connections.length === 0) {
      setIsNoSheetModalOpen(true);
      return;
    }
    setEditingRule(null);
    setConnectionId('all');
    setBranches([ { conditions: [{ col: 'source', op: 'contains', val: '' }], inject: { enabled: false, fields: [] } } ]);
    setTargetRound(rounds[0]?.id || '');
    setIsModalOpen(true);
  };

  const openEditModal = (rule: any) => {
    setEditingRule(rule);
    setConnectionId(rule.connection_id ? Number(rule.connection_id) : 'all');
    if (rule.conditions_json) {
      try {
        const parsed = typeof rule.conditions_json === 'string' ? JSON.parse(rule.conditions_json) : rule.conditions_json;
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (parsed[0].col) {
            // Legacy flat array
            setBranches([ { conditions: parsed, inject: { enabled: false, fields: [] } } ]);
          } else if (Array.isArray(parsed[0])) {
            // Legacy array of arrays
            setBranches(parsed.map((b: any) => ({ conditions: b, inject: { enabled: false, fields: [] } })));
          } else if (parsed[0].conditions) {
            // New structure
            setBranches(parsed);
          }
        } else {
          setBranches([ { conditions: [{ col: 'source', op: 'contains', val: '' }], inject: { enabled: false, fields: [] } } ]);
        }
      } catch (e) {
        setBranches([ { conditions: [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }], inject: { enabled: false, fields: [] } } ]);
      }
    } else {
      setBranches([ { conditions: [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }], inject: { enabled: false, fields: [] } } ]);
    }
    setTargetRound(rule.target_round_id);
    setIsModalOpen(true);
  };

  const handleSaveRule = async () => {
    for (const branch of branches) {
      if (!branch.conditions || branch.conditions.length === 0) return toast.error('Có nhánh đang trống điều kiện');
      for (const c of branch.conditions) {
        const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
        if (!c.col || !c.op || (!c.val && !isNoValueOp)) return toast.error('Vui lòng nhập đủ thông tin các điều kiện');
      }
      if (branch.inject?.enabled && branch.inject.fields) {
        for (const f of branch.inject.fields) {
          if (!f.col || !f.val) return toast.error('Vui lòng nhập đủ thông tin trường dữ liệu ghi đè');
        }
      }
    }
    if (!targetRound) return toast.error('Vui lòng chọn vòng phân bổ');
    if (isSaving) return;

    setIsSaving(true);
    const payload = {
      id: editingRule?.id,
      connection_id: connectionId === 'all' ? null : connectionId,
      condition_column: branches[0]?.conditions?.[0]?.col || '',
      condition_operator: branches[0]?.conditions?.[0]?.op || '',
      condition_value: branches[0]?.conditions?.[0]?.val || '',
      conditions_json: branches,
      logical_operator: 'OR',
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
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const json = await fetchAPI(`delete_rule&id=${deleteId}`);
      if (json.success) {
        toast.success('Xóa thành công!');
        fetchRules();
      } else {
        toast.error(json.message || 'Lỗi khi xóa');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsDeleting(false);
    setIsConfirmOpen(false);
  };

  const getFieldOptions = () => {
    const baseFields = [
      { value: 'source', label: 'Nguồn Data (Hệ thống)' },
      { value: 'type', label: 'Loại Data (Hệ thống)' },
      { value: 'note', label: 'Ghi Chú (Hệ thống)' }
    ];
    if (connectionId !== 'all') {
      const conn = connections.find(c => Number(c.id) === Number(connectionId));
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
    { value: 'not_contains', label: 'Không chứa từ khóa' },
    { value: 'equals', label: 'Trùng khớp chính xác với' },
    { value: 'not_equals', label: 'Không trùng khớp chính xác' },
    { value: 'starts_with', label: 'Bắt đầu bằng' },
    { value: 'ends_with', label: 'Kết thúc bằng' },
    { value: 'is_empty', label: 'Trống (Không có dữ liệu)' },
    { value: 'is_not_empty', label: 'Không trống (Có dữ liệu)' },
    { value: 'date_before', label: 'Ngày trước (Nhỏ hơn ngày)' },
    { value: 'date_after', label: 'Ngày sau (Lớn hơn ngày)' },
    { value: 'date_equals', label: 'Chính xác ngày' }
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
        <div style={{
          background: 'white',
          width: 40, height: 40, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', boxShadow: 'var(--shadow-sm)', color: 'var(--color-primary)'
        }}>
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
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <CardSkeleton key={i} height={90} />)}
          </div>
        ) : rules.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: 'var(--shadow-sm)' }}>
              <Filter size={32} color="var(--color-text-muted)" />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Chưa có Quy tắc Định tuyến nào</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>Thêm quy tắc đầu tiên để hệ thống tự động phân loại và chuyển tiếp dữ liệu đến đúng vòng phân bổ.</p>
            <button className="btn primary" onClick={openAddModal}><Plus size={18} /> Thêm Quy tắc</button>
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
            <div style={{ padding: '0 1rem', marginTop: '1rem' }}>
              <button 
                onClick={openAddModal}
                style={{ width: '100%', padding: '0.875rem', background: 'transparent', border: '2px dashed #e2e8f0', borderRadius: 'var(--radius-lg)', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
              >
                <Filter size={18} /> Thêm Quy tắc mới
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Modal for Add/Edit */}
      <CustomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRule ? "Chỉnh sửa Quy tắc" : "Thêm Quy tắc mới"}
        width="800px"
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


          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {branches.map((branch, bIndex) => (
              <div key={bIndex} style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: '1.25rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: '#8b5cf6', borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#4c1d95', textTransform: 'uppercase', margin: 0 }}>Nhánh {bIndex + 1}</h4>
                  {branches.length > 1 && (
                    <button type="button" className="btn ghost" style={{ color: 'var(--color-danger)', padding: 4 }} onClick={() => setBranches(branches.filter((_, idx) => idx !== bIndex))}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {branch.conditions.map((c: any, i: number) => {
                    const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
                    const isLast = i === branch.conditions.length - 1;
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
                                newB[bIndex].conditions[i].col = String(val);
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
                                newB[bIndex].conditions[i].op = String(val);
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
                                  newB[bIndex].conditions[i].val = e.target.value;
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
                                  newB[bIndex].conditions[i].val = e.target.value;
                                  setBranches(newB);
                                }}
                              />
                            )}
                          </div>
                        )}
                        {branch.conditions.length > 1 && (
                          <button
                            type="button"
                            className="btn ghost"
                            style={{ color: 'var(--color-danger)', padding: '8px', flexShrink: 0 }}
                            onClick={() => {
                               const newB = [...branches];
                               newB[bIndex].conditions = branch.conditions.filter((_: any, idx: number) => idx !== i);
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
                      type="button"
                      onClick={() => {
                         const newB = [...branches];
                         newB[bIndex].conditions.push({ col: 'source', op: 'contains', val: '' });
                         setBranches(newB);
                      }}
                      style={{ background: '#f3e8ff', color: '#7c3aed', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Plus size={14} /> Thêm điều kiện
                    </button>
                  </div>
                  
                  {/* INJECT DATA FIELDS TOGGLE */}
                  <div style={{ paddingLeft: 44, marginTop: '1rem', borderTop: '1px dashed #e2e8f0', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: branch.inject?.enabled ? '1rem' : 0 }}>
                      <div 
                        onClick={() => {
                          const newB = [...branches];
                          if (!newB[bIndex].inject) newB[bIndex].inject = { enabled: false, fields: [] };
                          const isEnabled = !newB[bIndex].inject.enabled;
                          newB[bIndex].inject.enabled = isEnabled;
                          if (isEnabled && newB[bIndex].inject.fields.length === 0) {
                             newB[bIndex].inject.fields.push({ col: 'source', val: '' });
                          }
                          setBranches(newB);
                        }}
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: 24,
                          background: branch.inject?.enabled ? '#10b981' : '#cbd5e1',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          flexShrink: 0
                        }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: 2,
                          left: branch.inject?.enabled ? 22 : 2,
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Tự động gán trường dữ liệu (Inject Data)</span>
                    </div>
                    
                    {branch.inject?.enabled && (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                         {branch.inject.fields.map((f: any, fi: number) => {
                           const isCustomMode = f.isCustom || !['source', 'type', 'note', 'name', ''].includes(f.col);
                           return (
                             <div key={fi} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                               <div style={{ flex: isCustomMode ? '0 0 180px' : 1, background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0' }}>
                                 <CustomSelect
                                   options={[
                                     { value: 'source', label: 'Nguồn Khách (Source)' },
                                     { value: 'type', label: 'Loại Khách (Type)' },
                                     { value: 'note', label: 'Ghi Chú (Note)' },
                                     { value: 'name', label: 'Tên Khách Hàng (Name)' },
                                     { value: 'custom_trigger', label: 'Tùy chỉnh (Custom Key)...' }
                                   ]}
                                   value={isCustomMode ? 'custom_trigger' : f.col}
                                   onChange={val => {
                                      const newB = [...branches];
                                      if (val === 'custom_trigger') {
                                         newB[bIndex].inject.fields[fi].isCustom = true;
                                         if (['source', 'type', 'note', 'name'].includes(newB[bIndex].inject.fields[fi].col)) {
                                             newB[bIndex].inject.fields[fi].col = '';
                                         }
                                      } else {
                                         newB[bIndex].inject.fields[fi].isCustom = false;
                                         newB[bIndex].inject.fields[fi].col = String(val);
                                      }
                                      setBranches(newB);
                                   }}
                                 />
                               </div>
                               
                               {isCustomMode && (
                                 <div style={{ flex: 1, minWidth: 120 }}>
                                   <input
                                     style={{ width: '100%', padding: '8px 16px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none' }}
                                     placeholder="Tên trường custom (vd: utm_source)..."
                                     value={f.col}
                                     onChange={e => {
                                        const newB = [...branches];
                                        newB[bIndex].inject.fields[fi].col = e.target.value;
                                        setBranches(newB);
                                     }}
                                   />
                                 </div>
                               )}
                               
                               <div style={{ flex: isCustomMode ? 1.5 : 2, minWidth: 150 }}>
                                 <input
                                   style={{ width: '100%', padding: '8px 16px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none' }}
                                   placeholder="Giá trị muốn gán tự động..."
                                   value={f.val}
                                   onChange={e => {
                                      const newB = [...branches];
                                      newB[bIndex].inject.fields[fi].val = e.target.value;
                                      setBranches(newB);
                                   }}
                                 />
                               </div>
                               
                               <button type="button" className="btn ghost" style={{ color: 'var(--color-danger)', padding: '6px' }} onClick={() => {
                                  const newB = [...branches];
                                  newB[bIndex].inject.fields = branch.inject.fields.filter((_: any, idx: number) => idx !== fi);
                                  setBranches(newB);
                               }}>
                                 <Trash2 size={16} />
                               </button>
                             </div>
                           );
                         })}
                         <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start', fontSize: '0.8125rem', marginTop: 4 }} onClick={() => {
                            const newB = [...branches];
                            newB[bIndex].inject.fields.push({ col: 'source', val: '' });
                            setBranches(newB);
                         }}>
                           <Plus size={14} /> Thêm trường
                         </button>
                       </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ padding: '0', marginTop: '0', marginBottom: '0.5rem' }}>
            <button 
              type="button"
              onClick={() => setBranches([...branches, { conditions: [{ col: 'source', op: 'contains', val: '' }], inject: { enabled: false, fields: [] } }])}
              style={{ width: '100%', padding: '0.875rem', background: 'transparent', border: '2px dashed #e2e8f0', borderRadius: 'var(--radius-lg)', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <Plus size={18} /> Thêm Nhánh Mới
            </button>
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
          <div style={{ padding: '1.25rem', background: '#f8fafc', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
            <button type="button" className="btn outline" onClick={() => setIsModalOpen(false)}>Hủy bỏ</button>
            <button type="button" onClick={handleSaveRule} className="btn primary" disabled={isSaving}>
              {isSaving ? 'Đang lưu...' : (editingRule ? 'Cập nhật' : 'Thêm mới')}
            </button>
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

      {/* No Sheet Modal */}
      <CustomModal
        isOpen={isNoSheetModalOpen}
        onClose={() => setIsNoSheetModalOpen(false)}
        title="Chưa có kết nối Google Sheets"
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ background: 'var(--color-warning-light)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <Link2 size={32} color="var(--color-warning)" />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>Bạn cần kết nối Sheets trước</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>Hệ thống quy tắc định tuyến cần có cấu hình cột từ Google Sheets để hoạt động. Vui lòng thiết lập ít nhất 1 kết nối Tích hợp trước khi tạo quy tắc.</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn outline" onClick={() => setIsNoSheetModalOpen(false)}>Hủy bỏ</button>
            <button className="btn primary" onClick={() => navigate('/integrations')}>Đi tới Tích hợp</button>
          </div>
        </div>
      </CustomModal>
    </div>
  );
};
