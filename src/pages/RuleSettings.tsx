import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { withRouterFreezer } from '../components/RouterFreezer';
import { Plus, Trash2, ShieldCheck, ArrowRight, Filter, Server, MapPin, GripVertical, Edit2, Link2, FileSpreadsheet, Zap, Keyboard, Globe, Play, XCircle, AlertCircle, RefreshCw, Mail, Info, Layers, Cpu, SlidersHorizontal, Loader2, Clock } from 'lucide-react';
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
  contains: 'Chứa',
  not_contains: 'Không chứa',
  equals: 'Là',
  not_equals: 'Khác',
  starts_with: 'Bắt đầu bằng',
  ends_with: 'Kết thúc bằng',
  is_empty: 'Trống',
  is_not_empty: 'Có dữ liệu',
  date_before: 'Trước ngày',
  date_after: 'Sau ngày',
  date_equals: 'Đúng ngày'
};

const FIELD_SHORT_LABELS: Record<string, string> = {
  source: 'Nguồn Data',
  project_id: 'Dự án',
  preferred_location: 'Khu vực',
  type: 'Loại Data',
  platform: 'Nền tảng Ads',
  utm_campaign: 'UTM Campaign',
  utm_medium: 'UTM Medium',
  utm_content: 'UTM Content',
  utm_term: 'UTM Term',
  form_name: 'Lead Form',
  budget: 'Ngân sách',
  note: 'Ghi chú',
  name: 'Họ tên',
  phone: 'Số điện thoại',
  email: 'Email',
  connection_id: 'Nguồn kết nối'
};

// Sortable Item Component
const SortableRuleItem = ({ rule, idx, connections, projects = [], onEdit, onDelete, isDragDisabled, isReadOnly }: { rule: any, idx: number, connections: any[], projects?: any[], onEdit: (r: any) => void, onDelete: (id: number) => void, isDragDisabled?: boolean, isReadOnly?: boolean }) => {
  const { t } = useLanguage();
  const [showAllBranches, setShowAllBranches] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  // Parse & smart-consolidate branches whose non-project conditions are identical
  const consolidatedBranches = useMemo(() => {
    const parsed = (() => {
      if (rule.conditions_json) {
        try {
          return typeof rule.conditions_json === 'string' ? JSON.parse(rule.conditions_json) : rule.conditions_json;
        } catch (e) {
          return [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }];
        }
      }
      return [{ col: rule.condition_column, op: rule.condition_operator, val: rule.condition_value }];
    })();

    const rawBranches: any[] = (() => {
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (parsed[0].col) return [{ conditions: parsed }];
        if (Array.isArray(parsed[0])) return parsed.map(b => ({ conditions: b }));
        if (parsed[0].conditions) return parsed;
      }
      return [{ conditions: [] }];
    })();

    // Group branches that share identical non-project conditions and only vary by project_id (equals/contains)
    const grouped: any[] = [];
    const signatureMap = new Map<string, number>();

    rawBranches.forEach((branch) => {
      const conds = Array.isArray(branch.conditions) ? branch.conditions : [];
      const projConds = conds.filter((c: any) => c.col === 'project_id' && (c.op === 'equals' || c.op === 'contains'));
      const otherConds = conds.filter((c: any) => !(c.col === 'project_id' && (c.op === 'equals' || c.op === 'contains')));
      const injectSig = branch.inject?.enabled ? JSON.stringify(branch.inject.fields || []) : '';

      if (projConds.length === 1) {
        const sig = JSON.stringify(otherConds.map((c: any) => ({ col: c.col, op: c.op, val: c.val }))) + '||' + injectSig;
        if (signatureMap.has(sig)) {
          const targetIdx = signatureMap.get(sig)!;
          const existingProjCond = grouped[targetIdx].conditions.find((c: any) => c.col === 'project_id' && (c.op === 'equals' || c.op === 'contains'));
          if (existingProjCond) {
            const existingVals = String(existingProjCond.val || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            const newVals = String(projConds[0].val || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            newVals.forEach((v: string) => {
              if (!existingVals.includes(v)) existingVals.push(v);
            });
            existingProjCond.val = existingVals.join(',');
          }
          grouped[targetIdx].mergedCount = (grouped[targetIdx].mergedCount || 1) + 1;
          return;
        }
        signatureMap.set(sig, grouped.length);
      }

      grouped.push({
        ...branch,
        mergedCount: 1,
        conditions: conds.map((c: any) => ({ ...c }))
      });
    });

    return { grouped, rawCount: rawBranches.length };
  }, [rule.conditions_json, rule.condition_column, rule.condition_operator, rule.condition_value]);

  const visibleBranches = showAllBranches ? consolidatedBranches.grouped : consolidatedBranches.grouped.slice(0, 2);
  const hiddenBranchCount = Math.max(0, consolidatedBranches.grouped.length - 2);

  return (
    <div ref={setNodeRef} style={style} className={`group hover-lift ${isDragging ? 'is-dragging' : ''}`}>
      <div className="sortable-rule-card" style={{
        display: 'flex', alignItems: 'stretch', margin: '0.4rem 0.5rem', border: '1px solid var(--color-border)',
        borderRadius: '12px', background: 'var(--color-surface)', boxShadow: isDragging ? 'var(--shadow-lg)' : '0 1px 3px rgba(0,0,0,0.02)',
        transition: 'box-shadow 0.2s', overflow: 'hidden'
      }}>
        {/* Drag Handle & Priority */}
        <div className="sortable-rule-drag-handle" style={{
          background: 'var(--color-bg)', borderRight: '1px solid var(--color-border-light)',
          padding: '0.75rem 0.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minWidth: '52px'
        }}>
          {!isDragDisabled ? (
            <button {...attributes} {...listeners} style={{ cursor: 'grab', padding: '2px', color: 'var(--color-text-muted)' }}>
              <GripVertical size={18} />
            </button>
          ) : (
            <div style={{ padding: '2px', color: 'var(--color-border-light)' }}>
              <GripVertical size={18} />
            </div>
          )}
          <div style={{
            width: 26, height: 26, borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)',
            marginTop: 4, boxShadow: 'var(--shadow-xs)'
          }}>
            {idx + 1}
          </div>
        </div>

        {/* Content */}
        <div className="mobile-flex-wrap" style={{ flex: 1, minWidth: 0, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px', minWidth: 0 }}>
            {/* Source Header Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              {(() => {
                if (rule.connection_id === null || rule.connection_id === 'all' || rule.connection_id === '') {
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', background: 'rgba(189, 29, 45, 0.06)', border: '1px solid rgba(189, 29, 45, 0.15)', borderRadius: 6, color: '#BD1D2D' }}>
                      <Globe size={12} color="#BD1D2D" /> {t("Tất cả nguồn kết nối")}
                    </span>
                  );
                }

                const cIds = rule.connection_id.toString().split(',').map((id: string) => Number(id.trim()));
                return cIds.map((cId: number) => {
                  if (cId === -1) {
                    return (
                      <span key={cId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 6, color: '#059669' }}>
                        <FileSpreadsheet size={12} color="#10b981" /> {t("Tất cả Google Sheets")}
                      </span>
                    );
                  }
                  if (cId === -2) {
                    return (
                      <span key={cId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 6, color: '#d97706' }}>
                        <Zap size={12} color="#f59e0b" /> {t("Tất cả API / Landing Pages")}
                      </span>
                    );
                  }
                  if (cId === -3) {
                    return (
                      <span key={cId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', background: 'rgba(236, 72, 153, 0.08)', borderRadius: 6, color: '#db2777' }}>
                        <Keyboard size={12} color="#ec4899" /> {t("Data Nhập tay")}
                      </span>
                    );
                  }
                  const conn = connections.find(c => Number(c.id) === cId);
                  if (conn) {
                    return (
                      <span key={cId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: 6, color: 'var(--color-text)' }}>
                        <FileSpreadsheet size={12} color="#10b981" /> {conn.sheet_name}
                      </span>
                    );
                  }
                  return null;
                });
              })()}
              {consolidatedBranches.rawCount > 1 && (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '2px 7px', borderRadius: 6 }}>
                  {consolidatedBranches.rawCount} nhánh điều kiện
                </span>
              )}
            </div>

            {/* Compact Conditions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {visibleBranches.map((branch: any, bIndex: number) => (
                <div
                  key={bIndex}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border-light)',
                    padding: '6px 10px',
                    borderRadius: 8
                  }}
                >
                  {bIndex > 0 && (
                    <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#f59e0b', color: '#fff', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.3px' }}>
                      HOẶC
                    </span>
                  )}
                  {(branch.conditions || []).map((c: any, i: number) => {
                    const fieldLabel = FIELD_SHORT_LABELS[c.col] || c.col;
                    const isNoVal = c.op === 'is_empty' || c.op === 'is_not_empty';

                    // Render project chips cleanly without long DA codes
                    if (c.col === 'project_id' && !isNoVal) {
                      const rawIds = String(c.val || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                      return (
                        <div key={i} style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                          {i > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)', padding: '0 2px' }}>+</span>
                          )}
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {t('Dự án')}{rawIds.length > 1 ? ` (${rawIds.length})` : ''}:
                          </span>
                          {rawIds.map((pid: string, pIdx: number) => {
                            const foundProj = projects.find((p: any) => String(p.id) === String(pid));
                            const projName = foundProj ? foundProj.name : pid;
                            const projTooltip = foundProj
                              ? `${foundProj.name}${foundProj.code ? ` (${foundProj.code})` : ''} — Tự động khớp Tên, Mã & ID`
                              : pid;
                            return (
                              <span
                                key={pIdx}
                                title={projTooltip}
                                style={{
                                  background: '#fffbeb',
                                  border: '1px solid #fcd34d',
                                  color: '#92400e',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                {projName}
                              </span>
                            );
                          })}
                        </div>
                      );
                    }

                    return (
                      <div key={i} style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                        {i > 0 && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)', padding: '0 2px' }}>+</span>
                        )}
                        <span style={{
                          background: 'rgba(37, 99, 235, 0.07)',
                          border: '1px solid rgba(37, 99, 235, 0.2)',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontWeight: 600,
                          color: '#1d4ed8',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <span>{fieldLabel}:</span>
                          <strong style={{ fontWeight: 700 }}>
                            {isNoVal
                              ? (t(OP_LABELS[c.op]) || c.op)
                              : `${t(OP_LABELS[c.op]) || c.op} "${c.col === 'connection_id' ? (connections.find((conn: any) => String(conn.id) === String(c.val))?.sheet_name || c.val) : c.val}"`}
                          </strong>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {hiddenBranchCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllBranches(!showAllBranches);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '2px 4px'
                  }}
                >
                  {showAllBranches ? '▲ Thu gọn nhánh điều kiện' : `▼ Xem thêm ${hiddenBranchCount} nhánh điều kiện khác...`}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-border)' }}>
            <ArrowRight className="mobile-rotate-90" size={20} strokeWidth={1.75} style={{ transition: 'transform 0.2s' }} />
          </div>

          <div style={{ flex: '0 1 230px', minWidth: '200px' }}>
            <div style={{
              background: 'rgba(189, 29, 45, 0.05)',
              border: '1px solid rgba(189, 29, 45, 0.25)',
              color: 'var(--color-primary)',
              padding: '6px 12px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.825rem',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <div style={{ background: 'var(--color-primary)', width: 26, height: 26, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={13} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>
                  {rule.round_name || t("Vòng ID: {id}").replace('{id}', String(rule.target_round_id))}
                </span>
                {rule.is_schedule_active ? (
                  <span style={{ 
                    fontSize: '0.675rem', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    marginTop: 1,
                    color: rule.is_round_currently_active ? '#059669' : '#d97706',
                    fontWeight: 600 
                  }}>
                    <Clock size={10} /> {rule.active_time_start} - {rule.active_time_end} ({rule.is_round_currently_active ? t("Đang active") : t("Ngoài ca")})
                  </span>
                ) : (
                  <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 1, fontWeight: 500 }}>
                    <Clock size={10} /> 24/7
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sortable-rule-actions" style={{ padding: '0 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', borderLeft: '1px dashed var(--color-border-light)' }}>
          <button
            onClick={() => onEdit(rule)}
            className="btn ghost"
            style={{ width: 36, height: 36, padding: 0, borderRadius: 8, color: 'var(--color-primary)' }}
            title={isReadOnly ? t("Xem chi tiết") : t("Sửa quy tắc")}
          >
            {isReadOnly ? <Filter size={15} /> : <Edit2 size={15} />}
          </button>
          {!isReadOnly && (
            <button
              onClick={() => onDelete(rule.id)}
              className="btn ghost"
              style={{ width: 36, height: 36, padding: 0, borderRadius: 8, color: 'var(--color-danger)' }}
              title={t("Xóa quy tắc này")}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const parseMarkdownToHtml = (markdown: string) => {
  if (!markdown) return '';
  const html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h4 style="font-size: 1rem; font-weight: 700; color: var(--color-primary); margin-top: 1rem; margin-bottom: 0.5rem;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="font-size: 1.15rem; font-weight: 800; color: var(--color-primary); margin-top: 1.25rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--color-border-light); padding-bottom: 4px;">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 style="font-size: 1.3rem; font-weight: 800; color: var(--color-primary); margin-top: 1.5rem; margin-bottom: 1rem;">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\s*[-*]\s+(.*$)/gim, '<li style="margin-left: 1.25rem; margin-bottom: 0.25rem; list-style-type: disc;">$1</li>')
    .replace(/\n\n/g, '<div style="margin-bottom: 0.75rem;"></div>')
    .replace(/\n/g, '<br/>');

  return html;
};

const RuleSettingsInner = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { t } = useLanguage();
  const user = useAuthStore(state => state.user);
  const isReadOnly = !['admin', 'superadmin', 'super_admin', 'assistant'].includes(user?.role || '');
  const [rules, setRules] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [sysSettings, setSysSettings] = useState<any>(null);

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
    type: 'Đăng ký tư vấn',
    note: 'Cần tư vấn căn 2PN',
    project_id: ''
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

      if (simulatePayload.project_id) {
        dataPayload.project_id = simulatePayload.project_id;
      }

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
        })).filter((c: any) => Number(c.is_silent) !== 1);
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

  const latestRulesReqRef = useRef(0);

  const fetchRules = async () => {
    const reqId = ++latestRulesReqRef.current;
    try {
      const json = await fetchAPI('get_rules');
      if (reqId !== latestRulesReqRef.current) return;
      if (json.success) setRules(json.data);
    } catch (e: any) {
      console.error("Failed to fetch rules", e);
    }
    if (reqId === latestRulesReqRef.current) {
      setLoading(false);
    }
  };

  const fetchRounds = async () => {
    try {
      const json = await fetchAPI('get_rounds');
      if (json.success) setRounds(json.data);
    } catch (e: any) {
      console.error("Failed to fetch rounds", e);
    }
  };

  const fetchProjects = async () => {
    try {
      const json = await fetchAPI('projects');
      if (json.success) setProjects(json.data || []);
    } catch (e: any) {
      console.error("Failed to fetch projects", e);
    }
  };

  useEffect(() => {
    Promise.all([
      fetchRules(),
      fetchRounds(),
      fetchConnections(),
      fetchProjects(),
      fetchAPI('get_settings').then(res => {
        if (res && res.success) {
          setSysSettings(res.data);
        }
      }).catch(() => {})
    ]);
  }, []);

  useEffect(() => {
    setSimulateConnectionId('all');
  }, [simulateConnectionType]);

  const handleDragEnd = async (event: DragEndEvent) => {
    if (isReadOnly) return;
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

  const [activeBranchTab, setActiveBranchTab] = useState<number | 'all'>(0);

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
    setActiveBranchTab(0);
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
    setActiveBranchTab(0);
    setTargetRound(rule.target_round_id);
    setIsModalOpen(true);
  };

  // Smart helper to merge multiple branches that share identical non-project conditions into multi-project branches
  const mergedBranchesPreview = useMemo(() => {
    if (branches.length <= 1) return null;
    const grouped: any[] = [];
    const sigMap = new Map<string, number>();

    branches.forEach((branch) => {
      const conds = Array.isArray(branch.conditions) ? branch.conditions : [];
      const projConds = conds.filter((c: any) => c.col === 'project_id' && (c.op === 'equals' || c.op === 'contains'));
      const otherConds = conds.filter((c: any) => !(c.col === 'project_id' && (c.op === 'equals' || c.op === 'contains')));
      const injectSig = branch.inject?.enabled ? JSON.stringify(branch.inject.fields || []) : '';

      if (projConds.length === 1) {
        const sig = JSON.stringify(otherConds.map((c: any) => ({ col: c.col, op: c.op, val: c.val }))) + '||' + injectSig;
        if (sigMap.has(sig)) {
          const targetIdx = sigMap.get(sig)!;
          const existingProjCond = grouped[targetIdx].conditions.find((c: any) => c.col === 'project_id' && (c.op === 'equals' || c.op === 'contains'));
          if (existingProjCond) {
            const existingVals = String(existingProjCond.val || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            const newVals = String(projConds[0].val || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            newVals.forEach((v: string) => {
              if (!existingVals.includes(v)) existingVals.push(v);
            });
            existingProjCond.val = existingVals.join(',');
          }
          return;
        }
        sigMap.set(sig, grouped.length);
      }

      grouped.push({
        ...branch,
        conditions: conds.map((c: any) => ({ ...c })),
        inject: branch.inject ? { ...branch.inject, fields: [...(branch.inject.fields || [])] } : { enabled: false, fields: [] }
      });
    });

    return grouped.length < branches.length ? grouped : null;
  }, [branches]);

  const handleSaveRule = async () => {
    if (isReadOnly) return;
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
    if (isReadOnly || !deleteId || isDeleting) return;
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
      { value: 'source', label: t('Nguồn Data / Phân loại Lead (Hệ thống)') },
      { value: 'project_id', label: t('Dự án (Hệ thống - Project)') },
      { value: 'preferred_location', label: t('Khu vực / Dự án quan tâm (Preferred Location)') },
      { value: 'type', label: t('Loại Data (Hệ thống)') },
      { value: 'platform', label: t('Nền tảng Ads (Platform: Meta, Google, TikTok,...)') },
      { value: 'utm_campaign', label: t('Tên Chiến dịch Ads (UTM Campaign)') },
      { value: 'utm_medium', label: t('Hình thức Ads (UTM Medium)') },
      { value: 'utm_content', label: t('Nội dung Ads (UTM Content)') },
      { value: 'utm_term', label: t('Từ khóa Ads (UTM Term)') },
      { value: 'form_name', label: t('Tên Lead Form / Landing Page') },
      { value: 'budget', label: t('Ngân sách tài chính (Budget)') },
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
          label: t("Cột Sheets: {col}").replace('{col}', m.sheet_column)
        }));
        return [...baseFields, ...customFields];
      }
    } else {
      const allCols = new Set<string>();
      connections.forEach(c => {
        (c.mappings || []).forEach((m: any) => {
          if (m.sheet_column) allCols.add(m.sheet_column);
        });
      });
      if (allCols.size > 0) {
        const customFields = Array.from(allCols).map(col => ({
          value: col,
          label: t("Cột Sheets: {col}").replace('{col}', col)
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

  const filteredRules = useMemo(() => rules.filter(r => {
    const matchConnection = (() => {
      if (activeFilter === 'all') {
        return true;
      } else if (activeFilter === null) {
        return r.connection_id === null || r.connection_id === '' || r.connection_id === 'all';
      } else {
        if (r.connection_id === null || r.connection_id === '' || r.connection_id === 'all') {
          return false;
        } else {
          const cIds = r.connection_id.toString().split(',').map((id: string) => Number(id.trim()));
          return cIds.includes(activeFilter);
        }
      }
    })();

    let matchRound = true;
    if (activeRoundFilter !== 'all') {
      matchRound = Number(r.target_round_id) === Number(activeRoundFilter);
    }

    return matchConnection && matchRound;
  }), [rules, activeFilter, activeRoundFilter]);

  return (
    <div style={{ animation: 'fadeIn 0.3s', maxWidth: '100%', overflowX: 'hidden' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Filter size={24} color="var(--color-primary)" /> {t("Quy tắc Định tuyến (Routing Rules)")}
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: 'rgba(0, 0, 0, 0.02)',
                border: '1px solid var(--color-border)',
                padding: '4px 10px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'all 0.2s',
                marginLeft: '8px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                e.currentTarget.style.background = 'var(--color-primary-light)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
              }}
              title={t("Xem chi tiết quy định luật định tuyến và kết nối")}
            >
              <Info size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
            </button>
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
            actionText={isReadOnly ? undefined : t("Thêm Quy tắc")}
            onAction={isReadOnly ? undefined : openAddModal}
          />
        ) : (
          <div style={{ padding: '0.5rem' }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredRules.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {filteredRules.map((rule) => {
                  const originalIdx = rules.findIndex(r => r.id === rule.id);
                  return (
                    <SortableRuleItem
                      key={rule.id} rule={rule} idx={originalIdx} connections={connections} projects={projects}
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
        width="960px"
        maxWidth="96vw"
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


          {/* Smart 1-Click Merge Banner when multiple branches only differ by Project */}
          {!isReadOnly && mergedBranchesPreview && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fcd34d',
              borderRadius: '10px',
              padding: '0.625rem 0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#92400e', fontWeight: 600 }}>
                <Zap size={16} color="#d97706" style={{ flexShrink: 0 }} />
                <span>
                  Phát hiện <strong>{branches.length} nhánh</strong> có cùng điều kiện chỉ khác Dự án. Bạn có thể gộp gọn thành <strong>{mergedBranchesPreview.length} nhánh chọn nhiều Dự án</strong>!
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBranches(mergedBranchesPreview);
                  setActiveBranchTab(0);
                  toast.success('Đã gộp các nhánh cùng điều kiện thành chọn nhiều Dự án!');
                }}
                style={{
                  background: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                ⚡ Gộp gọn ngay
              </button>
            </div>
          )}

          {/* Branch Switcher Tabs + Add Branch Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.625rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {branches.map((b, bIdx) => {
                const isActive = activeBranchTab === bIdx;
                const projCond = (b.conditions || []).find((c: any) => c.col === 'project_id' && c.val);
                const projIds = projCond ? String(projCond.val).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                const firstProj = projIds.length === 1 ? projects.find((p: any) => String(p.id) === projIds[0]) : null;
                const tabSubtitle = projIds.length > 1
                  ? `${projIds.length} dự án`
                  : (firstProj ? firstProj.name : `${(b.conditions || []).length} ĐK`);

                return (
                  <button
                    key={bIdx}
                    type="button"
                    onClick={() => setActiveBranchTab(bIdx)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: isActive ? 'var(--color-primary)' : 'var(--color-bg)',
                      color: isActive ? '#ffffff' : 'var(--color-text)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>{t("Nhánh {num}").replace('{num}', String(bIdx + 1))}</span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '6px',
                      maxWidth: '140px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-surface)',
                      color: isActive ? '#ffffff' : 'var(--color-text-muted)'
                    }}>
                      {tabSubtitle}
                    </span>
                  </button>
                );
              })}

              {branches.length > 1 && (
                <button
                  type="button"
                  onClick={() => setActiveBranchTab(activeBranchTab === 'all' ? 0 : 'all')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: activeBranchTab === 'all' ? '1px solid #2563eb' : '1px dashed var(--color-border)',
                    background: activeBranchTab === 'all' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                    color: activeBranchTab === 'all' ? '#2563eb' : 'var(--color-text-muted)'
                  }}
                >
                  {activeBranchTab === 'all' ? 'Đang xem tất cả' : `Xem tất cả (${branches.length})`}
                </button>
              )}
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  const nextIdx = branches.length;
                  setBranches([...branches, { conditions: [{ col: 'source', op: 'contains', val: '' }], inject: { enabled: false, fields: [] } }]);
                  setActiveBranchTab(nextIdx);
                }}
                style={{
                  padding: '6px 12px',
                  background: 'var(--color-surface)',
                  border: '1px dashed var(--color-primary)',
                  borderRadius: '8px',
                  color: 'var(--color-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} /> {t("Thêm Nhánh (OR)")}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {branches.map((branch, bIndex) => {
              if (activeBranchTab !== 'all' && activeBranchTab !== bIndex && branches.length > 1) {
                return null;
              }
              return (
              <div key={bIndex} style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1rem 1.125rem', position: 'relative', background: 'var(--color-surface)' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: 'var(--color-primary)', borderRadius: '12px 0 0 12px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h4 style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', margin: 0 }}>
                      {t("Nhánh {num}").replace('{num}', String(bIndex + 1))}
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      (Tất cả điều kiện trong nhánh đều phải thỏa mãn — AND)
                    </span>
                  </div>
                  {branches.length > 1 && (
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ color: 'var(--color-danger)', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      onClick={() => {
                        const updated = branches.filter((_, idx) => idx !== bIndex);
                        setBranches(updated);
                        if (typeof activeBranchTab === 'number' && activeBranchTab >= updated.length) {
                          setActiveBranchTab(Math.max(0, updated.length - 1));
                        }
                      }}
                    >
                      <Trash2 size={14} /> Xóa nhánh
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {branch.conditions.map((c: any, i: number) => {
                    const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
                    const isLast = i === branch.conditions.length - 1;
                    return (
                      <div key={i} className="condition-row-responsive" style={{ background: 'transparent', padding: '0', position: 'relative' }}>
                        <div style={{ position: 'relative', width: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          {i === 0 ? (
                            <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', width: 28, height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0, position: 'relative', zIndex: 2 }}>IF</div>
                          ) : (
                            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', width: 28, height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, flexShrink: 0, position: 'relative', zIndex: 2 }}>AND</div>
                          )}
                          {!isLast && (
                            <div style={{ position: 'absolute', top: 28, bottom: -14, left: 15, width: 2, background: 'var(--color-border-light)', zIndex: 1 }} />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ background: 'var(--color-bg)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
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
                        <div style={{ flex: 0.85, minWidth: 0 }}>
                          <div style={{ background: 'var(--color-bg)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
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
                          <div style={{ flex: 1.35, minWidth: 0 }}>
                            {c.op.startsWith('date_') ? (
                              <input
                                type="date"
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.85rem', outline: 'none' }}
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
                            ) : c.col === 'project_id' ? (
                              <CustomSelect
                                multiple
                                options={projects.map(proj => ({
                                  value: String(proj.id),
                                  label: proj.code ? `${proj.name} (${proj.code})` : proj.name
                                }))}
                                value={String(c.val || '').split(',').map((s: string) => s.trim()).filter(Boolean)}
                                onChange={v => {
                                  const newB = [...branches];
                                  const arr = Array.isArray(v) ? v.map(String).filter(Boolean) : [String(v)].filter(Boolean);
                                  newB[bIndex].conditions[i].val = arr.join(',');
                                  setBranches(newB);
                                }}
                                disabled={isReadOnly}
                                placeholder={t("Chọn 1 hoặc nhiều Dự án (tự khớp Tên, Mã & ID)...")}
                              />
                            ) : (
                              <input
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.85rem', outline: 'none' }}
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
                            style={{ color: 'var(--color-danger)', padding: '6px', flexShrink: 0 }}
                            onClick={() => {
                              const newB = [...branches];
                              newB[bIndex].conditions = branch.conditions.filter((_: any, idx: number) => idx !== i);
                              setBranches(newB);
                            }}
                            title={t("Xóa điều kiện này")}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Combined Footer Row: Add Condition + Inject Data Toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    paddingLeft: 36,
                    marginTop: '0.35rem',
                    paddingTop: '0.625rem',
                    borderTop: '1px dashed var(--color-border-light)'
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        const newB = [...branches];
                        newB[bIndex].conditions.push({ col: 'source', op: 'contains', val: '' });
                        setBranches(newB);
                      }}
                      style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <Plus size={13} /> {t("Thêm điều kiện (AND)")}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                          width: 38,
                          height: 20,
                          borderRadius: 20,
                          background: branch.inject?.enabled ? '#10b981' : '#cbd5e1',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          flexShrink: 0
                        }}
                      >
                        <div style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: 'var(--color-surface)',
                          position: 'absolute',
                          top: 2,
                          left: branch.inject?.enabled ? 20 : 2,
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        {t("Tự động gán trường dữ liệu (Inject Data)")}
                      </span>
                    </div>
                  </div>

                  {/* INJECT DATA FIELDS PANEL */}
                  {branch.inject?.enabled && (
                    <div style={{ paddingLeft: 36, marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--color-bg)', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                        {branch.inject.fields.map((f: any, fi: number) => {
                          const isCustomMode = f.isCustom || !['source', 'project_id', 'preferred_location', 'platform', 'type', 'note', 'name', ''].includes(f.col);
                          const rankOptions = ['R3_Fb', 'R3', 'R2', 'R3_Zalo', 'broadcast', 'ca_nhan', 'gioi_thieu', 'databank'];
                          return (
                            <div key={fi} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.5rem', alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap', borderBottom: isMobile ? '1px dashed var(--color-border)' : 'none', paddingBottom: isMobile ? '10px' : '0', marginBottom: isMobile ? '10px' : '0' }}>
                              <div style={{ flex: isMobile ? 'none' : (isCustomMode ? '0 0 200px' : 1), width: isMobile ? '100%' : 'auto', background: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                                <CustomSelect
                                  options={[
                                    { value: 'source', label: t('Phân loại Lead / Rank (Source)') },
                                    { value: 'project_id', label: t('Dự án (Project ID / Tên dự án)') },
                                    { value: 'preferred_location', label: t('Khu vực quan tâm (Preferred Location)') },
                                    { value: 'platform', label: t('Nền tảng Ads (Platform)') },
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
                                      if (['source', 'project_id', 'preferred_location', 'platform', 'type', 'note', 'name'].includes(newB[bIndex].inject.fields[fi].col)) {
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
                                <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : 'auto', minWidth: 120 }}>
                                  <input
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.85rem', outline: 'none' }}
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

                              <div style={{ flex: isMobile ? 'none' : (isCustomMode ? 1.5 : 2), width: isMobile ? '100%' : 'auto', minWidth: 150, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {f.col === 'project_id' ? (
                                  <CustomSelect
                                    options={[
                                      { value: '', label: t('Chọn Dự án...') },
                                      ...projects.map(proj => ({
                                        value: String(proj.id),
                                        label: proj.code ? `${proj.name} (${proj.code})` : proj.name
                                      }))
                                    ]}
                                    value={f.val}
                                    onChange={v => {
                                      const newB = [...branches];
                                      newB[bIndex].inject.fields[fi].val = String(v);
                                      setBranches(newB);
                                    }}
                                    disabled={isReadOnly}
                                    placeholder={t("Chọn Dự án...")}
                                  />
                                ) : (
                                  <input
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.85rem', outline: 'none' }}
                                    placeholder={f.col === 'source' ? t("VD: R3_Fb, R2, R3...") : t("Giá trị muốn gán tự động...")}
                                    value={f.val}
                                    onChange={e => {
                                      const newB = [...branches];
                                      newB[bIndex].inject.fields[fi].val = e.target.value;
                                      setBranches(newB);
                                    }}
                                  />
                                )}
                                {f.col === 'source' && (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginRight: 2 }}>{t('Gợi ý Rank:')}</span>
                                    {rankOptions.map(rOpt => (
                                      <span
                                        key={rOpt}
                                        onClick={() => {
                                          const newB = [...branches];
                                          newB[bIndex].inject.fields[fi].val = rOpt;
                                          setBranches(newB);
                                        }}
                                        style={{
                                          fontSize: '0.68rem',
                                          fontWeight: f.val === rOpt ? 700 : 500,
                                          padding: '1px 6px',
                                          borderRadius: '10px',
                                          background: f.val === rOpt ? 'var(--color-primary)' : 'var(--color-surface)',
                                          color: f.val === rOpt ? '#ffffff' : 'var(--color-text)',
                                          border: `1px solid ${f.val === rOpt ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                          cursor: 'pointer',
                                          transition: 'all 0.15s'
                                        }}
                                      >
                                        {rOpt}
                                      </span>
                                    ))}
                                  </div>
                                )}
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
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
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
            <button type="button" className="btn outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>{isReadOnly ? t("Đóng") : t("Hủy bỏ")}</button>
            {!isReadOnly && (
              <button 
                type="button" 
                onClick={handleSaveRule} 
                className={`btn primary ${isSaving ? 'loading' : ''}`} 
                disabled={isSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>{t('Đang lưu...')}</span>
                  </>
                ) : (
                  editingRule ? t('Cập nhật') : t('Thêm mới')
                )}
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
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{t("Dự án (Project)")}</label>
                <CustomSelect
                  options={[
                    { value: '', label: t('-- Không chọn Dự án --') },
                    ...projects.map(p => ({
                      value: String(p.id),
                      label: p.code ? `${p.name} (${p.code})` : p.name
                    }))
                  ]}
                  value={simulatePayload.project_id || ''}
                  onChange={v => setSimulatePayload({ ...simulatePayload, project_id: String(v) })}
                  placeholder={t("-- Chọn Dự án giả lập --")}
                />
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
                      const condText = (() => {
                        if (Array.isArray(parsedConds) && parsedConds.length > 0) {
                          const firstBranch = parsedConds[0];
                          const conds = firstBranch.conditions || [];
                          let txt = conds.map((c: any) => `${c.col} ${c.op} "${c.val}"`).join(' VÀ ');
                          if (parsedConds.length > 1) txt += ` (+ ${parsedConds.length - 1} nhánh OR)`;
                          return txt;
                        } else {
                          return `${r.condition_column} ${r.condition_operator} "${r.condition_value}"`;
                        }
                      })();
                      
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

      {/* Mechanism Explanation Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Cơ chế & Quy tắc Định tuyến (Routing Rules)")}
        width="780px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.875rem 1rem', 
            background: 'var(--color-primary-light)', 
            border: '1px solid rgba(163, 20, 34, 0.15)', 
            borderRadius: 12 
          }}>
            <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {t("Quy tắc Định tuyến (Routing Rules) quyết định đường đi của lead từ các nguồn khác nhau đổ về hệ thống để đi vào vòng xoay phân bổ (Round-Robin) phù hợp.")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Lớp ưu tiên */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(59, 130, 246, 0.02)', 
              borderLeft: '4px solid #3b82f6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Layers size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Quét theo Thứ tự Ưu tiên (Priority Scan)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Các quy tắc được sắp xếp theo độ ưu tiên từ cao xuống thấp (kéo thả để đổi vị trí). Lead mới vào sẽ chạy qua từng Rule một; nếu khớp tất cả các điều kiện so khớp (Nguồn, Loại, Ghi chú), lead sẽ được chuyển ngay vào Vòng phân bổ chỉ định và dừng quét các Rule bên dưới.")}
                </p>
              </div>
            </div>

            {/* Các nguồn kết nối */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(16, 185, 129, 0.02)', 
              borderLeft: '4px solid #10b981', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Server size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Kết nối đa nguồn (Integration Sources)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Hệ thống hỗ trợ tự động quét và lấy thông tin khách hàng mới từ trang Google Sheets của Marketing (mỗi 1 phút tự chạy qua tiến trình lập lịch duy nhất), tự động loại bỏ các dòng bị trùng bằng bộ lọc thông minh để tránh chia 2 lần cho cùng một khách hàng, hoặc đẩy ngay lập tức qua cổng kết nối API, hoặc nhập bằng tay.")}
                </p>
              </div>
            </div>

            {/* Chế độ Silent & Inject */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(245, 158, 11, 0.02)', 
              borderLeft: '4px solid #f59e0b', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Cpu size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Chế độ Im lặng (Silent Mode) & Ghi đè (Inject Data)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("• Chế độ Im lặng: Hệ thống chỉ đồng bộ dữ liệu để kiểm tra trùng lặp (không phân phối chia số cho Sale, thời hạn kiểm tra trùng lặp là ")}
                  <strong>{sysSettings?.duplicate_check_months || 6} {t("tháng")}</strong>
                  {t(").")}
                  <br />
                  {t("• Ghi đè (Inject): Cho phép quy tắc tự động bổ sung hoặc thay đổi các trường dữ liệu của lead (vd: thêm Tag chiến dịch, đổi loại dự án) ngay khi so khớp thành công.")}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
        </div>
      </CustomModal>
    </div>
  );
};

export const RuleSettings = withRouterFreezer(RuleSettingsInner, '/rules');
