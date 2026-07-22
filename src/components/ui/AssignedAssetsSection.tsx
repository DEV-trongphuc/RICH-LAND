import React, { useState } from 'react';
import { Package, Laptop, Key, Smartphone, Plus, Edit2, Trash2, CheckCircle2, RotateCcw, AlertTriangle, XCircle, Calendar, ShieldCheck, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';

export interface AssignedAsset {
  id: string;
  name: string;
  code: string;
  category: string;
  assignedDate: string;
  condition: string;
  status: 'using' | 'returned' | 'maintenance' | 'lost';
  note?: string;
}

interface AssignedAssetsSectionProps {
  assets: AssignedAsset[];
  onChange: (newAssets: AssignedAsset[]) => void;
  readOnly?: boolean;
}

export const AssignedAssetsSection: React.FC<AssignedAssetsSectionProps> = ({
  assets = [],
  onChange,
  readOnly = false
}) => {
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssignedAsset | null>(null);

  // Modal Form State
  const [formData, setFormData] = useState<Partial<AssignedAsset>>({
    name: '',
    code: '',
    category: 'Thiết bị công nghệ',
    assignedDate: new Date().toISOString().substring(0, 10),
    condition: 'Mới 100%',
    status: 'using',
    note: ''
  });

  const handleOpenAddModal = () => {
    setEditingAsset(null);
    setFormData({
      name: '',
      code: `TS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      category: 'Thiết bị công nghệ',
      assignedDate: new Date().toISOString().substring(0, 10),
      condition: 'Mới 100%',
      status: 'using',
      note: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (asset: AssignedAsset) => {
    setEditingAsset(asset);
    setFormData({ ...asset });
    setShowModal(true);
  };

  const handleDeleteAsset = (id: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa tài sản này khỏi danh sách cấp phát?'))) {
      const updated = assets.filter(a => a.id !== id);
      onChange(updated);
    }
  };

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.code?.trim()) return;

    if (editingAsset) {
      // Edit existing
      const updated = assets.map(a => 
        a.id === editingAsset.id ? { ...(formData as AssignedAsset), id: editingAsset.id } : a
      );
      onChange(updated);
    } else {
      // Add new
      const newAsset: AssignedAsset = {
        id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: formData.name.trim(),
        code: formData.code.trim(),
        category: formData.category || 'Thiết bị công nghệ',
        assignedDate: formData.assignedDate || new Date().toISOString().substring(0, 10),
        condition: formData.condition || 'Mới 100%',
        status: formData.status || 'using',
        note: formData.note?.trim() || ''
      };
      onChange([...assets, newAsset]);
    }
    setShowModal(false);
  };

  const getStatusBadge = (status: AssignedAsset['status']) => {
    switch (status) {
      case 'using':
        return { label: 'Đang sử dụng', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', icon: CheckCircle2 };
      case 'returned':
        return { label: 'Đã thu hồi', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', icon: RotateCcw };
      case 'maintenance':
        return { label: 'Báo bảo trì', bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', icon: AlertTriangle };
      case 'lost':
        return { label: 'Báo mất', bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: XCircle };
      default:
        return { label: 'Đang sử dụng', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', icon: CheckCircle2 };
    }
  };

  const getCategoryIcon = (cat: string) => {
    if (cat?.includes('Thẻ') || cat?.includes('Phương tiện') || cat?.includes('Xe')) return Key;
    if (cat?.includes('SIM') || cat?.includes('Thoại') || cat?.includes('Điện thoại')) return Smartphone;
    return Laptop;
  };

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: '16px',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      marginTop: '1rem'
    }}>
      {/* Section Header */}
      <div style={{
        padding: '1rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-light)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '6px',
            background: '#8b5cf6', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Package size={15} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)' }}>
              TÀI SẢN ĐƯỢC CẤP PHÁT ({assets.length})
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              Danh sách thiết bị & tài sản công ty bàn giao cho nhân viên quản lý
            </p>
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            className="btn primary sm"
            onClick={handleOpenAddModal}
            style={{
              borderRadius: '8px',
              fontSize: '0.75rem',
              padding: '5px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 600
            }}
          >
            <Plus size={14} />
            <span>Thêm tài sản</span>
          </button>
        )}
      </div>

      {/* Assets Body */}
      <div style={{ padding: '1.25rem' }}>
        {assets.length === 0 ? (
          <div style={{
            border: '2px dashed var(--color-border)',
            borderRadius: '12px',
            padding: '2rem 1rem',
            textAlign: 'center',
            background: 'var(--color-bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldCheck size={22} />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
              Chưa có tài sản nào được cấp phát
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {readOnly 
                ? 'Hiện tại chưa có thiết bị hay tài sản công ty nào ghi nhận bàn giao cho bạn.' 
                : 'Quản lý có thể thêm thiết bị (Laptop, SIM, Xe, Thẻ từ...) cấp phát cho nhân sự này.'}
            </p>
            {!readOnly && (
              <button
                type="button"
                className="btn outline sm"
                onClick={handleOpenAddModal}
                style={{ marginTop: '6px', borderRadius: '8px', fontSize: '0.75rem' }}
              >
                + Cấp phát tài sản đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            {assets.map((asset) => {
              const badge = getStatusBadge(asset.status);
              const BadgeIcon = badge.icon;
              const CatIcon = getCategoryIcon(asset.category);

              return (
                <div
                  key={asset.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '1rem',
                    boxShadow: 'var(--shadow-xs)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                    transition: 'all 0.2s ease'
                  }}
                  className="hover-lift"
                >
                  {/* Top: Icon + Name + Status */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '10px',
                        background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <CatIcon size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h5 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {asset.name}
                        </h5>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 600, fontFamily: 'monospace' }}>
                          {asset.code}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '3px 8px', borderRadius: '12px',
                      fontSize: '0.68rem', fontWeight: 700,
                      color: badge.color, backgroundColor: badge.bg,
                      flexShrink: 0
                    }}>
                      <BadgeIcon size={11} />
                      <span>{badge.label}</span>
                    </div>
                  </div>

                  {/* Mid: Info Table */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
                    padding: '8px 10px', borderRadius: '8px',
                    background: 'var(--color-bg)',
                    fontSize: '0.72rem'
                  }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Danh mục: </span>
                      <strong style={{ color: 'var(--color-text)' }}>{asset.category}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Ngày giao: </span>
                      <strong style={{ color: 'var(--color-text)' }}>{asset.assignedDate}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Tình trạng: </span>
                      <strong style={{ color: 'var(--color-text)' }}>{asset.condition}</strong>
                    </div>
                    {asset.note && (
                      <div style={{ gridColumn: 'span 2', color: 'var(--color-text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--color-border-light)', paddingTop: '4px', marginTop: '2px' }}>
                        "{asset.note}"
                      </div>
                    )}
                  </div>

                  {/* Bottom: Manager Actions */}
                  {!readOnly && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(asset)}
                        style={{
                          border: 'none', background: 'transparent',
                          color: 'var(--color-text-muted)', cursor: 'pointer',
                          padding: '4px 6px', borderRadius: '4px'
                        }}
                        className="hover-bg-muted"
                        title="Chỉnh sửa tài sản"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(asset.id)}
                        style={{
                          border: 'none', background: 'transparent',
                          color: 'var(--color-danger)', cursor: 'pointer',
                          padding: '4px 6px', borderRadius: '4px'
                        }}
                        className="hover-bg-muted"
                        title="Xóa cấp phát"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD / EDIT ASSET MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="overlay-backdrop" style={{ zIndex: 1000070, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
            <motion.div
              style={{
                width: '100%',
                maxWidth: '520px',
                background: 'var(--color-surface, #ffffff)',
                borderRadius: '20px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden'
              }}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={18} style={{ color: '#8b5cf6' }} />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                    {editingAsset ? 'Cập nhật thông tin cấp phát' : 'Khai báo cấp phát tài sản mới'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveAsset} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Tên tài sản / Thiết bị *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ví dụ: Laptop MacBook Pro M2 16 inch"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Mã tài sản / Serial *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="TS-2026-001 hoặc Serial S/N..."
                      value={formData.code || ''}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Danh mục tài sản</label>
                    <select
                      className="form-input"
                      value={formData.category || 'Thiết bị công nghệ'}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Thiết bị công nghệ">Thiết bị công nghệ (Laptop, PC, Màn hình)</option>
                      <option value="SIM & Điện thoại">SIM & Điện thoại hotline</option>
                      <option value="Phương tiện & Thẻ">Phương tiện & Thẻ từ ra vào</option>
                      <option value="Văn phòng phẩm & Đồng phục">Đồng phục & Thẻ đeo</option>
                      <option value="Khác">Tài sản khác</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Ngày cấp phát</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.assignedDate || ''}
                      onChange={e => setFormData({ ...formData, assignedDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Tình trạng khi bàn giao</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ví dụ: Mới 100%, Tốt 95%..."
                      value={formData.condition || ''}
                      onChange={e => setFormData({ ...formData, condition: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Trạng thái cấp phát hiện tại</label>
                  <select
                    className="form-input"
                    value={formData.status || 'using'}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="using">🟢 Đang sử dụng (Đang lưu giữ)</option>
                    <option value="returned">⚪ Đã thu hồi (Đã trả lại công ty)</option>
                    <option value="maintenance">🟠 Báo bảo trì (Hỏng hóc mang đi sửa)</option>
                    <option value="lost">🔴 Báo mất (Thất lạc/Làm mất)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Ghi chú phụ kiện đi kèm</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="ví dụ: Kèm sạc 140W, chuột không dây, túi chống sốc..."
                    value={formData.note || ''}
                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                    style={{ resize: 'none' }}
                  />
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn outline sm"
                    onClick={() => setShowModal(false)}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn primary sm"
                    style={{ background: '#8b5cf6', borderColor: '#8b5cf6', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Save size={14} />
                    <span>Lưu thông tin</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
