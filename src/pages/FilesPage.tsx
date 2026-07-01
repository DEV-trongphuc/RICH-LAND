import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, FileText, Download, Trash2, Upload, Search, X,
  MoreVertical, File, Filter, LayoutGrid, List, Plus, Edit,
  Shield, User, Globe, Clock, ChevronRight, HardDrive,
  Star, Clock3, FileJson, FileCode, FileImage, FileVideo,
  MoreHorizontal, Share2, Info
} from 'lucide-react';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { EmptyCard } from '../components/ui/EmptyCard';
import { Avatar } from '../components/ui/Avatar';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Pagination } from '../components/ui/Pagination';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';

export const FilesPage: React.FC = () => {
  const { addToast, showConfirm } = useUIStore();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'shared' | 'personal'>('shared');
  const [category, setCategory] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New States for Category Management
  const [categories, setCategories] = useState<any[]>([
    { id: 'all', label: 'Tất cả', icon: <HardDrive size={18} /> }
  ]);

  const fetchCategories = async () => {
    if (DEV_MODE) return;
    try {
      const res = await api.get('/file-categories');
      const cats = (res.data.data || []).map((c: any) => ({
        ...c,
        icon: c.icon_type === 'hard-drive' ? <HardDrive size={18} /> :
              c.icon_type === 'file-text' ? <FileText size={18} /> :
              c.icon_type === 'globe' ? <Globe size={18} /> :
              c.icon_type === 'shield' ? <Shield size={18} /> :
              <Folder size={18} />
      }));
      setCategories(cats);
    } catch (err: any) {
      console.error('Failed to fetch categories', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // New States for Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFormData, setUploadFormData] = useState({ name: '', category: 'general' });

  // New States for Category Modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [catFormData, setCatFormData] = useState({ label: '' });

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchFiles = async () => {
    if (DEV_MODE) {
      setLoading(true);
      const state = getFilteredMockState();
      let list = [...state.files];

      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        list = list.filter(f => f.name.toLowerCase().includes(s));
      }

      if (category !== 'all') {
        list = list.filter(f => f.category === category);
      }

      setFiles(list);
      setTotal(list.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/cloud-files', { 
        params: { 
          page, 
          limit: 15, 
          category: category === 'all' ? '' : category,
          search: searchTerm
        } 
      });
      const data = res.data.data;
      setFiles(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      addToast('Lỗi khi tải danh sách tệp tin', 'error');
    } finally {
      setLoading(false);
    }
  };

  // fetchFiles with auto-reset page on filter change
  useEffect(() => {
    fetchFiles();
  }, [page, category, searchTerm]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast('Dung lượng file quá lớn (tối đa 2MB)', 'error');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setUploadFormData({ name: file.name.split('.')[0], category: category === 'all' ? 'general' : category });
    setShowUploadModal(true);
    // Clear input so same file can be selected again
    e.target.value = '';
  };

  const confirmUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', uploadFormData.name);
      formData.append('category', uploadFormData.category);
      formData.append('visibility', activeTab);

      await api.post('/cloud-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      addToast('Đã tải tệp lên thành công', 'success');
      setShowUploadModal(false);
      setSelectedFile(null);
      fetchFiles();
    } catch (e: any) {
      addToast('Lỗi khi tải tệp lên', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!catFormData.label) return;
    try {
      if (editingCat) {
        if (!DEV_MODE) await api.put(`/file-categories/${editingCat.id}`, { label: catFormData.label });
        addToast('Đã cập nhật danh mục', 'success');
      } else {
        if (!DEV_MODE) await api.post('/file-categories', { label: catFormData.label, icon_type: 'folder' });
        addToast('Đã thêm danh mục mới', 'success');
      }
      fetchCategories();
    } catch (e: any) {
      addToast('Lỗi lưu danh mục', 'error');
    }
    setShowCatModal(false);
    setEditingCat(null);
    setCatFormData({ label: '' });
  };

  const deleteCategory = (id: string) => {
    showConfirm(
      'Xóa danh mục?',
      'Các tệp tin trong danh mục này sẽ được chuyển về mục Khác. Bạn chắc chứ?',
      async () => {
        try {
          if (!DEV_MODE) await api.delete(`/file-categories/${id}`);
          if (category === id) setCategory('all');
          addToast('Đã xóa danh mục', 'success');
          fetchCategories();
        } catch (e: any) {
          addToast('Lỗi xóa danh mục', 'error');
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    showConfirm(
      'Xóa tệp tin?',
      'Hành động này không thể hoàn tác. Tệp tin sẽ bị xóa vĩnh viễn khỏi hệ thống.',
      async () => {
        try {
          await api.delete(`/cloud-files/${id}`);
          addToast('Đã xóa tệp tin', 'success');
          fetchFiles();
        } catch (e: any) {
          addToast('Lỗi khi xóa tệp tin', 'error');
        }
      }
    );
  };

  const filtered = files;

  const getMimeIcon = (mime: string) => {
    if (!mime) return <File size={24} />;
    if (mime.includes('image')) return <FileImage size={24} className="text-rose-500" />;
    if (mime.includes('video')) return <FileVideo size={24} className="text-indigo-500" />;
    return <File size={24} style={{ color: 'var(--color-text-muted)' }} />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext!)) return { icon: <FileText size={20} />, color: '#ef4444', bg: '#fef2f2' };
    if (['doc', 'docx'].includes(ext!)) return { icon: <FileText size={20} />, color: '#3b82f6', bg: '#eff6ff' };
    if (['xls', 'xlsx'].includes(ext!)) return { icon: <FileText size={20} />, color: '#10b981', bg: '#ecfdf5' };
    if (['jpg', 'jpeg', 'png', 'svg'].includes(ext!)) return { icon: <FileImage size={20} />, color: '#BD1D2D', bg: '#fff5f6' };
    if (['zip', 'rar', '7z'].includes(ext!)) return { icon: <Folder size={20} />, color: '#f59e0b', bg: '#fffbeb' };
    return { icon: <File size={20} />, color: '#64748b', bg: 'var(--color-bg)' };
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeTab === 'shared' ? <Globe style={{ color: 'var(--color-primary)' }} /> : <User style={{ color: 'var(--color-indigo)' }} />}
            {activeTab === 'shared' ? 'Kho Tài liệu chung' : 'Tài liệu cá nhân'}
          </h1>
          <p className="page-subtitle" style={{ marginTop: '4px' }}>
            {activeTab === 'shared' ? 'Lưu trữ các biểu mẫu, quy trình và tài liệu dùng chung cho toàn đội ngũ' : 'Không gian lưu trữ riêng tư chỉ mình bạn có thể truy cập'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
           {/* Mobile Visibility Selector */}
           <div className="mobile-only" style={{ width: '120px' }}>
             <select
               value={activeTab}
               onChange={e => setActiveTab(e.target.value as any)}
               className="form-select"
               style={{ width: '100%', height: 40 }}
             >
               <option value="shared">Dùng chung</option>
               <option value="personal">Cá nhân</option>
             </select>
           </div>

           {/* Desktop Visibility Tab Switcher */}
           <div className="hide-on-mobile" style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px' }}>
             <button 
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 700, background: activeTab === 'shared' ? 'var(--color-primary-light)' : 'transparent', color: activeTab === 'shared' ? 'var(--color-primary)' : 'var(--color-text-muted)', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                onClick={() => setActiveTab('shared')}
             >
               Dùng chung
             </button>
             <button 
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 700, background: activeTab === 'personal' ? 'var(--color-primary-light)' : 'transparent', color: activeTab === 'personal' ? 'var(--color-primary)' : 'var(--color-text-muted)', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                onClick={() => setActiveTab('personal')}
             >
               Cá nhân
             </button>
           </div>
           
           <button className="btn primary" onClick={() => fileInputRef.current?.click()} title="Tải tệp mới">
             <Plus size={16} />
             <span className="hide-on-mobile"> Tải tệp mới</span>
           </button>
           <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Nav */}
        <div className="hide-on-mobile" style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '2rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 8px' }}>
                <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DANH MỤC</p>
                <button 
                  onClick={() => { setEditingCat(null); setCatFormData({ label: '' }); setShowCatModal(true); }}
                  style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Plus size={14} />
                </button>
             </div>
             {categories.map(cat => (
               <button
                 key={cat.id}
                 onClick={() => { setPage(1); setCategory(cat.id); }}
                 style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 'var(--radius-lg)', transition: 'all 0.2s', cursor: 'pointer', background: category === cat.id ? 'var(--color-surface)' : 'transparent', border: category === cat.id ? '1px solid var(--color-border)' : '1px solid transparent', boxShadow: category === cat.id ? 'var(--shadow-sm)' : 'none', color: category === cat.id ? 'var(--color-primary)' : 'var(--color-text-light)' }}
               >
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                   <span style={{ color: category === cat.id ? 'var(--color-primary)' : 'inherit' }}>{cat.icon}</span>
                   <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{cat.label}</span>
                 </div>
                 {category === cat.id && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
               </button>
             ))}
          </div>

          <div style={{ marginTop: 'auto', padding: '20px', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
             <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>Dung lượng sử dụng</h5>
             <div style={{ width: '100%', height: '8px', background: 'var(--color-border)', borderRadius: '999px', marginBottom: '12px', overflow: 'hidden' }}>
               <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${Math.min((files.reduce((acc, f) => acc + (Number(f.file_size) || 0), 0) / (10 * 1024 * 1024 * 1024)) * 100, 100)}%` }} 
                  style={{ height: '100%', background: 'var(--color-primary)' }} 
               />
             </div>
             <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 700 }}>
               {formatSize(files.reduce((acc, f) => acc + (Number(f.file_size) || 0), 0))} / 10 GB Đã dùng
             </p>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
          {/* Mobile Folder/Category Dropdown */}
          <div className="mobile-only" style={{ width: '100%' }}>
            <select 
              value={category} 
              onChange={e => { setPage(1); setCategory(e.target.value); }}
              className="form-select"
              style={{ width: '100%', height: 44, marginBottom: '0.5rem' }}
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
             <div className="filter-search" style={{ flex: 1, maxWidth: '400px' }}>
                <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <input 
                  type="text"
                  placeholder="Tìm kiếm tài liệu..." 
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
                    <X size={14} />
                  </button>
                )}
             </div>
             <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px' }}>
                <button 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, background: viewMode === 'grid' ? 'var(--color-primary-light)' : 'transparent', color: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-text-muted)', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid size={16} /> Lưới thẻ
                </button>
                <button 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, background: viewMode === 'list' ? 'var(--color-primary-light)' : 'transparent', color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                  onClick={() => setViewMode('list')}
                >
                  <List size={16} /> Danh sách
                </button>
             </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: '192px', borderRadius: 'var(--radius-2xl)' }} />)}
              </div>
            ) : total === 0 ? (
              <div style={{ flex: 1, display: 'flex', minHeight: '400px', width: '100%' }}>
                <div style={{ flex: 1, background: 'var(--color-surface)', padding: '4rem', borderRadius: 'var(--radius-2xl)', border: '2px dashed var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ width: '96px', height: '96px', background: 'var(--color-bg)', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                    <Folder size={48} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Thư mục này đang trống</h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: 1.5 }}>
                    Bắt đầu tổ chức tài liệu bằng cách tải lên tệp đầu tiên. Dung lượng lưu trữ của bạn được giới hạn ở mức <strong>10 GB</strong>.
                  </p>
                  <button className="btn primary" style={{ padding: '12px 24px', fontSize: '1rem', borderRadius: 'var(--radius-lg)' }} onClick={() => fileInputRef.current?.click()}>
                    <Upload size={18} style={{ marginRight: '8px' }} /> Tải lên ngay
                  </button>
                </div>
              </div>
            ) : (
              <>
                {viewMode === 'grid' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', paddingBottom: '2rem' }}>
                    {filtered.map(f => (
                      <motion.div 
                        key={f.id} 
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', position: 'relative' }}
                        className="hover-shadow"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                          <div style={{ width: '56px', height: '56px', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)' }}>
                            {getMimeIcon(f.mime_type)}
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn-icon-bare" title="Chia sẻ"><Share2 size={16} /></button>
                            <button className="btn-icon-bare" title="Xóa" onClick={() => handleDelete(f.id)} style={{ color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
                          </div>
                        </div>
                        
                        <h4 style={{ fontWeight: 900, fontSize: '0.875rem', color: 'var(--color-text)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.name}>{f.name}</h4>
                        <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.02em', marginBottom: '1.25rem' }}>
                          {formatSize(f.file_size)} • {f.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)' }}>
                          <Avatar name={f.uploader_name} size="sm" />
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.uploader_name}</span>
                            <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock3 size={10} /> {new Date(f.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>

                          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                            <a 
                              href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${f.file_path}`} 
                              download={f.name}
                              className="btn primary" 
                              style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: 'var(--radius-lg)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Download size={14} /> Tải xuống
                            </a>
                            <button className="btn outline" style={{ padding: '8px 12px', borderRadius: 'var(--radius-lg)' }}>
                              <Info size={16} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: '2rem' }}>
                      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                              <th style={{ padding: '1.25rem 2rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)' }}>Tên tài liệu</th>
                              <th style={{ padding: '1.25rem 1.5rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)' }}>Dung lượng</th>
                              <th style={{ padding: '1.25rem 1.5rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)' }}>Người tải lên</th>
                              <th style={{ padding: '1.25rem 1.5rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)' }}>Ngày tải</th>
                              <th style={{ padding: '1.25rem 2rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)', textAlign: 'right' }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(f => (
                              <tr key={f.id} className="hover-row" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                <td style={{ padding: '1.25rem 2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                      <div style={{ width: '40px', height: '40px', background: getFileIcon(f.name).bg, color: getFileIcon(f.name).color, borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {getFileIcon(f.name).icon}
                                      </div>
                                      <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{f.name}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{formatSize(f.file_size || f.size)}</span>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Avatar name={f.uploader_name} size="sm" />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>{f.uploader_name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{new Date(f.created_at).toLocaleDateString('vi-VN')}</span>
                                </td>
                                <td style={{ padding: '1.25rem 2rem', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                      <a 
                                        href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${f.file_path}`} 
                                        download={f.name}
                                        className="btn-icon-bare" 
                                        title="Tải xuống"
                                      >
                                        <Download size={18} />
                                      </a>
                                      <button className="btn-icon-bare" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(f.id)}><Trash2 size={18} /></button>
                                    <button className="btn-icon-bare"><MoreHorizontal size={18} /></button>
                                  </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {total > 15 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0 2rem' }}>
                    <Pagination total={total} page={page} pageSize={15} onChange={setPage} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Tải tệp mới */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showUploadModal && (
            <div className="overlay-backdrop flex items-center justify-center p-4" style={{ zIndex: 1100 }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-sheet"
              style={{ width: '400px' }}
            >
              <div className="modal-header">
                <h3>Tải tài liệu mới</h3>
                <button className="btn-icon sm" onClick={() => setShowUploadModal(false)}><Plus size={18} style={{ transform: 'rotate(45deg)' }} /></button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   {getMimeIcon(selectedFile?.type || '')}
                   <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile?.name}</p>
                      <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 700 }}>{formatSize(selectedFile?.size || 0)}</p>
                   </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tên hiển thị</label>
                  <input 
                    className="form-input" 
                    value={uploadFormData.name} 
                    onChange={e => setUploadFormData({ ...uploadFormData, name: e.target.value })}
                    placeholder="Nhập tên tài liệu..."
                  />
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Danh mục</label>
                  <CustomSelect
                    options={categories.filter(c => c.id !== 'all').map(c => ({ value: c.id, label: c.label }))}
                    value={uploadFormData.category}
                    onChange={val => setUploadFormData({ ...uploadFormData, category: String(val) })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ gap: '1rem' }}>
                <button className="btn secondary flex-1" onClick={() => setShowUploadModal(false)}>Hủy</button>
                <button className="btn primary flex-1" onClick={confirmUpload} disabled={loading}>
                  {loading ? 'Đang tải...' : 'Bắt đầu tải lên'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    , document.body)}

      {/* Modal Quản lý Danh mục */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showCatModal && (
            <div className="overlay-backdrop flex items-center justify-center p-4" style={{ zIndex: 1100 }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-sheet"
              style={{ width: '400px' }}
            >
              <div className="modal-header">
                <h3>{editingCat ? 'Sửa danh mục' : 'Thêm danh mục mới'}</h3>
                <button className="btn-icon sm" onClick={() => setShowCatModal(false)}><Plus size={18} style={{ transform: 'rotate(45deg)' }} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tên danh mục</label>
                  <input 
                    className="form-input" 
                    value={catFormData.label} 
                    onChange={e => setCatFormData({ label: e.target.value })}
                    placeholder="Ví dụ: Tài liệu kỹ thuật..."
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ gap: '1rem' }}>
                <button className="btn secondary flex-1" onClick={() => setShowCatModal(false)}>Hủy</button>
                <button className="btn primary flex-1" onClick={handleSaveCategory}>
                  {editingCat ? 'Cập nhật' : 'Thêm ngay'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    , document.body)}
    </div>
  );
};
