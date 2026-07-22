import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, FileText, Download, Trash2, Upload, Search, X,
  MoreVertical, File, Filter, LayoutGrid, List, Plus, Edit,
  Shield, User, Users, Globe, Clock, ChevronRight, HardDrive,
  Star, Clock3, FileJson, FileCode, FileImage, FileVideo,
  MoreHorizontal, Share2, Info, Building2, Eye, Megaphone
} from 'lucide-react';
import api from '../api/axios';
import { compressToWebP } from '../utils/imageCompress';
import { useUIStore } from '../store/uiStore';
import { EmptyCard } from '../components/ui/EmptyCard';
import { Avatar } from '../components/ui/Avatar';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Pagination } from '../components/ui/Pagination';
import { useAuthStore } from '../store/authStore';

import { useUploadProgress } from '../contexts/UploadProgressContext';

interface FilesPageProps {
  embedProjectId?: string;
  isEmbedded?: boolean;
}

export const FilesPage: React.FC<FilesPageProps> = ({ embedProjectId, isEmbedded = false }) => {
  const { startUpload, updateProgress, finishUpload } = useUploadProgress();
  const { addToast, showConfirm } = useUIStore();
  const userRole = useAuthStore.getState().user?.role;
  const isSale = userRole === 'sale';
  const isViewer = userRole === 'viewer';
  const isSaleOrViewer = isSale || isViewer;
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'shared' | 'personal'>('shared');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [category, setCategory] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New States for Category Management
  const [categories, setCategories] = useState<any[]>([
    { id: 'all', label: 'Tất cả', icon: <HardDrive size={18} /> }
  ]);

  const [projects, setProjects] = useState<any[]>([]);
  
  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects?bypass_roster=1');
      if (res.data?.success) {
        setProjects(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/file-categories', {
        params: { visibility: activeTab }
      });
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

  const [selectedProjectId, setSelectedProjectId] = useState<string>(embedProjectId || 'all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalSizeBytes, setTotalSizeBytes] = useState(0);

  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Restored modal state fields
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFormData, setUploadFormData] = useState({ name: '', category: 'general', project_id: embedProjectId || '', campaign_id: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFile, setEditingFile] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ id: 0, name: '', category: 'general', visibility: 'shared', project_id: '', campaign_id: '' });
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [catFormData, setCatFormData] = useState({ label: '' });
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [activeFolderMenuId, setActiveFolderMenuId] = useState<string | null>(null);
  const [activeFileMenuId, setActiveFileMenuId] = useState<number | null>(null);
  const [editFileExt, setEditFileExt] = useState('');

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/marketing-campaigns');
      if (res.data && res.data.success) {
        setCampaigns(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch campaigns', e);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [activeTab]);

  useEffect(() => {
    fetchProjects();
    fetchCampaigns();
    if (embedProjectId) {
      setSelectedProjectId(embedProjectId);
      setUploadFormData(prev => ({ ...prev, project_id: embedProjectId }));
    } else {
      const params = new URLSearchParams(window.location.search);
      const pId = params.get('project_id');
      if (pId) {
        setSelectedProjectId(pId);
      }
    }
  }, [embedProjectId]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cloud-files', { 
        params: { 
          page, 
          limit: 15, 
          category: category === 'all' ? '' : category,
          search: searchTerm,
          project_id: selectedProjectId === 'all' ? '' : selectedProjectId,
          visibility: activeTab
        } 
      });
      const data = res.data.data;
      setFiles(data.items || []);
      setTotal(data.total || 0);
      setTotalSizeBytes(data.total_size_bytes || 0);
    } catch (err: any) {
      addToast('Lỗi khi tải danh sách tệp tin', 'error');
    } finally {
      setLoading(false);
    }
  };

  // fetchFiles with auto-reset page on filter change
  useEffect(() => {
    setPage(1);
    fetchFiles();
  }, [category, activeTab, selectedProjectId, searchTerm]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast('Dung lượng file quá lớn (tối đa 2MB)', 'error');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setUploadFormData({ name: file.name.split('.')[0], category: category === 'all' ? 'general' : category, project_id: embedProjectId || '', campaign_id: '' });
    setShowUploadModal(true);
    // Clear input so same file can be selected again
    e.target.value = '';
  };

  const confirmUpload = async () => {
    if (!selectedFile || loading) return;
    setLoading(true);

    const sizeStr = (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB';
    const taskId = startUpload(selectedFile.name, sizeStr);

    try {
      updateProgress(taskId, 10, 'compressing');
      const compressedFile = await compressToWebP(selectedFile);
      updateProgress(taskId, 25, 'uploading');

      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('name', uploadFormData.name);
      formData.append('category', uploadFormData.category);
      formData.append('visibility', activeTab);
      if (uploadFormData.project_id) {
        formData.append('project_id', uploadFormData.project_id);
      }
      if (uploadFormData.campaign_id) {
        formData.append('campaign_id', uploadFormData.campaign_id);
      }

      await api.post('/cloud-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            updateProgress(taskId, percent, percent === 100 ? 'processing' : 'uploading');
          }
        }
      });
      
      finishUpload(taskId, true);
      addToast('Đã tải tệp lên thành công', 'success');
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadFormData({ name: '', category: 'general', project_id: embedProjectId || '', campaign_id: '' });
      fetchFiles();
    } catch (e: any) {
      finishUpload(taskId, false, e.message || 'Lỗi khi tải tệp lên');
      addToast('Lỗi khi tải tệp lên', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (fileObj: any) => {
    setEditingFile(fileObj);
    const name = fileObj.name || '';
    const lastDot = name.lastIndexOf('.');
    const ext = lastDot !== -1 ? name.substring(lastDot) : '';
    const baseName = lastDot !== -1 ? name.substring(0, lastDot) : name;
    setEditFileExt(ext);
    setEditFormData({
      id: fileObj.id,
      name: baseName,
      category: fileObj.category || 'general',
      visibility: fileObj.visibility || 'shared',
      project_id: fileObj.project_id ? String(fileObj.project_id) : '',
      campaign_id: fileObj.campaign_id ? String(fileObj.campaign_id) : ''
    });
    setShowEditModal(true);
  };

  const handleUpdateFile = async () => {
    if (!editFormData.name || loading) return;
    setLoading(true);
    try {
      await api.put(`/cloud-files/${editFormData.id}`, {
        name: editFormData.name + editFileExt,
        category: editFormData.category,
        visibility: editFormData.visibility,
        project_id: editFormData.project_id || null,
        campaign_id: editFormData.campaign_id || null
      });
      addToast('Cập nhật tài liệu thành công', 'success');
      setShowEditModal(false);
      fetchFiles();
    } catch (e) {
      addToast('Lỗi khi cập nhật tài liệu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async () => {
    if (isSaleOrViewer && activeTab !== 'personal') {
      addToast('Bạn không có quyền thực hiện hành động này', 'error');
      return;
    }
    if (!catFormData.label || isSavingCategory) return;
    try {
      setIsSavingCategory(true);
      
      // Calculate full path label based on currentPath (excluding the last element if editing)
      const parentPath = editingCat ? currentPath.slice(0, -1) : currentPath;
      const fullLabel = parentPath.length > 0 ? `${parentPath.join('/')}/${catFormData.label.trim()}` : catFormData.label.trim();

      if (editingCat) {
        const oldLabel = editingCat.label;
        await api.put(`/file-categories/${editingCat.id}`, { label: fullLabel });
        // If this is a parent folder, update all its child subfolders recursively
        const subCatsToRename = categories.filter(c => c.label.startsWith(oldLabel + '/'));
        for (const sub of subCatsToRename) {
          const relativePart = sub.label.slice(oldLabel.length);
          await api.put(`/file-categories/${sub.id}`, { label: fullLabel + relativePart });
        }
        addToast('Đã cập nhật thư mục', 'success');
      } else {
        await api.post('/file-categories', { label: fullLabel, icon_type: 'folder', visibility: activeTab });
        addToast('Đã tạo thư mục mới', 'success');
      }
      fetchCategories();
      setShowCatModal(false);
      setEditingCat(null);
      setCatFormData({ label: '' });
    } catch (e: any) {
      addToast('Lỗi lưu thư mục', 'error');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const deleteCategory = (id: string) => {
    showConfirm(
      'Xóa danh mục?',
      'Các tệp tin trong danh mục này sẽ được chuyển về mục Khác. Bạn chắc chứ?',
      async () => {
        try {
          await api.delete(`/file-categories/${id}`);
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

  const currentPathStr = currentPath.join('/');
  const currentCategoryObj = categories.find(c => c.label === currentPathStr);
  const currentCategoryId = currentCategoryObj ? currentCategoryObj.id : 'all';

  const displayFolders = searchTerm ? [] : categories.filter(c => {
    if (c.id === 'all') return false;
    const label = c.label;
    if (currentPath.length === 0) {
      return !label.includes('/');
    } else {
      return label.startsWith(currentPathStr + '/') && label.slice(currentPathStr.length + 1).split('/').length === 1;
    }
  });

  const displayFiles = searchTerm 
    ? files 
    : files.filter(f => {
        if (currentPath.length === 0) {
          return !f.category || f.category === 'general' || f.category === 'all' || !categories.some(c => c.id === f.category);
        } else {
          return f.category === currentCategoryId;
        }
      });

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
    if (['pdf'].includes(ext!)) return { icon: <FileText size={22} />, color: '#ffffff', bg: '#ef4444' };
    if (['doc', 'docx'].includes(ext!)) return { icon: <FileText size={22} />, color: '#ffffff', bg: '#3b82f6' };
    if (['xls', 'xlsx'].includes(ext!)) return { icon: <FileText size={22} />, color: '#ffffff', bg: '#10b981' };
    if (['jpg', 'jpeg', 'png', 'svg', 'webp'].includes(ext!)) return { icon: <FileImage size={22} />, color: '#ffffff', bg: '#BD1D2D' };
    if (['zip', 'rar', '7z'].includes(ext!)) return { icon: <Folder size={22} />, color: '#ffffff', bg: '#f59e0b' };
    return { icon: <File size={22} />, color: '#ffffff', bg: '#64748b' };
  };

  return (
    <div className={isEmbedded ? "" : "page-container"} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: isEmbedded ? 0 : undefined }}>
      {!isEmbedded && (
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
           {/* Pill Tab Switcher */}
           <div style={{ 
              display: 'flex', 
              background: 'var(--color-border-light)', 
              border: '1px solid var(--color-border)',
              borderRadius: '8px', 
              padding: '2px', 
              gap: '2px', 
              position: 'relative' 
            }}>
              <button 
                 style={{ 
                   padding: '6px 16px', 
                   borderRadius: '6px', 
                   fontSize: '0.85rem', 
                   fontWeight: 700, 
                   background: 'transparent', 
                   color: activeTab === 'shared' ? 'var(--color-text)' : 'var(--color-text-light)', 
                   transition: 'color 0.2s', 
                   border: 'none', 
                   outline: 'none',
                   boxShadow: 'none',
                   cursor: 'pointer',
                   position: 'relative',
                   display: 'inline-flex',
                   alignItems: 'center',
                   gap: '6px'
                 }}
                 onClick={() => { setActiveTab('shared'); setCurrentPath([]); setCategory('all'); }}
              >
                {activeTab === 'shared' && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'var(--color-surface)',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      zIndex: 1
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} />
                  Dùng chung
                </span>
              </button>
              <button 
                 style={{ 
                   padding: '6px 16px', 
                   borderRadius: '6px', 
                   fontSize: '0.85rem', 
                   fontWeight: 700, 
                   background: 'transparent', 
                   color: activeTab === 'personal' ? 'var(--color-text)' : 'var(--color-text-light)', 
                   transition: 'color 0.2s', 
                   border: 'none', 
                   outline: 'none',
                   boxShadow: 'none',
                   cursor: 'pointer',
                   position: 'relative',
                   display: 'inline-flex',
                   alignItems: 'center',
                   gap: '6px'
                 }}
                 onClick={() => { setActiveTab('personal'); setCurrentPath([]); setCategory('all'); }}
              >
                {activeTab === 'personal' && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'var(--color-surface)',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      zIndex: 1
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} />
                  Cá nhân
                </span>
              </button>
           </div>
           
           {!isViewer && (
             <button className="btn secondary" onClick={() => fileInputRef.current?.click()} title="Tải tệp mới" style={{ border: '1px solid var(--color-border)', borderRadius: '8px' }}>
               <Plus size={16} />
               <span className="hide-on-mobile"> Tải tệp mới</span>
             </button>
           )}
        </div>
      </div>
      )}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
          
          {/* Personal Vault Theme banner */}
          {activeTab === 'personal' && (
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
              border: '1px solid rgba(99, 102, 241, 0.45)',
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              position: 'relative',
              boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.25), 0 8px 10px -6px rgba(99, 102, 241, 0.2)',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '120px',
                height: '100%',
                opacity: 0.1,
                background: 'radial-gradient(circle, #fff 10%, transparent 11%)',
                backgroundSize: '12px 12px'
              }} />
              
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
                flexShrink: 0
              }}>
                <Shield size={22} className="animate-pulse" />
              </div>
              <div style={{ flex: 1, zIndex: 1 }}>
                <h4 style={{ fontWeight: 900, fontSize: '0.9rem', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.02em' }}>
                  HỆ THỐNG LƯU TRỮ BẢO MẬT CÁ NHÂN (PERSONAL VAULT)
                  <span style={{ fontSize: '9px', background: '#6366f1', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: 900, letterSpacing: '0.05em' }}>SECURE</span>
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'rgba(224, 231, 255, 0.85)', margin: '4px 0 0 0', fontWeight: 700, lineHeight: '1.4' }}>
                  Không gian mã hóa bảo mật. Chỉ tài khoản cá nhân của bạn mới có quyền truy cập, xem hoặc chỉnh sửa dữ liệu tại đây.
                </p>
              </div>
            </div>
          )}

          {/* Unified Explorer Control Panel */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
          }}>
            {/* Row 1: Sleek Explorer Header & Breadcrumbs Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', flex: 1, paddingBottom: '2px' }}>
                <button 
                  onClick={() => { setCurrentPath([]); setCategory('all'); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: currentPath.length === 0 ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                >
                  <HardDrive size={16} /> Gốc
                </button>
                {currentPath.map((folder, idx) => (
                  <React.Fragment key={idx}>
                    <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <button
                      onClick={() => {
                        const newPath = currentPath.slice(0, idx + 1);
                        setCurrentPath(newPath);
                        const partialLabel = newPath.join('/');
                        const catObj = categories.find(c => c.label === partialLabel);
                        setCategory(catObj ? catObj.id : 'all');
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: idx === currentPath.length - 1 ? 'var(--color-primary)' : 'var(--color-text-muted)', padding: 0 }}
                    >
                      {folder}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              
              {/* Storage Progress indicator & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--color-text-muted)' }}>Dung lượng:</span>
                  <div style={{ width: '80px', height: '6px', background: 'var(--color-border)', borderRadius: '999px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min((totalSizeBytes / (10 * 1024 * 1024 * 1024)) * 100, 100)}%`, 
                      background: activeTab === 'personal' ? 'var(--color-indigo)' : 'var(--color-primary)' 
                    }} />
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--color-text)', fontWeight: 800 }}>
                    {formatSize(totalSizeBytes)} / 10 GB
                  </span>
                </div>

                {!isViewer && (
                  <button 
                    className="btn secondary"
                    onClick={() => { setEditingCat(null); setCatFormData({ label: '' }); setShowCatModal(true); }}
                    style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', height: '32px', border: '1px solid var(--color-border)' }}
                  >
                    <Plus size={14} /> Thư mục mới
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--color-border-light)' }} />

            {/* Row 2: Search and filtering controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
               <div style={{ display: 'flex', gap: '1rem', flex: 1, maxWidth: '650px', alignItems: 'center', flexWrap: 'wrap' }}>
                 <div className="filter-search" style={{ flex: 1, borderRadius: '8px', height: '34px', minWidth: '200px' }}>
                    <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <input 
                      type="text"
                      placeholder="Tìm kiếm tài liệu..." 
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                      style={{ fontSize: '0.8rem' }}
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
                        <X size={14} />
                      </button>
                    )}
                 </div>

                 {/* Project Filter Dropdown */}
                 {!isEmbedded && (
                    <div style={{ width: '200px', flexShrink: 0 }}>
                      <CustomSelect
                        options={[
                          { value: 'all', label: 'Tất cả dự án' },
                          ...projects.map(p => ({ value: String(p.id), label: p.name }))
                        ]}
                        value={selectedProjectId}
                        onChange={val => {
                          setPage(1);
                          setSelectedProjectId(String(val));
                        }}
                        placeholder="Lọc theo dự án"
                        searchable
                      />
                    </div>
                  )}
               </div>
               
               {/* View Switcher (with OS-style 8px border-radius) */}
               <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '3px' }}>
                  <button 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, background: viewMode === 'grid' ? 'var(--color-bg)' : 'transparent', color: viewMode === 'grid' ? 'var(--color-text)' : 'var(--color-text-muted)', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid size={14} /> Lưới thẻ
                  </button>
                  <button 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, background: viewMode === 'list' ? 'var(--color-bg)' : 'transparent', color: viewMode === 'list' ? 'var(--color-text)' : 'var(--color-text-muted)', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                    onClick={() => setViewMode('list')}
                  >
                    <List size={14} /> Danh sách
                  </button>
               </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '160px' }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: '192px', borderRadius: 'var(--radius-2xl)' }} />)}
              </div>
            ) : (displayFolders.length === 0 && displayFiles.length === 0) ? (
              <div style={{ flex: 1, display: 'flex', minHeight: '400px', width: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <EmptyCard 
                    icon={<Folder />}
                    title="Thư mục này đang trống"
                    description={isViewer ? "Không có tài liệu nào trong thư mục này." : "Bắt đầu tổ chức tài liệu bằng cách tải lên tệp đầu tiên. Dung lượng lưu trữ của bạn được giới hạn ở mức 10 GB."}
                    actionText={isViewer ? undefined : "Tải lên ngay"}
                    onAction={isViewer ? undefined : () => fileInputRef.current?.click()}
                  />
                </div>
              </div>
            ) : (
              <>
                {viewMode === 'grid' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
                    {/* Folders Section */}
                    {displayFolders.length > 0 && (
                      <div>
                        <h5 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Thư mục ({displayFolders.length})</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                          {displayFolders.map(sub => {
                            const displayLabel = currentPath.length === 0 ? sub.label : sub.label.slice(currentPathStr.length + 1);
                            const fileCount = files.filter(f => f.category === sub.id).length;
                            return (
                              <motion.div
                                key={sub.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{
                                  background: 'var(--color-surface)',
                                  padding: '0.85rem 1.15rem',
                                  borderRadius: '12px',
                                  border: '1px solid rgba(226, 232, 240, 0.8)',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.03)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  position: 'relative',
                                  overflow: 'visible'
                                }}
                                className="hover-shadow"
                                onClick={() => {
                                  const nextPath = [...currentPath, displayLabel];
                                  setCurrentPath(nextPath);
                                  setCategory(sub.id);
                                }}
                              >
                                <div style={{ color: '#f59e0b', flexShrink: 0 }}>
                                  <Folder size={30} fill="#f59e0b" stroke="#f59e0b" />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <h5 style={{ fontWeight: 750, fontSize: '0.85rem', color: 'var(--color-text)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={displayLabel}>
                                    {displayLabel}
                                  </h5>
                                  <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '2px 0 0 0', fontWeight: 700 }}>
                                    {fileCount} tài liệu
                                  </p>
                                </div>
                                {!isViewer && (
                                   <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                                     <button 
                                       className="btn-icon-bare" 
                                       title="Thao tác" 
                                       onClick={() => setActiveFolderMenuId(activeFolderMenuId === sub.id ? null : sub.id)}
                                       style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                     >
                                       <MoreHorizontal size={16} />
                                     </button>

                                     {activeFolderMenuId === sub.id && (
                                       <>
                                         {/* Click overlay to close dropdown */}
                                         <div 
                                           style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                                           onClick={() => setActiveFolderMenuId(null)}
                                         />
                                         <div 
                                           style={{ 
                                             position: 'absolute', 
                                             right: 0, 
                                             top: '100%', 
                                             marginTop: '4px',
                                             background: 'var(--color-surface)', 
                                             borderRadius: '8px', 
                                             border: '1px solid var(--color-border)', 
                                             boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                             padding: '4px', 
                                             zIndex: 1000, 
                                             display: 'flex', 
                                             flexDirection: 'column', 
                                             gap: '2px',
                                             minWidth: '100px'
                                           }}
                                         >
                                           <button 
                                             className="btn-icon-bare" 
                                             style={{ 
                                               padding: '6px 12px', 
                                               fontSize: '0.75rem', 
                                               fontWeight: 700, 
                                               width: '100%', 
                                               textAlign: 'left', 
                                               display: 'flex', 
                                               alignItems: 'center', 
                                               gap: '6px', 
                                               borderRadius: '6px',
                                               color: 'var(--color-text-light)'
                                             }} 
                                             onClick={() => { 
                                               setActiveFolderMenuId(null); 
                                               setEditingCat(sub); 
                                               setCatFormData({ label: displayLabel }); 
                                               setShowCatModal(true); 
                                             }}
                                           >
                                             <Edit size={12} /> Sửa
                                           </button>
                                           <button 
                                             className="btn-icon-bare" 
                                             style={{ 
                                               padding: '6px 12px', 
                                               fontSize: '0.75rem', 
                                               fontWeight: 700, 
                                               width: '100%', 
                                               textAlign: 'left', 
                                               display: 'flex', 
                                               alignItems: 'center', 
                                               gap: '6px', 
                                               borderRadius: '6px',
                                               color: 'var(--color-danger)'
                                             }} 
                                             onClick={() => { 
                                               setActiveFolderMenuId(null); 
                                               deleteCategory(sub.id); 
                                             }}
                                           >
                                             <Trash2 size={12} /> Xóa
                                           </button>
                                         </div>
                                       </>
                                     )}
                                   </div>
                                 )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Files Section */}
                    {displayFiles.length > 0 && (
                      <div>
                        <h5 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Tệp tin ({displayFiles.length})</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
                          {displayFiles.map(f => (
                            <motion.div 
                              key={f.id} 
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              style={{ background: 'var(--color-surface)', padding: '1.15rem', borderRadius: '12px', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.03)', position: 'relative', overflow: 'visible' }}
                              className="hover-shadow"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                  <div style={{ width: '32px', height: '32px', background: getFileIcon(f.name).bg, color: getFileIcon(f.name).color, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none' }}>
                                    {React.cloneElement(getFileIcon(f.name).icon, { size: 16 })}
                                  </div>
                                  <h4 style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.name}>
                                    {f.name}
                                  </h4>
                                </div>
                                <div style={{ position: 'relative' }}>
                                  <button 
                                    className="btn-icon-bare" 
                                    title="Thao tác" 
                                    onClick={() => setActiveFileMenuId(activeFileMenuId === f.id ? null : f.id)}
                                    style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    <MoreHorizontal size={16} />
                                  </button>

                                  {activeFileMenuId === f.id && (
                                    <>
                                      {/* Click overlay to close dropdown */}
                                      <div 
                                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                                        onClick={() => setActiveFileMenuId(null)}
                                      />
                                      <div 
                                        style={{ 
                                          position: 'absolute', 
                                          right: 0, 
                                          top: '100%', 
                                          marginTop: '4px',
                                          background: 'var(--color-surface)', 
                                          borderRadius: '8px', 
                                          border: '1px solid var(--color-border)', 
                                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                          padding: '4px', 
                                          zIndex: 1000, 
                                          display: 'flex', 
                                          flexDirection: 'column', 
                                          gap: '2px',
                                          minWidth: '120px'
                                        }}
                                      >
                                        <a 
                                          href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${f.file_path}`} 
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ 
                                            padding: '6px 12px', 
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            width: '100%', 
                                            textAlign: 'left', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '6px', 
                                            borderRadius: '6px',
                                            color: 'var(--color-text-light)',
                                            textDecoration: 'none'
                                          }} 
                                          onClick={() => setActiveFileMenuId(null)}
                                        >
                                          <Eye size={14} /> Xem tài liệu
                                        </a>
                                        <a 
                                          href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${f.file_path}`} 
                                          download={f.name}
                                          style={{ 
                                            padding: '6px 12px', 
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            width: '100%', 
                                            textAlign: 'left', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '6px', 
                                            borderRadius: '6px',
                                            color: 'var(--color-text-light)',
                                            textDecoration: 'none'
                                          }} 
                                          onClick={() => setActiveFileMenuId(null)}
                                        >
                                          <Download size={14} /> Tải xuống
                                        </a>
                                        {!isViewer && (!isSale || activeTab === 'personal') && (
                                          <button 
                                            className="btn-icon-bare" 
                                            style={{ 
                                              padding: '6px 12px', 
                                              fontSize: '0.75rem', 
                                              fontWeight: 700, 
                                              width: '100%', 
                                              textAlign: 'left', 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              gap: '6px', 
                                              borderRadius: '6px',
                                              color: 'var(--color-text-light)',
                                              border: 'none',
                                              background: 'none',
                                              cursor: 'pointer'
                                            }} 
                                            onClick={() => {
                                              setActiveFileMenuId(null);
                                              handleOpenEditModal(f);
                                            }}
                                          >
                                            <Edit size={14} /> Chỉnh sửa
                                          </button>
                                        )}
                                        <button 
                                          className="btn-icon-bare" 
                                          style={{ 
                                            padding: '6px 12px', 
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            width: '100%', 
                                            textAlign: 'left', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '6px', 
                                            borderRadius: '6px',
                                            color: 'var(--color-text-light)',
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer'
                                          }} 
                                          onClick={() => {
                                            setActiveFileMenuId(null);
                                            addToast('Đã sao chép link liên kết!', 'success');
                                            navigator.clipboard.writeText(`${import.meta.env.VITE_API_URL ?? '/backend'}/${f.file_path}`);
                                          }}
                                        >
                                          <Share2 size={14} /> Chia sẻ
                                        </button>
                                        {!isViewer && (!isSale || activeTab === 'personal') && (
                                          <button 
                                            className="btn-icon-bare" 
                                            style={{ 
                                              padding: '6px 12px', 
                                              fontSize: '0.75rem', 
                                              fontWeight: 700, 
                                              width: '100%', 
                                              textAlign: 'left', 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              gap: '6px', 
                                              borderRadius: '6px',
                                              color: 'var(--color-danger)',
                                              border: 'none',
                                              background: 'none',
                                              cursor: 'pointer'
                                            }} 
                                            onClick={() => {
                                              setActiveFileMenuId(null);
                                              handleDelete(f.id);
                                            }}
                                          >
                                            <Trash2 size={14} /> Xóa
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.02em', marginBottom: (f.project_name || f.campaign_name) ? '0.5rem' : '1.15rem', paddingLeft: '40px' }}>
                                {formatSize(f.file_size)} • {f.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                              </p>
                              {(f.project_name || f.campaign_name) && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginLeft: '40px', marginBottom: '1.15rem' }}>
                                  {f.project_name && (
                                    <div style={{ gap: '4px', background: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5', padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 800, display: 'inline-flex', alignItems: 'center' }}>
                                      <Building2 size={10} /> {f.project_name}
                                    </div>
                                  )}
                                  {f.campaign_name && (
                                    <div style={{ gap: '4px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 800, display: 'inline-flex', alignItems: 'center' }}>
                                      <Megaphone size={10} /> {f.campaign_name}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', background: 'var(--color-bg)', borderRadius: '8px' }}>
                                <Avatar name={f.uploader_name} size="sm" />
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.uploader_name}</span>
                                  <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock3 size={9} /> {new Date(f.created_at).toLocaleDateString('vi-VN')}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="table-wrap responsive-table-wrap mobile-card-table" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: '2rem' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                          <tr>
                            <th style={{ padding: '1.25rem 2rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)' }}>Tên tài liệu</th>
                            <th style={{ padding: '1.25rem 1.5rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)' }}>Loại</th>
                            <th style={{ padding: '1.25rem 1.5rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)' }}>Dung lượng</th>
                            <th style={{ padding: '1.25rem 1.5rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)' }}>Người tải lên</th>
                            <th style={{ padding: '1.25rem 1.5rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)' }}>Ngày tải</th>
                            <th style={{ padding: '1.25rem 2rem', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)', textAlign: 'right' }}>Hành động</th>
                          </tr>
                      </thead>
                      <tbody>
                          {/* List view folders first */}
                          {displayFolders.map(sub => {
                            const displayLabel = currentPath.length === 0 ? sub.label : sub.label.slice(currentPathStr.length + 1);
                            return (
                              <tr 
                                key={sub.id} 
                                className="hover-row" 
                                style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer' }}
                                onClick={() => {
                                  const nextPath = [...currentPath, displayLabel];
                                  setCurrentPath(nextPath);
                                  setCategory(sub.id);
                                }}
                              >
                                <td data-label="Tên tài liệu" style={{ padding: '1.25rem 2rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ color: '#f59e0b' }}>
                                      <Folder size={20} fill="#f59e0b" stroke="#f59e0b" />
                                    </div>
                                    <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{displayLabel}</span>
                                  </div>
                                </td>
                                <td data-label="Loại" style={{ padding: '1.25rem 1.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--color-text-muted)' }}>Thư mục</span>
                                </td>
                                <td data-label="Dung lượng" style={{ padding: '1.25rem 1.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>-</span>
                                </td>
                                <td data-label="Người tải lên" style={{ padding: '1.25rem 1.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>-</span>
                                </td>
                                <td data-label="Ngày tải" style={{ padding: '1.25rem 1.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>-</span>
                                </td>
                                <td data-label="Hành động" style={{ padding: '1.25rem 2rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                    {!isViewer && (
                                      <div style={{ position: 'relative' }}>
                                        <button 
                                          className="btn-icon-bare" 
                                          title="Thao tác" 
                                          onClick={() => setActiveFolderMenuId(activeFolderMenuId === sub.id ? null : sub.id)}
                                          style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                          <MoreHorizontal size={16} />
                                        </button>

                                        {activeFolderMenuId === sub.id && (
                                          <>
                                            {/* Click overlay to close dropdown */}
                                            <div 
                                              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                                              onClick={() => setActiveFolderMenuId(null)}
                                            />
                                            <div 
                                              style={{ 
                                                position: 'absolute', 
                                                right: 0, 
                                                top: '100%', 
                                                marginTop: '4px',
                                                background: 'var(--color-surface)', 
                                                borderRadius: '8px', 
                                                border: '1px solid var(--color-border)', 
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                                padding: '4px', 
                                                zIndex: 1000, 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                gap: '2px',
                                                minWidth: '100px'
                                              }}
                                            >
                                              <button 
                                                className="btn-icon-bare" 
                                                style={{ 
                                                  padding: '6px 12px', 
                                                  fontSize: '0.75rem', 
                                                  fontWeight: 700, 
                                                  width: '100%', 
                                                  textAlign: 'left', 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  gap: '6px', 
                                                  borderRadius: '6px',
                                                  color: 'var(--color-text-light)'
                                                }} 
                                                onClick={() => { 
                                                  setActiveFolderMenuId(null); 
                                                  setEditingCat(sub); 
                                                  setCatFormData({ label: displayLabel }); 
                                                  setShowCatModal(true); 
                                                }}
                                              >
                                                <Edit size={12} /> Sửa
                                              </button>
                                              <button 
                                                className="btn-icon-bare" 
                                                style={{ 
                                                  padding: '6px 12px', 
                                                  fontSize: '0.75rem', 
                                                  fontWeight: 700, 
                                                  width: '100%', 
                                                  textAlign: 'left', 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  gap: '6px', 
                                                  borderRadius: '6px',
                                                  color: 'var(--color-danger)'
                                                }} 
                                                onClick={() => { 
                                                  setActiveFolderMenuId(null); 
                                                  deleteCategory(sub.id); 
                                                }}
                                              >
                                                <Trash2 size={12} /> Xóa
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {/* List view files next */}
                          {displayFiles.map(f => (
                            <tr key={f.id} className="hover-row" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                              <td data-label="Tên tài liệu" style={{ padding: '1.25rem 2rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', background: getFileIcon(f.name).bg, color: getFileIcon(f.name).color, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
                                      {getFileIcon(f.name).icon}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>{f.name}</span>
                                      {(f.project_name || f.campaign_name) && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                          {f.project_name && (
                                            <span style={{ fontSize: '10px', color: '#4f46e5', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                              <Building2 size={10} /> {f.project_name}
                                            </span>
                                          )}
                                          {f.campaign_name && (
                                            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                              <Megaphone size={10} /> {f.campaign_name}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                              </td>
                              <td data-label="Loại" style={{ padding: '1.25rem 1.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--color-text-muted)' }}>{f.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                              </td>
                              <td data-label="Dung lượng" style={{ padding: '1.25rem 1.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{formatSize(f.file_size || f.size)}</span>
                              </td>
                              <td data-label="Người tải lên" style={{ padding: '1.25rem 1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Avatar name={f.uploader_name} size="sm" />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>{f.uploader_name}</span>
                                </div>
                              </td>
                              <td data-label="Ngày tải" style={{ padding: '1.25rem 1.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{new Date(f.created_at).toLocaleDateString('vi-VN')}</span>
                              </td>
                              <td data-label="Hành động" style={{ padding: '1.25rem 2rem', textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                  <div style={{ position: 'relative' }}>
                                    <button 
                                      className="btn-icon-bare" 
                                      title="Thao tác" 
                                      onClick={() => setActiveFileMenuId(activeFileMenuId === f.id ? null : f.id)}
                                      style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <MoreHorizontal size={18} />
                                    </button>

                                    {activeFileMenuId === f.id && (
                                      <>
                                        {/* Click overlay to close dropdown */}
                                        <div 
                                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                                          onClick={() => setActiveFileMenuId(null)}
                                        />
                                        <div 
                                          style={{ 
                                            position: 'absolute', 
                                            right: 0, 
                                            top: '100%', 
                                            marginTop: '4px',
                                            background: 'var(--color-surface)', 
                                            borderRadius: '8px', 
                                            border: '1px solid var(--color-border)', 
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                            padding: '4px', 
                                            zIndex: 1000, 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '2px',
                                            minWidth: '120px',
                                            textAlign: 'left'
                                          }}
                                        >
                                          <a 
                                            href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${f.file_path}`} 
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ 
                                              padding: '6px 12px', 
                                              fontSize: '0.75rem', 
                                              fontWeight: 700, 
                                              width: '100%', 
                                              textAlign: 'left', 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              gap: '6px', 
                                              borderRadius: '6px',
                                              color: 'var(--color-text-light)',
                                              textDecoration: 'none'
                                            }} 
                                            onClick={() => setActiveFileMenuId(null)}
                                          >
                                            <Eye size={14} /> Xem tài liệu
                                          </a>
                                          <a 
                                            href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${f.file_path}`} 
                                            download={f.name}
                                            style={{ 
                                              padding: '6px 12px', 
                                              fontSize: '0.75rem', 
                                              fontWeight: 700, 
                                              width: '100%', 
                                              textAlign: 'left', 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              gap: '6px', 
                                              borderRadius: '6px',
                                              color: 'var(--color-text-light)',
                                              textDecoration: 'none'
                                            }} 
                                            onClick={() => setActiveFileMenuId(null)}
                                          >
                                            <Download size={14} /> Tải xuống
                                          </a>
                                          {!isViewer && (!isSale || activeTab === 'personal') && (
                                            <button 
                                              className="btn-icon-bare" 
                                              style={{ 
                                                padding: '6px 12px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700, 
                                                width: '100%', 
                                                textAlign: 'left', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '6px', 
                                                borderRadius: '6px',
                                                color: 'var(--color-text-light)',
                                                border: 'none',
                                                background: 'none',
                                                cursor: 'pointer'
                                              }} 
                                              onClick={() => {
                                                setActiveFileMenuId(null);
                                                handleOpenEditModal(f);
                                              }}
                                            >
                                              <Edit size={14} /> Chỉnh sửa
                                            </button>
                                          )}
                                          <button 
                                            className="btn-icon-bare" 
                                            style={{ 
                                              padding: '6px 12px', 
                                              fontSize: '0.75rem', 
                                              fontWeight: 700, 
                                              width: '100%', 
                                              textAlign: 'left', 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              gap: '6px', 
                                              borderRadius: '6px',
                                              color: 'var(--color-text-light)',
                                              border: 'none',
                                              background: 'none',
                                              cursor: 'pointer'
                                            }} 
                                            onClick={() => {
                                              setActiveFileMenuId(null);
                                              addToast('Đã sao chép link liên kết!', 'success');
                                              navigator.clipboard.writeText(`${import.meta.env.VITE_API_URL ?? '/backend'}/${f.file_path}`);
                                            }}
                                          >
                                            <Share2 size={14} /> Chia sẻ
                                          </button>
                                          {!isViewer && (!isSale || activeTab === 'personal') && (
                                            <button 
                                              className="btn-icon-bare" 
                                              style={{ 
                                                padding: '6px 12px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700, 
                                                width: '100%', 
                                                textAlign: 'left', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '6px', 
                                                borderRadius: '6px',
                                                color: 'var(--color-danger)',
                                                border: 'none',
                                                background: 'none',
                                                cursor: 'pointer'
                                              }} 
                                              onClick={() => {
                                                setActiveFileMenuId(null);
                                                handleDelete(f.id);
                                              }}
                                            >
                                              <Trash2 size={14} /> Xóa
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
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
              style={{ width: '560px' }}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Danh mục</label>
                    <CustomSelect
                      options={categories.filter(c => c.id !== 'all').map(c => ({ value: c.id, label: c.label }))}
                      value={uploadFormData.category}
                      onChange={val => setUploadFormData({ ...uploadFormData, category: String(val) })}
                    />
                  </div>

                  <div style={{ margin: 0 }} />

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Dự án liên kết</label>
                    <CustomSelect
                      searchable
                      direction="up"
                      options={[
                        { value: '', label: 'Không liên kết' },
                        ...projects.map(p => ({ value: String(p.id), label: p.name }))
                      ]}
                      value={uploadFormData.project_id}
                      onChange={val => {
                        const nextProj = String(val);
                        let nextCamp = uploadFormData.campaign_id;
                        if (nextCamp) {
                          const c = campaigns.find(x => String(x.id) === nextCamp);
                          if (c && String(c.project_id) !== nextProj) {
                            nextCamp = '';
                          }
                        }
                        setUploadFormData({ ...uploadFormData, project_id: nextProj, campaign_id: nextCamp });
                      }}
                      placeholder="Chọn dự án..."
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Chiến dịch liên kết</label>
                    <CustomSelect
                      searchable
                      direction="up"
                      options={[
                        { value: '', label: 'Không liên kết' },
                        ...campaigns
                          .filter(c => !uploadFormData.project_id || String(c.project_id) === uploadFormData.project_id)
                          .map(c => ({ value: String(c.id), label: c.name }))
                      ]}
                      value={uploadFormData.campaign_id}
                      onChange={val => {
                        const nextCamp = String(val);
                        let nextProj = uploadFormData.project_id;
                        if (nextCamp) {
                          const c = campaigns.find(x => String(x.id) === nextCamp);
                          if (c && c.project_id) {
                            nextProj = String(c.project_id);
                          }
                        }
                        setUploadFormData({ ...uploadFormData, campaign_id: nextCamp, project_id: nextProj });
                      }}
                      placeholder="Chọn chiến dịch..."
                    />
                  </div>
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

      {/* Modal Chỉnh sửa tài liệu */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showEditModal && (
            <div className="overlay-backdrop flex items-center justify-center p-4" style={{ zIndex: 1100 }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-sheet"
              style={{ width: '560px' }}
            >
              <div className="modal-header">
                <h3>Chỉnh sửa tài liệu</h3>
                <button className="btn-icon sm" onClick={() => setShowEditModal(false)}><Plus size={18} style={{ transform: 'rotate(45deg)' }} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tên hiển thị</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      className="form-input" 
                      value={editFormData.name} 
                      onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                      placeholder="Nhập tên tài liệu..."
                      style={{ flex: 1 }}
                    />
                    {editFileExt && (
                      <span style={{ 
                        background: 'var(--color-bg)', 
                        padding: '0.625rem 0.85rem', 
                        borderRadius: 'var(--radius-lg)', 
                        border: '1px solid var(--color-border)', 
                        color: 'var(--color-text-muted)', 
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}>
                        {editFileExt}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Danh mục</label>
                    <CustomSelect
                      options={categories.filter(c => c.id !== 'all').map(c => ({ value: c.id, label: c.label }))}
                      value={editFormData.category}
                      onChange={val => setEditFormData({ ...editFormData, category: String(val) })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Quyền riêng tư</label>
                    <CustomSelect
                      options={[
                        { value: 'shared', label: 'Chia sẻ (Shared)' },
                        { value: 'personal', label: 'Cá nhân (Personal)' }
                      ]}
                      value={editFormData.visibility}
                      onChange={val => setEditFormData({ ...editFormData, visibility: String(val) })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Dự án liên kết</label>
                    <CustomSelect
                      searchable
                      direction="up"
                      options={[
                        { value: '', label: 'Không liên kết' },
                        ...projects.map(p => ({ value: String(p.id), label: p.name }))
                      ]}
                      value={editFormData.project_id}
                      onChange={val => {
                        const nextProj = String(val);
                        let nextCamp = editFormData.campaign_id;
                        if (nextCamp) {
                          const c = campaigns.find(x => String(x.id) === nextCamp);
                          if (c && String(c.project_id) !== nextProj) {
                            nextCamp = '';
                          }
                        }
                        setEditFormData({ ...editFormData, project_id: nextProj, campaign_id: nextCamp });
                      }}
                      placeholder="Chọn dự án..."
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Chiến dịch liên kết</label>
                    <CustomSelect
                      searchable
                      direction="up"
                      options={[
                        { value: '', label: 'Không liên kết' },
                        ...campaigns
                          .filter(c => !editFormData.project_id || String(c.project_id) === editFormData.project_id)
                          .map(c => ({ value: String(c.id), label: c.name }))
                      ]}
                      value={editFormData.campaign_id}
                      onChange={val => {
                        const nextCamp = String(val);
                        let nextProj = editFormData.project_id;
                        if (nextCamp) {
                          const c = campaigns.find(x => String(x.id) === nextCamp);
                          if (c && c.project_id) {
                            nextProj = String(c.project_id);
                          }
                        }
                        setEditFormData({ ...editFormData, campaign_id: nextCamp, project_id: nextProj });
                      }}
                      placeholder="Chọn chiến dịch..."
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ gap: '1rem' }}>
                <button className="btn secondary flex-1" onClick={() => setShowEditModal(false)}>Hủy</button>
                <button className="btn primary flex-1" onClick={handleUpdateFile} disabled={loading}>
                  {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
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
                 <button className="btn secondary flex-1" onClick={() => setShowCatModal(false)} disabled={isSavingCategory}>Hủy</button>
                 <button className="btn primary flex-1" onClick={handleSaveCategory} disabled={isSavingCategory}>
                   {isSavingCategory ? 'Đang lưu...' : (editingCat ? 'Cập nhật' : 'Thêm ngay')}
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
