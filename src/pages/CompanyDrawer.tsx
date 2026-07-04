import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, FileText, FileBadge, Tag as TagIcon, Phone, Mail, MapPin, Search, Calendar, Users, Briefcase, Plus, HelpCircle, Globe, Settings, Download, Trash2, Edit, Pencil, Loader2, History } from 'lucide-react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { AddressSelect } from '../components/ui/AddressSelect';
import { EmptyCard } from '../components/ui/EmptyCard';
import { TagInput } from '../components/ui/TagInput';
import { useUIStore } from '../store/uiStore';
import api from '../api/axios';
import { compressToWebP } from '../utils/imageCompress';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { ActivityModal } from '../components/ui/ActivityModal';
import { createPortal } from 'react-dom';
import styles from './EntityDrawer.module.css'; // Reusing the same drawer CSS
import { numberToText } from '../utils/numberToText';
import { useAuth } from '../contexts/AuthContext';

interface CompanyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entity: any;
  onSave: (data: any) => void;
}

const TABS = [
  { id: 'info', label: 'Thông tin công ty', icon: <Building2 size={16} /> },
  { id: 'activities', label: 'Hoạt động & Lịch', icon: <History size={16} /> },
  { id: 'contacts', label: 'Người liên hệ', icon: <Users size={16} /> },
  { id: 'deals', label: 'Cơ hội bán hàng', icon: <Briefcase size={16} /> },
  { id: 'docs', label: 'Hợp đồng & Tài liệu', icon: <FileBadge size={16} /> },
  { id: 'settings', label: 'Thiết lập & Cài đặt', icon: <Settings size={16} /> },
];

export const CompanyDrawer: React.FC<CompanyDrawerProps> = ({ isOpen, onClose, entity, onSave }) => {
  const { user: currentUser } = useAuth();
  const { addToast, showConfirm } = useUIStore();
  const [activeTab, setActiveTab] = useState('info');
  const [formData, setFormData] = useState(entity || {});
  const [tags, setTags] = useState<string[]>(entity?.tags || []);

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

  const [baseData, setBaseData] = useState<any>(entity || {});
  const [baseTags, setBaseTags] = useState<string[]>(entity?.tags || []);

  const hasChanges = useMemo(() => {
    if (!entity) return false;
    if (JSON.stringify(tags) !== JSON.stringify(baseTags)) return true;
    
    const fieldsToCompare = [
      'name', 'email', 'phone', 'website', 'tax_code', 'address', 'city', 'ward', 'status', 'description'
    ];
    
    for (const key of fieldsToCompare) {
      const val1 = formData[key] === undefined || formData[key] === null ? '' : String(formData[key]);
      const val2 = baseData[key] === undefined || baseData[key] === null ? '' : String(baseData[key]);
      if (val1 !== val2) return true;
    }
    
    // Custom fields comparison
    if (formData.custom_fields && baseData.custom_fields) {
      if (JSON.stringify(formData.custom_fields) !== JSON.stringify(baseData.custom_fields)) return true;
    }
    
    return false;
  }, [formData, baseData, tags, baseTags, entity]);

  const handleSave = useCallback(async () => {
    try {
      const payload = { ...formData, tags };
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
      const res = await api.put(`/companies/${entity.id}`, payload);
      const updated = res.data.data;
      setFormData(updated);
      setBaseData(updated);
      setBaseTags(updated.tags || []);
      addToast('Đã cập nhật thông tin công ty thành công', 'success');
      onSave(updated);
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Lỗi khi lưu thông tin công ty', 'error');
    }
  }, [formData, tags, entity, onSave, addToast]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      showConfirm({
        title: 'Bỏ qua thay đổi?',
        message: 'Bạn có các thay đổi chưa lưu. Bạn có muốn lưu thay đổi trước khi đóng không?',
        confirmText: 'Lưu & Đóng',
        extraText: 'Bỏ qua thay đổi',
        cancelText: 'Hủy',
        onConfirm: async () => {
          await handleSave();
          onClose();
        },
        onExtra: () => {
          onClose();
        }
      });
    } else {
      onClose();
    }
  }, [hasChanges, onClose, showConfirm, handleSave]);
  const [helpModal, setHelpModal] = useState<{title: string, content: string} | null>(null);
  
  // B2B Sub-contacts State — loaded from API
  const [subContacts, setSubContacts] = useState<any[]>([]);
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealForm, setDealForm] = useState({ title: '', value: '', stage: 'lead', probability: 50, expected_close: '' });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [subLoading, setSubLoading] = useState(false);

  // Deals — loaded from API
  const [deals, setDeals] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  
  // Docs — local only (no backend endpoint)
  const [docs, setDocs] = useState<any[]>([]);
  
  // Activities State
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const fetchActivities = async () => {
    if (!entity?.id) return;
    setActivitiesLoading(true);
    try {
      const r = await api.get('/activities', { params: { related_type: 'company', related_id: entity.id } });
      setActivities(r.data.data?.items || r.data.data || []);
    } catch (e: any) {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!dealForm.title.trim()) return;
    try {
      await api.post('/deals', {
        company_id: entity.id,
        title: dealForm.title,
        value: Number(dealForm.value) || 0,
        stage: dealForm.stage,
        expected_close: dealForm.expected_close
      });
      setShowDealModal(false);
      setDealForm({ title: '', value: '', stage: 'lead', probability: 50, expected_close: '' });
      
      // Refresh deals
      setDealsLoading(true);
      api.get('/deals', { params: { company_id: entity.id } })
        .then(r => setDeals(r.data.data?.items || r.data.data || []))
        .catch(() => setDeals([]))
        .finally(() => setDealsLoading(false));

      addToast('Đã tạo cơ hội mới thành công', 'success');
    } catch (e: any) {
      addToast(e?.response?.data?.message || 'Lỗi khi tạo cơ hội', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'activities') fetchActivities();
  }, [activeTab]);
  
  useEffect(() => {
    if (entity) {
      setFormData(entity);
      setTags(entity.tags || []);
      setBaseData(entity);
      setBaseTags(entity.tags || []);
      if (entity.id) {
        if (DEV_MODE) {
          const { contacts, deals } = useMockStore.getState();
          const compContacts = contacts.filter((c: any) => c.company_id === entity.id || c.company_name === entity.name);
          setSubContacts(compContacts.map((c: any) => ({
            id: c.id,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Chưa có tên',
            role: c.job_title || '',
            phone: c.phone || '',
            email: c.email || '',
            isPrimary: c.is_primary || false,
          })));
          setDeals(deals.filter((d: any) => d.company_id === entity.id || d.company_name === entity.name));
        } else {
          setSubLoading(true);
          api.get('/contacts', { params: { company_id: entity.id, limit: 50 } })
            .then(r => setSubContacts((r.data.data?.items || r.data.data || []).map((c: any) => ({
              id: c.id,
              name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Chưa có tên',
              role: c.job_title || '',
              phone: c.phone || '',
              email: c.email || '',
              isPrimary: c.is_primary || false,
            }))))
            .catch(() => setSubContacts([]))
            .finally(() => setSubLoading(false));
          
          setDealsLoading(true);
          api.get('/deals', { params: { company_id: entity.id } })
            .then(r => setDeals(r.data.data?.items || r.data.data || []))
            .catch(() => setDeals([]))
            .finally(() => setDealsLoading(false));
        }
      }
    }
  }, [entity]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="drawer-backdrop" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            onClick={handleClose} 
            style={{ zIndex: 1000 }}
          />
          <motion.div 
            className={styles.drawer}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerProfile}>
                <div className="avatar-placeholder lg" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', fontSize: '1.25rem', width: 56, height: 56, borderRadius: '12px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}>
                  {formData?.name?.[0] || 'C'}
                </div>
                <div>
                  <h2 className={styles.title}>{formData?.name || 'Tên Công Ty'}</h2>
                  <p className={styles.subtitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={14} /> {formData?.industry || 'Chưa cập nhật ngành nghề'} · MST: {formData?.tax_id || 'Chưa cập nhật'}
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={12} /> {formData?.phone || 'Chưa có SĐT'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} /> {formData?.email || 'Chưa có Email'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Globe size={12} /> {formData?.website || 'Chưa có Website'}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.headerActions}>
                <span className={`badge ${formData?.status === 'active' ? 'success' : formData?.status === 'inactive' ? 'danger' : 'warning'}`}>
                  {formData?.status === 'active' ? 'Hoạt động' : formData?.status === 'inactive' ? 'Ngừng' : 'Tiềm năng'}
                </span>
                <button className={styles.closeBtn} onClick={handleClose}><X size={20} /></button>
              </div>
            </div>

            {/* Layout Split: Left Sidebar & Content */}
            <div className={styles.drawerBody}>
              {/* Sidebar Tabs */}
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

              {/* Content Area */}
              <div className={styles.contentArea}>
                {activeTab === 'info' && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card-panel">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="panel-title" style={{ margin: 0 }}>Hồ sơ Doanh nghiệp</h4>
                      </div>
                      <div className="grid grid-2">
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Tên công ty <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                          <input className="form-input" placeholder="Tên đầy đủ của doanh nghiệp..." value={formData?.name || ''} onChange={e => setFormData((prev: any) => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Mã số thuế (Tax ID)</label>
                          <input className="form-input" placeholder="Nhập MST..." value={formData?.tax_id || ''} onChange={e => setFormData((prev: any) => ({ ...prev, tax_id: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Ngành nghề (Industry)</label>
                          <input className="form-input" placeholder="Ví dụ: Công nghệ, Bán lẻ, Tài chính..." value={formData?.industry || ''} onChange={e => setFormData((prev: any) => ({ ...prev, industry: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Quy mô công ty</label>
                          <CustomSelect 
                            options={[
                              { value: '1-10', label: '1-10 nhân viên' },
                              { value: '11-50', label: '11-50 nhân viên' },
                              { value: '51-200', label: '51-200 nhân viên' },
                              { value: '201-500', label: '201-500 nhân viên' },
                              { value: '500+', label: 'Hơn 500 nhân viên' }
                            ]}
                            value={formData?.size || ''}
                            onChange={val => setFormData((prev: any) => ({ ...prev, size: val as string }))}
                            placeholder="Chọn quy mô..."
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Trạng thái Khách hàng</label>
                          <CustomSelect 
                            options={[
                              { value: 'prospect', label: 'Tiềm năng (Prospect)' },
                              { value: 'active', label: 'Đang hoạt động (Active)' },
                              { value: 'inactive', label: 'Ngừng hoạt động (Inactive)' }
                            ]}
                            value={formData?.status || 'prospect'}
                            onChange={val => setFormData((prev: any) => ({ ...prev, status: val as string }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Giai đoạn Pipeline</label>
                          <CustomSelect 
                            options={[
                              { value: 1, label: 'Giai đoạn mới' },
                              { value: 2, label: 'Đã liên hệ' },
                              { value: 3, label: 'Đang thương lượng' },
                              { value: 4, label: 'Gửi báo giá' },
                              { value: 5, label: 'Chốt thành công' },
                              { value: 6, label: 'Thất bại' },
                            ]}
                            value={formData?.stage_id || ''}
                            onChange={val => setFormData((prev: any) => ({ ...prev, stage_id: val }))}
                            placeholder="Chọn giai đoạn..."
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Mã số thuế</label>
                          <input className="form-input" placeholder="MST..." value={formData?.tax_id || ''} onChange={e => setFormData((prev: any) => ({ ...prev, tax_id: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Lĩnh vực kinh doanh</label>
                          <input className="form-input" placeholder="VD: Công nghệ, Xây dựng..." value={formData?.industry || ''} onChange={e => setFormData((prev: any) => ({ ...prev, industry: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Doanh thu dự kiến (VND)</label>
                          <input 
                            className="form-input" 
                            type="number" 
                            placeholder="Nhập giá trị..." 
                            value={formData?.expected_revenue || ''} 
                            onChange={e => setFormData((prev: any) => ({ ...prev, expected_revenue: e.target.value }))} 
                          />
                          {formData?.expected_revenue && Number(formData.expected_revenue) > 0 && (
                            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
                              {numberToText(Number(formData.expected_revenue))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--color-border-light)', margin: '1.25rem 0', paddingTop: '1.25rem' }}></div>
                      
                      <h4 className="panel-title" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Thông tin Liên lạc & Trụ sở</h4>
                      <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">Điện thoại Hotline</label>
                          <input className="form-input" type="tel" placeholder="028 xxx xxxx" value={formData?.phone || ''} onChange={e => setFormData((prev: any) => ({ ...prev, phone: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Email Doanh nghiệp</label>
                          <input className="form-input" type="email" placeholder="info@congty.com" value={formData?.email || ''} onChange={e => setFormData((prev: any) => ({ ...prev, email: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Website</label>
                          <input className="form-input" placeholder="www.congty.com" value={formData?.website || ''} onChange={e => setFormData((prev: any) => ({ ...prev, website: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Mạng xã hội (LinkedIn/FB)</label>
                          <input className="form-input" placeholder="https://..." value={formData?.social_link || ''} onChange={e => setFormData((prev: any) => ({ ...prev, social_link: e.target.value }))} />
                        </div>
                      </div>
                    </div>

                    <div className="card-panel">
                      <h4 className="panel-title">Địa chỉ Trụ sở</h4>
                      <AddressSelect 
                        value={formData?.address || ''}
                        onChange={addr => setFormData((prev: any) => ({ ...prev, address: addr }))}
                        placeholder="Chọn địa chỉ trụ sở..."
                      />
                    </div>

                    <div className="card-panel">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="panel-title" style={{ margin: 0 }}>Các trường tùy chỉnh (Custom Fields)</h4>
                      </div>
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
                          <div style={{ gridColumn: 'span 2', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Chưa có trường tùy chỉnh nào được cấu hình cho Công ty.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'activities' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Lịch sử hoạt động</h4>
                      <button className="btn primary sm" onClick={() => setShowActivityModal(true)}><Plus size={14}/> Thêm hoạt động</button>
                    </div>

                    {activitiesLoading ? (
                      <div className="flex justify-center p-8"><Loader2 className="spin" /></div>
                    ) : activities.length === 0 ? (
                      <EmptyCard 
                        title="Chưa có hoạt động" 
                        description="Ghi lại các cuộc gọi, họp hoặc email với công ty này."
                        icon={<Calendar size={32} />}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {activities.map(act => (
                          <div key={act.id} className="card-panel" style={{ padding: '1rem', borderLeft: `3px solid var(--color-primary)` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <h5 style={{ fontWeight: 600 }}>{act.subject}</h5>
                              <span className="text-xs text-light">{new Date(act.created_at).toLocaleDateString('vi-VN')}</span>
                            </div>
                            <p className="text-sm text-light mt-1">{act.body || 'Không có mô tả chi tiết'}</p>
                            <div className="mt-2 flex gap-2">
                              <span className="badge info sm">{act.type}</span>
                              <span className={`badge sm ${act.status === 'done' ? 'success' : 'warning'}`}>
                                {act.status === 'done' ? 'Đã xong' : 'Chờ xử lý'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'contacts' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <div>
                        <h4 className="panel-title" style={{ margin: 0, marginBottom: '0.25rem' }}>Danh sách Liên hệ (Sub-contacts)</h4>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Quản lý các nhân sự thuộc doanh nghiệp B2B này.</p>
                      </div>
                      <button className="btn primary sm" onClick={() => {
                        const newContact = { id: Date.now(), name: 'Liên hệ mới', role: 'Chức vụ', phone: '', email: '', isPrimary: false };
                        setSubContacts([...subContacts, newContact]);
                        addToast('Đã thêm liên hệ mới, vui lòng cập nhật thông tin', 'info');
                      }}><Plus size={14}/> Thêm liên hệ</button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {subContacts.map(sc => (
                        <div key={sc.id} className="card-panel" style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', position: 'relative', borderLeft: sc.isPrimary ? '4px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
                          {sc.isPrimary && (
                            <span style={{ position: 'absolute', top: '-10px', left: '1rem', background: 'var(--color-primary)', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                              Liên hệ chính
                            </span>
                          )}
                          <div className="avatar-placeholder" style={{ background: sc.isPrimary ? 'var(--color-primary)' : 'var(--color-text-muted)', color: 'white', fontWeight: 600, width: 48, height: 48, fontSize: '1.25rem', flexShrink: 0 }}>
                            {sc.name[0]?.toUpperCase()}
                          </div>
                          
                          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                            <div>
                              <input 
                                className="form-input" 
                                style={{ fontWeight: 600, border: 'none', padding: '0.25rem 0.5rem', background: 'transparent', height: 'auto', fontSize: '1rem', marginBottom: '0.25rem' }} 
                                value={sc.name} 
                                onChange={e => setSubContacts(subContacts.map(x => x.id === sc.id ? {...x, name: e.target.value} : x))} 
                                placeholder="Họ và tên..."
                              />
                              <input 
                                className="form-input text-xs" 
                                style={{ border: 'none', padding: '0 0.5rem', background: 'transparent', height: 'auto', color: 'var(--color-text-light)' }} 
                                value={sc.role} 
                                onChange={e => setSubContacts(subContacts.map(x => x.id === sc.id ? {...x, role: e.target.value} : x))} 
                                placeholder="Chức vụ..."
                              />
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Phone size={14} color="var(--color-text-muted)" />
                              <input 
                                className="form-input text-sm" 
                                style={{ border: 'none', padding: '0.25rem', background: 'transparent', height: 'auto' }} 
                                value={sc.phone} 
                                onChange={e => setSubContacts(subContacts.map(x => x.id === sc.id ? {...x, phone: e.target.value} : x))} 
                                placeholder="Số điện thoại..."
                              />
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Mail size={14} color="var(--color-text-muted)" />
                              <input 
                                className="form-input text-sm" 
                                style={{ border: 'none', padding: '0.25rem', background: 'transparent', height: 'auto', width: '100%' }} 
                                value={sc.email} 
                                onChange={e => setSubContacts(subContacts.map(x => x.id === sc.id ? {...x, email: e.target.value} : x))} 
                                placeholder="Email..."
                              />
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {!sc.isPrimary && (
                              <button 
                                className="btn outline sm" 
                                title="Đặt làm liên hệ chính"
                                onClick={() => setSubContacts(subContacts.map(x => ({...x, isPrimary: x.id === sc.id})))}
                              >
                                Chọn làm chính
                              </button>
                            )}
                            <button 
                              className="btn-icon-bare" 
                              style={{ color: 'var(--color-danger)' }} 
                              title="Xóa liên hệ"
                              onClick={() => {
                                if (sc.isPrimary) addToast('Không thể xóa liên hệ chính, vui lòng đổi liên hệ chính trước', 'error');
                                else setSubContacts(subContacts.filter(x => x.id !== sc.id));
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {subContacts.length === 0 && (
                      <div className="card-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        <Users size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                        <p>Chưa có liên hệ phụ nào được thêm.</p>
                      </div>
                    )}
                  </div>
                )}


                {activeTab === 'deals' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Cơ hội Bán hàng (Hợp đồng/Deals)</h4>
                      <button className="btn primary sm" onClick={() => setShowDealModal(true)}><Plus size={14}/> Tạo Deal</button>
                    </div>
                    {dealsLoading ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
                      </div>
                    ) : deals.length === 0 ? (
                      <div className="card-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        <Briefcase size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>Chưa có hợp đồng nào</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Module này dùng để quản lý các giao dịch cụ thể.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {deals.map((d: any) => (
                          <div key={d.id} className="card-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
                            <div>
                              <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)' }}>{d.title}</h4>
                              <p className="text-xs text-light mt-1">Giá trị: <strong style={{ color: 'var(--color-text)' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(d.value || 0)}</strong> • Ngày dự kiến: {d.expected_close || 'Chưa xác định'}</p>
                            </div>
                            <span className={`badge ${d.stage_color ? '' : 'warning'}`} style={d.stage_color ? { background: d.stage_color + '20', color: d.stage_color } : {}}>{d.stage || d.pipeline_stage || 'Đang xử lý'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}                {activeTab === 'docs' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Tài liệu Doanh nghiệp</h4>
                      <label className="btn outline sm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input type="file" style={{ display: 'none' }} onChange={async (e) => {
                          if (e.target.files?.[0]) {
                            const file = e.target.files[0];
                            const compressed = await compressToWebP(file);
                            setDocs(prev => [{ id: Date.now(), name: compressed.name, date: new Date().toLocaleDateString('vi-VN'), size: (compressed.size / 1024 / 1024).toFixed(1) + ' MB', type: compressed.name.split('.').pop() || 'file' }, ...prev]);
                            addToast('Đã tải lên tài liệu doanh nghiệp mới.', 'success');
                          }
                        }} />
                        <Plus size={14} /> Upload Tệp
                      </label>
                    </div>
                    {docs.length === 0 ? (
                      <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)' }}>
                        <FileBadge size={48} color="var(--color-border)" style={{ margin: '0 auto 1rem auto' }} />
                        <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>Chưa có tài liệu doanh nghiệp</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Upload giấy phép kinh doanh, hợp đồng NDA, báo cáo tài chính...</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {docs.map(doc => (
                          <div key={doc.id} className="card-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                            <div style={{ width: 40, height: 40, background: doc.name.endsWith('.pdf') ? 'var(--color-warning-light)' : 'var(--color-info-light)', color: doc.name.endsWith('.pdf') ? 'var(--color-warning)' : 'var(--color-info)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {doc.name.endsWith('.pdf') ? <FileBadge size={20} /> : <FileText size={20} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</h4>
                              <p className="text-xs text-light mt-1">Tải lên: {doc.date} • {doc.size}</p>
                            </div>
                            <div className="flex gap-1" style={{ flexShrink: 0 }}>
                              <button className="btn-icon sm" title="Tải xuống" onClick={() => addToast(`Đang tải xuống ${doc.name}...`, 'success')}><Download size={14} /></button>
                              <button className="btn-icon sm" title="Đổi tên" onClick={() => {
                                showConfirm({
                                  title: 'Đổi tên tài liệu',
                                  message: 'Nhập tên mới cho tài liệu:',
                                  requirePromptInput: true,
                                  promptPlaceholder: doc.name,
                                  confirmText: 'Lưu',
                                  cancelText: 'Hủy',
                                  onConfirm: (newName) => {
                                    if (newName && newName.trim()) {
                                      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, name: newName.trim() } : d));
                                      addToast('Đã đổi tên tài liệu.', 'success');
                                    }
                                  }
                                });
                              }}><Pencil size={14} /></button>
                              <button className="btn-icon sm text-danger" title="Xóa" onClick={() => {
                                showConfirm({
                                  title: 'Xóa tài liệu?',
                                  message: `Bạn có chắc muốn xóa vĩnh viễn tài liệu "${doc.name}"?`,
                                  confirmText: 'Xóa',
                                  cancelText: 'Hủy',
                                  isDanger: true,
                                  onConfirm: () => {
                                    setDocs(prev => prev.filter(d => d.id !== doc.id));
                                    addToast('Đã xóa tài liệu doanh nghiệp.', 'success');
                                  }
                                });
                              }}><Trash2 size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="animate-fade">
                    <div className="card-panel mb-4">
                      <h4 className="panel-title">Thiết lập B2B (Company Settings)</h4>
                      <p className="text-sm text-light mb-4">Cấu hình các tùy chọn ưu đãi và mức độ chăm sóc dành riêng cho pháp nhân này.</p>
                      
                      <div className="form-group mb-4">
                        <label className="form-label">Phân cấp khách hàng (SLA Level)</label>
                        <CustomSelect 
                          options={[
                            { value: 'standard', label: 'Standard (Phản hồi 24h)' },
                            { value: 'gold', label: 'Gold (Phản hồi 12h + Hỗ trợ tận nơi)' },
                            { value: 'platinum', label: 'Platinum (Phản hồi 2h + Chuyên viên riêng)' }
                          ]}
                          value={'standard'}
                          onChange={() => {}}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                        <CustomCheckbox 
                          label={<div><span style={{ fontWeight: 600, display: 'block' }}>Áp dụng Bảng giá Đại lý (Wholesale)</span><span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Công ty này sẽ tự động nhận báo giá đã chiết khấu.</span></div>}
                          checked={true}
                          onChange={() => {}}
                        />
                        <CustomCheckbox 
                          label={<div><span style={{ fontWeight: 600, display: 'block' }}>Miễn trừ thuế GTGT (VAT Exempt)</span><span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Áp dụng cho doanh nghiệp chế xuất, khu phi thuế quan.</span></div>}
                          checked={false}
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tags' && (
                  <div className="animate-fade">
                    <div className="card-panel">
                      <p className="text-sm text-light mb-4">Quản lý Tags và phân nhóm công ty khách hàng.</p>
                      <div className="form-group mb-4">
                        <label className="form-label">Thêm Tag</label>
                        <CustomSelect 
                          options={[
                            { value: 'vip', label: 'Khách hàng VIP' },
                            { value: 'partner', label: 'Đối tác chiến lược' },
                            { value: 'vendor', label: 'Nhà cung cấp' },
                          ]}
                          value={null}
                          onChange={() => {}}
                          placeholder="Chọn hoặc nhập tag mới..."
                          searchable
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <button className="btn ghost" onClick={handleClose}>Hủy bỏ</button>
              <button 
                className={`btn ${hasChanges ? 'primary' : 'outline'}`} 
                disabled={!hasChanges}
                onClick={handleSave}
              >
                {hasChanges ? 'Lưu thông tin Công ty' : 'Đã đồng bộ'}
              </button>
            </div>
          </motion.div>

          {/* Help Modal */}
          <AnimatePresence>
            {helpModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div 
                  className="overlay-backdrop" 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                  onClick={() => setHelpModal(null)} 
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  style={{
                    position: 'relative',
                    background: 'var(--color-surface)', width: '400px', borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-xl)', zIndex: 1110, border: '1px solid var(--color-border)',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #BD1D2D 100%)', padding: '1rem 1.25rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><HelpCircle size={18} /> {helpModal.title}</h3>
                    <button onClick={() => setHelpModal(null)} style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '4px', color: 'white' }}><X size={16} /></button>
                  </div>
                  <div style={{ padding: '1.25rem', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                    {helpModal.content}
                  </div>
                  <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-bg)' }}>
                    <button className="btn outline" onClick={() => setHelpModal(null)}>Đã hiểu</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* CREATE DEAL MODAL */}
          <AnimatePresence>
            {showDealModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div 
                  className="overlay-backdrop" 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                  onClick={() => setShowDealModal(false)}
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
                />
                <motion.div
                  className="modal-sheet"
                  style={{ position: 'relative', width: '100%', maxWidth: 500, zIndex: 1110 }}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h3>Tạo Deal mới cho {formData.name}</h3>
                    <button className="btn-icon-bare" onClick={() => setShowDealModal(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    <div className="form-group">
                      <label className="form-label">Tên Deal *</label>
                      <input className="form-input" placeholder="VD: Hợp đồng triển khai phần mềm..." value={dealForm.title} onChange={e => setDealForm(prev => ({ ...prev, title: e.target.value }))} autoFocus />
                    </div>
                    <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">Giá trị dự kiến (VND)</label>
                          <input className="form-input" type="number" placeholder="0" value={dealForm.value} onChange={e => setDealForm(prev => ({ ...prev, value: e.target.value }))} />
                          {dealForm.value && Number(dealForm.value) > 0 && (
                            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
                              {numberToText(Number(dealForm.value))}
                            </div>
                          )}
                        </div>
                      <div className="form-group">
                        <label className="form-label">Giai đoạn</label>
                        <CustomSelect 
                          options={[
                            { value: 'lead', label: 'Tiềm năng' },
                            { value: 'contacted', label: 'Đã liên hệ' },
                            { value: 'negotiation', label: 'Thương lượng' },
                            { value: 'proposal', label: 'Báo giá' },
                            { value: 'won', label: 'Thành công' },
                            { value: 'lost', label: 'Thất bại' }
                          ]} 
                          value={dealForm.stage} 
                          onChange={val => setDealForm(prev => ({ ...prev, stage: val.toString() }))} 
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ngày dự kiến chốt</label>
                      <input className="form-input" type="date" value={dealForm.expected_close} onChange={e => setDealForm(prev => ({ ...prev, expected_close: e.target.value }))} />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn outline" onClick={() => setShowDealModal(false)}>Hủy</button>
                    <button className="btn primary" onClick={handleCreateDeal}>Tạo Deal</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <ActivityModal 
            isOpen={showActivityModal} 
            onClose={() => setShowActivityModal(false)}
            entityType="company"
            entityId={entity?.id}
            onSuccess={fetchActivities}
            userId={entity?.owner_id || currentUser?.id}
          />
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
