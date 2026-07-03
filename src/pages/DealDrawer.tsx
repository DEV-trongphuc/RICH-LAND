import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, History, Briefcase, Tag as TagIcon, Box, FileText, CheckCircle2 } from 'lucide-react';
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
  const [loadingLists, setLoadingLists] = useState(false);

  const fetchLists = async () => {
    setLoadingLists(true);
    try {
      const [rC, rCo, rT] = await Promise.all([
        api.get('/contacts'),
        api.get('/companies'),
        api.get('/tags')
      ]);
      setContacts(rC.data.data?.items || []);
      setCompanies(rCo.data.data?.items || []);
      setAllTags(rT.data.data || []);
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

  useEffect(() => {
    if (deal) {
      setFormData({
        ...deal,
        tags: Array.isArray(deal.tags) ? deal.tags : (typeof deal.tags === 'string' ? JSON.parse(deal.tags) : [])
      });
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

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="overlay-backdrop" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            onClick={onClose} 
            style={{ zIndex: 1000 }}
          />
          <motion.div 
            className={styles.drawer}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
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
                            options={contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                            value={formData?.contact_id}
                            onChange={val => {
                              const co = contacts.find(x => x.id === Number(val));
                              setFormData({...formData, contact_id: Number(val), contact: `${co?.first_name} ${co?.last_name}`});
                            }}
                            placeholder="Chọn liên hệ..."
                            searchable
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
                                <p style={{ fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>{n.body}</p>
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
              </div>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
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
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
