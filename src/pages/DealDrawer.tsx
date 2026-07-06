import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, History, Briefcase, Tag as TagIcon, Box, FileText, CheckCircle2, Link2 } from 'lucide-react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { EmptyCard } from '../components/ui/EmptyCard';
import { useUIStore } from '../store/uiStore';
import api from '../api/axios';
import { createPortal } from 'react-dom';
import styles from './EntityDrawer.module.css';
import { TagInput } from '../components/ui/TagInput';
import { MentionInput } from '../components/ui/MentionInput';
import { numberToText } from '../utils/numberToText';
import { CustomModal } from '../components/ui/CustomModal';

interface DealDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deal: any;
  onSave: (data: any) => void;
  stages: any[];
}

const TABS = [
  { id: 'info', label: 'Thông tin cơ bản', icon: <Briefcase size={16} /> },
  { id: 'activities', label: 'Lịch sử tương tác', icon: <History size={16} /> },
  { id: 'products', label: 'Sản phẩm báo giá', icon: <Box size={16} /> },
  { id: 'quotes', label: 'Báo giá & Hợp đồng', icon: <FileText size={16} /> },
  { id: 'audit', label: 'Vết kiểm toán', icon: <Link2 size={16} /> },
];

export const DealDrawer: React.FC<DealDrawerProps> = ({ isOpen, onClose, deal, onSave, stages }) => {
  const { addToast, setShowPOS } = useUIStore();
  const [activeTab, setActiveTab] = useState<'info' | 'activities' | 'products' | 'quotes' | string>('info');
  const [formData, setFormData] = useState(deal || {});
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // Unit Switching State
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [switchUnitCode, setSwitchUnitCode] = useState('');
  const [switchPrice, setSwitchPrice] = useState('');
  const [switchProjectId, setSwitchProjectId] = useState('');
  const [switchReason, setSwitchReason] = useState('');
  const [submittingSwitch, setSubmittingSwitch] = useState(false);

  const handleSwitchUnit = async () => {
    if (!switchUnitCode.trim() || !switchPrice) {
      addToast('Vui lòng điền đầy đủ mã căn hộ mới và giá bán mới', 'error');
      return;
    }
    setSubmittingSwitch(true);
    try {
      const res = await api.post(`/deals/${deal.id}/switch`, {
        new_unit_code: switchUnitCode,
        new_price: parseFloat(switchPrice),
        new_project_id: switchProjectId ? Number(switchProjectId) : undefined,
        reason: switchReason
      });
      if (res.data.success) {
        addToast('Đổi căn hộ giao dịch thành công!', 'success');
        setIsSwitchModalOpen(false);
        onClose(); // Close the drawer to refresh the main page
        if (onSave) {
          onSave(null); // trigger reload on main page
        }
      } else {
        addToast(res.data.message || 'Lỗi đổi căn hộ', 'error');
      }
    } catch (e: any) {
      addToast(e.response?.data?.message || e.message || 'Lỗi kết nối', 'error');
    } finally {
      setSubmittingSwitch(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const renderFormattedText = (text: string) => {
    if (!text) return '';
    const regex = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_\u00C0-\u1EF9()]+)/g;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {part}
          </a>
        );
      } else if (part.startsWith('@')) {
        const cleanMention = part.substring(1).toLowerCase();
        const taggedUser = users.find((u: any) => {
          const normalizedUser = (u.full_name || '').trim().replace(/\s+/g, '_').toLowerCase();
          return normalizedUser === cleanMention;
        });

        const displayName = taggedUser?.full_name || part.substring(1).replace(/_/g, ' ');
        const avatarUrl = taggedUser?.avatar_url || taggedUser?.avatar;
        const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

        return (
          <span
            key={index}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#dc2626', // Red text
              background: 'rgba(239, 68, 68, 0.08)', // Light red background tint
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '2px 8px',
              borderRadius: '9999px',
              margin: '0 2px',
              fontWeight: 600,
              fontSize: '0.85em',
              verticalAlign: 'middle'
            }}
          >
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={displayName} 
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
            ) : (
              <span 
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  lineHeight: 1
                }}
              >
                {initial}
              </span>
            )}
            @{displayName}
          </span>
        );
      }
      return part;
    });
  };

  const fetchLists = async () => {
    setLoadingLists(true);
    try {
      const [rC, rCo, rT, rU, rP] = await Promise.all([
        api.get('/contacts?limit=1000'),
        api.get('/companies'),
        api.get('/tags'),
        api.get('/users').catch(() => ({ data: { data: [] } })),
        api.get('/projects?bypass_roster=1').catch(() => ({ data: { data: [] } }))
      ]);
      setContacts(rC.data.data?.items || []);
      setCompanies(rCo.data.data?.items || []);
      setAllTags(rT.data.data || []);
      const ud = rU.data.data;
      setUsers(Array.isArray(ud) ? ud : (ud?.items || []));
      setProjects(rP.data.data || []);
    } catch (e: any) {
      // Keep empty or mock
    } finally {
      setLoadingLists(false);
    }
  };

  const fetchNotes = async () => {
    if (!deal?.id) return;
    setLoadingNotes(true);
    try {
      const r = await api.get(`/notes?entity_type=deal&entity_id=${deal.id}`);
      setNotes(r.data.data || []);
    } catch (e: any) {
      setNotes([
        { id: 1, author_name: 'Admin', body: 'Đã liên hệ khách hàng lần đầu, khách phản hồi tốt.', created_at: new Date().toISOString() },
        { id: 2, author_name: 'Sales', body: 'Khách yêu cầu gửi thêm báo giá chi tiết module ERP.', created_at: new Date(Date.now() - 86400000).toISOString() }
      ]);
    } finally {
      setLoadingNotes(false);
    }
  };

  const getLinkedDealId = () => {
    // 1. Check description
    const desc = formData?.description || '';
    const matchDesc = desc.match(/Deal ID:\s*(\d+)/i) || desc.match(/Deal ID mới:\s*(\d+)/i) || desc.match(/Deal ID cũ:\s*(\d+)/i);
    if (matchDesc) return parseInt(matchDesc[1], 10);

    // 2. Check notes
    for (const note of notes) {
      const body = note.body || '';
      const matchNote = body.match(/Deal ID:\s*(\d+)/i) || body.match(/Deal ID mới:\s*(\d+)/i) || body.match(/Deal ID cũ:\s*(\d+)/i);
      if (matchNote) return parseInt(matchNote[1], 10);
    }
    return null;
  };

  const fetchDealDetails = async (dealId: number) => {
    try {
      const res = await api.get(`/deals/${dealId}`);
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        setFormData({
          ...d,
          tags: Array.isArray(d.tags) ? d.tags : (typeof d.tags === 'string' ? JSON.parse(d.tags) : [])
        });
      }
    } catch (e) {
      console.error("Error fetching deal details:", e);
    }
  };

  useEffect(() => {
    if (deal) {
      setFormData({
        ...deal,
        tags: Array.isArray(deal.tags) ? deal.tags : (typeof deal.tags === 'string' ? JSON.parse(deal.tags) : [])
      });
      fetchDealDetails(deal.id);
      fetchNotes();
    }
    fetchLists();
  }, [deal]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await api.post(`/notes?entity_type=deal&entity_id=${deal.id}`, { body: newNote, type: 'internal' });
      setNewNote('');
      addToast('Đã lưu ghi chú mới', 'success');
      fetchNotes();
    } catch (e: any) {
      const mockNote = { id: Date.now(), author_name: 'Bạn', body: newNote, created_at: new Date().toISOString() };
      setNotes(prev => [mockNote, ...prev]);
      setNewNote('');
      addToast('Đã lưu ghi chú (Local)', 'success');
    }
  };

  const [isVisible, setIsVisible] = useState(isOpen);
  const [animateIn, setAnimateIn] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      const timer = setTimeout(() => setAnimateIn(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setIsVisible(false), 420);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="drawer-backdrop"
        onClick={onClose}
        style={{
          zIndex: 1000,
          opacity: animateIn ? 1 : 0,
          transition: 'opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: animateIn ? 'auto' : 'none'
        }}
      />
      <div
        className={styles.drawer}
        style={{
          transform: animateIn ? 'translateX(0)' : 'translateX(160px)',
          opacity: animateIn ? 1 : 0,
          transition: 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform, opacity'
        }}
      >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerProfile}>
                <div className="avatar-placeholder lg" style={{ background: '#3b82f6', fontSize: '1.25rem', width: 56, height: 56 }}>
                  <DollarSign size={28} />
                </div>
                <div>
                  <h2 className={styles.title}>{formData?.title || 'Tên cơ hội...'}</h2>
                  <p className={styles.subtitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>{formData?.company || 'Chưa chọn công ty'}</strong> - Liên hệ: {formData?.contact || 'N/A'}
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                    <span>{formData?.value ? (formData.value || 0).toLocaleString() : '0'} đ</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>| Xác suất: {formData?.prob || 0}%</span>
                  </div>
                </div>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
              </div>
            </div>

            {/* Layout Split: Left Sidebar & Content */}
            <div className={styles.drawerBody}>
              <div className={styles.sidebarTabs}>
                {TABS.map(tab => (
                  <button 
                    key={tab.id} 
                    className={`${styles.sidebarTabBtn} ${activeTab === tab.id ? styles.sidebarTabActive : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              <div className={styles.contentArea}>
                {activeTab === 'info' && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {(() => {
                      const linkedId = getLinkedDealId();
                      if (!linkedId) return null;
                      return (
                        <div style={{
                          background: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-lg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          fontSize: '0.875rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600 }}>
                            <Link2 size={16} />
                            <span>Giao dịch này liên quan đến một Deal đổi căn hộ</span>
                          </div>
                          <button 
                            className="btn primary sm" 
                            style={{ padding: '6px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            onClick={async () => {
                              try {
                                const res = await api.get(`/deals/${linkedId}`);
                                if (res.data.success && res.data.data) {
                                  setFormData(res.data.data);
                                  const rNotes = await api.get(`/notes?entity_type=deal&entity_id=${linkedId}`);
                                  setNotes(rNotes.data.data || []);
                                  addToast(`Đã chuyển sang Deal liên kết #${linkedId}`, 'success');
                                } else {
                                  addToast('Không tìm thấy thông tin Deal liên kết', 'error');
                                }
                              } catch (e: any) {
                                addToast('Không thể tải Deal liên kết', 'error');
                              }
                            }}
                          >
                            Xem Deal #{linkedId}
                          </button>
                        </div>
                      );
                    })()}
                    <div className="card-panel">
                      <h4 className="panel-title">Cơ hội bán hàng</h4>
                      <div className="grid grid-2">
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label className="form-label">Tên Deal (Cơ hội)</label>
                          <input className="form-input" value={formData?.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Vd: Cung cấp giải pháp phần mềm ABC..." />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Giá trị dự kiến (đ)</label>
                          <input className="form-input" type="number" value={formData?.value || ''} onChange={e => setFormData({...formData, value: Number(e.target.value)})} />
                          {formData?.value > 0 && (
                            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
                              {numberToText(formData.value)}
                            </div>
                          )}
                        </div>
                        <div className="form-group">
                          <label className="form-label">Xác suất thành công (%)</label>
                          <input className="form-input" type="number" value={formData?.prob || ''} onChange={e => setFormData({...formData, prob: Number(e.target.value)})} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Giai đoạn (Pipeline Stage)</label>
                          <CustomSelect 
                            options={stages.map(s => ({ value: s.id, label: s.name }))}
                            value={formData?.stage_id}
                            onChange={val => setFormData({...formData, stage_id: Number(val)})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Ngày dự kiến chốt</label>
                          <input className="form-input" type="date" value={formData?.close || ''} onChange={e => setFormData({...formData, close: e.target.value})} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="card-panel">
                      <h4 className="panel-title">Các trường tùy chỉnh (Custom Fields)</h4>
                      <div className="grid grid-2">
                        {formData.custom_fields && formData.custom_fields.length > 0 ? (
                          formData.custom_fields.map((field: any, index: number) => (
                            <div className="form-group" key={field.id}>
                              <label className="form-label">{field.label} {field.is_required ? <span style={{color: 'var(--color-danger)'}}>*</span> : ''}</label>
                              {field.field_type === 'text' && (
                                <input className="form-input" value={field.value || ''} onChange={e => {
                                  const newFields = [...formData.custom_fields];
                                  newFields[index].value = e.target.value;
                                  setFormData({ ...formData, custom_fields: newFields });
                                }} />
                              )}
                              {field.field_type === 'number' && (
                                <input type="number" className="form-input" value={field.value || ''} onChange={e => {
                                  const newFields = [...formData.custom_fields];
                                  newFields[index].value = e.target.value;
                                  setFormData({ ...formData, custom_fields: newFields });
                                }} />
                              )}
                              {field.field_type === 'date' && (
                                <input type="date" className="form-input" value={field.value || ''} onChange={e => {
                                  const newFields = [...formData.custom_fields];
                                  newFields[index].value = e.target.value;
                                  setFormData({ ...formData, custom_fields: newFields });
                                }} />
                              )}
                              {field.field_type === 'dropdown' && (
                                <CustomSelect 
                                  options={(field.options || []).map((o:any) => ({ value: o, label: o }))} 
                                  value={field.value || ''} 
                                  onChange={val => {
                                    const newFields = [...formData.custom_fields];
                                    newFields[index].value = val.toString();
                                    setFormData({ ...formData, custom_fields: newFields });
                                  }} 
                                />
                              )}
                              {field.field_type === 'multiselect' && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.25rem' }}>
                                  {(field.options || []).map((o: any) => {
                                    let selected: string[] = [];
                                    try {
                                      if (typeof field.value === 'string') selected = JSON.parse(field.value);
                                      else if (Array.isArray(field.value)) selected = field.value;
                                     } catch (e: any) { console.error(e); }
                                    const isChecked = selected.includes(o);
                                    return (
                                      <label key={o} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', background: isChecked ? 'var(--color-primary)' : 'var(--color-bg)', padding: '6px 12px', borderRadius: '20px', border: `1px solid ${isChecked ? 'var(--color-primary)' : 'var(--color-border)'}`, transition: 'all 0.2s' }}>
                                        <input type="checkbox" checked={isChecked} onChange={e => {
                                          const newFields = [...formData.custom_fields];
                                          const newSelected = e.target.checked ? [...selected, o] : selected.filter((s: string) => s !== o);
                                          newFields[index].value = newSelected;
                                          setFormData({ ...formData, custom_fields: newFields });
                                        }} style={{ display: 'none' }} />
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: isChecked ? 'white' : 'var(--color-text)' }}>{o}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              {field.field_type === 'checkbox' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '40px' }}>
                                  <CustomCheckbox 
                                    checked={field.value === 'true' || field.value === true} 
                                    onChange={e => {
                                      const newFields = [...formData.custom_fields];
                                      newFields[index].value = e ? 'true' : 'false';
                                      setFormData({ ...formData, custom_fields: newFields });
                                    }} 
                                  />
                                  <span style={{ fontSize: '0.875rem' }}>Có</span>
                                </label>
                              )}
                            </div>
                          ))
                        ) : (
                          <div style={{ gridColumn: 'span 2', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Chưa có trường tùy chỉnh nào được cấu hình cho Cơ hội bán hàng.</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="card-panel">
                      <h4 className="panel-title">Khách hàng / Công ty</h4>
                      <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">Công ty</label>
                          <CustomSelect 
                            options={companies.map(c => ({ value: c.id, label: c.name }))}
                            value={formData?.company_id}
                            onChange={val => {
                              const co = companies.find(x => x.id === Number(val));
                              setFormData({...formData, company_id: Number(val), company: co?.name});
                            }}
                            placeholder="Chọn công ty..."
                            searchable
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Liên hệ chính</label>
                          <CustomSelect 
                            options={contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}`, avatar: c.avatar_url || c.avatar }))}
                            value={formData?.contact_id}
                            onChange={val => {
                              const co = contacts.find(x => x.id === Number(val));
                              setFormData({...formData, contact_id: Number(val), contact: `${co?.first_name} ${co?.last_name}`});
                            }}
                            placeholder="Chọn liên hệ..."
                            searchable
                            showAvatars
                          />
                        </div>
                      </div>
                    </div>
                    <div className="card-panel">
                      <h4 className="panel-title">Phân loại & Tags</h4>
                      <div className="form-group">
                        <label className="form-label">Gắn Tags</label>
                        <div style={{ padding: '0.5rem 0' }}>
                          <TagInput 
                            tags={formData?.tags || []} 
                            onChange={newTags => setFormData({...formData, tags: newTags})}
                            suggestions={allTags.map(t => t.name)}
                            placeholder="Thêm tag cho deal này..."
                          />
                        </div>
                        <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                          Tags giúp lọc và báo cáo hiệu quả chiến dịch bán hàng.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'activities' && (
                  <div className="animate-fade">
                    <div className="card-panel" style={{ marginBottom: '1.5rem' }}>
                      <MentionInput 
                        className="form-textarea" 
                        rows={3} 
                        placeholder="Viết ghi chú, cập nhật tiến độ deal (Sử dụng @ để tag user/sale)..."
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button className="btn primary sm" onClick={handleAddNote} disabled={!newNote.trim()}>Lưu ghi chú</button>
                      </div>
                    </div>
                    
                    <div className="timeline" style={{ position: 'relative', paddingLeft: '2rem' }}>
                      {loadingNotes ? (
                        <div className="p-4 text-center text-muted">Đang tải...</div>
                      ) : (
                        <>
                          {notes.map(n => (
                            <div key={n.id} className="timeline-item" style={{ marginBottom: '1.5rem', position: 'relative' }}>
                              <div className="timeline-icon bg-primary" style={{ position: 'absolute', left: '-2rem', top: '0', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                                <History size={14} />
                              </div>
                              <div className="timeline-content" style={{ padding: '0.75rem 1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <strong style={{ fontSize: '0.875rem' }}>{n.author_name || n.user_name || 'Hệ thống'}</strong>
                                  <span className="text-xs text-muted">{n.created_at ? new Date(n.created_at).toLocaleString('vi-VN') : ''}</span>
                                </div>
                                <p style={{ fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>{renderFormattedText(n.body)}</p>
                              </div>
                            </div>
                          ))}
                          
                          <div className="timeline-item" style={{ marginBottom: '1.5rem', position: 'relative' }}>
                            <div className="timeline-icon bg-success" style={{ position: 'absolute', left: '-2rem', top: '0', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                              <CheckCircle2 size={14} />
                            </div>
                            <div className="timeline-content" style={{ padding: '0.75rem 1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', textAlign: 'left' }}>
                              <p style={{ fontSize: '0.875rem', margin: 0 }}><strong>System</strong> chuyển sang trạng thái "{stages.find(s=>s.id===formData?.stage_id)?.name || 'Lead mới'}".</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'products' && (
                  <div className="animate-fade">
                    <EmptyCard 
                      icon={<Box size={48} />}
                      title="Chưa có sản phẩm nào"
                      description="Thêm các sản phẩm, phần mềm hoặc dịch vụ vào cơ hội bán hàng này để tính toán giá trị chính xác."
                      action={<button className="btn primary" onClick={() => setShowPOS(true)}>Mở Quầy Báo Giá (POS)</button>}
                    />
                  </div>
                )}

                {activeTab === 'quotes' && (
                  <div className="animate-fade">
                    <EmptyCard 
                      icon={<FileText size={48} />}
                      title="Chưa có báo giá / hợp đồng"
                      description="Sau khi chốt xong sản phẩm, bạn có thể tạo báo giá PDF chuyên nghiệp và gửi thẳng cho khách hàng."
                      action={<button className="btn primary" onClick={() => setShowPOS(true)}>Tạo báo giá qua POS</button>}
                    />
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem' }}>
                    {/* Header summary of audit trail */}
                    <div style={{ display: 'flex', gap: '1rem', background: 'var(--color-bg-light)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(163,20,34,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                        <Link2 size={20} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>Sơ đồ Vết kiểm toán</h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Lịch sử dịch chuyển trạng thái, thay đổi căn hộ hoặc hoàn/bể cọc được đồng bộ thời gian thực.
                        </p>
                      </div>
                    </div>

                    {/* Horizontal Graphic for Unit Switching (if any parent or child exists) */}
                    {(() => {
                      const linkedId = getLinkedDealId();
                      if (!linkedId) return null;
                      
                      // Check if current deal description contains "Đổi từ căn cũ"
                      const desc = formData?.description || '';
                      const isChild = desc.toLowerCase().includes('đổi từ căn cũ') || desc.toLowerCase().includes('đổi căn');
                      
                      return (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          padding: '1.25rem',
                          borderRadius: '12px',
                        }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            Luồng dịch chuyển Giao dịch (Unit Switching Flow)
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
                            {isChild ? (
                              <>
                                <div 
                                  style={{ border: '1px dashed var(--color-border)', borderRadius: '8px', padding: '8px 12px', textAlign: 'center', opacity: 0.7, cursor: 'pointer', background: 'var(--color-bg-light)' }}
                                  onClick={async () => {
                                    try {
                                      const res = await api.get(`/deals/${linkedId}`);
                                      if (res.data.success && res.data.data) {
                                        setFormData(res.data.data);
                                        const rNotes = await api.get(`/notes?entity_type=deal&entity_id=${linkedId}`);
                                        setNotes(rNotes.data.data || []);
                                        addToast(`Đã chuyển sang Deal cũ #${linkedId}`, 'success');
                                      }
                                    } catch (e) {}
                                  }}
                                >
                                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Deal Cũ (Đã Đóng)</div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>ID: #{linkedId}</div>
                                </div>
                                <div style={{ fontSize: '1.5rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>➔</div>
                                <div style={{ border: '1.5px solid var(--color-primary)', borderRadius: '8px', padding: '8px 12px', textAlign: 'center', background: 'var(--color-primary-light)' }}>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600 }}>Deal Hiện tại</div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>ID: #{formData.id} ({formData.title})</div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ border: '1.5px solid var(--color-primary)', borderRadius: '8px', padding: '8px 12px', textAlign: 'center', background: 'var(--color-primary-light)' }}>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600 }}>Deal Cũ (Đã Đóng)</div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>ID: #{formData.id} ({formData.title})</div>
                                </div>
                                <div style={{ fontSize: '1.5rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>➔</div>
                                <div 
                                  style={{ border: '1px dashed var(--color-border)', borderRadius: '8px', padding: '8px 12px', textAlign: 'center', opacity: 0.7, cursor: 'pointer', background: 'var(--color-bg-light)' }}
                                  onClick={async () => {
                                    try {
                                      const res = await api.get(`/deals/${linkedId}`);
                                      if (res.data.success && res.data.data) {
                                        setFormData(res.data.data);
                                        const rNotes = await api.get(`/notes?entity_type=deal&entity_id=${linkedId}`);
                                        setNotes(rNotes.data.data || []);
                                        addToast(`Đã chuyển sang Deal mới #${linkedId}`, 'success');
                                      }
                                    } catch (e) {}
                                  }}
                                >
                                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Deal Mới (Đang chạy)</div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>ID: #{linkedId}</div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Timeline representation of audit trails */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Vết kiểm toán chi tiết (Audit Timeline)
                      </div>

                      {(() => {
                        // Merge stage history and internal notes
                        const combinedEvents: any[] = [];
                        
                        // Add stage history
                        if (formData?.stage_history) {
                          formData.stage_history.forEach((h: any) => {
                            combinedEvents.push({
                              type: 'stage',
                              date: h.moved_at,
                              title: 'Dịch chuyển cột trạng thái',
                              body: `Chuyển từ "${h.from_stage_name || 'Bắt đầu'}" sang "${h.to_stage_name}"`,
                              user: h.moved_by_name || 'Hệ thống'
                            });
                          });
                        }

                        // Add internal notes (audit trails)
                        if (formData?.internal_notes) {
                          formData.internal_notes.forEach((n: any) => {
                            combinedEvents.push({
                              type: 'audit_note',
                              date: n.created_at,
                              title: 'Ghi chú nghiệp vụ hệ thống',
                              body: n.body,
                              user: n.user_name || 'Hệ thống'
                            });
                          });
                        }

                        if (combinedEvents.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0', fontSize: '0.8rem' }}>
                              Chưa ghi nhận vết kiểm toán nào cho giao dịch này.
                            </div>
                          );
                        }

                        // Sort chronologically
                        combinedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                        return (
                          <div style={{ position: 'relative', borderLeft: '2px solid var(--color-border-light)', paddingLeft: '1rem', marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {combinedEvents.map((ev, idx) => (
                              <div key={idx} style={{ position: 'relative' }}>
                                {/* Timeline dot */}
                                <div style={{
                                  position: 'absolute',
                                  left: 'calc(-1rem - 7px)',
                                  top: '4px',
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: ev.type === 'stage' ? 'var(--color-primary)' : '#3b82f6',
                                  border: '2px solid var(--color-surface)',
                                  boxShadow: '0 0 0 2px rgba(0,0,0,0.05)'
                                }} />
                                
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                                  {new Date(ev.date).toLocaleString('vi-VN')} {ev.user ? `• ${ev.user}` : ''}
                                </div>
                                <div style={{ fontWeight: 800, fontSize: '0.825rem', color: 'var(--color-text)' }}>
                                  {ev.title}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px', background: 'var(--color-bg-light)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                                  {ev.body}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              {stages.find(s => s.id === formData?.stage_id)?.name?.toLowerCase()?.includes('cọc') && (
                <button 
                  className="btn outline" 
                  style={{ marginRight: 'auto', color: '#BD1D2D', borderColor: '#BD1D2D', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    setSwitchUnitCode('');
                    setSwitchPrice(formData.value ? String(formData.value) : '');
                    setSwitchProjectId(formData.project_id ? String(formData.project_id) : '');
                    setSwitchReason('');
                    setIsSwitchModalOpen(true);
                  }}
                >
                  🔄 Đổi Căn
                </button>
              )}
              <button className="btn ghost" onClick={onClose}>Hủy bỏ</button>
              <button className="btn primary" onClick={() => {
                const payload = { ...formData };
                if (formData.custom_fields && Array.isArray(formData.custom_fields)) {
                  for (const f of formData.custom_fields) {
                    const isEmpty = f.value === undefined || f.value === null || f.value === '' || (Array.isArray(f.value) && f.value.length === 0);
                    if (f.is_required && isEmpty) {
                      addToast(`Trường "${f.label}" là bắt buộc.`, 'error');
                      return;
                    }
                  }
                  payload.custom_fields = formData.custom_fields.map((f: any) => ({ field_id: f.id, value: f.value }));
                }
                onSave(payload);
              }}>Lưu Cơ Hội</button>
            </div>
            {/* Unit Switching Modal */}
            <CustomModal
              isOpen={isSwitchModalOpen}
              onClose={() => setIsSwitchModalOpen(false)}
              title="Đổi căn hộ giao dịch (Unit Switch)"
              width="500px"
            >
              <div style={{ padding: '0.5rem 0', color: 'var(--color-text)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  <strong>Quy tắc đổi căn:</strong> Hệ thống sẽ tự động đóng deal cũ này (đánh dấu thất bại), tạo một deal mới hoàn toàn cho căn hộ mới, chuyển lịch thanh toán cọc, và tự động ghi chú lưu vết kiểm toán (audit trail).
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Mã căn hộ mới <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="VD: B-205"
                      value={switchUnitCode}
                      onChange={e => setSwitchUnitCode(e.target.value.toUpperCase())}
                      className="form-input"
                      style={{ height: '38px', padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Giá bán mới (VND) <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input
                      type="number"
                      required
                      placeholder="Nhập giá bán mới..."
                      value={switchPrice}
                      onChange={e => setSwitchPrice(e.target.value)}
                      className="form-input"
                      style={{ height: '38px', padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                    {parseFloat(switchPrice) > 0 && (
                      <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
                        {numberToText(parseFloat(switchPrice))}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dự án mới (Nếu đổi dự án)</label>
                    <CustomSelect
                      options={projects.map(p => ({ value: String(p.id), label: p.name }))}
                      value={switchProjectId}
                      onChange={val => setSwitchProjectId(val.toString())}
                      placeholder="-- Giữ nguyên dự án cũ --"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lý do đổi căn</label>
                    <textarea
                      placeholder="Nhập lý do đổi căn..."
                      value={switchReason}
                      onChange={e => setSwitchReason(e.target.value)}
                      className="form-input"
                      style={{ height: '80px', resize: 'none', padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn ghost w-full" onClick={() => setIsSwitchModalOpen(false)}>Hủy bỏ</button>
                    <button className="btn primary w-full" style={{ backgroundColor: '#BD1D2D', borderColor: '#BD1D2D' }} onClick={handleSwitchUnit} disabled={submittingSwitch}>
                      {submittingSwitch ? 'Đang xử lý...' : 'Xác nhận Đổi Căn'}
                    </button>
                  </div>
                </div>
              </div>
            </CustomModal>
      </div>
    </>,
    document.body
  );
};
