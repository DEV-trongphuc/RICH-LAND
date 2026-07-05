import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pagination } from '../components/ui/Pagination';
import { Plus, Package, Pencil, Trash2, X, Loader2, Search, Layers, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/uiStore';
import api from '../api/axios';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { useDebounce } from '../hooks/useDebounce';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { numberToText } from '../utils/numberToText';

const FMT = (n: number) => new Intl.NumberFormat('vi-VN', { style:'currency', currency:'VND', maximumFractionDigits:0 }).format(n);

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Phần mềm', track_inventory: false, track_cost: false },
  { id: 2, name: 'Dịch vụ', track_inventory: false, track_cost: false },
  { id: 3, name: 'Hàng hóa', track_inventory: true, track_cost: true },
  { id: 4, name: 'Khác', track_inventory: true, track_cost: true }
];

const EMPTY = { name:'', sku:'', category_id: 1, category:'Phần mềm', price:'', cost:'', unit:'cái', description:'', is_active:true, stock_quantity: 0, track_inventory: false, track_cost: false };

export const ProductsPage: React.FC = () => {
  const { addToast, showConfirm } = useUIStore();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchProducts = () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      let list = [...state.products];
      
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s));
      }
      
      if (categoryFilter) {
        list = list.filter(p => String(p.category_id) === String(categoryFilter));
      }
      
      setProducts(list);
      setTotal(list.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = {
      page,
      limit: 20,
      search: debouncedSearch,
      category_id: categoryFilter
    };
    api.get('/products', { params })
      .then(r => { 
        const data = r.data.data;
        if (Array.isArray(data)) {
          setProducts(data);
          setTotal(data.length);
        } else {
          setProducts(data.items || []); 
          setTotal(data.total || 0);
        }
      })
      .catch(() => {
        setProducts([]);
        setTotal(0);
        addToast('Không thể tải danh sách sản phẩm', 'error');
      })
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    fetchProducts();
  }, [page, debouncedSearch, categoryFilter]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (showModal || showCatModal) && !saving) {
        setShowModal(false);
        setShowCatModal(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showModal, showCatModal, saving]);

  const filtered = products;

  const handleSave = async () => {
    if (!form.name.trim()) { addToast('Tên sản phẩm là bắt buộc', 'error'); return; }
    setSaving(true);
    const payload = { 
      ...form, 
      price: Number(form.price),
      cost: Number(form.cost),
      stock_quantity: Number(form.stock_quantity)
    };
    try {

      if (editItem) {
        await api.put(`/products/${editItem.id}`, payload);
        addToast('Đã cập nhật sản phẩm', 'success');
      } else {
        await api.post('/products', payload);
        addToast('Đã thêm sản phẩm', 'success');
      }
      fetchProducts();
      setShowModal(false);
    } catch (err: any) {
      addToast('Lỗi khi lưu sản phẩm', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    params.set('type', 'product');
    params.set('token', localStorage.getItem('token') || '');
    if (search) params.set('search', search);
    window.open(`${api.defaults.baseURL}/export?${params.toString()}`, '_blank');
    addToast('Đang xuất danh sách sản phẩm theo bộ lọc hiện tại...', 'info');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sản phẩm & Dịch vụ</h1>
          <p className="page-subtitle">{total} sản phẩm</p>
        </div>
        <div className="flex gap-2">
          <button className="btn secondary" onClick={() => setShowCatModal(true)} title="Quản lý danh mục">
            <Layers size={16} />
            <span className="hide-on-mobile"> Quản lý danh mục</span>
          </button>
          <button className="btn outline" onClick={handleExport} title="Xuất Excel/CSV">
            <Download size={16} />
            <span className="hide-on-mobile"> Xuất file</span>
          </button>
          <button className="btn primary" onClick={() => { setEditItem(null); setForm(EMPTY); setShowModal(true); }} title="Thêm sản phẩm">
            <Plus size={16} />
            <span className="hide-on-mobile"> Thêm sản phẩm</span>
          </button>
        </div>
      </div>

      <div className="card-panel mb-6 flex items-center gap-4">
        <div className="filter-search flex-1">
          <Search size={18} className="text-muted" />
          <input 
            placeholder="Tìm sản phẩm theo tên hoặc mã SKU..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); }} 
          />
          <AnimatePresence>
            {search && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSearch('')} 
                className="text-muted hover:text-danger p-1"
                title="Xóa tìm kiếm"
              >
                <X size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <div style={{ width: '200px' }}>
          <CustomSelect 
            options={[{ value: '', label: 'Tất cả danh mục' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} 
            value={categoryFilter} 
            onChange={val => { setCategoryFilter(String(val)); setPage(1); }} 
          />
        </div>
        {selectedIds.length > 0 && (
          <button className="btn danger sm" onClick={() => { 
            showConfirm(
              `Xóa ${selectedIds.length} sản phẩm?`,
              `Tất cả sản phẩm đã chọn sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.`,
              async () => {
                try {
                  await api.post('/products/bulk-delete', { ids: selectedIds });
                  addToast(`Đã xóa ${selectedIds.length} sản phẩm`, 'success');
                  setSelectedIds([]);
                  fetchProducts();
                } catch (err: any) { 
                  addToast(err.response?.data?.message || 'Lỗi khi xóa hàng loạt', 'error'); 
                  setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
                  setSelectedIds([]);
                }
              }
            );
          }}>Xóa {selectedIds.length} mục</button>
        )}
      </div>

      <div className="card" style={{ overflow: 'visible' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <CustomCheckbox 
                    checked={selectedIds.length === filtered.length && filtered.length > 0} 
                    onChange={e => setSelectedIds(e.target.checked ? filtered.map(p => p.id) : [])} 
                  />
                </th>
                <th>Sản phẩm</th><th>Đơn giá</th><th>Kho</th><th>Trạng thái</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <motion.tr key={p.id} initial={{ opacity:0 }} animate={{ opacity:1 }}>
                  <td>
                    <CustomCheckbox 
                      checked={selectedIds.includes(p.id)} 
                      onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))} 
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div style={{ width:36, height:36, borderRadius:'10px', background:'rgba(163, 20, 34,0.1)', color:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}><Package size={16} /></div>
                      <div>
                        <p className="text-sm font-semi" style={{ color: 'var(--color-text)' }}>{p.name}</p>
                        {p.description && <p className="text-xs text-light" style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{p.description}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <code style={{ background:'var(--color-bg)', padding:'2px 6px', borderRadius:4, fontSize:'0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>SKU: {p.sku}</code>
                          <span className="badge text-xs" style={{ background:'var(--color-bg)', color:'var(--color-text-muted)', padding: '2px 6px' }}>{p.category}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="font-semi" style={{ color:'var(--color-primary)', fontWeight: 700, fontSize: '0.875rem' }}>{FMT(p.price)}</span>
                      <span className="text-xs text-light" style={{ color: 'var(--color-text-muted)' }}>/ {p.unit}</span>
                    </div>
                  </td>
                  <td>
                    {p.track_inventory ? (
                      <span className={`badge ${(p.stock_quantity || 0) <= 5 ? 'danger' : 'info'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                        {p.stock_quantity || 0}
                      </span>
                    ) : (
                      <span className="text-light">—</span>
                    )}
                  </td>
                  <td><span className={`badge ${p.is_active ? 'success' : 'danger'}`}>{p.is_active ? 'Đang bán' : 'Ngừng bán'}</span></td>
                  <td>
                    <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn ghost sm" onClick={() => { 
                        const cat = categories.find(c => c.id === (p.category_id || p.category)) || categories.find(c => c.name === p.category) || categories[0];
                        setEditItem(p); 
                        setForm({...p, price:String(p.price), cost: String(p.cost || ''), category_id: cat?.id || '', track_inventory: cat?.track_inventory ?? !!p.track_inventory, track_cost: cat?.track_cost ?? true }); 
                        setShowModal(true); 
                      }}><Pencil size={14} /></button>
                      <button className="btn ghost sm" style={{ color:'var(--color-danger)' }} onClick={() => { 
                        showConfirm(
                          'Xóa sản phẩm?',
                          `Bạn có chắc muốn xóa "${p.name}"?`,
                          async () => {
                            try {
                              await api.delete(`/products/${p.id}`);
                              addToast('Đã xóa sản phẩm thành công', 'success');
                              fetchProducts();
                            } catch (e: any) { 
                              addToast('Lỗi khi xóa (Demo Mode)', 'error'); 
                              setProducts(prev => prev.filter(x => x.id !== p.id));
                            }
                          }
                        );
                      }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 20 && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
            <Pagination total={total} page={page} pageSize={20} onChange={setPage} />
          </div>
        )}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <div className="overlay-backdrop" onClick={() => !saving && setShowModal(false)} style={{ zIndex: 1000 }}>
              <motion.div className="modal-sheet modal-md shadow-2xl"
              initial={{ opacity:0, scale:0.96, y: 20 }} 
              animate={{ opacity:1, scale:1, y: 0 }} 
              exit={{ opacity:0, scale:0.96, y: 20 }}
              style={{ maxWidth: '650px', width: '100%' }}
              onClick={e => e.stopPropagation()}
            >
              
              <div className="modal-header" style={{ padding: '1.25rem 1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(163, 20, 34,0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight:800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>{editItem ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                      Điền thông tin chi tiết cho sản phẩm/dịch vụ
                    </p>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => !saving && setShowModal(false)} style={{ borderRadius: '10px' }}><X size={18} /></button>
              </div>

              <div className="modal-body" style={{ padding: '1.5rem 1.75rem', gap: '1.25rem' }}>

                {/* ── Basic Info ── */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Tên sản phẩm / dịch vụ <span className="text-danger">*</span></label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="VD: Máy tính xách tay Dell XPS..." autoFocus />
                </div>
                
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Mã SKU</label>
                    <input className="form-input" value={form.sku} onChange={e => setForm({...form, sku:e.target.value})} placeholder="VD: SV-CRM-01" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Nhóm danh mục</label>
                    <CustomSelect 
                      options={categories.map(c => ({ value: c.id, label: c.name }))} 
                      value={form.category_id} 
                      onChange={val => {
                        const cat = categories.find(c => c.id === val);
                        if (cat) {
                          setForm({...form, category_id: cat.id, category: cat.name, track_inventory: cat.track_inventory, track_cost: cat.track_cost});
                        }
                      }} 
                    />
                  </div>
                </div>

                {/* ── Pricing ── */}
                <div style={{ background: 'var(--color-bg)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--color-border-light)' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                    Giá cả
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: form.track_cost ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700 }}>Giá bán (đ)</label>
                      <div style={{ position: 'relative' }}>
                        <input className="form-input" type="number" value={form.price} onChange={e => setForm({...form, price:e.target.value})} style={{ paddingRight: '2.5rem' }} />
                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>đ</span>
                        {form.price && Number(form.price) > 0 && (
                          <div style={{ marginTop: '4px', fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
                            {numberToText(Number(form.price))}
                          </div>
                        )}
                      </div>
                    </div>
                    {form.track_cost && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700 }}>Giá vốn nhập (đ)</label>
                        <div style={{ position: 'relative' }}>
                          <input className="form-input" type="number" value={form.cost} onChange={e => setForm({...form, cost:e.target.value})} style={{ paddingRight: '2.5rem' }} />
                          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>đ</span>
                          {form.cost && Number(form.cost) > 0 && (
                            <div style={{ marginTop: '4px', fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
                              {numberToText(Number(form.cost))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Inventory (physical products only) ── */}
                {/* ── Inventory ── */}
                {form.track_inventory && (
                  <div style={{ background: 'var(--color-bg)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                        Tồn kho
                      </p>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700 }}>Số lượng tồn kho hiện có</label>
                      <input className="form-input" type="number" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: Number(e.target.value)})} />
                    </div>
                  </div>
                )}

                {/* ── Unit & Description ── */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Đơn vị tính</label>
                  <input className="form-input" value={form.unit} onChange={e => setForm({...form, unit:e.target.value})} placeholder="VD: Cái, Hộp, Giờ, Gói..." />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Mô tả</label>
                  <textarea className="form-textarea" value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Mô tả ngắn gọn..." />
                </div>

                <div style={{ padding: '0.25rem 0' }}>
                  <CustomCheckbox 
                    checked={form.is_active} 
                    onChange={e => setForm({...form, is_active:e.target.checked})} 
                    label="Đang kinh doanh / Hiển thị"
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '1.25rem 1.75rem', background: 'var(--color-bg)' }}>
                <button className="btn secondary" onClick={() => setShowModal(false)} disabled={saving}>Hủy bỏ</button>
                <button className="btn primary" onClick={handleSave} disabled={saving} style={{ minWidth: '160px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {saving && <Loader2 size={16} className="spin" />}
                  {editItem ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    , document.body)}


      {/* Category Management Modal (Modal xịn) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showCatModal && (
            <motion.div 
              className="overlay-backdrop" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowCatModal(false)} 
              style={{ zIndex: 1000 }}
            >
            <motion.div className="modal-sheet" style={{ width:'700px', maxWidth:'calc(100vw - 2rem)', zIndex: 1010, margin: 'auto' }}
              initial={{ opacity:0, scale:0.96, y: 20 }} animate={{ opacity:1, scale:1, y: 0 }} exit={{ opacity:0, scale:0.96, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              
              <div className="modal-header" style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight:800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Thiết lập Danh mục</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                      Cấu hình tính năng tồn kho, giá vốn theo từng danh mục
                    </p>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setShowCatModal(false)} style={{ borderRadius: '10px' }}><X size={18} /></button>
              </div>

              <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', background: 'var(--color-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                  <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tên danh mục mới</label>
                    <input className="form-input" placeholder="VD: Dịch vụ bảo trì..." value={newCat} onChange={e => setNewCat(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                    <button className="btn primary" onClick={() => { 
                      if(newCat.trim()){ 
                        setCategories([...categories, { id: Date.now(), name: newCat.trim(), track_inventory: true, track_cost: true }]); 
                        setNewCat(''); 
                        addToast('Đã thêm danh mục', 'success'); 
                      } 
                    }}>
                      <Plus size={16} /> Thêm mới
                    </button>
                  </div>
                </div>

                <div className="table-wrap" style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Tên danh mục</th>
                        <th style={{ textAlign: 'center' }}>Quản lý Tồn kho</th>
                        <th style={{ textAlign: 'center' }}>Nhập Giá vốn</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td style={{ textAlign: 'center' }}>
                            <CustomCheckbox checked={c.track_inventory} onChange={e => setCategories(categories.map(x => x.id === c.id ? {...x, track_inventory: e.target.checked} : x))} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <CustomCheckbox checked={c.track_cost} onChange={e => setCategories(categories.map(x => x.id === c.id ? {...x, track_cost: e.target.checked} : x))} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn-icon sm text-danger" onClick={() => { setCategories(categories.filter(x => x.id !== c.id)); addToast('Đã xóa danh mục', 'info'); }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '1.25rem 1.75rem', background: 'var(--color-bg)', justifyContent: 'flex-end' }}>
                <button className="btn primary" onClick={() => setShowCatModal(false)}>Hoàn tất</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    , document.body)}
    </div>
  );
};
