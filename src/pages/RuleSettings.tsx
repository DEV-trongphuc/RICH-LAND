import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { withRouterFreezer } from '../components/RouterFreezer';
import { Plus, Trash2, ShieldCheck, ArrowRight, Filter, Server, MapPin, GripVertical, Edit2, Link2, FileSpreadsheet, Zap, Keyboard, Globe, Play, XCircle, AlertCircle, RefreshCw, Mail } from 'lucide-react';
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
import { Avatar } from '../components/ui/Avatar';
import { useLanguage } from '../contexts/LanguageContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { useAuthStore } from '../store/authStore';

const OP_LABELS: Record<string, string> = {
  contains: 'Có chứa từ khóa',
  not_contains: 'Không chứa từ khóa',
  equals: 'Trùng khớp chính xác với',
  not_equals: 'Không trùng khớp chính xác',
  starts_with: 'Bắt đầu bằng',
  ends_with: 'Kết thúc bằng',
  is_empty: 'Trống (Không có dữ liệu)',
  is_not_empty: 'Không trống (Có dữ liệu)',
  date_before: 'Ngày trước (Nhỏ hơn ngày) (YYYY-MM-DD)',
  date_after: 'Ngày sau (Lớn hơn ngày) (YYYY-MM-DD)',
  date_equals: 'Chính xác ngày (YYYY-MM-DD)'
};

// Sortable Item Component
const SortableRuleItem = ({ rule, idx, connections, onEdit, onDelete, isDragDisabled, isReadOnly }: { rule: any, idx: number, connections: any[], onEdit: (r: any) => void, onDelete: (id: number) => void, isDragDisabled?: boolean, isReadOnly?: boolean }) => {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`group hover-lift ${isDragging ? 'is-dragging' : ''}`}>
      <div className="sortable-rule-card" style={{
        display: 'flex', alignItems: 'stretch', margin: '0.5rem', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', boxShadow: isDragging ? 'var(--shadow-lg)' : 'var(--shadow-xs)',
        transition: 'box-shadow 0.2s', overflow: 'hidden'
      }}>
        {/* Drag Handle & Priority */}
        <div className="sortable-rule-drag-handle" style={{
          background: 'var(--color-bg)', borderRight: '1px solid var(--color-border-light)',
          padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minWidth: '60px'
        }}>
          {!isDragDisabled ? (
            <button {...attributes} {...listeners} style={{ cursor: 'grab', padding: '4px', color: 'var(--color-text-muted)' }}>
              <GripVertical size={20} />
            </button>
          ) : (
            <div style={{ padding: '4px', color: 'var(--color-border-light)' }}>
              <GripVertical size={20} />
            </div>
          )}
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: 'white', border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary)',
            marginTop: 8, boxShadow: 'var(--shadow-sm)'
          }}>
            {idx + 1}
          </div>
        </div>

        {/* Content */}
        <div className="mobile-flex-wrap" style={{ flex: 1, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {(() => {
                if (rule.connection_id === null || rule.connection_id === 'all' || rule.connection_id === '') {
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '4px 8px', background: 'var(--color-bg)', borderRadius: 4, color: 'var(--color-text-muted)' }}>
                      <Globe size={14} color="#BD1D2D" /> {t("Tất cả mọi kết nối (Sheet & API & Nhập tay)")}
                    </span>
                  );
                }

                const cIds = rule.connection_id.toString().split(',').map((id: string) => Number(id.trim()));
                return cIds.map((cId: number) => {
                  if (cId === -1) {
                    return (
                      <span key={cId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '4px 8px', background: 'var(--color-bg)', borderRadius: 4, color: 'var(--color-text-muted)' }}>
                        <FileSpreadsheet size={14} color="#10b981" /> {t("Tất cả các Google Sheets")}
                      </span>
                    );
                  }
                  if (cId === -2) {
                    return (
                      <span key={cId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '4px 8px', background: 'var(--color-bg)', borderRadius: 4, color: 'var(--color-text-muted)' }}>
                        <Zap size={14} color="#f59e0b" /> {t("Tất cả các API / Landing Pages")}
                      </span>
                    );
                  }
                  if (cId === -3) {
                    return (
                      <span key={cId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '4px 8px', background: 'var(--color-bg)', borderRadius: 4, color: 'var(--color-text-muted)' }}>
                        <Keyboard size={14} color="#ec4899" /> {t("Chỉ Data Nhập tay (Thêm Data Nhanh)")}
                      </span>
                    );
                  }
                  const conn = connections.find(c => Number(c.id) === cId);
                  if (conn) {
                    return (
                      <span key={cId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '4px 8px', background: 'var(--color-bg)', borderRadius: 4, color: 'var(--color-text-muted)' }}>
                        <FileSpreadsheet size={14} color="#10b981" /> {conn.sheet_name}
                      </span>
                    );
                  }
                  return null;
                });
              })()}
            </div>

            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{t("Điều kiện kích hoạt")}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(() => {
                let parsed = [];
                if (rule.conditions_json) {
                  try {
                    parsed = typeof rule.conditions_json === 'string' ? JSON.parse(rule.conditions_json) : rule.conditions_json;
                  } catch (e) {
                    parsed = [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }];
                  }
                } else {
                  parsed = [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }];
                }

                // Normalize to new structure: { conditions: [...] }
                let normalizedBranches = [];
                if (Array.isArray(parsed) && parsed.length > 0) {
                  if (parsed[0].col) {
                    normalizedBranches = [{ conditions: parsed }];
                  } else if (Array.isArray(parsed[0])) {
                    normalizedBranches = parsed.map(b => ({ conditions: b }));
                  } else if (parsed[0].conditions) {
                    normalizedBranches = parsed;
                  } else {
                    normalizedBranches = [{ conditions: [] }];
                  }
                } else {
                  normalizedBranches = [{ conditions: [] }];
                }

                return normalizedBranches.map((branch: any, bIndex: number) => (
                  <div key={bIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {bIndex > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--color-border-light)' }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--color-warning)', color: 'white', padding: '2px 8px', borderRadius: 10 }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--color-border-light)' }} />
                      </div>
                    )}
                    <div style={{ background: 'var(--color-bg)', padding: '0.5rem', borderRadius: 8 }}>
                      {(branch.conditions || []).map((c: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: i > 0 ? '0.5rem' : 0 }}>
                          {i > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--color-text-muted)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                              AND
                            </span>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              background: 'rgba(163, 20, 34, 0.08)', border: '1px solid var(--color-primary-light)', padding: '4px 10px', borderRadius: 8, fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6
                            }}>
                              <Server size={12} /> {c.col}
                            </span>
                            <span style={{ color: 'var(--color-text-light)', fontSize: '0.8125rem', fontStyle: 'italic' }}>
                              {t(OP_LABELS[c.op]) || c.op}
                            </span>
                            {c.op !== 'is_empty' && c.op !== 'is_not_empty' && (
                              <span style={{
                                background: 'var(--color-warning-light)', border: '1px dashed #f59e0b', padding: '4px 10px', borderRadius: 8, fontWeight: 700, color: '#b45309', fontSize: '0.8125rem'
                              }}>
                                "{c.col === 'connection_id' ? (connections.find((conn: any) => String(conn.id) === String(c.val))?.sheet_name || c.val) : c.val}"
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
            <ArrowRight className="mobile-rotate-90" size={24} strokeWidth={1.5} style={{ transition: 'transform 0.2s' }} />
          </div>

          <div style={{ flex: '0 0 250px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{t("Hành động xử lý")}</p>
            <div style={{
              background: 'linear-gradient(135deg, rgba(163, 20, 34, 0.05), rgba(163, 20, 34, 0.15))',
              border: '1px solid var(--color-primary)',
              color: 'var(--color-primary)',
              padding: '8px 16px',
              borderRadius: 50,
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 2px 8px rgba(163, 20, 34, 0.15)'
            }}>
              <div style={{ background: 'var(--color-primary)', padding: 6, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={16} />
              </div>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rule.round_name || t("Vòng ID: {id}").replace('{id}', String(rule.target_round_id))}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sortable-rule-actions" style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderLeft: '1px dashed var(--color-border-light)' }}>
          <button
            onClick={() => onEdit(rule)}
            className="btn ghost"
            style={{ width: 40, height: 40, padding: 0, borderRadius: 10, color: 'var(--color-primary)' }}
            title={isReadOnly ? t("Xem chi tiết") : t("Sửa quy tắc")}
          >
            {isReadOnly ? <Filter size={16} /> : <Edit2 size={16} />}
          </button>
          {!isReadOnly && (
            <button
              onClick={() => onDelete(rule.id)}
              className="btn ghost"
              style={{ width: 40, height: 40, padding: 0, borderRadius: 10, color: 'var(--color-danger)' }}
              title={t("Xóa quy tắc này")}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const parseMarkdownToHtml = (markdown: string) => {
  if (!markdown) return '';
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h4 style="font-size: 1rem; font-weight: 700; color: var(--color-primary); margin-top: 1rem; margin-bottom: 0.5rem;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="font-size: 1.15rem; font-weight: 800; color: var(--color-primary); margin-top: 1.25rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--color-border-light); padding-bottom: 4px;">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 style="font-size: 1.3rem; font-weight: 800; color: var(--color-primary); margin-top: 1.5rem; margin-bottom: 1rem;">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\s*[\-\*]\s+(.*$)/gim, '<li style="margin-left: 1.25rem; margin-bottom: 0.25rem; list-style-type: disc;">$1</li>')
    .replace(/\n\n/g, '<div style="margin-bottom: 0.75rem;"></div>')
    .replace(/\n/g, '<br/>');

  return html;
};

const RuleSettingsInner = () => {
  const { t } = useLanguage();
  const user = useAuthStore(state => state.user);
  const isReadOnly = user?.role === 'director';
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
  const [branches, setBranches] = useState<any[]>([{ conditions: [{ col: 'source', op: 'contains', val: '' }], inject: { enabled: false, fields: [] } }]);
  const [targetRound, setTargetRound] = useState<number | ''>('');
  const [connectionId, setConnectionId] = useState<any[]>(['all']);
  const [connections, setConnections] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<number | 'all' | null>('all');
  const [activeRoundFilter, setActiveRoundFilter] = useState<number | 'all'>('all');

  // AI Evaluation states
  const [isAiEvalModalOpen, setIsAiEvalModalOpen] = useState(false);
  const [aiEvalFeedback, setAiEvalFeedback] = useState('');
  const [aiEvalStep, setAiEvalStep] = useState<'preview' | 'loading' | 'result'>('preview');

  const handleAIEvaluateRules = () => {
    setIsAiEvalModalOpen(true);
    setAiEvalStep('preview');
    setAiEvalFeedback('');
  };

  const triggerAiEvaluation = async () => {
    setAiEvalStep('loading');
    setAiEvalFeedback('');
    try {
      const res = await fetchAPI('evaluate_rules_ai', {
        method: 'POST',
        body: JSON.stringify({ rules })
      });
      if (res.success) {
        setAiEvalFeedback(res.feedback || '');
        setAiEvalStep('result');
      } else {
        toast.error(res.message || t('Lỗi đánh giá quy tắc'));
        setAiEvalStep('preview');
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
      setAiEvalStep('preview');
    }
  };

  // Simulator states
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulatePayload, setSimulatePayload] = useState({
    name: 'Nguyễn Văn A',
    phone: '0987654321',
    email: 'test@example.com',
    source: 'Facebook Ads',
    type: 'Đăng ký khóa học',
    note: 'Cần tư vấn lộ trình học nhanh'
  });
  const [simulateConnectionId, setSimulateConnectionId] = useState<string>('all');
  const [simulateConnectionType, setSimulateConnectionType] = useState<string>('sheets');
  const [simulateCustomFields, setSimulateCustomFields] = useState<{ key: string; val: string }[]>([]);
  const [simulateResult, setSimulateResult] = useState<any>(null);

  const openSimulateModal = () => {
    setSimulateResult(null);
    setSimulateConnectionId('all');
    const hasSheets = connections.some(c => c.connection_type === 'sheets');
    const hasLP = connections.some(c => c.connection_type === 'landing_page');
    if (hasSheets) {
      setSimulateConnectionType('sheets');
    } else if (hasLP) {
      setSimulateConnectionType('landing_page');
    } else {
      setSimulateConnectionType('manual');
    }
    setIsSimulateModalOpen(true);
  };

  const handleRunSimulation = async () => {
    setSimulateLoading(true);
    setSimulateResult(null);
    try {
      const dataPayload: Record<string, string> = {
        name: simulatePayload.name,
        phone: simulatePayload.phone,
        email: simulatePayload.email,
        source: simulatePayload.source,
        type: simulatePayload.type,
        note: simulatePayload.note
      };

      simulateCustomFields.forEach(field => {
        if (field.key.trim() !== '') {
          dataPayload[field.key.trim()] = field.val;
        }
      });

      const res = await fetchAPI('preview_routing', {
        method: 'POST',
        body: JSON.stringify({
          data: dataPayload,
          connection_id: simulateConnectionId,
          connection_type: simulateConnectionType
        })
      });

      if (res.success) {
        setSimulateResult(res);
      } else {
        toast.error(res.message || t('Lỗi mô phỏng'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi khi kết nối mô phỏng: ') + err.message);
    }
    setSimulateLoading(false);
  };

  const fetchConnections = async () => {
    try {
      const [connRes, mapRes] = await Promise.all([
        fetchAPI('get_connections'),
        fetchAPI('get_mappings')
      ]);
      if (connRes.success && mapRes.success) {
        const conns = connRes.data.map((c: any) => ({
          ...c,
          mappings: mapRes.data.filter((m: any) => Number(m.connection_id) === Number(c.id))
        })).filter((c: any) => !Boolean(Number(c.is_silent)));
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

  useEffect(() => {
    setSimulateConnectionId('all');
  }, [simulateConnectionType]);

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
        toast.error(t('Lỗi lưu thứ tự: ') + e.message);
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

    // Pre-fill connection based on active filter
    if (activeFilter !== 'all' && activeFilter !== null) {
      setConnectionId([activeFilter]);
    } else if (activeFilter === null) {
      setConnectionId(['all']);
    } else {
      setConnectionId(['all']);
    }

    setBranches([{ conditions: [{ col: 'source', op: 'contains', val: '' }], inject: { enabled: false, fields: [] } }]);
    setTargetRound(rounds[0]?.id || '');
    setIsModalOpen(true);
  };

  const openEditModal = (rule: any) => {
    setEditingRule(rule);

    let initialConns = ['all'];
    if (rule.connection_id !== null && rule.connection_id !== '') {
      initialConns = rule.connection_id.toString().split(',').map((v: string) => {
        const trim = v.trim();
        return isNaN(Number(trim)) ? trim : Number(trim);
      });
    }
    setConnectionId(initialConns);

    if (rule.conditions_json) {
      try {
        const parsed = typeof rule.conditions_json === 'string' ? JSON.parse(rule.conditions_json) : rule.conditions_json;
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (parsed[0].col) {
            // Legacy flat array
            setBranches([{ conditions: parsed, inject: { enabled: false, fields: [] } }]);
          } else if (Array.isArray(parsed[0])) {
            // Legacy array of arrays
            setBranches(parsed.map((b: any) => ({ conditions: b, inject: { enabled: false, fields: [] } })));
          } else if (parsed[0].conditions) {
            // New structure
            setBranches(parsed);
          }
        } else {
          setBranches([{ conditions: [{ col: 'source', op: 'contains', val: '' }], inject: { enabled: false, fields: [] } }]);
        }
      } catch (e) {
        setBranches([{ conditions: [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }], inject: { enabled: false, fields: [] } }]);
      }
    } else {
      setBranches([{ conditions: [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }], inject: { enabled: false, fields: [] } }]);
    }
    setTargetRound(rule.target_round_id);
    setIsModalOpen(true);
  };

  const handleSaveRule = async () => {
    for (const branch of branches) {
      if (!branch.conditions || branch.conditions.length === 0) return toast.error(t('Có nhánh đang trống điều kiện'));
      for (const c of branch.conditions) {
        const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
        if (!c.col || !c.op || (!c.val && !isNoValueOp)) return toast.error(t('Vui lòng nhập đủ thông tin các điều kiện'));
      }
      if (branch.inject?.enabled && branch.inject.fields) {
        for (const f of branch.inject.fields) {
          if (!f.col || !f.val) return toast.error(t('Vui lòng nhập đủ thông tin trường dữ liệu ghi đè'));
        }
      }
    }
    if (!targetRound) return toast.error(t('Vui lòng chọn vòng phân bổ'));
    if (isSaving) return;

    setIsSaving(true);
    const payload = {
      id: editingRule?.id,
      connection_id: connectionId.includes('all') ? 'all' : connectionId.join(','),
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
        toast.success(editingRule ? t('Cập nhật thành công!') : t('Thêm rule thành công!'));
        setIsModalOpen(false);
        fetchRules();
      } else {
        toast.error(json.message || t("Lỗi lưu Rule"));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const json = await fetchAPI(`delete_rule&id=${deleteId}`);
      if (json.success) {
        toast.success(t('Xóa thành công!'));
        fetchRules();
      } else {
        toast.error(json.message || t('Lỗi khi xóa'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsDeleting(false);
    setIsConfirmOpen(false);
  };

  const getFieldOptions = () => {
    const baseFields = [
      { value: 'source', label: t('Nguồn Data (Hệ thống)') },
      { value: 'type', label: t('Loại Data (Hệ thống)') },
      { value: 'note', label: t('Ghi Chú (Hệ thống)') },
      { value: 'name', label: t('Họ và Tên (Hệ thống)') },
      { value: 'phone', label: t('Số điện thoại (Hệ thống)') },
      { value: 'email', label: t('Email (Hệ thống)') },
      { value: 'connection_id', label: t('Tích hợp (Sheet/Webhook)') }
    ];
    if (!connectionId.includes('all') && connectionId.length === 1) {
      const conn = connections.find(c => Number(c.id) === Number(connectionId[0]));
      if (conn && conn.mappings) {
        const customFields = conn.mappings.map((m: any) => ({
          value: m.sheet_column,
          label: t("Cột: {col}").replace('{col}', m.sheet_column)
        }));
        return [...baseFields, ...customFields];
      }
    }
    return baseFields;
  };

  const opOptions = [
    { value: 'contains', label: t('Có chứa từ khóa') },
    { value: 'not_contains', label: t('Không chứa từ khóa') },
    { value: 'equals', label: t('Trùng khớp chính xác với') },
    { value: 'not_equals', label: t('Không trùng khớp chính xác') },
    { value: 'starts_with', label: t('Bắt đầu bằng') },
    { value: 'ends_with', label: t('Kết thúc bằng') },
    { value: 'is_empty', label: t('Trống (Không có dữ liệu)') },
    { value: 'is_not_empty', label: t('Không trống (Có dữ liệu)') },
    { value: 'date_before', label: t('Ngày trước (Nhỏ hơn ngày) (YYYY-MM-DD)') },
    { value: 'date_after', label: t('Ngày sau (Lớn hơn ngày) (YYYY-MM-DD)') },
    { value: 'date_equals', label: t('Chính xác ngày (YYYY-MM-DD)') }
  ];

  const filteredRules = rules.filter(r => {
    let matchConnection = true;
    if (activeFilter === 'all') {
      matchConnection = true;
    } else if (activeFilter === null) {
      matchConnection = r.connection_id === null || r.connection_id === '' || r.connection_id === 'all';
    } else {
      if (r.connection_id === null || r.connection_id === '' || r.connection_id === 'all') {
        matchConnection = false;
      } else {
        const cIds = r.connection_id.toString().split(',').map((id: string) => Number(id.trim()));
        matchConnection = cIds.includes(activeFilter);
      }
    }

    let matchRound = true;
    if (activeRoundFilter !== 'all') {
      matchRound = Number(r.target_round_id) === Number(activeRoundFilter);
    }

    return matchConnection && matchRound;
  });

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Filter size={24} color="var(--color-primary)" /> {t("Quy tắc Định tuyến (Routing Rules)")}
          </h1>
          <p className="page-subtitle">{t("Hệ thống Rule Engine tự động phân tích Data Inbound và điều phối cho Tư vấn viên.")}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn outline" onClick={handleAIEvaluateRules} style={{ borderColor: '#a31422', color: '#a31422', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img 
              src="/LOGO.jpg" 
              alt="Gemini" 
              style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} 
            /> {t("AI Đánh giá Quy tắc")}
          </button>
          <button className="btn outline" onClick={openSimulateModal} style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
            <Play size={16} style={{ fill: 'currentColor' }} /> {t("Thử nghiệm Định tuyến")}
          </button>
          {!isReadOnly && (
            <button className="btn primary" onClick={openAddModal}>
              <Plus size={18} /> {t("Thêm Quy tắc mới")}
            </button>
          )}
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, rgba(163, 20, 34, 0.05) 0%, rgba(163, 20, 34, 0.1) 100%)',
        border: '1px solid var(--color-primary-light)', borderLeft: '4px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem'
      }}>
        <div style={{
          background: 'var(--color-surface)',
          width: 40, height: 40, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', boxShadow: 'var(--shadow-sm)', color: 'var(--color-primary)'
        }}>
          <ShieldCheck size={20} />
        </div>
        <div>
          <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: 4 }}>{t("Nguyên tắc hoạt động")}</h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
            {t("Các quy tắc được kiểm tra ưu tiên {topDown} (Top-Down). Kéo thả biểu tượng {grip} để thay đổi độ ưu tiên.").replace('{topDown}', t('từ trên xuống dưới')).replace('{grip}', '⋮⋮')}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {/* Filter 1: Connection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{t("Lọc theo nguồn:")}</div>
          <div style={{ width: 280 }}>
            <CustomSelect
              options={[
                { value: 'all', label: t('Hiển thị tất cả nguồn'), icon: <Filter size={14} color="#64748b" /> },
                { value: 'null', label: t('Chỉ các Quy tắc "Tất cả kết nối"'), icon: <Globe size={14} color="#BD1D2D" /> },
                { value: -1, label: t('Tất cả Google Sheets'), icon: <FileSpreadsheet size={14} color="#10b981" /> },
                { value: -2, label: t('Tất cả API / Landing Pages'), icon: <Zap size={14} color="#f59e0b" /> },
                { value: -3, label: t('Chỉ nhóm "Data Nhập tay"'), icon: <Keyboard size={14} color="#ec4899" /> },
                ...connections.map(c => ({ value: c.id, label: c.sheet_name, icon: <FileSpreadsheet size={14} color="#10b981" /> }))
              ]}
              value={activeFilter === null ? 'null' : activeFilter.toString()}
              onChange={(v) => setActiveFilter(v === 'all' ? 'all' : (v === 'null' ? null : Number(v)))}
            />
          </div>
        </div>

        {/* Filter 2: Round */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{t("Lọc theo vòng hành động xử lý:")}</div>
          <div style={{ width: 280 }}>
            <CustomSelect
              options={[
                { value: 'all', label: t('Hiển thị tất cả vòng hành động'), icon: <Filter size={14} color="#64748b" /> },
                ...rounds.map(r => ({ value: r.id.toString(), label: r.round_name, icon: <MapPin size={14} color="var(--color-primary)" /> }))
              ]}
              value={activeRoundFilter.toString()}
              onChange={(v) => setActiveRoundFilter(v === 'all' ? 'all' : Number(v))}
            />
          </div>
        </div>

        {(activeFilter !== 'all' || activeRoundFilter !== 'all') && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-warning)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} /> {t("Chế độ lọc đang bật. Kéo thả thứ tự tạm khóa.")}
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'visible', paddingBottom: '2rem' }}>
        {loading ? (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => <CardSkeleton key={i} height={90} />)}
          </div>
        ) : filteredRules.length === 0 ? (
          <EmptyCard
            icon={<Filter size={48} />}
            title={t("Không tìm thấy Quy tắc nào")}
            description={t("Thử thay đổi bộ lọc hoặc thêm quy tắc mới.")}
            actionText={t("Thêm Quy tắc")}
            onAction={openAddModal}
          />
        ) : (
          <div style={{ padding: '0.5rem' }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredRules.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {filteredRules.map((rule) => {
                  const originalIdx = rules.findIndex(r => r.id === rule.id);
                  return (
                    <SortableRuleItem
                      key={rule.id} rule={rule} idx={originalIdx} connections={connections}
                      onEdit={openEditModal}
                      onDelete={(id) => { setDeleteId(id); setIsConfirmOpen(true); }}
                      isDragDisabled={isReadOnly || activeFilter !== 'all'}
                      isReadOnly={isReadOnly}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
            <div style={{ padding: '0 1rem', marginTop: '1rem' }}>
              <button
                onClick={openAddModal}
                style={{ width: '100%', padding: '0.875rem', background: 'transparent', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
              >
                <Filter size={18} /> {t("Thêm Quy tắc mới")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Modal for Add/Edit */}
      <CustomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRule ? t("Chỉnh sửa Quy tắc") : t("Thêm Quy tắc mới")}
        width="800px"
      >
        {isModalOpen && (
          <fieldset disabled={isReadOnly} style={{ border: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem 0' }}>
          <div>
            <label className="form-label">{t("Áp dụng cho Nguồn (Connection)")}</label>
            <CustomSelect
              multiple
              options={[
                { value: 'all', label: t('Tất cả mọi kết nối (Sheet & API & Nhập tay)'), icon: <Globe size={14} color="#BD1D2D" /> },
                { value: -1, label: t('Tất cả các Google Sheets'), icon: <FileSpreadsheet size={14} color="#10b981" /> },
                { value: -2, label: t('Tất cả các API / Landing Pages'), icon: <Zap size={14} color="#f59e0b" /> },
                { value: -3, label: t('Chỉ Data Nhập tay (Thêm Data Nhanh)'), icon: <Keyboard size={14} color="#ec4899" /> },
                ...connections.map(c => ({ value: c.id, label: c.sheet_name, icon: <FileSpreadsheet size={14} color="#10b981" /> }))
              ]}
              value={connectionId}
              onChange={(v) => setConnectionId(v)}
              disabled={isReadOnly}
            />
          </div>


          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {branches.map((branch, bIndex) => (
              <div key={bIndex} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: 'var(--color-primary)', borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', margin: 0 }}>{t("Nhánh {num}").replace('{num}', String(bIndex + 1))}</h4>
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
                      <div key={i} className="condition-row-responsive" style={{ background: 'transparent', padding: '0', position: 'relative' }}>
                        <div style={{ position: 'relative', width: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {i === 0 ? (
                            <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, position: 'relative', zIndex: 2 }}>IF</div>
                          ) : (
                            <div style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0, position: 'relative', zIndex: 2 }}>AND</div>
                          )}
                          {!isLast && (
                            <div style={{ position: 'absolute', top: 32, bottom: -20, left: 15, width: 2, background: 'var(--color-border)', zIndex: 1 }} />
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ background: 'var(--color-bg)', borderRadius: 20, border: '1px solid var(--color-border)' }}>
                            <CustomSelect
                              options={getFieldOptions()}
                              value={c.col}
                              onChange={val => {
                                const newB = [...branches];
                                newB[bIndex].conditions[i].col = String(val);
                                setBranches(newB);
                              }}
                              placeholder={t("Chọn trường...")}
                              disabled={isReadOnly}
                            />
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ background: 'var(--color-bg)', borderRadius: 20, border: '1px solid var(--color-border)' }}>
                            <CustomSelect
                              options={opOptions}
                              value={c.op}
                              onChange={val => {
                                const newB = [...branches];
                                newB[bIndex].conditions[i].op = String(val);
                                setBranches(newB);
                              }}
                              disabled={isReadOnly}
                            />
                          </div>
                        </div>
                        {!isNoValueOp && (
                          <div style={{ flex: 1 }}>
                            {c.op.startsWith('date_') ? (
                              <input
                                type="date"
                                style={{ width: '100%', padding: '8px 16px', borderRadius: 20, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none' }}
                                value={c.val}
                                onChange={e => {
                                  const newB = [...branches];
                                  newB[bIndex].conditions[i].val = e.target.value;
                                  setBranches(newB);
                                }}
                              />
                            ) : c.col === 'connection_id' ? (
                              <CustomSelect
                                options={[
                                  { value: '', label: t('Chọn Sheet tích hợp...') },
                                  ...connections.map(conn => ({ value: String(conn.id), label: conn.sheet_name }))
                                ]}
                                value={c.val}
                                onChange={v => {
                                  const newB = [...branches];
                                  newB[bIndex].conditions[i].val = String(v);
                                  setBranches(newB);
                                }}
                                disabled={isReadOnly}
                              />
                            ) : (
                              <input
                                style={{ width: '100%', padding: '8px 16px', borderRadius: 20, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none' }}
                                placeholder={t("Nhập giá trị...")}
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
                            title={t("Xóa điều kiện này")}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ paddingLeft: 44, marginTop: '0.75rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: -12, left: 15, width: 2, height: 24, background: 'var(--color-border)', zIndex: 1 }} />
                    <button
                      type="button"
                      onClick={() => {
                        const newB = [...branches];
                        newB[bIndex].conditions.push({ col: 'source', op: 'contains', val: '' });
                        setBranches(newB);
                      }}
                      style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Plus size={14} /> {t("Thêm điều kiện")}
                    </button>
                  </div>

                  {/* INJECT DATA FIELDS TOGGLE */}
                  <div style={{ paddingLeft: 44, marginTop: '1rem', borderTop: '1px dashed var(--color-border)', paddingTop: '1rem' }}>
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
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{t("Tự động gán trường dữ liệu (Inject Data)")}</span>
                    </div>

                    {branch.inject?.enabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--color-bg)', padding: '1rem', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                        {branch.inject.fields.map((f: any, fi: number) => {
                          const isCustomMode = f.isCustom || !['source', 'type', 'note', 'name', ''].includes(f.col);
                          return (
                            <div key={fi} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ flex: isCustomMode ? '0 0 180px' : 1, background: 'var(--color-surface)', borderRadius: 20, border: '1px solid var(--color-border)' }}>
                                <CustomSelect
                                  options={[
                                    { value: 'source', label: t('Nguồn Khách (Source)') },
                                    { value: 'type', label: t('Loại Khách (Type)') },
                                    { value: 'note', label: t('Ghi Chú (Note)') },
                                    { value: 'name', label: t('Tên Khách Hàng (Name)') },
                                    { value: 'custom_trigger', label: t('Tùy chỉnh (Custom Key)...') }
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
                                  disabled={isReadOnly}
                                />
                              </div>

                              {isCustomMode && (
                                <div style={{ flex: 1, minWidth: 120 }}>
                                  <input
                                    style={{ width: '100%', padding: '8px 16px', borderRadius: 20, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none' }}
                                    placeholder={t("Tên trường custom (vd: utm_source)...")}
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
                                  style={{ width: '100%', padding: '8px 16px', borderRadius: 20, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none' }}
                                  placeholder={t("Giá trị muốn gán tự động...")}
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
                          <Plus size={14} /> {t("Thêm trường")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isReadOnly && (
            <div style={{ padding: '0', marginTop: '0', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setBranches([...branches, { conditions: [{ col: 'source', op: 'contains', val: '' }], inject: { enabled: false, fields: [] } }])}
                style={{ width: '100%', padding: '0.875rem', background: 'transparent', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
              >
                <Plus size={18} /> {t("Thêm Nhánh Mới")}
              </button>
            </div>
          )}
          <div>
            <label className="form-label">{t("Hành động: Phân bổ vào")}</label>
            <CustomSelect
              options={rounds.map(r => ({
                value: r.id.toString(),
                label: r.name || r.round_name,
                disabled: Number(r.is_active) !== 1,
                disabledType: 'round' as const
              }))}
              value={targetRound.toString()}
              onChange={(v) => setTargetRound(Number(v))}
              placeholder={t("Chọn vòng phân bổ...")}
              disabled={isReadOnly}
            />
          </div>
          <div style={{ padding: '1.25rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
            <button type="button" className="btn outline" onClick={() => setIsModalOpen(false)}>{isReadOnly ? t("Đóng") : t("Hủy bỏ")}</button>
            {!isReadOnly && (
              <button type="button" onClick={handleSaveRule} className="btn primary" disabled={isSaving}>
                {isSaving ? t('Đang lưu...') : (editingRule ? t('Cập nhật') : t('Thêm mới'))}
              </button>
            )}
          </div>
          </fieldset>
        )}
      </CustomModal>

      {/* Global Confirm Modal for Deletion */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t("Xóa Quy Tắc Định Tuyến")}
        message={t("Bạn có chắc chắn muốn xóa Quy tắc này? Các luồng phân bổ Data có thể bị ảnh hưởng ngay lập tức.")}
      />

      {/* No Sheet Modal */}
      <CustomModal
        isOpen={isNoSheetModalOpen}
        onClose={() => setIsNoSheetModalOpen(false)}
        title={t("Chưa có kết nối Google Sheets")}
        width={400}
      >
        {isNoSheetModalOpen && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ background: 'var(--color-warning-light)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Link2 size={32} color="var(--color-warning)" />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t("Bạn cần kết nối Sheets trước")}</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>{t("Hệ thống quy tắc định tuyến cần có cấu hình cột từ Google Sheets để hoạt động. Vui lòng thiết lập ít nhất 1 kết nối Tích hợp trước khi tạo quy tắc.")}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn outline" onClick={() => setIsNoSheetModalOpen(false)}>{t("Hủy bỏ")}</button>
              <button className="btn primary" onClick={() => navigate('/integrations')}>{t("Đi tới Tích hợp")}</button>
            </div>
          </div>
        )}
      </CustomModal>

      {/* Simulator Modal (Hộp thử nghiệm) */}
      <CustomModal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        title={t("Thử nghiệm Định tuyến Lead")}
        width="1050px"
      >
        {isSimulateModalOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
            {t("Giả lập một lead mới đi vào hệ thống định tuyến để kiểm tra xem rule nào khớp và Sale nào sẽ nhận được data.")}
          </p>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
            {/* Cột trái: Nhập thông tin (Form) */}
            <div style={{ flex: '1 1 450px', background: 'var(--color-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Server size={16} color="var(--color-primary)" /> {t("Thông tin Lead Giả lập")}
              </h4>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{t("Họ và Tên")}</label>
                <input
                  className="form-input"
                  value={simulatePayload.name}
                  onChange={e => setSimulatePayload({ ...simulatePayload, name: e.target.value })}
                  placeholder={t("VD: Nguyễn Văn A")}
                />
              </div>

              <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{t("Số điện thoại")}</label>
                  <input
                    className="form-input"
                    value={simulatePayload.phone}
                    onChange={e => setSimulatePayload({ ...simulatePayload, phone: e.target.value })}
                    placeholder={t("VD: 0987654321")}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{t("Email")}</label>
                  <input
                    className="form-input"
                    value={simulatePayload.email}
                    onChange={e => setSimulatePayload({ ...simulatePayload, email: e.target.value })}
                    placeholder={t("VD: test@domain.com")}
                  />
                </div>
              </div>

              <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{t("Nguồn (Source)")}</label>
                  <input
                    className="form-input"
                    value={simulatePayload.source}
                    onChange={e => setSimulatePayload({ ...simulatePayload, source: e.target.value })}
                    placeholder={t("VD: Facebook Ads")}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{t("Loại (Type)")}</label>
                  <input
                    className="form-input"
                    value={simulatePayload.type}
                    onChange={e => setSimulatePayload({ ...simulatePayload, type: e.target.value })}
                    placeholder={t("VD: Dang ky hoc")}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{t("Ghi chú (Note)")}</label>
                <input
                  className="form-input"
                  value={simulatePayload.note}
                  onChange={e => setSimulatePayload({ ...simulatePayload, note: e.target.value })}
                  placeholder={t("VD: Tư vấn buổi tối")}
                />
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.75rem', color: '#475569' }}>{t("Cấu hình Kết nối & Loại nguồn nhận")}</h5>
                <div 
                  className={simulateConnectionType === 'manual' ? '' : 'responsive-grid-1-1'}
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: simulateConnectionType === 'manual' ? '1fr' : '1fr 1fr', 
                    gap: '1rem' 
                  }}>
                  {simulateConnectionType !== 'manual' && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Nguồn tích hợp")}</label>
                      <CustomSelect
                        options={[
                          { value: 'all', label: t('Tất cả kết nối'), icon: <Globe size={14} color="#BD1D2D" /> },
                          ...connections
                            .filter(c => c.connection_type === simulateConnectionType)
                            .map(c => ({
                              value: c.id.toString(),
                              label: c.sheet_name,
                              icon: c.connection_type === 'landing_page'
                                ? <Zap size={14} color="#f59e0b" />
                                : <FileSpreadsheet size={14} color="#10b981" />
                            }))
                        ]}
                        value={simulateConnectionId}
                        onChange={v => setSimulateConnectionId(String(v))}
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Loại kết nối")}</label>
                    <CustomSelect
                      options={[
                        ...(connections.some(c => c.connection_type === 'sheets') ? [
                          { value: 'sheets', label: t('Google Sheets'), icon: <FileSpreadsheet size={14} color="#10b981" /> }
                        ] : []),
                        ...(connections.some(c => c.connection_type === 'landing_page') ? [
                          { value: 'landing_page', label: t('Landing Page API'), icon: <Zap size={14} color="#f59e0b" /> }
                        ] : []),
                        { value: 'manual', label: t('Nhập tay'), icon: <Keyboard size={14} color="#ec4899" /> }
                      ]}
                      value={simulateConnectionType}
                      onChange={v => setSimulateConnectionType(String(v))}
                    />
                  </div>
                </div>
              </div>

              {/* Custom fields list */}
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h5 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: '#475569' }}>{t("Trường dữ liệu tùy chỉnh (Cột Sheets custom)")}</h5>
                  <button
                    type="button"
                    onClick={() => setSimulateCustomFields([...simulateCustomFields, { key: '', val: '' }])}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={14} /> {t("Thêm trường")}
                  </button>
                </div>

                {simulateCustomFields.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                    {simulateCustomFields.map((f, fi) => (
                      <div key={fi} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          style={{ flex: 1, padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                          placeholder={t("Tên cột (vd: utm_medium)...")}
                          value={f.key}
                          onChange={e => {
                            const newF = [...simulateCustomFields];
                            newF[fi].key = e.target.value;
                            setSimulateCustomFields(newF);
                          }}
                        />
                        <input
                          style={{ flex: 1.5, padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                          placeholder={t("Giá trị...")}
                          value={f.val}
                          onChange={e => {
                            const newF = [...simulateCustomFields];
                            newF[fi].val = e.target.value;
                            setSimulateCustomFields(newF);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setSimulateCustomFields(simulateCustomFields.filter((_, idx) => idx !== fi))}
                          style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn primary"
                onClick={handleRunSimulation}
                disabled={simulateLoading}
                style={{ width: '100%', padding: '0.75rem', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700 }}
              >
                {simulateLoading ? (
                  <>
                    <RefreshCw size={16} className="spin" /> {t("Đang chạy mô phỏng...")}
                  </>
                ) : (
                  <>
                    <Play size={16} fill="white" /> {t("Bắt đầu Mô phỏng")}
                  </>
                )}
              </button>
            </div>

            {/* Cột phải: Kết quả Trace */}
            <div style={{ flex: '1.2 1 500px', display: 'flex', flexDirection: 'column', minHeight: '500px', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ background: 'var(--color-bg)', padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, textTransform: 'uppercase' }}>
                  {t("Kết quả phân tích đường đi")}
                </h4>
              </div>

              <div className="no-scrollbar" style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'var(--color-surface)' }}>
                {simulateLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '1rem', color: 'var(--color-text-muted)' }}>
                    <div style={{ width: 40, height: 40, border: '4px solid var(--color-border-light)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: '0.875rem' }}>{t("Đang chạy phân tích quy tắc hệ thống...")}</span>
                  </div>
                ) : !simulateResult ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, border: '2px dashed var(--color-border)', borderRadius: '8px', padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: '1rem' }}>
                      <Play size={24} fill="currentColor" style={{ marginLeft: 3 }} />
                    </div>
                    <h5 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-text-light)', marginBottom: 4 }}>{t("Chưa chạy thử nghiệm")}</h5>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: 350, margin: 0 }}>{t("Vui lòng điền thông tin lead giả lập ở cột bên trái và bấm nút \"Bắt đầu Mô phỏng\".")}</p>
                  </div>
                ) : (
                  <>
                    {/* Hộp đích đến */}
                    <div style={{
                      background: (simulateResult.is_fallback_admin || simulateResult.is_fallback)
                        ? 'var(--color-warning-light)'
                        : (simulateResult.consultant ? 'var(--color-success-light)' : 'var(--color-danger-light)'),
                      border: '1px solid ' + ((simulateResult.is_fallback_admin || simulateResult.is_fallback) ? 'var(--color-warning)' : (simulateResult.consultant ? 'var(--color-success)' : 'var(--color-danger)')),
                      borderRadius: '10px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <div style={{ flexShrink: 0 }}>
                        {simulateResult.consultant ? (
                          <Avatar src={simulateResult.consultant.avatar} name={simulateResult.consultant.name} size={36} />
                        ) : (
                          <div style={{
                            background: 'var(--color-surface)',
                            color: 'var(--color-danger)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            width: 36, height: 36,
                            borderRadius: '50%'
                          }}>
                            <XCircle size={20} />
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                            {simulateResult.consultant ? simulateResult.consultant.name : t('Không tìm thấy người nhận')}
                          </h4>
                          <span style={{
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: (simulateResult.is_fallback_admin || simulateResult.is_fallback) ? '#d97706' : (simulateResult.consultant ? '#10b981' : '#ef4444'),
                            color: '#fff',
                            textTransform: 'uppercase',
                            letterSpacing: '0.2px'
                          }}>
                            {simulateResult.is_fallback_admin
                              ? t('Fallback (Admin)')
                              : (simulateResult.is_fallback ? t('Fallback (Mặc định)') : (simulateResult.consultant ? t('Thành công') : t('Không khớp')))}
                          </span>
                        </div>

                        {simulateResult.consultant && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.775rem', color: '#475569' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={12} color="var(--color-primary)" /> <strong>{t("Vòng chia:")}</strong> {simulateResult.consultant.round_name}
                              </div>
                              {simulateResult.consultant.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
                                  <Mail size={12} color="var(--color-text-muted)" /> <strong>{t("Email:")}</strong> {simulateResult.consultant.email}
                                </div>
                              )}
                            </div>

                            {/* Giải thích logic chọn Sale */}
                            {simulateResult.consultant.consultant_id > 0 && (
                              <div style={{
                                marginTop: '4px',
                                borderTop: '1px dashed rgba(0,0,0,0.06)',
                                paddingTop: '4px',
                                fontSize: '0.75rem',
                                color: '#475569'
                              }}>
                                <strong>{t("Lý do:")}</strong>{' '}
                                {simulateResult.consultant.reason ? (
                                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                                    {t(simulateResult.consultant.reason)}
                                  </span>
                                ) : simulateResult.consultant.is_compensation ? (
                                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                                    {t("Được nhận đền bù số lỗi (còn nợ: {count} số).").replace('{count}', String(simulateResult.consultant.compensation_count))}
                                  </span>
                                ) : simulateResult.consultant.is_mid_turn ? (
                                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                                    {t("Đang trong lượt nhận gộp (còn {count} số).").replace('{count}', String(simulateResult.consultant.current_turn_remaining))}
                                  </span>
                                ) : (
                                  <span>
                                    {t("Xoay vòng thông thường (Skip: {count1}/{count2}).").replace('{count1}', String(simulateResult.consultant.skip_count)).replace('{count2}', String(simulateResult.consultant.receive_ratio - 1))}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Injected Fields */}
                    {simulateResult.injected_fields && Object.keys(simulateResult.injected_fields).length > 0 && (
                      <div style={{ padding: '0.75rem 1rem', background: 'var(--color-primary-light)', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                        <h5 style={{ fontSize: '0.8rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Zap size={14} color="var(--color-primary)" /> {t("Ghi đè thuộc tính (Inject Data):")}
                        </h5>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Object.entries(simulateResult.injected_fields).map(([key, val]: any) => (
                            <span key={key} style={{ fontSize: '0.75rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '6px', color: 'var(--color-primary)' }}>
                              <strong>{key}</strong> -&gt; "{val}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Danh sách Trace Logs */}
                    <div>
                      <h5 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-light)', margin: '0 0 10px', textTransform: 'uppercase' }}>
                        {t("Chi tiết quy trình quét quy tắc (Trace Logs)")}
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {simulateResult.trace && simulateResult.trace.map((traceItem: any, idx: number) => {
                          const isMatched = traceItem.status === 'matched';
                          const isSkipped = traceItem.status === 'skipped';
                          return (
                            <div key={idx} style={{
                              border: '1px solid ' + (isMatched ? 'var(--color-success)' : (isSkipped ? 'var(--color-border)' : 'var(--color-danger)')),
                              borderRadius: '8px',
                              overflow: 'hidden'
                            }}>
                              {/* Header của Rule Trace */}
                              <div style={{
                                background: isMatched ? 'var(--color-success-light)' : (isSkipped ? 'var(--color-bg)' : 'var(--color-danger-light)'),
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid ' + (isMatched ? 'var(--color-success)' : (isSkipped ? 'var(--color-border)' : 'var(--color-danger)'))
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: isMatched ? 'var(--color-success)' : (isSkipped ? 'var(--color-text-muted)' : 'var(--color-danger)')
                                  }} />
                                  <span style={{ fontSize: '0.825rem', fontWeight: 700, color: isMatched ? 'var(--color-success)' : (isSkipped ? 'var(--color-text-light)' : 'var(--color-danger)') }}>
                                    {traceItem.description}
                                  </span>
                                </div>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: isMatched ? 'var(--color-success-light)' : (isSkipped ? 'var(--color-border-light)' : 'var(--color-danger-light)'),
                                  color: isMatched ? 'var(--color-success)' : (isSkipped ? 'var(--color-text-light)' : 'var(--color-danger)'),
                                  textTransform: 'uppercase'
                                }}>
                                  {isMatched ? t('Khớp') : (isSkipped ? t('Bỏ qua') : t('Lỗi'))}
                                </span>
                              </div>

                              {/* Chi tiết điều kiện kiểm tra */}
                              <div style={{ padding: '8px 12px', background: 'var(--color-surface)', fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
                                {isSkipped ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic' }}>
                                    <AlertCircle size={14} /> {t(traceItem.reason)}
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {traceItem.conditions && traceItem.conditions.map((c: any, ci: number) => (
                                      <div key={ci} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                          <span style={{ background: 'var(--color-bg)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, color: 'var(--color-text-light)' }}>
                                            {c.col}
                                          </span>
                                          <span style={{ fontStyle: 'italic', fontSize: '0.725rem' }}>
                                            {t(OP_LABELS[c.op]) || c.op}
                                          </span>
                                          {c.op !== 'is_empty' && c.op !== 'is_not_empty' && (
                                            <span style={{ fontWeight: 600 }}>
                                              "{c.val}"
                                            </span>
                                          )}
                                        </div>
                                        <span style={{ fontWeight: 700, color: c.matched ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                          {c.matched ? t('Đạt') : t('Không đạt')}
                                        </span>
                                      </div>
                                    ))}
                                    <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 4, fontSize: '0.725rem', fontStyle: 'italic', color: '#94a3b8' }}>
                                      {t("Kết luận:")} {t(traceItem.reason)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      </CustomModal>

      {/* AI Evaluation Modal */}
      <CustomModal
        isOpen={isAiEvalModalOpen}
        onClose={() => setIsAiEvalModalOpen(false)}
        title={t("AI Đánh giá cấu hình Quy tắc")}
        width="800px"
      >
        {isAiEvalModalOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '12px' }}>
              <img 
                src="/LOGO.jpg" 
                alt="Gemini AI Logo" 
                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary-light)', boxShadow: 'var(--shadow-sm)' }} 
              />
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>{t("Trợ lý Rich Land AI Đánh giá")}</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t("Phân tích xung đột, tối ưu thứ tự ưu tiên và phát hiện kẽ hở định tuyến")}</p>
              </div>
            </div>
            {aiEvalStep === 'preview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t("Nhấn xác nhận bên dưới để gửi toàn bộ cấu hình quy tắc định tuyến hiện tại lên Gemini AI phân tích các xung đột logic, tối ưu thứ tự ưu tiên và phát hiện kẽ hở định tuyến.")}
                </p>
                <div style={{ background: 'var(--color-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h5 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                    {t("Cấu hình sẽ gửi lên AI gồm {count} quy tắc:").replace('{count}', String(rules.length))}
                  </h5>
                  <div className="no-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {rules.map((r, idx) => {
                      let parsedConds = [];
                      if (r.conditions_json) {
                        try {
                          parsedConds = typeof r.conditions_json === 'string' ? JSON.parse(r.conditions_json) : r.conditions_json;
                        } catch (e) {}
                      }
                      let condText = "";
                      if (Array.isArray(parsedConds) && parsedConds.length > 0) {
                        const firstBranch = parsedConds[0];
                        const conds = firstBranch.conditions || [];
                        condText = conds.map((c: any) => `${c.col} ${c.op} "${c.val}"`).join(' VÀ ');
                        if (parsedConds.length > 1) condText += ` (+ ${parsedConds.length - 1} nhánh OR)`;
                      } else {
                        condText = `${r.condition_column} ${r.condition_operator} "${r.condition_value}"`;
                      }
                      
                      return (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px', 
                          fontSize: '0.85rem', 
                          padding: '10px 16px', 
                          background: 'var(--color-surface)', 
                          borderRadius: 'var(--radius-md)', 
                          border: '1px solid var(--color-border)', 
                          boxShadow: 'var(--shadow-xs)' 
                        }}>
                          <span style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            background: 'var(--color-bg)', 
                            border: '1px solid var(--color-border)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '0.75rem', 
                            fontWeight: 800, 
                            color: 'var(--color-primary)',
                            flexShrink: 0
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{ color: 'var(--color-text-light)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t("Điều kiện:")} <strong style={{ color: 'var(--color-text)' }}>{condText}</strong>
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>&rarr;</span>
                          <span style={{ 
                            background: 'linear-gradient(135deg, rgba(163, 20, 34, 0.05), rgba(163, 20, 34, 0.12))',
                            border: '1px solid var(--color-primary-light)',
                            color: 'var(--color-primary)',
                            padding: '4px 14px',
                            borderRadius: '50px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            boxShadow: '0 2px 4px rgba(163, 20, 34, 0.05)'
                          }}>
                            {r.round_name || `Vòng ${r.target_round_id}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button className="btn outline" onClick={() => setIsAiEvalModalOpen(false)}>{t("Hủy bỏ")}</button>
                  <button className="btn primary" onClick={triggerAiEvaluation} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {t("Xác nhận và Gửi đánh giá")}
                  </button>
                </div>
              </div>
            )}

            {aiEvalStep === 'loading' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1.25rem', color: 'var(--color-text-muted)' }}>
                <div style={{ width: 48, height: 48, border: '4px solid var(--color-border-light)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t("Gemini AI đang phân tích thiết lập và thứ tự ưu tiên của các Quy tắc...")}</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: 450, margin: 0 }}>
                  {t("Hệ thống đang chạy kiểm tra các xung đột logic, quy tắc bị che phủ (redundant/shadowed), khe hở định tuyến (gaps) và đề xuất tối ưu hóa tốt nhất.")}
                </p>
              </div>
            )}

            {aiEvalStep === 'result' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div 
                  className="ai-feedback-content"
                  style={{ 
                    maxHeight: '500px', 
                    overflowY: 'auto', 
                    padding: '1.25rem', 
                    background: 'var(--color-bg)', 
                    border: '1px solid var(--color-border)', 
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    color: 'var(--color-text)'
                  }}
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(aiEvalFeedback) }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button className="btn outline" onClick={() => setAiEvalStep('preview')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} /> {t("Xem lại cấu hình")}
                  </button>
                  <button className="btn primary" onClick={() => setIsAiEvalModalOpen(false)}>{t("Đóng")}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </CustomModal>
    </div>
  );
};

export const RuleSettings = withRouterFreezer(RuleSettingsInner, '/rules');
